import { State, Task } from '@melonade/melonade-declaration';
import { Worker } from '../worker';

const kafkaServers = process.env['MELONADE_KAFKA_SERVERS'];
const namespace = process.env['MELONADE_NAMESPACE'];

for (let i = 1; i <= 3; i++) {
  const worker = new Worker(
    `t${i}`,
    (task: Task.ITask) => {
      console.log(`Processing ${task.taskName}`);
      return {
        status: State.TaskStates.Completed,
      };
    },
    (task: Task.ITask) => {
      console.log(`Compenstating ${task.taskName}`);
      return {
        status: State.TaskStates.Completed,
      };
    },
    {
      kafkaServers,
      namespace,
    },
  );

  worker.once('ready', () => {
    console.log(`Worker t${i} is ready!`);
  });

  worker.on('task-timeout', (task: Task.ITask) => {
    console.log(
      `Worker skiped ${task.taskName}: ${task.taskId} because it already timed out`,
    );
  });
}
