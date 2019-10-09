import { KafkaConsumer, Producer } from '@nv4re/node-rdkafka';
import {
  Task,
  State,
  Event,
  Kafka,
  Command,
} from '@melonade/melonade-declaration';
import * as R from 'ramda';
import { jsonTryParse } from './utils/common';
import { EventEmitter } from 'events';

const DEFAULT_PM_CONFIG = {
  namespace: 'node',
  maximumPollingTasks: 100,
  pollingCooldown: 1,
  processTimeoutTask: false,
  autoStart: true,
};

export interface ITaskResponse {
  status:
    | State.TaskStates.Inprogress
    | State.TaskStates.Completed
    | State.TaskStates.Failed;
  output?: any;
  logs?: string | string[];
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
  `melonade.${prefix}.task.${taskName}`;

const isTaskTimeout = (task: Task.ITask): boolean => {
  const elapsedTime = Date.now() - task.startTime;
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
        this.consumer.subscribe([
          `melonade.${this.adminConfig.namespace}.store`,
        ]);
        this.poll();
      });

      this.consumer.setDefaultConsumeTimeout(1);
      this.consumer.connect();
    }

    this.producer = new Producer(
      { 'bootstrap.servers': adminConfig.kafkaServers, ...kafkaConfig },
      {},
    );

    this.producer.setPollInterval(100);
    this.producer.connect();
  }

  startTransaction = (
    transactionId: string,
    workflow: IWorkflowRef,
    input: any,
  ) => {
    if (!transactionId) throw new Error('transactionId is required');
    this.producer.produce(
      `melonade.${this.adminConfig.namespace}.command`,
      null,
      Buffer.from(
        JSON.stringify({
          type: Command.CommandTypes.StartTransaction,
          transactionId,
          workflow,
          input,
        }),
      ),
      transactionId,
      Date.now(),
    );
  };

  cancleTransaction = (transactionId: string) => {
    if (!transactionId) throw new Error('transactionId is required');
    this.producer.produce(
      `melonade.${this.adminConfig.namespace}.command`,
      null,
      Buffer.from(
        JSON.stringify({
          type: Command.CommandTypes.CancelTransaction,
          transactionId,
        }),
      ),
      transactionId,
      Date.now(),
    );
  };

  consume = (messageNumber: number = 100): Promise<Event.AllEvent[]> => {
    return new Promise((resolve: Function, reject: Function) => {
      this.consumer.consume(
        messageNumber,
        (error: Error, messages: Kafka.kafkaConsumerMessage[]) => {
          if (error) return reject(error);
          resolve(
            messages.map((message: Kafka.kafkaConsumerMessage) =>
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
    task: Task.ITask,
    logger: (message: string) => void,
    isTimeout: boolean,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private compensateCallback: (
    task: Task.ITask,
    logger: (message: string) => void,
    isTimeout: boolean,
  ) => ITaskResponse | Promise<ITaskResponse>;
  private runningTasks: {
    [taskId: string]: Task.ITask;
  } = {};

  constructor(
    tasksName: string | string[],
    taskCallback: (
      task: Task.ITask,
      logger: (message: string) => void,
      isTimeout: boolean,
    ) => ITaskResponse | Promise<ITaskResponse>,
    compensateCallback: (
      task: Task.ITask,
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
        'group.id': `melonade-${this.pmConfig.namespace}.client`,
        'enable.auto.commit': 'false',
        ...kafkaConfig,
      },
      { 'auto.offset.reset': 'earliest' },
    );
    this.producer = new Producer(
      {
        'compression.type': 'snappy',
        'enable.idempotence': 'true',
        'message.send.max.retries': '100000',
        'socket.keepalive.enable': 'true',
        'queue.buffering.max.messages': '10000',
        'queue.buffering.max.ms': '1',
        'batch.num.messages': '100',
        'bootstrap.servers': pmConfig.kafkaServers,
        ...kafkaConfig,
      },
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

    this.producer.setPollInterval(100);
    this.producer.connect();
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

  consume = (
    messageNumber: number = this.pmConfig.maximumPollingTasks,
  ): Promise<Task.ITask[]> => {
    return new Promise((resolve: Function, reject: Function) => {
      this.consumer.consume(
        messageNumber,
        (error: Error, messages: Kafka.kafkaConsumerMessage[]) => {
          if (error) return reject(error);
          resolve(
            messages.map((message: Kafka.kafkaConsumerMessage) =>
              jsonTryParse(message.value.toString(), undefined),
            ),
          );
        },
      );
    });
  };

  updateTask = (task: Task.ITask, result: ITaskResponse) => {
    return this.producer.produce(
      `melonade.${this.pmConfig.namespace}.event`,
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
      Date.now(),
    );
  };

  commit = () => {
    return this.consumer.commit();
  };

  private dispatchTask = async (task: Task.ITask, isTimeout: boolean) => {
    const logger = (logs: string) => {
      this.updateTask(task, {
        status: State.TaskStates.Inprogress,
        logs,
      });
    };

    switch (task.type) {
      case Task.TaskTypes.Task:
        return await this.taskCallback(task, logger, isTimeout);
      case Task.TaskTypes.Compensate:
        return await this.compensateCallback(task, logger, isTimeout);
      default:
        throw new Error(`Task type: "${task.type}" is invalid`);
    }
  };

  private processTask = async (task: Task.ITask) => {
    const isTimeout = isTaskTimeout(task);
    if (isTimeout && this.pmConfig.processTimeoutTask === false) return;
    this.updateTask(task, {
      status: State.TaskStates.Inprogress,
    });

    this.runningTasks[task.taskId] = task;

    try {
      const result = await this.dispatchTask(task, isTimeout);
      this.updateTask(task, validateTaskResult(result));
    } catch (error) {
      this.updateTask(task, {
        status: State.TaskStates.Failed,
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
