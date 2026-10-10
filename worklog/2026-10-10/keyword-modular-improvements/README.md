# 키워드 관리 오류 개선과 모듈화

- 요청: 재검토에서 확인한 문제 정정·개선, 가능한 범위의 모듈화.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 21:10 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, HEAD `6990dea`. 직전 keyword-ux-review 담당 종료 확인. 기존 사용자/다른 작업 변경 보존.
- 담당 경로: 키워드 page·전용 composable/shared/component/style, 키워드 브라우저 검사, 관련 planning/system-design/spec/status/roadmap/코드 구조, 이 기록. API·DB·Collector 변경 없음.
- 기준: [직전 검토](../keyword-ux-review/README.md)의 E01/E02/D01/C01. 중복/입력 오류의 행 편집 보존, 미저장 이탈 방어와 저장 중 이동 차단, 선택 행만 일괄 삭제, 문서 모순 정정.
- 모듈 경계: 화면 배치, 편집/저장과 오류 복구, 필터/페이지/선택/일괄 대상, 미저장 변경 이탈 방어, 폼/목록/일괄/삭제 확인 표현을 구분한다. API 계약/버전/transaction/권한은 유지한다.
- 검증 순서: 회귀 테스트로 기존 오류 확인 → 정본/소스 개선 → 최종 동일 조건 브라우저/빌드/타입/lint/unit/구조 검사 → 로컬3000 반영·실제 설정값 보존 확인. 커밋/운영 배포/배치 활성화 없음.

## 변경

- E01: 행/일괄이 useKeywordEditor의 한 mutate/오류 복구 분기를 사용한다. 중복/입력 거부/한도 오류는 초안 유지, 충돌/응답 불확실은 대상 최신값 재조회, 재조회 실패 중 쓰기 금지. 성공 재조회 시 이전 오류 안내를 제거한다.
- E02: useUnsavedChanges에서 메뉴 이동 경고·새로고침 방어·저장 중 이탈 차단. 행 전체(숨긴 행 포함)/새 키워드 폼/실제 변경될 일괄 방식의 dirty 상태를 합산한다. 필터/페이지 이동은 행 초안을 유지한다.
- D01: 저장의 필터 기본 대상은 유지하고 삭제는 선택 행만. 선택 없음이면 `선택한 0개 삭제` 비활성, 선택한 건수 버튼에 표시. 모바일에서 표 머리가 숨겨져도 도구 모음의 현재 페이지 체크로 선택/해제 가능하다. 행별 삭제는 해당 ID의 확인 단계를 유지한다.
- C01: 삭제 허용과 사용 중지의 정본 문구 모순을 정정하고 화면·기술·개발 명세/현황을 동기화했다.
- 추가 재조회 회귀: 기존 install은 미수정 행도 옛 초안을 유지해 다른 관리자 변경이 화면에 반영되지 않았다. 실제 dirty 행만 보존하고 미수정 행은 최신 snapshot으로 갱신한다.
- 최종 요청값이 원래 값과 같아지는 일괄 덮어쓰기는 변경 건수/SAVE 대상에서 제외한다.

## 모듈

| 경로(모두 apps/web/app 아래) | 역할 |
| --- | --- |
| pages/admin-keywords.vue | 페이지/기능 flag·상태/컴포넌트 조립, dirty 합산과 사용자 이벤트 연결 |
| composables/useKeywordEditor.ts | API 조회/생성/행·일괄 쓰기/초안/공통 오류 복구 |
| composables/useKeywordSelection.ts | 검색/분류/사용 필터·페이지·선택·일괄 저장 대상·선택 삭제 확인 ID |
| composables/useUnsavedChanges.ts | 메뉴/새로고침 이탈 방어와 이벤트 해제 |
| utils/keyword-editor.ts | 계약 타입/옵션/초안 비교·실제 요청값 계산/오류 분류(HTTP/반응형 상태 없음) |
| components/KeywordEditorForm.vue, KeywordEditorTable.vue | 추가 폼·행 편집/선택·사용자 이벤트(HTTP 없음) |
| components/KeywordBulkActions.vue, KeywordDeleteConfirmation.vue | 일괄 도구 모음·현재 페이지 선택·삭제 확인/포커스(HTTP 없음) |
| assets/css/keyword-editor.css | 키워드 화면 전용 스타일, 전역 label/input 규칙은 keyword-management 하위로 제한 |

- API/DB/Collector와 다른 관리 화면 source는 이번 작업에서 변경하지 않았다. 기존 기술 계층·계약·버전/권한/transaction 유지.

## 검증 진행

- [수정 전](before-browser.log): 기존 빌드에서 새 회귀 3/3 실패(입력 유실/이탈 경고 없음/삭제 버튼 활성). [추가 재조회 재현](before-reload-confirmed.log) 1/1 실패(미수정 출근 사용 여부가 최신 값과 다름).
- [최종 브라우저](browser-ready.log): 9/9 통과, fail/cancelled/skipped/todo=0. 기존 관리/OWNER·EDITOR/충돌/삭제, 행·일괄 중복409·제어문자400의 초안·DB 보존, 일괄 실제 변경값 판정, 이동/새로고침 취소·폐기 확인, 저장 중 이탈 차단, 응답 유실+재조회503 후 복구, 미수정 최신값/수정 행 초안 보존, 모바일 선택 해제를 검증했다. 1280/1024/900/390/320 가로 넘침0, [데스크톱](bulk-desktop.png)/[모바일](bulk-mobile.png) 직접 시각 확인.
- 검사 보완 근거: 최초 새 검사의 즉시 로그인 뒤 API read가 인증 완료 전에 실행돼 데이터 envelope가 없었고, 이후 요청별 requestId까지 비교하는 문제가 있었다. 실제 규칙 data/버전을 비교하도록 수정했다. 새로고침 취소는 드라이버 ERR_ABORTED 또는 commit 대기 timeout이므로 경고 발생/commit 없음/입력 유지로 판정한다. 재진입/새로고침 후 SSR markup에 입력하던 경합은 기존 Core 검사와 같은 Vue 준비 신호 및 새 검색 상태 확인으로 해결했다. 값/DB/경고 기대값은 완화하지 않았다.
- before-reload.log는 추가 검사가 잘못 중첩되어 이름 필터에 매칭되지 않은 실행이며 재현 증거로 사용하지 않는다. 독립 테스트로 이동한 before-reload-confirmed.log만 근거로 사용한다.
- 중간 quality-final.log는 build 실패로 전체 통과가 아니며 이후 browser-verified.log는 fixture 기동 실패9건이다. 원시 빌드 출력은 harness가 hash만 보관하므로 당시 원인 미확정. 이후 독립 Web/루트 build가 통과했고, 최종 품질은 quality-confirmed.log/새 receipt로 확인한다. 중간 receipt는 최종 변경의 근거로 재사용하지 않는다.
- 정본7개 상대 링크 누락0, git diff --check 통과.

## 최종 결과

- [최종 품질 로그](quality-confirmed.log): quality profile 14/14 통과(계약·CI·빌드·API 테스트 빌드·타입·lint·unit), unit 88/88, CI 16/16 통과.
- [최종 receipt](verification/2026-10-10T12-06-27.296Z-quality-4214.json): 최종 입력에서 검증, receipt 재검사 `valid: true`, `problems: []`. 중간 실행 결과와 구분한다.
- 개발 LaunchAgent `com.blariyo.discord-review.development`를 새 빌드로 재시작했다. API `/internal/health/ready` 응답 READY. [실제 localhost:3000 화면](localhost-modular.png) 직접 확인: 선택 0개 삭제 비활성 → 정치 1개 선택 시 선택한 1개 삭제 활성 → 해제 시 다시 0개 비활성. 저장/삭제 실행 없음, 초안/선택 없는 상태로 화면을 열어 두었다.
- 로컬 DB readback: `life-humor-v1`, 키워드 125개, revision 1개. 기존 설정값 유지. 운영 DB 접근/변경 없음.
- 브라우저 회귀의 생성·수정·삭제는 전용 임시 PostgreSQL container `blariyo-keyword-modular-pg-20261010`의 격리 fixture DB에서만 수행했다. 검증 후 해당 임시 container 제거, 기존 로컬 PostgreSQL 유지.
- 범위 밖 기존 변경 보존, 커밋/push/운영 배포/수집·발행 배치 활성화 없음. 잔여 작업은 요청 시 Git 반영·운영 적용과 별도 운영 수용 확인이다.
