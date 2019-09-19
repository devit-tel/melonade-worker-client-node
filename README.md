# node-saga-client

This is prototype of saga implementation, written in Node.

## Worker

- [ ] Manage rebalance callback to hold working task
- [ ] List working task method (for graceful shutdown)

## Example

```javascript
const { Worker } = require('node-saga-client');

const sagaConfig = {
  kafkaServers: 'kafka.namespace.svc.blablabla.k8s.local',
};

const blablabla = time => new Promise(resolve => setTimeout(resolve, time));

new Worker(
  // Task name
  'TASK_1',
  // Task callback
  async (task, logger) => {
    console.log(`Processing ${task.taskName}: ${task.taskId}`);

    // You can log to task whenever you want (until task is finish)
    logger("I'm doing step 1");
    // Do some job
    await blablabla(100);

    // this can help you debug what step is gone wrong
    logger("I'm doing step 2");
    await blablabla(100);

    logger("I'm doing step 3");
    await blablabla(100);

    logger("I'm doing step 4");
    //throw new Error("I'm done for this 💩, CYA")

    // To finish task you have to return result in this format
    // interface ITaskResponse {
    // status: 'INPROGRESS' | 'COMPLETED' | 'FAILED';
    // output?: any;
    // logs?: string | string[];
    // }
    return {
      status: 'COMPLETED',
      output: {
        eiei: 'lol',
      },
    };
  },

  task => {
    // Task compensation callback
    console.log(`Compensating ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
    };
  },
  sagaConfig,
);

new Worker(
  'TASK_2',
  task => {
    console.log(`Processing ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
      output: {
        time: Date.now(),
        eiei: 'lol',
      },
    };
  },
  task => {
    console.log(`Compensating ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
    };
  },
  sagaConfig,
);

new Worker(
  'TASK_3',
  task => {
    console.log(`Processing ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
      output: {
        time: Date.now(),
        eiei: 'lol',
      },
    };
  },
  task => {
    console.log(`Compensating ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
    };
  },
  sagaConfig,
);

new Worker(
  'TASK_4',
  task => {
    console.log(`Processing ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
      output: {
        time: Date.now(),
        eiei: 'lol',
      },
    };
  },
  task => {
    console.log(`Compensating ${task.taskName}: ${task.taskId}`);
    return {
      status: 'COMPLETED',
    };
  },
  sagaConfig,
);
```
