import { KafkaConsumer, Producer } from 'node-rdkafka';
import * as R from 'ramda';
import { ITask } from './task';
import { jsonTryParse } from './utils/common';
import { TaskTypes, TaskStates } from './constants/task';

const DEFAULT_PM_CONFIG = {
  kafkaTopicPrefix: 'node',
  maximumPollingTasks: 100,
  pollingCooldown: 1,
  processTimeoutTask: false,
  autoStart: true,
};

export interface ITaskResponse {
  status: TaskStates.Inprogress | TaskStates.Completed | TaskStates.Failed;
  output?: any;
  logs?: string | string[];
}

export interface IKafkaConsumerMessage {
  value: Buffer;
  size: number;
  key: string;
  topic: string;
  offset: number;
  partition: number;
}

export interface IPmConfig {
  kafkaServers: string;
  kafkaTopicPrefix?: string;
  maximumPollingTasks?: number;
  pollingCooldown?: number;
  processTimeoutTask?: boolean;
  autoStart?: boolean;
}

const mapTaskNameToTopic = (taskName: string, prefix: string) =>
  `${prefix}.saga.task.${taskName}`;

const isTaskTimeout = (task: ITask): boolean => {
  const elapsedTime = Date.now() - task.startTime;
  return task.ackTimeout >= elapsedTime || task.timeout >= elapsedTime;
};

const validateTaskResult = (result: ITaskResponse): ITaskResponse => {
  const status = R.prop('status', result);
  if (
    ![TaskStates.Inprogress, TaskStates.Completed, TaskStates.Failed].includes(
      status,
    )
  ) {
    return {
      status: TaskStates.Failed,
      output: {
        error: `"${status}" is invalid status`,
      },
    };
  }

  return result;
};

export class Worker {
  private consumer: KafkaConsumer;
  private producer: Producer;
  pmConfig: IPmConfig;
  private isSubscribed: boolean = false;
  private taskCallback: (
    task: ITask,
    isTimeout: boolean,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private compensateCallback: (
    task: ITask,
    isTimeout: boolean,
  ) => ITaskResponse | Promise<ITaskResponse>;

  constructor(
    tasksName: string | string[],
    taskCallback: (task: ITask) => ITaskResponse | Promise<ITaskResponse>,
    compensateCallback: (task: ITask) => ITaskResponse | Promise<ITaskResponse>,
    pmConfig: IPmConfig,
    kafkaConfig: any = {},
  ) {
    this.taskCallback = taskCallback;
    this.compensateCallback = compensateCallback;
    this.pmConfig = {
      ...DEFAULT_PM_CONFIG,
      ...pmConfig,
    };

    this.consumer = new KafkaConsumer(
      {
        'bootstrap.servers': pmConfig.kafkaServers,
        'group.id': `${this.pmConfig.kafkaTopicPrefix}.node.client`,
        'enable.auto.commit': 'false',
        ...kafkaConfig,
      },
      {},
    );
    this.producer = new Producer(
      { 'bootstrap.servers': pmConfig.kafkaServers, ...kafkaConfig },
      {},
    );

    this.consumer.on('ready', () => {
      if (Array.isArray(tasksName)) {
        this.consumer.subscribe(
          tasksName.map((taskName: string) =>
            mapTaskNameToTopic(taskName, this.pmConfig.kafkaTopicPrefix),
          ),
        );
      } else {
        this.consumer.subscribe([
          mapTaskNameToTopic(tasksName, this.pmConfig.kafkaTopicPrefix),
        ]);
      }

      if (this.pmConfig.autoStart) {
        this.subscribe();
      }
    });

    this.consumer.setDefaultConsumeTimeout(this.pmConfig.pollingCooldown);
    this.consumer.connect();
    this.producer.connect();
  }

  consume = (
    messageNumber: number = this.pmConfig.maximumPollingTasks,
  ): Promise<ITask[]> => {
    return new Promise((resolve: Function, reject: Function) => {
      this.consumer.consume(
        messageNumber,
        (error: Error, messages: IKafkaConsumerMessage[]) => {
          if (error) return reject(error);
          resolve(
            messages.map((message: IKafkaConsumerMessage) =>
              jsonTryParse(message.value.toString(), undefined),
            ),
          );
        },
      );
    });
  };

  updateTask = (task: ITask, result: ITaskResponse) => {
    return this.producer.produce(
      `${this.pmConfig.kafkaTopicPrefix}.saga.event`,
      null,
      JSON.stringify({
        transactionId: task.transactionId,
        taskId: task.taskId,
        status: result.status,
        output: result.output,
        logs: result.logs,
      }),
      null,
    );
  };

  commit = () => {
    return this.consumer.commit();
  };

  private processTask = async (task: ITask) => {
    const isTimeout = isTaskTimeout(task);
    if (isTimeout && this.pmConfig.processTimeoutTask === false) return;
    try {
      switch (task.type) {
        case TaskTypes.Task:
          return this.updateTask(
            task,
            validateTaskResult(await this.taskCallback(task, isTimeout)),
          );
        case TaskTypes.Compensate:
          return this.updateTask(
            task,
            validateTaskResult(await this.compensateCallback(task, isTimeout)),
          );
        default:
          break;
      }
    } catch (error) {
      this.updateTask(task, {
        status: TaskStates.Failed,
        output: {
          error: error.toString(),
        },
      });
    }
  };

  private poll = async () => {
    try {
      const tasks = await this.consume();
      if (tasks.length > 0) {
        await Promise.all(tasks.map(this.processTask));
        this.commit();
      }
    } finally {
      // In case of consume error

      // Check if still isSubscribed
      if (this.isSubscribed) {
        setImmediate(this.poll);
      }
    }
  };

  subscribe = () => {
    if (!this.isSubscribed) {
      this.isSubscribed = true;
      this.poll();
    }
  };

  unsubscribe = () => {
    this.isSubscribed = false;
  };
}
