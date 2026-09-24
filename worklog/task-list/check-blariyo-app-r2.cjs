#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { parseCredentials: parseR2 } = require('./check-blariyo-r2.cjs');
const { parseCredentials: parseCache } = require('./check-blariyo-cache.cjs');
const { makeTestPng } = require('./check-blariyo-public-media.cjs');

function readPrivateFile(name) {
  const fd = fs.openSync(path.join(os.homedir(), '.config/blariyo', name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Unsafe credential file');
    return fs.readFileSync(fd, 'utf8');
  } finally { fs.closeSync(fd); }
}

async function missing(storage, kind, key) {
  try { await storage.get(kind, key); return false; }
  catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return true;
    throw error;
  }
}

async function verifyAppR2(storage, cache, fetchImpl = fetch, report = console.log) {
  const id = randomUUID();
  const key = `__blariyo_check__/app-${id}.png`;
  const url = `https://media.blariyo.com/${key}`;
  const bytes = makeTestPng(id);
  const attempted = new Set();
  const request = method => fetchImpl(url, { method, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  let failures = 0;
  let stage = '테스트 경로 사전 확인';
  report(`검사 경로: ${key}`);
  try {
    // Both generated paths must be absent before any mutation; never touch an existing file.
    for (const kind of ['private', 'public']) {
      if (!await missing(storage, kind, key)) throw new Error('Test path already exists');
    }
    stage = '앱 private 업로드';
    attempted.add('private');
    await storage.put('private', key, bytes);
    report('PASS 앱 어댑터 — private 전용 키로 원본 업로드');
    stage = '앱 private → public 발행 복사';
    attempted.add('public');
    await storage.promote(key, key);
    if (!bytes.equals(await storage.get('public', key))) throw new Error('Public bytes differ');
    if (!bytes.equals(await storage.get('private', key))) throw new Error('Private original differs');
    report('PASS 앱 어댑터 — 별도 키로 public 복사 · 원본 유지 · 내용 일치');
    stage = '공개 이미지 HTTPS 조회';
    const response = await request('GET');
    if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png') {
      await response.body?.cancel();
      throw new Error('Public image response differs');
    }
    if (!bytes.equals(Buffer.from(await response.arrayBuffer()))) throw new Error('HTTPS bytes differ');
    report('PASS 공개 이미지 — 앱이 복사한 PNG의 HTTPS 내용 일치');
  } catch (error) {
    failures++;
    const status = error?.$metadata?.httpStatusCode;
    report(`FAIL ${stage}${Number.isInteger(status) ? ` — HTTP ${status}` : ''} (비밀값·원문 오류는 출력하지 않음)`);
  } finally {
    // Attempt cleanup even when upload/copy returned an error after storing an object.
    let publicDeleted = false;
    for (const kind of ['public', 'private']) {
      if (!attempted.has(kind)) continue;
      try {
        await storage.delete(kind, key);
        if (!await missing(storage, kind, key)) throw new Error('Deletion not confirmed');
        if (kind === 'public') publicDeleted = true;
        report(`PASS 정리 — ${kind} 테스트 이미지 삭제 확인`);
      } catch {
        failures++;
        report(`FAIL 정리 확인 필요 — ${kind}/${key}`);
      }
    }
    if (attempted.has('public')) {
      try {
        await cache.purge([url]);
        report('PASS 정리 — 테스트 이미지 URL 하나의 캐시 삭제 요청 수락');
        if (publicDeleted) {
          const response = await request('HEAD');
          if (response.status !== 404) throw new Error('Public URL not removed');
          report('PASS 정리 — 공개 URL 404 확인');
        }
      } catch {
        failures++;
        report(`FAIL 공개 URL 캐시·정리 확인 필요 — ${url}`);
      }
    }
  }
  return failures;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--help')) {
    console.log('사용법: node check-blariyo-app-r2.cjs --write-test');
    console.log('빌드된 실제 앱의 R2 어댑터로 private 업로드 → public 복사 → HTTPS 확인 → 두 테스트 파일 삭제 → 테스트 URL 하나 캐시 삭제.');
    console.log('기존 r2-credentials.env와 cloudflare-cache.env를 읽으며 비밀값을 출력하지 않습니다.');
    return;
  }
  if (args.length !== 1 || args[0] !== '--write-test') throw new Error('Invalid arguments');
  const r2 = parseR2(readPrivateFile('r2-credentials.env'));
  const cache = parseCache(readPrivateFile('cloudflare-cache.env'));
  if (!/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com\/?$/.test(r2.R2_ENDPOINT)
    || r2.R2_PRIVATE_BUCKET !== 'blariyo-media-private' || r2.R2_PUBLIC_BUCKET !== 'blariyo-media-public') {
    throw new Error('Unexpected R2 endpoint or buckets');
  }
  const { adapters } = await import(pathToFileURL('/Volumes/MicroVault/iCloudDrive/git/private/blariyo/apps/api/dist/bootstrap/config.js').href);
  const runtime = adapters({
    NODE_ENV: 'test', STORAGE_MODE: 'r2', R2_ENDPOINT: r2.R2_ENDPOINT,
    R2_PRIVATE_BUCKET: r2.R2_PRIVATE_BUCKET, R2_PUBLIC_BUCKET: r2.R2_PUBLIC_BUCKET,
    R2_PRIVATE_ACCESS_KEY_ID: r2.R2_PRIVATE_ACCESS_KEY_ID, R2_PRIVATE_SECRET_ACCESS_KEY: r2.R2_PRIVATE_SECRET_ACCESS_KEY,
    R2_PUBLIC_ACCESS_KEY_ID: r2.R2_PUBLIC_ACCESS_KEY_ID, R2_PUBLIC_SECRET_ACCESS_KEY: r2.R2_PUBLIC_SECRET_ACCESS_KEY,
    CACHE_ZONE_ID: cache.CACHE_ZONE_ID, CACHE_PURGE_TOKEN: cache.CACHE_PURGE_TOKEN,
  });
  const failures = await verifyAppR2(runtime.storage, runtime.cache);
  console.log(`${failures ? 'FAIL' : 'PASS'} 앱 R2 연동 검사 완료 — 실패 ${failures}건`);
  console.log('검증 범위: 맥에서 실제 앱의 R2·캐시 어댑터와 운영 버킷 연결. DB 발행 transaction·관리자 인증·서버 배포·전체 CDN 전파는 미검증.');
  process.exitCode = failures ? 1 : 0;
}

module.exports = { verifyAppR2 };
if (require.main === module) main().catch(() => {
  console.error('FAIL 준비 오류 — 기존 두 보관 파일·권한(600)·Zone ID·API 빌드를 확인하세요. 비밀값 보호를 위해 상세 오류는 출력하지 않습니다.');
  process.exitCode = 1;
});
