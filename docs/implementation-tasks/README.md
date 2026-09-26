# 구현 task 목록

2026-09-24 기준 [로드맵](../roadmap.md)과 현행 코드·검증 문서에서 확인된 미완료 구현/인수 항목 17개를 실행 단위로 분리한다. 각 task는 완료 증거가 남아야 닫을 수 있다. 이 문서는 계획이며 구현 완료를 뜻하지 않는다.

2026-09-26 실행 준비: [구현 task list](../../worklog/2026-09-26/m0-implementation-plan/IMPLEMENTATION-TASKS.md)와 [구현 goal 요청문](../../worklog/2026-09-26/m0-implementation-plan/IMPLEMENTATION-GOAL-PROMPT.md)에 아래 ID의 실행 순서·로컬 완료 조건·실제 운영 잔여를 연결했다. 작성만으로 구현을 시작하거나 이 목록의 상태를 완료로 바꾸지 않는다. 제품·기술 계약은 아래 정본 링크가 우선한다.

## 시작 순서

| 순서 | task 묶음 | task | 우선순위 | 선행 조건 |
| --- | --- | --- | --- | --- |
| 1 | [Core 화면 마감](core-ux.md) | UX-01~06 | P0 | 코드 변경 전 관련 planning/spec 확인; palette 결정이 필요한 UX-06은 색상 기준 확정 |
| 2 | [수집 통제](collection-controls.md) | COL-01~04 | P1 | COL-01~02는 direct 실행 통제; source별 실제 표본/활성화는 QD-06/07 |
| 3 | [운영 인수](operations-acceptance.md) | OPS-01~05 | P0/P1/P2 | 운영 환경 접근·테스트 대상은 읽기 전용 재조회 후 승인 범위 확정 |
| 4 | [계약·유지보수](contracts-maintenance.md) | CON-01~02 | P1 | legacy 경로 재활성화 결정; raw SQL/N+1은 해당 코드 수정 시 검증 |

P0는 Core 운영 개시 조건, P1은 수집 기능 활성화 전 조건, P2는 초기 운영 관찰 단계다. P0와 P1은 준비된 범위에서 병행할 수 있으나 수집은 보존·권한·요청 통제가 충족되기 전 활성화하지 않는다. 날짜나 공수는 근거가 없어 기입하지 않았다.

## 상태 정의

- **대기:** 착수 입력 또는 선행 조건 확인 전.
- **진행:** 구현/검증 중이며 완료 증거가 아직 모이지 않음.
- **차단:** 명시된 결정·환경 입력이 없어 해당 범위를 안전하게 진행할 수 없음.
- **완료:** task별 코드·테스트·운영 증거가 모두 연결됨.

현재 모든 task의 시작 상태는 **대기**이며, 차단 상태는 선행 결정이 실제로 확인된 뒤 표시한다. 과거 실행 결과는 현재 task의 새 SHA 검증을 대신하지 않는다.

## 완료 보고

완료 시 task ID, 변경 경로, 실행한 검사와 환경, 결과 링크를 이 문서 또는 해당 task에 기록하고 [요구사항 대조](../development-specs/requirements-status.md)·[로드맵](../roadmap.md)·[현재 상태](../status.md)를 함께 갱신한다. 운영 인수, 실제 외부 연동, 배포는 로컬 테스트와 별도 증거로 보고한다.


<a id="m0-design-handoff"></a>
## M0-D06 — 설계 보완 구현 인계 (2026-09-26)

D01~D05 기술 계약·출처 증거표를 아래 기존 ID에 연결한다. 상태는 **설계 문서 보완 / 구현·운영 인수 잔여**다. 기존 17개 task ID·요구사항 집계는 바꾸지 않는다. 문서 검증과 실제 source/test/운영 검증의 구분은 [실행 결과](../../worklog/2026-09-26/m0-design-completion/README.md)를 따른다.

| 결정 | 정본 절·개발 입력 | 기존 task·순서 | 필요한 구현/migration·호환성 | 검증 시나리오·완료 증거 |
| --- | --- | --- | --- | --- |
| D01 최초 검수/만료·영구 최소 키·삭제 소유권 | [데이터 §M0-D01](../system-design/02-data-model.md#m0-d01-retention), [수집 spec](../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md#m0-design-completion) | COL-04, OPS-03과 병행 설계·회수 활성은 backup 검증 이후 | 새 API/Collector migration: lifecycle/dedup/manifest, 최초 시각·post 최소 연결·제한 함수/trigger; API 만료 guard·retention worker. 적용 SQL/checksum 보존 | D01-T1~T7: 시각·경합·권한·부수 사본·부분 삭제·복원, DB/object 직접 readback |
| D02 API mailbox pull·runtime 읽기 | [아키텍처](../system-design/01-system-architecture.md#m0-d02-delivery), [API](../system-design/03-api-design.md#m0-d02-api), [DB](../system-design/02-data-model.md#m0-d02-input-model), 수집 spec/OpenAPI | CON-02의 P1-01 연결, D01 키/guard 후 구현; COL-01/02 요청 통제와 결합 | API mailbox+batch receipt/runtime+제한 함수, queue nullable/EXPIRED, BFF/controller·UI, 문서 OpenAPI→packages/contracts 동기화/생성 | D02-T1~T6, D04-T3/T5; queue 중복0·API 외부 fetch0·실제 config version 비교·브라우저 |
| D03 Drive 선택 백업·복원·전환 | [보안/운영 D03](../system-design/05-security-operations.md#m0-d03-drive), [인프라 인계](../system-design/04-infrastructure-design.md#m0-d01d04-인프라-인계--2026-09-26) | OPS-03, D01 모델 적용 뒤 R2 profile 검증→Drive 병행→전환 | backup runner/전송/manifest/만료 timer·독립 복원·Discord; 영구/임시 DB 데이터 분리. 현행 R2 source 교체는 후속 | D03-T1~T6·D01-T7, exact backup ID/hash·격리 DB 결과·실수신·복귀 receipt |
| D04 OWNER/EDITOR·서비스 역할 | [보안/운영 D04](../system-design/05-security-operations.md#m0-d04-roles), [관리자 spec](../development-specs/m0-core/admin-post-management/admin-post-management.dev.md#m0-d04-역할-인계--2026-09-26) | OPS-01/02/04, 구현은 기존 auth adapter/Core guard 범위 | registry role·내부 role header·operation allowlist·회수, 서비스별 DB/R2/Drive ACL. UI 추가 없음 | D04-T1~T6: 허용·직접 접근 거부·위조/회수·secret 미노출; 실제 두 계정 증거 |
| D05 검증된 출처만 편입 | [S1~S5](../planning/content-collection/source-collection-policy.md#m0-admission), [21개 증거표](../planning/content-collection/reference-site-validation.md#m0-evidence-20260926) | COL-01/02→COL-03, COL-04/OPS-04 뒤 활성 | 현재 local17 성공과4 차단/미검증을 유지, 실제 source/config hash를 조회한 뒤 선택 출처별 수용 | S1~S5 receipt, 시각/환경/SHA/원문 순서·byte readback·오류/운영 인수; 미충족은 후보 |
| D06 문서/실행 계약·상태 인계 | 이 표·[readiness](../system-design/design-readiness.md)·[requirements](../development-specs/requirements-status.md) | CON-01 legacy는 비활성 유지, CON-02/각 task에서 구현 후 상태 갱신 | 이번 docs OpenAPI planned 경로는 실행 source에 없음. 구현 시 copies 비교·타입 생성·API/DB/BFF 회귀를 같은 변경에서 수행 | 링크/anchor·OpenAPI 형식·diff는 이번 문서 증거; test/build/runtime은 해당 구현 SHA로 새 실행 |

### 실행 순서와 되돌리기

1. **병행 가능:** UX-01~06의 독립 Core 화면 작업·OPS-01 운영자 사용성. 청록 #00A19B 유지, 이 설계 전체를 선행 gate로 삼지 않는다.
2. **저장 모델/권한:** COL-04의 추가 migration을 additive로 설치하고 backfill 수량·시각·키 충돌 dry-run, D04 guard 지원을 준비한다. collector/API 기존 버전의 읽기 호환과 readiness를 검사하고 destructive purge는 아직 켜지 않는다. 실제 다음 migration 번호는 착수 시 ledger로 배정한다.
3. **백업 선행:** OPS-03에서 새 모델의 선택 dump를 R2에 검증하고 기존7일 full snapshot의 검증된 대체를 완료한다. 이후 COL-04 회수 guard/worker 제한 인수. 삭제를 되돌리려고 raw 백업을 보관하지 않는다.
4. **전달/요청 통제:** CON-02/P1-01의 mailbox·runtime UI와 COL-01/02를 구현한다. dry-run·격리 통합·browser·권한 시험 후 실제 장비/R2/DB·Discord를 OPS-04로 인수한다.
5. **Drive 전환:** 계정 조건·독립 복원·알림·만료·복귀 시험 후 사용자만 전환한다. old R2는 원래 기한, Drive 장애 복귀도 선택 dump profile 유지.
6. **출처 선택:** COL-03에서 증거가 갖춰진 출처만 M0 적용 목록에 기록한다. COL-REANALYZE-01 대기·PGR21 미편입 유지. 실제 운영7일은 OPS-05이며 문서 작업으로 채우지 않는다.

되돌리기는 feature flag OFF·미수락 TTL 종료·기존 검수/Core 유지, source/schema forward fix가 기본이다. additive 설치 후 과거 앱 write가 새 invariant를 깨면 read-only만 허용하고 이전 worker로 삭제를 수행하지 않는다. 파기된 원문 재생성·영구 중복 키 제거·raw 포함 full dump 복귀는 되돌리기 방법이 아니다. 원격 적용·stage/commit/push/merge는 이번 문서 goal에서 수행하지 않는다.
