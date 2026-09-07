# 분석 동의와 GA4 연동 기능 명세

## 1. 문서 정보와 입력 근거

- 문서 상태: `작성 완료`
- milestone: `M0 Core` (`m0-core`)
- 기능: `analytics-consent` — 기본 비활성 GA4 loader·선택·철회
- 기준일: 2026-09-07
- 미검증: GA4 property·Measurement ID·CSP·국외이전 고지, browser storage/network, 실제 event
- 주요 근거:
  - [서비스 기획 §11·§13·§14](../../../planning/01-service-plan.md)
  - [화면 설계 §10·§13](../../../planning/03-screen-design.md)
  - [분석·광고 계획 §2~§5·§11·§12](../../../planning/04-analytics-ad-plan.md)
  - [쿠키 설정 안내](../../../legal/cookie-settings.md), [개인정보처리방침 §3·§4·§7·§10](../../../legal/privacy-policy.md)
  - [시스템 아키텍처 §4](../../../system-design/01-system-architecture.md), [보안·운영 §4](../../../system-design/05-security-operations.md)

## 2. 목표와 대상 milestone

M0 Core에 GA4 loader와 동의 제어를 구현하되 production 기본값은 비활성으로 유지한다. 활성 gate를
통과한 환경에서도 저장된 분석 동의 후에만 Google tag와 이벤트를 보내고 철회 즉시 중단한다.

## 3. 행위자와 진입 조건

- 공개 이용자: 최초 비차단형 banner, footer `/cookie-settings`, modal 또는 직접 route
- 시작 조건: `NUXT_PUBLIC_GA4_ENABLED=true`이고 활성 선택 범위에 대한 저장값이 없거나 변경됨
- 기본 M0: flag false이므로 banner·분석 option·Google 요청·`blariyo_consent`가 없다.

## 4. 범위와 범위 밖

범위:

- 활성 기능 기반 consent scope, `blariyo_consent` 12개월 저장·재선택
- 분석 허용 전 tag/cookieless ping 차단, 허용 뒤 loader와 4개 event
- 철회 시 전송 중단·현재 domain `_ga`,`_ga_*` 삭제
- cookie banner·modal/direct route·비활성 상태

범위 밖:

- 자체 analytics API·DB·원시 event·일별 집계, GA4 User-ID
- 광고·제휴 runtime과 광고 event, M1 회원 session
- GA4 운영 활성화 자체는 M0 Core 구현 완료 gate와 분리한다.

GA4를 대체하는 자체 방문 분석은 만들지 않는다. 기존 참고용 게시글 조회 수와 방문 분석에 쓰지
않는 보안·오류 로그는 각각 공개 탐색과 보안·운영 계약을 따른다.

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| 기본 flag false·banner/Google 요청 없음 | 확정 | 분석 계획 §2·§11 | D01 consent, D08 loader/banner | 반영 |
| 동의 뒤 tag·page_view/select_content/share/scroll | 확정 | 분석 계획 §4 | D01 send-events, loader | 반영 |
| 철회 뒤 전송 중단·`_ga*` 삭제 | 확정 | cookie 안내 §4·§5 | D01 consent, cookie-settings | 반영 |
| 선택 범위 변경 시 재선택 | 확정 | 분석 계획 §5 | D01·D08 | 반영 |
| event별 custom parameter allowlist·금지값 | 확정 | 분석 계획 §4 | send-events | 반영 |
| Measurement ID·보관·국외이전·Google 법인·CSP | 실값 필요 | legal 활성화 차단 | loader | 활성화 차단 |
| 광고 consent/runtime | 범위 밖 | M0 Core 제외 | 전체 | 미노출 |

## 6. 업무 규칙과 수용 조건

- flag false이면 선택 UI나 저장을 요구하지 않는다.
- banner는 콘텐츠 클릭·scroll을 막지 않고 `필수만 사용`, `설정`, `모두 허용`을 제공한다.
- settings는 실제 활성 기능만 보여주며 선택 저장 뒤 banner/modal을 닫는다.
- 분석 거부 상태에서도 공개 목록·상세·공유와 조회 수 API가 정상 동작해야 한다.
- event별로 [분석 계획 §4](../../../planning/04-analytics-ad-plan.md)의 custom parameter allowlist만
  전송한다.
- 게시글 제목·본문·원문 URL·내부 `postId`, 회원·소셜 식별자, IP, GA4 User-ID, 숨김·삭제 글
  콘텐츠와 수집 후보 정보는 GA4로 보내지 않는다.
- tag 로드나 event 전송 실패 시 event를 drop하고 공개 기능을 유지하며 자체 queue·분석 DB·일별
  방문 집계 fallback을 만들지 않는다.

## 7. 데이터·권한·법무 영향

- `localStorage.blariyo_consent`: `version`, 고정 순서의 활성 `scope`, `analytics`, `ads`, `savedAt`을 가진 JSON;
  마지막 선택 후 12개월. 구체 계약은 [분석 선택 D01](#d01-manage-analytics-consent)이 소유한다.
- 동의 전 Google 요청과 `_ga*` 신규 생성 0건. 자체 DB 저장 없음.
- 활성화 전 Measurement ID·보관 설정·국외이전 고지·실제 Google 계약 법인·Google tag/CSP domain
  확정이 필요하다. 하나라도 미확정이면 production의 `NUXT_PUBLIC_GA4_ENABLED=false`를 유지한다.

## 8. API 작업 목록

API 해당 없음. Google tag는 browser에서 동의 후 직접 로드하며 BFF·Core·PostgreSQL에 분석 경로를 만들지 않는다.

## 9. 처리 흐름 찾아보기

- [분석 선택 저장·변경·철회](#d01-manage-analytics-consent)
- [허용된 GA4 이벤트 전송](#d01-send-analytics-events)

## 10. 화면·프로그램 찾아보기

- [쿠키 선택 banner](#d08-consent-banner)
- [쿠키 설정](#d08-cookie-settings)
- [GA4 loader](#d08-analytics-loader)

## 11. 결정·가정·미정·차단 항목

- 확정: 네 event의 custom parameter allowlist와 금지값, 동의 후 1회 동적 로드, 실패 시 event drop.
- 활성화 차단: Measurement ID, property 보관 설정, 국외이전 고지, Google 계약 법인·Google tag/CSP
  domain. 모두 확정되기 전에는 production flag를 false로 유지한다.
- flag가 false인 환경은 원인과 관계없이 Measurement ID를 public runtime config에서 unset한다.
- 활성화 차단값은 M0 Core 공개 자체를 막지 않는다. source·browser·network 검증은 별도다.

## 12. 기능 계약 상세

아래 API·처리 흐름·화면 절을 이 파일에서 함께 관리한다. 각 절의 미검증·차단 조건은 유지하며, 문서 통합은 구현 완료를 뜻하지 않는다.

분석 전용 API는 없다. 동의 저장 형식은 아래 분석 선택 절이, event별 허용 값은 분석 계획이 소유한다.

<a id="d01-manage-analytics-consent"></a>

### 분석 선택 저장·변경·철회

- 계약 상태: `작성 완료`

- 입력 근거: [분석 계획 §5](../../../planning/04-analytics-ad-plan.md), [쿠키 안내 §3~§5](../../../legal/cookie-settings.md), [퍼블리싱 동의 저장 비교물](../../../publishing/responsive/app.js)
- 미검증: browser storage·tag/network test

#### 프로세스 목적과 범위

활성 선택 기능 범위에 대해 이용자가 분석 허용 여부를 저장·변경·철회한다.

#### 행위자·시작·선행 조건

공개 이용자. flag false이면 이 프로세스는 자동 시작하지 않고 footer에서 비활성 상태만 확인한다.

#### 정상 흐름

1. client가 활성 선택 기능과 저장된 consent scope를 비교한다.
2. 활성 기능이 있고 저장값이 없거나 scope가 달라졌으면 비차단 banner를 표시한다.
3. `필수만 사용`은 analytics=false, `모두 허용`은 현재 활성 선택만 true로 저장한다.
4. `설정`은 modal을 열고 이용자가 분석 option을 고른 뒤 `선택 저장`한다.
5. 아래 schema로 `blariyo_consent`를 저장하고 banner/modal을 닫는다.
6. footer 설정에서 철회하면 Google 전송을 중단하고 `_ga`,`_ga_*`를 삭제한다.

#### 대안·실패 흐름

- localStorage 차단/오류·JSON parse 실패·schema/version 불일치: 저장값을 사용하지 않고 Google tag를
  로드하지 않는 거부 기본값으로 처리하며 선택을 기억할 수 없음을 알린다.
- 새 기능 추가: 기존 true를 확대 적용하지 않고 다시 선택한다.
- cookie 삭제 실패: 추가 전송은 즉시 중단하고 삭제 실패를 일반 안내한다.

#### 단계별 API 매핑

API 해당 없음. browser localStorage와 tag loader만 사용한다.

#### 데이터·상태 전이

저장 key는 `blariyo_consent`이며 값은 다음 JSON schema를 따른다.

```json
{
  "version": 2,
  "scope": "analytics",
  "analytics": true,
  "ads": false,
  "savedAt": "2026-09-02T05:00:00.000Z"
}
```

- `version`: 현재 퍼블리싱 비교물과 맞춘 storage schema version인 정수 `2`.
- `scope`: 현재 활성 선택 기능 slug를 `analytics`, `ads` 고정 순서로 선택해 쉼표로 연결한 문자열.
  M0 GA4만 활성화하면 `analytics`, 둘 다 활성화하면 `analytics,ads`다.
- `analytics`, `ads`: boolean. scope에 없는 기능은 항상 `false`이며 동의로 해석하지 않는다.
- `savedAt`: 저장 성공 시각의 UTC ISO 8601 문자열.
- 유효 기간: `savedAt`부터 12개월. 달력 기준 12개월이 지난 첫 확인에서 만료로 판정하고 재선택한다.

퍼블리싱 비교물의 `version=2`, 쉼표 구분 scope와 field 구조는 이 계약과 일치하지만 12개월 만료
판정은 구현돼 있지 않다. 정적 비교물을 실행 증거로 보지 않고 실제 source에서 별도 구현·검증한다.

미저장→analytics false/true; scope 변경·12개월 만료→재선택 필요; true→false 철회다.

#### 권한·트랜잭션·멱등성·재시도

인증·server transaction 없음. 같은 선택 저장은 같은 결과이며 tag load는 현재 consent를 재확인한다.

#### 완료 조건과 수용 기준

flag false·미저장·거부·철회에서 새 Google tag 로드·request·cookieless ping·쿠키 생성은 0건이어야 한다.
이전에 생성된 `_ga*`는 철회 시 삭제하며, 삭제 실패 시에는 위 실패 흐름대로 전송 중단과 안내를 검증한다.
공개 기능은 유지되어야 한다. 깨진 JSON,
미지원 version, scope 순서 변경, 12개월 경계와 저장 실패도 거부 기본값으로 처리해야 한다.

#### 미정·차단·미검증

GA4 활성화 실값은 차단 상태지만 consent state machine 자체는 확정됐다. browser test는 미실행이다.

<a id="d01-send-analytics-events"></a>

### 허용된 GA4 이벤트 전송

- 계약 상태: `작성 완료`

- 입력 근거: [분석 계획 §2·§4](../../../planning/04-analytics-ad-plan.md), [시스템 아키텍처 §4](../../../system-design/01-system-architecture.md)
- 미검증: source, browser, GA4 DebugView·network

#### 프로세스 목적과 범위

분석 활성·동의 상태에서만 `page_view`, `select_content`, `share`, `scroll`을 browser가 GA4로 보낸다.

#### 행위자·시작·선행 조건

공개 이용자 interaction. flag true, 유효 consent의 analytics=true, loader 성공이 모두 필요하다.

#### 정상 흐름

1. route 첫 화면 표시에서 `page_view`를 한 번 보낸다.
2. 목록에서 글 선택 시 `select_content`를 보낸다.
3. 공유 방식을 선택할 때 `share`를 보낸다.
4. 상세 주요 구간에 최초 도달할 때 `scroll`을 보낸다.

각 event의 custom parameter는 [분석 계획 §4](../../../planning/04-analytics-ad-plan.md)의 allowlist를 따른다.

[분석 계획의 기본 필드 제한](../../../planning/04-analytics-ad-plan.md)에 따라 첫 설정부터 `send_page_view: false`와 자동 측정 비활성화를 적용한다. 모든 이벤트의 `page_title`은 `블라리요`, `page_referrer`는 빈 문자열, `page_location`은 서비스 origin과 고정 분석 경로만 사용한다. 실제 제목·URL·query·hash·postId가 기본 필드에도 남지 않도록 route 전환마다 전송 전에 갱신한다. 관리자 경로에서는 tag를 load하지 않는다. network 검증 전 운영 활성화하지 않는다.

#### 대안·실패 흐름

- `/→/meme` redirect는 중복 `page_view`를 보내지 않는다.
- flag false·미동의·철회·loader 실패면 event를 drop하고 공개 기능을 유지한다.
- 숨김/404 화면은 제목·번호를 event에 포함하지 않는다.
- 전송 실패를 자체 queue·분석 DB·일별 방문 집계로 우회하거나 자동 재시도하지 않는다.

#### 단계별 API 매핑

Blariyo API 해당 없음. browser가 GA4로 직접 전송하며 자체 queue·DB fallback을 만들지 않는다.

#### 데이터·상태 전이

Blariyo DB 변화 없음. 위 allowlist 밖의 custom parameter는 추가하지 않는다. 게시글 제목·본문·원문
URL·내부 `postId`, 회원·소셜 식별자, IP, GA4 User-ID와 수집 후보 정보는 값으로도 전송하지 않는다.

#### 권한·트랜잭션·멱등성·재시도

서버 transaction 없음. route·scroll lifecycle guard로 같은 화면의 의도하지 않은 중복만 막고 실패 자동 재시도는 하지 않는다.

#### 완료 조건과 수용 기준

동의 후 네 event 시점과 allowlist, 미동의 상태의 방문자 수·page open을 포함한 Google
tag/request·cookieless ping 0건, 금지값 미전송, loader 실패 시 공개 기능 유지를 확인해야 한다.

#### 미정·차단·미검증

event 계약은 확정됐다. GA4 운영 gate의 실값과 source·browser·DebugView·network는 미검증이다.

<a id="d08-analytics-loader"></a>

### GA4 Loader

- 계약 상태: `작성 완료`

- 입력 근거: [분석 계획 §2·§4·§11](../../../planning/04-analytics-ad-plan.md), [보안·운영 §4 CSP](../../../system-design/05-security-operations.md)
- 미검증: Measurement ID·CSP·GA4 network·DebugView

#### 프로그램 목적·route·milestone

모든 공개 route에서 현재 flag·consent를 검사해 필요할 때만 Google tag를 load하는 browser 프로그램이다.

#### 진입·이탈·권한 조건

flag true + 저장된 analytics consent true + 승인 설정이 모두 필요하다. 하나라도 아니면 방문자 수·
page open을 포함한 Google tag/request와 cookieless ping을 만들지 않는다.

#### UI 영역과 구성요소

직접 UI 없음. banner·cookie settings의 선택을 구독하고 event adapter를 제공한다.

#### 필드·표시값·validation

공개 Measurement ID 형식, 확정된 GA4 property 보관 설정·국외이전 고지·Google 계약 법인, 승인된
Google tag/CSP domain allowlist와 current consent scope를 검사한다. Measurement ID는 secret이
아니지만 미확정값이나 placeholder를 노출하지 않는다.

#### 이벤트·후처리

동의 true 전환 시 browser에서 Google tag를 1회 동적 load하고, false 전환 시 추가 전송 중지·cookie
삭제. load 실패 시 event를 drop하고 공개 기능을 유지한다. route/interaction은 event D01을 따른다.

#### 프로그램 상태

disabled, denied, loading, ready, blocked/error를 구분하되 오류가 page JavaScript를 중단시키지 않는다.

#### 반응형과 접근성

UI 없음. 상태 안내는 cookie settings의 `aria-live`를 사용하고 콘텐츠 focus를 바꾸지 않는다.

#### 이벤트별 D01·API 매핑

[선택 관리](#d01-manage-analytics-consent), [event 전송](#d01-send-analytics-events). Blariyo API 해당 없음.

#### 메시지와 사용자 피드백

provider 내부 오류를 이용자에게 노출하지 않고 선택 저장/철회 결과만 알린다.

#### 프로그램 수용 조건

flag false·미동의·철회에서 방문자 수·page open을 포함한 Google tag/request·cookieless ping 0건,
동의 뒤 1회 동적 load, loader 실패 시 event drop·공개 기능 유지가 필요하다.

#### 미정·차단·미검증

event custom parameter 계약은 확정됐다. Measurement ID·property 보관 설정·국외이전 고지·Google
계약 법인·Google tag/CSP domain은 활성화 차단 실값이며, 모두 확정되기 전 production은
`NUXT_PUBLIC_GA4_ENABLED=false`다. flag가 false인 환경은 원인과 관계없이 Measurement ID를 public
runtime config에서 unset한다. source·browser·network는 미검증이다.

<a id="d08-consent-banner"></a>

### 쿠키 선택 Banner

- 계약 상태: `작성 완료`

- 입력 근거: [화면 설계 §10 쿠키 설정](../../../planning/03-screen-design.md), [쿠키 안내 §4](../../../legal/cookie-settings.md)
- 미검증: actual browser·viewport·accessibility test

#### 목적·route·milestone

별도 route 없이 활성 선택 기능의 최초·변경 동의를 받는 화면 하단 비차단형 banner다.

#### 진입·이탈·권한 조건

인증 없음. 활성 선택 기능이 있고 해당 scope 저장값이 없을 때만 표시한다. flag false면 미노출이며,
banner 표시만으로 Google tag/request나 cookieless ping을 만들지 않는다.

#### UI 영역과 구성요소

간단한 목적 설명, `필수만 사용`, `설정`, `모두 허용` 세 action. 콘텐츠 위를 가리더라도 click·scroll을 막지 않는다.

#### 필드·표시값·validation

비활성 분석·광고 option을 문구로 사전 동의받지 않는다. action은 현재 활성 scope만 저장한다.

#### 이벤트·버튼·이동·후처리

필수만/모두 허용은 저장 후 닫기. 설정은 cookie modal을 열고 banner를 배경으로 비활성 처리한다.

#### 화면 상태

미노출(default), 선택 필요, 저장 중, 저장 실패를 구분한다. 실패는 거부 기본값으로 tag를 차단한다.

#### 반응형과 접근성

360px에서 가로 scroll 없음, action 44px 이상, DOM focus 순서와 `aria-label`을 제공한다.

#### 이벤트별 D01·API 매핑

[분석 선택 관리](#d01-manage-analytics-consent); API 해당 없음.

#### 메시지와 사용자 피드백

거부해도 콘텐츠를 이용할 수 있음을 명확히 알린다. 미정 provider 이름을 노출하지 않는다.

#### 화면 수용 조건

flag false 미노출, true+미선택 표시, 저장 후 닫힘, scope 변경 시 재표시, 콘텐츠 비차단을 확인한다.

#### 미정·차단·미검증

GA4 활성 gate는 차단 상태지만 banner contract는 확정. browser 검증은 미실행이다.

<a id="d08-cookie-settings"></a>

### 쿠키 설정

- 계약 상태: `작성 완료`

- 입력 근거: [화면 설계 §10](../../../planning/03-screen-design.md), [쿠키 안내](../../../legal/cookie-settings.md), [퍼블리싱 동의 저장 비교물](../../../publishing/responsive/app.js)
- 미검증: actual modal/direct route·storage test

#### 목적·route·milestone

`/cookie-settings` 직접 화면과 footer modal에서 실제 활성 저장소와 선택을 확인·변경한다.

#### 진입·이탈·권한 조건

인증 없음. footer에서 언제든 진입. modal 닫기 후 원래 focus/scroll 복귀, JavaScript 실패 시 직접 route.

#### UI 영역과 구성요소

필수 설정 저장소 설명, 활성 분석 option, `선택 저장`; 활성 선택 기능이 없으면 상태 문구만 표시한다.

#### 필드·표시값·validation

- `blariyo_consent`: [분석 선택 D01](#d01-manage-analytics-consent)의 `version=2`, 고정 순서 `scope`,
  `analytics`, `ads`, UTC `savedAt` JSON. `savedAt`부터 달력 기준 12개월 뒤 만료한다.
- 분석 option은 GA4 flag true일 때만 표시한다.
- GA4 운영값과 법무 고지가 모두 확정되지 않아 flag가 false인 환경에서는 Measurement ID나 provider
  placeholder를 노출하지 않는다.
- M0에서 광고가 비활성이면 광고 option·cookie를 표시하거나 만들지 않는다.

#### 이벤트·버튼·이동·후처리

option 변경→선택 저장→loader 반영→modal/banner 닫기. 철회는 전송 중단과 `_ga*` 삭제를 즉시 요청한다.

#### 화면 상태

비활성: `현재 활성화된 저장소가 없습니다`; 활성·미선택; 저장 완료; storage/delete 실패; 깨진 JSON·
미지원 version·만료는 미선택으로 구분한다.

#### 반응형과 접근성

modal focus trap/return, background inert, Escape/dim/닫기, label-control 연결과 status `aria-live`를 적용한다.

#### 이벤트별 D01·API 매핑

[분석 선택 관리](#d01-manage-analytics-consent); API 해당 없음.

#### 메시지와 사용자 피드백

활성 기능·목적·기간·철회 효과를 평이하게 표시하고 철회가 공개 열람을 막지 않음을 알린다.

#### 화면 수용 조건

modal/direct route 동등 내용, 비활성 option 미노출, 12개월 scope, 철회 네트워크·cookie 차단을 확인한다.

#### 미정·차단·미검증

GA4 실제 cookie 만료·property 보관·국외이전 고지·Google 계약 법인·Google tag/CSP domain은 활성화
차단값이다. 모두 확정되기 전 production flag는 false이며 M0 Core 공개 자체는 막지 않는다. 화면
runtime은 미검증이다.
