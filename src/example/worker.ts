import { State, Task } from '@melonade/melonade-declaration';
import { Worker } from '..';

const kafkaServers = process.env['MELONADE_KAFKA_SERVERS'];
const namespace = process.env['MELONADE_NAMESPACE'];

for (const forkID in new Array(1).fill(null)) {
  for (const workerId of [1, 2, 3]) {
    const worker = new Worker(
      // task name
      `t${workerId}`,

      // process task
      (task, _logger, _isTimeOut, updateTask) => {
        setTimeout(() => {
          updateTask(task, {
            status: State.TaskStates.Completed,
          });

          console.log(`Async Completed ${task.taskName}`);
        }, 5000);

        console.log(`Processing ${task.taskName}`);
        return {
          status: State.TaskStates.Inprogress,
        };
      },

      // compensate task
      (task) => {
        console.log(`Compenstating ${task.taskName}`);
        return {
          status: State.TaskStates.Completed,
        };
      },

      // configs
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
