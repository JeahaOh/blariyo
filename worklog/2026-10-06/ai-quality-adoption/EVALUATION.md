# 규칙 비교·실제 변경 관찰

- 담당: Codex / 기준: 2026-10-06 / 실행 증거는 이 폴더 `verification/`.
- 원본: Anti Slop `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`, iron-laws `fd746b425dd566569b6bd4009ab04efef8afb0f6`(1.4.0). Oxlint·플러그인1.78.0, Python3.14.4. 고정 SHA source를 읽고 시험했으며 upstream의 전체 규칙을 도입하지 않았다.
- 방법: 14개 실제 파일, 후보9개에 정상/결함 대조1쌍씩, Vue script 추가 표본. [파일·내용 hash와 실행 결과](verification/external-evaluation.json).
- 재현: 고정 Anti Slop source를 `<실험폴더>/anti-slop`에 준비하고 해당 폴더에 Oxlint/플러그인1.78.0을 설치한다. `python3 evaluate.py <저장소> <실험폴더> <iron-laws 실행파일>`은 [표본 목록](sample-paths.json)과 평가 설정을 사용한다. root Node24.18.0·기존 ESLint 설치/타입 준비, iron-laws 전용 환경이 선행 조건이다. 앱 source는 실행하거나 수정하지 않는다. 결과 파일은 같은 평가 기록 경로에 쓰므로 재평가는 새 작업 기록으로 스크립트/목록을 복사해 수행한다.

## 14파일 비교

| 도구 | 실제 범위 | 후보 결과 | 최초 새 프로세스 / 이후3회 |
| --- | --- | --- | --- |
| 기존 ESLint | API4, Web TS/Vue4, Node test2 | 실제 파일10개 경고0 | 작업군별2.078/4.7751/1.6846초; 단일 합산 비교 벤치마크 아님 |
| Anti Slop 후보5개 | 지원 파일11개 | 실제 파일 경고0 | 0.2203 / 0.2115·0.2170·0.2143초 |
| iron-laws 후보4개 | 12개, Vue2개 미지원 | IL-301 검토 후보2개 | 0.4367 / 0.4209·0.4315·0.4292초 |

- 최초 실행도 이전 smoke로 OS cache가 준비됐을 수 있다. 완전히 비운 machine-cold 측정이라고 부르지 않는다. 각 측정은 새 CLI 프로세스다.
- iron-laws의 두 후보는 `admin-return.ts:17`의 잘못된 URL 안전 복귀와 `SourceRequests.java:104`의 Retry-After 파싱 실패/overflow 처리다. 현재 계약에 필요한 동작이므로 무조건 throw로 바꾸지 않았다.
- iron-laws 자체 보고에서 평가 언어/규칙 조합12개 중 미검증8개(66.67%). Vue/Gradle·파일 간 의미 분석을 통과로 해석하지 않는다. tool `is_passed`나 grade는 프로젝트 완료 근거로 사용하지 않았다.

## 규칙별 결정

| 후보 | 대조 표본·추가 효과 | 채택 |
| --- | --- | --- |
| `anti-slop/no-reduce-accumulator-copy` | concat 누적 복사 결함 탐지, 소유 배열 push 정상 표본 통과. 기존 ESLint가 탐지하지 않은 유형 | 선택 error |
| `oxc/no-accumulating-spread` | reduce spread 복사 결함 탐지, 반복문 push 정상 통과 | 선택 error |
| chained assertion / widen then assert | 결함 탐지하지만 기존 typed ESLint와 겹침 | 추가하지 않음 |
| assertion safety comment | 주석만 넣은 unsafe cast는 Anti Slop 표본 규칙을 통과하고 기존 ESLint는 계속 차단 | 제외; 주석은 타입 안전성 증거가 아님 |
| IL-301 오류 은폐 | 인위적 빈 catch 탐지. 정상 복구도 경고 | 명시적 검토 보조 |
| IL-101 비밀 후보 | 가짜 비밀 fixture 탐지·정상 인자 통과 | 명시적 검토 보조; 원문 출력 제거 |
| PERF-103 반복 I/O | 직렬 loop I/O 탐지·재시도 loop 정상 표본 통과 | 명시적 검토 보조 |
| AIA-101 위험 지침 | 인위적 보안 무시 지시 탐지·정상 규칙 통과 | 명시적 검토 보조; 한국어 의미 판정 한계 |

- Anti Slop 결함5개 표본에서 중첩 경고8건, 해당 규칙의 정상5개 표본 경고0. iron-laws 결함4개 표본에서4건, 정상4개0건. 전체 정확도나 보안 성능으로 일반화하지 않는다.
- 선택2개는 Vue `<script setup>` 결함도 실제 탐지했다. template·Java는 선택 Oxlint 검사 범위가 아니다.
- 복사한 두 upstream 구현은 byte 동일성을 확인했고 MIT LICENSE를 보존했다. 신규 wrapper만 선택 규칙을 등록한다. 유지보수 담당과 갱신 기준은 `tools/oxlint/anti-slop/UPSTREAM.md`, Python 고정 환경은 `tools/iron-laws/requirements.lock`.

## 실제 변경5건 관찰

[전후 입력 hash·건수·시간](verification/real-change-observation.json). 시작 기준 `12df6ae`와 현재 파일을 비교한 **기존 실제 변경5건의 재현 관찰**이다. 미래 작업5회나 장기 운영 기간을 관찰했다고 주장하지 않는다. 관찰하려고 제품 코드를 임의 수정하지 않았다.

| 실제 변경 | 전후 줄 수 | 선택 Oxlint | iron-laws | 검토 |
| --- | --- | --- | --- | --- |
| API quota TS | 117→117 | 전후0 | 전후0 | 기존 입력/계약 유지, 경고를 없애기 위한 변경 없음 |
| API result TS | 116→116 | 전후0 | 전후0 | 업무 변경과 도구 적용을 분리 |
| admin return TS | 20→20 | 전후0 | 전후1 | 같은 URL 복구 후보, 안전 복귀 유지 |
| admin.vue | 969→1005 | 전후0 | 미지원 | 누적 업무 변경 포함; 이번 lint 수정은 unsafe cast를 instanceof 확인으로 바꾼2줄뿐 |
| SourceRequests Java | 134→109 | 미지원 | 전후1 | 같은 Retry-After 복구 후보, Java source는 이번 도입으로 수정하지 않음 |

- 파일당 선택 Oxlint0.1484~0.1572초, iron-laws0.3320~0.6651초. 정상 경계 훼손·추가 추상화·경고 해결용 ignore는 만들지 않았다.
- 실제5건에는 선택 규칙이 겨냥한 누적 복사 결함이 없었다. 따라서 추가 실제 결함 발견0건, 알려진 복구 경고2개 유지. 결함 탐지 증거는 별도 정상/결함 표본이다. 알려지지 않은 미탐률은 측정 불가다.
- 범위·코드 문맥·대조 결과 검토는 재개 후 약20:29~20:33 KST 구간에 다른 검증과 함께 수행했다. 전용 검토 시간만 분리 계측하지 않았으므로 인건비/시간 절감 수치를 만들지 않는다.

## 전체 source 검토 보조 실행

[실행 결과](verification/2026-10-06T11-28-39.458Z-iron-laws-76047.json): 입력314개, Vue31개 별도 미지원, 후보114개(IL-301 113개·AIA-101 1개). 이는 표본의2개와 검사 범위가 다르다. 모든 후보를 결함 또는 오탐으로 단정하지 않았다.

- 한국어 AGENTS의 “미검증·위험은 생략하지 않는다”도 AIA-101 검토 후보가 됐다. 원문 취지는 검증 근거 보존이므로 보안 무시 지시라는 해석은 부적절하다.
- HIGH/CONFIRMED 표시22개를 문맥 확인했다. readiness false/503, 잘못된 URL null/false, 페이지 숫자 오류 -1, 파일 없음 false, 이미 실패가 기록된 cleanup 알림의 재실패 등 정상 복구/차단도 포함된다. `CONFIRMED`는 제품 결함 확정이 아니다.
- `RunRepository.mutationReady()`는 예외 시false로 변경을 차단한다. `SpoolCleanup`은 내부 알림 실패 전 telemetry와 stderr에 실패를 기록한다.
- preview/image cleanup은 원래 오류를 계속 반환하지만 객체 삭제와 outbox 등록이 모두 실패한 경우의 후속 회수/관측은 별도 운영 검토 후보다. 이번 도구 도입에서 제품 처리·로그 정책을 확대 수정하지 않았다.
- 나머지 REVIEW 후보는 자동 승인·ignore 처리하지 않았고 원본 위치 목록을 보존했다. 전체114건을 해소한 상태가 아니며, 필수 gate로 승격하지 않는 근거다. 품질 도구의 설치/범위 확인과 제품 전체 오류 처리 감사는 구분한다.

## 정책 변경 검토

[정책 변경 후보](verification/policy-review.txt)는15건이다. 모두 이번 승인된 도입의 CI/package/new policy/new tools 경로이며 사용자 요청·계획과 대조했다.

- CI에서는 기존 scripts/tests lint를 공통 lint로 옮기고 API/Web·선택 규칙을 추가했다. 기존 build·타입·unit·integration·browser·collector job과 조건은 유지했다.
- 기존 ESLint·TypeScript strict/ignore를 변경하지 않았다. Oxlint의 기본 correctness off는 새 추가 도구에서 선택2개만 활성화하기 위한 설정이며 기존 규칙 비활성화가 아니다.
- 이 비교의 근거는 사용자 `세운 계획대로 도입 해`, 승인된 도입 계획과 실제 diff다. 도구 자체가 경고를 자동 승인하거나 삭제하지 않는다.
- 되돌리기가 필요하면 신규 Oxlint 규칙·호출/개발 의존성과 iron-laws 환경만 별도 변경으로 검토한다. 기존4개 lint·검증 기록·실패 증거를 임의 제거하거나 즉석 disable로 회피하지 않는다.

## 최종 입력 후속

- API V013 mapping 보완·격리 launcher port와 browser synchronization 검증 보완을 거친 뒤 최종 advisory를 다시 실행했다. [후속 기록](verification/2026-10-06T11-45-05.969Z-iron-laws-1901.json)에서 입력314/실제 검사314, Vue31개 미지원, 후보114개는 동일하다.
- 별도 세션의 제목 규칙 수정으로 초기14개 표본 중 title test hash는 달라졌다. 위14개 비교는 기록에 고정된 당시 입력의 평가다. 최종 공통 lint/전체 검사 결과는 최신 입력 receipt로 별도 확인하며 이전 표본 PASS를 새 제품 검사로 재사용하지 않는다.
- 검토 시간 보완: 최종 선택 규칙의 source·설정·정상/결함 표본·경계만 독립 재검토하여16초를 계측했다([시작/종료·검토 결과](verification/rule-review-timing.json)). 이전 혼합 작업 시간이나 인간 개발자의 비용 추정으로 일반화하지 않는다. 별도 사용자 정의 reduce·중첩 callback·의도적 bounded copy는 패턴 검사 한계로 유지한다.

## 21:03 이후 기준선 재대조

- 시작 기준12df6ae부터 현재까지 [정책 후보 재검사](verification/policy-review-2103.txt)는16건이다. 앞선15건 외 `packages/contracts/tsconfig.json`의 `files`에 `src/draft-title.mjs`가 추가된 변화1건을 포함한다. 다른 담당이b932366에 반영한 검사 대상 확장이며 strict/checkJs/noEmit 등 기존 옵션은 동일하다. 검사 완화가 아니며 이 작업에서 다시 수정하지 않는다.
- [현재 iron-laws 결과](verification/2026-10-06T12-02-10.560Z-iron-laws-71624.json)도114후보·Vue31개 미지원이다. 이전 경고의 자동 해소·전체 보안 통과를 주장하지 않는다.

## Collector 임시 제외 정책과 offline 검사 분리

- 다른 담당의 최신 사용자 결정은3출처 수집 비활성화다. 운영 SourcePolicy와 설정의 차단은 유지한다. 저장 HTML의 parser 회귀는 기존21개 parser를 유지하는 계약을 검사하므로 test-only 메모리 사본에 승인 상태를 둔다. 실제 외부 수집을 허용하는 설정 변경이 아니다.
- 기존 fingerprint·이미지/URL 경계·파싱 결과 assertion은 전부 유지했고,3출처의 운영 정책 거부 및 helper 호출 후 원본 byte 보존 회귀를 추가했다. [집중175 tests 통과](verification/collector-offline-focused.json). 이 결과는 전체 DB readback/Collector 수용을 대체하지 않는다.
- 현재 HEAD b932366 기준 [검토 후보 재검사](verification/policy-review-after-collector.txt)는15건이다. Java 변경은 도구 의미 분석 미지원이므로 해당4개 test source diff와 최신 수집 기획을 직접 대조했다. 테스트 삭제·skip·기대 fingerprint 갱신은 없고 신규3개 경계 검사만 추가했다.

## 적용 상태 재감사 — 2026-10-06 21:30 KST

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/production-collection-20261004` / HEAD: `85109e6`.
- 상태: 종료(감사 완료, 발견한 코드 보완은 미실행).
- 요청: 도구·스킬이 제대로 적용됐는지 확인. `audit`·`blariyo-docs-audit` 절차로 계획/지침/설정/실행 코드/재현을 대조했다. 하위 에이전트 검토는 사용하지 않았다.
- 변경 범위: 이 평가 파일 끝에 후속 감사 기록만 추가. 제품 source·검사 설정·기존 테스트·DB·서버·stage/commit/push는 변경하지 않았다. 재현은 소유 임시 Git 저장소에서 수행하고 제거했다.
- 판정: 선택 도입과 기본 실행은 확인됐지만 자동 검증에2개 보완 필요 사항이 있다. 앞선 정상 표본·전체 검증 성공만으로 이 경계까지 보장됐다고 해석하면 안 된다.

### 확인한 적용 형태

| 대상 | 현재 적용 | 대조 결과 |
| --- | --- | --- |
| Attention Span | 기존 한국어·핵심 보고 지침에 필요한 원칙만 통합 | AGENTS18~19, 승인 계획24. 별도 원본 스킬 설치 방식이 아님 |
| Karpathy | 요구 밖 확장/추상화 억제, 기존 입력 경계 유지, 문제별 검증 연결 | AGENTS15~19 및 작업 시작 절차. 자동 코드 품질 보증은 아님 |
| Verification Before Completion | G06 + 수동 호출 실행기/입력 기록/receipt 재판정 | 실패·누락·stale 거부 회귀 통과. 아래E1은 추가 보완 필요 |
| Anti Slop·Oxlint | upstream concat-copy1개 + 내장 accumulating-spread1개 error, 기존4개 lint/CI 연결 | 실제 공통 lint PASS, TS/Vue 결함 탐지·정상/무수정 회귀 PASS |
| iron-laws | 고정SHA 전용 Python 환경,4규칙 검토 보조 | 설치 metadata의 version1.4.0·archive SHA/해시가 lock과 일치. 정상/결함4쌍 재실행 확인 |

- 원칙3종의 독립 SKILL.md나 전체 Superpowers가 없는 것은 승인 계획의 선택 통합 방식이다. 누락 설치로 판정하지 않는다.
- 자동 연결은 `npm run lint`와 로컬 workflow source다. quality:verify/receipt/review/audit는 명시 실행이며 모든 AI 응답·commit에 자동 호출되도록 연결한 것은 아니다. 원격 CI 반영·실행은 이번 감사에서 확인하지 않았다.
- Anti Slop 구현2파일과 MIT LICENSE는 고정 upstream 사본과 byte 동일, Oxlint/@oxlint/plugins1.78.0 exact pin 확인. iron-laws 결과는 exit code만 쓰지 않고 findings로 검토 필요를 판정한다(PERF/AIA 경고의 원본 CLI exit0도 wrapper는 후보로 처리).

### E1 / High·P1 / 오류 / 신뢰도 높음 — Docker 브라우저 기록과 빌드의 연결 누락

- 위치: `scripts/quality/policy.ts:28`, `package.json:33`, `scripts/quality/receipt.ts:46`, `tests/helpers/browser-fixture.ts:18` 및`:219`.
- 조건: source 수정 후 재빌드 없이 browser-docker 프로필 실행. 이 프로필은 build를 실행하지 않고, 실제 fixture는 API dist/Web .output을 사용한다. ignore된 build 결과와 source의 대응도 확인하지 않는다.
- 직접 재현: 임시 저장소에 값42인 source를 build한 뒤 source만0으로 변경했다. 실제 verify/assess 함수를 browser-docker 프로필로 실행했고 검사 명령은 컴파일 결과를 읽는 작은 Node 테스트로 대체했다. 제품 브라우저/DB는 실행하지 않았다.
- 결과: 오래된 build의 테스트1/1 PASS, 실행기 problems=[], 독립 assess=[]였다. 같은 source를 재빌드한 대조군은0/1 PASS, exit1 및 browser-docker:not-passing이었다. 따라서 최신 입력에 대한 기록이 실제로 실행한 build와 연결되지 않을 수 있다.
- 문서265행의 ‘build 후 실행’ 지시는 있으나 실행기가 그 선행 조건을 보장하지 않는다.266행의 ‘해당 입력의 유효한 통과’를 무조건 자동 보장한다고 이해하면 과장이다.
- 최소 수정안: browser-docker 프로필 내부에서 build를 먼저 수행하고 결과를 기록한다. build 공유 충돌을 피하려면 같은 입력에 묶인 build 산출물 증거를 필수로 확인하는 대안이 있지만 구현 비용이 더 크다. 오래된 build 거부/재빌드 후 실패를 회귀로 추가한다.
- 과거 전체 브라우저 실행이 틀렸다는 증거는 아니다. 당시에는 실제 build 뒤 실행했다. 이번 지적은 새 호출에서 선행 조건 위반을 자동 감지하지 못하는 공백이다.

### E2 / Medium·P2 / 오류 / 신뢰도 높음 — 하위 workspace 검사 명령 변경 미탐지

- 위치: `scripts/quality/review-guards.ts:67`~69, `scripts/quality/policy.ts:20`~22.
- 조건: `apps/api/package.json`의 scripts.lint를 기존 eslint 명령에서 `node -e "process.exit(0)"`로 바꾼 표본. 원본 파일을 수정하지 않고 문자열 사본을 실제 reviewChange에 전달했다.
- 결과: 하위 앱 경로 findings=[]; 같은 변경을 루트 package.json 경로로 전달하면 verification-policy-changed 탐지. 하위 JSON이 unsupported로 표시되는 것도 아니므로 검토기가 범위 공백을 알리지 못한다.
- 원인: 정책 파일 조건이 path === 'package.json'으로 루트만 처리한다. 실제 공통 lint는 API/Web workspace의 package scripts에 위임한다.
- 최소 수정안: 실제 workspace package.json의 검사/빌드 script 변경도 후보로 분류한다. 루트/하위 package 정상 변경과 lint/test 제거·성공 고정의 대조 회귀를 추가한다. 경고가 의미적 위반 확정이라는 뜻은 아니다.

### 이번 실행 결과와 경계

| 실행 | 결과 |
| --- | --- |
| node --test tests/quality-evidence.test.ts tests/quality-rules.test.ts | 10 tests PASS, 실패/skip0 |
| npm run lint | 기존 API/Web/scripts/tests + 선택 Oxlint 모두 PASS |
| typecheck:scripts / typecheck:tests / typecheck:quality-rules | 모두 PASS |
| hooks:check / actionlint CI 문법 | PASS |
| iron-laws 정상/결함4쌍 | IL301/IL101/PERF103/AIA101 각각 결함 탐지1·정상0 |
| 마지막 quality receipt CLI | stale-inputs로 거부, exit1(현재 HEAD/후속 source가 달라 정상 동작) |
| 새 경계 재현 | E1/E2 모두 확인. 기존10개 테스트에 없는 경우 |

- 현재 전체 앱 build/API/browser/Collector는 다시 실행하지 않았다. 이번 표를 현재 제품 전체 통과로 확대하지 않는다.
- 소스 수정 권한을 감사 요청에서 확대하지 않았다. E1→E2 순서로 보완한 뒤 해당 회귀와 실제 명령을 다시 확인해야 자동 검증의 적용 상태를 더 강하게 판정할 수 있다.

## E1/E2 보완 실행 — 2026-10-06

- 사용자 보완·회귀·커밋 요청으로 재개했다. E1은 `test:browser:docker`에 `npm run build &&`를 연결해 수동 선행 조건을 필수 실행 경로로 바꿨다. 프로필과 직접 명령에 동일하게 적용되며 build 실패 시 기존 빌드로 검사를 계속하지 않는다. E2는 루트뿐 아니라 하위 모든 package.json을 검사 정책 변경 후보로 표시한다. 정상 메타데이터/의존성 변경도 검토 후보이며 위반 확정이 아니다.
- 기존 코드에서 신규 회귀2개 실패를 확인했다: stale build가 통과했고 apps/api/package의 우회 명령이 탐지되지 않았다. 수정 후에는 stale output 재빌드로 실패를 드러내기, 정상 build/test 통과, build 실패 시 테스트 미시작, root/API/Web/contracts manifest 탐지·동일 입력/일반 JSON 무경고를 확인한다. 실제 실행 결과는 README의 후속 마감 절을 따른다.
- 도구 전체를 교체하거나 공통 검사 범위를 완화하지 않았다. 문서의 수동 build 선행 안내는 실제 자동 연결과 맞췄다. 과거 감사/실패 결과는 그 시점 사실로 유지한다.

### E1/E2 보완 수용 — 2026-10-06 21:50 KST

- E1/E2 모두 보완했다. 오래된 build/새 build/build 실패의3경계와 루트/API/Web/contracts package 명령 변경을 회귀로 확인했다. 전체 결과는 [후속 회귀 기록](README.md#감사-보완-후-전체-회귀--2026-10-06-2150-kst)을 따른다.
- 동일 입력에서 공통 품질14검사(CI16·unit88), API140, Docker 브라우저85, Collector299(실DB20)가 모두 통과했다. 실패·skip0이고3프로필 receipt와 Collector 입력 hash를 실행 후 다시 대조했다.
- 이 결과는 로컬 도입과 감사2건 보완의 수용이다. 모든 에이전트 응답/커밋의 자동 검사, 미지원 언어 의미 분석, iron-laws114후보 해소, 원격 CI·운영 수용으로 확대하지 않는다.
