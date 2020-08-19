import {
  Command,
  Event,
  Kafka,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import { EventEmitter } from 'events';
import {
  KafkaConsumer,
  LibrdKafkaError,
  Message,
  Producer,
} from 'node-rdkafka';
import { jsonTryParse } from './utils/common';
import { ITaskRef, ITaskResponse } from './worker';

export interface IAdminConfig {
  kafkaServers: string;
  namespace?: string;
  adminId?: string;
  subscribeToAllTransaction?: boolean;
}

export enum EventTypes {
  TransactionEvent = 'TRANSACTION_EVENT',
  TransactionFalseEvent = 'TRANSACTION_FALSE_EVENT',
  WorkflowEvent = 'WORKFLOW_EVENT',
  WorkflowFalseEvent = 'WORKFLOW_FALSE_EVENT',
  TaskEvent = 'TASK_EVENT',
  TaskFalseEvent = 'TASK_FALSE_EVENT',
  SystemEvent = 'SYSTEM_EVENT',
  SystemFalseEvent = 'SYSTEM_FALSE_EVENT',
}

export declare interface Admin {
  on(
    event: EventTypes.TransactionEvent,
    listener: (event: Event.ITransactionEvent) => void,
  ): this;
  on(
    event: EventTypes.WorkflowEvent,
    listener: (event: Event.IWorkflowEvent) => void,
  ): this;
  on(
    event: EventTypes.TaskEvent,
    listener: (event: Event.ITaskEvent) => void,
  ): this;
  on(
    event: EventTypes.TransactionFalseEvent,
    listener: (event: Event.ITransactionErrorEvent) => void,
  ): this;
  on(
    event: EventTypes.WorkflowFalseEvent,
    listener: (event: Event.IWorkflowErrorEvent) => void,
  ): this;
  on(
    event: EventTypes.TaskFalseEvent,
    listener: (event: Event.ITaskErrorEvent) => void,
  ): this;
  on(
    event: EventTypes.SystemFalseEvent,
    listener: (event: Event.ISystemErrorEvent) => void,
  ): this;
  on(
    event: EventTypes.SystemFalseEvent,
    listener: (event: Event.ISystemErrorEvent) => void,
  ): this;
  on(event: 'ready', listener: () => void): this;
}

export class Admin extends EventEmitter {
  consumer?: KafkaConsumer;
  producer: Producer;
  private adminConfig: IAdminConfig;
  private watchingTransactions: string[] = [];

  constructor(adminConfig: IAdminConfig, kafkaConfig: object = {}) {
    super();

    this.adminConfig = adminConfig;
    if (adminConfig.adminId) {
      this.consumer = new KafkaConsumer(
        {
          'bootstrap.servers': adminConfig.kafkaServers,
          'group.id': adminConfig.adminId,
          'enable.auto.commit': true,
          ...kafkaConfig,
        },
        { 'auto.offset.reset': 'latest' }, //Don't poll old events
      );

      this.consumer.on('ready', () => {
        if (this.isAdminClientReady()) {
          this.emit('ready');
        }

        this.consumer.subscribe([
          `melonade.${this.adminConfig.namespace}.store`,
        ]);
        this.poll();
      });

      this.consumer.setDefaultConsumeTimeout(10);
      this.consumer.connect();
    }

    this.producer = new Producer(
      { 'bootstrap.servers': adminConfig.kafkaServers, ...kafkaConfig },
      {},
    );

    this.producer.on('ready', () => {
      if (this.isAdminClientReady()) {
        this.emit('ready');
      }
    });

    this.producer.setPollInterval(100);
    this.producer.connect();

    process.on('SIGTERM', () => {
      if (adminConfig.adminId) {
        this.consumer.unsubscribe();
      }
      // setTimeout(() => {
      //   process.exit(0);
      // }, 1000);
    });
  }

  private isAdminClientReady = (): boolean => {
    if (this.adminConfig.adminId) {
      return this.producer.isConnected() && this.consumer.isConnected();
    }
    return this.producer.isConnected();
  };

  startTransaction = (
    transactionId: string,
    workflowRef: WorkflowDefinition.IWorkflowRef,
    input: any,
    tags: string[] = [],
  ) => {
    if (!transactionId) throw new Error('transactionId is required');
    this.producer.produce(
      `melonade.${this.adminConfig.namespace}.command`,
      null,
      Buffer.from(
        JSON.stringify({
          type: Command.CommandTypes.StartTransaction,
          transactionId,
          workflowRef,
          input,
          tags,
        } as Command.IStartTransactionCommand),
      ),
      transactionId,
      Date.now(),
    );
  };

  startTransactionByArbitraryWorkflowDefinition = (
    transactionId: string,
    workflowDefinition: WorkflowDefinition.IWorkflowDefinition,
    input: any,
    tags: string[] = [],
  ) => {
    if (!transactionId) throw new Error('transactionId is required');
    // Check if workflowDefinition are valid
    new WorkflowDefinition.WorkflowDefinition(workflowDefinition);
    this.producer.produce(
      `melonade.${this.adminConfig.namespace}.command`,
      null,
      Buffer.from(
        JSON.stringify({
          type: Command.CommandTypes.StartTransaction,
          transactionId,
          workflowDefinition,
          input,
          tags,
        } as Command.IStartTransactionCommand),
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

  updateTask = (task: ITaskRef, result: ITaskResponse) => {
    return this.producer.produce(
      `melonade.${this.adminConfig.namespace}.event`,
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

  consume = (messageNumber: number = 100): Promise<Event.AllEvent[]> => {
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

  private poll = async () => {
    try {
      const events = await this.consume();
      if (events.length > 0) {
        for (const event of events) {
          if (
            this.adminConfig.subscribeToAllTransaction ||
            this.watchingTransactions.includes(event.transactionId)
          ) {
            this.emit(event.type, event);
            if (event.isError === true) {
              switch (event.type) {
                case 'TRANSACTION':
                  this.emit(EventTypes.TransactionFalseEvent, event);
                  break;
                case 'WORKFLOW':
                  this.emit(EventTypes.WorkflowFalseEvent, event);
                  break;
                case 'TASK':
                  this.emit(EventTypes.TaskFalseEvent, event);
                  break;
              }
            } else {
              switch (event.type) {
                case 'TRANSACTION':
                  this.emit(EventTypes.TransactionEvent, event);
                  break;
                case 'WORKFLOW':
                  this.emit(EventTypes.WorkflowEvent, event);
                  break;
                case 'TASK':
                  this.emit(EventTypes.TaskEvent, event);
                  break;
              }
            }
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
        (tId: string) => tId !== transactionId,
      );
    }
  };
}
