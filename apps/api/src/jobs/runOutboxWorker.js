const pool = require('../config/database');
const OutboxRepository = require('../core/repositories/outboxRepository');
const OutboxProcessor = require('./processOutboxBatch');
const {
  createPrivateMediaStorageFromEnv,
  createPublicMediaStorageFromEnv,
} = require('../core/storage/privateMediaStorage');
const { createCachePurgeFromEnv } = require('../core/cache/cloudflareCachePurge');

async function run() {
  const processor = new OutboxProcessor({
    outboxRepository: new OutboxRepository(pool),
    privateMediaStorage: createPrivateMediaStorageFromEnv(),
    publicMediaStorage: createPublicMediaStorageFromEnv(),
    cachePurge: createCachePurgeFromEnv(),
  });
  const result = await processor.processBatch({ limit: 500 });
  console.log(
    `Outbox recovered ${result.recovered}, processed ${result.processed}, `
    + `succeeded ${result.succeeded}, failed ${result.failed}`
  );
}

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
