# Express → Nest 전환 계획 및 수용 기준

최종 완료 조건은 [사용자 TASK](TASK.md)의 전체 조건이다. 실제 브라우저·Spring·Docker·백업/격리 복원 및 최종 작업 트리 재검증을 포함한다.

기준선: main의 사용자 미커밋 source. API/OpenAPI·M0 제품·SQL 스키마 유지. M1/M1.5 추가, 프런트 개편,
commit/push/배포 제외. 기술 정본은 [08-code-structure](../../../docs/system-design/08-code-structure.md).

## HTTP 대응표

기존 OpenAPI의 operation을 대응한다. Collector 외부 경로는 BFF에서 `/api/collector/v1`, Core에서
`/internal/collect`로 유지한다. 아래 회귀 이름은 전환 전 테스트 묶음의 추적용 이름이다. 현재 실행 파일은 아래의 strict 테스트 대응표를 따른다.

| Core Method / Path | operationId | Nest 도메인 | 기존 회귀 테스트 |
| --- | --- | --- | --- |
| GET `/internal/health/live` | getLiveHealth | health | core-isolation |
| GET `/internal/health/ready` | getReadyHealth | health | core-isolation |
| GET `/api/v1/boards` | listBoards | public | public / bff |
| GET `/api/v1/boards/{boardSlug}/posts` | listPosts | public | public / bff |
| GET `/api/v1/boards/{boardSlug}/posts/{postId}` | getPost | public | public / bff |
| POST `/api/v1/boards/{boardSlug}/posts/{postId}/views` | incrementPostView | public | public / bff |
| GET `/api/v1/policies/{type}` | getPolicy | public policy | policy-consent |
| GET `/api/v1/admin/posts` | searchAdminPosts | posts | admin / review-regressions / failures |
| POST `/api/v1/admin/posts` | createPost | posts | admin / review-regressions / failures |
| GET `/api/v1/admin/posts/{postId}` | getPostEditor | posts | admin / review-regressions / failures |
| PATCH `/api/v1/admin/posts/{postId}` | updatePost | posts | admin / review-regressions / failures |
| DELETE `/api/v1/admin/posts/{postId}` | removePost | posts | admin / review-regressions / failures |
| POST `/api/v1/admin/images` | uploadImages | images | admin / failures / upload-errors |
| GET `/api/v1/admin/images/{imageId}/preview` | previewImage | images | admin / failures / upload-errors |
| DELETE `/api/v1/admin/images/{imageId}` | discardImage | images | admin / failures / upload-errors |
| POST `/api/v1/admin/posts/{postId}/publish` | publishPost | posts | admin / review-regressions / failures |
| POST `/api/v1/admin/posts/{postId}/unschedule` | unschedulePost | posts | admin / review-regressions / failures |
| POST `/api/v1/admin/posts/{postId}/hide` | hidePost | posts | admin / review-regressions / failures |
| POST `/api/v1/admin/posts/{postId}/republish` | republishPost | posts | admin / review-regressions / failures |
| GET `/api/v1/admin/collect/sources` | listCollectionSources | collection admin | collection / collection-v2 |
| PATCH `/api/v1/admin/collect/sources/{sourceId}` | updateCollectionSource | collection admin | collection / collection-v2 |
| GET `/api/v1/admin/collect/candidates` | listCollectionCandidates | collection admin | collection / collection-v2 |
| POST `/api/v1/admin/collect/candidates` | createCollectionCandidate | collection admin | collection / collection-v2 |
| GET `/api/v1/admin/collect/candidates/{candidateId}` | getCollectionCandidate | collection admin | collection / collection-v2 |
| GET `/api/v1/admin/collect/candidates/{candidateId}/images/{candidateImageId}/preview` | previewCollectionImage | collection admin | collection / collection-v2 |
| POST `/api/v1/admin/collect/candidates/{candidateId}/retry` | retryCollectionCandidate | collection admin | collection / collection-v2 |
| POST `/api/v1/admin/collect/candidates/{candidateId}/reject` | rejectCollectionCandidate | collection admin | collection / collection-v2 |
| POST `/api/v1/admin/collect/candidates/{candidateId}/draft` | promoteCollectionCandidate | collection admin | collection / collection-v2 |
| POST `/internal/collect/candidates` | collectorCreateCandidate | collector legacy/V2 | collection / collection-v2 / spring/* |
| POST `/internal/collect/candidates/claim` | collectorClaim | collector legacy/V2 | collection / collection-v2 / spring/* |
| POST `/internal/collect/candidates/{candidateId}/heartbeat` | collectorHeartbeat | collector legacy/V2 | collection / collection-v2 / spring/* |
| POST `/internal/collect/candidates/{candidateId}/result` | collectorResult | collector legacy/V2 | collection / collection-v2 / spring/* |
| POST `/internal/collect/candidates/{candidateId}/images/{candidateImageId}/preview` | collectorUploadPreview | collector legacy/V2 | collection / collection-v2 / spring/* |
| GET `/internal/collect/status` | collectorStatus | collector legacy/V2 | collection / collection-v2 / spring/* |
| GET `/internal/collect/candidates/{candidateId}/execution-state` | collectorExecutionState | collector legacy/V2 | collection / collection-v2 / spring/* |
| POST `/internal/collect/sources/{sourceId}/request-reservations` | collectorReservation | collector legacy/V2 | collection / collection-v2 / spring/* |
| POST `/internal/collect/operational-events` | collectorOperationalEvent | collector legacy/V2 | collection / collection-v2 / spring/* |
| GET `/api/v1/admin/collect/operational-events` | listCollectorOperationalEvents | collection admin | collection / collection-v2 |
| POST `/api/v1/admin/collect/operational-events/{eventId}/acknowledge` | acknowledgeCollectorOperationalEvent | collection admin | collection / collection-v2 |

개발 전용 local media route도 binary 응답으로 유지한다. 별도 제품 endpoint를 추가하지 않는다.

## 유스케이스 및 운영 명령

| 기능 / 명령 | 목표 소유자 | 검증 |
| --- | --- | --- |
| 공개 eligibility·문맥·조회 수·정책 버전 | PublicService/PublicRepository | public, policy-consent, bff, Nest public |
| 게시 상태·이력·멱등성·이미지 소유권 | PostsService/PostsRepository + UnitOfWork | admin, review-regressions, failures |
| 이미지 decode/re-encode·업로드·보상 | ImagesService/ImagesRepository + OutboxRepository | admin, failures, Nest images |
| 정책 artifact hash·권한·발행 | PoliciesService/PoliciesRepository | policy-consent |
| 수집 출처·후보 검수·반려·승격 | CollectionService/CollectionRepository | collection |
| legacy/V2·quota·lease·execution/version fencing | CollectorCommandsService·Protocol/Lease/Quota/State와 기능별 Repository | collection-v2, spring/* |
| npm run db:migrate, down, grantApplication | MigrationsService/MigrationsRepository | constraints, schema catalog, checksum |
| npm run posts:publish-due | PostsService + ScheduleAlertsService | admin, failures |
| npm run outbox:run | OutboxService/OutboxRepository | failures, review-regressions |
| npm run cleanup:run | CleanupService/Repositories | failures |
| npm run policies:publish -- --artifact=... | PoliciesService | policy-consent, CLI smoke |
| collection-transition check/apply | CollectionOperationsService/CollectionOperationsRepository | collection-v2, drain/fencing |
| liveness/readiness·shutdown·maintenance | HealthModule / bootstrap / Guard | core-isolation, compiled process smoke |
| Nuxt BFF / Spring 프로세스 | 기존 HTTP 계약 유지 | bff, browser/*, spring/runtime/control/preview/fencing/step-boundaries |

## 정본·기존 구현·새 경계의 연결

위 HTTP 표의 도메인과 아래 표를 함께 사용한다. 기존 경로는 삭제 전 `apps/api/src/` 기준이며
착수 사본에 보존되어 있다. 공통 HTTP 분기는 원래 `http/app.mjs`, 수집 분기는
`http/collection-routes.mjs`였다. 현재는 각 Controller가 명시적으로 등록한 route로 처리한다.
아래 Repository 이름은 업무 계약이고 구현은 `persistence/`의 TypeORM provider다.
실제 테스트 파일·명령은 다음 strict 테스트 표와 단일 종합 실행 절, 최신 결과는 [REPORT](REPORT.md)에 연결한다.

| HTTP 표의 도메인 / 운영 묶음 | 정본 | 기존 구현 | 현재 Module·HTTP/업무·저장 경계 | DB·동시성 요구 |
| --- | --- | --- | --- | --- |
| health | [인프라](../../../docs/system-design/04-infrastructure-design.md)·[Core OpenAPI](../../../docs/development-specs/m0-core/openapi/m0-core.yaml) | database/readiness.mjs, bootstrap/startup.mjs | HealthModule/Controller/Service/Repository, startup | read-only schema·역할 권한 확인, listener/연결 정상 종료 |
| public | [공개 명세](../../../docs/development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md) | features/public/public.mjs | PublicModule/Controller/Service/Repository | REPEATABLE READ snapshot, 원자적 조회 수, 정렬·페이지 제한 |
| public policy / 정책 CLI | [권리·정책 명세](../../../docs/development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md) | features/policies/policies.mjs, commands/command.mjs | PublicController, PoliciesModule/Service/Repository | artifact checksum·권한, 시행 버전 transaction, 공개 이력 |
| posts | [관리자 명세](../../../docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md) | features/posts/posts.mjs, database/post-lock.mjs | PostsModule/Controller/Service/Repository, IdempotencyRepository, Storage | session advisory lock, version·멱등성·outbox·copy 보상 |
| images | [관리자 명세](../../../docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md)·[API](../../../docs/system-design/03-api-design.md) | features/images/images.mjs | ImagesModule/Controller/Service/Repository, Storage, OutboxRepository | 전체 파일 검증·재인코딩, 소유권·rollback·외부 저장 보상 |
| collection admin | [수집 명세](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md) | features/collection/collection.mjs | CollectionModule/Controller/Service/PromotionService/Repository, Posts/Images Module | 후보·출처 상태, 승격 멱등성·version·초안/receipt/outbox 원자성 |
| collector legacy/V2 | [Spring 설계](../../../docs/system-design/07-spring-collector-design.md)·[수집 OpenAPI](../../../docs/development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml) | features/collection/collection.mjs, collection-v2.mjs | CollectionModule/CollectorController, Commands/Protocol/Lease/Quota/Result/Preview/State Service·기능별 Repository | SKIP LOCKED, receipt·quota·execution/version fencing·lease·preview 보상 |
| collection 운영 이벤트·전환 | [Spring 설계](../../../docs/system-design/07-spring-collector-design.md) | features/collection/operations.mjs, transition.mjs, commands/collection-transition.mjs | CollectionOperationsModule/Controller/Service/Repository | 확인 원자성·legacy drain·ACCESS EXCLUSIVE 전환, 단일 CLI |
| migration / outbox / 정리 / 예약 알림 | [데이터](../../../docs/system-design/02-data-model.md)·[운영](../../../docs/system-design/05-security-operations.md) | database/migrate.mjs, operations/*.mjs, features/posts/schedule-failure.mjs | MigrationsModule/Service/Repository, OperationsModule, Outbox/Cleanup/ScheduleAlerts Service·Repository, EdgeCache/Storage | 기존 SQL·ledger·checksum·잠금, 재시도 소유권·보존 기간·예약 중복 방지 |

## 순서와 검증 gate

1. 기준선 snapshot·기존 테스트·빌드·DB catalog 확보.
2. strict TS, ORM entity, Repository 계약, UnitOfWork, HTTP Pipe/Filter/Guard 기반 작성.
3. public → images → posts → policies → collection → operations/CLI 순서로 구현·단계 검증.
4. 기존 Express 직접 구현과 중복 의존성 제거, 모든 테스트/스크립트/build 진입점을 Nest로 연결.
5. 한 번의 종합 검증에서 typecheck, lint, mock Repository 서비스 단위 테스트, 실제 PostgreSQL 통합,
   API/BFF/Spring E2E, production build, 빌드 결과물 기동 smoke를 모두 통과.
6. SQL·OpenAPI·범위 밖 파일 hash, main/HEAD, diff check, 문서 링크와 완료 주장 검수.

## 완료 감사

- [x] Nest가 Core 주 실행 경로이며 Express 라우터 위임 없음
- [x] 모든 도메인 Module/Controller/Service/Repository와 DI 계약 완성
- [x] HTTP·Service·CLI에 ORM/SQL 직접 접근 없음
- [x] 17개 테이블 entity 매핑, 원래 제약·인덱스·trigger/transition 보존
- [x] strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes, 전체 Core TS 전환
- [x] any/ts-ignore/ts-nocheck/이중 단언 회피 없음
- [x] M0/API/운영 명령/동시성/보상 기능과 모든 기존 assertion 보존
- [x] 단위/실제 DB/전체 API/BFF/Spring/compiled runtime 검증 통과
- [x] legacy 파일·진입점·중복 의존성 제거
- [x] 사용자 변경 보존·main 유지·commit/push/배포 미수행 검증

체크는 최종 소스·종합 실행 `migration-ks4zg0`·문서와 보존 감사·전용 자원 종료 후 반영했다.
22개 실행 단계가 exit 0이며 상세 결과는 [REPORT](REPORT.md), 과정 이력은 [PROGRESS](PROGRESS.md)에 기록한다.

## 현재 구현과 strict 테스트 대응

테스트 파일은 별도 표시가 없으면 `apps/api/test/`이며 실제 실행은 빌드된 `apps/api/dist-test/`를 사용한다.
전환 전 assertion과 대응을 비교한 기록은 PROGRESS와 `core-test-inventory.jsonl`에 보존했다.

| 원래 회귀 묶음 / 기능 | 현재 테스트 | 실제 구현 경계 |
| --- | --- | --- |
| public / policy-consent | public-http.integration, policies.integration | PublicService/PublicRepository, PoliciesService/PoliciesRepository |
| admin / failures / review-regressions | admin-http.integration, failures.integration, review-regressions.integration | PostsService/PostsRepository, ImagesService/ImagesRepository, OutboxService/OutboxRepository |
| constraints / core-isolation | migrations.integration, core-isolation.integration, startup.service | MigrationsService/MigrationsRepository, DatabaseContext, HealthRepository, startup |
| collection | collection-admin.integration, collection-http.integration | CollectionService, CollectionPromotionService, CollectionRepository, Posts/Images Module |
| collection-v2 | collection-v2-http.integration, collector-lease.integration, collection-operations.integration | CollectorCommands/Protocol/Lease/Result/Preview/Quota/State Service와 각각의 Repository·receipt Repository |
| bff / auth-contract | bff.integration, http-boundaries.integration, tests/auth-contract.test.ts | 실제 Nuxt BFF, Admin/Collector Guard·ContractPipe·Filter·Interceptor |
| 운영·빌드 프로세스 | runtime-operations.integration, schedule-alerts.integration, dev-watch.integration | compiled main/command, CleanupService·ScheduleAlertsService·운영 Repository, polling dev |
| ORM·transaction·FK | database.integration | 17 Entity·224 컬럼·15 FK, 실제 독립 연결 transaction·잠금·rollback |
| migration·독립 복원 | schema-restore.integration | 원래 SQL schema 전체 dump·전체 row/sequence/ledger/checksum, 별도 PostgreSQL·복원 후 Nest API |
| UI·동의·오류 | tests/browser/*.test.ts 및 root *.test.ts | 실제 Chromium·Nuxt, 원래 실패/동의/반응형 assertion |
| Spring 연동·중단·복구 | tests/spring/{control,fencing,preview,runtime,step-boundaries}.test.ts | 실제 JVM·별도 PostgreSQL·BFF/Core·Chromium |
| Docker production·운영·종료 | scripts/test-docker.ts | 실제 Core/Nuxt image, 합성 Access·정책 CLI·S3/CDN, maintenance·SIGTERM·DB 연결 해제 |

## 단일 종합 검증

`npm run verify:migration`은 필터·skip 인자를 받지 않는다. 실행 순서는 build → strict/lint →
단위·구조·계약 → 실제 PostgreSQL API/CLI/schema/독립 복원 → 실제 Chromium →
Spring build/unit/프로세스 복구 → 최종 Docker → legacy·Git 검사다.
검증은 `test-results/migration-*/results.json`과 단계별 로그에 기록한다. 필수 단계 실패는 nonzero 종료다.
이 진입점의 전체 통과와 최종 요구사항 감사·문서 검증·자원 정리가 모두 끝나기 전에는 DONE_LOCAL이 아니다.

Core와 Spring은 실행 중인 검증 파일/공유 runtime을 고정하여 검사한다. 개별 실행 이후 코드나
검증 연결이 바뀌면 최종 종합 실행으로 결과를 갱신한다. 외부 운영 실값·배포·실발송은 포함하지 않는다.
