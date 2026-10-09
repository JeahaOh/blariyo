# 출처별 자동 발행 로컬 실행

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / HEAD: `abf21ea`.
- 요청: 새 기능이 반영된 로컬 서버 실행. 앞선 [개발·격리 검증](../source-auto-publish/README.md)을 이어 실제 로컬 DB/API/Web에 적용한다.
- 담당 범위: 이 기록, 기존 개발 DB 백업·V015/앱 권한 적용, 동일 프로젝트의 기존 Web/API 재시작·화면 조회. 기존 미커밋 개발분 보존.
- 실제 출처 ON·수집/검수/발행 실행·예약 재개·운영 변경·커밋/push는 범위 밖이다.
- 계획: 기존 프로세스/대상 확인 → 비공개 로컬 백업 확인 → migration·권한 → API/Web 시작 → HTTP·화면·기본 OFF·기존 데이터 보존 readback.

## 실행 결과

- 갱신: 2026-10-09 21:50 KST. 로컬 V015 migration 및 `blariyo_api_local` 앱 권한 적용 완료.
- 변경 전 비공개 백업 1,845,771 bytes, pg_restore archive 목록 714개 확인. 파일 위치·SHA-256·기존 테이블 건수/해시는 [before.json](before.json)에 기록했다. DB 원문은 Git에 저장하지 않았다.
- 기존 API PID 27787을 정상 종료했다. 기존 `com.blariyo.discord-review.development` LaunchAgent의 KeepAlive가 최신 빌드로 재시작했으며, 별도 중복 서버는 만들지 않았다. API PID 23185 / Web PID 23186, 포트 3100 / 3000.
- Core `/internal/health/ready` HTTP 200, `READY`. DB `ops.is_schema_ready('V015') = true`.
- 실제 Chrome에서 개발 관리자 로그인 → `/admin/batch` 조회 → 출처별 자동 발행 설정 펼침 확인. 수집 결과 948건 표시, 출처 선택 21개, 기본 선택 더쿠의 자동 발행 체크 해제, 변경 없는 저장 버튼 비활성 확인.
- 정책·정책 변경 이력 테이블 모두 0행: 전체 출처 기본 OFF. 설정 저장·수집·검수·발행 실행 없음.
- 기존 게시물 30건·수집 항목 948건·검수 47건·검수 명령 17건은 전후 건수와 전체 행 해시가 동일하다.
- 로컬 수집, Discord scan, maintenance, awake LaunchAgent 4개는 모두 disabled 및 unloaded 유지. 개발 서버 실행 인자에 `--workers` 없음.
- 기존 소스 수정은 보존했으며 이번 요청은 로컬 실행 검증과 이 작업 기록만 추가했다. 커밋·push·운영 반영 없음.

## 접속

- 관리 화면: http://localhost:3000/admin/batch
- 공개 화면: http://localhost:3000/meme
- Chrome 관리 화면 탭을 열어 두었다. 다른 브라우저에서는 개발 관리자 로그인으로 진입한다.
