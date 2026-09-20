import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contractData } from '../apps/api/test/contract-response.ts';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { artifactChecksum } from '../apps/api/dist/features/policies/policy-artifact.js';

// All resources belong to this invocation. Existing Compose projects and databases are untouched.
const prefix = `blariyo-check-${randomBytes(6).toString('hex')}`;
const resources: [kind: 'image' | 'network' | 'container' | 'volume', name: string][] = [];
// Prebuilt immutable IDs let the packaging check exercise exactly the exported images.
// They are never tagged, rebuilt or deleted by this test.
const args = process.argv.slice(2);
const prebuilt = args.length === 4 && args[0] === '--api-image' && args[2] === '--web-image';
if (
  args.length &&
  (!prebuilt ||
    !args[1]?.match(/^sha256:[a-f0-9]{64}$/) ||
    !args[3]?.match(/^sha256:[a-f0-9]{64}$/))
)
  throw new Error(
    'Usage: node scripts/test-docker.ts [--api-image sha256:ID --web-image sha256:ID]'
  );
const images = {
  api: prebuilt ? args[1]! : `${prefix}-api:local`,
  web: prebuilt ? args[3]! : `${prefix}-web:local`,
};
const buildxDirectory = await mkdtemp(join(tmpdir(), 'blariyo-docker-buildx-'));
const siteOrigin = 'https://docker.blariyo.example.com';
const accessIssuer = 'https://access.blariyo.example.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const assertion = await new SignJWT({})
  .setProtectedHeader({ alg: 'RS256', kid: 'docker-fixture' })
  .setSubject('docker-fixture-subject')
  .setIssuer(accessIssuer)
  .setAudience('docker-fixture')
  .setIssuedAt()
  .setExpirationTime('30m')
  .sign(privateKey);
const fixturesMount = `type=bind,source=${fileURLToPath(new URL('./fixtures', import.meta.url))},target=/fixtures,readonly`;
const env = {
  ...process.env,
  BUILDX_CONFIG: buildxDirectory,
  SERVICE_TOKEN: randomBytes(32).toString('hex'),
  NUXT_SERVICE_TOKEN: '',
  FIXTURE_JWKS: JSON.stringify({
    keys: [
      { ...publicKey.export({ format: 'jwk' }), kid: 'docker-fixture', alg: 'RS256', use: 'sig' },
    ],
  }),
  CACHE_ZONE_ID: 'fixture-zone',
  CACHE_PURGE_TOKEN: randomBytes(32).toString('hex'),
  R2_PRIVATE_ACCESS_KEY_ID: randomBytes(16).toString('hex'),
  R2_PRIVATE_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'),
  R2_PUBLIC_ACCESS_KEY_ID: randomBytes(16).toString('hex'),
  R2_PUBLIC_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'),
  LEGAL_CONFIG: JSON.stringify({
    operatorDisplayName: 'Docker fixture',
    contactEmail: 'contact@example.com',
    rightsEmail: 'rights@example.com',
    privacyEmail: 'privacy@example.com',
    privacyOfficer: 'Fixture officer',
  }),
  NUXT_ACTOR_SECRET: randomBytes(32).toString('hex'),
};
env.NUXT_SERVICE_TOKEN = env.SERVICE_TOKEN;
function docker(args: string[], input?: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn('docker', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [],
      errors: Buffer[] = [];
    child.stdout.on('data', (data: Buffer) => output.push(data));
    child.stderr.on('data', (data: Buffer) => errors.push(data));
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
async function ready(check: () => Promise<boolean>) {
  for (let i = 0; i < 90; i++) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Container readiness timeout');
}
let primaryError: unknown;
try {
  for (const target of ['api', 'web'] as const) {
    if (prebuilt) {
      const id = (await docker(['image', 'inspect', images[target], '--format', '{{.Id}}']))
        .toString()
        .trim();
      assert.equal(id, images[target]);
      console.log(`Docker ${target} prebuilt immutable image: PASS`);
    } else {
      await docker(['build', '--target', target, '-t', images[target], '.']);
      resources.push(['image', images[target]]);
      console.log(`Docker ${target} build: PASS`);
    }
  }
  await docker(['network', 'create', '--internal', prefix]);
  resources.push(['network', prefix]);
  async function start(name: string, args: string[], network = prefix) {
    const full = `${prefix}-${name}`;
    await docker([
      'run',
      '-d',
      '--name',
      full,
      '--network',
      network,
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
  const databasePassword = randomBytes(32).toString('hex');
  await docker(
    ['exec', '-i', db, 'psql', '-U', 'fixture', '-d', 'fixture', '-v', 'ON_ERROR_STOP=1'],
    Buffer.from(`CREATE ROLE blariyo_app LOGIN PASSWORD '${databasePassword}';`)
  ).catch(() => {
    throw new Error('FIXTURE_DB_ROLE_SETUP_FAILED');
  });
  const secretVolume = `${prefix}-db-secrets`;
  await docker(['volume', 'create', secretVolume]);
  resources.push(['volume', secretVolume]);
  const secretMount = `type=volume,source=${secretVolume},target=/run/db-secrets`;
  // Stage a synthetic secret via stdin, readable only by the API image's node user.
  await docker(
    [
      'run',
      '--rm',
      '-i',
      '--user',
      '0',
      '--network',
      'none',
      '--mount',
      secretMount,
      images.api,
      'node',
      '--input-type=module',
      '-e',
      "import fs from 'node:fs'; const file='/run/db-secrets/app-password'; fs.writeFileSync(file,fs.readFileSync(0),{mode:0o600,flag:'wx'}); fs.chownSync(file,1000,1000);",
    ],
    Buffer.from(databasePassword)
  );
  await docker([
    'run',
    '--rm',
    '--network',
    prefix,
    '-e',
    `DATABASE_URL=${database}`,
    '-e',
    'DB_APP_ROLE=blariyo_app',
    images.api,
    'node',
    'apps/api/dist/commands/migrate.js',
  ]);
  const external = await start('external', [
    '-e',
    'FIXTURE_JWKS',
    '-e',
    'CACHE_PURGE_TOKEN',
    '--mount',
    fixturesMount,
    images.api,
    'node',
    '/fixtures/docker-external.ts',
  ]);
  const externalIp = (
    await docker([
      'inspect',
      external,
      '--format',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
    ])
  )
    .toString()
    .trim();
  assert.match(externalIp, /^\d+\.\d+\.\d+\.\d+$/);
  const productionEnvironment = [
    '-e',
    'NODE_ENV=production',
    '-e',
    'HOST=0.0.0.0',
    '-e',
    'PORT=3100',
    '-e',
    'DB_HOST=db',
    '-e',
    'DB_NAME=fixture',
    '-e',
    'APP_DB_USER=blariyo_app',
    '-e',
    'APP_DB_PASSWORD_FILE=/run/db-secrets/app-password',
    '--mount',
    `${secretMount},readonly`,
    '-e',
    'SERVICE_TOKEN',
    '-e',
    `SITE_ORIGIN=${siteOrigin}`,
    '-e',
    'IMAGE_ORIGIN=https://images.blariyo.example.com',
    '-e',
    'LEGAL_CONFIG',
    '-e',
    'STORAGE_MODE=r2',
    '-e',
    `R2_ENDPOINT=http://${externalIp}:8081`,
    '-e',
    'R2_PRIVATE_ACCESS_KEY_ID',
    '-e',
    'R2_PRIVATE_SECRET_ACCESS_KEY',
    '-e',
    'R2_PUBLIC_ACCESS_KEY_ID',
    '-e',
    'R2_PUBLIC_SECRET_ACCESS_KEY',
    '-e',
    'R2_PRIVATE_BUCKET=fixture-private',
    '-e',
    'R2_PUBLIC_BUCKET=fixture-public',
    '-e',
    'CACHE_ZONE_ID',
    '-e',
    'CACHE_PURGE_TOKEN',
    '-e',
    'NODE_OPTIONS=--import=/fixtures/docker-network-preload.ts',
    '--mount',
    fixturesMount,
  ];
  const artifacts = ['terms', 'privacy'].map((type) => {
    const artifact = {
      type,
      version: 'docker-v1',
      title: `Synthetic ${type}`,
      body: '<p>Docker local verification only.</p>',
      effectiveAt: new Date().toISOString(),
    };
    return { ...artifact, checksum: artifactChecksum(artifact) };
  });
  await docker(
    [
      'run',
      '--rm',
      '-i',
      '--user',
      '0',
      '--network',
      prefix,
      ...productionEnvironment,
      images.api,
      'node',
      '/fixtures/docker-publish-policies.ts',
    ],
    Buffer.from(JSON.stringify(artifacts))
  );
  const api = await start('api', [...productionEnvironment, images.api]);
  const ingress = prefix + '-ingress';
  await docker(['network', 'create', ingress]);
  resources.push(['network', ingress]);
  const proxy = await start(
    'proxy',
    [
      '-p',
      '127.0.0.1::8080',
      '--mount',
      fixturesMount,
      images.api,
      'node',
      '/fixtures/docker-proxy.ts',
    ],
    ingress
  );
  await docker(['network', 'connect', prefix, proxy]);
  const origin = 'http://' + (await docker(['port', proxy, '8080/tcp'])).toString().trim();
  const web = await start('web', [
    '-e',
    'NODE_ENV=production',
    '-e',
    'NITRO_HOST=0.0.0.0',
    '-e',
    'NITRO_PORT=3000',
    '-e',
    'NUXT_CORE_ORIGIN=http://api:3100',
    '-e',
    'NUXT_ADMIN_AUTH_MODE=access',
    '-e',
    'NUXT_SERVICE_TOKEN',
    '-e',
    `NUXT_ACCESS_ISSUER=${accessIssuer}`,
    '-e',
    'NUXT_ACCESS_AUDIENCE=docker-fixture',
    '-e',
    'NUXT_ADMIN_OPERATORS_FILE=/fixtures/docker-admin-operators.json',
    '-e',
    'NODE_OPTIONS=--import=/fixtures/docker-network-preload.ts',
    '--mount',
    fixturesMount,
    '-e',
    'NUXT_PUBLIC_OPERATOR_DISPLAY_NAME=Docker fixture',
    '-e',
    'NUXT_PUBLIC_CONTACT_EMAIL=contact@example.com',
    '-e',
    'NUXT_PUBLIC_RIGHTS_EMAIL=rights@example.com',
    '-e',
    'NUXT_PUBLIC_PRIVACY_EMAIL=privacy@example.com',
    '-e',
    'NUXT_PUBLIC_PRIVACY_OFFICER=Fixture officer',
    '-e',
    'NUXT_ACTOR_SECRET',
    '-e',
    `NUXT_PUBLIC_SITE_ORIGIN=${siteOrigin}`,
    images.web,
  ]);
  await ready(
    async () =>
      (
        await fetch(origin + '/health/ready', {
          headers: { 'cf-access-jwt-assertion': assertion },
          signal: AbortSignal.timeout(1000),
        })
      ).ok
  );
  assert.equal((await fetch(origin + '/meme')).status, 200);
  assert.equal((await fetch(origin + '/admin')).status, 401);
  const ports: unknown = JSON.parse(
    (await docker(['inspect', api, '--format', '{{json .NetworkSettings.Ports}}'])).toString()
  );
  assert.ok(
    ports === null ||
      (typeof ports === 'object' && Object.values(ports).every((value: unknown) => value === null))
  );
  async function request<K extends 'createPost' | 'publishPost' | 'hidePost'>(
    name: K,
    path: string,
    body: Record<string, unknown>,
    method = 'POST'
  ) {
    const response = await fetch(origin + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: siteOrigin,
        'cf-access-jwt-assertion': assertion,
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json();
    assert.ok(response.ok, JSON.stringify(result));
    return contractData(name, path, response.status, result, method);
  }
  const draft = await request('createPost', '/api/v1/admin/posts', {
    boardSlug: 'meme',
    title: 'Docker smoke fixture',
    source: null,
    pinnedPosition: null,
    blocks: [{ type: 'TEXT', text: 'Container verification' }],
  });
  await request('publishPost', `/api/v1/admin/posts/${draft.postId}/publish`, {
    lockVersion: 1,
    mode: 'IMMEDIATE',
  });
  assert.equal((await fetch(origin + '/meme/posts/' + draft.postId)).status, 200);
  await request('hidePost', `/api/v1/admin/posts/${draft.postId}/hide`, {
    lockVersion: 2,
    reasonCode: 'EDIT',
  });
  assert.equal((await fetch(origin + '/meme/posts/' + draft.postId)).status, 404);
  for (const command of ['posts:publish-due', 'outbox:run', 'cleanup:run'])
    await docker(['exec', api, 'node', 'apps/api/dist/commands/command.js', command]);
  assert.equal((await fetch(origin + '/api/v1/policies/terms')).status, 200);
  assert.equal((await fetch(origin + '/api/v1/policies/privacy')).status, 200);
  assert.equal((await fetch(origin + '/health/ready')).status, 503);
  const observations: unknown = JSON.parse(
    (await docker(['exec', external, 'node', '/fixtures/docker-observations.ts'])).toString()
  );
  assert.ok(
    typeof observations === 'object' &&
      observations !== null &&
      'jwks' in observations &&
      'purge' in observations &&
      'inventory' in observations &&
      'rejected' in observations
  );
  assert.ok(typeof observations.jwks === 'number' && observations.jwks > 0);
  assert.ok(typeof observations.purge === 'number' && observations.purge > 0);
  assert.ok(typeof observations.inventory === 'number' && observations.inventory >= 2);
  assert.equal(observations.rejected, 0);
  console.log(
    'Docker production Core/Web/PostgreSQL, signed Access, policies, publish/hide and operational commands: PASS'
  );
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
    "SELECT ops.is_schema_ready('V005'); SELECT id,title,status,lock_version FROM content.board_post ORDER BY id; SELECT post_id,from_status,to_status FROM content.board_post_status_history ORDER BY id;";
  const snapshot = (name: string) =>
    docker(['exec', db, 'psql', '-U', 'fixture', '-d', name, '-At', '-c', sql]);
  assert.equal((await snapshot('restored')).toString(), (await snapshot('fixture')).toString());
  console.log('PostgreSQL custom dump and isolated restore/readback: PASS');
  const maintenance = await start('maintenance', [
    ...productionEnvironment,
    '-e',
    'MAINTENANCE_READ_ONLY=true',
    images.api,
  ]);
  await docker(['exec', api, 'node', '/fixtures/docker-health.ts']);
  await docker(['exec', maintenance, 'node', '/fixtures/docker-health.ts', 'maintenance']);
  await assert.rejects(
    docker(['exec', maintenance, 'node', 'apps/api/dist/commands/command.js', 'cleanup:run']),
    /MAINTENANCE_READ_ONLY/
  );
  for (const container of [maintenance, api, web]) {
    await docker(['stop', '--timeout', '20', container]);
    const exit = (await docker(['inspect', container, '--format', '{{.State.ExitCode}}']))
      .toString()
      .trim();
    assert.ok(['0', '143'].includes(exit), `Non-graceful exit ${exit}`);
    const oom = (await docker(['inspect', container, '--format', '{{.State.OOMKilled}}']))
      .toString()
      .trim();
    assert.equal(oom, 'false');
  }
  const connections = (
    await docker([
      'exec',
      db,
      'psql',
      '-U',
      'fixture',
      '-d',
      'fixture',
      '-Atc',
      "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()",
    ])
  )
    .toString()
    .trim();
  assert.equal(connections, '0');
  console.log(
    'Docker liveness/readiness, maintenance API/CLI rejection, SIGTERM and released DB connections: PASS'
  );
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const cleanupErrors: unknown[] = [];
  for (const [kind, name] of resources.reverse()) {
    try {
      await docker(
        kind === 'container'
          ? ['rm', '-f', name]
          : kind === 'network'
            ? ['network', 'rm', name]
            : kind === 'volume'
              ? ['volume', 'rm', name]
              : ['image', 'rm', '-f', name]
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await rm(buildxDirectory, { recursive: true, force: true });
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length) {
    console.error(`Docker cleanup failures: ${cleanupErrors.length}`);
    if (!primaryError) throw new AggregateError(cleanupErrors, 'Docker cleanup failed');
  }
}
