const { Worker } = require('../build');
const { State } = require('@melonade/melonade-declaration');

const config = require('./config.json');

// const workflowDef = {
//   name: 'TRUE_RYDE',
//   rev: 'phase_1',
//   description: 'No description',
//   tasks: [
//     {
//       taskReferenceName: 'parallel_1',
//       type: 'PARALLEL',
//       parallelTasks: [
//         [
//           {
//             name: 'tms_trip_create',
//             taskReferenceName: 'tms_trip_create',
//             type: 'TASK',
//             inputParameters: {
//               type: 'TRUE_RYDE_TAXI',
//               passengers: '${workflow.input.passengers}',
//               pickupLocation: '${workflow.input.pickupLocation}',
//               wayPoints: '${workflow.input.wayPoints}',
//               transactionId: '${workflow.transactionId}',
//               pricing: '${workflow.input.pricing}',
//             },
//           },
//         ],
//         [
//           {
//             name: 'fms_driver_find',
//             taskReferenceName: 'fms_driver_find',
//             type: 'TASK',
//             inputParameters: {
//               type: 'TRUE_RYDE_TAXI',
//               passengers: '${workflow.input.passengers}',
//               pickupLocation: '${workflow.input.pickupLocation}',
//               wayPoints: '${workflow.input.wayPoints}',
//               pricing: '${workflow.input.pricing}',
//             },
//           },
//         ],
//       ],
//     },
//     {
//       name: 'tms_driver_assign',
//       taskReferenceName: 'tms_driver_assign',
//       type: 'TASK',
//       inputParameters: {
//         tripId: '${tms_trip_create.output.trip._id}',
//         driver: '${fms_driver_find.output.driver}',
//       },
//     },
//     {
//       name: 'tms_task_run',
//       taskReferenceName: 'tms_task_run',
//       type: 'TASK',
//       inputParameters: {
//         tripId: '${tms_trip_create.output.trip._id}',
//       },
//     },
//     {
//       name: 'fms_driver_summarize',
//       taskReferenceName: 'fms_driver_summarize',
//       type: 'TASK',
//       inputParameters: {
//         driverId: '${fms_driver_find.output.driver._id}',
//         rating: '${tms_task_run.output.rating}',
//       },
//     },
//   ],
//   failureStrategy: 'COMPENSATE',
//   outputParameters: {
//     transactionId: '${workflow.transactionId}',
//     rating: '${tms_task_run.output.rating}',
//   },
// };

const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

new Worker(
  'tms_trip_create',
  async (task, logger) => {
    console.log(`Processing ${task.taskName} (${task.transactionId})`);
    // logger('Creating trip');
    // await sleep(10);

    // logger('Creating task');
    // await sleep(10);

    // logger('Creating todo');
    // await sleep(10);

    // throw new Error('Test error');
    // console.log(task.input);
    // console.log(`Done ${task.taskName} (${task.transactionId})`);
    return {
      status: State.TaskStates.Completed,
      output: {
        trip: {
          _id: 'some-trip-id',
          bla: 'bla-bla',
          foo: 'foo-foo',
        },
      },
    };
  },
  async (task, logger) => {
    console.log(`Compensating ${task.taskName} (${task.transactionId})`);
    // logger('Cleaning todo');
    // // await sleep(10);

    // logger('Cleaning task');
    // // await sleep(10);

    // logger('Cleaning trip');
    // await sleep(10);

    return {
      status: State.TaskStates.Completed,
    };
  },
  config.sagaConfig,
).consumer.on('ready', () => console.log(`Worker tms_trip_create is ready!`));

// ----------------------------------------------------------------

const fmsDriverFindWorker = new Worker(
  'fms_driver_find',
  async (task, logger) => {
    console.log(`Processing ${task.taskName} (${task.transactionId})`);
    // logger('Push notification to drivers');
    // setTimeout(() => {
    //   console.log('Driver accept job');
    //   fmsDriverFindWorker.updateTask(task, {
    //     status: State.TaskStates.Completed,
    //     output: {
    //       driver: {
    //         _id: 'some-driver-id',
    //         name: 'John Felix Anthony Cena Jr.',
    //         avarter: 'some-driver-id.jpg',
    //         someInfo: 'bla bla',
    //       },
    //     },
    //   });
    // }, 100);

    // console.log(task.input);
    return {
      status: State.TaskStates.Completed,
    };
  },
  async (task, logger) => {
    console.log(`Compensating ${task.taskName} (${task.transactionId})`);
    logger('Cleaning driver');
    // await sleep(10);

    return {
      status: State.TaskStates.Completed,
    };
  },
  config.sagaConfig,
);

fmsDriverFindWorker.consumer.on('ready', () =>
  console.log(`Worker fms_driver_find is ready!`),
);

// ----------------

new Worker(
  'tms_driver_assign',
  async (task, logger) => {
    console.log(`Processing ${task.taskName} (${task.transactionId})`);
    // logger('Add driver to tasks');
    // await sleep(10);

    // console.log(task.input);

    // console.log(`Done ${task.taskName} (${task.transactionId})`);
    return {
      status: State.TaskStates.Completed,
    };
  },
  async (task, logger) => {
    console.log(`Compensating ${task.taskName} (${task.transactionId})`);
    // Or just skip
    logger('Cleaning driver from tasks');
    // await sleep(10);

    return {
      status: State.TaskStates.Completed,
    };
  },
  config.sagaConfig,
).consumer.on('ready', () => console.log(`Worker tms_driver_assign is ready!`));

// ----------------

new Worker(
  'tms_task_run',
  async (task, logger) => {
    console.log(`Processing ${task.taskName} (${task.transactionId})`);
    // logger('Run task of', task.input.tripId);
    // await sleep(10);

    // setTimeout(() => {
    //   console.log('Driver on the way');
    //   fmsDriverFindWorker.updateTask(task, {
    //     status: State.TaskStates.Inprogress,
    //     logs: 'Driver on the way',
    //   });
    // }, 1000);

    // setTimeout(() => {
    //   console.log('Driver at pickup point');
    //   fmsDriverFindWorker.updateTask(task, {
    //     status: State.TaskStates.Inprogress,
    //     logs: 'Driver at pickup point',
    //   });
    // }, 3000);

    // setTimeout(() => {
    //   console.log('Passenger hopped in');
    //   fmsDriverFindWorker.updateTask(task, {
    //     status: State.TaskStates.Inprogress,
    //     logs: 'Passenger hopped in',
    //   });
    // }, 4000);

    // setTimeout(() => {
    //   console.log('Driver dropped passenger');
    //   fmsDriverFindWorker.updateTask(task, {
    //     status: State.TaskStates.Completed,
    //     logs: 'Driver dropped passenger',
    //   });
    // }, 5000);

    return {
      status: State.TaskStates.Completed,
    };
  },
  async (task, logger) => {
    console.log(`Compensating ${task.taskName} (${task.transactionId})`);
    // No need to compensate anything
    return {
      status: State.TaskStates.Completed,
    };
  },
  config.sagaConfig,
).consumer.on('ready', () => console.log(`Worker tms_task_run is ready!`));

// ----------------

new Worker(
  'oms_summarize',
  async (task, logger) => {
    console.log(`Processing ${task.taskName} (${task.transactionId})`);

    throw new Error('asddsa');
    // console.log(task.input);
    return {
      status: State.TaskStates.Completed,
    };
  },
  async (task, logger) => {
    console.log(`Compensating ${task.taskName} (${task.transactionId})`);
    // Should never fire in this workflow (last task)

    return {
      status: State.TaskStates.Completed,
    };
  },
  config.sagaConfig,
).consumer.on('ready', () => console.log(`Worker oms_summarize is ready!`));
