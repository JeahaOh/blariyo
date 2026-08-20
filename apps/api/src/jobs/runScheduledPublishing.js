const pool = require('../config/database');
const AdminPostLifecycleRepository = require('../core/repositories/adminPostLifecycleRepository');
const MediaPromotionService = require('../core/services/mediaPromotionService');
const ScheduledPostPublisher = require('./publishScheduledPosts');
const {
  createPrivateMediaStorageFromEnv,
  createPublicMediaStorageFromEnv,
} = require('../core/storage/privateMediaStorage');

async function run() {
  const publisher = new ScheduledPostPublisher({
    adminPostLifecycleRepository: new AdminPostLifecycleRepository(pool),
    mediaPromotionService: new MediaPromotionService({
      privateMediaStorage: createPrivateMediaStorageFromEnv(),
      publicMediaStorage: createPublicMediaStorageFromEnv(),
    }),
  });
  const result = await publisher.publishDue({ limit: 500 });
  console.log(
    `Scheduled candidates ${result.candidates}, published ${result.published}, `
    + `skipped ${result.skipped}, failed ${result.failed}`
  );
  if (result.failed > 0) throw new Error('SCHEDULED_PUBLISH_FAILED');
}

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
