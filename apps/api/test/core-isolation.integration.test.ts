import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { localStorage } from '../dist/adapters/storage.js';
import { CleanupService } from '../dist/operations/cleanup.service.js';
import { CleanupRepository } from '../dist/operations/cleanup.repository.js';
import { CollectionCleanupService } from '../dist/features/collection/collection-cleanup.service.js';

await test('collection failures preserve Core cleanup and private previews', async (t) => {
  const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(databaseUrl);
  const migration = await migrationContext(databaseUrl);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const root = await mkdtemp('/private/tmp/nest-core-isolation-');
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const mode of ['absent', 'cleanup-failure', 'reference-failure'] as const)
    await t.test(mode, async () => {
      const backing = localStorage(root + '/' + mode);
      await backing.put('private', 'staging/core-orphan', Buffer.from('fixture'));
      await backing.put('private', 'collect-preview/candidate-orphan', Buffer.from('fixture'));
      const storage = {
        put: backing.put.bind(backing),
        get: backing.get.bind(backing),
        promote: backing.promote.bind(backing),
        delete: backing.delete.bind(backing),
        inventory: async (bucket: 'private' | 'public') =>
          (await backing.inventory(bucket)).map((item) => ({ ...item, createdAt: new Date(0) })),
      };
      const app = await createNestApplication({ databaseUrl, storage });
      try {
        const repository = app.get(CleanupRepository);
        const expire = repository.expireReceipts.bind(repository);
        let coreExpiryCalls = 0;
        repository.expireReceipts = async () => {
          coreExpiryCalls++;
          await expire();
        };
        if (mode === 'absent') repository.collectionAvailable = async () => false;
        if (mode === 'cleanup-failure')
          app.get(CollectionCleanupService).run = async () => {
            throw new Error('collection fixture failure');
          };
        if (mode === 'reference-failure') {
          const referenced = repository.referenced.bind(repository);
          repository.referenced = async (bucket, key, preview) => {
            if (preview) throw new Error('reference fixture failure');
            return referenced(bucket, key, preview);
          };
        }
        const cleanup = app.get(CleanupService);
        if (mode === 'absent') await cleanup.run();
        else
          await assert.rejects(
            cleanup.run(),
            mode === 'cleanup-failure'
              ? /COLLECTION_CLEANUP_FAILED/
              : /COLLECTION_REFERENCE_CHECK_FAILED/
          );
        assert.deepEqual(
          (await backing.inventory('private')).map((item) => item.key),
          ['collect-preview/candidate-orphan']
        );
        assert.equal(coreExpiryCalls, 1);
      } finally {
        await app.close();
      }
    });
});
