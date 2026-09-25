import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../dist/persistence/database.js';
import { rows } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { PostsService } from '../dist/features/posts/posts.service.js';
import { PoliciesService } from '../dist/features/policies/policies.service.js';
import { artifactChecksum } from '../dist/features/policies/policy-artifact.js';
import { localStorage } from '../dist/adapters/storage.js';

function command(args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [],
      stderr: Buffer[] = [];
    child.stdout.on('data', (bytes: Buffer) => stdout.push(bytes));
    child.stderr.on('data', (bytes: Buffer) => stderr.push(bytes));
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve(Buffer.concat(stdout))
        : reject(
            new Error(
              'Docker verification command failed: ' + Buffer.concat(stderr).toString('utf8')
            )
          )
    );
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
}
function normalizeDump(bytes: Buffer) {
  // Random psql restriction tokens and distro suffixes in the server-version
  // comment are not schema. Keep the numeric version and every DDL/ACL statement.
  return bytes
    .toString('utf8')
    .split('\n')
    .filter((line) => !/^\\(?:un)?restrict /.test(line))
    .map((line) =>
      line.replace(/^(-- Dumped from database version \d+(?:\.\d+)+)(?: \([^\n]*\))?$/, '$1')
    )
    .join('\n');
}
async function snapshot(source: DataSource) {
  const tables = rows(
    await source.query(
      "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('content','legal','ops','collect') ORDER BY schemaname,tablename"
    )
  );
  const data: Record<string, unknown> = {};
  for (const table of tables) {
    assert.ok(typeof table.schemaname === 'string' && /^[a-z_]+$/.test(table.schemaname));
    assert.ok(typeof table.tablename === 'string' && /^[a-z_]+$/.test(table.tablename));
    const qualified = `"${table.schemaname}"."${table.tablename}"`;
    data[qualified] = rows(
      await source.query(`SELECT to_jsonb(t) AS row FROM ${qualified} t ORDER BY to_jsonb(t)::text`)
    ).map((row) => row.row);
  }
  const sequences = rows(
    await source.query(
      "SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname IN ('content','legal','ops','collect') ORDER BY schemaname,sequencename"
    )
  );
  for (const sequence of sequences) {
    assert.ok(typeof sequence.schemaname === 'string' && /^[a-z_]+$/.test(sequence.schemaname));
    assert.ok(typeof sequence.sequencename === 'string' && /^[a-z_]+$/.test(sequence.sequencename));
    const qualified = `"${sequence.schemaname}"."${sequence.sequencename}"`;
    data[qualified] = rows(await source.query(`SELECT last_value,is_called FROM ${qualified}`));
  }
  return data;
}

await test(
  'full SQL schema, existing ledger/data and isolated PostgreSQL backup restore remain identical',
  { timeout: 120000 },
  async (t) => {
    const url = process.env.TEST_NEST_DATABASE_URL;
    assert.ok(url);
    const target = new URL(url);
    assert.equal(target.hostname, '127.0.0.1');
    assert.equal(target.port, '55449');
    const database = target.pathname.slice(1);
    assert.match(database, /^nest_[a-f0-9]{12}$/);
    const targetPort = target.port;
    // Keep this verification self-contained. The old version depended on a
    // developer's long-lived container, which does not exist on CI runners.
    const owner = 'blariyo-nest-migration-pg-' + randomBytes(6).toString('hex');
    let ownerCreated = false;
    try {
      await command([
        'run',
        '-d',
        '--name',
        owner,
        '--tmpfs',
        '/var/lib/postgresql',
        '-e',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        '-p',
        '127.0.0.1::5432',
        'postgres:18',
      ]);
      ownerCreated = true;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          await command(['exec', owner, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
          ready = true;
          break;
        } catch {
          await delay(100);
        }
      }
      assert.ok(ready, 'migration fixture PostgreSQL did not become ready');
      const mapping = (await command(['port', owner, '5432/tcp'])).toString().trim();
      const match = /^127\.0\.0\.1:(\d+)$/.exec(mapping);
      assert.ok(match?.[1]);
      const ownerUrl = `postgresql://postgres@127.0.0.1:${match[1]}/postgres`;
      const ownerDatabase = await createDataSource(ownerUrl).initialize();
      await ownerDatabase.query('CREATE DATABASE nest_schema_baseline');
      await ownerDatabase.destroy();
      const baselineUrl = `postgresql://postgres@127.0.0.1:${match[1]}/nest_schema_baseline`;
      const baselineMigration = await migrationContext(baselineUrl);
      try {
        await baselineMigration.get(MigrationsService).migrate();
      } finally {
        await baselineMigration.close();
      }
    } catch (error) {
      if (ownerCreated) await command(['rm', '-f', owner]).catch(() => undefined);
      throw error;
    }
    t.after(() => (ownerCreated ? command(['rm', '-f', owner]) : Promise.resolve()));
    const directory = await mkdtemp('/private/tmp/blariyo-schema-restore-');
    t.after(() => rm(directory, { recursive: true, force: true }));
    const dumpSchema = async (container: string, name: string) =>
      normalizeDump(
        await command(['exec', container, 'pg_dump', '-U', 'postgres', '-d', name, '--schema-only'])
      );
    const dumpTargetSchema = async (name: string) =>
      normalizeDump(
        await command([
          'run',
          '--rm',
          '--network',
          'host',
          'postgres:18',
          'pg_dump',
          '-h',
          '127.0.0.1',
          '-p',
          targetPort,
          '-U',
          'postgres',
          '-d',
          name,
          '--schema-only',
        ])
      );
    const dumpTargetArchive = async (name: string) =>
      command([
        'run',
        '--rm',
        '--network',
        'host',
        'postgres:18',
        'pg_dump',
        '-h',
        '127.0.0.1',
        '-p',
        targetPort,
        '-U',
        'postgres',
        '-d',
        name,
        '-Fc',
      ]);
    const originalSchema = await dumpSchema(owner, 'nest_schema_baseline');
    const migration = await migrationContext(url);
    try {
      await migration.get(MigrationsService).migrate();
    } finally {
      await migration.close();
    }
    const emptySchema = await dumpTargetSchema(database);
    assert.equal(
      emptySchema,
      originalSchema,
      'full dump includes constraints, indexes, sequences, triggers, functions, ACL and RLS'
    );
    const source = await createDataSource(url).initialize();
    t.after(() => source.destroy());
    const storage = localStorage(directory + '/media');
    const app = await createNestApplication({ databaseUrl: url, storage });
    try {
      const posts = app.get(PostsService);
      const draft = await app.get(UnitOfWork).transaction(() =>
        posts.createDraftInTransaction(
          {
            boardSlug: 'meme',
            title: 'Restore synthetic post',
            source: null,
            pinnedPosition: null,
            blocks: [{ type: 'TEXT', text: 'Synthetic backup fixture only.' }],
          },
          'system:migration'
        )
      );
      await posts.command(
        {
          action: 'publish',
          params: { postId: String(draft.postId) },
          body: { lockVersion: 1, mode: 'IMMEDIATE' },
        },
        'system:scheduler'
      );
      for (const type of ['terms', 'privacy']) {
        const artifact = {
          type,
          version: 'restore-fixture',
          title: 'Synthetic policy',
          body: '<p>Synthetic local policy.</p>',
          effectiveAt: new Date().toISOString(),
        };
        await app
          .get(PoliciesService)
          .publish({ ...artifact, checksum: artifactChecksum(artifact) });
      }
    } finally {
      await app.close();
    }
    const before = await snapshot(source);
    const existing = await migrationContext(url);
    try {
      await existing.get(MigrationsService).migrate();
    } finally {
      await existing.close();
    }
    const restarted = await createNestApplication({ databaseUrl: url, storage });
    await restarted.close();
    assert.deepEqual(
      await snapshot(source),
      before,
      'existing data, timestamps, ledger/checksums and sequence state unchanged by startup/migrate'
    );
    assert.equal(await dumpTargetSchema(database), originalSchema);
    const archive = await dumpTargetArchive(database);
    await writeFile(directory + '/synthetic.dump', archive);
    assert.ok(archive.length > 1000);
    const restoredName = 'blariyo-nest-restore-' + randomBytes(6).toString('hex');
    let created = false;
    let restored: DataSource | undefined;
    try {
      await command([
        'run',
        '-d',
        '--name',
        restoredName,
        '--tmpfs',
        '/var/lib/postgresql',
        '-e',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        '-e',
        'POSTGRES_DB=nest_restore',
        '-p',
        '127.0.0.1::5432',
        'postgres:18',
      ]);
      created = true;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          await command([
            'exec',
            restoredName,
            'pg_isready',
            '-h',
            '127.0.0.1',
            '-U',
            'postgres',
            '-d',
            'nest_restore',
          ]);
          ready = true;
          break;
        } catch {
          await delay(100);
        }
      }
      assert.ok(ready);
      const mapping = (await command(['port', restoredName, '5432/tcp'])).toString().trim();
      const match = /^127\.0\.0\.1:(\d+)$/.exec(mapping);
      assert.ok(match?.[1]);
      const restoredUrl = `postgresql://postgres@127.0.0.1:${match[1]}/nest_restore`;
      await command(
        [
          'exec',
          '-i',
          restoredName,
          'pg_restore',
          '-U',
          'postgres',
          '-d',
          'nest_restore',
          '--exit-on-error',
        ],
        archive
      );
      // PostgreSQL reparses deparsed CHECK expressions on restore (array casts may move to each element).
      // Normalize the untouched baseline through the same PostgreSQL parser, retaining every DDL/ACL statement.
      await command(['exec', restoredName, 'createdb', '-U', 'postgres', 'nest_reference']);
      await command(
        [
          'exec',
          '-i',
          restoredName,
          'psql',
          '-U',
          'postgres',
          '-d',
          'nest_reference',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        Buffer.from(originalSchema)
      );
      const referenceSchema = await dumpSchema(restoredName, 'nest_reference');
      assert.equal(await dumpSchema(restoredName, 'nest_restore'), referenceSchema);

      restored = await createDataSource(restoredUrl).initialize();
      assert.deepEqual(
        await snapshot(restored),
        before,
        'independent server restores all rows, migration ledger and sequences'
      );
      const restoredApp = await createNestApplication({ databaseUrl: restoredUrl, storage });
      try {
        await restoredApp.listen(0, '127.0.0.1');
        const base = await restoredApp.getUrl();
        const health = await fetch(base + '/internal/health/ready');
        assert.equal(health.status, 200);
        await health.body?.cancel();
        const list = await fetch(base + '/api/v1/boards/meme/posts');
        assert.equal(list.status, 200);
        assert.match(await list.text(), /Restore synthetic post/);
        for (const type of ['terms', 'privacy']) {
          const response = await fetch(base + '/api/v1/policies/' + type);
          assert.equal(response.status, 200);
          assert.match(await response.text(), /restore-fixture/);
        }
      } finally {
        await restoredApp.close();
      }
      assert.deepEqual(await snapshot(restored), before, 'read APIs do not mutate restored data');
      console.log(
        JSON.stringify({
          event: 'NEST_SCHEMA_RESTORE_VERIFIED',
          tablesAndSequences: Object.keys(before).length,
          archiveSha256: createHash('sha256').update(archive).digest('hex'),
          schemaSha256: createHash('sha256').update(originalSchema).digest('hex'),
        })
      );
    } finally {
      await restored?.destroy();
      if (created) await command(['rm', '-f', restoredName]);
    }
  }
);
