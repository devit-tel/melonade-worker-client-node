const { Worker } = require('../build');
const { State } = require('@melonade/melonade-declaration');

const config = require('./config.json');

// const taskDefs = [
//   {
//     name: "task-1",
//     description: "description",
//     ackTimeout: 0,
//     timeout: 0,
//     retry: {
//       limit: 0,
//       delay: 0
//     },
//     document: {
//       inputs: [
//         {
//           field: "name",
//           type: "string",
//           description: "name of user",
//           required: true
//         },
//         {
//           field: "citizenId",
//           type: "string",
//           description: "citizen ID of user",
//           required: true
//         }
//       ],
//       output: [
//         {
//           field: "user",
//           type: "any",
//           description: "user infomation data",
//           required: true
//         }
//       ]
//     }
//   },
//   {
//     name: "task-2",
//     description: "description",
//     ackTimeout: 0,
//     timeout: 0,
//     retry: {
//       limit: 0,
//       delay: 0
//     },
//     document: {
//       inputs: [
//         {
//           field: "name",
//           type: "string",
//           description: "name of user",
//           required: true
//         },
//         {
//           field: "citizenId",
//           type: "string",
//           description: "citizen ID of user",
//           required: true
//         }
//       ],
//       output: [
//         {
//           field: "user",
//           type: "any",
//           description: "user infomation data",
//           required: true
//         }
//       ]
//     }
//   },
//   {
//     name: "task-3",
//     description: "description",
//     ackTimeout: 0,
//     timeout: 0,
//     retry: {
//       limit: 0,
//       delay: 0
//     },
//     document: {
//       inputs: [
//         {
//           field: "name",
//           type: "string",
//           description: "name of user",
//           required: true
//         },
//         {
//           field: "citizenId",
//           type: "string",
//           description: "citizen ID of user",
//           required: true
//         }
//       ],
//       output: [
//         {
//           field: "user",
//           type: "any",
//           description: "user infomation data",
//           required: true
//         }
//       ]
//     }
//   }
// ];

// const workflowDef = {
//   name: "test",
//   rev: "simple",
//   description: "No description",
//   tasks: [
//     {
//       name: "task-1",
//       taskReferenceName: "task-1",
//       type: "TASK",
//       inputParameters: {
//         userId: "${workflow.input.user._id}"
//       }
//     },
//     {
//       name: "task-2",
//       taskReferenceName: "task-2",
//       type: "TASK",
//       inputParameters: {
//         userId: "${workflow.input.user._id}"
//       }
//     },
//     {
//       name: "task-3",
//       taskReferenceName: "task-3",
//       type: "TASK",
//       inputParameters: {
//         userId: "${workflow.input.user._id}"
//       }
//     }
//   ],
//   failureStrategy: "COMPENSATE",
//   outputParameters: {
//     transactionId: "${workflow.transactionId}",
//     "task-1-input": "${task-1.input}",
//     "task-2-output-hello": "${task-2.output.hello}",
//     "when-task-2-completed": "${task-2.endTime}"
//   }
// };

for (let i = 1; i <= 3; i++) {
  new Worker(
    `task-${i}`,
    task => {
      console.log(`Processing ${task.taskName} (${task.transactionId})`);
      return {
        status: State.TaskStates.Completed,
        output: {
          hello: 'world',
          name: task.taskName,
        },
      };
    },
    task => {
      console.log(`Compensating ${task.taskName} (${task.transactionId})`);
      return {
        status: State.TaskStates.Completed,
      };
    },
    config.sagaConfig,
  ).consumer.on('ready', () => console.log(`Worker ${i} is ready!`));
}

// Expect result
// Processing task-1 (8d616a55-256f-4b52-8763-a5fcc7856b25)
// Processing task-2 (8d616a55-256f-4b52-8763-a5fcc7856b25)
// Processing task-3 (8d616a55-256f-4b52-8763-a5fcc7856b25)

// => Transaction status = COMPLETED
