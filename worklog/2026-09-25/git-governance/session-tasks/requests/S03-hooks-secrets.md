# S03 — Git hook·설정 복원과 비밀 탐지 분리

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-07 · GOV-08 · GOV-09 · GOV-10 · GOV-11 · GOV-12**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 현재 강제 연결 복원 후보; 단순 공백·비밀 검사는 선택 유지. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S03-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

설치된 hook을 안전하게 복원하고, 남기기로 선택한 검사만 task/branch 정책에서 분리한다. 호출 대상을 먼저 지워 Git 작업을 막지 않는다.

기본·governance·delivery·stash-recovery의 설치 4세트/16개 wrapper와 공통 Git 설정. 현재 기록은 정적 hash·실행권한·dispatcher 확인이며 runtime smoke 성공을 뜻하지 않는다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`.githooks/*`, `scripts/harness/hooks.mjs`, `check.mjs`, `secrets.mjs`, `tests/harness/hooks.test.mjs`와 관련 회귀; 각 gitdir의 `harness-hooks*`, `harness-post-commit.jsonl`, `config.worktree`, 실제 유효 `core.hooksPath`. `check.mjs`의 task/branch 부분은 S09와 공유하므로 담당 변경 단위를 먼저 정한다.

실제 Git hook 설정은 이 세션만 편집. S09는 hooks/check/secrets 공용 파일을 동시에 수정하지 않으며 연결 해제 결과 전에는 호출 대상을 삭제하지 않음.

## 수행 순서

1. S01의 설정/wrapper 원본을 확인한 뒤 worktree별 Git 공통 경로·개별 gitdir·config origin을 읽는다. 사용자 기존 hook과 governance wrapper의 연결을 구분하고 설치 전 값이 확인되는 복원안을 만든다.
2. 설정 복원 실행이 요청된 범위에서는 각 작업본의 연결을 설치 전 상태로 돌린 뒤 readback한다. 공유 `extensions.worktreeConfig`를 먼저 unset하지 않는다. 제거할 파일과 아직 필요한 CLI/policy를 구분한다.
3. 검사별 선택을 기록한다: pre-commit 공백/비밀/task 범위, commit-msg 제목/trailer, post-commit 기록, pre-push 이력/branch 제한. 단순 lint를 남긴다는 이유로 task trailer를 자동 유지하지 않는다.
4. 분리 유지 선택 시 비밀 패턴 4종과 전체 outgoing commit 순회·삭제된 비밀 회귀를 필요한 범위에서 추출한다. 비밀 값 원문을 로그에 쓰지 않는다. 광범위 비밀 탐지가 된다고 표현하지 않는다.
5. S09에 아직 사용하는 export/import와 삭제 가능한 wrapper/정책 연결 목록을 넘긴다. hook runtime 검증은 임시 저장소에서 수행하며 사용자 이력에 시험 commit/push를 만들지 않는다.

## 검증과 완료 조건

- 4개 작업본의 before/after 유효 hook 경로와 wrapper 보존/복원 상태. 다른 사용자 hook·공유 quality 도구·타 worktree 설정 보존.
- 유지한 경우 정상/거부 commit 메시지, staged 범위·symlink·비밀 후보, outgoing 이력의 기존 관련 회귀를 임시 저장소에서 실행.
- 철회한 경우 사라진 스크립트를 가리키는 활성 wrapper/설정이 없는지 확인. 실제 push는 하지 않음.

완료 조건:

- 선택한 hook 연결이 복원 또는 정상 분리되고 작업본별 검증이 기록됨.
- 남길 검사와 철회할 task/branch 강제의 경계가 S09/S10에 전달됨. 새 hook 설치는 선택된 실행 범위일 때만 적용.

중단/보존 조건:

- 설치 전 hook 값이나 wrapper 소유를 확인할 수 없으면 해당 연결을 추정 복원하지 않음.
- 다른 세션이 설정을 바꾸거나 같은 작업본에서 Git 작업 중이면 해당 설정 변경을 조율할 때까지 보존.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

작업본별 설정 전후, 유지한 검사 진입점·명령·범위, S09의 삭제 제외 파일, 필요한 package/CI 변경 요구를 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S03 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S03-hooks-secrets.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S03-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-07 — worktree별 hook 설치·복원

- 분야/중요도: 로컬 Git 설정 / High.
- 근거: `scripts/harness/hooks.mjs:27`·`:90`, `.githooks/*`, 각 gitdir의 `config.worktree`, `harness-hooks.json`, `harness-hooks/`. 실제 위치와 파일 hash는 JSON에 기록했다.
- 진척: installer/remover, 기존 hook 연결과 wrapper hash 검사, 설치 거부 조건이 구현됐다. 기본·governance·delivery·stash-recovery 4곳에 설치 메타데이터가 있다.
- 문제: 새 T1 worktree는 기본 hook 경로를 상속했으나 해당 branch의 CLI·policy·메타데이터가 없어 연결 준비가 필요했다. T1 worktree는 이미 제거됐다. 설치 메타데이터 4개가 현재 모든 hook의 정상 실행을 증명하지는 않는다.
- 유지/원복: 먼저 wrapper·설정 원본을 보관하고 각 worktree를 설치 전 연결로 복원한다. 소스부터 지우면 commit/push가 계속 실패할 수 있다. `extensions.worktreeConfig`는 여러 worktree의 다른 설정을 확인하기 전에 공유 값부터 제거하면 안 된다. lint 도구가 공통 gitdir를 쓰는 점도 GOV-15와 함께 고려한다.

### GOV-08 — pre-commit: staged 검사

- 분야/중요도: 커밋 전 검사 / High.
- 근거: `scripts/harness/check.mjs:125`, `hooks.mjs:172`, `.githooks/pre-commit`, `tests/harness/hooks.test.mjs`.
- 진척: index의 공백·비밀 후보·task 허용 경로와 삭제 경로를 검사한다. staged symlink는 링크 대상 파일을 따라 읽지 않는 회귀가 있다. 회귀 step 성공.
- 미완료: task 정책과 없는 branch에 hook이 상속되는 상황의 실제 사용 수용. 현재 pre-commit은 전체 lint를 자동 수행하는 hook이 아니다.
- 유지/원복: 공백·비밀 검사는 독립 후보다. task allowlist 부분을 그대로 두면 GOV-02를 제거할 수 없다. 실제 설치 wrapper는 GOV-07 절차로 다룬다.

### GOV-09 — commit-msg: 형식·Task-Id·Change-Id

- 분야/중요도: 커밋 메시지 정책 / Medium.
- 근거: `scripts/harness/hooks.mjs:140`, `.harness/policy.json`, `.githooks/commit-msg`.
- 진척: Conventional Commit 형식, branch task와 trailer 일치, 활성 task·등록 UUID 검사를 구현했다. 회귀 step 성공.
- 미완료: 기존 8개 commit에는 이 trailer가 없으며 새 정책의 도입 기준선 처리와 통합이 남았다. 기존 SHA를 보존한 채 과거 이력을 새 형식으로 바꾸는 것은 불가능하다.
- 유지/원복: 메시지 제목 규칙만 선택적으로 남길 수 있다. task trailer 강제는 GOV-02·20·24와 연결되므로 개별 해제만으로 전체 정책이 사라지지는 않는다.

### GOV-10 — post-commit 기록

- 분야/중요도: 로컬 작업 이력 / Low.
- 근거: `scripts/harness/hooks.mjs:186`, `.githooks/post-commit`, gitdir의 `harness-post-commit.jsonl`.
- 진척: commit SHA·branch·task/change 식별 기록과 기록 실패가 commit 성공을 뒤집지 않는 동작을 구현했다. 회귀 step 성공.
- 미완료: 실제 기록의 장기 보존·조회 운영 수용은 별도다. JSONL 존재를 외부 수신 또는 CI 성공으로 해석하지 않는다.
- 유지/원복: 기존 기록은 archive 후보다. 자동 기록을 제거해도 제품 기능에는 직접 영향이 없지만 wrapper·메타데이터는 GOV-07과 함께 정상 복원한다.

### GOV-11 — pre-push: 전체 이력·push 제한

- 분야/중요도: 전송 전 검사 / High.
- 근거: `scripts/harness/check.mjs:196`·`:271`, `.githooks/pre-push`, `tests/harness/hooks.test.mjs:152` 이후.
- 진척: 마지막 파일 상태뿐 아니라 전송되는 모든 commit, 삭제된 비밀, merge 해소 시 유입된 내용, shallow/원격 객체 부재를 검사한다. 직접 보호 branch push·force update 제한과 synthetic remote 회귀가 있다.
- 미완료: 최신 #7~#9 CI의 실제 유입 이력 scan은 선행 실패로 skip이다. helper 회귀 성공을 실제 PR 이력 scan 성공으로 대신할 수 없다.
- 유지/원복: 비밀 이력 검사는 분리 유지 후보다. branch 직접 push·삭제·force 정책은 GOV-01과 따로 선택한다. pre-push만 제거해도 서버 보호가 새로 생기는 것은 아니다.

### GOV-12 — 비밀 탐지 엔진의 범위

- 분야/중요도: 보안 검사 / Medium.
- 근거: `scripts/harness/secrets.mjs:1`.
- 진척: private key, AWS access key ID, 일부 GitHub token, Slack token 패턴 4종을 탐지하며 값 원문을 오류에 출력하지 않는 흐름이 있다.
- 한계: 모든 token 형식, 비밀번호, 임의 `.env` 비밀, binary 내용을 포괄하는 범용 DLP가 아니다. 이 검사 통과만으로 비밀이 전혀 없다고 주장할 수 없다.
- 유지/원복: 가벼운 보조 검사로 분리 유지할 가치가 있다. checker를 추출할 경우 GOV-11의 전체 이력 순회와 회귀도 함께 가져와야 한다.
