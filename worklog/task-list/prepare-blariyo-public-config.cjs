#!/usr/bin/env node
'use strict';
const { main } = require('/Volumes/MicroVault/iCloudDrive/git/private/blariyo/deploy/application/prepare-public-config.cjs');
main().catch(() => {
  console.error('FAIL 공개 연락처 파일의 존재·권한·입력 형식 또는 API build 상태를 확인하세요. 입력값은 출력하지 않습니다.');
  process.exitCode = 1;
});
