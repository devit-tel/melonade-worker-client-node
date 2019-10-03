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
//       limit: 3,
//       delay: 1000
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
//     name: "task-2-retryable",
//     description: "description",
//     ackTimeout: 0,
//     timeout: 0,
//     retry: {
//       limit: 3,
//       delay: 1000
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
//   rev: "compensate-then-retry-task-retry",
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
//       name: "task-2-retryable",
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
//   outputParameters: {
//     transactionId: "${workflow.transactionId}",
//     "task-1-input": "${task-1.input}",
//     "task-2-output-hello": "${task-2.output.hello}",
//     "when-task-2-completed": "${task-2.endTime}"
//   },
//   failureStrategy: "COMPENSATE_THEN_RETRY",
//   retry: {
//     limit: 5
//   }
// };

let errorCount = 10;

new Worker(
  'task-2-retryable',
  task => {
    console.log(`Processing ${task.taskName} (${task.transactionId})`);
    if (errorCount > 0) {
      errorCount--;
      throw new Error('Test error');
    }
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
      status: TaskStates.Completed,
    };
  },
  config.sagaConfig,
).consumer.on('ready', () => console.log(`Worker task-1-retryable is ready!`));

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

// Expect result errorCount = 10
// Processing task-1 (7d0279ee-94dd-4dd2-a5db-416630101a86)
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 1
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 2
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 3
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 4
// Compensating task-1 (7d0279ee-94dd-4dd2-a5db-416630101a86)
// Processing task-1 (7d0279ee-94dd-4dd2-a5db-416630101a86)
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 5
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 6
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 7
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 8
// Compensating task-1 (7d0279ee-94dd-4dd2-a5db-416630101a86)
// Processing task-1 (7d0279ee-94dd-4dd2-a5db-416630101a86)
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 9
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86) <- Failed 10
// Processing task-2-retryable (7d0279ee-94dd-4dd2-a5db-416630101a86)
// Processing task-3 (7d0279ee-94dd-4dd2-a5db-416630101a86)

// => Transaction status = COMPLETED

// ----------------

// Expect result errorCount = Number.MAX_SAFE_INTEGER
// Processing task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Compensating task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Compensating task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Compensating task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Compensating task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Compensating task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Processing task-2-retryable (88f81166-bf81-4da6-ba25-658a35b4424e)
// Compensating task-1 (88f81166-bf81-4da6-ba25-658a35b4424e)

// => Transaction status = COMPENSATED
