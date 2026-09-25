# 개발 harness 구현 계획

> 2026-09-25 전달 상태: 현재 checkout은 검토용 `feature/HARN-09-ci-diagnostics`다. 원본 stash와 복구 branch `5957492`, 기존 PR #1/#2를 보존하고 새 Draft PR #3~#8을 생성했다. 실제 분리 범위·검증·선행 관계는 [CI 복구·전달 기록](../../worklog/2026-09-25/git-governance/CI-RECOVERY.md)을 따른다. develop 통합·원격 보호·배포는 미완료다.

- 작성: 2026-09-25. 설계 정본: [Git 브랜치 전략과 개발 harness](git-workflow.md).
- 상태: **HARN-01~07 부분 구현, stash 복구 6단계 커밋 완료.** 복구 branch의 전체 lint(SQL 27개·finding 0), harness 52/52, quality 10/10, architecture 9/9와 앱·DB·브라우저 검증을 통과했다. 원격 develop 생성·tracking은 완료했지만 기존 작업 통합은 남았다. PR #1 verify 실패, PR #2 event-context/harness-gate 실패·8개 skip이며 원격 보호는 미활성이다. 상세 SHA·범위·로그는 [복구 결과](../../worklog/2026-09-25/git-governance/STASH-RECOVERY.md)를 따른다.
- HARN-01~~07은 개발 도구 구현 계획의 로컬 task 식별자다. 현재 복구 checkout에는 HARN-06·07·08 manifest가 있다. 후속 CI 수정을 위한 HARN-09는 정확한 9개 경로와 두 Change-Id로 등록안을 작성했으며 trusted base 반영은 대기 중이다. [CI 복구 계획](../../worklog/2026-09-25/git-governance/CI-RECOVERY.md)을 따른다. HARN-01~~05는 구현 PR의 task/change 범위를 확정할 때 별도 manifest가 필요하며, 이 계획 번호는 외부 발급 ID가 아니고 [기존 제품 task 17개](../implementation-tasks/README.md)의 수량·상태를 바꾸지 않는다.
- 아래 P0/P1/P2는 개발 도구 내부 구현 우선순위다. 기존 Core 출시·Collector 활성화 우선순위와 별도로 운영한다. 시작일·납기·담당자는 `(미정)`이며 공수나 날짜를 임의 확정하지 않는다.

## 1. 구현 원칙과 제외 범위

1. Node CLI 하나와 공통 정책 엔진을 만들고 기존 npm·Gradle·PostgreSQL·브라우저 runner를 재사용한다. 새 웹 관리 화면이나 중앙 DB를 만들지 않는다.
2. 작업·검증·승인·전달 상태를 분리한다. 문서화 요청을 구현·설치·commit·push·원격 설정 승인으로 확대하지 않는다.
3. 각 task는 독립적으로 리뷰·되돌리기 가능한 변경 단위다. 아래 커밋명은 실행 시 사용할 제안이며 이번 문서화에서 커밋하지 않는다.
4. 제품 요구사항·법무 placeholder·배포 계약을 복제하지 않고 링크한다. 민감한 설정과 테스트 데이터는 기존 격리 규칙을 따른다.
5. 최초 도입부터 모든 AI 도구의 편집 차단을 보장하지 않는다. 공통 CLI·Git·CI를 우선 구현하고 도구별 adapter는 실제 지원 범위를 확인한다.
6. 기존 브랜치 정리, 자동 push·merge·배포, S2B 관리대장 연결, 공수 통계와 활동 추적 대시보드는 제외한다.

## 2. 순서와 의존성

| ID      | 우선순위 | 변경 단위                               | 선행                             | 상태                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | -------- | --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HARN-01 | 도구 P0  | branch role·task policy·CLI·doctor      | 이 설계                          | 부분 구현: branch role·PR 방향·활성 manifest·staged 및 PR 변경 경로 allowlist·doctor. CI는 trusted base의 정책/manifest를 읽고 정책 파일 자기확장은 governance review로 차단; schema 검증 보강 대기; read-only resume은 HARN-02에 구현                                                                                                                                                                                          |
| HARN-02 | 도구 P0  | develop 기반 worktree·자원 소유권·재개  | HARN-01                          | 부분 구현: `start`는 manifest를 검증하고 local `develop`과 `origin/develop` SHA 불일치를 차단; `verify`의 OS advisory lease가 task/resource 충돌을 막고 `lease hold`가 지정 task를 점유. read-only `resume`은 lock과 evidence freshness를 비교; 작성 세션 자동 heartbeat·다중 host 조정은 미구현. Windows `msvcrt` 경로는 전용 `windows-leases` CI job과 최종 gate에 연결했다; 이 환경에서 Windows runner 실행 결과는 아직 없음 |
| HARN-03 | 도구 P0  | 검증 runner·증거·ready/handoff          | HARN-01, HARN-02                 | 부분 구현: 고정 npm 검증 명령 5종·로컬 evidence·ready/handoff, PR/push/manual CI event identity·changeBindings와 job별 receipt artifact를 추가하고 회귀; 원격 artifact readback 대기                                                                                                                                                                                                                                            |
| HARN-04 | 도구 P0  | Git hook·이력 검사·worktree별 설치/복원 | HARN-01, HARN-02, HARN-03        | 부분 구현: pre-commit/commit-msg/post-commit/pre-push·이력 scanner·per-worktree installer와 synthetic bare remote 회귀; 원본 worktree 네 hook smoke 및 복구 worktree 별도 설치·commit 검증; 다른 세션 worktree 보존                                                                                                                                                                                                             |
| HARN-06 | 도구 P0  | 전체 lint·architecture 검사·정책 예외   | HARN-01                          | 부분 구현: baseline fingerprint/candidate 비교기와 회귀를 구현하고 CI가 target base SHA의 baseline을 사용. lint scope 0건과 SQLFluff/Stylelint 빈 보고서를 차단하는 helper 및 regression 추가. Architecture 9개 통과; Ruff/ShellCheck/actionlint 통과. SQL 27개 파일 전체 lint 0건; 포맷된 migration의 checksum evolution 계약과 기존 ledger 호환을 회귀 검증                                                                   |
| HARN-05 | 도구 P0  | branch-aware CI gate·원격 보호 활성화   | HARN-03, HARN-04, HARN-06        | 부분 구현: quality job·필수 Windows lease 회귀·PR 방향·이력 scan·동일 workflow SHA 조건부 Core restore·harness-gate·공통 event-context와 각 job receipt artifact 단계 추가; 첫 원격 실행은 base policy 부재로 실패; 진단 artifact 분리 로컬 검증 완료; 후속 job 실행/readback·보호 대기                                                                                                                                         |
| HARN-07 | 도구 P2  | release 증거·후보 대조                  | HARN-03, HARN-05, 현행 배포 계약 | 부분 구현: read-only manifest checker가 candidate SHA·등록 Change-Id·CI/lint/architecture/image/DB/restore·rollback 일관성을 검사하고 max backup age를 요구; merge-back CLI는 release/hotfix 대상 ref ancestry를 판정. provider record/artifact readback과 배포 증명은 미검증                                                                                                                                                   |

실행 순서는 HARN-01 → HARN-02 → HARN-03 → HARN-04와 HARN-06 → HARN-05 → HARN-07이다. HARN-06의 lint·architecture와 HARN-03의 PR/push/manual changeBindings 문맥 및 개별 receipt는 workflow gate에 연결됐다. 작성 세션 자동 heartbeat, 원격 receipt readback과 보호 검증은 남았다. Windows lease 전용 CI job은 harness gate에 연결했으나 GitHub runner에서의 첫 실행은 미검증이다. 이 task 순서는 branch 생성/원격 ruleset 허가가 아니다. 별도 에이전트 자동 위임이나 동시 실행 승인이 아니다. 같은 정책·runner 파일을 동시에 수정하지 않도록 실제 구현자가 범위를 배정한다.

### 저장소 branch 전환 선행 조건

후속 전달은 완료했다. 기존 8개는 Draft PR #4에 SHA 그대로 두었고, 브라우저 #3·정책 #5·cleanup #6·harness #7·진단 #8로 분리했다. 현재 feature base들은 차등 검토용이며 실제 통합은 선행 PR 검토 후 develop로 retarget해 재검증한다. commit·push·Draft 생성 승인을 merge·보호 설정 승인으로 확대하지 않는다.

사용자 선택에 따라 기존 local main의 8개 commit을 별도 PR로 먼저 검토한다. 모두 Task-Id/Change-Id trailer가 없으므로 이력 재작성 없이 새 gate 활성화 전 도입 기준선으로 검증한다. 브라우저 선행 결함 수정 → 기존 8개 검토 → 정책/task 등록 → 앱·SQL cleanup → harness 활성화 순서와 각 수용 조건은 [CI 복구 계획](../../worklog/2026-09-25/git-governance/CI-RECOVERY.md)에 둔다. 정책 PR과 기존 main 사이의 설계 문서 2개 add/add 충돌은 계산으로 확인했으며 실제 해결·병합은 하지 않았다. 도입 후 policy/manifest 변경을 위한 전용 governance gate도 미구현이므로 원격 필수 검사 활성화 전에 경로를 검증해야 한다.

초기 inventory에는 develop이 없었지만 이후 사용자가 운영 SHA `8af72449a7d56c9701efd0d73dc7d430a66f9610`을 기준으로 선택했고 local/remote develop 생성·tracking을 마쳤다. 최신 `git ls-remote`에서도 origin/main·develop·단일 release가 해당 SHA다. local main `e51f1b5`의 기존 8개 commit과 복구 commit은 `feature/HARN-08-stash-recovery`에 있고 develop에는 미반영이다. 원본의 미추적 파일·stash·다른 세션 worktree를 보존했다. HARN-02의 develop 부재 차단은 현재 발생 중인 장애가 아니라 회귀 계약이다. PR #1/#2의 통합 순서와 별도 보호 설정은 [로드맵](../roadmap.md)의 P0 항목으로 남긴다.

실제 branch 정책을 켜기 전 별도 실행에서 local/remote ref, 전체 worktree, dirty/untracked, unique commit, branch owner, 현재 production SHA를 목록화한다. 기준 SHA·기존 작업을 `develop`으로 옮길지/보존할지 승인 없이 추정하지 않는다. `develop` branch 생성, 기존 branch merge/rebase/delete, default branch나 ruleset 변경, push는 별도 사용자의 명시 요청·권한이 있어야 한다. `develop`이 없는 동안 HARN-02 `start`는 BLOCKED로 종료하고 `main` fallback/branch 자동 생성/push를 하지 않는다. feature/m0-core 등 in-flight branch는 이 정책으로 자동 전환하지 않는다.

## 3. 제안 파일 구조

아래는 구현 경로와 계획 경로를 함께 보인다. 현행 여부는 저장소 상태에서 재확인한다.

```text
.harness/
  policy.json                 # 구현: branch role·PR·commit 정책
  schemas/                    # 계획: task·policy·evidence 검증 schema
  tasks/<task-id>.json        # 구현: 등록 manifest
.githooks/
  pre-commit                  # 구현
  commit-msg                  # 구현
  post-commit                 # 구현: 로컬 SHA/task/change 기록, 실패는 commit 결과와 분리
  pre-push                    # 구현
scripts/harness/
  cli.mjs                     # 구현: doctor/check/start/hooks/PR/range 진입점
  git.mjs                     # 구현: 안전한 Git 프로세스 adapter
  secrets.mjs                 # 구현
  check.mjs                   # 구현: staged/task-range/outgoing history
  branches.mjs                # 구현: branch role·PR 방향·start
  hooks.mjs                   # 구현: worktree install/remove/dispatch
  restore-scope.mjs           # 구현: Core/Collector restore 분류
  verify.mjs                  # 구현: 고정 allowlist 검증 및 로컬 증거·readiness·handoff
scripts/quality/
  lint-all.mjs                # 부분 구현: local·CI 공통 언어 lint와 formatter 진입점; 현재 local finding 0, future exception baseline 계약 유지
  eslint.config.mjs           # 구현: scripts/tests MJS lint 설정
  policy.json                 # 계획: 전체 언어별 linter/version/예외 계약
tests/harness/
  *.test.mjs                  # 구현: Git/worktree/policy/restore 분류 회귀
tests/architecture.test.ts   # 구현: API/Collector/Web/contracts 의존 경계
.quality/
  baseline.json               # 미생성: 승인본만 허용; draft는 .quality/baseline.candidate.json에 별도 생성
apps/collector/config/checkstyle/checkstyle.xml
.quality/requirements.txt     # 구현: Python lint 도구 및 의존성 version 고정
```

- 로컬 소유권·실행 메타데이터는 Git이 알려주는 common directory 아래의 전용 영역, 큰 결과물은 Git 제외 출력 영역을 사용하는 안으로 구현 시 확정한다. `.git` 문자열을 하드코딩하지 않는다.
- 실제 사용자 홈·worktree 경로·승인 대화·비밀을 추적 설정에 넣지 않는다. CI에는 필요한 검증 결과만 artifact로 남긴다.
- 문서 진입점과 상태 요약은 기존 [AI 안내](README.md), [task 목록](../implementation-tasks/README.md), [status](../status.md), [roadmap](../roadmap.md)을 사용한다.

## 4. 작업별 구현 계약

### HARN-01 — 정책·task·doctor

- 변경 범위: `.harness/policy.json`, schema, `cli.mjs`, `policy.mjs`, `git.mjs`, `doctor.mjs`, `scripts/harness/eslint.config.mjs`, `package.json`의 진입·test/lint script, 관련 테스트.
- 내용: task 정본 참조·유효성, branch role·허용 base/target 규칙, 검사 profile, Git 상태/HEAD/worktree·hook 설정 출처와 필수 환경 진단. branch 정책은 §2 flow와 같은 schema이며 문자열 prefix만으로 release 권한을 인정하지 않는다. runtime/tool version은 저장소의 pinned source에서 읽는다.
- 필수 동작: 조회 명령이 파일·Git 설정·네트워크를 임의 변경하지 않음. 없는 `develop`·task·검사기·정본·잘못된 schema를 이유와 함께 표시. path escape·symlink 경계를 처리.
- 수용: 임시 저장소에서 정상/누락/손상 입력을 구분하고, `doctor` 실행 전후 Git 설정·index·사용자 파일이 동일함. 존재하는 task 참조만 인정.
- 검사 연결: `test:harness`는 `tests/harness/*.test.mjs`를 Node test runner로 실제 실행하고 report·실행 테스트 수를 확인한다. `lint:harness`는 harness source·test의 `.mjs`를 명시적으로 포함한다. 기존 `test`·`lint:scripts`·`lint:tests`의 TS 전용 glob이나 typecheck가 이를 검사한다고 가정하지 않는다. 테스트 0개·필수 report 누락·의도적으로 넣은 실패 테스트와 lint 위반이 비정상 종료되는지 검증한다. HARN-05에서 이 두 명령을 필수 CI job에 연결한다.
- 커밋 제안: `feat(harness): add policy contracts and doctor`.

### HARN-02 — 작업 공간·자원·재개

- 변경 범위: `workspace.mjs`, `git.mjs`, CLI의 start/resume, 로컬 실행기와 연결하는 최소 adapter, 관련 테스트.
- 내용: 등록된 task ID로 `feature/<task-id>-<slug>`를 `develop`에서 준비하고 repo/task/change/worktree/run을 연결한다. `start`는 local `develop`과 `origin/develop`이 존재하고 SHA가 정확히 같을 때만 기준으로 사용한다. 프로세스 생명주기에 묶인 OS advisory lease가 task 및 선언 resource 충돌을 막는다. `verify`는 lease를 자동 취득·반납하고, 장시간 작업은 `lease hold <task-id>`로 명시 점유한다. `resume <task-id>`는 evidence·checkout·현재 lock을 읽기 전용 비교하며 실행 ownership을 자동 취득하지 않는다.
- 필수 동작: `develop` branch/ref 부재, stale 기준 SHA 또는 role mismatch면 BLOCKED. `main` fallback·원격 branch 생성/push·기존 branch 재작성 없음. 원본 dirty/untracked를 보존하고 기존 branch/worktree 재사용 여부를 표시한다. 자원 실패 시 이번 실행 자원만 정리.
- 수용: feature base가 fetched `origin/develop`과 같은지 확인하고 PR target이 develop인지 판정한다. 원격 branch 보호 설정의 실제 승인 여부는 `start`가 증명하지 않으며 HARN-05 readback 대상으로 남긴다. release/hotfix 작업은 별도의 branch role·policy 경로를 요구한다. 두 실행의 자원 충돌과 stale lease를 구분하며 다른 작업의 폴더·PID·DB를 정리하지 않는다.
- 커밋 제안: `feat(harness): isolate task workspaces and resume state`.

### HARN-03 — 검증·증거·인계

- 변경 범위: `verify.mjs`, `evidence.mjs`, CLI verify/ready/handoff, 기존 runner adapter, schema와 관련 테스트.
- 내용: 고정된 소스 스냅샷에서 허용된 profile 실행, 입력 hash·환경·검사·결과 기록, CI/로컬/수동 증거 분리, task 요약·다음 행동 생성.
- 필수 동작: runner를 임의 shell 문자열로 받지 않음. build 산출물 재사용 때문에 다른 소스를 검증하지 않음. 실행 전후 입력 변경·missing report·timeout·0 tests·skip을 명시적으로 판정.
- 수용: SHA·branch role/base·policy·lockfile·필수 환경 변경 시 이전 증거 무효화, 결과와 source hash의 순환 없음. 수동 기록을 자동 통과로 승격하지 않음. 비밀이 artifact에 포함되지 않음.
- 식별 계약: [설계](git-workflow.md) §8.3·§9.1의 `changeBindings`와 `executionContext` schema를 구현한다. PR head/base/merge-result, main/develop/release before/after와 여러 변경, 수동 target/base/change 집합을 구분한다. CI의 로컬 `worktreeId`는 null로 두고 provider run/job/attempt·checkout ID를 기록한다. 자동 merge trailer 부재는 검증된 변경 연결로 처리하며 연결 누락·상충·다른 SHA 결과 재사용은 차단한다.
- 커밋 제안: `feat(harness): record verification evidence and handoffs`.

### HARN-04 — Hook·설치·복원

- 변경 범위: `.githooks/`, installer/restore 진입점, 공통 검사와 관련 테스트. 설치 명령과 단순 npm 의존성 설치를 분리한다.
- 내용: 빠른 index 검사, commit 메시지, 모든 push ref/SHA와 전송 이력의 비밀 검사, commit 뒤 로컬 기록. 지정 worktree 설치·기존 hook 보존·재귀 방지·원상 복원.
- 필수 동작: 부분 staging, 임시 index, 공백·한글·rename·삭제 경로 처리. 전송 이력에서 삭제 경로는 blob 검사를 건너뛰고, 추가·변경 경로와 merge resolution 최종 tree는 검사한다. feature/hotfix staged path는 활성 task manifest allowlist와 대조하고, CI PR path 대조는 base SHA의 trusted manifest를 사용한다. 정책·해당 task manifest의 자기수정은 governance review로 분리한다. 필수 validator가 없으면 차단. post-commit은 외부 전송이나 추가 commit을 실행하지 않음.
- 수용: 임시 저장소에서 실제 commit·로컬 bare remote push로 검증. 기존 hook의 결과·호출 순서 보존, 재설치 멱등, linked worktree 설치·실행·복원 성공. 실제 사용자 remote에는 테스트 push하지 않음.
- 이력 검사: [설계](git-workflow.md) §7.1대로 기존 ref의 old/new 범위, 새 branch 전체 도달 이력, 다중 ref, tag 메시지·이력, 삭제·0 OID를 처리한다. 중간 commit에서 비밀을 추가한 뒤 삭제해도 전송 전에 차단해야 한다. shallow/객체 부재는 BLOCKED/ERROR로 처리하고 hook에서 fetch하지 않는다. 최종 SHA의 앱 검증 증거로 이력 검사를 대신하지 않는다.
- 설치 범위: installer는 §7.2대로 대상 worktree의 `core.hooksPath`만 설정하며 기존 custom `core.hooksPath`가 있으면 덮어쓰지 않고 차단한다. `extensions.worktreeConfig` 비활성 시 공통 설정을 자동 변경하지 않는다. 격리 Git worktree A/B에서 A 설치·기존 hook chain·A 제거와 B 무변경을 검사했다. 실제 적용에서는 기존 worktree config와 hook 경로가 없는 것을 확인한 뒤 확장을 켜고 main에 설치했다. dirty feature worktree의 설정·파일은 바뀌지 않았다.
- 커밋 제안: `feat(hooks): enforce task scope and verify outgoing commits`.

### HARN-05 — CI gate·원격 보호

- 변경 범위: 기존 `ci.yml`, 필요한 정책 검증 runner, CI 결과 schema·회귀. 원격 ruleset 변경은 별도 실행 단위로 보고한다.
- 내용: `main`, `develop`, `release/**` PR/push 검증으로 기존 verify·collector를 유지하면서 필수 `quality`(전체 lint+architecture), `harness`, 이력 비밀 검사, 조건부 `restore` job과 최종 `harness-gate` 추가. `hotfix/**`는 PR로 main에 검사. 이미지 게시에는 main의 gate 성공만 연결한다.
- 필수 동작: PR target별 source/target role·merge-result SHA를 검증하고 PR 전체 workflow를 path filter로 생략하지 않음. 실패·취소·예상 외 skip 때 gate 실패. workflow 전체 취소로 gate 자체가 미실행이면 성공 check 부재로 병합·이미지 게시 차단. main/develop/release SHA와 main image SHA를 구분.
- Branch matrix: feature→develop, release→main와 develop, hotfix→main 후 배포 뒤 develop 및 각 활성 release 재반영. `develop`에는 production images를 publish하지 않는다. release branch의 후보 build는 production tag/push 없이 검증한다.
- Quality job: 현재 `npm run test:harness`, `npm run test:quality`, `npm run lint:harness`, `npm run lint:all`, `npm run test:architecture`를 실행한다. `lint:all` 내부에서 native tool 설치 뒤 `npm run test:quality:tools`를 필수 실행해 TS/MJS/Vue·Java·Python·SQL·shell·CSS·Markdown·GitHub Actions·Prettier의 정상·위반 fixture를 확인한다. `lint:all`은 저장소 전체 SQL 27개를 포함해 exact candidate fingerprint를 검사한다. 현재 finding 0건으로 approved exception baseline 없이 로컬 통과하며, finding 발생 시 기존 trusted-base 승인 baseline이 필요하다. CI 비교 기준은 PR base SHA에서 읽는다. 단, workflow와 검사기 source/config는 현재 event subject checkout에서 실행되므로 trusted-base execution은 미구현이다. governance 경로 보호 또는 trusted-ref required workflow를 원격에서 readback하기 전에는 self-weakening 방지가 완료된 것으로 보지 않는다.
- Harness job: HARN-01의 `npm run test:harness`, `npm run lint:harness`를 매 실행의 필수 job에서 호출하고 테스트 실행 수·report를 gate가 확인한다. `.mjs` 테스트 실패·lint 위반·0 tests로 gate가 실패하는지 검증한다.
- Restore job: [설계](git-workflow.md) §9.2 경로 분류를 구현하고 PR/main/develop/release의 동일 subject SHA에서 Core와 Collector 전용 restore job을 분리 실행한다. Core는 기존 schema restore runner를 사용하고 Collector는 `npm run test:collector:restore`로 임시 PostgreSQL source/restore 두 개, full custom archive, schema·row·sequence readback, restore 후 migration idempotency를 확인한다. 변경 영역별 job 성공·skip을 최종 `harness-gate`가 강제한다. 일반 변경은 분류 output에서 둘 다 false일 때만 restore job skip을 허용한다. 별도 예약·수동 workflow는 운영 점검으로 유지하고 다른 SHA의 성공으로 gate를 채우지 않는다.
- 이벤트 입력: HARN-03 schema에 PR/main/develop/release/수동 이벤트 adapter를 연결한다. 모든 job이 같은 SHA·변경 집합을 검사하는지 대조한다. 이력 비밀 검사는 중간 commit까지 포함하며, push 이후 CI 검사로 이미 전송된 비밀 노출을 막았다고 보고하지 않는다.
- 정책 신뢰: 기준 정책/runner와 후보 정책을 구분한다. 정책 변경자가 workflow까지 고칠 때의 우회 가능성을 검토하고 신뢰 실행 주체·보호 기능의 실제 지원을 확인한다.
- 수용: workflow 정적 검증과 HV-20/21/23/24~31 회귀 후 실제 허용된 develop/feature PR, release PR, hotfix PR 및 main release SHA에서 성공·필수 실패 차단 확인. 실패 시험은 비밀 없는 synthetic fixture로 수행한다. workflow·lint·architecture·baseline/policy 변경을 보호할 trusted-ref required workflow 또는 base 기준 code-owner review를 구성한다. 그 후 각 보호 대상의 stable check 이름을 원격 필수 검사로 등록하고 설정을 readback. 원격 검증 전에는 로컬/YAML 검증 완료까지만 보고한다.
- 원격 전제: 저장소 공개 범위·요금제·관리 권한·검토자·현재 ruleset `(미정)`. 불가능하면 강제력 미완료로 남기고 로컬 성공으로 대체하지 않는다.
- 커밋 제안: `ci: require harness gate before publishing images`.

### HARN-06 — 전체 lint·architecture 검사와 정책 예외

- 변경 범위: root/package lint script·config, `.quality` language/tool policy와 exact baseline candidate/comparator, Gradle Checkstyle, Python/SQL/shell/Markdown/CSS/Action YAML linter 설정, 전체 architecture checker·회귀.
- 구현 착수 전 baseline: API/Web/contracts 각각 ESLint script가 있었으나 CI verify에 전체 적용 gate가 없었다. root CI는 TS scripts/tests lint만 호출했고 Java style linter·명시 architecture gate는 없었다. SQL·shell·Python·Markdown·CSS 전용 lint도 확인되지 않았다. 상세와 현재 적용 결과는 [설계 §8.2](git-workflow.md).
- 명령 계약: root `npm run lint:all`, `npm run format:check`, `npm run test:architecture`, `npm run test:quality`, `npm run test:quality:tools`를 제공한다. lint runner는 필수 source scope가 0개인지 검사하고 모든 하위 도구를 실행한 뒤 실패 목록을 모은다. SQLFluff·Stylelint는 입력 대상과 결과 file set이 일치하는지 확인하고 빈·잘못된·누락·중복·추가 경로 보고서를 거부한다. `test:quality`는 0 scope·빈 보고서·잘못된 SQL 보고서를 검증한다. `test:quality:tools`는 TS/MJS/Vue·Java·Python·SQL·shell·CSS·Markdown·GitHub Actions·Prettier 도구마다 통과 fixture와 실패 fixture를 실행하며 `lint:all`에서 필수 단계로 돈다. `lint-debt.mjs --draft`는 승격되지 않는 candidate를 만들고, gate는 path/fingerprint/source hash/config hash/version/owner/reason/expiry를 검증한다. CI는 PR target base SHA의 baseline만 신뢰한다. 현재 candidate 항목은 0개라 로컬 lint는 통과하고 승인 baseline은 요구하지 않는다. 향후 finding이 생기면 승인 예외가 없는 신규 finding·예외 확대·만료는 차단한다.
- 언어 적용: JS/TS/Vue는 기존 package ESLint, Collector Java는 Checkstyle 14.1.0, Python은 Ruff 0.16.9, PostgreSQL SQL은 SQLFluff 4.3.0, shell은 체크섬 검증된 ShellCheck 0.11.0, CSS는 Stylelint 17.15.0, Markdown은 markdownlint-cli2 0.23.3, GitHub Actions workflow는 actionlint 1.7.12를 사용한다. Markdown MD024는 여러 API endpoint 아래의 반복 Request/Response template을 허용하도록 siblings-only로 설정하되 동일 부모의 중복은 계속 차단한다. Prettier 3.9.6은 hash-locked migration·contract 파일을 제외한 전체 포맷 후 `format:check` 통과를 확인한다. Ruff·ShellCheck·actionlint도 통과했고, SQLFluff는 저장소 전체 SQL 27개를 검사하며 현재 위반 0건이다. migration 변경 전·후 hash는 evolution contract로 관리하고 기존 ledger가 보유한 이전 hash만 런타임 전환 허용한다. Stylelint·Markdownlint도 현재 위반 0건이다. native 설치기는 `darwin-arm64`와 `linux-x64`만 지원하고 full lint CI는 Ubuntu에서 실행한다. Windows는 lease job만 있으며 full lint 검증이 없다. 일반 YAML schema와 Gradle Kotlin DSL 전용 lint도 적용하지 않는다.
- Architecture 규칙: [system-design/08-code-structure](../system-design/08-code-structure.md), §8.2의 edge 방향·layer contract를 AST/package graph로 검사한다. TS runtime/type/dynamic import, `@`·`~` alias, Vue script, workspace export·package dependency와 Java package/import·Gradle project dependency를 해석한다. API persistence 경계, API feature allowlist, Collector package/cycle/site isolation, Web→HTTP/contracts, 앱 간 source 역참조 금지를 검사한다. directory-name regex 하나로 검사하지 않는다. reflection·동적 문자열 등 미해석 edge는 manual review/BLOCKED다.
- 예외와 config 보안: 기존 위반은 exact `ruleId+path+fingerprint`, 이유, owner, expiry로만 등록한다. 신규/수정 라인의 위반과 만료 항목은 실패한다. config/lock/policy/baseline 변경은 trusted base version의 검사와 후보 version의 전체 검사를 모두 통과해야 한다. wildcard exception, baseline 자동 갱신, CI warning 허용을 금지한다.
- 수용: 언어 fixture별 rule 위반·누락 tool·빈 입력·report 부재가 실패, 전체 local/CI 명령·config hash·대상 파일 목록 일치, 의도된 금지/허용 edge와 cycle·alias·dynamic import 검사, 예외 확대·만료 차단. 저장소 전체 SQL 27개를 포함한 `lint:all`이 로컬에서 통과한다. CI 원격 실행과 trusted-base 보호 적용은 별도 미검증이다. 기존 전체 검사와 결과를 비교하기 전 path optimization 없음.
- 커밋 제안: `build: enforce workspace lint and architecture contracts`.

### HARN-07 — Release 증거 대조

- 변경 범위: release-check, release manifest/version·배포 증거 adapter, 기존 배포 문서 연결과 테스트.
- 내용: `npm run harness -- release-check <manifest.json> --max-backup-age-hours <hours>`가 `release/<version>` scope freeze manifest를 읽고 후보 SHA에 묶인 CI·lint/architecture·image digest·DB 호환·백업/복원·rollback evidence 사이의 consistency를 대조한다. task manifest의 Change-Id는 후보 commit tree에서 확인한다. `merge-back-check <release-or-hotfix-branch>`는 release/hotfix source branch가 요구된 `origin/*` remote-tracking refs의 조상인지 읽기 전용으로 확인한다. release version/tag 정본이 확정될 때까지 version 의미는 호출자가 공급한다.
- 필수 동작: 실제 deploy/migration·외부 발송·수집 flag 활성화 없음. DB readiness와 backup freshness를 시간·환경별로 평가. stale 운영 관측을 현재 사실로 재사용하지 않음.
- 수용: fixture에서 잘못된 SHA/digest·만료 백업·비호환 DB·누락 task/evidence와 release/hotfix merge-back 누락을 차단한다. release evidence 명령은 입력된 evidenceRef와 artifact hash의 consistency 검사이며 provider API를 호출하거나 artifact bytes를 fetch하지 않는다. merge-back 검사는 `origin/*` remote-tracking refs만 확인하므로 사전에 `git fetch origin`이 필요하며, ancestry가 deployment나 protection을 증명하지 않는다고 결과에 표시한다. 실제 환경 검증은 허용된 읽기 전용 확인으로 별도 기록한다. 배포·운영 인수·7일 관찰은 별도 task로 유지.
- 커밋 제안: `feat(harness): check release evidence and compatibility`.

## 5. 명령 계약

아래 명령 중 “구현됨” 항목은 현재 CLI에서 실행할 수 있다. 경로는 절대경로를 사용한다.

```bash
npm run harness -- doctor
npm run harness -- start HARN-06 --slug quality-gates --path /tmp/blariyo-HARN-06
npm run harness -- check --staged
npm run harness -- pr-policy feature/HARN-06-quality-gates develop
npm run harness -- merge-back-check release/1.2.3
npm run harness -- task-range feature/HARN-06-quality-gates <base-sha> <head-sha>
npm run harness -- range <base-sha> <head-sha>
npm run harness -- install-hooks
npm run harness -- remove-hooks
npm run test:harness
npm run lint:harness
npm run lint:all
npm run test:architecture
```

| 명령                                                               | 상태·효과                                                                                                                                                                                                                                                     | 권한 경계                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| doctor / check / range / task-range / pr-policy / merge-back-check | 구현됨: 진단·staged/index·commit 이력·task 경로·PR 방향과 release/hotfix merge-back ancestry 판정                                                                                                                                                             | merge-back은 fetch된 remote-tracking refs만 읽음; provider·배포·보호 상태는 별도 증거                                                           |
| start / start-hotfix                                               | 구현됨: feature는 승인·원격 동기화된 `develop`, hotfix는 명시 full production SHA(존재·`main` 조상 검증)에서 task manifest 기반 worktree 생성                                                                                                                 | hotfix SHA의 실제 배포 여부는 provider 확인이 필요; 자동 push 없음                                                                              |
| install-hooks / remove-hooks                                       | 구현됨: 지정 worktree의 hook 설치/복원; main에 설치·smoke 검증                                                                                                                                                                                                | 현재 `extensions.worktreeConfig=true`; feature worktree에는 설정하지 않음                                                                       |
| resume / lease                                                     | 부분 구현: evidence·checkout과 OS advisory task/resource lock 상태를 읽기 전용 비교. `verify`는 task manifest의 선택 resource를 직렬화하고 `lease hold`는 지정 task 점유                                                                                      | resume은 lock을 자동 취득하지 않음; 단일 host만 지원, 만료/강탈 없음; Windows msvcrt 경로는 구현했으나 이 환경에서 미검증, 다중 host 미지원     |
| verify                                                             | 부분 구현: task manifest의 고정 npm 명령 5종만 허용, 입력 fingerprint 전후 대조 및 `.git` 영역에 출력 원문 없는 요약 증거 기록                                                                                                                                | 운영 DB·외부 발송 명령 불허; 전체 실행은 현재 checkout 기준이고 immutable snapshot 연결은 미구현                                                |
| ready / handoff                                                    | 부분 구현: 최신 로컬 evidence의 SHA·branch·source·policy·task hash를 read-only 대조하고 handoff receipt 기록                                                                                                                                                  | 제품 완료·승인 상태 자동 승격 없음; resume/lease·미완료 계획 연결 대기                                                                          |
| release-check                                                      | 부분 구현: candidate commit의 task Change-Id와 입력 CI·quality·architecture·image·DB·backup/restore evidence consistency 대조                                                                                                                                 | backup freshness 한도 명시 필수; evidence URL/provider 기록 실재 여부나 artifact 내용은 독립 검증하지 않음; 배포·DB 쓰기 없음                   |
| harness                                                            | `doctor`, staged check, pre-push, commit range, per-worktree hook install/remove CLI                                                                                                                                                                          | doctor는 읽기 전용; install/remove는 지정 worktree에만 설정; 미해결 develop은 비정상 상태                                                       |
| test:harness / lint:harness                                        | 구현됨: 52 tests 실행 수·실패·skip 보고, harness `.mjs` lint                                                                                                                                                                                                  | 임시 Git 저장소·synthetic fixture; 0 tests/report 누락은 실패                                                                                   |
| lint:all / format:check                                            | 부분 구현: API/Web/contracts/scripts/tests ESLint, Collector Checkstyle, Ruff·SQLFluff·ShellCheck·Stylelint·Markdownlint·actionlint, read-only Prettier 및 도구별 정상/위반 fixture                                                                           | 저장소 SQL 27개 포함; 전체 local lint·format 통과. migration checksum evolution과 기존 ledger 호환 적용. finding이 있을 때만 승인 baseline 요구 |
| ci-context / job receipt                                           | 부분 구현: PR/push/manual event 구분, commit trailer와 task manifest의 등록 `changeIds` 대조, subject/base/head·run/attempt·checkout hash·binding artifact; 실행된 각 CI job·최종 gate는 receipt JSON, 최종 gate는 context 실패에도 별도 진단 artifact 업로드 | 신규 ref·비조상·미등록 change·trailer 누락을 차단; GitHub 실제 실행 artifact readback 대기                                                      |
| format:check                                                       | 로컬 통과: Prettier 3.9.6 `--check .`; hash-locked migration·contract 파일은 `.prettierignore`로 보호                                                                                                                                                         | 미포맷 파일 0개                                                                                                                                 |
| test:architecture                                                  | 앱·계약 layer dependency/cycle 검사                                                                                                                                                                                                                           | 고정 CI check; 대상 누락·해석 실패는 성공 아님                                                                                                  |

`harness`, `test:harness`, `test:quality`, `test:quality:tools`, `lint:harness`, `lint:all`, `test:architecture`는 구현되어 실행 가능하다. `test:quality:tools`는 `lint:all`에서 언어별 정상·위반 fixture를 실행한다. `format:check`는 `prettier --check .`이며 source를 수정하지 않는다. hash-locked migration·contract 파일을 제외한 format finding은 0건이다. 저장소 전체 SQL 27개에서 lint finding 0건이고 전체 local lint가 통과한다. candidate 항목이 있을 때만 owner/reason/expiry가 있는 승인 baseline을 요구한다.

설치·복구·제거 명령의 최종 인자는 HARN-04에서 확정한다. npm `prepare` 같은 의존성 설치 후크에 Git 설정 변경을 숨기지 않는다.

## 6. 필수 회귀 시나리오

| ID    | 입력·상황                                                                                       | 기대 결과                                                                                                                 | 담당 task |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| HV-01 | task·정본·validator·schema 누락                                                                 | 명시적 BLOCKED/ERROR, 성공 아님                                                                                           | 01/04     |
| HV-02 | 부분 staging·임시 index                                                                         | 실제 커밋 대상만 검사, 비스테이징 수정 보존                                                                               | 04        |
| HV-03 | 한글·공백·rename·삭제·symlink 경로                                                              | 누락·경로 이탈 없이 정책 판정                                                                                             | 01/04     |
| HV-04 | `HEAD:main`, 다중 ref, 새 branch, 삭제 push                                                     | 실제 목적지·각 SHA별 판정                                                                                                 | 04        |
| HV-05 | 정상 main merge와 수동 충돌 해결                                                                | 승인된 유입과 신규 변경 구분; 최종 검사 유지                                                                              | 04        |
| HV-06 | 검사 도중 코드·HEAD·정책 변경                                                                   | 낡은 결과 재사용 금지                                                                                                     | 03        |
| HV-07 | 두 실행의 동일 worktree·포트·DB 요청                                                            | 충돌 탐지·격리/직렬화, 다른 자원 보존                                                                                     | 02        |
| HV-08 | crash·stale lease·PID 재사용                                                                    | 실제 소유권 재확인, 자동 삭제/kill 없음                                                                                   | 02        |
| HV-09 | 기존 hook·중복 설치·linked worktree                                                             | 기존 동작 보존, 재귀 없음, 복원 가능                                                                                      | 04        |
| HV-10 | tests=0·필수 report 없음·timeout·skip                                                           | 필수 검사 성공 아님                                                                                                       | 03/05     |
| HV-11 | CI 선행 실패·취소·예상 외 skip·workflow 전체 취소                                               | 실행 가능한 gate는 실패; gate 미실행도 성공 check 부재로 병합·이미지 게시 차단                                            | 05        |
| HV-12 | PR에서 정책·runner·workflow 약화                                                                | 기준 정책 검사·보호 경계 검증, 우회 한계 명시                                                                             | 05/06     |
| HV-13 | 문서만 변경했지만 계약 입력 포함                                                                | 필요한 앱·계약 검사 유지                                                                                                  | 06        |
| HV-14 | 다른 run 결과·변조된 로컬 PASS 파일                                                             | CI가 독립 재실행, 증거 불일치 표시                                                                                        | 03/05     |
| HV-15 | post-commit 로컬 메타데이터 기록 실패                                                           | commit SHA·task/change ID 기록; 기록 오류를 알리되 commit 성공을 유지하고 자동 재커밋 없음                                | 04        |
| HV-16 | 기존 부채 예외와 새 위반                                                                        | 정확한 기존 대상만 구분, 새 위반 차단                                                                                     | 06        |
| HV-17 | 만료 백업·DB 비호환·다른 digest                                                                 | release 준비 실패, 자동 배포 없음                                                                                         | 07        |
| HV-18 | 앞선 commit에 synthetic 비밀 추가 후 마지막 commit에서 삭제                                     | 최종 tree가 깨끗해도 pre-push가 이력의 비밀을 검출·전송 차단; 원문 로그 금지                                              | 04/05     |
| HV-19 | 새 branch·다중 ref·annotated tag·삭제·0 OID·shallow·old 객체 부재                               | 모든 ref 이력·tag 메시지 검사; 실제 빈 범위만 N/A, 증명 불가 범위는 차단; 자동 fetch 없음                                 | 04/05     |
| HV-20 | `.mjs` 테스트에 의도된 실패·lint 위반 또는 테스트 0개/report 누락                               | 전용 명령과 CI harness job·최종 gate 실패; 정상 fixture에서는 실제 테스트 수 확인                                         | 01/05     |
| HV-21 | migration/복구 PR·main, 일반 변경, 다른 SHA의 예약 복원 성공                                    | 영향 변경은 동일 SHA restore 필수; 일반 변경만 근거 있는 N/A; skip·범위 미지원·증거 불일치는 차단                         | 05        |
| HV-22 | A에 hook 설치·재설치·제거, B는 wrapper 없는 branch; 확장 미지원·설정 이관 필요                  | 비대상 B의 hook 경로·동작 보존, A 복원·runner 누락 차단, 미지원은 공유 설치 없이 BLOCKED                                  | 04        |
| HV-23 | PR detached merge·여러 PR 포함 main push·수동 실행·CI 재실행·연결 누락                          | 실제 subject SHA·변경별 task/manifest·attempt·checkout ID 일치, CI worktreeId null; 누락·불일치 차단                      | 03/05     |
| HV-24 | feature/release/hotfix의 잘못된 source·PR target, main 직접 feature PR                          | 허용 branch flow만 성공; feature→develop, release/hotfix→main 권한과 target 검증                                          | 01/02/05  |
| HV-25 | release freeze, develop에 남은 미포함 feature, release 종료                                     | 새 기능은 release에 들어가지 않음; 승인 release 수정만 main+develop 양쪽 merge 후 종료 가능                               | 02/05/07  |
| HV-26 | production SHA가 main tip과 다르고 active release가 있는 hotfix                                 | production SHA 기반 수정; main 배포 뒤 develop·active release에 각각 재반영·검증, 누락 시 차단                            | 02/05/07  |
| HV-27 | develop 부재, 여러 worktree·dirty/untracked·기존 remote/local branches                          | HARN-02 BLOCKED; branch 생성·push·전환·재작성 없이 목록·보존                                                              | 01/02     |
| HV-28 | `lint:all` 로컬·CI 실행, package 내 비변경 파일 lint 오류                                       | 동일 version/config·전체 package 대상 실행; 변경 파일만 검사하거나 오류를 생략하면 gate 실패                              | 06/05     |
| HV-29 | TS/MJS/Vue/Java/Python/SQL/shell/CSS/Markdown/YAML fixture의 정상·위반·0 files·tool/report 누락 | 언어별 검사 적용; 필수 검사기 누락·0 대상은 명시적 BLOCKED/ERROR, PASS 아님                                               | 06        |
| HV-30 | lint config·version·baseline 변경, 넓은 예외·만료 exception·신규 위반                           | trusted base와 후보 config 검사, exact fingerprint만 허용; 변경 신규 위반·예외 확대·만료 차단                             | 06/05     |
| HV-31 | TS alias/Vue/dynamic import·Java package/Gradle edge의 cycle·역방향 의존                        | 실제 import/package graph에서 금지 edge와 cycle 검출; 이름만 유효하거나 해석되지 않는 dynamic/reflection 경로는 PASS 금지 | 06/05     |

로컬 회귀는 임시 Git 저장소·로컬 bare remote와 synthetic fixture를 사용한다. 사용자 저장소에 시험 커밋을 만들거나 실제 remote·운영 DB를 로컬 회귀 대상으로 사용하지 않는다. HARN-05의 원격 수용은 별도로 허용된 PR/CI 범위에서 실행한다. Windows/macOS/Linux의 경로·실행권한·셸·GUI Git 환경은 각 환경별로 검증하고 미실행 환경은 명시한다.

## 7. 단계별 도입과 되돌리기

0. **branch 전환 준비:** inventory와 초기 SHA 선택, local/remote develop 생성·tracking은 완료했다. 기존 main 8개 commit과 복구 branch의 통합, 단일 release ref 처리, 원격 보호는 미완료다. 기존 branch를 자동 재작성하지 않는다.
1. **로컬 기반:** HARN-01~03, HARN-04 격리 검증, hash-locked OpenAPI/generated contract를 제외한 Prettier format check와 architecture fixture를 확인했다. SQLFluff는 저장소 전체 SQL 27개에서 0 findings이며 전체 `lint:all`은 로컬 통과한다. 과거 migration SHA 변경은 계약과 runtime 구 checksum allowlist에 반영했고 알 수 없는 checksum은 계속 차단한다.
2. **로컬 hook 시범:** 격리 설치·복원 및 main worktree의 hook smoke를 완료했다. 설치는 main worktree 전용이고 별도 `feature/m0-core` worktree는 설정과 변경을 보존했다. 다른 worktree에 확장 hook을 일괄 설치하지 않았다.
3. **원격 관찰:** HARN-05 CI를 main/develop/release PR·push와 hotfix PR에 적용하고 각 stable check·동일 SHA restore·lint/architecture 차단을 확인한다. PR #1/#2의 첫 CI는 실패했고 후속 quality·Windows·restore는 skip됐다. 현재 원격 보호는 미활성이다.
4. **원격 강제:** 확인된 check를 main/develop/release 대상 ruleset에 등록하고 feature direct-to-main·필수 실패 병합 거부·main 이미지 게시 차단을 확인한다. 설정 readback 후에만 활성화 완료로 표시한다.
5. **release 시범:** HARN-07로 첫 release version/scope/merge-back/readback을 검증한다. 자동 deploy·자동 branch 삭제는 켜지 않는다.

되돌리기는 installer가 기록한 대상 worktree의 원래 hook·설정 연결로 복원한다. 다른 worktree가 쓰는 공통 확장·설치 후 설정은 삭제하지 않는다. CI gate 제거·이름 변경은 원격 required check와 함께 조정한다. 오탐 때문에 `--no-verify`·광범위 예외·전체 검사 비활성화를 표준 운영 방식으로 만들지 않는다.

## 8. 구현 전 결정과 완료 보고

| 결정                                        | 현재 상태                                                              | 결정 시점  |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| worktree 루트·공유 상태 경로                | 설정 가능 설계, 실제 경로 `(미정)`                                     | HARN-02    |
| lease 갱신 주기·회수 절차                   | 자동 강탈 금지, 수치 `(미정)`                                          | HARN-02    |
| 증거 schema·보존기간·장기 release 보관      | 최소 필드 설계, 실제 저장·기간 `(미정)`                                | HARN-03/07 |
| hook 설치 범위·공존·대상 OS·복원            | 지정 worktree 하나·기존 연결 보존 확정; 지원 환경·호환성 `(미정)`      | HARN-04    |
| 원격 보호 지원·권한·독립 검토자·신뢰 runner | 인증된 설정 조회 완료: classic/ruleset 없음; 검토자·신뢰 runner는 미정 | HARN-05    |
| 도구별 AI hook 지원 범위                    | 미검증                                                                 | HARN-06    |

완료 보고는 task ID, 변경 경로, 기준/대상 SHA, 실행 환경, 검사·결과·artifact, 남은 조건, commit·push·원격 설정 상태를 분리한다. 필요한 로컬·원격 수용이 남으면 해당 task를 완료 처리하지 않는다.

현재는 **HARN-01~07 모두 부분 구현**이다. 구현률을 test 개수로 환산하지 않는다. 로컬 기능은 policy·branch·task·lease·verify/ready/handoff·hook·전체 lint·architecture·release/merge-back 검사까지 있고, HV-25/26의 release/hotfix lifecycle은 synthetic Git fixture로 검증했다. 실제 release provider·배포·원격 재반영 수용은 별도다.

복구 결과는 코드 검증 SHA `49b84e4`와 문서 포함 `de28c0c`에 묶인다. 전체 lint와 SQL 27개, harness 52/52, quality 10/10, architecture 9/9, Core/Collector restore 31/41개를 포함한 검증을 통과했다. 원문 parser HTML 49개는 byte identity를 보존하고 formatter에서 제외했다. checksum evolution과 제한된 기존 ledger 호환은 실제 migration 회귀로 검증했다.

원격 PR #2에서는 base policy 부재를 감지해 필수 gate가 실패했지만 context 생성 실패로 `SUBJECT_SHA`, `CONTEXT_SHA256`, `BINDINGS_SHA256`도 없어 최종 receipt 생성·업로드가 실패했다. 이 결과는 정상적인 전체 gate 수용이 아니다. 후속 로컬 변경에서 진단 JSON 생성·업로드를 receipt와 분리했다. context가 실패·취소·skip·누락되거나 success여도 필수 output이 없으면 gate는 계속 실패하고 진단은 검증 증거가 아님을 명시한다. 복원 분류 누락은 null로 남긴다. 기존 receipt의 필수 식별자 검증을 유지했으며 원격 업로드/readback은 아직 미검증이다. Windows·quality·restore는 8개 skip 중에 포함돼 실행 증거가 없다. 원격 classic protection/ruleset은 모두 미설정이며 trusted-ref/code-owner 보호·실제 receipt readback·자동 heartbeat·다중 host 조정이 남았다.

진단 보완 후 로컬 `test:harness`는 54/54, 실패·skip 0이다. workflow에서 파싱한 실제 Bash·jq 명령을 실행해 context 5개 실패 입력의 진단 보존, 필수 job 실패·취소·skip 차단, restore 필요 여부별 성공/skip 계약을 확인했다. `lint:harness`와 pinned actionlint도 통과했다. 이 보완의 원격 적용과 artifact 수용은 별도다.

PR #1의 브라우저 P0도 별도 격리 사본 `ada2474`에서 확인했다. 이미지 fault 주입 전에 재조회 완료를 기다리는 테스트 1줄을 추가했고, 동일 1초 응답 지연 조건에서 기존 실패 2건을 포함한 4/4와 게시글 12개 DB/media readback을 통과했다. 애플리케이션 코드는 수정하지 않았으며 실제 PR commit·원격 verify 수용은 남았다. 사용자는 기존 local main 8개 commit을 별도 PR로 검토하고 harness·cleanup을 후속 연결하도록 선택했다. 이 선택을 push·merge 승인으로 해석하지 않는다.

## 9. Review Findings 반영과 구현 증거

2026-09-25 감사 D1-1·E1-1·C1-1·A1-1·A1-2와 [REQUEST](../../worklog/2026-09-25/git-governance/REQUEST.md)의 branch/lint/architecture 요구를 설계와 실행 구현에 반영했다. 감사 finding의 원인·심각도와 설계 정본은 [설계서 Review Findings](git-workflow.md#14-review-findings)에 둔다. 초기 실행 증거는 [구현·검증 결과](../../worklog/2026-09-25/git-governance/RESULT.md)에, 현재 복구·원격 관측은 [복구 결과](../../worklog/2026-09-25/git-governance/STASH-RECOVERY.md)에 기록한다. HV-25~31 전체 수용 matrix 및 원격 수용은 미완료다.

| 주요 구현·정본 경로                                                                                   | 현재 내용                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [git-workflow.md](git-workflow.md), [harness-implementation-plan.md](harness-implementation-plan.md)  | branch 정책·gate 계약·HARN 순서·수용 matrix와 현재 구현 상태                  |
| [harness source](../../scripts/harness/cli.mjs), [quality source](../../scripts/quality/lint-all.mjs) | branch/task/CI/evidence/hook/restore harness 및 다언어 lint gate              |
| [CI workflow](../../.github/workflows/ci.yml), [architecture tests](../../tests/architecture.test.ts) | 로컬 command 계약, quality/architecture/restore/harness gate 연결과 구조 회귀 |
| [status.md](../status.md), [roadmap.md](../roadmap.md)                                                | 실제 로컬 상태, debt, 원격·플랫폼 검증 잔여 및 다음 단계                      |
| [작업 결과](../../worklog/2026-09-25/git-governance/RESULT.md)                                        | 초기 구현 당시 검사·remote/worktree 관측; 현재 상태는 복구 결과 참조          |

복구 branch에는 별도 hook을 설치하고 6개 commit을 검증했다. 원본 stash·다른 worktree는 보존했다. 기존 PR #1/#2는 원격 실행 실패 상태이고 복구 branch는 미push다. 원격 보호 미설정을 인증된 Settings에서 확인했으며 설정 변경·merge·배포는 하지 않았다.
