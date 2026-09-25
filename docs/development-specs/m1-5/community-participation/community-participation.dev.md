# 익게 글·댓글·내 활동 기능 명세

- 문서 상태: `작성 완료` — API·처리 흐름·화면 계약; 아래 운영 활성화 절은 `차단`
- 기준일: 2026-09-08
- 2026-09-24 재대조: 후속 설계 상태를 유지한다. 현재 구현 부재와 운영 활성화 조건은 [회원·익게 기술 계약](../../../system-design/06-member-community-design.md)을 따른다.
- 실행 증거: source·migration·OpenAPI 생성·test·build·브라우저·production 모두 이 문서 작업에서 미검증
- 입력: [제품 계약](../../../planning/08-member-community-plan.md), [화면 설계](../../../planning/03-screen-design.md), [법무 gate](../../../legal/README.md)
- 공통 타입·요청/응답·오류·권한: [기술 API 정본](../../../system-design/06-member-community-design.md#api)
- 저장·제약·잠금: [데이터 정본](../../../system-design/06-member-community-design.md#data)

이 기능은 아직 전용 machine-readable OpenAPI가 없으므로 요청·응답 필드는 위 기술 정본 표를
사용한다. 아래는 업무 제약과 구현 순서를 보충한다. M0 Core YAML을 이 기능의 전체 계약으로 해석하지 않는다.

## 1. 범위·행위자

- milestone: M1.5. 공개 읽기, 회원 텍스트 글·댓글 작성/수정/삭제, 글 단위 랜덤 이름, 내 활동.
- 선행: ACCOUNT_ACCESS와 COMMUNITY 활성, USER board, 유효 회원·필수 동의. MEMBER=false는 신규 가입·연결 중단이며 기존 회원 참여를 막지 않는다. 제재 중 읽기·삭제는 가능하다.
- 제외: 이미지 업로드·추천·검색·대댓글·예약·초안·타인 프로필. 짤의 운영자 작성 권한을 바꾸지 않는다.

## 2. 요구사항 추적

| 요구                   | API                            | 흐름                       | 화면                     |
| ---------------------- | ------------------------------ | -------------------------- | ------------------------ |
| 공개 목록·상세         | boards/community/posts GET     | [읽기](#d01-read)          | [목록·상세](#d08-browse) |
| 본인 글 작성/수정/삭제 | posts POST/PATCH/DELETE        | [글](#d01-post)            | [편집](#d08-editor)      |
| 댓글·랜덤 이름         | comments GET/POST/PATCH/DELETE | [댓글](#d01-comment)       | [댓글](#d08-comments)    |
| 내 활동·탈퇴 처리      | me/activity, withdrawal worker | [활동·삭제](#d01-activity) | [내 활동](#d08-activity) |

<a id="api-community"></a>

## 3. API 업무 계약

기술 정본 익게 표의 endpoint를 그대로 사용한다. 외부 browser는 BFF만 호출하고 Core가
board·계정·제재·동의·소유권을 검증한다. 공개 DTO에는 회원 정보나 본인 여부를 넣지 않는다.

- 페이지 20개, 범위 초과는 M0와 같은 404 PAGE_NOT_FOUND, 게시글 0개의 1페이지는 빈 목록 200.
- 상세 context는 현재 글이 속한 페이지, contextPage 지정 시 해당 페이지를 반환한다. 댓글 page와 독립이다.
- 본인 여부는 me permissions로 별도 확인한다. comment page의 본인 ID/version만 반환한다.
- 공개 글 수정은 본인·version·상태 일치, 삭제는 본인이고 이미 숨겨져 있어도 허용한다.
- 제목/본문/댓글은 [공통 문자열 계약](../../../system-design/06-member-community-design.md#api)에 따라
  잘못된 Unicode scalar sequence·U+0000 거부→여러 줄 입력의 CRLF·CR·U+2028·U+2029를 LF로 통일
  (제목은 거부)→C0·C1 제어 문자 거부(여러 줄 LF만 예외)→NFC 정규화→ECMAScript trim→Unicode code point
  길이 검증 순으로 처리하고 canonical 값만 저장한다. 브라우저 렌더링은 escape이며 Markdown을 해석하지 않는다.
- 변경 command는 Idempotency-Key와 version을 사용하고 사용자 ID를 body로 받지 않는다.

<a id="d01-read"></a>

## 4. 공개 읽기 흐름

1. board 활성과 slug를 검증하고 PUBLISHED/publishedAt<=now 조건을 적용한다.
2. 목록·상세·context를 no-store로 반환한다. 다른 board의 ID, 숨김·삭제는 동일 404다.
3. 상세 화면 정상 표시 뒤 기존 조회 수 command를 호출한다. 실패해도 본문 읽기는 유지한다.
4. 별도 comments GET으로 20개를 읽는다. 숨김/삭제 행은 본문·작성자 없이 자리 표시한다.
5. 로그인 사용자만 permissions를 추가 조회해 수정·삭제 버튼을 렌더링한다. SSR 공용 자료와 섞지 않는다.

<a id="d01-post"></a>

## 5. 글 command 흐름

1. 회원 session 확인, Core account lock으로 탈퇴 여부 확인, 동의와
   `status=ACTIVE AND startsAt<=now AND (endsAt IS NULL OR endsAt>now)`인 제재만 확인하고 USER board를 확인한다.
2. receipt 선점·재생, 신규 생성이면 rate bucket 검사, 수정/삭제면 post 소유자·version 확인.
3. 생성은 post+TEXT+글쓴이 participant+post_author, 수정은 TEXT·title·version, 삭제는 REMOVED·본문 파기를 atomic 저장한다.
4. receipt는 ID·version만 보관한다. 성공 뒤 상세 재조회 또는 목록으로 이동한다.
5. 실패 시 전체 rollback하며 성공 카운터와 원문 없는 receipt를 어긋나게 남기지 않는다.

<a id="d01-comment"></a>

## 6. 댓글과 랜덤 이름 흐름

1. 부모 공개 여부를 확인한다. 단 본인 댓글 삭제는 부모 숨김/삭제 상태에서도 허용한다.
2. account→post lock 아래 글쓴이 여부를 확인한다. 글쓴이 포함 기존 participant를 찾는다. 원글 작성자에게만 별도 `글쓴이` 배지를 표시한다.
3. 첫 참여면 기술 정본의 이름 배정 계약으로 이름을 생성하고 comment와 같은 transaction으로 저장한다.
4. 수정은 본인 공개 댓글만, 숨김 중에는 삭제만 허용한다. 삭제한 참여자의 이름을 다른 참여자에게 재사용하지 않는다.
5. 댓글 목록은 id ASC의 페이지 방식, 사용자 수정이 순서를 바꾸지 않는다.

<a id="d01-activity"></a>

## 7. 내 활동·탈퇴 연결

- me/activity는 session account 기준으로만 조회한다. 숨김 본문 대신 일반 상태·ID·version을 제공한다.
- 탈퇴 KEEP은 post_author/comment/participant account FK를 null로 바꾸고 감사 actor를 정리한다.
- 탈퇴는 글·댓글 본문과 기존 공개/숨김/삭제 상태를 유지한다. 삭제 선택은 제공하지 않으며 이미 삭제된 콘텐츠를 복원하지 않는다.
- 삭제 후 신규 가입은 새 계정이다. 과거 랜덤 이름이나 콘텐츠 소유권을 자동 연결하지 않는다.

<a id="d08-browse"></a>

## 8. 목록·상세 화면

- route `/community`, `/community/posts/:postId`. 제목·시각·댓글 수·조회 수, 글쓰기 버튼과 페이지네이션.
- empty `아직 작성된 글이 없습니다`, loading 행 skeleton, 오류 재시도, 404 `/community` 이동.
- 상세는 글·댓글·동일 게시판 하단 목록이다. 댓글 오류가 정상 본문을 가리지 않는다.
- 신고 버튼은 [신고 명세](../community-moderation/community-moderation.dev.md#d01-report)로 연결한다.

<a id="d08-editor"></a>

## 9. 편집 화면

- `/community/new`, `/community/posts/:postId/edit`; title·body와 NFC 정규화·trim 후 Unicode code point
  기준 남은 글자 수, 등록/저장·취소. 제목은 CR·LF·U+2028·U+2029를 거부하고 본문의 해당 줄바꿈은 LF로 통일한다.
- 제출은 post 흐름, 취소는 화면 이동(API 해당 없음), 미저장 확인은 브라우저 UI다.
- 409 입력 보존·최신 확인, 401 부모 화면을 유지한 인증 팝업, 403 재동의 dialog/제재 안내, 429 Retry-After, 503 재시도.
- [편집 인증 계약](../../../system-design/06-member-community-design.md#auth-continuation)에 따라 부모 탭을 이동하지 않는다. 팝업 완료 뒤 서버에서 새 CSRF·세션·소유권을 확인하고 자동 제출하지 않는다. 팝업 차단은 입력 유지·재시도·복사를 제공한다. 부모 새로고침·종료 뒤 복구를 보장하지 않으며 영구 저장소에 저장하지 않는다.

<a id="d08-comments"></a>

## 10. 댓글 화면

- 상세 안의 댓글 목록·입력·수정·삭제·신고, 20개 댓글 페이지와 본문 하단 목록 페이지를 독립 유지한다.
  댓글 counter도 canonical Unicode code point 기준이며 CRLF·CR·U+2028·U+2029는 LF로 통일한다.
- 등록 성공 뒤 새 댓글 페이지로 이동하고 입력을 비운다. 실패하면 입력을 유지한다.
- 비회원 입력은 로그인 진입, 제재 회원은 사유와 삭제 가능 안내. 삭제 확인 뒤 자리 표시로 전환한다.
- 동일 글의 랜덤 이름과 원글 작성자의 글쓴이 배지만 표시한다. 랜덤 이름에 다른 글 활동 링크를 달지 않는다.

<a id="d08-activity"></a>

## 11. 내 활동 화면

- `/account/activity`; 글·댓글 탭 GET me/activity, 신고 탭 GET me/reports.
- 숨김 상태의 원문은 표시하지 않고 본인 삭제를 지원한다. 공개 불가 부모의 댓글도 삭제 가능하다.
- 공통 접근성: 360/768/1280px, 키보드 focus, 삭제 dialog focus 복귀, 상태 aria-live,
  입력 label·오류 연결, 색상만으로 본인·선택 행을 구분하지 않음.

## 12. 수용 시나리오·차단

미실행: 공개 20행·context, IDOR(다른 회원 ID로 권한 우회), USER 관리자 route 차단,
XSS 텍스트, 동시 랜덤 이름·글 수정·삭제, rate 멱등 재생, 탈퇴와 글쓰기 경쟁, 본문·감사 actor 누출,
댓글 부모 숨김 후 본인 삭제, KEEP 뒤 다른 글 연결 단서 없음, M0 회귀,
제목·본문·댓글의 한글 NFC·emoji·ZWJ·결합문자·최대/최대+1 code point·단독 surrogate 거부,
REVOKED 무기한·REVOKED 미래 종료·만료 ACTIVE의 참여 허용.

운영 활성화 `차단`: M1 gate, 익게 약관·보존 검토, 운영 검수 수용 테스트. 사용자 업로드 API는 이 명세에 없다.

## 13. 검토 보완 수용 시나리오

실행 전 목록: 입력 후 401→팝업 로그인→원문 유지→권한 재조회, 팝업 차단과 사용자 복사,
다른 계정 인증 후 수정 거부, 재동의 dialog와 정책 변경, 가입 중단 뒤 기존 회원의 내 활동·삭제·탈퇴.

## 14. 랜덤 이름 상세 계약

[배정·DB·공개 필드](../../../system-design/06-member-community-design.md#random-name-assignment)와
[사전](../../../planning/09-random-name-catalog.md)을 따른다. 조회·수정·새로고침은 이름을 바꾸지 않는다.
이름 배정 실패 시 “이름을 만들지 못했습니다. 잠시 후 다시 시도해 주세요”를 표시하고 편집 내용을 유지한다.
360px에서도 32 code point 이름은 줄바꿈하며 이름·배지를 색상만으로 구분하지 않는다. 숨김 자리 표시에서는 둘 다 감춘다.
