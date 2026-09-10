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
  'Spring ownership loss, rejection and active SIGTERM',
  { timeout: 240000 },
  async (t) => {
    let child: ChildProcessByStdio<null, Readable, Readable> | null = null;
    let container: string | undefined = undefined;
    let dir: string | undefined = undefined;
    let proxy: Server | undefined = undefined;
    function currentChild() {
      assert.ok(child);
      return child;
    }
    const secrets: Record<string, string> = {};
    let output = '';
    t.after(async () => {
      for (const value of Object.values(secrets)) output = output.replaceAll(value, '[redacted]');
      await writeFile('/private/tmp/blariyo-spring-fencing-process.log', output);
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
    dir = await mkdtemp('/private/tmp/blariyo-spring-fencing-');
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
    const start = async (extra: string[]) => {
      child = spawn(java, [...args, ...extra], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (b: string) => (output += b));
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (b: string) => (output += b));
      await until(async () => (await fetch(origin + '/actuator/health/liveness')).ok, 45000);
    };
    const stop = async () => {
      const exited = once(currentChild(), 'exit');
      currentChild().kill('SIGTERM');
      await exited;
      child = null;
    };
    const sql = async (query: string) =>
      (
        await exec('docker', ['exec', databaseContainer, 'psql', '-U', 'fixture', '-Atc', query])
      ).stdout.trim();
    const candidate = async (path: string) => {
      const created = await fetch(f.origin + '/api/collector/v1/candidates', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + f.collectorToken,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          collectorId: secrets['collector-id'],
          originUrl: 'https://fixture.invalid/post/' + path,
        }),
      });
      assert.equal(created.status, 202);
      return contractData(
        'collectorCreateCandidate',
        '/api/collector/v1/candidates',
        created.status,
        await created.json(),
        'POST'
      ).candidateId;
    };
    for (const change of ['owner', 'reject', 'promote']) {
      const marker = join(dir, change);
      const step = change === 'promote' ? 'notifyAndFinalize' : 'fetchAndExtract';
      await start([
        `--collector.fixture-crash-step=${step}`,
        '--collector.fixture-crash-phase=before',
        `--collector.fixture-crash-marker=${marker}`,
      ]);
      const target = await candidate(change);
      const submitted = await request('/local/v1/jobs/collect', {
        mode: 'COLLECT',
        candidateId: target,
      });
      assert.equal(submitted.status, 202);
      const id = uuid(object(submitted.body.data).jobRequestId);
      await until(async () => (await readFile(marker, 'utf8')) === step + ':before');
      const exited = once(currentChild(), 'exit');
      currentChild().kill('SIGKILL');
      await exited;
      if (change === 'owner')
        await f.pool.query(
          'UPDATE collect.candidate SET collector_execution_id=$1,lock_version=lock_version+1 WHERE id=$2',
          [randomUUID(), target]
        );
      else if (change === 'reject')
        await f.pool.query(
          "UPDATE collect.candidate SET status='REJECTED',reject_reason_code='OTHER',reviewed_at=now(),fetched_at=now(),lease_until=NULL,lock_version=lock_version+1 WHERE id=$1",
          [target]
        );
      else {
        const row = firstRow(
          await f.pool.query('SELECT lock_version FROM collect.candidate WHERE id=$1', [target])
        );
        const image = firstRow(
          await f.pool.query(
            'SELECT id FROM collect.candidate_image WHERE candidate_id=$1 ORDER BY position',
            [target]
          )
        );
        const drafted = await fetch(
          f.origin + '/api/v1/admin/collect/candidates/' + target + '/draft',
          {
            method: 'POST',
            headers: {
              Cookie: 'BLARIYO_ADMIN_SESSION=' + f.adminToken,
              Origin: f.origin,
              'Content-Type': 'application/json',
              'Idempotency-Key': randomUUID(),
            },
            body: JSON.stringify({
              lockVersion: row.lock_version,
              boardSlug: 'meme',
              candidateImageIds: [Number(image.id)],
              imageOptions: [{ candidateImageId: Number(image.id), alt: 'Fixture preview' }],
              acknowledgeDuplicate: false,
            }),
          }
        );
        assert.equal(drafted.status, 201, await drafted.text());
      }
      await start([]);
      const settled = await until(async () => {
        const body = object((await request('/local/v1/jobs/' + id)).body.data);
        return ['STOPPED', 'FAILED', 'COMPLETED', 'RECONCILE_REQUIRED'].includes(
          typeof body.state === 'string' ? body.state : ''
        )
          ? body
          : null;
      });
      assert.equal(settled.state, 'STOPPED', JSON.stringify(settled));
      assert.equal(settled.restartable, false);
      assert.equal(
        await sql(`SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${id}'`),
        change === 'promote' ? '3' : '0'
      );
      assert.equal(
        await sql(`SELECT count(*) FROM collector.spool_reference WHERE job_request_id='${id}'`),
        '0'
      );
      await stop();
      await new Promise((r) => setTimeout(r, 11500));
      console.log('Authoritative ' + change + ' change stops without network/mutation PASS');
    }
    await start([]);
    const target = await candidate('slow');
    const submitted = await request('/local/v1/jobs/collect', {
      mode: 'COLLECT',
      candidateId: target,
    });
    assert.equal(submitted.status, 202);
    const id = uuid(object(submitted.body.data).jobRequestId);
    await until(
      async () =>
        (await sql(
          `SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${id}' AND kind='DETAIL' AND state='NETWORK_STARTED'`
        )) === '1'
    );
    const shutdownStart = Date.now(),
      exited = once(currentChild(), 'exit');
    currentChild().kill('SIGTERM');
    await exited;
    child = null;
    assert.ok(Date.now() - shutdownStart < 90000);
    assert.equal(await sql(`SELECT state FROM collector.run WHERE id='${id}'`), 'STOPPED');
    assert.equal(
      await sql(`SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${id}'`),
      '2'
    );
    assert.equal(
      firstRow(await f.pool.query('SELECT status FROM collect.candidate WHERE id=$1', [target]))
        .status,
      'RUNNING'
    );
    console.log(
      'SIGTERM during actual active fetch exits within 90 seconds without a following image request or Core result PASS'
    );
  }
);
