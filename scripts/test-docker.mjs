import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';

// All resources belong to this invocation. Existing Compose projects and databases are untouched.
const prefix = `blariyo-check-${randomBytes(6).toString('hex')}`;
const resources = [];
const env = {
  ...process.env,
  SERVICE_TOKEN: randomBytes(32).toString('hex'),
  NUXT_SERVICE_TOKEN: '',
  NUXT_LOCAL_ADMIN_TOKEN: randomBytes(32).toString('hex'),
  NUXT_ACTOR_SECRET: randomBytes(32).toString('hex'),
};
env.NUXT_SERVICE_TOKEN = env.SERVICE_TOKEN;
function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [],
      errors = [];
    child.stdout.on('data', (data) => output.push(data));
    child.stderr.on('data', (data) => errors.push(data));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve(Buffer.concat(output))
        : reject(
            new Error(
              `Docker ${args[0]} failed (${code}): ${Buffer.concat(errors).toString().slice(-1200)}`
            )
          )
    );
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
async function ready(check) {
  for (let i = 0; i < 90; i++) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Container readiness timeout');
}
try {
  for (const target of ['api', 'web']) {
    await docker([
      'build',
      '--target',
      target,
      '-t',
      `blariyo-m0-core-verify-${target}:local`,
      '.',
    ]);
    console.log(`Docker ${target} build: PASS`);
  }
  await docker(['network', 'create', prefix]);
  resources.push(['network', prefix]);
  async function start(name, args) {
    const full = `${prefix}-${name}`;
    await docker([
      'run',
      '-d',
      '--name',
      full,
      '--network',
      prefix,
      '--network-alias',
      name,
      ...args,
    ]);
    resources.push(['container', full]);
    return full;
  }
  const db = await start('db', [
    '--tmpfs',
    '/var/lib/postgresql',
    '-e',
    'POSTGRES_USER=fixture',
    '-e',
    'POSTGRES_DB=fixture',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    'postgres:18',
  ]);
  await ready(async () => {
    await docker(['exec', db, 'pg_isready', '-U', 'fixture']);
    return true;
  });
  const database = 'postgres://fixture@db:5432/fixture';
  await docker([
    'run',
    '--rm',
    '--network',
    prefix,
    '-e',
    `DATABASE_URL=${database}`,
    'blariyo-m0-core-verify-api:local',
    'node',
    'apps/api/src/migrate.mjs',
  ]);
  const api = await start('api', [
    '-e',
    'NODE_ENV=test',
    '-e',
    'HOST=0.0.0.0',
    '-e',
    'PORT=3100',
    '-e',
    `DATABASE_URL=${database}`,
    '-e',
    'SERVICE_TOKEN',
    'blariyo-m0-core-verify-api:local',
  ]);
  const reserved = createServer().listen(0, '127.0.0.1');
  await once(reserved, 'listening');
  const webPort = reserved.address().port;
  await new Promise((r) => reserved.close(r));
  const web = await start('web', [
    '-e',
    'NODE_ENV=test',
    '-e',
    'NITRO_HOST=0.0.0.0',
    '-e',
    'NITRO_PORT=3000',
    '-e',
    'NUXT_CORE_ORIGIN=http://api:3100',
    '-e',
    'NUXT_ADMIN_AUTH_MODE=local',
    '-e',
    'NUXT_SERVICE_TOKEN',
    '-e',
    'NUXT_LOCAL_ADMIN_TOKEN',
    '-e',
    'NUXT_ACTOR_SECRET',
    '-e',
    `NUXT_PUBLIC_SITE_ORIGIN=http://127.0.0.1:${webPort}`,
    '-p',
    `127.0.0.1:${webPort}:3000`,
    'blariyo-m0-core-verify-web:local',
  ]);
  const origin = 'http://' + (await docker(['port', web, '3000/tcp'])).toString().trim();
  await ready(
    async () => (await fetch(origin + '/health/ready', { signal: AbortSignal.timeout(1000) })).ok
  );
  assert.equal((await fetch(origin + '/meme')).status, 200);
  assert.equal((await fetch(origin + '/admin')).status, 401);
  const ports = JSON.parse(
    (await docker(['inspect', api, '--format', '{{json .NetworkSettings.Ports}}'])).toString()
  );
  assert.ok(!ports || Object.values(ports).every((value) => value === null));
  async function request(path, body, method = 'POST') {
    const response = await fetch(origin + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        Cookie: `BLARIYO_ADMIN_SESSION=${env.NUXT_LOCAL_ADMIN_TOKEN}`,
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.ok(response.ok, result.error?.code);
    return result.data;
  }
  const draft = await request('/api/v1/admin/posts', {
    boardSlug: 'meme',
    title: 'Docker smoke fixture',
    source: null,
    pinnedPosition: null,
    blocks: [{ type: 'TEXT', text: 'Container verification' }],
  });
  await request(`/api/v1/admin/posts/${draft.postId}/publish`, {
    lockVersion: 1,
    mode: 'IMMEDIATE',
  });
  assert.equal((await fetch(origin + '/meme/posts/' + draft.postId)).status, 200);
  await request(`/api/v1/admin/posts/${draft.postId}/hide`, { lockVersion: 2, reasonCode: 'EDIT' });
  assert.equal((await fetch(origin + '/meme/posts/' + draft.postId)).status, 404);
  for (const command of ['posts:publish-due', 'outbox:run', 'cleanup:run'])
    await docker(['exec', api, 'node', 'apps/api/src/command.mjs', command]);
  console.log('Docker Core/Web/PostgreSQL, auth, publish/hide and operational commands: PASS');
  const dump = await docker([
    'exec',
    db,
    'pg_dump',
    '-U',
    'fixture',
    '-d',
    'fixture',
    '-Fc',
    '--no-owner',
    '--no-acl',
  ]);
  await docker(['exec', db, 'createdb', '-U', 'fixture', 'restored']);
  await docker(
    [
      'exec',
      '-i',
      db,
      'pg_restore',
      '-U',
      'fixture',
      '-d',
      'restored',
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
    ],
    dump
  );
  const sql =
    "SELECT ops.is_schema_ready('V004'); SELECT id,title,status,lock_version FROM content.board_post ORDER BY id; SELECT post_id,from_status,to_status FROM content.board_post_status_history ORDER BY id;";
  const snapshot = (name) =>
    docker(['exec', db, 'psql', '-U', 'fixture', '-d', name, '-At', '-c', sql]);
  assert.equal((await snapshot('restored')).toString(), (await snapshot('fixture')).toString());
  console.log('PostgreSQL custom dump and isolated restore/readback: PASS');
} finally {
  for (const [kind, name] of resources.reverse()) {
    await docker(kind === 'container' ? ['rm', '-f', name] : ['network', 'rm', name]);
  }
}
