# Git governance 전체 issue·진척·원복 영향 목록

- 작성: 2026-09-26 KST. 로컬 목록은 14:03:39, 원격 목록은 14:03:48 KST에 수집을 시작했다. 개별 조회 시각·전체 SHA·실행 URL은 [inventory.json](inventory.json)에 고정했다.
- 용도: **남길 항목과 철회할 항목을 결정하기 위한 원복 전 기록**. 이 문서 작성은 구현 재개·추가 원복·병합·배포 승인이 아니다.
- 이번 변경: 이 폴더의 기록만 작성했다. 코드·테스트·workflow·hook·Git 설정·branch·PR·DB는 변경하지 않았고 테스트·CI도 새로 실행하지 않았다.
- 직전 T0/T1 세션 원복 기록은 [별도 보관본](../2026-09-26-t0-t1-cancelled/README.md)에 있다. **그 원복은 전체 governance 철회가 아니었다.**
- `완료`는 범위를 붙인다. 구현 존재, 특정 SHA의 검사 통과, develop 통합, 실제 운영 강제는 별개다. 과거 로컬 성공이나 다른 head 성공을 현재 통합 성공으로 승계하지 않는다.
- 기록 검증 결과: [verification.json](verification.json). 파일 index·issue 연결·SHA/CI 대응·기존 변경 보존·문서 링크와 공백을 확인했다.

## 1. 기록 범위와 현재 상태

| 구분 | 확인한 범위·상태 |
| --- | --- |
| 기능·운영 issue | GOV-01부터 GOV-32까지 32개. 세부 내용·미완료·원복 영향은 아래에 기록 |
| 파일 경로 | **495개 고유 경로**. PR #1~#9, 로컬 HARN branch, 관련 미커밋/미추적 파일과 stash의 합집합. 처음 446개에 stash 대조로 원문 HTML fixture 49개를 추가했다. [전체 경로 색인](FILES.md) |
| 기본 작업본 | `develop`, HEAD `8af72449a7d56c9701efd0d73dc7d430a66f9610`; worklog 외 미추적 파일 **51개** |
| 구현 작업본 | `blariyo-governance-delivery`, HEAD `6a431358db73b9c59be4125fa0749beb014e7acd`, 추적 변경 없음 |
| 작업본 | 전체 6개 조회. 기본·governance·delivery·stash-recovery에 hook 설정·설치 메타데이터 **4세트** 존재. 설치 메타데이터 존재를 각 hook의 현재 동작 성공으로 해석하지 않음 |
| 관련 보조 작업본 | `blariyo-git-governance`, `blariyo-governance-delivery`, `blariyo-stash-recovery`, `blariyo-ci-browser-review` |
| 미커밋 복구 변경 | stash-recovery의 수정 8개·미추적 2개. 경로·내용 hash 기록. 별도 m0-core 작업본의 기존 변경도 보존 대상으로 기록 |
| 브랜치 | 로컬 HARN 10개, GitHub 원격 HARN 9개. develop·release 및 모든 조회 대상 ref도 기록 |
| 추가 보조 ref | `refs/remotes/fixprep/harness` → `85796f2667a7a9e0f220e7cefd1c025c33f86e2c`. `fixprep` remote 설정은 없고 이 ref는 delivery의 조상. 고유 후속 commit은 없지만 정리 대상에서 누락하면 안 됨 |
| PR | #1·#2·#4~#9 **8개 open**, #3 merged. #1은 Draft 아님; 나머지 open 7개는 Draft |
| stash | `c373dac4ad6584e663ad958d1c9d64767dc48605` 1개. 부모·추적 diff·미추적 경로 기록. 원문 내용 백업·분리는 후속 원복의 선행 조건 |
| Git 내부 도구 | `.git/quality-tools`, `.git/quality-venv`, 각 gitdir의 `harness-hooks*`, `harness-post-commit.jsonl`, `config.worktree` 등 기록 |
| 기존 local main | `e51f1b5`까지 8개 commit 중 `21b8828`은 governance 설계 문서 2개. 나머지 제품 관련 변경을 함께 삭제하면 안 됨 |

[Git 자산·16개 설치 hook·미커밋 파일 상세](ASSETS.md)에 작업본별 실제 경로와 상태를 펼쳐 두었다. 16개 wrapper 모두 조회 시 메타데이터 hash·실행 권한·활성 dispatcher 행·CLI/policy 존재를 확인했다. 실제 hook 실행 재시험은 하지 않았다.

**기록의 한계:** 이 목록은 삭제 allowlist가 아니다. `inventory.json`은 파일·blob·SHA·상태 목록이며 복원 가능한 Git bundle이나 미커밋 파일 원문 백업이 아니다. 실제 삭제 전에 GOV-28의 백업 조건을 충족해야 한다. 생성된 의존성·캐시는 디렉터리 단위로 목록화했고 비밀·`.env` 값은 수집하지 않았다. 333개 cleanup 파일 각각의 의미상 동등성을 이번 목록 작성에서 전수 검증한 것은 아니다.

## 2. 원격 CI 증거와 PR 범위

아래 최신 실행은 모두 attempt 1, completed다. 조회 당시 head는 JSON의 PR head와 일치했다. job·step 결과 원문은 `remote.runs`에 기록했다.

| PR | API base SHA 기준 변경 파일 | 최신 실행 | 결과·의미 |
| --- | ---: | --- | --- |
| #1 정책 등록 원본 | 11 | [36137890579](https://github.com/JeahaOh/blariyo/actions/runs/36137890579) | failure, 미병합 |
| #2 harness 원본 | 66 | [36138034691](https://github.com/JeahaOh/blariyo/actions/runs/36138034691) | failure, 미병합 |
| #3 관리자 이미지 재조회 대기 | 1 | [36143693503](https://github.com/JeahaOh/blariyo/actions/runs/36143693503) | success. **develop 병합 완료**; 이 행의 실행은 source PR 실행 |
| #4 기존 main 8개 보존 | 72 | [36214959953](https://github.com/JeahaOh/blariyo/actions/runs/36214959953) | failure, 미병합. 제품 변경과 설계 문서가 함께 있음 |
| #5 분리 정책 등록 | 14 | [36214960745](https://github.com/JeahaOh/blariyo/actions/runs/36214960745) | failure, 미병합 |
| #6 cleanup·checksum | 333 | [36214960444](https://github.com/JeahaOh/blariyo/actions/runs/36214960444) | **verify·collector success**, images skip. 아직 feature base의 후보 성공이며 develop 통합은 아님 |
| #7 harness 활성화 | 56 | [36214960591](https://github.com/JeahaOh/blariyo/actions/runs/36214960591) | 전체 failure. harness·quality 회귀, harness lint, architecture, 전체 lint는 success. PR 방향 단계 failure, 후속 이력 scan skip |
| #8 실패 진단 | 8 | [36214960603](https://github.com/JeahaOh/blariyo/actions/runs/36214960603) | #7과 같은 핵심 판정. Core restore·Windows lease·앱 verify·collector success |
| #9 날짜 fixture·문서 | 4 | [36214960778](https://github.com/JeahaOh/blariyo/actions/runs/36214960778) | 전체 failure. harness·quality 회귀·harness lint·architecture success, 전체 lint failure. 방향·이력 scan skip. Windows·verify·collector success |

PR #7도 Core restore·Windows lease·verify·collector가 통과했다. #7/#8의 Collector restore는 skip이며 Collector 복원 성공 증거가 아니다. #9는 Core·Collector restore 모두 skip이다. 기존 T0는 동일 H9의 lint 실패 원인을 `docs/status.md:79` Prettier 1건으로 확인했다. 이번에는 해당 CI 결과를 재조회했으며 포맷 검사를 재실행하지 않았다.

PR #1/#2 API의 base SHA는 `8af7244`지만 현재 develop branch는 `1ad626c`다. **현재 target branch와 직접 비교하면 각각 12개·67개 파일**이다. 두 기준의 diff를 JSON에 별도 보관했다. 위 과거 실행 성공/실패를 새 base의 통합 결과로 승계하지 않는다.

원격 metadata에서 main/develop은 `protected=false`, rulesets는 빈 목록이다. 이는 공개 API 조회 근거이며 인증된 Settings의 전체 권한·조직 정책 감사를 새로 완료한 것은 아니다. GitHub job success와 강제 병합 차단 설정도 구분한다.

## 3. 분야·방향별 요약

방향은 권고이며 사용자가 선택한 결과가 아니다. `분리 유지`는 현재 파일을 그대로 남겨도 된다는 뜻이 아니라 결합된 정책을 제거한 뒤 다시 검증해야 한다는 뜻이다.

| ID | 분야 / 카테고리 | 완료한 부분 | 미완료·차단 부분 | 권고 방향 |
| --- | --- | --- | --- | --- |
| GOV-01 | Git / 브랜치 전략 | Gitflow 역할·이름·PR 방향 검사 구현 | feature base와 정책 충돌, 실제 release 운용 미수용 | 현재 강제 전략 보류·재선택 |
| GOV-02 | 하네스 / task·Change-Id·경로 | manifest·변경 범위·등록 검사 구현, 회귀 step 성공 | develop 등록 전, schema 보강·도입 경계 남음 | 강제 연결 철회 후보 |
| GOV-03 | 하네스 / 정책 변경 절차 | 자기확장 차단 구현 | 정책·task 신규 등록 전용 gate 미구현 | 현재 도입 보류 |
| GOV-04 | 하네스 / CLI·작업본 생성 | doctor·start·start-hotfix·동기화 차단 구현 | 실제 작업 흐름 수용·hook 연계 미완료 | 필요 명령만 분리 유지 후보 |
| GOV-05 | 하네스 / 작업 잠금·재개 | 단일 host 잠금·resume, Windows 회귀 성공 | 자동 heartbeat·다중 host 미구현 | 보관·도입 보류 |
| GOV-06 | 하네스 / 검증 runner·인계 | verify·ready·handoff·입력 hash·허용 명령 구현 | immutable 실행 snapshot·제품 전체 완료 판단 미지원 | 단순 검증 명령으로 축소 후보 |
| GOV-07 | Git hook / 설치·복원 | installer·remover·4개 설치 메타데이터 | 새 worktree 상속 문제, 기존 연결 현재 수용 미완료 | 정상 복원 후 현재 강제 설치 철회 후보 |
| GOV-08 | Git hook / pre-commit | staged 공백·비밀·task 경로 검사 | task 파일 없는 branch와 연결 충돌 | 공백·비밀 검사만 분리 후보 |
| GOV-09 | Git hook / commit-msg | 커밋 형식·Task/Change ID 검사 | 기존 trailer 없는 이력과 도입 충돌 | 강제 task trailer 철회 후보 |
| GOV-10 | Git hook / post-commit | commit 식별 기록·실패 격리 구현 | 기록 활용·보존 운영 미수용 | 선택 기록 또는 archive |
| GOV-11 | Git hook / pre-push | 전체 전송 이력·강제 push·보호 branch 검사 | PR 실제 이력 scan은 앞 단계에서 skip | 이력 검사만 분리 후보 |
| GOV-12 | 보안 / 비밀 탐지 | 4종 패턴·과거 commit 검사 회귀 | 모든 비밀 탐지를 보장하지 않음 | 제한을 명시해 분리 유지 |
| GOV-13 | 품질 / 언어별 lint·format | 도구·통합 runner·양성/음성 fixture, #7/#8 lint 성공 | #9 포맷 실패, harness 디렉터리·빌드 선행 의존 | **분리 유지 우선** |
| GOV-14 | 품질 / 기존 위반 예외 관리 | fingerprint·담당·만료·범위 검증 구현 | 예외 운영 승인·관리 절차 미수용 | 필요한 만큼 단순화해 유지 |
| GOV-15 | 품질 / 도구 설치·플랫폼 | 버전·download hash 고정, Mac ARM/Linux x64 지원 | Windows 전체 lint·GUI 경로 미지원 | lint 유지 시 함께 유지 |
| GOV-16 | 아키텍처 / 의존 방향·순환 | 기존 검사 보강, #7/#8/#9 step 성공 | 동적 edge 전부 해석 불가, 추출 후 재검증 필요 | **분리 유지 우선** |
| GOV-17 | cleanup / 대량 포맷·혼합 변경 | 333개 변경·#6 앱/collector CI 성공 | 전 파일 의미상 동등성·최종 통합 미검증 | 파일/변경 단위 선별 |
| GOV-18 | DB / SQL checksum 호환 | 승인된 previous/current 쌍·거부 회귀·#6 CI 성공 | 실제 대상 DB ledger와 최종 조합 확인 필요 | SQL 선택과 묶어서 판단 |
| GOV-19 | CI / 통합 gate·이미지 선행 | workflow 연결·각 job 실행 | #7~#9 최종 gate failure, 병합 미완료 | 일반 품질 CI와 분리 |
| GOV-20 | CI / 실행 문맥·receipt | base/head/subject/run 연결·artifact 생성 | artifact 내용/hash readback 미수용 | 복잡한 task 결합 보류 |
| GOV-21 | CI / 실행 순서·Windows·날짜 | API build 선행·Python·상대 날짜 수정, 관련 step 성공 | 유지할 job에만 재적용·재검증 필요 | 해당 기능 유지 시 유지 |
| GOV-22 | DB / Core 복원 범위·검증 | 분류·Core restore #7/#8 성공 | 최종 누적 통합 SHA 증거 없음 | 복원 테스트 유지·gate 분리 |
| GOV-23 | DB / Collector 복원 | 격리 dump/restore 비교 구현, 과거 로컬 기록 | 최신 후보 Collector restore skip, 최종 원격 수용 없음 | 독립 검증 도구 유지 후보 |
| GOV-24 | 릴리스 / freeze·증거·merge-back | 검증기·synthetic 회귀 구현 | provider 원문·실제 배포·release/hotfix 운영 미검증 | archive·도입 보류 |
| GOV-25 | CI / 실패 진단 보존 | 실패 context 진단·증거 구분·회귀 성공 | 진단 artifact 내용 수용 남음 | 일반 실패 로그 보존만 추출 |
| GOV-26 | 원격 운영 / 보호·권한 | 설계·API 조회 | required check·보호 적용·실제 거부 검증 미완료 | 현재 도입 철회, 필요 시 별도 단순 설정 |
| GOV-27 | 제품 테스트 / 브라우저 회귀 | #3 병합, #6 선택자 수정 후보 검증 | #4/#5 선택자 실패; T1 선반영은 원복됨 | **제품 수정으로 별도 유지** |
| GOV-28 | Git 자산 / PR·ref·worktree·stash | 분리·원격 전달·이번 목록 작성 | 전체 원문 백업·선별·종료·정리 미실행 | 유지 결정 후 archive·정리 |
| GOV-29 | 문서 / 정본·지침·worklog | 설계·계획·이력 작성 | 현행 상태와 오래된 문구 불일치 | 정책 지침 축소, 이력 보관 |
| GOV-30 | 제품 보존 / 기존 8개 commit | 기존 commit·SHA 보존 | 제품 통합과 governance 철회 분리 필요 | **제품 변경 보존** |
| GOV-31 | 취소 / 이번 T0·T1 세션 | 선택자 원복·임시 worktree 제거·15개 자료 보관 | 전체 governance 철회와는 별개 | 완료 상태 유지 |
| GOV-32 | 수집 검증 / 원문 HTML fixture | stash의 변형 49개와 기준 원문을 대조; 49개 모두 기준 원문 일치 사본 확인 | stash 변형본의 의미·재사용 여부 미판정 | 현재 원문 보존, stash 일괄 재적용 금지 |

## 4. Issue별 구체 기록

### GOV-01 — Gitflow 브랜치 역할·이름·PR 방향

- 분야/중요도: Git 정책 / Medium. `main`, `develop`, `feature/<task-id>-<slug>`, `release/<version>`, `hotfix/<task-id>-<slug>`의 방향을 강제한다.
- 근거: `.harness/policy.json`, `scripts/harness/branches.mjs`, `tests/harness/branches.test.mjs`, `docs/ai/git-workflow.md`. local/remote develop·release가 존재한다.
- 진척: 정책과 검사 코드·회귀가 있고 #7/#8의 harness 회귀 step은 통과했다. 실제 PR #7~#9의 base는 feature branch다. #7/#8은 PR 방향 단계에서 실패했고 #9는 그 전에 lint 실패로 방향 검사를 실행하지 않았다.
- 미완료: 실제 feature→develop 통합, release/version 규약, hotfix 운영 수용. 단일 `release` 이름도 설계의 `release/<version>`와 다르다.
- 유지/원복: 검사만 남겨 현재 branch 구성을 강제하면 계속 충돌한다. 브랜치 전략 자체를 먼저 선택하고 GOV-02·09·11·19·24의 결합을 함께 조정한다. develop/release 삭제는 코드 원복과 별도 조치다.

### GOV-02 — Task manifest·Change-Id·경로 제한

- 분야/중요도: 하네스 정책 / High. task마다 허용 경로·검증 명령·Change-Id를 등록하고 변경을 연결한다.
- 근거: `.harness/policy.json`, `.harness/tasks/HARN-06.json`부터 `HARN-09.json`, `scripts/harness/check.mjs:41`, `scripts/harness/ci-context.mjs`. HARN-08 허용 경로는 450개로 복구 작업용 범위다.
- 진척: 활성 task, 허용 경로, UUID, trusted base의 manifest, policy 자기변경 차단이 구현돼 회귀 step이 성공했다. 등록안은 PR #1/#5와 후보 branch에 있다.
- 미완료: develop 기준 정책 등록, 도입 이후 변경 절차, schema 검증 보강. 계획의 HARN-01~05 번호를 실제 등록 manifest 존재로 해석하면 안 된다.
- 유지/원복: `.harness`만 삭제하면 hook·verify·CI context·release checker가 깨진다. GOV-03·06·08·09·19·20·24와 묶어 해제하거나 전체 연결을 재설계한다. 일반 lint·architecture 자체에는 Task-Id가 필수는 아니다.

### GOV-03 — 정책·task 등록 전용 gate 부재

- 분야/중요도: 하네스 운영 / High.
- 근거: `scripts/harness/check.mjs:41`의 policy/task 변경 차단, `docs/ai/harness-implementation-plan.md`의 등록 전용 governance gate 미구현 기록.
- 진척: 구현 PR이 스스로 허용 범위를 넓히는 것을 막는 검사는 있다.
- 미완료: 정책을 정당하게 신규 등록·수정하는 전용 검사 경로는 구현되지 않았다. 일반 gate로 등록을 막는 기능과 정상 등록 절차는 서로 다르다.
- 유지/원복: 현재 강제를 유지하면 새 task 등록도 운영 절차를 추가로 완성해야 한다. 경로 예외를 임의 확대해 통과시키는 방식은 해결이 아니다. 강제 manifest 운영을 철회하면 이 신규 기능은 만들 필요가 없다.

### GOV-04 — CLI·doctor·worktree 생성

- 분야/중요도: 개발 도구 / Medium.
- 근거: `scripts/harness/cli.mjs`, `branches.mjs`, `git.mjs`, `tests/harness/branches.test.mjs`.
- 진척: doctor, start, start-hotfix, PR 방향·범위 검사 등의 진입점이 있다. start는 local develop과 origin/develop 불일치 및 task 누락을 차단하고 별도 worktree를 만든다. 관련 회귀 step이 성공했다.
- 미완료: 현재 기본 checkout의 local develop/origin tracking ref는 원격 develop보다 오래됐다. CLI 도입 자체가 모든 기존 작업본·hook을 정상화하지 않는다.
- 유지/원복: 읽기 전용 진단은 분리 유지 후보다. start는 GOV-01·02·07과 결합돼 있으므로 기존 Git 명령을 감싸는 부분만 남길지 선택해야 한다. 기존 worktree 삭제와 CLI 파일 삭제를 같은 것으로 취급하지 않는다.

### GOV-05 — 자원 잠금·lease·resume

- 분야/중요도: 동시 작업 제어 / Medium. lease는 작업이나 자원을 한 프로세스가 점유하도록 하는 잠금이다.
- 근거: `scripts/harness/leases.mjs`, `lease_lock.py`, `verify.mjs`, `tests/harness/leases.test.mjs`.
- 진척: 단일 host의 OS advisory lock, task/resource 충돌 검사, 프로세스 종료 후 잠금 해제, 읽기 전용 resume이 구현됐다. #7/#8/#9 `windows-leases` job이 실제 성공했다.
- 미완료: 작성 세션 자동 heartbeat, 다중 host 조정, 전체 Windows lint·GUI Git 지원. 오래된 문서의 “Windows 실행 미검증”은 현재 부분 성공과 구분해야 한다.
- 유지/원복: 자동 작업 관리 체계를 유지하지 않으면 우선 보관 후보다. 제거 시 verify의 잠금 import·호출도 바꾸고, 실제 살아 있는 잠금 보유 프로세스가 있는지는 실행 시 다시 확인한다. 잠금 파일 존재만으로 프로세스를 강제 종료하지 않는다.

### GOV-06 — verify·ready·handoff 검증 runner

- 분야/중요도: 검증 자동화 / Medium.
- 근거: `scripts/harness/verify.mjs:8`, `run-tests.mjs`, `tap.mjs`, `tests/harness/verify.test.mjs`.
- 진척: 고정 명령 5종(`test:harness`, `test:quality`, `lint:harness`, `lint:all`, `test:architecture`)만 실행한다. SHA·입력·정책·task hash를 기록하며 0개/skip된 시험을 거부하고 ready/handoff를 구분한다. 회귀 step 성공.
- 미완료: immutable snapshot에 고정한 실행, 실제 전체 제품 검증·승인 자동 판정은 지원하지 않는다. API·browser·collector 전체를 이 5종이 대신하지 않는다.
- 유지/원복: 단순 npm 검사 명령은 남길 수 있다. 상태 관리 wrapper를 없애면 GOV-02·05·20에 대한 의존과 `.git` evidence 파일 사용처도 함께 정리한다.

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

### GOV-13 — 언어별 lint·format 통합

- 분야/중요도: 코드 품질 / High. lint는 규칙 위반 검사, format은 코드 표기 형식 검사다.
- 근거: `scripts/quality/lint-all.mjs:78`, `package.json`, 언어별 config, `tests/quality/lint-tools.test.mjs`.
- 범위: JS/TS/Vue ESLint, Java Checkstyle, Python Ruff, SQL SQLFluff, shell ShellCheck, CSS Stylelint, Markdown markdownlint, GitHub Actions actionlint, Prettier. 기존 package lint를 전체 runner로 묶고 부족한 언어 검사를 추가했다.
- 진척: #7/#8 전체 lint step 성공. #9는 harness·quality 회귀와 architecture가 통과했으나 전체 lint가 실패했다. 같은 H9의 기존 분석은 `docs/status.md:79` 포맷 1건이었다.
- 결합: runner는 `scripts/harness`, `tests/harness`가 비어 있으면 실패한다. 도구와 언어 fixture는 공통 gitdir의 quality 도구 위치를 사용한다. API typed-test lint 전에 API/test build가 필요하다. Node는 `24.18.0` 정확 일치를 요구한다.
- 유지/원복: **유지 우선 후보**지만 harness 삭제 후 그대로 실행하면 안 된다. 검사 대상·도구 경로·빌드 선행·package script를 새 범위에 맞추고 한 번 검증한다. 품질 검사 자체와 task/branch gate는 분리 가능하다.

### GOV-14 — lint 예외·baseline 관리

- 분야/중요도: 품질 정책 / Medium.
- 근거: `scripts/quality/lint-debt.mjs:262`, `lint-contracts.mjs`, `tests/quality/lint-debt.test.mjs`, `.quality/baseline.candidate.json`.
- 진척: 위반 fingerprint, 설정·도구 버전, 담당·사유·만료, 중복·잘못된 보고서·빈 scope·누락 경로를 검증한다. CI는 base의 baseline을 사용하며 draft candidate는 승인 baseline이 아니다. quality 회귀 step 성공.
- 구분: 기본 checkout의 미추적 candidate는 과거 자료일 수 있다. #7/#8의 전체 lint가 통과한 사실과 과거 “434개 draft 차단” 기록을 혼동하면 안 된다. 새 H9 포맷 실패도 과거 SQL debt 차단과 별개다.
- 미완료: 실제 예외 승인·갱신 운영 체계와 검사기 자체 보호. finding 0인 조합에서는 예외 baseline 없이 통과할 수 있다.
- 유지/원복: 예외가 필요할 때만 제한적으로 유지한다. 단순 검사만 원하면 복잡한 baseline 관리도 축소할 수 있으나 기존 위반을 무조건 성공 처리하도록 바꾸지는 않는다.

### GOV-15 — 품질 도구 버전·설치·OS 지원

- 분야/중요도: 개발 환경 / Medium.
- 근거: `scripts/quality/setup-native-tools.mjs:16`, `.quality/requirements.txt`, package lock, `.git/quality-tools`, `.git/quality-venv`.
- 진척: native 도구 버전·다운로드 checksum 고정, 공통 gitdir 도구 재사용 회귀가 있다. 설치 asset은 darwin-arm64·linux-x64다. Ubuntu 전체 lint 및 별도 Windows lease job의 성공은 서로 다른 범위다.
- 미완료: Windows 전체 lint, 다른 CPU/OS, GUI Git의 PATH 지원은 완료 근거가 없다. 일반 YAML schema·Gradle Kotlin DSL 전용 lint도 현재 전체 지원으로 주장할 수 없다.
- 유지/원복: lint를 남기면 공통 도구 저장소도 필요하다. governance를 철회한다는 이유로 `.git/quality-*`를 먼저 삭제하면 안 된다. 도구 제거 여부는 GOV-13 선택 뒤 결정한다.

### GOV-16 — 아키텍처 의존·계층·순환 검사

- 분야/중요도: 구조 품질 / Medium.
- 근거: `tests/architecture.test.ts`, `apps/api/test/architecture.service.test.ts`, `docs/system-design/08-code-structure.md`.
- 진척: 기존 architecture 검사를 강화했다. H6→H7에서 두 시험 파일에 331 insertions/24 deletions. API 계층·feature/persistence, Web/contracts와 앱 간 source 참조, Collector 모듈·사이트 격리, 순환·alias·runtime import를 검사한다. #7/#8/#9 architecture step 성공.
- 한계: 계산된 동적 import·reflection 등 모든 실행 의존을 자동 증명하지 않는다. 일부 판단은 수동 검토가 남는다.
- 유지/원복: **유지 우선 후보**다. 기존부터 있던 architecture 검사까지 통째로 삭제하지 말고 추가 보강 diff를 선택한다. `test:architecture`의 API/test build 선행을 보존해야 한다.

### GOV-17 — 333개 cleanup 파일의 혼합 변경

- 분야/중요도: 코드·문서 정리 / High.
- 근거: H5 `8a72c9a` → H6 `a1a4802`의 333개 파일. [FILES.md](FILES.md)와 JSON의 PR #6 `changes`에 각 경로·이전/이후 blob을 기록했다.
- 진척: API/Web/Collector·fixture·배포 스크립트·SQL·설계·법무·화면 문서까지 변경했고 #6 verify/collector CI가 성공했다.
- 미완료: 전체 파일을 “공백만 바뀌었다”고 증명하지 않았다. checksum runtime·브라우저 선택자 같은 실제 동작 수정도 포함돼 있다. 원문 fixture 내용·현재 다른 작업과의 충돌을 전수 수용한 것도 아니다.
- 유지/원복: 폴더 전체 삭제 또는 #6 전체 유지로 단정하지 않는다. 포맷·품질 수정, SQL/호환 코드, 제품 회귀 수정, 문서 상태 변경을 분리한다. GOV-18·27·29·30과 교차한다. 같은 파일의 기존 제품 변경을 먼저 보존한다.

### GOV-18 — 기존 migration SQL과 checksum 호환

- 분야/중요도: DB 호환 / High.
- 근거: API `migration-checksum-compatibility.ts:38`, `migrations.service.ts`, Collector `MigrationMain.java`, `scripts/content/migration-checksum.mjs`, `docs/migration/contract-evolution.json`, migration 관련 회귀.
- 진척: API V001~V008, Collector V001~V006, 콘텐츠 migration의 포맷 변경과 승인된 previous/current hash 쌍 제한이 있다. 현재 hash의 정확한 일치 또는 등록된 쌍만 허용하며 미등록·변조 거부 회귀를 추가했다. H6의 기존 verify·collector CI success.
- 미완료: 실제 개발/운영 DB ledger가 어떤 hash를 보유하는지 이번 목록 작성에서 조회하지 않았다. 최종 남길 SQL/호환 코드 조합의 수용도 아직 없다.
- 유지/원복: **SQL만 되돌리거나 호환 함수만 제거하지 않는다.** 원본 SQL, 실행기, 계약 JSON, 회귀를 같은 조합으로 판단한다. 기존 ledger 수동 수정은 이 목록이나 일반 코드 원복에 포함되지 않는다. lint를 유지하는 것과 과거 migration 전체 재포맷을 유지하는 것은 별도 선택이다.

### GOV-19 — CI quality·최종 harness gate·이미지 의존

- 분야/중요도: CI 파이프라인 / High.
- 근거: `.github/workflows/ci.yml:22`·`:515`·`:642`, `tests/harness/ci-workflow.test.mjs`.
- 진척: event-context → quality/Windows/app/collector/복원 분류 → 최종 harness-gate → images의 연결이 구현됐다. 개별 job 다수는 실제 실행 성공했다.
- 미완료: #7~#9 최종 gate는 failure, develop 통합 미완료. images는 현재 PR에서 skip이며 배포 성공 증거가 아니다.
- 유지/원복: lint·architecture·기존 앱 CI는 남길 수 있다. task·방향 gate만 빼려면 job needs, 조건, receipt 작성 단계, image 선행 의존을 함께 수정해야 한다. **harness-gate job만 삭제하면 images 연결이 깨진다.** 기존 앱 검증까지 없애면 안 된다.

### GOV-20 — CI event context·task binding·receipt

- 분야/중요도: 검증 증거 / Medium.
- 근거: `scripts/harness/ci-context.mjs`, `job-receipt.mjs`, 관련 회귀와 workflow artifact 단계.
- 진척: PR/push/manual의 base·head·실제 검사 SHA, run/attempt, Task/Change ID와 hash를 연결한다. #7~#9 event-context success; receipt 생성·업로드 단계도 실행됐다.
- 미완료: 모든 원격 artifact JSON 내용과 실제 Git/job의 hash·identity를 내려받아 수용한 근거는 없다. 업로드 success는 내용 readback 완료가 아니다.
- 유지/원복: 단순 SHA·run 기록은 유용하지만 현재 구현은 GOV-02에 강하게 연결된다. task 시스템을 철회하면서 receipt 단계만 그대로 남길 수 없다. 과거 증거는 보관하고 새 구조에서는 필요한 최소 필드만 재선택한다.

### GOV-21 — CI 환경·순서·날짜 fixture 수정

- 분야/중요도: 실행 안정성 / Medium.
- 근거: `.github/workflows/ci.yml:79`, Windows Python 설정, `tests/harness/release.test.mjs`. H7에는 API/test build 선행·Python `3.13.15`·상대 날짜 fixture가 포함돼 있다.
- 진척: API build 뒤 lint, Windows lease 실행, 실행 시각 기반 날짜 fixture의 관련 step이 실제 통과했다. stale/future 거부 시나리오는 유지한다.
- 미완료: 이 수정이 포함됐다고 branch 방향·전체 CI·원격 artifact 수용까지 성공한 것은 아니다. #9는 #7과 중복된 선반영 때문에 현재 코드 차분보다 문서 차분 중심이다.
- 유지/원복: 유지하는 검사에는 환경 수정도 남긴다. 제거하는 release/Windows lease 검사의 보조 수정만 별도로 억지로 남길 필요는 없다. 고정 날짜로 되돌려 시간이 지나면 실패하도록 만들지 않는다.

### GOV-22 — Core DB 복원 분류와 동일 SHA 검증

- 분야/중요도: 데이터 복구 검증 / High.
- 근거: `scripts/harness/restore-scope.mjs`, `.github/workflows/ci.yml:329`·`:381`, API `schema-restore.integration.test.ts`.
- 진척: 변경 경로에 따라 Core restore 필요 여부를 분류하고 필수 복원이 skip되면 최종 gate가 실패한다. #7/#8 Core `schema-restore` job success.
- 미완료: 최종 develop 통합 SHA에 대한 누적 변경 범위 복원 수용은 없다. #9 문서 위주 범위의 restore skip은 #6 migration의 최종 복원 증거가 아니다.
- 유지/원복: 복원 시험 자체는 유지 우선 후보다. task 기반 receipt·최종 gate 결합은 분리 가능하다. 기존 예약 backup/restore workflow와 PR 필수 복원은 역할이 다르므로 기존 운영 백업까지 삭제하면 안 된다.

### GOV-23 — Collector 격리 dump/restore 검증

- 분야/중요도: Collector DB 복구 / High.
- 근거: `scripts/test-collector-restore.mjs`, `package.json`의 `test:collector:restore`, `.github/workflows/ci.yml:456`, 관련 Java fixture.
- 진척: 임의 이름의 격리 PostgreSQL container에서 schema·데이터·sequence dump/restore 비교와 migration 재실행 일관성을 검사하는 구현이 있다. 과거 worklog에 로컬 성공 기록이 있다.
- 미완료: 최신 #7/#8/#9의 Collector restore는 skip이다. 이번 목록 작성은 과거 로컬 증거의 실행 환경·전체 원문을 새로 수용하거나 최종 CI에서 실행한 것이 아니다.
- 유지/원복: 독립적인 복원 점검 도구로 남길 후보다. Java 25·Docker·DB fixture 전제를 함께 보존하고 운영 DB 대상으로 바꾸지 않는다. 다른 Collector 기능·기존 백업 운영을 함께 지우지 않는다.

### GOV-24 — release freeze·배포 증거·merge-back

- 분야/중요도: 릴리스 운영 / Medium.
- 근거: `scripts/harness/release.mjs:46`·`:139`, `merge-back.mjs`, release/merge-back 회귀.
- 진척: 후보 SHA·Change-Id·이미지 digest·DB 호환·백업 시간·복귀 증거의 일관성을 검사하고, release/hotfix가 필요한 branch에 반영됐는지 조상 관계를 검사한다. synthetic 회귀는 harness step에 포함된다.
- 미완료: provider API나 artifact bytes를 직접 가져와 검증하는 기능은 없다. 실제 release/hotfix·배포·merge-back 운영 수용, 제품 version/tag 규약도 미완료다. remote-tracking ref 검사는 live remote 상태를 대신하지 않는다.
- 유지/원복: 지금은 archive·도입 보류 후보다. manifest나 fixture 통과를 운영 배포 증거로 남기지 않는다. GOV-01·02·20과 함께 분리한다.

### GOV-25 — 실패한 CI의 진단 자료 보존

- 분야/중요도: CI 관측 / Low.
- 근거: PR #8, `.github/workflows/ci.yml:581`, `tests/harness/ci-workflow.test.mjs:110`.
- 진척: event context가 없거나 잘못돼도 실패 원인 JSON을 남기고 `verificationEvidence=false`로 유효 검증 증거와 구분한다. 분류 누락은 null로 남기며 관련 harness 회귀 step 성공.
- 미완료: 해당 실제 진단 artifact의 전체 내용·hash readback은 별도다. 진단 생성이 최종 gate 성공을 뜻하지 않는다.
- 유지/원복: 실패 로그·진단 보존 아이디어는 유지할 가치가 있다. 현재 context/receipt schema에 묶인 부분은 GOV-19·20 제거 시 재구성한다.

### GOV-26 — 원격 보호·required check·검사기 보호

- 분야/중요도: GitHub 운영 강제 / High.
- 근거: 원격 branches/rulesets API 관측은 JSON `remote`. 설계는 trusted workflow 또는 code-owner 보호와 실제 거부 시험을 요구한다.
- 진척: 보호 정책의 설계와 현재 metadata 조회는 있다. 조회 당시 main/develop `protected=false`, rulesets 빈 목록.
- 미완료: 필수 검사 등록·검사기 자체 보호·direct push/실패 PR 병합 거부의 실제 운영 수용은 완료되지 않았다. 일반 job을 실행하는 것과 서버에서 병합을 강제로 막는 것은 다르다.
- 유지/원복: 현재 도입을 철회한다면 새 보호 체계를 완성할 필요가 없다. 이미 설치된 것으로 추정해 무작정 원격 설정을 지우지 않는다. 단순한 보호를 나중에 선택하더라도 현재 거대한 task gate를 전제로 할 필요는 없다.

### GOV-27 — 관리자 브라우저 회귀 수정

- 분야/중요도: 제품 테스트 / Medium.
- 근거: #3 `tests/browser/admin-workflow.test.ts`, #6 `tests/browser/admin-recovery.test.ts`, 취소한 T1 patch·로그.
- 완료: #3의 편집기 재조회 후 이미지 재시도 대기 수정은 source CI success 및 develop 병합 완료다. #6의 공개 사이트 링크 선택자 수정은 해당 후보의 verify 성공에 포함된다.
- 미완료: #4/#5에는 선택자 불일치가 남아 실패했다. T1에서 #4에 선반영한 2줄은 사용자 요청으로 원복했다. 따라서 T1의 8/8 로컬 성공을 현재 #4가 고쳐졌다는 증거로 쓰면 안 된다.
- 유지/원복: governance 운영과 직접 관계없는 제품 테스트 수정이다. #3의 이미 병합된 이력을 없애거나 #6 전체를 버리며 필요한 회귀 수정까지 잃지 않도록 별도 선택한다. main 배포 여부는 이 issue의 완료 주장에 포함하지 않는다.

### GOV-28 — PR·branch·worktree·stash·보조 ref 보존/정리

- 분야/중요도: Git 자산 / High.
- 근거: JSON의 `refs`, `worktrees`, `localHarnBranches`, `stash`, `auxiliaryGovernanceRefs`, `remote.prs`. 정확한 경로·SHA·상태·hash·PR base/head를 기록했다.
- 진척: 정책·cleanup·harness·진단을 별도 PR로 나눠 전달했다. 로컬 HARN 10개·원격 HARN 9개, open PR 8개, 관련 보조 worktree 4개, stash 1개가 남는다. `fixprep/harness` ref도 추가 확인했다.
- 미완료: 이번 inventory는 복구용 원본 백업이 아니다. stash와 dirty recovery의 원문, 각 관련 ref를 담은 검증 가능한 Git bundle, hook 설정 원본을 보관하고 readback해야 실제 삭제를 안전하게 수행할 수 있다.
- 유지/원복: 유지 선택 → 원문/bundle 보관·검증 → hook 연결 복원 → 관련 PR 종료·branch/worktree 정리 순서가 필요하다. 원격 PR 종료, 원격 branch 삭제, 로컬 branch 삭제, worktree 제거는 서로 다른 작업이다. m0-core의 기존 dirty 작업, 다른 기능 branch·배포 상태를 보존한다. 이번에 어떤 항목도 삭제하거나 종료하지 않았다.

### GOV-29 — 설계·지침·상태 문서와 과거 기록

- 분야/중요도: 문서·작업 규칙 / Medium.
- 근거: AGENTS, docs/ai README, git-workflow, harness-implementation-plan, docs/status·roadmap, worklog. local main의 설계 원본 commit은 `21b8828`이다.
- 진척: 브랜치·hook·lint·architecture·CI·release 설계와 이력이 작성돼 있다.
- 미완료: 문서 상단의 오래된 branch 이름·PR 실패·Windows 미검증 문구와 후속 관측이 섞여 있다. 문서가 남아 있으면 다음 세션이 폐기한 정책을 여전히 실행 기준으로 읽을 수 있다.
- 유지/원복: 활성 지침은 남길 구조에 맞춰 수정하고, 과거 작업 기록은 상태를 소급 조작하지 말고 archive로 보관한다. 기존 579줄 설계 2개도 별도 선택 대상이다. 모든 제품·법무 문서를 삭제하는 일이 아니다.

### GOV-30 — 기존 제품 변경 보존

- 분야/중요도: 제품 기능·기존 이력 / High.
- 근거: local main `e51f1b5`의 기존 8개 commit, PR #4. JSON `legacyMain`에 전체 SHA·제목·제품 경로 70개·설계 경로 2개를 분리했다.
- 진척: GA4/GTM·관리자 접근·수집 검토 UX와 관련 기록의 기존 SHA는 보존됐다. 그중 governance 전용 설계 commit은 `21b8828`의 두 문서다.
- 미완료: PR #4의 develop 통합은 미완료이며 governance 철회와 별개다. 기존 제품 변경의 운영 수용을 이번 inventory가 새로 완료 판정하지 않는다.
- 유지/원복: governance 이전의 `8af7244`로 main 전체를 강제 reset하면 제품 변경도 잃는다. **제품 변경은 보존 대상으로 둔다.** FILES의 GOV-30 표시는 같은 파일에 제품 변경이 섞였다는 경고다. branch·commit 이름만 보고 통째로 버리지 않는다.

### GOV-31 — 이번 T0/T1 취소 처리

- 분야/중요도: 세션 정리 / Low.
- 근거: [취소 기록](../2026-09-26-t0-t1-cancelled/README.md), [검증 결과](../2026-09-26-t0-t1-cancelled/rollback-result.json).
- 완료: 테스트 선택자 2줄 복원, T1 임시 worktree·설치/빌드 산출물 제거, 문서 3개·자료 12개 보관, 기존 ref·stash·다른 작업·공용 hook 보존 확인. T1 goal은 paused다.
- 한계: 전체 governance 작업을 제거한 것은 아니다. 당시 보존했던 대상이 이번 inventory의 주요 잔여 대상이다.
- 처리: 완료된 취소를 다시 실행하거나 T1을 자동 재개하지 않는다. 당시 성공 로그는 당시 임시 수정본의 증거로 보관한다.

### GOV-32 — stash의 수집 원문 HTML fixture 49개

- 분야/중요도: 원문·제품 회귀 데이터 / High.
- 근거: stash의 **추적 파일 수정**을 파일 색인과 대조해 추가한 `apps/collector/src/test/resources/sites/**/*.html` 49개. stash는 부모 2개이며 별도 미추적 tree가 없다. JSON `stashOriginalHtmlFixtures`에 기준 blob·stash blob·각 SHA-256·현재 작업본 사본을 기록했다.
- 진척: PR·현재 diff만 조사했을 때 빠졌던 arcalive, bobaedream, dcinside, dogdrip, inven 등 HTML 변경을 포함했다. 49개 모두 stash 기준 부모의 원문과 일치하는 현재 사본이 있고, stash의 변경된 byte와 일치하는 현재 사본은 확인되지 않았다. raw HTML과 포맷된 JSON fixture·provenance는 같은 산출물이 아니다.
- 미완료: stash의 변형이 의미상 안전한 포맷인지, 재사용할 변경인지 이번 inventory에서 수용 판정하지 않았다. 기준 원문과 stash 변형본을 같은 내용으로 취급하지 않는다.
- 유지/원복: 현재 보존된 원문을 유지한다. **stash 전체를 재적용하면 원문 HTML 49개도 다시 바뀔 수 있다.** stash 삭제나 recovery worktree 제거 전 두 버전과 provenance를 보관하고 비교한다. 제목·요약이나 JSON 일부로 원문 보관을 대신하지 않는다.

## 5. 먼저 결정할 묶음과 원복 순서

### 남길 가치가 높은 후보

- GOV-13·15·16: 언어별 lint, 도구 설치, architecture 보강. task manifest와 브랜치 방향 검사를 제거해도 독립적으로 운영할 수 있도록 추출하는 방향.
- GOV-12: 제한된 비밀 탐지와 GOV-11의 이력 순회. 탐지 범위를 과장하지 않는 조건.
- GOV-22·23: 격리 복원 시험. governance receipt와 분리하고 기존 운영 백업은 보존.
- GOV-27·30·32: 제품 회귀 수정·기존 제품 기능·원문 fixture. governance 철회와 분리해 보존 판단.

### 현재 결합을 그대로 남기기 어려운 묶음

- GOV-01·02·03·09·20·24: Gitflow, task/UUID, 정책 등록, CI binding, release 증거. 하나만 삭제하면 다른 부분의 입력이 사라진다.
- GOV-07·08·11: 설치된 hook과 검사기. **설정 복원 전에 호출 대상부터 삭제하지 않는다.**
- GOV-13·19: lint와 CI. 현재 runner의 harness scope와 images의 harness-gate 의존을 함께 해소한다.
- GOV-17·18: 과거 SQL 재포맷과 runtime checksum 호환. 동일한 SQL·계약·실행기 조합으로 선택한다.

### 실행 전 필수 조건

1. 32개 issue마다 유지·분리·철회 결정을 기록한다. 아직 모두 사용자 결정 전이다.
2. GOV-28의 bundle·미커밋 원문·hook 설정 원본을 archive에 보관하고 복구 가능성을 확인한다. 이 inventory만으로 백업 완료 처리하지 않는다.
3. 원격 head·작업본 변경을 실행 직전 재확인한다. 이번 목록 이후 변경은 별도 비교한다.
4. hook 연결 → 실제 source/config → CI 의존 → 문서 지침 → PR/ref/worktree 순서로 영향과 선행 관계를 확인한다. DB ledger는 임의 수정하지 않는다.
5. 남긴 조합의 필요한 검사만 실행하고, 원복된 경로·보존한 경로·원격 상태를 각각 확인한다. 과거 CI 성공을 새 조합의 성공으로 승계하지 않는다.

## 6. 이번 기록의 검증 범위

- source·설정·시험 목록·PR diff·현재 Git 상태와 최신 9개 CI run/job/step을 읽기 전용으로 대조했다.
- 모든 수집 파일 경로에 적어도 하나의 GOV issue를 배정했다. 자동 경로 분류는 교차 검토용이며 변경 의미의 최종 판정이 아니다.
- 전체 6개 worktree와 관련 ref·stash·Git 내부 설정 자료를 기록했다. m0-core 변경은 보존 대상이며 governance 삭제 대상으로 분류하지 않는다.
- 이 폴더 안의 링크·공백·issue ID·경로 수·SHA/CI 대응과 외부 코드 변경 부재를 별도 검증 기록으로 남긴다.
- 미실행: 새 테스트·CI, DB readback, artifact 본문 readback, 실제 hook 동작 재시험, 333개 파일의 의미상 동등성 전수 감사, Git bundle 생성·복원 시험, 추가 원복·commit·push·PR 변경.
