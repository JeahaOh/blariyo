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
import { mkdtemp, readFile, writeFile, rm, utimes, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { browserFixture } from '../helpers/browser-fixture.ts';
const exec = promisify(execFile);
const javaHome = process.env.JAVA_HOME;
assert.ok(javaHome, 'JAVA_HOME required');
const java = join(javaHome, 'bin/java');
const classpath = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
await test(
  'Spring Quartz, Discord outbox, stop, retention and metrics controls',
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
    let unavailable = false;
    t.after(async () => {
      for (const value of Object.values(secrets)) output = output.replaceAll(value, '[redacted]');
      await writeFile('/private/tmp/blariyo-spring-control-process.log', output);
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
          if (unavailable && req.url?.startsWith('/api/collector/v1/status')) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }));
            return;
          }
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
    dir = await mkdtemp('/private/tmp/blariyo-spring-control-');
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
      '--collector.quartz-enabled=true',
      '--collector.notification-poll-ms=3600000',
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
      await writeFile('/private/tmp/blariyo-spring-control-failure.log', output);
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
    assert.equal((await request('/local/v1/jobs/not-a-uuid')).status, 400);
    assert.equal((await request('/unknown')).status, 404);
    assert.equal(
      (
        await request(
          '/local/v1/jobs/collect',
          { mode: 'COLLECT', nextPending: true },
          { token: secrets['local-read-token'] }
        )
      ).status,
      401
    );
    for (const forbidden of [{ Origin: 'https://example.invalid' }, { Cookie: 'session=fixture' }])
      assert.equal(
        (
          await fetch(origin + '/local/v1/status', {
            headers: { Authorization: 'Bearer ' + secrets['local-read-token'], ...forbidden },
          })
        ).status,
        403
      );
    assert.equal(
      (
        await fetch(origin + '/local/v1/jobs/collect', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + secrets['local-run-token'],
            'Content-Type': 'application/json',
            'Idempotency-Key': randomUUID(),
          },
          body: JSON.stringify({ padding: 'x'.repeat(17000) }),
        })
      ).status,
      413
    );
    assert.equal(
      (
        await request('/local/v1/jobs/collect', {
          mode: 'COLLECT',
          originUrl: 'https://fixture.invalid/post/1',
        })
      ).status,
      400
    );
    const sql = async (query: string) =>
      (
        await exec('docker', ['exec', databaseContainer, 'psql', '-U', 'fixture', '-Atc', query])
      ).stdout.trim();
    async function candidate(path: string) {
      const r = await fetch(f.origin + '/api/collector/v1/candidates', {
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
      assert.equal(r.status, 202);
      return contractData(
        'collectorCreateCandidate',
        '/api/collector/v1/candidates',
        r.status,
        await r.json(),
        'POST'
      ).candidateId;
    }
    await candidate('quartz');
    const second = await candidate('discord');
    const fired = await request('/fixture/quartz/fire', {});
    assert.equal(fired.status, 200, JSON.stringify(fired.body));
    assert.equal(object(fired.body.data).cron, '0 0/15 * * * ?');
    assert.equal(object(fired.body.data).timezone, 'Asia/Seoul');
    assert.equal(object(fired.body.data).misfire, 2);
    await until(
      async () =>
        (await sql(
          "SELECT count(*) FROM collector.run WHERE trigger='QUARTZ' AND state='COMPLETED'"
        )) === '1'
    );
    assert.equal(
      firstRow(await f.pool.query('SELECT status FROM collect.candidate WHERE id=$1', [second]))
        .status,
      'PENDING'
    );
    assert.equal(await sql("SELECT count(*) FROM collector.run WHERE trigger='QUARTZ'"), '1');
    await new Promise((r) => setTimeout(r, 11500));
    const submitted = await request('/fixture/discord/' + second, {});
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const id = uuid(object(submitted.body.data).jobRequestId);
    assert.equal(object(submitted.body.data).replayId, id);
    assert.equal(object(submitted.body.data).duplicateTargetStored, false);
    await until(
      async () => object((await request('/local/v1/jobs/' + id)).body.data)?.state === 'COMPLETED'
    );
    for (let attempt = 1; attempt <= 4; attempt++) {
      await sql(
        `UPDATE collector.notification SET next_attempt_at=now() WHERE job_request_id='${id}'`
      );
      assert.equal((await request('/fixture/notifications/drain', {})).status, 200);
      const row = (
        await sql(
          `SELECT attempt_count,status,ceil(extract(epoch FROM next_attempt_at-now())) FROM collector.notification WHERE job_request_id='${id}'`
        )
      ).split('|');
      assert.equal(Number(row[0]), attempt);
      assert.equal(row[1], attempt === 4 ? 'FINAL_FAILED' : 'PENDING');
      if (attempt < 4) {
        const expected = [60, 300, 900][attempt - 1];
        assert.ok(expected !== undefined);
        assert.ok(Number(row[2]) <= expected && Number(row[2]) >= expected - 3);
      }
    }
    await sql(
      `UPDATE collector.notification SET next_attempt_at=now() WHERE job_request_id='${id}'`
    );
    await request('/fixture/notifications/drain', {});
    await request('/fixture/notifications/drain', {});
    assert.equal(
      await sql(`SELECT status FROM collector.notification WHERE job_request_id='${id}'`),
      'CORE_RECORDED'
    );
    assert.equal(
      firstRow(
        await f.pool.query(
          "SELECT count(*)::integer AS count FROM collect.collector_operational_event WHERE event_code='NOTIFICATION_FINAL_FAILED'"
        )
      ).count,
      1
    );
    assert.equal(object((await request('/local/v1/jobs/' + id)).body.data).state, 'COMPLETED');
    const files = object((await request('/fixture/spool/' + id, {})).body.data);
    const old = new Date(Date.now() - 7200000);
    await utimes(join(dir, 'spool', uuid(files.orphan) + '.enc'), old, old);
    await sql("UPDATE collector.run SET created_at=now()-interval '15 days'");
    await request('/fixture/maintenance', {});
    await assert.rejects(stat(join(dir, 'spool', uuid(files.expired) + '.enc')));
    await assert.rejects(stat(join(dir, 'spool', uuid(files.orphan) + '.enc')));
    assert.equal(await sql('SELECT count(*) FROM collector.run'), '0');
    assert.equal(await sql('SELECT count(*) FROM batch.batch_job_execution'), '0');
    assert.equal(await sql('SELECT sum(job_count) FROM collector.daily_summary'), '2');
    await request('/fixture/maintenance', {});
    assert.equal(await sql('SELECT sum(job_count) FROM collector.daily_summary'), '2');
    for (const metric of [
      'collector.jobs.submitted',
      'collector.jobs.rejected',
      'collector.step.duration',
      'collector.job.duration',
      'collector.core.ready',
      'collector.operations',
      'collector.jobs.restartable',
    ]) {
      const observed = await request('/actuator/metrics/' + metric);
      assert.equal(observed.status, 200, metric);
      assert.equal(JSON.stringify(observed.body).includes('fixture.invalid'), false);
    }
    unavailable = true;
    const partial = await request('/local/v1/status');
    assert.equal(partial.status, 200);
    assert.equal(object(partial.body.data).partial, true);
    assert.equal(object(object(partial.body.data).core).status, 'UNAVAILABLE');
    unavailable = false;
    const statusSnapshot = await request('/local/v1/status?windowHours=1');
    assert.equal(statusSnapshot.status, 200);
    assert.equal(object(object(object(statusSnapshot.body.data).dependencies).core).ready, true);
    assert.ok(object(object(object(statusSnapshot.body.data).dependencies).core).lastSuccessAt);
    const metrics = await request('/actuator/metrics/collector.jobs');
    assert.equal(metrics.status, 200);
    assert.equal(JSON.stringify(metrics.body).includes('fixture.invalid'), false);
    await new Promise((r) => setTimeout(r, 11500));
    const stopCandidate = await candidate('stop');
    const sameKey = randomUUID();
    const concurrent = await Promise.all(
      Array.from({ length: 100 }, () =>
        request(
          '/local/v1/jobs/collect',
          { mode: 'COLLECT', candidateId: stopCandidate },
          { key: sameKey }
        )
      )
    );
    assert.ok(concurrent.every((r) => r.status === 202));
    assert.equal(new Set(concurrent.map((r) => uuid(object(r.body.data).jobRequestId))).size, 1);
    const stoppedSubmit = concurrent[0];
    assert.ok(stoppedSubmit);
    const stopId = uuid(object(stoppedSubmit.body.data).jobRequestId);
    await until(
      async () =>
        (await sql(
          `SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${stopId}' AND state='COMPLETED'`
        )) === '1'
    );
    const stop = await fetch(origin + '/local/v1/jobs/' + stopId + '/stop', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secrets['local-stop-token'],
        'Idempotency-Key': randomUUID(),
      },
    });
    assert.equal(stop.status, 202);
    await until(
      async () => object((await request('/local/v1/jobs/' + stopId)).body.data)?.state === 'STOPPED'
    );
    assert.equal(
      await sql(`SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${stopId}'`),
      '1'
    );
    assert.equal(
      firstRow(
        await f.pool.query('SELECT status FROM collect.candidate WHERE id=$1', [stopCandidate])
      ).status,
      'RUNNING'
    );
    const exited = once(currentChild(), 'exit');
    currentChild().kill('SIGTERM');
    await exited;
    child = null;
    const properties = join(dir, 'operator.properties');
    await writeFile(
      properties,
      [
        'spring.profiles.active=fixture',
        `collector.fixture-secrets=${secretFile}`,
        `collector.sources-file=${sourceFile}`,
        `collector.spool-directory=${join(dir, 'spool')}`,
      ].join('\n'),
      { mode: 0o600 }
    );
    const control = (action: string, ...ids: string[]) =>
      exec(
        java,
        ['-cp', classpath, 'com.blariyo.collector.ops.JobControlMain', action, ...ids, properties],
        { env }
      );
    assert.ok((await control('inspect', stopId)).stdout.includes('STOPPED'));
    await sql('UPDATE collector.restore_gate SET reconcile_required=true');
    await assert.rejects(control('resume', stopId), (error: unknown) => {
      const stderr = object(error).stderr;
      return typeof stderr === 'string' && stderr.includes('RESTORE_RECONCILE_REQUIRED');
    });
    await control('reconcile', stopId);
    assert.equal(
      await sql(`SELECT state FROM collector.run WHERE id='${stopId}'`),
      'RECONCILE_REQUIRED'
    );
    assert.equal(
      await sql(
        `SELECT count(*) FROM collector.operational_event WHERE job_request_id='${stopId}'`
      ),
      '1'
    );
    await assert.rejects(control('release-restore'), (error: unknown) => {
      const stderr = object(error).stderr;
      return typeof stderr === 'string' && stderr.includes('RESTORE_RECONCILE_REQUIRED');
    });
    await f.pool.query(
      "UPDATE collect.candidate SET status='FETCH_FAILED',fetch_error_code='FETCH_TIMEOUT',lease_until=NULL,fetched_at=now() WHERE id=$1",
      [stopCandidate]
    );
    await control('reconcile', stopId);
    assert.equal(await sql(`SELECT state FROM collector.run WHERE id='${stopId}'`), 'STOPPED');
    assert.ok(
      (await control('release-restore')).stdout.includes('COLLECTOR_RESTORE_GATE_RELEASED')
    );
    assert.equal(await sql('SELECT reconcile_required FROM collector.restore_gate'), 'f');
    assert.equal(output.includes('stack_trace'), false);
    assert.equal(output.includes('fixture.invalid'), false);
    const logEvents = output
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => object(JSON.parse(line)));
    assert.ok(
      logEvents.some(
        (event) => event.message === 'COLLECTOR_JOB_FINISHED' && uuid(event.jobRequestId)
      )
    );
    assert.equal(
      await sql(`SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${stopId}'`),
      '1'
    );
    console.log(
      'Quartz single candidate, Discord dedup/retries/event, TTL/orphan/metadata, metrics, 100-submit dedup, stop and operator restore reconciliation PASS'
    );
  }
);
