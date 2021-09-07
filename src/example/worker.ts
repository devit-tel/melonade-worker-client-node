import { ITask, ITaskResponse, IWorkerConfig, State, Worker } from '..';

const config: IWorkerConfig = {
  kafkaServers: 'localhost:29092', // kafka's brokers server
  namespace: 'docker-compose', // melonade's namespace
};

// process callback task
const processTask = async (task: ITask): Promise<ITaskResponse> => {
  console.log(`Processing ${task.taskName}: ${task.taskId}`);
  await sleep(5 * 1000);
  console.log(`Processed ${task.taskName}:  ${task.taskId}`);

  return {
    status: State.TaskStates.Completed,
    output: 'hello',
  };
};

// compensate callback task
// will run if workflow failed, and task is success
// reverse what has been done
// task.input = { input: <processTask.input>, output: <processTask.output> }
const compensateTask = async (task: ITask): Promise<ITaskResponse> => {
  console.log(`Compensating ${task.taskName}: ${task.taskId}`);
  await sleep(5 * 1000);
  console.log(`Compensated ${task.taskName}:  ${task.taskId}`);

  return {
    status: State.TaskStates.Completed,
  };
};

for (const workerId of ['t1', 't2', 't3']) {
  const worker = new Worker(workerId, processTask, compensateTask, config);

  worker.once('ready', () => {
    console.log(`Worker ${workerId} is ready!`);
  });
}

// util funcs
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
