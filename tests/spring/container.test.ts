import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, realpath, rm } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { until } from '../helpers/spring-runtime.ts';

const image = process.env.COLLECTOR_TEST_IMAGE;
const exec = promisify(execFile);
await test(
  'Linux container boots with private file secrets and its own DB; no host ports',
  {
    skip: !image,
    timeout: 120000,
  },
  async (t) => {
    assert.ok(image);
    const dir = await realpath(await mkdtemp('/private/tmp/blariyo-linux-test-'));
    const suffix = randomBytes(6).toString('hex');
    const network = 'blariyo-linux-' + suffix,
      database = network + '-db',
      app = network + '-app';
    const uid = String(userInfo().uid),
      gid = String(userInfo().gid);
    const containers: string[] = [];
    let networkCreated = false;
    t.after(async () => {
      for (const container of containers.reverse())
        await exec('docker', ['rm', '-f', container]).catch(() => {});
      if (networkCreated) await exec('docker', ['network', 'rm', network]);
      await rm(dir, { recursive: true, force: true });
    });
    const secrets = join(dir, 'secrets'),
      state = join(dir, 'state'),
      config = join(dir, 'config');
    for (const path of [secrets, state, config]) await mkdir(path, { mode: 0o700 });
    const password = randomBytes(32).toString('hex');
    const values = {
      'collector-id': 'collector-aaaaaaaaaaaaaaaa',
      'database-password': password,
      'core-token': randomBytes(32).toString('hex'),
      'spool-key': randomBytes(32).toString('base64'),
      'request-key': randomBytes(32).toString('base64'),
      'local-run-token': randomBytes(32).toString('hex'),
      'local-read-token': randomBytes(32).toString('hex'),
      'local-stop-token': randomBytes(32).toString('hex'),
    };
    for (const [name, value] of Object.entries(values))
      await writeFile(join(secrets, name), value, { mode: 0o600 });
    const envFile = join(dir, 'postgres.env');
    await writeFile(
      envFile,
      `POSTGRES_USER=collector\nPOSTGRES_DB=collector\nPOSTGRES_PASSWORD=${password}\n`,
      { mode: 0o600 }
    );
    await writeFile(
      join(config, 'collector.properties'),
      'collector.processing-enabled=false\ncollector.discord-enabled=false\ncollector.quartz-enabled=false\ncollector.sources-file=/config/sources.json\n',
      { mode: 0o600 }
    );
    await writeFile(join(config, 'sources.json'), '{}', { mode: 0o600 });
    await exec('docker', ['network', 'create', network]);
    networkCreated = true;
    await exec('docker', [
      'run',
      '-d',
      '--name',
      database,
      '--network',
      network,
      '--tmpfs',
      '/var/lib/postgresql',
      '--env-file',
      envFile,
      'postgres:18',
    ]);
    containers.push(database);
    await until(async () => {
      await exec('docker', ['exec', database, 'pg_isready', '-U', 'collector']);
      return true;
    });
    const common = [
      '--network',
      network,
      '--user',
      `${uid}:${gid}`,
      '--mount',
      `type=bind,src=${secrets},dst=/run/operator-secrets,readonly`,
      '--mount',
      `type=bind,src=${config},dst=/config,readonly`,
      '--mount',
      `type=bind,src=${state},dst=/state`,
      '-e',
      `COLLECTOR_DATABASE_URL=jdbc:postgresql://${database}:5432/collector`,
      '-e',
      'COLLECTOR_DATABASE_USER=collector',
      '-e',
      'COLLECTOR_CORE_ORIGIN=https://service.invalid',
      '-e',
      'COLLECTOR_SECRETS_DIRECTORY=/run/operator-secrets',
      '-e',
      'COLLECTOR_SPOOL_DIRECTORY=/state/spool',
    ];
    const migrated = await exec('docker', [
      'run',
      '--rm',
      ...common,
      '--entrypoint',
      'java',
      image,
      '-Dloader.main=com.blariyo.collector.ops.MigrationMain',
      '-cp',
      '/app/collector.jar',
      'org.springframework.boot.loader.launch.PropertiesLauncher',
      '/config/collector.properties',
    ]);
    assert.match(migrated.stdout, /MIGRAT/);
    await exec('docker', [
      'run',
      '-d',
      '--name',
      app,
      ...common,
      '--read-only',
      '--tmpfs',
      '/tmp',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
      image,
      '--spring.config.additional-location=file:/config/collector.properties',
    ]);
    containers.push(app);
    await until(async () => {
      const result = await exec('docker', [
        'exec',
        app,
        'bash',
        '-c',
        'exec 3<>/dev/tcp/127.0.0.1/18787; printf "GET /actuator/health/liveness HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n" >&3; head -n 1 <&3',
      ]);
      return result.stdout.includes('200');
    }, 60000);
    const ports = await exec('docker', ['port', app]);
    assert.equal(ports.stdout.trim(), '');
    const counts = await exec('docker', [
      'exec',
      database,
      'psql',
      '-U',
      'collector',
      '-d',
      'collector',
      '-Atc',
      'SELECT count(*) FROM collector.identity; SELECT count(*) FROM collector.token_audit;',
    ]);
    assert.equal(counts.stdout.trim(), '1\n3');
    const logs = await exec('docker', ['logs', app]);
    for (const secret of Object.values(values))
      assert.ok(!(logs.stdout + logs.stderr).includes(secret));
  }
);
