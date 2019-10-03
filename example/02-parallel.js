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
//   rev: "parallel",
//   description: "No description",
//   tasks: [
//     {
//       taskReferenceName: "task-1",
//       name: "task-1",
//       type: "TASK"
//     },
//     {
//       taskReferenceName: "parallel-1",
//       type: "PARALLEL",
//       parallelTasks: [
//         [
//           {
//             taskReferenceName: "parallel-1-parallel-2",
//             type: "PARALLEL",
//             parallelTasks: [
//               [
//                 {
//                   taskReferenceName: "parallel-1-parallel-2-1-task-1",
//                   name: "task-1",
//                   type: "TASK"
//                 },
//                 {
//                   taskReferenceName: "parallel-1-parallel-2-1-task-2",
//                   name: "task-2",
//                   type: "TASK"
//                 }
//               ],
//               [
//                 {
//                   taskReferenceName: "parallel-1-parallel-2-2-task-1",
//                   name: "task-1",
//                   type: "TASK"
//                 },
//                 {
//                   taskReferenceName: "parallel-1-parallel-2-2-task-2",
//                   name: "task-2",
//                   type: "TASK"
//                 }
//               ]
//             ]
//           }
//         ],
//         [
//           {
//             taskReferenceName: "parallel-1-task-1",
//             name: "task-1",
//             type: "TASK"
//           },
//           {
//             taskReferenceName: "parallel-1-task-2",
//             name: "task-2",
//             type: "TASK"
//           }
//         ]
//       ]
//     },
//     {
//       name: "task-2",
//       taskReferenceName: "task-2",
//       type: "TASK"
//     }
//   ],
//   failureStrategy: "COMPENSATE_THEN_RETRY",
//   retry: {
//     limit: 5
//   }
// };

for (let i = 1; i <= 3; i++) {
  new Worker(
    `task-${i}`,
    task => {
      console.log(`Processing ${task.taskReferenceName}`);
      return {
        status: State.TaskStates.Completed,
      };
    },
    task => {
      console.log(`Compensating ${task.taskReferenceName}`);
      return {
        status: State.TaskStates.Completed,
      };
    },
    config.sagaConfig,
  ).consumer.on('ready', () => console.log(`Worker ${i} is ready!`));
}

// Expect result
// Processing task-1
// Processing parallel-1-task-1
// Processing parallel-1-task-2
// Processing parallel-1-parallel-2-1-task-1
// Processing parallel-1-parallel-2-2-task-1
// Processing parallel-1-parallel-2-1-task-2
// Processing parallel-1-parallel-2-2-task-2
// Processing task-2

// => Transaction status = COMPLETED
