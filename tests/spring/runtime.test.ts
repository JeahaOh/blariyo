import { uuid } from '../helpers/spring-runtime.ts';
import { freePort, until } from '../helpers/spring-runtime.ts';
import { object, firstRow } from '../helpers/browser-values.ts';
import { contractData } from '../../apps/api/test/contract-response.ts';
import type { Readable } from 'node:stream';
import test from 'node:test';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcessByStdio } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { createServer as createHttpServer, type Server } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
const exec = promisify(execFile);
const javaHome = process.env.JAVA_HOME;
assert.ok(javaHome, 'JAVA_HOME required');
const java = join(javaHome, 'bin/java');
const classpath = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
await test(
  'Spring actual process, dedicated PostgreSQL, REST and BFF/Core collection',
  { timeout: 420000 },
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
      await writeFile('/private/tmp/blariyo-spring-runtime-process.log', output);
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
    dir = await mkdtemp('/private/tmp/blariyo-spring-runtime-');
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
          parser: 'THEQOO',
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
      await writeFile('/private/tmp/blariyo-spring-runtime-failure.log', output);
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
    const key = randomUUID(),
      body = { originUrl: 'https://fixture.invalid/post/1' };
    const submitted = await request('/local/v1/candidates', body, { key });
    assert.equal(submitted.status, 202, JSON.stringify(submitted.body));
    const candidate = object(submitted.body.data).candidateId;
    assert.ok(typeof candidate === 'number');
    const id = uuid(object(submitted.body.data).jobRequestId);
    assert.equal(
      uuid(object((await request('/local/v1/candidates', body, { key })).body.data).jobRequestId),
      id
    );
    assert.equal(
      (
        await request(
          '/local/v1/candidates',
          { originUrl: 'https://fixture.invalid/post/other' },
          { key }
        )
      ).status,
      409
    );
    assert.equal((await request('/local/v1/candidates', body)).status, 409);
    assert.equal(
      (await request('/local/v1/candidates', { originUrl: 'https://unknown.invalid/post/1' }))
        .status,
      403
    );
    const completed = await until(async () => {
      const r = await request('/local/v1/jobs/' + id);
      return ['COMPLETED', 'FAILED', 'RECONCILE_REQUIRED'].includes(
        typeof object(r.body.data).state === 'string' ? String(object(r.body.data).state) : ''
      )
        ? object(r.body.data)
        : null;
    }, 90000);
    if (completed.state !== 'COMPLETED') {
      for (const value of Object.values(secrets)) output = output.replaceAll(value, '[redacted]');
      await writeFile('/private/tmp/blariyo-spring-runtime-failure.log', output);
    }
    assert.equal(completed.state, 'COMPLETED', JSON.stringify(completed));
    const result = firstRow(
      await f.pool.query('SELECT status,title,content_blocks FROM collect.candidate WHERE id=$1', [
        candidate,
      ])
    );
    assert.equal(result.status, 'NEW');
    assert.equal(result.title, 'Spring fixture');
    assert.ok(Array.isArray(result.content_blocks));
    assert.deepEqual(
      result.content_blocks.map((b: unknown) => object(b).type),
      ['TEXT', 'IMAGE', 'LINK']
    );
    const images = (
      await f.pool.query(
        'SELECT preview_storage_key,preview_source_sha256 FROM collect.candidate_image WHERE candidate_id=$1',
        [candidate]
      )
    ).rows;
    assert.equal(images.length, 1);
    assert.ok(images[0]);
    assert.ok(Buffer.isBuffer(images[0].preview_source_sha256));
    assert.ok(images[0].preview_storage_key);
    assert.equal(images[0].preview_source_sha256.length, 32);
    const meta = (
      await exec('docker', [
        'exec',
        container,
        'psql',
        '-U',
        'fixture',
        '-Atc',
        'SELECT state FROM collector.run; SELECT count(*) FROM batch.batch_step_execution; SELECT count(*) FROM collector.spool_reference;',
      ])
    ).stdout;
    assert.match(meta, /COMPLETED\n6\n0/);
    // A real browser performs the separate operator review, draft creation and manual publish.
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin },
    ]);
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === f.origin ? route.continue() : route.abort()
    );
    const page = await context.newPage();
    await page.goto(f.origin + '/admin/collect');
    await page.getByRole('button', { name: /Spring fixture/ }).click();
    await expect(page.getByRole('img', { name: '검수용 미리보기' })).toBeVisible();
    await expect(page.getByRole('region', { name: '수집한 원문' })).toContainText('원문 문단 전체');
    await expect(page.getByLabel('초안에 포함')).toBeChecked();
    await expect(page.getByLabel('초안에 포함')).toBeDisabled();
    await page.getByLabel('이미지 설명').fill('Spring 수집 시험 이미지');
    await page.getByRole('button', { name: '검수 완료 · 초안 만들기' }).click();
    await page.waitForURL(/\/admin\?postId=/);
    assert.equal(
      firstRow(await f.pool.query('SELECT status FROM collect.candidate WHERE id=$1', [candidate]))
        .status,
      'APPROVED'
    );
    const draftId = firstRow(
      await f.pool.query('SELECT post_id FROM collect.candidate WHERE id=$1', [candidate])
    ).post_id;
    assert.ok(typeof draftId === 'string' && /^[0-9]+$/.test(draftId));
    assert.equal((await fetch(f.origin + '/api/v1/boards/meme/posts/' + draftId)).status, 404);
    await page.getByRole('button', { name: '즉시 발행', exact: true }).click();
    await expect(page.getByRole('link', { name: '공개 게시글 보기' })).toBeVisible();
    await page.goto(f.origin + '/meme/posts/' + draftId);
    await expect(page.getByAltText('Spring 수집 시험 이미지')).toBeVisible();
    assert.equal(
      await page
        .getByAltText('Spring 수집 시험 이미지')
        .evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0),
      true
    );
    // Drop each committed Core response while killing Spring, then restart the persisted Job.
    for (const [name, path] of [
      ['claim', /\/candidates\/claim$/],
      ['heartbeat', /\/heartbeat$/],
      ['reservation', /\/request-reservations$/],
      ['result', /\/result$/],
      ['preview', /\/preview$/],
      ['expired-result', /\/result$/],
    ] satisfies [string, RegExp][]) {
      await new Promise((r) => setTimeout(r, 11500));
      const response = await fetch(f.origin + '/api/collector/v1/candidates', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + f.collectorToken,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          collectorId: secrets['collector-id'],
          originUrl: 'https://fixture.invalid/post/fault-' + name,
        }),
      });
      assert.equal(response.status, 202);
      const faultCandidate = contractData(
        'collectorCreateCandidate',
        '/api/collector/v1/candidates',
        response.status,
        await response.json(),
        'POST'
      ).candidateId;
      const crashed = new Promise<void>((resolve) => {
        fault = { path, resolve };
      });
      const submittedFault = await request('/local/v1/jobs/collect', {
        mode: 'COLLECT',
        candidateId: faultCandidate,
      });
      assert.equal(submittedFault.status, 202);
      const faultId = uuid(object(submittedFault.body.data).jobRequestId);
      let crashTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          crashed,
          new Promise((_, reject) => {
            crashTimer = setTimeout(
              () => reject(new Error('Missing committed response crash: ' + name)),
              60000
            );
          }),
        ]);
      } finally {
        clearTimeout(crashTimer);
      }
      if (name === 'expired-result') {
        await f.pool.query(
          "UPDATE collect.collector_receipt SET expires_at=now()-interval '1 second'"
        );
        await exec('docker', [
          'exec',
          container,
          'psql',
          '-U',
          'fixture',
          '-Atc',
          `UPDATE collector.run SET expires_at=now()-interval '1 second' WHERE id='${faultId}'`,
        ]);
        const refs = (
          await exec('docker', [
            'exec',
            container,
            'psql',
            '-U',
            'fixture',
            '-Atc',
            `SELECT ref FROM collector.spool_reference WHERE job_request_id='${faultId}'`,
          ])
        ).stdout
          .trim()
          .split('\n')
          .filter(Boolean);
        for (const ref of refs) {
          assert.match(ref, /^[a-f0-9-]{36}$/);
          await rm(join(dir, 'spool', ref + '.enc'), { force: true });
        }
      }
      child = spawn(java, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (b: string) => (output += b));
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (b: string) => (output += b));
      const recovered = await until(async () => {
        const r = await request('/local/v1/jobs/' + faultId);
        return ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'RECONCILE_REQUIRED'].includes(
          typeof object(r.body.data).state === 'string' ? String(object(r.body.data).state) : ''
        )
          ? object(r.body.data)
          : null;
      }, 60000);
      assert.equal(
        recovered.state,
        name === 'expired-result' ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        name + ': ' + JSON.stringify(recovered)
      );
      if (name === 'expired-result') assert.equal(recovered.outcome, 'RESULT_DIGEST_RECONCILED');
      assert.equal(
        firstRow(
          await f.pool.query('SELECT attempt_count FROM collect.candidate WHERE id=$1', [
            faultCandidate,
          ])
        ).attempt_count,
        1,
        name
      );
      console.log('Committed-response restart PASS: ' + name);
    }
    // Kill after an external attempt has started: restart must reconcile, never repeat that request.
    const created2 = await fetch(f.origin + '/api/collector/v1/candidates', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + f.collectorToken,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        collectorId: secrets['collector-id'],
        originUrl: 'https://fixture.invalid/post/2',
      }),
    });
    assert.equal(created2.status, 202);
    const candidate2 = contractData(
      'collectorCreateCandidate',
      '/api/collector/v1/candidates',
      created2.status,
      await created2.json(),
      'POST'
    ).candidateId;
    // Avoid intentionally colliding with the preceding candidate's source-wide permit window.
    await new Promise((r) => setTimeout(r, 11500));
    const second = await request('/local/v1/jobs/collect', {
      mode: 'COLLECT',
      candidateId: candidate2,
    });
    assert.equal(second.status, 202);
    const id2 = uuid(object(second.body.data).jobRequestId);
    await until(async () => {
      const row = await exec('docker', [
        'exec',
        container,
        'psql',
        '-U',
        'fixture',
        '-Atc',
        `SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${id2}' AND state='COMPLETED'`,
      ]);
      return Number(row.stdout.trim()) === 1;
    });
    const killed = once(currentChild(), 'exit');
    currentChild().kill('SIGKILL');
    await killed;
    child = spawn(java, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (b: string) => (output += b));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (b: string) => (output += b));
    const reconciled = await until(async () => {
      const r = await request('/local/v1/jobs/' + id2);
      return object(r.body.data)?.state === 'RECONCILE_REQUIRED' ? object(r.body.data) : null;
    }, 45000);
    assert.equal(reconciled.restartable, false);
    const attempts = await exec('docker', [
      'exec',
      container,
      'psql',
      '-U',
      'fixture',
      '-Atc',
      `SELECT count(*) FROM collector.network_attempt WHERE job_request_id='${id2}'`,
    ]);
    assert.equal(Number(attempts.stdout.trim()), 1);
    assert.equal(object((await request('/local/v1/jobs/' + id)).body.data).state, 'COMPLETED');
    // Encrypt a real pg_dump, restore only into an empty database, and keep execution disabled.
    const dumpWrapper = join(dir, 'pg-dump'),
      restoreWrapper = join(dir, 'pg-restore');
    await writeFile(
      dumpWrapper,
      `#!/bin/sh\nexec docker exec ${container} pg_dump -U fixture -d fixture "$@"\n`,
      { mode: 0o700 }
    );
    await writeFile(
      restoreWrapper,
      `#!/bin/sh\nexec docker exec -i ${container} pg_restore -U fixture "$@"\n`,
      { mode: 0o700 }
    );
    const backupEnv = {
      ...env,
      COLLECTOR_PG_DUMP: dumpWrapper,
      COLLECTOR_PG_RESTORE: restoreWrapper,
    };
    const backupArgs = [
      `-Dspring.profiles.active=fixture`,
      `-Dcollector.fixture-secrets=${secretFile}`,
      '-cp',
      classpath,
      'com.blariyo.collector.ops.BackupMain',
    ];
    const backupDirectory = join(dir, 'backups');
    await exec(java, [...backupArgs, 'backup', backupDirectory], { env: backupEnv });
    const archiveName = (await readdir(backupDirectory)).find((f) => f.endsWith('.enc'));
    assert.ok(archiveName);
    const archive = join(backupDirectory, archiveName);
    assert.equal((await readFile(archive)).includes(Buffer.from('Spring fixture')), false);
    await exec('docker', [
      'exec',
      databaseContainer,
      'createdb',
      '-U',
      'fixture',
      'fixture_restore',
    ]);
    const restoreEnv = {
      ...backupEnv,
      COLLECTOR_DATABASE_URL: `jdbc:postgresql://127.0.0.1:${dbPort}/fixture_restore`,
    };
    await exec(java, [...backupArgs, 'restore', archive], { env: restoreEnv });
    assert.equal(
      (
        await exec('docker', [
          'exec',
          container,
          'psql',
          '-U',
          'fixture',
          '-d',
          'fixture_restore',
          '-Atc',
          'SELECT reconcile_required FROM collector.restore_gate',
        ])
      ).stdout.trim(),
      't'
    );
    await assert.rejects(exec(java, [...backupArgs, 'restore', archive], { env: restoreEnv }));
    // Public Core continues responding while the separate collector process is stopped.
    const exited = once(currentChild(), 'exit');
    currentChild().kill('SIGTERM');
    await exited;
    assert.equal((await fetch(f.origin + '/meme')).status, 200);
    assert.equal(output.includes('Spring fixture'), false);
    for (const value of [secrets['core-token'], secrets['spool-key'], secrets['request-key']]) {
      assert.ok(value);
      assert.equal(output.includes(value), false);
    }
    console.log(
      'Spring runtime: dedicated DB, six Batch steps, BFF/Core preview, auth, isolation, process-kill recovery and encrypted restore PASS'
    );
  }
);
