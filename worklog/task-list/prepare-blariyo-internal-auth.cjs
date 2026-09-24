#!/usr/bin/env node
'use strict';

// Local preparation only. No network calls, environment loading, or secret output.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const names = ['SERVICE_TOKEN', 'NUXT_SERVICE_TOKEN', 'NUXT_ACTOR_SECRET'];
const defaultDirectory = path.join(os.homedir(), '.config', 'blariyo');
class ConfigError extends Error {}

function validate(contents) {
  const config = Object.create(null);
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z_]+)='([a-f0-9]{64})'$/.exec(line);
    if (!match || !names.includes(match[1]) || Object.hasOwn(config, match[1])) {
      throw new ConfigError('내부 인증 파일의 항목·중복·64자리 난수 형식을 확인하세요. 기존 파일은 보존합니다.');
    }
    config[match[1]] = match[2];
  }
  if (names.some(name => !config[name])) throw new ConfigError('내부 인증 항목 3개가 모두 필요합니다. 기존 파일은 보존합니다.');
  if (config.SERVICE_TOKEN !== config.NUXT_SERVICE_TOKEN) {
    throw new ConfigError('SERVICE_TOKEN과 NUXT_SERVICE_TOKEN은 같은 값이어야 합니다. 기존 파일은 보존합니다.');
  }
  if (config.SERVICE_TOKEN === config.NUXT_ACTOR_SECRET) {
    throw new ConfigError('NUXT_ACTOR_SECRET은 별도의 난수여야 합니다. 기존 파일은 보존합니다.');
  }
}

function checkDirectory(directory) {
  const info = fs.lstatSync(directory);
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o022) !== 0) {
    throw new ConfigError('보관 디렉터리는 본인 소유여야 하며 다른 사용자의 쓰기 권한과 심볼릭 링크를 허용하지 않습니다.');
  }
}

function verify(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600 || info.size > 4096) {
      throw new ConfigError('내부 인증 파일은 본인 소유의 권한 600인 4KB 이하 일반 파일이어야 합니다. 기존 파일은 보존합니다.');
    }
    validate(fs.readFileSync(fd, 'utf8'));
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function prepare(directory = defaultDirectory, create = false) {
  const parent = path.dirname(directory);
  // Check the parent before creating anything below it; do not change existing permissions.
  checkDirectory(parent);
  if (create) {
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  checkDirectory(directory);
  const file = path.join(directory, 'internal-auth.env');
  let created = false;
  if (create) {
    let fd;
    try {
      fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (fd !== undefined) {
      try {
        const serviceToken = randomBytes(32).toString('hex');
        let actorSecret;
        do { actorSecret = randomBytes(32).toString('hex'); } while (actorSecret === serviceToken);
        const contents = [
          '# Local staging file. Select variables per container when deploying.',
          `SERVICE_TOKEN='${serviceToken}'`,
          `NUXT_SERVICE_TOKEN='${serviceToken}'`,
          `NUXT_ACTOR_SECRET='${actorSecret}'`,
          '',
        ].join('\n');
        fs.writeFileSync(fd, contents, 'utf8');
        fs.fsyncSync(fd);
        created = true;
      } finally { fs.closeSync(fd); }
    }
  }
  verify(file);
  return { file, created };
}

function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node prepare-blariyo-internal-auth.cjs [--create]');
    console.log('기본: ~/.config/blariyo/internal-auth.env의 권한·형식·키 관계 검사만 실행합니다.');
    console.log('--create: 파일이 없을 때만 32바이트 난수 2개를 생성해 권한 600으로 저장합니다.');
    console.log('기존 파일은 덮어쓰거나 권한을 바꾸지 않습니다. 비밀값 출력·외부 API 호출·서버 배포는 없습니다.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--create')) throw new ConfigError('--help를 확인하세요.');
  const result = prepare(defaultDirectory, args[0] === '--create');
  console.log(result.created ? 'PASS 내부 인증키 — 32바이트 난수 2개 생성·저장' : 'PASS 내부 인증키 — 기존 파일 유지·검사');
  console.log(`보관 파일: ${result.file}`);
  console.log('PASS 파일 소유자·권한 600·형식 확인 — 비밀값 비출력');
  console.log('PASS Core SERVICE_TOKEN = Web NUXT_SERVICE_TOKEN · 별도 NUXT_ACTOR_SECRET 확인');
  console.log('배포 시 Core에는 SERVICE_TOKEN만, Web에는 NUXT_SERVICE_TOKEN·NUXT_ACTOR_SECRET을 주입합니다.');
  console.log('검증 범위: 로컬 키 준비·보관·일치 여부. 실제 Web→Core 인증·컨테이너 주입·서버 배포는 미검증.');
}

module.exports = { validate, verify, prepare };
if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(`FAIL: ${error instanceof ConfigError ? error.message : '파일 준비·읽기 오류입니다. 보관 경로·권한을 확인하세요. 기존 파일은 덮어쓰지 않습니다.'}`);
    process.exitCode = 1;
  }
}
