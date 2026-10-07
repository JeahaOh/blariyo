# 검수 원본 링크와 조회 시 상세 해제

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 기준 HEAD: `b932366`
- 상태: 종료 / 갱신: 2026-10-06 20:54 KST
- 요청: 검수 화면에서 원본을 열고, 필터 조회 시 상세를 표시하지 않는다.
- 범위: `apps/web/app/pages/admin-batch.vue`, `apps/web/app/assets/css/admin.css`, `tests/browser/batch-review.test.ts`의 링크 표시명, `docs/planning/03-screen-design.md`, 이 기록.
- 담당 경계: 기존 sticky 변경을 이어 수정한다. 품질 도입 세션의 파일·공유 빌드·Git 작업은 보존한다. 개인 실행 사본에서 Web을 빌드한다.
- 최초 확인: 실제 요청 항목에서 원문 링크는 제목 아래 존재했다. 출처를 고급유머로 바꿔 조회하자 상세0개·주소 `/admin/batch`로 정상 해제됐다. 이 조건에서는 사용자가 보고한 상세 잔류를 재현하지 못했다.
- 계획: 원본 링크를 고정 버튼 행으로 이동해 발견/접근성을 개선한다. 출처·수집 상태·검수 상태·빈 결과·새로고침에서도 상세 미표시를 실제 확인한다. 승인/반려/삭제/발행은 하지 않는다.

## 변경·검증 결과

- 제목 아래 `원문 확인` 텍스트 링크를 고정 버튼 행 왼쪽 `원본 열기 ↗`로 이동했다. `target=_blank`, `rel=noopener noreferrer`를 유지했다. 380px 이하에서는 원본 버튼을 별도 행 전체 너비로 두어 반려/승인을 같은 행에 유지한다.
- 기존 browser regression의 링크 표시명 기대값을 새 UI 명칭으로 동기화했다. 해당 자동 browser 전체 검사는 이번에 실행하지 않았다.
- 개인 실행 사본에서 Web 빌드 PASS, 변경 Vue ESLint PASS, `git diff --check` PASS. localhost:3000에 최종 빌드 반영. 공유 빌드와 품질 도입 세션 파일은 수정하지 않았다.
- Chrome에서 실제 요청 항목의 원본 버튼을 눌러 `https://www.goodgag.net/372267` 새 탭이 열리고, 검수 탭의 itemId/상세가 유지되는 것을 확인했다. 발행 완료 상태에서도 링크 사용 가능.
- 1512px 데스크톱에서 스크롤 중 원본/처리 버튼 고정 확인. 최종 320px에서는 barTop=0, 반려·승인 모두 top=62/height=44px, 가로 넘침 없음. 임시 viewport 원복.
- 출처 고급유머 조회(10건), 수집 실패 조회(0건), 승인 상세를 연 뒤 검수 전 조회, 조회 후 새로고침에서 상세 패널0개·itemId 없는 `/admin/batch`를 확인했다. 현재 실행 버전에서는 상세 잔류를 재현하지 못해 조회 로직은 변경하지 않았다. 조회 실패·지연 응답의 추가 장애 주입은 미실행이다.
- 승인/반려/삭제/발행·DB 쓰기·커밋/푸시·운영 배포는 하지 않았다. 원본 탭은 검증 후 닫았다.
