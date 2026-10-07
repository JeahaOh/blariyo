# 로컬 서버 실행 상태 확인

- 요청: 로컬 서버가 실행 중인지 확인.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료 / 갱신: 2026-10-05 18:08 KST
- 변경 경로: 이 기록만 추가. 기존 미커밋 코드·테스트·문서는 보존.
- 확인: `lsof`에서 TCP3000/3100 LISTEN 없음. 프록시를 제외한 loopback HTTP 요청도 Web `/admin/login`, Core `/health/live` 모두 curl exit7(연결 실패).
- 결과: 로컬 Web·Core 서버 미실행. 조회 요청이므로 서버 시작·DB 변경은 수행하지 않음.
- 이전 맥락: [관리자 뒤로가기 수정](../../2026-10-04/admin-detail-history/README.md) 당시 실행 중이던 서버 상태를 현재 상태로 재사용하지 않고 직접 확인함.

## 사용자 요청에 따른 서버 시작 — 18:32 KST

- 요청: 로컬 서버 실행. 담당·폴더·브랜치 동일. 기존 변경을 보존하고 이 기록만 추가 갱신.
- Node24.18.0으로 `scripts/local/start-development.mjs` 실행. 시작 전3000/3100 포트가 비었음을 확인. Core PID87855, Web PID87858, 실행 세션1419.
- 기존 로컬 개발 DB와 현재 Web 빌드로 시작했으며 `workers=false`. 새 빌드·migration·운영 접속은 수행하지 않음.
- Web `/admin/login`, `/meme`, `/api/v1/boards`와 Core `/api/v1/boards` HTTP200 확인. Core 실제 상태 경로는 `/internal/health/live`, `/internal/health/ready`이며 두 경로 모두200 확인. 처음 조회한 Core `/health/live`는 등록되지 않은 경로여서404였으며 서버 장애가 아님.
- 상태: 종료(서버 시작·응답 확인 완료, 서버 실행 유지).
