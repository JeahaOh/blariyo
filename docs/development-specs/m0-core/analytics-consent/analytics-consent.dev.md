# 분석 동의와 GA4 연동 개발 보강서

## 1. 문서 정보와 입력 근거

- 문서 상태: `초안`
- milestone: `M0 Core` (`m0-core`)
- 기능: `analytics-consent` — 기본 비활성 GA4 loader·선택·철회
- 기준일: 2026-09-02
- 미검증: GA4 property·Measurement ID·CSP·국외이전 고지, browser storage/network, 실제 event
- 주요 근거:
  - [서비스 기획 §11·§13·§14](../../../planning/01-service-plan.md)
  - [화면 설계 §10·§13](../../../planning/03-screen-design.md)
  - [분석·광고 계획 §2~§5·§11·§12](../../../planning/04-analytics-ad-plan.md)
  - [쿠키 설정 안내](../../../legal/cookie-settings.md), [개인정보처리방침 §3·§4·§7·§11](../../../legal/privacy-policy.md)
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

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| 기본 flag false·banner/Google 요청 없음 | 확정 | 분석 계획 §2·§11 | D01 consent, D08 loader/banner | 반영 |
| 동의 뒤 tag·page_view/select_content/share/scroll | 확정 | 분석 계획 §4 | D01 send-events, loader | 반영 |
| 철회 뒤 전송 중단·`_ga*` 삭제 | 확정 | cookie 안내 §4·§5 | D01 consent, cookie-settings | 반영 |
| 선택 범위 변경 시 재선택 | 확정 | 분석 계획 §5 | D01·D08 | 반영 |
| event별 custom parameter allowlist | 결정 필요 | planning에 이름·시점만 존재 | send-events | 상위 계약 누락 |
| Measurement ID·보관·국외이전·CSP | 결정 필요 | legal 출시 차단 | loader | 활성화 차단 |
| 광고 consent/runtime | 범위 밖 | M0 Core 제외 | 전체 | 미노출 |

## 6. 업무 규칙과 수용 조건

- flag false이면 선택 UI나 저장을 요구하지 않는다.
- banner는 콘텐츠 클릭·scroll을 막지 않고 `필수만 사용`, `설정`, `모두 허용`을 제공한다.
- settings는 실제 활성 기능만 보여주며 선택 저장 뒤 banner/modal을 닫는다.
- 분석 거부 상태에서도 공개 목록·상세·공유와 조회 수 API가 정상 동작해야 한다.
- 숨김·삭제 글 title/id, 본문·출처·회원/provider 정보는 GA4로 보내지 않는다.

## 7. 데이터·권한·법무 영향

- `localStorage.blariyo_consent`: `version`, 고정 순서의 활성 `scope`, `analytics`, `ads`, `savedAt`을 가진 JSON;
  마지막 선택 후 12개월. 구체 계약은 [분석 선택 D01](d01/manage-analytics-consent.md)이 소유한다.
- 동의 전 Google 요청 0건, `_ga*` 0건. 자체 DB 저장 없음.
- 활성화 전 Measurement ID·보관 설정·국외이전 고지·실제 Google 법인·CSP domain 확정이 필요하다.

## 8. API 작업 목록

API 해당 없음. Google tag는 browser에서 동의 후 직접 로드하며 BFF·Core·PostgreSQL에 분석 경로를 만들지 않는다.

## 9. D01 프로세스 목록

- [분석 선택 저장·변경·철회](d01/manage-analytics-consent.md)
- [허용된 GA4 이벤트 전송](d01/send-analytics-events.md)

## 10. D08 화면·프로그램 목록

- [쿠키 선택 banner](d08/consent-banner.md)
- [쿠키 설정](d08/cookie-settings.md)
- [GA4 loader](d08/analytics-loader.md)

## 11. 결정·가정·미정·차단 항목

- 결정 필요: 네 event의 custom parameter allowlist. 확정 전에는 custom parameter를 추가하지 않는다.
- 활성화 차단: Measurement ID, property 보관 설정, 국외이전 고지, Google 계약 법인·CSP domain.
- 기본 비활성 M0 동작은 구현 가능하지만 event 계약 누락 때문에 번들은 `초안`이다.
