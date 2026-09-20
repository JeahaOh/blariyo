#!/usr/bin/env node
'use strict';

// Local preparation only. Never publishes policy text or sends contact data to a server.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const fields = {
  operatorDisplayName: '운영자 표시명',
  contactEmail: '일반 문의 이메일',
  rightsEmail: '권리 신고 이메일',
  privacyEmail: '개인정보 문의 이메일',
  privacyOfficer: '개인정보 보호책임자 또는 담당자',
};
const defaultDirectory = path.join(os.homedir(), '.config', 'blariyo');
const parserPath = path.resolve(__dirname, '../../apps/api/dist/features/policies/policy-artifact.js');
class ConfigError extends Error {}

function checkDirectory(directory) {
  const info = fs.lstatSync(directory);
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o022) !== 0) {
    throw new ConfigError('보관 디렉터리의 소유자·권한을 확인하세요. 심볼릭 링크와 다른 사용자의 쓰기는 허용하지 않습니다.');
  }
}

function readConfig(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o600 || info.size > 16384) {
      throw new ConfigError('공개 연락처 보관 파일은 본인 소유·권한 600·16KB 이하의 일반 파일이어야 합니다.');
    }
    let value;
    try { value = JSON.parse(fs.readFileSync(fd, 'utf8')); }
    catch { throw new ConfigError('공개 연락처 파일의 JSON 형식을 확인하세요. 입력값은 출력하지 않습니다.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== Object.keys(fields).length ||
        Object.keys(value).some(key => !Object.hasOwn(fields, key)) ||
        Object.keys(fields).some(key => typeof value[key] !== 'string' || value[key].trim() !== value[key] || value[key].length > 512)) {
      throw new ConfigError('지정된 항목 5개를 문자열로 입력하세요. 항목 이름과 앞뒤 공백을 확인하세요.');
    }
    return value;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function prepare(directory = defaultDirectory, create = false) {
  checkDirectory(path.dirname(directory));
  if (create) {
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  checkDirectory(directory);
  const file = path.join(directory, 'public-contact.json');
  let created = false;
  if (create) {
    let fd;
    try { fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (fd !== undefined) {
      try {
        fs.writeFileSync(fd, JSON.stringify(Object.fromEntries(Object.keys(fields).map(key => [key, ''])), null, 2) + '\n');
        fs.fsyncSync(fd);
        created = true;
      } finally { fs.closeSync(fd); }
    }
  }
  return { file, created, config: readConfig(file) };
}

async function validate(config) {
  const { assertLegalConfig } = await import(pathToFileURL(parserPath).href);
  try { assertLegalConfig(config); }
  catch { throw new ConfigError('필수값·이메일 형식·미정 문구를 확인하세요. 실제 앱의 LEGAL_CONFIG 검사를 통과하지 못했습니다.'); }
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node prepare-blariyo-public-config.cjs [--create]');
    console.log('--create: ~/.config/blariyo/public-contact.json이 없을 때만 빈 항목 5개를 권한 600으로 생성합니다.');
    console.log('기본: 파일 권한·형식과 실제 앱의 연락처 설정 검사를 수행합니다.');
    console.log('입력값 출력·네트워크 호출·정책 발행·서버 배포는 없습니다. 기존 파일을 덮어쓰지 않습니다.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--create')) throw new ConfigError('--help를 확인하세요.');
  const result = prepare(defaultDirectory, args[0] === '--create');
  console.log('PASS 공개 연락처 보관 파일 — ' + (result.created ? '빈 양식 생성' : '기존 파일 유지') + ' · 본인 소유·권한 600·항목 형식 확인');
  console.log('보관 파일: ' + result.file);
  const pending = Object.keys(fields).filter(key => !result.config[key]);
  if (pending.length) {
    console.log('입력 필요: ' + pending.map(key => fields[key]).join(' · '));
    console.log('양식 준비만 완료했습니다. 값을 채운 뒤 --create 없이 다시 검사하세요.');
    if (args[0] !== '--create') process.exitCode = 2;
    return;
  }
  await validate(result.config);
  console.log('PASS 실제 앱 LEGAL_CONFIG 파서 — 필수 공개 연락처 5개 형식 정상 (값 비출력)');
  console.log('검증 범위: 로컬 입력·권한·앱 설정 형식. 이메일 수신·담당자 적정성·정책 확정/발행·앱 기동은 미검증입니다.');
}

module.exports = { fields, prepare, readConfig, validate, main };
if (require.main === module) main().catch(error => {
  console.error('FAIL ' + (error instanceof ConfigError ? error.message : '파일 존재·권한 또는 API build 상태를 확인하세요. 입력값은 출력하지 않습니다.'));
  process.exitCode = 1;
});
