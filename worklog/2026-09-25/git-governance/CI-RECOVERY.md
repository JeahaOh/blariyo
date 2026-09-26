# HARN-09 — CI 실패 복구와 도입 순서

- 시작 기준: recovery HEAD `5957492429b668377bede866c90f878b43225785`, 기존 미커밋 8개 경로 보존.
- 정본: [Git 설계](../../../docs/ai/git-workflow.md), [구현 계획](../../../docs/ai/harness-implementation-plan.md).
- 상태: 로컬 구현·회귀, 분리 commit·push와 **Draft PR #3~#8 생성 완료**. 등록안은 PR #5에서 검토하며 trusted develop 반영·병합·원격 보호·배포는 미완료다.
- 기존 HARN-08은 stash 복구 task로 유지한다. 허용 경로를 확대하지 않으며 HARN-09도 자기 manifest를 구현 허용 경로에 포함하지 않는다.

## 변경과 완료 조건

| 변경                      | Change-Id                              | 범위·완료 증거                                                                                                                                                                     |
| ------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이미지 재시도 테스트 race | `45831498-8ae4-4f2e-9933-42ca6e1df655` | `tests/browser/admin-workflow.test.ts`의 대기 1줄. PR source `ada2474` + 동일 1초 응답 지연에서 실패 재현 후 4/4·12개 게시글·3단계·DB/media readback 통과. 원격 verify 성공은 대기 |
| 최종 gate 진단 보존       | `2bd49d94-8036-44c5-bc8a-4000d4792aa6` | workflow의 진단/receipt 분리와 harness 회귀, 관련 상태 문서. harness 54/54·전체 lint 통과. 실제 artifact 생성·다운로드는 대기                                                      |

고정 runner 검증은 `test:harness`, `lint:harness`, `lint:all`이다. 브라우저 격리 실행·`typecheck:tests`·`lint:tests`와 실제 원격 수용은 이 runner 밖의 추가 필수 증거이며, manifest의 세 명령만 통과했다고 전체 완료로 판정하지 않는다. 브라우저 재현은 총 2회로 종료했고 결과를 반복 실행해 통과한 것으로 바꾸지 않는다.

## 등록과 구현의 분리

1. 정책 등록은 기존 PR #1을 보존하고 새 Draft PR #5에 HARN-08·HARN-09 manifest와 각 taskRef를 분리해 전달했다. PR #1에는 여전히 HARN-08·HARN-09가 없으며 최종 통합 시 중복 등록을 피해야 한다.
2. gate 활성화 이후 구현 PR의 base에는 해당 manifest가 이미 있어야 한다. 구현 범위에 `.harness/policy.json`·`.harness/tasks/*`가 섞이면 기존 `task-range`가 계속 차단한다.
3. HARN-09 구현은 manifest의 정확한 9개 경로만 허용한다. 정책 파일·다른 앱 source·migration을 같이 수정하지 않는다.
4. 현재 recovery branch의 미커밋 변경을 한꺼번에 commit하거나 원래 HARN-08 branch에서 새 테스트 경로를 억지로 통과시키지 않는다. 등록·브라우저 수정·gate 진단 수정의 commit과 PR 범위를 분리한다.

## 실제 이력에서 확인한 선행 관계

- 원격 develop=`8af7244`, 기존 main=`e51f1b5`. 기존 8개 commit은 72개 파일(+4,655/-485)이며 **8개 모두 Task-Id/Change-Id trailer가 없다**. 사용자는 이 8개를 별도 PR로 검토하고 harness·cleanup을 후속 연결하도록 선택했다.
- `git merge-tree --write-tree e51f1b5 ada2474`는 아래 2개 add/add conflict를 반환했다. 임시 병합 계산이며 branch·index·작업 사본은 바꾸지 않았다.
  - `docs/ai/git-workflow.md`
  - `docs/ai/harness-implementation-plan.md`
- 같은 이름의 초기 설계를 양쪽에서 추가한 결과다. 충돌 해결 시 현재 recovery의 승인된 설계 계약을 대조하되, 아직 그 PR에 없는 source·원격 보호를 완료라고 쓰지 않는다.
- 기존 8개를 새 CI를 켠 뒤 그대로 끼워 넣으면 commit binding이 trailer 누락으로 차단한다. 이력을 재작성하거나 넓은 예외를 추가하지 않고, 검토된 도입 이전 변경을 먼저 develop에 통합한다. 초기 develop 기준 `8af7244`와 policy bootstrap ancestry pin은 유지한다.

## 도입 순서와 수용 기준 — 전달 전 계획

| 순서 | PR 범위                                            | 적용 전·후 확인                                                                                                                                                     |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | 기존 CI의 브라우저 선행 결함: 대기 1줄만 별도 검토 | harness 활성화 전 기존 CI로 검증. 현재 재현 patch는 준비됐지만 원격 반영·성공은 미완료                                                                              |
| 1    | 기존 local main 8개 commit의 별도 PR               | 기존 commit SHA·작성자 보존. 0번의 수정과 함께 실제 merge-result에서 CI 확인. 기능·법무·운영 활성화 승인을 자동 승계하지 않음                                       |
| 2    | 정책·task 등록 PR #1                               | 최신 develop를 대조하고 설계 문서 2개 충돌 해결. HARN-08/09와 taskRef를 함께 등록하되 검사기 활성화는 별도                                                          |
| 3    | HARN-08의 source·fixture·SQL·문서 cleanup          | 정책/manifest 변경을 제외한 등록 범위만 반영. 원문 HTML 바이트·SQL checksum 계약 유지. 정확한 후보 SHA에서 기존 CI·migration 회귀 확인                              |
| 4    | harness 활성화 PR #2와 HARN-09 진단 보완           | cleanup이 포함된 base에서 전체 lint·architecture·Windows·restore·receipt 검증. 기존 PR #2의 55개 구현 경로와 중복을 대조하며 새 branch/commit 범위별 task 검사 수행 |
| 5    | 원격 보호와 release/hotfix 수용                    | 성공한 stable check 등록, 검사기 변경 보호, direct push·실패 병합 거부와 provider readback 확인                                                                     |

0번은 새 gate가 아직 배포되지 않은 시점의 기존 CI 선행 결함 수정이다. 해당 1줄과 기존 8개를 검토한 도입 기준선에 포함하고 실제 SHA를 기록한다. 새 gate 활성화 뒤에는 같은 경로를 예외로 두지 않는다. 기존 CI를 끄거나 실패를 무시한 병합, secret 이력 검사 면제는 제안하지 않는다.

위 표는 전달 전 통합 실행안이다. 이후 사용자가 로컬 commit·push·검토용 Draft PR 생성을 명시 승인해 아래 6개 PR을 생성했다. 기존 PR #1/#2는 변경하지 않았고 merge·배포·원격 보호 설정은 실행하지 않았다.

도입 이후의 정책 등록 경로는 별도 미완료 항목이다. 현재 `task-range`는 policy/manifest 변경을 일반 구현 범위에서 차단하지만, 그 변경을 검토·승인할 전용 governance gate는 아직 구현되지 않았다. 초기 PR #1을 기존 CI에서 검토하는 순서만으로 향후 task 등록까지 해결했다고 판단하지 않는다. 원격 필수 gate 활성화 전 전용 검토 경로와 검사기 변경 보호를 함께 확정·검증해야 한다.

## 검증·보존

- 실행 로그와 SHA별 근거는 [복구 기록](STASH-RECOVERY.md)의 CI 진단·브라우저 race 절을 따른다.
- manifest schema·정확한 9개 허용 경로·중복 없는 UUID·taskRef 존재·고정 검증 명령·resource 선언을 확인했다. HARN-08 manifest는 변경하지 않았다.
- 임시 Git 저장소에서 실제 `checkTaskRange`, `buildCiContext`, `taskLeaseSpec`으로 검사했다. 등록된 base 위의 두 Change-Id 구현은 통과했고, 등록 파일을 구현에 혼합·무관한 source 추가·base manifest 누락은 각각 거부됐다. 기대 결과 4/4이며 실제 PR의 base/head 통과 증거는 아니다.
- 검사 결과: `/tmp/blariyo-harn09-contract-result.json`. 임시 저장소는 검사 후 제거했다.
- 원본 stash·refs·미추적 56개와 다른 세션 worktree를 보존한다. PR의 정확한 base/head에서 재검증하기 전 원격 완료로 표시하지 않는다.

## 실제 분리·전달 결과 — 2026-09-25

사용자 승인 범위는 로컬 commit 후 push·검토용 Draft PR 생성까지다. 기존 8개 commit의 SHA·작성자는 그대로이며 원본 recovery의 7개 commit도 재작성하지 않았다. 아래는 새 검토 branch의 commit이다.

| PR                                              | 검토 범위                       | base → head branch                                                     | commit·파일                                    |
| ----------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| [#3](https://github.com/JeahaOh/blariyo/pull/3) | 브라우저 재시도 대기 1줄        | `develop` → `feature/HARN-09-browser-retry`                            | `2b61c4c`, 1개                                 |
| [#4](https://github.com/JeahaOh/blariyo/pull/4) | 기존 local main 8개             | `develop` → `feature/HARN-08-legacy-main-review`                       | HEAD `e51f1b5`, 기존 8개·72파일                |
| [#5](https://github.com/JeahaOh/blariyo/pull/5) | 정책·task 등록과 근거           | `feature/HARN-08-legacy-main-review` → `feature/HARN-08-policy-review` | `c06b982`, 14개                                |
| [#6](https://github.com/JeahaOh/blariyo/pull/6) | source·fixture·SQL·문서 cleanup | `feature/HARN-08-policy-review` → `feature/HARN-08-cleanup-review`     | `35903da`·`7b1a3c4`·`28b72fb`·`5e41d1e`, 333개 |
| [#7](https://github.com/JeahaOh/blariyo/pull/7) | harness·quality·workflow 활성화 | `feature/HARN-08-cleanup-review` → `feature/HARN-08-harness-review`    | `c5670f6`, 56개                                |
| [#8](https://github.com/JeahaOh/blariyo/pull/8) | CI 실패 진단·전달 문서          | `feature/HARN-08-harness-review` → `feature/HARN-09-ci-diagnostics`    | 구현 `48ec5c1`·후속 전달 문서 commit           |

- 여섯 PR 모두 GitHub 화면에서 Draft와 정확한 base/head·commit 수를 확인했다. 원격 6개 ref가 local SHA와 같고 main/develop/단일 release는 계속 `8af7244`다.
- #5~#8의 feature base는 선행 변경을 제외하고 보는 검토 기준이다. 현재 branch 정책의 최종 허용 대상은 develop이며 feature→feature를 허용하는 예외를 추가하지 않았다. 선행 변경을 통합한 뒤 develop로 retarget하고 정확한 head/merge-result CI를 다시 확인해야 한다. 지금 Draft를 그대로 순서대로 merge하라는 지시가 아니다.
- #1/#2는 보존했다. #5/#7은 기존 8개와 cleanup을 반영한 후속 검토 후보이므로 실제 통합 때 중복 PR을 함께 병합하지 않는다. PR 닫기·병합·배포·보호 설정은 이번 실행에 포함하지 않았다.
- cleanup은 source 150개·fixture 33개·SQL/checksum 34개·문서 116개로 분리했다. 각 blob과 harness 56개 blob은 복구 `5957492`와 일치한다. 브라우저 1줄은 #3에 별도로 두었다.
- task-range는 등록된 base 대비 cleanup 333개·harness 56개·진단 구현 4개 모두 통과했다. 전송은 활성 pre-push hook을 통해 전체 신규 branch 이력을 검사한 뒤 atomic push로 완료했다. force·no-verify·정책 완화는 사용하지 않았다.
- 새 delivery checkout에서 Node 24.18.0 `npm ci`, harness 54/54(실패·skip 0), `lint:harness` 통과. 로그는 `/tmp/blariyo-delivery-npm-ci.log`, `/tmp/blariyo-delivery-harness.log`, `/tmp/blariyo-delivery-lint-harness.log`에 있다. 기존 복구의 앱/DB/전체 lint 통과를 이번 모든 PR의 원격 통과로 승계하지 않는다.
- 새 worktree 두 곳에 원본 recovery의 hooksPath가 복사된 것을 발견했다. metadata가 원본 worktree를 가리키고 새 worktree에는 자체 설치가 없음을 확인한 뒤 새 worktree의 잘못된 포인터만 제거했다. 도입 전 browser/등록 commit은 정확한 승인 pathspec·비밀 검사를 명시 실행했고, delivery에 harness source가 들어온 뒤 해당 worktree 전용 hook을 설치해 이후 commit/push를 검사했다. 원본·다른 세션 설정은 바꾸지 않았다. 신규 worktree 생성 시 외부 hooksPath 상속을 자동 진단하는 보강은 별도 잔여 사항이다.

### 첫 원격 CI 관찰

[PR #8 첫 실행](https://github.com/JeahaOh/blariyo/actions/runs/36143920729)은 구현 SHA `48ec5c1` 기준이다. 관찰 시 event-context·restore-scope는 성공했고 quality·verify·collector·Core schema-restore는 진행 중이었다. Collector restore는 분류에 따라 skip됐다. 이 중간 관찰은 최종 gate 통과를 뜻하지 않는다.

[Windows lease job](https://github.com/JeahaOh/blariyo/actions/runs/36143920729/job/108100236397?pr=8)은 27초 뒤 setup-python에서 실패했다. runner는 Windows 2025 x64용 Python `3.12.11`을 찾지 못했다. 따라서 lease 검사는 실행되지 않았으며 실제 Windows 수용은 미완료다. 지원되는 Python/runner 조합 확인과 고정 버전 수정·실제 Windows 회귀가 후속 작업이다. 이번 전달 문서 commit 이후 실행은 별도 SHA/run으로 평가해야 한다.

## 원격 결과 확정과 수정 후보 — 2026-09-26

이 절은 전달 당시의 진행 중 관찰을 대체하는 후속 기록이다. PR과 source는 읽기 전용으로 확인했으며 이번 후보를 PR branch에 반영하거나 commit·push하지 않았다.

| PR  | 실제 실행                                                                  | 확정 결과                                                                                                                |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| #3  | [36143693503](https://github.com/JeahaOh/blariyo/actions/runs/36143693503) | verify 성공 7m11s·collector 성공 4m27s                                                                                   |
| #4  | [36143738309](https://github.com/JeahaOh/blariyo/actions/runs/36143738309) | verify 실패·collector 성공; 실패 전체 로그 원인 확정은 별도                                                              |
| #5  | [36143786671](https://github.com/JeahaOh/blariyo/actions/runs/36143786671) | verify 실패·collector 성공; 실패 전체 로그 원인 확정은 별도                                                              |
| #6  | [36143844495](https://github.com/JeahaOh/blariyo/actions/runs/36143844495) | verify 성공 7m24s·collector 성공 4m5s                                                                                    |
| #7  | [36143879080](https://github.com/JeahaOh/blariyo/actions/runs/36143879080) | event-context·restore-scope·verify·collector·Core restore 성공; quality·Windows·gate 실패; Collector restore·images skip |
| #8  | [36144240604](https://github.com/JeahaOh/blariyo/actions/runs/36144240604) | 전달 SHA 9b13c81. #7과 같은 job 결과. artifact 13개 생성                                                                 |

### 확인한 원인과 후보

1. quality의 typed API lint가 `../dist` 모듈을 참조하지만 깨끗한 CI에서는 API build 전에 실행된다. `test:architecture`는 API와 test build를 포함하므로 이를 `lint:all` 앞으로 이동한다. 임시 source 사본에서 dist 부재 시 API lint 3,312건을 재현했고, build/architecture 선행 뒤 같은 lint는 통과했다. architecture 9/9도 통과했다.
2. Windows job의 Python 3.12.11은 Windows x64 바이너리가 없다. [Python 3.12.11 공식 안내](https://www.python.org/downloads/release/python-31211/)는 source-only release이며 3.12.10이 마지막 installer 제공 버전임을 명시한다. [actions/python-versions manifest](https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json)에서 stable 3.13.15 Windows x64 배포를 확인했다. Windows lease job만 이 버전으로 고정하는 후보이며 실제 Windows 실행은 아직 하지 않았다.
3. 2026-09-26 전체 harness 회귀에서 release CLI 두 테스트가 고정된 2026-09-24 백업 시각 때문에 만료됐다. CLI용 fixture만 실행 시각 기준 freeze -4h·backup -3h·observed -2h로 만들고, 명시적 시계를 주입하는 validator 단위 테스트와 운영 만료 검사는 유지했다. 이 파일은 HARN-07 범위로 분리했다.

검증 사본은 `/private/tmp/blariyo-ci-pr8-fix-39xvhea3`이며 source는 Git archive `9b13c81`이다. dependency는 동일 lockfile의 delivery node_modules를 읽기 전용 symlink로 사용했다. 새 npm 설치나 Windows 검증으로 표현하지 않는다. 제한된 환경의 사용자 cache 쓰기 실패 2건은 지원되는 `HARNESS_STATE_ROOT`를 임시 사본 내부로 지정해 테스트 상태를 격리했다. 전체 harness는 1차 50/54(날짜 fixture 2·cache 권한 2 실패), 2차 54/54·skip 0, harness lint 통과다. 동일 전체 회귀는 두 번으로 종료했다.

[진단 artifact](https://github.com/JeahaOh/blariyo/actions/runs/36144240604/artifacts/10869163912)와 [gate receipt](https://github.com/JeahaOh/blariyo/actions/runs/36144240604/artifacts/10868779206)의 생성은 UI에서 확인했다. 다운로드 수신은 두 번의 관찰에서 timeout되어 JSON 내용·hash 대조는 완료하지 못했다. 생성 확인을 readback 완료로 계산하지 않는다.

현재 세션의 delivery worktree와 원본 Git metadata는 읽기 전용이다. 수정 후보·문서 patch는 허용된 임시 폴더에만 작성했고 원본 source·refs·stash를 바꾸지 않았다. HARN-09(workflow/CI 회귀·문서)와 HARN-07(release fixture)은 각각 기존 allowlist/Change-Id에 따라 별도 commit해야 한다. PR 병합·보호 설정·배포는 이번 권한에도 포함되지 않는다.

## 2026-09-26 후속 후보 전체 quality 검증

- 기준: delivery HEAD `9b13c81c838a4b393ae616a68c4df0658d08aa70`, 후보는 임시 사본에만 반영. 실제 delivery branch는 clean이며 새 commit·push 없음.
- 환경: macOS arm64, Node 24.18.0, Java 25. 기존 node_modules와 Python 도구 재사용. 원본과 동일한 추적 파일 목록을 임시 Git index로 구성했으며 commit·remote는 만들지 않았다. native 도구는 임시 Git 디렉터리에 설치하고 archive SHA-256을 검사했다.
- 결과: `npm run lint:all` exit 0. API/Web/contracts/scripts/tests/MJS·Java Checkstyle·Ruff·ShellCheck·actionlint·SQL/CSS/Markdown/format 전체 통과. SQL 27개, Markdown 145개, workflow 2개; 언어별 fixture 6/6, finding 0건. 로그: `/private/tmp/blariyo-pr8-full-quality.log`.
- 준비 과정: 임시 index의 첫 등록은 원본에서 추적 중인 ignored worklog 1개 때문에 종료 코드 1이었다. 두 번째에는 원본의 정확한 path 목록만 강제 등록하고 목록 일치를 확인했다. 전체 lint 실행은 1회다.
- 보존 점검: 원본 HEAD·main·stash ref는 과거 snapshot과 동일하다. 과거 파일 hash 56개 중 55개는 동일하고 원본 RESULT.md 1개는 다르다. 이번 후속 작업에서 해당 파일을 수정하지 않았으며 차이를 덮어쓰거나 전체 56개 byte identity 보존으로 보고하지 않는다.
- 한계: 실제 PR 반영·전체 Linux quality·Windows lease·artifact 내용 readback은 미완료. 현재 session의 delivery worktree 및 원본 .git 쓰기 제한은 그대로다.

## 2026-09-26 delivery 작업본에 후속 수정 반영

- 권한 변경: delivery worktree에 파일 쓰기 권한이 추가됐다. 공유 `.git`, delivery의 `.git` 연결 파일 및 `.git/worktrees/blariyo-governance-delivery`는 여전히 읽기 전용이다. 커밋·push의 기존 사용자 승인은 유효하지만 실행 권한은 확보되지 않았다.
- 적용 기준: clean HEAD `9b13c81c838a4b393ae616a68c4df0658d08aa70`에서 patch 3개의 SHA-256 및 적용 가능 여부를 확인하고 7개 파일에 반영했다. 적용 직후 모든 파일이 검증한 임시 사본과 byte 단위로 일치했다. 이후 문서 4개에 이 적용 상태를 갱신했으며 소스 3개는 그대로다.
- 범위: HARN-09는 workflow·CI 순서 회귀·문서, HARN-07은 release CLI fixture다. task allowlist 확장이나 검사 완화는 없다. 아직 staging·commit·push는 하지 않았고 기존 remote SHA를 변경하지 않았다.
- 검증 승계 범위: 동일 소스 후보에서 통과한 macOS 전체 lint·harness 54/54·architecture 9/9를 참조한다. 실제 delivery에서 전체 테스트를 재실행한 것으로 보고하지 않는다. 적용 후 파일 범위·diff 공백·문서 링크를 확인하며, Linux·Windows CI 및 artifact 내용 readback은 미완료다.

## 2026-09-26 코드 커밋·push 및 HARN-07 별도 Draft PR

- Git metadata 쓰기 권한 추가 후 HARN-09 코드 2개 파일을 `8c1b5c1d5d0fd29986607d249bb6d1acc324d9fb`로 커밋했다. release 테스트는 HARN-09 branch의 path allowlist가 거부했으며 hook을 우회하거나 manifest를 확장하지 않았다.
- 동일 HEAD에서 `feature/HARN-07-release-fixture-clock`을 분기하고 staged release 테스트 한 파일만 `0fe6255626de3f8c6a16c9ab7a482e4d26cecb96`로 커밋했다. 두 branch를 active pre-push hook 상태에서 atomic push했다.
- [Draft PR #9](https://github.com/JeahaOh/blariyo/pull/9)는 HARN-07 한 commit/한 파일이다. base는 PR #8의 `feature/HARN-09-ci-diagnostics`이며 검토 차이만 분리한 연결이다. 최종 feature → develop 정책은 유지하고 선행 PR 통합 뒤 retarget·재검증한다.
- [PR #8 실행 36210788239](https://github.com/JeahaOh/blariyo/actions/runs/36210788239): Windows lease와 receipt 생성·업로드가 성공했다. quality는 release fixture 수정이 없는 상태에서 harness 52/54로 실패했다.
- [PR #9 실행 36210803673](https://github.com/JeahaOh/blariyo/actions/runs/36210803673): Linux harness·quality 회귀·harness lint·architecture·전체 lint 및 Windows lease가 통과했다. quality 실패 로그는 `harness error: feature -> feature is not an allowed pull request direction`이다. branch 방향 실패 뒤 commit range 검사는 skip됐으므로 전체 quality gate 성공으로 보고하지 않는다.
- 권한/문서: 최신 권한 변경에서 delivery worktree 자체가 쓰기 허용 목록에서 빠졌다. 기존 문서 4개는 미커밋 상태로 보존했고 최신 결과 갱신은 별도 임시 사본에 준비했다. 공유 .git만 쓰기 허용해도 실제 worktree 파일 편집 권한을 대신하지 않는다.

### 동일 실행 최종 결과

PR #8은 verify·Collector·Windows lease·Core restore 성공, quality·harness-gate 실패, Collector restore·images skip으로 종료됐다. PR #9는 event-context·restore-scope·Windows lease·Collector 성공, quality·verify·harness-gate 실패, Core/Collector restore·images skip으로 종료됐다. quality 내부 Linux lint·harness·architecture 성공과 job 전체 실패를 구분한다.

[PR #9 verify 로그](https://github.com/JeahaOh/blariyo/actions/runs/36210803673/job/108316757770)에서 browser 43개 중 41개 통과·2개 실패를 확인했다. `tests/browser/admin-workflow.test.ts:334`의 이미지 다시 불러오기 버튼 클릭이 10초 timeout됐고, 부모 테스트는 실패한 stage의 완료 증거 기록을 거부했다. PR #8과 #9 사이 해당 파일 diff는 없고 현재 source에는 최신 내용 확인 뒤 aria-busy=false 대기가 없다. 그 대기를 추가한 PR #3 commit `2b61c4c`도 현재 HEAD의 조상이 아니다. 별도 검토 중인 선행 browser 수정과 통합 조건을 해소해야 하며 release fixture 변경으로 새 browser 코드가 들어간 것은 아니다. 같은 CI를 다시 실행하지 않았다.

이번 관찰에서 GitHub 공개 Actions API로 run/job/step 상태를 읽었고 인증된 UI에서 Draft PR #9 및 failure 로그를 대조했다. artifact 내용 다운로드/readback은 여전히 미완료다.

## 2026-09-26 권한 복구 후 현행 문서 갱신

- delivery worktree와 공유 Git metadata 쓰기 권한이 모두 추가됐다. 현재 HEAD `0fe6255`에서 기존 문서 4개의 hash와 준비 patch를 대조한 뒤 최신 결과를 실제 파일에 적용했다. 권한 차단으로 준비만 했다는 앞 절은 당시 기록이다.
- status·roadmap은 최신 원격 결과·남은 수용 조건을 중심으로 정리했고 구현 계획의 Windows 미검증, API build/lint 순서, 테스트 개수 및 PR #3 미전달 설명을 갱신했다. 제품·법무·앱 source·lint 설정·정책 허용 경로는 수정하지 않았다.
- 문서 4개는 현재 HARN-07 manifest의 기존 허용 경로에 속하므로 코드 수정과 분리한 문서 commit으로 전달한다. 미정 계약이나 전체 gate 실패를 완료로 승격하지 않는다.

- 적용 후 검증: Markdown lint 145개 파일 오류 0, 변경 문서 상대 링크 118개 정상, HARN-07 허용 경로 및 변경 파일 4개 일치, `git diff --check` 통과. 이번 변경은 문서뿐이므로 앱·harness 전체 테스트를 다시 실행한 것으로 보고하지 않는다.

## 2026-09-26 PR #3 병합 후 3건 수정과 전달 차단

- PR #3은 사용자 승인으로 develop에 merge commit `1ad626c92dd418f31827d17ccbb9f3580f58447f`를 만들었다. 병합 후 CI `36212646767`은 verify·Collector success, images skipped다. 기존 source SHA `2b61c4c`는 유지한다.
- 이번 범위는 발견한 3건 수정과 병합 가능한 후보 준비다. #4~#9 실제 병합·배포·원격 보호 설정은 포함하지 않는다.
- PR #6 `a1a4802`: 구 applied hash만 맞으면 임의 current hash도 허용하던 API·Collector·콘텐츠 수집 비교를 previous/current 쌍으로 제한했다. API 8개·Collector 6개 버전의 실제 현재 SQL과 legacy hash, 변조 current, 미등록 applied/version을 검증한다. Collector V001은 Spring Batch 6.0.5·Quartz 2.5.2 리소스를 포함하는 합성 hash이며 예전 hash와 새 hash를 직접 계산·대조했다. SQL 원문과 DB ledger는 변경하지 않았다.
- PR #7 `f782c0b`: #8에서 API build/lint 순서·Windows Python 수정, #9에서 release CLI 날짜 fixture 수정을 먼저 포함했다. 진단 보존 구현은 #8에 남겼다. 세 파일은 HARN-08의 기존 허용 경로이며 manifest를 확대하지 않았다.
- #4→#5→#6→#7→#8→#9 순서로 선행 브랜치를 merge했다. PR #3의 browser 대기가 모두 포함되고 원래 8개 commit과 각 PR의 원래 head가 조상으로 남는다. rebase·force push·원격 병합은 없었다. task-range 결과는 #6 333개, #7 56개, #8 8개, #9 문서 4개 경로 통과다.
- 원본은 보존하고 임시 독립 clone에서 bootstrap 이전 브랜치 #4~#6을 준비했다. #6 staged 5개 파일은 기존 검사기로 path·비밀 검사를 수행했다. 임시 사본에서 CI 파일을 적용하려던 restore와 patch 명령은 자동 승인 검토/프로젝트 경계에서 거절돼 실제 쓰기 허용된 delivery worktree로 커밋을 가져왔다. #7 이후 커밋은 설치된 hook을 유지했다.
- 검증: Node 24.18.0 harness 54/54·skip 0, Node migration 계약 회귀 1/1, Collector checksum 회귀 1/1·skip 0, architecture 9/9. 처음 Java 회귀는 JDK 탐색 실패 후 설치된 Java 25 경로를 지정해 성공했다. lint도 기본 Node 25를 거부한 뒤 고정 Node로 실행했다. 전체 lint의 Java Checkstyle·Java fixture는 재사용 Gradle 프로세스의 delivery cache 생성 실패였으며 `--no-daemon`/`GRADLE_OPTS=-Dorg.gradle.daemon=false`로 해당 2개만 재검증해 성공했다. 나머지 lint는 성공, SQL/CSS/Markdown/format finding 0이다. 전체 lint 한 실행의 exit 0이나 새 Linux/Windows CI 성공으로 합쳐 표현하지 않는다.
- 원격 전달 차단: `git push --atomic origin ...`과 단독 `git push origin feature/HARN-08-cleanup-review`가 모두 실행 전 자동 승인 검토에서 거절됐다. 메시지는 `approval required by policy, but AskForApproval is set to Never`이며 구체적 사유는 제공되지 않았다. 사용자 commit·push 권한 부족이나 harness 오류로 해석하지 않는다. 원격 PR 본문·대상·Draft 상태는 갱신하지 않았다.
- 재개 순서: 아래 6개 feature ref를 push하고 새 CI 확인 → #4 검토·병합 → #5/#6을 차례로 develop 대상으로 바꾸고 검증·병합 → #7/#8/#9도 선행 통합 SHA에서 같은 절차. 선행 병합 전 #7~#9의 feature → feature 실패는 정책상 남는다. 성공한 로컬 검사를 원격 병합 가능 판정으로 대체하지 않는다.
- 추가 DB 검증: Node 24.18.0의 API migration 통합 1/1 성공. Java 25 Collector 전체 274/274·77 suites·skip 0·DB readback 15개 성공. 기존 runner가 임의 이름의 임시 DB를 생성·정리했으며 기존 개발 DB 데이터나 운영 DB를 대상으로 실행하지 않았다.
- 문서·전송 준비 검증: Markdown 145개 오류 0, 변경 문서의 상대 링크 88개 존재, diff 공백 검사 통과. outgoing 검사에서 6개 ref·10개 신규 도달 commit을 검사했고 기존 remote head가 각 로컬 head의 조상임을 확인했다. 이 문서 후속 커밋은 같은 검사로 별도 확인한다.

```sh
git -C /Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery push --atomic origin \
  feature/HARN-08-legacy-main-review \
  feature/HARN-08-policy-review \
  feature/HARN-08-cleanup-review \
  feature/HARN-08-harness-review \
  feature/HARN-09-ci-diagnostics \
  feature/HARN-07-release-fixture-clock
```
