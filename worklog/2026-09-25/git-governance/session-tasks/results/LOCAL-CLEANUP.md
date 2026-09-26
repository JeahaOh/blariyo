# Governance 로컬 폐기 결과

- 실행일: 2026-09-26 KST. 삭제 전후 시각·전체 SHA·파일 hash는 [실행 기록](../../archive/2026-09-26-local-cleanup/README.md) 참조.
- 사용자 지시: “이제 나머지 폐기할 것 로컬에서 폐기 해”. 설계만 원격 보관한 뒤 거버넌스 구현의 로컬 잔여물을 폐기하는 범위다.
- 결과: **로컬 폐기 완료 / 설계 원격 보관 유지 / 원격 PR·브랜치 무변경**.
- 기존 S04~S11 요청서는 검토·분리 유지 가능성을 검토하던 과거 계획이다. 이번 선택으로 폐기한 구현을 다시 분리하거나 develop에 통합하는 작업은 진행하지 않는다. 해당 세션들을 구현 완료로 처리하지도 않는다.

## 실제 삭제

| 대상 | 결과 | 복구 근거 |
| --- | --- | --- |
| 기본 작업본의 미추적 거버넌스 구현·설정·테스트 | **51개 파일 삭제**. `.githooks/`, `.harness/`, lint 설정·스크립트, Checkstyle 설정, migration checksum 보강, Collector restore 시험 등 | S01 원문과 hash·권한 일치 확인. 정확한 경로는 [파일 목록](../../archive/2026-09-26-local-cleanup/root-files-deleted.json) |
| 공유 worktree | **4개 삭제**. `blariyo-ci-browser-review`, `blariyo-git-governance`, `blariyo-governance-delivery`, `blariyo-stash-recovery` | 각 HEAD를 bundle 복구 저장소에서 확인. recovery의 추적 수정 8개·미추적 2개도 원문 백업과 재대조 |
| 로컬 `feature/HARN-*` 브랜치 | **10개 삭제**, 16개에서 6개로 감소 | 각 tip의 commit 객체를 S01 복구 저장소에서 확인. [전체 이름·SHA](../../archive/2026-09-26-local-cleanup/refs-deleted.json) |
| stash | **1개 삭제**, `c373dac4ad6584e663ad958d1c9d64767dc48605` | S01 bundle에 보존. 원문 HTML fixture 백업도 유지 |
| 사용하지 않는 로컬 참조 | **`refs/remotes/fixprep/harness` 1개 삭제** | 예상 SHA `85796f2667a7a9e0f220e7cefd1c025c33f86e2c`와 일치할 때만 삭제 |
| 비활성 hook | **4개 gitdir의 wrapper 16개와 metadata·post-commit 기록 삭제** | S03에서 이미 연결을 해제한 상태. 삭제 직전 원문은 추가 private 백업에 보존 |
| 거버넌스 도구 캐시 | `.git/quality-tools`, `.git/quality-venv`, 기본 작업본의 `.ruff_cache` 삭제 | 유지 대상의 실행 의존성으로 사용되지 않음을 확인. 재생성 가능한 캐시 |
| 설계 전송용 임시 clone | `/private/tmp/blariyo-design-archive-weyic3mb` 삭제 | 원격 설계 branch의 SHA를 재확인하고 미커밋 변경 없음 확인 |

각 worktree의 ignored 의존성·build 캐시도 해당 작업본과 함께 삭제했다. runtime DB가 있는 기본 작업본과 제품 작업본의 데이터·의존성은 보존했다.

## 보존 대상

| 대상 | 보존 상태 |
| --- | --- |
| 기본 작업본 `blariyo` | `develop` / `beacb90ef6c7490d35a111e7c7c9cce34b666ce5`, 추적 파일 변경 없음 |
| 제품 작업본 `blariyo-m0-core` | `feature/m0-core` / `a273f3c853fe0cf8260e3c7eb9daa2cfd1b02727`, 기존 추적 수정 20개·미추적 68개 hash·diff 유지 |
| S02 독립 제품 후보 저장소 | `/Users/zeaha/task_list/20260926-blariyo-s02-product-preservation`, `a13500b080781660538688ff53d489021376df77`, clean 유지 |
| 나머지 로컬 브랜치 | `main`, `develop`, `release`, `feature/m0-core`, `planning-design-only`, `office`의 SHA 유지 |
| 선택한 수동 검사 | `scripts/git-checks/check.mjs`, `scripts/git-checks/README.md`, `tests/git-checks.test.mjs` 원문 유지 |
| 기록·복구 자료 | S01~S03 결과, 원문 fixture·bundle·기존 archive 보존. 세션 진입 README에 이번 결정을 추가한 것 외 기존 기록 hash 유지 |
| 원격 설계 보관 | [docs/git-governance-design-archive](https://github.com/JeahaOh/blariyo/tree/docs/git-governance-design-archive/worklog/2026-09-25/git-governance/design-archive), `20c7863150bd071e32d20507d5a48c004430c0e6` |
| Git 설정 | 자동 hook 미설치 상태 유지. `extensions.worktreeConfig`와 이웃 설정 보존. 삭제한 브랜치의 tracking 설정만 Git이 함께 제거 |

기본·m0-core **공유 작업본 2개**가 남았다. S02는 별도 저장소이므로 이 개수에 포함하지 않는다.
`origin/*` 원격 추적 참조와 실제 원격 HARN 브랜치·PR은 그대로 남아 있다. 로컬 캐시는 fetch로 갱신하지 않았으므로 원격의 최신 상태와 동일하다고 주장하지 않는다.
로컬 main의 제품 commit과 develop의 수동 검사 commit을 보존했으며, 원격 main/release/develop으로 reset하거나 병합하지 않았다.

## 검증과 실행 경계

- 삭제 전 S01 bundle SHA-256 `53fd80869f224a392421bde410fecab9278a68cab407c6e422965e7248780738` 재확인. 삭제 대상 commit 12개(HARN 10개·stash·fixprep)와 변경 파일 61개를 복구 근거에 대조했다.
- 추가 Git 메타데이터 60개를 복사한 뒤 hash·권한 대조. 기존 기록·백업 644개를 기준선으로 삼고, 의도한 세션 README 갱신 외 보존을 확인했다.
- 보존·삭제 상태 검사 **22/22 통과**. [상세 검증](../../archive/2026-09-26-local-cleanup/verification.json).
- 삭제 후 `node --test tests/git-checks.test.mjs`: **13/13 통과**, 실패·skip 0. [실행 출력](../../archive/2026-09-26-local-cleanup/manual-git-checks.txt).
- 삭제 전에 실행 중인 Git 프로세스와 대상 worktree를 현재 디렉터리로 사용하는 프로세스가 없음을 확인했다. 최초 프로세스 조회는 샌드박스가 차단해, 권한을 확장한 재시도 1회로 확인했다.
- `git diff --check`, 새 문서 공백·링크, 최종 변경 범위 확인 결과는 [문서 검증](../../archive/2026-09-26-local-cleanup/document-validation.json)에 기록한다.
- source·test·workflow의 추적 파일 수정, 새 commit, push, 원격 branch/PR 변경, CI 실행·재실행, DB 변경·배포는 수행하지 않았다. 이번 문서·백업 기록은 로컬에만 있다.
- 실패로 남은 로컬 삭제 대상 없음. 원격 PR 종료·브랜치 삭제는 이번 로컬 요청에 포함되지 않는다. 기존 paused goal과 T1은 재개하지 않았다.

필요하면 기존 [S01 복원 안내](../../archive/2026-09-26-s01-a-backup-145815/RESTORE.md)와 이번 [삭제 목록](../../archive/2026-09-26-local-cleanup/manifest.json)으로 회수할 수 있다. 기존 hook 설정을 복원하면 강제 정책이 다시 연결될 수 있으므로 복구 시에는 파일 복구와 hook 설치를 구분한다.
