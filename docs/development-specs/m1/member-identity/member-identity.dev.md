# 회원 인증·가입·필수 동의 기능 명세

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

- milestone: M1. 비회원 신규 가입, 기존 회원 인증·재인증, 필수 재동의.
- 진입: 로그인, 회원 참여 진입, 계정 민감 동작. 네 provider adapter가 동일 회원 서비스를 사용한다.
- 제외: 계정 병합, 이메일 비밀번호 로그인, 선택 분석 동의, 익게 구현.

## 2. 요구사항 추적

| 제품 요구 | API | 처리 | 화면 |
| --- | --- | --- | --- |
| 제공자 인증·취소·오류 | context/start/callback | [인증](#d01-login) | [로그인](#d08-login) |
| 신규 별도 필수 동의 | signup GET/POST/DELETE | [가입](#d01-signup) | [가입 동의](#d08-signup) |
| 최신 필수 동의 | me/consent GET/POST | [재동의](#d01-consent) | [재동의](#d08-consent) |

<a id="api-auth"></a>
## 3. API 업무 계약

Consumer는 browser·provider callback, 외부 provider는 Nuxt BFF, 저장 provider는 Core다.
`GET /auth/context`, `POST /auth/:provider/start`, `GET|POST /auth/:provider/callback`,
`GET|POST|DELETE /auth/signup`, `GET|POST /me/consent`의 필드·상태는 기술 API 정본을 따른다.

- `purpose=LOGIN` 신규일 때만 가입 대기로 간다. LINK·REAUTH를 신규 가입으로 변환하지 않는다.
- 콜백 raw query/form을 정규화·검증하고 로그에서 제거한다. Apple form_post는 다른 callback과
  content-type·cookie 조건이 다르므로 별도 adapter 테스트가 필요하다.
- signup의 약관 두 ID는 클라이언트가 화면에서 읽은 값이며 Core가 현재 시행 버전과 비교한다.
  false·누락 동의는 400, 시행 버전 변경은 409 POLICY_CHANGED다.
- displayName은 [공통 문자열 계약](../../../system-design/06-member-community-design.md#api)에 따라 잘못된
  Unicode scalar sequence·U+0000과 줄바꿈·C0/C1 제어 문자를 먼저 거부하고 NFC 정규화·ECMAScript trim 후
  2~20 code point로 검증한다.
  JavaScript UTF-16 code unit 수를 API 제한값으로 사용하지 않는다.
- 계정·social_identity·consent·session insert는 단일 transaction이며 임시 인증 1건은 한 번만 소비한다.
  provider subject unique 충돌은 기존 계정으로 자동 병합하지 않고 로그인 재시작으로 안내한다.
- 세션을 응답 body·receipt에 저장하지 않고 BFF가 Set-Cookie 한다. 응답 유실 후 callback code를 재사용하지 않는다.

<a id="d01-login"></a>
## 4. 인증 처리 흐름

1. context로 활성 제공자와 CSRF를 받고 선택한 제공자의 start를 POST한다.
2. BFF는 provider allowlist·returnTo·purpose·delivery를 검증하고 Core에 state와 binding 저장을 요청한다. 내부 인증 완료 자료는 [명시적 필드·키 계약](../../../system-design/06-member-community-design.md#identity-material)을 따른다.
3. 제공자 인증 뒤 state 단회 claim→token 교환→주체 검증→Core complete 순서로 처리한다.
4. 기존 ACTIVE 회원이면 session 회전·last_login_at 갱신 후 REDIRECT는 검증된 returnTo, POPUP은 서버 `/auth/complete`로 이동한다. guard 차단 중 동일 주체의 재연결은 거부한다.
5. REAUTH_REQUIRED는 동일 provider 주체만 복구한다. WITHDRAWING은 거부한다.
6. 오류 시 cookie·임시 credential을 정리하고 `/login`의 허용 오류 코드만 사용한다.

대안: 제공자 취소는 회원을 만들지 않는다. timeout·서명 실패·nonce/state 불일치는 실패로 끝내며
사용자에게 provider 원문을 표시하지 않는다. 다른 탭의 인증 callback을 현재 탭 계정에 연결하지 않는다.

<a id="d01-signup"></a>
## 5. 가입 처리 흐름

1. 가입 GET으로 임시 인증과 현재 두 동의 전문을 조회한다. 10분 만료면 재인증으로 돌아간다.
2. 표시명·두 필수 동의·생년월일(YYYY-MM-DD)을 입력하고 POST한다. Core가 표시명 canonical 값,
   유효 날짜와 만 14세 이상을 검증하며 실패하면 회원·동의·세션을 생성하지 않는다.
3. Core는 임시 인증 lock·정책 lock·unique 검증 뒤 회원과 동의를 저장한다. 동의 row는 실제 policy FK다.
4. session을 발급하고 임시 인증을 소비·파기한다. BFF는 auth cookie 삭제와 session cookie 설정 후 이동한다.
5. 취소는 DELETE로 임시 payload를 지운다. 브라우저 이탈만으로 즉시 삭제 호출을 보장하지 않으므로 TTL 정리를 병행한다.

<a id="d01-consent"></a>
## 6. 재동의 처리 흐름

회원 참여 API가 CONSENT_REQUIRED이면 `/account/consent`로 이동한다. GET으로 최신 전문을 보여주고
POST에서 같은 시행 버전인지 재확인한다. 독립 화면에서는 동의가 완료되면 intended 참여 화면으로 복귀하되
글·댓글을 자동 제출하지 않는다. 거부 시 읽기 또는 탈퇴로 이동한다.

<a id="d08-login"></a>
## 7. 로그인 화면

- route `/login`; 활성 provider 버튼은 같은 중요도, 설정 미완료 provider는 비활성 안내다.
- loading: context 로딩 skeleton, empty: 활성 제공자 없음·공개 짤로 이동, error: 재시도.
- 클릭→인증 start, 진행 중 중복 클릭 비활성화, 취소/실패 시 재시작 버튼 제공.
- `짤은 로그인 없이 볼 수 있어요`와 정책 링크를 유지한다. callback 화면은 로그·개인정보를 렌더링하지 않는다.

<a id="d08-signup"></a>
## 8. 가입 동의 화면

- route `/signup/consent`; 표시명, 생년월일 입력, 약관·수집이용 각각 checkbox·전문·version.
- 표시명 counter와 오류는 NFC 정규화·trim 후 Unicode code point 기준이다. 단독 surrogate는 제출 전에
  오류로 표시하되 Core의 400 판정이 최종이며 canonical 값을 다시 응답해 서로 다른 값을 표시하지 않는다.
- 제출→가입 흐름, 취소→임시 가입 DELETE, 정책 전문 열기→기존 policy viewer(새 API 해당 없음).
- 입력 오류는 label 연결·aria-describedby, 서버 오류는 aria-live. 정책 변경 시 동의 checkbox를 초기화한다.
- 화면 360px부터 단일 열, 768px 이상도 최대 760px. 키보드로 모든 checkbox·전문·취소에 접근한다.

<a id="d08-consent"></a>
## 9. 재동의 화면

- route `/account/consent`; 최신 두 전문과 변경 안내, 동의·공개 읽기·탈퇴 진입.
- 미로그인은 로그인, 이미 동의했으면 계정으로 이동. 필수 전문 로드 실패 시 빈 화면으로 동의를 받지 않는다.
- 처리 중 중복 제출 금지, 409면 전문 새로고침, 503이면 기존 체크를 보존하되 재검증 후 제출한다.

## 10. 수용 시나리오·차단

미실행 시나리오: 네 제공자 신규/기존/취소, Apple POST cookie, callback 재전송, 서로 다른 browser,
변조 issuer/audience/nonce, 동시 가입 unique, 가입 도중 정책 시행, 분석 거부 중 로그인, 생년월일 누락·잘못된 날짜·만 14세 미만,
표시명 한글 NFC·emoji·ZWJ·결합문자·20/21 code point·단독 surrogate의 UI/Core/DB 동일 판정.

운영 활성화 상태: `차단`. 실제 provider client/secret·callback·최소 scope·fresh-auth·알림 설정,
연령 확인 적정성, SIGNUP_PRIVACY 법무 검토·운영 버전·시행일·국외이전 고지가 `(미정)`이다.
[가입 동의 전문 초안](../../../legal/signup-privacy-consent.md)은 작성했으며 검토 전 운영 발행하지 않는다. 코드 작성과 mock 테스트의 선행 법무 확정을 뜻하지 않는다.

## 11. 검토 보완: 인증 전달·가입 중단

- MEMBER=false·ACCOUNT_ACCESS=true의 LOGIN은 기존 subject에만 session을 발급한다. 새 주체는
  가입 중단 안내로 종료하며 가입 임시 자료를 파기한다. REAUTH는 현재 account·subject 일치를 Core에서 확인한다.
- context는 registrationEnabled·accountAccessEnabled와 기존 접근용 providers를 구분해 반환한다.
- start.delivery=POPUP은 [편집 인증 흐름](../../../system-design/06-member-community-design.md#auth-continuation)을
  따른다. 팝업 닫힘·메시지로 성공을 판정하지 않고 부모가 서버 세션을 재조회한다.
- 편집 도중 재동의는 같은 편집 페이지의 dialog에서 GET/POST me/consent를 수행한다. 새 동의 전문을
  조회할 수 없으면 동의를 받지 않으며 입력은 부모 메모리에 유지한다.
- 미실행 수용 시나리오: HMAC 키 분리·원문 미저장·envelope 변조, LOGIN 신규/기존 분기, LINK 차단,
  팝업 차단·부모 입력 유지·다른 계정, returnTo 두 계정 경로와 외부 URL 거부.

## 12. 재검토 보완: 조회 키 교체

인증 완료·가입·연결은 [HMAC 키 교체 계약](../../../system-design/06-member-community-design.md#hash-key-rotation)의
current/retiring 후보 hash를 모두 확인한다. 기존 차단을 새 키로 우회할 수 없으며 기존 계정은
발견한 row를 재사용한다. 서로 다른 계정이 일치하면 자동 병합하지 않는다.
키 교체 동안 쓰기 process들의 keyring 구성이 일치하기 전 인증 쓰기를 재개하지 않는다.

미실행 검증: 탈퇴 원문 삭제→키 교체→같은 provider 주체 가입 차단, 기존 회원 중복 생성 방지,
서로 다른 keyring의 동시 쓰기 거부, 필요한 키 없는 backup 복원 시 인증 쓰기 차단.

## 13. 직접 입력 생년월일

날짜 검증·서버 기준일·가입 거부·원문 폐기는 [생년월일 계약](../../../system-design/06-member-community-design.md#signup-birth-date)을 따른다.
생년월일 입력은 연령 자기 신고이며 본인확인 완료로 표시하지 않는다. 서버의 AGE_REQUIREMENT_NOT_MET은
“만 14세 이상부터 가입할 수 있습니다”로 표시한다. 날짜 오류는 해당 입력에 연결하고 입력값을 로그에 보내지 않는다.
기술 정본의 생일 경계·가입 거부·원문 미잔존 시나리오는 구현 단계에서 검증한다.
