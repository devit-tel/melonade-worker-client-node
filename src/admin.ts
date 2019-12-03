import {
  Command,
  Event,
  Kafka,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
import { EventEmitter } from 'events';
import { KafkaConsumer, Producer } from 'node-rdkafka';
import { jsonTryParse } from './utils/common';

export interface IAdminConfig {
  kafkaServers: string;
  namespace?: string;
  adminId: string;
}

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

    process.on('SIGTERM', () => {
      this.consumer.disconnect();
      this.producer.disconnect();

      setTimeout(() => {
        process.exit(0);
      }, 1000);
    });
  }

  startTransaction = (
    transactionId: string,
    workflow: WorkflowDefinition.IWorkflowRef,
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
        (tId: string) => tId !== transactionId,
      );
    }
  };
}
