import { Event, Kafka, Task } from '@melonade/melonade-declaration';
import axios from 'axios';
import { EventEmitter } from 'events';
import {
  ConsumerGlobalConfig,
  KafkaConsumer,
  LibrdKafkaError,
  Message,
} from 'node-rdkafka';
import { jsonTryParse } from './utils/common';
import {
  isTaskTimeout,
  ITaskRef,
  ITaskResponse,
  mapTaskNameToTopic,
} from './worker';

export interface ISyncWorkerConfig {
  processManagerUrl: string;
  kafkaServers: string;
  namespace?: string;
  maximumPollingTasks?: number;
  pollingCooldown?: number;
  processTimeoutTask?: boolean;
  autoStart?: boolean;
  latencyCompensationMs?: number;
  trackingRunningTasks?: boolean;
}

export interface ISyncUpdateTask {
  (task: ITaskRef, result: ITaskResponse): Promise<void>;
}

const DEFAULT_WORKER_CONFIG = {
  namespace: 'node',
  maximumPollingTasks: 100,
  pollingCooldown: 1,
  processTimeoutTask: false,
  autoStart: true,
  latencyCompensationMs: 50,
  trackingRunningTasks: false,
} as ISyncWorkerConfig;

// Maybe use kafka streamAPI
export class SyncWorker extends EventEmitter {
  private consumer: KafkaConsumer;
  workerConfig: ISyncWorkerConfig;
  private isSubscribed: boolean = false;
  private taskCallback: (
    task: Task.ITask,
    updateTask: ISyncUpdateTask,
    isTimeout: boolean,
  ) => void | Promise<void>;
  private compensateCallback: (
    task: Task.ITask,
    updateTask: ISyncUpdateTask,
    isTimeout: boolean,
  ) => void | Promise<void>;
  private runningTasks: {
    [taskId: string]: Task.ITask;
  } = {};
  private tasksName: string | string[];

  constructor(
    tasksName: string | string[],
    taskCallback: (
      task: Task.ITask,
      updateTask: ISyncUpdateTask,
      isTimeout: boolean,
    ) => void | Promise<void>,
    compensateCallback: (
      task: Task.ITask,
      updateTask: ISyncUpdateTask,
      isTimeout: boolean,
    ) => void | Promise<void>,
    workerConfig: ISyncWorkerConfig,
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

    this.consumer.on('ready', () => {
      this.emit('ready');

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

    process.once('SIGTERM', () => {
      this.consumer.unsubscribe();
    });
  }

  get health(): {
    consumer: 'connected' | 'disconnected';
    tasks: { [taskId: string]: Task.ITask };
  } {
    return {
      consumer: this.consumer.isConnected() ? 'connected' : 'disconnected',
      tasks: this.runningTasks,
    };
  }

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

  updateTask = async (task: ITaskRef, result: ITaskResponse) => {
    await axios.post(
      'v1/transaction/update',
      {
        transactionId: task.transactionId,
        taskId: task.taskId,
        status: result.status,
        output: result.output,
        logs: result.logs,
        isSystem: false,
        doNotRetry: result.doNotRetry,
      } as Event.ITaskUpdate,
      {
        baseURL: this.workerConfig.processManagerUrl,
      },
    );
    return;
  };

  commit = () => {
    return this.consumer.commit();
  };

  private dispatchTask = async (task: Task.ITask, isTimeout: boolean) => {
    switch (task.type) {
      case Task.TaskTypes.Task:
        return await this.taskCallback(task, this.updateTask, isTimeout);
      case Task.TaskTypes.Compensate:
        return await this.compensateCallback(task, this.updateTask, isTimeout);
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

    if (this.workerConfig.trackingRunningTasks) {
      this.runningTasks[task.taskId] = task;
    }

    try {
      await this.dispatchTask(task, isTimeout);
    } catch (error) {
      console.warn(this.tasksName, error);
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
