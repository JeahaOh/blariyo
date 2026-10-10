# 키워드 관리 화면 시각·사용성 재검토

- 요청: “UI가 이게 맞나...” — 현재 개발 화면 재검토.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 21:20 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`. 직전 keyword-modular-improvements 담당 종료 확인. 기존 변경 보존.
- 범위: 실제 localhost:3000/admin/keywords 화면·관련 planning·Web source 읽기, 이 기록만 작성. 앱/DB/계약/테스트 수정 없음.
- 근거: 화면 1367×806, table top 463.8px, 첫 행 높이91px, 완전히 보이는 데이터 행2개. 현재 페이지25개에 combobox100개, table input51개. 화면 직접 시각 확인 및 DOM 치수 읽기.
- D01 / 중간 / 높은 신뢰도: 목록 전 상단 공간이 과도하다. 추가 accordion·필터·건수·일괄 작업이 별도 블록으로 쌓여 실제 목록을 밀어낸다. `apps/web/app/pages/admin-keywords.vue:90-134`, `apps/web/app/assets/css/keyword-editor.css:19-42,61-64,128-139`. 추천: 추가 버튼은 제목 옆, 필터·건수·일괄 도구 모음은 목록과 연결한 컴팩트 영역. 추가 폼은 요청 시 펼치되 기존 입력 보존 유지.
- D02 / 중간 / 높은 신뢰도: 모든 행에 큰 입력/4개 select/저장·삭제를 상시 표시해 내용을 훑기 어렵다. `apps/web/app/components/KeywordEditorTable.vue:53-111`, `apps/web/app/assets/css/keyword-editor.css:49-59,104-112`. 사용자 요구인 행 select는 유지하고 목록용 크기/간격으로 축소, 데스크톱 행 높이48~56px·첫 화면8~10행을 설계 목표로 삼는다. 목표는 아직 구현/검증하지 않았다.
- A01 / 중간 / 높은 신뢰도: 상단의125개/전체125개가 반복되며 저장은 필터 전체/선택, 삭제는 선택만이어서 대상 인지가 필요하다. `apps/web/app/pages/admin-keywords.vue:115-124`, `apps/web/app/components/KeywordBulkActions.vue:18-58`. 추천: 목록 건수 한 곳, 저장 대상/변경 수/삭제 선택 수를 해당 동작과 붙인다. API/선택 삭제 정책을 임의로 바꾸지 않는다.
- 결론: 직전 회귀/품질 통과는 동작/입력 보존/계약 증거이며 시각 완성도나 사용성 증거로 확대할 수 없다. UI는 개선 필요. 추천은 현행 행 편집 요구를 유지하는 밀도 높은 목록이며 별도 화면/신규 기능 확대는 필요하지 않다.
- 검증: 실제 화면/소스/정본 대조만 수행. 이번 턴 빌드·테스트 실행 없음. Git 변경은 이 기록뿐, 커밋/push/배포 없음.
