# 검수 안내와 상단 구성 정리

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료(구현·검증·로컬 반영 완료) / 갱신: 2026-10-05 20:36 KST
- 앞선 batch-empty-state 종료 확인. 기존 변경 보존.
- 요청: 불필요한 안내 제거, 안내 버튼·결과 건수·필터의 시각적 위계 개선.
- 범위: batch Web/CSS, 공통 AppDialog 크기·문단 간격, 화면 planning, 기존 브라우저 회귀와 작업 기록/status.
- 기준: 도움말은 제목 옆 보조 아이콘, 건수는 실제 결과 머리글, 필터는 균일한 높이의 간결한 검색줄. 안내에는 승인/반려 의미만 남기며 오류 복구는 실제 오류 상황에서 안내한다.
- 검증: Web build/type/lint, 기존 브라우저 검수/접근성 회귀와 모바일·데스크톱 화면 확인. 데이터 변경·Git 반영·운영 배포 제외.

## 결과·검증

- 도움말: 승인 즉시 공개/반려 두 문장만 보존. 제목을 `검수 안내`로 축약, 공통 dialog 폭400px·본문14px·문단12px 간격으로 조정. 제목 옆21px 물음표 아이콘에44px 클릭 영역·접근성 이름·키보드 포커스 유지.
- 제목 옆0건 배지 제거. 결과가 있는 경우 목록 머리글에 건수 표시, 없는 경우 기존 빈 결과 안내만 표시.
- 검색줄: 장식 카드·padding 제거, input/button44px 통일. 실화면에서 발견한 global label margin12px을 해당 toolbar에서만0으로 덮어써 버튼 위치 불일치 수정. 기존 모바일 반응형 유지.
- Web build/typecheck, 대상 Vue·테스트 ESLint, tests tsc, git diff --check 통과.
- 최종 Chromium19 tests(batch-review15/navigation4) 통과·실패/skip0. 실제 버튼/입력 위치·높이 비교, 도움말 Tab/Shift+Tab/Escape·포커스 복귀, 기존 발행·응답 손실·조회·주소 회귀 유지.
- 도움말320/1280px·빈 화면1280px 직접 확인. screenshot `.local-data/admin-ux-rework/screenshots/batch-help-{320,1280}.png`, `batch-empty-{390,1280}.png`. 빌드/테스트 로그 `/tmp/blariyo-batch-help-*`.
- 로컬 최종 서버 세션32545로 재시작, Core READY·관리자 로그인 redirect 후200. workers=false 유지.
- DB 변경·commit/push·운영 배포 없음. 앞선 웃대 기존 데이터 복구 잔여는 유지.
