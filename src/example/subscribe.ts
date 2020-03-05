import { Event, State } from '..';
import { Admin, EventTypes } from '../admin';

const kafkaServers = process.env['MELONADE_KAFKA_SERVERS'];
const namespace = process.env['MELONADE_NAMESPACE'];

const adminClient = new Admin({
  kafkaServers,
  namespace,
  adminId: 'DEMO_SUBSCRIBE_01',
  subscribeToAllTransaction: true,
});

// use subscribeToAllTransaction or subscribe each transactionID
// adminClient.subscribe('someTransactionID1')
// adminClient.subscribe('someTransactionID2')
// adminClient.subscribe('someTransactionID3')

adminClient.on(
  EventTypes.TransactionEvent,
  (event: Event.ITransactionEvent) => {
    switch (event.details.status) {
      case State.TransactionStates.Running:
        console.log(`Transacrion ${event.transactionId} started`);
        break;
      case State.TransactionStates.Completed:
        console.log(`Transacrion ${event.transactionId} Completed`);
        break;
    }
  },
);

adminClient.on(
  EventTypes.TransactionFalseEvent,
  (event: Event.ITransactionErrorEvent) => {
    console.log(`Transacrion ${event.transactionId} went wrong`, event.error);
  },
);

adminClient.on(EventTypes.TaskEvent, (event: Event.ITaskEvent) => {
  // Ignore system task and compensate task
  // Or you may filter by taskName as well
  if (event.details.type === 'TASK') {
    switch (event.details.status) {
      case State.TaskStates.Scheduled:
        console.log(`Task ${event.details.taskId} started`);
        break;
      case State.TaskStates.Inprogress:
        console.log(`Task ${event.details.taskId} acked`);
        break;
      case State.TaskStates.Completed:
        console.log(`Task ${event.details.taskId} Completed`);
        break;
    }
  }
});

adminClient.once('ready', () => {
  console.log('Ready');
});
