# Blariyo AI 협업 규칙·스킬·하네스 도입 초안

- 작성일: 2026-08-13
- 상태: 최종 재검수 Medium 2건까지 반영 완료 초안(문서 잔여 Critical 0 / High 0 / Medium 0,
  실제 도입 전 보안 선결 High 1)
- 대상: `<project-root>`
- 산출물 보관 위치: `<artifact-dir>`

`<project-root>`는 현재 Blariyo 저장소 루트이고, `<artifact-dir>`는 저장소 외부의
문서 산출물 보관 디렉터리다.
- 비교 기준: `<reference-project>`의 기존 대규모 프로젝트 협업 체계
- 작성자: Codex 구현 에이전트 `draft_author`
- 적용 범위: 문서 검토만 완료. 이 문서는 소스·설정·hook·CI를 변경하지 않는다.

## 0. 결론

추천안은 **기존 체계 전체 복제**가 아니라 다음 3층만 먼저 이식하는 것이다.

1. 루트 `AGENTS.md`: 모든 에이전트가 지키는 짧은 헌장과 정본 우선순위
2. `docs/ai/`: 제품·법무 정본을 가리키는 링크맵, 에이전트 중립 절차, 증거계약
3. 검증 하네스: 포맷·lint·test·build·링크·비밀 검사를 같은 명령으로 재현하고,
   CI provision 후 required check를 설정해 자동 게이트로 승격

Claude/Codex/Gemini용 파일은 정본을 복제하지 않고 이 3층을 가리키는 얇은
어댑터로 둔다. 고위험 작업만 독립 검수를 강제한다. 비교 프로젝트의 기술 스택, 사내망,
관리대장, 조직 전용 인프라·응답 코드 감사, 개인 권한 allowlist는 버린다.

현재 tracked 구현과 현행 planning 제안은 Express다. 별도 `.git`을 가진 untracked
NestJS scaffold도 존재하지만 목적과 전환 승인은 확인되지 않았다. 따라서 먼저 기존
Express의 민감 로그를 차단하고 공통 안전 규칙만 적용한다. NestJS 전환 여부, 기술별
API 스킬과 CI 명령은 백엔드 기준선을 명시적으로 결정한 뒤 도입한다.

## 1. 현황과 근거

### 1.1 기존 대규모 프로젝트에서 효과적인 구조

| 관찰 | 근거 | 이식 판단 |
| --- | --- | --- |
| 에이전트 중립 헌장과 벤더별 얇은 진입 파일 | `<reference-project>/AGENTS.md` | Keep |
| 충돌 시 정본 서열을 명시 | `<reference-project>/AGENTS.md` | Keep |
| 추측 금지, 편집 전 읽기, push·삭제·외부 전송 승인 | `<reference-project>/AGENTS.md` | Keep |
| 구현자와 검수자를 분리하고 위험 기반으로 적용 | `<reference-project>/AGENTS.md` | Keep, 위험 기준은 Adapt |
| 스킬은 라우터, command는 절차, reference는 코드 정본 | `<reference-project>/dev-guide.md` | Keep |
| 도구가 없을 때 검증을 추정하지 않고 `BLOCKED`로 기록 | `<reference-project>/.agents/skills/compatibility-guide.md` | Keep |
| 변경 전 Git 상태 확인과 사용자 변경 보존 | 같은 파일 `:67-72` | Keep |
| 로컬 권한 파일에 파괴적 Git 명령 deny | `<reference-project>/.claude/settings.json` | Adapt |
| 테스트·도메인 감사·히스토리를 완료 조건으로 묶음 | `<reference-project>/AGENTS.md` | 원칙 Keep, 감사 항목 Adapt |

`<reference-project>`는 비교에 사용한 기존 프로젝트의 루트를 뜻한다.

### 1.2 Blariyo의 현재 상태

| 관찰 | 근거/증거 | 의미 |
| --- | --- | --- |
| session README가 planning/legal 정본 위치를 안내함 | `<blariyo>/docs/session-log/README.md:7-13` | session은 탐색용 이력으로만 사용 |
| 구현 여부를 소스·migration·테스트·Git으로 확인하도록 규정 | 같은 파일 `:13`, `:32` | 증거 분리 원칙을 유지 |
| tracked 앱은 Express로 선언 | `<blariyo>/README.md:64-71`, `apps/api/package.json:1-37` | 현재 Git 정본은 Express |
| 설계 문서에는 NestJS가 함께 적혀 있음 | `<blariyo>/README.md:108-146` | 백엔드 기준선이 문서상 충돌 |
| `apps/blariyo.core/` NestJS 초안은 바깥 Git에서 미추적 | 바깥 `git status --short`의 `?? apps/blariyo.core/` | 사용자 작업으로 보존, 정본으로 확정 금지 |
| 같은 폴더가 자체 `.git`을 가진 무커밋 nested repo | 내부 status `No commits yet on master`, 전체 파일 `??` | 삭제·흡수·submodule화 의도 확인 전 양쪽을 분리 취급 |
| Express와 NestJS 모두 Jest 명령은 있음 | `apps/api/package.json:6-14`, `apps/blariyo.core/package.json:8-20` | 공통 test 계약을 만들 기반은 있음 |
| commitlint/lint-staged 설정 파일은 있음 | `.commitlintrc.json`, `.lintstagedrc` | 설정 파일만 있고 활성 연결은 확인되지 않음 |
| 활성 로컬 Git hook과 저장소 정의 CI 파일이 없음 | `core.hooksPath` 미설정, `.git/hooks`는 sample뿐, `.github` 없음 | 로컬/저장소 하네스 없음. 원격 required check는 미검증 |
| npm/yarn lockfile이 ignore됨 | `.gitignore:19-30`, `git check-ignore -v` | 재현 가능한 설치를 막는 우선 개선점 |
| 과거 session 기록에 이미지 저장 위치 등 미정 이력이 남음 | `docs/session-log/2026-08-12-board-policy-correction.md:7-15` | 사실 판단은 planning/legal 원문에서 재확인하고 미정값은 AI가 채우지 않음 |

`<blariyo>`와 `<project-root>`는 현재 Blariyo 저장소 루트를 뜻한다. 조사 시점은
`main`, `HEAD=3db4032`, `origin/main`과 동일했다. 기존 미추적
`apps/blariyo.core/`는 수정하지 않았다. 바깥 저장소와 nested 저장소의 status를
각각 확인했으며, nested 저장소는 아직 커밋이 없다.

### 1.3 현재 하네스의 빈틈

1. `.commitlintrc.json`과 `.lintstagedrc`는 있지만 루트 `package.json`, hook 설치,
   CI 연결이 없어 “존재”와 “실행”이 다르다.
2. `.lintstagedrc`는 `eslint --fix`, `prettier --write`처럼 commit 중 파일을 바꾸는
   명령이다. 초기에는 `lint:check`/`format:check`처럼 읽기 전용 검사를 정본으로 하고
   수정 명령은 개발자가 별도 실행하는 편이 예측 가능하다.
3. Express `test` 스크립트는 Jest가 실패하면 뒤의 Docker 종료 명령이 실행되지 않을
   수 있다. 실제 하네스에서는 `trap` 또는 별도 setup/teardown을 써서 실패해도 정리한다.
4. lockfile을 추적하지 않으면 선택한 패키지 관리자의 clean-install 기반 CI를
   재현할 수 없다.
5. tracked Express는 전역 middleware에서 요청 body/query/params를 파일 로그에
   기록하고 테스트가 `DB_PASSWORD`를 출력한다. 일반 CI를 켜기 전에 즉시 제거해야 한다.
6. `apps/api/package.json`의 `nodemon ^3.1.10`과 기존 `package-lock.json`의
   `^3.0.2`/해석 버전 `3.1.9`가 다르므로 lockfile을 그대로 정본으로 승격할 수 없다.

### 1.4 정본 우선순위와 착수 읽기 순서

두 개념을 섞지 않는다. **우선순위**는 충돌 판정 규칙이고, **읽기 순서**는 빠짐없이
맥락을 확보하기 위한 작업 절차다. 먼저 읽었다고 더 높은 정본이 되는 것은 아니다.

#### 작업 권한과 사실 정본

두 축을 하나의 서열로 합치지 않는다.

- 현재 사용자 요청은 작업 범위, 우선순위, 변경·외부 작업 승인 여부를 결정한다.
- 제품 기능과 운영 정책의 사실 정본은 관련 `docs/planning/**`뿐이다.
- 권리·개인정보·출시 차단의 사실 정본은 `docs/legal/**`이다.
- 사용자 요청은 제품·법무 사실이나 출시 차단을 자동으로 변경·면제하지 않는다.
  충돌 요청은 관련 planning/legal 정본을 갱신하고 필요한 검수를 마칠 때까지
  구현·출시를 `BLOCKED`로 둔다.
- 루트 `AGENTS.md`는 협업·안전 규칙, `docs/ai/**`는 링크맵·절차·증거계약,
  벤더 파일은 포인터, 개인 설정과 로컬 메모리는 개인 실행 보조다.

#### 산출물별 역할과 권위

| 산출물 | 역할 | 정본 여부·승격 규칙 |
| --- | --- | --- |
| `docs/planning/**` | 제품 기능·운영 정책 | 제품 사실 정본 |
| `docs/legal/**` | 권리·개인정보·출시 차단 | 법무 사실 정본 |
| `docs/adr/**` | 기술·아키텍처 결정, 대안과 결과 | 기술 결정 정본. 제품·법무 변경은 원문 동시 갱신 없이는 효력 없음 |
| `docs/task_list/**` | 작업 범위, 실행 증거, 현재 상태, 핸드오프 | 비정본 작업 기록 |
| `docs/session-log/**` | 재개용 시점 스냅샷과 다음 시작점 | 비정본 이력. 현행 정본 링크만 제공 |
| `docs/ai/**` | 정본 링크, 절차, 증거계약 | 제품·법무 사실을 소유하지 않음 |

`docs/session-log/**`는 항상 planning/legal의 현행 정본 링크와 당시 실행 이력만 제공한다.
아직 정본에 반영되지 않은 제품·법무 결정은 session이나 ADR에 먼저 확정하지 않고,
관련 planning/legal 원문을 갱신하고 필요한 검수를 마친 뒤 그 링크만 남긴다.

#### 작업 착수 읽기 순서

1. 바깥 저장소와 작업 대상이 nested repo라면 양쪽 `git status --short --branch`
2. 루트 `AGENTS.md`로 협업·안전 경계 확인
3. `docs/session-log/README.md`는 이력과 planning/legal 정본 링크 탐색 용도로만 확인
4. 작업에 관련된 `docs/planning/**`와 `docs/legal/**` 원문에서 제품·법무 사실 확인
5. `docs/ai/README.md` 링크맵과 해당 workflow/evidence contract
6. 선택된 벤더 스킬·포인터
7. 실제 소스, migration, 테스트, 실행 설정

## 2. 적용 원칙

1. **행동을 이식하고 문장을 복사하지 않는다.** 기존 체계의 목적을 Blariyo 명령과
   위험으로 다시 표현한다.
2. **정본은 한 곳에 둔다.** 같은 규칙을 `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`에
   복제하지 않는다. `docs/ai`에도 제품·법무 사실을 복사하지 않고 원문 링크만 둔다.
3. **규칙과 레퍼런스와 실행 검사를 분리한다.** 규칙 문서가 명령의 성공을 대신하지
   못하고, 테스트 성공이 요구사항 충족을 대신하지 못한다.
4. **최소 권한을 기본으로 한다.** 자격증명·`.env`는 읽지 않고, push·배포·외부 API
   전송·삭제는 명시적 승인 뒤에만 한다.
5. **위험에 비례해 검수한다.** 사소한 문구 수정까지 다중 검수를 강제하지 않는다.
6. **미정은 `(미정)`으로 남긴다.** 기술 선택, ID, URL, 저장소, 법률 문구를 AI가
   빈칸 채우듯 만들지 않는다.
7. **로컬 hook보다 CI를 정본으로 한다.** hook은 빠른 피드백이다. 단, CI는
   workflow가 provision되고 브랜치의 required check로 설정된 뒤에만 자동 게이트다.
8. **도입 자체를 회귀 가능하게 만든다.** 각 단계는 독립 PR/커밋 단위로 나누고,
   다음 단계 전 실패·불편 데이터를 확인한다.

## 3. Keep / Adapt / Drop

### 3.1 Keep — 그대로 가져갈 것

| 항목 | Blariyo 적용 |
| --- | --- |
| 작업 권한과 사실 정본 분리 | 사용자 요청은 작업 범위·승인을 결정하고, 제품·법무 사실은 `docs/planning`·`docs/legal`만 변경 |
| 추측 금지 | 문서·소스·migration·테스트에서 확인되지 않은 값은 `(미정)` |
| 기존 변경 보존 | 시작 시 `git status --short --branch`, 미추적/수정 파일을 작업 범위와 분리 |
| 파괴·외부 작업 승인 | 삭제, 데이터 변경, push, merge, deploy, 외부 서비스 업로드/메시지 전송은 승인 필요 |
| 증거별 완료 판정 | 문서/소스/lint/test/build/runtime/HTTP/UI/DB/deploy를 각각 완료·실패·미검증·BLOCKED로 보고 |
| 구현자/검수자 분리 | 인증·권한·개인정보·수집/저작권·DB migration·배포·아키텍처 확정은 독립 검수 |
| 핸드오프 | 무엇을/어느 파일에/검증 명령/남은 리스크를 task에 기록 |
| 스킬의 얇은 라우팅 | 스킬에는 트리거와 순서만, 실제 패턴은 reference, 명령은 workflow에 둠 |

### 3.2 Adapt — 줄여서 가져갈 것

| 기존 체계 항목 | Blariyo 변환안 | 이유 |
| --- | --- | --- |
| 대형 `AGENTS.md` | 80~120줄 이내의 프로젝트 헌장 | 1인/소규모 프로젝트에 조직·서비스 지도는 과함 |
| 모든 에이전트용 파일 | `AGENTS.md` 정본 + 벤더별 10~30줄 포인터 | 중복과 drift 방지 |
| 화면별 개발 HISTORY | 기술 결정은 `docs/adr/`, 작업 증거는 `docs/task_list/`, 재개 이력은 `docs/session-log/` | 제품·법무 정본과 역할 중첩 방지 |
| 다중 에이전트 교차검증 | 고위험 항목만 필수, 일반 기능은 체크리스트+self review | 비용과 속도 균형 |
| 기존 API/UI/spec 스킬 | Blariyo `task-start`, `docs-audit`, `api-change`, `security-review`, `release-check`로 재설계 | 기술·도메인이 다름 |
| DB MCP hard gate | migration 변경 때만 실제 MySQL schema/read-only evidence 요구 | 모든 문서 작업에 DB 연결 불필요 |
| Git commit gate | Conventional Commits + CI 검사. 조직 전용 업무 ID/trailer는 제외 | 현재 `.commitlintrc`를 살리고 복잡도 제거 |
| worktree-first | 병렬 에이전트나 장기 기능에만 선택 사용 | 작은 변경에는 운영 비용이 큼 |
| nested Git 운영 | 의도 확정 전 바깥 staging 제외, 양쪽 status 확인, 복구 가능한 외부 백업 검증 | 중첩 저장소 흡수·삭제 사고 방지 |
| 세션 메모리 | `.agent-memory/`는 선택적 로컬 전용, 비밀 금지, Git ignore | 장기 맥락이 실제로 쌓인 뒤 도입 |
| 상세 권한 allowlist | repo 공통 deny 원칙 + 개인별 로컬 최소 allow | 머신 경로·계정·도구를 공유 규칙에 넣지 않음 |
| 테스트 hook | 변경 파일 기반 빠른 check는 hook, 전체 check는 CI | commit 지연과 환경 차이 축소 |

### 3.3 Drop — 가져오지 않을 것

- 비교 프로젝트의 언어·프레임워크·ORM·통신 방식·패키지 상세 규칙
- 비교 프로젝트의 표준 단어 사전, 공통 코드, 응답 코드 전용 감사
- 화면·프로세스·프로그램 관리대장과 조직 전용 커밋 트레일러
- 조직 전용 데이터베이스, 폐쇄망 dependency 승인, 포트·프로파일·공용 파일 소유자 목록
- 특정 사용자 ID를 코드에 넣은 hook, 개인 절대경로와 광범위 Bash/Read allowlist
- 조직 전용 문서 동기화, PPT 명세 생성기, ID 관리대장
- 로컬 설정 은폐에 `skip-worktree`를 기본 사용한 관행
- 착수 신호를 위한 빈 브랜치 push와 배포/QA 표시용 빈 커밋
- 역할 없이 늘어나는 페르소나 이름과 장식적 자동 라우팅

## 4. 제안 디렉터리

```text
blariyo/
├── AGENTS.md                         # 에이전트 중립 헌장, 유일 정본
├── CLAUDE.md                         # AGENTS + Claude adapter 포인터
├── GEMINI.md                         # AGENTS + Gemini adapter 포인터
├── .github/
│   ├── copilot-instructions.md       # AGENTS 포인터
│   └── workflows/quality.yml         # CI 정본 게이트(호스팅 결정 후)
├── .agents/
│   └── skills/                       # Codex 라우터(얇게)
│       ├── blariyo-task-start/SKILL.md
│       ├── blariyo-docs-audit/SKILL.md
│       ├── blariyo-api-change/SKILL.md
│       ├── blariyo-security-review/SKILL.md
│       └── blariyo-release-check/SKILL.md
├── .claude/
│   └── skills/                       # docs/ai workflow를 가리키는 Claude 어댑터
├── docs/
│   ├── ai/
│   │   ├── README.md                 # 정본 지도와 스킬 매핑
│   │   ├── references/
│   │   │   ├── product-legal-map.md # planning/legal 정본 링크만
│   │   │   ├── code-source-map.md   # 코드·migration·설정 정본 링크만
│   │   │   ├── test-evidence.md     # 검증 종류와 증거계약
│   │   │   └── security-evidence.md # redaction·negative-test 증거계약
│   │   └── workflows/
│   │       ├── task-start.md
│   │       ├── docs-audit.md
│   │       ├── api-change.md
│   │       ├── security-review.md
│   │       └── release-check.md
│   ├── adr/                          # 기술·아키텍처 결정만 ADR로 보존
│   ├── task_list/MM/DD/<영역>/      # 날짜별 작업·검증 증거
│   └── session-log/                  # 기존 재개용 요약 유지
└── scripts/ai/
    ├── check-governance.mjs          # 포인터·링크·필수 섹션 검사
    └── check-secrets.mjs             # 또는 검증된 외부 도구로 대체
```

디렉터리를 한 번에 만들지 않는다. 1단계는 `AGENTS.md`, `docs/ai/README.md`,
`task-start`와 `docs-audit` 두 스킬만으로 시작한다.

`docs/ai`는 제품 요구, 게시판 정책, 법무 문구, 보관기간, URL, 상태값을 복제하지
않는다. 해당 사실은 `docs/planning`, `docs/legal`에만 두고,
`docs/ai`에는 원문 링크·읽기 절차·필요 증거·완료 판정만 기록한다.

## 5. 제안 규칙의 최소 내용

루트 `AGENTS.md`에는 다음만 둔다.

1. 한국어 보고, 핵심 우선
2. 제품·법무 정본이 협업 규칙보다 위라는 우선순위와 planning/legal 정본 링크
3. 우선순위와 별개인 착수 읽기 순서, 바깥/nested Git 상태 확인
4. 추측·가짜 ID·가짜 URL 금지, `(미정)` 사용
5. 비밀 파일 읽기/출력/커밋 금지
6. 삭제·push·merge·deploy·외부 전송 승인 게이트
7. 사용자 변경 보존, 작업 범위 밖 파일 수정 금지
8. 고위험 작업의 구현자/검수자 분리
9. 작업별 필수 검증 명령과 미실행 상태 표기
10. commit/push는 자동 수행하지 않음

기술 세부, 코드 예시, 긴 체크리스트는 `docs/ai/references`와
`docs/ai/workflows`로 내린다.

## 6. 스킬과 모델 라우팅 초안

### 6.1 첫 도입 스킬

| 스킬 | 트리거 | 읽을 정본 | 필수 종료 증거 |
| --- | --- | --- | --- |
| `blariyo-task-start` | 비단순 작업, 날짜 task 생성 요청 | `AGENTS.md`, 관련 `docs/planning`, `docs/legal`, 대상 파일 | task 경로, 범위, Git 상태, 검증 계획 |
| `blariyo-docs-audit` | 기획/정책/법무/와이어프레임 검토 | 관련 `docs/planning`, `docs/legal`; session은 정본 링크 탐색·이력 확인만 | 파일:행 근거, 충돌/미정/대체 문서, 링크 검사 |

### 6.2 기준선 확정 뒤 추가

| 스킬 | 선행 결정 | 필수 종료 증거 |
| --- | --- | --- |
| `blariyo-api-change` | Express 유지 또는 NestJS 전환, ORM/migration 방식 | lint, unit, integration, migration/schema, HTTP |
| `blariyo-security-review` | Phase 0 민감 로그 차단 뒤 인증·권한·업로드·외부수집 범위 | redacted threat evidence, negative test, secret scan, 로그 검사 |
| `blariyo-release-check` | CI/호스팅/환경별 배포 경로 | 관련 planning/legal 대조, build artifact, smoke, rollback, 사용자 승인 |
| `blariyo-browser-e2e` | 프론트 프레임워크·route 기준선 | 실제 route, 콘솔, 네트워크, 스크린샷 |

### 6.3 모델 선택 원칙

특정 모델명을 문서에 고정하지 않고 작업 위험에 따라 등급을 선택한다.

| 작업 | 권장 모델 등급 | 검수 |
| --- | --- | --- |
| 파일 인벤토리, 링크/포맷 검사 | 빠른 실행 모델 | 자동 검사 중심 |
| 일반 문서·기능 구현 | 균형형 코딩 모델 | 자체 체크 + 필요 시 독립 검수 |
| 인증·개인정보·수집권리·DB migration·아키텍처 | 고추론 모델 | 다른 컨텍스트/가능하면 다른 모델의 독립 검수 필수 |
| release 판정 | 고추론 검수 모델 | 구현 로그가 아니라 CI·런타임 증거 재실행 |

에이전트가 많다는 사실을 품질로 간주하지 않는다. 각 역할은 질문과 증거가 달라야 한다.

### 6.4 보안 검수 증거계약

- task, 세션 로그, AI 대화, CI artifact에 요청·응답 **body 원문**,
  `Authorization`/`Cookie` 헤더, access/refresh token, session ID, 비밀번호,
  권리 증빙 원문·개인정보를 남기지 않는다.
- 기록 허용 필드는 allowlist로 고정한다. 기본 후보는 HTTP method, 정규화된 path,
  status, duration, request ID, test case ID, redacted actor ID, pass/fail이다.
- redaction은 “알려진 비밀 키를 지우기”가 아니라 “allowlist 외에는 기록하지 않기”를
  기본으로 한다. 원문 payload가 실패 메시지나 snapshot에 포함되지 않게 한다.
- negative test에는 최소한 인증 없음·잘못됨·만료, 권한 상승, 타 사용자 객체 접근,
  cookie/token 재사용, 업로드 확장자·MIME·크기, 입력 변조를 포함한다.
- negative test 후 application/test/CI 로그를 직접 검사해 body·Auth·cookie·token·
  권리 증빙이 남지 않았음을 별도 증거로 기록한다. 민감 원문 자체는 증거로 첨부하지 않는다.

## 7. 하네스 초안

### 7.1 실행 계약

먼저 canonical backend와 저장소 토폴로지(monorepo/root workspace 또는 단일 app)를
정한다. 아래는 **루트 npm workspace를 채택한 경우에만** 적용하는 예시다.

```text
# 조건부 예시: root npm workspace를 채택한 경우
npm run format:check
npm run lint:check
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e          # UI/서버 준비 후
npm run ai:check          # 규칙 포인터, Markdown 링크, task 필수 필드
npm run secrets:check
npm run check             # 위 항목의 안전한 합성
```

단일 app 또는 다른 패키지 관리자를 선택하면 canonical backend의 실제 cwd에서
그 관리자의 clean-install/check 명령을 정의한다. 루트 명령이 있다는 가정을
스킬이나 CI에 먼저 박지 않는다.

`lint`나 `format` 기본 명령은 파일을 바꾸지 않는 검사로 두고, 수정은
`lint:fix`, `format:write`로 분리한다.

### 7.2 패키지 관리자

- 후보 A: canonical backend를 `apps/api`로 유지하고 npm + `package-lock.json`을
  추적하는 최소 변경안. 현재 lockfile은 manifest와 불일치하므로 그대로 채택하지 않는다.
- 후보 B: NestJS 전환과 함께 npm/pnpm/yarn 중 하나의 root workspace로 합치는 안.
  장기 구조는 단순해질 수 있지만 nested repo 처리와 migration 비용이 먼저 확정돼야 한다.
- 결정 전에는 lockfile ignore만 성급히 제거하지 않는다. 결정 후 선택하지 않은
  lockfile 패턴만 정리한다.
- 패키지 관리자 선택 전에 후보 lockfile과 manifest의 의존성 범위를 대조한다. npm을
  선택하면 lockfile 재생성을 별도 변경으로 수행하고 diff 검수와 fresh clean install을
  통과한 파일만 추적한다.

### 7.3 CI와 hook

1. canonical backend cwd와 패키지 관리자 명령을 확정한다.
2. CI workflow를 provision하고 clean install과 check가 실제 runner에서 통과하게 한다.
3. 브랜치 보호에서 해당 check를 required로 지정한다. **이 단계 이후에만** 자동 병합
   게이트라고 부른다.
4. required check 전에는 실행 명령·종료 코드·checksum·Git status를 task에 붙이는
   임시 evidence gate를 사용하고 “CI 보장”이라고 보고하지 않는다.
5. CI 통과는 사용자 승인, 제품 정본 대조, 법무 검토를 대체하지 않는다.
6. pre-commit은 변경 파일 대상 `format:check`와 `lint:check` 정도만 실행한다.
7. commit-msg는 기존 Conventional Commits를 검사하되 비교 프로젝트 전용 trailer를 요구하지 않는다.
8. pre-push에 전체 E2E를 강제하지 않는다. 느린 통합/E2E는 CI에서 실행한다.
9. `--no-verify`에 의존해 품질을 지키지 않는다. hook이 없어도 required CI가 같은
   실패를 잡아야 한다.
10. Docker integration test는 성공·실패·중단 모두에서 종료되도록 정리 trap을 둔다.

현재 확인된 것은 로컬 hook과 저장소 정의 workflow가 없다는 사실뿐이다. GitHub 원격의
branch protection, ruleset, 외부 App status check는 미검증이다. Phase 0에서 읽기 전용
API 또는 UI로 적용 브랜치, required check context, enforcement 상태를 확인하기 전에는
현재 원격 게이트의 유무를 확정하지 않는다.

## 8. 단계별 도입

### Phase 0 — 즉시 보안 차단과 기준선 결정, 0.5~1일

- [ ] tracked Express의 request body/query/params, 로그인·회원가입 body, 오류 객체,
  `DB_PASSWORD` 원문 출력을 제거하고 allowlist 기반 logger로 제한
- [ ] 인증·민감 입력 negative test 뒤 application/test 로그에 비밀번호·token·Cookie·
  Authorization·권리 증빙 원문이 없음을 확인하기 전 Phase 2 CI 실행 금지
- [ ] 기존 `combined.log`·CI 출력의 노출 여부와 보존 범위를 확인하고, 실제 노출된
  자격증명은 회전하며 로그 삭제는 별도 사용자 승인 후 수행
- [ ] 현행 기준선은 tracked Express임을 확인하고, nested NestJS 전환 제안은 별도 결정
- [ ] monorepo/root workspace와 단일 app 저장소 중 토폴로지 결정
- [ ] 패키지 관리자 하나와 추적할 lockfile 하나를 결정하고 manifest-lock 일치 검사
- [ ] CI의 checkout 경로와 install/test/build cwd 결정
- [ ] `apps/blariyo.core/.git`을 별도 repo로 유지, submodule화, 바깥 repo로 흡수,
  폐기 중 무엇으로 할지 결정
- [ ] 결정 전에는 바깥 저장소에서 `apps/blariyo.core/`를 stage하지 않고,
  바깥/안쪽 `git status`를 각각 확인
- [ ] nested Git 변경 전 외부 위치에 백업하고 파일 manifest·SHA-256을 기록한 뒤
  별도 위치에서 복원 시험을 완료
- [ ] submodule은 내부 초기 commit과 지속 가능한 remote가 확인된 뒤에만 선택
- [ ] 흡수 검토 중에도 원본 nested 저장소와 `.git`은 그대로 보존
- [ ] 별도 임시 복제본에서 `.git`만 제외한 사본으로 outer index dry-run을 수행하고
  반영 대상과 경로를 검수
- [ ] dry-run 결과 검수와 사용자 승인 후 원본 nested `.git`을 외부 보존 위치로
  이동하고, 복구 경로를 기록한 다음 바깥 저장소에 흡수
- [ ] `docs/task_list` 버전관리 여부 결정
- [ ] CI 제공자와 기본 브랜치 보호 방식을 결정하고, 현재 GitHub 원격의 branch
  protection/ruleset/required check 상태를 읽기 전용으로 확인

종료 조건: 민감 로그 차단과 로그 부재 검사가 통과하고, 기술·아키텍처 결정은
`docs/adr/`에 기록한다. 제품·법무 변경은 planning/legal 원문을 함께 갱신하며 미정
항목은 AI가 추정하지 않는다.

### Phase 1 — 규칙 최소본, 0.5~1일

- [ ] `AGENTS.md` 작성
- [ ] `docs/ai/README.md`에 planning/legal 정본 링크맵만 작성
- [ ] 벤더별 얇은 포인터 작성
- [ ] `task-start`, `docs-audit` 스킬만 추가
- [ ] `docs/ai`에 제품·법무 사실이 복제되지 않았는지 검사
- [ ] task 템플릿의 목표/범위/산출물/검증/상태/구현자/리스크 필드 검사

종료 조건: 세 에이전트 진입 파일이 같은 정본을 가리키고 중복 규칙이 없다.

### Phase 2 — 재현 가능한 기본 하네스, 1~2일

- [ ] canonical backend cwd에서 패키지 관리자 통일 및 lockfile 추적
- [ ] 선택한 lockfile과 manifest 일치, diff 검수, fresh clean install 확인
- [ ] 읽기 전용 `format:check`, `lint:check`, unit/build 명령 확정
- [ ] CI workflow provision 후 실제 runner에서 clean install → check 실행
- [ ] 브랜치 보호 required check 설정과 실패 시 병합 차단을 별도 확인
- [ ] 의도적으로 lint/test 실패를 넣어 CI가 차단하는지 검증 후 되돌림
- [ ] `.env`/secret ignore 및 샘플 파일 검증

종료 조건: 새 clone에서 동일 명령으로 같은 결과를 재현하고 required check가 실제로
병합을 차단한다. 그 전까지는 task의 임시 evidence gate를 사용한다.

### Phase 3 — 기술별 스킬, 1~2일

- [ ] 확정 스택의 코드 정본을 가리키는 source map과 test/security evidence 계약 작성
- [ ] `api-change`, `security-review` 스킬 추가
- [ ] 대표 소규모 API 변경 1건으로 전체 워크플로우 dry-run
- [ ] Phase 0의 기본 민감 로그 차단 위에서 인증·권한·입력 negative test 범위를 확장
- [ ] 구현자와 별도 검수자가 명령을 재실행

종료 조건: 코드·test·HTTP·DB 근거가 분리 보고되고 추정값이 없다.

### Phase 4 — 배포/UI가 생길 때 조건부 도입

- [ ] browser E2E, 접근성, visual evidence
- [ ] release smoke/rollback
- [ ] migration drift check, dependency/secret scan
- [ ] 외부 콘텐츠 수집의 권리·보관·삭제 검증

종료 조건: 실제 실행 환경과 사업자/저장소가 확정된 뒤에만 게이트를 활성화한다.

## 9. 검증 체크리스트

### 문서·규칙

- [ ] 제품·법무 사실의 유일한 정본이 planning/legal이고 AGENTS보다 우선하는가
- [ ] `AGENTS.md`가 유일한 협업 규칙 정본이며 벤더 파일은 얇은 포인터인가
- [ ] `docs/ai`가 제품·법무 사실을 복제하지 않고 링크맵·절차·증거계약만 담는가
- [ ] 모든 상대 링크가 실제 파일을 가리키는가
- [ ] session/정정 문서를 제품·법무 사실 입력으로 사용하지 않고 이력·정본 링크 탐색에만 쓰는가
- [ ] 미반영 제품·법무 결정이 planning/legal 갱신과 검수를 마칠 때까지 `BLOCKED`인가
- [ ] `(미정)` 항목을 예시 값으로 채우지 않았는가
- [ ] 비교 프로젝트 절대경로와 조직·기술 스택 전용 규칙이 남지 않았는가
- [ ] task에 목표/범위/산출물/검증/상태/구현자/리스크가 모두 있는가

### Git·비밀

- [ ] 작업 전후 `git status --short --branch` 차이가 의도한 파일뿐인가
- [ ] 기존 `apps/blariyo.core/` 미추적 작업이 보존됐는가
- [ ] 바깥 저장소와 `apps/blariyo.core/` nested 저장소 status를 각각 확인했는가
- [ ] 의도 결정 전 바깥 staging에서 nested repo가 제외됐는가
- [ ] nested `.git` 삭제·흡수·submodule 변경에 사용자 승인이 있는가
- [ ] nested Git 외부 백업의 manifest·SHA-256과 복원 가능성을 확인했는가
- [ ] 원본 nested 저장소를 보존한 채 `.git`을 제외한 임시 복제본에서 outer index
  dry-run을 수행하고 반영 결과를 검수했는가
- [ ] 흡수 승인 후에도 원본 nested `.git`을 외부 보존 위치로 이동하고 복구 경로를
  기록한 뒤 바깥 저장소에 반영했는가
- [ ] submodule이면 내부 commit과 접근 가능한 remote가 있는가
- [ ] `.env`, 자격증명, token, 개인 경로가 추적되지 않는가
- [ ] 선택한 lockfile이 더는 ignore되지 않고 Git에 추적되는가
- [ ] hook이 파일 삭제, 강제 push, hard reset을 수행하지 않는가
- [ ] commit/push/merge/deploy가 사용자 승인 없이 실행되지 않는가

### 실행 하네스

- [ ] 새 clone에서 lockfile 기반 clean install이 성공하는가
- [ ] lockfile과 manifest가 일치하고 lockfile 재생성 diff가 검수됐는가
- [ ] format/lint가 검사 모드에서는 파일을 변경하지 않는가
- [ ] unit/integration/build가 독립적으로 실행되는가
- [ ] test 실패 뒤 Docker/container가 정리되는가
- [ ] 의도적 실패가 로컬 check와 CI 양쪽에서 같은 방식으로 차단되는가
- [ ] CI workflow가 provision됐고 해당 check가 브랜치 보호 required로 설정됐는가
- [ ] required 설정 전 결과를 자동 게이트로 과장하지 않았는가
- [ ] 원격 branch protection/ruleset/required check를 별도 확인했는가
- [ ] CI 통과와 별개로 사용자 승인과 제품·법무 정본 대조를 수행했는가
- [ ] 실행하지 못한 항목이 `미검증` 또는 `BLOCKED`로 보고되는가

### 보안 증거

- [ ] body, Authorization, Cookie, token, session ID, 권리 증빙 원문이 로그·task·CI
  artifact에 남지 않는가
- [ ] 기록 필드가 redaction allowlist 안으로 제한되는가
- [ ] 인증 없음/오류/만료, 권한 상승, 타 사용자 접근, 입력·업로드 변조 negative test를
  실행했는가
- [ ] negative test 후 실제 application/test/CI 로그를 검사했는가

### 독립 검수

- [ ] 검수자가 구현자의 설명만 읽지 않고 diff와 명령을 직접 확인했는가
- [ ] 인증/권한/개인정보/수집권리/DB migration/release는 다른 검수자가 확인했는가
- [ ] 불일치가 있으면 양쪽 근거를 남기고 사용자에게 결정권을 돌렸는가

## 10. 아직 미정인 항목

| 항목 | 현재 증거 | 추천 기본값 | 확정 주체/시점 |
| --- | --- | --- | --- |
| canonical backend | tracked 구현·현행 planning 제안은 Express, untracked nested NestJS 목적 미정 | Express를 현행 기준선으로 확인하고 NestJS 전환은 별도 승인 | 사용자, Phase 0 |
| 저장소 토폴로지 | 바깥 repo 안에 별도 무커밋 `.git` 존재 | 별도 repo/흡수/submodule 중 선택 | 사용자, Phase 0 |
| 프론트엔드 | README에 Vue/Nuxt/Next 후보 혼재 | 구현 전 하나로 확정 | 사용자 |
| 패키지 관리자·lockfile | npm/yarn lockfile 모두 ignore, 기존 package-lock과 manifest 불일치 | canonical backend 결정 후 하나 선택하고 재생성 diff 검수 | 사용자, Phase 0 |
| CI 제공자·cwd | 저장소 정의 CI 없음, 원격 required check 미검증 | 원격 보호 상태와 checkout/install/test/build cwd를 함께 확인 | 사용자 |
| task_list 추적 정책 | 이번에 repo 내부 경로 요청됨 | 초기에는 추적, 과밀 시 분기 | 사용자/검수자 |
| DB migration 도구 | MySQL 사용만 확인 | 스택 확정 뒤 ORM/migration과 함께 결정 | API 기준선 결정 시 |
| 이미지 저장소 | 문서상 미정 | 어떤 사업자도 추정하지 않음 | 출시 설계 시 |
| AI 외부 도구 허용 | 프로젝트 전용 정책 없음 | deny 기본, 건별 승인 | 보안 검토 시 |
| 로컬 공유 메모리 | 현재 없음 | 당장은 미도입 | 반복 맥락이 쌓일 때 |
| 브랜치/worktree | 규칙 없음 | 짧은 feature branch, worktree 선택 | 협업자 증가 시 |

## 11. 최종 추천 순서

1. tracked Express의 민감 원문 로그를 차단하고 로그 부재를 먼저 검증한다.
2. canonical backend, nested Git 처리, 저장소 토폴로지, 패키지 관리자·lockfile,
   CI cwd와 원격 보호 상태를 결정한다.
3. `AGENTS.md` + `docs/ai/README.md` + 두 개의 최소 스킬만 추가한다.
4. lockfile과 CI를 복구하고 required check를 설정해 실제 자동 게이트로 연결한다.
5. 대표 API 변경 1건으로 불편과 누락을 측정한다.
6. 그 결과가 있을 때만 확장 security/release/browser 스킬을 추가한다.

이 순서면 기존 체계의 신뢰성은 가져오면서도, 아직 작은 Blariyo가 다른 조직의 규칙과
도구 복잡성에 끌려가지 않는다.

## 12. 이번 검토의 한계

- 목표 문서는 지정 경로에 저장됐다. Blariyo 내부 task는 현재 미추적이며 commit·push는
  수행하지 않았다.
- 문서와 Git 상태를 검토했으며 앱 테스트는 실행하지 않았다.
- `apps/blariyo.core/`는 기존 미추적 사용자 작업이므로 내용은 구조 확인에만 쓰고
  정본 또는 완료 상태로 판정하지 않았다. 내부 `.git`도 삭제·흡수하지 않았다.
- 법률·보안 요구의 실제 적법성이나 운영 배포 가능성을 확정하지 않았다.

## 13. 목표 저장 결과와 완료 판정

목표 두 곳의 저장소 성격이 다르므로 검증을 섞지 않는다.

### A. Blariyo Git 저장소 내부 task

목표:
`<blariyo>/docs/task_list/08/13/ai-governance/TASK.md`

1. 목표 파일 저장 완료.
2. Blariyo 저장소에서 `docs/task_list/`는 미추적 상태다.
3. commit·push는 수행하지 않았다.
4. 최종 문서 수정 후 `git status`, whitespace, Markdown 링크를 다시 검사한다.

### B. 비-Git `ai-use` 초안

목표:
`<artifact-dir>/blariyo-ai-governance-adoption-draft-20260813.md`

1. 목표 파일 저장 완료.
2. 이 경로는 Git 저장소가 아니므로 `git status`·`git diff --check`를 검증 항목으로
   쓰지 않는다.
3. 최종 문서 수정 후 SHA-256, Markdown 링크, trailing whitespace를 다시 검사한다.

### 완료 조건

두 목표의 저장과 최종 재검수 Medium 2건의 반영은 완료했다. 문서 검증을 통과하면
이번 검토 문서 작업을 완료로 판정한다. 다음 실행 단계는 별도 `security-hotfix` task로
민감 로그 차단을 시작하는 것이다. Blariyo task의 Git 추적 여부와 commit/push는 별도
사용자 승인·결정 사항이다.
