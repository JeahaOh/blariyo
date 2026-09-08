# M1 회원·M1.5 익게 기술 계약

- 문서 상태: 작성 완료 — 기술 설계; 운영 활성화 절은 차단
- 기준일: 2026-09-08
- 제품 정본: [회원·익게 제품 계약](../planning/08-member-community-plan.md)
- 공통 계약: [아키텍처](01-system-architecture.md), [M0 데이터 모델](02-data-model.md), [API 공통 응답](03-api-design.md), [보안·운영](05-security-operations.md)
- 미검증: source, migration, machine-readable OpenAPI, 계약·DB·브라우저 테스트, 실제 provider 설정

이 문서는 M0 공통 계약을 확장하는 M1·M1.5 전용 정본이다. 기존 M0 endpoint와 YAML에 회원·익게
필드를 조용히 추가하지 않는다. 아래 명시한 확장은 각 단계 migration·공유 OpenAPI에 반영하고
생성 타입·요청 검증·계약 테스트를 함께 갱신한다. 현재는 Markdown 설계이며 실행 계약 생성은 구현 작업이다.

<a id="architecture"></a>
## 1. 시스템 경계

브라우저 → same-origin Nuxt BFF → Express Core → PostgreSQL 흐름을 유지한다. OAuth는 외부
제공자에게 인증을 위임하는 방식이다. 제공자 code 교환·서명 검증·프로필 최소화는 BFF adapter,
계정·세션·동의·권한·업무 transaction은 Core가 담당한다. BFF에 SQL이나 회원 상태 판정을 두지 않는다.

- BFF `MemberIdentityProvider`: start, exchange, verify, revoke, notification 검증을 제공자별로 구현한다.
- Core `IdentityService`: OAuth 임시 상태, 계정·연동·세션, 동의, 탈퇴 작업의 유일한 저장 주체다.
- Core `CommunityService`: 글·댓글·랜덤 이름·본인 활동을 처리한다.
- Core `ModerationService`: 신고·검토·제재를 처리하고 모든 회원 참여 command가 제재를 재확인한다.
- Core는 BFF 서비스 token과 실제 저장된 회원 세션을 함께 검증한다. 외부 `X-User-Id`, actor,
  role header는 BFF가 제거한다. payload로 받은 회원 ID를 현재 사용자로 신뢰하지 않는다.
- 내부 회원 route는 외부 `/api/v1/`를 `/internal/v1/`로 바꾼 경로·method·body를 사용한다.
  OAuth start/callback/알림은 아래 전용 내부 route를 쓰며 외부 응답에 token을 반환하지 않는다.
- 관리자 회원 계정과 일반 회원 계정은 독립이다. 일반 소셜 로그인으로 `/admin` 권한을 얻지 못한다.
- 공개 읽기와 회원 상태 조회를 분리한다. 읽기 API·SSR에는 회원별 `isMine`을 넣지 않는다.
  `/me` 계열 응답에서만 소유권을 확인한다. 모든 회원·익게 HTML/API는 `Cache-Control: no-store`다.
- 새 상시 서비스·Redis는 추가하지 않는다. DB 세션과 DB 원자 카운터를 사용하고 유지관리 command는
  기존 API 이미지의 cron으로 실행한다. 공개 익게 읽기는 provider 장애와 독립적으로 동작한다.

<a id="identity"></a>
## 2. 회원 인증과 보안

### OAuth transaction

1. `POST /api/v1/auth/:provider/start`는 같은 origin 확인과 pre-auth CSRF 검증 뒤 Core에
   임시 transaction 생성을 요청한다. `purpose=LOGIN|LINK|REAUTH`, 검증된 `returnTo`를 저장한다.
2. 32바이트 이상 난수 state, browser binding, 해당 제공자가 지원하는 nonce·PKCE S256을 생성한다.
   state는 hash, PKCE verifier와 임시 provider 자료는 서버 암호화 저장한다. 유효시간은 시작부터 10분이다.
3. returnTo는 서버 allowlist의 상대 경로(`/meme`, `/community`, `/account`, `/account/activity`,
   `/community/new`, `/community/posts/<양의 정수>` 및 해당 `/edit`, `/account/withdraw`,
   `/account/consent`)만 허용한다. 팝업 완료 경로 `/auth/complete`는 외부 returnTo 입력으로 받지 않고 서버가 선택한다.
   `//`, 역슬래시, scheme, 인코딩 우회, 임의 query는 거부한다. 기본값은 `/meme`이다.
4. callback에서는 state·provider·purpose·browser binding·만료를 함께 확인한다. CAS로
   `STARTED→EXCHANGING` 선점 후 code를 한 번만 교환한다. 재전송은 재교환하지 않고 재시작 안내로 끝낸다.
5. OIDC 제공자는 서명/JWKS, issuer, audience, exp, nonce를 검증한다. 네이버처럼 profile API의
   식별자를 쓰는 adapter는 고정 HTTPS endpoint와 token 주체를 확인하며 OIDC 검증을 했다고 주장하지 않는다.
6. 검증 결과는 아래 [내부 인증 자료 계약](#identity-material)에 따라 Core로 전달한다. 신규면 10분 임시 가입으로 전환하고, 기존이면
   계정 상태 검사 후 세션을 발급한다. LINK와 REAUTH 결과는 신규 회원 생성 경로로 보내지 않는다.
7. code·access token·원문 provider 응답은 log·URL·브라우저 상태에 보관하지 않는다. code 교환 후 폐기한다.
   Apple refresh token 예외는 §3의 암호화 credential에만 저장한다.

### Cookie와 CSRF

| 이름 | 목적 | 속성·기한 |
| --- | --- | --- |
| `__Host-blariyo-session` | 임의 32바이트 세션 token, DB에는 SHA-256만 저장 | Secure, HttpOnly, Path=/, Domain 없음, SameSite=Lax; 절대 7일·유휴 24시간 중 빠른 만료 |
| `__Host-blariyo-auth` | OAuth browser binding·임시 가입 참조 | Secure, HttpOnly, Path=/, Domain 없음, SameSite=None; 10분 |

Apple `form_post` callback에는 Lax cookie가 오지 않을 수 있어 OAuth 전용 binding cookie만
SameSite=None으로 둔다. 일반 로그인 cookie를 완화하지 않는다. callback POST만 일반 origin/CSRF
검사를 대신 state+binding 검증하며, 다른 회원 쓰기 endpoint에는 예외를 적용하지 않는다.
GET `/api/v1/auth/context`가 비밀이 아닌 CSRF 제출용 난수와 활성 제공자를 반환한다. CSRF hash는
세션 또는 pre-auth transaction 저장소에 결합하고 `X-CSRF-Token`과 정확한 Origin을 검증한다.
SSR 페이지에 token을 공용 cache로 남기지 않는다. 로그인 성공·재인증·권한 변경 시 세션 token을 회전하고
기존 token을 즉시 폐기한다. 로그인 발급 응답 유실은 다시 인증하며 세션 token을 멱등 결과에 저장하지 않는다.

- 재인증은 실제 인증 adapter의 fresh-auth 결과를 검증하고 5분 유효한 `reauthenticated_at`으로 기록한다.
  단순 기존 session 조회나 OAuth 화면 재방문만으로 fresh-auth로 취급하지 않는다. 제공자별 지원 확인은 활성화 gate다.
- 세션은 `ACTIVE` 계정 또는 참여 제한 회원에게만 발급한다. `WITHDRAWING`은 발급 금지,
  `REAUTH_REQUIRED`는 동일 provider subject 검증과 사용 가능한 연동 복구 후 `ACTIVE`로 전환한다.
- 요청마다 Core가 세션 만료·계정 상태를 확인한다. 제재는 인증 실패로 취급하지 않고 쓰기 권한만 제한한다.
- 계정 연결·해제는 계정 row lock 뒤 사용 가능한 연동 수를 다시 검사한다. 양쪽 동시 해제로 0개가 되는 것을 막는다.
- 인증 시작은 IP당 20회/10분, callback은 60회/10분, 실패는 일반 메시지로 응답한다.
  신뢰된 edge IP의 일일 HMAC만 속도 제한에 쓰고 원문은 일반 log에 남기지 않는다.

### 제공자별 계약과 근거

공식 문서 확인일: 2026-09-08. 아래는 공통화 가능한 범위이며 실제 client 설정을 확인한 증거는 아니다.

| 제공자 | 식별·검증 | 최소 요청·종료 |
| --- | --- | --- |
| 네이버 | profile `id`, state와 token 교환 확인 | 선택 프로필 권한 요청하지 않음; 재인증한 접근 token으로 연동 해제, 최신 API 지원은 adapter 계약 테스트 |
| 카카오 | 서비스 회원번호, OIDC 활성화 시 서명·nonce도 검증 | 추가 프로필 동의 제외; 사용자 access token으로 unlink |
| Google | 검증한 ID token의 `sub` | `openid`만 요청, email/profile·offline access 제외; 사용자가 연결된 앱 권한을 철회하도록 안내 |
| Apple | 검증한 ID token `sub`, 최초 이름은 회원 키로 쓰지 않음 | name/email scope 제외; refresh credential 암호화 보관 후 상태 확인·revoke |

- [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md)
- [카카오 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api)
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect)
- [Apple 계정 삭제와 토큰 철회](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)

Apple 문서는 유효 token이 없는 경우에도 자체 계정 삭제를 처리하고 수동 철회를 안내하도록 설명한다.
이 설계는 새 연동에서는 refresh credential을 암호화해 철회에 사용하며, 분실·장애 시에도 로컬 삭제를 진행한다.
네이버·카카오·Google의 PKCE/fresh-auth/철회·알림 지원을 Apple과 동일하다고 가정하지 않는다.
지원하지 않는 항목은 adapter capability로 표시하고 state·binding·code 단회성 검증은 필수로 유지한다.

<a id="data"></a>
## 3. 데이터 모델

공통: 별도 명시 없으면 열은 NOT NULL, `?`는 NULL 허용. 모든 표의 entity는 기존 공통 감사 4열을
가진다. PK는 BIGINT identity, FK는 같은 BIGINT, 시각은 TIMESTAMPTZ(3), API의 BIGINT는 양의 10진수
문자열이다. `lock_version INT DEFAULT 1 CHECK >=1`은 변경 가능한 업무 entity에 둔다.
FK 삭제는 기본 RESTRICT이며 아래 삭제 절차에서 명시적으로 순서대로 정리한다. JSON으로 외래 관계를 숨기지 않는다.

### M1 identity

| 테이블 | 고유 열·제약 | 인덱스·보존 |
| --- | --- | --- |
| `identity.account` | id; display_name VARCHAR(20); status VARCHAR(24) ACTIVE/REAUTH_REQUIRED/WITHDRAWING; last_login_at?; age_confirmed_at; reconsent_required BOOLEAN; lock_version | status,id; 탈퇴 worker 완료 시 삭제 |
| `identity.social_identity` | id; account_id FK account; provider VARCHAR(10) NAVER/KAKAO/GOOGLE/APPLE; subject_hash BYTEA(32) HMAC; subject_ciphertext BYTEA; key_version INT; hash_key_version INT; status VARCHAR(16) ACTIVE/REVOKED; generation UUID UNIQUE; linked_at; authenticated_at | UNIQUE(provider,subject_hash), UNIQUE(account_id,provider); 탈퇴/해제 시 삭제 |
| `identity.provider_credential` | id; social_identity_id FK UNIQUE; ciphertext BYTEA; key_version INT; expires_at?; last_checked_at? | Apple refresh만; 연동 종료 또는 탈퇴 외부 작업 완료/24시간 만료 시 삭제 |
| `identity.session` | id; account_id FK; token_hash BYTEA(32) UNIQUE; csrf_hash BYTEA(32); reauthenticated_at?; idle_expires_at; absolute_expires_at; authenticated_social_identity_id FK | account_id, absolute_expires_at; 로그아웃 즉시 삭제, 매시간 만료 삭제 |
| `identity.auth_transaction` | id; state_hash BYTEA(32) UNIQUE; binding_hash BYTEA(32); csrf_hash BYTEA(32); provider?; purpose VARCHAR(10) LOGIN/LINK/REAUTH/CONTEXT; delivery VARCHAR(10) REDIRECT/POPUP; account_id? FK; session_id? FK; status VARCHAR(20) STARTED/EXCHANGING/VERIFIED/CONSUMED; return_to VARCHAR(256); encrypted_payload BYTEA?; expires_at | expires_at; 10분 또는 소비/취소 시 secret 삭제 |
| `identity.consent` | id; account_id FK; policy_version_id FK legal.policy_version; accepted_at | UNIQUE(account_id,policy_version_id); 탈퇴 시 삭제, 법적 예외는 공개 전 별도 확정 |
| `identity.withdrawal` | id; account_id? FK UNIQUE; content_action VARCHAR(16) KEEP 고정; status VARCHAR(16) PENDING/RUNNING/DONE/FAILED; journaled_at?; token_hash BYTEA(32) UNIQUE; expires_at; last_error_code VARCHAR(64)?; cursor_id BIGINT?; phase VARCHAR(24) | 상태/created_at; 결과 조회 token 24시간; account 삭제 전 FK null, 완료 후 24시간 삭제 |
| `identity.provider_disconnect` | id; withdrawal_id? FK; social_identity_id? FK; provider; encrypted_payload BYTEA?; status VARCHAR(20) PENDING/RUNNING/UNKNOWN/DONE/MANUAL/FAILED; generation UUID; guard_id FK identity.identity_guard; lease_until?; attempts INT; next_attempt_at; expires_at | 대상 식별·token은 암호문으로만 24시간; secret 삭제 후 결과 코드만 withdrawal 종료까지 유지 |
| `identity.identity_guard` | id; provider VARCHAR(10); subject_hash BYTEA(32); hash_key_version INT; generation UUID; status VARCHAR(16) ACTIVE/DISCONNECTING/QUARANTINED; blocked_until?; lock_version | UNIQUE(provider,subject_hash); 계정/연동 삭제와 독립, 종료·보존은 아래 해제 경합 규칙 |
| `identity.request_receipt` | id; account_id? FK; owner_hash BYTEA(32); scope VARCHAR(120); request_key VARCHAR(128); request_hash BYTEA(32); resource_id BIGINT?; result JSONB; expires_at | UNIQUE(owner_hash,scope,request_key); 24시간, token/subject/본문 미포함 |

HMAC은 subject의 안정 조회용이며 암호화 대체가 아니다. 암호문은 AEAD와 entity/열을 AAD로 사용한다. 모든 BYTEA(32) 표기는 실제 PostgreSQL BYTEA+octet_length=32 CHECK를 뜻한다.
키는 DB·backup과 분리한다. `key_version`은 암호문 키, `hash_key_version`은 조회용 HMAC 키다.
원문을 삭제한 guard hash는 재계산하지 않는다. 키 교체는 [HMAC 교체 계약](#hash-key-rotation)을 따른다.
DB unique는 유지하지만 서로 다른 키의 hash 사이 중복 방지는 모든 조회 키의 후보 대조·잠금으로 보완한다.
일반 user actor는 내부 account ID의 HMAC이며 공개 반환하지 않는다.

약관과 개인정보처리방침은 기존 `TERMS`,`PRIVACY`를 유지한다. M1 migration에서
`legal.policy_version.policy_type`에 `SIGNUP_PRIVACY`를 추가해 필수 수집·이용 동의 전문을 별도
버전으로 관리한다. [전문 초안](../legal/signup-privacy-consent.md)은 법무 검토 후 발행한다. 새 가입은 현재 EFFECTIVE인 TERMS와 SIGNUP_PRIVACY ID 두 개를 서버가 확인한다.
PRIVACY 열람을 수집·이용 동의로 대체하지 않는다. 정책 발행은 기존 artifact command를 확장해
필수 재동의 대상이면 `reconsent_required=true`를 설정한다. 기준 정책 ID 검증과 동의 insert는
정책별 advisory lock을 정책 발행과 공유해 동시에 새 정책이 시행되는 경쟁을 막는다.

M1부터 인증 rate 제한에 `ops.member_rate_bucket`을 생성한다. 아래 표의 테이블을 M1.5에서 재생성하지 않는다.
M1 migration에서 `system:privacy-worker`를 감사 CHECK에 추가한다. 계정의 age_confirmed_at은
입력 생년월일로 만 14세 이상 판정을 통과하고 가입이 완료된 서버 시각만 저장한다. 생년월일은 저장하지 않는다. auth_transaction은 CONTEXT에서
start 요청 시 provider/purpose를 채운 STARTED transaction으로 교체한다. binding은 브라우저와 유지한다.
동시 새 로그인 시작은 이전 임시 transaction을 폐기하며 이전 탭은 재시작 안내를 받는다.

### M1.5 community·moderation

기존 `content.board_post` PK·상태·TEXT block을 재사용한다. `community` 게시판 seed는
posting_policy=USER, is_active=false로 추가하며 활성화 전 공개 목록에 나오지 않는다.

| 테이블/확장 | 열·관계·제약 | 인덱스·규칙 |
| --- | --- | --- |
| `community.post_author` | post_id PK/FK content.board_post; account_id? FK account; participant_id NOT NULL; FK(post_id,participant_id) -> thread_participant(post_id,id) | account_id,post_id; 회원 삭제 전 null |
| `community.thread_participant` | id; post_id FK; account_id? FK; alias_label VARCHAR(32) NOT NULL; dictionary_version VARCHAR(32) NOT NULL | UNIQUE(post_id,account_id) WHERE account_id IS NOT NULL; UNIQUE(post_id,alias_label); UNIQUE(account_id,alias_label) WHERE account_id IS NOT NULL; UNIQUE(post_id,id); 이름 재사용 금지 |
| `community.comment` | id; post_id FK; account_id? FK; participant_id NOT NULL FK; is_post_author BOOLEAN; body VARCHAR(1000)?; status VARCHAR(20) PUBLISHED/HIDDEN_REVIEW/REMOVED; lock_version | (post_id,id), (account_id,id); 공개만 body NOT NULL; REMOVED는 body NULL; participant와 post 일치는 복합 FK |
| `moderation.report` | id; post_id FK; comment_id? FK; reporter_account_id? FK; reason_code VARCHAR(24); detail VARCHAR(500)?; status VARCHAR(16) OPEN/RESOLVED; resolved_at?; resolution VARCHAR(16)? NONE/HIDE/REMOVE; lock_version | 대상 존재 복합 FK(comment_id,post_id); UNIQUE(reporter_account_id,post_id) WHERE comment_id IS NULL; UNIQUE(reporter_account_id,comment_id) WHERE comment_id IS NOT NULL; (status,id) |
| `moderation.action` | id; report_id? FK; post_id? FK; comment_id? FK; account_id? FK; account_detached_at?; action VARCHAR(24); public_reason VARCHAR(300); internal_note VARCHAR(500)?; before_status VARCHAR(24)?; after_status VARCHAR(24)?; until_at? | 대상·created_at; actor 감사 열은 관리자, 본문 사본·provider 식별자 금지 |
| `moderation.restriction` | id; account_id FK UNIQUE; status VARCHAR(12) ACTIVE/REVOKED; starts_at; ends_at?; public_reason VARCHAR(300); lock_version | account_id,status,ends_at; null ends_at은 무기한; 실제 참여 판단은 status='ACTIVE' AND starts_at<=now AND (ends_at IS NULL OR ends_at>now) |
| `ops.member_rate_bucket` | id; account_id? FK; subject_hash BYTEA(32); action VARCHAR(24); window_start; count INT CHECK >=0; expires_at | UNIQUE(subject_hash,action,window_start); 짧은 창·KST 일 창, 만료 24시간 내 삭제 |

moderation.action.action 허용값은 NONE/HIDE/RESTORE/REMOVE/RESTRICT/UNRESTRICT다.
RESTRICT/UNRESTRICT 이력은 생성 시 account_id 필수·account_detached_at NULL이다.
탈퇴 정리 후에는 account_id NULL·account_detached_at NOT NULL인 이력을 허용한다. 구체적인
CHECK·생성/분리 제한은 [제재 이력 분리 계약](#restriction-detachment)을 따른다.
콘텐츠 action에는 post_id(댓글이면 comment_id도), report 종결에는 report_id가 있어야 한다.
모든 참조와 CHECK는 migration 테스트에 포함한다.
삭제 ledger는 DB 테이블이 아니라 암호화 object record이며 account 참조가 남는 개인정보 처리다.
따라서 ledger가 존재하는 동안 완전한 비식별화라고 표현하지 않는다.

`reason_code`는 SPAM/HARASSMENT/PRIVACY/RIGHTS/ILLEGAL/OTHER만 허용하며 OTHER 설명은 공통 문자열
정규화 후 1~500 Unicode code point다.
글쓴이를 포함한 모든 comment의 participant_id는 필수다. 탈퇴 후에도 이름 참조는 유지하지만 account_id는 null이다.
작성 시 post_author/comment의 계정과 participant의 계정이 같은지 검사한다. 글쓴이 여부는 저장된 post_author.participant_id와 비교하며 계정 삭제 후에도 유지한다.
신고 대상·작성자의 FK는 검토 당시 대상을 찾기 위한 것이며 공개 응답에 반환하지 않는다.
M1.5 멱등 receipt는 M1 `identity.request_receipt`를 재사용하되 결과에는 생성 ID·version·status만 저장한다.
원문 제목·본문을 receipt에 복제하지 않는다.

### 전이·잠금·정리

- 글·댓글·신고 참여를 막는 유효 제재 predicate는
  `status='ACTIVE' AND starts_at<=now AND (ends_at IS NULL OR ends_at>now)` 하나다. `REVOKED`, 시작 전,
  `ends_at<=now` row는 이력·version 조회에는 남아도 참여를 막지 않는다. 수동 해제 transaction은
  `status=REVOKED`와 UNRESTRICT action을 함께 저장하며 정리 cron은 권한 판정의 선행 조건이 아니다.
- 일반 회원 콘텐츠 참여 command는 계정 row → 제한 row → post row → comment/report row 순으로 lock한다. 인증·연동·탈퇴는 §7의 guard 선점 후 이 순서를 따른다.
  탈퇴·제재도 계정 row부터 lock해 이미 접수한 탈퇴 뒤 새 글·댓글이 생기지 않게 한다.
- 글 생성은 board USER·회원·동의·제재·상한을 확인하고 post PUBLISHED/published_at=now,
  TEXT block, 글쓴이 participant, post_author, receipt를 한 transaction에 저장한다.
- 새 이름은 [배정 계약](#random-name-assignment)에 따라 account → post lock 아래 생성하며 동시 최초 참여에서도 UNIQUE를 지킨다.
- 수정은 lockVersion 일치 시 본문·버전을 함께 갱신한다. PUBLISHED→HIDDEN_REVIEW→PUBLISHED 또는
  PUBLISHED/HIDDEN_REVIEW→REMOVED만 허용한다. REMOVED에서 복원하지 않는다.
- 사용자 글은 예약·공지·이미지·출처 필드를 받지 않는다. 기존 관리자 `/admin/posts` command는
  USER 게시판을 거부하고 운영 조치는 moderation API를 거친다.
- 댓글 숨김은 원문을 운영자 검토에만 남기고 공개에 자리 표시를 반환한다. 삭제는 원문을 지운다.
- 탈퇴는 계정을 WITHDRAWING으로 전환하되 콘텐츠 본문·공개 상태를 변경하지 않는다. 숨김·삭제 상태도 유지하며 다시 공개하지 않는다.
- 탈퇴 worker는 복원용 암호화 삭제 ledger를 VM 외부 저장소에 멱등 기록하고 journaled_at을 확인한 뒤
  영구 파기를 시작한다. ledger를 쓰지 못하면 계정 WITHDRAWING 상태를 유지하고 FAILED·운영 경고를 남긴다.
  탈퇴 DONE은 ledger 원격 readback까지 성공한 경우만 허용한다. 접수 직후 아직 ledger가 없는 요청은
  재해 복구에서 유실될 수 있는 별도 RPO 한계이므로, 202 화면에 처리 중으로 표시하며 완료라고 알리지 않는다.
- worker는 100건 단위로 잠금·cursor·phase를 갱신해 재시작 가능하게 처리한다. 본문과 공개 상태를
  유지하고 author/comment/participant/report의 계정 FK와 user 감사값을 정리한다.
- 탈퇴자 감사값은 새 `system:privacy-worker`로 대체한다. 계정 관련 receipt·상한·session·동의·제재는
  삭제하고 moderation action의 계정 FK를 null로 바꾸는 같은 UPDATE에서 account_detached_at을 기록한다. 기존 M0 user/admin actor 규칙에는 이 system actor를 migration으로 추가한다.
- 이미 저장된 다른 회원 댓글은 삭제하지 않는다. 그 댓글 소유자는 자신의 활동 화면에서 삭제할 수 있다.
- provider_disconnect 작업은 회원 삭제 전에 필요한 최소 암호문을 분리하고 FK를 null로 바꾼다.
  네트워크 호출은 DB transaction 밖에서 수행한다. 재전송 가능 여부·간격·secret 만료는
  [외부 해제 결과별 전이표](#disconnect-outcomes)만을 따른다. 권한 철회와 회원 탈퇴 상태를 혼동하지 않는다.
- 신고 설명·운영 내부 메모는 해결 후 90일을 설계 기본 보유 기간으로 둔다. 관련 법적 근거·기간 검토
  전에는 M1.5 공개를 차단한다. 탈퇴 자체를 이유로 타인의 신고 사건을 무조건 지우지 않되 계정 연결은 제거한다.
- 매일 완료 신고 설명·내부 메모 만료 정리, 매시간 인증 임시값·세션·receipt 정리, 매분 탈퇴·해제
  worker를 실행한다. 실제 법적 보존 요청은 승인 근거·기간을 가진 별도 격리 절차 없이는 보관 예외로 적용하지 않는다.

<a id="api"></a>
## 4. API 공통 계약과 endpoint

모든 아래 path는 `/api/v1` 기준이다. `provider=naver|kakao|google|apple`, ID는 양의 10진수 문자열,
page는 1~10000 정수(기본 1), pageSize는 20 고정이다. 추가 JSON 필드는 거부한다. 표의 `?`만 선택이다.
날짜는 UTC ISO 8601이다. 사용자 입력 문자열은 잘못된 Unicode scalar sequence와 U+0000을 먼저
거부한다. 여러 줄 필드는 CRLF·CR·U+2028 LINE SEPARATOR·U+2029 PARAGRAPH SEPARATOR를 LF로
통일하고, 단일 줄 필드는 이 네 줄바꿈을 위치와 관계없이 거부한다. 이어 C0·C1 제어 문자를
거부하되 여러 줄 필드의 LF만 허용한다. 검증을 통과한 값은 NFC 정규화→ECMAScript
`String.prototype.trim` 호환 앞뒤 WhiteSpace·LineTerminator 제거 순으로 canonicalize한다.
ZWJ 같은 Unicode format 문자는
C0·C1이 아니며 기존 허용 문자열에서 code point로 센다. 길이는 Unicode code point 수로 검증한다.
단독 high/low surrogate와 U+0000은 정규화 전 400 VALIDATION_FAILED다.
성공/목록/오류 envelope는 M0와 같다.
생성은 201, 조회·변경은 200, 비동기 탈퇴는 202다. 표의 data가 없는 성공은 `data:{}`다.
삭제 API에도 JSON body를 사용한다. returnTo로의 이동은 성공 후 클라이언트 또는 callback의 303이다.

브라우저·BFF는 JavaScript `String.length`를 길이 판정에 사용하지 않는다. 이는 UTF-16 code unit
수이므로 위 공통 문자열 정규화 순서를 적용한 `canonical`에 대해
`Array.from(canonical).length`로 센다. Core의 계산이 최종 판정이며 UI counter는
같은 fixture를 쓰는 사전 안내다. PostgreSQL 18의
`VARCHAR(n)`은 byte가 아니라 character 수를 제한하지만, 암묵적 동작에만 기대지 않고 UTF8 DB에서
`IS NFC NORMALIZED`와 `char_length` CHECK를 migration에 둔다. 명시적 cast로 초과 문자열을 잘라
저장하지 않는다. 근거는 [ECMAScript String iterator](https://tc39.es/ecma262/multipage/text-processing.html#sec-string-iterator-objects),
[PostgreSQL character type](https://www.postgresql.org/docs/18/datatype-character.html),
[PostgreSQL 문자열 함수](https://www.postgresql.org/docs/18/functions-string.html)다.

| 입력 필드 | canonical 길이·줄바꿈 |
| --- | --- |
| `displayName` | 2~20 code point, 줄바꿈·제어 문자 금지 |
| 글 `title` | 1~200 code point, 줄바꿈·제어 문자 금지 |
| 글 `body` | 1~10,000 code point, LF 허용·그 밖의 제어 문자 금지 |
| 댓글 `body` | 1~1,000 code point, LF 허용·그 밖의 제어 문자 금지 |
| 신고 `detail` | OTHER는 1~500, 그 외는 0~500 code point; LF 허용·그 밖의 제어 문자 금지 |
| 운영 `publicReason` | 1~300 code point, 줄바꿈·제어 문자 금지 |
| 운영 `internalNote` | 0~500 code point, LF 허용·그 밖의 제어 문자 금지 |

M1/M1.5 migration은 위 필드의 상한과 NFC를 DB CHECK로 방어한다. `display_name`은
`char_length(display_name) BETWEEN 2 AND 20`, 댓글·신고·운영 문자열은 각 상태·필수 조건과 함께
검사한다. `content.board_post`를 재사용하는 익게 제목·TEXT block은 USER `community` board에만
적용되는 CHECK/constraint trigger로 최소·최대 길이를 강제한다. 모든 계층은 원문이 아니라 같은
canonical 문자열을 저장·반환한다.

모든 인증 endpoint는 no-store이고 callback을 제외한 쓰기는 Origin+CSRF를 요구한다.
회원 ID는 요청 body에서 받지 않는다. 일반 member 쓰기는 유효 session, 소유권과 동의·제재를 서버가 확인한다.
세션·로그아웃·동의·삭제·탈퇴는 참여 제재/재동의로 막지 않는다.

### 회원

| Method path | 요청 | 성공 data·조건 |
| --- | --- | --- |
| GET `/auth/context` | 없음 | csrfToken:string, providers:provider[], authenticated:boolean, registrationEnabled:boolean, accountAccessEnabled:boolean; 사전 인증 binding 발급 |
| POST `/auth/:provider/start` | purpose, returnTo?, delivery?:REDIRECT/POPUP(기본 REDIRECT) | authorizationUrl:string; URL은 고정 provider adapter만 생성 |
| GET 또는 POST `/auth/:provider/callback` | provider 정의 code/state 또는 error, Apple는 form-urlencoded | REDIRECT는 검증 뒤 303 `/signup/consent` 또는 저장된 returnTo; POPUP은 서버 `/auth/complete`로 303; 오류는 허용 오류 코드만 전달 |
| GET `/auth/signup` | 임시 binding cookie | displayName:string 기본 빈 값, termsPolicyId, signupPrivacyPolicyId, policy bodyHtml·versionLabel 각각, ageConfirmationRequired:true; 미인증 401 |
| POST `/auth/signup` | displayName, termsPolicyId, signupPrivacyPolicyId, termsAccepted:true, privacyAccepted:true, birthDate:YYYY-MM-DD | member DTO와 cookie; 임시 transaction 소비+계정·동의·session atomic |
| DELETE `/auth/signup` | 없음 | 임시 인증 파기, cookie 삭제 |
| GET `/me` | 없음 | member DTO |
| PATCH `/me` | displayName, lockVersion:int | member DTO |
| GET `/me/consent` | 없음 | termsPolicyId, signupPrivacyPolicyId, 각 bodyHtml·versionLabel, required:boolean |
| POST `/me/consent` | termsPolicyId, signupPrivacyPolicyId, termsAccepted:true, privacyAccepted:true | required:false; 최신 시행 버전 검증 |
| POST `/auth/logout` | 없음 | 현재 세션 삭제, cookie 만료; 이미 없음도 200 |
| POST `/auth/logout-all` | 없음 | 전체 세션 삭제, cookie 만료 |
| DELETE `/me/identities/:provider` | lockVersion:int | member DTO와 disconnectStatus:DONE/PENDING/MANUAL; 최근 재인증·마지막 수단 검사 |
| GET `/me/withdrawal-preview` | 없음 | postCount:int, commentCount:int, contentPolicy:KEEP, providers:provider[] |
| POST `/me/withdrawals` | lockVersion:int, confirmation:true | withdrawalId, status:PENDING, statusToken:string(한 번만 반환); session 즉시 취소 |
| GET `/withdrawals/:withdrawalId` | Authorization Bearer statusToken | status:PENDING/RUNNING/DONE/FAILED, providerResults:[{provider,status}], errorCode?:string; token 24시간·조회만 허용 |

탈퇴 요청은 contentAction을 받지 않는다. 서버가 콘텐츠 유무와 무관하게 KEEP으로 기록한다.
삭제 선택이나 알 수 없는 필드 입력은 400 VALIDATION_FAILED로 거부한다.

member DTO = {displayName:string, lockVersion:int, status:ACTIVE/REAUTH_REQUIRED,
reconsentRequired:boolean, identities:[{provider, status:ACTIVE/REVOKED, authenticatedAt:timestamp}],
restriction:null 또는 {reason:string, endsAt:timestamp|null}}. 일반 회원 DTO의 restriction은 위 유효
predicate가 참일 때만 반환한다. accountId·subject·email·token은 없다.
LINK callback은 `/me` 계정 version을 올리고 현재 회원에만 연결하며 다른 기존 계정에 연결된 subject면
409 IDENTITY_ALREADY_LINKED다. REAUTH callback은 member 세션 회전·재인증 시각 갱신만 한다.

탈퇴 접수 응답 유실 시 기존 세션으로 재호출해도 새 접수를 만들지 않는다. 세션 취소 때문에 401이면
로그인으로 계정을 복원하지 말고 탈퇴 진행 안내와 지원 이메일을 제공한다. statusToken은 sessionStorage에도
장기 저장하지 않고 해당 탭 메모리에서만 사용한다. 24시간 후 404이며 탈퇴가 취소된다는 뜻이 아니다.

### 익게·내 활동

| Method path | 요청 | 성공 data |
| --- | --- | --- |
| GET `/boards/community/posts` | page? | items:[{postId,title,publishedAt,viewCount:string,commentCount:int,authorLabel:string}], pinnedItems:[]; 공통 pagination meta |
| GET `/boards/community/posts/:postId` | contextPage? | postId,title,body,publishedAt,updatedAt,viewCount:string,authorLabel,context:{items, pagination}; 본문 TEXT만 합침 |
| POST `/boards/community/posts/:postId/views` | 없음 | 기존 참고 조회 수 계약, 개인 이력 없음 |
| POST `/boards/community/posts` | title, body | postId, lockVersion:1 |
| PATCH `/boards/community/posts/:postId` | title,body,lockVersion | postId,lockVersion |
| DELETE `/boards/community/posts/:postId` | lockVersion | postId,status:REMOVED,lockVersion |
| GET `/boards/community/posts/:postId/comments` | page? | items:[{commentId,body:string\|null,authorLabel:string\|null,isPostAuthor:boolean\|null,status:PUBLISHED/HIDDEN_REVIEW/REMOVED,createdAt}], 공통 pagination meta |
| POST `/boards/community/posts/:postId/comments` | body | commentId,lockVersion:1 |
| PATCH `/boards/community/posts/:postId/comments/:commentId` | body,lockVersion | commentId,lockVersion |
| DELETE `/boards/community/posts/:postId/comments/:commentId` | lockVersion | commentId,status:REMOVED,lockVersion |
| GET `/me/activity` | type:posts/comments, page? | items:[{postId,commentId?:string,title:string\|null,body:string\|null,status,lockVersion,createdAt}], 공통 pagination meta; 내부 검토 사유 없음 |
| GET `/me/community/posts/:postId/permissions` | 없음 | canEdit:boolean,canDelete:boolean,postLockVersion:int\|null,comments:[{commentId,lockVersion}]; 공개 댓글 page?(기본 1)를 함께 받아 해당 20건의 본인 댓글만 반환 |

공개 댓글 자리 표시에서는 body·authorLabel·isPostAuthor를 null로 하고 createdAt·commentId·상태만 남긴다.
숨김 글과 타 게시판 글은 상세·댓글 API 모두 일반 404다. 본인 활동은 본인이 숨김 글을 삭제할 수 있도록
ID·version·일반 상태를 보여주지만 숨김 본문은 반환하지 않는다. 타인 글이 숨겨진 경우에도
본인 댓글 삭제 endpoint는 account 소유권을 확인한 뒤 허용하며 부모 공개 여부로 삭제권을 막지 않는다.

### 신고·운영

| Method path | 요청 | 성공 data |
| --- | --- | --- |
| POST `/reports` | postId, commentId?, reasonCode, detail?:0~500 code point(OTHER는 1~500) | reportId,status:OPEN; 같은 신고면 기존 ID·현재 상태로 200 |
| GET `/me/reports` | page? | items:[{reportId,postId,commentId?,status,createdAt,resolvedAt:timestamp\|null}], pagination meta |
| GET `/admin/moderation/posts/:postId` | 없음 | postId,title:string\|null,body:string\|null,status,lockVersion,targetMemberRef:string\|null; USER board만 |
| GET `/admin/moderation/posts/:postId/comments` | page? | items:[{commentId,status,createdAt,lockVersion}], 공통 pagination meta; 숨김/삭제 포함 |
| GET `/admin/moderation/posts/:postId/comments/:commentId` | 없음 | postId,commentId,body:string\|null,status,lockVersion,targetMemberRef:string\|null; 부모 소속 검증 |
| GET `/admin/moderation/reports` | status?:OPEN/RESOLVED, page? | items:[{reportId,postId,commentId?,reasonCode,status,createdAt,lockVersion}], pagination meta |
| GET `/admin/moderation/reports/:reportId` | 없음 | 목록 필드+detail:string\|null,target:{title:string\|null,body:string\|null,status,lockVersion},actions:[{action,publicReason,createdAt}], targetMemberRef:string\|null |
| POST `/admin/moderation/reports/:reportId/resolve` | resolution:NONE/HIDE/REMOVE, publicReason:1~300 code point, internalNote?:0~500 code point,lockVersion:int,targetLockVersion:int | reportId,status:RESOLVED,lockVersion |
| POST `/admin/moderation/posts/:postId/actions` | action:HIDE/RESTORE/REMOVE,publicReason:1~300 code point,internalNote?:0~500 code point,lockVersion | postId,status,lockVersion |
| POST `/admin/moderation/posts/:postId/comments/:commentId/actions` | action:HIDE/RESTORE/REMOVE,publicReason:1~300 code point,internalNote?:0~500 code point,lockVersion | commentId,status,lockVersion |
| POST `/admin/moderation/members/:memberRef/restriction` | durationDays:1/7/30/null,publicReason:1~300 code point,lockVersion:int | status:ACTIVE,endsAt:timestamp\|null,lockVersion |
| DELETE `/admin/moderation/members/:memberRef/restriction` | publicReason:1~300 code point,lockVersion:int | status:REVOKED,lockVersion |
| GET `/admin/moderation/members/:memberRef` | 없음 | restriction:null 또는 {status,publicReason,endsAt,lockVersion}, actions:[{action,publicReason,createdAt}] |

memberRef는 관리 화면 전용 불투명 참조로 내부 account ID를 서버 키로 인증 암호화한 값이며
그 자체가 인증·권한을 부여하지 않는다. 이미 탈퇴해 연결이 없으면 null이다. 최초 제재는 lockVersion=0,
기존 제한은 실제 version을 사용한다. 모든 report는 lock_version을 가지며 처리 시 증가한다.
여러 신고가 같은 대상을 가리켜도 자동 종결하지 않고 target version 충돌을 검토자가 확인하게 한다.
일반 회원 참여 판정과 DTO는 유효 predicate만 사용하고, 관리자 회원 조회는 REVOKED·만료 row도
version과 이력 확인을 위해 반환할 수 있다. 해제 뒤 새 글·댓글·신고는 즉시 허용한다.

### 추가 조회·저장 세부

- GET `/policies/signup-privacy`는 M1에서만 SIGNUP_PRIVACY의 EFFECTIVE/RETIRED 전문을 공개한다.
  공통 정책 viewer와 artifact command가 이 유형을 인식하도록 확장하고 M0 types는 그대로 둔다.
- member list의 page 범위 초과는 200 빈 목록, 공개 글·댓글은 404 PAGE_NOT_FOUND다. 0건의 page=1은 200이다.
- 공개 context의 pagination은 {page,pageSize,totalItems,totalPages,hasPrevious,hasNext}, items는 목록 DTO다.
  상세 contextPage는 1~10000이며 생략하면 현재 글을 포함한 페이지를 조회한다.
- GET permissions는 해당 글의 로그인 회원 소유권만 반환한다. 타인의 postLockVersion=null,
  comments는 본인이 작성한 현재 댓글 page의 ID와 version만 포함한다. 숨김 글은 내 활동을 사용한다.
- commentCount는 PUBLISHED인 댓글 COUNT다. 별도 원시 활동 집계를 만들지 않는다.
- 모든 JSON 쓰기 body는 64KiB 이하, 인증 callback form은 16KiB 이하로 제한한다. 초과는 413 REQUEST_TOO_LARGE다.
- session idle_expires_at은 성공한 인증 요청에서 min(now+24시간,absolute_expires_at)으로 갱신한다.
  절대 만료와 재인증 시각을 활동만으로 연장하지 않는다.
- MEMBER=false이고 기존 계정 접근도 필요 없는 신규 배포에서만 `/auth/context`가 providers=[]를 반환한다. 회원 데이터가 남은 환경의 인증은 아래 활성화 표를 따른다. COMMUNITY=false이면 신규
  공개 익게 route는 404지만 이미 가진 회원 데이터의 삭제·계정 종료 전용 경로는 유지한다.
- 조회 DTO에 들어가는 createdAt/updatedAt/lockVersion은 해당 entity 감사 시각/version으로부터 반환한다.
  actor key, 내부 회원 FK, encrypted payload는 serializer allowlist에서 제외한다.
- 별도 회원·운영 목록의 총 건수와 페이지 조회는 같은 DB snapshot으로 읽는다. page와 count 사이의
  동시 삭제로 빈 페이지가 나타나면 재조회 안내를 주며 숨김 원문을 cache로 보충하지 않는다.

### 오류·동시 요청

| HTTP | code | 처리 |
| --- | --- | --- |
| 400 | VALIDATION_FAILED / AUTH_TRANSACTION_INVALID | 입력 또는 만료 인증 안내, state 존재 유무 세부 비공개 |
| 401 | AUTH_REQUIRED / REAUTH_REQUIRED | 로그인 또는 재인증, 편집 내용은 현재 탭 메모리에만 유지 |
| 403 | CSRF_INVALID / CONSENT_REQUIRED / PARTICIPATION_RESTRICTED / AGE_REQUIREMENT_NOT_MET | 재동의·제재 안내; 동의·제재 오류는 삭제·계정 종료에 적용하지 않으며 연령 오류는 신규 가입에만 적용 |
| 404 | POST_NOT_FOUND / COMMENT_NOT_FOUND / RESOURCE_NOT_FOUND / FEATURE_DISABLED / PAGE_NOT_FOUND | 소유하지 않은 리소스, 숨김/삭제/잘못된 게시판은 같은 응답 |
| 409 | VERSION_CONFLICT / POLICY_CHANGED / IDENTITY_ALREADY_LINKED / IDENTITY_DISCONNECT_PENDING / LAST_IDENTITY / STATE_CONFLICT | 최신 조회 후 사용자가 다시 판단, 자동 덮어쓰기 금지 |
| 409 | IDEMPOTENCY_CONFLICT / IDEMPOTENCY_IN_PROGRESS | key 입력 충돌 또는 진행 중, 지수 backoff |
| 413 | REQUEST_TOO_LARGE | 요청 크기를 줄여 다시 제출 |
| 429 | RATE_LIMITED | Retry-After 초 단위, 사용자 입력 보존 |
| 503 | DEPENDENCY_UNAVAILABLE / ALIAS_ALLOCATION_UNAVAILABLE | provider·DB 장애 또는 이름 배정 실패, 읽기 가능한 기능과 편집 입력 유지 |

글·댓글 생성·수정·삭제, 신고와 운영 조치는 Idempotency-Key(1~128 ASCII)를 필수로 받는다.
정규화한 `{params,body}` SHA-256과 actor+method+route+key를 기준으로 advisory lock→동일 receipt
조회→domain 변경→receipt insert 순서다. 동시에 진행 중이면 409, 같은 key 다른 입력이면 409,
완료 같은 입력이면 새 requestId envelope에 기존 최소 결과를 재생한다. 현재 인증·탈퇴·소유권은
재생 전에 검사하고 version/이미지 상태는 재생 뒤에 검사한다. 계정 종료 후 예전 성공 응답을 노출하지 않는다.
기존 리소스 수정·삭제·탈퇴는 계약상 lockVersion을 검증하며 신규 글·댓글 생성에는 입력 version을 요구하지 않는다. rate bucket·도메인 변경도 같은 transaction에 둔다.

### 내부 OAuth·알림 route

| Core 전용 route | 입력·결과 |
| --- | --- |
| POST `/internal/v1/identity/auth-transactions` | provider?,purpose,delivery,returnTo,account session? → 서버 난수·transaction; CONTEXT는 provider 없음 |
| POST `/internal/v1/identity/auth-transactions/claim` | state,binding,provider → 단회 선점·검증 자료 |
| POST `/internal/v1/identity/auth-transactions/complete` | [VerifiedIdentityMaterial](#identity-material) → 가입 임시 상태 또는 session/LINK/REAUTH 결과 |
| POST `/internal/v1/identity/provider-events` | eventId:string,provider,subject:string,eventType:string,occurredAt:timestamp\|null,verifiedAt:timestamp → 중복·현재 세대 확인 후 처리 |

외부 `/api/v1/auth/:provider/notifications` POST는 provider adapter가 서명·issuer·audience·timestamp와
replay를 검증한 알림만 Core로 보낸다. 외부 일반 CSRF 예외이나 서비스 token으로 위장한 사용자
요청을 허용하지 않는다. provider별 검증 계약이 없는 adapter의 알림 route는 404로 비활성이다.
서명 없는 알림만으로 계정을 삭제하지 않는다. 알림 receipt는 `identity.request_receipt`의
provider 이벤트 scope와 event ID로 24시간 중복 제거한다. provider가 재전송해도 상태 전이는 멱등이다.
Apple consent-revoked도 아래 해제 경합 규칙의 현재 세대 확인 후에만 세션 취소·REVOKED로 전환한다. 계정 삭제 요청은 다른 연결 제공자와 사용자 콘텐츠 처리 정책까지 확인하며 이벤트 수신만으로 계정 전체를 삭제하지 않는다.

<a id="operations"></a>
## 5. migration·운영·복구

설계 상태별 작업 순서:

1. M1 migration·정책 artifact 확장 → provider mock/계약 테스트 → 회원 UI → 실제 네 provider 검증.
2. M1.5 migration·비활성 board → 참여 command·권한 테스트 → 운영 검토 → 탈퇴/복원 통합 테스트.
3. 각 단계 gate를 따로 확인하고 flag를 활성화한다. 단계 실패가 M0 수동 발행을 멈추게 하지 않는다.

- M1: identity·rate bucket 테이블·SIGNUP_PRIVACY 정책 유형·system:privacy-worker 감사 CHECK·인증 secret mount·cron 추가. M0 테이블 삭제 없음.
- M1.5: community/moderation·USER board seed·회원 탈퇴 콘텐츠 처리 확장.
- 실제 migration 번호는 구현 worktree의 최신 번호 다음으로 할당한다. 이 docs 브랜치에서 번호를 추정하지 않는다.
- app/backup role에 단계별 schema USAGE·table/sequence 최소 권한을 추가하며 app DDL 권한은 주지 않는다.
- `MEMBER_ENABLED`는 회원 기능 신규 제공(가입·새 연결)을, `ACCOUNT_ACCESS_ENABLED`는 기존 계정
  로그인·재인증·관리 접근을, `COMMUNITY_ENABLED`는 익게 신규 참여·공개를 제어한다. 신규 배포 기본값은 모두 false다.

| 상태 | MEMBER | ACCOUNT_ACCESS | COMMUNITY | 허용 |
| --- | --- | --- | --- | --- |
| M0 신규 | false | false | false | 회원 없음, providers=[] |
| M1 운영 | true | true | false | 가입·로그인·연결·계정 관리 |
| M1.5 운영 | true | true | true | 회원·익게 참여 |
| 가입 중단 | false | true | true 또는 false | 기존 회원 로그인·재인증·참여(익게가 true일 때), 새 가입·LINK 금지 |
| 계정 정리 | false | true | false | 기존 회원 로그인·재인증·본인 삭제·탈퇴·운영 조치 |

MEMBER=true 또는 COMMUNITY=true이면 ACCOUNT_ACCESS=true여야 한다. 회원·연동·처리 중 탈퇴가
남아 있으면 ACCOUNT_ACCESS=false 전환을 배포 gate에서 거부한다. 계정 정리 상태에도 기존 연결
provider 설정과 callback은 유지하며 context.providers는 기존 계정 접근용 제공자를 반환한다.
비회원 LOGIN 결과가 기존 subject에 없으면 일반 가입 중단 안내만 반환하고 임시 가입·회원 생성은 하지 않는다.
REAUTH는 현재 계정과 동일 subject임을 재검증하고 LINK는 MEMBER=false에서 거부한다.
flag를 끄더라도 삭제 worker·관리자 숨김·복구·필수 동의 조회는 중단하지 않는다. provider 자체 장애나
침해로 인증이 불가능하면 공개 읽기를 유지하면서 검증된 문의 채널의 수동 본인 확인 절차로 처리한다.
- 키 배치·암호화/해시 생성 책임은 [내부 인증 자료 계약](#identity-material)의 표를 따른다.
- 확정 callback 도메인/client ID/secret/키 식별자, 알림 URL, 법무 시행일은 `(미정)`이며 환경 값으로 관리한다.
- 신규 worker: `members:cleanup`, `members:withdraw`, `members:disconnect`, `moderation:cleanup`.
  정의한 작업의 장애·지연 건수만 운영 지표에 추가하고 본문·회원 식별자를 외부 알림에 싣지 않는다.
- Apple 상태 확인은 adapter가 하루 최대 한 번 수행하고 일시 통신 실패를 철회로 간주하지 않는다.
  확인 실패의 수동 검토 경고와 실제 revoked 처리 결과를 분리한다.
- 백업은 기존 14일 daily·8주 weekly 순환을 유지한다. 탈퇴 삭제 요청 ledger는 최소 account opaque ID·
  처리 시각·contentAction만 별도 암호화 backup prefix에 8주 보관하는 설계다. 이 보존의 법적 근거는
  공개 전 확인한다. 복원 시 ledger를 적용해 탈퇴·삭제를 재실행하고 세션 전체 무효화 후 공개한다.
  ledger 미확보 복원은 공개 차단한다. 삭제 ledger에는 subject·token·본문을 담지 않는다.
  복원 대상 backup은 생성 당시 identity sequence high-water mark와 ledger watermark를 manifest에 남긴다.
  ID sequence는 보관 중 ledger의 최대 account ID보다 큰 값으로 복원해 이후 신규 회원 ID 재사용을 막는다.
  만료된 backup을 순환 밖에서 재사용하지 않는다. 새 backup 공개 전에 처리 중 탈퇴와 ledger 누락을 점검한다.
- 장기간 RUNNING/FAILED 탈퇴는 경고하고 cursor부터 재처리한다. 외부 해제 작업의 응답 유실·
  DB 기록 전 장애는 UNKNOWN으로 분류하며 무조건 재전송하지 않는다. 아래 전이표로 처리한다.

<a id="acceptance"></a>
## 6. 구현 수용 검증과 공개 gate

아래는 실행할 테스트 목록이며 이번 문서 작업에서 실행하지 않았다.

| 계층 | 필수 시나리오 |
| --- | --- |
| 계약 | 모든 endpoint body·추가 필드·ID·enum·오류, callback content-type, envelope·최소 공개 필드 |
| 인증 | state/nonce/issuer/audience 변조, code 재사용, 다른 browser binding, Apple form_post, 로그인 CSRF·open redirect, cookie 회전 |
| DB | 동시 가입 unique, 양쪽 연동 동시 해제, 정책 발행과 가입 경쟁, 댓글 랜덤 이름 경쟁, version 충돌·멱등·상한 rollback |
| 권한 | 다른 회원 수정·삭제, admin header 위장, 숨김 원문 누출, 제재·탈퇴와 글쓰기 경쟁, M0 USER 관리자 API 우회 |
| 탈퇴 | 콘텐츠 KEEP 고정·삭제 선택 거부, 기존 숨김/삭제 상태·타인 댓글 보존, receipt·감사·FK 제거, 외부 timeout, worker 중단 재시작, 백업 restore 삭제 재적용 |
| UI | 네 provider 성공/취소/장애, 동의 변경, 만료·429 입력 유지, 360/768/1280px, 키보드·focus·aria-live |
| 회귀 | M0 공개 목록·상세·조회 수·운영자 수동 발행과 비활성 GA4 동작 유지 |

공개 차단은 [법무 README](../legal/README.md)를 따른다. 설계 기본값으로 연령 확인·보존 기간을
기술적으로 정했다고 적법성이 확정된 것은 아니다. mock adapter로 로컬 개발할 수 있으나 실제 제공자
등록·계약 테스트·법무 고지·복원 시험 없이 M1/M1.5 운영 준비 완료라고 판정하지 않는다.

<a id="disconnect-races"></a>
## 7. 연동 해제·재연결·지연 알림의 경합

- provider+subject 단위 `identity_guard`를 먼저 lock하고 account→identity→job 순서로 lock한다.
  LINK·로그인 복구·가입 완료·해제·탈퇴 worker가 같은 순서를 따른다. 복수 provider는 provider+hash
  정렬순으로 guard들을 선점한다. guard 없는 신규 주체는 unique insert 후 다시 잠근다.
- 정상 연동은 generation UUID를 서버가 새로 발급한다. 해제는 guard DISCONNECTING과 이전 generation의
  작업을 같은 transaction으로 생성한 뒤 로컬 연동을 제거한다. 외부 작업에 token·원문 subject를 로그하지 않는다.
- DISCONNECTING/QUARANTINED인 동일 주체는 LOGIN 복구·LINK·신규 가입을 모두
  `409 IDENTITY_DISCONNECT_PENDING`으로 거부한다. 다른 연결 제공자의 계정 접근·탈퇴는 유지한다.
- worker는 generation 일치와 guard를 확인하고 RUNNING+lease_until을 commit한 뒤 외부 호출한다.
  외부 I/O 동안 DB lock을 유지하지 않지만 guard는 계속 차단 상태다. 완료 기록은 generation과 lease를 다시 검사한다.
- 호출 timeout·process crash·lease 만료는 외부 성공 여부 불명이므로 job UNKNOWN,
  guard QUARANTINED로 전환한다. secret은 최초 작업 생성 후 최대 24시간이며 재시도로 기한을 늘리지 않는다.
  secret 파기는 재연결 허용을 뜻하지 않는다. 재전송·상태 확인·종료는 아래 전이표만 따른다.
  단순 로컬 버전 비교로 이미 전송된 외부 요청을 취소할 수 있다고 가정하지 않는다.
- 해제 성공과 실행 중 요청 없음이 확인되면 guard를 해제하고 재연결 시 새 generation을 발급한다.
  MANUAL은 제공자에서 수동 해제했음을 현재 상태 확인 또는 검증된 운영 확인으로 판정한 뒤에만 해제한다.
- 연동 중 guard는 유지한다. 성공 종료 뒤 계정 없는 guard는 terminal job의 보존 만료·삭제 뒤 정리한다. guard FK를 가진 job을 먼저 삭제해 RESTRICT 위반을 막는다. 불명확 작업의 최소 provider·hash·
  generation·시각만 최대 30일 보유하는 설계 기본값을 둔다. 30일 내 해결하지 못하면 해당 provider의
  신규 연결·가입을 중단한 뒤 최소 기록을 파기한다. 보존 근거·실제 확인 방법이 확정되지 않으면 provider 공개를 차단한다.
- 지연 알림의 인증은 신호의 출처만 증명한다. 현재 연결보다 오래된 신뢰 가능한 occurredAt이면
  현재 연결에 적용하지 않는다. 시각·generation 귀속이 불명확하면 현재 credential 상태를 확인한다.
  재연결 이전 token으로 확인하지 않는다. 현재 연결에 대한 철회가 확인되기 전 새 연동·계정을 삭제하지 않는다.
- 이벤트 귀속/현재 상태 확인 기능이 없는 provider는 지연 알림을 근거로 자동 삭제하지 않고 운영 검토로 보낸다.
  알림 확인 실패를 성공으로 덮지 않으며 adapter별 처리·재시도·수동 경로를 실제 provider 테스트로 검증한다.

<a id="identity-material"></a>
## 8. 내부 인증 자료와 키 소유권

| 자료 | 생성·검증 | 전달·보관 |
| --- | --- | --- |
| provider subject 원문 | BFF가 고정 provider adapter로 인증 결과를 검증 | Core complete/event의 인증된 TLS 내부 요청에서만 일시 수신; 요청 log/APM 제외 |
| subject_hash | Core가 `HMAC(subjectKey, provider + NUL + subject)` 생성 | DB 32-byte hash; subjectKey와 버전은 Core·전용 migration command만 보유 |
| subject_ciphertext | BFF가 별도 AEAD subjectKey로 암호화 | Core는 불투명 envelope 저장, 일반 Core HTTP는 복호화 불가 |
| Apple refresh ciphertext | BFF credential adapter가 별도 AEAD credentialKey로 암호화 | credential 테이블, 전용 철회/상태 확인 command만 복호화 |
| 회원 actor HMAC | Core가 별도 actorKey로 account ID 가명화 | 감사 열만, subject 조회 키와 분리 |

위 표의 subjectKey는 HMAC용과 AEAD용을 서로 다른 secret 이름
`IDENTITY_SUBJECT_HMAC_KEY`와 `IDENTITY_SUBJECT_AEAD_KEY`로 주입한다. credential은
`IDENTITY_CREDENTIAL_AEAD_KEY`, actor는 `IDENTITY_ACTOR_HMAC_KEY`다. 실값은 문서에 쓰지 않는다.

VerifiedIdentityMaterial 필수 필드는 transactionId:양의 정수 문자열, provider:고정 enum,
subject:빈 값 아닌 provider 문자열(최대 1024 UTF-8 bytes), verifiedAt:UTC 시각,
freshAuthenticatedAt:UTC 시각|null, subjectEnvelope:Envelope다. 선택 필드는
appleRefreshEnvelope:Envelope이며 APPLE에서만 허용한다. 알 수 없는 필드는 거부한다.
Envelope={keyVersion:양의 정수, contextId:UUID, nonce:base64url, ciphertext:base64url, tag:base64url}다.
암호화는 AES-256-GCM, nonce 12 bytes·tag 16 bytes, AAD는 provider+자료유형+contextId+keyVersion의
명시적 순서 JSON 배열 UTF-8 bytes다. contextId는 BFF가 생성하고 envelope와 함께 저장한다.
DB 열 ciphertext에는 envelope의 JSON UTF-8 bytes를 저장하며 key_version은 envelope와 일치해야 한다.
row ID를 AAD로 가정하지 않아 가입 이전 임시 암호문을 정식 row로 옮길 수 있다.

Core는 BFF 서비스 인증, transaction 선점·만료·provider·purpose·bound account/session을 검증한다.
REAUTH는 검증 subject가 bound account의 기존 연동인지 Core가 확인한다. LINK는 시작한 회원의 현재 세션·최근 재인증을 재확인하고 새 subject가 다른 계정에 속하지 않는지 검사한다. BFF의 accountId 입력은 받지 않는다.
전달받은 원문으로 HMAC을 생성하고 원문은 DB·receipt·event log에 저장하지 않는다. 신규 가입 임시값에는
hash·암호문 envelope만 남긴다. BFF는 같은 검증 subject로 원문과 envelope를 만들고 상호 불일치 테스트를 수행한다.

credential 복호화 키는 BFF와 전용 members:disconnect/상태 확인 command에만 mount한다.
subject 복호화 키는 BFF·전용 철회/키 회전 command에만 준다. 일반 Core HTTP는 HMAC만 계산한다.
암호화 키 교체는 복호화 가능한 자료만 새 envelope로 재암호화한다. HMAC 키는 별개이며 아래
조회 키 병행 계약을 따른다. 삭제한 원문을 키 교체 목적으로 복구하거나 새로 장기 보관하지 않는다.

<a id="auth-continuation"></a>
## 9. 편집 중 인증과 복귀

편집 도중 401 재로그인은 `delivery=POPUP`을 사용한다. 사용자 클릭으로 빈 인증 창을 먼저 열고
start 성공 뒤 그 창만 authorizationUrl로 이동한다. 부모 편집 페이지는 이동·새로고침하지 않으므로
입력은 부모 메모리에 유지한다. popup 차단이면 입력을 그대로 둔 채 허용 안내·재시도·내용 복사를 제공한다.
부모 페이지를 외부 로그인으로 강제 이동하거나 같은 탭 이동 후 내용 복구를 보장하지 않는다.

POPUP LOGIN은 기존 회원만 인증하며 신규 subject이면 가입 전환 없이 부모 화면에서 일반 가입 절차를 따르도록 안내한다. REDIRECT LOGIN에서만 신규 가입으로 진입한다. POPUP callback은 서버 전용 `/auth/complete`를 렌더링한다. 완료 페이지는 credential·사용자 자료를
opener/postMessage/URL로 전달하지 않으며 창 닫기와 부모 화면의 `인증 완료 확인` 사용을 안내한다.
부모는 해당 버튼에서 GET auth/context로 CSRF를 새로 받고 GET me 및 글/댓글 permissions로
현재 세션·동의·소유권을 다시 검증한다. popup 닫힘·페이지 메시지만으로 인증 성공을 판정하지 않는다.
다른 계정 로그인으로 수정 권한이 없으면 제출을 막고 원래 계정 재인증 또는 내용 복사·취소를 제공한다.
일반 신규 글도 인증 후 사용자에게 내용 확인을 요구하고 자동 제출하지 않는다. 부모 탭 종료·새로고침 시 보존은 보장하지 않는다.

REDIRECT의 returnTo는 검증한 상대 경로만 서버 transaction에 저장한다. `/account/withdraw`와
`/account/consent` 복귀 시 preview/최신 정책을 다시 조회하며 삭제·동의·연결 해제를 자동 실행하지 않는다.
필수 재동의로 이동해야 하는 편집자는 부모 화면에서 동일 재동의 UI를 dialog로 열어 입력을 유지한다.
전문 조회·POST me/consent 성공 뒤 참여 권한을 다시 검사한다. 독립 `/account/consent` 경로도 유지한다.

## 10. 이번 보완의 필수 수용 시나리오

아래는 설계 검증 입력이며 실행 테스트 통과 기록이 아니다.

1. 외부 해제 timeout→재연결 시도 차단→오래된 worker 재개, secret 만료 후에도 차단 유지, 지연 알림과 새 연결 구분.
2. MEMBER=false·ACCOUNT_ACCESS=true에서 기존 회원 로그인·5분 재인증·탈퇴 성공, 신규 가입/LINK 거부.
3. 신고 없는 숨김 댓글을 관리자 조회→현재 version으로 숨김/복원, 대상 memberRef로 제재; 일반 회원 접근 거부.
4. 편집 401→인증 팝업→부모 입력 유지→CSRF 갱신·소유권 확인, 팝업 차단·다른 계정·부모 새로고침 처리.
5. 탈퇴·재동의 returnTo 허용과 외부 URL/인코딩 우회 거부, 복귀 후 자동 실행 없음.
6. 원문 subject의 DB/log 미잔존, HMAC provider 분리, envelope AAD·keyVersion 변조·키 회전, Core HTTP 복호화 키 미주입.
7. REVOKED 무기한·REVOKED 미래 종료·만료 ACTIVE·시작 전 ACTIVE는 참여 허용, 현재 유효 ACTIVE만 글·댓글·신고 거부.
8. 표시명·제목·본문·댓글·신고·운영 문구의 한글 NFC, 보조평면 emoji, ZWJ sequence, 결합문자,
   최소·최대·최대+1 code point, CRLF→LF, ECMAScript trim 경계, U+0000·C0/C1·단독 surrogate 거부를
   UI·Core·PostgreSQL에서 같은 결과로 검증.

<a id="hash-key-rotation"></a>
## 11. 원문 없는 차단 기록의 HMAC 키 교체

- 조회용 keyring은 current 쓰기 키 1개와 retiring 조회 키들로 구성한다. 기존
  social_identity·identity_guard에는 저장 당시 hash_key_version을 유지한다. 새 row만 current 키를 쓴다.
- 검증된 provider subject를 받은 Core는 모든 조회 키로 후보 hash를 계산한다. 각 후보의
  (provider, hash_key_version, hash)를 정렬한 순서로 transaction advisory lock을 얻고,
  social_identity와 guard를 모든 후보에 대해 조회한다. 기존 차단이 하나라도 있으면 새 키의 row를 만들지 않는다.
  후보 잠금 뒤 guard row→account→identity→job 순서로 진행한다. §7의 guard 선점에는 이 후보 잠금이 포함된다.
- 후보가 기존 정상 연동을 찾으면 그 row를 재사용한다. 서로 다른 계정을 가리키는 복수 후보는
  자동 병합하지 않고 충돌로 차단한다. UNIQUE(provider,subject_hash)만으로 키 간 동일 주체를 판별한다고 가정하지 않는다.
- 교체 시 인증·LINK·가입·해제 및 guard를 변경하는 worker를 잠시 중지·drain한다. 모든 인스턴스에
  동일한 새 current+이전 retiring 목록을 배치·확인한 뒤 재개한다. 구 keyring만 쓰는 인스턴스가
  쓰기를 계속하면 후보 잠금이 달라지므로 혼용 배포를 허용하지 않는다. 공개 읽기는 유지한다.
- 정상 연동에 보관된 subject 암호문은 전용 migration command에서만 복호화해 새 hash로 이관할 수 있다.
  원문이 없는 탈퇴 guard는 이관하지 않고 기존 키로 남은 보존 기간 동안 비교한다. 조회·키 교체로
  guard의 보존 기한을 연장하지 않는다.
- retiring 키는 해당 버전을 참조하는 모든 살아 있는 identity/guard가 이관·만료되고 작업이 종료된 뒤
  온라인 keyring에서 제거한다. 암호화 backup의 manifest에는 필요한 키 버전을 기록한다.
  해당 backup 보존이 끝날 때까지 복구용 키는 격리 보관하고, 복원은 키·최신 삭제 ledger·필요 keyring을
  재구성한 뒤 인증 쓰기를 허용한다. 키를 확보할 수 없으면 인증 쓰기는 차단한다.
- 키 침해로 즉시 폐기가 필요한 경우 키 없는 기존 guard를 무시하고 새 가입을 허용하지 않는다.
  해당 provider의 신규 가입·연결을 차단하고 기존 계정 접근·삭제를 위한 사고 대응 경로를 적용한다.

<a id="disconnect-outcomes"></a>
## 12. 외부 해제 결과별 전이표

이 표가 모든 해제 worker·운영 재처리의 단일 기준이다. FAILED는 명시적 영구 실패,
UNKNOWN은 외부 실행 여부 불명이다. MANUAL은 수동 확인 필요이며 성공을 뜻하지 않는다.

| 관찰 결과 | job / guard | 자동 재전송 | 다음 처리 |
| --- | --- | --- | --- |
| 외부 요청이 전송되지 않았음을 증명 | PENDING / DISCONNECTING | 가능 | 1분→5분→30분→2시간, 이후 2시간; secret 유효기간 안에서만 |
| provider가 미적용·재시도 가능을 명시 | PENDING / DISCONNECTING | 가능 | 위 간격, provider Retry-After가 길면 그 값을 우선 |
| 완료 또는 이미 해제됨을 해당 주체에 대해 확인 | DONE / 해제 가능 | 불필요 | 진행 중 요청 없음 확인 뒤 차단 해제 |
| timeout·응답 유실·연결 중단·lease 만료·성공 응답 후 DB 기록 실패 | UNKNOWN / QUARANTINED | 금지 | 상태 확인·운영 확인으로 전환; HTTP 5xx만으로 미적용을 추정하지 않음 |
| 명시적 영구 거절·잘못된 자격 증명 | FAILED / QUARANTINED | 금지 | 설정 수정·수동 확인; 외부 미적용이 증명돼야 재처리 가능 |
| secret 24시간 만료, 미완료 | MANUAL / QUARANTINED | 금지 | 암호문 secret 파기, 최소 guard만 보존 |

UNKNOWN에서 현재 상태가 해제됨이고 이전 요청도 더 이상 실행 중이 아님을 확인하면 DONE이다.
아직 연결되어 있음만으로 이전 요청 미실행을 단정하지 않는다. 미적용·진행 중 요청 없음이 확인되고
secret이 유효한 경우만 UNKNOWN/FAILED→PENDING으로 전환한다. 이를 판정할 기능이 없는 provider는
MANUAL 경로를 유지한다. 확인 시각·오류 코드만 기록하고 원문 응답·credential은 기록하지 않는다.

불명확 작업은 secret 만료 후에도 같은 generation과 guard를 유지한다. 최대 30일 보존·provider 신규
연결 중단·파기는 §7과 제품 정책을 따른다. 재시도·수동 확인으로 최초 보존 기한을 갱신하지 않는다.

<a id="restriction-detachment"></a>
## 13. 탈퇴 후 제재 이력의 계정 연결 제거

`moderation.action.account_detached_at`은 TIMESTAMPTZ(3) NULL 허용이다. RESTRICT/UNRESTRICT에는
다음 행 단위 제약을 적용한다.

```sql
CHECK (
  action NOT IN ('RESTRICT', 'UNRESTRICT')
  OR (account_id IS NOT NULL AND account_detached_at IS NULL)
  OR (account_id IS NULL AND account_detached_at IS NOT NULL)
)
```

- INSERT 검증 trigger는 RESTRICT/UNRESTRICT 생성 시 account_id 필수·account_detached_at NULL을
  강제한다. 따라서 위 CHECK의 분리 완료 형태를 이용한 대상 없는 최초 제재 이력 생성을 막는다.
- 탈퇴 worker는 잠근 WITHDRAWING 계정의 기존 이력만 account_id=NULL,
  account_detached_at=서버 현재 시각으로 한 UPDATE에서 변경한다. UPDATE 검증 trigger는
  기존 account_id의 계정 상태와 이 두 열의 동시 전환을 확인한다. 일반 관리 API는 이 열을 입력받지 않는다.
- 연결 제거 후 다시 account_id를 붙이거나 detached 시각을 바꾸는 UPDATE는 거부한다. 공개 사유·
  조치·처리 시각은 그대로 남기고 다른 회원에게 과거 제재를 승계하지 않는다.
- FK는 RESTRICT를 유지한다. 이력 연결 제거→현재 restriction 삭제→나머지 계정 참조 정리→
  account 삭제 순으로 실행한다. worker 재시작 시 이미 연결 제거된 행은 다시 수정하지 않는다.
- 관리 화면은 계정 연결 없는 이력을 과거 처리로만 보여주고 제재·해제 버튼을 제공하지 않는다.

추가 수용 검증(미실행): 원문 없는 구키 guard와 새키 가입의 동시 요청·차단 유지, keyring 혼용 배포 거부,
해제 미전송/5xx/응답 유실/secret 만료별 전이, 제재 이력 생성 시 null 거부·탈퇴 시 분리 허용·FK 삭제 성공·재연결 거부.

<a id="signup-birth-date"></a>
## 14. 가입 생년월일 입력과 연령 판정

- 네 제공자 모두 POST `/auth/signup`의 `birthDate`를 직접 입력받는다. 소셜 프로필 생일이나
  로그인 성공으로 대체하지 않는다. 필수 수집·이용 동의 전문에 일시 처리 목적·항목·폐기를 포함한다.
- BFF는 HTTPS 요청 body로 Core에 전달하고 Core가 실제 달력의 `YYYY-MM-DD` 날짜를 검증한다.
  누락·잘못된 날짜·미래 날짜는 `400 VALIDATION_FAILED`, 만 14세 미만은 `403 AGE_REQUIREMENT_NOT_MET`이다.
- 기준일은 Core 서버의 Asia/Seoul 현재 날짜다. 현재 연도에서 출생 연도를 뺀 뒤, 올해 생일의
  월·일이 아직 지나지 않았으면 1을 뺀다. 결과가 14 이상이어야 한다. 2월 29일생은 평년 3월 1일부터
  해당 연령을 허용하는 보수적 설계 기준을 사용하며 연령 확인 방식과 함께 법무 검토한다.
- 실패하면 계정·동의·session·age_confirmed_at을 생성하지 않는다. 입력 오류 수정은 기존 임시 인증
  유효 시간 안에서 허용하고 기존 가입 rate 제한을 적용한다. 입력값으로 검증된 실명 연령이라고 표시하지 않는다.
- birthDate는 DB·임시 인증 payload·멱등 receipt·요청 hash·로그·오류 추적·분석 이벤트·URL·브라우저 저장소에
  남기지 않는다. BFF/Core 요청 body 수집과 오류 보고에서 제외하며 응답에도 되돌려주지 않는다.
  처리 후 서버 원문을 폐기하고 성공·취소·이탈 시 화면 입력 상태를 비운다. 동의 전문 갱신으로 재입력할 수 있다.
- 미실행 수용 시나리오: 14세 생일 전날/당일, 한국 날짜 자정, 2월 29일·잘못된 날짜·미래 날짜,
  누락·구형 ageConfirmed 요청 거부, 네 제공자 동일 판정, 실패 시 회원 생성 없음, 로그·receipt 원문 미잔존.

<a id="random-name-assignment"></a>
## 15. 글별 랜덤 이름 배정

- 원문 사전과 조합 규칙은 [기획 사전](../planning/09-random-name-catalog.md)을 따른다. Core가 버전별
  유효 조합을 생성·중복 제거한 불변 목록으로 관리한다. 실시간 외부 생성 API나 LLM을 호출하지 않는다.
- account → post 순서로 잠근 후 기존 (post_id,account_id) participant가 있으면 그대로 사용한다.
  없으면 암호학적 난수로 유효 조합을 선택한다. account ID/hash·생일·가입순서를 난수 seed로 쓰지 않는다.
- 해당 글에서 이미 사용한 이름과 해당 계정이 다른 글에서 사용한 이름은 제외한다. 두 UNIQUE 제약으로
  동시성을 보장한다. 다른 회원의 다른 글 이름과는 중복 가능하다. 전역 공개 ID나 이름 검색 기능을 제공하지 않는다.
- 최대 64회 무작위 시도 후 무작위 시작점부터 유효 목록을 순환하며 최대 1024개를 검사한다.
  확보하지 못하면 `503 ALIAS_ALLOCATION_UNAVAILABLE`과 Retry-After:60을 반환하고 transaction 전체를
  rollback한다. 중복 이름·숫자 접미사로 우회하지 않는다. 고갈 경보 후 검토된 사전을 확대한다.
- participant의 label·version은 불변이다. 댓글을 모두 삭제해도 예약을 남겨 동일 글 재참여 시 재사용한다.
  계정이 있는 동안 과거 이름 중복 방지 인덱스를 유지한다. 탈퇴 시 account_id를 null로 바꾸되 label은 유지한다.
  재가입 계정에 과거 이력을 연결하지 않는다. post_author와 comment가 participant를 참조하므로
  글쓴이 탈퇴 후에도 이름과 배지가 보존된다. 공개에서는 participant_id·사전 인덱스·계정 연결을 반환하지 않는다.
- label은 NFC 정규화 후 1~32 Unicode code point, 단어 사이 공백 하나이며 전체 label로 unique 비교한다.
  사전 확장 시 과거 버전과 중복될 수 있으므로 version이 아니라 label 기준으로 제외한다.
- 공개 글 목록·상세의 authorLabel은 post_author의 participant 이름이다. 댓글 authorLabel은 participant 이름,
  isPostAuthor는 원글 작성자 배지 여부다. 저장된 comment.is_post_author는 post_author.participant_id 일치 결과와 같아야 하며 INSERT 검증으로 강제한다. 숨김/삭제 댓글의 body·authorLabel·isPostAuthor는 모두 null이다. 사용자 입력으로 이 필드를 받지 않는다.
- 미실행 검증: 같은 글 재참여 고정·다른 글 재사용 거부, 동일 글 동시 최초 댓글·글 생성 rollback,
  글쓴이 탈퇴 후 배지 유지, 사전 교체 후 기존 이름 유지, 충돌·고갈 오류 시 사용량/receipt rollback,
  숨김 이름 누출 없음, 계정 삭제 후 연결 제거, 백업 복원 후 이름·계정 분리 재적용.

## 16. 정책 변경 통합 대조 결과

2026-09-08 문서 대조 결과다. 아래는 계약 연결을 확인한 것이며 구현 테스트 통과가 아니다.

| 변경 | 제품·화면 | API·DB·실패 처리 | 복원·검증 |
| --- | --- | --- | --- |
| 글별 랜덤 이름 | 사전 §1–5, 같은 글 고정·다른 글 변경·배지 | §15, participant 필수·이름 고유 제약·배정 실패 전체 rollback | 사전 변경에도 label 유지, 탈퇴 FK 제거 뒤 배지 보존 |
| 소셜 최소 수집 | 서비스 기획 M1, 직접 표시명·생일 입력 | provider 최소 scope, 불필요한 프로필 미저장 | provider별 실제 반환값·로그 검증 미실행 |
| 연령 판정 | 생년월일 입력, 미성년 가입 거부 | §14, Core 한국 날짜 판정·원문 미보관 | 생일 경계·연령 거부·로그 미잔존 미실행 |
| 가입 동의 전문 | legal 전문 초안·개별 필수 동의 | 현행 정책 ID 두 개 검증·원자적 가입 | 정책 교체 경쟁·동의 원문 artifact 검증 미실행 |
| 탈퇴 KEEP | 삭제 선택 없음·편집 불가 안내 | 입력 contentAction 없음·서버 KEEP 고정·기존 콘텐츠 상태 유지 | ledger는 회원 연결 제거 재적용, 콘텐츠 삭제/재공개로 변환 금지 |
| 계정 이력 분리 | 개인정보 삭제·이의제기 경로 | §13, 제재 이력 분리와 계정 FK 삭제 순서 | worker 재시작·백업 복원·재연결 거부 미실행 |

동의 전문 법무 검토·운영 발행, 사전 전체 조합 적절성 검수, provider 운영 설정과 실행 검증은 여전히
공개 조건이다. 이번 검토로 해당 조건을 완료 처리하지 않는다.
