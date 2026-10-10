# 키워드 관리 로컬 실행 반영

- 요청: 3000번 포트에서 화면이 열리지 않는 문제 확인 및 로컬 실행 반영.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 11:10 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, HEAD `6990dea`.
- 담당 경로: 이 기록 폴더, Git 제외 로컬 DB 백업/검증/실행 산출물. 이전 소스 변경과 사용자 변경 보존. 당일 이전 담당 모두 종료 확인.
- 확인: 기존 `start-development.mjs`(PID88289)와 자식 Web(PID88297)이 3100/3000에서 실행 중. 익명 `/admin/keywords` 응답401. API DB V015, Collector V016이며 키워드 관리에 필요한 API V016/V017 미적용.
- 작업: 로컬 DB 전체 백업 및 별도 DB 복원/보존 검증 → API V016/V017과 기존 API 역할 최소 권한 적용 → 최신 빌드로 해당 로컬 서버 재시작 → 개발 관리자 로그인 및 실제 키워드 목록 브라우저 확인.
- 경계: 운영 변경·Git 반영·예약 수집/자동 발행 활성화 없음. 게시글/키워드 설정 쓰기 검수는 수행하지 않음.

## 결과

- `npm run build` PASS(Node24.18.0). 기존 서버는 복사된 과거 Web 빌드로 실행 중이었다. 현재 빌드로 재시작 완료.
- 개발 서버 LaunchAgent `com.blariyo.discord-review.development`의 KeepAlive로 최초 SIGTERM 뒤 자동 재시작됐다. 해당 Agent만 bootout → DB 적용 → 원래 plist로 bootstrap 했고 최종 PID82726/exit0 확인. plist/다른 Agent 변경 없음. 수집 예약 Agent는 로드되지 않은 상태 유지.
- 백업: Git 제외 `.local-data/backups/keyword-local-1791598123754/database.dump`(1,863,237bytes), catalog 확인 및 별도 무작위 DB 실제 복원. 85개 테이블 count와 전체 행 digest 일치. 검증 DB만 삭제하고 백업/receipt 보존.
- API V016/V017 migration 및 기존 `blariyo_api_local` 최소 권한 반영. migration ledger 외 기존84개 테이블 전체 행 digest 동일. 초기 키워드125개/버전 `life-humor-v1`. Collector V016 유지. [DB 결과](database.json), [역할 권한](role-rights.json).
- 기존 API 역할에서 head SELECT/UPDATE, revision SELECT/INSERT 허용 및 revision UPDATE/DELETE 거부 확인. DB 설정을 변경하는 화면 쓰기는 실행하지 않음.
- Web 로그인200, 실제 Core `/internal/health/ready` READY/200. 최초 시작 직후 연결 준비 전 curl 실패와 잘못된 `/health/ready`404는 올바른 준비 상태 경로로 재확인했다.
- Chrome 신규 로컬 탭에서 개발 관리자 로그인 → `/admin/keywords`로 이동, 메뉴/목록125개/행별 선택·저장/필터/페이지 표시 확인. [실제 로컬 화면](localhost-keywords.png). 탭을 사용자에게 유지했다. 익명 관리자401는 인증 정책의 정상 응답.
- `git diff --check` PASS. 브랜치/HEAD 및 기존 소스 변경 보존. 이번 작업은 소스 변경 없이 기록과 로컬 실행/DB만 반영. 운영 배포·commit/push·자동 발행 실행 없음.
