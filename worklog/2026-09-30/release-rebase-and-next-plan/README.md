# release rebase 및 후속 진행·문서 갱신 계획

- 요청: 실제 운영자는 사용자 본인임을 반영, main/release 관계 확인 및 release rebase, 진행 계획과 문서 갱신 계획 작성.
- 후속 질문: cherry-pick 등 선택 반영이 필요한 것 아닌지 검토.
- 담당: Codex / 본 세션. 실제 운영 확인·수용 담당: 사용자(OWNER).
- 상태: 종료 — 요청된 로컬 rebase와 계획 작성 완료. 후속 방식 변경·feature 통합·push·배포는 미실행.
- 갱신: 2026-09-30T20:17:16+09:00.
- 기록 브랜치/폴더: feature/m0-design-completion@c49d27f / 기본 프로젝트의 이 worklog 폴더.
- rebase 격리 폴더: `.worktree/release-main-rebase/`. 공유 Git 지침·상태/운영/로드맵 4개 문서의 충돌을 사전 확인해, 기존 미커밋 19개를 보호하기 위해 격리했다. Git/검색 제외와 기존 경로 부재를 확인했다.
- 권한: 사용자가 이번 release rebase를 명시했다. 일반 정책·hook을 수정하거나 이 지시를 원격 이력 재작성/push 권한으로 확대하지 않았다.

## 1. 브랜치 확인과 설명 정정

앞선 검토는 현재 기능 브랜치와 release, 원격 main을 주로 비교했다. 로컬 main의 고유 변경을 명확히 보고하지 못했다.

- rebase 전 로컬 main에만 8개, release에만 6개 커밋이 있었다. 공통 조상은 8af7244였다.
- 원격 main은 8af7244로, 기존 release에 이미 포함돼 있었다. 로컬 main은 e51f1b5이며 원격 main과 다르다.
- 실제 운영자는 사용자다. 운영자 신원/담당의 미정과 실제 업무 수행/인수의 미검증을 구분한다.

## 2. 실행한 rebase

1. 이전 release를 `backup/release-before-main-rebase-20260930`으로 보존했다.
2. 격리된 release에서 `git -c rebase.updateRefs=false -c rebase.autoStash=false rebase --rebase-merges main`을 실행했다.
3. 다음 충돌을 해결하고 기존 merge 관계를 유지해 완료했다. hook 우회·stash·원격 쓰기는 하지 않았다.

| 충돌 파일 | 해결 기준 |
| --- | --- |
| docs/status.md | main의 9/25 실제 앱 배포·GTM 로딩과 release의 9/26 공개 GET·M0 잔여를 날짜별로 모두 유지 |
| docs/operations/current-status.md | 최근 확인 앱은 9/25 8af7244, DB 전수 증거는 9/23, 공개 GET은 9/26으로 구분 |
| docs/ai/git-workflow.md | 9/25 이전 설계안보다 9/26 확정된 feature→release→main·GitHub Free·로컬 hook 정책 우선. 최종 내용은 이전 release와 바이트 동일 |
| docs/roadmap.md | 9/25 배포 증거와 9/26 Drive/보존/검증 출처 결정을 함께 유지 |

- 이전 release: bb19c486f3cafa847bd34828a699382c6d5bd0b6.
- 현재 로컬 release: **2126c053b35f2e2b4e45a8496e259ac211812772**.
- main: e51f1b501f7cc327da279102dd69eac2f4c554db. 변경 없음.
- main 고유 미반영: **0개**. 새 release는 main보다 6개 커밋 앞선다.
- 현재 기능 브랜치의 M0 전용 4커밋과 기존 미커밋 19개는 그대로 보존했다. 이 M0 구현을 release에 통합한 것은 아니다.
- 원격 release는 6b91402 그대로다. 새 로컬 release와 원격 4/로컬 14개 고유 커밋으로 분기했다. force push를 하지 않았다.

## 3. cherry-pick 후속 질문에 대한 판단

- 필요한 커밋 일부만 가져오려면 cherry-pick이 맞다. 현재 rebase 결과에는 main 8개가 이미 들어 있으므로 같은 8개를 다시 cherry-pick하지 않는다.
- main 8개 전체를 가져오고 공유 release 이력을 보존하려면 **기존 release에서 main merge**가 더 적합하다. 사전 검사 충돌은 문서 4개이고 앱 source 충돌은 없었다.
- rebase 요청을 실행하기 전에 공유 release 이력과 원격 반영 영향을 더 명확히 설명했어야 했다. 후속 기본안은 기존 release를 기준으로 통합 후보를 만들고 main/feature를 merge하는 방식이다.
- 현재 2126c05와 이전 bb19c48을 보존한다. 추가 복원/merge/cherry-pick은 이번 계획 작성 중 실행하지 않는다. 후속 실행은 [진행 계획](PROGRESS-PLAN.md)의 비교·순서를 따른다.

## 4. 검증 결과

- main 조상 포함, 이전 merge 구조, Git hook 설치 상태, conflict marker 없음, git diff --check 통과.
- 앱·계약·배포·테스트·local/content 스크립트·workflow·lockfile은 main과 바이트 동일하다. source 내용을 rebase 충돌 해결로 바꾸지 않았다.
- 과거 날짜별 worklog: 이전 release 324개·main 204개 모두 원본 blob 동일. 공용 worklog/README.md 색인은 별도로 구분했다.
- 격리 폴더에서 npm ci 후 API build 성공, 공통 테스트 34/34 통과·실패/skip 0. 최초 검사는 새 checkout에 API dist가 없어 1건 실패했고, API build 뒤 다시 통과했다.
- npm의 기존 allow-scripts 정책을 바꾸지 않았다. glob/eslint deprecated와 일부 의존성 install-script 미승인 경고가 있었다. 전체 Web build/브라우저/실DB/Collector/Docker/원격CI/운영 상태 검증은 수행하지 않았다.
- 충돌 문서 4개의 상대 링크 120개 존재 확인. anchor 검사는 미실행.
- 기본 작업 폴더의 HEAD·index와 기존 19개 파일 hash 동일. 현재 기능 브랜치 source와 이전 검토 기록은 변경하지 않았다.
- [검증 결과](REBASE-VERIFICATION.json), [시작 기준선](BASELINE.json).

## 5. 계획 산출물과 다음 담당

- [진행 계획](PROGRESS-PLAN.md): 통합 방식 선택, main/feature/후속 변경 보존, 영향 검증, 사용자 실제 업무 확인, 배포/7일 관찰/선택 수집의 순서·완료 기준.
- [문서 갱신 계획](DOCUMENT-UPDATE-PLAN.md): 사용자 역할·운영 인계·요구사항·상태/로드맵·이전 Git 설계안의 갱신 대상과 검증 기준.
- [브랜치 옵션](BRANCH-OPTIONS.json), [현재 rebase 결과와 feature 단순 merge 충돌 22개](INTEGRATION-PREVIEW.json), [원격 과거 이력을 재합칠 때의 별도 충돌 7개](REMOTE-RECONCILE-PREVIEW.json)는 사전 검사다. 실제 merge/cherry-pick으로 보고하지 않는다.
- 다음 기술 작업 담당: Codex. 실제 운영 확인/수용: 사용자. 아직 정해지지 않은 실행 시각과 실제 환경 관측은 미정/미검증으로 유지한다.

- 종료 정리: 검증용 worktree와 그 안의 설치/빌드 산출물은 정리했다. release2126c05와 이전 release backup ref는 유지하며 기본 작업 폴더의19개 기존 파일·HEAD·index는 동일하다.
