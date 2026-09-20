import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { pathToFileURL } from 'node:url';
import { CollectionOperationsModule } from '../features/collection/collection-operations.module.js';
import { CollectionOperationsService } from '../features/collection/collection-operations.service.js';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { resolveDatabaseUrl } from '../bootstrap/database-config.js';

export async function transitionContext(databaseUrl: string) {
  return NestFactory.createApplicationContext(
    CollectionOperationsModule.register(PersistenceModule.forRoot(databaseUrl, true)),
    { logger: false, abortOnError: false }
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode !== 'check' && mode !== 'apply') {
    console.error('Usage: node apps/api/dist/commands/collection-transition.js check|apply');
    process.exitCode = 2;
  } else {
    try {
      const databaseUrl = resolveDatabaseUrl(process.env, 'app');
      const app = await transitionContext(databaseUrl);
      try {
        const service = app.get(CollectionOperationsService);
        console.log(
          JSON.stringify(
            await (mode === 'apply' ? service.applyTransition() : service.inspectTransition())
          )
        );
      } finally {
        await app.close();
      }
    } catch (error) {
      console.error(
        error instanceof Error && error.message === 'LEGACY_DRAIN_REQUIRED'
          ? 'LEGACY_DRAIN_REQUIRED'
          : 'COLLECTOR_TRANSITION_FAILED'
      );
      process.exitCode = 1;
    }
  }
}
