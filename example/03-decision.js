const { Worker, TaskStates } = require("../build");

const config = require("./config.json");

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
//   rev: "decision-1",
//   description: "No description",
//   tasks: [
//     {
//       taskReferenceName: "decision-1",
//       type: "DECISION",
//       inputParameters: {
//         case: "${workflow.input.decision-1}"
//       },
//       defaultDecision: [
//         {
//           taskReferenceName: "decision-1-default-task-1",
//           name: "task-1",
//           type: "TASK"
//         },
//         {
//           taskReferenceName: "decision-1-default-task-2",
//           name: "task-2",
//           type: "TASK"
//         }
//       ],
//       decisions: {
//         A: [
//           {
//             taskReferenceName: "decision-1-A-task-1",
//             name: "task-1",
//             type: "TASK"
//           },
//           {
//             taskReferenceName: "decision-1-A-task-2",
//             name: "task-2",
//             type: "TASK"
//           }
//         ],
//         B: [
//           {
//             taskReferenceName: "decision-1-B",
//             type: "DECISION",
//             inputParameters: {
//               case: "${workflow.input.decision-1-B}"
//             },
//             defaultDecision: [
//               {
//                 taskReferenceName: "decision-1-B-default",
//                 name: "task-1",
//                 type: "TASK"
//               }
//             ],
//             decisions: {
//               A: [
//                 {
//                   taskReferenceName: "decision-1-B-A-task-1",
//                   name: "task-1",
//                   type: "TASK"
//                 }
//               ],
//               B: [
//                 {
//                   taskReferenceName: "decision-1-B-B-task-1",
//                   name: "task-1",
//                   type: "TASK"
//                 }
//               ]
//             }
//           },
//           {
//             taskReferenceName: "decision-1-B-task-2",
//             name: "task-2",
//             type: "TASK"
//           }
//         ],
//         C: [
//           {
//             taskReferenceName: "decision-1-C-task-1",
//             name: "task-1",
//             type: "TASK"
//           }
//         ]
//       }
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
        status: TaskStates.Completed
      };
    },
    task => {
      console.log(`Compensating ${task.taskReferenceName}`);
      return {
        status: TaskStates.Completed
      };
    },
    config.sagaConfig
  ).consumer.on("ready", () => console.log(`Worker ${i} is ready!`));
}

// Expect result input
// {
// 	"decision-1": "A",
// 	"decision-1-B": "A"
// }
// Processing decision-1-A-task-1
// Processing decision-1-A-task-2
// Processing task-2

// => Transaction status = COMPLETED

// ----

// Expect result input
// {
// 	"decision-1": "B",
// 	"decision-1-B": "A"
// }
// Processing decision-1-B-A-task-1
// Processing decision-1-B-task-2
// Processing task-2

// => Transaction status = COMPLETED

// ----

// Expect result input
// {
// 	"decision-1": "B",
// 	"decision-1-B": "B"
// }
// Processing decision-1-B-B-task-1
// Processing decision-1-B-task-2
// Processing task-2

// => Transaction status = COMPLETED

// ----

// Expect result input
// {
// 	"decision-1": "B",
// 	"decision-1-B": "C"
// }
// Processing decision-1-B-default
// Processing decision-1-B-task-2
// Processing task-2

// => Transaction status = COMPLETED

// ----

// Expect result input
// {
// 	"decision-1": "E",
// 	"decision-1-B": "A"
// }
// Processing decision-1-default-task-1
// Processing decision-1-default-task-2
// Processing task-2

// => Transaction status = COMPLETED
