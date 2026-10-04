# main 3e3e1d0 운영 배포·태그 게시

- 담당: Codex 운영 배포 세션
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-deploy-3e3e1d0`, 기준 `release@43d82fe` (시작 시 clean)
- 변경 경로: 이 기록만. 기존 작업들은 종료 상태이며 겹치는 수정 없음.
- 상태: 종료 — 운영 배포·annotated tag 원격 게시 완료
- 갱신: 2026-10-04 KST
- 요청: Actions 완료 후 운영 배포하고 태그를 달아 push.
- 허용 범위: 현재 main API/Web 배포, 백업·복원·기본 동작 검사, 배포 커밋 annotated tag 생성 및 해당 태그 push.
- DB migration·기능 flag·인증 설정 변경, main 직접 commit/push, 기존 태그 일괄 push 제외.

## 사전 확인

- 후보 main: `3e3e1d0b79cd71d4ff3b6969fa6282b14da7fcf4`.
- [main CI #56](https://github.com/JeahaOh/blariyo/actions/runs/37186590723): 성공, 3m27s. quality·verify·API/Web images 성공.
- plan은 동일 merge tree와 성공한 전체 [PR CI #55](https://github.com/JeahaOh/blariyo/actions/runs/37185946231)를 근거로 검증 재사용 판정. main의 integration/browser/collector는 skipped이며 재실행 성공으로 표시하지 않는다. PR 전체 시간 5m40s.
- API image: `ghcr.io/jeahaoh/blariyo-api@sha256:8cb9f9668a88007c1c28f5f73a464929974dafb9ccc33123f2efa55853b49f38`.
- Web image: `ghcr.io/jeahaoh/blariyo-web@sha256:997520f298a14d0a6e6fc9036b59257b80c3db7542cfb32ab58a80d28ab5ae22`.
- 기존 운영: `4cbfec2`, `/opt/blariyo/application/release-4cbfec2-main-nightly-20261004T071908Z`. API/Web/DB healthy, OOM false, 배포 service 비활성·성공, 잠금 없음.
- `4cbfec2..3e3e1d0` 변경은 CI·문서·검토 기록이며 앱 코드·DB migration·배포 실행 코드 변경 없음.
- 서버 배포 스크립트 SHA-256 `41ce29ac633245ef690337b1dc789276488b1dd604cf91747db218cca6a84414` 유지.
- Node 24.18.0 `npm run hooks:check` 통과.

## 운영 배포 결과

- 완료 시각: **2026-10-04 16:53:09 KST**.
- 서버 `blariyo-nightly-main-deploy.service`를 수동 1회 실행. 실행 직전 main SHA·기존 release·스크립트 hash·배포 잠금 부재를 확인했다.
- 신규 release: `/opt/blariyo/application/release-3e3e1d0-main-nightly-20261004T075251Z`.
- 이전 release: `/opt/blariyo/application/release-4cbfec2-main-nightly-20261004T071908Z` 보존.
- CI 이미지 digest와 서버 pull·실행 API/Web image가 일치.
- service `Result=success`, `ExecMainStatus=0`; journal의 `DEPLOYED main 3e3e1d0...` 확인.
- API/Web/DB/Nginx running healthy, OOM false, 공개 host port 없음. Core readiness `200 / READY`.
- 부팅 helper는 새 release 참조. 이전 helper `.20261004T075309Z` 사본 보존.
- publish/outbox/cleanup/backup/nightly-main-deploy 타이머 5개 active/enabled.
- 운영 DB READ ONLY 재조회: API V010/10건, Collector V010/10건, schema readiness true. migration 미실행.

## 백업 확인

- 16:52:34 KST 사전 백업을 새로 생성하고 R2 실다운로드·SHA-256·age 복호화·격리 PostgreSQL 18 복원·운영 ledger/정책 hash/게시글 수 대조 통과.
- 배포 서비스의 추가 백업: 16:52:53 KST, 511,118 bytes, SHA-256 `38807a9e3f801a3cad8a3c2e5791e3829ad578e008a051780fdc3f64f1991a5f`.
- 키는 현행 안내 경로의 Git 제외 파일을 SSH stdin으로만 사용. 키 원문·서버 키 파일 저장 없음.

- 배포 서비스가 추가 생성한 16:52:53 백업도 동일한 R2 다운로드·해시·복호화·격리 복원·운영 대조 통과. 시험 컨테이너·임시 사본 정리 확인.

## 배포 후 공개·설정 확인

- `/meme`, `/terms`, `/privacy`, `/cookie-settings`, `/health/live` HTTPS 200, 실제 상세 `/meme/posts/115` 200.
- 공개 약관·개인정보 API v0.1/시행일/placeholder 없음 확인.
- 익명·위조 헤더 관리자 화면/API는 Access 인증으로 이동. Core 내부 경로 공개 404, HTTP→HTTPS·www→대표 도메인 redirect 통과.
- 공개 HTML/JSON 404와 Web 직접 JSON 404는 `no-store`.
- 자산 4개에서 원래 URL·쿼리 변형의 bytes 해시 일치와 immutable 확인.
- 이전/신규 release의 api.env·web.env·Compose·logging·app-password·운영자 매핑 파일 해시 일치. 값 원문 출력 없음.

## 태그·Git 반영

- 태그: `prod/2026-10-04-1653-KST-3e3e1d0`.
- annotated tag이며 대상 commit은 `3e3e1d0b79cd71d4ff3b6969fa6282b14da7fcf4`. release 경로·이미지 digest·ledger·백업·smoke·인수 경계를 annotation에 기록했다.
- 위 태그 하나의 refspec만 명시하여 origin push 성공. 기존 로컬 태그와 main/release/feature 브랜치는 push하지 않았다.
- `git ls-remote` 확인: 원격 tag object `ef44d5a8eeb8765e9e5ddb468ad5be1dcc772a23`, peeled commit `3e3e1d0b79cd71d4ff3b6969fa6282b14da7fcf4` 모두 로컬과 일치.
- 작업 기록은 현재 feature 브랜치에 로컬 커밋으로 보존하며 기록 브랜치 push·release 병합은 이번 태그 push에 포함하지 않는다.

## 미검증·경계

- 새 버전의 실제 MFA 로그인 이후 관리자 쓰기 인수, rollback·VM 재부팅·장기 관찰은 미실행.
- CI 성공, 운영 배포, 태그 게시, 운영자 인수는 별도 증거다. 이번 main의 무거운 검사는 PR 결과 재사용이며 main에서 다시 실행한 것으로 보고하지 않는다.
- 복구키·운영 비밀·설정 파일은 Git 변경 범위에 포함하지 않았다.

- 최종 갱신: 2026-10-04 16:54 KST
