# CI 병렬화와 main 중복 검증 제거

- 담당: Codex (현재 세션)
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/ci-fast-validation`
- 기준: `release@c4fd0f9`, 기존 미커밋 검토 기록 2개는 보존
- 상태: 종료 (요청된 단위별 로컬 commit; 원격 CI 성능은 미검증)
- 갱신: 2026-10-04 16:23 KST
- 요청: CI 시간 개선 추천안 적용, release PR와 main의 중복 검사 개선.
- 변경 범위: `.github/workflows/ci.yml`, CI 판정 도구·회귀 테스트, package 검사 명령, CI 관련 문서, 이 기록.
- 제외: 앱 동작·DB·운영 배포·원격 설정·push·main 병합. 기존 전체 검사 assertion과 실제 예약 시각 검증은 유지한다.

## 구현 기준

- PR에서 quality·DB 통합·브라우저·Collector를 독립 job으로 실행하고 verify가 결과를 집계한다.
- 기존 setup-java의 Gradle cache를 활성화한다. 테스트 통과 결과는 cache로 대신하지 않는다.
- main push는 같은 저장소 release/hotfix→main PR의 성공 실행·필수 job·검증 기록을 확인한다. 검증된 PR 합성 merge의 부모 커밋·전체 tree가 실제 main merge와 같을 때만 전체 검사 재실행을 생략한다.
- 증거 없음·만료·불일치·API 실패·PR 검사 진행 중·일반 push는 main에서 전체 검사를 수행하는 보수적 경로로 돌아간다. workflow_dispatch는 항상 전체 검증한다.
- 배포 후보인 main 대상 PR은 문서만 바뀌어도 전체 검증한다. 그 외 PR의 명확한 일반 문서/worklog 변경만 무거운 검사를 줄인다. OpenAPI·계약·공유 설정은 일반 문서로 취급하지 않는다.
- GitHub Actions 원격 실행과 성능 개선 실측은 로컬 검증과 구분한다.

## 구현·중간 검증

- `plan → quality/integration/browser/collector → verify → images`로 분리했다. main에서 PR 결과를 재사용하더라도 quality와 image build는 실행한다.
- PR 검증 기록은 run/회차/PR/head/base/합성 merge SHA/부모/tree/필수 결과를 담고, main은 GitHub의 실제 성공 run/job과 ZIP digest를 대조한다.
- 실제 Git 저장소에서 같은 부모·tree를 가진 서로 다른 merge SHA 재사용과 내용 변경 시 거부를 검증했다. 다운로드 token은 API 요청에만 전달하고 ZIP은 메모리에서 JSON만 읽는다.
- CI 판정 회귀 16/16, 공식 actionlint 1.7.12의 workflow 검사, Python 구문·상대 링크·diff whitespace 검사 통과. actionlint는 공식 release와 checksum을 대조한 `/private/tmp` 실행본으로 검사했다.
- Node 24.18.0 API/Web·API test build, scripts/tests 타입·lint, Web 타입, `npm test` 51/51 통과.
- DB 통합 중 BFF/sitemap 검사가 Web build도 요구함을 source에서 확인하여 integration job의 API/Web build를 유지했다. browser job만 Java 준비를 제거한다.
- 테스트 전용 PostgreSQL `9cd8db3312a3186b508e74a57fa735bce2a9ee282daa3e5ab7afff8500fd9d85`를 새로 생성했다. 운영·기존 개발 DB를 초기화하지 않는다.
- DB 통합은 위 전용 서버의 파일별 임시 DB, 브라우저는 기존 검증 runner가 만드는 임의 DB와 일회용 Playwright 컨테이너를 사용한다.
- 다른 운영 배포 세션이 이 폴더의 `worklog/2026-10-04/production-deploy-4cbfec2/`만 작성 중임을 확인했다. 해당 기록·운영 작업은 건드리지 않으며 현재 세션도 branch/index/ref 변경·commit을 수행하지 않는다. CI 파일 담당은 이 세션으로 유지한다.

## 최종 로컬 검증

| 검사 | 결과 |
| --- | --- |
| CI 판정 회귀 | 16/16 통과; 실제 Git merge·API 실패·artifact digest·인증 헤더 분리 포함 |
| 기존 `npm test` | 51/51 통과 |
| CI 범위 DB 통합 | 29파일 129/129 통과, 실패·skip 0; 기존 CI와 같이 schema restore 제외 |
| Chromium 브라우저 | 54/54 통과, 실패·skip 0, 약238초; JAVA_HOME 미설정 상태 |
| build·타입·lint | API/Web·API test build, scripts/tests 타입·lint, Web 타입 통과 |
| workflow·문서 | actionlint 1.7.12, Python AST, 상대 링크, diff whitespace 통과 |

- 로그: `/private/tmp/blariyo-ci-fast-quality.log`, `fixtures.log`, `integration.log`, `browser.log` (뒤 3개도 같은 `blariyo-ci-fast-` 접두사).
- 이번 실행 소유 PostgreSQL은 immutable container ID로 제거했다. 브라우저 runner도 자기 Playwright 컨테이너를 정리했다. 기존 개발 PostgreSQL은 유지했다.
- Collector 전체 명령·assertion·skip 차단은 변경하지 않았다. 이번에는 Java fixture 준비를 실행했고 Collector 전체 재실행은 하지 않았다. 앞선 289/289 결과를 이번 변경의 신규 실행 결과로 표시하지 않는다.
- GitHub REST·artifact 회귀는 격리된 대역이며 실제 인증된 원격 재사용 성공의 증거가 아니다. 원격 PR 성공 → 동일 main에서 reuse → 새 image 게시 및 5~6분 목표 실측은 후속 원격 수용이다.
- 새 CI가 아직 main에 없거나 이전 PR에 검증 artifact가 없으면 전체 검사로 돌아가도록 했다. 모든 오류에서 검사나 image gate를 무조건 생략하는 경로를 만들지 않았다.
- 로컬 feature에 수정·신규 파일로 남겼다. commit·push·release 통합·main 병합·원격 설정·운영 배포는 이 작업에서 하지 않았다.

## 후속 요청: 변경 단위별 commit

- 사용자 요청: 수정 내용 단위로 commit. CI 구현·회귀 테스트와 운영·검증 문서를 나누어 로컬 feature에 반영한다.
- 운영 배포 세션과 복구키 경로 문서 갱신 세션의 기록에서 모두 종료 상태를 확인했다. 앞선 공유 폴더 Git 작업 보류 사유는 해소됐으며, 현재 세션이 이 CI 변경의 index·commit을 담당한다.
- 제외 경로: `deploy/backup/README.md`, 기존 `ci-duration-review/`·`predeploy-db-review/` 기록, 다른 세션의 `production-deploy-4cbfec2/`·`recovery-key-location/` 기록. 해당 미커밋 변경은 보존한다.
- 커밋 범위: 1차 CI workflow·판정 도구·회귀 테스트·검사 명령, 2차 CI 관련 문서와 이 작업 기록. push·merge·배포는 요청 범위에 포함하지 않는다.
- 구현 commit: `1d1bfa8` (`ci: parallelize checks and reuse verified PR results`), 4파일. 실제 pre-commit의 staged 계약·migration·OpenAPI 검사 통과.
- 문서 commit: `docs(ci): document PR verification reuse and fallback` 제목으로 CI 계약·운영 안내·검증 안내와 이 기록을 별도 반영한다. 자기 commit SHA는 이 기록을 포함하는 Git 이력으로 확인한다.
- 이번 commit 요청에서 hook 설치 상태, CI 회귀 16/16, actionlint 1.7.12, diff whitespace를 다시 검사하여 통과했다. 앱·DB·브라우저 전체 검사는 앞선 로컬 검증 결과이며 이번 commit 단계에서 재실행하지 않았다. 구현 source는 앞선 검증 이후 변경하지 않았다.
