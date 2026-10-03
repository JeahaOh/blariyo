# S09 — 하네스·브랜치 정책·릴리스 절차 정리

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-01 · GOV-02 · GOV-03 · GOV-04 · GOV-05 · GOV-06 · GOV-24**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 현재 강제 체계 도입 보류/철회 후보; 필요한 명령만 분리. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S09-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

task/Change-Id·Gitflow·lease·verify·release 강제 체계 중 선택된 부분을 정리하고, 다른 분야가 유지할 검사와 도구를 남긴다.

`.harness` 등록 후보, CLI/lease/verify/release 구현과 관련 회귀. 정상 정책 등록 전용 gate, 다중 host, immutable 검증 snapshot, 실제 release 운영은 미완료다. 철회 선택 시 이를 새로 완성하지 않는다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`.harness/*`, `scripts/harness`와 `tests/harness` 중 이 세션 담당 부분: branches/git/cli, leases/lease_lock, verify/run-tests/tap, release/merge-back 등. hooks/check/secrets는 S03, restore-scope는 S08, ci-context/job-receipt/CI 회귀는 S10이 소비 요구를 먼저 정한다.

읽기 분석과 독립 파일 후보 준비 가능. S03/S08과 공용 파일 수정은 순서를 정하고, 실제 최종 삭제는 S10의 소비자 정리와 함께 반영.

## 수행 순서

1. 7개 issue에 대해 유지/축소/철회 선택을 한 묶음으로 기록하고 예외만 나눈다. 새 세션 문서 ID S01~S11은 기존 harness task 등록/UUID를 요구하지 않는다.
2. 모든 import·CLI 진입점·npm script·hook·CI 소비자를 읽어 제거/유지 목록을 만든다. S03 연결 복원, S04 lint scope 분리, S08 복원 분류 인계를 선행 조건으로 반영한다.
3. 유지할 doctor 등의 명령은 필요한 입력·출력만 남기는 후보를 만든다. task 시스템을 철회하면서 정상 task 등록 gate를 새로 개발하지 않는다. 기존 commit에 trailer를 넣으려고 rebase/amend하지 않는다.
4. 사용 중인 lease/프로세스가 있으면 파일 유무만 보고 강제 종료하지 않는다. verify의 잠금/import와 evidence 사용처를 함께 점검한다.
5. 삭제 후보는 먼저 patch로 준비한다. S10이 최종 CI/package에서 소비자를 제거한 후 같은 통합 조합에 반영한다. 호출 대상부터 공유 작업본에서 지우지 않는다. 활성 문서 변경 요구는 S11에 전달한다.

## 검증과 완료 조건

- 유지한 명령·검사에 필요한 기존 회귀. 제거한 기능의 synthetic 시험을 유지하기 위해 빈 구현을 만들지 않음.
- 최종 조합에서 폐기 대상 import/script/CLI/hook/CI 참조가 남지 않음. 최종 연결 확인은 S10과 결과 SHA를 맞춤.
- 기존 SHA·사용자 작업·공통 quality 도구 보존. release validator 성공을 실제 배포 증거로 쓰지 않음.

완료 조건:

- issue별 선택과 소비자별 제거/보존 patch가 준비되고 필요한 단위 검증이 끝남.
- S09 후보 완료와 S10 최종 반영 완료를 따로 기록. 강제 체계 철회를 governance 운영 도입 완료로 보고하지 않음.

중단/보존 조건:

- 설정이 여전히 호출하거나 다른 분야가 유지하는 script를 삭제해야 하는 상황이면 해당 삭제 보류.
- 사용자 선택 없이 새 Gitflow·정책 예외·task 등록 운영을 추가하지 않음.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

유지/삭제 파일·export 목록과 patch, 소비자 인계 상태, 잔여 운영 미도입 항목을 S10/S11에 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S09 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S09-harness-policy-release.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S09-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-01 — Gitflow 브랜치 역할·이름·PR 방향

- 분야/중요도: Git 정책 / Medium. `main`, `develop`, `feature/<task-id>-<slug>`, `release/<version>`, `hotfix/<task-id>-<slug>`의 방향을 강제한다.
- 근거: `.harness/policy.json`, `scripts/harness/branches.mjs`, `tests/harness/branches.test.mjs`, `docs/ai/git-workflow.md`. local/remote develop·release가 존재한다.
- 진척: 정책과 검사 코드·회귀가 있고 #7/#8의 harness 회귀 step은 통과했다. 실제 PR #7~#9의 base는 feature branch다. #7/#8은 PR 방향 단계에서 실패했고 #9는 그 전에 lint 실패로 방향 검사를 실행하지 않았다.
- 미완료: 실제 feature→develop 통합, release/version 규약, hotfix 운영 수용. 단일 `release` 이름도 설계의 `release/<version>`와 다르다.
- 유지/원복: 검사만 남겨 현재 branch 구성을 강제하면 계속 충돌한다. 브랜치 전략 자체를 먼저 선택하고 GOV-02·09·11·19·24의 결합을 함께 조정한다. develop/release 삭제는 코드 원복과 별도 조치다.

### GOV-02 — Task manifest·Change-Id·경로 제한

- 분야/중요도: 하네스 정책 / High. task마다 허용 경로·검증 명령·Change-Id를 등록하고 변경을 연결한다.
- 근거: `.harness/policy.json`, `.harness/tasks/HARN-06.json`부터 `HARN-09.json`, `scripts/harness/check.mjs:41`, `scripts/harness/ci-context.mjs`. HARN-08 허용 경로는 450개로 복구 작업용 범위다.
- 진척: 활성 task, 허용 경로, UUID, trusted base의 manifest, policy 자기변경 차단이 구현돼 회귀 step이 성공했다. 등록안은 PR #1/#5와 후보 branch에 있다.
- 미완료: develop 기준 정책 등록, 도입 이후 변경 절차, schema 검증 보강. 계획의 HARN-01~05 번호를 실제 등록 manifest 존재로 해석하면 안 된다.
- 유지/원복: `.harness`만 삭제하면 hook·verify·CI context·release checker가 깨진다. GOV-03·06·08·09·19·20·24와 묶어 해제하거나 전체 연결을 재설계한다. 일반 lint·architecture 자체에는 Task-Id가 필수는 아니다.

### GOV-03 — 정책·task 등록 전용 gate 부재

- 분야/중요도: 하네스 운영 / High.
- 근거: `scripts/harness/check.mjs:41`의 policy/task 변경 차단, `docs/ai/harness-implementation-plan.md`의 등록 전용 governance gate 미구현 기록.
- 진척: 구현 PR이 스스로 허용 범위를 넓히는 것을 막는 검사는 있다.
- 미완료: 정책을 정당하게 신규 등록·수정하는 전용 검사 경로는 구현되지 않았다. 일반 gate로 등록을 막는 기능과 정상 등록 절차는 서로 다르다.
- 유지/원복: 현재 강제를 유지하면 새 task 등록도 운영 절차를 추가로 완성해야 한다. 경로 예외를 임의 확대해 통과시키는 방식은 해결이 아니다. 강제 manifest 운영을 철회하면 이 신규 기능은 만들 필요가 없다.

### GOV-04 — CLI·doctor·worktree 생성

- 분야/중요도: 개발 도구 / Medium.
- 근거: `scripts/harness/cli.mjs`, `branches.mjs`, `git.mjs`, `tests/harness/branches.test.mjs`.
- 진척: doctor, start, start-hotfix, PR 방향·범위 검사 등의 진입점이 있다. start는 local develop과 origin/develop 불일치 및 task 누락을 차단하고 별도 worktree를 만든다. 관련 회귀 step이 성공했다.
- 미완료: 현재 기본 checkout의 local develop/origin tracking ref는 원격 develop보다 오래됐다. CLI 도입 자체가 모든 기존 작업본·hook을 정상화하지 않는다.
- 유지/원복: 읽기 전용 진단은 분리 유지 후보다. start는 GOV-01·02·07과 결합돼 있으므로 기존 Git 명령을 감싸는 부분만 남길지 선택해야 한다. 기존 worktree 삭제와 CLI 파일 삭제를 같은 것으로 취급하지 않는다.

### GOV-05 — 자원 잠금·lease·resume

- 분야/중요도: 동시 작업 제어 / Medium. lease는 작업이나 자원을 한 프로세스가 점유하도록 하는 잠금이다.
- 근거: `scripts/harness/leases.mjs`, `lease_lock.py`, `verify.mjs`, `tests/harness/leases.test.mjs`.
- 진척: 단일 host의 OS advisory lock, task/resource 충돌 검사, 프로세스 종료 후 잠금 해제, 읽기 전용 resume이 구현됐다. #7/#8/#9 `windows-leases` job이 실제 성공했다.
- 미완료: 작성 세션 자동 heartbeat, 다중 host 조정, 전체 Windows lint·GUI Git 지원. 오래된 문서의 “Windows 실행 미검증”은 현재 부분 성공과 구분해야 한다.
- 유지/원복: 자동 작업 관리 체계를 유지하지 않으면 우선 보관 후보다. 제거 시 verify의 잠금 import·호출도 바꾸고, 실제 살아 있는 잠금 보유 프로세스가 있는지는 실행 시 다시 확인한다. 잠금 파일 존재만으로 프로세스를 강제 종료하지 않는다.

### GOV-06 — verify·ready·handoff 검증 runner

- 분야/중요도: 검증 자동화 / Medium.
- 근거: `scripts/harness/verify.mjs:8`, `run-tests.mjs`, `tap.mjs`, `tests/harness/verify.test.mjs`.
- 진척: 고정 명령 5종(`test:harness`, `test:quality`, `lint:harness`, `lint:all`, `test:architecture`)만 실행한다. SHA·입력·정책·task hash를 기록하며 0개/skip된 시험을 거부하고 ready/handoff를 구분한다. 회귀 step 성공.
- 미완료: immutable snapshot에 고정한 실행, 실제 전체 제품 검증·승인 자동 판정은 지원하지 않는다. API·browser·collector 전체를 이 5종이 대신하지 않는다.
- 유지/원복: 단순 npm 검사 명령은 남길 수 있다. 상태 관리 wrapper를 없애면 GOV-02·05·20에 대한 의존과 `.git` evidence 파일 사용처도 함께 정리한다.

### GOV-24 — release freeze·배포 증거·merge-back

- 분야/중요도: 릴리스 운영 / Medium.
- 근거: `scripts/harness/release.mjs:46`·`:139`, `merge-back.mjs`, release/merge-back 회귀.
- 진척: 후보 SHA·Change-Id·이미지 digest·DB 호환·백업 시간·복귀 증거의 일관성을 검사하고, release/hotfix가 필요한 branch에 반영됐는지 조상 관계를 검사한다. synthetic 회귀는 harness step에 포함된다.
- 미완료: provider API나 artifact bytes를 직접 가져와 검증하는 기능은 없다. 실제 release/hotfix·배포·merge-back 운영 수용, 제품 version/tag 규약도 미완료다. remote-tracking ref 검사는 live remote 상태를 대신하지 않는다.
- 유지/원복: 지금은 archive·도입 보류 후보다. manifest나 fixture 통과를 운영 배포 증거로 남기지 않는다. GOV-01·02·20과 함께 분리한다.
