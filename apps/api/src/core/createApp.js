const express = require('express');
const helmet = require('helmet');
const BoardRepository = require('./repositories/boardRepository');
const PostRepository = require('./repositories/postRepository');
const PolicyRepository = require('./repositories/policyRepository');
const EventRepository = require('./repositories/eventRepository');
const AdminPostRepository = require('./repositories/adminPostRepository');
const AdminPostCommandRepository = require('./repositories/adminPostCommandRepository');
const AdminPostLifecycleRepository = require('./repositories/adminPostLifecycleRepository');
const AdminImageRepository = require('./repositories/adminImageRepository');
const PublicContentService = require('./services/publicContentService');
const PublicPolicyService = require('./services/publicPolicyService');
const PublicEventService = require('./services/publicEventService');
const AdminPostService = require('./services/adminPostService');
const AdminPostCommandService = require('./services/adminPostCommandService');
const AdminPostLifecycleService = require('./services/adminPostLifecycleService');
const MediaPromotionService = require('./services/mediaPromotionService');
const AdminImageService = require('./services/adminImageService');
const PublicContentController = require('./controllers/publicContentController');
const PublicPolicyController = require('./controllers/publicPolicyController');
const PublicEventController = require('./controllers/publicEventController');
const AdminPostController = require('./controllers/adminPostController');
const AdminImageController = require('./controllers/adminImageController');
const createHealthController = require('./controllers/healthController');
const createPublicContentRoutes = require('./routes/publicContentRoutes');
const createPublicPolicyRoutes = require('./routes/publicPolicyRoutes');
const createPublicEventRoutes = require('./routes/publicEventRoutes');
const createAdminPostRoutes = require('./routes/adminPostRoutes');
const requestContext = require('./http/requestContext');
const createInternalAdminAuth = require('./http/internalAdminAuth');
const {
  createPrivateMediaStorageFromEnv,
  createPublicMediaStorageFromEnv,
} = require('./storage/privateMediaStorage');
const { errorHandler, notFoundHandler } = require('./http/errorHandler');

function createApp({
  pool,
  mediaBaseUrl = process.env.PUBLIC_MEDIA_BASE_URL || 'https://img.__SERVICE_DOMAIN__',
  serviceBaseUrl = process.env.SERVICE_BASE_URL || 'https://__SERVICE_DOMAIN__',
  eventHmacSecret = process.env.EVENT_HMAC_SECRET,
  coreServiceToken = process.env.CORE_SERVICE_TOKEN,
  privateMediaStorage = createPrivateMediaStorageFromEnv(),
  publicMediaStorage = createPublicMediaStorageFromEnv(),
  expectedMigrationVersion = Number(process.env.EXPECTED_MIGRATION_VERSION || 2),
} = {}) {
  if (!pool) throw new Error('PostgreSQL pool is required');

  const boardRepository = new BoardRepository(pool);
  const postRepository = new PostRepository(pool);
  const policyRepository = new PolicyRepository(pool);
  const eventRepository = new EventRepository(pool);
  const adminPostRepository = new AdminPostRepository(pool);
  const adminPostCommandRepository = new AdminPostCommandRepository(pool);
  const adminPostLifecycleRepository = new AdminPostLifecycleRepository(pool);
  const adminImageRepository = new AdminImageRepository(pool);
  const publicContentService = new PublicContentService({
    boardRepository,
    postRepository,
    mediaBaseUrl,
    serviceBaseUrl,
  });
  const publicContentController = new PublicContentController(publicContentService);
  const publicPolicyController = new PublicPolicyController(new PublicPolicyService({ policyRepository }));
  const publicEventController = new PublicEventController(new PublicEventService({
    boardRepository,
    postRepository,
    eventRepository,
    eventHmacSecret,
  }));
  const healthController = createHealthController(pool, expectedMigrationVersion);
  const adminPostController = new AdminPostController(
    new AdminPostService({ adminPostRepository }),
    new AdminPostCommandService({ adminPostCommandRepository }),
    new AdminPostLifecycleService({
      adminPostLifecycleRepository,
      mediaPromotionService: new MediaPromotionService({
        privateMediaStorage,
        publicMediaStorage,
      }),
    })
  );
  const adminImageController = new AdminImageController(new AdminImageService({
    adminImageRepository,
    privateMediaStorage,
  }));
  const internalAdminAuth = createInternalAdminAuth({ coreServiceToken });

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);

  app.get('/internal/health/live', healthController.live);
  app.get('/internal/health/ready', healthController.ready);
  app.use(
    '/internal/v1/admin',
    internalAdminAuth,
    createAdminPostRoutes(adminPostController, adminImageController)
  );
  app.use('/internal/v1', createPublicContentRoutes(publicContentController));
  app.use('/internal/v1', createPublicPolicyRoutes(publicPolicyController));
  app.use('/internal/v1', createPublicEventRoutes(publicEventController));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
