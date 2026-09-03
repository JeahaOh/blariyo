# 정책 시행 Command D08

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-03
- 입력 근거: [데이터 모델 §4](../../../../system-design/02-data-model.md), [보안·운영 §12](../../../../system-design/05-security-operations.md)
- 미검증: CLI source·artifact·runtime

## 1. 프로그램 목적·route·milestone

화면 route 해당 없음. `npm run policies:publish -- --artifact=<path>` 단발성 운영 프로그램이다.

## 2. 진입·이탈·권한 조건

권한 있는 deploy 운영자만 실행하며 artifact는 root `0600`, container read-only mount다. 종료 후 mount·임시 파일을 제거한다.

## 3. UI 영역과 구성요소

CLI 입력은 artifact path만 받는다. stdout/stderr에는 단계·일반 오류 code·최종 version만 표시하고 본문·secret·checksum 전체를 출력하지 않는다.

## 4. 필드·표시값·validation

artifact의 type, version, title, raw body, effectiveAt, checksum schema를 검증한다. 운영자 표시명·일반
문의·권리·개인정보 접수 이메일과 개인정보 보호책임자 또는 담당자 config 실값이 반영됐는지,
필수값 placeholder가 남지 않았는지도 검증한다. 사업자등록 전 보류한 사업자 정보 placeholder는 허용한다.
값은 command argument로 직접 받지 않는다.

## 5. 이벤트·이동·후처리

validate→sanitize→lock/transaction→outbox→결과 확인 순서다. 성공 뒤 운영자가 API·route를 별도 확인한다.

## 6. 프로그램 상태

schema·필수 실값·placeholder 검증 실패, 시행 window 오류, lock/DB 오류, purge pending, 성공을 exit
code와 일반 메시지로 구분한다.

## 7. 반응형과 접근성

CLI이므로 반응형 해당 없음. 색 없이도 exit code·텍스트로 상태를 구분하고 비대화형 실행이 가능해야 한다.

## 8. 이벤트별 D01·API 매핑

[승인 정책 시행](../d01/publish-policy.md)을 수행하며 확인은 [정책 조회](../api/get-policy.md)를 사용한다.

## 9. 메시지와 사용자 피드백

미래·5분 초과 과거·checksum·sanitize·DB·purge를 구분하되 raw body·secret을 출력하지 않는다.

## 10. 프로그램 수용 조건

필수 법무·문의 실값과 placeholder 부재, 실패 rollback, 유형별 current 한 건, 이력 경계, purge
outbox, artifact 제거를 검증해야 한다.

## 11. 미정·차단·미검증

승인 artifact와 실행 source가 없어 차단이다.
