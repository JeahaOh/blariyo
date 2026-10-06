# AI Slop 방지 도구 4종 적용성 검토

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6aedce57d41993d49060793656870c5c318f`
- 상태: 종료(검토·기록 완료, 도입 미착수) / 갱신: 2026-10-06 19:53 KST
- 요청: Attention Span, Andrej Karpathy Skills, Anti Slop, Verification Before Completion의 프로젝트 적용 가능성 확인.
- 변경 경로: 이 신규 README만. 설치·정본/source/설정 수정·Git 변경·배포는 범위 밖.
- 담당 확인: `collector-request-policy`는 진행 상태이며 Collector·관련 정본/테스트를 소유한다. 해당 경로를 수정하지 않고, 기존 담당이 없는 이 검토 기록에만 작성한다. 브랜치 전환·빌드·DB 검사를 병행하지 않는다.
- 완료 조건: 외부 원문을 고정 SHA로 확인하고 현행 지침·기술 계약·lint/CI source와 비교해 중복, 충돌, 도입 순서와 미검증 범위를 기록한다.

## 결론

**4종 모두 활용 여지는 있지만 전체 설치는 비추천이다. 지침은 기존 정본에 필요한 원칙만 반영하고, Anti Slop은 제한된 규칙을 별도로 평가하는 것이 적합하다.**

| 도구 | 적용 판정 | 추가 가치 | 비용·제약 |
| --- | --- | --- | --- |
| Attention Span | 별도 설치 우선순위 낮음 | 결론 우선, 짧은 보고, 중요한 조건 보존 | 사용자 한국어·불릿 지침과 대부분 중복. 코드 정확성 검사 기능 없음 |
| Karpathy Skills | 원칙 일부 반영 권장 | 추측성 기능·일회성 추상화 억제, 변경과 검증 목적 연결 | G01/G02와 중복. 모든 모호함을 중단·질문으로 처리하거나 기존 계층을 없애면 부작용 |
| Anti Slop | 선택 규칙의 시험 적용 후보 | 정해진 코드 패턴을 실행 검사로 탐지 | 기본 규칙은 입력 검증과 충돌 가능. Oxlint 추가 및 복사한 규칙의 유지보수 필요 |
| Verification Before Completion | 기존 G06·검증 양식에 통합 권장 | 주장에 맞는 검사를 실행하고 출력·종료 상태 확인 | 스킬 자체는 자동 차단 장치가 아님. 원문 전체 도입은 중복 실행을 유발할 수 있음 |

## 외부 근거 기준

2026-10-06 GitHub 기본 브랜치의 HEAD를 조회한 뒤 해당 SHA의 원문을 읽었다. 외부 파일은 `/tmp/blariyo-slop-review-20261006/`에서 읽기 자료로만 취급했으며 설치 스크립트는 실행하지 않았다.

| 저장소 | 검토 SHA | 핵심 원문 |
| --- | --- | --- |
| alexgreensh/attention-span | `2714c965e6be1fa2597510e66651e63bc67cb448` | [Attention-kind](https://github.com/alexgreensh/attention-span/blob/2714c965e6be1fa2597510e66651e63bc67cb448/output-styles/attention-kind.md) |
| multica-ai/andrej-karpathy-skills | `2c606141936f1eeef17fa3043a72095b4765b9c2` | [CLAUDE.md](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md) |
| dmmulroy/anti-slop | `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` | [README](https://github.com/dmmulroy/anti-slop/blob/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b/README.md), [등록 규칙](https://github.com/dmmulroy/anti-slop/blob/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b/src/index.ts), [설치 스킬](https://github.com/dmmulroy/anti-slop/blob/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b/skills/install-anti-slop/SKILL.md) |
| obra/superpowers | `8ca22dba9a94f28898bbce59f2537ff4d87c747d` | [Verification Before Completion](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/verification-before-completion/SKILL.md) |

Karpathy Skills는 Karpathy의 관찰에서 영향을 받은 제3자 가이드다. 본인이 배포한 공식 검사 도구로 해석하지 않는다.

## 현행 프로젝트와의 대조

- [AGENTS.md](../../../AGENTS.md) G01/G02/G06/G07: 범위 확대·기존 변경 훼손·검증 과장·우회 금지가 이미 존재한다.
- [harness](../../../docs/ai/harness.md):3,31,60–69: 자동화는 부분 구현이며 입력 hash·검사 생략·코드 변경 후 결과 무효화가 설계돼 있다. 문서 존재와 실행 강제는 다르다.
- [검증 기록 양식](../../../docs/testing/README.md):254–270: SHA/미커밋 변경/관련 hash, 실행 명령, 실제 결과, 차단·생략 사유가 이미 있다. 새 양식 복제보다 생성 자동화가 보완점이다.
- [코드 구조](../../../docs/system-design/08-code-structure.md):9,37–47: Nest/TypeScript·Nuxt/Vue·Java Collector가 공존한다. Controller/Service/Repository 분리와 엄격한 타입 설정은 현행 계약이다.
- [API ESLint](../../../apps/api/eslint.config.mjs):2–17, [Web ESLint](../../../apps/web/eslint.config.mjs):16–37: `recommendedTypeChecked`, `no-explicit-any`, `no-unsafe-type-assertion`이 설정돼 있다. Web에는 Vue parser가 있다. 설정 확인이며 이번 lint 통과 증거는 아니다.
- [CI](../../../.github/workflows/ci.yml):45–49: build·scripts/tests lint·Web typecheck는 호출하지만 API/Web workspace lint 직접 호출은 없다. [API build](../../../apps/api/build.ts):13–27도 `tsc` 실행이며 lint를 실행하지 않는다.
- [CI 검증 근거 대조](../../../scripts/ci/validation.py):53–65: SHA/tree/부모 커밋/실행 회차/필수 job 성공을 비교한다. 미커밋 입력에 연결된 로컬 검증 기록과는 범위가 다르다.
- 기존 [iron-laws 검토](../../2026-10-05/iron-laws-improvement-review/README.md)의 로컬 검증 기록·정책 완화 감지·검사 범위 표시 제안과 통합할 수 있다. 과거 기록은 구현 완료 증거로 사용하지 않았다.

## 도구별 적용 경계

### Attention Span

- 출력 스타일용 Markdown이다. 추론·작업량을 줄이지 않고 보고를 짧게 하는 목적이며 코드 결함 탐지기는 아니다.
- Attention-kind 원문에는 영어 표현, 화살표 문단, 질문 하나씩, 사용자 ADHD 가정이 있다. 한국어·불릿·Q1/Q2 요구를 가진 이 프로젝트에 그대로 붙이지 않는다.
- 결론 우선·중복 제거·숫자/조건/위험 보존만 현재 응답 규칙으로 충분히 수용 가능하다. 설치나 전역 AGENTS 덮어쓰기를 추가할 필요는 낮다.

### Karpathy Skills

- 사고 후 구현, 단순성, 필요한 부분만 변경, 검증 가능한 목표의 네 원칙은 적용 가능하다.
- 추가할 만한 내용: 현재 요구에 없는 확장 설정·추상화는 만들지 않고, 변경 이유와 확인할 검사를 연결한다.
- 단순함을 이유로 Repository·Unit of Work·트랜잭션·권한 경계를 합치거나 외부 입력 방어를 제거하지 않는다. 해당 경계는 정본에 근거한다.
- 원문의 모호하면 중단·질문 지침은 모든 구현 선택에 적용하지 않는다. 확보된 요청과 정본으로 판단하고, 결과를 바꾸는 미결정만 질문한다.

### Anti Slop

- 검토 SHA의 패키지 표기는 `0.1.2`; 일반 규칙18개와 별도 Effect 규칙5개다. 공식 npm 패키지 설치 방식이 아니라 규칙 source를 저장소에 복사해 관리하는 방식이다.
- 기본 설치 스킬은 일반18개와 Oxlint 내장 `oxc/no-accumulating-spread`를 error로 켠다. 그대로 실행하면 선택 도입이 아니다.
- `oxlint`와 `@oxlint/plugins` 버전을 일치시켜 고정해야 한다. 검토 source의 두 버전은 `1.78.0`이며 실제 도입 시 선택 버전으로 호환성을 다시 확인한다. 외부 개발용 TypeScript 버전을 프로젝트 업그레이드 요구로 해석하지 않는다.
- Anti Slop 자체는 AST(코드 구문 구조)·파일 안 이름 범위를 분석한다. TypeScript의 전체 타입 판정이나 다른 파일의 타입 계약을 대체하지 않는다.
- [Oxlint JS plugin 문서](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)는 alpha 상태와 사용자 지정 parser·타입 정보를 요구하는 plugin의 한계를 설명한다. 내장 Vue script 검사 지원과 Anti Slop의 Vue 전체 호환은 별개다. `.vue` script/setup·템플릿 및 위치 매핑은 표본 실행 전 미검증이며 Java는 검사 대상 밖이다.

| 분류 | 규칙 | Blariyo 판단 |
| --- | --- | --- |
| 우선 평가 | `no-reduce-accumulator-copy` + `oxc/no-accumulating-spread` | 누적 배열/객체의 반복 복사 탐지. 실제 크기·소유권 확인 후 수정하며 자동 mutation 전환 금지 |
| 중복 비교 후 평가 | `no-chained-type-assertions`, `no-widen-then-assert` | 기존 unsafe assertion 검사보다 추가로 잡는 사례가 있는지 먼저 측정 |
| 제한 평가 | `require-safety-comment-for-type-assertion` | 필요한 단언의 근거 기록. 주석 존재가 안전성 증명은 아니며 형식적 주석 증가도 측정 |
| 기본 도입 보류 | `no-runtime-typeof`, `no-unknown-parameters/returns`, `no-unsafe-dictionary-type`, `no-reflect-get` | HTTP·오류·설정 입력 경계의 정상 검증과 충돌 가능. schema 도구 도입이나 unsafe cast를 강요하지 않음 |
| 우선순위 낮음 | `no-array-filter-map`, `no-shape-in-symbol-names`, `require-readable-spacing` | 가독성·명명·성능 취향을 광범위 리팩터링 근거로 쓰지 않음 |
| 적용 필요 낮음 | `no-module-mocking`, Effect 규칙 | 현재 Node test 흐름 대비 Jest/Vitest 중심 rule의 추가 효과 제한. 조회한 manifest에 Effect 직접 의존성 없음 |

충돌 근거는 실제 코드에 있다. [HTTP 입력](../../../apps/api/src/http/contracts.ts):39–56은 `unknown` 입력을 검사하고 계약 검증으로 넘긴다. [API 오류 경계](../../../apps/api/src/http/response.ts):88–102와 [Web 응답 경계](../../../apps/web/server/utils/response.ts):1–20도 타입을 확인한다. 이 패턴은 기본 규칙과 충돌할 수 있지만 이번 검토에서 보안 결함이나 실제 lint 위반 건수로 판정하지 않았다.

`allowInTypeGuards: true` 옵션도 일반 parser 반환 함수와 모든 Nest 경계를 자동 허용하지 않는다. API 경계를 별도 설계하지 않고 옵션 하나로 해결됐다고 볼 수 없다.

### Verification Before Completion

- 주장할 결과를 증명하는 명령 선정 → 실행 → 전체 출력·종료 코드 확인 → 주장 범위 대조는 적합하다.
- 스킬은 지침이며 프로세스 종료·commit을 기술적으로 차단하지 않는다. G06·harness·기존 테스트 양식을 대체할 이유는 적다.
- 원문의 매 메시지 새 검사 요구를 그대로 적용하지 않는다. 현행 기준대로 제품 입력·검사 설정 변경 시 관련 증거를 무효화하고, 기록 문구만 고쳤다고 전체 build/DB/browser 검사를 반복하지 않는다.
- 회귀 판별력 검사를 위해 공유 작업 폴더에서 수정분을 임의 되돌리지 않는다. 기존 검증 안내처럼 격리 사본에서 필요한 경우에만 실행한다.
- 로컬 PASS, 원격 CI 성공, 배포와 운영자 수용을 각각 보고하는 기존 기준을 유지한다.

## 권장 순서와 수용 조건

아래는 검토 내 우선순위다. 운영 인수·진행 중 수집 정책 작업의 우선순위를 변경하지 않는다. 담당·착수일·기한은 `(미정)`이다.

1. **P1 — 기존 검사 실행 누락 보완:** API/Web lint를 공통 검증 흐름에서 실제 실행하도록 연결하는 후속 작업을 검토한다. 기존 실패·생략도 숨기지 않고 보고한다. 새 유료 보호·별도 CI 도입을 선행 조건으로 만들지 않는다.
2. **P1 — 검증 근거 자동 기록:** 기존 양식에 명령·종료 코드·테스트/실패/skip 수·도구 버전·HEAD·관련 미커밋 코드/설정 hash·검사 범위를 자동 채운다. 누락/미실행은 통과로 계산하지 않고, 코드/설정 변경 시 영향받는 결과만 무효화한다.
3. **P2 — Anti Slop 표본 평가:** 현재 ESLint를 유지한 별도 평가에서 API 도메인/HTTP 경계/Web TS/Vue/테스트의 대표 파일과 정상·결함 표본을 비교한다. 외부 규칙 SHA를 고정하고 autofix 없이 결과를 수집한다. 기존 ESLint와 중복, 새 결함 탐지, 정상 코드 오탐, 미탐, 미지원, 실행 시간을 기록한다.
4. **P2 — 유효한 규칙만 채택:** 실제 결함 탐지 이득이 있고 정상 입력 검증을 훼손하지 않는 규칙만 고른다. 최초 평가의 경고는 필수 검사 통과로 집계하지 않는다. 적용 범위·예외 근거·유지보수 담당·재검토 조건을 정한 뒤 error 전환을 결정한다.
5. **P3 — 지침 최소 보완:** Karpathy의 추측성 추상화 금지와 Attention Span의 조건을 보존한 요약 원칙 중 기존 지침에 없는 내용만 검토한다. 3종 스킬 전체나 Superpowers 전체 묶음을 추가할 이유는 현재 부족하다.

## 검증과 잔여

- 완료: 외부 고정 SHA 원문, 프로젝트 지침·기술 계약·lint/CI source와 대표 입력 검증 코드의 정적 대조.
- 기록 검사: 상대 링크13개 대상 존재. `git diff --check` 종료0. 신규 파일의 `git diff --no-index --check /dev/null <파일>`은 추가 diff에 따른 종료1이며 공백 오류 출력 없음. 검토 근거17파일은 검사 시 SHA-256 동일. 최종 `git status --short --branch`에서 기존 dirty 상태·같은 브랜치/HEAD 확인. 이 세션의 프로젝트 쓰기는 이 README뿐이며 stage·commit·push 없음.
- 미검증: Anti Slop 실제 실행·오탐률·성능·Vue 호환, 앱 build/test/lint, hook 실제 설치 상태, 원격 CI·운영 상태. 패키지 설치 및 도구 실행은 하지 않았다.
- 제품·법무 정책과 placeholder 변경 없음. 도구 권고를 제품 구조 변경 근거로 사용하지 않는다.
- 잔여: 후속 구현 요청 시 현재 담당·작업 기준선을 다시 확인하고 P1부터 범위를 정한다.

## 후속 — iron-laws 포함한 5종 통합 검토 (2026-10-06)

- 요청: `JinHo-von-Choi/iron-laws`도 참고한다.
- 담당: Codex / 작업 폴더·브랜치·HEAD는 위와 동일.
- 상태: 종료(추가 원문 검토·기록 완료, 설치·구현 미착수) / 갱신: 2026-10-06 19:54 KST
- 변경 경로: 이 README의 후속 절만 추가. 진행 중 `collector-request-policy`의 source·정본·검증 자원은 수정하지 않는다. 앞선 4종 판정과 10/5 과거 기록은 당시 사실로 보존한다.

### 최신 원문과 이전 검토의 차이

- 현재 기본 브랜치 HEAD: `fd746b425dd566569b6bd4009ab04efef8afb0f6`. 이전 검토 `7a1e2d16f9d890da1b2cfd318e2f901553bb850b` 이후 **커밋1개 추가**를 GitHub compare API로 확인했다.
- [변경 비교](https://github.com/JinHo-von-Choi/iron-laws/compare/7a1e2d16f9d890da1b2cfd318e2f901553bb850b...fd746b425dd566569b6bd4009ab04efef8afb0f6): 의존성 취약점 권고, 프로젝트 구조 진단, AI 규칙 파일·설정의 공격 가능 요소, 성능 규칙 추가.
- [패키지](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/pyproject.toml)의 버전은 여전히 `1.4.0`, Python 요구는 `>=3.12`다. 버전 문자열만으로 검토 기준을 구분할 수 없으므로 SHA를 함께 기록한다.
- 최신 [README](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/README.md), [지원표](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/docs/SUPPORT_MATRIX.md), [정확도·한계](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/docs/ACCURACY.md), [패치 검증 계약](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/docs/PATCH_VERIFICATION.md)과 관련 source를 직접 대조했다. 외부 source는 `/tmp/blariyo-iron-laws-followup-20261006/`에 열람용으로 받았으며 실행하지 않았다.

### Blariyo에 반영할 참고 사항

| 우선순위 | 참고할 기능·원칙 | 기존 제안과 통합할 방식 |
| --- | --- | --- |
| P1 | 입력 코드·설정 hash와 검증 결과 연결 | 위 검증 결과 자동 기록에 포함. HEAD만 같아도 미커밋 입력이 다르면 같은 검사로 취급하지 않음 |
| P1 | 테스트 삭제·skip·단언/검사 정책 약화 탐지 | G06/G07 변경 검토를 보조. 정당한 요구 변경과 우회를 구분하고 자동으로 수정·허용하지 않음 |
| P1 | 통과·실패·미실행·판정 불가 및 지원 범위 구분 | lint/test 성공 수와 별도로 검사한 파일·규칙·언어 및 미지원 범위를 기록 |
| P2 | 비밀·오류 은폐·보안·성능 패턴 검사 | Anti Slop과 같은 대표 표본에서 중복·추가 탐지·오탐을 비교. 전체 필수 검사 도입은 보류 |
| P2 | 규칙 파일의 숨은 문자·위험 지시 탐지 | 외부 AGENTS/SKILL 등 도입 검토의 보조 자료. 탐지 결과와 의도는 사람이 대조 |
| P2 | 의존성·구조 진단 | package-lock 및 기존 구조 검사와 비교하는 선택 평가. 결과만으로 의존성 업그레이드·계층 재편하지 않음 |

### 전체 도입을 보류하는 근거

- TypeScript·Java를 지원하지만 규칙별 검증 범위가 다르다. 최신 지원표에서도 TypeScript의 `IL-501`, `PERF-101~105`는 적용·미검증으로 표시된다. Python 외 파일 간 분석, 검증 계약·회귀시험 생성 범위도 제한된다.
- [언어 매핑](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/src/iron_laws/engine/languages.py)에 `.vue`가 없다. Nuxt 전체 검사 완료로 집계할 수 없다.
- 새 [의존성 parser](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/src/iron_laws/deps/lockfiles.py)는 `uv.lock`, `poetry.lock`, `package-lock.json`, `pnpm-lock.yaml`을 등록한다. Blariyo npm 잠금 파일은 평가 후보지만 Gradle Collector의 의존성 검사까지 포함하지 않는다.
- [독립 근거 검증](https://github.com/JinHo-von-Choi/iron-laws/blob/fd746b425dd566569b6bd4009ab04efef8afb0f6/docs/EVIDENCE_VERIFICATION.md)은 보고서 내부 모순을 확인하는 기능이다. 탐지 엔진이 일관되게 틀린 판단을 하거나 실제 업무 요구를 놓치는 것까지 증명하지 못한다.
- 도구의 보고서 위치 지침을 프로젝트 G05의 작업 기록 위치보다 우선하지 않는다. 향후 실행한다면 검사 입력·생성 증거를 분리하고 제외 범위를 명시해, 결과 파일 생성 자체가 제품 입력 hash를 바꾸지 않게 설계한다.

### 5종의 역할과 실행 순서

1. Attention Span·Karpathy: 답변과 구현 행동의 최소 원칙을 참고한다.
2. Verification Before Completion: 완료 보고 전 증거 확인 절차에 참고한다.
3. iron-laws: 그 증거를 코드에 연결하고 검사 우회·지원 공백을 드러내는 자동화 설계에 우선 참고한다.
4. Anti Slop·iron-laws 정적 규칙: 기존 ESLint·구조 검사와 겹치지 않는 효과가 확인된 것만 선택한다.

구현 순서는 기존 API/Web lint 실행 누락 보완 → 로컬 검증 결과·입력 연결 및 우회/미지원 표시 → 두 정적 검사 도구의 제한 평가다. 도구 다섯 개를 설치하는 작업으로 확대하지 않는다.

- 검증 범위: 최신 SHA·변경 비교·원문·지원 한계의 정적 검토. 실제 탐지 정확도·앱 검사·원격 CI·운영 환경은 이번에도 미검증이다.

## 후속 — 도입 계획 (2026-10-06 20:03 KST)

- 사용자 요청에 따라 [단계별 도입 계획](ADOPTION-PLAN.md)을 작성했다. 담당 Codex, 작업 폴더·브랜치는 위와 동일. 상태: 종료(계획 작성), 실제 도입 미착수.
- 범위: 기존 lint 연결 → 검증 입력/결과 자동 기록 → 검사 약화 검토 → 외부 규칙 비교 평가 → 선택 도입/관찰. 변경 파일·수용 조건·보류/복구 기준·예상 공수와 권한 경계를 포함한다.
- 현재 `visualize:visualize` 스킬 존재와 원문을 확인했다. 단계 의존 관계는 대화에서 Mermaid로 설명한다.
- 이번 변경은 계획 신규 작성과 이 후속 절이다. 원문4종·iron-laws의 이전 판정과 검증 기록은 소급 수정하지 않는다.
