#!/usr/bin/env node
'use strict';

// Read-only configuration check. --check-keys fetches public JWKS; never accepts a JWT.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const configDirectory = path.join(os.homedir(), '.config/blariyo');
const appModule = '/Volumes/MicroVault/iCloudDrive/git/private/blariyo/apps/web/server/utils/access.mjs';
const required = ['NUXT_ADMIN_AUTH_MODE', 'NUXT_ACCESS_ISSUER', 'NUXT_ACCESS_AUDIENCE'];
const allowed = new Set([...required, 'NUXT_ADMIN_OPERATORS_FILE']);

class ConfigError extends Error {}

function parseAccessConfig(contents) {
  const config = Object.create(null);
  for (const [index, raw] of contents.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const invalid = () => new ConfigError(`Access 설정 파일 ${index + 1}행의 항목명·중복·인용 형식을 확인하세요.`);
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(config, match[1])) throw invalid();
    let value;
    if (/^['"]/.test(match[2])) {
      const quoted = /^(['"])(.*?)\1(?:\s+#.*)?$/.exec(match[2]);
      if (!quoted) throw invalid();
      value = quoted[2];
    } else {
      value = match[2].replace(/\s+#.*$/, '').trim();
      if (/[\s'"]/.test(value)) throw invalid();
    }
    config[match[1]] = value;
  }
  for (const name of required) {
    if (!config[name]) throw new ConfigError(`${name} 값이 필요합니다.`);
  }
  if (config.NUXT_ADMIN_AUTH_MODE !== 'access') throw new ConfigError('NUXT_ADMIN_AUTH_MODE는 access여야 합니다.');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.NUXT_ACCESS_ISSUER)) {
    throw new ConfigError('NUXT_ACCESS_ISSUER는 팀의 HTTPS cloudflareaccess.com 주소여야 합니다.');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(config.NUXT_ACCESS_AUDIENCE)) {
    throw new ConfigError('NUXT_ACCESS_AUDIENCE는 관리자 Access 앱의 64자리 AUD여야 합니다.');
  }
  if (Object.hasOwn(config, 'NUXT_ADMIN_OPERATORS_FILE') && !path.isAbsolute(config.NUXT_ADMIN_OPERATORS_FILE)) {
    throw new ConfigError('NUXT_ADMIN_OPERATORS_FILE은 실제 JSON 파일의 절대경로여야 합니다.');
  }
  return config;
}

function readPrivateFile(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.size > 65536) {
      throw new ConfigError('설정은 본인 소유의 64KB 이하 일반 파일이며, 그룹·타인 접근 권한이 없어야 합니다.');
    }
    return fs.readFileSync(fd, 'utf8');
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('설정 파일의 존재·읽기 권한을 확인하세요. 심볼릭 링크는 허용하지 않습니다.');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

async function checkPublicKeys(issuer, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    return response.ok && Array.isArray(body?.keys) && body.keys.some(key =>
      key && key.kty === 'RSA' && typeof key.kid === 'string' && key.kid.length > 0 &&
      typeof key.n === 'string' && key.n.length > 0 && typeof key.e === 'string' && key.e.length > 0);
  } catch { return false; }
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node check-blariyo-access.cjs [--check-keys]');
    console.log('기본: Access 설정·운영자 JSON의 권한·형식 검사. 쓰기·로그인·권한 부여 없음.');
    console.log('--check-keys: issuer의 공개키 조회 추가. AUD 소속·실제 JWT·관리자 접속은 별도 검증.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check-keys')) throw new ConfigError('--help를 확인하세요.');
  const config = parseAccessConfig(readPrivateFile(path.join(configDirectory, 'cloudflare-access.env')));
  console.log('PASS Access 설정 — 파일 권한·모드·issuer·AUD 형식 정상');
  const operatorFile = config.NUXT_ADMIN_OPERATORS_FILE || path.join(configDirectory, 'admin-operators.json');
  if (!fs.existsSync(operatorFile)) throw new ConfigError('운영자 매핑 파일이 아직 없습니다. ~/.config/blariyo/admin-operators.json을 준비하세요.');
  let operators;
  try { operators = JSON.parse(readPrivateFile(operatorFile)); }
  catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('운영자 JSON 문법을 확인하세요. 원문·사용자 식별값은 출력하지 않습니다.');
  }
  const { parseAdminOperators } = await import(pathToFileURL(appModule).href);
  let active;
  try { active = parseAdminOperators(operators); }
  catch { throw new ConfigError('운영자 목록의 identity·operatorId·active 타입과 identity 중복을 확인하세요.'); }
  const uuid = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;
  if (!operators.every(entry => uuid.test(entry.identity))) throw new ConfigError('identity에는 이메일이나 임시 문구 대신 본인의 Cloudflare user_uuid를 넣으세요.');
  if (!active.size) throw new ConfigError('활성 운영자가 없습니다. 승인한 운영자의 active 설정을 확인하세요.');
  console.log(`PASS 운영자 매핑 — 실제 앱 파서 통과 · 활성 ${active.size}명 (식별값 비출력)`);
  if (!config.NUXT_ADMIN_OPERATORS_FILE) console.log('참고: 로컬 기본 매핑 파일을 검사했습니다. 배포 시 NUXT_ADMIN_OPERATORS_FILE에 컨테이너 mount 경로를 주입해야 합니다.');
  if (args[0] === '--check-keys') {
    if (!await checkPublicKeys(config.NUXT_ACCESS_ISSUER)) throw new ConfigError('Access 공개키 응답·연결을 확인하세요.');
    console.log('PASS Access issuer — 서명 검증용 공개키 조회 성공');
  }
  console.log('검증 범위: 설정 형식·권한·활성 매핑. 실제 사용자 소유권·AUD 소속·JWT·정책 허용/거부·서버 배포는 미검증.');
}

module.exports = { parseAccessConfig, readPrivateFile, checkPublicKeys };
if (require.main === module) main().catch(error => {
  console.error(`FAIL: ${error instanceof ConfigError ? error.message : '검사 준비 오류입니다. 원문·식별값·비밀값은 출력하지 않습니다.'}`);
  process.exitCode = 1;
});
