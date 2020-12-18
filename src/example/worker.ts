import { State, Task } from '@melonade/melonade-declaration';
import { Worker } from '..';

const kafkaServers = 'localhost:29092';
const namespace = 'docker-compose';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// tslint:disable-next-line: no-for-in
for (const forkID in new Array(1).fill(null)) {
  for (const workerId of [4]) {
    const worker = new Worker(
      // task name
      `t${workerId}`,

      // process task
      async (task, _logger, _isTimeOut) => {
        console.log(`Processing ${task.taskName}: ${task.taskId}`);
        await sleep(15 * 60 * 1000);
        console.log(`Processed ${task.taskName}:  ${task.taskId}`);
        return {
          status: State.TaskStates.Completed,
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
