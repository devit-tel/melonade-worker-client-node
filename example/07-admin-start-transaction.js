const { Admin } = require('../build');
const uuid = require('uuid/v4');

const config = require('./config.json');

// adminId is require if you wanto subscribe for store event
const adminClient = new Admin(
  {
    ...config.adminConfig,
    // adminId: 'test-07-admin-start-transaction'
  },
  {},
);

// adminClient.on('TRANSACTION', event => {
//   if (event.isError) {
//     console.log(
//       `transaction: ${event.transactionId} updated rejected`,
//       event.details,
//     );
//   } else {
//     console.log(
//       `transaction: ${event.details.transactionId} updated to ${event.details.status}`,
//     );
//   }
// });

// adminClient.on('WORKFLOW', event => {
//   if (event.isError) {
//     console.log(
//       `workflow: ${event.transactionId} updated rejected`,
//       event.details,
//     );
//   } else {
//     console.log(
//       `workflow: ${event.details.workflowId} updated to ${event.details.status}`,
//     );
//   }
// });

// adminClient.on('TASK', event => {
//   if (event.isError) {
//     console.log(`task: ${event.transactionId} updated rejected`, event.details);
//   } else {
//     console.log(
//       `task: ${event.details.taskId} updated to ${event.details.status}`,
//     );
//   }
// });

adminClient.producer.on('ready', () => {
  // setTimeout(() => {
  console.log('start tasks');
  for (let i = 0; i < 10; i++) {
    const transactionId = uuid();
    console.log(`start transaction: ${transactionId}`);
    adminClient.startTransaction(
      transactionId,
      {
        name: 'test',
        rev: 'timeout',
      },
      { hello: 'world' },
    );
    // adminClient.subscribe(transactionId);
  }
  // }, 5000);
});
