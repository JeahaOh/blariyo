# 제품·회원·법무·운영 확정 조건 검토

- 검토일: 2026-09-08
- 범위: `docs/planning/` 핵심 제품 계약, `docs/legal/` 전체, 회원·익게 기술 설계와 M1·M1.5 개발 명세
- 상태: 검토 완료. 정본 수정·구현·commit·push는 수행하지 않음
- 판정 기준: 실제 문서 모순·통합 차단 목록의 누락과, 의도적으로 남긴 운영 실값·법무·구현 검증을 구분함

이 검토는 문서 내부의 정책 정합성과 단계별 차단 조건을 감사한 결과다. 법률 자문이나 최신 법령의
적법성 확인 완료를 뜻하지 않는다. 개인정보처리방침의 시점 민감한 법령 문구
(`docs/legal/privacy-policy.md:251`)는 이번에 최신성을 판정하지 않았으며 외부 법무 검증 대상으로 남긴다.
아래 `설계 기준선 동결 가능` 판정은 제품·회원·법무·운영 정책 영역에 한정한다. API·DB·Unicode
단위·Spring 상세 계약 등 다른 영역의 주 검수 발견도 반영돼야 전체 설계를 동결할 수 있다.

## 기준선 확인

- 이전 보완의 D01–D12와 추가 2건은 주 검수 보고서에서 반영 완료로 기록됐다
  (`docs/task_list/09/08/문서정합성보완/review.md:3-25`). KEEP, TERMS·SIGNUP_PRIVACY,
  직접 입력 생년월일·원문 미보관, 글별 랜덤 이름·글쓴이 배지는 다시 미정으로 돌리지 않는다.
- 현행 제품 정본은 위 세 정책을 사용자 확정 정책으로 선언하고
  (`docs/planning/08-member-community-plan.md:17-24`), 탈퇴 KEEP의 세부 동작
  (`docs/planning/08-member-community-plan.md:54-62`)과 글 단위 이름 계약
  (`docs/planning/08-member-community-plan.md:64-80`)을 구체화한다.
- 현재 구조 검사 결과는 Markdown 71개, 상대 링크 661개, 표 342개, 오류 0건이다. 이는 문서 구조
  검증이며 source·migration·test·runtime·브라우저·배포 증거가 아니다.

## 핵심 결론 7건

### 1. High · 확정 — M0 통합 차단표에 본문 차단 조건이 빠져 있다

**양쪽 근거**

- 통합 차단표는 권리 요청에 관해 접수 이메일 값만 열거한다
  (`docs/legal/README.md:69-76`).
- 개인정보처리방침은 공개 서비스 요청의 처리 근거를 출시 전에 확정하도록 하고
  (`docs/legal/privacy-policy.md:40-47`), 권리자 이메일 처리의 적법 근거와 고지 방식도 출시 전 확정
  대상으로 둔다 (`docs/legal/privacy-policy.md:47-52`). 권리자 요청 안내도 같은 차단 조건과 함께
  이름·이메일·소명자료 등을 처리 완료 후 3년 보관한다고 밝힌다
  (`docs/legal/rights-request.md:18-26`, `docs/legal/rights-request.md:57-61`).

**영향**: 개별 본문을 모두 읽지 않고 통합표로 출시 점검을 수행하면 M0의 처리 근거·고지 확인을
빠뜨릴 수 있다. 통합표가 모든 차단 조건을 열거한다고 명시한 것은 아니므로 곧바로 잘못된 출시가
가능하다고 단정하지는 않지만, 현재 목록은 단일 점검표로 쓰기에 불완전하다.

**최소 조치**: `docs/legal/README.md` 표에 ① 공개 서비스 요청의 처리 근거, ② 권리 요청 이메일 처리의
근거·고지 방식과 고지된 3년 기간의 검토를 M0 항목으로 추가한다. 권리자 요청 안내와 쿠키 설정의
시행일도 각 문서가 차단값으로 선언하지만 (`docs/legal/rights-request.md:3-10`,
`docs/legal/cookie-settings.md:3-10`) 표의 시행일 적용 대상은 약관·개인정보처리방침 공통으로만 적혀
있다 (`docs/legal/README.md:69-73`). 이 범위는 **의심** 항목으로, 네 법무 문서 공통인지 기능 공개
시점별인지 한 문장으로 명확히 한다.

### 2. Medium · 확정 — 익게 제품 정책을 법무 README가 아직 미확정으로 표현한다

**양쪽 근거**

- 제품 정본은 신고·운영 판단과 이의제기 표시를 이미 정의하고
  (`docs/planning/08-member-community-plan.md:82-97`), M1.5의 구현 수용과 별도 공개 조건을 나눈다
  (`docs/planning/08-member-community-plan.md:99-104`). 탈퇴 KEEP도 확정돼 있다
  (`docs/planning/08-member-community-plan.md:54-62`).
- 법무 README는 여전히 `익게 작성·댓글·신고, 탈퇴 후 게시글 처리` 자체를 차단 항목으로 두고
  이 기준을 별도 확정해야 한다고 쓴다 (`docs/legal/README.md:86-91`). 같은 README 뒤쪽은 실제 남은
  조건을 동의 전문, 연령 적정성, 90일·8주 보존 근거, 제공자 검증으로 더 정확히 적고 있다
  (`docs/legal/README.md:117-132`).

**영향**: 제품 결정을 다시 사용자에게 묻거나, 반대로 제품 결정이 끝났다는 이유로 법무·운영 gate도
끝난 것으로 오해할 수 있다.

**최소 조치**: 86행과 91행을 제품 정책 확정 요구가 아니라 `M1.5 약관 조항의 법무 검토·시행일`,
`신고 90일·삭제 ledger 8주 근거`, `이의제기 실제 접수값`, `운영자 수용 검증`으로 좁힌다. 약관은
현재 이 범위를 시행 전 검토 초안으로 명시한다 (`docs/legal/terms-of-service.md:149-169`).

### 3. Medium · 확정 — 설계 기준선과 구현·출시 준비 상태가 한 문장에 섞여 있다

**양쪽 근거**

- 시스템 설계 README는 planning → system-design → 기능 명세를 개발 입력으로 정의하고, 법무 실값·
  production 계정·복구 훈련은 공개 전 조건이므로 로컬 개발과 mock adapter 테스트를 시작할 수 있다고
  구분한다 (`docs/system-design/README.md:24-34`).
- 회원 준비 검토는 문서·오프라인 검증이 끝났다고 하면서 운영값과 실제 구현이 없다는 이유로
  `기준선 분리·태그·병합`까지 확정하지 않았다고 적는다
  (`docs/system-design/validation/member-readiness-review.md:1-20`). 이어지는 미완료 목록도 운영 실값,
  보존 판단, 실제 구현과 runtime 검증이다
  (`docs/system-design/validation/member-readiness-review.md:35-45`).

**영향**: 설계가 충분해도 구현 부재 때문에 설계 동결 여부를 판단하지 못하고, 반대로 문서 동결을
구현 수용이나 출시 승인으로 과장할 수 있다.

**최소 조치**: 상태를 `설계 기준선 동결`, `구현 수용`, `production 공개 승인`의 세 칸으로 분리한다.
현재 문서만으로 가능한 것은 첫 칸의 조건부 판정이며, tag·merge 실행은 사용자 결정과 별도 작업이다.

### 4. 조건부 기준선 · 오류 아님 — M0 Core는 로컬 구현을 시작할 수 있고 production은 차단돼 있다

M0 Core의 범위와 수집 단계 분리는 명확하다 (`docs/planning/01-service-plan.md:25-35`). 운영자 표시명,
일반·권리·개인정보 접수 이메일, 개인정보 담당자, 시행일과 실제 호스팅·이미지·이메일 수탁자는
사용자가 제공하거나 운영 계약에서 확인해야 한다 (`docs/legal/README.md:31-40`,
`docs/legal/README.md:64-76`; 단, 결론 1의 누락 보완 필요). 접속·보안 로그와 권리 요청 처리 근거는
외부 법무 검증 대상이다 (`docs/legal/privacy-policy.md:40-52`). 실제 복구 훈련과 배포 설정 검증은
실행 증거가 필요하다 (`docs/system-design/README.md:33-34`).

따라서 **정책·법무 관점에서는 결론 1을 문서상 보완하면 M0 Core 설계 기준선 동결 조건을 충족**하고,
로컬 구현은 지금 시작 가능하다. production 공개는 실값·법무·복구·runtime 증거 전까지 차단이 적절하다.

### 5. 조건부 기준선 · 오류 아님 — 수집·GA4·광고는 M0 Core와 분리돼 있다

수집 가능성 검증, 수집 보조, 자동 수집은 각각 별도 활성화 단계이며
(`docs/planning/content-collection/README.md:40-53`, `docs/planning/content-collection/README.md:178-191`),
GA4는 필요한 값이 없으면 비활성으로 유지해도 M0 Core 공개를 막지 않는다
(`docs/planning/04-analytics-ad-plan.md:18-33`, `docs/planning/04-analytics-ad-plan.md:184-197`). 쿠키 문서도
같은 경계를 유지한다 (`docs/legal/cookie-settings.md:35-43`).

AI가 단계별 체크리스트·비활성 기본값 계약을 정리할 수 있다. 실제 출처별 약관·robots 정책,
User-Agent 연락처, GA4·광고 계약 법인과 설정은 사용자·운영 실값 및 외부 서비스 검증이 필요하다.
이 미정값은 해당 기능만 차단하며 M0 Core 설계 기준선을 막는 오류가 아니다.

### 6. 조건부 기준선 · 오류 아님 — M1 제품·기술 계약은 개발 입력으로 쓸 수 있다

가입은 생년월일 직접 입력 후 판정하고 원문을 저장하지 않으며, TERMS와 SIGNUP_PRIVACY를 각각
동의하는 계약으로 정리돼 있다 (`docs/planning/08-member-community-plan.md:27-39`). 동의 전문도 처리 항목,
원문 즉시 폐기, 발행 artifact 계약을 갖췄다 (`docs/legal/signup-privacy-consent.md:13-28`,
`docs/legal/signup-privacy-consent.md:63-74`).

남은 것은 사용자 실값인 네 provider 앱·callback·안전한 secret 위치·운영 연락처·버전·시행일,
외부 검증인 연령 방식·가입 전 임시 소셜 정보·보존·국외이전의 적정성, 그리고 실제 provider·DB·
브라우저 수용 검증이다 (`docs/planning/08-member-community-plan.md:101-104`,
`docs/legal/signup-privacy-consent.md:76-88`, `docs/legal/privacy-policy.md:158-173`).

따라서 **정책·법무 관점에서는 결론 2·3의 상태 문구를 고치면 M1 설계 기준선 동결 조건을 충족**하고
mock 개발도 가능하다. 실제 회원가입 공개는 위 실값·외부 검증·runtime 증거 전까지 차단한다.

### 7. 조건부 기준선 · 오류 아님 — M1.5 계약은 정해졌고 운영·보존 근거가 남았다

제품 계약은 공개 읽기, 글·댓글, 글 단위 이름, 신고·숨김·삭제·제재와 탈퇴 KEEP를 정했고
(`docs/planning/08-member-community-plan.md:64-104`), 기술 설계는 신고 설명·운영 메모 90일과 삭제
ledger 8주를 법무 검토 전 공개 차단 기본값으로 둔다
(`docs/system-design/06-member-community-design.md:185-202`,
`docs/system-design/06-member-community-design.md:390-417`). 운영 명세도 이의제기 실제 접수값과
운영자 처리 가능성 검증을 차단 조건으로 둔다
(`docs/development-specs/m1-5/community-moderation/community-moderation.dev.md:90-105`).

AI는 약관·개인정보처리방침 초안 연결, 수용 시나리오와 운영 절차를 설계할 수 있다. 사용자는 실제
이의제기 채널과 운영 담당 능력·책임자를 확정해야 한다. 90일·8주·연동 guard 30일의 필요성·근거와
최소 기간은 외부 법무 검증, 경쟁·worker 재시작·복원·provider·브라우저 동작은 실제 구현 검증이
필요하다 (`docs/legal/privacy-policy.md:270-301`,
`docs/system-design/06-member-community-design.md:400-444`).

따라서 **정책·법무 관점에서는 결론 2·3을 반영하면 M1.5 설계 기준선 동결 조건을 충족**한다.
운영 공개는 M1 gate, 약관 법무 검토·시행일, 보존 근거, 실제 접수값과 운영 수용 증거가 모두 있어야 한다.

## 결정권과 다음 조치

| 구분 | 이번 검토에서 남긴 일 | 설계 기준선 차단 여부 |
| --- | --- | --- |
| AI가 설계할 수 있음 | 결론 1의 법무 마스터표 보완, 결론 2의 stale 문구 축소, 결론 3의 3상태 표기, 기존 계약 기반 체크리스트·테스트 시나리오 | 세 문서 오류를 고치기 전에는 최종 동결 보류 권장 |
| 사용자 실값·운영 결정 필요 | 운영자·담당자·문의/권리/이의제기 이메일, 시행일·버전, 실제 수탁자·provider 앱·callback, 운영 책임자와 활성 기능 | 설계값 자리를 정의하는 데는 비차단, 해당 기능 production 공개에는 차단 |
| 외부 검증 필요 | 처리 근거·연령 방식·보존 기간·국외이전·약관 문구의 적정성, 출처별 수집 허용 범위, 실제 provider 계약·데이터 흐름 | 설계 기본안 동결에는 조건부 비차단, 해당 기능 production 공개에는 차단 |
| 실행 증거 필요 | source·migration·test·build·DB 경쟁·worker·복원·browser·배포와 운영자 수용 검증 | 문서 동결에는 비차단, 구현 수용·production 공개에는 차단 |

우선순위는 **결론 1 → 결론 2 → 결론 3**이다. 세 항목을 최소 수정하면 M0 Core·M1·M1.5의
정책·법무 영역은 단계별 조건부 설계 기준선으로 묶을 수 있다. 전체 설계 동결에는 구조·API·DB·
Spring 영역의 주 검수 발견을 추가 반영해야 한다. 이후에는 단계별 실값·외부 검증과 실행 증거를
별도 승인표에서 해제해야 하며, 이를 문서 동결과 같은 완료 상태로 표시하면 안 된다.
