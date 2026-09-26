# GitHub Free 기준의 보호 범위 정정

- 요청: 무료 요금제를 사용하는 상황에서 브랜치 보호를 어떻게 운영할지 설명한다.
- 사용자 확인: GitHub Free 사용. 저장소 공개 여부·계정 권한·실제 원격 보호 설정은 이번에 조회하지 않았다.
- 담당: Codex / 무료 요금제의 실행 가능 범위 확인.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치·HEAD: `release@6b91402f11df5c08c0147bab14fd2df7c681cbd8`.
- 작업일·갱신: 2026-09-26 19:30:58 KST.
- 상태: 종료 — 공식 지원 범위와 대안 검토. 설정·구현 미실행.
- 변경 경로: 이 파일 하나. M0 문서 작업의 19:26 종료 기록을 확인했으며 기존 변경은 수정하지 않는다.

## 앞선 안내의 정정

앞선 답변은 비공개 저장소의 유료 요금제 조건을 적었지만, 사용자의 무료 환경에서 실행할 수 있는 안을 먼저 제시하지 못했다.
Free·비공개라면 앞서 안내한 branch protection·branch ruleset의 원격 강제 적용을 현재 실행안으로 삼지 않는다.
Free·공개 저장소는 지원되지만 보호 기능을 얻기 위해 이 프로젝트를 공개로 전환하도록 제안하지 않는다.
[보호 브랜치 지원 범위](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches),
[ruleset 지원 범위](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

## 무료·비공개 유지 시 제안

- 확정한 feature→release→main과 main에서 hotfix-* 생성·역전달 규칙은 유지할 수 있다.
- 저장소에서 버전 관리하는 로컬 hook으로 main 직접 commit·push, 보호 대상 ref의 삭제·이력 재작성 등을 조기 차단한다.
  hook 설치·검사 코드는 후속 작업이며 이번에 만들거나 설치하지 않는다.
- PR의 CI에서 검사 결과와 잘못된 병합 방향을 표시하고, main 병합 담당자가 성공 여부를 확인한 후 웹에서 병합한다.
  검사 실행과 GitHub의 병합 강제 차단은 다르다. Free·비공개에서 required checks를 원격 강제 설정했다고 보고하지 않는다.
- GitHub Actions는 비공개 저장소의 요금제별 포함 사용량 안에서 이용하는 안으로 검토한다.
  현재 사용량·예산·결제 설정은 조회하지 않았다. [Actions 사용량 안내](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- 로컬 hook은 미설치·우회·다른 clone·GitHub CLI/API 병합까지 막지 못한다.
  같은 쓰기 자격 증명을 공유하는 상황에서 문서·hook·CI만으로 main을 완전히 보호한다고 주장하지 않는다.
  [Git hook](https://git-scm.com/docs/githooks), [Git push](https://git-scm.com/docs/git-push)

## 검증·적용 상태

- 공식 요금제별 지원 범위와 현재 Git 상태를 읽기 전용으로 확인했다.
- 이전의 ruleset 설정 질의도 파일 쓰기가 겹쳐 기록하지 못했으며, 그 안내의 무료 환경 적용 한계를 이번 기록에서 정정한다.
- 기존 AI 규칙은 유지한다. GitHub 설정·hook·CI·소스 수정, commit·push·브랜치 전환은 수행하지 않는다.

## 후속 검토 — 무료 Git 플랫폼 대안

- 요청: main 하나만 무료 보호할 수 있는지 확인하고, 기존 GitHub Actions·CI 유지를 필수 조건에서 제외해 다른 플랫폼을 비교한다.
- 담당: Codex. 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치·HEAD: `release@6b91402f11df5c08c0147bab14fd2df7c681cbd8`. 변경 경로: 이 파일 하나.
- 상태: 종료 — 공식 기능·요금제 비교. 갱신: 2026-09-26 19:39 KST.
- M0 문서 작업의 19:26 종료와 수집 재분석 기록 담당의 종료·실행 대기를 확인했다. 기존 변경을 보존했다.
- GitHub Free·비공개에서는 main 하나만 대상으로 해도 기본 브랜치 보호를 사용할 수 없다. 브랜치 수를 줄여 해결되는 제한이 아니다.
- GitLab.com Free: 프로젝트 단위 보호 브랜치, 역할별 push·MR 병합 권한 분리와 강제 push 제한을 제공한다. 현재 요구의 우선 추천이다. 비공개 최상위 그룹은 5명 제한이며, 리뷰 승인 수를 필수로 강제하는 기능은 Premium 이상이다.
- Azure Repos: 첫 5명 Basic 무료·비공개 Git 저장소와 브랜치 정책을 제공한다. 승인·병합 정책을 세밀하게 운영할 대안이다.
- Bitbucket Cloud Free: 5명까지 무료 비공개 저장소와 기본 브랜치 권한을 사용할 수 있다. 필수 병합 검사 강제는 Premium 영역이므로 기본 보호와 구분한다.
- Forgejo 직접 운영: 브랜치 보호·PR 승인 수 제한을 제공한다. 소프트웨어 사용료와 별개로 서버·업데이트·백업을 직접 관리해야 한다.
- GitLab 적용 후보: main 직접 push 금지·MR 병합 허용, release는 지정 역할의 일반 push 허용, 두 브랜치 강제 push 금지. feature→release→main과 main 기점 hotfix 역전달 흐름을 유지할 수 있다.
- GitLab도 MR 병합 API를 제공하므로 기본 보호만으로 웹 GUI 전용을 강제한다고 판단하지 않는다. 실제 이전을 결정하면 AI 지침의 GitHub 웹 전용 문구도 선택 플랫폼에 맞게 수정해야 한다.
- CI 유지가 선택의 필수 조건이 아니라는 사용자 지시를 반영했다. `.github/workflows/ci.yml`에 Actions·GHCR 의존이 있다는 source 관측만으로 운영 필수성을 주장하지 않는다. 실제 운영 의존성은 이번에 조회하지 않았다.
- 공식 문서와 로컬 상태만 확인했다. 외부 저장소 생성·코드 전송·remote 변경·CI 삭제·commit·push는 수행하지 않았다. 플랫폼 선택과 적용 검증은 미실행이다.

근거: [GitLab 브랜치 보호](https://docs.gitlab.com/user/project/repository/branches/protected/),
[GitLab Free 인원 제한](https://docs.gitlab.com/user/free_user_limit/),
[GitLab 승인 제한](https://docs.gitlab.com/user/project/merge_requests/approvals/),
[GitLab 병합 API](https://docs.gitlab.com/api/merge_requests/#merge-a-merge-request),
[Azure 요금제](https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/),
[Azure 브랜치 정책](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops),
[Bitbucket 요금제](https://www.atlassian.com/software/bitbucket/pricing),
[Bitbucket 브랜치 권한](https://support.atlassian.com/bitbucket-cloud/docs/use-branch-permissions/),
[Forgejo 브랜치 보호](https://forgejo.org/docs/latest/user/repository/protection/).

## 후속 검토 — Cloudflare와 AWS

- 요청: Cloudflare·AWS의 Git 플랫폼 대체 가능성과 유·무료 여부를 확인한다.
- 담당: Codex. 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치·HEAD: `release@6b91402f11df5c08c0147bab14fd2df7c681cbd8`. 변경 경로: 이 파일 하나.
- 상태: 종료 — 공식 문서 비교. 갱신: 2026-09-26 19:41 KST. M0 기록의 최종 종료 상태를 재확인했다.
- Cloudflare Pages/Workers의 Git 연동은 외부 Git 저장소를 연결하는 빌드·배포 기능이다. Pages 무료 요금제가 존재해도 Git 저장소·브랜치 보호의 대체 서비스로 보지 않는다.
- AWS CodeCommit은 관리형 비공개 Git 저장소 후보다. 최초 5명 무료 구간과 사용량 한도가 있으며, 추가 활성 사용자·저장 공간·Git 요청은 과금 대상이다. 가격 페이지는 활성 사용자 6명·초과 사용 없음의 예를 월 $1로 설명한다. 활성 사용자는 접근한 AWS 사용자·역할 등 고유 identity 기준이다.
- CodeCommit의 신규 가입은 2025년 11월 재개됐다. 요금 페이지 상단에는 예전 신규 가입 중단 문구가 남아 있어, 최신 재개 발표와 사용자 가이드 변경 이력을 대조했다. 현재 사용자 계정에서 저장소 생성이 가능한지는 실행하지 않았다.
- CodeCommit은 IAM 권한 정책으로 브랜치별 push·삭제·병합을 제한할 수 있다. 이를 일반 push를 허용하면서 강제 push만 별도로 차단하는 기능이나 웹 GUI 전용 병합 강제로 확대 해석하지 않는다.
- 추천 판단: 무료 기본 브랜치 보호를 간단히 운영하려면 GitLab.com, AWS 계정·권한 체계 안에서 운영하려면 CodeCommit. 기존 CI 유지가 필수라는 전제를 두지 않는다.
- 공식 기능·가격 안내만 조회했다. 계정·청구·실제 사용량 조회, 원격 설정, 저장소 생성·전송, commit·push는 미실행이다.

근거: [Cloudflare Pages Git 연동](https://developers.cloudflare.com/pages/configuration/git-integration/),
[Cloudflare Pages 무료 범위](https://developers.cloudflare.com/pages/platform/limits/),
[CodeCommit 요금](https://aws.amazon.com/codecommit/pricing/),
[CodeCommit 신규 가입 재개](https://aws.amazon.com/blogs/devops/aws-codecommit-returns-to-general-availability/),
[CodeCommit 변경 이력](https://docs.aws.amazon.com/codecommit/latest/userguide/history.html),
[CodeCommit 브랜치 권한](https://docs.aws.amazon.com/codecommit/latest/userguide/how-to-conditional-branch.html).
