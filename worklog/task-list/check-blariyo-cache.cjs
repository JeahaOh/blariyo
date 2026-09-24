#!/usr/bin/env node
'use strict';

// Never print credentials or raw API errors. No network access without --purge-test.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const credentialsPath = path.join(os.homedir(), '.config/blariyo/cloudflare-cache.env');
const expected = new Set(['CACHE_ZONE_ID', 'CACHE_PURGE_TOKEN']);

class ConfigError extends Error {}

function parseCredentials(contents) {
  const config = Object.create(null);
  for (const [index, raw] of contents.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const invalid = () => {
      throw new ConfigError(`보관 파일 ${index + 1}행의 항목명·중복·따옴표 형식을 확인하세요.`);
    };
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || !expected.has(match[1]) || Object.hasOwn(config, match[1])) invalid();
    const [, key, rawValue] = match;
    let value;
    if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
      const quoted = /^(['"])(.*?)\1(?:\s+#.*)?$/.exec(rawValue);
      if (!quoted) invalid();
      value = quoted[2];
    } else {
      value = rawValue.replace(/\s+#.*$/, '').trim();
      if (/[\s'"]/.test(value)) invalid();
    }
    config[key] = value;
  }
  for (const key of expected) {
    if (!config[key]) throw new ConfigError(`${key} 값을 입력하세요.`);
  }
  if (!/^[a-f0-9]{32}$/i.test(config.CACHE_ZONE_ID)) {
    throw new ConfigError('CACHE_ZONE_ID는 blariyo.com의 32자리 Zone ID여야 합니다. Account ID와 구분하세요.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(config.CACHE_PURGE_TOKEN)) {
    throw new ConfigError('CACHE_PURGE_TOKEN 형식을 확인하세요. 공백이나 줄바꿈을 넣지 마세요.');
  }
  return config;
}

function readCredentials() {
  let fd;
  try {
    fd = fs.openSync(credentialsPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid()) {
      throw new ConfigError('보관 파일은 본인 소유의 일반 파일이며 권한이 600이어야 합니다.');
    }
    return parseCredentials(fs.readFileSync(fd, 'utf8'));
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('~/.config/blariyo/cloudflare-cache.env 파일의 존재·읽기 권한을 확인하세요. 심볼릭 링크는 허용하지 않습니다.');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

async function verifyPurge(config, fetchImpl = fetch, report = console.log) {
  const testUrl = `https://blariyo.com/__blariyo_check__/cache-${randomUUID()}.txt`;
  report(`검사 URL: ${testUrl}`);
  let response;
  let body;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(config.CACHE_ZONE_ID)}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.CACHE_PURGE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: [testUrl] }),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    );
    body = await response.json();
  } catch {
    report('FAIL 캐시 삭제 검사 — 연결·시간 초과·응답 형식 오류. 요청 수락 여부는 미확인입니다.');
    return false;
  }
  const errorCodes = Array.isArray(body?.errors)
    ? body.errors.map(error => error?.code).filter(Number.isSafeInteger)
    : [];
  if (!response.ok || body?.success !== true || !Array.isArray(body.errors) || body.errors.length !== 0) {
    report(`FAIL 캐시 삭제 검사 — HTTP ${response.status}; 오류 코드: ${errorCodes.join(', ') || '미제공'}`);
    report('blariyo.com의 Zone ID와 토큰의 Cache → Purge 권한·도메인 범위를 확인하세요.');
    return false;
  }
  report('PASS 캐시 삭제 검사 — 단일 테스트 URL의 삭제 요청이 수락되었습니다.');
  report('검증 범위: 입력한 Zone ID와 토큰으로 단일 URL 캐시 삭제 API 호출. 실제 콘텐츠의 캐시 무효화·앱 연동·공개 도메인 동작은 미검증.');
  return true;
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('사용법: node check-blariyo-cache.cjs [--purge-test]');
    console.log('기본: 보관 파일 형식·권한만 검사. --purge-test: 무작위 테스트 URL 하나의 캐시 삭제 요청을 1회 전송.');
    console.log('보관 파일: ~/.config/blariyo/cloudflare-cache.env');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--purge-test')) {
    throw new ConfigError('지원하지 않는 인자입니다. --help를 확인하세요.');
  }
  const config = readCredentials();
  console.log('PASS 보관 파일 형식·권한 확인 — 비밀값은 출력하지 않습니다.');
  if (args[0] !== '--purge-test') {
    console.log('API 인증은 미검증입니다. --purge-test로 단일 테스트 URL 삭제 요청을 실행할 수 있습니다.');
    return;
  }
  if (!await verifyPurge(config)) process.exitCode = 1;
}

module.exports = { parseCredentials, verifyPurge };
if (require.main === module) {
  main().catch(error => {
    console.error(`FAIL: ${error instanceof ConfigError ? error.message : '예상하지 못한 검사 오류입니다. 비밀값은 출력하지 않습니다.'}`);
    process.exitCode = 1;
  });
}
