import { State, Task } from '@melonade/melonade-declaration';
import { Worker } from '../worker';

const kafkaServers = process.env['MELONADE_KAFKA_SERVERS'];
const namespace = process.env['MELONADE_NAMESPACE'];

for (const forkID in new Array(1).fill(null)) {
  for (const workerId of [1, 2, 3]) {
    const worker = new Worker(
      `t${workerId}`,
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
      console.log(`Fork ${forkID} Worker t${workerId} is ready!`);
    });

    worker.on('task-timeout', (task: Task.ITask) => {
      console.log(
        `Worker skiped ${task.taskName}: ${task.taskId} because it already timed out`,
      );
    });
  }
}
