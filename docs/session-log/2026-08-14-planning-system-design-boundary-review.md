# 2026-08-14 planning·system-design 경계 재검토

- 상태: 현행 문서 구조 정정 완료
- 목적: planning과 system-design의 중복·대치 제거, data-model·api-design 계약 보완, 실행 준비 상태의 과장 제거
- 범위: 루트 README, planning 정본, M0 system-design, 실제 Express skeleton·PostgreSQL init 경계

## 1. 확정한 문서 책임

| 계층 | 책임 |
| --- | --- |
| planning | 제품 범위, 출시 단계, 운영 규칙, 화면과 수용 기준 |
| system-design | 컴포넌트, DB schema, HTTP 계약, 인프라, 보안·운영 |
| 실행 산출물 | migration, OpenAPI, source, test, Compose와 실제 배포 상태 |

planning에는 SQL 자료형·table schema·endpoint payload의 사본을 두지 않는다. system-design은 planning의 제품 범위를 독자적으로 바꾸지 않는다. 설계 문서가 있어도 실행 산출물과 검증이 없으면 구현 준비 완료로 판정하지 않는다.

## 2. 감사 결과

| ID | 심각도 | 유형 | 신뢰도 | 발견 내용 | 처리 |
| --- | --- | --- | --- | --- | --- |
| C3-1 | High | Contradiction | High | 서비스·인프라 planning이 table·API·보안 계약을 복제해 system-design과 정본이 이중화됨 | planning은 요구사항·의사결정으로 축소하고 구현 세부는 system-design 링크로 대체 |
| C3-2 | High | Contradiction | High | planning은 로그인·광고를 초기 구현으로, system-design은 M0 제외로 정의 | M0, M1, M1.5, 후속 단계로 분리하고 M0 schema·API에서 후속 기능 제외 |
| E3-1 | High | Error | High | image upload가 post 생성보다 먼저지만 image의 `post_no`가 NOT NULL 전제 | 미연결 STAGED image와 transaction 선점·복합 FK 계약 추가 |
| E3-2 | High | Error | High | API `viewCount`를 계산할 저장 열과 중복 없는 집계 절차가 없음 | `TB_POST.view_count`, event dedupe key, 5분 exactly-once 집계 경계 추가 |
| E3-3 | High | Error | High | 변경 API가 `Idempotency-Key`를 요구하지만 결과를 보존할 model이 없음 | actor scope의 idempotency table과 advisory transaction lock 계약 추가 |
| E3-5 | High | Error | High | 예약 발행이 staging image promote 없이 DB 상태만 공개로 바꾸고 외부 I/O 중 row lock을 유지할 여지가 있음 | 결정적 R2 copy 후 상태·version 조건부 DB transaction으로 흐름 수정 |
| E3-6 | High | Error | High | 단일 image storage key로는 숨김 후 public object 제거와 private 복구·재공개를 동시에 보장할 수 없음 | private 원본 key와 public 배포 key, 삭제 대기 상태와 outbox를 분리 |
| E3-4 | Medium | Error | High | `SCHEDULED -> DRAFT` 상태 전이는 있으나 예약 취소 endpoint가 없음 | 관리자 unschedule endpoint와 응답·멱등 계약 추가 |
| D3-1 | Medium | Design | High | 관리자 검색·편집 상세·image preview/폐기·command 응답이 구현 가능한 수준으로 닫히지 않음 | endpoint inventory와 request·response·오류·경쟁 조건 보완 |
| A3-1 | Medium | Ambiguity | High | migration·OpenAPI·M0 route가 없는데 data/API 문서가 구현 기준안으로 표시됨 | 설계 계약과 실행 준비를 분리하고 미구현 gate checklist 추가 |
| C3-3 | Medium | Contradiction | High | 루트 README가 이전·다음 탐색, 과거 단계와 운영량을 현행 정본처럼 중복 정의 | README를 안내·정본 링크·실행 상태 중심으로 재작성 |

총 11건이다. High 7건, Medium 4건이며 모두 직접 문서·코드에서 확인한 High confidence finding이다. 11건 모두 문서에 반영했다.

## 3. 핵심 수정 근거

### C3-1·C3-2 — 정본과 단계

- 문제 위치: `docs/planning/01-service-plan.md`의 기존 최소 data/API 계약, `02-infra-plan.md`의 기존 table·API 절, `03-screen-design.md`의 로그인 초기 구현, `docs/system-design/README.md`의 M0 범위
- 영향: 같은 요구사항을 두 군데서 다르게 수정하고 M0 구현자가 회원·광고까지 포함할 수 있었다.
- 처리: planning은 제품 요구사항과 단계만 남기고 system-design README에 책임·우선순위 표를 추가했다.

### E3-1 — image 선행 upload

- 문제 위치: `docs/system-design/03-api-design.md` image upload·draft create 순서, `02-data-model.md`의 기존 image `post_no NOT NULL`
- 영향: API 순서대로는 image row를 생성할 수 없고 동시에 같은 image를 두 draft가 선점할 수 있었다.
- 처리: upload 직후 `post_no=NULL`인 STAGED image row를 만들고 draft transaction이 조건부 선점한다. IMAGE block이 `image_no`와 사용 맥락의 `alt_text`를 소유하며 block과 image는 `(post_no, image_no)` 복합 FK로 소유권을 강제한다.

### E3-2·E3-3 — 조회 수와 멱등성

- 문제 위치: 공개 API의 `viewCount`, event model, publish·hide command의 `Idempotency-Key`
- 영향: 응답 근거가 없고 retry·동시 요청에서 조회 수 또는 상태 변경이 중복될 수 있었다.
- 처리: event dedupe·집계 완료 시각·post 누적 조회 수를 연결하고, idempotency 완료 결과를 domain transaction과 함께 저장한다.

### E3-5 — 예약 발행 image promote

- 문제 위치: `docs/system-design/01-system-architecture.md`의 기존 예약 발행 흐름과 image 발행 흐름
- 영향: 예약 시각에 DB만 `PUBLISHED`가 되면 공개 API가 staging key를 참조하거나, R2 작업 중 DB lock을 오래 잡을 수 있었다.
- 처리: R2 copy는 transaction 밖에서 결정적 key로 수행하고 `SCHEDULED`·`versionNo` 조건부 transaction 한 건만 public key·상태·이력·outbox를 commit한다.

### E3-6 — 숨김 image의 공개 제거와 복구

- 문제 위치: `docs/system-design/02-data-model.md`의 기존 단일 storage key, `01-system-architecture.md`의 숨김 흐름
- 영향: 공개 key를 private key로 바꾸면 원본 복구 근거가 사라지고, public key를 유지하면 숨김 이후에도 object가 공개될 수 있었다.
- 처리: private 원본 key를 유지하고 public key를 별도로 관리한다. 숨김 시 public 삭제 대기, 삭제 완료 후 private review, 재공개 시 private 원본 재승격 상태를 적용한다.

### D3-1·A3-1 — API 완결성과 상태 표시

- 문제 위치: 관리자 API 요약 절, data/API 문서 상단의 기존 `구현 기준안` 상태
- 영향: 구현자가 response, patch 의미, preview 보안과 edge case를 임의 결정하고 문서 존재를 구현 준비 완료로 오해할 수 있었다.
- 처리: endpoint와 payload·오류를 보완하고 두 문서 끝에 실행 준비 gate를 추가했다.

## 4. 변경 파일

| 파일 | 변경 |
| --- | --- |
| `README.md` | 중복 제품 사양 제거, 정본·실행 상태 안내로 재작성 |
| `docs/planning/01-service-plan.md` | M0/M1/M1.5 분리, schema·endpoint 사본 제거 |
| `docs/planning/02-infra-plan.md` | 공급자·비용·운영 형태 결정만 남기도록 재작성 |
| `docs/planning/03-screen-design.md` | 로그인·광고 단계와 검수 기준 분리 |
| `docs/planning/04-analytics-ad-plan.md` | M0 내부 조회와 후속 GA4·광고 분리 |
| `docs/planning/05-benchmark-spec.md` | M0 header와 M1 로그인 범위 분리 |
| `docs/system-design/README.md` | 문서 책임·우선순위·준비 상태 추가 |
| `docs/system-design/02-data-model.md` | image, 조회 집계, idempotency와 실행 gate 보완 |
| `docs/system-design/03-api-design.md` | endpoint inventory, 관리자 계약, 예약 취소와 실행 gate 보완 |
| `docs/system-design/01-system-architecture.md` | M0 제외 범위 문구 정정 |
| `docs/system-design/04-infrastructure-design.md` | private 원본·public 배포 image key 경계 반영 |
| `docs/system-design/05-security-operations.md` | storage provider 이전 시 key 분리 계약 반영 |

## 5. 현재 판정

- planning과 system-design의 책임 경계는 정리됐다.
- data-model과 api-design의 논리 계약 검토는 완료됐다.
- `V001`·`V002`, 정책 seed migration, M0 OpenAPI, Express route와 contract/integration test는 아직 없다.
- 따라서 데이터와 API는 설계 문서 기준으로는 다음 구현에 사용할 수 있지만 실행 준비 완료 상태는 아니다.

## 6. 다음 작업

1. data-model의 실행 준비 gate를 기준으로 PostgreSQL migration 작성
2. migration을 빈 PostgreSQL 18에서 검증
3. API 설계를 OpenAPI `3.1.x`로 옮기고 example validation 추가
4. 기존 회원 skeleton route와 M0 route의 제거·분리 범위 확정
5. OpenAPI contract test 후 공개·관리자 route 구현
