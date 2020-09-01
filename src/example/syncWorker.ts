import { State, Task } from '@melonade/melonade-declaration';
import { TaskStates } from '..';
import { SyncWorker } from '../syncWorker';

const kafkaServers = process.env['MELONADE_KAFKA_SERVERS'];
const namespace = process.env['MELONADE_NAMESPACE'];
const processManagerUrl =
  process.env['MELONADE_PROCESS_MANAGER_URL'] || 'http://localhost:8081';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

for (const forkID in new Array(1).fill(null)) {
  for (const workerId of [1, 2, 3]) {
    const worker = new SyncWorker(
      // task name
      `t${workerId}`,
      // process task
      async (task, updateTask) => {
        await updateTask(task, { status: TaskStates.Inprogress });
        console.log(`Processing ${task.taskName}`);
        await sleep(5000);
        await updateTask(task, { status: State.TaskStates.Completed });
      },
      // compensate task
      async (task, updateTask) => {
        await updateTask(task, { status: TaskStates.Inprogress });
        console.log(`Compenstating ${task.taskName}`);
        await sleep(10);
        await updateTask(task, { status: TaskStates.Completed });
      },
      // configs
      {
        processManagerUrl,
        kafkaServers,
        namespace,
      },
    );

    worker.once('ready', () => {
      console.log(`Fork ${forkID} Worker t${workerId} is ready!`);
    });

    worker.on('task-timeout', (task: Task.ITask) => {
      console.log(
        `Worker skiped ${task.taskName}: ${task.taskId} because it already timed out`,
      );
    });
  }
}
