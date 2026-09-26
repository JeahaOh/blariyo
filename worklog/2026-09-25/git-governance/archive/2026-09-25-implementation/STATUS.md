# Git governance 현재 진행 현황

- 확인 시각: **2026-09-25 22:57~22:58 KST**. 이후 변경은 이 기록에 포함되지 않는다.
- 종합 판정: **로컬 구현·복구·분리 커밋·검토용 PR 전달까지 진행. develop 통합과 원격 강제 적용은 미완료.**
- 이번 갱신은 상태 문서 작업이다. source·Git 설정·브랜치·PR·배포를 변경하거나 테스트를 재실행하지 않았다.
- [RESULT.md](RESULT.md)는 이전 작업 시점의 기록이다. 그 안의 “remote develop 없음”, “미커밋·미push”는 현재 상태가 아니다. 과거 검증 기록은 소급 수정하지 않고 이 문서를 최신 현황 진입점으로 사용한다.

## 1. 어디까지 끝났는가

| 단계                       | 현재 판정              | 확인한 내용                                                                                              |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| 브랜치·harness 설계 문서화 | 작성됨, 보완 사항 있음 | Gitflow·task 식별·hook·lint·architecture·CI 증거 계약이 있다. 도입 이후 task 등록 전용 gate 등은 남았다  |
| 로컬 구현·품질 정리        | 주요 구현·검증 완료    | harness, hook, 전체 언어 lint, SQL/checksum 호환, architecture, CI workflow 구현과 로컬 검증 기록이 있다 |
| stash 복구·변경 분리       | 완료                   | 원본 stash 보존, 복구 6단계와 상태 문서까지 7개 commit 보존. 기존 main 8개도 SHA 그대로 분리             |
| 원격 검토 자료 전달        | 완료                   | 새 검토 branch 6개 push, Draft PR #3~#8 생성. 최신 전달 문서 commit `9b13c81`까지 원격 반영              |
| develop 통합               | 미완료                 | main/develop/release가 모두 `8af7244`. PR #1~#8은 모두 열려 있고 병합되지 않음                           |
| 원격 CI 전체 수용          | 미완료                 | 로컬 통과와 별개. 이전 Windows setup 실패가 있고 최신 PR #8 실행은 확인 당시 Waiting                     |
| 원격 보호·운영 적용        | 미완료                 | required check·검사기 변경 보호·실제 release/hotfix 수용 완료 증거가 없음                                |

**진척을 한 숫자로 환산하지 않는다.** 구현·전달이 끝난 항목과 실제 병합·차단·배포 검증이 남은 항목의 비중이 다르다. 현재 단계는 “검토 가능한 변경을 전달했고 통합·원격 수용을 진행할 단계”다.

## 2. 브랜치와 PR 현황

`git ls-remote --heads origin`으로 원격 SHA를 직접 확인했다. PR 상태는 GitHub 목록에서 확인했다.

| 대상                                      | 확인한 SHA·상태                              | 의미                                            |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| origin/main·origin/develop·origin/release | 모두 `8af7244`                               | 검토 변경은 통합·운영 기준에 아직 들어가지 않음 |
| 기존 local main                           | `e51f1b5`, 기존 8개 commit                   | SHA·작성자 보존 대상; PR #4에서 별도 검토       |
| 원본 recovery branch                      | `5957492`                                    | 복구 7개 commit 보존; 새 검토 branch와 구분     |
| 최신 전달 branch                          | `feature/HARN-09-ci-diagnostics` / `9b13c81` | 로컬·원격 일치. CI 보완과 전달 현황 문서 포함   |
| 원본 stash                                | `c373dac4ad6584e663ad958d1c9d64767dc48605`   | 여전히 존재                                     |

| PR                                              | 범위                                      | commit 수 / 변경 파일 수 | 현재 상태     |
| ----------------------------------------------- | ----------------------------------------- | ------------------------ | ------------- |
| [#3](https://github.com/JeahaOh/blariyo/pull/3) | 브라우저 이미지 재시도 테스트 대기 1줄    | 1 / 1                    | Draft, 미병합 |
| [#4](https://github.com/JeahaOh/blariyo/pull/4) | 기존 main의 analytics·관리자 UX·관련 문서 | 기존 8 / 72              | Draft, 미병합 |
| [#5](https://github.com/JeahaOh/blariyo/pull/5) | 정책·HARN-08/09 등록과 근거 문서          | 1 / 14                   | Draft, 미병합 |
| [#6](https://github.com/JeahaOh/blariyo/pull/6) | source·fixture·SQL/checksum·문서 cleanup  | 4 / 333                  | Draft, 미병합 |
| [#7](https://github.com/JeahaOh/blariyo/pull/7) | harness·quality·workflow 활성화           | 1 / 56                   | Draft, 미병합 |
| [#8](https://github.com/JeahaOh/blariyo/pull/8) | CI 실패 진단과 전달 문서                  | 2 / 8                    | Draft, 미병합 |

- 기존 [#1 정책 등록](https://github.com/JeahaOh/blariyo/pull/1)은 Open, [#2 초기 harness](https://github.com/JeahaOh/blariyo/pull/2)는 Draft로 남아 있다. 새 #5/#7과 중복되는 변경을 함께 병합하지 않도록 최종 통합 후보를 정해야 한다.
- #3/#4의 base는 develop이다. #5 → #4 branch, #6 → #5 branch, #7 → #6 branch, #8 → #7 branch를 비교 기준으로 사용한다.
- 이 feature base 연결은 변경을 나누어 검토하기 위한 것이다. 현행 정책은 feature → develop만 허용하므로 **선행 변경 통합 후 develop로 대상 변경(retarget)하고 정확한 후보 CI를 다시 확인해야 한다.** 지금 보이는 PR을 feature branch끼리 순서대로 병합하라는 뜻이 아니다.

## 3. 검증 결과를 어떻게 읽어야 하는가

| 증거                          | 확인된 결과                                                                        | 적용 범위·한계                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| delivery harness 실행 로그    | **54/54**, 실패·skip 0                                                             | 기존 실행 로그를 이번에 다시 읽음. 이번 문서 작업에서 테스트 재실행하지 않음 |
| delivery lint:harness         | 통과 기록                                                                          | harness 코드·회귀 범위. 전체 앱·원격 CI 성공을 의미하지 않음                 |
| 복구 시 전체 lint             | SQL 27개 포함 finding 0                                                            | 복구 snapshot의 과거 증거. 분리된 모든 PR의 정확한 merge-result 통과와 구분  |
| 복구 시 주요 회귀             | quality 10/10, architecture 9/9, API 단위 34/34, Collector 273/273, 브라우저 26/26 | 전체 복구 작업 사본 기준. 각 중간 commit을 모두 따로 검증한 결과가 아님      |
| 복구 시 migration·restore     | Core 31개·Collector 41개 table/sequence 복원 기록                                  | 격리 DB 검증. production 배포·복원 승인과 별개                               |
| PR #1 실패 재현·수정          | 지연 조건에서 실패 재현 후 테스트 1줄 수정으로 4/4 통과 기록                       | 수정은 #3에 전달됨. 원격 최종 후보의 CI 수용은 별도                          |
| PR #8 첫 실행 `36143920729`   | Windows setup 실패 기록                                                            | 구현 SHA `48ec5c1`의 실행. 최신 문서 commit의 실행과 구분                    |
| PR #8 최신 실행 `36144240604` | **Waiting**, artifact 표시 `–`                                                     | head `9b13c81`; 확인 당시 최종 결과 없음. 성공으로 표시하지 않음             |

Windows 실패 원인은 **Windows 2025 x64에서 고정한 Python `3.12.11`을 setup-python이 찾지 못한 것**이다. lease(동시에 같은 자원을 쓰지 못하게 하는 잠금) 테스트 자체는 실행되지 않았다. Python/runner 조합을 확인하고 수정한 뒤 실제 Windows 검증이 필요하다.

- 최신 실행: [PR #8 CI](https://github.com/JeahaOh/blariyo/actions/runs/36144240604).
- 첫 Windows 실패: [job 근거](https://github.com/JeahaOh/blariyo/actions/runs/36143920729/job/108100236397?pr=8), [전달 기록](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/worklog/2026-09-25/git-governance/CI-RECOVERY.md).
- 로컬 로그: `/tmp/blariyo-delivery-harness.log`, `/tmp/blariyo-delivery-lint-harness.log`. 다른 PC나 정리 이후에는 보장되지 않는 로컬 증거 경로다.
- #3~#7의 최신 전체 CI 결과와 원격 보호 Settings는 이번 갱신에서 각각 재조회하지 않았다. 이전 보호 미설정 기록을 현재 재확인한 사실로 바꾸지 않는다.

## 4. 무엇이 부족한가 — 우선순위와 완료 조건

| 우선순위 | 남은 항목                         | 완료라고 판단할 증거                                                                                                |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| P0       | Windows 실행 환경 수정            | 지원되는 고정 Python/runner 조합으로 실제 lease 테스트 성공·receipt 확인                                            |
| P0       | 기존 8개와 중복 PR 검토·통합      | #3 선행 결함 수정, #4 기능 검토, #1/#5·#2/#7 중복 처리, 승인된 변경의 develop 반영                                  |
| P0       | 정확한 통합 후보의 CI 통과        | develop 기준 head/merge-result에서 lint·architecture·앱·Windows·필요한 restore·최종 gate 성공                       |
| P0       | 정책/task 등록 전용 검토 경로     | 일반 구현 PR의 정책 자기확장 차단을 유지하면서 새 task를 등록할 수 있는 별도 governance gate 구현·거부 회귀         |
| P0       | 원격 진단·검증 증거 수용          | artifact를 내려받아 run/attempt·subject SHA·context/binding hash·job 결과 일치 확인. 단순 업로드와 검증 완료를 구분 |
| P0       | 필수 검사·검사기 자체 보호        | required check와 trusted workflow 또는 code-owner 보호 설정·readback, direct push·실패 병합 거부 확인               |
| P1       | task schema·세션 lease 보강       | schema 누락/오류 차단, 자동 heartbeat(작업 생존 신호), 다중 host·지원 OS·보존기간 계약과 회귀                       |
| P1       | 새 worktree의 hook 경로 상속 보강 | 다른 worktree의 hooksPath를 물려받는 경우 자동 진단·안전한 설치 및 기존 worktree 설정 보존 확인                     |
| P2       | 실제 release/hotfix 수용          | 제품 version/tag/image 규약, 운영 SHA·artifact·복원 증거, main/develop/활성 release 재반영 검증                     |
| P2       | 단일 release branch 처리          | 현재 `release`와 설계의 `release/<version>` 차이를 해소할 방침 확정. 자동 삭제·이름 변경은 하지 않음                |

담당자·기한은 `(미정)`이다. 이 표는 남은 작업의 상태·완료 조건이며 이번 문서 갱신이 병합·원격 설정·배포 권한을 추가하지 않는다.

## 5. HARN task별 판정

| Task    | 판정                                     | 핵심 잔여                                            |
| ------- | ---------------------------------------- | ---------------------------------------------------- |
| HARN-01 | 부분 구현                                | schema 보강, task 등록 governance 경로               |
| HARN-02 | 부분 구현                                | 자동 heartbeat·다중 host·실제 Windows 수용           |
| HARN-03 | 부분 구현                                | 원격 context/receipt artifact 내용 대조              |
| HARN-04 | 부분 구현                                | 신규 worktree의 외부 hook 경로 상속 자동 진단        |
| HARN-05 | 부분 구현                                | 정확한 후보 CI·필수 검사·검사기 보호·원격 거부 증거  |
| HARN-06 | 로컬 품질 정리 완료, 원격 수용 미완료    | 통합 후보 lint·architecture 및 강제 적용 검증        |
| HARN-07 | 부분 구현                                | 실제 release/hotfix·provider·배포·재반영 증거        |
| HARN-08 | 복구·분리 전달 완료, 통합 미완료         | 기존 기능과 cleanup/harness의 순차 검토·develop 통합 |
| HARN-09 | 수정·등록안·Draft 전달 완료, 수용 미완료 | #3/#8 원격 검증, 등록안의 trusted develop 반영       |

## 6. 정본과 이력 위치

현재 원본 checkout은 develop `8af7244`다. 최신 governance 문서·구현이 아직 병합되지 않아 이 checkout의 파일만 보면 이전 상태가 보일 수 있다. 아래 링크는 이번 확인에서 사용한 **전달 commit `9b13c81`에 고정**했다.

- [Git 설계](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/docs/ai/git-workflow.md), [구현 계획](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/docs/ai/harness-implementation-plan.md).
- [전달 시 status](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/docs/status.md), [남은 작업 roadmap](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/docs/roadmap.md).
- [stash 복구 상세](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/worklog/2026-09-25/git-governance/STASH-RECOVERY.md), [CI 복구·PR 전달 상세](https://github.com/JeahaOh/blariyo/blob/9b13c81c838a4b393ae616a68c4df0658d08aa70/worklog/2026-09-25/git-governance/CI-RECOVERY.md).
- 이 폴더의 과거 자료: [최초 요청](REQUEST.md), [구현·검증 당시 결과](RESULT.md), [브랜치 인벤토리](BRANCH-TRANSITION-INVENTORY.md), [develop 기준 결정](DEVELOP-BOOTSTRAP-DECISION.md), [lint 후보 검토](LINT-CANDIDATE-REVIEW.md).

이 현황은 기획·법무·제품 정본을 변경하지 않으며 새로운 제품 출시 조건을 추가하지 않는다. 다음 갱신에서는 새 SHA·run ID·관찰 시각을 기록하고 기존 로컬 통과 수치를 원격 통과로 승계하지 않는다.
