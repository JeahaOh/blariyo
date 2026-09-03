# 권리 문의 이메일 작성 D01

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-03
- 입력 근거: [화면 설계 §10 권리 이메일](../../../../planning/03-screen-design.md), [권리자 안내](../../../../legal/rights-request.md)
- 미검증: 실제 수령인·메일 client·법률 고지

## 1. 프로세스 목적과 범위

현재 화면에서 권리자가 확정 접수 이메일로 대상 URL과 요청을 작성하게 한다.

## 2. 행위자·시작·선행 조건

공개 이용자. `BLARIYO_RIGHTS_CONTACT_EMAIL` 실값과 고지 문구가 확정돼야 한다.

## 3. 정상 흐름

1. footer `권리 문의`를 선택한다.
2. client가 제목에 서비스명·문의 유형, 본문에 현재 URL·요청 내용 입력란을 넣은 `mailto`를 연다.
3. 이용자가 필요한 최소 정보와 소명 자료를 직접 검토해 보낸다.
4. 이후 운영 처리는 관리자 [권리 문의 처리 D01](../../admin-post-management/d01/handle-rights-request.md)을 따른다.

footer에는 위 흐름과 별도로 항상 `이메일 주소 복사`를 제공한다. 선택하면
`BLARIYO_RIGHTS_CONTACT_EMAIL`의 이메일 주소만 복사하며 제목·본문은 복사하지 않는다.

## 4. 대안·실패 흐름

- mail client 없음·실행 실패: 성공·실패를 감지하지 않고 원래 page를 유지한다. 이메일 주소 복사는
  mailto 결과와 무관하게 계속 사용할 수 있다.
- 이메일 주소 복사 실패: `aria-live`로 실패를 알리되 form·API·접수 DB로 전환하지 않는다.
- canonical URL 생성 실패는 수용 조건 미충족이다. 빈 URL이나 복사 안내로 대체하지 않는다.

## 5. 단계별 API 매핑

API 해당 없음. 초기에는 form·`/rights`·권리 요청 endpoint를 만들지 않는다.

## 6. 데이터·상태 전이

Blariyo application DB 상태 전이 없음. 메일 내용은 client가 이메일 사업자에 전달한다.

## 7. 권한·트랜잭션·멱등성·재시도

해당 없음. 사용자가 전송을 통제한다.

## 8. 완료 조건과 수용 기준

mailto 본문에는 현재 URL이 포함되고 footer에는 긴 주소 대신 `권리 문의`와 `이메일 주소 복사`가
항상 보여야 한다. 주소 복사는 이메일 주소만 대상으로 하며 제목·본문이 clipboard와 application
log에 없어야 한다. mail client 실행 결과를 감지하는 handler가 없어야 한다.

## 9. 미정·차단·미검증

`[출시 차단: 권리 침해 신고·요청 이메일·시행일 입력 필요]`. mail client 결과 미감지와 이메일 주소만
복사하는 계약은 확정됐으나 실제 client·clipboard·browser 동작은 미검증이다.
