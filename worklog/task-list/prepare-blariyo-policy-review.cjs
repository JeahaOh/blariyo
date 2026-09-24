#!/usr/bin/env node
'use strict';
const { main } = require('/Volumes/MicroVault/iCloudDrive/git/private/blariyo/deploy/application/prepare-policy-review.cjs');
main().catch(() => {
  console.error('FAIL 정책 검토본 생성 — 보관 파일 권한·형식, API build와 저장 경로를 확인하세요. 입력값은 출력하지 않습니다.');
  process.exitCode = 1;
});
