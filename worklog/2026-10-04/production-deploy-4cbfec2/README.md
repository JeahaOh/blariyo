# main 4cbfec2 운영 배포

- 담당: Codex 운영 배포 세션
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/ci-fast-validation` (기존 CI 개선 세션의 브랜치 유지)
- 변경 경로: 이 기록만. 기존 CI 개선 파일과 기존 검토 기록은 다른 담당 범위로 보존.
- 운영 범위: 검증된 main API/Web 이미지 배포와 백업·상태 검증. DB migration·설정·기능 flag 변경 없음.
- 상태: 종료 — 운영 앱 배포·기본 검증 완료, Git 기록 반영·운영자 기능 인수 별도
- 갱신: 2026-10-04 16:12 KST
- 요청: “깃헙 액션 끝났으니까 운영 배포 해”

## 배포 전 확인

- 원격 main: `4cbfec252a993dc685dc984b9dd17b8a66588263`.
- [CI #54](https://github.com/JeahaOh/blariyo/actions/runs/37184260894): GitHub 브라우저에서 Success, verify 9m26s, collector 5m7s, API/Web images 모두 성공 확인. 전체 11m12s.
- API: `ghcr.io/jeahaoh/blariyo-api@sha256:7c9fd988c2a077749318e35ba3772e8406974471e12e61a3d705c422242c0f3a`.
- Web: `ghcr.io/jeahaoh/blariyo-web@sha256:5f5edbfbb5440f2b489bfeb727dd3d4abbf36f31b05d91e2edd394f05a1b6950`.
- 위 SHA 태그의 이미지를 운영 서버로 pull하고 두 digest가 CI 출력과 일치함을 확인.
- 기존 운영 release: `/opt/blariyo/application/release-b2a7435-main-nightly-20261003T045949Z`.
- 기존 API/Web/DB는 running healthy, OOM false. 배포 service inactive/success, 배포 잠금 없음.
- 서버 배포 스크립트 SHA-256 `41ce29ac633245ef690337b1dc789276488b1dd604cf91747db218cca6a84414`: 로컬 추적 파일과 일치.
- 공유 저장소 refs·index·브랜치를 변경하지 않기 위해 `/private/tmp/blariyo-deploy-1004.git` 임시 bare 저장소에 후보를 조회했다. worktree는 생성하지 않았다.
- `c4fd0f9..4cbfec2` 파일 차이 없음. `b2a7435..4cbfec2`에 migration·DB 설정·entity·배포 실행 코드 변경 없음.
- 운영 DB를 READ ONLY transaction으로 조회: API V010/10건, Collector V010/10건, `ops.is_schema_ready('V010')=true`.
- 16:10:46 KST 새 백업 성공: 511,118 bytes, SHA-256 `338260e50a154a79ca00a93ca61741d5e0755f35f0b23084ec61aed7aceb8b31`.

## 최초 확인 당시 대기 (아래 재개 결과로 해소)

- `deploy/backup/README.md`에 기록된 로컬 복구키 파일이 없어 격리 복원 검사를 시작하지 못했다.
- 기존 비공개 설정·task_list·iCloud blariyo 경로와 파일명 검색에서 복구키를 찾지 못했고 사용자에게 현재 파일 경로를 문의했다. 키 원문은 요청·출력하지 않았다.
- 앱 교체는 아직 실행하지 않았다. 새 백업 생성과 이미지 pull은 완료했으며 운영 API/Web은 기존 버전이다.
- 커밋·push·tag 생성 미실행. 기존 CI 작업과 Git 변경 충돌을 피한다.

- 다음 담당: 사용자(복구키 파일 위치 확인) → Codex 운영 배포 세션(격리 복원 검사, 기존 nightly 배포 서비스 1회 실행, digest·health·timer·공개 응답 확인).
- 중단 근거: `docs/operations/deployment-runbook.md` §4 3단계의 새 백업·R2 실다운로드·해시·격리 복원 확인 조건. 성공한 CI 백업 workflow는 실제 운영 백업 복원 증거를 대신하지 않는다.
- 기록 검증: 이번 기록의 `git diff --check` 통과. 시작·종료 Git 상태에서 기존 CI 변경 경로를 보존했고 이번 기록 폴더만 추가했다.

## 복구키 확인 후 재개

- 갱신: 2026-10-04 16:18 KST
- 사용자 요청으로 프로젝트 숨김·Git 제외 파일까지 검색해 `worklog/task-list/.blariyo-recovery/postgres-age-identity.txt`를 찾았다. 앞선 탐색에서 프로젝트 내부 이동 경로를 누락했다.
- 키 파일 600·부모 디렉터리 700, 전용 `.gitignore` 제외 확인. 비밀값은 출력·기록하지 않았다.
- 기존 운영 배포 요청에 따라 이 키를 SSH 표준입력으로만 전달해 격리 복원을 검사하고 배포를 재개한다.

## 운영 배포 결과

- 완료 시각: **2026-10-04 16:19:26 KST**.
- 방식: 서버의 기존 `blariyo-nightly-main-deploy.service`를 수동 1회 실행. 실행 직전 main SHA·현재 release·스크립트 hash·잠금 없음 재확인.
- main: `4cbfec252a993dc685dc984b9dd17b8a66588263`.
- release: `/opt/blariyo/application/release-4cbfec2-main-nightly-20261004T071908Z`.
- API/Web digest는 위 CI 출력·서버 pull 검증값과 동일하며 실행 컨테이너에서도 일치.
- 배포 service `Result=success`, `ExecMainStatus=0`; journal에 해당 SHA의 `DEPLOYED main` 확인.
- 서버 부팅 helper가 새 release를 참조함. 기존 helper는 `.20261004T071926Z` 사본 보존.
- API/Web/DB/Nginx 모두 running healthy, OOM false, 공개 host port 없음.
- Core readiness `200 / READY`.
- publish/outbox/cleanup/backup/nightly-main-deploy 타이머 5개 active/enabled.
- DB READ ONLY 재조회: API V010/10건, Collector V010/10건, schema readiness true. DB migration 미실행.
- 이전/새 release의 api.env·web.env·Compose·logging 설정·app-password·운영자 매핑 파일은 해시 비교 일치. 비밀값 출력 없음.

## 백업·공개 검증

- 배포 전 16:10 백업의 R2 실제 다운로드·SHA-256·age 복호화·격리 PostgreSQL 18 복원·운영 ledger/정책 hash/게시글 수 대조 통과.
- 배포 서비스가 16:19:11 KST 생성한 추가 백업도 동일한 실제 다운로드·복호화·격리 복원 검사를 통과.
- 최종 백업: 511,118 bytes, SHA-256 `3f348e7574f32dcdc61b9b2cb7776816045253948b020100419187c9fbfaea2a`.
- 복구키는 프로세스 메모리·SSH stdin에서만 사용. 서버 키 파일 저장 없음, 격리 복원 컨테이너·임시 사본 정리 확인.
- `/meme`, `/terms`, `/privacy`, `/cookie-settings`, `/health/live` HTTPS 200.
- 실제 공개 상세 `/meme/posts/115` 200.
- 공개 약관·개인정보 API v0.1/시행일/placeholder 없음 확인.
- 익명·위조 헤더의 관리자 화면/API는 Access 인증으로 이동. 내부 readiness 공개 경로는 404.
- HTTP→HTTPS, www→대표 도메인 redirect 정상.
- 공개 HTML/JSON 404와 Web 직접 JSON 404의 `no-store` 확인.
- 새 빌드 자산 4개에서 원래 URL·쿼리 변형의 응답 SHA-256 일치, 양쪽 immutable 정책 확인.

## 잔여·검증 경계

- 이번 배포의 관리자 MFA 로그인 이후 검색·작성·업로드·발행·숨김 기능 인수는 미실행. 익명 인증 보호 확인과 구분한다.
- 실제 rollback·VM 재부팅·장기 관찰은 수행하지 않았다.
- 공유 작업 폴더에서 CI 개선 담당이 진행 중이므로 G03에 따라 브랜치 전환·공유 Git refs/index 변경을 하지 않았다. **배포 tag 생성, 작업 기록 commit·push는 미실행**이며 후속 Git 반영 때 처리한다.
- 기존 미커밋 CI 파일·다른 작업 기록 보존. 이번 저장소 변경은 이 작업 기록뿐이다.

- 최종 기록 갱신: 2026-10-04 16:20 KST
