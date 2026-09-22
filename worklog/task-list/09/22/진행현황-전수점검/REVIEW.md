# 주 에이전트 직접 검수

- 기준 HEAD: `c69aa53c0112bcff8f50405c3a81b80969bef05a`
- 상태: 직접 검수 완료 — 조사 수용. 제품 구현·운영 수용은 REPORT의 잔여 상태를 유지한다.
- 원칙: 하위 모델의 결론을 원문·Git·계약·실행 결과와 대조한다. 계획과 source를 수정하지 않고 이번 감사 산출물의 오류만 정정한다.

## 직접 확인한 핵심 증거

| ID | 검수 대상 | 직접 확인 결과 |
| --- | --- | --- |
| R01 | 최초 계획 | `503aec7`, `5271830`의 README는 제목/CMS 2줄. `5792943`에서 257줄 기능·기술 설계가 추가됨. 2025 CMS 최초 상세 기획과 `d53514e`의 2026 피드 재기획을 분리하는 것이 타당함. |
| R02 | 폐기 구현 승계 | `docs/ai/README.md:5`의 새 개발 전제를 확인. 과거 prototype 기능/PASS를 현재 구현률에 합산하지 않음. |
| R03 | 현행 M0 완료 조건 | `docs/planning/01-service-plan.md:426`은 하루 두 차례 10~20개 발행·연속 열람 가능 상태. `04-analytics-ad-plan.md:18`은 GA4 연동·동의 구현을 요구하되 운영 활성화는 별도. |
| R04 | 운영 배포와 수용 | `docs/implementation/operations/current-status.md:3`은 9/20 공개 배포 기록, 같은 문서 `:29`~`:37`은 공개 글·실제 관리자 쓰기·장기 관찰·전체 복구의 미검증 경계를 명시. 기록상 완료와 이번 실시간 확인은 별도 집계. |
| R05 | 오래된 현행 상태표 | `docs/system-design/design-readiness.md:19`~`:24`의 M0 전체 공개 차단·자동수집 미구현 설명은 이후 배포와 9/21 코드 추가를 반영하지 못함. 과거 `docs/migration/PROGRESS.md:3`의 DONE_LOCAL은 9/9 범위로만 유효. |
| R06 | 신규 batch 조회 연결 누락 | `apps/api/src/features/collection/collection.controller.ts:110`에 batch-items GET가 있으나 생성 계약 schema의 39개 operation 중 batch 경로 0개. `apps/web/server/api/v1/[...path].ts:24`~`:26`, `apps/api/src/http/auth.guard.ts:24`~`:29`는 계약 미등록 경로를 404로 거부함. 코드/계약 대조로 확인한 결함이며 실제 HTTP 실행 재현은 하지 않음. |
| R07 | 최신 readback 테스트의 한계 | `DirectBatchRunnerReadbackTests.java:27`~`:28`은 DB URL 없으면 skip. `:45`~`:49`의 object store는 Local, `:96` 이후 transport는 fixture임. 실제 출처/S3 운영 readback으로 간주하지 않음. |
| R08 | 최신 migration | `MigrationMain.java:70`~`:94`의 V002 checksum/ledger 기록과 HEAD commit 2개 변경파일을 직접 확인. 테스트 코드 추가와 이번 실행 PASS는 구분함. |
| R09 | 회원·익게 설계 검사 | `python3 docs/system-design/validation/check-member-design.py` exit 0. 이름 조합 262144, Unicode 35·제재 조건 6·연령/SQLite 21 검사. 출력 자체가 `offline_design_model_not_implementation`, JavaScript 및 PostgreSQL/provider 실행은 not_tested라고 명시. |
| R10 | 문서 상대 링크 | Git tracked 749파일 목록에서 관련 Markdown 116개, 상대 링크 957개 검사. 누락 1개는 `docs/ai/handoffs/2026-09-08-main-merge-implementation-status.md:27`의 과거 `collection.mjs` 링크. 역사 기록이므로 현 source 누락과 혼동하지 않음. [검사 산출물](artifacts/repository-inventory-and-links.json). |
| R11 | 계약 baseline 실패 재현 | Node 24.18.0으로 `tests/migration-contracts.test.ts`를 직접 실행해 1 fail 재현. 전체 manifest 비교에서 hash 불일치 3개, 신규 V006/V007 SQL 4개를 확인. 역사 baseline 자체를 현재 hash로 덮어쓰는 처방을 제외하고 현행 확장 검사와 분리하도록 정정. [직접 비교](artifacts/review-contract-baseline.json). |
| R12 | 공개 콘텐츠 독립 조회 | 주 에이전트가 2026-09-22 14:34:26 UTC에 익명 GET을 실행. 실제 `data.pinnedItems`와 `data.items` 모두 0, `success=true`. 하위 조사 결과와 일치. [직접 증거](artifacts/review-public-readback.json). |
| R13 | 회원·익게 미구현 | `apps/api/src/app.module.ts:1`~`:53`과 실제 pages, migration 목록을 대조. 회원/계정/익게/moderation 모듈·화면·migration이 없으며 4개 명세만 있다는 판정을 수용. |
| R14 | 진행 집계 분모 | `git ls-files -z`의 현행 `.dev.md` 9개를 직접 열거. Core 4개 구현 범위, 수집 1개 부분, 회원·익게 4개 미구현으로 정리. [집계](artifacts/progress-counts.json). 전체 공수·출시 준비율로 해석하지 않음. |

## 하위 산출물 정정 요청

1. TASK-01의 “2025 계획의 앱” 표현은 2025 README에 없는 요구이므로 제거 요청. 앱 제외는 2026 재기획 경계로 분리한다.
2. 12개 대분류 동일 가중 비율은 세부 구현 진척이나 공수 비율이 아니다. 기능 묶음 커버리지 제안으로만 쓰고 최종 분모는 세부 inventory와 함께 공개한다.
3. GA4 동의·기본 비활성 연동 구현은 M0 Core 필수이고, 실제 GA4 운영 활성화만 별도라는 차이를 정정 요청.
4. 초기 2026 M1 커뮤니티/M1.5 승인제보와 현행 M1 회원/M1.5 익게의 변화 비교를 보강 요청.
5. 현 운영 법무 실값을 무조건 미입력으로 쓰지 않도록 요청. 공개 정책 발행 기록과 후속 기능 gate를 구분한다.
6. TASK-02의 임의 부분점수 0.25와 69.4%를 제거했다. source 존재를 완성률로 제시하지 않고 실제 기능명세 9개 분모를 별도 공개했다.
7. SNS 단위 통과는 social 7+x 4=11로 정정했다. 전체 18 PASS와 architecture 시작 실패·baseline assertion 실패의 구분을 확인했다.
8. TASK-03의 콘텐츠 0건은 문서만으로 현재값을 단정하지 않도록 실제 공개 API readback을 추가했다. 서비스 수용 문제는 High로 분류하고 Critical 표현을 제거했다.
9. 기존 배포 manifest/source/archive 추적 기록을 인정하고, 부족 항목은 최신 main과 운영 release의 직접 readback 매핑 미확인으로 한정했다.
10. 공유 DB는 9/21 작업지시서에서 이미 결정했으므로 재결정 과제 대신 구 정본·도구 동기화와 권한 검증 과제로 정정했다.
11. 후속 Backlog의 batch DB/E2E 순서를 바로잡고, 수집 활성화와 7일 관찰 사이의 순환 의존을 제거했다. 자동 CD를 M0 필수 조건으로 올리지 않았다.

위 정정은 해당 하위 산출물과 JSON에 반영됐으며 최종 보고는 정정 후 상태를 따른다.

## 이번 실행과 미검증

- 완료: Git 최초/현재 기준 대조, 생성 schema import를 통한 경로 수 검사, 회원 오프라인 설계 검사, tracked 문서 상대 링크 검사, baseline 실패 재현, 공개 목록 독립 조회, 최종 집계 확인.
- 환경 차단: `matchOperation` runtime import는 설치되지 않은 `ajv`로 실패. 생성 schema만의 import 검사는 성공했으나 이를 전체 계약 runtime 테스트로 표현하지 않는다.
- 환경 재확인: Node 24.18.0은 `/Users/jeaha/.nvm/versions/node/v24.18.0/bin/node`에 존재한다. 초기 PATH의 Node 20만으로 Node24 부재를 단정하지 않았다. JDK25/root workspace 의존성이 충족되지 않아 전체 실행은 완료하지 않았다.
- 하위 실행: Node subset 18 PASS/2 FAIL 중 assertion 실패 1개는 주 검수 재현, 다른 1개는 TypeScript 의존성 부재의 검사 시작 실패. Python launchd 1 PASS와 docs/packages OpenAPI 두 사본 일치는 하위 실행 기록을 확인했다.
- 미검증: 최신 HEAD 전체 build·DB 통합·실제 브라우저·Spring/Discord/R2·운영 관리자 로그인. 과거 결과를 현재 PASS로 승계하지 않았다.
- 문서 링크 검사는 파일 존재만 확인했으며 anchor·외부 URL의 내용 검증을 대신하지 않는다.

## 최종 판정

TASK-01~03과 후속 Backlog를 정정 후 수용한다. 핵심 완료/미완료·결함·운영 상태는 위 원문 대조와 실행 증거로 주 검수했다. 기능 하위 38행의 모든 세부 테스트를 재실행한 것은 아니며, 실계정·운영 설정·모든 코드 행의 완전한 수용을 의미하지 않는다. 최종 결과는 [REPORT.md](REPORT.md), 실제 보완 착수 조건은 [BACKLOG.md](BACKLOG.md)를 따른다.

최종 JSON·보고서 링크·신규 파일 공백·Git 변경 범위 검사는 `artifacts/final-validation.json`에 기록한다. 제품/source·기존 tracked 파일은 수정하지 않았고 HEAD/index를 변경하지 않았다.
