# Git governance 구현·검증 결과

> **최신 현황은 [진행 현황 README](STATUS.md)를 먼저 확인한다.** 아래는 이전 작업 시점의 기록이며 “remote develop 없음·미커밋·미push” 등의 설명은 현재 상태가 아니다. 2026-09-25 후속 분리 커밋·Draft PR 전달과 남은 수용 조건은 README에 따로 정리했다.

- 기준일: 2026-09-25 KST
- 상태: **로컬 구현 진행, 전체 적용 미완료**. 브랜치 전략·harness·hook·CI·lint·architecture 코드는 들어왔고 저장소 전체 SQL lint는 0건으로 정리됐다. 원격 적용·수용 증거는 남아 있다.
- 요청 정본: [REQUEST](REQUEST.md), [브랜치 전환 인벤토리](BRANCH-TRANSITION-INVENTORY.md), [develop 기준 결정](DEVELOP-BOOTSTRAP-DECISION.md)
- 구현 정본: `docs/ai/git-workflow.md`, `docs/ai/harness-implementation-plan.md`
- lint 상세 검토: [Lint 후보 검토 자료](LINT-CANDIDATE-REVIEW.md)

## 로컬 구현 및 확인

- Gitflow task policy, task manifest, PR 방향·path allowlist·commit range 검사, task/resource lease, 고정 명령 verify, evidence/ready/handoff, CI event-context/change binding과 job receipt, release evidence consistency 및 merge-back checker가 구현돼 있다.
- `pre-commit`, `commit-msg`, `post-commit`, `pre-push`와 선택 worktree에 설치·복구하는 hook installer가 구현돼 있다. post-commit은 SHA·task/change ID를 `.git/harness-post-commit.jsonl`에 기록하고 기록 실패를 commit 성공과 분리한다. main worktree의 hook path는 `.git/harness-hooks`이고 네 wrapper smoke 및 synthetic bare remote의 secret-history 차단을 검사했다. 다른 세션의 `feature/m0-core` worktree에는 설정을 변경하지 않았다.
- `lint:all`은 JS/TS/Vue, Java, Python, 저장소 전체 SQL, shell, CSS, Markdown, GitHub Actions를 실행하고 architecture 검사 및 품질 gate에 연결돼 있다. Prettier는 migration·contract hash-locked 파일을 제외하며 SQLFluff는 전체 SQL을 검사한다.
- `lint:all`은 별도 양성·음성 fixture suite도 실행한다. TS/MJS/Vue ESLint, Prettier, Java Checkstyle, Ruff, SQLFluff, ShellCheck, Stylelint, Markdownlint, actionlint가 정상 입력을 통과시키고 대표 위반을 거부하는지 확인한다.
- 최초 lint candidate 434건(migration SQL)을 모두 정리했고 배포 SQL 28건도 함께 수정했다. 현재 저장소 전체 SQL 27개 파일의 SQLFluff 결과는 0건이며 전체 `lint:all`이 로컬 통과한다. 이미 적용된 DB의 과거 checksum은 API·Collector·콘텐츠 runner에서 명시된 구 값만 허용하고 다른 불일치는 계속 차단한다. 상세 이력은 [Lint 후보 검토 자료](LINT-CANDIDATE-REVIEW.md)에 있다.
- `origin/main`은 `8af72449a7d56c9701efd0d73dc7d430a66f9610`; local `develop`도 같은 SHA다. 현재 remote에는 `develop`이 없다. local `main`은 `e51f1b501f7cc327da279102dd69eac2f4c554db`이며 production baseline보다 8개 commit 앞서 있어 그대로 보존한다.
- Browser test 종료 후 임시 Playwright 컨테이너와 임시 브라우저/sandbox DB가 남지 않았고, 별도 `feature/m0-core` worktree의 기존 변경 29건도 보존했다.

## 검증 결과

| 검사                                                                                     | 결과                                                                                                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:harness`                                                                   | 52/52 통과; multi-ref/main/tag 거부, shallow·missing object 차단, post-commit 실패 분리, Unicode·공백·rename·symlink·삭제 및 merge-resolution 검사 포함 |
| `npm run test:collector:restore`                                                         | 로컬 pass; 격리 PostgreSQL 두 개 사이 41개 table/sequence schema·data restore, 복원 후 migration idempotency 통과          |
| `npm run test:quality`                                                                   | 9/9 통과; 빈 lint scope·전체 저장소 SQL 포함·SQLFluff 빈/잘못된 report·SQL/CSS 전체 파일 결과 누락·중복·예상 밖 경로 차단 회귀 포함          |
| `npm run test:quality:tools`                                                            | 6/6 통과; TS/MJS/Vue·Java·Python·SQL·shell·CSS·Markdown·YAML 도구별 정상/위반 fixture 포함                            |
| `npm run lint:harness`                                                                   | 통과                                                                                                                       |
| `npm run test:architecture`                                                              | 9/9 통과; CommonJS/import-equals require 정적 경로, 순환 의존 fixture regression 포함                                      |
| `npm test`                                                                               | 39/39 통과; Vue template의 미정의 `batchItemId` 경고 4회 출력                                                               |
| `npm run build -w @blariyo/web`                                                          | 통과                                                                                                                       |
| `npm run test:browser:docker`                                                            | 43/43 통과; 관리자·collection·batch review·consent·analytics·Core/footer·local worker 포함                                 |
| `npm run test:browser:docker -- tests/browser/admin-workflow.test.ts`                    | 4/4 통과; 320/390/768/1280 viewport 포함                                                                                   |
| `npm run test:browser:docker -- tests/browser/core.test.ts tests/browser/footer.test.ts` | 14/14 통과; 공통 shell·pagination·footer 반응형 포함                                                                       |
| `node --test tests/harness/leases.test.mjs`                                              | 2/2 통과 on macOS; Windows 전용 CI job에는 연결했으나 runner 미실행                                                        |
| `actionlint .github/workflows/ci.yml`                                                    | 통과; Windows job·필수 최종 gate 포함                                                                                      |
| `npm run format:check` / `git diff --check`                                              | 통과                                                                                                                       |
| `npm run lint:all`                                                                       | 전체 언어 검사와 저장소 SQL 27개 lint 통과; finding 0건이므로 승인 예외 baseline 불필요                                |
| 변경 문서 상대 링크 검사                                                                 | 5개 문서, 누락 0                                                                                                           |

### HV-25~31 수용 범위

| 시나리오             | 현재 증거                                                                                                                                                                                                                             | 판정              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| HV-25 release freeze | `tests/harness/release.test.mjs`에서 freeze Change-Id 범위·post-freeze 기능 제외·release 수정의 synthetic main/develop merge-back을 한 흐름으로 검증. `merge-back-check`는 두 대상에 반영되기 전 INCOMPLETE, 양쪽 반영 후 COMPLETE를 반환. 실제 원격 승인·CI readback은 미검증 | 부분              |
| HV-26 hotfix         | `tests/harness/merge-back.test.mjs`가 main 전진 뒤 production SHA에서 hotfix worktree 생성, main 병합, develop·active release 재반영, 3개 대상의 변경 내용과 ancestry를 synthetic Git fixture에서 검증. 실제 운영 SHA·배포·provider readback은 미검증 | 부분              |
| HV-27 develop 부재   | synthetic 저장소에서 task 시작 차단 및 다른 dirty/untracked worktree·ref·worktree 목록 보존 regression 통과. 원격 branch 이관은 미적용                                                                                                | 로컬 fixture 통과 |
| HV-28 lint gate      | 전체 local `lint:all` 실행 및 workflow의 동일 lint 필수 의존성 검증 통과. 전체 SQL scope·lint gate 로컬 통과(0 findings); 원격 CI 미실행                                                                              | 로컬 통과         |
| HV-29 언어별 lint    | `test:quality:tools` 6/6에서 TS/MJS/Vue·Java·Python·SQL·shell·CSS·Markdown·GitHub Actions·format 정상/위반 fixture 통과. 빈 scope·SQL/CSS report coverage 회귀도 별도 확인. Windows full lint, 일반 YAML·Gradle Kotlin DSL 전용 lint는 미적용 | 부분              |
| HV-30 baseline 변경  | fingerprint, draft, 누락 owner/reason/expiry, 중복·만료·정책 drift regression 통과. 원격 trusted-base 승인 절차와 실제 승인 baseline 미검증                                                                                           | 부분              |
| HV-31 architecture   | 실제 API·Collector·Web·contracts 소스 AST/package graph와 cycle·방향 검사 9/9 통과. CommonJS/import-equals require 경계와 cycle fixture 추가. Gradle project edge는 단일 Collector project라 대상 관계가 없고, reflection 경로 미검증 | 부분              |

## 원격 상태와 완료 전 남은 조건

- Read-only `git ls-remote --heads origin main develop` 결과 remote `main`만 존재하고 remote `develop`은 없다.
- 공개 GitHub rulesets API는 빈 목록을 반환했다. `main` classic branch protection API는 인증이 없어 401을 반환했고, 환경에는 `gh` CLI가 없다. 따라서 원격 보호가 없다고 단정할 수 없으며, authenticated readback·required-check 설정은 미확인이다.
- remote `develop` 생성·push, default branch/ruleset 변경, required-check 설정은 적용하지 않았다. 원격 CI workflow·artifact 실제 readback도 실행하지 않았다.
- 품질 검사 결과: `quality` job의 workflow·lint·architecture 코드는 PR subject checkout에서 실행된다. trusted base SHA의 baseline JSON만 읽고 검사기 자체까지 신뢰된 경로에서 실행되는 것은 아니다. 원격 ruleset의 trusted-ref required workflow 또는 base 기준 code-owner review가 설정·readback되기 전에는 PR이 자체 gate를 약화할 수 있어 원격 enforcement는 완료되지 않았다.
- SQL lint 후속 처리: 저장소 전체 27개 SQL 파일의 findings 462건(기존 migration 434, 배포 SQL 28)을 정리해 0건으로 만들었다. migration 17개의 이전·현재 checksum을 evolution contract에 기록하고 기존 DB ledger의 구 checksum을 정확히 allowlist로만 수용한다. 알 수 없는 checksum 회귀는 API·Collector 테스트에서 거부된다. CSS specificity/range와 Collector 보고서 표 오류는 수정했고, 전체 browser suite 43/43 통과를 확인했다. 관리자 recovery 회귀 selector도 실제 공개 사이트 링크를 가리키도록 고쳤다.
- HV-25~31 전체 matrix는 여전히 미완료다. 각 시나리오의 검증 범위는 위 표와 같다. Collector DB 전용 restore adapter와 CI gate 연결은 추가했으나 CI runner 실행은 미검증이다. 실제 배포 SHA 확인 및 배포 후 develop/활성 release 재반영, Windows lease와 Collector restore CI runner 실행, 원격 provider/artifact readback은 미검증이다.
- 코드·문서 변경은 커밋하거나 push하지 않았다.
- SQL lint 후속 검증: `npm run test:quality` 9/9, `npm run test:quality:tools` 6/6, migration checksum 계약 테스트 통과, Collector 격리 restore/idempotency와 API migration up/down·legacy checksum 통합 테스트 통과. 전체 `lint:all`은 SQL 27개를 포함해 로컬 통과했다. `npm run test:nest`의 API migration 테스트는 통과했지만, 뒤이어 실행된 독립 schema-restore 케이스는 임시 Docker 연결의 PostgreSQL 비밀번호 설정이 없어 실패했다. 테스트는 격리 DB에서 실행했고 운영 DB는 건드리지 않았다.

## 2026-09-25 재개 점검

- 범위: 이 worklog의 Git governance 상태·수용 증거 재확인과 관련 status/roadmap 갱신. 변경 많은 기존 worktree에서 커밋·push·reset·다른 worktree 수정을 하지 않았다.
- 현재 Git 기준: `main`/HEAD=`e51f1b501f7cc327da279102dd69eac2f4c554db` (origin/main보다 8 commits ahead), local `develop`=`8af72449a7d56c9701efd0d73dc7d430a66f9610`, `origin/main` 동일 SHA. Read-only `git ls-remote --heads origin main develop` 결과에는 remote `main`만 있고 `develop`은 없다. 두 번째 `feature/m0-core` worktree도 존재하며 보존했다.
- task 등록: 현재 `.harness/tasks/`에는 HARN-06·HARN-07 manifest만 있다. 구현 PR/task를 해당 계약에 결속하려면 HARN-01~05 manifest를 별도로 등록해야 한다. 다만 HARN-02의 정식 feature worktree 시작은 `origin/develop` 생성·동기화가 먼저다.
- 로컬 재검증: Node 24.18.0에서 `npm run lint:all` 통과(SQL scope 27개, 전체 언어 scope finding 0), `npm run test:harness` 52/52, `npm run test:quality` 9/9, `npm run test:architecture` 9/9. `lint:all` 내부 언어별 정상/위반 fixture는 6/6 통과했다. HV-25 release freeze→main/develop merge-back, HV-26 hotfix lifecycle synthetic regression을 추가한 뒤 harness 52/52와 `lint:harness` 통과를 확인했다. 최초 전체 lint 호출은 기본 Node 20.19.2라 버전 검사에서 중단됐고, 설치된 Node 24.18.0을 PATH에 지정한 한 번의 재실행이 통과했다.
- 문서 정합성: `docs/status.md`·`docs/roadmap.md`·`docs/ai/README.md`·`docs/ai/git-workflow.md`·`docs/ai/harness-implementation-plan.md`의 lint debt/실패 상태를 현재 462건 수정 완료·SQL 27개 0 findings·로컬 lint 통과에 맞췄다. `REQUEST.md`의 hook 미설치 현황과 bootstrap decision의 candidate 상태도 현재 사실 및 당시 snapshot을 구분하도록 고쳤다. 최초 candidate 434건 분석은 `LINT-CANDIDATE-REVIEW.md`에 당시 자료로 유지했다. 수정 문서 8개에서 상대 Markdown 링크 176개를 검사해 누락 0건, Prettier와 `git diff --check` 통과.
- 남은 범위: 원격 `develop` 생성·push, GitHub ruleset/required check/code-owner 보호 readback, PR checkout에서 변경 가능한 quality workflow를 trusted-ref로 강제하는 운영 계약, 원격 CI 및 artifact 수용, Windows runner 실행, HV-25~31 전체 end-to-end matrix, release/provider/deployment evidence readback. 기존 지침상 외부 Git 변경과 push는 명시 승인 범위 밖이므로 적용하지 않았다.
