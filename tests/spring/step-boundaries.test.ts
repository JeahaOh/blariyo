import { freePort, until } from '../helpers/spring-runtime.ts';
import { object, firstRow } from '../helpers/browser-values.ts';
import { contractData } from '../../apps/api/test/contract-response.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Readable } from 'node:stream';
import { spawn, execFile, type ChildProcessByStdio } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { createServer as createHttpServer, type Server } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { browserFixture } from '../helpers/browser-fixture.ts';
const exec = promisify(execFile);
const javaHome = process.env.JAVA_HOME;
assert.ok(javaHome, 'JAVA_HOME required');
const java = join(javaHome, 'bin/java');
const classpath = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
await test(
  'Spring six Step before/after SIGKILL matrix and backup rotation',
  { timeout: 900000 },
  async (t) => {
    let child: ChildProcessByStdio<null, Readable, Readable> | null = null;
    let container: string | undefined = undefined;
    let dir: string | undefined = undefined;
    let proxy: Server | undefined = undefined;
    const secrets: Record<string, string> = {};
    function currentChild() {
      assert.ok(child);
      return child;
    }
    let output = '';
    t.after(async () => {
      for (const value of Object.values(secrets)) output = output.replaceAll(value, '[redacted]');
      await writeFile('/private/tmp/blariyo-spring-step-process.log', output);
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(currentChild(), 'exit');
        currentChild().kill('SIGTERM');
        const timer = setTimeout(() => child?.kill('SIGKILL'), 10000);
        await exited;
        clearTimeout(timer);
      }
      if (proxy) {
        proxy.closeAllConnections();
        const server = proxy;
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
      if (container) await exec('docker', ['rm', '-f', container]);
      if (dir) await rm(dir, { recursive: true, force: true });
    });
    const f = await browserFixture(t, { collection: true, spring: true });
    proxy = createHttpServer((req, res) => {
      void (async () => {
        try {
          const chunks: Buffer[] = [];
          for await (const input of req) {
            const chunk: unknown = input;
            assert.ok(chunk instanceof Uint8Array);
            chunks.push(Buffer.from(chunk));
          }
          const headers: Record<string, string> = {};
          for (const name of [
            'authorization',
            'content-type',
            'idempotency-key',
            'x-content-sha256',
          ]) {
            const value = req.headers[name];
            if (typeof value === 'string') headers[name] = value;
          }
          assert.ok(req.url && req.method);
          const upstream = await fetch(f.origin + req.url, {
            method: req.method,
            headers,
            ...(req.method === 'GET' ? {} : { body: Buffer.concat(chunks) }),
          });
          const bytes = Buffer.from(await upstream.arrayBuffer());
          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
          });
          res.end(bytes);
        } catch {
          res.destroy();
        }
      })();
    }).listen(0, '127.0.0.1');
    await once(proxy, 'listening');

    dir = await mkdtemp('/private/tmp/blariyo-spring-step-');
    const databaseContainer = 'blariyo-spring-test-' + randomBytes(6).toString('hex');
    container = databaseContainer;
    await exec('docker', [
      'run',
      '-d',
      '--name',
      container,
      '--tmpfs',
      '/var/lib/postgresql',
      '-p',
      '127.0.0.1::5432',
      '-e',
      'POSTGRES_USER=fixture',
      '-e',
      'POSTGRES_DB=fixture',
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      'postgres:18',
    ]);
    await until(async () => {
      await exec('docker', ['exec', databaseContainer, 'pg_isready', '-U', 'fixture']);
      return true;
    });
    const mapping = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim();
    const dbPort = mapping.split(':').at(-1);
    const address = proxy.address();
    assert.ok(address && typeof address !== 'string');
    const env = {
      ...process.env,
      COLLECTOR_DATABASE_URL: `jdbc:postgresql://127.0.0.1:${dbPort}/fixture`,
      COLLECTOR_DATABASE_USER: 'fixture',
      COLLECTOR_DATABASE_PASSWORD: '',
      COLLECTOR_CORE_ORIGIN: `http://127.0.0.1:${address.port}`,
    };
    await exec(java, ['-cp', classpath, 'com.blariyo.collector.ops.MigrationMain'], { env });
    await exec(java, ['-cp', classpath, 'com.blariyo.collector.ops.MigrationMain'], { env });
    Object.assign(secrets, {
      'collector-id': 'collector-aaaaaaaaaaaaaaaa',
      'core-token': f.collectorToken,
      'backup-key': randomBytes(32).toString('base64'),
      'spool-key': randomBytes(32).toString('base64'),
      'request-key': randomBytes(32).toString('base64'),
      'local-run-token': randomBytes(32).toString('hex'),
      'local-read-token': randomBytes(32).toString('hex'),
      'local-stop-token': randomBytes(32).toString('hex'),
    });
    const secretFile = join(dir, 'secrets.json'),
      sourceFile = join(dir, 'sources.json');
    await writeFile(secretFile, JSON.stringify(secrets), { mode: 0o600 });
    const source = firstRow(
      await f.pool.query(
        "INSERT INTO collect.source(name,base_url,host,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('Spring fixture','https://fixture.invalid','fixture.invalid',true,true,now(),1000,100,'system:migration','system:migration') RETURNING id"
      )
    ).id;
    assert.ok(typeof source === 'string');
    await writeFile(
      sourceFile,
      JSON.stringify({
        [source]: {
          approved: true,
          host: 'fixture.invalid',
          pathPrefixes: ['/post/', '/image/'],
          titleSelector: 'h1',
          imageSelector: 'article img',
          userAgent: 'Blariyo fixture contact-test',
        },
      })
    );
    const port = await freePort(),
      origin = `http://127.0.0.1:${port}`;
    const args = [
      '-cp',
      classpath,
      'com.blariyo.collector.FixtureApplication',
      '--spring.profiles.active=fixture',
      `--server.port=${port}`,
      `--collector.fixture-secrets=${secretFile}`,
      `--collector.sources-file=${sourceFile}`,
      `--collector.spool-directory=${join(dir, 'spool')}`,
      '--collector.processing-enabled=true',
    ];
    const request = async (
      path: string,
      body?: Record<string, unknown>,
      {
        token = body ? secrets['local-run-token'] : secrets['local-read-token'],
        key = randomUUID(),
      }: { token?: string; key?: string } = {}
    ) => {
      const res = await fetch(origin + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, body: object(await res.json()) };
    };

    const start = async (extra: string[]) => {
      child = spawn(java, [...args, ...extra], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (b: string) => (output += b));
      child.stderr.on('data', (b: string) => (output += b));
      await until(async () => (await fetch(origin + '/actuator/health/liveness')).ok, 45000);
    };
    const stop = async () => {
      const exited = once(currentChild(), 'exit');
      currentChild().kill('SIGTERM');
      await exited;
      child = null;
    };
    for (const step of [
      'resolveCandidate',
      'claimCandidate',
      'fetchAndExtract',
      'submitResult',
      'uploadPreviews',
      'notifyAndFinalize',
    ])
      for (const phase of ['before', 'after']) {
        const marker = join(dir, step + '-' + phase);
        await start([
          `--collector.fixture-crash-step=${step}`,
          `--collector.fixture-crash-phase=${phase}`,
          `--collector.fixture-crash-marker=${marker}`,
        ]);
        const created = await fetch(f.origin + '/api/collector/v1/candidates', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + f.collectorToken,
            'Content-Type': 'application/json',
            'Idempotency-Key': randomUUID(),
          },
          body: JSON.stringify({
            collectorId: secrets['collector-id'],
            originUrl: 'https://fixture.invalid/post/' + step + '-' + phase,
          }),
        });
        assert.equal(created.status, 202);
        const candidate = contractData(
          'collectorCreateCandidate',
          '/api/collector/v1/candidates',
          created.status,
          await created.json(),
          'POST'
        ).candidateId;
        const submitted = await request('/local/v1/jobs/collect', {
          mode: 'COLLECT',
          candidateId: candidate,
        });
        assert.equal(submitted.status, 202);
        const id = object(submitted.body.data).jobRequestId;
        assert.ok(typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id));
        await until(async () => (await readFile(marker, 'utf8')) === step + ':' + phase, 90000);
        const exited = once(currentChild(), 'exit');
        currentChild().kill('SIGKILL');
        await exited;
        await start([]);
        const settled = await until(async () => {
          const body = object((await request('/local/v1/jobs/' + id)).body.data);
          return ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'RECONCILE_REQUIRED'].includes(
            typeof body.state === 'string' ? body.state : ''
          )
            ? body
            : null;
        }, 90000);
        assert.equal(
          settled.state,
          'COMPLETED',
          step + ':' + phase + ' ' + JSON.stringify(settled)
        );
        assert.equal(
          firstRow(
            await f.pool.query('SELECT attempt_count FROM collect.candidate WHERE id=$1', [
              candidate,
            ])
          ).attempt_count,
          1
        );
        const count = (
          await exec('docker', [
            'exec',
            container,
            'psql',
            '-U',
            'fixture',
            '-Atc',
            `SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${id}'`,
          ])
        ).stdout.trim();
        assert.equal(count, '3');
        await stop();
        await new Promise((r) => setTimeout(r, 11500));
        console.log('Step boundary SIGKILL/restart PASS: ' + step + ' ' + phase);
      }
    const dumpWrapper = join(dir, 'pg-dump');
    await writeFile(
      dumpWrapper,
      `#!/bin/sh\nexec docker exec ${container} pg_dump -U fixture -d fixture "$@"\n`,
      { mode: 0o700 }
    );
    const backupDirectory = join(dir, 'backups');
    const backupArgs = [
      `-Dspring.profiles.active=fixture`,
      `-Dcollector.fixture-secrets=${secretFile}`,
      '-cp',
      classpath,
      'com.blariyo.collector.ops.BackupMain',
      'backup',
      backupDirectory,
    ];
    await exec(java, backupArgs, { env: { ...env, COLLECTOR_PG_DUMP: dumpWrapper } });
    const oldest = (await readdir(backupDirectory))[0];
    assert.ok(oldest);
    for (let i = 0; i < 7; i++)
      await exec(java, backupArgs, { env: { ...env, COLLECTOR_PG_DUMP: dumpWrapper } });
    const kept = await readdir(backupDirectory);
    assert.equal(kept.length, 7);
    assert.equal(kept.includes(oldest), false);
    console.log('Eight actual encrypted pg_dump backups retain newest seven PASS');
  }
);
