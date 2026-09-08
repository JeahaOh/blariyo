import { readFile } from 'node:fs/promises';
import { collectionSettings } from './collection-routes.mjs';
import { createPool } from './db.mjs';
import { adapters } from './config.mjs';
import { createApp } from './app.mjs';
const pool = createPool();
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
  ...collectionSettings(),
  collectorTokens: process.env.COLLECTOR_TOKENS_FILE ? JSON.parse(await readFile(process.env.COLLECTOR_TOKENS_FILE, 'utf8')) : [],
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
