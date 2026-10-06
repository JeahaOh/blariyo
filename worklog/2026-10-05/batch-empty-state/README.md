# 수집 검수 빈 화면 정리

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료(구현·검증·로컬 반영 완료) / 갱신: 2026-10-05 20:31 KST
- 앞선 batch-review-publish 종료 확인. 기존 변경 보존.
- 요청: 선택 상세가 없으면 영역 숨김, 0건 목록의 제목·페이지·과도한 여백 제거.
- 범위: admin-batch.vue, 관련 admin.css, 화면 planning, 기존 브라우저 회귀, status와 이 기록.
- 기준: 미선택은 목록 전체 너비, 빈 결과는 안내만 표시, 페이지 이동은 2페이지 이상일 때만 표시. 상세 URL 복원·명령 복구 유지.
- 검증: Web build/type/lint, 실제 Chromium 목록/상세·빈 결과·페이지·만료 회귀와 화면 확인. DB 변경·commit/push/배포 제외.

## 결과

- selected가 없으면 상세 section 자체를 렌더링하지 않는다. placeholder 제거, 미선택 목록 전체 너비 적용.
- 0건일 때 목록 제목·빈 ul·페이지 nav를 생성하지 않아 min-height 여백도 사라진다. 안내 문구만32px 세로 padding으로 표시.
- 결과가 있으면 `조회 결과` 제목을 표시하고 중복된 상단 페이지 수는 제거. 하단 페이지 이동은2페이지 이상일 때만 표시.
- 기존 브라우저 기대를 새 화면 계약에 맞게 변경: 1페이지/빈 결과 nav 없음, 상세 DOM 없음, 빈 카드 높이160px 미만·목록 전체 너비 검증. 다중 페이지 이동·조회 실패·저장 후 페이지 축소·응답 손실 복구 검증은 유지.
- Web build/typecheck, tests tsc, 대상 Vue/테스트 ESLint, git diff --check 통과. Chromium20 tests(batch-review15/navigation4/expiry1) 모두 통과, 실패·skip0.
- 390/1280px 빈 결과 스크린샷을 생성하고 직접 확인: `.local-data/admin-ux-rework/screenshots/batch-empty-{390,1280}.png`.
- 로그 `/tmp/blariyo-batch-empty-*`. 로컬 서버를 새 출력으로 재시작(세션89413), Core ready=READY, 관리자 URL은 로그인 redirect 후200 확인.
- 기존 데이터 변경·commit/push·운영 배포 없음. 이전 작업의 웃대 기존 데이터 정정 잔여는 그대로 유지.
