import { collectReader } from './adapters/collect-reader.js';
import { pathToFileURL } from 'node:url';
import { adapters, type Environment } from './bootstrap/config.js';
import { resolveDatabaseUrl } from './bootstrap/database-config.js';
import { collectionSettings } from './bootstrap/collection-settings.js';
import { loadCollectorTokens } from './bootstrap/startup.js';
import { createNestApplication } from './bootstrap/application.js';
import { PoliciesService } from './features/policies/policies.service.js';

export async function start(env: Environment = process.env) {
  const databaseUrl = resolveDatabaseUrl(env, 'app');
  const collection = collectionSettings(env);
  const collectorTokens = await loadCollectorTokens(collection, env);
  const production = env.NODE_ENV === 'production';
  if (
    production &&
    (!/^https:\/\//.test(env.SITE_ORIGIN || '') || !/^https:\/\//.test(env.IMAGE_ORIGIN || ''))
  )
    throw new Error('PRODUCTION_ORIGIN_REQUIRED');
  if (production) {
    const secret = env.ANALYTICS_CONTENT_KEY_SECRET || '';
    if (!secret) throw new Error('ANALYTICS_CONTENT_KEY_SECRET_REQUIRED');
    try {
      if (Buffer.from(secret, 'base64').length < 32)
        throw new Error('ANALYTICS_CONTENT_KEY_SECRET_REQUIRED');
    } catch {
      throw new Error('ANALYTICS_CONTENT_KEY_SECRET_REQUIRED');
    }
  }
  const app = await createNestApplication({
    databaseUrl,
    ...adapters(env),
    ...collection,
    collectorTokens,
    collectReader: collectReader(env),
    localMedia: !production,
    ...(env.SERVICE_TOKEN === undefined ? {} : { serviceToken: env.SERVICE_TOKEN }),
    ...(env.SITE_ORIGIN === undefined ? {} : { siteOrigin: env.SITE_ORIGIN }),
    ...(env.IMAGE_ORIGIN === undefined ? {} : { imageOrigin: env.IMAGE_ORIGIN }),
    ...(env.ANALYTICS_CONTENT_KEY_SECRET === undefined
      ? {}
      : { analyticsContentKeySecret: env.ANALYTICS_CONTENT_KEY_SECRET }),
    maintenance: env.MAINTENANCE_READ_ONLY === 'true',
  });
  try {
    if (production) await app.get(PoliciesService).assertProductionReady();
    app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
    await app.listen(Number(env.PORT || 3100), env.HOST || '127.0.0.1');
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await start();
  } catch (error) {
    console.error(
      error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'STARTUP_FAILED'
    );
    process.exitCode = 1;
  }
}
