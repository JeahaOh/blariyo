# Hot 출처 개발 DB 수집 결과

- 요청: `hot 있는 사이트들 수집해서 개발 DB에 넣어`
- 실행: 2026-09-25 00:14:28~00:38:16 KST, 최종 DB 대조 00:48:49 KST.
- 결과: **6개 출처에서 신규 원문 89건 저장. 10개 대상 전체 성공은 아님.**
- 대상: `127.0.0.1:5439/blariyo_local`, 제한 역할 `blariyo_batch_local`.
- 수집 완료 누계: **104 → 193건**. 기존 완료 104건의 전체 행 해시 일치.
- 완료 원문에 연결된 이미지 **320개 / 112,919,799 bytes**, 본문 블록 **718개**, SNS 링크 **4개**.
- 신규 실패/차단 item **8건**, 기간 제외 **1건**, 기존 중복 **5건**. 별도로 목록 미검증 출처 **2개**는 실행 시작 전에 거부.
- 기존 `content.board_post` **74건 전체 행 해시 일치**. 신규 수집물은 검수용 저장이며 초안 승격·발행하지 않음.

## 실행 범위

- 현재 source 설정에 `charts.hot`이 있는 10개 출처만 선택. 일반 최신 목록·상세 전용 출처는 대상 아님.
- 출처별 `--chart hot --max-pages 1 --max-items 20 --since 24h --interval-ms 10000 --write-db`.
- `datePolicy=INCLUDE_UNKNOWN`이므로 게시 시각을 확인하지 못한 글도 포함. 전체 결과를 최근 24시간 글로 단정하지 않음.
- 목록·상세·이미지 요청은 기존 수집기의 제한·출처별 잠금을 사용. 실패 시 차단 해제·allowlist 확장·본문 요약 대체 없음.
- 꺼져 있던 기존 개발 PostgreSQL 컨테이너만 기동. 기존 volume 유지, migration·초기화·운영 DB 접근 없음.
- 시작 전 개발 DB의 custom-format 백업을 확보했고 `pg_restore -l`로 백업 목록 읽기 확인. 복원 실행은 하지 않음.
- Java 25에서 Collector `bootJar --offline --no-daemon` 성공. 이번 작업에서는 애플리케이션 source·설정을 수정하지 않음. 수집 설정 파일은 시작 시 SHA-256과 종료 시 SHA-256 일치.

## 출처별 결과

| 출처 | 신규 완료 | 완료 이미지 | 실행 상태 | 예외 |
| --- | ---: | ---: | --- | --- |
| 아카라이브 | 19 | 79 | COMPLETED | 기간 제외 1건 |
| 보배드림 | 20 | 44 | COMPLETED | 없음 |
| 개드립 | 19 | 82 | FAILED | 마지막 상세 요청 DNS 오류 1건, 앞선 완료 19건 보존 |
| 인벤 | 11 | 47 | PARTIAL | 본문 분석 실패 3건 후 종료 |
| 루리웹 | 19 | 67 | PARTIAL | 본문 분석 실패 1건 |
| 더쿠 | 1 | 1 | BLOCKED | 다음 글의 본문 분석 중 허용 URL 검사 실패 |
| 디시인사이드 | 0 | 0 | FAILED | 기존 중복 5건 제외 후 새 글 이미지 서버 오류 |
| 오늘의유머 | 0 | 0 | BLOCKED | 첫 글의 본문 분석 중 허용 URL 검사 실패 |
| 에펨코리아 | 0 | 0 | BLOCKED | CHART_UNVERIFIED, DB run 생성·사이트 요청 전 거부 |
| 뽐뿌 | 0 | 0 | BLOCKED | CHART_UNVERIFIED, DB run 생성·사이트 요청 전 거부 |
| 합계 | **89** | **320** | 부분 성공 | 미완성 원문은 완료 수에 포함하지 않음 |

디시인사이드 실패 item에 연결된 이미지 9개는 진단용 부분 저장으로 남아 있다. 따라서 실제 신규 저장 파일은
329개이며, 위 완료 이미지 320개에는 이 9개를 포함하지 않는다. 일반 첨부파일(FILE) 신규 완료 수는 0개다.

## 검증

- `scripts/local/verify-batch-run.mjs`: DB run이 생성된 **8개 실행 모두 readbackPass=true**.
- 원문 HTML 존재·본문 블록 존재, 이미지 파일 크기·SHA-256·MIME·프레임 디코딩 확인.
- 실행 보고서·checkpoint·report hash·실패 기록 수와 DB 상태 일치.
- 신규 완료 89건의 본문 이미지 순번·저장 이미지, 첨부 metadata·파일, SNS 링크·본문 연결 일치.
- 기존 완료 104건 보존, 게시글 74건 보존, 완료 원문 식별자 중복 0건, 이번 실행 RUNNING 0건.
- 브라우저 화면 검증·게시글 승격·발행·운영 반영은 이번 실행 범위가 아님.
- 단위 테스트는 source 변경이 없어 재실행하지 않음. 빌드·실제 사이트 수집·DB/object 재조회 증거를 사용.

## 재개할 예외

| 출처 | 단계 | 오류 코드 | 재개 시 확인 |
| --- | --- | --- | --- |
| 디시인사이드 | MEDIA | SOURCE_HTTP_UNAVAILABLE | 해당 원문 이미지 서버의 정상 응답 |
| 개드립 | FETCH | SOURCE_DNS_FAILED | 공개 host DNS 정상 응답 |
| 인벤·루리웹 | PARSE | PARSE_FAILED | 저장 raw HTML 기준 본문/미디어 구조와 parser 계약 |
| 더쿠·오늘의유머 | PARSE | SOURCE_NOT_ALLOWED | 원문의 이미지·첨부 URL과 현재 허용 범위. 자동 확장하지 않음 |
| 에펨코리아·뽐뿌 | 실행 전 | CHART_UNVERIFIED | 기존 차단 조건 해소와 실제 공개 목록·상세 검증 |

robots 응답은 실행 전 아카라이브·보배드림·디시인사이드·개드립·인벤·루리웹 200,
더쿠·오늘의유머 404로 관측했다. 이는 robots 허용 전체 검증이나 운영 활성화 승인 증거가 아니다.
기존 direct 경로의 robots/일일 요청 예산 미연결과 운영 활성화 조건은 이번 데이터 적재로 해결하지 않았다.

## 증거 위치

비공개·Git 제외 `.local-data/hot-collection-20260925/`:

- `before.dump`: 실행 전 DB 백업, 권한 600.
- `baseline.json`: 실행 대상·옵션·시작 시각·기존 완료 item/게시글 행 해시.
- `runs.json`, `<source>.json`: 출처별 종료 코드·실행 ID·수집 결과.
- `verifications.json`, `<source>-verification.json`: DB·파일 재조회 결과.
- `summary.json`: 최종 집계·기존 데이터 보존·본문/이미지/SNS 연결 검사.
- `run.mjs`, `verify-completed.mjs`, `summarize.mjs`: 이번 실행의 로컬 재현·검증 스크립트.

원문·이미지 object는 기존 `.local-data/collector-objects/collect/`에 저장된다. 실제 본문과 비공개
설정·백업은 이 작업 기록이나 Git에 복사하지 않았다. 종료 시 작업 트리에는 시작 시점의 문서 변경 외에
analytics/consent 관련 source·테스트·문서 변경도 관측됐다. 이 병행 변경은 이번 수집 작업에서 건드리지 않았다.
이번 추적 대상 산출물은 이 결과 문서이며 commit/push는 실행하지 않았다. `git diff --check` 통과.
