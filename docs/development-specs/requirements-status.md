# M0 요구사항 전수 대조표

- 상위 보고서: [중간 점검](../../worklog/2026-09-23/m0-audit/report.md). 후속 실행: [다음 계획](../roadmap.md).
- 기준: 2026-09-23 작업 트리. 기능 묶음별 40개 점검 단위이며 API endpoint 수나 개발 공수 비율이 아니다.
- 구현 판정: **I = 주요 구현 확인, P = 부분 구현/새 경로 연결 또는 마감 필요, U = 대응 구현 미확인**. I도 현재 테스트·화면·운영 수용 완료를 뜻하지 않는다.
- 검증 판정: **L = 9월 23일 로컬 증거 확인, H = 이전 검증 기록/테스트 소스 확인, N = 해당 실제 흐름 미검증**. 최초 감사는 테스트를 재실행하지 않았으며 후속 실행은 각 결과 보고서로 구분한다.

## 1. M0 Core — 16개

정본: [서비스 기획](../planning/01-service-plan.md), [화면 설계](../planning/03-screen-design.md), [공개 탐색](m0-core/public-post-browsing/public-post-browsing.dev.md), [관리자](m0-core/admin-post-management/admin-post-management.dev.md), [정책·권리](m0-core/policy-and-rights/policy-and-rights.dev.md), [분석 동의](m0-core/analytics-consent/analytics-consent.dev.md).

| ID | 점검 단위 | 구현 | 검증·현재 근거 | 남은 수용 조건 / 다음 작업 |
| --- | --- | --- | --- | --- |
| C01 | 공개 진입·board seed·공지·목록·페이지 경계 | I | L: 목록 4페이지/71고유건; [PublicService](../../apps/api/src/features/public/public.service.ts), [PostList](../../apps/web/app/components/PostList.vue) | 최신 배포에서 20건/공지 분리·빈 페이지·오류 재시도 재확인 / P0-04 |
| C02 | 상세·본문 순서·하단 목록·비공개 404 | I | L: 본문71건·404 음성 검사; [상세](../../apps/web/app/pages/[boardSlug]/posts/[postId].vue) | 숨김 직후 공개 목록/상세와 잘못된 board 경계 운영 확인 / P0-04·05 |
| C03 | 이미지 URL host/key 분리·복수 이미지·SNS/외부 링크 | I | L:266이미지·SNS10 누락0; [public DTO](../../apps/api/src/features/public/public.dto.ts), [media route](../../apps/web/server/routes/media/[...path].get.ts) | 새 public prefix 실제 R2/CDN readback; 로컬 통과를 운영으로 승계 금지 / P0-05 |
| C04 | 상세 표시 후 조회 수·실패 비차단 | I | H: [공개 controller](../../apps/api/src/features/public/public.controller.ts), [브라우저 Core](../../tests/browser/core.test.ts) | 최신 화면 회귀; 단순 GET 점검과 view POST 쓰기 구분 / P0-04 |
| C05 | 공유·SSR canonical/OG/Twitter·404 noindex | I | H: [metadata](../../apps/web/app/utils/metadata.mjs), [공유 UI](../../apps/web/app/pages/[boardSlug]/posts/[postId].vue) | native/copy/X·오류 fallback 재확인; Kakao OFF 유지 / P0-04 |
| C06 | 정책 현행/이력·불변 시행·modal/직접 URL | I | H: [PolicyViewer](../../apps/web/app/components/PolicyViewer.vue), [PoliciesService](../../apps/api/src/features/policies/policies.service.ts), 정책 v0.1 배포 기록 | 최신 환경에서 버전·내용 동일성 확인; 고지 변경 시 새 버전 / P0-04·05 |
| C07 | 권리 문의 mailto·복사·숨김 업무 | I | H: [SiteFooter](../../apps/web/app/components/SiteFooter.vue), [footer 검사](../../tests/browser/footer.test.ts) | 실제 메일 수신·운영자 숨김 시나리오; 법률 자문 완료로 해석하지 않음 / P0-05 |
| C08 | 관리자 인증·allowlist·BFF/Core 경계 | I | H/N: [admin middleware](../../apps/web/server/middleware/admin.ts), [auth 계약](../../tests/auth-contract.test.ts); 실제 운영자 쓰기 미검증 | Access 로그인→권한 매핑→허용/거부 확인 / P0-05 |
| C09 | 관리자 검색·목록·필터·빈/오류 상태 | I | L: [Core 보완 결과](../../worklog/2026-09-23/admin-core/FIX-RESULTS.md), [admin.vue](../../apps/web/app/pages/admin.vue)의 게시판·수정일·한국어 상태/빈 결과·재시도 | 운영자 반복 검색·실제 사용성 인수 / P0-04 |
| C10 | TEXT/IMAGE·출처·공지·초안 수정·순서 변경 | I | H: [admin.vue](../../apps/web/app/pages/admin.vue), [PostsService](../../apps/api/src/features/posts/posts.service.ts) | 실제 수동 10~20건 반복 작성·저장/이탈·충돌 시 입력 유지 / P0-03·04 |
| C11 | 다중 이미지 업로드·검증·private preview·실패 보상 | I | H/L: [ImagesService](../../apps/api/src/features/images/images.service.ts), [images 통합](../../apps/api/test/images-http.integration.test.ts), 수집 이미지 후속 검사 | 실제 관리자 업로드 실패·재시도·원격 저장 경계 / P0-04·05 |
| C12 | 즉시 발행·멱등·동시 수정·버전 잠금 | I | L:111번 별도 발행; [PostsController](../../apps/api/src/features/posts/posts.controller.ts), [admin 통합](../../apps/api/test/admin-http.integration.test.ts) | 실제 관리자 버튼과 중복 클릭 최종 회귀 / P0-04 |
| C13 | 예약·취소·due worker·중단 복구·실패 알림 | I | H: [예약 통합](../../apps/api/test/schedule-alerts.integration.test.ts), [admin 통합](../../apps/api/test/admin-http.integration.test.ts) | 실제 예약1건·알림 실수신·중복 없음; 장기 관찰 별도 / P0-05·P2-01 |
| C14 | 숨김·재공개·제거·public 삭제/purge outbox | I | L/H: batch 검수 통합 및 [outbox](../../apps/api/src/operations/outbox.service.ts) | CDN 이미지 회수 실제 관측·실패 재시도 / P0-05 |
| C15 | 분석 기본 OFF·동의·철회·전송 항목 제한 | I | H: [consent](../../apps/web/app/utils/consent.mjs), [동의 브라우저](../../tests/browser/consent.test.ts) | OFF에서 Google 요청/식별값 미노출; GA4 활성화는 별도 / P0-04 |
| C16 | 관리자 디자인·탐색·모바일·키보드·반복 업무 | P | L/N:최소 디자인·반응형·키보드·오류 복구 로컬 검증, [인수 12건](../testing/operator-acceptance.md)은 미실행 | 실제 운영자 반복 업무의 시간·혼동·재작업과 잔여 수용 / P0-04 |

## 2. M0 수집 보조 — 8개

정본: [수집 기획](../planning/content-collection/README.md), [수집 설계의 direct 계약](../system-design/07-spring-collector-design.md), [수집 기능 명세](m0-collection-assist/collection-assist/collection-assist.dev.md). 최초 보고서 D01~D03의 앞부분 legacy 충돌은 [후속 정합성 결과](../../worklog/2026-09-23/collection-contract-alignment/RESULTS.md)로 보완했다. 입력/source 소유권·보존/고지는 별도 미정이다.

| ID | 점검 단위 | 구현 | 검증·현재 근거 | 남은 수용 조건 / 다음 작업 |
| --- | --- | --- | --- | --- |
| A01 | 관리자 URL 입력→source 식별→batch 접수 | P | N: [admin-collect](../../apps/web/app/pages/admin-collect.vue)는 legacy candidate POST, [BatchMain](../../apps/collector/src/main/java/com/blariyo/collector/ops/BatchMain.java)은 direct CLI | 입력 요청의 소유권·전달 방식 확정 후 direct 경로 연결 / P1-01 |
| A02 | Discord slash→사용자 확인→큐 등록 | I | L/N: [BatchDiscordIntake](../../apps/collector/src/main/java/com/blariyo/collector/discord/BatchDiscordIntake.java), [Gateway](../../apps/collector/src/main/java/com/blariyo/collector/discord/DiscordGateway.java); 실제 Gateway 없음 | 허용 대상·취소/만료·다른 사용자·재전송·결과 조회 실연동 / P1-04 |
| A03 | 공통 큐·claim·owner fence·재시작·중복 | I | L: [BatchQueueStore](../../apps/collector/src/main/java/com/blariyo/collector/run/BatchQueueStore.java), [queue readback](../../apps/collector/src/test/java/com/blariyo/collector/run/BatchQueueReadbackTests.java) | 다른 PC 실행·worker 중단 후 회복 / P1-03 |
| A04 | 수집 결과 조회·비공개 preview·실패 이유 | I | L: [검수 UI 후속](../../worklog/2026-09-23/batch-review-ui/RESULTS.md), 필터·이미지 실패 재시도·익명 거부 | 원격 collect 읽기 역할·실제 Access 인수 / P1-03 |
| A05 | 검수 상태·승인/반려·낙관 잠금 | I | L: [검수 UI 후속](../../worklog/2026-09-23/batch-review-ui/RESULTS.md), 격리 브라우저 승인/반려·버전 충돌·재조회 | 실제 운영자 수동 인수 / P1-02 |
| A06 | 승인→content DRAFT·이미지 복사·별도 공개 | I | L:111번 API/DB/object 전이, [V008](../../apps/api/migrations/V008__batch_review.sql) | 원격 private/public 복사·실패 보상·중복 승격 / P1-03 |
| A07 | 새 batch 검수 UI·원문/첨부 확인·초안 이동 | I | L: [검수 UI 후속](../../worklog/2026-09-23/batch-review-ui/RESULTS.md), 조건부 메뉴·필터·`/admin?postId`·응답 복구 | 실제 운영자·Access·원격 환경 인수 / P1-02·03 |
| A08 | source 설정·정책·활성/차단 상태 운영 관리 | P | N: [legacy 출처 UI](../../apps/web/app/pages/admin-collect-sources.vue)와 [direct registry](../../apps/collector/ops/reference-sites.sources.example.json) 분리 | 실제 적용 config 식별자·읽기 전용 조회·변경 절차 일치 / P1-01·02 |

## 3. M0 자동 수집 — 8개

| ID | 점검 단위 | 구현 | 검증·현재 근거 | 남은 수용 조건 / 다음 작업 |
| --- | --- | --- | --- | --- |
| B01 | HOT/GENERAL/DETAIL 정책·목록/상세 분리 | I | L: [SiteAdapters](../../apps/collector/src/main/java/com/blariyo/collector/source/SiteAdapters.java), [DirectBatchRunner](../../apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java) | 실제 source별 chart 유지·구조 변경 fixture 보강 / P1-06 |
| B02 | 본문 순서·복수 이미지·FILE·SNS·raw 저장 | I | L: [OrderedContentParser](../../apps/collector/src/main/java/com/blariyo/collector/source/common/OrderedContentParser.java), [DirectUrlRunner](../../apps/collector/src/main/java/com/blariyo/collector/run/DirectUrlRunner.java) | 17출처의 미디어/외부 링크 형태 표본 확대; 모든 사이트 FILE 실검증은 아님 / P1-06 |
| B03 | canonical/source post key·중복·재수집 정책 | I | L: [BatchStore](../../apps/collector/src/main/java/com/blariyo/collector/run/BatchStore.java), [runner readback](../../apps/collector/src/test/java/com/blariyo/collector/run/DirectBatchRunnerReadbackTests.java) | 현재 config는 skip; update 정책을 지원한다고 확대 보고하지 않음 / P1-06 |
| B04 | pagination·max pages/items·since·간격·크기 상한 | I | L: [BatchMain](../../apps/collector/src/main/java/com/blariyo/collector/ops/BatchMain.java), [runner 테스트](../../apps/collector/src/test/java/com/blariyo/collector/run/DirectBatchRunnerTests.java) | 날짜 미상 제외/포함과 시간대 의미를 화면·report에 표시 / P1-06 |
| B05 | retry/backoff·site stop·실패 상태·checkpoint | I | L: [SourceRequests](../../apps/collector/src/main/java/com/blariyo/collector/run/SourceRequests.java), [lifecycle 검사](../../apps/collector/src/test/java/com/blariyo/collector/run/BatchLifecycleReadbackTests.java) | 실제 장기 실행 실패율·재시작·중단 알림 / P1-03·P2-01 |
| B06 | dry-run 무쓰기·write-db 직접 저장·JSON 보고서 | I | L:12테이블/527object 불변 기록; [CLI](../../bin/blariyo-collector), [ops 안내](../../apps/collector/ops/README.md) | 원격 DB/S3 무쓰기·쓰기 후 독립 readback / P1-03 |
| B07 | 21개 출처 모두 실제 수집·readback | P | L/N:17개 verified-local, 4개 차단; [21출처 표](../../worklog/2026-09-23/m0-audit/report.md#6-21개-사이트-상태) | 차단 해제/허용 경로 확보 후 실제 검증; 불가능한 것을 generic 성공 처리하지 않음 / P1-06 |
| B08 | direct 원본·media·report·queue 보존/회수 | U | N:기존 [cleanup](../../apps/api/src/features/collection/collection-cleanup.service.ts)과 Java maintenance는 legacy 테이블 중심; direct 삭제 구현 미확인 | 보존 기간·참조 보호·batch 소유 삭제·orphan manifest·멱등 readback / P1-05 |

## 4. 공통 운영·출시 준비 — 8개

| ID | 점검 단위 | 구현 | 검증·현재 근거 | 남은 수용 조건 / 다음 작업 |
| --- | --- | --- | --- | --- |
| O01 | DB schema·상태·unique/version·분리 role/migration | I | L: [역할 검사](../../scripts/test-database-roles.ts), API V008/collector V006까지 확인 | 운영 적용 버전·이전 이미지 호환성·최소 권한 확인 / P0-05·P1-03 |
| O02 | 원격 DB/object 권한·prefix·새 collect 실연동 | P | N/H: [object adapter](../../apps/collector/src/main/java/com/blariyo/collector/storage/BatchObjectStore.java), 기존 Core R2 기록; 새 경로 실제 연결 없음 | batch/API 서로의 쓰기 거부 및 object GET/hash 대조 / P1-03 |
| O03 | DB 백업·암호화·격리 복원·복구 절차 | I | L/H:61테이블/16sequence 복원; [backup](../../deploy/backup/README.md) | 최신 배포 전 백업 상태; 새 VM/media 복구 및 7일 보존 관찰 별도 / P0-05·P2-01 |
| O04 | Core CI·image·테스트 재현 명령 | I | H: [CI](../../.github/workflows/ci.yml), [복원 CI](../../.github/workflows/backup-restore.yml) | collector job 로컬 추가; 최종 변경의 실제 원격 run·artifact 확인 / P0-04·P1-07 |
| O05 | 환경 설정·cross-platform·별도 PC batch 실행 | P | L/N:환경 예시·macOS local 검증; Windows/별도 PC 실증 없음 | 지원 OS별 동일 CLI·재시작·설정 경로 검증 / P1-03·07 |
| O06 | 운영 감시·실패 알림·일정·자원·보존 관찰 | P | H/N: [운영 상태](../operations/current-status.md), [runtime 검사](../../apps/api/test/runtime-operations.integration.test.ts) | 실제 알림 수신·관찰 담당·점검표·장애 대응 / P0-05·P2-01 |
| O07 | 최신 release 배포·rollback·운영자 인수 | P | L/H/N: [로컬 후보·호환 행렬](../../worklog/2026-09-23/release/candidate.md), 기존 9월20일 운영 기록은 이번 배포 증거가 아님 | 최종 SHA 원격 CI→운영 ledger/백업→승인 배포·실제 smoke / P0-05 |
| O08 | 정본·화면 명세·구현·운영 기록 일치 | P | N:최초 D01~D06 충돌 확인 후 [D01~D03 정합성 보완](../../worklog/2026-09-23/collection-contract-alignment/RESULTS.md) | 현행/legacy·입력 완료/활성화 gate·UI/기능 검증 분리 / P0-01·P1-01 |

## 5. 집계와 판정 규칙

- Core: I 15 / P 1 / U 0. 수집 보조: I 6 / P 2 / U 0. 자동 수집: I 6 / P 1 / U 1. 공통 운영: I 3 / P 5 / U 0.
- 총 40개: **I 30 / P 9 / U 1**. 이 표의 I 비율은 구현 기반의 확인 범위일 뿐 제품 완성도 또는 출시 준비율이 아니다.
- 전체 M0 완료는 Core·수집 보조·자동 수집의 수용 조건과 필요한 운영 검증까지 충족해야 한다. 접근 차단 출처를 제외한다면 별도 제품 범위 결정이 필요하며 본 보고서에서 제외 승인하지 않는다.
- 회원·익게·사용자 작성·광고·제휴는 M0 분모에서 제외한다. GA4/Kakao는 구현 경계와 실제 활성화를 분리하고 기본 OFF일 때 Core 운영을 막지 않는다.
