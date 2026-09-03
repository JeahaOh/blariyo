# OpenAPI 초안과 M0 수집 보조 Spec 분리

- 상태: 문서 작성·정적 검수 완료 · source/runtime 미검증
- 기준일: 2026-09-03
- 범위: M0 Core 구현 backlog/OpenAPI 초안 작성 기준, M0 수집 보조 개발 Spec 번들 생성
- Git 경계: stage, commit, push 수행하지 않음

## 요청

사용자가 다음 진행 대상으로 2번과 3번을 지시했다.

1. M0 Core 구현 backlog/OpenAPI 초안 작성
2. scraping은 별도 단계로 `M0 수집 보조` spec부터 작성

## 확인한 정본

- `docs/ai/skills/blariyo-plan-to-development-spec/SKILL.md`
- `docs/ai/skills/blariyo-plan-to-development-spec/references/artifact-contracts.md`
- `docs/ai/skills/blariyo-plan-to-development-spec/references/canonical-routing.md`
- `docs/ai/skills/blariyo-plan-to-development-spec/references/spec-quality-gates.md`
- `docs/planning/01-service-plan.md`
- `docs/planning/content-collection/README.md`
- `docs/planning/03-screen-design.md`
- `docs/system-design/01-system-architecture.md`
- `docs/system-design/02-data-model.md`
- `docs/system-design/03-api-design.md`
- `docs/system-design/05-security-operations.md`
- 기존 M0 Core development spec 번들

## 반영 내용

1. `docs/development-specs/m0-core/implementation-backlog.md`를 추가했다.
2. `docs/development-specs/m0-core/openapi-draft.md`를 추가했다.
3. `docs/development-specs/m0-collection-assist/collection-assist/`에 개발 보강서, API 4개, D01 3개,
   D08 1개를 추가했다.
4. `M0 수집 보조`와 `M0 자동 수집`을 분리하고, 자동 목록 수집·Discord 명령·출처 설정 변경은
   이번 범위 밖으로 유지했다.

## 검수 결과

- `git diff --check`: 통과
- Markdown 상대 링크 검사: 통과
- M0 Core와 M0 수집 보조 milestone 혼합: 확인된 오류 없음
- 정본에 없는 자동 수집 endpoint 추가: 없음
- source·migration·OpenAPI·test·runtime 구현 완료 주장: 없음

## 남은 일

- 실제 앱 scaffold 생성
- 실제 OpenAPI YAML 작성
- source, migration, contract/integration/browser test 작성
- 첫 수집 대상 출처별 source spec 작성과 robots·약관 확인
