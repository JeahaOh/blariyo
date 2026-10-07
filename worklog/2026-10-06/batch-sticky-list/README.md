# 상세 스크롤 중 조회 결과 유지

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 / 갱신: 2026-10-06 21:00 KST
- 요청: 상세를 스크롤할 때 조회 결과가 옆에 계속 보이게 한다.
- 변경 범위: `apps/web/app/assets/css/admin.css`, `docs/planning/03-screen-design.md`, 이 기록.
- 담당 경계: 기존 이 세션 UI 변경을 이어 수정하며 품질 도입 세션 파일·공유 빌드·Git은 보존한다. 개인 실행 사본으로 Web만 빌드한다.
- 원인: 목록 내부만 overflow:auto이고 목록 패널 자체는 일반 문서 흐름이어서 상세를 내릴 때 함께 화면 밖으로 사라진다.
- 계획: 두 열을 사용하는901px 이상에서 상세 선택 시 목록 패널 sticky, viewport 내 최대 높이, 목록 내부만 축소/스크롤. 목록 제목·일괄 처리·페이지 이동을 유지하고 목록 끝에서 상세로 스크롤이 전파되지 않게 한다. 단일 열에서는 고정하지 않는다.
- 검증: 실제 요청 항목의 긴 상세, 목록 내부 스크롤, 짧은 높이·두 열 경계·모바일 확인. 업무 처리/DB 변경·commit/push·운영 배포 없음.

## 결과

- CSS media query901px 이상·has-detail에만 목록 패널 sticky/top0·최대높이100dvh-12px 적용. 머리글·선택 도구·페이지 이동은 축소하지 않고 목록만 min-height0으로 축소/내부 스크롤한다. 목록 overscroll-behavior-y:contain으로 끝에서 문서 스크롤 전파를 차단한다.
- 개인 실행 사본 Web 빌드 PASS, `git diff --check` PASS. 이 세션 로컬 서버를 재시작해 localhost:3000 반영. Vue/업무 로직·공유 빌드 산출물 변경 없음.
- Chrome 실제 요청 항목 `b84fc91e-8f5d-4f17-bd75-2a2f13ce84ee` 확인:1512×828, 상세 scrollY1845.5에서 목록 패널 top0/bottom816, 페이지 이동 bottom815로 화면 안 유지.
- 목록 내부 스크롤0→1147, 상세 scrollY1845.5 그대로 유지. 목록 끝에서 추가3페이지 스크롤해도 listScroll1147/상세1845.5 유지.
- 1024×600: 패널 top0/bottom588, 페이지 이동 bottom587. 901×500: 패널 top0/bottom488, 페이지 이동 bottom487. 가로 넘침 없음.
- 900px는 단일 열·position:static, 390px는 block·position:static이며 가로 넘침 없음. 임시 viewport 원복.
- 실제 승인/반려/삭제/발행·DB 수정·전체 브라우저 자동 회귀·commit/push·운영 배포는 미실행. 이번 검증은 CSS 변경의 실제 스크롤·화면 크기별 확인이다.
