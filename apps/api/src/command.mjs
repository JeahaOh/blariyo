import { readFile, stat } from 'node:fs/promises';
import { createPool } from './db.mjs';
import { postService } from './posts.mjs';
import { deliverScheduleAlerts, scheduleWebhook } from './schedule-alerts.mjs';
import { adapters } from './config.mjs';
import { runOutbox } from './outbox.mjs';
import { cleanup } from './cleanup.mjs';
import { publishPolicy } from './policies.mjs';
const pool = createPool();
try {
  if (process.env.MAINTENANCE_READ_ONLY === 'true') throw new Error('MAINTENANCE_READ_ONLY');
  const command = process.argv[2];
  const options = { siteOrigin: process.env.SITE_ORIGIN, imageOrigin: process.env.IMAGE_ORIGIN };
  if (command === 'policies:publish') {
    const path = process.argv.find((v) => v.startsWith('--artifact='))?.slice(11);
    if (!path) throw new Error('ARTIFACT_REQUIRED');
    const production = process.env.NODE_ENV === 'production';
    if (production) {
      const info = await stat(path);
      if (info.uid !== 0 || (info.mode & 0o777) !== 0o600) throw new Error('ARTIFACT_PERMISSIONS');
    }
    const artifact = JSON.parse(await readFile(path, 'utf8'));
    await publishPolicy(pool, artifact, {
      ...options,
      production,
      legalConfig: JSON.parse(process.env.LEGAL_CONFIG || '{}'),
    });
  } else {
    const { storage, cache } = adapters();
    if (command === 'posts:publish-due') {
      try {
        await postService(pool, storage, options).publishDue();
      } finally {
        await deliverScheduleAlerts(pool, scheduleWebhook());
      }
    } else if (command === 'outbox:run') await runOutbox(pool, storage, cache);
    else if (command === 'cleanup:run') await cleanup(pool, storage);
    else throw new Error('UNKNOWN_COMMAND');
  }
  console.log('COMMAND_COMPLETE');
} catch (e) {
  console.error(/^[A-Z_]+$/.test(e.message) ? e.message : 'COMMAND_FAILED');
  process.exitCode = 1;
} finally {
  await pool.end();
}
