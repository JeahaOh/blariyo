# 로컬 Collector MIME 정정 검증 — 2026-09-23

판정: 고정 대상 MIME 정정 및 readback 통과. 전체 수집 고도화는 진행 중.
대상은 localhost PostgreSQL 5439/blariyo_local과 로컬 collect object 파일이다.
운영 DB·R2/S3·Discord Gateway는 이번 검증에 포함하지 않는다.

## 변경과 경계

- 새 Collector V006 migration을 적용했다. V001–V005의 적용된 SQL/checksum은 수정하지 않았다.
- `correct_batch_media_mime`는 소유자 전용 SECURITY INVOKER 함수이며 runtime 실행 권한이 없다.
- source/검수 advisory lock과 media 행 잠금, 기대 MIME/hash/size/item version/정정 revision을 검사한다.
- 고정 todayhumor item7개/IMAGE12개의 `image/png`를 실제 `image/jpeg`로 정정했다.
- 정정 전 pg_dump·manifest를 private 디렉터리에 저장했다. 실제12개 모두 파일 hash/size/전체JPEG디코딩을 확인했다.
- 완료 item의 원문/본문/version/상태, 기존 run report, 파일 bytes와 공개 content는 변경하지 않았다.
- append-only 감사 행12개, item7개, revision모두1, 이전PNG→새JPEG를 DB에서 readback했다.
- 같은 스크립트 재실행은 changed0. rollback은 격리 DB에서만 검증했으며 실제12개를 틀린PNG로 되돌리지 않았다.

## 실행 및 검증

```sh
node --test scripts/local/collector-mime-repair.test.mjs tests/migration-contracts.test.ts
node scripts/local/repair-collector-mime.mjs --dry-run
# JDK25와 최신 Collector JAR 사용
node scripts/local/prepare-batch-review.mjs --apply
node scripts/local/repair-collector-mime.mjs --apply
node scripts/local/repair-collector-mime.mjs --apply
node scripts/local/verify-collector-inventory.mjs
node scripts/local/verify-collected-content.mjs
node scripts/local/verify-dry-run.mjs humoruniv
```

- Node SQL 통합·계약 검사:12개 통과/skip0. 해시·크기·버전 오류/동시 멱등/transaction rollback/
  활성 source 거부/검수 잠금 경합/직접 수정·감사 삭제·truncate 거부/역방향 revision/runtime 권한 포함.
- Java 전체:167개 중151통과/환경 의존16skip. 이후 V006 search_path 고정 뒤 격리 DB에서
  MigrationMainTests 및 BatchOwnershipReadbackTests3개 통과/skip0, 최신bootJar성공.
  MigrationMainTests는 V001–V006 신규 적용과 재적용 및 ledger 존재를 검사한다.
- 로컬 migration 준비:API V008/Collector V006, 기존collect미디어372개 파일 readback,
  API/batch 제한 role 및 새 감사 테이블·정정 함수 접근 거부 검증 통과.
- dry-run:COMPLETED/exit0, DB12테이블 및 collect파일527개 전후 hash 동일.
- 공개:69글/17출처/208이미지/본문69/SNS10/4페이지 전수 통과, 누락·중복0.
- 수집 원본:103FETCHED/17출처/372IMAGE/21SNS/FILE0.
  MIME오류0, 항목101개 통과. dcinside2개 항목의 애니메이션5개는 디코딩 예산 초과로 미통과.
  inventory exit1을 전체 통과로 해석하지 않는다.
- syntax 및 git diff --check 통과. commit/push/배포 없음.

## 남은 문제

디시인사이드 hit17807의 GIF4개와 hit17805의 WebP1개는 전체프레임64Mpixel/API256MiB
디코딩 예산을 넘는다. 원본 bytes/hash 오류와 구분한다. 첫 프레임 절단이나 검증 한도 해제로
성공 처리하지 않는다. 관리자 실제 브라우저 검수, 실제 FILE 표본, 21사이트 최신 증거표도 남아 있다.

과거 [원본 전수 보고서](collector-inventory-2026-09-23.json)의 MIME12개는 정정 전 관측이다.
현재 상세 private 증거는 `.local-data/verification/collector-inventory.json`,
`collector-mime-repair.json`, `collected-content.json`, `dry-run-humoruniv.json`이며
감사 정본은 개발DB `collect.batch_media_correction`이다.
