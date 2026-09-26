# Git governance T0 — develop 통합 실행 계획

- 판정: **T0 계획 확정 완료. 변경 통합과 governance 운영 도입은 미완료.**
- 요청 범위: [REQUEST.md](REQUEST.md). 이번 쓰기는 이 파일 하나이며 T1을 시작하지 않는다.
- 확인: 2026-09-26 **12:52:29~12:55:36 KST**에 GitHub PR/Actions 공개 API, 인증된 GitHub 로그 화면, 공유 Git 객체와 구현 작업본을 대조했다. 아래 시각은 KST다.
- CI 재실행·새 실행, source/test/workflow/policy 수정, branch/PR 변경, commit/push/merge, hook/보호 설정, DB 변경·배포는 수행하지 않았다. 기존 goal도 변경·재개하지 않았다.
- 현재 병합 가능 판정은 **차단**이다. #4의 선행 테스트 수정과 #9의 포맷 수정, 순차 통합 후 develop 대상 검증, 단계별 사용자 승인이 필요하다.

## 1. 기준 작업본과 원문

| 대상 | 확인 결과 | 해석 |
| --- | --- | --- |
| 기본 작업본 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` | `develop`, HEAD=`8af72449a7d56c9701efd0d73dc7d430a66f9610`; 추적 파일 변경 없음, 기존 미추적 파일 58개 | 로컬 `origin/develop`도 같은 과거 SHA. 원격 현재값과 다르다. checkout을 갱신하지 않음 |
| 구현 작업본 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery` | `feature/HARN-07-release-fixture-clock`, HEAD=`6a431358db73b9c59be4125fa0749beb014e7acd`; clean | 원격 PR #9 head와 일치. source·정본 확인 위치 |
| 실제 원격 develop | `1ad626c92dd418f31827d17ccbb9f3580f58447f`, 12:52:42 API 확인 | 아래 `D0`. PR #3 병합 결과. 로컬 tracking 표기를 원격 사실로 사용하지 않음 |
| 보존 자원 | stash=`c373dac4ad6584e663ad958d1c9d64767dc48605`; local main=`e51f1b501f7cc327da279102dd69eac2f4c554db`; worktree 7개 | stash apply/pop/drop, 다른 세션 파일·ref 변경 없음 |
| 원격 강제 | develop API의 `protected=false` | 보호 활성화 증거 없음. 전체 branch ruleset·권한 재감사는 범위 밖이며 통합 승인과 별개 |

기본 checkout에 없는 설계 파일은 생성하지 않았다. 다음은 구현 작업본의 고정 SHA 원문이다. 문서 안의 과거 checkout 이름·push 차단·Windows 미검증·SQL 434건 등을 현재 상태로 승계하지 않았다.

- [Git 작업 설계](https://github.com/JeahaOh/blariyo/blob/6a431358db73b9c59be4125fa0749beb014e7acd/docs/ai/git-workflow.md): merge commit, SHA 보존, trusted base, 필수 gate와 운영 강제의 경계.
- [Harness 구현 계획](https://github.com/JeahaOh/blariyo/blob/6a431358db73b9c59be4125fa0749beb014e7acd/docs/ai/harness-implementation-plan.md): 기존 8개 선행 통합, 정책 등록 후 활성화, 검사·복원 계약.
- [상태](https://github.com/JeahaOh/blariyo/blob/6a431358db73b9c59be4125fa0749beb014e7acd/docs/status.md), [로드맵](https://github.com/JeahaOh/blariyo/blob/6a431358db73b9c59be4125fa0749beb014e7acd/docs/roadmap.md): Git/harness 범위만 현재 source·원격 결과와 대조.
- [CI 복구 기록](https://github.com/JeahaOh/blariyo/blob/6a431358db73b9c59be4125fa0749beb014e7acd/worklog/2026-09-25/git-governance/CI-RECOVERY.md): 과거 검증과 3건 수정의 탐색 근거. 당시 기록은 소급 수정하지 않음.

## 2. PR 및 최신 CI 상태

### 2.1 정확한 입력 SHA

`H4`~`H9`는 이번에 확인한 원격 source head다. 이후 수정·동기화 결과 SHA는 아직 존재하지 않으므로 추측하지 않는다.

| PR·확인 시각 | head branch / 정확한 head SHA | base branch / PR API base SHA | 상태 |
| --- | --- | --- | --- |
| [#3](https://github.com/JeahaOh/blariyo/pull/3), 12:52:29 | `feature/HARN-09-browser-retry` / `2b61c4ca038adea80069f0d020019199b4c1e53c` | `develop` / `8af72449a7d56c9701efd0d73dc7d430a66f9610` | **병합 완료**, Draft 아님. 11:43:27 병합, merge SHA=`D0` |
| [#4](https://github.com/JeahaOh/blariyo/pull/4), 12:52:29 | `feature/HARN-08-legacy-main-review` / **H4=`df7482704c7867712c12028d1a69e59bfd662acc`** | `develop` / `1ad626c92dd418f31827d17ccbb9f3580f58447f` | open·Draft·미병합 |
| [#5](https://github.com/JeahaOh/blariyo/pull/5), 12:52:29 | `feature/HARN-08-policy-review` / **H5=`8a72c9ae3e09460718de61065810a95594cd891c`** | `feature/HARN-08-legacy-main-review` / `df7482704c7867712c12028d1a69e59bfd662acc` | open·Draft·미병합 |
| [#6](https://github.com/JeahaOh/blariyo/pull/6), 12:52:29 | `feature/HARN-08-cleanup-review` / **H6=`a1a4802c75c0048345778ad11ae2af39b9315fd7`** | `feature/HARN-08-policy-review` / `8a72c9ae3e09460718de61065810a95594cd891c` | open·Draft·미병합 |
| [#7](https://github.com/JeahaOh/blariyo/pull/7), 12:52:29 | `feature/HARN-08-harness-review` / **H7=`f782c0be80763f279cd11fb261bfc825cadf9b6d`** | `feature/HARN-08-cleanup-review` / `a1a4802c75c0048345778ad11ae2af39b9315fd7` | open·Draft·미병합 |
| [#8](https://github.com/JeahaOh/blariyo/pull/8), 12:52:29 | `feature/HARN-09-ci-diagnostics` / **H8=`299ea62ab8eb3e00d4471fc82930137fc5026dc0`** | `feature/HARN-08-harness-review` / `f782c0be80763f279cd11fb261bfc825cadf9b6d` | open·Draft·미병합 |
| [#9](https://github.com/JeahaOh/blariyo/pull/9), 12:52:30 | `feature/HARN-07-release-fixture-clock` / **H9=`6a431358db73b9c59be4125fa0749beb014e7acd`** | `feature/HARN-09-ci-diagnostics` / `299ea62ab8eb3e00d4471fc82930137fc5026dc0` | open·Draft·미병합 |

PR #3의 base는 병합된 PR에 남은 당시 값이며 현재 develop은 `D0`다. #4~#9는 API `mergeable=true`였지만 이는 충돌 가능성 계산일 뿐 CI·승인 통과가 아니다.

### 2.2 현재 head에 연결된 최신 실행

실행 목록 확인 12:52:43, job/step 확인 12:52:57. 아래 실행은 모두 **attempt 1, completed**이며 실행 중인 최신 CI는 없다. PR 실행의 `head_sha`는 위 head와 일치한다. Actions API의 head SHA와 실제 checkout된 합성 병합 SHA는 다른 필드다. 이번에는 checkout SHA/artifact 내용 전체 readback까지 완료하지 않았으며, 다음 통합 때 실제 subject SHA를 반드시 고정한다.

| 대상 / API 실행 head SHA | 실행 ID·URL | 결과 및 범위 |
| --- | --- | --- |
| #3 / `2b61c4ca038adea80069f0d020019199b4c1e53c` | [36143693503](https://github.com/JeahaOh/blariyo/actions/runs/36143693503) | PR CI success. 아래 병합 후 실행과 구분 |
| #3 병합 후 develop / `1ad626c92dd418f31827d17ccbb9f3580f58447f` | [36212646767](https://github.com/JeahaOh/blariyo/actions/runs/36212646767) | **success**. `workflow_dispatch`; verify·collector success, images skipped |
| #4 / H4 | [36214959953](https://github.com/JeahaOh/blariyo/actions/runs/36214959953) | **failure**. verify의 browser 41/43, collector success, images skipped |
| #5 / H5 | [36214960745](https://github.com/JeahaOh/blariyo/actions/runs/36214960745) | **failure**. verify의 browser 41/43, collector success, images skipped |
| #6 / H6 | [36214960444](https://github.com/JeahaOh/blariyo/actions/runs/36214960444) | **success**. verify·collector success, images skipped. 이 단계에는 새 quality/harness/restore gate가 없음 |
| #7 / H7 | [36214960591](https://github.com/JeahaOh/blariyo/actions/runs/36214960591) | **failure**. event-context·restore-scope·Windows lease·verify·collector·Core restore success. quality는 PR 방향 실패, 후속 commit scan skipped; harness-gate failure. Collector restore·images skipped |
| #8 / H8 | [36214960603](https://github.com/JeahaOh/blariyo/actions/runs/36214960603) | **failure**. #7과 같은 job 결과. quality 내부 harness·quality 회귀·harness lint·architecture·전체 lint는 success, PR 방향에서 실패 |
| #9 / H9 | [36214960778](https://github.com/JeahaOh/blariyo/actions/runs/36214960778) | **failure**. event-context·restore-scope·Windows lease·verify·collector success. quality는 전체 lint에서 Prettier 1건 실패; 방향·commit scan은 skipped. harness-gate failure; Core/Collector restore·images skipped |

동일 push 묶음의 이전 취소 실행은 최신 판정에서 제외했다. 모두 attempt 1이며 #5 [36214960510](https://github.com/JeahaOh/blariyo/actions/runs/36214960510), #6 [36214960391](https://github.com/JeahaOh/blariyo/actions/runs/36214960391), #7 [36214959850](https://github.com/JeahaOh/blariyo/actions/runs/36214959850), #8 [36214959855](https://github.com/JeahaOh/blariyo/actions/runs/36214959855), #9 [36214960004](https://github.com/JeahaOh/blariyo/actions/runs/36214960004)가 `cancelled`다. 과거 `36210803673` 등 다른 head의 성공 step도 현재 전체 성공으로 승계하지 않았다.

## 3. 인계된 3건의 원격 반영 확인

| 항목 | 현재 diff·이력 근거 | 검사 근거와 한계 | 판정 |
| --- | --- | --- | --- |
| 승인된 previous/current checksum 쌍 제한 | [a1a4802](https://github.com/JeahaOh/blariyo/commit/a1a4802c75c0048345778ad11ae2af39b9315fd7)의 5개 파일. API V001~V008, Collector V001~V006, 콘텐츠 runner가 정확한 현재값 일치 또는 등록된 previous/current 쌍만 허용. 변경된 current·미등록 applied/version 거부 회귀 포함 | H6의 verify는 migration 계약을 포함하는 `npm test` 및 API 격리 통합, collector는 Java 회귀를 실행하여 success. Collector V001 합성 hash 입력을 사용하는 거부 회귀 source도 확인. T0에서는 DB 회귀 재실행 안 함 | **원격 반영 확인**. develop 미통합 |
| #7 활성화 전 API build·Windows Python·날짜 fixture 선반영 | [f782c0b](https://github.com/JeahaOh/blariyo/commit/f782c0be80763f279cd11fb261bfc825cadf9b6d)의 3개 파일. architecture/API build가 전체 lint보다 먼저, Windows Python=`3.13.15`, CLI fixture는 실행 시각 상대값. validator의 stale/future 검사는 유지 | #7 최신 quality의 harness·quality 회귀·lint:harness·architecture·lint:all success, Windows lease success. 이후 PR 방향 실패는 별도 | **원격 반영 및 해당 step 통과 확인** |
| 후속 브랜치 동기화·task 범위 | 원격 head와 로컬 Git 객체 SHA 일치. `D0 → H4 → H5 → H6 → H7 → H8 → H9`가 모두 ancestor 관계. 원래 8개와 #3 source를 모든 후속 head가 보존 | T0의 읽기 전용 `checkTaskRange`로 H5..H6=333, H6..H7=56, H7..H8=8, H8..H9=4개 경로 통과. 기준은 각 base에 등록된 manifest. 미래 develop 대상 범위·합성 merge-result 검사는 아직 아님 | **원격 반영·현재 연결 범위 확인** |

checksum 구현·회귀 위치: [API 함수](https://github.com/JeahaOh/blariyo/blob/a1a4802c75c0048345778ad11ae2af39b9315fd7/apps/api/src/commands/migration-checksum-compatibility.ts#L38), [콘텐츠 함수](https://github.com/JeahaOh/blariyo/blob/a1a4802c75c0048345778ad11ae2af39b9315fd7/scripts/content/migration-checksum.mjs#L9), [Node 거부 회귀](https://github.com/JeahaOh/blariyo/blob/a1a4802c75c0048345778ad11ae2af39b9315fd7/tests/migration-contracts.test.ts#L67), [Collector 거부 회귀](https://github.com/JeahaOh/blariyo/blob/a1a4802c75c0048345778ad11ae2af39b9315fd7/apps/collector/src/test/java/com/blariyo/collector/ops/MigrationMainTests.java#L25).

과거 push 거절 기록은 **해소된 전달 문제**다. 현재 사용자 승인·실행 환경이 향후 push/merge까지 허용한다고 추론하지 않는다.

## 4. 변경·중복·의존성

| PR | 현재 base..head 변경 | 의존성·처리 |
| --- | --- | --- |
| #4 | 9 commits, 72 files = 기존 8개 + #3 동기화 merge. GA4 v1, 관리자 UX, 관련 설계·작업 기록 | 새 gate 전 도입 기준선. 기존 8개는 trailer 없음. 새 결함 D01 수정 후 기존 CI를 통과해야 함. GA4 실제 수신·운영 활성화 승인과 분리 |
| #5 | 2 commits, 14 files. `.harness/policy.json`, HARN-06/07/08/09, 설계 2개와 등록 근거 | #4 통합 후 develop으로 변경. 정책 등록을 #7보다 먼저 완료. #1을 대신하는 확장 등록안 |
| #6 | 6 commits, 333 files. 앱·도구·fixture·문서 정리, SQL 포맷/contract evolution, checksum 호환·거부 회귀 | #5 등록 선행. 단순 공백 변경만은 아님: D01의 테스트 선택자 수정도 포함. 원문 parser HTML의 base..head diff는 0개. API/Collector migration 검사 필요 |
| #7 | 3 commits, 56 files. harness/hooks/quality/architecture/restore와 CI 연결, API build·Windows·날짜 선행 보완 | #6 통합 후 trusted develop 대상으로만 수용. #2 구현을 포함·보완한 활성화안 |
| #8 | 4 commits, 8 files. gate 진단과 receipt 분리, workflow 거부 회귀, 문서 | #7에 API build/Python 수정이 먼저 반영되어 현재 실질 코드 차이는 진단 보존과 회귀. 중복 수정 commit을 삭제하거나 rebase하지 않고 이력을 보존 |
| #9 | 4 commits, **문서 4개만** | release fixture 코드는 #7에 이미 포함. HARN-07의 원래 fixture commit과 문서 이력을 보존하기 위해 순서대로 merge. D02 포맷 수정과 현행 상태 정리가 필요 |

현재 각 선행 head가 다음 head의 조상이므로 과거 기록의 설계 2개 add/add 충돌을 현재 동일한 장애로 표시하지 않는다. 향후 새 develop 변경과의 충돌은 별도 확인한다.

**#1/#2 중복 판단에 필요한 최소 확인:** 12:52:29 기준 #1은 open·비Draft, head=`ada24744af144b7a3d72df3e029e1845594dc33c`; #2는 open·Draft, head=`f376e3dd7a2a41d489d5e0e67b591d62fe151753`. 두 PR API base는 `develop`/`8af72449a7d56c9701efd0d73dc7d430a66f9610`이며 현재 develop의 새 값과 구분한다. #1의 11개 경로 중 7개는 H9와 같은 blob, 3개는 후속 개정, `docs/ai/governance-bootstrap.md`는 초기 도입 설명으로 후속 경로에 없다. #2의 독립 구현 55개 중 49개는 같은 blob, 5개는 CI·fixture·parser 포맷 제외·browser Docker 명령 보완, `PR-RECOVERY.md`는 이전 전달 기록으로 남는다. 두 누락 문서는 원래 PR의 과거 이력으로 보존하며 현재 기능 누락으로 계산하지 않는다. **#1/#2는 통합 경로에서 제외하고 이중 병합하지 않는다.** 종료·삭제도 이번 계획의 자동 실행에 포함하지 않는다.

보존할 기존 8개 SHA:

```text
46053992f93a4fc83fe769787d1aad818e8e9d33
f920954862fb4fbf8bf15608d996670030fd1f7b
945b7462eaf2c7effdb810718f77cd3149c07911
21b8828d07e059fc93b23caf81d0ecf97957cb15
8389eeee11a2f01af36843b2d94a350b10363b5b
62f6fe5d7727e1c040c87537b5a7ba9a570de4e2
6e053140b5367ebabb61e5c476dcb128304ef1cb
e51f1b501f7cc327da279102dd69eac2f4c554db
```

## 5. 실제 차단과 새 결함

### D01 — #4/#5의 브라우저 테스트 선택자 불일치: T1 수정 필요

- 위치: H4의 [tests/browser/admin-recovery.test.ts:181](https://github.com/JeahaOh/blariyo/blob/df7482704c7867712c12028d1a69e59bfd662acc/tests/browser/admin-recovery.test.ts#L181)~184. 실제 UI는 [AdminWorkspace.vue:43](https://github.com/JeahaOh/blariyo/blob/df7482704c7867712c12028d1a69e59bfd662acc/apps/web/app/components/AdminWorkspace.vue#L43).
- 영향: `관리 메뉴` 안의 `공개 목록`은 해당 화면에 없다. 30초 timeout으로 #4·#5 browser 41/43·verify failure. #3의 이미지 재조회 대기와 별개이며 #3 포함만으로 해결되지 않는다.
- 관측: [#4 실패 로그](https://github.com/JeahaOh/blariyo/actions/runs/36214959953/job/108329001214#step:15:70), [#5 실패 로그](https://github.com/JeahaOh/blariyo/actions/runs/36214960745/job/108329006234#step:15:70). 두 실행 모두 `admin-recovery.test.ts:184`에서 동일 locator timeout.
- 권장: #6의 기존 [35903da](https://github.com/JeahaOh/blariyo/commit/35903da845f15812d80e7038ac643f50698ccc88)에 있는 `.admin-sidebar-bottom`/`공개 사이트 보기` 선택자 변경만 #4에 **추가 commit**으로 선반영한다. 전체 cleanup commit을 조기 반영하거나 이력을 재작성하지 않는다. 미저장 이탈 거부·입력 보존·중복 생성 방지 회귀를 유지한다.
- 별도 승인 후에만 수정·검증·commit/push한다. #5 이후는 최신 develop을 merge해 전달하고 #6의 동일 수정과 최종 diff를 확인한다. 이번에는 수정하지 않았다.

### D02 — #9 docs/status.md 포맷 1건: T4 수정 필요

- 위치: H9의 [docs/status.md:79](https://github.com/JeahaOh/blariyo/blob/6a431358db73b9c59be4125fa0749beb014e7acd/docs/status.md#L79).
- 영향: [#9 quality 로그](https://github.com/JeahaOh/blariyo/actions/runs/36214960778/job/108329068856)에 `1 findings remain blocking: {"prettier":1}`. 전체 lint 실패로 방향 검사보다 먼저 중단된다.
- 재현: 기존 Node 24.18.0·고정 Prettier로 #9 변경 문서 4개에 `--list-different`를 읽기 전용 실행, exit 1·`docs/status.md`만 출력. 메모리에서 format 결과와 비교한 차이는 79행의 두 물결표 범위 표기다. 파일 저장 없음.
- 권장: 문서 현행화와 함께 범위 표기를 `HARN-01부터 HARN-07`, `PR #4부터 #9`처럼 모호하지 않게 바꾸고 포맷을 검증한다. baseline 예외를 새로 승인하거나 lint 정책을 완화할 문제가 아니다. base에 `.quality/baseline.json`이 없어도 finding 0이면 현재 계약상 통과한다.

### 선행 통합·승인·외부 증거 대기

| 종류 | 실제 조건 | 처리 |
| --- | --- | --- |
| 선행 통합 | #7/#8은 최신 quality의 PR 방향 검사 실패. #9도 현재 feature base이며 D02가 먼저 실패해 방향 검사는 미실행 | 앞 PR이 develop에 통합된 후에만 대상 변경·동기화. 방향 정책 예외 추가 금지 |
| 검사 공백 | 현재 #7~#9에서 PR 범위/commit scan 전체 성공은 없음. 로컬 task-range 통과는 미래 develop·merge-result 통과가 아님 | 단계 진입 때 실제 base/head/subject SHA로 검사 |
| 사용자 승인 | #4~#9 Draft, 병합 승인 없음. T0는 후속 수정·전송·CI 실행 승인도 아님 | 단계별 실행 범위 승인. 병합 직전 검증된 구체 SHA를 제시하여 해당 병합 승인 |
| 외부 접근·증거 | artifact 생성·업로드와 JSON 내용/hash readback은 별개. 이번 T0에서 전체 내용 수용은 하지 않음 | T3/T4에 인증된 artifact 읽기, CI 실행·PR 변경·병합 권한 필요. 현재 권한 부족이 확인됐다는 뜻은 아님 |
| 미래 상태 변화 | 본 계획의 head/base와 다음 실행 시 원격이 달라질 수 있음 | 변경분을 먼저 대조하고 입력 SHA 갱신. 다른 세션 변경을 덮어쓰지 않음 |

문서의 push 차단 및 오래된 CI 설명은 현행 문서 갱신 항목이다. 이미 전달된 commit을 다시 push하는 작업을 다음 task로 잡지 않는다.

## 6. T1~T4 확정 순서와 완료 조건

### 공통 실행 계약

1. 순서는 **T1(#4) → T2(#5, 이어서 #6) → T3(#7) → T4(#8, 이어서 #9, 최종 수용)**이다. 한 번에 task 하나만 수행한다.
2. 각 PR 병합 결과를 `M4`~`M9`라고 부른다. 예를 들어 T2의 첫 base는 T1에서 실제 생성·기록한 `M4`의 전체 SHA다. 미래 SHA는 `(미정: 해당 선행 단계 산출물)`이며 임의 값을 만들지 않는다.
3. 각 단계는 표의 초기 H SHA를 보존한 채 수정·필요한 develop 동기화를 **추가 commit/merge commit**으로 수행한다. 승인된 최신 후보 `Hn*`, 실제 base `B`, CI checkout `Sn`, run ID/attempt, 병합 뒤 `Mn`을 별도 기록한다. `git merge-base --is-ancestor Hn Hn*`와 보존 목록을 확인한다.
4. 앞 PR을 통합하기 전 뒤 PR 대상만 develop으로 변경하지 않는다. 선행 완료 후 원격 develop을 확인하고 head에 필요한 변경을 merge한 다음 retarget한다. 새 후보의 CI를 확인하고 Ready 전환·병합은 승인 범위 안에서만 수행한다.
5. shared 이력 rebase/squash/force push, hook 우회, task 경로 확대, 실패 gate 무시 금지. 기존 hook/정책으로 bootstrap 추가 commit을 처리할 수 없으면 우회하지 않고 승인된 준비 방법을 확정할 때까지 중단한다.
6. 정확한 SHA·환경·검사 조건이 같은 성공 증거는 재사용한다. 코드·base·workflow가 바뀌면 영향 검사를 새 입력에 연결한다. 과거 head 성공을 새 합성 결과 또는 최종 develop 성공으로 대체하지 않는다.
7. 동일 문제는 최초 포함 최대 2회. 연속 2회 실질 진전 없음, 필수 검사 실패/누락, 범위 이탈, 승인·외부 권한 차단이면 원인과 다음 행동을 남기고 중단한다. 실패한 동일 CI를 원인 변경 없이 재실행하지 않는다.

### T1 — PR #4의 기존 기능 통합

- **고정 시작 입력:** base `D0=1ad626c92dd418f31827d17ccbb9f3580f58447f`, head `H4=df7482704c7867712c12028d1a69e59bfd662acc`. 새 후보와 M4는 D01 수정 뒤 확정한다.
- **순서:** 보존 목록/실제 원격 재확인 → D01의 기존 최소 선택자 수정 선반영 → 수정 테스트의 회귀 → 새 head·develop 합성 결과 CI → 구체 후보 검토·승인 → merge commit → M4 검증·기록.
- **필수 검사:** 기존 workflow의 fixture, API/Web 및 API test build, scripts/tests 타입·lint, Web typecheck, root tests, API 격리 통합, 전체 browser, collector. D01 시나리오 통과와 기존 8개·#3 source ancestry, 실제 유입 범위의 비밀/충돌 흔적 검사도 유지한다. 새 governance gate를 미리 켜지 않는다.
- **승인/권한:** 테스트 한 파일의 최소 수정, 격리 검증·추가 commit/push·후속 CI 실행·PR Ready 전환 범위 승인. 새 head와 CI 증거가 나온 뒤 #4 merge commit을 별도 승인. 다른 worktree의 기존 변경·hook 설정 수정은 포함하지 않는다.
- **완료:** D01 해소, 정확한 후보 CI 필수 항목 success, 승인된 M4 기록, M4에서 필요한 기존 CI success 및 8개/#3 SHA 조상 보존. 기존 workflow는 develop push 자동 실행이 없으므로 M4 검증은 별도 승인된 수동 CI로 정확한 SHA를 고정한다.
- **중단:** browser 41/43 유지, 성공 증거가 다른 SHA, 기존 SHA 재작성 요구, hook 우회 필요, 승인/권한 미확보. #6 통째 조기 병합으로 대체하지 않는다.

### T2 — PR #5 정책 등록 후 PR #6 cleanup 통합

- **고정 시작 head:** H5=`8a72c9ae3e09460718de61065810a95594cd891c`, H6=`a1a4802c75c0048345778ad11ae2af39b9315fd7`. #5 base는 M4, #6 base는 실제 #5 병합 결과 M5.
- **순서:** #5를 M4와 동기화·develop 대상 검증 → 등록 범위 승인/병합 M5 → M5에 정책과 HARN-06/07/08/09 존재 확인 → #6을 M5와 동기화·develop 대상 검증 → 승인/병합 M6.
- **필수 검사:** #5의 14개 등록 경로·taskRef·Change-Id·정책/manifest와 실제 변경 대조, 기존 CI success. #6의 정확한 base/head 및 실제 합성 결과를 HARN-08 manifest로 범위 검사; API/Collector/콘텐츠 current SQL과 checksum 계약·승인된 쌍·변조/미등록 거부, 기존 ledger 호환·재적용 회귀, parser 원문 보존과 기존 verify/collector CI 확인. T1 선택자 수정 중복도 diff로 확인한다.
- **승인/권한:** 정책 등록 검토·PR 대상/Ready 변경·필요한 동기화 commit/push/CI, #5와 #6 각각 구체 후보의 merge 승인. 테스트는 승인된 격리 DB만 사용하며 개발/운영 ledger 수동 수정은 하지 않는다.
- **완료:** M5에 등록이 먼저 도달하고 M6이 checksum 제한을 포함; 각 후보와 병합 결과의 해당 CI·migration 검증 success, H5/H6 원래 이력 보존. #6 현재 성공을 새 develop base 성공으로 승계하지 않는다.
- **중단:** 등록 누락, 정책 자기확장 혼입, checksum 계약 불일치, 원문 HTML 변경, D01 전파 충돌 또는 CI 실패. 별도 policy gate 신설은 이 task에 추가하지 않는다.

### T3 — PR #7 harness 활성화

- **고정 시작 head:** H7=`f782c0be80763f279cd11fb261bfc825cadf9b6d`; base는 검증 완료한 M6.
- **순서:** M6 동기화 → develop retarget → base에 HARN-08 등록 확인 → candidate·합성 결과 검사 → 구체 후보 승인/merge M7 → M7 push CI 확인.
- **필수 검사:** `pr-policy feature/HARN-08-harness-review develop`; trusted base를 사용한 head와 merge-result 각각의 `task-range`, 각 `base..head` 및 `base..merge-result`의 commit/비밀 검사. `event-context`, `quality`, `windows-leases`, `verify`, `collector`, `restore-scope`, 적용되는 restore, 최종 `harness-gate` success.
- **quality 내부:** `test:harness` → `test:quality` → `lint:harness` → `test:architecture` → `lint:all` 순서, 해당 언어 fixture 포함. API 선행 build·Windows Python·상대 날짜 fixture가 후보에 남아 있어야 한다.
- **복원/증거:** 현재 H6..H7은 Core required·Collector N/A. 실제 새 범위로 다시 분류하고 required job skip은 실패 처리. context와 필수 receipt의 run/attempt·base/head/subject·binding/hash를 내용으로 대조한다. PR #7에는 아직 #8의 실패 진단 분리가 없다는 점을 유지한다.
- **승인/권한:** PR retarget·동기화·CI·Ready 및 M7 병합 승인, artifact 읽기 접근. 원격 ruleset 활성화나 hook 추가 설치 승인으로 확대하지 않는다.
- **완료:** 올바른 feature→develop 방향, 두 범위 검사와 필수 gate success, 승인된 M7 및 동일 SHA의 CI/receipt 확인. 현재 feature→feature 실패 상태로 merge하지 않는다.
- **중단:** base 정책 누락, 범위·이력 실패, 필요한 복원 skip, receipt와 실제 job/SHA 불일치 또는 확인 불가. 검사기/정책 완화 없이 후속 결함으로 분리한다.

### T4 — PR #8/#9 및 최종 develop 수용

- **고정 시작 head:** H8=`299ea62ab8eb3e00d4471fc82930137fc5026dc0`, H9=`6a431358db73b9c59be4125fa0749beb014e7acd`. #8 base=M7, #9 base=M8, 최종 대상=M9.
- **순서:** #8 동기화·develop 대상 범위/CI/진단 검토·승인/merge M8 → #9에서 D02와 현행 Git 상태 문서 정리 → 동기화·develop 대상 검사·승인/merge M9 → 최종 수용. #9 기존 fixture commit은 코드 diff가 없어도 삭제하지 않는다.
- **필수 검사:** #8 HARN-09·#9 HARN-07의 trusted task 범위와 실제 merge-result, commit 이력, 문서 링크·포맷. T3의 CI 필수 항목을 새 후보와 병합 결과에 적용한다. #8의 실패 context 진단은 `verificationEvidence=false`, 분류 누락은 null이며 유효 receipt와 혼동하지 않는다. 기존 거부 회귀·실제 생성 artifact 내용으로 대조하고 실패를 만들기 위한 CI 새 실행을 임의 추가하지 않는다.
- **최종 복원 범위:** M9 push CI의 비교가 M8..M9 문서만이면 restore skip 자체는 정상일 수 있지만 #6 migration 통합의 최종 복원 증거는 아니다. **M5(등록 완료·cleanup 전)부터 M9까지** 누적 diff를 비교하는 승인된 `CI workflow_dispatch`를 계획한다. `base_sha=M5 전체 SHA`, `purpose=governance 누적 통합 최종 검증`, 실행 ref는 develop이고 실제 `GITHUB_SHA=M9`인지 확인한다. 이 범위는 기존 trailer 없는 8개를 다시 바인딩하지 않으면서 cleanup 이후 HARN 변경을 포함한다.
- **최종 필수 결과:** 현재 M5/M9 대응 원본 H5..H9의 분류는 Core·Collector 모두 required다. 최종 실제 범위에도 해당 SQL이 있으면 **동일 M9·동일 run/attempt의 Core/Collector restore 둘 다 success**, 나머지 필수 gate success, 전체 범위의 읽기 전용 이력 검사, artifact 내용 readback을 요구한다. 이전 #6 성공, #7/#8 Core restore, 다른 SHA의 예약 복원으로 대신하지 않는다.
- **artifact 수용:** context·필수 job receipt·진단 JSON의 SHA, run/attempt, task/change binding, policy/context/binding hash와 job 결과를 원격 실행 기록 및 해당 Git 객체에 대조한다. 업로드 표시·URL 존재만으로 내용 수용하지 않는다. 만료/접근 불가면 미검증·차단으로 남긴다.
- **승인/권한:** 문서 수정과 동기화 commit/push, #8/#9 PR 변경·각 merge, 최종 누적 CI 실행과 artifact 읽기 승인/권한. 결과 SHA를 문서 commit 자체에 순환 삽입하지 않고 검증 대상과 수용 기록을 구분한다.
- **완료:** H4~H9 및 기존 8개·#3 source가 최종 M9의 조상, 중복 구현/정책 없음, 최종 M9의 필수 CI·적용 복원·artifact 수용 완료, 현행 status/roadmap과 결과 기록 정리. #1/#2는 대체 관계를 기록해 보존한다. 이때만 **변경 통합 완료**로 보고한다.
- **중단:** D02 잔존, HARN-09/07 범위 이탈, 마지막 문서 수정 후 증거가 과거 SHA에 머무름, 최종 CI 실패·필수 restore 누락·내용 미수신, 선행 단계 결과 미확정. 운영 강제 항목을 붙여 T4 완료 조건을 확대하지 않는다.

## 7. 이번 통합 목표에서 제외할 운영 도입

- 원격 branch protection/ruleset·required check 강제, trusted-ref workflow/code-owner 보호 설정과 실패 병합 거부의 실제 운영 시험.
- 도입 후 policy/task 등록을 위한 전용 governance gate 신규 구현.
- 새 worktree hook 설치·기존 hook 이관·전역/공유 Git 설정 변경.
- 자동 heartbeat, 다중 host 조정, 증거 schema/보존기간 확대, 지원 OS·GUI Git·언어 lint 확대.
- 실제 release/hotfix cut·배포·merge-back, 제품 version/tag 규약, 단일 `release` 이름 이관·삭제.
- #1/#2 또는 기존 branch/stash/worktree의 종료·삭제, main/production 배포, DB/운영 ledger 변경.
- GA4 실제 수신·GTM 설정, 제품·법무·수집 기능의 운영 인수 및 전체 재감사.

이 항목들이 남아 있어도 요청한 develop 통합 수용은 별도로 판정할 수 있다. 다만 **governance 운영 도입 완료**라고 보고할 수는 없다.

## 8. 다음 task 하나와 승인

**다음 task는 T1 — PR #4의 선행 테스트 수정·검증 후 통합이다.** 시작 범위는 D01의 기존 선택자 변경 한 곳을 추가 commit으로 준비하는 것이다.

- 필요한 첫 승인: #4 테스트 최소 수정, 해당 격리 회귀/기존 CI, commit·push·검토 준비. 기본 dirty checkout 대신 기존 변경을 보존할 별도 작업 공간을 사용하는 범위도 포함해 확정한다.
- 병합 승인: 새 head/실제 base/검증 subject SHA·CI URL이 나온 뒤 구체 #4 후보의 merge commit을 승인받는다. 현재 H4는 실패 상태라 병합 대상으로 승인 요청하지 않는다.
- T0 문서 확정은 위 승인이나 T1 실행이 아니다. 다음 사용자 지시 전 자동 진행하지 않는다.

## 9. T0 완료 검증

- [x] PR #3~#9 확인 시각, 전체 head/base SHA, 병합/Draft 상태를 기록했다.
- [x] 최신 실행의 run ID/attempt/head, 완료·실패·skip·미검증을 분리했고 이전 cancelled 실행을 구분했다. 실행 중인 최신 CI는 없다.
- [x] 인계된 3건의 원격 반영을 실제 diff·ancestor·CI step·읽기 전용 task 범위 검사로 확인했다.
- [x] T1~T4 입력, 미래 SHA 확정 절차, 순서·검사·완료 조건·승인·실패 중단 기준을 고정했다.
- [x] 추가 수정 D01/D02, 선행 통합, 사용자 승인, 외부 접근/증거 대기를 구분했다.
- [x] 운영 도입 제외 항목과 다음 task 하나를 명시했다.
- [x] PLAN의 링크·참조 파일, diff 공백, 변경 범위와 기존 파일/ref 보존을 확인했다. 아래 검증 기록을 따른다.

검증 기록: T0에서 source/test/workflow 전체 테스트를 재실행하지 않았다. 새로 실행한 검사는 읽기 전용 Git/정적 대조, 4개 task-range, 결함 확인용 변경 문서 Prettier 검사와 PLAN 문서 검증이다. 최종 변경은 `PLAN.md` 하나이며 T0 이후의 구현·병합·운영 수용을 완료로 주장하지 않는다.

- 링크 39개: 상대 파일 1개 존재, 고정 SHA blob/행 12개와 commit 3개 확인, PR/Actions 23개는 이번 API/UI에서 관측한 대상과 대조했다. 모든 외부 URL을 별도 HTTP 재요청한 결과는 아니다.
- `git diff --check` 및 untracked PLAN의 `git diff --no-index --check`에서 공백 오류 없음. 후자의 변경 존재 exit 1과 공백 오류를 구분했다.
- 두 작업본의 추적 파일 diff는 비어 있고 HEAD·대상 HARN branch/remote-tracking 참조·main·develop·stash는 기준값을 유지했다. 기본 작업본 기존 미추적 58개의 경로/내용 합산 SHA-256은 전후 `4c34abed28353cf9e9daaa6800decf0bea41196ed510b372e9d9a2f339da5a90`으로 동일하다. 구현 작업본은 clean이다.
- 공유 refs 전체 해시는 달라져 저장소의 모든 내부 참조가 동일하다고 주장하지 않는다. `refs/codex/turn-diffs/` 내부 스냅샷 참조도 관측됐다. 이번 세션은 Git ref를 변경하는 명령을 실행하지 않았으며 위 통합 대상 참조를 개별 대조했다.
- 보조 Markdown 검사에서 발견한 문장 시작 `#3`의 heading 오인 표기를 `PR #3`으로 수정했다. 수정 뒤 전체 Markdown lint를 다시 돌렸다고 기록하지 않는다. 재시도 제한을 유지하며 필수 링크·공백·범위 검사로 종료한다.
