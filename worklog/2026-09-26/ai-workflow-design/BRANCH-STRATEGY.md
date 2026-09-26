# 브랜치 흐름 변경과 GitHub·hook 적용 범위

> 이후 사용자가 이 규칙을 확정하고 커밋하도록 요청했다. 최신 상태는 [규칙 확정과 커밋](#규칙-확정과-커밋)을 따른다.

## 요청·담당·권한

- 요청: feature→release는 CLI 병합, release→main은 GitHub GUI 병합으로 변경한다.
  긴급 수정은 main에서 hotfix-*를 만들고 main→release→feature 순서로 전달한다.
  GitHub와 Git hook에 규칙을 설정해야 하는지도 검토한다.
- 담당: Codex / AI 공통 지침·Git workflow 문서 정정.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치·기준 HEAD: `release@e2a6240a238085c1c22107acdd36650419a3f3a6`.
- 문서 쓰기 착수: 2026-09-26 19:03:06 KST.
- 상태: 종료 — 정본·연결 문서 반영과 정합성 검사 완료. 실행 설정 적용은 별도다.
- 갱신 시각: 2026-09-26 19:05:55 KST.
- 변경 경로: AGENTS.md, docs/ai/README.md, docs/ai/harness.md, docs/ai/git-workflow.md,
  이 주제의 DECISIONS.md·BRANCH-REVIEW.md·BRANCH-STRATEGY.md, 날짜별 worklog README.
- 다른 세션의 M0 문서 변경을 확인해 쓰기를 보류했다. 사용자 답변 '이번만 규칙 무시하고 진행하도록'에 따라
  이번 문서 정정에 한해 G03의 단일 작성자 예외를 적용한다. G03 자체를 삭제·완화하거나 상시 병행 권한으로 해석하지 않는다.
- GitHub 설정·hook 설치·CI source 수정·stage·commit·push·merge·브랜치 전환·배포는 이번 실행에 포함하지 않는다.

## 결정과 구체화

| 구분 | 반영 내용 |
| --- | --- |
| 사용자 변경 결정 | feature→release→main. release는 통합·배포 전 검증, main은 운영 반영 기준 |
| 사용자 변경 결정 | feature→release CLI 병합 허용, release→main GitHub 웹 GUI 병합 |
| 사용자 변경 결정 | main에서 hotfix-* 생성, main 반영 후 main→release→진행 중 feature 전달 |
| 구체화 | 새 feature는 release 기준, main 보호는 hotfix PR에도 동일 적용, PR 준비·조회·검증은 CLI 허용 |
| 구체화 | 원본 커밋·전달 관계를 보존하는 merge commit 기본값, 후보 SHA 변경 시 재검증 |
| 해석·확인 중 | CLI 범위 질문에는 아직 답변이 없어 로컬 git merge 허용으로 해석했다. 실제 push 권한은 G08에 따라 별도로 확인 |
| 적용안 | GitHub는 원격 보호·필수 검사, hook은 로컬 조기 검사, 공통 지침은 실행 수단·권한·전달 절차 |

- 현행 상세 정본은 [Git workflow](../../../docs/ai/git-workflow.md), 금지 규칙 요약은 [AGENTS.md](../../../AGENTS.md)다.
- [harness](../../../docs/ai/harness.md)의 G08 검사 계약·전환 경계·수용 조건을 새 흐름에 맞췄다.
- Claude·Gemini의 기존 `@AGENTS.md` 연결은 유지한다. 동일 규칙을 진입 문서에 다시 복제하지 않는다.
- [DECISIONS](DECISIONS.md#브랜치-흐름-변경)의 과거 내용과 [직전 검토](BRANCH-REVIEW.md)는 지우지 않고 최신 안내를 연결한다.
- '동결'은 검증할 release 버전에서 새 기능 추가를 잠시 멈추는 뜻으로 풀어 설명했다.
  별도 복잡한 브랜치 체계를 도입하지 않으며 후보가 바뀌면 다시 검증한다.

## 공식 근거와 강제 적용 한계

- [GitHub ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)은 PR·필수 검사·force push·삭제 등 원격 조건을 다룬다.
- [GitHub PR 병합](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request)은 웹과 `gh pr merge`를 모두 지원한다.
  이를 근거로 기본 PR 보호만으로 GUI 전용 병합을 강제할 수 없다고 판단했다. 실제 저장소 설정 조회 결과는 아니다.
- [Git hook](https://git-scm.com/docs/githooks)의 pre-push는 Git push의 대상 ref를 검사할 수 있다.
  [Git push](https://git-scm.com/docs/git-push)의 hook 우회 가능성을 확인했다. API 병합·미설치 환경까지 보호한다고 주장하지 않는다.
- [GitHub 병합 방식](https://docs.github.com/en/pull-requests/reference/pull-request-merges)의 장기 브랜치 squash 주의사항을 확인하고 merge commit 기본값을 선택했다.
- 현재 CI의 main 이미지 게시 방향은 새 흐름에서도 유지 가능하다. release push 검사·main PR 소스 제한은 후속 구현이다.
  원격 ruleset·계정별 권한·요금제와 실제 거부·통과 동작은 미검증이다.

## 검증·잔여

- 이번 변경 8개 문서의 로컬 링크·anchor 86개를 검사했고 누락은 0개다.
- AGENTS G01~G10과 harness 대응표 10개가 일치한다. Claude·Gemini 진입 문서는 작업 시작 hash와 동일하다.
- DECISIONS의 최신 안내 교체·후속 절 추가, BRANCH-REVIEW의 후속 안내 추가를 제외한 원문이
  시작 hash와 같음을 확인했다. 과거 결정·검토 본문은 보존했다.
- `git diff --check`에 공백 오류가 없다. 신규 Markdown 5개의 `git diff --no-index --check`에도 진단이 없다.
  신규 파일 존재에 따른 exit 1을 검사 실패와 구분했다.
- HEAD는 시작 값과 같고 staged 파일은 없다. 작업 범위 밖 roadmap·M0 계획의 동시 변경을 관측했으며 이 세션에서는 쓰지 않았다.
- 실제 AI 세션·hook·CI·브라우저·애플리케이션·운영 자원 검증은 실행하지 않는다.
- M0 정본·계획은 다른 작업의 변경으로 보존하며 이번 세션의 결과에 포함하지 않는다.

## 규칙 확정과 커밋

- 요청: 현재 규칙을 확정하고 관련 변경을 커밋한다. 원격 push·병합·배포는 요청 범위에 포함하지 않는다.
- 확정: feature→release의 로컬 CLI merge 허용, release/hotfix→main의 GitHub 웹 PR 병합,
  main에서 hotfix-* 생성 후 main→release→진행 중 feature 전달, merge commit 기본값을 현행 규칙으로 사용한다.
  위 표의 CLI 해석·확인 중 상태는 이번 확정으로 해소한다. 실제 push 실행 권한은 기존 G08을 따른다.
- 담당: Codex / AI workflow 규칙 확정·로컬 커밋.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 시작: 2026-09-26 19:10 KST. 다른 M0 문서 작업의 종료를 19:12 KST에 확인한 뒤 Git 작업을 시작했다.
- 작업 브랜치: `feature/ai-workflow-design`. 기준 release SHA: `e2a6240a238085c1c22107acdd36650419a3f3a6`.
  동일 HEAD에서 브랜치만 분기해 작업 폴더의 기존 변경을 유지했다. worktree·stash는 만들지 않았다.
- 범위: `.gitignore`, 루트 진입 문서 3개, AI 안내·Git workflow·harness, 착수·감사 스킬 2개,
  worklog 전체·날짜별 색인, 이 주제의 DECISIONS·REVIEW·BRANCH-REVIEW·BRANCH-STRATEGY. 총 15개 파일.
- 상태: 종료 — 규칙 문서 확정·검증 완료. 이 기록을 포함하는 커밋의 성공 여부·식별자는 아래 Git 기록으로 확인한다.
- 갱신 시각: 2026-09-26 19:13:04 KST.
- 검증: 커밋에 포함될 트리를 기준으로 로컬 링크·참조 118개, 누락·범위 밖 미추적 파일 의존 0개를 확인했다.
  범위 밖 문서는 작업 폴더의 다른 미커밋 변경에 기대지 않고 HEAD 내용을 기준으로 절 참조를 검사했다.
  G01~G10과 harness 대응표가 일치하고 두 스킬의 전역 배치본도 정본과 동일하다.
- 보존: Git 작업 직전 변경 32개 중 커밋 범위 밖 17개의 SHA-256이 브랜치 전환 후에도 동일하다.
  staged가 비어 있음을 확인했으며 위 15개 경로만 stage해 diff·공백을 검사한다.
- 커밋 식별자는 이 파일을 포함하는 `git log -1 -- worklog/2026-09-26/ai-workflow-design/BRANCH-STRATEGY.md`로 확인한다.
- GitHub 보호·hook·추가 CI와 실제 AI 세션·애플리케이션·운영 검증은 이번 커밋에 포함하지 않는다.
