# Collector batch architecture reset 실행 기록

상태: 부분 완료. 직접 batch ledger·object-store 경계와 API read-only 경계를 구현했지만, 21개 사이트 전체 실제 batch/S3 readback과 Discord Gateway 연결은 미검증이다.

## 소유권

batch는 `collect.batch_source`, `batch_run`, `batch_item`, `batch_media`, `batch_failure`, `batch_report`, `batch_checkpoint`를 쓰고 `collect/raw`, `collect/media`, `collect/report` object key를 만든다. API는 batch item을 SELECT로 읽고, 검수·초안 승격·공개는 기존 API 계층이 담당한다. API role에는 batch 테이블 INSERT/UPDATE/DELETE를 부여하지 않는다. batch는 `content.*`를 변경하지 않는다.

기존 API 후보·lease·reservation 경로는 기존 수동 URL 호환용으로 보존했으며 새 direct batch 실행 경로에서는 호출하지 않는다. Discord 확인 이후에는 `BatchStore.queueManual`이 batch queue에 직접 쓴다.

## 사이트 상태

| 상태 | source |
|---|---|
| parser 구현·공개 HTML DB fixture readback, 정책 승인 전 | arcalive, bobaedream, dogdrip, inven |
| 기존 detail parser만 유지, 목록·실제 readback 미검증 | theqoo |
| blocked | clien, dcinside, dmitory, etoland, fmkorea, goodgag, humoruniv, instiz, mlbpark, natepann, pgr21, ppomppu, ruliweb, todayhumor, yuldo, youtube-community |

상세 selector·chart·robots·fixture와 21개 전체 근거는 [출처별 검증표](../../../docs/planning/content-collection/reference-site-validation.md)에 있다. `blockedReason`이 있는 source는 실행하지 않으며 generic parser로 대체하지 않는다.

## 검증

- Java collector test: 36 tests, 0 failures/errors로 종료된 XML 결과.
- Node API lint, typecheck, test typecheck, unit: 19 tests passed.
- source config/schema·SNS projection: 8 tests passed.
- 공개 HTML 4종을 개인정보 제거 fixture와 별도로 캡처해 parser→격리 PostgreSQL Core readback: arcalive/bobaedream/dogdrip/inven 4건 passed. 이것은 direct `collect.batch_*` write나 S3 readback 증거가 아니다.
- `bin/blariyo-collector batch ... --dry-run`와 `--write-db`를 theqoo로 실행했다. robots 미확인으로 둘 다 `BLOCKED` exit 2이며 DB/object store를 열지 않았다.
- `git diff --check`: 통과.

## 미완료

실제 direct batch의 enabled source 실행과 `collect.batch_*` DB readback, S3/R2 upload/readback, 첨부 file binary 다운로드, 재수집 update, API batch-item 검수→content draft 승격, Windows/Docker 실제 실행, Discord Gateway 실제 guild 연결은 남아 있다. token·cookie·개인정보가 없어 Gateway 연결은 수행하지 않았다.
