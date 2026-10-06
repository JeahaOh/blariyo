# 수집 결과 검수 버튼 고정

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 / 갱신: 2026-10-06 20:51 KST
- 요청: 상세 콘텐츠를 스크롤하는 동안 승인·반려 버튼을 계속 표시한다.
- 변경 경로: `apps/web/app/pages/admin-batch.vue`, `apps/web/app/assets/css/admin.css`, `docs/planning/03-screen-design.md`, 이 기록.
- 담당 경계: 진행 중인 AI 코드 품질 도입 세션의 파일·공유 빌드·Git 작업을 건드리지 않는다. 직전 제목 보정 작업의 개인 실행 사본에서 Web만 빌드하고 이 세션의 로컬 서버에 반영한다.
- 검증 계획: Web 빌드, 변경 Vue lint, 실제 요청 항목의 데스크톱·모바일 스크롤/버튼 위치 확인. 승인·반려 실행 및 DB 변경은 하지 않는다.
- 잔여: commit/push/운영 배포는 이번 작업 범위에 없다.

## 변경·검증 결과

- 버튼 행을 `position: sticky; top: 0`로 배치했다. 상세 패널의 `overflow: hidden`은 sticky를 가로막으므로 해당 패널만 `clip`으로 변경했다. 흰 배경·구분선·반응형 패딩으로 본문과 구분하고 삭제/발행 재시도도 같은 행에 포함했다. 처리 함수·활성 조건은 유지했다.
- 개인 실행 사본 `.local-data/development/todayhumor-title-build/`에 변경 Vue/CSS를 복사한 뒤 Web 빌드 PASS. 이 세션의 기존 서버만 재시작하여 localhost:3000에 반영했다. 공유 `.output` 및 다른 세션 서버는 변경하지 않았다.
- 변경 Vue ESLint PASS, `git diff --check` PASS. 처음 파일 복사는 작업 디렉터리를 잘못 지정해 실패했고, 올바른 경로에 복사한 뒤 다시 빌드했다. 첫 root ESLint 실행은 설정 위치를 찾지 못해 실패했고 Web 작업 디렉터리에서 같은 대상 파일을 검사해 통과했다.
- Chrome 실제 요청 항목 `ff6121af-c696-4c10-9fc7-4f227cff0741` 확인: 1512×828에서 scrollY=1656, 390×844에서 scrollY=2500, 320×740에서 본문 끝 scrollY=5170.5 모두 버튼 행 top=0/height=65px. 가로 넘침 없음. 두 버튼 높이44px 유지. 임시 viewport는 원복했다.
- 요청 항목은 이미 발행되어 두 버튼이 비활성 상태였다. 미검수 항목 `24c41a62-6ce5-4a7c-ba17-236342752a81`에서는 두 버튼 활성과 scrollY=719에서 top=0을 확인했다. 승인·반려·삭제·발행 실행은 하지 않았다.
- 실제 발행 재시도 상태의 클릭 동작·전체 브라우저 회귀·운영 적용은 미실행. 이번 변경 검증은 레이아웃·상태 유지 범위다.
