import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';

await test(
  'actual dev script rebuilds changed TypeScript before restarting the Nest process',
  { timeout: 60000 },
  async (t) => {
    const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
    assert.ok(databaseUrl);
    const migration = await migrationContext(databaseUrl);
    try {
      await migration.get(MigrationsService).migrate();
    } finally {
      await migration.close();
    }
    const root = await mkdtemp('/private/tmp/nest-dev-watch-');
    t.after(() => rm(root, { recursive: true, force: true }));
    const api = root + '/apps/api';
    await mkdir(api, { recursive: true });
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    await symlink(repository + 'node_modules', root + '/node_modules', 'dir');
    await cp(repository + 'apps/api/src', api + '/src', {
      recursive: true,
      filter: async (path) => (await stat(path)).isDirectory() || path.endsWith('.ts'),
    });
    for (const file of ['build.ts', 'dev.ts', 'package.json', 'tsconfig.json'])
      await cp(repository + 'apps/api/' + file, api + '/' + file);
    const reservation = createServer();
    await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const address = reservation.address();
    assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + String(address.port);
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => (error ? reject(error) : resolve()))
    );
    const child = spawn('npm', ['run', 'dev'], {
      cwd: api,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        HOST: '127.0.0.1',
        PORT: String(address.port),
        STORAGE_MODE: 'local',
        STORAGE_ROOT: root + '/media',
        COLLECT_MANUAL_URL_ENABLED: 'false',
        COLLECT_DISCORD_COMMAND_ENABLED: 'false',
        MAINTENANCE_READ_ONLY: 'false',
      },
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (value: string) => {
      output += value;
    });
    child.stderr.on('data', (value: string) => {
      output += value;
    });
    const terminal = new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', () => resolve());
    });
    const stop = () => {
      if (child.pid && child.exitCode === null && child.signalCode === null)
        process.kill(-child.pid, 'SIGTERM');
    };
    t.after(async () => {
      stop();
      await terminal;
    });
    async function until(check: () => Promise<boolean>) {
      for (let attempt = 0; attempt < 200; attempt++) {
        assert.ok(child.exitCode === null && child.signalCode === null, output);
        if (await check()) return;
        await delay(100);
      }
      assert.fail(output || 'dev process did not become ready');
    }
    const ready = async () => {
      try {
        const response = await fetch(origin + '/internal/health/ready', {
          signal: AbortSignal.timeout(1000),
        });
        await response.body?.cancel();
        return response.status === 200;
      } catch {
        return false;
      }
    };
    await until(ready);
    const source = api + '/src/features/health/health.controller.ts';
    const marker = '// dev watch fixture: compile this source revision';
    const validSource = (await readFile(source, 'utf8')) + '\n' + marker + '\n';
    await writeFile(source, validSource);
    await until(async () => {
      if (!output.includes('Restarting')) return false;
      try {
        return (
          (await readFile(api + '/dist/features/health/health.controller.js', 'utf8')).includes(
            marker
          ) && (await ready())
        );
      } catch {
        return false;
      }
    });
    const live = await fetch(origin + '/internal/health/live');
    assert.deepEqual(await live.json(), { status: 'UP' });
    const restarts = () =>
      output.split('Restarting Nest after successful TypeScript build').length - 1;
    const beforeError = restarts();
    const errorOffset = output.length;
    await writeFile(source, validSource + '\nconst invalidBuildFixture: string = 123;\n');
    await until(async () => output.slice(errorOffset).includes('TS2322'));
    assert.equal(restarts(), beforeError);
    assert.equal(await ready(), true);
    assert.equal(
      (await readFile(api + '/dist/features/health/health.controller.js', 'utf8')).includes(
        'invalidBuildFixture'
      ),
      false
    );
    await writeFile(source, validSource + '\n// recovered valid build\n');
    await until(async () => restarts() > beforeError && (await ready()));
    stop();
    await terminal;
    await assert.rejects(
      fetch(origin + '/internal/health/live', { signal: AbortSignal.timeout(1000) })
    );
  }
);
