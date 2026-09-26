# Git 브랜치와 병합 절차

- 상태: 2026-09-26 사용자 확정. GitHub 보호 설정·hook·추가 CI는 적용 전이다.
- 공통 권한·worktree·기록 기준은 [AGENTS.md](../../AGENTS.md), 검사 계약은 [harness](harness.md)를 따른다.
- 이 문서는 최신 사용자 결정인 `feature → release → main`을 구체화한다. 과거 worklog의 반대 순서를 현행 규칙으로 사용하지 않는다.

## 브랜치 역할

| 브랜치 | 역할 | 출발 기준과 반영 대상 |
| --- | --- | --- |
| `feature/<주제영역>` | 일반 변경 작성·검증 | 확인한 release 커밋에서 시작해 release에 병합 |
| `release` | 기능 통합·배포 전 검증 | feature를 통합하고 main 대상 PR 준비 |
| `main` | 운영 반영 기준 | release 또는 hotfix PR을 GitHub 웹 GUI에서 병합 |
| `hotfix-<주제영역>` | 운영 긴급 수정 | 확인한 main 커밋에서 시작해 main에 먼저 반영 |

main HEAD가 실제 운영 버전이라는 뜻은 아니다. 실제 배포 여부는 SHA·이미지 digest·설정·배포 결과로 확인한다.
긴급 수정 전 main과 실제 운영 버전이 다르면 영향을 확인하고 기준선을 정한다. 미배포 변경을 긴급 수정에 묵시적으로 포함하지 않는다.

## 일반 작업과 병합

1. 작성 담당, 기존 변경, release 기준 SHA를 확인하고 feature에서 작업한다. 일반 작업에는 worktree를 만들지 않는다.
2. 요청 범위의 변경·검증·작업 기록을 준비한다. feature→release는 로컬 `git merge`를 허용한다.
   여기서 CLI 허용은 PR 전용으로 한정하지 않는다. 원격 push는 병합과 별개이며 사용자 요청 범위에서만 실행한다.
3. release의 기존 변경과 원격 기준선을 확인한 뒤 병합하고 충돌·통합 영향을 검증한다.
   release에서 일반 기능을 직접 작성해 commit하지 않는다. 승인된 병합 과정의 merge commit·충돌 해결은 허용한다.
4. 검증할 release SHA와 main 기준 SHA를 기록하고 release→main PR을 준비한다.
   PR 생성·조회·검사는 CLI로 할 수 있지만 최종 병합은 GitHub 웹 GUI에서만 한다.
5. PR의 head/base가 바뀌면 기존 결과를 새 후보의 검증으로 재사용하지 않는다. 충돌 해결로 내용이 바뀌면 관련 검사를 다시 수행한다.
6. main 반영 후 실제 main SHA의 CI·이미지 digest를 확인한다. 배포는 별도 요청·절차를 따른다.

main에는 로컬 직접 commit·push, `gh pr merge`·병합 API·자동 병합을 사용하지 않는다.
GUI로 실행한다는 사실도 병합 권한을 대신하지 않으며, AI의 실행 범위는 매번 받은 사용자 요청을 따른다.

기본 병합 방식은 원본 커밋 관계를 유지하는 merge commit이다. 로컬 통합은 `git merge --no-ff`,
웹 PR은 **Create a merge commit**을 사용한다. 공유 main·release 이력을 squash·rebase로 다시 쓰지 않는다.
반복 병합하는 장기 브랜치에서 squash는 이전 변경이 다음 PR에 다시 나타나거나 충돌이 반복될 수 있다.
이 기본값은 원본 이력과 긴급 수정의 전달 관계를 확인하기 위한 선택이다. [GitHub 병합 방식](https://docs.github.com/en/pull-requests/reference/pull-request-merges)

## 긴급 수정

```text
main ──분기──> hotfix-<주제영역>
                 │ 수정·검증
                 └──웹 PR──> main ──병합──> release ──병합──> 진행 중인 feature/*
```

- hotfix는 main에서 시작한다. 수정 중 release를 hotfix에 병합해 미출시 기능을 함께 올리지 않는다.
- hotfix→main도 main 보호 기준에 따라 GitHub 웹 PR로 병합한다. 긴급하다는 이유로 검증·권한을 자동 생략하지 않는다.
- main에 반영된 수정은 main→release, release→진행 중인 각 feature 순서로 전달한다.
  전달 단계의 로컬 CLI merge는 허용하되 다른 담당의 작업 브랜치는 합의 없이 변경하지 않는다.
- 각 단계의 충돌 해결·관련 검증·반영 SHA를 worklog에 남긴다. 활성 feature의 담당자에게 전달할 목록과 미반영 사유를 기록한다.
  종료한 과거 feature까지 일괄 수정하지 않는다. 새 feature는 수정이 포함된 release에서 시작한다.
- main 반영·실제 운영 배포·하위 브랜치 전달은 서로 다른 상태다. main 반영만으로 전체 긴급 수정 절차를 완료 처리하지 않는다.

## 배포 전 변경을 잠시 멈추는 기간

이전에 사용한 '동결'은 **검증할 release 버전을 정한 뒤 새 기능 추가를 잠시 멈추는 것**을 뜻한다.
별도 브랜치나 장기간 중단을 요구하는 말이 아니다. main 승격을 준비하는 동안에는 후보 SHA를 기록하고,
새 기능·결함 수정·hotfix 전달로 release가 바뀌면 후보를 다시 정해 검증한다. 진행 중 feature 작업 자체는 계속할 수 있다.

## GitHub·CI·hook 적용안

아래는 후속 구현·설정 시의 기준이며 현재 설치·강제 적용됐다는 뜻이 아니다.

| 위치 | 적용할 내용 | 한계와 주의 |
| --- | --- | --- |
| GitHub main 보호 | PR 필수, 필수 검사, force push·삭제 제한, 필요한 최소 우회 권한 | 기본 PR 규칙만으로 웹 GUI 전용을 구분할 수 없음 |
| main 대상 PR 검사 | 같은 저장소의 release 또는 hotfix-*인지 확인하고 실제 변경·검증 결과 확인 | branch 이름만으로 변경 내용·긴급 수정의 적정성을 증명하지 않음 |
| GitHub release 보호 | force push·삭제 제한, 사용자에게 허용된 로컬 병합 결과의 push 경로 유지 | 로컬 merge+push를 허용하면서 PR 전용 규칙을 일괄 켜지 않음 |
| CI | release push의 통합 검사, main 대상 PR 검사, main 병합 후 최종 SHA 검사·이미지 게시 | release push 후 실행한 검사는 이미 수신된 push의 사전 차단 증거가 아님 |
| 로컬 hook | main 대상 push 조기 차단, 요청된 변경 범위·작업 기록·로컬 검사 확인 | 미설치·우회 가능. GitHub CLI/API의 서버 병합을 가로채지 못함 |
| AI 공통 지침 | 병합 방향·실행 수단·긴급 수정 전달·권한 경계 | 문서만으로 위반을 기술적으로 방지하지 못함 |

main의 필수 검사에는 실제로 실행되는 CI를 지정한다. 생략·미실행을 성공으로 취급하지 않도록 검사 결과를 집계한다.
코드 작성자가 필수 검사 자체를 임의 약화해 통과시키지 못하도록 workflow 변경과 검사 출처·우회 권한도 검토한다.
혼자 관리하는 저장소라면 본인 PR을 승인할 수 없는 별도 리뷰어 필수 설정을 무조건 추가하지 않는다.

GitHub는 같은 PR을 웹과 CLI에서 모두 병합할 수 있다. 따라서 표준 PR·검사 규칙에 대한 이 문서의 판단은
**기본 보호 설정만으로 GUI 전용 병합을 완전히 강제할 수 없다는 것**이다.
이 요구를 더 강하게 제한하려면 AI용 계정·토큰에 main 병합 권한을 주지 않는 권한 분리를 검토한다.
같은 병합 가능 자격 증명을 사람과 AI가 공유하면서 CLI만 금지됐다고 판단하지 않는다.
[GitHub PR 병합](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request),
[GitHub ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

pre-push는 실제 원격 대상 ref를 확인해야 한다. 현재 체크아웃 이름만 검사하면 다른 이름의 로컬 ref를 main으로 보내는 경우를 놓친다.
hook 파일은 저장소에서 버전 관리하고 설치 절차로 연결하는 방식이 적합하다. `.git/` 내부 파일만 고치면 다른 clone에 배포되지 않는다.
로컬 hook은 `--no-verify` 등으로 우회할 수 있으므로 원격 보호를 대체하지 않는다.
[Git hook](https://git-scm.com/docs/githooks), [Git push](https://git-scm.com/docs/git-push)

## 전환과 검증

- 기존 main·release의 서로 다른 커밋과 미커밋 변경은 대조·보존한다. 새 흐름을 이유로 자동 reset·stash·강제 push하지 않는다.
- 현재 [CI](../../.github/workflows/ci.yml)와 [배포 정책](../operations/deployment-policy.md)은 main 검증·이미지 게시를 사용한다.
  main 게시 기준은 새 흐름에서도 유지 가능하며 release push 검사·main PR 소스 제한은 추가 구현 대상이다.
- 적용 전 저장소 요금제·권한·기존 ruleset을 조회해 가능한 설정을 확정한다. 보호 규칙은 CLI 허용 경로와 충돌시키지 않는다.
- 적용 결과는 문서, 로컬 hook, 원격 보호, CI, 실제 배포를 나눠 검증한다. 거부돼야 할 main push와 정상 허용 경로를 각각 확인한다.
