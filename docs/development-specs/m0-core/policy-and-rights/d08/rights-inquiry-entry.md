# 권리 문의 진입 D08

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-02
- 입력 근거: [화면 설계 §10 권리 이메일](../../../../planning/03-screen-design.md), [권리자 안내](../../../../legal/rights-request.md)
- 미검증: 실제 이메일·mailto/browser test

## 1. 목적·route·milestone

별도 route 없이 공개 footer의 `권리 문의` 진입점으로 mail client를 연다.

## 2. 진입·이탈·권한 조건

모든 공개 화면에서 인증 없이 사용한다. mail client로 이탈하며 원래 page는 유지된다.

## 3. UI 영역과 구성요소

footer의 짧은 link 문구 `권리 문의`; 주소를 길게 노출하지 않는다. 별도 form은 없다.

## 4. 필드·표시값·validation

mailto 제목은 서비스명·문의 유형, body는 현재 canonical URL·요청 입력란이다. 수령 주소는 확정값만 사용한다.

## 5. 이벤트·이동·후처리

click 시 안전하게 encode한 mailto를 연다. client 실패 시 대체 UX는 `(결정 필요)`다.

## 6. 화면 상태

loading 해당 없음. 이메일 미정이면 production에서 깨진 link를 노출하지 않고 출시를 차단한다.

## 7. 반응형과 접근성

link accessible name이 문구와 일치하고 keyboard activation·focus 표시를 지원한다.

## 8. 이벤트별 D01·API 매핑

[권리 문의 이메일 작성](../d01/submit-rights-inquiry.md); API 해당 없음.

## 9. 메시지와 사용자 피드백

메일 전송 성공이나 mail client가 실제로 열렸는지 서비스가 추측해 표시하지 않는다. click 후에는
원래 page를 유지하며, 대체 접수 UX가 확정되기 전 별도 성공 안내를 만들지 않는다.

## 10. 화면 수용 조건

현재 URL 포함, 개인정보 자동 수집 없음, `/rights`·form·API 미생성을 확인한다.

## 11. 미정·차단·미검증

접수 수령인·이메일·회신 채널이 `[출시 차단]` 상태이며 mail client 실패 대안도 미정이다.
