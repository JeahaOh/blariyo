# S08 — Core·Collector 격리 복원 검증

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-22 · GOV-23**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 복원 시험 유지 후보; task receipt/gate는 분리. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S08-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

Core/Collector 복원 시험을 독립적으로 남길 수 있게 분리하고, 실제 선택한 migration 조합에서 실행 결과를 확보한다.

#7/#8 Core restore 성공, #7/#8/#9 Collector restore skip, #9 Core restore skip. 과거 로컬 Collector 성공은 최신 후보/통합 성공이 아니다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`scripts/test-collector-restore.mjs`, API `schema-restore.integration.test.ts`, 관련 Collector fixture와 `scripts/harness/restore-scope.mjs`의 복원 분류 부분. package/workflow의 적용은 S10 담당. 기존 예약 backup/restore 운영은 보존 대상.

독립 시험 코드의 분리는 병행 가능. restore-scope 파일은 S09가 동시에 삭제/편집하지 않으며, 최종 실행은 S07 결과 뒤 수행.

## 수행 순서

1. Core/Collector 각 시험의 선행 환경·입력·생성 자원을 확인한다. Java 25·Docker·격리 PostgreSQL과 실제 운영 DB를 구분한다.
2. 분류기를 남길지, 관련 변경마다 독립 복원 시험을 실행할지 선택안을 정한다. task receipt/최종 gate 제거에 맞춰 필요한 export·명령을 S09/S10과 정한다.
3. 유지 실행 시 S07의 최종 SQL/checksum 후보를 사용한다. 격리 자원만 만들고 dump/restore 후 schema·행·sequence·migration 재실행 일관성을 확인한다.
4. 필수 시험이 skip됐거나 환경이 없으면 미검증으로 기록한다. 기존 예약 백업 workflow를 이번 governance 철회에 묶어 지우지 않는다.
5. 실행 중 만든 격리 자원만 정리하고 다른 세션의 Docker/DB 자원은 보존한다.

## 검증과 완료 조건

- Core 복원 시험 및 Collector dump/restore 비교를 실제 대상 SHA/patch에서 실행.
- 시험을 분류기로 제어한다면 필요한 변경의 누락/잘못된 skip 회귀 확인.
- 임시 자원 대상·실행 결과·정리 여부와 운영 DB 무변경 확인.

완료 조건:

- 선택된 복원 시험이 독립 실행되고 해당 SQL 조합의 결과가 기록됨.
- CI에 요구할 job/조건/명령을 S10에 전달. CI skip과 실제 복원 성공을 구분.

중단/보존 조건:

- 연결 대상이 격리 fixture임을 확인할 수 없거나 운영 DB를 가리키면 실행 중단.
- S07의 SQL/checksum 조합이 확정되지 않았다면 분석·추출까지만 진행하고 최종 복원 수용은 보류.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

실행 명령·환경·결과와 필요한 CI 조건, 보존할 기존 backup workflow를 S09/S10/S11에 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S08 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S08-database-restore.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S08-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-22 — Core DB 복원 분류와 동일 SHA 검증

- 분야/중요도: 데이터 복구 검증 / High.
- 근거: `scripts/harness/restore-scope.mjs`, `.github/workflows/ci.yml:329`·`:381`, API `schema-restore.integration.test.ts`.
- 진척: 변경 경로에 따라 Core restore 필요 여부를 분류하고 필수 복원이 skip되면 최종 gate가 실패한다. #7/#8 Core `schema-restore` job success.
- 미완료: 최종 develop 통합 SHA에 대한 누적 변경 범위 복원 수용은 없다. #9 문서 위주 범위의 restore skip은 #6 migration의 최종 복원 증거가 아니다.
- 유지/원복: 복원 시험 자체는 유지 우선 후보다. task 기반 receipt·최종 gate 결합은 분리 가능하다. 기존 예약 backup/restore workflow와 PR 필수 복원은 역할이 다르므로 기존 운영 백업까지 삭제하면 안 된다.

### GOV-23 — Collector 격리 dump/restore 검증

- 분야/중요도: Collector DB 복구 / High.
- 근거: `scripts/test-collector-restore.mjs`, `package.json`의 `test:collector:restore`, `.github/workflows/ci.yml:456`, 관련 Java fixture.
- 진척: 임의 이름의 격리 PostgreSQL container에서 schema·데이터·sequence dump/restore 비교와 migration 재실행 일관성을 검사하는 구현이 있다. 과거 worklog에 로컬 성공 기록이 있다.
- 미완료: 최신 #7/#8/#9의 Collector restore는 skip이다. 이번 목록 작성은 과거 로컬 증거의 실행 환경·전체 원문을 새로 수용하거나 최종 CI에서 실행한 것이 아니다.
- 유지/원복: 독립적인 복원 점검 도구로 남길 후보다. Java 25·Docker·DB fixture 전제를 함께 보존하고 운영 DB 대상으로 바꾸지 않는다. 다른 Collector 기능·기존 백업 운영을 함께 지우지 않는다.
