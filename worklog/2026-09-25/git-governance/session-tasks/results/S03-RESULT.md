# S03 실행 결과 — hook 복원과 수동 검사 분리

- 세션/issue: S03 / GOV-07·08·09·10·11·12.
- 실행일: 2026-09-26 KST. 시작 snapshot 15:18:03; 복원 시각은 [readback](S03-assets/restoration.json)에 기록.
- 실제 작업본: 기본 `develop`, 입력 HEAD `8af72449a7d56c9701efd0d73dc7d430a66f9610`; 연결 작업본 5개는 [before](S03-assets/before.json) 참조.
- 입력: [S03 요청서](../requests/S03-hooks-secrets.md), [S01 백업 결과](S01-RESULT.md), [S02 결과](S02-RESULT.md).
- 사용자 지시: “S03 진행 해”; 선택 “task 정책과 분리한 수동 검사 명령으로 유지”. 앞선 “commit 하고,” 요청도 이어서 수행한다.
- 결과 상태: **실제 hook 연결 복원 완료 / 독립 수동 검사 구현·로컬 검증 완료**. 원격 반영·CI 연결·운영 도입은 별도다.

## 1. 선택과 진척

| issue | 선택 | 이번 수행 | 남은 경계 |
| --- | --- | --- | --- |
| GOV-07 | 기존 강제 연결 복원 | 4개 작업본의 worktree `core.hooksPath` 해제, 6개 작업본 유효 경로 확인 | wrapper 16개와 metadata는 비활성 보존; 삭제는 후속 범위 |
| GOV-08 | 공백·비밀 검사 분리 유지, task 경로 강제 해제 | `staged` 수동 명령으로 index 검사 | 실행하지 않으면 자동 차단 없음 |
| GOV-09 | 제목·Task-Id·Change-Id 강제 해제 | 비밀 후보만 확인하는 `message` 명령 유지 | 새 제목 정책 도입 없음 |
| GOV-10 | 자동 post-commit 기록 해제 | 연결만 해제하고 기존 JSONL 보존 | 보존 기록 정리·조회 운영은 후속 선택 |
| GOV-11 | 이력 비밀 검사 분리 유지, branch·force·삭제 제한 해제 | `range`·`outgoing` 수동 명령; 모든 outgoing commit 검사 | package/CI 연결은 S10; 원격 보호 상태 변경 없음 |
| GOV-12 | 기존 패턴 4종 유지 | task/branch 모듈을 import하지 않는 독립 코드 | 일반 비밀번호·모든 token·binary·submodule 내용은 포괄하지 않음 |

## 2. 입력과 보존

- S01 백업과 현재 설정·wrapper·기록 등 **44개 파일의 hash·mode가 일치**했다. 복원 직전 별도 로컬 백업도 만들었다.
- 변경은 `config.worktree` 4개의 `core.hooksPath` 항목뿐이다. 나머지 설정 항목, 공통 설정,
  `extensions.worktreeConfig=true`, wrapper 16개, 기존 기록과 원래 hook 파일을 보존했다.
- before/after 설정 원문은 `S03-assets/private/`의 로컬 백업과 실제 gitdir에만 둔다.
  공개 JSON에는 경로·hash·필요한 설정 상태만 기록한다.
- 기본 작업본의 기존 미추적 source와 다른 작업본의 미커밋 변경은 보존했다.
  기존 `.harness/`, `.githooks/`, `scripts/harness/`, `tests/harness/`를 수정하거나 삭제하지 않았다.
- S01·S02 archive와 그 checksum, 과거 보고서는 수정하지 않았다. 새 코드 hash와 diff hash는
  [source manifest](S03-assets/source-manifest.json), 기존 파일 보존은 [최종 확인](S03-assets/final-verification.json) 참조.

## 3. 변경과 검증

| 작업본 | 이전 유효 경로 | 복원 후 | 결과 |
| --- | --- | --- | --- |
| 기본 blariyo | 기본 gitdir의 `harness-hooks` | 공통 `.git/hooks` | 설정 복원 |
| git-governance | 해당 gitdir의 `harness-hooks` | 공통 `.git/hooks` | 설정 복원 |
| governance-delivery | 해당 gitdir의 `harness-hooks` | 공통 `.git/hooks` | 설정 복원 |
| stash-recovery | 해당 gitdir의 `harness-hooks` | 공통 `.git/hooks` | 설정 복원 |
| ci-browser-review | 공통 `.git/hooks` | 동일 | 무변경 |
| m0-core | 공통 `.git/hooks` | 동일 | 무변경 |

공통 `.git/hooks`에는 sample만 있고 활성 hook은 없다. 사라진 CLI를 가리키는 활성 연결도 없다.
복원 명령은 작업본별 `git config --worktree --unset core.hooksPath`다. wrapper를 삭제하는 기존 remover는 쓰지 않았다.

| 검증 | 실제 결과 |
| --- | --- |
| `node --test tests/harness/hooks.test.mjs` | 기존 회귀 **15/15 통과**, 실패·skip 0 |
| `node --test tests/git-checks.test.mjs` | 독립 수동 검사 **13/13 통과**, 실패·skip 0 |
| 새 source·README·test Prettier 검사 | 통과 |
| 실제 설정 readback | 복원 4개 / 경로 확인 6개 / wrapper 16개 보존 |
| 보존 확인 | 설정 변경 외 40개 metadata 파일과 기존 작업 파일 hash 유지 |

- Node.js `v24.18.0`에서 실행했다. [검사 기록](S03-assets/checks.json) 참조.
- 임시 저장소에서 정상 메시지, 비밀 포함 거부, index와 작업 파일 차이, 공백, symlink,
  삭제된 비밀의 과거 commit, Unicode 경로, merge 해소 내용, commit/tag 메시지,
  ref 삭제·force 갱신 허용, 객체 부재·shallow 거부, 원래 hook 복원과 이웃 설정 보존을 검증했다.
- 기존 회귀의 push는 임시 저장소 사이의 로컬 bare remote만 사용했다. 실제 프로젝트 remote에는 push하지 않았다.
- 최초 설정 변경 전 `ps`가 샌드박스에서 차단됐다. 승인된 재시도에서 실행 중 Git 프로세스가 없음을 확인한 뒤 복원했다.
  설정 복원 실패나 테스트 실패는 없었다.
- 커밋 전 최초 공백 검사는 기존 `S02-assets/product-preservation.patch`의 원문 140곳을 거부했다.
  문맥 줄 135개와 삭제 줄 5개의 공백을 보존하려고 `results/.gitattributes`에서 이 파일 하나만
  `-whitespace`로 지정했다. patch 원문·checksum과 실제 소스 검사는 유지하며 비밀 검사는 제외하지 않는다.
- 제품 코드 변경이 없어 S03에서 제품 build·browser·DB 검사를 추가 실행하지 않았다.

## 4. 완료 조건과 미완료

- 선택한 hook 연결 복원과 작업본별 검증을 완료했다. 새 자동 hook은 설치하지 않았다.
- 수동 명령과 범위는 [당시 사용 안내·source 원문](S03-assets/manual-checks.patch)에 기록했다.
- 앞서 요청한 커밋 중 S02 독립 후보는 [커밋 확인](S03-assets/s02-commit.json)에 기록했다.
  실제 commit의 전체 index patch가 S02에서 브라우저 12/12를 통과한 patch와 일치한다.
- S01·S02 결과의 “commit 미실행”은 당시 사실로 보존한다. 이번 기본 작업본 커밋은
  S01·S02 공개 증거와 S03 신규 source·test·결과만 포함하며 최종 SHA는 실행 응답에서 보고한다.
- 실제 hook 설정은 `.git` 내부의 로컬 변경이다. 소스 커밋만으로 다른 clone의 설정까지 복원되지는 않는다.
- push·PR 변경·원격 branch/ruleset 변경·CI 실행·merge·DB 변경·배포는 수행하지 않았다.

## 5. S09·S10 인계

- **삭제 제외:** `scripts/git-checks/check.mjs`, `scripts/git-checks/README.md`, `tests/git-checks.test.mjs`와 S01~S03 증거.
- **새 독립 export:** `secretKinds`, `checkStaged`, `checkMessage`, `checkCommitRange`, `checkOutgoingRefs`, `main`.
  입력/결과 형태가 기존 API와 모두 같지는 않으므로 기존 테스트의 import만 바꾸는 방식으로 이전하지 않는다.
- **기존 소비자 보존:** `scripts/harness/cli.mjs`는 `checkStaged/checkOutgoingRefs/checkCommitRange`와
  `dispatchHook/installHooks/removeHooks`를 계속 import한다. `hooks.mjs`는 `check.mjs`와 `branches.mjs`,
  `check.mjs`는 `secrets.mjs`와 `branches.mjs`, 기존 hook 테스트는 이 함수들을 사용한다.
- **S09:** 비활성 `.githooks/`, gitdir wrapper·metadata·post-commit 기록과 기존 CLI/정책의 삭제 후보를 분류한다.
  metadata 존재를 현재 설치 상태로 오해하거나 기존 installer로 다시 연결하지 않는다. 아직 실제 삭제하지 않았다.
- **S10:** 후보 package/workflow에서 기존 `scripts/harness/cli.mjs`의 staged·range·pre-push 소비자를 찾고,
  유지한 검사에 해당하는 부분만 새 명령으로 연결한다. task 검사와 branch 제한을 새 명령에 다시 섞지 않는다.
  이번 S03에서는 공유 package/workflow를 편집하지 않았다.
- 다음 담당은 S09이며 S04~S11, T1 재개, worktree 정리·삭제를 자동 시작하지 않았다.
