# S01 — Git 자산 백업과 최종 정리

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-28**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 원문 백업부터 진행; 삭제·PR 종료는 최종 단계. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S01-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

기존 SHA와 미커밋 원문을 복원 가능하게 보관하고, 최종 유지 대상이 확보된 뒤 불필요한 Git 자산만 정리한다. 이 세션은 A(백업)와 B(최종 정리) 두 번에 나눠 진행한다.

전체 6개 worktree, local HARN 10개·remote HARN 9개, open PR 8개, 보조 ref `fixprep/harness`, stash `c373dac4ad6584e663ad958d1c9d64767dc48605`. 수량은 조사 시점 기준이므로 실행 직전 증감을 대조한다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

Git refs·PR metadata·worktree 상태, 미커밋/미추적 원문, 각 gitdir의 hook wrapper·설치 metadata·설정·작업 기록. 기본 작업본 51개 미추적 파일과 stash-recovery 수정 8개/미추적 2개를 빠뜨리지 않는다. m0-core의 20개 수정/68개 미추적은 다른 작업의 보존 경계이며 정리 대상이 아니다.

A의 읽기 조사·백업은 다른 읽기 검토와 병행 가능. B는 해당 worktree를 사용하는 세션이 종료된 뒤 단독 실행. hook 설정 편집은 S03 담당이며 이 세션은 원본 보관만 수행.

## 수행 순서

1. A: 모든 worktree의 HEAD·status, refs·stash 부모, PR base/head·상태를 읽어 기존 inventory와 달라진 부분을 기록한다. 다른 세션이 쓰는 worktree는 정리 대상에서 제외한다.
2. A: 유지·철회 선택 전이라도 기존 SHA를 담은 Git bundle, 미커밋/미추적 원문, hook/설정 원본을 보관한다. bundle에는 필요한 ref와 stash commit이 실제 포함됐는지 확인한다. archive 위치는 이 worklog 아래 별도 실행일 폴더를 사용하며 기존 snapshot을 덮어쓰지 않는다.
3. A: `git bundle verify`에 더해 임시 격리 저장소에서 필요한 commit/blob을 읽고, 미커밋 원문 파일의 hash를 원본과 대조한다. GOV-32의 원문/변형본 보존을 S02에 인계한다. 비밀·환경 값은 추적 문서에 복사하지 않고 민감한 원본의 보관 위치만 기록한다.
4. A 완료 후 중단한다. 선택된 S02~S11 작업의 결과가 갖춰지기 전에는 B를 시작하지 않는다.
5. B: 남길 코드·문서가 실제 보존된 위치와 SHA/patch hash, S03의 hook 연결 복원 결과, S10의 최종 조합, S11의 활성 문서 상태를 확인한다. PR별 중복/보존 이유, branch별 고유 commit, worktree별 dirty 상태를 다시 대조한다.
6. B: 사용자 지시로 정해진 정리 대상만 PR 종료·원격 branch·로컬 branch·worktree·stash·보조 ref별로 따로 처리한다. 미선택 대상은 보존하고 결과에 이유를 남긴다. 삭제할 필요가 없는 main/develop/release와 제품 commit을 일괄 reset하지 않는다.

## 검증과 완료 조건

- A: archive 목록과 원문 hash 일치, bundle 검증과 격리 readback 성공, 기존 refs·stash·worktree·설정 불변.
- B: 실제 처리 항목이 정리 목록과 일치하고 보존 대상이 남아 있음. 제거된 worktree를 가리키는 hook 연결과 사라진 유일한 제품 commit이 없음.

완료 조건:

- A 완료: 목록이 아니라 복원 가능한 원본과 readback 근거가 준비되어 다른 세션이 사용할 수 있음.
- B 완료: 선택된 정리 범위가 처리되고, 보류 대상과 보존 위치가 각각 기록됨. 원격 권한이 없으면 로컬 완료와 원격 미완료를 나눔.

중단/보존 조건:

- 필요한 commit/blob 또는 미커밋 원문을 archive에서 읽을 수 없으면 해당 자산 삭제 중단.
- 다른 세션의 새 변경, 고유 제품 commit, 설치 전 hook 설정을 확인할 수 없는 경우 해당 자산은 보존.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

S01-A 결과에 archive 경로·SHA256·복원 명령과 readback 결과를 남긴다. S01-B는 모든 관련 선택 결과를 받은 뒤 같은 결과 문서에 별도 단계로 기록한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S01 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S01-git-assets.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S01-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-28 — PR·branch·worktree·stash·보조 ref 보존/정리

- 분야/중요도: Git 자산 / High.
- 근거: JSON의 `refs`, `worktrees`, `localHarnBranches`, `stash`, `auxiliaryGovernanceRefs`, `remote.prs`. 정확한 경로·SHA·상태·hash·PR base/head를 기록했다.
- 진척: 정책·cleanup·harness·진단을 별도 PR로 나눠 전달했다. 로컬 HARN 10개·원격 HARN 9개, open PR 8개, 관련 보조 worktree 4개, stash 1개가 남는다. `fixprep/harness` ref도 추가 확인했다.
- 미완료: 이번 inventory는 복구용 원본 백업이 아니다. stash와 dirty recovery의 원문, 각 관련 ref를 담은 검증 가능한 Git bundle, hook 설정 원본을 보관하고 readback해야 실제 삭제를 안전하게 수행할 수 있다.
- 유지/원복: 유지 선택 → 원문/bundle 보관·검증 → hook 연결 복원 → 관련 PR 종료·branch/worktree 정리 순서가 필요하다. 원격 PR 종료, 원격 branch 삭제, 로컬 branch 삭제, worktree 제거는 서로 다른 작업이다. m0-core의 기존 dirty 작업, 다른 기능 branch·배포 상태를 보존한다. 이번에 어떤 항목도 삭제하거나 종료하지 않았다.
