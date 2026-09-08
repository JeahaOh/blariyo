import { collectionSettings } from './collection-routes.mjs';
import { createPool } from './db.mjs';
import { adapters } from './config.mjs';
import { createApp } from './app.mjs';
import { loadCollectorTokens } from './startup.mjs';
const pool = createPool();
const collection = collectionSettings(),
  collectorTokens = await loadCollectorTokens(collection);
if (process.env.NODE_ENV === 'production') {
  if (
    !/^https:\/\//.test(process.env.SITE_ORIGIN || '') ||
    !/^https:\/\//.test(process.env.IMAGE_ORIGIN || '')
  )
    throw new Error('PRODUCTION_ORIGIN_REQUIRED');
  const policies = await pool.query(
    "SELECT count(DISTINCT policy_type) FROM legal.policy_version WHERE status='EFFECTIVE' AND effective_at<=now()"
  );
  if (Number(policies.rows[0].count) !== 2) throw new Error('POLICY_RELEASE_REQUIRED');
}
const server = createApp(pool, {
  ...adapters(),
  ...collection,
  collectorTokens,
  localMedia: process.env.NODE_ENV !== 'production',
  serviceToken: process.env.SERVICE_TOKEN,
  siteOrigin: process.env.SITE_ORIGIN,
  imageOrigin: process.env.IMAGE_ORIGIN,
  maintenance: process.env.MAINTENANCE_READ_ONLY === 'true',
}).listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    })
  );
