import { Admin } from '../admin';

const kafkaServers = process.env['MELONADE_KAFKA_SERVERS'];
const namespace = process.env['MELONADE_NAMESPACE'];

const adminClient = new Admin({
  kafkaServers,
  namespace,
});

adminClient.once('ready', () => {
  const now = new Date().toISOString();

  for (const transactionNumber in new Array(1).fill(null)) {
    const transactionId = `sample-${transactionNumber}-${now}`;
    console.log(`Starting transactionId: ${transactionId}`);
    adminClient.startTransaction(
      transactionId,
      {
        name: 'simple',
        rev: '1',
      },
      {},
      ['demo', 'example-tag'],
    );
  }
});
