# 2026-09-23 localhost:3000 재검증

판정: **현재 공개 화면·로컬 데이터 정합성 통과, 전체 batch 고도화는 부분 완료**.
주소: http://localhost:3000/meme. 운영 DB/bucket/배포는 이번 결과에 포함하지 않는다.

## 로컬 전수 readback

고정 대상 `127.0.0.1:5439/blariyo_local`, Web 3000, Core 3100으로 실행했다.

| 항목 | 결과 |
| --- | --- |
| 목록 | 4페이지, 66개, 고유 ID 66개 |
| 상세 API | 66/66 HTTP 200, DB 블록 수/출처 URL 일치 |
| 수집 DB → 공개 본문 | 66/66 내용·이미지 hash·순서 일치 |
| 공개 블록 | 379개: TEXT 245, IMAGE 134 |
| 이미지 | 134/134 HTTP 응답·실제 format/MIME·SHA256·byte size·dimensions·디코딩 일치 |
| private/public | 134/134 동일 파일, 공개 key는 content/published/posts/* |
| SNS | 수집 DB의 9개 URL 모두 본문에 보존 |
| 비공개 경로 차단 | collect/media 및 content/private 요청 모두 404 |

이는 **이미 저장된 batch 결과와 content의 대조**다. 외부 원문 HTML과 parser 출력의 무손실 검증,
실제 첨부 파일 샘플, 21개 사이트 모두의 최신 live 검증을 대체하지 않는다.

## 발견·수정

1. 긴 본문(57블록)과 기존 40블록 API 제한: 본문 계약을 1000블록으로 정렬, 내용 자르지 않음.
2. 한글 출처 URL 때문에 이토랜드 78~81 상세 실패: 응답 URI 인코딩 정렬.
3. private 원본 134개 누락과 실제 JPEG/PNG 표기 불일치 6개: manifest/backup을 가진 media 복구로 정정.
4. 링크 URL만 옮기며 설명이 빠진 5개 게시글(42/81/91/94/102): labels 복구로 설명 추가. 원래 블록 ID 보존.
5. 신규 collect reader lint 2건, 새 public prefix를 인식하지 못한 outbox lock 경로, readiness의 복수 privilege ANY 판정 수정.
6. 일부 parser의 20개 초과 이미지 조용한 생략 제거. 초과 시 실패하도록 고쳤으며 재수집 전 과거 결과를 완전 수집으로 판정하지 않음.
7. 환경 예시의 API 토큰 누락, Core 공개 Web 자기호출 주소, API/batch 서로 다른 DB 표기 정정. 실제 권한 적용은 별도.

## 브라우저 확인

Chrome에서 3000번으로 직접 확인했다. 전체66건은 HTTP/DB 전수 대조하고, 화면은 다음 대표 사례를 관찰했다.

- `/meme`: 1페이지 20개, 4페이지 6개, 마지막 다음 페이지 버튼 비활성.
- `/meme/posts/57`: 긴 본문과 이미지, 정상 상세.
- `/meme/posts/78`: 이토랜드 상세, 공식 YouTube iframe player와 원문 링크.
- `/meme/posts/40`: 이미지 15개 DOM에서 complete/naturalWidth 확인, 15/15 로딩, 깨진 이미지 0.
- `/meme/posts/42`: 복원된 링크 설명 문구 표시.
- 해당 검사 탭의 수집된 console warning/error 로그 없음. 모든 사이트/SNS 사업자의 브라우저 동작을 전수 보장하는 결과는 아님.

## 남은 항목

| 중요도 | 근거 | 영향과 다음 검증 |
| --- | --- | --- |
| High | `apps/collector/src/main/java/com/blariyo/collector/source/SiteAdapters.java` Etoland.list | 로컬 80/81에 공지 포함. 실제 목록 fixture의 공지 row 식별을 검증해야 함 |
| High | `apps/api/src/features/collection/batch-review.service.ts`, local `ops.schema_migration` V006 | V008 새 흐름은 격리 테스트 통과 상태. 실제 dev migration/관리자 흐름·수집 샘플 승격 미완료 |
| High | `OrderedContentParser.java`와 과거 FETCHED 기록 | 이미지 생략 코드 제거 전 저장물은 raw HTML과 재대조 필요 |
| Medium | `apps/api/src/features/images/images.service.ts` upload | 신규 private key의 staging/*를 content/private/*와 정렬하고 cleanup 검증 필요 |
| Medium | `.env.*.example`, `environment-configuration.md` | 예시 정정과 실제 DB role/R2 GET 권한·환경 실행 검증은 별도 |
| Medium | Web 공개 상세의 TEXT 렌더링 | 일반 외부 URL은 보존되지만 클릭 가능한 링크가 아님 |

21개 source 중 현재 이 로컬 DB에 게시글이 있는 것은 **15개**다.
5개씩: arcalive/dmitory/goodgag/instiz/mlbpark/natepann/ruliweb/todayhumor/yuldo.
4개씩: bobaedream/clien/dogdrip/etoland/inven. humoruniv 1개.
dcinside/fmkorea/pgr21/ppomppu/theqoo/youtube-community는 이 데이터셋에 없으며,
다른 임시 DB에서 작성한 과거 17개 FETCHED 보고서를 이 로컬 DB의 현 상태로 취급하지 않는다.

## 실행 검증

- `node scripts/local/repair-collected-labels.mjs --dry-run`: 대상5/변경예정5.
- `--apply` → 반복 `--apply` → `--rollback` → `--apply`: 변경5/0/5/5.
- `node scripts/local/verify-collected-content.mjs`: posts66/images134/bodies66/SNS9, failures0.
- `npm run build -w @blariyo/api`, API/Web lint, Web typecheck 통과.
- `npm run test:unit -w @blariyo/api`: 20 통과.
- `node --test scripts/local/repair-collected-media.test.mjs`: 1 통과.
- 격리 DB runner: batch-review 5, migrations 1, review-regressions 6 통과.
- Java25 `apps/collector/gradlew -p apps/collector test --no-daemon`: 93 통과/조건부 DB2 skip.
  이어서 고유 임시 DB에 COLLECTOR_READBACK_DATABASE_URL을 지정해 MigrationMainTests/DirectBatchRunnerReadbackTests 2개 통과, 임시 DB 제거.
- 실제 R2/S3 cloud readback 및 Discord Gateway는 이번 검사에서 실행하지 않았다.
- git diff --check 통과. main은 기존 ahead1, 기존 미커밋 변경 보존, 이번 commit/push/배포 없음.

기계 판독 상세 결과는 Git 제외 `.local-data/verification/collected-content.json`,
복구 manifest는 Git 제외 `.local-data/repairs/`에 있다. 공개 보고서에 본문/비밀 값을 복사하지 않는다.

## 최신 빌드 재시작 후 추가 검증 (2026-09-23)

이 절은 위 최초 점검 이후의 상태다. V006 미적용 설명과 private staging 경로 잔여 항목은
현재 상태로 사용하지 않는다. 개발 DB는 V008까지 적용됐으며 새 업로드는 content/private/staging을 사용한다.

- Web 3000/Core 3100을 최신 빌드로 재시작했다. Core `/internal/health/ready`는 200 READY.
- 공개 전수 readback을 다시 실행: 목록 4페이지/66개/고유66, 상세66, 본문66, 이미지134, SNS9, 실패0.
- Chrome 재확인: 마지막 페이지6개/다음 비활성, 40번 이미지15/15 로딩 및 가로 넘침 없음,
  57번 긴 본문과 이미지7개 로딩, 78번 YouTube 공식 player 로딩, 42번 링크 설명 표시.
- 인증된 batch 목록 4페이지/66개와 상세66개 모두 HTTP200. 비인증 목록401.
  인증된 `/admin/batch` HTTP200/SSR 확인. 실제 관리자 브라우저 조작과 새 실수집물의 정식 승격은 별도 미검증.
- 관리자 이미지 preview 전수134개 중 **133개200 / 1개413**. 오늘의유머 게시글43의 세 번째 이미지:
  GIF 10,304,943 bytes, 300×533, 257프레임. 신규 이미지 검증의 200프레임 한도를 초과한다.
  공개 파일 정상 표시와 신규 승격 가능 여부를 구분한다. 프레임을 자르거나 검증을 우회하지 않았다.
- 개발 DB role 확인: API는 batch_item/media SELECT만, batch_review/content 쓰기 가능.
  batch는 batch_item/media 쓰기 가능, batch_review/content 접근 불가. 양쪽 superuser/createdb/createrole=false.
- 실제 개발 DB batch_review는 0행. 기존 공개66건을 새 정식 검수·승격으로 생성했다고 보고하지 않는다.
- API unit22, batch-review integration8, migration1, runtime operations5 재실행 통과.
  통합 테스트는 격리 DB에서 실행했다. Collector bootJar 성공, git diff --check 통과.

추가 코드 검토 결과 (미해결):

| 중요도 | 근거 | 영향·후속 작업 |
| --- | --- | --- |
| High | `run/BatchStore.java:119` | raw 저장 후 이미지 실패한 행은 재실행의 conflict update 대상에서 빠짐. 실패 상태/lease에 따른 재시도·멱등 저장 필요 |
| High | `run/DirectBatchRunner.java:98,126` | 429/5xx도 접근 차단으로 분류, retry/backoff 없음. 이미지 요청은 설정 interval 대신 1초 고정. 네트워크 오류와 영구 차단 분리 필요 |
| High | `storage/BatchObjectStore.java:25-28` | batch S3 설정이 없으면 API R2_PRIVATE 자격 증명을 fallback으로 읽음. 소유권 분리 기준과 충돌 |
| High | `source/SiteAdapters.java:299` | 이토랜드 공개80/81에 공지 포함 확인. 실제 row fixture 기반 제외 개선 및 재검증 필요 |
| Medium | `images/image-validation.ts:62` | 기존 GIF257프레임은 신규 preview/승격 제한에 걸림. 제한 유지 여부와 수집물 미리보기 정책 명시 필요 |
| Medium | `.env.local.example` | 직접 실행 예시는 아직 owner 계정/tmp root. 새 제한 role/persistent root 실행기와 문서 정렬 필요 |
| Medium | 공개 상세 TEXT 렌더링 | 42번 일반 외부 URL은 텍스트만 표시, 클릭 불가. 원문 URL 보존은 통과하나 사용성 보완 필요 |

관리자 read-only 상세 증거: Git 제외 `.local-data/verification/batch-review-readonly.json`.
외부21사이트 live 재수집, 원격 R2/S3 readback, Discord Gateway는 이 추가 점검에서 실행하지 않았다.
검증 후에도 공개66건·검수0건 유지. 기존 변경 보존, commit/push/배포 없음.
