'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepare, parseEnv, rawEnv } = require('./prepare-runtime-config.cjs');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blariyo-runtime-test-'));
  const directory = path.join(root, 'config');
  const project = 'blariyo-input-check-' + path.basename(root).split('-').at(-1).toLowerCase();
  let runtimeFile;
  const write = (name, value) => fs.writeFileSync(path.join(directory, name), value, { mode: 0o600 });
  const hex = c => c.repeat(64);
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
    fs.mkdirSync(path.join(directory, 'db-secrets'), { mode: 0o700 });
    // Quotes/$/backslashes must survive Compose unchanged; no shell execution.
    const contacts = { operatorDisplayName: `테스트 '운영자' "표시" $USER \\ $(false)`,
      contactEmail: 'contact@example.com', rightsEmail: 'rights@example.com',
      privacyEmail: 'privacy@example.com', privacyOfficer: '시험 담당자' };
    write('public-contact.json', JSON.stringify(contacts));
    write('db-secrets/app-password', hex('a') + '\n');
    // No migration/backup password files: assembling runtime must not read them.
    write('admin-operators.json', JSON.stringify([{ identity: '11111111-1111-4111-8111-111111111111', operatorId: 'test-operator', active: true }]));
    write('cloudflare-access.env', `NUXT_ADMIN_AUTH_MODE=access\nNUXT_ACCESS_ISSUER=https://fixture-team.cloudflareaccess.com\nNUXT_ACCESS_AUDIENCE=${hex('b')}\n`);
    write('internal-auth.env', `SERVICE_TOKEN='${hex('c')}'\nNUXT_SERVICE_TOKEN='${hex('c')}'\nNUXT_ACTOR_SECRET='${hex('d')}'\n`);
    const r2 = `R2_ENDPOINT=https://${'e'.repeat(32)}.r2.cloudflarestorage.com\n` +
      ['PRIVATE', 'PUBLIC', 'BACKUP'].map((role, i) => {
        const bucket = ['blariyo-media-private', 'blariyo-media-public', 'blariyo-backup'][i];
        return `R2_${role}_BUCKET=${bucket}\nR2_${role}_ACCESS_KEY_ID=${String(i+1).repeat(32)}\nR2_${role}_SECRET_ACCESS_KEY=${String(i+1).repeat(64)}\nR2_${role}_TOKEN='management-secret-${i}'\n`;
      }).join('');
    write('r2-credentials.env', r2);
    write('cloudflare-cache.env', `CACHE_ZONE_ID=${'f'.repeat(32)}\nCACHE_PURGE_TOKEN=fixture-cache-token\n`);
    const baseline = fs.readdirSync(directory).length;
    assert.deepEqual(await prepare(directory), { created: false });
    assert.equal(fs.readdirSync(directory).length, baseline);
    const first = await prepare(directory, true);
    const files = ['api.env', 'web.env', 'secrets/app-password', 'secrets/admin-operators.json', 'compose.yaml', 'bundle.json'];
    const snapshot = Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(first.destination, name), 'utf8')]));
    for (const folder of [first.destination, path.join(first.destination, 'secrets')]) assert.equal(fs.statSync(folder).mode & 0o777, 0o700);
    for (const file of files) assert.equal(fs.statSync(path.join(first.destination, file)).mode & 0o777, 0o600);
    const parseRaw = value => Object.fromEntries(value.trimEnd().split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    const api = parseRaw(snapshot['api.env']); const web = parseRaw(snapshot['web.env']);
    assert.deepEqual(JSON.parse(api.LEGAL_CONFIG), contacts);
    assert.equal(web.NUXT_PUBLIC_OPERATOR_DISPLAY_NAME, contacts.operatorDisplayName);
    assert.equal(api.SERVICE_TOKEN, web.NUXT_SERVICE_TOKEN);
    assert.notEqual(web.NUXT_SERVICE_TOKEN, web.NUXT_ACTOR_SECRET);
    assert.equal(web.NUXT_ADMIN_OPERATORS_FILE, '/run/secrets/admin-operators.json');
    assert.equal(api.APP_DB_PASSWORD_FILE, '/run/secrets/app-password');
    assert.equal(web.NUXT_CORE_ORIGIN, 'http://api:' + api.PORT);
    assert.equal(web.NUXT_LOCAL_ADMIN_TOKEN, '');
    for (const flag of ['COLLECT_MANUAL_URL_ENABLED', 'COLLECT_DISCORD_COMMAND_ENABLED', 'COLLECT_BATCH_REVIEW_ENABLED']) {
      assert.equal(api[flag], 'false');
      assert.equal(web['NUXT_' + flag], 'false');
    }
    for (const text of Object.values(snapshot)) {
      assert(!text.includes('management-secret'));
      assert(!text.includes('3'.repeat(64)));
    }
    assert(!snapshot['web.env'].includes('R2_'));
    assert(!snapshot['web.env'].includes('CACHE_PURGE_TOKEN'));
    assert(!snapshot['web.env'].includes(hex('a')));
    assert(!snapshot['api.env'].includes(hex('d')));
    assert(!snapshot['api.env'].includes('NUXT_ACCESS'));
    assert(!snapshot['api.env'].includes(hex('a')));
    assert(!snapshot['api.env'].includes('BACKUP') && !snapshot['api.env'].includes('MIGRATION'));
    const second = await prepare(directory, true);
    assert.notEqual(first.destination, second.destination);
    for (const file of files) assert.equal(fs.readFileSync(path.join(first.destination, file), 'utf8'), snapshot[file]);
    assert.equal(fs.readFileSync(path.join(directory, 'r2-credentials.env'), 'utf8'), r2);
    assert.throws(() => parseEnv('X=1\nX=2', ['X']));
    assert.throws(() => parseEnv('EVIL=1', ['X']));
    assert.throws(() => rawEnv({ X: 'a\nEVIL=1' }));
    for (const invalid of [r2.replace('R2_PUBLIC_ACCESS_KEY_ID=' + '2'.repeat(32), 'R2_PUBLIC_ACCESS_KEY_ID=' + '1'.repeat(32)), r2.replace(/R2_ENDPOINT=.*/, 'R2_ENDPOINT=https://untrusted.example.com')]) {
      write('r2-credentials.env', invalid);
      await assert.rejects(prepare(directory, true));
    }
    write('r2-credentials.env', r2);
    const input = path.join(directory, 'internal-auth.env');
    fs.chmodSync(input, 0o644);
    const count = fs.readdirSync(directory).length;
    await assert.rejects(prepare(directory, true));
    assert.equal(fs.readdirSync(directory).length, count);
    assert.equal(fs.statSync(input).mode & 0o777, 0o644);
    fs.chmodSync(input, 0o600);
    fs.renameSync(input, input + '.original'); fs.symlinkSync(input + '.original', input);
    await assert.rejects(prepare(directory, true));
    fs.unlinkSync(input); fs.renameSync(input + '.original', input);
    console.log('PASS 합성 입력 — 권한·키 분리·재실행 보존·잘못된 endpoint/키/권한/symlink 거부');

    // Capture rendered config privately: never print Compose's expanded environment.
    const env = { ...process.env, BLARIYO_API_IMAGE: 'blariyo-api:db-init-20260920-a17c9e4b', BLARIYO_WEB_IMAGE: 'blariyo-m0-core-verify-web:local' };
    const compose = ['compose', '--project-name', project, '-f', path.join(first.destination, 'compose.yaml')];
    execFileSync('docker', [...compose, 'config', '--quiet'], { env, stdio: 'pipe' });
    const rendered = JSON.parse(execFileSync('docker', [...compose, 'config', '--format', 'json'], { env, encoding: 'utf8', stdio: 'pipe' }));
    // `compose config` escapes $ as $$ for re-reading the rendered Compose document.
    // The one-off container below independently checks actual delivered bytes.
    const decoded = values => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.replaceAll('$$', '$')]));
    assert.deepEqual(decoded(rendered.services.api.environment), api);
    assert.deepEqual(decoded(rendered.services.web.environment), web);
    assert.equal(rendered.networks.data.external, true);
    assert.equal(rendered.networks.data.name, 'blariyo-db_data');
    assert(!Object.keys(rendered.services.web.networks).includes('data'));
    for (const service of Object.values(rendered.services)) {
      assert(!service.ports && !service.build && !service.privileged);
      assert.equal(service.user, '1000:1000'); assert.equal(service.read_only, true);
      assert.equal(service.platform, 'linux/amd64');
      assert.deepEqual(service.tmpfs, ['/tmp:size=32m,mode=1777,noexec,nosuid']);
      assert(service.volumes.every(v => v.read_only && !v.bind.create_host_path));
    }
    assert.equal(Number(rendered.services.api.mem_limit), 256 * 1024 * 1024);
    assert.equal(Number(rendered.services.web.mem_limit), 384 * 1024 * 1024);
    assert(rendered.services.web.healthcheck.test.join(' ').includes('/health/live'));
    assert(rendered.services.api.healthcheck.test.join(' ').includes('/internal/health/ready'));
    console.log('PASS Compose — raw 값 보존·host 포트 없음·역할별 mount/network·자원 제한');

    // Exercise only synthetic env delivery in a one-off Node process, not an app deployment.
    // No existing network/volume/container is used. No remote providers are called.
    runtimeFile = path.join(root, 'runtime.json');
    const runtime = { services: { probe: {
      image: env.BLARIYO_API_IMAGE, platform: 'linux/amd64', pull_policy: 'never',
      user: '1000:1000', network_mode: 'none', read_only: true,
      env_file: [{ path: path.join(first.destination, 'api.env'), format: 'raw' }],
      entrypoint: ['node', '-e', `const assert=require('node:assert/strict');assert.deepEqual(JSON.parse(process.env.LEGAL_CONFIG),${JSON.stringify(contacts)});assert.equal(process.env.SERVICE_TOKEN,'${hex('c')}');assert.equal(process.env.R2_BACKUP_SECRET_ACCESS_KEY,undefined);assert.equal(process.env.NUXT_ACTOR_SECRET,undefined);`.replaceAll('$', '$$$$')],
    } } };
    fs.writeFileSync(runtimeFile, JSON.stringify(runtime), { mode: 0o600 });
    execFileSync('docker', ['compose', '-p', project, '-f', runtimeFile, 'run', '--rm', '--no-deps', '-T', 'probe'], { stdio: 'pipe', timeout: 60000 });
    console.log('PASS 격리 Node 컨테이너 — raw 환경값 주입·인용 문자 보존 (앱 기동 아님)');
  } finally {
    if (runtimeFile) {
      try { execFileSync('docker', ['compose', '-p', project, '-f', runtimeFile, 'down'], { stdio: 'pipe', timeout: 15000 }); } catch {}
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(error => {
  const location = String(error.stack).match(/test-runtime-config\.cjs:\d+:\d+/)?.[0] || '';
  console.error('FAIL 운영 설정 격리 검사: ' + (error.code || error.name || 'CHECK_FAILED') + ' ' + location);
  process.exitCode = 1;
});
