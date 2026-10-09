# 수집처 관리 메뉴 분리

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 21:58 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / HEAD: `abf21ea`, release 공통 기준 `7df63de`.
- 요청: 출처별 자동 발행 설정을 별도 `수집처 관리` 메뉴로 구성한다.
- 앞선 [로컬 실행](../source-auto-publish-local/README.md)과 [자동 발행 개발](../source-auto-publish/README.md)의 종료 상태를 확인했다. 기존 미커밋 변경은 보존하고 이 후속 변경을 더한다.
- 담당 경로: 로그인 복귀 허용 경로·관리자 메뉴 2곳·새 `/admin/sources` 화면·SourcePublishPolicies·검수 화면의 설정 제거·해당 브라우저 테스트, planning 화면/수집 기획·기술 계약·개발 명세·status, 이 기록.
- 범위: 수집처 목록/자동 발행 상태 조회와 기존 설정 편집을 독립 화면으로 이동. API/DB/발행 규칙·공통코드 편집·legacy 수집처 설정은 변경하지 않는다.
- 검증: Web 빌드·타입/lint, 메뉴 이동/권한/설정 저장/충돌/조회 실패 복구·반응형 브라우저 검사, 로컬 서버 재시작·실제 화면 조회. 실제 로컬 정책 ON·예약 배치 재개·운영 적용·Git 반영은 하지 않는다.

- 1차 검사: build/type/lint 통과. Chromium 11개 중9개 통과·2개 실패로 새 경로 로그인 복귀 누락 발견. 허용 경로에 `/admin/sources`를 추가하고 동일 직접 접속 입력을 재검증한다.

## 결과

- 별도 관리자 메뉴 `수집처 관리`(`/admin/sources`) 추가. 검수 화면의 기존 설정 패널 제거, 등록 수집처 목록·저장된 자동 발행 상태·선택 수집처 설정을 새 화면으로 이동했다.
- 두 관리자 navigation 및 현재 위치 제목, 로그인 복귀 allowlist를 맞췄다. OWNER 변경·EDITOR 조회 및 batchReview 기능 경계를 유지한다.
- 처음 조회/재조회 실패 시 명시적인 재시도와 저장 차단을 제공한다. 저장 충돌은 기존 낙관적 버전 검사와 최신 상태 재조회로 처리한다.
- 제품 화면·수집 기획·기술 계약·개발 명세·status 동기화. 정적 공개 화면 검토물은 이 관리자 화면을 포함하지 않아 수정하지 않았다. 법무/공개 정책·발행 조건 변경 없음.

## 최종 검증

- `npm run build`: API·Web 빌드 통과. 이후 소스 변경 없음.
- Web typecheck/lint, tests typecheck/lint 통과. tests lint에서 발견한 DB any 결과의 직접 접근은 같은 건수 비교를 전체 결과 비교로 바꿔 해결했다.
- Docker Chromium: source-auto-publish + common-codes + global-loading 총11 tests 통과, fail/skip 0. 마지막 테스트 타입 보완 후 source-auto-publish 4 tests 재실행도 통과.
- 시나리오: 검수→새 메뉴 이동, 현재 메뉴 표시, 직접 URL 로그인 복귀, OWNER ON/OFF·새로고침·충돌 후 재조회, EDITOR 수정 불가, 최초 조회 실패 복구, 기능 OFF 메뉴 숨김·직접 진입 안내. ON/OFF 테스트는 임의 생성 격리 DB에서 수행했고 해당 fixture는 정리됐다.
- 화면 너비1280/390/320px 가로 넘침 없음. [데스크톱](admin-sources.png)·[모바일](admin-sources-mobile.png) 캡처 직접 확인.
- migration·OpenAPI 계약 무결성1 test 통과. 관련5개 정본의 상대 링크 대상 존재, `git diff --check` 통과.
- 이번 변경은 프런트엔드/문서 범위다. API/Collector 전체 테스트·전체 quality profile·운영 검증을 다시 실행한 것으로 보고하지 않는다. 앞선 quality receipt는 이전 입력의 기록이다.

## 실제 로컬 반영

- 기존 개발 LaunchAgent 정상 재시작: API PID25364·Web PID25367. API readiness `READY` 확인.
- 실제 Chrome 로그인 후 `/admin/sources` 복귀, 새 메뉴·페이지 제목·21개 수집처·전체 자동 발행 사용 안 함 확인. 해당 화면 탭을 열어 두었다.
- 실제 개발 DB 정책/이력 모두0행으로 이전 값 유지. 예약 배치4개 disabled/unloaded 유지. 자동 수집·검수·발행 실행 없음.
- Git HEAD `abf21ea` 유지. 기존 미커밋 개발분 보존. 이번 요청의 commit/push·운영 배포 없음.

- 종료 확인: 2026-10-09 22:00:23 KST
