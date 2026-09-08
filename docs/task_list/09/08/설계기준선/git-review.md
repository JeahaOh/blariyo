# 설계 기준선 Git 반영 사전 검토

- 검토일: 2026-09-08
- 작업 트리: `planning-design-only`
- 범위: branch ancestry·애플리케이션 제거 이력·현재 `docs/` 변경·비밀·범위 검사
- 실행 제한: 이 보고서 작성 외 Git index·commit·branch·tag·push 변경 없음

## 판정

현재 `main`은 `planning-design-only`의 조상이고 `main` 고유 commit이 없으므로, 현재 문서 변경을
`planning-design-only`에 commit한 뒤에도 ancestry상 fast-forward가 가능하다. 다만 fast-forward에는
`a021f6c70d5218e3a52e1a0942176c25af7764f2`의 기존 `apps/` 제거가 포함된다. 이 삭제는 작업 트리의
미커밋 변경이 아니라 이미 planning branch 이력에 들어간 의도적 planning-only 변경이다.

사용자의 main 반영 제안 진행 승인과 기존 prototype 폐기 뒤 docs 기준 재개발 전제에 근거해, 주 에이전트가
기존 앱 제거 이력까지 main 반영 범위에 포함된다고 판정하고 차이를 안내했다. 앱 삭제에 대한 별도 확인
응답을 받았다는 뜻은 아니다. 이 판정 아래에서는 `--ff-only`가 가장 단순하고 이력을 그대로 보존한다.
`main`의 기존 `apps/`를 유지해야 한다면 단순
fast-forward는 사용할 수 없고, docs tree만 별도 반영하는 통합 commit이 필요하다. 후자의 경우 최신 문서
commit 하나만 cherry-pick하면 앞선 15개 commit의 문서 변경이 빠지므로 기준선 전체 반영이 되지 않는다.

이번 검토 시점의 미커밋 변경은 모두 `docs/` 아래이고 외부 비밀 파일이나 실제 credential 서명은 발견하지
못했다. 기존 보완 이력과 task 검증 자료까지 `docs/` 전체를 한 기준선 commit에 포함할 수 있다. 다만
manifest 작성이 아직 진행 중이므로 stage 직전에 path·비밀·구조 검사를 다시 실행해야 한다.

## Branch·remote 근거

| 확인 | 결과 | 해석 |
| --- | --- | --- |
| `git merge-base main planning-design-only` | `3f9008fcebb5193957bb4868cfcb4ac4891b1954` | merge-base가 현재 main HEAD와 같음 |
| `git rev-list --left-right --count main...planning-design-only` | `0 15` | main 고유 0, planning 고유 15 commit |
| local·remote `main` | 모두 `3f9008fcebb5193957bb4868cfcb4ac4891b1954` | `git ls-remote`로 원격 현재값 확인 |
| local·remote `planning-design-only` | 모두 `0ade2e4815e74af68d337f73bd10877da28cce2f` | 미커밋 변경 전 branch ref가 원격과 같음 |
| `feature/m0-core` | local·remote `2bb8396092d1d84bfc2fe939f3a51e1bf1ea6cea` | M0 구현 branch는 별도 ref로 보존됨 |

현재 working tree 내용은 commit 전이라 `main`이 직접 fast-forward할 대상에는 아직 포함되지 않는다.
문서 commit이 planning HEAD 위에 추가되면 main의 조상 관계는 유지된다.

## 기존 앱 제거 이력

제거 commit은 다음과 같다.

- commit: `a021f6c70d5218e3a52e1a0942176c25af7764f2`
- 일시: 2026-08-19 15:38:15 +09:00
- 제목: `chore: remove application source for planning-only branch`
- 부모: `03977a4ec288eee0e0cf6a2c8d7e62a0332f2e55`
- 변경: `apps/` 29개 tracked file 삭제와 root `README.md`의 planning-only 설명 변경
- 통계: 30 files, 7 insertions, 7,714 deletions

`main` tree에는 `apps/` tracked file 29개가 있고 `planning-design-only` tree에는 0개다. 따라서
`main`에서 `git merge --ff-only planning-design-only`를 수행하면 이 29개가 main에서도 삭제된다.
`feature/m0-core`의 새 구현은 별도 branch ref에 남아 있으므로 planning fast-forward가 그 branch 자체를
삭제하지는 않는다.

## 현재 미커밋 docs 범위

이 보고서를 만들기 직전 상태는 다음과 같다.

- tracked 수정 18개
- untracked 39개
- staged 0개
- `docs/` 밖 tracked·untracked 변경 0개
- symlink·mode 변경 0개

이 보고서 추가로 untracked file은 1개 늘어난다. 파일은 다음 범주다.

| 범주 | 내용 | 판정 |
| --- | --- | --- |
| 정본·색인 | planning, legal, system-design, development-specs, `docs/ai/README.md` | 기준선 범위 |
| 정적 검토물 | responsive JS·README, community wireframe | 승인된 기존 보완 범위 |
| 검증 도구·결과 | `docs/system-design/validation/` | 구현 완료 주장이 아닌 설계 검증 증거 |
| 작업 기록 | `docs/task_list/09/08/` Markdown·Python·PNG | 기존 감사·보완·브라우저 증거. 제품 정본과 구분됨 |

범위 밖 파일명은 발견하지 못했다. 특히 `.env`, private key, keystore, DB dump, credential·token 이름의
파일과 `docs/` 밖 source 변경은 없다. PNG 세 개는 policy 화면의 desktop/mobile 시각 검수물이며 직접
열어 확인한 화면에 실제 계정·token·연락처가 보이지 않았다.

## 비밀·로컬 정보 검사

`docs/` 전체에서 private-key header, AWS access key, GitHub token, OpenAI 형식 key, Discord webhook token,
JWT, token/secret/password/API-key의 긴 직접 할당을 검사했다.

- 실제 비밀 서명: 0건
- `sk-` 형식 탐지: 1건. `docs/development-specs/m0-core/decisions/검수/task-04-user-audit-corrections.md:5`의
  상대 링크 `task-03-final-decisions-full-audit.md` 일부를 key로 오인한 false positive다.
- 실제 이메일·credential 직접 할당: 0건. `example.com` 예시는 검사에서 별도 분류했다.
- 로컬 절대 경로: `docs/system-design/validation/member-readiness-review.md:25`의 별도 구현 worktree 경로 1건.
  secret이 아니라 검토한 구현 증거 위치이며, 현재 사용자 환경에 종속된 기록이라는 한계가 있다.

이 검사는 알려진 signature와 문서·PNG 육안 확인이다. stage 뒤 `git diff --cached`를 대상으로 같은 검사를
다시 수행해야 새 manifest와 이 보고서까지 최종 포함한 결과가 된다.

## Git 실행 전 최소 gate

1. manifest·readiness 작성 완료 뒤 `git status --short --branch`로 `docs/` 밖 변경이 없는지 확인한다.
2. `git add -- docs`로 path를 제한하고 `git diff --cached --name-status`에서 삭제·binary·task artifact를
   다시 확인한다.
3. staged content secret scan, `git diff --cached --check`, 문서 구조 검사를 통과시킨다.
4. 기준선 commit 뒤 branch HEAD와 commit tree의 `apps/` 부재를 다시 표시한다.
5. 승인된 앱 제거 포함 main 전환은 main에서 `--ff-only`만 사용하고 새 HEAD가 기준선 commit과
   같은지 확인한다.
6. annotated design tag 네 개는 같은 검증된 commit을 가리키게 만들고 tag object의 type·message·target을
   local readback한다. branch·tag push는 이번 범위에서 제외하며, 나중에 별도 승인되면 각각 원격 ref를
   조회해 확인한다.

현재 결론은 **docs 기준선 commit 가능, 기존 앱 제거를 포함한 main fast-forward 가능**이다.
Git mutation은 주 검수와 실행 위임 전까지 보류한다.

보고서 작성 뒤 재검사 결과는 `markdown_files=73 local_links_checked=700 tables_checked=358 issues=0`,
`git diff --check` 출력 없음, `docs/` 밖 변경 0건이다.
