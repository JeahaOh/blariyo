# S04 — 언어별 lint·format·예외·도구 구성

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-13 · GOV-14 · GOV-15**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 하네스 의존을 제거해 분리 유지 우선. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S04-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

현재 품질 검사를 task/branch 강제와 분리하고, 유지할 언어·예외·지원 OS를 명확히 한 독립 실행 구성을 준비한다.

PR #7/#8 전체 lint 성공, #9 실패. 기존 동일 H9 분석은 `docs/status.md:79` Prettier 1건이며 새 조합은 다시 검사해야 한다. 과거 434개 SQL draft를 현재 실패 원인으로 승계하지 않는다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

`scripts/quality/*`, `tests/quality/*`, `.quality/*`, `.markdownlint-cli2.jsonc`, `.prettierignore`, `.prettierrc`, `.ruff.toml`, `.sqlfluff`, `.stylelintrc.json`, 언어별 ESLint/Checkstyle config와 Collector build 설정. package/lock 변경은 S10 반영 요청으로 전달한다.

S02/S05/S07/S08과 서로 다른 파일에서 병행 가능. 대량 포맷은 S06, package/lock/workflow는 S10, 활성 문서 편집은 S11이 맡는다.

## 수행 순서

1. 언어별 도구·버전·scope·기존 예외·지원 OS를 정리한다. JS/TS/Vue, Java, Python, SQL, shell, CSS, Markdown, Actions, Prettier 항목을 누락하지 않는다.
2. `lint-all.mjs`의 비어 있지 않은 harness 디렉터리 요구를 실제 유지 범위에 맞춰 분리한다. 삭제할 harness를 위해 빈 파일이나 형식적 테스트를 만드는 방식으로 통과시키지 않는다.
3. API typed-test lint의 build 선행과 정확한 Node `24.18.0` 요구를 검토하고, 그대로 유지하거나 변경할 때 이유·지원 범위를 명시한다. 공통 `.git/quality-tools`/venv 사용처를 확인하고 S01/S03에 보존 요구를 전달한다.
4. baseline은 필요한 위반에만 한정하고 fingerprint·담당·사유·만료를 확인한다. candidate를 승인 baseline으로 일괄 승격하지 않는다. 위반이 없으면 예외 운영을 새로 만들 필요가 없다.
5. 설정·runner 변경과 기존 코드의 대량 포맷을 나눈다. 실제 lint 결과와 수정 필요 경로를 S06에 전달하고, 문서 포맷은 S11이 마지막에 처리하도록 맡긴다. S10에는 npm script/dependency/lockfile 변경 요구를 전달한다.

## 검증과 완료 조건

- 유지한 lint/format, 기존 quality 회귀 및 실제 사용하는 도구 fixture 검사. 새 조합에서 검사 대상 0개·누락 경로를 성공으로 처리하지 않음.
- 선택된 언어의 정상/위반 fixture와 도구 버전 확인. Mac ARM·Linux x64 지원과 Windows lease 성공을 Windows 전체 lint 성공으로 섞지 않음.
- API build/test build 후 typed lint가 실행되는지 확인. 문서 포함 최종 lint는 S10/S11 결과 SHA에서 별도 판정.

완료 조건:

- 검사 scope가 실제 남는 경로와 일치하고 task manifest 없이 동작하는 후보 및 검증 결과가 준비됨.
- 품질 도구·예외 관리·지원 범위와 공유 파일 반영 요구가 명확함. 다른 분야 source 위반은 파일별 S06 인계로 구분.

중단/보존 조건:

- 필요 도구나 지원 OS가 없어 실행하지 못하면 환경 미검증으로 기록; 검사 생략을 성공으로 바꾸지 않음.
- 기존 SQL/원문 HTML을 자동 포맷해야만 통과한다면 S07/S02 선택 전에는 해당 파일을 수정하지 않음.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

독립 runner/config 후보, 유지 npm 명령·도구 버전, 언어별 결과, 잔여 위반 목록을 S06/S09/S10/S11에 전달한다.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S04 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S04-lint-tooling.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S04-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-13 — 언어별 lint·format 통합

- 분야/중요도: 코드 품질 / High. lint는 규칙 위반 검사, format은 코드 표기 형식 검사다.
- 근거: `scripts/quality/lint-all.mjs:78`, `package.json`, 언어별 config, `tests/quality/lint-tools.test.mjs`.
- 범위: JS/TS/Vue ESLint, Java Checkstyle, Python Ruff, SQL SQLFluff, shell ShellCheck, CSS Stylelint, Markdown markdownlint, GitHub Actions actionlint, Prettier. 기존 package lint를 전체 runner로 묶고 부족한 언어 검사를 추가했다.
- 진척: #7/#8 전체 lint step 성공. #9는 harness·quality 회귀와 architecture가 통과했으나 전체 lint가 실패했다. 같은 H9의 기존 분석은 `docs/status.md:79` 포맷 1건이었다.
- 결합: runner는 `scripts/harness`, `tests/harness`가 비어 있으면 실패한다. 도구와 언어 fixture는 공통 gitdir의 quality 도구 위치를 사용한다. API typed-test lint 전에 API/test build가 필요하다. Node는 `24.18.0` 정확 일치를 요구한다.
- 유지/원복: **유지 우선 후보**지만 harness 삭제 후 그대로 실행하면 안 된다. 검사 대상·도구 경로·빌드 선행·package script를 새 범위에 맞추고 한 번 검증한다. 품질 검사 자체와 task/branch gate는 분리 가능하다.

### GOV-14 — lint 예외·baseline 관리

- 분야/중요도: 품질 정책 / Medium.
- 근거: `scripts/quality/lint-debt.mjs:262`, `lint-contracts.mjs`, `tests/quality/lint-debt.test.mjs`, `.quality/baseline.candidate.json`.
- 진척: 위반 fingerprint, 설정·도구 버전, 담당·사유·만료, 중복·잘못된 보고서·빈 scope·누락 경로를 검증한다. CI는 base의 baseline을 사용하며 draft candidate는 승인 baseline이 아니다. quality 회귀 step 성공.
- 구분: 기본 checkout의 미추적 candidate는 과거 자료일 수 있다. #7/#8의 전체 lint가 통과한 사실과 과거 “434개 draft 차단” 기록을 혼동하면 안 된다. 새 H9 포맷 실패도 과거 SQL debt 차단과 별개다.
- 미완료: 실제 예외 승인·갱신 운영 체계와 검사기 자체 보호. finding 0인 조합에서는 예외 baseline 없이 통과할 수 있다.
- 유지/원복: 예외가 필요할 때만 제한적으로 유지한다. 단순 검사만 원하면 복잡한 baseline 관리도 축소할 수 있으나 기존 위반을 무조건 성공 처리하도록 바꾸지는 않는다.

### GOV-15 — 품질 도구 버전·설치·OS 지원

- 분야/중요도: 개발 환경 / Medium.
- 근거: `scripts/quality/setup-native-tools.mjs:16`, `.quality/requirements.txt`, package lock, `.git/quality-tools`, `.git/quality-venv`.
- 진척: native 도구 버전·다운로드 checksum 고정, 공통 gitdir 도구 재사용 회귀가 있다. 설치 asset은 darwin-arm64·linux-x64다. Ubuntu 전체 lint 및 별도 Windows lease job의 성공은 서로 다른 범위다.
- 미완료: Windows 전체 lint, 다른 CPU/OS, GUI Git의 PATH 지원은 완료 근거가 없다. 일반 YAML schema·Gradle Kotlin DSL 전용 lint도 현재 전체 지원으로 주장할 수 없다.
- 유지/원복: lint를 남기면 공통 도구 저장소도 필요하다. governance를 철회한다는 이유로 `.git/quality-*`를 먼저 삭제하면 안 된다. 도구 제거 여부는 GOV-13 선택 뒤 결정한다.
