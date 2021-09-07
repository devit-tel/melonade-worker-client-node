import { State, SyncWorker, Task, TaskStates } from '..';

const kafkaServers = 'localhost:29092';
const namespace = 'docker-compose';
const processManagerUrl = 'http://localhost:8081';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// tslint:disable-next-line: no-for-in
for (const forkID in new Array(1).fill(null)) {
  for (const workerId of [1, 2, 3]) {
    const worker = new SyncWorker(
      // task name
      `t${workerId}`,
      // process task
      async (task, updateTask) => {
        try {
          await updateTask(task, { status: TaskStates.Inprogress });
          console.log(`Processing ${task.taskName}`);
          await sleep(3000);
          await updateTask(task, {
            status: State.TaskStates.Completed,
          });
        } catch (error) {
          console.log(
            task.taskName,
            "Cannot update task..., Rollback what's has been done",
          );
        }
      },
      // compensate task
      async (task, updateTask) => {
        try {
          await updateTask(task, { status: TaskStates.Inprogress });
          console.log(`Compenstating ${task.taskName}`);
          await sleep(10);
          await updateTask(task, { status: TaskStates.Completed });
        } catch (error) {
          console.log(
            task.taskName,
            "Cannot compensate task..., Rollback what's has been done",
            'Need inspection !!!',
            task,
            error,
          );
        }
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
