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
