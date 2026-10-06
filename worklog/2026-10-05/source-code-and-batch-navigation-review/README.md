# 공통 코드 개념과 검수 목록 버튼 검토

- 요청: 출처 공통 코드 개념이 맞는지, `/admin/batch`의 목록으로 버튼 존재 이유 확인.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`, 기준 HEAD `12df6aed`
- 상태: 종료(검토·기록 완료, 구현 수정 없음) / 갱신: 2026-10-05 KST
- 범위: 현행 migration·공유 조회·화면 설계·버튼 DOM/CSS/동작 대조. 앞선 source-common-codes 종료 확인. 기존 미커밋 변경 보존.

## 결과

- 개념 구분: 현재 `content.source_code`는 출처 코드/표시명을 공유하는 전용 기준정보다. 그룹 테이블·그룹별 상세 코드·통합 관리 UI는 없다. 출처를 여러 화면에서 공통 사용한다는 요구는 충족하지만 범용 그룹/상세 공통 코드 관리로 설명하면 범위를 과장한다. 사용자가 의도한 범용 관리 여부를 단정하지 않으며, 이를 원하면 출처를 SOURCE 그룹으로 편입하는 구조가 맞다. 임의 코드 등록이 서버 업무 상태나 Collector 지원을 만드는 것으로 취급하면 안 된다.
- Medium: `admin.css:493`은 `.batch-detail .batch-mobile-back`을 숨기지만 실제 버튼은 `admin-batch.vue:453`의 `.batch-detail-panel` 직계 자식이다. 선택자가 매칭되지 않아 PC에서도 버튼 노출. Chrome1512px에서 display:inline-block/visible:true/selector match:false 확인. 항목을 선택하지 않은 안내 상태에서도 나타난다.
- `admin-batch.vue:295`의 backToList는 mobileDetail=false 후 기존 목록 항목으로 포커스를 돌린다. 페이지 이동이나 게시글 목록 복귀가 아니다. PC에서는 상세/목록이 이미 함께 보이므로 불필요하고, 미선택 상태에서는 돌아갈 대상도 없다.
- 설계 `docs/planning/03-screen-design.md:77`: PC 목록/상세 나란히, 모바일 상세→목록 복귀 시 검색·페이지·선택 보존. 최소 수정은 기본 숨김 선택자를 실제 DOM과 맞추고, 모바일 상세가 열린 때만 노출하는 것. 현재 모바일은 목록 아래 상세가 펼쳐져 완전한 화면 전환과도 차이가 있다.
- 검증: 소스/설계 대조 및 실제 로컬 Chrome DOM·계산 스타일 확인. 수집/검수/등록/수정 요청 없음. 이번 요청은 설명·검토로 처리해 제품 파일·DB·서버를 수정하지 않았다. 테스트 신규 실행 없음.
