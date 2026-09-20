#!/usr/bin/env node
'use strict';

// Offline only. Never source input as shell code or print input values/native errors.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const contact = require('./prepare-public-config.cjs');
const defaultDirectory = path.join(os.homedir(), '.config/blariyo');
const repo = path.resolve(__dirname, '../..');
const roles = ['PRIVATE', 'PUBLIC', 'BACKUP'];
const r2Names = ['R2_ENDPOINT', ...roles.flatMap(role => ['BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'TOKEN'].map(suffix => `R2_${role}_${suffix}`))];
const accessNames = ['NUXT_ADMIN_AUTH_MODE', 'NUXT_ACCESS_ISSUER', 'NUXT_ACCESS_AUDIENCE', 'NUXT_ADMIN_OPERATORS_FILE'];
const authNames = ['SERVICE_TOKEN', 'NUXT_SERVICE_TOKEN', 'NUXT_ACTOR_SECRET'];
const fail = code => { throw new Error(code); };

function directorySafe(directory) {
  const s = fs.lstatSync(directory);
  if (!s.isDirectory() || s.uid !== process.getuid() || (s.mode & 0o022)) fail('PRIVATE_DIRECTORY_INVALID');
}

function readPrivate(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const s = fs.fstatSync(fd);
    if (!s.isFile() || s.uid !== process.getuid() || (s.mode & 0o777) !== 0o600 || s.size > 65536) fail('PRIVATE_FILE_INVALID');
    return fs.readFileSync(fd, 'utf8');
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function parseEnv(text, allowed) {
  const result = Object.create(null);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || !allowed.includes(m[1]) || Object.hasOwn(result, m[1])) fail('ENV_FIELD_INVALID');
    let value = m[2];
    if (/^['"]/.test(value)) {
      const q = /^(['"])(.*?)\1(?:\s+#.*)?$/.exec(value);
      if (!q) fail('ENV_QUOTE_INVALID');
      value = q[2];
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
      if (/[\s'"]/.test(value)) fail('ENV_VALUE_INVALID');
    }
    if (/[\x00-\x1f\x7f]/.test(value)) fail('ENV_CONTROL_CHARACTER');
    result[m[1]] = value;
  }
  return result;
}

// Compose env_file format: raw keeps $, quotes and backslashes literal. Not a shell file.
function rawEnv(values) {
  return Object.entries(values).map(([key, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== 'string' || /[\r\n\x00]/.test(value)) fail('OUTPUT_ENV_INVALID');
    return `${key}=${value}\n`;
  }).join('');
}

async function prepare(directory = defaultDirectory, create = false) {
  directorySafe(path.dirname(directory));
  directorySafe(directory);
  directorySafe(path.join(directory, 'db-secrets'));
  const load = (file, names) => parseEnv(readPrivate(path.join(directory, file)), names);
  const r2 = load('r2-credentials.env', r2Names);
  const cache = load('cloudflare-cache.env', ['CACHE_ZONE_ID', 'CACHE_PURGE_TOKEN']);
  const access = load('cloudflare-access.env', accessNames);
  const auth = load('internal-auth.env', authNames);
  if (!/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com\/?$/.test(r2.R2_ENDPOINT || '')) fail('R2_ENDPOINT_INVALID');
  for (const [role, bucket] of [['PRIVATE', 'blariyo-media-private'], ['PUBLIC', 'blariyo-media-public']]) {
    if (r2[`R2_${role}_BUCKET`] !== bucket || !/^[a-f0-9]{32}$/i.test(r2[`R2_${role}_ACCESS_KEY_ID`] || '') ||
        !/^[a-f0-9]{64}$/i.test(r2[`R2_${role}_SECRET_ACCESS_KEY`] || '')) fail('R2_APP_CREDENTIAL_INVALID');
  }
  if (r2.R2_PRIVATE_ACCESS_KEY_ID === r2.R2_PUBLIC_ACCESS_KEY_ID || r2.R2_PRIVATE_SECRET_ACCESS_KEY === r2.R2_PUBLIC_SECRET_ACCESS_KEY) fail('R2_CREDENTIALS_MUST_DIFFER');
  if (!/^[a-f0-9]{32}$/i.test(cache.CACHE_ZONE_ID || '') || !/^[A-Za-z0-9_-]+$/.test(cache.CACHE_PURGE_TOKEN || '')) fail('CACHE_CONFIG_INVALID');
  if (access.NUXT_ADMIN_AUTH_MODE !== 'access' || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(access.NUXT_ACCESS_ISSUER || '') ||
      !/^[a-f0-9]{64}$/i.test(access.NUXT_ACCESS_AUDIENCE || '')) fail('ACCESS_CONFIG_INVALID');
  if (authNames.some(name => !/^[a-f0-9]{64}$/.test(auth[name] || '')) || auth.SERVICE_TOKEN !== auth.NUXT_SERVICE_TOKEN || auth.SERVICE_TOKEN === auth.NUXT_ACTOR_SECRET) fail('INTERNAL_AUTH_INVALID');
  const operatorsFile = access.NUXT_ADMIN_OPERATORS_FILE || path.join(directory, 'admin-operators.json');
  if (!path.isAbsolute(operatorsFile)) fail('OPERATOR_PATH_INVALID');
  const operators = JSON.parse(readPrivate(operatorsFile));
  const { parseAdminOperators } = await import(pathToFileURL(path.join(repo, 'apps/web/server/utils/access.mjs')));
  if (!parseAdminOperators(operators).size || !operators.every(o => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(o.identity))) fail('OPERATOR_MAPPING_INVALID');
  const passwordFile = path.join(directory, 'db-secrets/app-password');
  const password = readPrivate(passwordFile).replace(/\r?\n$/, '');
  if (!/^[a-f0-9]{64}$/.test(password)) fail('APP_DB_PASSWORD_INVALID');
  const publicConfig = contact.prepare(directory).config;
  await contact.validate(publicConfig);
  if (Object.values(publicConfig).some(v => /[\x00-\x1f\x7f]/.test(v))) fail('CONTACT_CONTROL_CHARACTER');
  const api = {
    NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '4000',
    NODE_OPTIONS: '--max-old-space-size=160',
    DB_HOST: 'postgresql', DB_PORT: '5432', DB_NAME: 'blariyo',
    APP_DB_USER: 'blariyo_app', APP_DB_PASSWORD_FILE: '/run/secrets/app-password',
    STORAGE_MODE: 'r2', R2_ENDPOINT: r2.R2_ENDPOINT,
    ...Object.fromEntries(['PRIVATE', 'PUBLIC'].flatMap(role => ['BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY'].map(suffix => {
      const key = `R2_${role}_${suffix}`; return [key, r2[key]];
    }))),
    ...cache, SERVICE_TOKEN: auth.SERVICE_TOKEN,
    LEGAL_CONFIG: JSON.stringify(publicConfig),
    SITE_ORIGIN: 'https://blariyo.com', IMAGE_ORIGIN: 'https://media.blariyo.com',
    COLLECT_MANUAL_URL_ENABLED: 'false', COLLECT_DISCORD_COMMAND_ENABLED: 'false',
  };
  const web = {
    NODE_ENV: 'production', NITRO_HOST: '0.0.0.0', NITRO_PORT: '3000',
    NODE_OPTIONS: '--max-old-space-size=256', NUXT_CORE_ORIGIN: 'http://api:4000',
    NUXT_ADMIN_AUTH_MODE: 'access', NUXT_LOCAL_ADMIN_TOKEN: '',
    NUXT_ACCESS_ISSUER: access.NUXT_ACCESS_ISSUER, NUXT_ACCESS_AUDIENCE: access.NUXT_ACCESS_AUDIENCE,
    NUXT_ADMIN_OPERATORS_FILE: '/run/secrets/admin-operators.json',
    NUXT_SERVICE_TOKEN: auth.NUXT_SERVICE_TOKEN, NUXT_ACTOR_SECRET: auth.NUXT_ACTOR_SECRET,
    NUXT_TRUSTED_CLIENT_IP_HEADER: '',
    NUXT_COLLECT_MANUAL_URL_ENABLED: 'false', NUXT_COLLECT_DISCORD_COMMAND_ENABLED: 'false',
    NUXT_PUBLIC_SITE_ORIGIN: api.SITE_ORIGIN, NUXT_PUBLIC_IMAGE_ORIGIN: api.IMAGE_ORIGIN,
    NUXT_PUBLIC_SITE_NAME: '블라리요', NUXT_PUBLIC_HOME_TAGLINE: '블라블라블라',
    NUXT_PUBLIC_HOME_TITLE: '블라리요 - 블라블라블라',
    NUXT_PUBLIC_HOME_DESCRIPTION: '블라리요에서 블라블라블라',
    NUXT_PUBLIC_HOME_OG_DESCRIPTION: '블라리요에서 블라블라블라', NUXT_PUBLIC_FOOTER_TAGLINE: '블라블라블라',
    NUXT_PUBLIC_GA4_ENABLED: 'false', NUXT_PUBLIC_ANALYTICS_APPROVED: 'false',
    NUXT_PUBLIC_GA4_MEASUREMENT_ID: '', NUXT_PUBLIC_ANALYTICS_CONNECT_ORIGINS: '',
    NUXT_PUBLIC_KAKAO_ENABLED: 'false', NUXT_PUBLIC_KAKAO_KEY: '',
    NUXT_PUBLIC_KAKAO_SDK_URL: '', NUXT_PUBLIC_KAKAO_INTEGRITY: '', NUXT_PUBLIC_KAKAO_CONNECT_ORIGINS: '',
  };
  for (const [key, value] of Object.entries(publicConfig)) {
    web['NUXT_PUBLIC_' + key.replace(/[A-Z]/g, c => '_' + c).toUpperCase()] = value;
  }
  // Actual application loaders, offline. No pool construction or API call.
  const { resolveDatabaseUrl } = await import(pathToFileURL(path.join(repo, 'apps/api/dist/bootstrap/database-config.js')));
  resolveDatabaseUrl({ ...api, APP_DB_PASSWORD_FILE: passwordFile }, 'app');
  const { adapters } = await import(pathToFileURL(path.join(repo, 'apps/api/dist/bootstrap/config.js')));
  adapters(api);
  const files = {
    'api.env': rawEnv(api), 'web.env': rawEnv(web),
    'secrets/app-password': password + '\n',
    'secrets/admin-operators.json': JSON.stringify(operators.map(({ identity, operatorId, active }) => ({ identity, operatorId, active })), null, 2) + '\n',
    'compose.yaml': fs.readFileSync(path.join(__dirname, 'compose.yaml'), 'utf8'),
    'bundle.json': JSON.stringify({ schemaVersion: 1, kind: 'runtime-inputs-only',
      productionReady: false, imagesIncluded: false, gatewayIncluded: false,
      serverSecretUid: 1000, serverSecretGid: 1000,
      requiredBeforeDeploy: ['policy-release', 'verified-amd64-images', 'secret-ownership', 'gateway-and-tunnel', 'runtime-smoke'] }, null, 2) + '\n',
  };
  if (!create) return { created: false };
  const destination = fs.mkdtempSync(path.join(directory, 'application-config-'));
  fs.chmodSync(destination, 0o700);
  fs.mkdirSync(path.join(destination, 'secrets'), { mode: 0o700 });
  // Write completion metadata last. A partial directory is never a complete bundle.
  for (const [name, value] of Object.entries(files)) {
    const fd = fs.openSync(path.join(destination, name), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, value); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  return { created: true, destination };
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node prepare-blariyo-runtime-config.cjs [--create]');
    console.log('기본: 기존 비공개 입력과 앱 로더를 로컬에서 검사합니다. --create: 새 application-config-* 폴더에 Core/Web 설정을 분리 저장합니다.');
    console.log('폴더 700·파일 600. 원문·비밀값 비출력. 외부 통신·서버 변경·정책 발행·image build 없음.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--create')) fail('INVALID_ARGUMENT');
  const result = await prepare(defaultDirectory, args[0] === '--create');
  console.log('PASS 운영 입력 — 파일 권한·형식·키 분리·실제 앱 DB/R2/연락처/운영자 파서');
  console.log('PASS 설정 분리 — Core: app DB·private/public R2·캐시 / Web: Access·내부 인증·공개 연락처');
  console.log('PASS 제외 — DB migration·backup 비밀번호, R2 backup 키·관리 API 토큰');
  if (result.created) console.log('보관 폴더: ' + result.destination);
  console.log('검증 범위: 로컬 설정 준비. image·정책 발행·컨테이너 기동·서버 배포·실제 로그인은 미검증입니다.');
}

module.exports = { prepare, main, readPrivate, parseEnv, rawEnv };
if (require.main === module) main().catch(() => {
  console.error('FAIL 운영 설정 준비 — 보관 파일 권한·형식 또는 API build 상태를 확인하세요. 원문·비밀값은 출력하지 않습니다.');
  process.exitCode = 1;
});
