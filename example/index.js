const cluster = require('cluster')

const RUNNERS = 4

if (cluster.isMaster) {
  cluster.on('exit', worker => {
    console.log(`Workker: ${worker.id} are dead`);
  });

  cluster.on('fork', worker => {
    console.log(`Worker ${worker.process.pid} started`);
  });

  for (let i = 0; i < RUNNERS; i++) {
    cluster.fork();
  }
} else {
  require('./01-simple-workflow');
  // require('./02-parallel');
  // require('./03-decision');
  // require('./04-compensation-workflow');
  // require('./05-compensation-then-retry-workflow');
  // require('./06-compensation-then-retry-workflow-and-task-retry');
  // require('./07-admin-start-transaction'); // Should not run this with > 1 clusters
}
