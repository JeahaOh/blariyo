import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';
import { object } from './browser-values.ts';

// Runs the actual user-facing launcher, including its opt-in command timer, on localhost:3000.
// Tests never invoke PostsService.publishDue or OutboxService.run directly.
export async function localDevelopmentFixture(t: TestContext) {
  const base = process.env.TEST_DATABASE_ADMIN_URL;
  assert.ok(base);
  const target = new URL(base);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.ok(['55449', '5439'].includes(target.port));
  assert.equal(target.pathname, '/postgres');
  assert.equal(target.search, '');
  const admin = await createDataSource(base).initialize();
  const name = `blariyo_sandbox_${randomBytes(6).toString('hex')}`;
  target.pathname = '/' + name;
  const database = createDataSource(target.href);
  const directory = await mkdtemp(join(tmpdir(), 'blariyo-admin-sandbox-'));
  let child: ChildProcess | undefined,
    created = false;
  const logs: string[] = [];
  let adminToken = '';
  const origin = 'http://localhost:3000';
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const owned = child;
      const timer = setTimeout(() => owned.kill('SIGKILL'), 15000);
      const result: unknown[] = await exited;
      clearTimeout(timer);
      assert.equal(result[1], null, 'launcher must drain workers and shut down gracefully');
      assert.equal(result[0], 0);
    }
  }
  t.after(async () => {
    try {
      await stop();
    } finally {
      if (database.isInitialized) await database.destroy();
      try {
        if (created) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      } finally {
        await admin.destroy();
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  const migration = await migrationContext(target.href);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  await database.initialize();
  await writeFile(
    join(directory, 'sandbox.json'),
    JSON.stringify({ version: 1, databaseUrl: target.href }),
    { mode: 0o600 }
  );
  async function start() {
    let output = '';
    let launchError: Error | undefined;
    child = spawn(
      process.execPath,
      [
        'scripts/local/start-development.mjs',
        `--sandbox=${directory}`,
        '--workers',
        '--worker-interval-ms=1000',
      ],
      {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    child.once('error', (e) => {
      launchError = e;
    });
    for (const stream of [child.stdout, child.stderr])
      stream?.on('data', (data: Buffer) => {
        output += data.toString();
        logs.push(data.toString());
      });
    await expect
      .poll(
        async () => {
          if (launchError) throw launchError;
          assert.equal(child?.exitCode, null, 'launcher exited before ready');
          if (!output.includes('Listening on')) return false;
          try {
            return (await fetch(origin + '/api/v1/boards')).ok;
          } catch {
            return false;
          }
        },
        { timeout: 30000 }
      )
      .toBe(true);
    const session = object(JSON.parse(await readFile(join(directory, 'session.json'), 'utf8')));
    assert.equal(typeof session.adminToken, 'string');
    adminToken = String(session.adminToken);
  }
  await start();
  const pool = {
    async query(sql: string, parameters: unknown[] = []) {
      const result: unknown = await database.query(sql, parameters);
      assert.ok(Array.isArray(result));
      const rows = result.map(object);
      return { rows, rowCount: rows.length };
    },
  };
  return {
    origin,
    directory,
    pool,
    databaseUrl: target.href,
    storage: localStorage(join(directory, 'media')),
    get adminToken() {
      return adminToken;
    },
    logs,
    stop,
    start,
    async waitForOutbox() {
      await expect
        .poll(
          async () =>
            (
              await pool.query(
                "SELECT count(*)::int AS remaining FROM ops.outbox_task WHERE status<>'SUCCEEDED'"
              )
            ).rows[0]?.remaining,
          { timeout: 15000 }
        )
        .toBe(0);
    },
  };
}
