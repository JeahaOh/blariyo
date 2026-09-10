import { uuid } from '../helpers/spring-runtime.ts';
import { freePort, until } from '../helpers/spring-runtime.ts';
import { object, firstRow } from '../helpers/browser-values.ts';
import { contractData } from '../../apps/api/test/contract-response.ts';
import type { Readable } from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcessByStdio } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { createServer as createHttpServer, type Server } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { browserFixture } from '../helpers/browser-fixture.ts';
const exec = promisify(execFile);
const javaHome = process.env.JAVA_HOME;
assert.ok(javaHome, 'JAVA_HOME required');
const java = join(javaHome, 'bin/java');
const classpath = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
await test(
  'Spring multi-image partial outcome and NEW preview refresh',
  { timeout: 180000 },
  async (t) => {
    let child: ChildProcessByStdio<null, Readable, Readable> | null = null;
    let container: string | undefined = undefined;
    let dir: string | undefined = undefined;
    let proxy: Server | undefined = undefined;
    function currentChild() {
      assert.ok(child);
      return child;
    }
    let fault: {
      path: RegExp;
      resolve: () => void;
    } | null = null;
    const secrets: Record<string, string> = {};
    let output = '';
    t.after(async () => {
      for (const value of Object.values(secrets)) output = output.replaceAll(value, '[redacted]');
      await writeFile('/private/tmp/blariyo-spring-preview-process.log', output);
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
          if (fault && req.method === 'POST' && fault.path.test(req.url) && upstream.ok) {
            const pending = fault;
            fault = null;
            const exited = once(currentChild(), 'exit');
            currentChild().kill('SIGKILL');
            res.destroy();
            await exited;
            pending.resolve();
            return;
          }
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
    dir = await mkdtemp('/private/tmp/blariyo-spring-preview-');
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
    child = spawn(java, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (b: string) => (output += b));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (b: string) => (output += b));
    try {
      await until(async () => {
        if (currentChild().exitCode !== null) throw new Error('exited');
        return (await fetch(origin + '/actuator/health/liveness')).ok;
      }, 45000);
    } catch (e) {
      for (const value of Object.values(secrets)) output = output.replaceAll(value, '[redacted]');
      await writeFile('/private/tmp/blariyo-spring-preview-failure.log', output);
      throw e;
    }
    const request = async (
      path: string,
      body?: Record<string, unknown>,
      {
        token = body ? secrets['local-run-token'] : secrets['local-read-token'],
        key = randomUUID(),
      }: {
        token?: string | undefined;
        key?: string;
      } = {}
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
    assert.equal((await request('/local/v1/status', undefined, { token: 'wrong' })).status, 401);
    assert.equal(
      (
        await request('/local/v1/jobs/collect', {
          mode: 'COLLECT',
          originUrl: 'https://fixture.invalid/post/1',
        })
      ).status,
      400
    );
    const created = await fetch(f.origin + '/api/collector/v1/candidates', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + f.collectorToken,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        collectorId: secrets['collector-id'],
        originUrl: 'https://fixture.invalid/post/partial',
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
    const crashed = new Promise<void>((resolve) => {
      fault = { path: /\/preview$/, resolve };
    });
    const submitted = await request('/local/v1/jobs/collect', {
      mode: 'COLLECT',
      candidateId: candidate,
    });
    assert.equal(submitted.status, 202);
    const id = uuid(object(submitted.body.data).jobRequestId);
    let crashTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        crashed,
        new Promise((_, reject) => {
          crashTimer = setTimeout(() => reject(new Error('Preview response crash missing')), 60000);
        }),
      ]);
    } finally {
      clearTimeout(crashTimer);
    }
    child = spawn(java, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (b: string) => (output += b));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (b: string) => (output += b));
    await until(async () => (await fetch(origin + '/actuator/health/liveness')).ok, 45000);
    const settle = async (id: string) =>
      until(async () => {
        const body = object((await request('/local/v1/jobs/' + id)).body.data);
        return ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'RECONCILE_REQUIRED'].includes(
          typeof body.state === 'string' ? body.state : ''
        )
          ? body
          : null;
      }, 90000);
    assert.equal((await settle(id)).state, 'COMPLETED_WITH_WARNINGS');
    const before = (
      await f.pool.query(
        'SELECT id,preview_storage_key FROM collect.candidate_image WHERE candidate_id=$1 ORDER BY position',
        [candidate]
      )
    ).rows;
    assert.equal(before.length, 2);
    assert.ok(before[0] && before[1]);
    assert.ok(before[0].preview_storage_key);
    assert.equal(before[1].preview_storage_key, null);
    const original = firstRow(
      await f.pool.query('SELECT status,title,lock_version FROM collect.candidate WHERE id=$1', [
        candidate,
      ])
    );
    assert.equal(original.status, 'NEW');
    assert.equal(original.title, 'Partial fixture');
    const exited = once(currentChild(), 'exit');
    currentChild().kill('SIGTERM');
    await exited;
    child = spawn(java, [...args, '--collector.fixture-images-recover=true'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (b: string) => (output += b));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (b: string) => (output += b));
    await until(async () => (await fetch(origin + '/actuator/health/liveness')).ok, 45000);
    const refreshed = await request('/local/v1/jobs/collect', {
      mode: 'PREVIEW_REFRESH',
      candidateId: candidate,
      lockVersion: original.lock_version,
    });
    assert.equal(refreshed.status, 202);
    const refreshedId = uuid(object(refreshed.body.data).jobRequestId);
    assert.equal((await settle(refreshedId)).state, 'COMPLETED');
    const after = (
      await f.pool.query(
        'SELECT id,preview_storage_key FROM collect.candidate_image WHERE candidate_id=$1 ORDER BY position',
        [candidate]
      )
    ).rows;
    assert.ok(after[0] && after[1]);
    assert.equal(after[0].preview_storage_key, before[0].preview_storage_key);
    assert.ok(after[1].preview_storage_key);
    const result = firstRow(
      await f.pool.query('SELECT status,title FROM collect.candidate WHERE id=$1', [candidate])
    );
    assert.deepEqual(result, { status: 'NEW', title: 'Partial fixture' });
    const count = (
      await exec('docker', [
        'exec',
        container,
        'psql',
        '-U',
        'fixture',
        '-Atc',
        `SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${refreshedId}'`,
      ])
    ).stdout.trim();
    assert.equal(count, '1');
    await new Promise((r) => setTimeout(r, 11500));
    const redirectCreated = await fetch(f.origin + '/api/collector/v1/candidates', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + f.collectorToken,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        collectorId: secrets['collector-id'],
        originUrl: 'https://fixture.invalid/post/redirect/0',
      }),
    });
    assert.equal(redirectCreated.status, 202);
    const redirectCandidate = contractData(
      'collectorCreateCandidate',
      '/api/collector/v1/candidates',
      redirectCreated.status,
      await redirectCreated.json(),
      'POST'
    ).candidateId;
    const redirectSubmitted = await request('/local/v1/jobs/collect', {
      mode: 'COLLECT',
      candidateId: redirectCandidate,
    });
    assert.equal(redirectSubmitted.status, 202);
    const redirectJob = uuid(object(redirectSubmitted.body.data).jobRequestId);
    assert.equal((await settle(redirectJob)).state, 'COMPLETED');
    const redirectResult = firstRow(
      await f.pool.query('SELECT status,fetch_error_code FROM collect.candidate WHERE id=$1', [
        redirectCandidate,
      ])
    );
    assert.deepEqual(redirectResult, {
      status: 'FETCH_FAILED',
      fetch_error_code: 'SOURCE_REDIRECT_BLOCKED',
    });
    const reservations = (
      await exec('docker', [
        'exec',
        container,
        'psql',
        '-U',
        'fixture',
        '-Atc',
        `SELECT kind,count(*) FROM collector.network_attempt WHERE job_request_id='${redirectJob}' GROUP BY kind ORDER BY kind`,
      ])
    ).stdout.trim();
    assert.equal(reservations, 'DETAIL|1\nREDIRECT|3\nROBOTS|1');
    console.log(
      'Same-host redirect maximum three hops and quota reservation per HTTP attempt PASS'
    );
    console.log(
      'Multi-image committed-preview SIGKILL/replay, partial source failure, successful preview preservation, NEW refresh of missing image only PASS'
    );
  }
);
