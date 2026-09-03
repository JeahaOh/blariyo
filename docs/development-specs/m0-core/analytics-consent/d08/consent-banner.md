# 쿠키 선택 Banner D08

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `analytics-consent`
- 기준일: 2026-09-03
- 입력 근거: [화면 설계 §10 쿠키 설정](../../../../planning/03-screen-design.md), [쿠키 안내 §4](../../../../legal/cookie-settings.md)
- 미검증: actual browser·viewport·accessibility test

## 1. 목적·route·milestone

별도 route 없이 활성 선택 기능의 최초·변경 동의를 받는 화면 하단 비차단형 banner다.

## 2. 진입·이탈·권한 조건

인증 없음. 활성 선택 기능이 있고 해당 scope 저장값이 없을 때만 표시한다. flag false면 미노출이며,
banner 표시만으로 Google tag/request나 cookieless ping을 만들지 않는다.

## 3. UI 영역과 구성요소

간단한 목적 설명, `필수만 사용`, `설정`, `모두 허용` 세 action. 콘텐츠 위를 가리더라도 click·scroll을 막지 않는다.

## 4. 필드·표시값·validation

비활성 분석·광고 option을 문구로 사전 동의받지 않는다. action은 현재 활성 scope만 저장한다.

## 5. 이벤트·버튼·이동·후처리

필수만/모두 허용은 저장 후 닫기. 설정은 cookie modal을 열고 banner를 배경으로 비활성 처리한다.

## 6. 화면 상태

미노출(default), 선택 필요, 저장 중, 저장 실패를 구분한다. 실패는 거부 기본값으로 tag를 차단한다.

## 7. 반응형과 접근성

360px에서 가로 scroll 없음, action 44px 이상, DOM focus 순서와 `aria-label`을 제공한다.

## 8. 이벤트별 D01·API 매핑

[분석 선택 관리](../d01/manage-analytics-consent.md); API 해당 없음.

## 9. 메시지와 사용자 피드백

거부해도 콘텐츠를 이용할 수 있음을 명확히 알린다. 미정 provider 이름을 노출하지 않는다.

## 10. 화면 수용 조건

flag false 미노출, true+미선택 표시, 저장 후 닫힘, scope 변경 시 재표시, 콘텐츠 비차단을 확인한다.

## 11. 미정·차단·미검증

GA4 활성 gate는 차단 상태지만 banner contract는 확정. browser 검증은 미실행이다.
