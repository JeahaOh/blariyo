# TASK-02 기능 명세 하위 요구 매핑

상태 표기: **구현**은 현 HEAD source 근거, **정의**는 테스트 파일 존재, **과거 PASS**는 2026-09-09 등 당시 기록, **이번**은 이 감사의 실행 결과다. 어떤 열도 운영 적용을 뜻하지 않는다.

| 명세 | 하위 요구 | 구현 근거 | 검증 수준 |
| --- | --- | --- | --- |
| 공개 탐색 | 활성 board 목록 | `public.controller.ts:20-27`, `public.service.ts:12-19` | 정의: `public-http.integration.test.ts`; 과거 PASS |
| 공개 탐색 | 목록의 공지/20행/page | `public.service.ts:21-32` | 정의: `public-http.integration.test.ts`; 과거 PASS |
| 공개 탐색 | 상세·소속/비공개 404 | `public.controller.ts:37-47`, `public.service.ts:34-47` | 정의: `public-http.integration.test.ts`; 과거 PASS |
| 공개 탐색 | 조회 수 원자 증가 | `public.controller.ts:49-55`, `public.service.ts:49-52` | 정의: `public-http.integration.test.ts`; 이번 미실행 |
| 공개 탐색 | 공유·SNS 안전 projection | `[boardSlug]/posts/[postId].vue:115-135`, `social-posts.ts` | 이번 `social-posts` 7 + `x-posts` 4 = 11 case PASS |
| 관리자 게시글 | 검색/편집 상세 | `posts.controller.ts:11-35`, `admin.vue:78-125` | 정의: `admin-http.integration.test.ts`; 과거 PASS |
| 관리자 게시글 | 초안 생성·수정·version | `posts.controller.ts:37-53`, `posts.service.ts:103-204` | 정의: `admin-http.integration.test.ts`; 과거 PASS |
| 관리자 게시글 | 즉시/예약/취소 발행 | `posts.controller.ts:55-75`, `posts.service.ts:205-223` | 정의: `schedule-alerts.integration.test.ts`; 과거 PASS |
| 관리자 게시글 | 권리 숨김·재공개·제거 | `posts.service.ts:224-254` | 정의: `review-regressions.integration.test.ts`; 과거 PASS |
| 관리자 게시글 | staging 이미지 upload/preview/discard | `images.controller.ts:8-33`, `images.service.ts` | 정의: `images-http.integration.test.ts`; 이번 미실행 |
| 관리자 게시글 | image rollback/outbox 보상 | `posts.service.ts:80-88,228-240` | 정의: `failures.integration.test.ts`; 과거 PASS |
| 분석 동의 | 기본 false·저장소/UI 미노출 | `nuxt.config.ts:50-52`, `useConsent.ts:3-14` | 이번 consent 5 case PASS |
| 분석 동의 | banner와 cookie settings | `SiteFooter.vue:144-168`, `CookieSettings.vue:10-20` | 정의: `browser/consent.test.ts`; 이번 browser 미실행 |
| 분석 동의 | 허용 뒤 loader/event | `analytics.client.ts:1-37` | 이번 consent test PASS; network 미실행 |
| 분석 동의 | 철회·만료·오류에서 차단 | `useConsent.ts:16-29`, `consent.mjs` | 이번 consent test PASS |
| 정책·권리 | public policy version/history | `public.controller.ts:57-69`, `public.service.ts:53-65`, `PolicyViewer.vue:3-52` | 정의: `policies.integration.test.ts`; 과거 PASS |
| 정책·권리 | artifact 시행 command | `commands/command.ts`, `policies.service.ts` | 정의: `policies.integration.test.ts`; 과거 PASS |
| 정책·권리 | 권리/문의 mailto와 copy fallback | `SiteFooter.vue:7-73,113-143` | source 존재; 실제 client 미검증 |
| 정책·권리 | 공개 배포/정책 v0.1 | `03-operations.md:8-20,86-96` | 공개 GET/발행 증거 있음; 반복 처리 미검증 |
| 수집 보조 | 관리자 URL 후보 접수·조회·반려 | `collection.controller.ts:47-108`, `collection.service.ts` | 정의: `collection-http.integration.test.ts`; 과거 PASS |
| 수집 보조 | 후보 preview와 관리자 검수 | `collection.controller.ts:116-124`, `admin-collect.vue:72-208` | 정의: `collection-content.integration.test.ts`; 과거 PASS |
| 수집 보조 | candidate→draft 승격 | `collection.controller.ts:25-36`, `collection-promotion.service.ts:42-166` | 정의: `collection-admin.integration.test.ts`; 과거 PASS |
| 수집 보조 | legacy/V2 create/claim/heartbeat/result | `collector.controller.ts:23-50`, `collector-commands.service.ts` | 정의: `collection-v2-http.integration.test.ts`; 과거 PASS |
| 수집 보조 | quota·lease·execution fence | `collector-quota.service.ts:22-115`, `collector-lease.service.ts:35-96` | 정의: `collector-lease.integration.test.ts`; 과거 PASS |
| 수집 보조 | 운영 event 목록/ack | `collection-operations.controller.ts:8-46`, `admin-collect.vue:13-39` | 정의: `collection-operations.integration.test.ts`; 과거 PASS |
| direct batch | V002 ledger·write ownership | `collector-v002.sql:1-58`, `BatchStore.java:13-37` | 정의: `MigrationMainTests.java`; env 없으면 skip |
| direct batch | list/detail parse·media local object boundary | `DirectBatchRunner.java:17-52`, `BatchObjectStore.java:11-40` | fixture readback 정의; 실제 source/S3 미검증 |
| direct batch | 4 parser fixture/21 source 상태 | `SiteAdapters.java`, `collector-batch-architecture-reset-20260921.md:13-27` | 4 fixture historical; 16 blocked |
| direct batch | batch item read-only 조회 | `collection.controller.ts:110-115`, `batch-result.repository.ts:6-28` | 구현은 있으나 OpenAPI/BFF 미등록으로 도달 불가 |
| direct batch | batch→검수→draft 연결 | `collection-promotion.service.ts:33-166`은 candidate 전용 | 미구현; reset 기록도 미완료로 명시 |
| M1 회원 인증 | provider context/start/callback | `member-identity.dev.md:23-45` | source/migration/OpenAPI/test 모두 미검증 |
| M1 회원 인증 | 가입 필수동의/나이/세션 | `member-identity.dev.md:60-75` | 미구현 |
| M1 계정 | 표시명/연동/로그아웃 | `account-lifecycle.dev.md:21-64` | 미구현 |
| M1 계정 | 탈퇴 worker/KEEP/복원 ledger | `account-lifecycle.dev.md:67-105` | 미구현 |
| M1.5 참여 | community 공개 읽기·글 | `community-participation.dev.md:44-61` | 미구현 |
| M1.5 참여 | 댓글·랜덤 이름·내 활동 | `community-participation.dev.md:63-78,98-112` | 미구현 |
| M1.5 moderation | 신고 접수/중복/rate | `community-moderation.dev.md:28-52` | 미구현 |
| M1.5 moderation | 운영 검토·hide/remove·제재 | `community-moderation.dev.md:54-76,87-114` | 미구현 |

`apps/api/src/app.module.ts:1-69`와 `apps/web/app/pages/`에는 M1/M1.5 module·route가 없다. 이 표의 명세 source 행은 구현 근거가 아니라 미구현 판정의 정본 근거다.
