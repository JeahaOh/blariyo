#!/usr/bin/env node
'use strict';
const { main } = require('/Volumes/MicroVault/iCloudDrive/git/private/blariyo/deploy/application/prepare-runtime-config.cjs');
main().catch(() => {
  console.error('FAIL 운영 설정 준비 — 보관 파일 권한·형식 또는 API build 상태를 확인하세요. 원문·비밀값은 출력하지 않습니다.');
  process.exitCode = 1;
});
