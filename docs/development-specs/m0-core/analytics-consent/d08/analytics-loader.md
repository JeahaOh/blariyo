# GA4 Loader D08

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `analytics-consent`
- 기준일: 2026-09-02
- 입력 근거: [분석 계획 §2·§4·§11](../../../../planning/04-analytics-ad-plan.md), [보안·운영 §4 CSP](../../../../system-design/05-security-operations.md)
- 미검증: Measurement ID·CSP·GA4 network·DebugView

## 1. 프로그램 목적·route·milestone

모든 공개 route에서 현재 flag·consent를 검사해 필요할 때만 Google tag를 load하는 browser 프로그램이다.

## 2. 진입·이탈·권한 조건

flag true + analytics consent true + 승인 설정이 모두 필요하다. 하나라도 아니면 외부 script/request를 만들지 않는다.

## 3. UI 영역과 구성요소

직접 UI 없음. banner·cookie settings의 선택을 구독하고 event adapter를 제공한다.

## 4. 필드·표시값·validation

공개 Measurement ID 형식, 승인된 Google CSP host allowlist, current consent scope를 검사한다. secret은 없다.

## 5. 이벤트·후처리

동의 true 전환 시 1회 load, false 전환 시 추가 전송 중지·cookie 삭제. route/interaction은 event D01을 따른다.

## 6. 프로그램 상태

disabled, denied, loading, ready, blocked/error를 구분하되 오류가 page JavaScript를 중단시키지 않는다.

## 7. 반응형과 접근성

UI 없음. 상태 안내는 cookie settings의 `aria-live`를 사용하고 콘텐츠 focus를 바꾸지 않는다.

## 8. 이벤트별 D01·API 매핑

[선택 관리](../d01/manage-analytics-consent.md), [event 전송](../d01/send-analytics-events.md). Blariyo API 해당 없음.

## 9. 메시지와 사용자 피드백

provider 내부 오류를 이용자에게 노출하지 않고 선택 저장/철회 결과만 알린다.

## 10. 프로그램 수용 조건

flag false·미동의·철회 Google 요청 0건, 동의 뒤 1회 load, loader 실패 시 공개 기능 유지가 필요하다.

## 11. 미정·차단·미검증

Measurement ID·CSP domain·국외이전·event custom parameter가 미정이라 `초안`이다.
