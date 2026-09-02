---
name: blariyo-plan-to-development-spec
description: Create or update Blariyo feature-level Markdown development spec bundles from confirmed planning and cross-checked legal, system-design, publishing, and wireframe evidence. Produces a development supplement, per-operation API specs when applicable, D01 process specs, and D08 program specs for implementation handoff; do not use for direct coding, PPT generation, or cross-cutting architecture and infrastructure design.
---

# Blariyo 기획에서 개발 Spec 작성

Blariyo의 확정된 기획과 공통 기술 계약을 화면·기능 단위의 개발 가능한 Markdown Spec으로
구체화한다. 결과물은 개발 보강서, API Spec, D01 프로세스 명세서, D08 프로그램 명세서다.
PPTX와 PPT용 model 파일은 만들지 않는다.

## 시작 전

1. `git rev-parse --show-toplevel`로 Blariyo 저장소 루트를 확인한다.
2. 루트 `AGENTS.md`와 `docs/ai/README.md`를 처음부터 끝까지 읽는다.
3. `git status --short --branch`로 현재 브랜치와 기존 변경을 확인한다.
4. 대상 milestone, 기능과 화면·route를 확인한다. 정본에서 결정할 수 없고 결과가 달라지는 값은 사용자에게 확인한다.
5. [정본 라우팅](references/canonical-routing.md)에 따라 입력 기능과 직접 관련된 원문만 읽는다.
6. 기존 Spec을 갱신하는 경우 해당 번들의 모든 파일을 먼저 읽고 사용자 변경을 보존한다.

## 문서 소유권

- `docs/planning/`: 제품 범위, milestone, 화면·운영 규칙과 수용 조건
- `docs/legal/`: 약관, 개인정보, 권리, 쿠키와 출시 차단 조건
- `docs/system-design/`: 여러 기능이 공유하는 아키텍처, 데이터, API, 인프라, 보안·운영 계약
- `docs/development-specs/`: 한 기능 안에서 위 계약을 구현하는 흐름, 화면, API와 데이터 매핑
- `docs/publishing/`, `docs/wireframes/`: 화면 표현을 비교하는 정적 증거이며 제품 정본이 아님
- source·migration·OpenAPI·test·build·runtime·배포: 구현 여부를 판정하는 독립 증거

하위 문서는 상위 정본을 재정의하지 않는다. 제품 범위가 충돌하면 planning, 공통 기술 계약이 충돌하면
system-design을 먼저 정정한다. 개발 Spec은 기능별 구체화와 추적 관계를 소유하며 상위 계약 전체를
복제하지 않는다. 실행 산출물이 Spec과 다르면 구현 완료가 아니라 drift로 판정한다.

## 산출물

기본 출력 위치는 `docs/development-specs/<milestone>/<feature-slug>/`다. 파일명과 필수 항목은
[산출물 계약](references/artifact-contracts.md)을 따른다.

```text
<feature-slug>.dev.md
api/<operation>.md             # API가 있을 때 작업별 1개
d01/<process>.md               # 프로세스별 1개
d08/<screen-or-program>.md     # 화면·프로그램별 1개
```

API가 없는 화면이나 클라이언트 전용 동작에는 빈 API 파일이나 가짜 endpoint를 만들지 않는다.
개발 보강서와 관련 D01·D08에 `API 해당 없음`과 근거를 기록한다.

## 작업 경계

- 사용자가 Spec 작성이나 갱신을 요청한 기능 범위만 수정한다. 코드, Docker, migration, OpenAPI, PPT 생성으로 확대하지 않는다.
- 이 스킬로 `docs/system-design/01`부터 `05`를 자동 수정하지 않는다. 상위 계약 변경이 필요하면 영향과 대상 문서를 보고하고 별도 승인을 받는다.
- `M0 Core`, `M0 수집 보조`, `M0 자동 수집`, `M1`, `M1.5`, 후속 기능을 같은 Spec에 섞지 않는다.
- 실제 domain, credential, provider 계정, 연락처와 시행일이 없으면 `(미정)` 또는 기존 placeholder를 유지한다.
- 기술적으로 그럴듯한 endpoint, field, table, 상태값, 오류 코드와 제한값을 추측해 만들지 않는다.
- commit과 push는 각각 명시적으로 요청받기 전에는 수행하지 않는다.

## 워크플로

### 1. 개발 보강서 작성

입력 문서에서 milestone, 행위자, 진입 조건, 사용자 흐름, 업무 규칙, 수용 조건과 제외 범위를 추출한다.
각 항목을 `확정`, `가정`, `결정 필요`, `미검증`, `범위 밖`으로 나누고 출처 파일과 절을 기록한다.

문서만으로 충분하면 형식적인 인터뷰를 하지 않는다. 구현 계약을 바꾸는 결정이 빠졌으면 질문을
최소화해 확인한다. 답을 받을 수 없으면 개발 보강서에 차단 이유와 영향을 남기며 임의로 확정하지 않는다.
차단되지 않은 부분은 초안으로 계속 작성할 수 있지만 `작성 완료`로 표시하지 않는다.

### 2. API Spec 작성

개발 보강서의 기능·데이터·권한 요구와 `docs/system-design/03-api-design.md`의 공통 계약을 대조한다.
API가 필요한 작업마다 `api/<operation>.md`를 작성한다. request·response, validation, 오류, 인증,
멱등성, 동시성, 상태 전이와 데이터 소유권을 구현 가능한 수준으로 적고 모든 필드와 값의 근거를 남긴다.

API 전체에 적용되는 공통 envelope, 인증 방식과 오류 원칙은 복제하지 않고 system-design의 해당 절을
참조한다. 공통 계약과 다른 예외가 필요하면 Spec에서 임의 확정하지 않고 상위 계약 변경 대상으로 보고한다.

### 3. D01 프로세스 명세서 작성

개발 보강서와 완성된 API Spec을 입력으로 `d01/<process>.md`를 작성한다. 행위자, 시작·선행 조건,
정상 흐름, 대안·실패 흐름, API 호출, 데이터·상태 전이, 중복·재시도와 완료 조건을 단계 순서로 연결한다.
API 없는 클라이언트 전용 흐름도 D01을 만들되 API 호출은 `해당 없음`으로 표시한다.

### 4. D08 프로그램 명세서 작성

화면 기획, publishing·wireframe 비교 결과, 개발 보강서, API Spec과 D01을 입력으로
`d08/<screen-or-program>.md`를 작성한다. route, 진입·이탈 조건, UI 영역, 이벤트, validation,
loading·empty·error·권한 상태, 반응형·접근성, 메시지와 API 매핑을 정의한다.

하나의 기능에 화면·프로그램이 여러 개면 D08을 각각 분리한다. 아키텍처·배치·인프라처럼 화면이나
사용자 프로그램이 없는 작업에는 이 스킬을 적용하지 않는다.

### 5. 상호 검수

[Spec 품질 게이트](references/spec-quality-gates.md)를 적용한다. 특히 다음 연결을 직접 확인한다.

- 개발 보강서의 확정 요구사항이 API·D01·D08 중 적절한 산출물에 반영됨
- D08의 사용자 동작이 D01 단계와 API 작업에 연결됨
- D01의 상태 전이와 API·데이터 계약이 일치함
- API 없는 동작과 미정값에 가짜 계약이 생성되지 않음
- milestone과 기능 범위가 모든 산출물에서 동일함
- 상대 링크, `git diff --check`, 변경 파일 범위가 정상임

## 종료 보고

생성·변경한 Spec, 상위 정본과의 추적 관계, 수행한 문서 검증, 남은 결정과 미검증 실행 증거를
구분한다. Spec 작성 완료, 구현 준비, 구현 완료와 배포 완료를 같은 상태로 보고하지 않는다.
