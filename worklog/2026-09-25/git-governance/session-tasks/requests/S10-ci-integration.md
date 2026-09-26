# S10 — CI·공유 패키지 설정·최종 조합 검증

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-19 · GOV-20 · GOV-21 · GOV-25 · GOV-26**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 일반 앱/품질 CI 유지, task 강제 연결은 선택에 따라 제거. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S10-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

다른 세션이 선택한 변경을 하나의 일관된 후보로 연결하고, CI/package 공유 파일을 한 곳에서 편집·검증한다.

각 S02~S09 결과의 기준 SHA·diff hash·검증·선택. #7/#8 branch 방향 실패와 range scan skip, #9 lint 실패, images의 harness-gate 의존을 기존 근거로 사용한다. 과거 성공을 새 통합 조합에 승계하지 않는다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`.github/workflows/ci.yml`, `.github/workflows/backup-restore.yml`, 루트/영향받는 workspace `package.json`·npm lock, `scripts/harness/ci-context.mjs`·`job-receipt.mjs`, 관련 CI/context/receipt 회귀. S04가 정한 native/quality config와 S08의 기존 backup 보존 경계를 존중한다.

소스 분야 작업 중 읽기 설계 가능. workflow/package/lock의 실제 편집은 이 세션만 수행. S11 문서 반영 이후 문서 영향 검사만 마무리하며 전체 테스트를 무조건 반복하지 않음.

## 수행 순서

1. 입력 결과별 실제 SHA/diff와 공유 파일 변경 요구를 모은다. 선택하지 않은 분야나 미검증을 포함한 채 전체 완료로 처리하지 않는다. 기존 worktree를 덮어쓰지 않는 통합 후보에서 작업한다.
2. 유지한 npm 명령·dependency·lock을 함께 반영하고 API build→typed lint/test 순서를 보존한다. Windows Python·날짜 fixture 수정은 남기는 기능에 필요한 범위만 유지한다. 고정 만료일 fixture로 되돌리지 않는다.
3. job needs·if·receipt·artifact·images 의존을 함께 수정한다. harness-gate만 지우지 않고 images가 어떤 검증 뒤 실행되는지 확인한다. 기존 앱·collector 검증과 예약 백업 역할을 보존한다.
4. task receipt를 철회하면 오래된 evidence는 archive로 보관하고 일반 SHA/run·실패 로그만 필요한 만큼 남긴다. 유지한다면 실제 artifact 내용/hash/실행 식별을 읽어 수용해야 하며 업로드 성공만으로 완료 처리하지 않는다.
5. S09 삭제 후보는 소비자 정리와 같은 후보에 반영한다. 각 세션의 script/export 계약과 S04 lint scope, S05 architecture, S07 SQL, S08 restore가 함께 동작하는지 확인한다.
6. 원격 보호는 현재 존재 여부를 읽기 전용으로 확인한다. 도입 철회라면 미구현 required-check/검사기 보호를 새로 완성하지 않는다. 원격 설정 변경·CI 실행·push가 명시된 작업이면 그 범위만 수행하고, 없으면 후보/로컬 결과와 원격 미실행을 구분한다.

## 검증과 완료 조건

- workflow 문법/actionlint와 수정한 CI 회귀, package script 존재·lock 정합성·남은 import/needs 참조.
- 최종 후보의 선택된 lint·architecture·관련 앱/browser/collector·SQL·복원 검사. 이미 같은 입력으로 검증한 무관 항목을 이유 없이 반복하지 않음.
- CI 실행이 요청된 경우에만 해당 run의 head/base/subject·attempt·job/step·URL을 확인. 실행 중이면 상태를 기록하고 다른 세션/후속 인계로 넘김; 자동 재실행하지 않음.
- 보호 적용을 선택한 경우에만 실제 권한/필수 검사와 거부 수용을 별도 작업으로 다룸. job 성공과 서버 강제를 구분.

완료 조건:

- 선택한 후보의 공유 설정·소비자·소스가 연결되고 필요한 로컬 검증 결과가 있음.
- 원격 CI/통합/보호 적용은 실제 수행한 범위에서만 별도 완료. 외부 실행 권한이 없으면 코드 후보 완료와 원격 미실행으로 종료 가능.
- S11의 문서 반영 후 문서 포함 최종 lint 결과도 같은 최종 조합에 연결.

중단/보존 조건:

- 입력 SHA/diff 불일치, 공유 파일 동시 변경, 필요한 검사 실패가 있으면 통합 완료로 승격하지 않음.
- missing receipt나 skip된 실제 이력 검사를 과거 helper 통과로 대신하지 않음. 철회한 기능의 수용 검사를 새 차단 조건으로 강제하지 않음.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

최종 후보 SHA/patch hash, 적용 분야·미반영 사유, 검증 결과·CI URL·보호 상태를 S11과 S01-B에 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S10 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S10-ci-integration.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S10-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-19 — CI quality·최종 harness gate·이미지 의존

- 분야/중요도: CI 파이프라인 / High.
- 근거: `.github/workflows/ci.yml:22`·`:515`·`:642`, `tests/harness/ci-workflow.test.mjs`.
- 진척: event-context → quality/Windows/app/collector/복원 분류 → 최종 harness-gate → images의 연결이 구현됐다. 개별 job 다수는 실제 실행 성공했다.
- 미완료: #7~#9 최종 gate는 failure, develop 통합 미완료. images는 현재 PR에서 skip이며 배포 성공 증거가 아니다.
- 유지/원복: lint·architecture·기존 앱 CI는 남길 수 있다. task·방향 gate만 빼려면 job needs, 조건, receipt 작성 단계, image 선행 의존을 함께 수정해야 한다. **harness-gate job만 삭제하면 images 연결이 깨진다.** 기존 앱 검증까지 없애면 안 된다.

### GOV-20 — CI event context·task binding·receipt

- 분야/중요도: 검증 증거 / Medium.
- 근거: `scripts/harness/ci-context.mjs`, `job-receipt.mjs`, 관련 회귀와 workflow artifact 단계.
- 진척: PR/push/manual의 base·head·실제 검사 SHA, run/attempt, Task/Change ID와 hash를 연결한다. #7~#9 event-context success; receipt 생성·업로드 단계도 실행됐다.
- 미완료: 모든 원격 artifact JSON 내용과 실제 Git/job의 hash·identity를 내려받아 수용한 근거는 없다. 업로드 success는 내용 readback 완료가 아니다.
- 유지/원복: 단순 SHA·run 기록은 유용하지만 현재 구현은 GOV-02에 강하게 연결된다. task 시스템을 철회하면서 receipt 단계만 그대로 남길 수 없다. 과거 증거는 보관하고 새 구조에서는 필요한 최소 필드만 재선택한다.

### GOV-21 — CI 환경·순서·날짜 fixture 수정

- 분야/중요도: 실행 안정성 / Medium.
- 근거: `.github/workflows/ci.yml:79`, Windows Python 설정, `tests/harness/release.test.mjs`. H7에는 API/test build 선행·Python `3.13.15`·상대 날짜 fixture가 포함돼 있다.
- 진척: API build 뒤 lint, Windows lease 실행, 실행 시각 기반 날짜 fixture의 관련 step이 실제 통과했다. stale/future 거부 시나리오는 유지한다.
- 미완료: 이 수정이 포함됐다고 branch 방향·전체 CI·원격 artifact 수용까지 성공한 것은 아니다. #9는 #7과 중복된 선반영 때문에 현재 코드 차분보다 문서 차분 중심이다.
- 유지/원복: 유지하는 검사에는 환경 수정도 남긴다. 제거하는 release/Windows lease 검사의 보조 수정만 별도로 억지로 남길 필요는 없다. 고정 날짜로 되돌려 시간이 지나면 실패하도록 만들지 않는다.

### GOV-25 — 실패한 CI의 진단 자료 보존

- 분야/중요도: CI 관측 / Low.
- 근거: PR #8, `.github/workflows/ci.yml:581`, `tests/harness/ci-workflow.test.mjs:110`.
- 진척: event context가 없거나 잘못돼도 실패 원인 JSON을 남기고 `verificationEvidence=false`로 유효 검증 증거와 구분한다. 분류 누락은 null로 남기며 관련 harness 회귀 step 성공.
- 미완료: 해당 실제 진단 artifact의 전체 내용·hash readback은 별도다. 진단 생성이 최종 gate 성공을 뜻하지 않는다.
- 유지/원복: 실패 로그·진단 보존 아이디어는 유지할 가치가 있다. 현재 context/receipt schema에 묶인 부분은 GOV-19·20 제거 시 재구성한다.

### GOV-26 — 원격 보호·required check·검사기 보호

- 분야/중요도: GitHub 운영 강제 / High.
- 근거: 원격 branches/rulesets API 관측은 JSON `remote`. 설계는 trusted workflow 또는 code-owner 보호와 실제 거부 시험을 요구한다.
- 진척: 보호 정책의 설계와 현재 metadata 조회는 있다. 조회 당시 main/develop `protected=false`, rulesets 빈 목록.
- 미완료: 필수 검사 등록·검사기 자체 보호·direct push/실패 PR 병합 거부의 실제 운영 수용은 완료되지 않았다. 일반 job을 실행하는 것과 서버에서 병합을 강제로 막는 것은 다르다.
- 유지/원복: 현재 도입을 철회한다면 새 보호 체계를 완성할 필요가 없다. 이미 설치된 것으로 추정해 무작정 원격 설정을 지우지 않는다. 단순한 보호를 나중에 선택하더라도 현재 거대한 task gate를 전제로 할 필요는 없다.
