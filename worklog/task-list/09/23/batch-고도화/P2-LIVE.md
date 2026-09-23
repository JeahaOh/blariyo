# 2026-09-23 정식 batch 검수·초안·별도 발행 증거

대상: 로컬 PostgreSQL5439/blariyo_local, Web3000, Core3100.
운영 DB/bucket/서비스는 변경하지 않았다. 전체 목표는 P3/P4와 최종 감사가 남아 있다.

## 실행 결과

| 수집물 | 원문 | batch item | API 게시글 | 검증 |
| --- | --- | --- | --- | --- |
| yuldo | https://yul-do.com/humorissue/102745043 | 75bd56e9-8198-4ca1-a9a3-855026537f14 | 104 | SNS LINK1, 공식 X iframe 실제 로딩 |
| goodgag | https://www.goodgag.net/371441 | a112abf4-a6a8-419d-974a-f242f4a0a787 | 105 | 원문 이미지3개, private/public 실제 bytes·hash·decode, 브라우저3/3 로딩 |

API의 REVIEWING → APPROVED → DRAFT(201) → 별도 publish(200)로 처리했다.
초안 상태의 공개 조회는 각각404였고 105는 private3개/공개key없음까지 확인했다.
104의 동일 draft key 재전송은 같은 post104를 반환했다. 새 게시글을 추가로 만들지 않았다.
격리 API 통합 테스트에서는 이미지 중간 실패 보상, 같은 key 동시 요청, 변경 snapshot 재검수,
canonical/source post key 중복, 숨김→outbox 회수→private 보존→재발행을 검증했다.

현재 공개68건/이미지137개/SNS10개, 전체 목록·상세·본문 순서·공개/비공개 사본 대조 실패0.
기존66건은 보존했다. 새 승격 사본은 이미지 검증·재인코딩 계약을 따르므로 collect의 원본 hash와
공개 hash를 무조건 같다고 판정하지 않는다. collect bytes 자체 hash를 먼저 대조한 뒤 동일 검증
변환 결과와 저장된 content hash를 대조하고, HTTP/public/private 세 사본도 별도로 대조한다.

## batch 실행과 readback

| run | 내용 | 결과 |
| --- | --- | --- |
| 97131f0a-cb6e-42ee-b161-ba5a5e7cf650 | yuldo dry-run1건 | 상세1, collect7테이블 전체 행 digest/object217개 hash 실행 전후 동일 |
| b4feba93-a0a5-429b-8316-8857dd2d754b | yuldo write1건 | FETCHED1, media0, DB/raw/report readback 통과 |
| 129da83e-09f6-4a38-8343-028e842fb7b8 | yuldo write상한5건 | 신규4/중복1, DB/raw/report readback 통과 |
| f3e17ee7-43d8-4a58-9044-63b3c97e227e | goodgag write1건 | FETCHED1, 원문 video URL3개 LINK 보존, media0 |
| 21378fe0-169f-47de-982a-5587f233f666 | goodgag write상한5건 | 신규3/중복1/실패1, PARTIAL. media5개 readback 통과, 수집 전체 완료=false |

goodgag371439는 IMAGE 요청에서 SOURCE_TOO_LARGE, item FAILED/failure_code와 batch_failure에 원인이 남는다.
해당 raw/body가 있어도 이미지 저장 실패를 FETCHED로 표시하지 않는다.
율도의 hot은 현행 호환 설정명이고 실제로는 일반 유머/이슈 목록이다. 인기 목록 검증으로 해석하지 않는다.
site별 날짜 미확인 정책은 P4에서 별도 정렬해야 하므로 --since24h가 모든 원문의 작성일 확인을 증명하지 않는다.

DB 백업: Git 제외 `.local-data/backups/before-live-review-20260923.dump`.
기계 판독 결과: `.local-data/verification/live-dry-run.json`, `batch-run-{runId}.json`, `collected-content.json`.
readbackPass는 DB/object 정합성, collectionComplete는 해당 실행의 수집 완료이며 서로 대체하지 않는다.

## 재현 명령

```sh
node scripts/local/run-batch.mjs batch --source yuldo --chart hot --max-pages 1 --max-items 1 --since 24h --dry-run
node scripts/local/run-batch.mjs batch --source yuldo --chart hot --max-pages 1 --max-items 5 --since 24h --write-db
node scripts/local/run-batch.mjs batch --source goodgag --chart hot --max-pages 1 --max-items 5 --since 24h --write-db
node scripts/local/verify-batch-run.mjs RUN_UUID
node scripts/local/verify-collected-content.mjs
```

검수 명령과 고정 로컬 role 준비는 [실행 안내](../../../../../scripts/local/README.md#정식-batch-검수-실행)를 따른다.
이 실행에서 사용한 draft key는 각각 local-yuldo-102745043-draft / local-goodgag-371441-draft다.
토큰/쿠키는 기록하지 않는다. 현재 서버 재시작으로 관리자 actor가 바뀌었다면 이전 actor의 receipt 재생을
기대하지 말고 연결된 postId와 최신 lockVersion을 조회한다. 새 요청은 중복 승격 제약으로 보호된다.

## 코드/테스트 보강

- SourceRequests: list/detail/redirect/media/file 같은 interval, 429/408/5xx와 제한 transport 오류 최대3회.
  Retry-After60초 초과는 사이트 중단,403 즉시 중단, 나머지 상세 실패는 최대3개.
- BatchStore: source session lock, orphan RUNNING 종료, 미완성 item 재실행/부분 media 행 교체, 완료 snapshot skip.
- BatchObjectStore: API R2_PRIVATE fallback 제거, collect 밖 traversal key 거부, presigned key 첫 글자 유실 수정.
- LinkedText: HTTP(S) 외부 URL 렌더링, 본문 문자 그대로 보존, 인증정보 포함 URL은 평문 유지, HTML 실행 없음.
- Java 전체103 pass/0 fail/0 skip(임시 PostgreSQL 실제 연결), Web 링크2/typecheck/lint/build 통과.
- git diff --check 통과. 기존 변경 유지, commit/push/배포 없음.

이 문서는 21개 사이트 전체 완료, 실제 remote R2 readback 또는 Discord Gateway 실연동의 증거가 아니다.
