# Stash 복구와 단계별 커밋 — 2026-09-25

## 요청과 경계

- 사용자 요청: stash를 복구하고 단계별로 나누어 로컬 커밋한다.
- stash: `c373dac4ad6584e663ad958d1c9d64767dc48605`; 원래 기준점 `e51f1b501f7cc327da279102dd69eac2f4c554db`.
- 복구 branch: `feature/HARN-08-stash-recovery`; worktree: `../blariyo-stash-recovery`.
- 원본 `develop`, 기존 PR #1/#2 브랜치, 다른 세션 worktree, stash ref는 보존한다. stash는 apply로 복원했고 pop/drop하지 않는다.
- local main의 기존 8개 commit은 복구 기준점의 이력이다. 이번 복구가 새로 작성한 commit이나 develop 반영 결과가 아니다.
- 별도 task manifest는 정확한 파일 목록을 등록한다. 원격 반영 시 정책 등록을 먼저 별도 검토해야 하며, 이 branch를 현재 develop에 곧바로 병합할 수 있다는 의미가 아니다.

## 분할 순서

1. 복구 범위와 task 등록.
2. harness·hook·quality 설정·CI 연결. 기존 PR의 clean checkout/worktree 보완도 유지한다.
3. 애플리케이션·개발/배포 도구의 포맷과 lint 수정.
4. byte-sensitive Collector HTML 원본 보존·formatter 경계와 fixture metadata·정적 문서 HTML의 포맷.
5. 전체 SQL 포맷, migration checksum 계약과 runner·회귀 검증.
6. 문서 포맷·상태 및 최종 복구 검증 기록.

## 복구 확인

- 추적 파일 393개를 stash tree와 byte 단위로 대조했고 모두 일치했다.
- stash 밖의 연관 미추적 파일 55개를 원본 SHA-256 대조 후 복사했다. 생성된 `.quality/baseline.candidate.json`은 승인 설정이 아니므로 커밋 대상에서 제외한다.
- 아래 결과는 복구 worktree에서 새로 실행한 검증이다. 과거 RESULT의 통과를 승계하지 않았다.

## 복구 후 확인한 결함과 보완

- `typecheck:tests`에서 콘텐츠 checksum helper의 매개변수 타입과 계약 JSON 값의 narrowing 누락을 발견했다. JSDoc 및 runtime 타입 확인을 추가했고 checksum 계약·타입 검사를 다시 실행한다.
- 최초 Collector 전체 실행은 273개 중 39개 실패였다. 일괄 HTML 포맷이 provenance hash와 parser output fingerprint를 바꾼 원인이 확인됐다. parser 입력 HTML 49개는 stash 이전 byte로 복원했고 `.prettierignore`에 해당 fixture HTML 경로를 명시했다. 기존 hash·기대 결과는 변경하지 않았다. stash 자체에는 원래 포맷 변경이 계속 남아 있다.
- 변경 SQL 21개 중 20개는 공백·주석·비인용 토큰 대소문자를 제외한 lexer 토큰이 일치했다. 나머지 `seed-policy-drafts.sql`은 SELECT 출력 alias를 추가한 변경이며 실제 PostgreSQL 정책 seed 회귀로 반복·충돌 rollback·기존 발행본 보존을 검증했다.
- 새 checkout에서 API build 이전 lint는 `dist` 타입 참조가 없어 실패했다. CI와 동일하게 build를 먼저 수행한 뒤 전체 lint를 재검증한다.

## 최종 로컬 검증

코드 상태는 `49b84e4`까지의 복구 결과이며 후속 최종 commit은 문서·task JSON 포맷만 포함한다. 검증은 아래의 전체 복구 작업 사본에서 실행했으며 각 중간 commit의 깨끗한 checkout을 개별 재검증한 결과는 아니다.

| 검사                              | 결과                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| Node 24.18.0 `npm ci`             | 통과                                                                 |
| API/Web build                     | 통과                                                                 |
| `test:harness`                    | 52/52, 실패·skip 0                                                   |
| `test:quality`                    | 10/10, 실패·skip 0                                                   |
| `lint:all`                        | 전체 통과; SQL 27개 포함, 예외 baseline 없이 finding 0               |
| 언어 도구 정상/위반 fixture       | 6/6, lint:all 내부 실행                                              |
| 루트 `npm test`                   | 39/39, architecture 9개 포함, 실패·skip 0                            |
| API 단위 검사                     | 34/34, 실패·skip 0                                                   |
| scripts/tests/Web 타입 검사       | 통과                                                                 |
| migration checksum 계약           | 1/1, 허용한 구 checksum과 알 수 없는 checksum 거부                   |
| API migration 통합·schema restore | 2/2; 독립 PostgreSQL 18, ledger/data 및 table/sequence 31개 복원     |
| Collector 전체 검사               | 273/273, 77 suites, DB readback 15개 포함, 실패·skip 0               |
| Collector 독립 restore            | PASS, table/sequence 41개, V001–V006 유지와 재실행 확인              |
| 정책 seed DB 회귀                 | 반복 무변경·충돌 전체 취소·EFFECTIVE 입력 거부·기존 발행본 보존 통과 |
| 관리자·Core·Footer 브라우저       | 26/26, 실패·skip 0; 관리자 320/1280px 캡처 직접 확인                 |
| 복구 문서 상대 링크               | 최초 1,607개 대상 누락 0; 최종 신규 참조 재확인                      |
| 법무 placeholder                  | 기존 placeholder 임의 제거 없음                                      |
| Markdown lint                     | 145개 파일, issue 0                                                  |
| commit hook                       | 단계별 지정 pathspec·비밀 후보·whitespace·commit trailer 검사 통과   |

- 주요 로그: `/tmp/blariyo-recovery-lint-verified.log`, `/tmp/blariyo-recovery-harness.log`, `/tmp/blariyo-recovery-quality.log`, `/tmp/blariyo-recovery-collector-final.log`, `/tmp/blariyo-recovery-migration-restore.log`, `/tmp/blariyo-recovery-collector-restore.log`, `/tmp/blariyo-recovery-browser.log`.
- 화면 캡처: 이 worktree의 `test-results/admin-core/editor-320.png`, `editor-1280.png`; 검증 산출물로 보관하고 source commit에는 넣지 않는다.
- DB 검증은 이번 실행 소유의 임시 PostgreSQL과 무작위 fixture DB를 사용했다. 기존 개발 DB·운영 DB 데이터는 대상으로 삼지 않았다.
- 원격 CI, Windows, production 배포, 전체 API 통합 suite는 이번 복구에서 수행하지 않았다.

## 커밋과 최종 보존

| 단계 | commit    | 경로 수 | 내용                                                        |
| ---- | --------- | ------- | ----------------------------------------------------------- |
| 1    | `06de9f9` | 5       | 정책·복구 task 등록                                         |
| 2    | `5df5290` | 56      | harness·quality·CI 연결과 clean checkout/worktree 보완      |
| 3    | `e606d7e` | 150     | 앱·개발/배포 도구 포맷·lint 정리                            |
| 4    | `bd1b883` | 34      | fixture metadata·정적 HTML 포맷, parser 입력 HTML 포맷 제외 |
| 5    | `49b84e4` | 34      | SQL·checksum runner·계약·회귀 및 타입 보완                  |
| 6    | `de28c0c` | 125     | 문서·복구 결과·task JSON 포맷                               |

- 원본 `blariyo`의 HEAD/main/stash ref, Git 상태, 미추적 56개 파일 hash를 대조해 보존을 확인했다.
- 원본 stash는 백업으로 남긴다. 생성 candidate는 커밋하지 않으며 HTML 49개의 잘못된 포맷 변경은 원본 바이트 보존으로 대체했다.
- push·PR 수정·merge·원격 보호 설정·배포는 수행하지 않는다. 현재 PR #1/#2는 기존 branch를 유지한다.
- 이 branch는 local main의 기존 8개 commit을 기반으로 한다. develop 반영 시 기존 PR과 중복되는 harness·정책 등록, 기존 main의 기능 commit을 먼저 대조하고 통합 순서를 정해야 한다.

## 복구 이후 원격 상태 대조 — 2026-09-25

이 절은 위 복구 완료 뒤 수행한 읽기 전용 조회와 상태 문서 갱신이다. 과거 RESULT·inventory는 당시 기록으로 보존한다.

- `git ls-remote --heads origin`: main/develop/단일 release 모두 `8af72449a7d56c9701efd0d73dc7d430a66f9610`. registration `ada2474`, bootstrap `f376e3d`도 유지됐다. 복구 branch는 원격 목록에 없다.
- [PR #1 verify](https://github.com/JeahaOh/blariyo/actions/runs/36137890579/job/108080280417?pr=1): 브라우저 41개 중 39 PASS·2 FAIL·skip 0. `admin-workflow.test.ts:333`의 이미지 재시도 버튼 10초 timeout과 후속 완료 증거 assertion이다. collector 성공·images skip. 원격 PR 기준의 실패 원인은 추가 재현 대상이며 복구 branch의 26개 로컬 PASS로 해결됐다고 판정하지 않는다.
- [PR #2 event-context](https://github.com/JeahaOh/blariyo/actions/runs/36138034691/job/108080761870?pr=2): base SHA `8af7244`에 `.harness/policy.json`이 없어 실패했다. PR #1의 정책 등록이 아직 develop에 병합되지 않은 상태와 일치한다.
- [PR #2 harness-gate](https://github.com/JeahaOh/blariyo/actions/runs/36138034691/job/108080807223?pr=2): 선행 실패를 차단했다. 이후 receipt 단계도 `SUBJECT_SHA`, `CONTEXT_SHA256`, `BINDINGS_SHA256` 누락으로 실패했고 artifact 파일도 생성되지 않았다. 성공 gate 증거는 없으며 실패 진단의 보존 경로를 보완해야 한다.
- PR #2 합계는 2 FAIL·8 SKIP다. quality·Windows·Core/Collector restore를 실행했다고 기록하지 않는다. 두 PR 모두 미병합이며 #2는 Draft다.
- 인증된 [Branches 설정](https://github.com/JeahaOh/blariyo/settings/branches)에서 classic protection 미설정, [Rulesets 설정](https://github.com/JeahaOh/blariyo/settings/rules)에서 ruleset 없음 확인. 읽기만 했고 변경하지 않았다.
- 위 관측을 설계·계획·AI 안내·status·roadmap에 동기화했다. 이번 후속 변경은 문서 6개로 한정하며 앱·migration·workflow를 바꾸지 않는다.

### 다음 작업의 판단 경계

1. PR #1의 브라우저 실패를 해당 PR 기준에서 재현·최소 수정하고 CI를 통과시킨다. 실패 무시·검사 삭제·보호 우회로 병합하지 않는다.
2. 복구 branch의 기존 local main 8개 commit을 develop에 함께 넣을지 별도 PR로 검토할지 결정한다. 기능 변경은 analytics/admin 등을 포함하므로 stash 복구 요청만으로 merge하지 않는다.
3. 정책/task 등록을 trusted base에 먼저 반영하고 구현·cleanup을 연결한다. 기존 PR #2와 복구 commit의 중복을 대조한 후 정확한 head/base를 검증한다.
4. 원격 CI 실패 증거·Windows/restore/receipt 수용과 보호 설정, 실제 release/hotfix 수용을 마친 뒤 HARN 전체 완료를 판정한다.

복구·단계 커밋 요청의 완료와 HARN 전체 도입의 완료는 구분한다. 후속 push·merge·원격 설정은 각각 명시된 권한 범위에서 진행한다.

## CI 초기 실패 진단 보완 — 2026-09-25 후속 로컬 변경

- 시작 기준: `5957492429b668377bede866c90f878b43225785`, 작업 전 recovery worktree clean. 기존 원격 PR #2의 context 입력 부재와 receipt 생성·업로드 실패를 근거로 진행했다.
- 범위: `.github/workflows/ci.yml`, `tests/harness/ci-workflow.test.mjs`, 관련 설계·계획·status·roadmap과 이 기록. 앱·migration·Git 설정·원격 refs는 변경하지 않는다.
- 최종 gate에 항상 실행하는 진단 생성·업로드 단계를 추가했다. run/attempt·이벤트 SHA·job 결과와 복원 분류를 기록하며 전체 환경변수·event body·비밀·source 원문은 수집하지 않는다. 진단은 검증 증거가 아니라고 표시하고 분류 누락은 null로 보존한다.
- 검증 receipt는 event-context 성공 시에만 생성·업로드한다. 원래 SHA·digest 필수 검사는 변경하지 않았으며 context 성공 주장만 있고 output이 없는 입력도 계속 거부한다. 진단 업로드를 먼저 수행해 후속 receipt 실패와 분리했다. 필수 gate·images 의존 관계는 유지했다.
- 회귀는 YAML에서 실제 gate/진단 Bash·jq 명령을 읽어 실행했다. context 실패·취소·skip·누락·success지만 output 누락의 5가지 입력에서 gate 비정상 종료와 진단 JSON 생성, null 분류·비밀 sentinel 비포함·receipt 거부를 확인했다. 필수 6개 job 각각의 failure/cancelled/skipped, 필수 output 누락, Core/Collector 복원 success/skip 조합을 검사했다.
- 검증: 관련 workflow/receipt 8/8, 전체 harness 54/54(실패·skip 0), `lint:harness`, actionlint 1.7.12 통과. 로그 `/tmp/blariyo-gate-diagnostic-harness.log`. 최종 `lint:all` 전체 configured scope 통과·finding 0(로그 `/tmp/blariyo-gate-diagnostic-lint.log`), Markdown 145개·issue 0, 변경 파일 format·상대 링크 136개 누락 0·diff 검사 통과. 원본 refs/status와 미추적 56개 SHA-256 보존을 재확인했다.
- 상태: 로컬 구현·회귀 완료, 미커밋·미push. GitHub runner에서 새 진단 artifact 생성·다운로드는 아직 검증하지 않았다. runner 장애·workflow 전체 취소로 gate가 시작되지 않는 경우 진단 생성을 보장하지 않으며 필수 check 부재는 계속 차단 조건이다.

검증한 실행 변경의 SHA-256(문서 갱신과 분리):

- `.github/workflows/ci.yml`: `42c30c533706d93b0a81819918c03472bf26bb99e9e02555d94a9a96e459566c`
- `tests/harness/ci-workflow.test.mjs`: `cb7717a38763c225cba3db4e082965f6c5f757a53573984b51cfe02eda0a7d98`

## 후속 통합 범위 선택 — 2026-09-25

사용자는 기존 local main의 8개 commit을 별도 PR로 검토하고 harness·cleanup을 후속 연결하는 방식을 선택했다. 해당 8개를 한 번에 개발 기준 branch에 자동 병합하는 승인이 아니며, 질문에서 명시한 대로 이 답변만으로 push·merge하지 않는다. 원격 PR #1 브라우저 실패의 최소 수정과 기존 정책 등록 PR의 선행 관계를 함께 대조한다.

## PR #1 브라우저 race 재현·최소 수정 — 2026-09-25

- 대상 PR source: `ada24744af144b7a3d72df3e029e1845594dc33c`. `git archive`로 만든 별도 임시 사본에서 `npm ci`·API/Web build를 완료했다. 앱과 fixture source는 해당 SHA와 byte 대조했고 원본 worktree·refs는 수정하지 않았다.
- 재현은 마지막 이미지 복구 단계의 게시글 GET 응답만 1초 지연했다. 앱 코드·권한·DB 규칙은 그대로 두었다. 지연과 관측 코드는 임시 사본에만 넣고 repository 변경에는 포함하지 않았다.
- 1차 재현: 4개 중 2 PASS·2 FAIL·skip 0. 오류 버튼 표시 순간 `editorBusy=true`, `retryEnabled=false`였다. 클릭은 disabled 상태에서 대기하다 재조회 응답이 imageFailures를 초기화해 버튼이 DOM에서 제거되면서 10초 timeout됐다. 후속 완료 단계 assertion도 2/3으로 실패해 원격 증상과 일치했다.
- 최소 수정: `tests/browser/admin-workflow.test.ts`에서 마지막 `최신 내용 확인` 뒤 `section[aria-busy=false]`를 기다린 후 DOM image src를 변경한다. 사용자 기능·이미지 오류 처리·기대 결과는 바꾸지 않았다.
- 2차 검증: 동일 PR source·동일 지연 조건에서 4/4, 실패·skip 0. `editorBusy=false`, `retryEnabled=true`였고 12개 게시글·3개 업무 단계·최종 PUBLISHED 12개·브라우저 오류 0을 DB/media readback으로 확인했다. 동일 문제 실행은 총 2회로 종료했다.
- recovery worktree에도 같은 테스트 1줄을 적용하고 `typecheck:tests`, `lint:tests`를 통과했다. 다른 source 차이가 있는 recovery 전체 브라우저 suite를 새로 실행한 것으로 기록하지 않는다.
- 로그: `/tmp/blariyo-pr1-browser-build.log`, `/tmp/blariyo-pr1-browser-race-before.log`, `/tmp/blariyo-pr1-browser-race-after.log`, `/tmp/blariyo-pr1-fix-types.log`, `/tmp/blariyo-pr1-fix-lint.log`. PR 기준 최소 patch는 `/tmp/blariyo-pr1-minimal-fix.patch`, 임시 사본·container 정리 상태는 `/tmp/blariyo-pr1-browser-state.json`에 기록했다.
- DB는 이번 실행 소유의 `postgres:18` container와 무작위 fixture DB만 사용했다. 두 검증 종료 후 container ID·소유 label을 확인해 제거했고 기존 개발 DB 5439·다른 DB 5433은 보존했다. 임시 연결 암호도 상태 파일에서 제거했다.
- 상태: 로컬 수정·재현 완료, 미커밋·미push. PR #1의 실제 CI 상태는 기존 실패이며 원격 수용 전 완료 처리하지 않는다. 기존 7개 미커밋 변경을 보존했고 테스트 1개 경로가 추가돼 현재 변경 범위는 8개 파일이다.

최소 수정 대상 파일 SHA-256: `54f25844d1cfece69a92e0758ca10501736f554d05c30ea58652b475f9584d8b`.

### 커밋 전 task 범위 검사

현재 8개 변경 중 기존 HARN-08 allowlist에는 7개가 포함돼 있다. 새 테스트 수정 경로 `tests/browser/admin-workflow.test.ts`는 원래 stash 복구 대상이 아니어서 포함돼 있지 않다. 이 수정은 후속 P0 CI 복구 범위이며 HARN-08 manifest를 스스로 넓혀 커밋하지 않는다. 별도 CI 수정 task의 경로·Change-Id 등록을 분리해 검토한 후 구현 commit에 연결해야 한다. 현재 staging·commit·push는 하지 않았다. 상대 링크 136개 누락 0, Markdown 145개 문제 0, format·diff 검사 통과와 원본 refs/status/미추적 56개 hash 보존을 확인했다.

기존 main 8개 commit의 별도 PR 비교 기준은 develop `8af7244` → local main `e51f1b5`이며 72개 파일(+4,655/-485)이다. 이 수량은 단순 포맷 복구가 아니라 선행 기능·문서 변경을 포함한 비교 범위다. 이번 브라우저 최소 수정이나 미커밋 CI 진단 보완은 그 8개 이력에 포함되지 않는다.

## HARN-09 등록안과 실제 통합 선행 관계 — 2026-09-25

- 후속 CI 수정용 `.harness/tasks/HARN-09.json`과 [CI 복구 계획](CI-RECOVERY.md)을 작성했다. 정확한 9개 허용 경로·두 Change-Id이며 기존 HARN-08 manifest는 변경하지 않았다. 아직 로컬 미커밋 등록안이고 trusted base 승인 결과는 아니다.
- 실제 validator를 사용하는 임시 Git 저장소에서 정상 구현 두 binding은 통과, 등록 파일 혼합·무관 source·base manifest 누락은 거부됐다. 기대 결과 4/4이며 결과는 `/tmp/blariyo-harn09-contract-result.json`에 남겼다.
- 기존 main의 8개 commit 모두 Task-Id/Change-Id trailer가 없음을 확인했다. 새 gate 활성화 전 별도 PR에서 검토하는 순서를 문서화했고 기존 SHA·작성자는 유지했다.
- 읽기 전용 `git merge-tree --write-tree e51f1b5 ada2474` 계산에서 `docs/ai/git-workflow.md`, `docs/ai/harness-implementation-plan.md` 두 파일의 add/add 충돌을 확인했다. 실제 branch·index·작업 사본 병합은 수행하지 않았다.
- 초기 정책 PR의 순서만으로 도입 후 task 등록 경로까지 해결되지는 않는다. 전용 governance gate는 미구현으로 정본·로드맵에 남겼으며 자기확장 차단을 해제하지 않았다.
