# Git governance — 별도 세션 작업 요청서

> 이 문서는 폐기 전의 세션 분리 계획이다. 현재 보존·폐기 결과는 [세션 안내](../README.md)를 먼저 확인한다. 아래 입력 경로·상태·승인 조건은 작성 당시 기록이다.

> **2026-09-26 후속 결정: 거버넌스 구현의 로컬 폐기를 완료했다.** 설계는 별도 원격 보관 브랜치에 저장했고, 제품 변경·수동 Git 검사·기록과 백업은 유지했다.
> [로컬 폐기 결과](../results/LOCAL-CLEANUP.md)와 [최종 상태·삭제 목록](../../archive/2026-09-26-local-cleanup/README.md)을 먼저 읽는다.
> 아래 11개 세션 계획과 입력 SHA·작업본 경로는 작성 당시 기록이다. 삭제된 작업본을 다시 만들거나 S04~S11의 분리·통합 계획을 자동 재개하지 않는다. 새 요청에서 유지할 항목을 명시한 경우에만 해당 범위를 수행한다.

- 작성: 2026-09-26 KST. **32개 issue를 11개 세션으로 분리한 문서**다. 495개 경로의 원본 조사 범위를 모두 연결했다.
- 현재 완료: 이 작업 요청서 작성과 문서 검증. **추가 원복·분리 구현·통합·운영 도입은 실행하지 않았다.**
- 사용자 의도: 관련 작업을 원복하기 전에 남길 수 있는 부분을 검토하고, 분야별로 다른 세션에서 처리한다. 아래 권고는 유지/철회 결정이 아니다.
- 원래 T0/T1 계획의 후속 실행 지시가 아니다. 취소 처리한 T1과 paused goal을 재개하지 않는다.
- `S01`~`S11`은 문서상의 세션 번호다. 기존 `.harness` task 등록·Change-Id·UUID 발급을 요구하지 않는다.

## 먼저 열 문서

| 세션                                 | 분야                                      | 주담당 issue                                           | 권고 방향 — 미확정                                        |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| [S01](S01-git-assets.md)             | Git 자산 백업과 최종 정리                 | GOV-28                                                 | 원문 백업부터 진행; 삭제·PR 종료는 최종 단계              |
| [S02](S02-product-preservation.md)   | 제품 변경·브라우저 회귀·원문 fixture 보존 | GOV-27, GOV-30, GOV-32                                 | 제품 변경과 원문 보존; 필요한 회귀 수정은 별도 유지 후보  |
| [S03](S03-hooks-secrets.md)          | Git hook·설정 복원과 비밀 탐지 분리       | GOV-07, GOV-08, GOV-09, GOV-10, GOV-11, GOV-12         | 현재 강제 연결 복원 후보; 단순 공백·비밀 검사는 선택 유지 |
| [S04](S04-lint-tooling.md)           | 언어별 lint·format·예외·도구 구성         | GOV-13, GOV-14, GOV-15                                 | 하네스 의존을 제거해 분리 유지 우선                       |
| [S05](S05-architecture.md)           | 아키텍처 의존·계층·순환 검사              | GOV-16                                                 | 기존 검사 보존, 추가 보강 분리 유지 우선                  |
| [S06](S06-mixed-cleanup.md)          | 333개 혼합 cleanup의 변경 단위 선별       | GOV-17                                                 | 전체 유지/삭제 대신 변경 단위별 선별                      |
| [S07](S07-migration-checksum.md)     | 기존 migration SQL·checksum 호환 조합     | GOV-18                                                 | SQL·계약·실행기·회귀를 한 조합으로 선택                   |
| [S08](S08-database-restore.md)       | Core·Collector 격리 복원 검증             | GOV-22, GOV-23                                         | 복원 시험 유지 후보; task receipt/gate는 분리             |
| [S09](S09-harness-policy-release.md) | 하네스·브랜치 정책·릴리스 절차 정리       | GOV-01, GOV-02, GOV-03, GOV-04, GOV-05, GOV-06, GOV-24 | 현재 강제 체계 도입 보류/철회 후보; 필요한 명령만 분리    |
| [S10](S10-ci-integration.md)         | CI·공유 패키지 설정·최종 조합 검증        | GOV-19, GOV-20, GOV-21, GOV-25, GOV-26                 | 일반 앱/품질 CI 유지, task 강제 연결은 선택에 따라 제거   |
| [S11](S11-docs-closeout.md)          | 활성 문서 정리와 취소 상태 마감           | GOV-29, GOV-31                                         | 활성 지침은 최종 선택에 맞춤, 과거 기록은 보존            |

공통 결과 양식: [RESULT-TEMPLATE.md](RESULT-TEMPLATE.md). 결과는 `results/Sxx-RESULT.md`로 남긴다. 자동 확인용 담당·순서 목록은 [tasks.json](tasks.json), 이번 문서 검증은 [verification.json](verification.json)에 있다.

## 각 세션을 시작하는 방법

1. 해당 문서의 절대 경로와 원하는 방향을 전달한다. 예: `S04 문서를 읽고 lint와 도구 구성을 하네스에서 분리 유지하는 로컬 구현까지 진행해.`
2. 선택이 아직 없으면 현황 확인·차이 분류·선택안 작성부터 진행한다. 구현/원복 실행 범위가 이미 주어졌으면 그 범위의 통상적인 수정·검증을 다시 승인받지 않는다. 32개 항목마다 별도 승인 절차를 만들 필요 없이 분야 단위로 선택하고 예외만 기록하면 된다.
3. commit, push, PR 변경·원격 보호 설정, 실제 DB 변경·배포는 서로 다른 동작이다. 새 세션에서 명시된 범위를 따른다. **이 문서 생성 요청 자체를 이 동작들의 실행 지시로 해석하지 않는다.**
4. 실행할 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 읽고 status·HEAD·기존 변경을 확인한다. 단순 파일 부재 때문에 branch를 전환하거나 같은 이름의 설계 파일을 새로 만들지 않는다.
5. 같은 파일을 수정하는 세션은 순서를 정하거나 자기 후보 diff로 인계한다. 구현을 요청받은 세션은 기존 dirty 작업본을 덮어쓰지 않는 작업 위치를 사용한다. 사용자 지시 없이 원본 이력을 rebase/amend/reset하지 않는다.

기본 저장소는 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 구현 참조 작업본은 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`다. 두 작업본은 Git 이력을 공유하므로 서로 독립된 저장소처럼 설정·ref를 변경하지 않는다.

## 입력 근거와 현재 기록의 한계

- [전체 issue inventory](../../archive/2026-09-26-full-inventory/README.md): 32개 issue의 완료/미완료·방향·근거.
- [전체 파일 색인](../../archive/2026-09-26-full-inventory/FILES.md): 495개 고유 경로. 삭제 허용 목록은 아니다.
- [Git 자산과 hook](../../archive/2026-09-26-full-inventory/ASSETS.md), [상태·SHA·CI 원문](../../archive/2026-09-26-full-inventory/inventory.json), [당시 검증](../../archive/2026-09-26-full-inventory/verification.json).
- [이미 완료한 T0/T1 취소](../../archive/2026-09-26-t0-t1-cancelled/README.md): 임시 선택자 수정과 T1 worktree를 원복하고 문서/증거를 보관한 범위. 전체 governance 원복과 다르다.

근거 수집은 2026-09-26 14:03:39 KST(로컬), 14:03:48 KST(원격)에 시작했다. 문서 분리 때 기본·delivery 상태와 6개 worktree를 다시 확인했으며 새 원격/CI 조회는 하지 않았다. 다음 세션에서 실제 적용할 SHA를 고정한다.

| 입력                                | 기록된 SHA 또는 상태                       | 다음 세션에서의 의미                    |
| ----------------------------------- | ------------------------------------------ | --------------------------------------- |
| 기본 develop / local origin/develop | `8af72449a7d56c9701efd0d73dc7d430a66f9610` | 원격 develop보다 오래된 로컬 기준       |
| 원격 develop                        | `1ad626c92dd418f31827d17ccbb9f3580f58447f` | #3 merge 포함; 원격 작업 전 재확인      |
| delivery / PR #9 head               | `6a431358db73b9c59be4125fa0749beb014e7acd` | 후속 구현 누적 참조; 최종 CI 실패       |
| local main                          | `e51f1b501f7cc327da279102dd69eac2f4c554db` | 기존 8개 commit/제품 변경 보존          |
| stash                               | `c373dac4ad6584e663ad958d1c9d64767dc48605` | 부모 2개, 원문 HTML 49개 추적 수정 포함 |
| PR #4 head                          | `df7482704c7867712c12028d1a69e59bfd662acc` | 제품/설계 혼합, browser 실패            |
| PR #5 head                          | `8a72c9ae3e09460718de61065810a95594cd891c` | 정책 등록, browser 실패                 |
| PR #6 head                          | `a1a4802c75c0048345778ad11ae2af39b9315fd7` | 333개 cleanup/SQL/제품 회귀 혼합        |
| PR #7 head                          | `f782c0be80763f279cd11fb261bfc825cadf9b6d` | harness, branch 방향 실패               |
| PR #8 head                          | `299ea62ab8eb3e00d4471fc82930137fc5026dc0` | CI 진단, branch 방향 실패               |

`inventory.json`은 **복원 가능한 Git bundle이나 미커밋 원문 백업이 아니다.** 삭제·이력 정리 전에 S01-A를 완료해야 한다. 과거 CI 성공, 새 후보의 로컬 성공, develop 통합, 서버 보호/운영 도입은 별도 완료 상태다.

## 권장 실행 순서와 병행 범위

읽기 전용 조사·분류는 각 세션에서 바로 병행할 수 있다. 파일 변경/설정 복원/삭제를 진행할 때 아래 순서를 사용한다. 선택하지 않은 기능은 새로 완성하지 않으며 그 기능의 운영 수용도 다른 분야 완료의 선행 조건으로 만들지 않는다.

| 단계 | 실행                                      | 실제 선행 조건 / 멈출 위치                                                                                         |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | **S01-A 백업**                            | 원문·bundle·설정 보관과 readback. 여기서는 삭제하지 않고 종료                                                      |
| 2    | **S02·S03·S04·S05·S07·S08**의 선택된 범위 | 분야별 구현은 별도 파일/작업본에서 병행. S08 최종 복원 검증은 S07의 SQL 조합 뒤                                    |
| 3    | **S06 잔여 cleanup**                      | 분류는 먼저 가능; 적용은 S02 보호 목록·S04 검사 범위 뒤. 다른 세션 소유 경로 제외                                  |
| 4    | **S09 정리 후보 확정**                    | S03 hook 연결, S04 lint scope, S08 restore 소비자 인계가 있어야 삭제 후보 확정. 실제 삭제는 S10 소비자 변경과 함께 |
| 5    | **S10 최종 후보 연결·검증**               | 선택한 S02~S09 결과를 모아 workflow/package/소스를 연결. commit/push/CI/merge는 새 세션의 실제 지시 범위에 따름    |
| 6    | **S11 활성 문서 갱신 → 문서 영향 검사**   | 실제 S10 결과를 문서에 반영하고 선택된 문서 lint만 추가 확인. 필요한 상태만 기록                                   |
| 7    | **S01-B 최종 자산 정리**                  | 보존 코드/결과·hook 복원·문서 상태가 확인되고 정리 대상이 정해진 뒤. S11에는 결과 상태만 추가 인계                 |

S01-A와 S01-B는 같은 Git 자산 담당의 두 단계다. S09는 삭제 후보, S10은 최종 반영을 맡으므로 서로의 완료를 기다리는 순환 의존을 만들지 않는다. 문서 결과의 마지막 단순 상태 반영 때문에 전체 검사를 재시작하지 않는다.

## 공유 파일 담당 — 동시에 수정하지 않을 곳

| 파일/설정                                                    | 편집 담당          | 다른 세션이 넘길 내용                                                      |
| ------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------- |
| 각 gitdir hook wrapper·metadata·실제 Git hook 설정           | S03                | S01은 원본 보관, S09는 삭제 의존 확인                                      |
| `.harness`, 일반 CLI/branch/lease/verify/release source      | S09                | S03/S08/S10의 유지 export와 소비자 목록                                    |
| `hooks.mjs`, `secrets.mjs`, `check.mjs`의 hook/secret 부분   | S03 우선, S09 후속 | 같은 파일의 task/branch 변경은 S03 인계 후 적용                            |
| `restore-scope.mjs`                                          | S08 우선, S09 후속 | 복원 분류 유지/추출 결정 후 삭제 여부 전달                                 |
| `ci-context.mjs`, `job-receipt.mjs`, CI/context/receipt 회귀 | S10                | S09는 삭제 후보와 보존 요구만 전달                                         |
| 루트/workspace `package.json`, npm lock, workflow YAML       | **S10**            | 모든 세션의 명령·dependency·job·build 순서 요구                            |
| quality runner/config, Collector Checkstyle/build 품질 설정  | S04                | S05 구조 검사 요구, S10의 job 요구. Collector lock 변경 필요 시 S04가 담당 |
| architecture 시험 2개                                        | S05                | S06은 일반 정리 대상에서 제외                                              |
| SQL·checksum helper/caller·계약·관련 회귀                    | S07                | S04 SQL 규칙, S08 복원 검증 대상                                           |
| 복원 시험/Collector restore 도구                             | S08                | package/workflow는 S10에 요청                                              |
| 제품 보호·browser 회귀·원문 HTML/provenance                  | S02                | S06은 보호 목록을 받고 별도 hunk만 처리                                    |
| 위 담당에 속하지 않는 cleanup source/fixture                 | S06                | 각 분야 결과와 미판정 경로                                                 |
| 활성 AGENTS·README·AI/status/roadmap·설계 안내               | S11                | 다른 세션은 바뀐 명령/사실/선택만 인계                                     |
| refs·PR 상태·worktree·stash 정리                             | S01-B              | 다른 세션은 자기 후보와 보존 위치/사용 종료를 전달                         |

공유 설정을 바꾸지 못해 개별 후보 전체 실행이 어려우면 필요한 최소 diff/명령과 미검증 범위를 넘긴다. 공유 파일을 경쟁 편집하거나 “모든 세션 전체 성공”을 억지로 만들지 않는다. 다른 세션의 승인 없이 소유권을 넘겨받아 수정하지 말라는 뜻이 아니라, 작업 중복과 덮어쓰기를 피하기 위한 담당 구분이다.

## 32개 issue의 주담당·선택 기록

선택은 각 결과 문서에서 `유지 / 분리 유지 / 철회 / 보류`와 사용자 지시를 기록한다. 이 표의 `미확정`은 **유지 방향**에 대한 표시이며 구현 진척이 없다는 뜻이 아니다. 특히 GOV-31 취소 처리는 이미 완료돼 재실행하지 않는다. 각 세션 문서에 해당 issue의 당시 완료·미완료·근거를 빠짐없이 실었다.

| issue  | 내용                                        | 주담당                               | 유지/철회 선택             |
| ------ | ------------------------------------------- | ------------------------------------ | -------------------------- |
| GOV-01 | Gitflow 브랜치 역할·이름·PR 방향            | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-02 | Task manifest·Change-Id·경로 제한           | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-03 | 정책·task 등록 전용 gate 부재               | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-04 | CLI·doctor·worktree 생성                    | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-05 | 자원 잠금·lease·resume                      | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-06 | verify·ready·handoff 검증 runner            | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-07 | worktree별 hook 설치·복원                   | [S03](S03-hooks-secrets.md)          | 미확정                     |
| GOV-08 | pre-commit: staged 검사                     | [S03](S03-hooks-secrets.md)          | 미확정                     |
| GOV-09 | commit-msg: 형식·Task-Id·Change-Id          | [S03](S03-hooks-secrets.md)          | 미확정                     |
| GOV-10 | post-commit 기록                            | [S03](S03-hooks-secrets.md)          | 미확정                     |
| GOV-11 | pre-push: 전체 이력·push 제한               | [S03](S03-hooks-secrets.md)          | 미확정                     |
| GOV-12 | 비밀 탐지 엔진의 범위                       | [S03](S03-hooks-secrets.md)          | 미확정                     |
| GOV-13 | 언어별 lint·format 통합                     | [S04](S04-lint-tooling.md)           | 미확정                     |
| GOV-14 | lint 예외·baseline 관리                     | [S04](S04-lint-tooling.md)           | 미확정                     |
| GOV-15 | 품질 도구 버전·설치·OS 지원                 | [S04](S04-lint-tooling.md)           | 미확정                     |
| GOV-16 | 아키텍처 의존·계층·순환 검사                | [S05](S05-architecture.md)           | 미확정                     |
| GOV-17 | 333개 cleanup 파일의 혼합 변경              | [S06](S06-mixed-cleanup.md)          | 미확정                     |
| GOV-18 | 기존 migration SQL과 checksum 호환          | [S07](S07-migration-checksum.md)     | 미확정                     |
| GOV-19 | CI quality·최종 harness gate·이미지 의존    | [S10](S10-ci-integration.md)         | 미확정                     |
| GOV-20 | CI event context·task binding·receipt       | [S10](S10-ci-integration.md)         | 미확정                     |
| GOV-21 | CI 환경·순서·날짜 fixture 수정              | [S10](S10-ci-integration.md)         | 미확정                     |
| GOV-22 | Core DB 복원 분류와 동일 SHA 검증           | [S08](S08-database-restore.md)       | 미확정                     |
| GOV-23 | Collector 격리 dump/restore 검증            | [S08](S08-database-restore.md)       | 미확정                     |
| GOV-24 | release freeze·배포 증거·merge-back         | [S09](S09-harness-policy-release.md) | 미확정                     |
| GOV-25 | 실패한 CI의 진단 자료 보존                  | [S10](S10-ci-integration.md)         | 미확정                     |
| GOV-26 | 원격 보호·required check·검사기 보호        | [S10](S10-ci-integration.md)         | 미확정                     |
| GOV-27 | 관리자 브라우저 회귀 수정                   | [S02](S02-product-preservation.md)   | 미확정                     |
| GOV-28 | PR·branch·worktree·stash·보조 ref 보존/정리 | [S01](S01-git-assets.md)             | 미확정                     |
| GOV-29 | 설계·지침·상태 문서와 과거 기록             | [S11](S11-docs-closeout.md)          | 미확정                     |
| GOV-30 | 기존 제품 변경 보존                         | [S02](S02-product-preservation.md)   | 미확정                     |
| GOV-31 | 이번 T0/T1 취소 처리                        | [S11](S11-docs-closeout.md)          | 완료 상태 보존·재실행 제외 |
| GOV-32 | stash의 수집 원문 HTML fixture 49개         | [S02](S02-product-preservation.md)   | 미확정                     |

## 공통 완료와 중단 기준

- 세션 결과에 입력 SHA/status, 선택, 실제 변경 경로, 명령·결과·SHA/patch hash, 미검증/차단, 다음 담당을 남긴다. 기록 작성 완료·후보 구현 완료·실제 원복·원격 통합·운영 도입을 구분한다.
- 코드 수정이 없다면 무관한 제품 테스트를 새로 완료 조건으로 추가하지 않는다. 수정한 기능은 필요한 기존 검사를 실행하고, 실패/skip/미실행을 통과로 바꾸지 않는다.
- 새로운 결함은 파일:행·영향·근거·권장 조치로 기록한다. 담당 밖의 기능이나 전체 제품·법무 감사로 확대하지 않는다.
- 기존 dirty 변경과 일치 여부를 작업 전후 확인한다. 원문 백업 실패·새 동시 변경·입력 SHA 불일치는 영향받는 삭제/덮어쓰기만 멈추고 이유를 남긴다.
- 동일 문제 해결은 최초 포함 최대 2회. 새 근거 없는 반복 조회는 하지 않는다. 2회 연속 실질적 진전이 없으면 원인을 기록하고 해당 범위를 중단한다.
- CI는 실행 지시가 있을 때만 실행한다. 실행 중이면 상태·URL을 남기고 기다림을 완료 조건으로 만들지 않는다. 실패 재실행을 자동 수행하지 않는다.
- 각 세션은 자기 범위에서 종료한다. 이 문서 세트나 다른 결과 파일을 이유로 T1·다음 task·배포를 자동 시작하지 않는다.
