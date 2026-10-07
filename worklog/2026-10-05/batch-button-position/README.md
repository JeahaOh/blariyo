# 검수 화면 버튼 위치 확인

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료(버튼 정렬 구현·검증·로컬 반영) / 갱신: 2026-10-05 20:45 KST
- 앞선 batch-help-layout 종료 확인, 기존 변경 보존.
- 요청: 버튼 위치 정정. 처음 조회 버튼으로 해석했으나 이번 메시지에는 대상이 명시되지 않았다.
- 현재 코드: 조회 버튼과 select는44px, 필터 label margin0, desktop flex-end 정렬. 도움말은 제목 옆, dialog 확인은 오른쪽 아래.
- 대상 확인: 조회 / 제목 옆 도움말 / 안내창 확인 중 어느 버튼인지 비동기 질문. 답변 전 추가 UI 변경 없음.
- 수행: Git 상태·관련 CSS·직전 담당 확인. 새 테스트·배포·데이터 변경 없음.

## 후속 지시와 구현

- 사용자 후속: 특정 버튼 하나가 아니라 도움말·조회 등 화면 전체 버튼 정렬 문제. 개별 대상 재질문 없이 이 화면 기준으로 수정한다.
- 담당/폴더/브랜치 유지, 변경 범위: batch CSS·도움말 SVG, AppDialog 버튼, 화면 planning, 기존 브라우저 위치 검사 및 이 기록/status.
- 제목 중앙 SVG 도움말·32px 버튼, 필터 라벨/입력의 명시적 grid 행,44px 입력/조회와14px/20px 텍스트 규격, 상세 버튼 그룹 오른쪽 정렬, dialog 확인 버튼 중앙 텍스트/여백 정렬.
- 검증: 브라우저 위치·크기 측정과320/390/768/1280/1440 화면 확인, Web build/type/lint. 데이터/운영/Git 반영 제외.

## 검증 결과

- Web build/typecheck·대상 Vue/테스트 ESLint·tests tsc·git diff --check 통과.
- Chromium19 tests 모두 통과(실패/skip0).320/390/768/1280/1440px에서 제목과 도움말 중심 차이2px 미만 확인.768px 이상에서 조회/select 상단·높이 차이2px 미만, 목록 전체 너비·짧은 빈 결과와 기존 검수/복구/탐색 동작 검증.
- 생성된320/768px 빈 결과와1280px 상세를 직접 확인. 도움말 SVG, 조회 공통행, 상세 작업 버튼 오른쪽 정렬 확인. 관련 screenshot `.local-data/admin-ux-rework/screenshots/batch-empty-*.png`, `batch-review-1280.png`.
- 최종 로컬 서버 세션2437로 재시작. Core READY·관리자 로그인 redirect 후200, workers=false. 로그 `/tmp/blariyo-button-position-*`.
- 일반 CSS/다른 관리 화면·운영 데이터 변경 없음. commit/push/배포 없음.
