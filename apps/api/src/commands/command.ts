import { SourceAutoPublishService } from '../features/collection/source-auto-publish.service.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { AppModule } from '../app.module.js';
import { adapters, type Environment } from '../bootstrap/config.js';
import { resolveDatabaseUrl } from '../bootstrap/database-config.js';
import { collectionSettings } from '../bootstrap/collection-settings.js';
import { PostsService } from '../features/posts/posts.service.js';
import { PoliciesService } from '../features/policies/policies.service.js';
import { PoliciesModule } from '../features/policies/policies.module.js';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { ScheduleAlertsService } from '../operations/schedule-alerts.service.js';
import { OutboxService } from '../operations/outbox.service.js';
import { CleanupService } from '../operations/cleanup.service.js';
import { collectReader } from '../adapters/collect-reader.js';

export function autoPublishArguments(args: string[]) {
  let dryRun = false, limit = 5;
  const seen = new Set<string>();
  for (const arg of args) {
    const key = arg === '--dry-run' ? 'dry-run' : arg.startsWith('--limit=') ? 'limit' : '';
    if (!key || seen.has(key)) throw new Error('AUTO_PUBLISH_ARGUMENT_INVALID');
    seen.add(key);
    if (key === 'dry-run') dryRun = true;
    else {
      if (!/^--limit=(?:[1-9]|1[0-9]|20)$/.test(arg)) throw new Error('AUTO_PUBLISH_LIMIT_INVALID');
      limit = Number(arg.slice(8));
    }
  }
  return { dryRun,limit };
}
export async function runCommand(command: string | undefined, args: string[], env: Environment = process.env) {
  const autoOptions = command === 'collection:auto-publish' ? autoPublishArguments(args) : undefined;
  if (env.MAINTENANCE_READ_ONLY === 'true') throw new Error('MAINTENANCE_READ_ONLY');
  const databaseUrl = resolveDatabaseUrl(env, 'app');
  const origins = { ...(env.SITE_ORIGIN === undefined ? {} : { siteOrigin: env.SITE_ORIGIN }), ...(env.IMAGE_ORIGIN === undefined ? {} : { imageOrigin: env.IMAGE_ORIGIN }) };
  let app: INestApplicationContext | undefined;
  try {
    if (command === 'policies:publish') {
      const path = args.find(value => value.startsWith('--artifact='))?.slice(11);
      if (!path) throw new Error('ARTIFACT_REQUIRED');
      const production = env.NODE_ENV === 'production';
      if (production) {
        const info = await stat(path);
        if (info.uid !== 0 || (info.mode & 0o777) !== 0o600) throw new Error('ARTIFACT_PERMISSIONS');
      }
      const artifact: unknown = JSON.parse(await readFile(path, 'utf8'));
      const legalConfig: unknown = JSON.parse(env.LEGAL_CONFIG || '{}');
      app = await NestFactory.createApplicationContext(PoliciesModule.register(PersistenceModule.forRoot(databaseUrl)), { logger: false, abortOnError: false });
      await app.get(PoliciesService).publish(artifact, { ...origins, production, legalConfig });
    } else {
      app = await NestFactory.createApplicationContext(AppModule.register({ databaseUrl, ...origins, ...adapters(env), ...collectionSettings(env),
        ...(autoOptions ? { collectReader:collectReader(env) } : {}) }), { logger: false, abortOnError: false });
      if (command === 'posts:publish-due') {
        try { await app.get(PostsService).publishDue(); }
        finally { await app.get(ScheduleAlertsService).deliver(); }
      } else if (autoOptions) {
        const service = app.get(SourceAutoPublishService);
        console.log(JSON.stringify(autoOptions.dryRun ? { event:'SOURCE_AUTO_PUBLISH_PREVIEW',decisions:await service.preview(autoOptions.limit) }
          : { event:'SOURCE_AUTO_PUBLISH',counts:await service.run(autoOptions.limit) }));
      }
      else if (command === 'outbox:run') await app.get(OutboxService).run();
      else if (command === 'cleanup:run') await app.get(CleanupService).run();
      else throw new Error('UNKNOWN_COMMAND');
    }
  } finally { await app?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runCommand(process.argv[2], process.argv.slice(3));
    console.log('COMMAND_COMPLETE');
  } catch (error) {
    console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'COMMAND_FAILED');
    process.exitCode = 1;
  }
}
