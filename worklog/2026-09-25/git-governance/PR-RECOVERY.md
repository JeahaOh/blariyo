# 분리된 Git governance PR 준비 결과 — 2026-09-25

## 범위와 보존

- 사용자 승인: 기존 harness 변경과 무변경 push 보완을 PR로 준비하고 local release tracking을 연결한다.
- 원본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, `develop` 기준 `8af72449a7d56c9701efd0d73dc7d430a66f9610`.
- 별도 worktree: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-git-governance`.
- stash `c373dac4ad6584e663ad958d1c9d64767dc48605`를 apply/pop/drop하지 않았다. 원본 미추적 파일 56개의 SHA-256과 Git 상태를 작업 전후 대조한다.
- SQL migration/checksum 코드, 전체 포맷 변경과 local main의 미배포 8개 commit을 이 PR에 넣지 않았다. 과거 RESULT의 전체 lint 통과는 이 분리된 브랜치에 승계하지 않는다.

## 준비된 순서

| 순서 | source branch | 대상 | 내용 |
| --- | --- | --- | --- |
| 1 | `feature/HARN-06-governance-registration` | `develop` | 정책·HARN-06/07 manifest·설계·기존 기록 11개 파일. 등록 commit `ada2474`. 새 검사 workflow를 활성화하지 않음 |
| 2 | `feature/HARN-06-git-governance-bootstrap` | 1번 병합 후 `develop` | harness·hook·quality 검사기, CI/npm/Gradle/architecture 연결과 이 복원 기록. draft 상태로 검토 필요 |

첫 PR이 base 정책을 먼저 등록해야 후속 CI가 신뢰된 base 정책과 허용 경로를 읽을 수 있다. 구현 브랜치에서 manifest를 바꾸거나 기존 gate를 우회하지 않는다. 병합과 원격 보호 설정은 이번 로컬 준비의 결과가 아니다.

## 실제 복원과 보완

- 작업 폴더에서 45개 구현 파일을 복사했다. 생성된 `.quality/baseline.candidate.json` 및 SQL checksum 호환 source는 제외했다.
- stash에서 정확히 9개 경로의 변경분을 적용했다: CI/backup workflow 2개, package/lock 2개, Prettier 설정, Collector Gradle/lock 2개, architecture test 2개. local main에만 있는 브라우저 runner 명령은 가져오지 않았다.
- 같은 SHA의 보호 branch 입력 허용과 SHA 변경 거절 회귀를 포함했다. 최초 remote branch 생성 실패와 무변경 입력 처리는 다른 조건이다. 현재 `develop` 최초 생성은 사용자가 이미 완료했다.
- 깨끗한 checkout에서도 architecture 검사가 동작하도록 API build를 test build보다 먼저 실행한다.
- Web lint 전에 `nuxt prepare`로 TypeScript 설정을 생성한다.
- 백업 복원 CI에 lint에 필요한 Python 버전과 requirements 설치를 추가했다.
- native lint 도구 경로를 `.git` 디렉터리 가정에서 Git common directory 조회로 고쳤다. 일반 checkout과 linked worktree에서 같은 도구를 재사용하는 실제 Git 회귀를 추가했다.
- 새 worktree가 원본의 hooksPath만 상속하고 설치 metadata는 갖지 않는 문제를 관찰했다. 새 worktree의 상속 설정을 백업하고 그 worktree 전용 hook을 installer로 재설치한 뒤 commit 검사를 실행했다. 원본 hook 설정은 바꾸지 않았다. 향후 worktree 생성과 자동 hook 설치 연결은 별도 보완 대상이다.

## 이 브랜치의 검증

| 검사 | 결과 |
| --- | --- |
| Node `24.18.0`, `npm ci --no-audit --no-fund` | 성공; dependency install-script 미승인 경고는 별도 유지 |
| `npm run test:harness` | 52/52 통과, skipped 0 |
| `npm run test:quality` | 10/10 통과, linked worktree native tool 회귀 포함 |
| `npm run lint:harness` | 통과 |
| 변경한 quality JS/test의 ESLint | 통과 |
| `npm run test:architecture` | API build 및 test build 성공 후 9/9 통과 |
| 언어별 정상/위반 fixture | 전체 lint 실행 안에서 6/6 통과 |
| 두 workflow actionlint | 통과 |
| `npm run lint:all` | 실패 유지: JS module, Ruff, ShellCheck 및 baseline 검사 4개 그룹 |
| baseline 위반 | 1,237건: SQL 462, CSS 130, Markdown 302, Prettier 343. 앞의 JS/Ruff/ShellCheck 결과는 이 수치에 포함하지 않음 |

검증 로그는 준비 환경의 `/tmp/blariyo-pr-harness.log`, `/tmp/blariyo-pr-quality.log`, `/tmp/blariyo-pr-architecture.log`, `/tmp/blariyo-pr-lint-all.log`에 남겼다. 원격 CI·Windows runner·실제 DB restore·배포는 이번 작업에서 실행하지 않았다.

## 병합 전 남은 일

- 1번 정책 등록을 검토·병합하고 2번 PR의 base에 해당 정책이 들어온 것을 확인한다.
- 원본 stash의 전체 lint/SQL 정리 변경을 별도 범위로 검토·반영한 뒤 전체 lint를 다시 통과시킨다. 현재 2번은 merge-ready가 아니다.
- 원격 CI 결과와 보호 규칙을 실제로 확인한다. 로컬 test·YAML 통과는 이를 대신하지 않는다.
- 사용자 생성 `release`는 `release/<version>` 정책과 ref 이름 공간이 충돌한다. 실제 버전 release 시작 전에 별도 이름 이관이 필요하며 이번에는 삭제·이름 변경하지 않았다.
