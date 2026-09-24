#!/usr/bin/env node
'use strict';

// Read-only by default; --write-test creates and removes only synthetic test objects.
// Never print credentials, existing object names, or raw errors.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');

const repoPath = '/Volumes/MicroVault/iCloudDrive/git/private/blariyo';
const credentialsPath = path.join(os.homedir(), '.config/blariyo/r2-credentials.env');
const buckets = [
  ['PRIVATE', 'blariyo-media-private'],
  ['PUBLIC', 'blariyo-media-public'],
  ['BACKUP', 'blariyo-backup'],
];
const expected = new Set(['R2_ENDPOINT', ...buckets.flatMap(([role]) => [
  `R2_${role}_BUCKET`, `R2_${role}_ACCESS_KEY_ID`, `R2_${role}_SECRET_ACCESS_KEY`,
])]);
const ignored = new Set(buckets.map(([role]) => `R2_${role}_TOKEN`));

// Parse text only: never source the file or expand shell expressions.
function parseCredentials(contents) {
  const config = Object.create(null);
  const seen = new Set();
  for (const [index, raw] of contents.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    const invalid = () => {
      throw new Error(`FAIL: 보관 파일 ${index + 1}행의 항목명·중복·따옴표 형식을 확인하세요.`);
    };
    if (!match || (!expected.has(match[1]) && !ignored.has(match[1])) || seen.has(match[1])) invalid();
    const [, key, rawValue] = match;
    seen.add(key);
    // Account API tokens are optional storage entries, not S3 credentials.
    if (ignored.has(key)) continue;
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
  return config;
}

function stop(message) {
  console.error(message);
  process.exit(1);
}

function errorStatus(error) {
  return Number.isInteger(error?.$metadata?.httpStatusCode) ? error.$metadata.httpStatusCode : '연결 오류';
}

async function verifyBucket(client, bucket, sdk, report = console.log) {
  const key = `__blariyo_check__/${randomUUID()}.txt`;
  const body = Buffer.from('Blariyo R2 synthetic verification file. No private data.\n');
  const send = command => client.send(command, { abortSignal: AbortSignal.timeout(15000) });
  let failures = 0;
  let cleanupNeeded = false;
  let stage = '업로드';
  report(`검사 파일: ${bucket}/${key}`);
  try {
    cleanupNeeded = true; // Also attempt cleanup if the upload response is lost.
    try {
      await send(new sdk.PutObjectCommand({
        Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain',
        CacheControl: 'no-store', IfNoneMatch: '*',
      }));
    } catch (error) {
      // Do not delete a pre-existing object when conditional creation fails.
      if ([409, 412].includes(error?.$metadata?.httpStatusCode)) cleanupNeeded = false;
      throw error;
    }
    stage = '다운로드';
    const response = await send(new sdk.GetObjectCommand({ Bucket: bucket, Key: key }));
    const downloaded = Buffer.from(await response.Body.transformToByteArray());
    if (!body.equals(downloaded)) {
      failures++;
      report(`FAIL ${bucket} — 업로드·다운로드 내용 불일치`);
    } else {
      report(`PASS ${bucket} — 업로드·다운로드 내용 일치`);
    }
  } catch (error) {
    failures++;
    report(`FAIL ${bucket} — ${stage}: ${errorStatus(error)}`);
  } finally {
    if (cleanupNeeded) {
      try {
        await send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key }));
        let absent = false;
        try {
          await send(new sdk.HeadObjectCommand({ Bucket: bucket, Key: key }));
        } catch (error) {
          if (error?.$metadata?.httpStatusCode === 404) absent = true;
          else throw error;
        }
        if (!absent) throw new Error('Synthetic object still exists');
        report(`PASS ${bucket} — 검사 파일 삭제 확인`);
      } catch (error) {
        failures++;
        report(`FAIL ${bucket} — 검사 파일 정리 확인 필요: ${key} (${errorStatus(error)})`);
      }
    }
  }
  // Test only list permission on the other two known buckets.
  for (const [, other] of buckets) {
    if (other === bucket) continue;
    try {
      await send(new sdk.ListObjectsV2Command({ Bucket: other, Prefix: key, MaxKeys: 1 }));
      failures++;
      report(`FAIL ${bucket} 키 → ${other} 목록 조회 허용됨: 권한 범위 확인 필요`);
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 403 && error.name === 'AccessDenied') {
        report(`PASS ${bucket} 키 → ${other} 목록 조회 차단`);
      } else {
        failures++;
        report(`FAIL ${bucket} 키 → ${other} 차단 여부 판정 불가: ${errorStatus(error)}`);
      }
    }
  }
  return failures;
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('사용법: node /Users/zeaha/task_list/check-blariyo-r2.cjs');
    console.log('로컬 보관 파일을 읽고 R2 버킷 3개의 목록 조회 권한만 확인합니다.');
    console.log('--write-test: 버킷별 임시 파일 업로드·다운로드·삭제 및 다른 두 버킷의 목록 조회 차단을 검사합니다.');
    return;
  }
  if (process.argv.slice(2).some(arg => arg !== '--write-test')) stop('FAIL: 지원하지 않는 옵션입니다. --help를 확인하세요.');
  const writeTest = process.argv.includes('--write-test');

  let sdk;
  try {
    sdk = createRequire(path.join(repoPath, 'package.json'))('@aws-sdk/client-s3');
  } catch {
    stop('FAIL: Blariyo 저장소의 R2 연결 라이브러리를 찾을 수 없습니다.');
  }

  let contents;
  try {
    const stat = fs.lstatSync(credentialsPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) {
      stop('FAIL: 본인 소유의 일반 파일이어야 하며 권한은 600이어야 합니다.');
    }
    contents = fs.readFileSync(credentialsPath, 'utf8');
  } catch {
    stop('FAIL: ~/.config/blariyo/r2-credentials.env 파일을 읽을 수 없습니다.');
  }

  let config;
  try {
    config = parseCredentials(contents);
  } catch (error) {
    stop(error.message);
  }
  const missing = [...expected].filter(key => !config[key]?.trim());
  if (missing.length) stop(`FAIL: 미입력 항목: ${missing.join(', ')}`);
  // Restrict credential use to the official R2 S3 endpoint.
  if (!/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com\/?$/.test(config.R2_ENDPOINT)) {
    stop('FAIL: R2_ENDPOINT에 Cloudflare가 표시한 S3 API endpoint를 입력하세요.');
  }
  for (const [role, bucket] of buckets) {
    if (config[`R2_${role}_BUCKET`] !== bucket) stop(`FAIL: R2_${role}_BUCKET 이름을 확인하세요.`);
  }

  let failures = 0;
  for (const [role, bucket] of buckets) {
    const client = new sdk.S3Client({
      region: 'auto', endpoint: config.R2_ENDPOINT, forcePathStyle: true, maxAttempts: 1,
      credentials: {
        accessKeyId: config[`R2_${role}_ACCESS_KEY_ID`],
        secretAccessKey: config[`R2_${role}_SECRET_ACCESS_KEY`],
      },
    });
    try {
      await client.send(new sdk.ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }), {
        abortSignal: AbortSignal.timeout(15000),
      });
      console.log(`PASS ${bucket} — 인증·목록 조회 성공`);
      if (writeTest) failures += await verifyBucket(client, bucket, sdk);
    } catch (error) {
      failures++;
      console.log(`FAIL ${bucket} — ${errorStatus(error)}`);
    } finally {
      client.destroy();
    }
  }
  if (writeTest) {
    console.log(`${failures ? 'FAIL' : 'PASS'} R2 검사 완료 — 실패 ${failures}건`);
    console.log('검증 범위: 본인 버킷 인증·목록·업로드·다운로드·삭제, 다른 두 버킷 목록 조회 차단. 앱 연동·공개 도메인·교차 읽기/쓰기 차단은 별도 검증 대상입니다.');
  } else {
    console.log('검증 범위: 인증·목록 조회. 업로드·다운로드·삭제 및 다른 버킷 접근 차단은 미검증.');
  }
  process.exitCode = failures ? 1 : 0;
}

module.exports = { parseCredentials, verifyBucket };
if (require.main === module) {
  main().catch(() => stop('FAIL: 확인 작업을 완료하지 못했습니다. 비밀값 보호를 위해 상세 오류는 출력하지 않습니다.'));
}
