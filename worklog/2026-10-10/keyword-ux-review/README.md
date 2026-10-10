# 키워드 일괄 관리 재검토

- 요청: 사용성 개선 후 구현이 적절한지 재검토. 검토만 수행.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 20:48 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치 `feature/discord-review`, HEAD `6990dea`. 직전 keyword-bulk-ux 담당 종료 확인.
- 담당 변경 경로: 이 작업 기록만. 기존 source/test/docs/config와 사용자 변경 보존. 실제 개발/운영 DB 설정 변경 없음.
- 범위: 키워드 화면·선택/일괄 대상·행/일괄 저장 오류/삭제/이탈·API transaction/권한·기존 검사 탐지 범위. 현행 planning/system-design/spec과 실제 코드를 대조한다.
- 검증 계획: 기존 최종 receipt 입력 유효성 확인, 격리된 임시 DB/브라우저 fixture로 오류 후 입력 보존과 이탈·선택 범위 재현. 전체 품질 검사를 중복 실행하거나 운영에 적용하지 않는다.

## 판정

기본 API 구조와 정상 저장 흐름은 적절하지만, 사용자 입력 보존 2건과 대상 전환 설계 1건을 보완하기 전에는 사용성이 충분하다고 판정하지 않는다.

| ID | 중요도/유형/신뢰도 | 조건·문제 | 근거 | 권장 조치 |
| --- | --- | --- | --- | --- |
| E01 | P2 / 오류 / 높음(재현) | 출근을 기존 퇴근으로 바꾸고 행 저장 → 중복409, DB 변경 없음에도 입력이 출근으로 돌아감. 같은 일괄 저장은 퇴근 입력 보존 | admin-keywords.vue:75~80의 무조건 resetIds, bulk:107의 오류별 분기. reproduction.json/failedRow, failedBulk | 중복/입력검증 실패 시 행 초안 보존, 충돌/응답 불확실 재조회와 구분. 행/일괄의 같은 오류를 같은 방식으로 검사 |
| E02 | P2 / 오류 / 높음(재현) | 출근미저장검토 입력 후 게시글 관리 이동/복귀 → 경고0·출근으로 복원, 편집 유실 | admin-keywords.vue:27~40의 컴포넌트 내부 초안과 파일 내 이탈 방어 부재. admin.vue:491~513은 기존 이탈 방어 사용. reproduction.json/navigation | 미저장 행/새 키워드/일괄 입력의 변경 상태를 합산, 메뉴 이동 경고와 새로고침 방어, 저장 중 이탈 차단. 필터/페이지 이동은 기존 보존 유지 |
| D01 | P2 / 설계 / 높음(대상 전환 재현, 혼동은 판단) | 마지막 체크 해제 시 대상1개→전체125개, 동일 일괄 삭제 버튼의 범위가 확대됨. 125개 삭제 확인이 있어 즉시 삭제되는 결함은 아님 | admin-keywords.vue:38~40, 139~153. reproduction.json/scope. 현행 planning 명시 기준에 부합 | 저장의 필터 기본값은 유지 가능. 삭제는 명시 선택 대상으로 제한하거나 버튼에 검색결과/선택/전체 대상과 개수를 직접 표시. 체크 해제를 0개라는 일반 기대와 맞춤 |

- 보조 C01/P3: docs/planning/content-collection/README.md:6~7은 삭제를 허용하지만 :8에는 `삭제 대신 사용 중지한다`가 남아 서로 모순된다. 실제 사용자 요청/구현에 맞춰 후속 문서 정렬 필요. 이번 검토에서는 수정하지 않음.

## 적절한 부분과 검사 공백

- API는 Controller 계약 검사 → Service 입력 정규화/transaction → Repository head FOR UPDATE/버전 비교/전체 중복 검사/불변 snapshot 저장으로 분리돼 있다. OWNER 변경/EDITOR 조회가 명시 권한 목록으로 제한된다. 이번에는 관련 원문·테스트 코드를 대조했으며 전체 API 회귀를 다시 실행한 것은 아니다.
- 입력 오류 재현 중 행/일괄 모두 실제 DB값·버전이 유지됐다. 일괄 입력 보존과 삭제 확인/취소도 직접 확인했다.
- 기존 tests/browser/keyword-management.test.ts는 정상 저장·버전 충돌·비대상 초안 보존·필터/선택 범위·삭제·권한·가로 넘침을 검사한다. 행 저장 중복/검증 실패의 입력 보존과 미저장 메뉴 이탈은 검사하지 않아 기존 통과로 이번 문제를 배제할 수 없다.
- 기존 quality receipt를 현재 입력에서 재검증: valid=true/problems=[]. 이는 빌드/타입/lint/unit 검사의 입력 유효성 증거이며 사용자 동작이 적절하다는 증거와 구분한다.

## 실행 증거와 변경 경계

- [재현 스크립트](reproduce.test.ts), [실행 로그](reproduction.log), [구조화 결과](reproduction.json). 1개 시나리오에서 두 입력 유실과 대상 확대를 확인했다. 테스트 성공은 문제 재현의 성공이며 수정 완료/정상 동작을 뜻하지 않는다.
- [행 실패 화면](row-error.png), [선택 해제 후 삭제 범위](selection-clear.png).
- source/test/관련 정본 6개 [시작 hash](baseline.sha256) 재대조 전부 OK. 앱·검사·정본 변경 없음. 변경은 이 작업 기록/재현 파일/산출물만.
- 전용 tmpfs PostgreSQL 컨테이너 `blariyo-keyword-review-pg-20261010`, loopback55449, 무작위 fixture DB 사용. 종료 후 전용 컨테이너만 제거. 실제 개발 DB readback life-humor-v1/125개/revision1 유지.
- 운영·배치 실행·commit/push/deploy 미수행. 수정은 다음 변경 요청 범위로 남김.
