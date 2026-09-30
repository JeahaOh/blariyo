# M0 로컬 구현 goal 완료 감사

- 담당: Codex. 폴더 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/m0-design-completion`.
- 기준 HEAD: `71ed8efe0d1cfb8ea22ed16f6464043c4aa1d81b`. 변경은 미커밋이며 branch/stage/commit/push/merge/배포 없음.
- 상태: **로컬 goal 완료**. 최종 판정: 2026-09-27 10:17 KST. §8의7개 조건과 D01~D04 로컬25개 분기 모두 아래 실행 증거로 확인했다. 실제 운영 인수는 미실행이다.
- 범위: [구현 task §8](../../2026-09-26/m0-implementation-plan/IMPLEMENTATION-TASKS.md#8-로컬-구현-goal-완료-조건). 실제 운영 인수는 [인계서](../../../docs/operations/m0-operation-handoff.md)에 분리한다.
- 환경: Node24.18.0, Java25, PostgreSQL18, task 전용 loopback55449·무작위 DB/합성 object·로컬 Chromium. 실제 출처·Drive/R2/Discord에 접속하지 않는다.

## 1. §8 항목별 판정

| 항목 | 산출물·검증 근거 | 판정 |
| --- | --- | --- |
| UX-01~06·COL-01/02/04·CON-02·D03/D04 코드 | 아래 수용 시험 대응표, [UX 증거](../../../docs/implementation-tasks/core-ux.md), API/Collector/Web·운영 도구 실제 source | PASS |
| 실행 계약·타입·migration/checksum | 문서/실행 OpenAPI 동일성, generator, evolution manifest·기존 적용001–008/001–006 해시 비교, 정확한 DB Entity/FK catalog 검사 | PASS — 보호23개 시작해시 동일 |
| D01~D04 로컬 전체 분기 | 아래25개 수용 시험의 실제 DB·암호화·object·권한·화면 근거. 외부 실패만 합성 응답 사용 | PASS |
| 필요한 타입/lint·단위·실DB·Collector·browser·Docker | §3 명령과 실제 결과. 실패·skip·미실행을 성공으로 집계하지 않음 | PASS |
| 실제 인수·조건부 항목 인계 | [M0 운영 인계서](../../../docs/operations/m0-operation-handoff.md)의 담당·입력·전환/복귀·S1~S5·실제 Core7일·CON-01 | 작성 완료, 실제 인수 미실행 |
| 현행 문서·증거·되돌리기 | status/roadmap/requirements·운영 안내·이 기록, 최종 파일 해시와 명령별 결과 | PASS |
| 범위·기존 변경·자원 정리 | 적용 migration·사용자 준비 기록 보존, owned DB/컨테이너만 생성/정리, 운영 자원 미변경 | PASS — task PG/volume/age 정리, 기존 자원 보존 |

## 2. 수용 시험 대응표

파일명은 저장소 루트 기준이다. 여러 시험을 합쳐 입증하는 항목은 각각의 증거 역할을 적는다.

| ID | 실제 실행 증거·확인 내용 | 실제 인수와의 경계 |
| --- | --- | --- |
| D01-T1 | `apps/api/test/batch-retention.integration.test.ts`: 고정 DB 시각·UTC/KST 직전/정각 판정. `batch-expiry.test.ts`: 브라우저410·기한 경과 표시 폐기 | 운영 시계/worker 상태 인수 별도 |
| D01-T2 | 동일 실DB 시험: 27일 첫 승인→34일 만료, 재검수/반려 불연장,28일 정각 거부 | 합성 과거 시각은 실제28일 관찰이 아님 |
| D01-T3 | 동일 실DB 시험: 서로 다른 접속의 승격/회수 잠금, 만료 commit 전체 rollback·post/origin0·후속 purge 우선. `batch-review.integration.test.ts`: 동시 요청1사본·기존 private/public hash 보호 | 운영 삭제 미실행 |
| D01-T4 | `batch-retention-worker.integration.test.ts`: 실제 JVM+제한 역할+filesystem,403/timeout·DELETE 직후 JVM halt·lease 만료 후 새 JVM 재시도·늦은PUT inventory 재회수·최종 원문0 | S3 adapter의 합성 서명/list/delete·403/timeout은 `RetentionObjectsTests` |
| D01-T5 | worker·`scripts/test-database-roles.ts`: app/batch 일반삭제·불변수정·교차 접근 거부, backup gate·기한 전 호출·content prefix 삭제 거부, 전용 CLI 실제회수 | 실제 cloud ACL 인수 별도 |
| D01-T6 | worker에 body/raw/media/report/checkpoint/queue/confirmation/MIME before_row/API receipt canary 주입 후 DB/object 부재. `batch-review`의 pre-PUT outbox·실패 staging 회수 및 committed copy 유지. backup spool24h/7일 회수 시험 | JS로 제거할 수 없는 외부 사본까지 없다고 주장하지 않음 |
| D01-T7 | `deploy/backup/test-selective-backup.mjs`: 실제 pg_dump→age→독립 decrypt/restore, 원문17table0·content/dedup 유지·과거 full008/006→010/010·원래만료 유지·복원 후 동일원문 DUPLICATE/queue0 | 실제 계정 다운로드·운영 orphan inventory 별도 |
| D02-T1 | `direct-mailbox`·`direct-retry` DB 및 `direct-input` browser: 같은key 동시/응답유실/재전송, 다른key alias, body충돌409·queue중복0 | API 원문 외부 요청0 |
| D02-T2 | `direct-mailbox`: 실제 JVM BEFORE_ACK/AFTER_ACK/AFTER_COMMIT 종료, rollback/restart, 실제60초 lease·late ack 거부·새owner1회 | 실제 장비 강제 종료 별도 |
| D02-T3 | `direct-expiry`·`direct-retry`:24시간 과거 row의 DB 복원 순서, offline ACCEPTED의 GET EXPIRED 무쓰기·batch cleanup 일치·RUNNING/성공 미추정·fetch0 | 하루 대기를 합성 fixture로 재현한 경계 시험 |
| D02-T4 | DB·HTTP·browser: ABSENT/STALE/CONFLICT503/disabled409, 안전한 runtime 필드·GET 무쓰기, 인수 뒤 정책 변경 BLOCKED | 실제 PC 설정 version 인수 별도 |
| D02-T5 | `BatchQueueReadbackTests`·`SourceRequestsTests`·`direct-retry`: 일시/영구 실패 예산, backoff, 수동retry version/key/영구중복/원문기한·commit fence | task 자체 수정 cycle과 제품 retry 정책은 별개 |
| D02-T6 | `tests/browser/direct-input.test.ts`·`batch-expiry.test.ts`:320/1280px·키보드·loading/empty/error·401복구·5초poll 중단·410/정각 text/img/link/action 제거 | 실제 운영자 수용 별도 |
| D03-T1 | `test-drive.mjs`: OAuth/Shared Drive 최소 scope·계정/폴더/부모 불일치·공개폴더/타파일 거부 | 실제 계정 종류·용량·ACL 미입력 |
| D03-T2 | 동일 시험: chunk/최종 응답 유실·동일fileID·중단 재개·durable offset·session 만료, loopback HTTP 실제stream | Google 실전송 미실행 |
| D03-T3 | 동일 시험:401 refresh1회·invalid_grant·403회수·429 Retry-After·quota·유한 retry | 실제 credential/권한회수 시험 별도 |
| D03-T4 | Drive/jobs/spool 시험: snapshot+7일 정각 삭제·새 dump 실패/공급자 일부 실패에도 만료 회수·다른파일 보호·미완료 spool24h | 운영 timer 설치/활성화 미실행 |
| D03-T5 | 실제 PG18/age 독립 복원, hash 오염 거부·미분류 table 거부·full 사본 대체 전 독립 재다운로드/복원·원래 expiry 보존 | 실제18시간 이내 운영 복구 증거 별도 |
| D03-T6 | `test-backup-jobs.mjs`: R2 유지·dual 실패·Drive 전환 gate·R2 fallback·실패/회복 알림 재시도·중복dump0 | Discord 실수신·실제 전환/복귀 미실행 |
| D04-T1 | Core HTTP·브라우저 signed Access 대역: OWNER/EDITOR 게시물/이미지/검수 업무 허용 | 실제 두 계정 Access/MFA 별도 |
| D04-T2 | Core operation 허용 목록·직접 legacy PATCH/설정 EDITOR403, 서버·DB/backup 권한 분리·안전 runtime 읽기 | 실제 서버/Cloudflare/R2/Drive ACL 별도 |
| D04-T3 | `auth-contract`·`admin-roles`·`direct-input`: 외부 role/service header 제거·검증된 BFF 내부role, 잘못된 token/role·직접 Core 거부 | 실제 Access issuer/audience 별도 |
| D04-T4 | 실제 BFF+합성 RS256/JWKS: 같은JWT로 active=false 즉시403·복원200·잘못된role403·위조signature401 | JWT 유효성 캐시와 registry 재조회 구분 |
| D04-T5 | 실제5개 DB login·GRANT·제한함수·S3 합성 signed adapter·private/content prefix 분리·backup 쓰기/역할전환 거부 | 실제 cloud 정책 집행 증거 별도 |
| D04-T6 | 관리자 실제브라우저 업로드·BFF 계약projection·storage 설정 분리: credential/object key 비노출·인증된 preview | 친구 실계정 이미지 업무 인수 별도 |

추가 범위: COL-01의 합성 HTTP/실PG 영속 quota·robots/Crawl-delay·동시성·KST 날짜/재시작은 `DirectHttpControlReadbackTests`·`DirectRequestBudgetTests`; COL-02의0/3/4redirect·순환·다른host·매hop DNS·4번째 목적지0요청은 `SourceRequestsTests`다. OPS-04의 확인 전 취소·동시확인·권한·만료·replay는 `BatchQueueReadbackTests`이며 실제 Discord 전송은 없다.

## 3. 검사 명령과 결과

- 기본 환경은 위 Node/Java 경로와 `TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres`를 명시했다. 비밀번호 없는 task 전용 loopback 시험 DB이며 운영 설정은 읽지 않는다.
- API `build` 완료→`build:test` 완료→검사 순서를 지켰다. `dist`를 읽는 API/browser 검사가 실행 중일 때 rebuild하지 않는다.

| 검사 | 명령 | 최신 결과 |
| --- | --- | --- |
| 공통·계약·불변 migration | `npm test`, `npm run contracts:generate`, `npm run hooks:check` | 공통34 PASS·생성 동일·hook PASS |
| API 타입/산출물/lint | `npm run build -w @blariyo/api`, `npm run build:test -w @blariyo/api`, `npm run lint -w @blariyo/api` | PASS |
| API 서비스 | `node --test apps/api/dist-test/*.service.test.js` | 35 PASS |
| API 전체 실DB | `node scripts/test-nest-integration.ts` |30 files/130 tests PASS·실패/skip0 |
| Collector 전체·실DB | `node scripts/test-collector-readback.mjs` |80suites/289tests·실DB readback18 PASS, 실패/skip0 |
| 실제5역할·복원 | `node scripts/test-database-roles.ts` | PASS,73table/16sequence·확인취소 제한함수 포함 |
| Web | `npm run typecheck:web`, `npm run lint -w @blariyo/web`, `npm run build -w @blariyo/web` | PASS |
| scripts/tests | `npm run typecheck:scripts`, `npm run lint:scripts`, `npm run typecheck:tests`, `npm run lint:tests` | PASS |
| 실제 Chromium | `node --test --test-concurrency=1 tests/browser/*.test.ts` | 최종52 PASS, 실패/skip0·실제 예약 시각 검증 |
| Docker API/Web | `node scripts/test-docker.ts` | 최종 build/production runtime·signed Access·DB복원·maintenance·SIGTERM PASS |
| backup/retention 단위 | `npm run test:backup` | Node17·Python3 PASS |
| 실제 선택백업/과거 full 대체 | `node deploy/backup/test-selective-backup.mjs` |53보존/17제외·008/006→010/010·같은URL 실제접수 DUPLICATE/queue0 PASS |
| backup image | `docker build -f deploy/backup/Dockerfile -t blariyo-m0-backup-20260927-final .` 및 readonly/network-none runtime | nonroot65532·Node24.18.0·pg_dump18.6·age1.3.2 PASS |
| 문서/범위 | 상대링크/anchor 검사, `git diff --check`, 보호 파일 해시·Git 상태 | 보호23개 동일·링크/anchor 오류0·diff check PASS |

## 4. 운영 인계·되돌리기

- 실제 장비/OS·사설 DB 경로, Drive 계정/전용 폴더·복구키 별도 보관, 두 operator identity/role, Discord 채널, 비운영 R2/DB/Drive 영역과 법무 고지는 미입력이다. 값을 추측하거나 secret을 Git에 남기지 않는다.
- 승인 후 순서: 현재 운영 SHA/digest/ledger/flag readback→백업·격리복원→새 migration/제한역할 후보→기본OFF 배포→선택백업/기존full 대체 확인→회수/입력 허용 범위 활성화→실제 인수→Core 운영7일 관찰.
- V009/V010의 destructive down은 명시적으로 거부한다. 기능 flag/worker를 닫고 데이터 보존 상태에서 호환 후보 이미지로 복귀한다. immutable trigger 해제·원문 재생성·영구dedup 삭제로 되돌리지 않는다.
- R2 정상 백업은 Drive 실제 인수가 끝날 때까지 유지한다. Drive 장애는 검증된 R2 fallback을 사용하고 snapshot+7일 삭제 기한을 늘리지 않는다.
- 전체17 task나 실제 운영 완료로 올리지 않는다. COL-03/S1~S5·OPS-01~05 실제 수용·CON-01 조건부 재활성화는 [운영 인계서](../../../docs/operations/m0-operation-handoff.md)에 남는다.

## 5. 최종 증거와 보존

[검사 집계](VALIDATION.json), [현재 파일 SHA-256](FINAL-FILES.sha256), [기존 적용 SQL·사용자 기록 보존](PRESERVATION.json), [문서 링크 검사](DOCUMENT-LINK-AUDIT.json)를 함께 읽는다. 해시 목록은 그 목록 자체만 제외하고 본 task의 Git 변경 후보와 worklog 산출물을 포함한다. 과거00:31의 FILES.sha256/STOP-REPORT는 이력으로 보존했으며 최신 판정에 재사용하지 않는다.

시험 runner의 무작위 DB/object/서버는 종료·정리됐다. task PG 컨테이너와 연결 anonymous volume·age 다운로드를 정리하고 기존5439/5433 자원은 보존했다. 최종 backup image는 검토 산출물로 보관한다. 다른 세션의 batch-structure-research 기록2개와 기존 m0-implementation-plan 기록은 본 변경 해시 목록에서 제외하고 보존했다.
