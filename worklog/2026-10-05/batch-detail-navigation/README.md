# 수집 항목 URL 동기화와 목록으로 버튼 제거

- 요청: 선택 수집 항목 ID를 주소에 표시하고 목록으로 버튼 제거.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD·release 기준: `12df6aed`
- 상태: 종료(구현·검증·로컬 반영 완료) / 갱신: 2026-10-05 20:11 KST
- 앞선 global-loading-bar 종료 확인. 기존 dirty 변경 보존.
- 범위: admin-batch.vue·관련 CSS, 화면/API 설계, 브라우저 URL/새로고침/뒤로·앞으로/직접 링크/잠금 검증. URL은 기존 UUID itemId 계약 사용.
- commit/push/운영 배포 없음.

## 구현

- 목록 선택을 기존 UUID `itemId` query로 history에 추가. 같은 항목 클릭은 history를 추가하지 않고 상세만 재조회.
- query 변경을 감시해 새로고침·직접 진입·뒤로/앞으로 이동 시 상세를 동기화. 읽기 시작 시 이전 상세를 비워 주소와 다른 내용을 표시하지 않음.
- itemId 없는 주소는 선택 해제, 잘못된 ID 형식은 안내 후 상세 미표시. sessionStorage는 필터·페이지만 저장하며 과거 selectedItemId는 무시.
- 목록 복귀 시 이전 항목 또는 목록 영역에 포커스 복원. 직접 수집 요청의 request query는 보존.
- 조회/저장 및 불확실 결과 확인 중에는 같은 화면 itemId 변경도 차단. 기존 외부 이동·새로고침 경고와 멱등 요청 복구 유지.
- PC/모바일의 목록으로 버튼, mobileDetail 전환 변수·backToList 함수, 전용 CSS 제거. 다른 게시글 관리 화면의 목록 버튼은 이번 대상 아님.
- 정본: 화면 기획 및 API 설계의 Web URL 계약 반영. API/DB 변경 없음.

## 검증

- 신규 모바일390/PC1280/새 로그인 직접 링크 브라우저4 tests 통과.
- Web build·Web/tests 타입·변경 Vue/tests lint 통과, diff check 통과.
- 기존 batch 응답 손실 복구 테스트의 이동 차단 기대 주소를 `/admin/batch`에서 선택 항목의 `?itemId=...`로 갱신. 검증 의미(동일 선택 유지·페이지 이탈 차단)는 유지한다. 최초 실패 이후 같은 브라우저의 인증 상태가 미복구되어 후속 검사가 연쇄 실패했으므로 새 격리 환경에서 전체 재실행해 통과했다.
- 최신 빌드로 소유 로컬 서버 재시작. Web3000/Core3100, workers=false, readiness READY 및 batch→로그인200 확인.

- 최종 브라우저24 tests 전부 PASS: 신규 URL/history4, batch 검수·인증/불확실 응답 복구12, 만료1, URL 직접 수집1, 공통 로딩6. 실패/skip0.
- 로그: `/tmp/blariyo-batch-navigation-final.log`, `/tmp/blariyo-batch-navigation-build.log`, `/tmp/blariyo-batch-navigation-types.log`, `/tmp/blariyo-batch-navigation-test-types.log`, `/tmp/blariyo-batch-navigation-lint.log`, `/tmp/blariyo-batch-navigation-test-lint.log`.
- 원문·게시글·검수 데이터를 사용자 DB에서 수정하지 않았다. 격리 테스트 데이터만 생성·정리했다. commit/push/운영 배포 미실행.
