# 신고·운영 검토·참여 제한 기능 명세

- 문서 상태: `작성 완료` — API·처리 흐름·화면 계약; 아래 운영 활성화 절은 `차단`
- 기준일: 2026-09-08
- 실행 증거: source·migration·OpenAPI 생성·test·build·브라우저·production 모두 이 문서 작업에서 미검증
- 입력: [제품 계약](../../../planning/08-member-community-plan.md), [화면 설계](../../../planning/03-screen-design.md), [법무 gate](../../../legal/README.md)
- 공통 타입·요청/응답·오류·권한: [기술 API 정본](../../../system-design/06-member-community-design.md#api)
- 저장·제약·잠금: [데이터 정본](../../../system-design/06-member-community-design.md#data)

이 기능은 아직 전용 machine-readable OpenAPI가 없으므로 요청·응답 필드는 위 기술 정본 표를
사용한다. 아래는 업무 제약과 구현 순서를 보충한다. M0 Core YAML을 이 기능의 전체 계약으로 해석하지 않는다.

## 1. 범위·행위자

- milestone: M1.5. 회원 신고, 외부 관리자 인증 운영자의 검토·숨김·복원·삭제·참여 제한.
- 권리자 이메일은 기존 법적 접수 경로를 유지한다. 신고 첨부·자동 신고 임계 제재·AI 판정은 없다.
- 일반 회원 session으로 운영 화면·API에 접근할 수 없다.

## 2. 요구사항 추적

| 요구 | API | 흐름 | 화면 |
| --- | --- | --- | --- |
| 중복 없는 신고 | POST reports, GET me/reports | [신고](#d01-report) | [신고 modal](#d08-report) |
| 검토·숨김·삭제 | admin moderation reports/resolve/actions | [검토](#d01-review) | [검토](#d08-review) |
| 참여 제한·해제 | admin members restriction | [제재](#d01-restrict) | [제재](#d08-restrict) |

<a id="api-moderation"></a>
## 3. API 업무 계약

기술 정본 신고·운영 표를 사용한다. 신고 입력은 postId·선택 commentId·reasonCode·detail이며
Core가 실제 대상 소속·공개·신고자와 작성자의 차이를 확인한다. reporter ID를 입력으로 받지 않는다.

- 같은 신고자·대상 unique로 재시도를 흡수한다. key만 바꿔도 새 신고와 새 rate 사용량을 만들지 않는다.
- 운영자 resolve는 report version과 target version 모두 검사한다. 둘 중 하나라도 다르면 rollback이다.
- HIDE/REMOVE와 신고 종결·action 이력을 함께 commit한다. NONE은 콘텐츠를 바꾸지 않는다.
- 직접 hide/restore/remove는 reportId 없이도 가능하며 권리 이메일 우선 숨김에 사용한다.
- 대상 이미 삭제됨은 STATE_CONFLICT; 운영자는 새로 조회 후 NONE으로 사건 종결할 수 있다.
- 제재 API는 관리 화면 전용 memberRef를 받아 내부 account를 찾는다. auth·권한을 대신하지 않는다.
- 잠금 순서·최소 receipt·상태·보존은 데이터 정본을 따른다. 신고 detail을 외부 log에 복제하지 않는다.
- detail·publicReason·internalNote는 [공통 문자열 계약](../../../system-design/06-member-community-design.md#api)의
  원문 Unicode scalar·U+0000 검사→줄바꿈 통일 또는 거부→C0·C1 검사→NFC 정규화→ECMAScript trim→
  code point 제한 순서를 적용한다. detail/internalNote의 CRLF·CR·U+2028·U+2029는 LF로 통일하고
  publicReason의 CR·LF·U+2028·U+2029는 거부한다.

<a id="d01-report"></a>
## 4. 신고 접수

1. 사용자 session·동의·제재 확인 후 공개 글 또는 해당 글의 공개 댓글인지 검증한다.
2. 본인 신고는 입력 오류로 거부하고 본인 삭제를 안내한다.
3. reason enum, OTHER 설명 필수, 설명 길이와 rate를 확인한다.
4. unique 기존 사건이 있으면 기존 결과를 반환하고, 없으면 OPEN+receipt를 atomic 저장한다.
5. 신고자에게 접수 상태만 반환한다. 운영 조치 없이 콘텐츠를 숨기지 않는다.

<a id="d01-review"></a>
## 5. 운영자 검토

1. 외부 관리자 인증 후 OPEN 목록과 사건 상세를 읽는다. 신고가 없으면 관리자 글 상세·댓글 목록/상세 조회를 사용한다. 대상 현재 version과 targetMemberRef를 함께 확인한다.
2. 무조치·숨김·삭제와 공개 사유·선택 내부 메모를 입력한다.
3. Core가 actor 검증, 대상 계정→post→comment/report 순 잠금, version 검사를 수행한다.
4. 콘텐츠 전이와 사건 RESOLVED·action을 commit한다. 삭제 원문을 action snapshot으로 보존하지 않는다.
5. 복원은 HIDDEN_REVIEW만 별도 actions RESTORE로 처리한다. 본인 삭제·REMOVED는 복원하지 않는다.
6. 공개 재조회로 숨김 글 404 또는 댓글 자리 표시를 확인한다. 운영자 조치 성공과 공개 검증 결과는 별도로 기록한다.

권리 이메일을 확인한 경우 report를 인위적으로 만들지 않고 직접 HIDE를 호출한다. 법적 접수·회신은
기존 권리 안내를 따른다. 숨김·삭제 전후 본문 사본을 메일·log·신고 detail로 자동 복사하지 않는다.

<a id="d01-restrict"></a>
## 6. 참여 제한

1. 신고 상세 또는 관리자 글/댓글 상세의 targetMemberRef로 현 제한 상태를 조회한다. 탈퇴한 회원은 제재 대상이 없다.
2. 공개 사유와 1/7/30일 또는 무기한을 입력하고 version을 전송한다.
3. account lock 아래 restriction 갱신·action insert를 함께 수행한다. 진행 중인 회원 쓰기와 직렬화된다.
4. 회원의 다음 글·댓글·신고 요청부터 `status=ACTIVE AND startsAt<=now AND (endsAt IS NULL OR endsAt>now)`인
   제재만 적용한다. 공개 읽기·계정 확인·본인 삭제·탈퇴는 유지한다.
5. 만료는 요청 시각과 endsAt 비교로 즉시 적용하며 cron 지연을 이유로 제한을 연장하지 않는다.
6. 수동 해제는 REVOKED와 action을 저장하고 즉시 참여를 허용한다. 기간 변경도 version을 올리며 이전 이력을 덮어쓰지 않는다.

<a id="d08-report"></a>
## 7. 신고 modal

- 상세 글·댓글의 신고→사유 선택·설명. label과 NFC 정규화·trim 후 Unicode code point 기준 최대 글자 수,
  첨부 미지원 안내를 제공한다.
- 제출 중 중복 버튼 비활성, 성공/이미 접수됨 aria-live, 401 로그인, 429 재시도 시간, 404 대상 소멸 안내.
- 닫기는 API 해당 없음이며 접수된 서버 신고를 취소하지 않는다. Escape·focus 복귀를 지원한다.
- 내 신고는 `/account/activity` 신고 탭에서 접수/종결만 보여준다. 내부 메모·신고자·제재 대상 식별자는 없다.

<a id="d08-review"></a>
## 8. 운영 검토 화면

- route `/admin/moderation`, `/admin/moderation/reports/:reportId`, `/admin/moderation/posts/:postId`, `/admin/moderation/posts/:postId/comments/:commentId`.
- 목록 상태 필터·20개 페이지, 상세 target 본문·사유·조치 이력. 없으면 빈 대기열, 403은 관리자 재인증 안내.
- 무조치·숨김·삭제는 공개 사유 입력 후 실행. 삭제는 복원 불가 확인창을 제공한다.
- 409는 사용자 메모를 유지하고 최신 대상 상태를 다시 확인한다. 503이면 성공한 것처럼 목록에서 제거하지 않는다.
- 숨김 복원은 독립 버튼이며 최종 삭제에는 표시하지 않는다.

<a id="d08-restrict"></a>
## 9. 제재 화면

- 검토 상세에서 회원 제한 panel로 진입, 현재 사유·기간·이력·기간 선택·해제.
- 입력 없는 제재는 금지한다. 탈퇴 targetMemberRef=null이면 제재 조작을 숨긴다.
- REVOKED·만료 row는 이력으로 표시하되 현재 제한으로 표시하지 않는다. 해제 성공 뒤 참여 가능 상태를 다시 조회한다.
- 일반 계정 화면에는 공개 사유·종료 시각·이의제기 이메일만 보인다.
- 모바일 단일 열/데스크톱 목록·상세 분리, 키보드로 모든 조치 가능, 긴 사유 줄바꿈·focus 복귀 검증.

## 10. 수용 시나리오·차단

미실행: 같은 대상 중복 신고, OTHER 공백, 본인 신고, 다른 글 댓글 조합, 동시 검토 version,
숨김 뒤 수정 차단, 삭제 복원 불가, 일반 회원의 admin 위장, 제한과 쓰기 경쟁, 종료 시각 경계,
삭제·탈퇴 권한 유지, 신고자 정보 비공개, 90일 정리와 법무 예외 분리,
REVOKED 무기한·REVOKED 미래 종료·만료 ACTIVE·시작 전 ACTIVE의 참여 허용과 현재 ACTIVE만 차단,
detail·publicReason·internalNote의 한글 NFC·emoji·ZWJ·결합문자·최대/최대+1·단독 surrogate 거부.

운영 활성화 `차단`: 신고·제재 보존 적법 근거, 이의제기 실제 접수값, 운영자가 처리할 수 있는지
수용 검증. 문서 작성은 실제 신고 운영 체계를 검증한 증거가 아니다.

## 11. 신고 없는 직접 검토 계약

GET `/api/v1/admin/moderation/posts/:postId`, 해당 `/comments?page=1`, `/comments/:commentId`는
[기술 API 표](../../../system-design/06-member-community-design.md#api)의 DTO를 사용한다.
일반 회원에게 허용하지 않고 USER board와 댓글의 부모 소속을 검증한다. 삭제 원문은 null이며
숨김 원문은 운영 검토 권한에서만 반환한다. 조회 자체는 신고·action 이력을 생성하지 않는다.

운영자는 글 ID로 직접 상세 진입→댓글 페이지→댓글 상세에서 상태·version을 읽고 직접 actions 또는
memberRef 제재로 이동한다. 타 게시판 ID·잘못된 댓글 조합은 일반 404, 탈퇴 회원 참조는 null이다.
무조치 종결은 실제 신고 사건에서만 제공한다. 직접 조치는 HIDE/RESTORE/REMOVE로 action 이력을 남긴다.

미실행 검증: 신고 0건 댓글 숨김·복원·제재, 현재 version 충돌, 삭제 본문 미반환,
일반 회원 admin 접근 거부, 부모 소속 위조, 탈퇴자 제재 버튼 없음.

## 12. 재검토 보완: 탈퇴자의 제재 이력

제재 이력은 생성할 때 실제 대상 계정이 필수다. 탈퇴 후에는
[분리 완료 제약](../../../system-design/06-member-community-design.md#restriction-detachment)에 따라
account_id=null과 account_detached_at을 함께 보관한다. 현재 restriction은 삭제하며 과거 action을
새 회원에게 연결하지 않는다. 대상 계정이 없는 이력에는 제재·해제 동작을 제공하지 않는다.

미실행 검증: 대상 없는 신규 제재 이력 INSERT 거부, WITHDRAWING 계정의 이력 분리 허용,
일반 계정의 임의 분리 거부, 계정 FK 삭제 성공, 분리한 과거 이력 재연결 거부.
