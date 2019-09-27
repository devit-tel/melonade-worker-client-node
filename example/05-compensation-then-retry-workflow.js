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
//   rev: "compensate-then-retry",
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
//   failureStrategy: "COMPENSATE_THEN_RETRY",
//   retry: {
//     limit: 5
//   },
//   outputParameters: {
//     transactionId: "${workflow.transactionId}",
//     "task-1-input": "${task-1.input}",
//     "task-2-output-hello": "${task-2.output.hello}",
//     "when-task-2-completed": "${task-2.endTime}"
//   }
// };

let errorCount = Number.MAX_SAFE_INTEGER

for (let i = 1; i <= 3; i++) {
  new Worker(
    `task-${i}`,
    task => {
      console.log(`Processing ${task.taskName} (${task.transactionId})`);
      if (task.taskName === "task-3" && errorCount > 0) {
        errorCount--
        throw new Error("Test error");
      }
      return {
        status: TaskStates.Completed,
        output: {
          hello: "world",
          name: task.taskName
        }
      };
    },
    task => {
      console.log(`Compensating ${task.taskName} (${task.transactionId})`);
      return {
        status: TaskStates.Completed
      };
    },
    config.sagaConfig
  ).consumer.on("ready", () => console.log(`Worker ${i} is ready!`));
}

// Expect result errorCount = 3
// Processing task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-3 (49855b0c-c616-46af-971a-4b3454f08821)
// Compensating task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Compensating task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-3 (49855b0c-c616-46af-971a-4b3454f08821)
// Compensating task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Compensating task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-3 (49855b0c-c616-46af-971a-4b3454f08821)
// Compensating task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Compensating task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-1 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-2 (49855b0c-c616-46af-971a-4b3454f08821)
// Processing task-3 (49855b0c-c616-46af-971a-4b3454f08821)

// => Transaction status = COMPLETED

// ----------------

// Expect result errorCount = Number.MAX_SAFE_INTEGER
// Processing task-1 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-3 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-1 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-1 (013dd6da-3748-41aa-99a4-36395cc0765b) <- retry 1
// Processing task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-3 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-1 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-1 (013dd6da-3748-41aa-99a4-36395cc0765b) <- retry 2
// Processing task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-3 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-1 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-1 (013dd6da-3748-41aa-99a4-36395cc0765b) <- retry 3
// Processing task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-3 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-1 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-1 (013dd6da-3748-41aa-99a4-36395cc0765b) <- retry 4
// Processing task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-3 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-1 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-1 (013dd6da-3748-41aa-99a4-36395cc0765b) <- retry 5
// Processing task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Processing task-3 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-2 (013dd6da-3748-41aa-99a4-36395cc0765b)
// Compensating task-1 (013dd6da-3748-41aa-99a4-36395cc0765b) // keep error 5 time end the transaction // workflowDef.retry.limit = 5

// => Transaction status = COMPENSATED
