# S05 — 아키텍처 의존·계층·순환 검사

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-16**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 기존 검사 보존, 추가 보강 분리 유지 우선. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S05-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

API/Web/Collector 구조 검사를 governance 도입과 분리해 보존할 범위를 확정하고 검증한다.

PR #6→#7 두 시험 파일의 +331/-24 보강. #7/#8/#9 architecture step 성공은 당시 후보의 증거다. 기존부터 있던 구조 검사는 철회 대상과 구분한다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`tests/architecture.test.ts`, `apps/api/test/architecture.service.test.ts`, 기술 계약 `docs/system-design/08-code-structure.md`. `test:architecture` package script와 Collector build 설정 변경 요구는 S10/S04에 전달한다.

S04와 별도 시험 파일에서 병행 가능. S06은 두 구조 시험 파일을 일괄 포맷/원복하지 않는다. 설계 문서 반영은 S11에 인계.

## 수행 순서

1. 원래 검사와 추가 보강 diff를 비교하고 API 계층·feature/persistence, Web/contracts, 앱 간 참조, Collector 모듈/사이트 격리, 순환·alias·runtime import별 유지 범위를 정한다.
2. 현행 아키텍처 계약과 실제 source를 대조한다. 제품 구조 자체를 임의로 재설계하거나 이 task를 전체 아키텍처 감사로 확대하지 않는다.
3. 유지 실행 지시가 있으면 선택한 보강을 독립 후보에 적용한다. API build/test build 선행을 보존하며, task/branch 정책을 실행 전제로 만들지 않는다.
4. 현재 fixture/회귀가 정상 의존과 잘못된 의존을 구분하는지 확인하고, 동적 import/reflection의 검사 한계를 기록한다.

## 검증과 완료 조건

- 실제 package script 확인 후 `npm run test:architecture` 또는 분리 후 동등한 명령 실행.
- 기존 검사 누락 여부, 선택한 계층/순환 거부 회귀, build 선행 보존 확인.

완료 조건:

- 기존 구조 검사가 보존되고 선택된 보강의 실제 실행 결과가 기록됨.
- 남은 수동 검토 한계와 package/build 요구를 인계. 전체 제품 아키텍처 수용으로 확대하지 않음.

중단/보존 조건:

- 현행 설계와 검사 규칙이 모순되면 규칙을 임의 완화하지 않고 해당 항목의 사실·영향·선택안을 기록.
- 기존 제품 구조 수정까지 필요하면 이 범위를 넘어 자동 진행하지 않음.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

선택한 두 시험 파일의 diff, 대상 SHA·검사 결과, S04/S10의 build/package 반영 요구를 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S05 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S05-architecture.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S05-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-16 — 아키텍처 의존·계층·순환 검사

- 분야/중요도: 구조 품질 / Medium.
- 근거: `tests/architecture.test.ts`, `apps/api/test/architecture.service.test.ts`, `docs/system-design/08-code-structure.md`.
- 진척: 기존 architecture 검사를 강화했다. H6→H7에서 두 시험 파일에 331 insertions/24 deletions. API 계층·feature/persistence, Web/contracts와 앱 간 source 참조, Collector 모듈·사이트 격리, 순환·alias·runtime import를 검사한다. #7/#8/#9 architecture step 성공.
- 한계: 계산된 동적 import·reflection 등 모든 실행 의존을 자동 증명하지 않는다. 일부 판단은 수동 검토가 남는다.
- 유지/원복: **유지 우선 후보**다. 기존부터 있던 architecture 검사까지 통째로 삭제하지 말고 추가 보강 diff를 선택한다. `test:architecture`의 API/test build 선행을 보존해야 한다.
