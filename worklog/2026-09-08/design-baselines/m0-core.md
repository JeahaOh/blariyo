# M0 Core 설계 기준선 manifest v1

- 상태: 과거 v1 범위 정의 참고본, 현행 Git 기준선 아님
- 과거 기준선 tag: `design/m0-core/v1` (삭제됨)
- tag 상태: 현행 ref 없음, 재생성 계획 없음
- 과거 선행 기준선: 없음
- 현행 준비 판정: [M0 Core](../../../docs/system-design/design-readiness.md#현재-판정) 조건부 확정 가능

## 포함 범위

| 계층 | 정본 | 포함 절·범위 |
| --- | --- | --- |
| planning | [01-service-plan.md](../../../docs/planning/01-service-plan.md) | §1의 M0 Core 단계, §2의 공개 짤·URL, §§3~5·§7, §§9~11, §14의 `M0 Core`. §6은 광고·제휴가 M0 비활성·후속이라는 경계 문장만, §8은 수집이 M0 Core 이후라는 경계 문장만 포함 |
| planning | [02-infra-plan.md](../../../docs/planning/02-infra-plan.md) | §§1~10 중 M0 Core 행·문장. 수집 보조·자동 수집, M1·M1.5 행은 단계 경계로만 참조 |
| planning | [03-screen-design.md](../../../docs/planning/03-screen-design.md) | §§1~8의 M0 Core 화면, §10 정책 modal·직접 경로, §12, §13의 `M0 Core` |
| planning | [04-analytics-ad-plan.md](../../../docs/planning/04-analytics-ad-plan.md) | §§1~5, §11의 M0 Core·GA4 기본 비활성 flag, §12의 `M0 Core`·GA4 활성 gate. §10 수집 운영 측정은 제외 |
| planning | [05-benchmark-spec.md](../../../docs/planning/05-benchmark-spec.md) | §§1~4, §5의 짤 목록·상세, §6, §8, §9의 정책, §§10~11 |
| planning | [06-copy-contract.md](../../../docs/planning/06-copy-contract.md), [07-color-palette.md](../../../docs/planning/07-color-palette.md) | 전체 |
| legal | [README.md](../../../docs/legal/README.md) | `법무·문의 실값 관리`, `공통 정책 계약`, `출시 차단 항목`의 M0 Core·보류 행, `작성 기준` |
| legal | [terms-of-service.md](../../../docs/legal/terms-of-service.md) | §§1~15 중 M0 Core 공개·운영자 게시·권리·정책·쿠키 조항. §2·§4의 회원/소셜 정의·서비스와 별도 M1.5 추가 절은 제외 |
| legal | [privacy-policy.md](../../../docs/legal/privacy-policy.md) | 핵심 요약, §§1~15 중 M0 공개 요청·조회 수·로그·권리 요청·수탁·파기·안전성·담당자·변경 조항. provider 회원·M1/M1.5 추가안, 비활성 GA4·광고의 실제 활성 조항은 제외 |
| legal | [rights-request.md](../../../docs/legal/rights-request.md) | 전체 |
| legal | [cookie-settings.md](../../../docs/legal/cookie-settings.md) | §§1~7 중 M0 필수 저장소와 GA4 기본 비활성·동의 gate. 광고 및 `M1 인증 저장소 설계값` 절은 제외 |
| system | [README.md](../../../docs/system-design/README.md) | 문서 책임, 현재 준비 상태, 설계 범위·원칙과 핵심 결정의 M0 Core 범위 |
| system | [01-system-architecture.md](../../../docs/system-design/01-system-architecture.md) | §§1~4에서 collector 전용 중계 제외, §5의 목록·상세·이미지/발행·권리 숨김·예약 발행, §§6~7 |
| system | [02-data-model.md](../../../docs/system-design/02-data-model.md) | §§1~5, §7의 M0 상태 전이, §§8~11 중 `content`·`legal`·`ops`와 M0 Core gate. §5의 수집 보조 resource type·nullable 확장과 `SPRING_V2` 7일 receipt, §9의 `SPRING_V2` 보존 행은 제외 |
| system | [03-api-design.md](../../../docs/system-design/03-api-design.md) | §§1~4, §5 관리자 API, §§6~9의 M0 Core 계약. `5-1 수집 관리자 API`와 Spring 수집 절 제외 |
| system | [04-infrastructure-design.md](../../../docs/system-design/04-infrastructure-design.md) | §§1~10 중 공개 Web/Core/PostgreSQL/R2/backup 배포. 마지막 `로컬 Spring 수집 서버 배치 경계` 제외 |
| system | [05-security-operations.md](../../../docs/system-design/05-security-operations.md) | §§1~13 중 수집 전용 하위 절·runbook을 제외한 공개/관리자/정책/DB/로그/백업·복구·배포 계약. 마지막 Spring 수집 절 제외 |
| system | [design-readiness.md](../../../docs/system-design/design-readiness.md) | 상태 정의·변경 규칙과 `M0 Core` 행 |
| development spec | [implementation-backlog.md](../../../docs/development-specs/m0-core/implementation-backlog.md), [openapi-draft.md](../../../docs/development-specs/m0-core/openapi-draft.md), [openapi/m0-core.yaml](../../../docs/development-specs/m0-core/openapi/m0-core.yaml) | 전체 |
| development spec | [public-post-browsing.dev.md](../../../docs/development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md), [admin-post-management.dev.md](../../../docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md), [policy-and-rights.dev.md](../../../docs/development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md), [analytics-consent.dev.md](../../../docs/development-specs/m0-core/analytics-consent/analytics-consent.dev.md) | 전체 |

## 제외 범위

- M0 수집 보조와 M0 자동 수집의 collector·후보·출처 API/schema/runtime.
- M1 회원, M1.5 익게, 뉴스·추가 게시판, 광고·제휴 활성화.
- `docs/development-specs/m0-core/decisions/`와 task/worklog는 결정 이력이지 구현 입력 정본이 아니다.
- publishing·wireframe은 정적 비교 자료이며 baseline 정본이 아니다.

## 남은 gate와 미검증

- production 공개 차단: 운영자·문의/권리/개인정보 이메일, 담당자, 시행일·실제 policy artifact,
  실제 호스팅·이미지·이메일 수탁자, 요청/권리/로그 처리 근거와 복구 훈련.
- GA4·Kakao는 운영값·도메인·CSP·동의·법무 gate 전 기본 비활성이다. 광고·제휴는 범위 밖이다.
- 새 source·migration·생성 타입·OpenAPI 배치본·test·build·PostgreSQL/R2·runtime·browser·deployment는
  미구현 또는 미검증이다.
- 법무 문서 포함은 초안과 차단 조건을 고정하는 것이며 법률 자문 완료를 뜻하지 않는다.

## 과거 Annotated tag 계약 (폐기)

아래 내용은 당시 tag에 적용한 계약이며 현행 Git 정책이 아니다. tag annotation은
`Blariyo design baseline: M0 Core v1`, 이 manifest 경로, `design only`, 구현 수용과 production 공개
승인 제외를 기록했다.
