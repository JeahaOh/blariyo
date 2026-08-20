const pool = require('../config/database');
const { aggregateEventBatch, deleteExpiredRawEvents } = require('./aggregateEventBatch');

async function run() {
  let total = 0;
  while (true) {
    const result = await aggregateEventBatch(pool);
    total += result.processed;
    if (!result.locked || result.processed === 0) break;
  }
  const deleted = await deleteExpiredRawEvents(pool);
  console.log(`Aggregated ${total} raw events and deleted ${deleted} expired raw events`);
}

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
