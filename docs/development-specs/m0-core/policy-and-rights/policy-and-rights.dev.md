# 정책 공개와 권리 문의 개발 보강서

## 1. 문서 정보와 입력 근거

- 문서 상태: `차단`
- milestone: `M0 Core` (`m0-core`)
- 기능: `policy-and-rights` — 약관·개인정보 버전 조회와 권리 문의 진입
- 기준일: 2026-09-03
- 미검증: 법률 확정, 실제 정책 artifact, 접수 이메일, policy command/API/source/runtime
- 주요 근거:
  - [서비스 기획 §3·§11·§14](../../../planning/01-service-plan.md)
  - [화면 설계 §10·§13](../../../planning/03-screen-design.md)
  - [법무 문서 목록과 출시 차단](../../../legal/README.md)
  - [이용약관](../../../legal/terms-of-service.md), [개인정보처리방침](../../../legal/privacy-policy.md), [권리자 안내](../../../legal/rights-request.md)
  - [데이터 모델 §4](../../../system-design/02-data-model.md), [API 설계 §3 정책](../../../system-design/03-api-design.md)

## 2. 목표와 대상 milestone

이용자가 현재·과거 이용약관과 개인정보처리방침 전문을 modal 또는 직접 route에서 확인하고,
현재 URL이 포함된 권리 문의 이메일을 작성할 수 있게 한다. 승인된 정책은 버전별 불변 기록으로 시행한다.

## 3. 행위자와 진입 조건

- 공개 이용자: footer의 이용약관·개인정보처리방침·권리 문의, `/terms`, `/privacy`
- 운영자: 승인된 policy release artifact를 시행 시각부터 5분 안에 단발성 command로 발행
- 선행: 운영자 표시명·시행일·일반 문의·권리 침해 신고/요청·개인정보 문의 이메일,
  개인정보 보호책임자 또는 담당자, 실제 사용 수탁자 실값 확정과 법률 검토

## 4. 범위와 범위 밖

범위:

- `terms`,`privacy` 현재·과거 버전 조회와 본문·이력 UI
- modal focus·scroll 제어와 직접 route fallback
- 정책 시행 command의 checksum·sanitize·version 전환·cache purge
- footer `권리 문의` mailto·항상 접근 가능한 `이메일 주소 복사`와 관리자 우선 숨김 프로세스 연결

범위 밖:

- 권리 문의 form·`/rights`·권리 요청 API
- mail client 실행 성공·실패 감지, 별도 접수 DB
- 법률 문구 자체 확정, 이메일 사업자 선정, ticket/민감자료 저장
- 쿠키 선택 UI는 [analytics-consent](../analytics-consent/analytics-consent.dev.md)가 소유한다.

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| current 전문과 버전·적용 기간 이력 | 확정 | 화면 설계 §10 | get-policy, D01·D08 policy | 반영 |
| 시행된 본문 불변·버전 보관 | 확정 | 데이터 모델 §4 | publish-policy, D08 command | 반영 |
| modal·직접 route 동등 내용 | 확정 | 서비스 기획 §11 | policy-viewer | 반영 |
| 현재 URL을 넣은 권리 mailto | 확정 | 화면 설계 §10 | submit-rights-inquiry, rights-entry | 반영 |
| 법무·문의 실값의 properties/config 주입 | 확정 | OD-M0-006·legal README | policy D01·D08 | 실값 미입력으로 `[출시 차단]` 유지 |
| 사업자등록 전 사업자 정보 보류 | 확정 | OD-M0-006·legal README | policy D01·D08 | `(미정)` 유지 |
| mailto와 독립적인 이메일 주소 복사 | 확정 | 사용자 결정·legal README | rights D01·D08 | 주소만 복사, 제목·본문 제외 |
| mail client 실행 결과 감지 없음 | 확정 | 사용자 결정·legal README | rights D01·D08 | 성공·실패 분기 미생성 |
| form·API | 범위 밖 | 서비스 기획 §11 | 전체 | 생성 안 함 |

## 6. 업무 규칙과 수용 조건

- 정책 API는 `terms`,`privacy`만 받고 `EFFECTIVE`와 `RETIRED`만 공개한다.
- 본문은 허용 목록으로 sanitize한 `bodyHtml`만 반환하고 초안·원문은 공개하지 않는다.
- 현재 적용 기간은 `시행 중`, 과거는 시작~종료이며 행 선택 시 같은 modal 본문을 교체한다.
- 권리 mailto에는 현재 URL과 요청 내용 입력란만 미리 넣고 개인정보 원문을 자동 수집하지 않는다.
- 권리 mailto와 `이메일 주소 복사`는 `BLARIYO_RIGHTS_CONTACT_EMAIL` 실값만 사용한다. 복사 동작은
  mailto 실행 결과와 무관하게 항상 노출하고 이메일 주소만 복사한다. client 실행 성공·실패를
  감지하거나 form·API·접수 DB로 분기하지 않는다.

## 7. 데이터·권한·법무 영향

- `legal.policy_version`의 시행 버전은 불변이며 유형별 EFFECTIVE 한 건이다.
- policy artifact는 root `0600`, command container read-only mount, 종료 후 제거한다.
- 권리 메일 본문·소명자료는 application DB·log에 복사하지 않는다.
- 법무 placeholder는 근거 없이 제거하지 않는다.

## 8. API 작업 목록

- [정책 버전 조회](api/get-policy.md)
- 정책 시행은 HTTP API 해당 없음. 운영 단발성 command를 사용한다.

## 9. D01 프로세스 목록

- [정책 본문과 이력 열람](d01/view-policy.md)
- [승인 정책 시행](d01/publish-policy.md)
- [권리 문의 이메일 작성](d01/submit-rights-inquiry.md)

## 10. D08 화면·프로그램 목록

- [정책 viewer](d08/policy-viewer.md)
- [정책 시행 command](d08/policy-publish-command.md)
- [권리 문의 진입](d08/rights-inquiry-entry.md)

## 11. 결정·가정·미정·차단 항목

- 출시 차단: legal README의 운영자 표시명·시행일·수탁자·일반 문의·권리·개인정보 접수 이메일과
  개인정보 보호책임자 또는 담당자 실값. 사업자 정보는 사업자등록 또는 거래 기능 확정 전까지 보류한다.
- 확정: mail client 실행 결과를 감지하지 않고 `이메일 주소 복사`를 항상 제공한다. 복사 범위는
  이메일 주소뿐이며 제목·본문은 제외한다.
- 미검증: 법률 자문, 실제 release artifact/checksum, SMTP/mail client, policy cache purge.
- 문서 계약은 작성했지만 실값이 없으므로 상태를 `차단`으로 유지한다.
