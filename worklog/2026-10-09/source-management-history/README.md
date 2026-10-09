# 수집처 필터·수집 이력·선택 목록

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 23:09 KST.
- 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / HEAD: `abf21ea`.
- 요청: OS 기본 선택 메뉴 개선, 필터, 수집처별 마지막 수집 시각·실패 사유.
- 담당 경로: SourcePublishPolicies.vue 및 선택 컴포넌트, 정책 조회 repository/interface, 해당 OpenAPI와 생성 계약, 화면/기술/개발 명세, 관련 API·브라우저 테스트, 이 기록.
- 기준: WRITE_DB 최근 실행과 FETCHED 시각을 구분. 최근 실행 오류 코드만 반환, 오류 detail·URL 원문 제외. 필터는 로컬 목록에 적용하며 미저장 편집을 유지.
- 검증 예정: API/Web build/type/lint, 계약·API 통합, 브라우저 키보드/필터/저장/이력/반응형 및 실제 로컬 readback. 기존 변경·사용자가 삭제한 안내 유지, 예약/운영/발행 설정 변경 없음.

## 변경 결과

- SourceSettingSelect.vue는 버튼/combobox와 body에 표시하는 listbox를 사용한다. 청록 선택 강조·체크 표시, 방향키/Home/End/Enter/Space/Escape/Tab, 바깥 클릭 닫기, 제한 옵션·비활성 상태를 지원한다. 메뉴는 창 안으로 위치를 조절하며 스크롤·창 크기 변경 시 입력 위치를 따라간다.
- 목록에 이름·URL 검색, 수집 여부, 자동 발행, 최근 오류/오류 없음/이력 없음 필터와 초기화를 추가했다. 필터 기준은 저장값이며 미저장 편집은 보존한다.
- API는 마지막 FETCHED 시각, 최신 WRITE_DB 실행 시각/상태와 해당 실행의 오류 코드만 읽는다. dry-run·이전 실행의 오류·오류 detail·형식이 맞지 않는 reason/code를 제외한다. 미기록/이력 없음은 별도로 표시한다. 새 SQL migration이나 권한 추가 없음.
- planning·system-design·개발 명세·OpenAPI 두 복사본과 생성 계약을 동기화했다. 승인된 응답 필드 추가를 contract-evolution.json에 이유와 새 checksum으로 기록했다. 기존 SQL checksum은 유지한다.

## 검증

- API build/build:test/lint 통과. API 정책 통합 14개 통과(상위 1 + 하위 13), 실패·skip0. 최신 실패/정상 실행, 성공 시각과 시도 시각 구분, dry-run 제외, 중복/안전 코드 필터, 이력 없음, 기존 감사·권한·자동 발행 포함.
- Web build/typecheck/lint, tests typecheck/lint 통과. 계약·migration 불변 검사 1개 통과.
- 브라우저 6개 통과, 실패·skip0. 기존 5개와 신규 키보드/필터/이력/제한 옵션/바깥 클릭/Tab/미저장 보존 포함. 1280/390/320px 전체 페이지 넘침 없음.
- 초기 검증에서 API unsafe assertion lint, 계약 checksum 동기화 누락, 메뉴 열기 후 지연 스크롤로 닫힘을 발견하고 각각 상태값 명시 검사, 승인된 계약 변경 이유/checksum 기록, 메뉴 위치 재계산으로 수정했다. 제한 옵션 테스트의 클릭은 disabled guard가 실제 변경을 거부하는지 확인하기 위해 강제 이벤트를 사용하며 허용 assertion은 유지했다.
- [선택 메뉴](custom-options.png), [데스크톱 이력](admin-sources-history.png), [모바일 이력](admin-sources-history-mobile.png)을 시각 확인했다. 이 화면은 격리 테스트 데이터이며 실제 로컬 이력은 아래 readback으로 구분한다. 과거 작업 캡처는 보존했다.
- 실제 제한 API 역할로 [로컬 readback](local-readback.json): 등록21개, 실제 실행 이력17개, 정상 수집 시각16개, 최근 실행 오류 코드7개. 조회8ms. 발행 설정0·수집 변경 이력0 유지.
- 로컬 API96357/Web96452, readiness READY. 실제 Chrome에서 21개 목록과 정상/부분 실패/차단 이력, 사용자 제거 문구 유지, 커스텀 선택 메뉴 확인. `오류 있음` 필터7/21개와 초기화21/21개를 확인했다. 선택값 저장·배치 실행 없이 확인했다.
- git diff --check 통과. feature/discord-review 및 HEAD abf21ea 유지, 범위 밖 기존 변경 보존. 운영 반영/commit/push 없음. 이번 입력에서 종합 quality 전체 검증은 수행하지 않았으며 과거 receipt를 재사용하지 않는다.
