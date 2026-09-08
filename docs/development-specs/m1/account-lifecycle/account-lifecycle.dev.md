# 계정 관리·연동·탈퇴 기능 명세

- 문서 상태: `작성 완료` — API·처리 흐름·화면 계약; 아래 운영 활성화 절은 `차단`
- 기준일: 2026-09-08
- 실행 증거: source·migration·OpenAPI 생성·test·build·브라우저·production 모두 이 문서 작업에서 미검증
- 입력: [제품 계약](../../../planning/08-member-community-plan.md), [화면 설계](../../../planning/03-screen-design.md), [법무 gate](../../../legal/README.md)
- 공통 타입·요청/응답·오류·권한: [기술 API 정본](../../../system-design/06-member-community-design.md#api)
- 저장·제약·잠금: [데이터 정본](../../../system-design/06-member-community-design.md#data)

이 기능은 아직 전용 machine-readable OpenAPI가 없으므로 요청·응답 필드는 위 기술 정본 표를
사용한다. 아래는 업무 제약과 구현 순서를 보충한다. M0 Core YAML을 이 기능의 전체 계약으로 해석하지 않는다.

## 1. 범위·행위자

- milestone: M1. 회원의 표시명 변경·제공자 연결/해제·로그아웃·탈퇴.
- 진입: `/account`, `/account/withdraw`. 선행은 유효 회원 세션과 민감 동작의 최근 재인증이다.
- M1.5 콘텐츠 처리 자체는 익게 명세가 소유하고 이 기능은 contentAction·계정 폐기 orchestration을 소유한다.

## 2. 요구사항 추적

| 요구 | API | 흐름 | 화면 |
| --- | --- | --- | --- |
| 표시명·연동 상태 | GET/PATCH me | [관리](#d01-account) | [계정](#d08-account) |
| 재인증·연결·해제 | auth start LINK/REAUTH, DELETE identities | [연동](#d01-link) | [계정](#d08-account) |
| 현재/모든 기기 종료 | logout/logout-all | [관리](#d01-account) | [계정](#d08-account) |
| 탈퇴와 외부 실패 분리 | preview/withdrawals/status | [탈퇴](#d01-withdraw) | [탈퇴](#d08-withdraw) |

<a id="api-account"></a>
## 3. API 업무 계약

필드·상태는 기술 정본 회원 표의 `/me`, `/me/identities/:provider`, `/auth/logout`,
`/auth/logout-all`, `/me/withdrawal-preview`, `/me/withdrawals`, `/withdrawals/:withdrawalId`를 따른다.

- consumer browser, BFF 인증·cookie 처리, Core account transaction과 세션 취소 담당.
- 표시명 변경은 lockVersion 비교와 [공통 문자열 계약](../../../system-design/06-member-community-design.md#api)의
  원문 Unicode scalar·U+0000·줄바꿈·C0/C1 검사, NFC 정규화, ECMAScript trim 후 2~20 Unicode code point
  검증 순서를 적용한다. 이메일·provider subject는 수정 필드로 허용하지 않는다.
- 해제·탈퇴에는 최근 5분 재인증을 요구한다. 탈퇴가 막히는 제공자 장애는 기존 문의 채널을 통한 본인 확인 수동 경로로 안내한다.
- 연동 해제는 account lock 아래 usable identity 수와 상태를 확인하고 연동 폐기를 예약한다.
  해당 identity로 발급한 모든 session을 취소하고 필요하면 현재 세션도 로그아웃한다.
- 탈퇴 중 기존 session으로 회원 권한을 얻지 못한다. 공개 열람은 계속 가능하다. 본인 확인된 탈퇴 접수는 외부 unlink 성공을 기다리지 않는다.
- 콘텐츠 유무와 무관하게 서버가 KEEP 정책을 적용한다. 요청의 contentAction은 허용하지 않는다.

<a id="d01-account"></a>
## 4. 계정 관리 흐름

1. GET me로 상태·version을 읽는다. 제한 사유는 공개 가능한 문구만 표시한다.
2. PATCH 표시명은 Unicode scalar sequence·canonical 길이와 version이 모두 유효한 경우에만 갱신한다.
   400이면 입력을 고치고 409면 사용자가 최신 값을 확인하도록 한다.
3. 현재 로그아웃은 해당 세션 삭제, 모든 기기는 account 기준 전체 세션 삭제 후 cookie를 만료한다.
4. cookie 삭제와 별개로 DB token 무효화를 확인한다. 서버 실패면 로그아웃 완료라고 안내하지 않는다.

<a id="d01-link"></a>
## 5. 연결·해제 흐름

1. REAUTH로 기존 회원을 확인하고 LINK transaction에 현재 account·session을 묶는다.
2. 새 provider callback subject가 다른 account에 이미 속하면 연결을 거부한다. 같은 이메일은 판단 근거가 아니다.
3. 성공하면 identity 추가·account version 증가·session 회전을 수행한다.
4. 해제는 현재 account 재확인→마지막 수단 검사→로컬 연동 폐기→외부 작업을 분리한다.
5. 해제 외부 토큰 확보 실패는 MANUAL로 안내한다. Apple credential은 분리 작업의 24시간 만료를 따른다.
6. [해제 경합 계약](../../../system-design/06-member-community-design.md#disconnect-races)의 guard와 generation으로 재연결을 차단한다. secret 만료만으로 차단을 풀지 않고 실행 중 외부 요청·늦은 알림을 구분한다.

대안: provider 외부 철회 알림은 인증된 adapter만 처리한다. 마지막 identity 철회 시 자동 다른 계정 연결
또는 신규 회원 생성 없이 REAUTH_REQUIRED로 두고 동일 주체 재인증 또는 본인 확인 문의를 안내한다.

<a id="d01-withdraw"></a>
## 6. 탈퇴 처리 흐름

1. 최근 재인증 후 preview로 본인 콘텐츠 수와 연결 제공자를 읽는다.
2. 콘텐츠 유지 안내 후 최종 확인을 받아 POST한다. account lock 안에서 version을 검증하고 KEEP을 기록한다.
3. WITHDRAWING 전환·전체 세션 삭제·withdrawal 작업 생성이 같은 transaction으로 commit된다.
4. statusToken으로만 결과 조회하며 account session은 다시 사용할 수 없다.
5. worker가 콘텐츠 상태 유지→개인정보 연결 제거→외부 작업 분리→account 삭제를 수행한다.
6. 외부 결과 DONE/PENDING/MANUAL을 별도로 보여준다. DONE 회원 탈퇴를 외부 장애로 되돌리지 않는다.

worker는 phase/cursor로 재개한다. 실패 재시도는 회원을 ACTIVE로 되돌리지 않으며, 백업 복원은 삭제 ledger
재적용 후에만 공개한다. 탈퇴 완료 증거에는 account·identity·session·consent·FK·감사값 readback을 포함한다.

<a id="d08-account"></a>
## 7. 계정 화면

- route `/account`; 표시명, 연결 제공자·인증 시각, 연결·해제, 현재/모든 로그아웃, 탈퇴.
- 표시명 counter는 NFC 정규화·trim 후 Unicode code point로 세며 Core가 반환한 canonical 값을 표시한다.
- loading skeleton, 401 로그인, 연동 없는 상태는 복구 안내, provider 일부 장애는 해당 동작만 실패로 표시한다.
- 마지막 수단 버튼을 비활성화하더라도 서버 검증을 생략하지 않는다. 변경·해제 성공 뒤 GET me를 다시 호출한다.
- 클릭 결과와 focus 이동을 aria-live로 알린다. 360/768/1280px에서 버튼·긴 사유가 넘치지 않게 한다.

<a id="d08-withdraw"></a>
## 8. 탈퇴 화면

- route `/account/withdraw`; 재인증→preview→콘텐츠 유지 안내→최종 확인→접수 결과 순서다.
- 삭제/유지 선택 UI는 없다. 글·댓글 유지와 탈퇴 후 일반 편집 불가를 안내한다.
- 확인 누락·만료·409면 제출하지 않고 현황을 다시 읽는다. irreversible 확인창은 목적과 삭제 범위를 명확히 표시한다.
- 202는 `탈퇴 처리 중`, DONE은 `탈퇴가 완료되었습니다`, 외부 MANUAL은 제공자 설정 해제 안내를 따로 표시한다.
- 결과 polling은 2초부터 최대 30초 backoff, 탭 숨김 시 멈춘다. token 만료는 처리 취소가 아니다.
- 계정 삭제 뒤 편집 메모리·session cookie를 정리하고 공개 `/meme` 이동을 제공한다.

## 9. 수용 시나리오·차단

미실행: 동시 마지막 수단 해제, 다른 계정 LINK, 세션 회전과 이전 cookie 재사용, 만료 재인증,
탈퇴와 신규 글 경쟁, KEEP 고정·삭제 선택 거부·숨김/삭제 상태 유지, 외부 timeout, 24시간 token 삭제,
worker 재시작·복원 ledger 적용, 표시명 한글 NFC·emoji·ZWJ·결합문자·20/21 code point·단독 surrogate 거부.

운영 활성화 상태 `차단`: provider 실제 철회 계약, 문의 본인 확인 절차, 별도 법적 보존 근거·기간,
삭제 ledger 보존 고지. 탈퇴 상태 DB 조회가 구현 테스트로 확인되기 전 기능 완료라고 보고하지 않는다.

## 10. 검토 보완: 운영 중단·재인증·복귀

- 신규 가입 중단은 MEMBER=false, 기존 계정 접근은 ACCOUNT_ACCESS=true다. 기존 회원 LOGIN과
  REAUTH는 유지하고 LINK와 신규 가입은 거부한다. 계정이 남은 채 ACCOUNT_ACCESS를 끄는 배포는 거부한다.
- `/account/withdraw` 복귀는 기술 allowlist에 포함된다. 재인증 성공 후 preview를 다시 읽고 최종 확인을
  받으며 탈퇴를 자동 제출하지 않는다. 같은 규칙을 `/account/consent`에도 적용한다.
- 해제 진행 중 재연결은 IDENTITY_DISCONNECT_PENDING으로 안내한다. 정상 다른 provider로 계정 관리와
  탈퇴는 가능하다. 실패·수동 확인·최소 기록 만료는 제품 정책과 기술 정본을 따른다.
- 미실행 수용 시나리오: 가입 중단 뒤 기존 회원 탈퇴, 재인증 5분 만료, 탈퇴 복귀·자동 제출 금지,
  외부 해제 timeout 뒤 재연결, 이전 generation worker와 지연 이벤트, 결과 불명확 상태 30일 만료.

## 11. 재검토 보완: 해제 결과와 탈퇴 이력

외부 해제 재처리는 [결과별 전이표](../../../system-design/06-member-community-design.md#disconnect-outcomes)를
따른다. 미전송·명시적 미적용 실패만 자동 재전송하며 timeout·응답 유실은 UNKNOWN으로 격리한다.
secret 만료는 MANUAL 전환·파기일 뿐 재연결 허용이 아니다.

탈퇴 worker는 [제재 이력 분리](../../../system-design/06-member-community-design.md#restriction-detachment)에
따라 account_id와 account_detached_at을 함께 변경한 뒤 계정을 삭제한다. 삭제한 식별자 원문을
[HMAC 키 교체](../../../system-design/06-member-community-design.md#hash-key-rotation)를 위해 복구하지 않는다.

미실행 수용 검증: 해제 실패 유형별 재전송 허용/금지, secret 만료 후 차단 유지, 기존 제재 이력의
계정 연결 제거·FK 삭제·worker 재시작, 원문 없는 guard가 키 교체 후에도 신규 연결을 차단함.
