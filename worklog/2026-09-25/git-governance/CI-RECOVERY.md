# HARN-09 — CI 실패 복구와 도입 순서

- 시작 기준: recovery HEAD `5957492429b668377bede866c90f878b43225785`, 기존 미커밋 8개 경로 보존.
- 정본: [Git 설계](../../../docs/ai/git-workflow.md), [구현 계획](../../../docs/ai/harness-implementation-plan.md).
- 상태: 로컬 구현·회귀 완료, **task 등록안과 PR 구성은 검토 대기**. `.harness/tasks/HARN-09.json`이 작업 사본에 있다는 사실은 trusted base 등록이나 원격 승인을 뜻하지 않는다.
- 기존 HARN-08은 stash 복구 task로 유지한다. 허용 경로를 확대하지 않으며 HARN-09도 자기 manifest를 구현 허용 경로에 포함하지 않는다.

## 변경과 완료 조건

| 변경                      | Change-Id                              | 범위·완료 증거                                                                                                                                                                     |
| ------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이미지 재시도 테스트 race | `45831498-8ae4-4f2e-9933-42ca6e1df655` | `tests/browser/admin-workflow.test.ts`의 대기 1줄. PR source `ada2474` + 동일 1초 응답 지연에서 실패 재현 후 4/4·12개 게시글·3단계·DB/media readback 통과. 원격 verify 성공은 대기 |
| 최종 gate 진단 보존       | `2bd49d94-8036-44c5-bc8a-4000d4792aa6` | workflow의 진단/receipt 분리와 harness 회귀, 관련 상태 문서. harness 54/54·전체 lint 통과. 실제 artifact 생성·다운로드는 대기                                                      |

고정 runner 검증은 `test:harness`, `lint:harness`, `lint:all`이다. 브라우저 격리 실행·`typecheck:tests`·`lint:tests`와 실제 원격 수용은 이 runner 밖의 추가 필수 증거이며, manifest의 세 명령만 통과했다고 전체 완료로 판정하지 않는다. 브라우저 재현은 총 2회로 종료했고 결과를 반복 실행해 통과한 것으로 바꾸지 않는다.

## 등록과 구현의 분리

1. 정책 등록 PR #1에 HARN-08·HARN-09 manifest와 각 taskRef 문서를 별도 검토 대상으로 준비한다. 현재 PR #1에는 HARN-08·HARN-09가 아직 없다.
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

## 제안 PR 순서와 수용 기준

| 순서 | PR 범위                                            | 적용 전·후 확인                                                                                                                                                     |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | 기존 CI의 브라우저 선행 결함: 대기 1줄만 별도 검토 | harness 활성화 전 기존 CI로 검증. 현재 재현 patch는 준비됐지만 원격 반영·성공은 미완료                                                                              |
| 1    | 기존 local main 8개 commit의 별도 PR               | 기존 commit SHA·작성자 보존. 0번의 수정과 함께 실제 merge-result에서 CI 확인. 기능·법무·운영 활성화 승인을 자동 승계하지 않음                                       |
| 2    | 정책·task 등록 PR #1                               | 최신 develop를 대조하고 설계 문서 2개 충돌 해결. HARN-08/09와 taskRef를 함께 등록하되 검사기 활성화는 별도                                                          |
| 3    | HARN-08의 source·fixture·SQL·문서 cleanup          | 정책/manifest 변경을 제외한 등록 범위만 반영. 원문 HTML 바이트·SQL checksum 계약 유지. 정확한 후보 SHA에서 기존 CI·migration 회귀 확인                              |
| 4    | harness 활성화 PR #2와 HARN-09 진단 보완           | cleanup이 포함된 base에서 전체 lint·architecture·Windows·restore·receipt 검증. 기존 PR #2의 55개 구현 경로와 중복을 대조하며 새 branch/commit 범위별 task 검사 수행 |
| 5    | 원격 보호와 release/hotfix 수용                    | 성공한 stable check 등록, 검사기 변경 보호, direct push·실패 병합 거부와 provider readback 확인                                                                     |

0번은 새 gate가 아직 배포되지 않은 시점의 기존 CI 선행 결함 수정이다. 해당 1줄과 기존 8개를 검토한 도입 기준선에 포함하고 실제 SHA를 기록한다. 새 gate 활성화 뒤에는 같은 경로를 예외로 두지 않는다. 기존 CI를 끄거나 실패를 무시한 병합, secret 이력 검사 면제는 제안하지 않는다.

이 표는 통합 실행안이다. 현재 refs를 바꾸거나 PR #1/#2를 수정·병합한 결과가 아니다. 새 commit·push·merge와 보호 설정은 각각 명시된 범위에서 실행한다. 기존 8개 별도 PR 선택은 그 자체로 push·merge 승인이 아니다.

도입 이후의 정책 등록 경로는 별도 미완료 항목이다. 현재 `task-range`는 policy/manifest 변경을 일반 구현 범위에서 차단하지만, 그 변경을 검토·승인할 전용 governance gate는 아직 구현되지 않았다. 초기 PR #1을 기존 CI에서 검토하는 순서만으로 향후 task 등록까지 해결했다고 판단하지 않는다. 원격 필수 gate 활성화 전 전용 검토 경로와 검사기 변경 보호를 함께 확정·검증해야 한다.

## 검증·보존

- 실행 로그와 SHA별 근거는 [복구 기록](STASH-RECOVERY.md)의 CI 진단·브라우저 race 절을 따른다.
- manifest schema·정확한 9개 허용 경로·중복 없는 UUID·taskRef 존재·고정 검증 명령·resource 선언을 확인했다. HARN-08 manifest는 변경하지 않았다.
- 임시 Git 저장소에서 실제 `checkTaskRange`, `buildCiContext`, `taskLeaseSpec`으로 검사했다. 등록된 base 위의 두 Change-Id 구현은 통과했고, 등록 파일을 구현에 혼합·무관한 source 추가·base manifest 누락은 각각 거부됐다. 기대 결과 4/4이며 실제 PR의 base/head 통과 증거는 아니다.
- 검사 결과: `/tmp/blariyo-harn09-contract-result.json`. 임시 저장소는 검사 후 제거했다.
- 원본 stash·refs·미추적 56개와 다른 세션 worktree를 보존한다. PR의 정확한 base/head에서 재검증하기 전 원격 완료로 표시하지 않는다.
