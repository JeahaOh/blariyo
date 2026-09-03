# 권리 문의 진입 D08

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-03
- 입력 근거: [화면 설계 §10 권리 이메일](../../../../planning/03-screen-design.md), [권리자 안내](../../../../legal/rights-request.md)
- 미검증: 실제 이메일·mailto/browser test

## 1. 목적·route·milestone

별도 route 없이 공개 footer의 `권리 문의`로 mail client를 열고, 독립된 `이메일 주소 복사`를 제공한다.

## 2. 진입·이탈·권한 조건

모든 공개 화면에서 인증 없이 사용한다. mail client로 이탈하며 원래 page는 유지된다.

## 3. UI 영역과 구성요소

footer의 짧은 link 문구 `권리 문의`와 button `이메일 주소 복사`; 주소를 길게 노출하지 않는다.
두 동작은 항상 함께 접근할 수 있으며 별도 form은 없다.

## 4. 필드·표시값·validation

mailto 제목은 서비스명·문의 유형, body는 현재 canonical URL·요청 입력란이다. 수령 주소는
`BLARIYO_RIGHTS_CONTACT_EMAIL`의 확정 실값만 사용한다. 주소 복사는 같은 값의 이메일 주소만
대상으로 하며 mailto 제목·본문은 포함하지 않는다.

## 5. 이벤트·이동·후처리

`권리 문의` 선택 시 안전하게 encode한 mailto를 연다. client 실행 성공·실패를 감지하지 않는다.
`이메일 주소 복사`는 mailto 결과와 무관하게 항상 제공하며 form·API·접수 DB로 분기하지 않는다.

## 6. 화면 상태

loading 해당 없음. 이메일 미정이면 production에서 깨진 link를 노출하지 않고 출시를 차단한다.

## 7. 반응형과 접근성

link와 button의 accessible name이 문구와 일치하고 keyboard activation·focus 표시를 지원한다.

## 8. 이벤트별 D01·API 매핑

[권리 문의 이메일 작성](../d01/submit-rights-inquiry.md); API 해당 없음.

## 9. 메시지와 사용자 피드백

메일 전송 성공이나 mail client가 실제로 열렸는지 서비스가 추측해 표시하지 않는다. mailto 선택
후에는 원래 page를 유지한다. 주소 복사 성공·실패만 별도 `aria-live`로 알린다.

## 10. 화면 수용 조건

현재 URL 포함, 개인정보 자동 수집 없음, `/rights`·form·API·mail client 결과 감지·접수 DB 미생성과
이메일 주소만 복사되는지 확인한다.

## 11. 미정·차단·미검증

권리 침해 신고·요청 이메일 실값과 시행일이 `[출시 차단]` 상태다. mail client 결과 미감지와 독립된
주소 복사는 확정됐지만 실제 mailto·clipboard·browser 동작은 미검증이다.
