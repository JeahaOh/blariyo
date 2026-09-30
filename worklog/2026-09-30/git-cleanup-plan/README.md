# Git 정리 재계획

- 요청: 현재 Git 상태를 기준으로 정리 계획을 다시 수립.
- 담당: Codex / 계획 작성 상태: 종료 / 실행 상태: 미착수 / 갱신: 2026-09-30T21:20:30+09:00.
- 기본 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / `feature/m0-design-completion@578c0581ae7db6207a5f864dcca6485ad3eb47d6`.
- 이번 쓰기 범위: 이 기록 폴더 3개 파일. 기존 조회 기록 3개·HEAD·index·모든 branch ref와 다른 worktree를 보존한다.
- 근거: [Git workflow](../../../docs/ai/git-workflow.md), [공통 지침](../../../AGENTS.md), [실측 기준선](BASELINE.json), [병합 사전 검사](MERGE-PREVIEW.json).
- 이 계획은 앞선 rebase/선택 반영 제안의 후속 Git 정리 방식을 대체한다. 사용자가 지시한 날짜순 cherry-pick 결과는 유지한다. 이전 작업 이력은 소급 수정하지 않는다.

## 1. 결론과 완료할 상태

**현재 local release에 현재 feature를 한 번 병합하고, 충돌·회귀 검증 후 일반 push로 origin/release와 맞춘다. 그 뒤 통합이 확인된 브랜치를 정리한다. main은 현 상태를 유지한다.**

- 정리 완료 시 `local release == origin/release == 검증한 통합 SHA`.
- `local main == origin/main == 8af7244` 유지. release가 main보다 앞선 상태는 정상이며 main 승격·배포는 이 정리의 완료 조건이 아니다.
- 최신 feature의 M0 구현·개발 수집 보완·7개 후속 커밋과 local release의 GA4/admin UX/날짜순 14커밋을 모두 보존한다.
- 마무리 기록까지 커밋해 기본 작업 폴더의 index/working tree를 깨끗하게 끝낸다.
- 포함이 검증된 종료 브랜치는 제거하고, 고유 커밋·미커밋 작업이 남은 대상은 명시적인 보존 목록으로 남긴다. 모든 브랜치 삭제를 성공 조건으로 삼지 않는다.

## 2. 현재 실측

| 대상 | SHA·상태 | 처리 방향 |
| --- | --- | --- |
| local main / origin/main | 둘 다 `8af7244` | 유지 |
| local release | `0545759`, 원격 대비 고유 ID 14개 | 날짜순 정리 결과 유지, feature 통합 대상 |
| origin/release | `6b91402`, local 대비 고유 ID 4개 | 최종 병합의 조상으로 보존 후 일반 push |
| local/origin feature/m0-design-completion | 둘 다 `578c058` | 최신 구현 통합 원본. 원격에서도 현재 같은 SHA를 확인함 |
| 기본 폴더 미커밋 | 조회 기록 3파일 | 이번 계획 3파일과 함께 실행 단계 첫 커밋으로 마감 |
| 별도 feature/m0-core worktree | `a273f3c`, 수정20 + untracked68 = 88파일 | 보존. 이 정리에서 쓰기·stash·reset·삭제·자동 통합 금지 |
| local branch 수 | 9개: main/release, feature4, backup3 | 아래 분류대로 처리 |
| 원격 실제 branch 수 | 19개 | 로컬 표시 잔재가 아니며 원격에 실제 존재 |

- `origin/release`는 이미 `feature/m0-design-completion`의 조상이다. 따라서 feature를 local release에 merge하면 원격 release 이력도 함께 포함된다. origin/release를 별도로 먼저 merge할 필요가 없다.
- 현재 로컬 release와 원격 release는 99파일 내용도 다르다. 재작성된 커밋 ID 차이와 기능 차이를 구분한다.
- 현재 feature에는 원래 local release `bb19c48` 이후 11개 커밋이 있다. M0 설계/구현4개와 방금 나눈7개다.
- `git remote prune origin --dry-run`은 삭제 후보를 반환하지 않았다. prune으로 현재 원격19개가 정리되는 것은 아니다.
- Git hook 설치 검사 통과. 현행 pre-push는 release 원격 이력을 지우는 push를 차단한다.
- 열린 PR은 아직 조회하지 못했다(`gh` 미설치). 실제 브랜치 삭제 전 로그인된 GitHub GUI에서 열린 PR·담당 상태를 확인한다. 이를 통합 계획 수립 전체의 차단 사유로 취급하지 않는다.

## 3. 방식 비교

| 방식 | 장점 | 비용·제약 | 판정 |
| --- | --- | --- | --- |
| **현재 release에 최신 feature merge 후 일반 push** | 날짜순14개·최신 구현·원격 조상 모두 보존, 현행 hook과 일치 | 충돌22파일 해결·통합 시험 필요. 예전 원본과 cherry-pick SHA가 이력에 함께 보임 | **추천** |
| origin/release만 먼저 merge | 원격 조상 포함 | feature 통합이 별도로 남아 불필요한 병합 단계가 늘어남 | 채택하지 않음 |
| 현재 release를 원격에 강제 덮어쓰기 | 원격 그래프를 로컬과 단순 일치시킴 | 현행 지침·실제 hook에 막힘. feature 통합은 여전히 남음 | 현재 범위에서 제외 |
| release를 다시 rebase/cherry-pick | 이력 모양을 다시 설계할 수 있음 | 이미 끝낸 SHA 재작성·충돌 검증 반복, 공유 feature 이력도 복잡해짐 | 채택하지 않음 |

이번 추천은 기존14개 커밋을 다시 정렬하거나 버리지 않는다. merge commit으로 원본 이력을 연결하므로 Git 그래프에는 동일 변경의 옛 SHA가 함께 남을 수 있다. 그래프 전체를 단일 날짜순 직선으로 만드는 목표와 공유 이력 보존을 동시에 달성한다고 약속하지 않는다.

## 4. 실행 순서와 종료 기준

| 단계·우선순위 | 작업 | 완료 증거 |
| --- | --- | --- |
| GIT-01 / P0 | 실행 직전 local/remote SHA·담당·dirty 상태 재확인. 조회 기록3개와 이번 계획을 현재 feature에 커밋. 관련 status/roadmap의 Git 반영 현황을 현재 증거에 맞춰 정리 | 기본 폴더 clean, 명시한 파일만 커밋, 구현/운영 완료 주장 확대 없음 |
| GIT-02 / P0 | 기존 backup3개 유지, 실행 전 local/remote ref 목록과 bundle 보존·복구 확인. 현재 release에서 격리 병합 준비 | 기존 파일·refs 보존, bundle verify 및 별도 복구 조회 성공 |
| GIT-03 / P0 | local release에 최신 `feature/m0-design-completion`을 `merge --no-ff`로 통합. 아래22개 충돌과 자동 병합 영역 검토 | 충돌0, 양쪽 기능·계약·기록 보존, merge 부모 확인 |
| GIT-04 / P0 | 실제 통합 내용으로 build·계약·권한·API/Collector·브라우저 회귀 검사 | 실패/skip/미실행 구분. 검증한 tree와 최종 merge commit tree 일치 |
| GIT-05 / P0 | 원격 release SHA 재확인, 조상 관계 확인 후 `git push origin release:release` 일반 push | 서버 직접 조회 SHA = local release = 검증한 SHA, `origin/release...release`가 0/0 |
| GIT-06 / P1 | 아래 확정 가능 종료 브랜치 정리. 기타 고유 이력은 별도 보존·검토 목록으로 확정 | 삭제 allowlist·복구 가능성·열린 PR/담당·remote readback 확인, 미커밋0 |

### GIT-01 — 기록과 문서

- 지금의 조회 기록은 `origin-main-check/README.md`, `release-origin-comparison/README.md`, `release-origin-comparison/COMPARISON.json` 세 파일이다. 이번 계획 문서도 실행 범위에 포함해 첫 커밋에 묶는다.
- `docs/status.md`의 후속 보완 미커밋·과거release SHA 표기, `docs/roadmap.md`의 구현 전체 미커밋/준비도구 미보완 표현을 현행 source·이번 커밋 결과에 맞춘다. 과거 worklog와 당시 운영 증거는 바꾸지 않는다.
- 실제 운영자는 사용자(OWNER)라는 확정 사실과 아직 실행하지 않은 운영 인수/실장비 검증을 구분한다. 이 단계에서 법무 미정값이나 운영 gate를 임의 완료하지 않는다.
- 첫 문서 커밋 후 feature SHA가 달라지므로 merge preview와 ref 기준선은 다시 확인한다. 현재22개를 미래의 고정 충돌 수로 가정하지 않는다.

### GIT-02/03 — 보존과 병합

- bundle은 Git 제외 `.local-data/git-backups/`에 저장하고 ref명·SHA·파일 hash를 작업 기록에 남긴다. `git bundle verify`와 별도 bare 복구 저장소에서 대상 commit/tree 조회를 확인한다.
- bundle은 커밋된 Git 객체만 보존한다. 별도 m0-core의 미커밋88개를 백업한 것으로 보고하지 않는다. 그 worktree는 그대로 둔다.
- 실제 병합은 공유 앱/계약/문서22개 충돌을 격리하기 위해 기본 루트의 `.worktree/git-integration/`에서 수행한다. 만들기 전에 ignore/검색 제외, 경로 부재, release를 다른 worktree가 쓰지 않는지 재확인한다. 계획 단계에서는 생성하지 않는다.
- release의 일반 직접 변경은 하지 않고 허용된 병합·충돌 해결만 수행한다. 필요하면 `merge --no-ff --no-commit feature/m0-design-completion`으로 최종 commit 전 후보 내용을 검증한다.
- root feature를 동시에 다른 담당이 변경하지 않도록 작업 소유권과 대상 SHA를 고정한다. 예상 밖 변경은 해당 범위 쓰기를 멈추고 기준선을 갱신한다.
- 기존14개를 다시 cherry-pick하지 않는다. `ours`/`theirs` 전체 선택, hook 해제, force push로 충돌을 넘기지 않는다.

### GIT-04 — 현재 확인한22개 충돌의 처리

| 범위 | 수 | 처리 기준 |
| --- | ---: | --- |
| Web 페이지/동의/설정 | 5 | release의 GA4 v1·로그인/검수 UX와 feature의 M0 관리자/입력/동의 결함 수정을 함께 보존 |
| 생성 계약 및 테스트 | 3 | 정본 OpenAPI/계약 진화 규칙에 맞춰 schema 재생성·대조. 두 쪽 테스트의 요구사항을 보존 |
| 현행 문서 | 13 | 최신 확정 제품·기술 결정과 실행 증거를 적용. 배포·DB·공개GET·인수 날짜를 구분하고 법무 placeholder 유지 |
| 과거 worklog | 1 | 현재 feature 버전은 release 원문을 유지하며 후속39줄만 추가한 것으로 확인. 그 추가 이력을 보존하는 방향 |

전체 파일명은 [MERGE-PREVIEW.json](MERGE-PREVIEW.json)을 따른다. 자동 병합된 API module·analytics plugin·OpenAPI·browser batch test 등도 의미상 누락이 없는지 확인한다.

필수 검증 범위:

1. `git diff --check`, 충돌 marker 없음, 상대 링크, migration 원문/체크섬 및 계약 생성물 일치, hook 설치 확인.
2. Node24.18.0·Java25 기준 API/Web build, 관련 typecheck/lint, 루트 테스트. 기존34 PASS를 통합 후 새 후보의 결과로 재사용하지 않는다.
3. 임시 DB batch 권한 시험, API/Collector 계약·migration/보존/mailbox·역할 경계 시험. 운영 DB나 사용 중인 개발 DB를 시험 대상으로 암묵 선택하지 않는다.
4. 실제 브라우저에서 동의/철회·GA4 중복 방지, 관리자 로그인/작성·수집 검수, 목록/상세/SNS·이미지 주요 경로. 합성 데이터와 격리 대상 사용, 실제 외부 수집·운영 게시·배포 없음.
5. 실패 원인에 해당하는 부분을 수정해 필요한 검사를 재실행한다. 변경 없는 성공 검사를 반복하거나 관계없는 기능을 추가하지 않는다. 같은 원인2회 연속 해결 실패 또는 진전 없음이면 현재 실패·보존 지점·재개 조건을 보고하고 해당 실행을 멈춘다.

검증 SHA/tree와 실제 push 대상이 같아야 한다. merge commit 전에 검사했다면 검사 당시 tree를 기록하고 commit tree와 동일함을 확인한다. 최종 보고서는 이전 검증과 현재 통합 검증을 구분한다.

### GIT-05 — 원격 동기화

- push 직전에 `git ls-remote --heads origin release`를 다시 조회한다. 처음6b91402에서 바뀌었으면 새 원격 commit을 가져와 포함 여부와 영향 검증을 다시 수행한다. 기존 값을 전제로 덮어쓰지 않는다.
- `git merge-base --is-ancestor origin/release release`와 원격이 보고한 실제 SHA의 조상 여부가 모두 통과해야 일반 push한다.
- 정상 경로는 force 없는 `git push origin release:release`다. hook이 거부하면 사유를 확인하며 우회하지 않는다.
- 서버 직접 SHA와 로컬 추적 ref를 다시 확인하고 이력 차이0/0 및 tree 동일성을 남긴다. push 성공 메시지만으로 마감하지 않는다.
- main PR/병합/배포를 이 단계에 섞지 않는다. 기존 feature 원격은 현재578c058이며, 후속 기록 commit을 원격 feature에도 보낼지 여부와 종료 브랜치 삭제는 GIT-06의 명시 범위를 따른다.

## 5. 브랜치·worktree 정리 목록

| 대상 | 현재 판정 | 실행 조건 |
| --- | --- | --- |
| main, release | 영구 유지 | main 동일성·release 통합 완료 증거 유지 |
| feature/m0-design-completion (local/remote) | GIT-05 이후 종료 후보 | 최종 feature commit이 원격release의 조상, 관련 PR/담당 작업 종료, 현재 폴더 전환 후 삭제 |
| feature/ai-workflow-design (local) | 종료 후보 | `92f1e04`가 통합release 조상임을 실제 확인 |
| feature/git-local-guards (local) | 종료 후보 | `bb19c48`이 통합release 조상임을 실제 확인 |
| origin/planning-design-only (remote) | 내용 보존 확인된 삭제 후보 | 현재main 조상임을 재확인, 열린PR/담당 확인, 실제 원격branch명을 지정해 삭제 |
| backup/* 3개 (local) | 복구 지점으로 우선 유지 | 원격release 일치·검증 완료, 검증된 bundle에 기존 SHA3개 보존 후 정리 |
| feature/m0-core (local/remote/worktree) | 명시적 보존 | 미커밋88개가 있고 별도 담당/시대의 source다. 이번 실행에서 건드리지 않음 |
| 그 외 원격14개 | 고유 이력 보존·분류 대상 | 아래 별도 검토 후 미사용 확정 목록만 정리 |

- 원격19개 중15개는 현재 feature에 포함되지 않는 고유 commit ID가 남아 있다. 이 숫자는 미구현 기능15개라는 뜻이 아니다. 위 m0-core1개와 나머지14개로 나눈다.
- 나머지14개: `develop`, `docs/git-governance-design-archive`, `feature/DPL-00-nightly-deploy-design`, `feature/HARN-06-git-governance-bootstrap`, `feature/HARN-06-governance-registration`, `feature/HARN-07-release-fixture-clock`, `feature/HARN-08-cleanup-review`, `feature/HARN-08-harness-review`, `feature/HARN-08-legacy-main-review`, `feature/HARN-08-policy-review`, `feature/HARN-09-browser-retry`, `feature/HARN-09-ci-diagnostics`, `feature/discord-env-setup`, `feature/m0-core-web`.
- 각 대상은 열린PR/담당, 고유diff, 현행 구현·문서에 반영됐는지, 폐기된 prototype인지 대조한다. 필요한 미반영 변경만 후속 task로 분리하며 낡은 브랜치를 일괄 merge하지 않는다.
- 보관 가치만 있으면 검증된 bundle 또는 명시적인 archive tag로 복구 가능성을 남기고 branch 삭제 대상으로 제시한다. 고유 변경의 폐기 판단을 이름이나 오래된 날짜만으로 하지 않는다.
- 첫 실행의 완료 범위는 GIT-01~05와 확인 가능한 종료 브랜치 정리다. 위14개 심층 검토를 끝날 때까지 통합 완료 보고를 미루거나 자동으로 범위를 확장하지 않는다. 14개의 보존/검토 목록을 후속 범위로 인계한다.
- 임시 integration worktree는 원격 SHA 확인 후 깨끗한 상태에서 제거한다. release checkout이 해제된 뒤 root 폴더를 release로 옮길 수 있다. 현재 feature를 지우기 위해 다른 worktree를 강제 제거하지 않는다.

## 6. 복구·중단 조건

- 이번 계획은 실행 권한을 추가하지 않는다. 계획 요청이므로 현재 commit/push/merge/reset/branch 삭제/배포는 수행하지 않는다. 후속 실행 요청의 대상 범위에 맞춰 진행한다.
- 병합 도중 중단은 처음부터 깨끗한 작업 전용 worktree에서 `merge --abort`로 원상 복구한다. 기존 사용자 변경은 stash/reset/clean하지 않는다.
- 원격 반영 전 실패한 로컬 후보는 별도 복구 ref로 보존한 후 이번 작업이 옮긴 release와 작업 폴더만 시작 상태로 복구한다. 다른 담당 변경이 발견되면 자동 복구하지 않는다.
- 원격 반영 뒤에는 이력 강제 덮어쓰기 대신 보존할 내용·되돌릴 범위를 검토한 revert commit으로 복구한다. main과 실제 운영 배포 상태는 별도다.
- 완료 증거: local/remote release 동일, 통합 대상 보존, 필요한 검사 통과, main 동일·변경 없음, root dirty0, 삭제/보존 목록과 복구 지점 명시. Git 정리를 운영 인수·배포 완료로 보고하지 않는다.

## 7. 이번 계획에서 수행한 확인

- 원격 branch19개 실제 조회, local9개/worktree2개 목록, 조상 관계와 local/remote SHA 대조, prune dry-run, hook 상태 확인.
- merge-tree 사전 검사에서22개 충돌 확인. HEAD/index/branch를 옮기거나 실제 merge를 시작하지 않았다. preview용 미참조 Git tree 객체만 생성했다.
- 별도 m0-core dirty20+68을 읽기 전용으로 확인했다. 해당 폴더 파일 변경 없음.
- 계획 문서 상대 링크 5개·JSON·공백 검사 통과. 기존 조회 기록3개 SHA-256, HEAD/index, local9개·origin19개 ref, 별도 worktree 상태가 시작 기준선과 동일함을 확인했다. 앱 빌드/테스트/브라우저·원격 PR 목록은 이번 계획에서 미검증이다.
