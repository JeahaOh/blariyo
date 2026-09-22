# TASK-02 — 구현·검증 전수 조사

- 기준: `main` `c69aa53c0112bcff8f50405c3a81b80969bef05a` (2026-09-22 조사)
- 조사 범위: `apps/api`, `apps/web`, `apps/collector`, `packages/contracts`, API·collector migration, root/API/collector tests와 `docs/migration`, `docs/development-specs`, `docs/implementation/m0-completion`.
- 제외: 비밀 `.env` 값, 실제 운영 DB/저장소/Discord/출처 쓰기, Docker/통합 시험. 외부·운영 상태는 확인하지 않았다.

## 판정

M0 Core와 수동 수집 보조는 코드·migration·계약·테스트 정의가 있고 2026-09-09의 격리 종합 PASS 이력이 있다. 이 이력은 현 HEAD의 PASS가 아니다. 2026-09-21~22 direct batch 변경 뒤 전체 종합 검증은 확인하지 못했고, 이번 안전한 일부 실행에서는 계약 기준선 불일치가 실제로 실패했다.

직접 batch는 **부분 구현**이다. batch ledger와 4개 parser fixture 경로는 존재하지만, `batch-items/:itemId` 조회만 Controller에 추가되었고 OpenAPI/생성 schema/BFF 허용 경로에 등록되지 않아 호출할 수 없다. 또한 batch item을 기존 후보 검수·초안 승격으로 넘기는 변환 계약·구현·테스트가 없다. M1과 M1.5는 명세만 있으며 구현 근거가 없다.

구현률은 이 산출물에서 계산하지 않는다. 기능 단위별 분류와 근거만 제시하며, 최종 분모·가중치·부분 구현 처리 기준은 TASK-04 교차 검수가 정한다. 코드 존재·과거 실행·이번 실행·운영 적용은 서로 대체하지 않는다.

## 기능 매핑

상세 증거와 완료 조건은 [02-implementation-items.json](02-implementation-items.json)을 정본으로 한다. 9개 기능 명세의 하위 요구 38개 매핑은 [02-feature-coverage.md](02-feature-coverage.md)에 둔다.

| ID | 기능 | 코드/테스트 정의 | 과거 PASS | 이번 실행 | 운영 적용 |
| --- | --- | --- | --- | --- | --- |
| I-01 | 공개 조회·공유 | 있음 | 9/9 전체 이력 | SNS projection 11 case PASS | 미검증 |
| I-02 | 관리자 글·이미지·예약 | 있음 | 9/9 전체 이력 | 통합 미실행 | 미검증 |
| I-03 | 정책·권리 | 있음 | 9/9 전체 이력 | 통합 미실행 | 공개 배포·정책 v0.1 증거 있음, 반복 운영 수용 미검증 |
| I-04 | GA4 동의 | 있음, 기본 off | 일부 이력 | consent 5 case PASS | 활성화 gate 미확인/off |
| I-05 | migration·outbox·운영 CLI | 있음 | 9/9 전체 이력 | contract baseline FAIL | 미검증 |
| I-06 | legacy/V2/Spring 수집 보조 | 있음 | 9/9 전체 이력 | 통합 미실행 | 미검증 |
| I-07 | direct batch 자동 수집 | 부분 | 부분 이력 | 재실행 불가 | 비활성·미검증 |
| I-08 | M1 회원 | 없음 | 없음 | 미실행 | 차단 |
| I-09 | M1.5 익게·moderation | 없음 | 없음 | 미실행 | 차단 |

## 이번 실행 로그

실행에 Node 24.18.0은 로컬에 존재해 절대 경로로 사용했다. JDK 25와 root workspace 의존성은 없으며, Gradle wrapper는 sandbox에서 `~/.gradle` lock parent 생성이 거부됐다. 설치·환경 변경이나 DB/운영 쓰기는 하지 않았다. 정책 공개/법무 운영 상태는 [TASK-03 운영 감사](03-operations.md)의 공개 배포·policy v0.1 증거를 따른다.

| 명령/검사 | 결과 | 판정 |
| --- | --- | --- |
| `cmp` canonical/package M0 Core·collection OpenAPI | 둘 다 동일 | PASS |
| `python3 apps/collector/ops/test-render-launchd.py` | 1 test PASS | PASS |
| Node24 `node --test` 7개 파일 | 20 tests 중 18 PASS, 2 FAIL | 아래 분리 |
| Node24 `npm run typecheck -w @blariyo/web` | exit 2 | workspace 불완전으로 완료 판정 불가 |
| contracts typecheck | `tsc: command not found` | root/contracts 의존성 부재 |
| Gradle collector test | 시작 전 wrapper lock parent 생성 거부; JDK25도 부재 | 미실행 |

실행한 Node subset의 정확한 명령은 다음과 같다.

```sh
PATH="/Users/jeaha/.nvm/versions/node/v24.18.0/bin:$PATH" node --test \
  tests/consent.test.ts tests/social-posts.test.ts tests/x-posts.test.ts \
  tests/upload-errors.test.ts tests/scaffold.test.ts tests/migration-contracts.test.ts \
  tests/architecture.test.ts
```

원문 결과는 `20 tests`, `18 pass`, `2 fail`, exit nonzero다. `migration-contracts` 실패는 expected `9f31e550f30a7f80c119b7ed0e553e22bb60211507a51a4a8faecabfa976be17`, actual `401f4a580ac30c71d2f2e5bda2a0d3212691ecbd6376a066628e73bddada5029`이다. `architecture`는 `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript' imported from apps/api/test/architecture.service.test.ts`로 시작 전에 실패했다.

18개 PASS는 consent 5, social-posts 7, x-posts 4, upload-errors 1, scaffold 1이다. SNS projection은 social-posts 7 + x-posts 4로 11건이다. 이들은 DB·브라우저·운영 연동을 검증하지 않는다.

- **확정 결함 — High:** `tests/migration-contracts.test.ts:6-30`은 `packages/contracts/openapi/m0-collection-assist.yaml`의 hash가 기준선과 다르다고 실패했다. 실제 두 canonical 사본은 동일(`cmp` PASS)이나, `docs/migration/contract-baseline.json:14`는 과거 hash를 유지한다. 전체 manifest 대조에서는 collection OpenAPI·`collection-api.d.ts`·`schema.mjs` 3개 불일치와 V006/V007 up/down SQL 4개 추가가 확인됐다. 이 baseline은 당시 migration-start의 불변 증거이므로 현재 hash로 덮어쓰지 않는다. 승인된 확장과 보존 대상 계약을 분리한 새 현행 검사로 재설계하고, 역사 baseline은 보존해야 한다.
- **환경 미충족:** `tests/architecture.test.ts:1`은 `apps/api/test/architecture.service.test.ts`가 root에서 찾을 수 없는 `typescript`를 import해 시작 실패했다. Web typecheck도 `@blariyo/contracts` workspace module을 찾지 못해 연쇄 오류가 발생했다. 이 상태의 typecheck 오류를 소스 결함 PASS/FAIL로 확정하지 않는다.

## 주요 부족·모순

1. **High — direct batch 조회 route가 계약에 없어 도달 불가.** `CollectionController`은 `GET /api/v1/admin/collect/batch-items/:itemId`를 구현했다([apps/api/src/features/collection/collection.controller.ts:110-115](../../../../../../apps/api/src/features/collection/collection.controller.ts#L110-L115)). 그러나 두 collection OpenAPI와 `schema.mjs`에는 `batch-items`가 없고, BFF는 `matchOperation` 실패 시 404를 반환한다([apps/web/server/api/v1/[...path].ts:24-26](../../../../../../apps/web/server/api/v1/[...path].ts#L24-L26)); Core `AdminGuard`도 같은 계약을 강제한다([apps/api/src/http/auth.guard.ts:24-29](../../../../../../apps/api/src/http/auth.guard.ts#L24-L29)). Controller 존재는 API 도달성 증거가 아니다.
2. **High — direct batch에서 검수/초안 승격으로 이어지는 연결이 없다.** API repository는 `collect.batch_item` 한 행만 읽는다([apps/api/src/persistence/batch-result.repository.ts:6-28](../../../../../../apps/api/src/persistence/batch-result.repository.ts#L6-L28)). 기존 `CollectionPromotionService`는 `collect.candidate`와 candidate image preview를 전제로 한다([apps/api/src/features/collection/collection-promotion.service.ts:33-105](../../../../../../apps/api/src/features/collection/collection-promotion.service.ts#L33-L105)). batch item→candidate 또는 batch item 직접 승격은 검색되지 않았다. 계획의 “운영자 검수→승격 또는 반려”([docs/planning/content-collection/README.md:130-140](../../../../../../docs/planning/content-collection/README.md#L130-L140)) 수용 조건이 충족되지 않는다.
3. **High — 자동 수집 상태 문서가 최신 부분 구현과 충돌한다.** 계획은 9/21부터 자동 수집을 이번 구현 대상이라고 한다([docs/planning/content-collection/README.md:30-39](../../../../../../docs/planning/content-collection/README.md#L30-L39)). `design-readiness`는 M0 자동 수집을 “미구현·미검증”으로 표기한다([docs/system-design/design-readiness.md:19-24](../../../../../../docs/system-design/design-readiness.md#L19-L24)). 실제 코드는 V002 ledger와 DirectBatchRunner를 갖고 있어 전면 미구현은 아니다. 반면 execution record는 부분 완료이며 4 parser fixture, theqoo readback 미검증, 16개 blocked라고 정확히 한정한다([docs/implementation/m0-completion/collector-batch-architecture-reset-20260921.md:3-32](../../../../../../docs/implementation/m0-completion/collector-batch-architecture-reset-20260921.md#L3-L32)). 상태 문서를 “부분 구현, 운영 미검증”으로 동기화해야 한다.
4. **Medium — 최신 direct batch readback·migration ledger가 운영 증거로 확대될 수 없다.** `DirectBatchRunnerReadbackTests`는 DB URL이 없으면 skip하고([apps/collector/src/test/java/com/blariyo/collector/run/DirectBatchRunnerReadbackTests.java:25-34](../../../../../../apps/collector/src/test/java/com/blariyo/collector/run/DirectBatchRunnerReadbackTests.java#L25-L34)), synthetic transport과 temp local object store를 쓴다([같은 파일:45-49, 96-115](../../../../../../apps/collector/src/test/java/com/blariyo/collector/run/DirectBatchRunnerReadbackTests.java#L45-L49)). `MigrationMainTests`도 같은 env gate다([apps/collector/src/test/java/com/blariyo/collector/ops/MigrationMainTests.java:12-20](../../../../../../apps/collector/src/test/java/com/blariyo/collector/ops/MigrationMainTests.java#L12-L20)). 5e0aa1c/c69aa53은 코드와 테스트를 추가했지만 이번 HEAD에서 실행되지 않았다.
5. **Medium — direct batch 공유 DB 방향과 이전 별도 DB 설명의 동기화가 남아 있다.** 최신 reset 기록은 batch가 `collect.batch_*`를 쓰고 API role은 SELECT만 하며 검수·초안 승격은 기존 API 계층이 맡는다고 명시한다([collector-batch-architecture-reset-20260921.md:7-9](../../../../../../docs/implementation/m0-completion/collector-batch-architecture-reset-20260921.md#L7-L9)). API도 같은 `DatabaseContext`로 `collect.batch_item`을 읽는다([apps/api/src/persistence/batch-result.repository.ts:6-12](../../../../../../apps/api/src/persistence/batch-result.repository.ts#L6-L12)). 반면 수집 PC와 서비스 DB를 역할 분리한 이전 계획 설명([README.md:46-48](../../../../../../docs/planning/content-collection/README.md#L46-L48)) 및 운영 도구는 공유 DB/role 적용 관점으로 갱신되지 않았다. 새 DB 결정보다는 최신 공유 DB 방향으로 정본·운영 도구를 동기화하고 실제 role grant·연결을 검증해야 한다.

## 다음 완료 순서

1. direct batch OpenAPI·generated contract·BFF/Core guard를 동기화하고 batch item의 검수/초안 승격 소유권을 정한다.
2. I-07의 최신 공유 DB/role 방향으로 이전 별도 DB 설명과 운영 도구를 동기화하고, 실제 role grant·연결 및 batch→검수→draft 격리 E2E와 failure/rollback을 검증한다.
3. 역사 `contract-baseline.json`은 보존하고, 승인된 V006/V007·collection contract 확장과 보존 대상 계약을 분리하는 현행 검사로 재설계한 뒤 의존성을 복원한 Node24/JDK25 격리 환경에서 migration verification을 재실행한다.
4. 실제 출처·S3/R2·Discord·운영 PC/7일 관찰은 별도 운영 수용으로 유지한다. M1/M1.5는 M0 완료율에 포함하지 않는 후속 미구현 범위다.
