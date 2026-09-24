#!/usr/bin/env node
'use strict';

// Uses only the public bucket credential. Never log secrets or raw remote errors.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const { deflateSync } = require('node:zlib');
const { parseCredentials } = require('./check-blariyo-r2.cjs');
const bucket = 'blariyo-media-public';

// A synthetic 16x16 blue PNG, with a per-run marker and valid PNG chunk checksums.
function makeTestPng(marker) {
  function chunk(type, data) {
    const payload = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, payload, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header[8] = 8;
  header[9] = 6; // RGBA
  const pixels = Buffer.alloc(16 * 65);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) pixels.set([0, 102, 255, 255], y * 65 + 1 + x * 4);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('tEXt', Buffer.from(`BlariyoCheck\0${marker}`)),
    chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function safeStatus(error) {
  const status = error?.$metadata?.httpStatusCode;
  return Number.isInteger(status) ? `HTTP ${status}` : '연결·응답 오류';
}

async function verifyPublicMedia(client, sdk, fetchImpl = fetch, report = console.log) {
  const marker = randomUUID();
  const key = `__blariyo_check__/public-${marker}.png`;
  const url = `https://media.blariyo.com/${key}`;
  const body = makeTestPng(marker);
  const send = command => client.send(command, { abortSignal: AbortSignal.timeout(15000) });
  // No cookies, credentials, redirects or disabled certificate verification for public requests.
  const request = method => fetchImpl(url, { method, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  let cleanupNeeded = false;
  let failures = 0;
  let stage = '테스트 이미지 업로드';
  report(`검사 URL: ${url}`);
  try {
    cleanupNeeded = true; // Clean up even if an upload response is lost.
    try {
      await send(new sdk.PutObjectCommand({
        Bucket: bucket, Key: key, Body: body, ContentType: 'image/png',
        CacheControl: 'no-store', IfNoneMatch: '*',
      }));
    } catch (error) {
      // Never delete an existing object on a conditional-write conflict.
      if ([409, 412].includes(error?.$metadata?.httpStatusCode)) cleanupNeeded = false;
      throw error;
    }
    report('PASS 공개 버킷 — 테스트 PNG 업로드');
    stage = '공개 HTTPS 이미지 조회';
    const response = await request('GET');
    if (response.status !== 200) {
      await response.body?.cancel();
      failures++;
      report(`FAIL 공개 이미지 — HTTP ${response.status} (200 필요)`);
    } else if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png') {
      await response.body?.cancel();
      failures++;
      report('FAIL 공개 이미지 — Content-Type이 image/png가 아닙니다.');
    } else {
      const downloaded = Buffer.from(await response.arrayBuffer());
      if (body.equals(downloaded)) report('PASS 공개 이미지 — HTTPS 200 · image/png · 업로드한 내용 일치');
      else {
        failures++;
        report('FAIL 공개 이미지 — 업로드한 내용과 응답이 다릅니다.');
      }
    }
  } catch (error) {
    failures++;
    report(`FAIL ${stage} — ${safeStatus(error)}`);
  } finally {
    if (cleanupNeeded) {
      let originDeleted = false;
      try {
        await send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key }));
        try {
          await send(new sdk.HeadObjectCommand({ Bucket: bucket, Key: key }));
        } catch (error) {
          if (error?.$metadata?.httpStatusCode === 404) originDeleted = true;
          else throw error;
        }
        if (!originDeleted) throw new Error('Deletion not confirmed');
        report('PASS 정리 — R2 테스트 이미지 삭제 확인');
      } catch (error) {
        failures++;
        report(`FAIL 정리 확인 필요 — ${bucket}/${key} (${safeStatus(error)})`);
      }
      if (originDeleted) {
        try {
          const response = await request('HEAD');
          if (response.status === 404) report('PASS 정리 — 공개 URL도 404 확인');
          else {
            failures++;
            report(`FAIL 공개 URL 정리 확인 — HTTP ${response.status}; 캐시·도메인 응답 확인 필요`);
          }
        } catch {
          failures++;
          report('FAIL 공개 URL 정리 확인 — 연결·응답 오류');
        }
      }
    }
  }
  return failures;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--help')) {
    console.log('사용법: node check-blariyo-public-media.cjs --write-test');
    console.log('공개 버킷에 합성 PNG 하나 업로드 → 인증 없는 HTTPS 조회·내용 비교 → 해당 PNG 삭제 → 공개 URL 404 확인.');
    console.log('자격증명: ~/.config/blariyo/r2-credentials.env (비밀값 출력 없음)');
    return;
  }
  if (args.length !== 1 || args[0] !== '--write-test') throw new Error('Invalid arguments');
  const file = path.join(os.homedir(), '.config/blariyo/r2-credentials.env');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let config;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('File permissions');
    config = parseCredentials(fs.readFileSync(fd, 'utf8'));
  } finally {
    fs.closeSync(fd);
  }
  if (!/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com\/?$/.test(config.R2_ENDPOINT)
    || config.R2_PUBLIC_BUCKET !== bucket || !config.R2_PUBLIC_ACCESS_KEY_ID || !config.R2_PUBLIC_SECRET_ACCESS_KEY) {
    throw new Error('Public credential configuration');
  }
  const sdk = createRequire('/Volumes/MicroVault/iCloudDrive/git/private/blariyo/package.json')('@aws-sdk/client-s3');
  const client = new sdk.S3Client({
    region: 'auto', endpoint: config.R2_ENDPOINT, forcePathStyle: true, maxAttempts: 1,
    credentials: { accessKeyId: config.R2_PUBLIC_ACCESS_KEY_ID, secretAccessKey: config.R2_PUBLIC_SECRET_ACCESS_KEY },
  });
  try {
    const failures = await verifyPublicMedia(client, sdk);
    console.log(`${failures ? 'FAIL' : 'PASS'} 공개 이미지 검사 완료 — 실패 ${failures}건`);
    console.log('검증 범위: 공개 버킷 → 사용자 지정 도메인 HTTPS 파일 접근·내용 일치·검사 파일 정리. 캐시 HIT·캐시 삭제 전파·브라우저 CORS·앱 연동은 미검증.');
    process.exitCode = failures ? 1 : 0;
  } finally {
    client.destroy();
  }
}

module.exports = { makeTestPng, verifyPublicMedia };
if (require.main === module) main().catch(() => {
  console.error('FAIL 검사 준비 오류 — 기존 R2 보관 파일·권한(600)·설치된 SDK를 확인하세요. 비밀값 보호를 위해 상세 오류는 출력하지 않습니다.');
  process.exitCode = 1;
});
