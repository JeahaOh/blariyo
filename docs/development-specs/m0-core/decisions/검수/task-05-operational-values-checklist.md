# 운영 실값 체크리스트 분리

- 상태: 완료 · runtime 미검증
- 기준일: 2026-09-03
- 범위: OD-M0-006, OD-M0-009, OD-M0-011의 남은 운영 실값을 별도 체크리스트로 분리
- Git 경계: stage, commit, push 수행하지 않음

## 요청 맥락

M0 Core 결정 문서 정리와 push 이후, 남은 작업을 이어서 진행한다. 현재 남은 항목은 제품 선택
문제가 아니라 production 공개 또는 provider 활성화 전에 입력·검증해야 하는 실제 운영값이다.

## 확인한 정본

- `docs/development-specs/m0-core/decisions/open-decisions.md`
- `docs/legal/README.md`
- `docs/legal/privacy-policy.md`
- `docs/planning/04-analytics-ad-plan.md`
- `docs/system-design/04-infrastructure-design.md`
- `docs/system-design/05-security-operations.md`

## 반영 내용

1. `operational-values-checklist.md`를 추가해 M0 Core 공개 전 필수값, 사업자등록 전 보류값,
   카카오톡 공유 활성화 gate, GA4 운영 활성화 gate를 분리했다.
2. 실값 원문, token, password, private key, `.env` 값은 기록하지 않는 원칙을 명시했다.
3. `open-decisions.md`의 OD-M0-006, OD-M0-009, OD-M0-011에서 새 체크리스트를 참조하도록 했다.

## 검수 기준

- 실값을 추측하거나 저장소에 남기지 않았는가
- M0 Core production 공개 차단 항목과 provider 활성화 차단 항목을 구분했는가
- 사업자등록 전 보류값을 임의 완료 처리하지 않았는가
- GA4와 카카오톡 공유가 M0 Core 공개 전체 차단으로 잘못 확대되지 않았는가

## 남은 일

- 실제 운영값 입력
- 법무 고지 최종 확인
- provider console 확인
- source/runtime/browser 검증
