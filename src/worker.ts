import { Event, Kafka, State, Task } from '@melonade/melonade-declaration';
import { EventEmitter } from 'events';
import {
  ConsumerGlobalConfig,
  KafkaConsumer,
  LibrdKafkaError,
  Message,
  Producer,
} from 'node-rdkafka';
import * as R from 'ramda';
import { jsonTryParse } from './utils/common';

export interface IWorkerConfig {
  kafkaServers: string;
  namespace?: string;
  maximumPollingTasks?: number;
  pollingCooldown?: number;
  processTimeoutTask?: boolean;
  autoStart?: boolean;
  latencyCompensationMs?: number;
  trackingRunningTasks?: boolean;
}

export interface ITaskResponse {
  status:
    | State.TaskStates.Inprogress
    | State.TaskStates.Completed
    | State.TaskStates.Failed;
  output?: any;
  logs?: string | string[];
  doNotRetry?: boolean;
}

export interface ITaskRef {
  transactionId: string;
  taskId: string;
}

export interface IUpdateTask {
  (task: ITaskRef, result: ITaskResponse): void;
}

const DEFAULT_WORKER_CONFIG = {
  namespace: 'node',
  maximumPollingTasks: 100,
  pollingCooldown: 1,
  processTimeoutTask: false,
  autoStart: true,
  latencyCompensationMs: 50,
  trackingRunningTasks: false,
} as IWorkerConfig;

const alwaysCompleteFunction = (): ITaskResponse => ({
  status: State.TaskStates.Completed,
});

const mapTaskNameToTopic = (taskName: string, prefix: string) =>
  `melonade.${prefix}.task.${taskName}`;

const isTaskTimeout = (
  task: Task.ITask,
  latencyCompensationMs: number = 0,
): boolean => {
  const elapsedTime = Date.now() - task.startTime + latencyCompensationMs;
  return (
    (task.ackTimeout > 0 && task.ackTimeout < elapsedTime) ||
    (task.timeout > 0 && task.timeout < elapsedTime)
  );
};

const validateTaskResult = (result: ITaskResponse): ITaskResponse => {
  const status = R.prop('status', result);
  if (
    ![
      State.TaskStates.Inprogress,
      State.TaskStates.Completed,
      State.TaskStates.Failed,
    ].includes(status)
  ) {
    return {
      status: State.TaskStates.Failed,
      output: {
        error: `"${status}" is invalid status`,
      },
    };
  }

  return result;
};

// Maybe use kafka streamAPI
export class Worker extends EventEmitter {
  private consumer: KafkaConsumer;
  private producer: Producer;
  workerConfig: IWorkerConfig;
  private isSubscribed: boolean = false;
  private taskCallback: (
    task: Task.ITask,
    logger: (message: string) => void,
    isTimeout: boolean,
    updateTask: IUpdateTask,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private compensateCallback: (
    task: Task.ITask,
    logger: (message: string) => void,
    isTimeout: boolean,
    updateTask: IUpdateTask,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private runningTasks: {
    [taskId: string]: Task.ITask;
  } = {};
  private tasksName: string | string[];

  constructor(
    tasksName: string | string[],
    taskCallback: (
      task: Task.ITask,
      logger: (message: string) => void,
      isTimeout: boolean,
      updateTask: IUpdateTask,
    ) => ITaskResponse | Promise<ITaskResponse>,
    compensateCallback: (
      task: Task.ITask,
      logger: (message: string) => void,
      isTimeout: boolean,
      updateTask: IUpdateTask,
    ) => ITaskResponse | Promise<ITaskResponse> = alwaysCompleteFunction,
    workerConfig: IWorkerConfig,
    kafkaConfig: ConsumerGlobalConfig = {},
  ) {
    super();

    this.tasksName = tasksName;
    this.taskCallback = taskCallback;
    this.compensateCallback = compensateCallback;
    this.workerConfig = {
      ...DEFAULT_WORKER_CONFIG,
      ...workerConfig,
    };

    this.consumer = new KafkaConsumer(
      {
        'bootstrap.servers': workerConfig.kafkaServers,
        'group.id': `melonade-${this.workerConfig.namespace}.client`,
        'enable.auto.commit': false,
        ...kafkaConfig,
      },
      { 'auto.offset.reset': 'earliest' },
    );
    this.producer = new Producer(
      {
        'compression.type': 'snappy',
        'enable.idempotence': false,
        retries: 100,
        'socket.keepalive.enable': true,
        'queue.buffering.max.messages': 100000,
        'queue.buffering.max.ms': 1,
        'batch.num.messages': 10000,
        'bootstrap.servers': workerConfig.kafkaServers,
        ...kafkaConfig,
      },
      {},
    );

    this.consumer.on('ready', () => {
      if (this.isWorkerClientReady()) {
        this.emit('ready');
      }

      if (Array.isArray(tasksName)) {
        this.consumer.subscribe(
          tasksName.map((taskName: string) =>
            mapTaskNameToTopic(taskName, this.workerConfig.namespace),
          ),
        );
      } else {
        this.consumer.subscribe([
          mapTaskNameToTopic(tasksName, this.workerConfig.namespace),
        ]);
      }

      if (this.workerConfig.autoStart) {
        this.subscribe();
      }
    });
    this.consumer.setDefaultConsumeTimeout(this.workerConfig.pollingCooldown);
    this.consumer.connect();

    this.producer.on('ready', () => {
      if (this.isWorkerClientReady()) {
        this.emit('ready');
      }
    });
    this.producer.setPollInterval(100);
    this.producer.connect();

    process.once('SIGTERM', () => {
      this.consumer.unsubscribe();

      // setTimeout(() => {
      //   process.exit(0);
      // }, 1000);
    });
  }

  get health(): {
    consumer: 'connected' | 'disconnected';
    producer: 'connected' | 'disconnected';
    tasks: { [taskId: string]: Task.ITask };
  } {
    return {
      consumer: this.consumer.isConnected() ? 'connected' : 'disconnected',
      producer: this.producer.isConnected() ? 'connected' : 'disconnected',
      tasks: this.runningTasks,
    };
  }

  private isWorkerClientReady = (): boolean => {
    return this.producer.isConnected() && this.consumer.isConnected();
  };

  consume = (
    messageNumber: number = this.workerConfig.maximumPollingTasks,
  ): Promise<Task.ITask[]> => {
    return new Promise((resolve: Function, reject: Function) => {
      this.consumer.consume(
        messageNumber,
        (error: LibrdKafkaError, messages: Message[]) => {
          if (error) {
            setTimeout(() => reject(error), 1000);
          } else {
            resolve(
              messages.map((message: Kafka.kafkaConsumerMessage) =>
                jsonTryParse(message.value.toString(), undefined),
              ),
            );
          }
        },
      );
    });
  };

  updateTask = (task: ITaskRef, result: ITaskResponse) => {
    return this.producer.produce(
      `melonade.${this.workerConfig.namespace}.event`,
      null,
      Buffer.from(
        JSON.stringify({
          transactionId: task.transactionId,
          taskId: task.taskId,
          status: result.status,
          output: result.output,
          logs: result.logs,
          isSystem: false,
          doNotRetry: result.doNotRetry,
        } as Event.ITaskUpdate),
      ),
      task.transactionId,
      Date.now(),
    );
  };

  commit = () => {
    return this.consumer.commit();
  };

  private dispatchTask = async (task: Task.ITask, isTimeout: boolean) => {
    const t = R.clone(task);
    const logger = (logs: string) => {
      this.updateTask(t, {
        status: State.TaskStates.Inprogress,
        logs,
      });
    };

    switch (task.type) {
      case Task.TaskTypes.Task:
        return await this.taskCallback(t, logger, isTimeout, this.updateTask);
      case Task.TaskTypes.Compensate:
        return await this.compensateCallback(
          t,
          logger,
          isTimeout,
          this.updateTask,
        );
      default:
        throw new Error(`Task type: "${task.type}" is invalid`);
    }
  };

  private processTask = async (task: Task.ITask) => {
    const isTimeout = isTaskTimeout(
      task,
      this.workerConfig.latencyCompensationMs,
    );
    if (isTimeout && this.workerConfig.processTimeoutTask === false) {
      this.emit('task-timeout', task);
      return;
    }
    this.updateTask(task, {
      status: State.TaskStates.Inprogress,
    });

    if (this.workerConfig.trackingRunningTasks) {
      this.runningTasks[task.taskId] = task;
    }

    try {
      const result = await this.dispatchTask(task, isTimeout);
      this.updateTask(task, validateTaskResult(result));
    } catch (error) {
      try {
        this.updateTask(task, {
          status: State.TaskStates.Failed,
          output: {
            error: error.toString(),
          },
        });
      } catch (error) {
        console.warn(this.tasksName, error);
      }
    } finally {
      if (this.workerConfig.trackingRunningTasks) {
        delete this.runningTasks[task.taskId];
      }
    }
  };

  private poll = async () => {
    // https://github.com/nodejs/node/issues/6673
    while (this.isSubscribed) {
      try {
        const tasks = await this.consume();
        if (tasks.length > 0) {
          await Promise.all(tasks.map(this.processTask));
          this.commit();
        }
      } catch (err) {
        // In case of consume error
        console.log(this.tasksName, err);
      }
    }

    console.log(`Stop subscribed ${this.tasksName}`);
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
