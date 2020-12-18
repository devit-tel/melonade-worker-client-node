import { Event, Kafka, Task } from '@melonade/melonade-declaration';
import axios from 'axios';
import { EventEmitter } from 'events';
import {
  ConsumerGlobalConfig,
  KafkaConsumer,
  LibrdKafkaError,
  Message,
} from 'node-rdkafka';
import { timeout, TimeoutError } from 'promise-timeout';
import * as R from 'ramda';
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
  batchTimeoutMs?: number;
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
  batchTimeoutMs: 10 * 60 * 1000, // 10 mins
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
    [taskId: string]: Task.ITask | string;
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

    var tn = '';
    if (Array.isArray(tasksName)) {
      tn = tasksName.join('-');
    } else {
      tn = tasksName;
    }

    this.consumer = new KafkaConsumer(
      {
        'bootstrap.servers': workerConfig.kafkaServers,
        'group.id': `melonade-${this.workerConfig.namespace}-client-${tn}`,
        'enable.auto.commit': false,
        'max.poll.interval.ms': Math.max(
          300000,
          this.workerConfig.batchTimeoutMs * 5,
        ),
        ...kafkaConfig,
      },
      { 'auto.offset.reset': 'latest' },
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
      console.log(`${this.tasksName}: unsubscribed`);
      this.consumer.unsubscribe();
    });
  }

  get health(): {
    consumer: 'connected' | 'disconnected';
    tasks: { [taskId: string]: Task.ITask | string };
  } {
    return {
      consumer: this.consumer.isConnected() ? 'connected' : 'disconnected',
      tasks: this.runningTasks,
    };
  }

  consume = (
    messageNumber: number = this.workerConfig.maximumPollingTasks,
  ): Promise<Task.ITask[]> => {
    return new Promise((resolve: Function) => {
      this.consumer.consume(
        messageNumber,
        (error: LibrdKafkaError, messages: Message[]) => {
          if (error) {
            console.log(`${this.tasksName}: consume error`, error);
            setTimeout(() => resolve([]), 1000);
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
    try {
      // @ts-ignore
      this.consumer.commitSync();
    } catch (error) {
      console.log(`${this.tasksName}: commit error`, error);
    }
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
    } else {
      this.runningTasks[task.taskId] = task.taskId;
    }

    try {
      await this.dispatchTask(task, isTimeout);
    } catch (error) {
      console.warn(this.tasksName, error);
    } finally {
      delete this.runningTasks[task.taskId];
    }
  };

  private poll = async () => {
    // https://github.com/nodejs/node/issues/6673
    while (this.isSubscribed) {
      const tasks = await this.consume();
      if (tasks.length > 0) {
        try {
          if (this.workerConfig.batchTimeoutMs > 0) {
            await timeout(
              Promise.all(tasks.map(this.processTask)),
              this.workerConfig.batchTimeoutMs,
            );
          } else {
            await Promise.all(tasks.map(this.processTask));
          }
        } catch (error) {
          if (error instanceof TimeoutError) {
            console.log(
              `${this.tasksName}: batch timeout`,
              R.keys(this.runningTasks),
            );
          } else {
            console.log(this.tasksName, 'process error', error);
          }
        } finally {
          this.commit();
        }
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
