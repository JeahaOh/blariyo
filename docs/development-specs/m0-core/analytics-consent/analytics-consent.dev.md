# 분석 동의와 GA4 연동 기능 명세

## 1. 문서 정보와 입력 근거

- 문서 상태: `작성 완료`
- milestone: `M0 Core` (`m0-core`)
- 기능: `analytics-consent` — 기본 비활성 GA4 loader·선택·철회와 첫 확장 `analytics-v1`
- 기준일: 2026-09-07
- 정합성 검토일: 2026-09-24 (소스·테스트 계약 대조, 재실행·운영 GA4 검증 아님)
- 확장 계약 확정일: 2026-09-25 — [§13 analytics-v1](#analytics-v1)의 이벤트·필드·단일 전송·재동의 계약 작성 완료. 확장 코드·OpenAPI·콘솔·운영은 미반영·미검증.
- 운영 확인: 9/25 `8af7244` 배포의 GTM 컨테이너 요청 HTTP 200·초기화([배포 증거](../../../../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)).
- 운영 미검증: GA4 property·Measurement ID·속성 자동 측정·국외이전 고지·GA4 실제 network/DebugView, GTM 태그·동의 설정. GTM 로딩 및 로컬 대체 tag 검증과 구분한다.
- 주요 근거:
  - [서비스 기획 §11·§13·§14](../../../planning/01-service-plan.md)
  - [화면 설계 §10·§13](../../../planning/03-screen-design.md)
  - [분석·광고 계획 §2~§5·§11·§12](../../../planning/04-analytics-ad-plan.md)
  - [쿠키 설정 안내](../../../legal/cookie-settings.md), [개인정보처리방침 §3·§4·§7·§10](../../../legal/privacy-policy.md)
  - [시스템 아키텍처 §4](../../../system-design/01-system-architecture.md), [보안·운영 §4](../../../system-design/05-security-operations.md)

### 현행 구현·검증 경계

§1~§12의 네 이벤트·version2 설명은 기존 구현 기준이다. 첫 확장 구현은 §13으로 교체하며
두 계약을 동시에 전송하지 않는다. 이 문서의 Google 요청 0건은 **직접 GA4 수집 경로**의 기준이다.
별도 [GTM 컨테이너 설치](../../../planning/04-analytics-ad-plan.md#gtm-컨테이너-설치--2026-09-25-사용자-요청)는
동의와 독립적이며, 컨테이너 내부 태그는 직접 adapter의 flag로 자동 제어되지 않는다.

- 구현은 `apps/web/app/utils/consent.mjs`, `useConsent.ts`, `analytics.client.ts`, `CookieSettings.vue`,
  `SiteFooter.vue`와 server `security.ts`/`production.ts`에서 확인했다. GA4 flag와
  `NUXT_PUBLIC_ANALYTICS_APPROVED`가 모두 참이어야 선택 UI·loader를 활성화한다.
- [단위 테스트](../../../../tests/consent.test.ts)와 [브라우저 테스트](../../../../tests/browser/consent.test.ts)가 있다.
  브라우저 테스트는 Google script를 로컬 응답으로 대체하고 다른 외부 요청은 차단한다.
  저장·철회·안전한 필드·route 재방문 검증이며 실제 Google 수신·보관·자동 측정을 증명하지 않는다.
- 이전 검증 증거는 [요구사항 C15](../../requirements-status.md)에서 추적한다. 이번 문서 검토는
  테스트를 재실행하지 않았다. 아래 미검증은 별도 표시가 없으면 **현재 환경의 수용 검증 잔여**다.
- 남은 구현 차이: cookie 삭제 예외는 전송을 중단하지만 이용자에게 삭제 실패를 알리는 경로가 없다.
  잘못된 JSON/schema를 읽을 때도 선택을 다시 받지만 읽기 실패 안내는 없다. 아래 실패 안내 요구는
  유지하며 GA4 활성화 전에 감지 가능한 실패·안내·검증 범위를 맞춘다. C15의 주요 구현과 별개인 잔여다.

## 2. 목표와 대상 milestone

M0 Core에 GA4 loader와 동의 제어를 구현하되 production 기본값은 비활성으로 유지한다. 활성 gate를
통과한 환경에서도 저장된 분석 동의 후에만 Google tag와 이벤트를 보내고 철회 즉시 중단한다.

## 3. 행위자와 진입 조건

- 공개 이용자: 최초 비차단형 banner, footer `/cookie-settings`, modal 또는 직접 route
- 시작 조건: `NUXT_PUBLIC_GA4_ENABLED=true`·`NUXT_PUBLIC_ANALYTICS_APPROVED=true`이고 활성 선택 범위에 대한 저장값이 없거나 변경됨
- 기본 M0: flag false이므로 banner·분석 option·Google 요청·새 consent 저장이 없다. 과거 localStorage 값이 자동 삭제된다고 보장하지 않으며 비활성 중에는 동의로 사용하지 않는다.

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
| 첫 확장 9개 수동 이벤트·직접 GA4 단일 전송 | 확정 설계 | 분석 계획 §4.1 | §13.1~§13.5 | 명세 반영·미구현 |
| 공개 콘텐츠 키·진입 분류·원시 연결·정확한 집계 | 확정 설계 | API 설계·분석 확장안 | §13.3~§13.7 | 명세 반영·미구현 |
| version3 재동의·BigQuery 일별 저장·운영 수신 | 구현·운영값 필요 | 보안·legal·분석 계획 | §13.2·§13.8 | 활성화 차단 |

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

분석 이벤트 수집 API 해당 없음. Google tag는 browser에서 동의 후 직접 로드하며 BFF·Core·PostgreSQL에
이벤트 수집 경로를 만들지 않는다. 첫 확장의 기존 공개 목록·상세 응답 필드 변경은
[§13.3](#analytics-v1-content-key)과 [공통 API 설계](../../../system-design/03-api-design.md)를 따른다.

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

이 절은 legacy 구현 기준이다. 다음 구현·검수 대상은 §13이며, 기존 anchor는 과거 구현 근거를 위해 유지한다.

아래 API·처리 흐름·화면 절을 이 파일에서 함께 관리한다. 각 절의 미검증·차단 조건은 유지하며, 문서 통합은 구현 완료를 뜻하지 않는다.

분석 전용 API는 없다. 동의 저장 형식은 아래 분석 선택 절이, event별 허용 값은 분석 계획이 소유한다.

<a id="d01-manage-analytics-consent"></a>

### 분석 선택 저장·변경·철회

- 계약 상태: `작성 완료`

- 입력 근거: [분석 계획 §5](../../../planning/04-analytics-ad-plan.md), [쿠키 안내 §3~§5](../../../legal/cookie-settings.md), [퍼블리싱 동의 저장 비교물](../../../ui/publishing/responsive/app.js)
- 현재 수용 잔여: 실제 browser storage·tag/network. 로컬 대체 tag 테스트 범위는 위 현행 구현 절을 따른다.

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

- `version`: 현행 앱과 퍼블리싱 비교물의 storage schema version인 정수 `2`.
- `scope`: 현재 활성 선택 기능 slug를 `analytics`, `ads` 고정 순서로 선택해 쉼표로 연결한 문자열.
  현행 M0 앱은 `analytics`만 허용한다. `analytics,ads`는 후속 광고 확장 계약이며 현재 앱에서는 미지원 scope로 재선택한다.
- `analytics`, `ads`: boolean. scope에 없는 기능은 항상 `false`이며 동의로 해석하지 않는다.
- `savedAt`: 저장 성공 시각의 UTC ISO 8601 문자열.
- 유효 기간: `savedAt`부터 12개월. 달력 기준 12개월이 지난 첫 확인에서 만료로 판정하고 재선택한다.

퍼블리싱 비교물의 `version=2`, 쉼표 구분 scope와 field 구조는 이 계약과 일치하지만 12개월 만료
판정은 구현돼 있지 않다. 실제 앱의 `readConsent`는 달력 1년·윤일·미래 시각·만료를 검사한다.
정적 비교물을 앱 실행 증거로 사용하지 않는다.

미저장→analytics false/true; scope 변경·12개월 만료→재선택 필요; true→false 철회다.

#### 권한·트랜잭션·멱등성·재시도

인증·server transaction 없음. 같은 선택 저장은 같은 결과이며 tag load는 현재 consent를 재확인한다.

#### 완료 조건과 수용 기준

flag false·미저장·거부·철회에서 새 Google tag 로드·request·cookieless ping·쿠키 생성은 0건이어야 한다.
이전에 생성된 `_ga*`는 철회 시 삭제하며, 삭제 실패 시에는 위 실패 흐름대로 전송 중단과 안내를 검증한다.
공개 기능은 유지되어야 한다. 깨진 JSON,
미지원 version, scope 순서 변경, 12개월 경계와 저장 실패도 거부 기본값으로 처리해야 한다.

#### 미정·차단·미검증

GA4 활성화 실값은 차단 상태다. consent 구현·로컬 대체 tag 테스트는 있으나 현재 운영 browser 수용은 별도다.

<a id="d01-send-analytics-events"></a>

### 허용된 GA4 이벤트 전송

- 계약 상태: `작성 완료`

- 입력 근거: [분석 계획 §2·§4](../../../planning/04-analytics-ad-plan.md), [시스템 아키텍처 §4](../../../system-design/01-system-architecture.md)
- 확인: source·로컬 대체 tag 테스트 구조. 미검증: 현재 운영 browser·GA4 DebugView·실제 network

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

event 계약과 adapter 구현은 대조했다. GA4 운영 gate의 실값·현재 browser·DebugView·실제 network는 미검증이다.

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
runtime config에서 빈 값으로 만든다. 해당 server hook은 확인했으며 현재 운영 browser·실제 network는 미검증이다.

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

GA4 활성 gate는 차단 상태다. banner 구현·로컬 대체 tag 테스트는 있으며 현재 운영 화면 수용은 별도다.

<a id="d08-cookie-settings"></a>

### 쿠키 설정

- 계약 상태: `작성 완료`

- 입력 근거: [화면 설계 §10](../../../planning/03-screen-design.md), [쿠키 안내](../../../legal/cookie-settings.md), [퍼블리싱 동의 저장 비교물](../../../ui/publishing/responsive/app.js)
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
- 분석 option은 GA4 flag와 분석 승인 flag가 모두 true일 때만 표시한다.
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
현재 운영 runtime은 미검증이다.

<a id="analytics-v1"></a>

## 13. 첫 확장 구현 — analytics-v1

- 계약 상태: `작성 완료`. milestone은 M0 Core의 선택 분석 확장이며 M1·광고 기능을 포함하지 않는다.
- 구현 상태: 아래 계약의 코드·OpenAPI·테스트·GA4/GTM/BigQuery 설정은 미반영·미검증.
- 제품 정본: [분석 계획 §4.1](../../../planning/04-analytics-ad-plan.md#41-첫-확장-구현-확정--analytics-v1).
- 첫 범위: 공개 목록·상세·정책의 화면 조회, 목록 노출·선택·페이지 이동, 본문 도달·활성 체류,
  공유창·시도·관측 결과, 제한된 진입 분류, 원시 이력 기반 재방문·SPA 연속 열람 분석.
- 후속: 미디어 조작, 오류·성능 이벤트, Clarity, 검색·회원·광고 이벤트, A/B 배정과 자동 보고.
- 새 이벤트 endpoint·PostgreSQL 이벤트 테이블·자체 방문자 쿠키·sessionStorage를 만들지 않는다.

### 13.1 전송 담당 결정과 책임

| 선택 | 장점 | 이번 범위의 부담 | 결정 |
| --- | --- | --- | --- |
| 앱 직접 GA4 | 동의·허용 필드·발생 시점을 코드와 CI에서 함께 검증. 현재 adapter 확장 가능 | 변경 시 앱 배포 필요 | 첫 구현 채택 |
| 앱 이벤트→GTM→GA4 | 태그 연결·운영 변경을 콘솔에서 관리 가능 | 앱과 콘솔의 계약·버전·동의·중복 전송을 별도 관리해야 함 | 첫 구현 미채택 |

1. 공개 컴포넌트는 공통 분석 adapter만 호출한다. 컴포넌트별 `gtag`, GA4 HTTP 요청,
   `dataLayer.push({event: ...})`를 통한 별도 GTM 전송은 만들지 않는다.
2. adapter가 매 호출마다 flag·현재 consent·공개 화면·필드 형식·허용값을 검사한다. 검사 후에만
   `gtag('event', name, { ...sanitized, send_to: measurementId })`를 호출한다.
3. 기존 GTM 컨테이너 삽입은 유지하되 같은 Measurement ID로 전송하는 Google tag·GA4 Event·
   custom HTML은 콘솔에서 중지해야 한다. 중지 여부와 게시된 컨테이너 버전은 활성화 때 실제로 확인한다.
4. 공유 `dataLayer` 객체·GTM 항목을 교체하거나 비우지 않는다. 직접 adapter가 만든 명령만 소유한다.
   공용 객체에 개인·게시물 원문이나 동의 전 행동을 임시로 넣어두지도 않는다.
5. 직접 설정은 `send_page_view=false`, 광고 신호·개인화 OFF이며 GA4 속성의 향상된 측정 전체를 OFF로
   확인한다. 자동 history page view·scroll과 수동 이벤트의 중복을 허용하지 않는다.
6. SDK의 `session_start`, `first_visit`, `user_engagement` 등 자동 기술 이벤트는 아래 9개 수동 이벤트와
   구분한다. 존재·필드·금지값 여부는 실제 network에서 확인한다.

GTM으로 전환하려면 별도 계약 변경에서 전송 담당을 교체한다. 앱 직접 전송을 켠 채 같은 목적지의
GTM 태그를 추가하는 점진적 중복 운영은 사용하지 않는다. [Google의 목적지 지정](https://developers.google.com/tag-platform/gtagjs/routing),
[수동 page view 안내](https://developers.google.com/analytics/devguides/collection/ga4/views)를 근거로 한다.

<a id="analytics-v1-consent"></a>

### 13.2 동의·측정 문맥·화면 수명

- 기존 두 flag와 유효 Measurement ID, 확장 고지 공개·실제 운영 조건 확인을 모두 만족해야 활성화한다.
  새 public flag나 임의의 운영 ID를 이번 문서에서 추가하지 않는다.
- `blariyo_consent`는 `version=3`, `scope="analytics_v1"`, boolean `analytics`, `ads=false`,
  UTC ISO `savedAt`을 저장한다. 12개월 만료·저장 실패 시 OFF 규칙은 유지한다.
- version2는 확장 동의로 사용하지 않는다. 활성화된 v1에서 재선택을 받고, 허용 전에는 직접 GA4를
  로드하지 않는다. 거부·미지원 version·손상값·만료·storage 실패는 거부 기본값으로 처리한다.
- 동의 후 loader가 ready가 되면 그 시점의 화면부터 측정한다. 동의 전 클릭·스크롤·체류를
  쌓아두거나 다시 보내지 않는다. loader 대기 중에는 현재 화면 1건만 보유하고 행동 queue는 만들지 않는다.
- `context_key`는 동의 후 ready에서 생성하는 UUID v4다. 브라우저 메모리에만 두고 전체 새로고침,
  새 document·탭, BFCache 복원, 철회 후 재동의에서 새로 만든다. 사용자·탭의 영구 식별자가 아니다.
- `view_key`는 정상 공개 화면이 확정될 때마다 생성하는 UUID v4다. 최초 hydration은 1회, 완료된
  SPA 이동·뒤로 가기·목록 page 변경은 각각 새 값이다. 취소·실패한 이동이나 단순 hash 변화는 새 조회가 아니다.
  상세 하단 목록만 바뀌면 상세 `view_key`를 유지하고 `list_instance_key`만 바꾼다.
  해당 page_view가 adapter에서 수락되지 않으면 그 view의 행동 관측기를 시작하지 않는다.
- `previous_view_key`는 같은 측정 문맥에서 직전 정상 화면의 값만 연결한다. 문서·탭 간 연결은 하지 않는다.
  오류·관리자·비공개 진입 시 기존 관측기·타이머를 중단하고 연결을 끊는다. 공개 화면 복귀는 새 문맥이다.
- 공개 화면은 정상 응답한 목록·상세·`/terms`·`/privacy`·`/cookie-settings`만 포함한다. 오류·관리자·
  로그인·API·수집 화면은 수동 이벤트 대상이 아니다. 직접 Google tag는 관리자 최초 진입에서 로드하지 않는다.
- 철회 시 전송 차단을 먼저 적용하고 모든 관측기·타이머·메모리 구분값·미전송 체류를 폐기한다.
  철회 시점의 체류를 마지막으로 전송하지 않는다. 이후 `_ga*` 삭제와 실패 안내를 처리한다.

공유 `dataLayer`를 유지하는 것과 분석 이벤트를 계속 허용하는 것은 다르다. GTM 컨테이너 요청은 별도
기준이며, 그 안의 GA4 태그에 직접 adapter의 flag·철회가 자동 전파된다고 가정하지 않는다.

<a id="analytics-v1-content-key"></a>

### 13.3 공개 콘텐츠 키와 API 영향

- 기존 공개 목록·상세 응답의 `analyticsContentKey`를 이벤트의 `content_key` 또는
  `page_content_key`로 매핑한다. 생성·형식·secret 경계는 [공통 API 설계](../../../system-design/03-api-design.md#analytics-v1-공개-콘텐츠-키--확정-설계미구현)가 소유한다.
- Core는 공개 DTO에서만 키를 생성한다. `PostListItem`, `PublicPost`에 선택 필드를 정의하면
  상세 context의 목록도 같은 schema를 재사용한다. docs·packages OpenAPI, 생성 타입·검증기·Core mapper를
  구현 단계에서 함께 갱신한다. BFF의 response 검증·projection을 우회하지 않는다.
- 키가 없거나 형식이 잘못됐으면 해당 게시물의 impression·select·detail·scroll·체류·공유 분석을
  보내지 않는다. 원래 `postId`를 fallback으로 쓰지 않으며 콘텐츠 조회·공유 기능 자체는 유지한다.
  1차 운영 활성화 전에 모든 공개 응답의 키 제공을 확인한다.
- 공개 응답을 받은 시점의 공개 콘텐츠만 관측한다. 숨김/404를 감지하면 키·관측기를 폐기한다.
  이미 열린 화면에서 서버의 숨김을 즉시 알 수 있다고 보장하지 않는다. 이전 전송 자료의 보관·삭제는
  고지와 BigQuery 정책에서 확정하며 활성화 조건에 포함한다.
- key 생성은 통계 API가 아니며 DB 쓰기·별도 조회를 추가하지 않는 DTO 변환이다. 목록 항목별
  추가 SQL 조회나 HMAC 값의 로그 출력을 만들지 않는다.

<a id="analytics-v1-parameters"></a>

### 13.4 공통 매개변수와 기본 필드

수동 이벤트는 아래 공통 필드와 §13.5의 해당 이벤트 필드만 보낸다. 타입·범위를 벗어난 필수값은
해당 이벤트를 drop하고, 정의하지 않은 필드는 제거한다. 문자열로 강제 변환하거나 객체를 직렬화해
보내지 않는다. 암호학적 난수 생성이 불가능하면 식별값을 약한 난수로 대체하지 않고 수동 분석을 중단한다.

| 필드 | 타입·허용값 | 필수·역할 |
| --- | --- | --- |
| `schema_version` | integer `1` | 모든 수동 이벤트. legacy의 필드 없음과 구분 |
| `event_key` | 소문자 UUID v4 문자열 36자 | 모든 이벤트의 개별 전송 시도. GA4 자체 중복 제거 기능으로 가정하지 않음 |
| `context_key` | 소문자 UUID v4 문자열 36자 | §13.2의 메모리 측정 문맥 |
| `view_key` | 소문자 UUID v4 문자열 36자 | 이벤트가 발생한 현재 화면 표시 |
| `page_type` | `list`, `detail`, `policy` | 모든 이벤트 |
| `route_template` | `/:boardSlug`, `/:boardSlug/posts/:postId`, `/policy` | `page_type`과 일치. 실제 route 문자열 금지 |
| `board_slug` | `meme` | list·detail 필수, policy 생략. 새 게시판은 계약 확장 후 허용 |
| `page_content_key` | `^p1_[0-9a-f]{64}$` | detail 필수. 현재 상세 게시물. list·policy에서는 생략 |

- adapter가 넣는 고정 기본 필드: `send_to`는 승인된 Measurement ID, `page_title="블라리요"`,
  `page_referrer=""`, `page_location`은 서비스 origin + `/analytics/list`, `/analytics/detail`, `/analytics/policy`.
  이벤트 입력에서 이 값을 덮어쓰지 못한다. 초기 config와 SPA 화면 변경의 SDK 설정에도 같은 값을 적용한다.
- SDK config의 `campaign_id`, `campaign_source`, `campaign_medium`, `campaign_name`, `campaign_term`,
  `campaign_content`는 빈 문자열로 명시해 원래 URL의 임의 캠페인 값이 자동 유입되지 않도록 한다.
  이 값들은 custom parameter가 아니다. 실제 SDK가 원문을 보내지 않는지는 악성·임의 UTM 입력으로
  검증하며, 설정만으로 비전송을 보장했다고 처리하지 않는다. [Google 설정 필드](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- `user_id`, `user_properties`, 실제 제목·URL·query·hash·본문·댓글·이미지 URL·내부 `postId`, IP 원문,
  회원·소셜·수집 후보 식별자는 보내지 않는다. SDK 자동 필드도 실제 전송을 검증한다.
- SDK의 사용자·세션 구분은 BigQuery의 `user_pseudo_id`와 `ga_session_id`를 사용한다. 클라이언트가
  GA 쿠키를 파싱해 별도 사용자 ID를 만들거나 수동 매개변수로 중복 전송하지 않는다.
- 앱이 지정하는 이벤트 매개변수는 고정 기본 필드를 포함해 25개 이내로 검증한다. custom 문자열은
  최대 100자이며 아래 UUID·enum·콘텐츠 키의 더 좁은 제한을 우선한다. [GA4 수집 제한](https://support.google.com/analytics/answer/9267744?hl=en)

<a id="analytics-v1-events"></a>

### 13.5 첫 구현 수동 이벤트 9개

표의 필드는 공통 필드에 추가된다. `?`는 선택 필드이며 실제 이름에는 포함하지 않는다.

| 이벤트 | 발생 조건·횟수 | 이벤트별 매개변수 |
| --- | --- | --- |
| `page_view` | 동의·ready 후 정상 화면 확정 때 view당 1회. `/` redirect 중간 화면은 제외 | `previous_view_key?`, `list_page?`, `entry_source`, `entry_campaign`, `entry_share_method` |
| `list_impression` | 항목의 50% 이상이 visible document에서 연속 1초 보이면 목록 표시·항목별 1회 | `content_key`, `list_instance_key`, `list_area`, `list_kind`, `list_page`, `list_position`, `impression_key` |
| `select_content` | 현재 글이 아닌 목록 항목을 실제 활성화할 때. 키보드·일반 click·중간 click을 동일 handler 경계로 처리 | `content_type`, `content_key`, `list_instance_key`, `list_area`, `list_kind`, `list_page`, `list_position`, `exposure_state`, `impression_key?`, `open_mode` |
| `list_page_change` | 이용자가 요청한 다른 목록 page가 성공적으로 표시될 때 1회. 최초 목록·실패·취소·같은 page는 제외 | `list_area`, `from_page`, `to_page`, `list_instance_key` |
| `scroll` | 본문 25·50·75% 지점 또는 본문 끝 marker가 1초 이상 보이면 view·구간별 1회 | `depth_percent` |
| `content_engagement` | 본문이 viewport와 겹치고 document가 visible·focus인 시간을 누적. 15초마다 또는 관측 종료 직전에 증분 전송 | `active_ms`, `flush_reason` |
| `share_open` | 닫힌 공유 메뉴가 이용자 조작으로 실제 열릴 때 1회 | 추가 필드 없음 |
| `share` | copy/native/kakao/x의 실제 공유 기능 호출 직전에 시도별 1회 | `share_method`, `share_attempt_key`, `parent_attempt_key?` |
| `share_result` | 해당 공유 API에서 관측한 결과가 확정될 때 시도별 최대 1회 | `share_method`, `share_attempt_key`, `share_outcome`, `parent_attempt_key?` |

| 매개변수 | 타입·허용값·조건 |
| --- | --- |
| `previous_view_key` | UUID v4. 같은 context의 직전 view가 있을 때만 포함 |
| `list_instance_key` | UUID v4. 목록의 응답 page가 실제 표시될 때 새로 생성. 상세 하단 page 변경은 이 값만 교체 |
| `content_key` | 공개 응답의 분석용 키. impression/select의 대상 글이며 현재 상세의 `page_content_key`와 구분 |
| `list_area` | `main`, `detail_footer` |
| `list_kind` | `regular`, `pinned` |
| `list_page`, `from_page`, `to_page` | integer 1~10000. 실제 공개 API page 값. `page_view.list_page`는 list에서만 필수 |
| `list_position` | regular는 1~20, pinned는 1~3. 각 묶음 안의 화면 순서 |
| `impression_key` | UUID v4. 노출 전송 전에 생성하고 adapter 수락 후에만 보유·select에 연결. 거절하면 폐기 |
| `content_type` | `post` |
| `exposure_state` | `qualified`, `unqualified`. 전자는 impression_key 필수, 후자는 생략 |
| `open_mode` | `same_tab`, `new_context`, `unknown`. 수식키·중간 클릭·target으로 판정 가능한 범위만 사용 |
| `depth_percent` | integer 25, 50, 75, 100 |
| `active_ms` | integer 1~60000. 직전 flush 이후 새로 관측한 시간만 전송 |
| `flush_reason` | `interval`, `hidden`, `blur`, `navigation`, `pagehide` |
| `share_method` | `copy`, `native`, `kakao`, `x` |
| `share_attempt_key`, `parent_attempt_key` | UUID v4. fallback copy는 새 시도 키를 만들고 직전 native 시도를 parent로 연결 |
| `share_outcome` | `copied`, `browser_resolved`, `cancelled`, `failed`, `unavailable`, `handoff` |
| `entry_source`, `entry_campaign`, `entry_share_method` | §13.6의 고정 enum. 그 외 문자열 금지 |

발생 시점의 상세 규칙:

- `page_view`는 세 page_type에서 가능하다. list_impression·select_content·list_page_change는
  list/detail에서만 허용하고, main은 list·detail_footer는 detail과 일치해야 한다. scroll·체류·공유
  이벤트는 detail에서만 허용한다. 값이 각각 유효해도 이런 조합이 맞지 않으면 drop한다.
- 빈 목록에는 impression을 보내지 않는다. 상세 하단의 `current=true` 항목은 클릭 가능한 노출의
  분모에서 제외한다. pinned와 regular는 각각 위치를 계산하며 둘 다 같은 조건으로 측정한다.
- 화면 밖 이동·document hidden이면 노출 1초 타이머를 초기화한다. DOM 재사용·위치 변경·page 변경 시
  관측 대상을 새 목록 instance에 연결한다. 추가 페이지 목록은 응답을 최신 요청과 대조한 뒤 표시한다.
- select가 1초 전에 발생하면 unqualified로 보낸다. 이를 클릭률 분자에만 더하지 않는다.
  반복 선택은 행동 건수로 남길 수 있으나 노출당 클릭 성공은 집계에서 한 번만 센다.
- scroll은 문서 전체 높이가 아닌 article 안의 marker로 측정한다. 이미지 로딩·크기 변경 시 위치를
  다시 계산하며 첫 layout이 안정되기 전에 도달을 확정하지 않는다. 동의 직후에는 지금 보이는 marker만
  측정하고 지나간 구간을 소급 생성하지 않는다. 짧은 글의 여러 marker가 함께 보이는 경우는 정상이다.
- 활성 시간은 단조 증가 clock으로 계산하고 hidden·blur·article 이탈 시 멈춘다. 브라우저 정지 등
  연속 관측 간격이 60초를 넘으면 그 공백은 버린다. 다른 화면의 시간을 합치지 않는다. flush 실패 시
  재전송하지 않으며 pagehide 전송 유실 때문에 전체 독서 시간을 완전히 복원한다고 보장하지 않는다.
- copy의 clipboard 성공은 copied, native Promise resolve는 browser_resolved, AbortError는 cancelled다.
  API 없음·SDK 미준비는 unavailable, 허용된 API 오류는 failed다. 카카오/X 호출이 정상적으로 외부에
  넘겨지면 handoff이며 실제 전송·게시·수신 완료를 뜻하지 않는다. 오류 원문은 매개변수에 넣지 않는다.
- native 미지원으로 copy fallback을 실행하면 native/unavailable 결과와 별도의 copy 시도·결과를
  parent로 연결한다. 공유를 두 번 완료했다고 합산하지 않는다. 응답 없는 시도는 실패로 추정하지 않는다.
- 결과 조합은 copy→copied, native→browser_resolved/cancelled, kakao/x→handoff만 허용하며,
  failed/unavailable은 네 방식 모두 가능하다. parent_attempt_key는 native fallback의 copy에만 허용한다.
- 공유 시도는 시작 시점의 context·view·콘텐츠 키를 고정한다. 결과가 도착할 때 동의와 해당 context·view가
  여전히 유효한 경우에만 share_result를 보낸다. 화면 이동·철회 뒤 도착한 결과는 버리고 새 화면에
  귀속하지 않는다. 원래 시도는 결과 미확인으로 남기며 공유 기능 자체의 성공·실패 처리에는 간섭하지 않는다.
- tag 미준비·동의 철회·잘못된 필드에서 adapter가 거절하면 노출·scroll의 전송 완료 guard를 세우지 않는다.
  ready 이후 현재 상태의 관측부터 다시 시작하며 이전 행동을 재현하지 않는다. 전송 수락은 Google 수신 확인이 아니다.

### 13.6 제한된 진입 경로와 공유 링크

- `entry_source`: `google`, `naver`, `bing`, `daum`, `kakao`, `x`, `facebook`, `instagram`,
  `youtube`, `other_referral`, `direct_or_unknown`, `internal_or_unknown`, `share`.
- `entry_campaign`: `none`, `share_v1`. `entry_share_method`: `none`, `copy`, `native`, `kakao`, `x`.
- 분석 동의 후 해당 document에서 첫 ready가 된 시점에만 현재 URL·document.referrer를 읽어
  위 enum으로 정제하고 같은 document의 page_view에 재사용한다. 원문은 저장·로그·외부 전송하지 않는다.
  동의 전에 사라진 유입 query를 보존하거나 복원하지 않는다.
- referrer의 hostname은 정확한 도메인 또는 점으로 경계 지은 하위 도메인만 매칭한다:
  google.com/google.co.kr→google, naver.com→naver, bing.com→bing, daum.net→daum,
  kakao.com→kakao, x.com/twitter.com/t.co→x, facebook.com→facebook,
  instagram.com→instagram, youtube.com/youtu.be→youtube. `google.com.evil.example`은 매칭되지 않는다.
- 같은 서비스 origin은 internal_or_unknown, 다른 정상 HTTP(S) referrer는 other_referral,
  비어 있거나 파싱 불가능하면 direct_or_unknown이다. 도메인만으로 검색 유입이라고 단정하지 않는다.
- 공유 기능이 만드는 링크에는 `utm_source=blariyo_share`, `utm_medium=share`,
  `utm_campaign=share_v1`, `utm_content=<copy|native|kakao|x>`만 추가한다. fragment와 기존 추적 query는
  복사하지 않고 공개 canonical share URL에서 만든다. 개인별 추적값이나 분석용 키를 URL에 붙이지 않는다.
- 들어온 query가 위 네 값의 허용 조합과 일치할 때만 source=share와 해당 method를 설정한다.
  임의 UTM·광고 ID·검색어는 무시하며 SDK의 campaign 설정으로 넘기지 않는다. 재공유의 채널 왜곡은 남는다.
- 이 세 값은 **동의 후 관측한 document 진입 분류**다. GA4 표준 source/medium·세션 획득 보고서를
  복원하는 계약이 아니다. 표준 유입 보고서로 대체하지 않고 맞춤 보고서와 BigQuery에서 사용한다.

### 13.7 GA4 보고서·BigQuery 집계 계약

- 1차는 GA4 기본 보고·사용자 퍼널과 **BigQuery 일별 원시 내보내기·기본 집계**를 함께 준비한다.
  streaming export, 자체 분석 DB, 예약 AI 보고서는 범위 밖이다. 최초 수신일을 기록하고 연결 전 원시
  데이터가 소급 복원되지 않는다는 제한을 유지한다.
- GA4 이벤트 범위 맞춤 측정기준은 `schema_version`, `page_type`, `route_template`, `board_slug`,
  `list_area`, `list_kind`, `exposure_state`, `open_mode`, `depth_percent`, `flush_reason`,
  `share_method`, `share_outcome`, `entry_source`, `entry_campaign`, `entry_share_method`의 15개다.
  `active_ms`는 합계용 맞춤 측정항목 1개로 등록한다. 중복 제외를 적용한 체류 정본은 BigQuery 집계다.
- UUID·콘텐츠 키·page/position 숫자는 GA4 맞춤 측정기준에 등록하지 않고 원시 이벤트에서 사용한다.
  per-post 경로·클릭률을 GA4의 고정 page_location만으로 볼 수 있다고 안내하지 않는다.
- BQ는 `schema_version=1`의 9개 수동 이벤트를 선택하고 동일 event_key의 완전 중복을 1건으로 처리한다.
  같은 키에 다른 payload가 있으면 수집 오류로 분리한다. 구분키가 없으면 임의로 다른 이벤트와 결합하지 않는다.
- 노출 클릭률: 같은 impression_key·view·목록·콘텐츠의 적격 노출과 select를 연결한다. 정상 노출이
  실제 수신된 경우에만 분모·분자를 만든다. 노출과 연결되지 않는 qualified 클릭이나 상위 page_view가
  수신되지 않은 노출은 품질 지표로 따로 보고한다. 클릭되지 않은 정상 노출은 분모에 포함한다.
- 본문 도달률: detail page_view의 고유 view_key를 분모로, 해당 depth의 고유 view_key를 분자로 한다.
  활성 시간은 같은 view의 중복 제거된 active_ms 증분을 합한다. SDK user_engagement를 더하지 않는다.
- **SPA 연속 열람률**: 같은 user_pseudo_id·ga_session_id·context_key 안의 page_view 연결에서
  연속한 상세 조회의 page_content_key가 다르면 앞 조회에 성공 1건이다. 목록·정책 중간 화면은 통과하되
  수신되지 않은 previous_view_key로 연결이 끊기면 성공을 추정하지 않는다. 전체 새로고침·새 탭은 새 문맥이므로
  연결하지 않는다. 같은 글 새로고침 조회 자체는 새 분모에 포함된다. 사용자 퍼널 전환율과 별도 표시한다.
- 복사 성공률은 중복 제거된 copy 시도 대비 copied 결과가 확인된 시도 비율이다. 결과 미수신은
  미확인 건수로 함께 표시한다. 공유 유입은 entry_source=share인 page_view가 있는 관측 세션 수로 집계하며
  개별 공유자와 받은 사람을 연결하지 않는다.
- D1·D7·D30은 user_pseudo_id와 GA4의 최초 관측 시각을 사용하고 기간 내 earliest event를 무조건
  첫 방문으로 바꾸지 않는다. 첫 콘텐츠는 최초 관측일의 첫 유효 콘텐츠 page_view로 고정한다.
  그 시점의 원시 이력이 없으면 미상이며 이후 콘텐츠로 덮어쓰지 않는다. 보고서·속성 시간대는 Asia/Seoul로 맞춘다.
- 일별 확정 보고는 대상일 종료 후 72시간 수신 대기 뒤 계산하고, 나중에 재처리된 자료는 집계 버전과
  재계산 시각을 남긴다. 당일·미완료 코호트는 잠정이다. BQ 보관·삭제 기간, 프로젝트·region·비용 상한의
  실제 값은 `(미정)`이며 운영 활성화 전에 확정한다.
- 노출 건수와 15초 체류 이벤트를 포함한 일별 예상 이벤트량을 산정하고, 속성의 현재 일별 export 상한·
  수신 누락·실제 저장/조회 비용을 확인한다. 상한 초과분이 자동 복원된다고 가정하지 않는다. [원시 내보내기 조건](https://support.google.com/analytics/answer/9358801?hl=en)
- 표본 수·미연결/미확인 수·동의 후 관측 범위·집계 버전을 보고서에 표시한다. 분모가 0이면 자료 없음이다.
  지표를 재현하는 검증 예제는 [확장안 §4.7](../../../planning/04-analytics-expansion-proposal.md#47-계산-검증-예제)를 함께 따른다.

<a id="analytics-v1-acceptance"></a>

### 13.8 구현·검증 순서와 완료 조건

| 순서 | 구현 범위·대상 | 수용 조건 — 아직 미실행 |
| --- | --- | --- |
| 1 | Core 공개 DTO·secret 검증, docs/packages OpenAPI, 타입·검증기 | 같은 게시물의 목록·상세 키 일치, 환경 분리, 비공개·오류·관리자 미노출, 키 없음에도 콘텐츠 정상 |
| 2 | `consent.mjs`, `useConsent.ts`, loader·선택 UI | version2 재선택, version3 저장·만료·철회·storage 실패, 직접 GA4 동의 전 0요청, GTM 컨테이너 요청 구분 |
| 3 | PostList·목록/상세·공유 handler, 단일 adapter | 9개 이벤트의 필드·시점·guard·send_to, 기본 필드 고정, 이벤트당 매개변수 제한, 모르는 필드 제거 |
| 4 | 단위·브라우저 격리 검증 | SSR hydration·SPA·뒤로 가기·하단 page 변경·짧은 글·이미지 지연·새 탭·BFCache·fallback·철회 경합 검증 |
| 5 | GA4/GTM/BQ 운영 설정·고지 — 별도 실행 | 단일 GA4 전송 담당, 향상된 측정 OFF, 맞춤 정의, version3 고지, 계약·보관·비용·원시 수신 확인 |
| 6 | 실제 공개 브라우저·DebugView·BQ·집계 대조 | 동의 전후·철회 요청, URL/개인정보 누출 없음, 수신 중복 없음, 같은 입력의 정의된 지표값 일치 |

추가 실패 수용 조건:

- malformed key/enum/필수값, 일부 콘텐츠 키 누락, tag/CSP/네트워크 실패가 공개 탐색·공유를 막지 않는다.
- native 취소·SDK 미준비·clipboard 실패는 관측된 결과만 남긴다. 동의 철회 뒤 도착한 Promise 결과는 버린다.
- 운영에서 GTM의 같은 목적지 태그를 중지할 수 없거나 상태를 확인하지 못하면 v1을 활성화하지 않는다.
- GA4가 비활성이거나 v1 조건이 충족되지 않아도 일반 M0 공개 기능은 유지한다. 확장 완료를 위해
  관리자·수집·기존 공개 정책을 임의 배포하거나 외부 태그를 켜지 않는다.
- 계측 rollback은 두 flag OFF로 먼저 수집을 중단하고 공개 기능을 유지한다. v3 선택을 v2 동의로
  자동 변환하지 않는다. 원시 export 중단 여부와 기존 데이터의 접근·보관·삭제는 운영 정책에 따라 별도로 처리한다.

### 13.9 문서와 구현 증거의 구분

이 절은 첫 구현 계약을 확정한 결과다. 기존 네 이벤트 소스나 과거 consent 테스트 통과를 9개 이벤트·
콘텐츠 키·v3·GTM 단일 전송·BigQuery 수신의 성공으로 승계하지 않는다. 운영 식별값·secret·계약 법인·
보관 기간의 `(미정)`은 의도적으로 남아 있으며, 실제 값이 필요해지는 활성화 단계에서 확정한다.
