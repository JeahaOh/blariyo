# Git 브랜치와 병합 절차

- 상태: 2026-09-26 사용자 확정. **GitHub Free 유지 + 로컬 Git hook**을 채택한다.
  hook은 구현됐으며 clone별 설치·검증은 별도다. GitHub 유료 보호·플랫폼 이전·추가 CI는 현재 필수 조건이 아니다.
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
6. main 반영 후 실제 main SHA를 확인한다. 배포할 때 해당 SHA의 검증·이미지 digest·실행 결과를 확인하며,
   배포는 별도 요청·절차를 따른다. 기존 CI의 유지·확장을 브랜치 보호 도입의 필수 조건으로 삼지 않는다.
   운영 배포가 성공하면 [배포 정책](../operations/deployment-policy.md)에 따라 배포된 커밋에
   `prod/YYYY-MM-DD-HHMM-KST-<shortsha>` annotated tag를 남긴다. main 병합, 운영 배포, tag push는
   서로 다른 권한과 완료 상태다.

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

## GitHub Free 운영 기준

- 플랫폼은 GitHub를 유지한다. 비공개 저장소의 GitHub Free에서는 서버 측 branch protection·ruleset을
  사용할 수 없으므로 적용됐다고 보고하지 않는다. 공개 저장소 전환·유료 전환은 이번 결정에 포함하지 않는다.
  [GitHub 보호 브랜치 지원 범위](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- 로컬 hook은 Git 명령 실행 시 실수를 차단하고, AI 공통 지침은 작업 범위·병합 방향·웹 GUI 사용을 규정한다.
  웹에서 main PR을 병합할 때 같은 저장소의 release 또는 hotfix-*인지, 후보 SHA의 필요한 검증이 끝났는지 확인한다.
- 현재 hook은 작업 기록 내용·사용자 승인·전체 변경 범위·제품 테스트 결과를 자동 판정하지 않는다.
  이 항목은 작업자와 병합 담당자가 확인한다. hook 통과를 commit·push 권한으로 해석하지 않는다.
- 추가 CI는 필요할 때 별도 요청으로 구성한다. 기존 workflow는 이번에 삭제하거나 수정하지 않는다.
  CI가 실행되면 대상 SHA·실행 여부·결과를 확인하며, 검사 실행을 원격 병합 강제 차단과 혼동하지 않는다.

## 로컬 hook 설치와 검증

편집 정본은 [`.githooks/`](../../.githooks/guard.sh), 설치 도구는
[`scripts/git-hooks.mjs`](../../scripts/git-hooks.mjs)다. clone별로 다음을 실행한다.

```sh
npm run hooks:install
npm run hooks:check
npm run test:git-hooks
```

- 설치는 Git 공통 디렉터리의 `blariyo-hooks/`에 source 사본을 만들고 해당 clone의 `core.hooksPath`를 연결한다.
  현재 환경은 `.git/blariyo-hooks/`이며 과거 `.git/harness-hooks/`를 재사용하지 않는다.
  다른 브랜치에 `.githooks/`가 없어도 설치본은 남는다. 같은 clone의 linked worktree는 공통 설정을 공유한다.
- 다른 `core.hooksPath`나 기존 실행 hook이 있으면 자동 덮어쓰지 않고 중단한다. 담당·통합 방법을 확인한다.
- hook source를 수정하거나 새 변경을 받은 뒤 `hooks:check`가 설치본 차이를 보고하면 내용을 검토하고
  `hooks:install`로 다시 설치한다. 설치는 반복 실행할 수 있으며 다른 clone에는 자동 전파되지 않는다.
- 설치·테스트에는 Node.js가 필요하고, 설치된 hook 실행에는 Git과 POSIX sh만 필요하다. npm 의존성 설치는 필요 없다.

| hook | 차단 | 허용 |
| --- | --- | --- |
| `pre-commit` | main 직접 commit, release 일반 commit | feature·hotfix commit, MERGE_HEAD가 있는 release 병합 완료 commit |
| `pre-merge-commit` | main의 로컬 merge commit | release 통합 등 main 이외의 merge commit |
| `pre-push` | 원격 main 생성·수정·삭제, release 삭제·이력 재작성 | release의 기존 이력을 포함하는 push, release 최초 생성, 일반 feature·hotfix push |

pre-push는 현재 브랜치 이름이 아닌 **Git이 제공한 실제 목적지 ref**를 검사한다. `HEAD:main`, 다른 원격 이름,
여러 ref를 보내는 push에도 적용한다. release의 원격 기준 커밋이 로컬에 없으면 자동 fetch하지 않고 중단한다.
해당 원격을 fetch하고 변경·병합 상태를 확인한 뒤 다시 실행한다. `--force` 여부 자체가 아니라 이전 원격 커밋의
이력을 포함하는지를 판정하므로, 실제 이력을 지우는 `--force-with-lease`도 차단한다.

### 한계

- `--no-verify`, hook 설정 변경·미설치, 다른 clone, 웹·API 요청은 이 hook의 보호 범위 밖이다. AI는 G07에 따라 우회하지 않는다.
- commit을 만들지 않는 fast-forward merge, reset·update-ref 등 로컬 ref 이동 전체를 가로채지는 않는다.
  main을 로컬에서 바꿔도 이 hook을 거치는 main push는 차단된다. 이를 로컬 main 변경 전체 차단으로 보고하지 않는다.
- main으로의 GitHub 웹 PR 병합은 허용하지만 hook이 웹·CLI·API 병합을 구별해 강제하지는 못한다.
  웹 전용과 release/hotfix 소스 제한은 공통 작업 규칙이다.
- 사용자 예외도 hook을 자동 해제하는 근거가 아니다. 예외 실행이 필요하면 대상·권한·설정 변경을 별도로 확인한다.

[Git hook](https://git-scm.com/docs/githooks), [Git push](https://git-scm.com/docs/git-push),
[GitHub PR 병합](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request)

## 전환과 검증

- 기존 main·release의 서로 다른 커밋과 미커밋 변경은 대조·보존한다. 새 흐름을 이유로 자동 reset·stash·강제 push하지 않는다.
- 현재 [CI](../../.github/workflows/ci.yml)와 [배포 정책](../operations/deployment-policy.md)은 main 검증·이미지 게시를 사용한다.
  main 게시 기준은 유지 가능하지만 CI source의 존재만으로 운영 필수성·실제 실행을 판단하지 않는다.
  release push 검사·main PR 소스 자동 검사는 필요한 경우의 후속 작업이다.
- 적용 결과는 문서, 로컬 hook 설치·테스트, 원격 보호, CI, 실제 배포를 나눠 검증한다.
  임시 로컬 저장소에서 거부돼야 할 main push와 정상 허용 경로를 확인하고, 실제 GitHub push 거부 증거와 구분한다.
