import { KafkaConsumer, Producer } from 'node-rdkafka';
import * as R from 'ramda';
import { ITask } from './task';
import { jsonTryParse } from './utils/common';
import { TaskTypes, TaskStates } from './constants/task';
import { EventEmitter } from 'events';

const DEFAULT_PM_CONFIG = {
  namespace: 'node',
  maximumPollingTasks: 100,
  pollingCooldown: 1,
  processTimeoutTask: false,
  autoStart: true,
};

export { TaskTypes, TaskStates } from './constants/task';

export interface IEvent {
  transactionId: string;
  type: 'TRANSACTION' | 'WORKFLOW' | 'TASK' | 'SYSTEM';
  details?: any;
  timestamp: number;
  isError: boolean;
  error?: string;
}

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
  namespace?: string;
  maximumPollingTasks?: number;
  pollingCooldown?: number;
  processTimeoutTask?: boolean;
  autoStart?: boolean;
}

export interface IAdminConfig {
  kafkaServers: string;
  namespace?: string;
  adminId: string;
}

export interface IWorkflowRef {
  name: string;
  rev: string;
}

const mapTaskNameToTopic = (taskName: string, prefix: string) =>
  `${prefix}.saga.task.${taskName}`;

const isTaskTimeout = (task: ITask): boolean => {
  const elapsedTime = Date.now() - task.startTime;
  return (
    (task.ackTimeout > 0 && task.ackTimeout < elapsedTime) ||
    (task.timeout > 0 && task.timeout < elapsedTime)
  );
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

export class Admin extends EventEmitter {
  consumer: KafkaConsumer;
  producer: Producer;
  private adminConfig: IAdminConfig;
  private watchingTransactions: string[] = [];

  constructor(adminConfig: IAdminConfig, kafkaConfig: any) {
    super();

    this.adminConfig = adminConfig;
    if (adminConfig.adminId) {
      this.consumer = new KafkaConsumer(
        {
          'bootstrap.servers': adminConfig.kafkaServers,
          'group.id': adminConfig.adminId,
          'enable.auto.commit': 'true',
          ...kafkaConfig,
        },
        { 'auto.offset.reset': 'latest' }, //Don't poll old events
      );

      this.consumer.on('ready', () => {
        this.consumer.subscribe([`${this.adminConfig.namespace}.saga.store`]);
        this.poll();
      });

      this.consumer.connect();
    }

    this.producer = new Producer(
      { 'bootstrap.servers': adminConfig.kafkaServers, ...kafkaConfig },
      {},
    );

    this.producer.connect();
  }

  startTransaction = (
    transactionId: string,
    workflow: IWorkflowRef,
    input: any,
  ) => {
    if (!transactionId) throw new Error('transactionId is required');
    this.producer.produce(
      `${this.adminConfig.namespace}.saga.command`,
      null,
      Buffer.from(
        JSON.stringify({
          type: 'START_TRANSACTION',
          transactionId,
          workflow,
          input,
        }),
      ),
      transactionId,
    );
  };

  consume = (messageNumber: number = 100): Promise<IEvent[]> => {
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

  private poll = async () => {
    try {
      const events = await this.consume();
      if (events.length > 0) {
        for (const event of events) {
          if (this.watchingTransactions.includes(event.transactionId)) {
            this.emit(event.type, event);
          }
        }
        this.consumer.commit();
      }
    } finally {
      // In case of consume error
      setImmediate(this.poll);
    }
  };

  subscribe = (transactionId: string): void => {
    if (!this.adminConfig.adminId)
      throw new Error(`adminConfig.adminId is required for this feature`);
    if (!this.watchingTransactions.includes(transactionId)) {
      this.watchingTransactions.push(transactionId);
    }
  };

  unsubscribe = (transactionId: string): void => {
    if (!this.watchingTransactions.includes(transactionId)) {
      this.watchingTransactions = this.watchingTransactions.filter(
        tId => tId !== transactionId,
      );
    }
  };
}

// Maybe use kafka streamAPI
export class Worker {
  private consumer: KafkaConsumer;
  private producer: Producer;
  pmConfig: IPmConfig;
  private isSubscribed: boolean = false;
  private taskCallback: (
    task: ITask,
    logger: (message: string) => void,
    isTimeout: boolean,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private compensateCallback: (
    task: ITask,
    logger: (message: string) => void,
    isTimeout: boolean,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private runningTasks: {
    [taskId: string]: ITask;
  } = {};

  constructor(
    tasksName: string | string[],
    taskCallback: (
      task: ITask,
      logger: (message: string) => void,
      isTimeout: boolean,
    ) => ITaskResponse | Promise<ITaskResponse>,
    compensateCallback: (
      task: ITask,
      logger: (message: string) => void,
      isTimeout: boolean,
    ) => ITaskResponse | Promise<ITaskResponse>,
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
        'group.id': `saga-${this.pmConfig.namespace}.client`,
        'enable.auto.commit': 'false',
        ...kafkaConfig,
      },
      { 'auto.offset.reset': 'earliest' },
    );
    this.producer = new Producer(
      { 'bootstrap.servers': pmConfig.kafkaServers, ...kafkaConfig },
      {},
    );

    this.consumer.on('ready', () => {
      if (Array.isArray(tasksName)) {
        this.consumer.subscribe(
          tasksName.map((taskName: string) =>
            mapTaskNameToTopic(taskName, this.pmConfig.namespace),
          ),
        );
      } else {
        this.consumer.subscribe([
          mapTaskNameToTopic(tasksName, this.pmConfig.namespace),
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

  get health(): {
    consumer: 'connected' | 'disconnected';
    producer: 'connected' | 'disconnected';
    tasks: { [taskId: string]: ITask };
  } {
    return {
      consumer: this.consumer.isConnected() ? 'connected' : 'disconnected',
      producer: this.producer.isConnected() ? 'connected' : 'disconnected',
      tasks: this.runningTasks,
    };
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
      `${this.pmConfig.namespace}.saga.event`,
      null,
      Buffer.from(
        JSON.stringify({
          transactionId: task.transactionId,
          taskId: task.taskId,
          status: result.status,
          output: result.output,
          logs: result.logs,
        }),
      ),
      task.transactionId,
    );
  };

  commit = () => {
    return this.consumer.commit();
  };

  private dispatchTask = async (task: ITask, isTimeout: boolean) => {
    const logger = (logs: string) => {
      this.updateTask(task, {
        status: TaskStates.Inprogress,
        logs,
      });
    };

    switch (task.type) {
      case TaskTypes.Task:
        return await this.taskCallback(task, logger, isTimeout);
      case TaskTypes.Compensate:
        return await this.compensateCallback(task, logger, isTimeout);
      default:
        throw new Error(`Task type: "${task.type}" is invalid`);
    }
  };

  private processTask = async (task: ITask) => {
    const isTimeout = isTaskTimeout(task);
    if (isTimeout && this.pmConfig.processTimeoutTask === false) return;
    this.updateTask(task, {
      status: TaskStates.Inprogress,
    });

    this.runningTasks[task.taskId] = task;

    try {
      const result = await this.dispatchTask(task, isTimeout);
      this.updateTask(task, validateTaskResult(result));
    } catch (error) {
      this.updateTask(task, {
        status: TaskStates.Failed,
        output: {
          error: error.toString(),
        },
      });
    } finally {
      delete this.runningTasks[task.taskId];
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
