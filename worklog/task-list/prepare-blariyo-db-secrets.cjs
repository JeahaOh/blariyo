#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const directory = path.join(os.homedir(), '.config', 'blariyo', 'db-secrets');
const names = ['app-password', 'migrator-password', 'backup-password'];
const appModule = '/Volumes/MicroVault/iCloudDrive/git/private/blariyo/apps/api/dist/bootstrap/database-config.js';
class ConfigError extends Error {}

function checkDirectory(target) {
  const info = fs.lstatSync(target);
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o022) !== 0) {
    throw new ConfigError('보관 디렉터리의 소유자·쓰기 권한을 확인하세요. 심볼릭 링크는 허용하지 않습니다.');
  }
}

function readPassword(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600 || info.size > 128) {
      throw new ConfigError('비밀번호 파일은 본인 소유의 권한 600인 일반 파일이어야 합니다. 기존 파일은 보존합니다.');
    }
    const contents = fs.readFileSync(fd, 'utf8');
    if (!/^[a-f0-9]{64}\n?$/.test(contents)) throw new ConfigError('비밀번호 파일의 64자리 난수 형식을 확인하세요. 기존 파일은 보존합니다.');
    return contents.trimEnd();
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function prepare(target = directory, create = false) {
  checkDirectory(path.dirname(target));
  if (create) {
    try { fs.mkdirSync(target, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  checkDirectory(target);
  const existing = new Map();
  // Validate all existing entries before creating any missing entries.
  for (const name of names) {
    const file = path.join(target, name);
    if (fs.lstatSync(file, { throwIfNoEntry: false })) existing.set(name, readPassword(file));
  }
  if (new Set(existing.values()).size !== existing.size) throw new ConfigError('DB 역할별 비밀번호가 같으면 안 됩니다. 기존 파일은 보존합니다.');
  if (!create && existing.size !== names.length) throw new ConfigError('비밀번호 파일이 부족합니다. 최초 준비 시 --create를 사용하세요.');
  let created = 0;
  for (const name of names) {
    if (existing.has(name)) continue;
    const file = path.join(target, name);
    let value;
    do { value = randomBytes(32).toString('hex'); } while ([...existing.values()].includes(value));
    let fd;
    try {
      fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      fs.writeFileSync(fd, `${value}\n`, 'utf8');
      fs.fsyncSync(fd);
      created++;
    } finally { if (fd !== undefined) fs.closeSync(fd); }
    existing.set(name, readPassword(file));
  }
  // Recheck the final files; do not report success for a partial set.
  const values = names.map(name => readPassword(path.join(target, name)));
  if (new Set(values).size !== names.length) throw new ConfigError('DB 역할별 비밀번호가 같으면 안 됩니다. 기존 파일은 보존합니다.');
  return { directory: target, created };
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node prepare-blariyo-db-secrets.cjs [--create]');
    console.log('기본: 기존 DB 비밀번호 3개의 권한·형식·분리 및 실제 앱 파일 입력을 검사합니다.');
    console.log('--create: 없는 파일만 32바이트 난수로 생성합니다. 기존 값·권한은 변경하지 않습니다.');
    console.log('비밀값 출력·네트워크 요청·DB 계정 생성·서버 배포는 없습니다.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--create')) throw new ConfigError('--help를 확인하세요.');
  // Load the real application parser before making local files.
  const { resolveDatabaseUrl } = await import(pathToFileURL(appModule).href);
  const result = prepare(directory, args[0] === '--create');
  const common = { NODE_ENV: 'production', DB_HOST: 'postgresql', DB_PORT: '5432', DB_NAME: 'blariyo' };
  resolveDatabaseUrl({ ...common, APP_DB_USER: 'blariyo_app', APP_DB_PASSWORD_FILE: path.join(directory, 'app-password') }, 'app');
  resolveDatabaseUrl({ ...common, MIGRATION_DB_USER: 'blariyo_migrator', MIGRATION_DB_PASSWORD_FILE: path.join(directory, 'migrator-password') }, 'migration');
  console.log(`PASS DB 비밀번호 — 신규 ${result.created}개 생성 · 기존 ${3 - result.created}개 유지`);
  console.log(`보관 디렉터리: ${result.directory}`);
  console.log('PASS 파일 소유자·권한 600·32바이트 난수 형식·서로 다른 비밀번호 확인');
  console.log('PASS 실제 앱 설정 로더 — app·migration 비밀번호 파일 읽기 성공 (비밀값 비출력)');
  console.log('준비 역할: blariyo_app · blariyo_migrator · blariyo_backup');
  console.log('검증 범위: 로컬 비밀번호 준비·앱 설정 파싱. DB 계정 생성·접속·권한·백업·서버 배포는 미검증.');
}

module.exports = { readPassword, prepare };
if (require.main === module) main().catch(error => {
  console.error(`FAIL: ${error instanceof ConfigError ? error.message : '준비 실패입니다. 파일·권한과 API 빌드를 확인하세요. 원문·비밀값은 출력하지 않습니다.'}`);
  process.exitCode = 1;
});
