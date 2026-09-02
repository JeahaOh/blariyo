# 쿠키 설정 D08

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `analytics-consent`
- 기준일: 2026-09-02
- 입력 근거: [화면 설계 §10](../../../../planning/03-screen-design.md), [쿠키 안내](../../../../legal/cookie-settings.md), [퍼블리싱 동의 저장 비교물](../../../../publishing/responsive/app.js)
- 미검증: actual modal/direct route·storage test

## 1. 목적·route·milestone

`/cookie-settings` 직접 화면과 footer modal에서 실제 활성 저장소와 선택을 확인·변경한다.

## 2. 진입·이탈·권한 조건

인증 없음. footer에서 언제든 진입. modal 닫기 후 원래 focus/scroll 복귀, JavaScript 실패 시 직접 route.

## 3. UI 영역과 구성요소

필수 설정 저장소 설명, 활성 분석 option, `선택 저장`; 활성 선택 기능이 없으면 상태 문구만 표시한다.

## 4. 필드·표시값·validation

- `blariyo_consent`: [분석 선택 D01](../d01/manage-analytics-consent.md)의 `version=2`, 고정 순서 `scope`,
  `analytics`, `ads`, UTC `savedAt` JSON. `savedAt`부터 달력 기준 12개월 뒤 만료한다.
- 분석 option은 GA4 flag true일 때만 표시한다.
- M0에서 광고가 비활성이면 광고 option·cookie를 표시하거나 만들지 않는다.

## 5. 이벤트·버튼·이동·후처리

option 변경→선택 저장→loader 반영→modal/banner 닫기. 철회는 전송 중단과 `_ga*` 삭제를 즉시 요청한다.

## 6. 화면 상태

비활성: `현재 활성화된 저장소가 없습니다`; 활성·미선택; 저장 완료; storage/delete 실패; 깨진 JSON·
미지원 version·만료는 미선택으로 구분한다.

## 7. 반응형과 접근성

modal focus trap/return, background inert, Escape/dim/닫기, label-control 연결과 status `aria-live`를 적용한다.

## 8. 이벤트별 D01·API 매핑

[분석 선택 관리](../d01/manage-analytics-consent.md); API 해당 없음.

## 9. 메시지와 사용자 피드백

활성 기능·목적·기간·철회 효과를 평이하게 표시하고 철회가 공개 열람을 막지 않음을 알린다.

## 10. 화면 수용 조건

modal/direct route 동등 내용, 비활성 option 미노출, 12개월 scope, 철회 네트워크·cookie 차단을 확인한다.

## 11. 미정·차단·미검증

GA4 실제 cookie 만료·property 보관·국외이전은 활성화 차단값이다. 화면 runtime은 미검증이다.
