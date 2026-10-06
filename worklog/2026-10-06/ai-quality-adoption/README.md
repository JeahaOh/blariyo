# AI 코드 품질 도입 실행

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 시작 HEAD·local release·origin/release: `12df6aedce57d41993d49060793656870c5c318f`
- 상태: 종료 — 계획0~5단계 도입·21:17 고정 입력 검증 완료; 이후 타 작업 변경은 재검증 대상 / 갱신: 2026-10-06 21:18 KST
- 요청: [도입 계획](../ai-slop-tools-review/ADOPTION-PLAN.md)의 전체 단계 실행.
- 담당 확인: 직전 `collector-request-policy` 종료(20:02 KST) 확인. 기존 dirty/untracked를 hash 목록으로 식별하고 보존한다.
- 브랜치 판단: 현재 feature HEAD가 확인한 release와 정확히 같음. 기존 작업을 이동하거나 공유 폴더 브랜치를 전환하지 않고 현재 feature에서 분리된 경로로 구현한다. 계획의 새 브랜치 이름은 제안이며 기준선·기존 변경 보존을 우선한다. commit·push 없음.
- 변경 범위: AGENTS·harness/검증 안내, package lint/quality 명령·기존 CI quality, `scripts/quality/`·관련 테스트, 외부 규칙 평가/선택 설정, status/roadmap, 이 기록.
- 제외: 제품·법무 정책 변경, 다른 작업 source 수정(필요 시 최소 별도 근거), 검사 우회, 운영 자원, 자동 수정, commit/push/merge/배포.

## 착수 당시 단계 현황

| 단계 | 상태 | 증거 |
| --- | --- | --- |
| 0 담당·기준선 | 완료 | 현재 feature/release 동일 SHA, 직전 담당 종료 |
| 1 기존 lint 연결 | 진행 | 현재4개 실행 기준선 확인 중 |
| 2 검증 결과 자동 기록 | 미착수 | 계획 수용 사례별 테스트 필요 |
| 3 검사 약화 변경 표시 | 미착수 | 정상/우회 표본 필요 |
| 4 외부 규칙 비교 평가 | 미착수 | 고정 SHA·14파일·정상/결함 표본 |
| 5 선택 도입·관찰 | 미착수 | 실제 변경5건 관찰·기존 검사 유지 확인 |

원격 반영·운영 수용은 로컬 구현/검증과 구분한다. 이번 요청에는 Git 전송·배포가 포함되지 않는다.

## 20:25 KST 이후 재개

- 사용자 `resume`과 [담당 인계](../commit-reset-recollection/README.md#작업-차단-해제담당-경계)를 확인했다. 새 HEAD는 `b9323667f39609fa42a75ae4e5870414dab9db94`이며 이 작업 파일은 미커밋으로 보존됐다.
- 다른 세션은 고정 JAR/서버 사본으로 기존 배치만 감시하고 공유 빌드·브랜치 전환을 하지 않는다. 이 세션이 품질 도입 파일의 수정·검증을 담당한다.
- 중단 전 추가 회귀8개·scripts/tests 타입/lint 통과. API의 파일별 다중 요약 집계 보완, 전체 검증, 5건 관찰과 문서 동기화는 아직 남았다. 이전 HEAD의 결과를 새 기준의 종합 통과로 재사용하지 않는다.

## 기존 API 통합 검사 실패와 최소 보완

- 새 격리 PostgreSQL18(127.0.0.1:55449)에서 전체 API 실행이98 tests 중97 pass/1 fail로 종료했다. 동일 명령 재현에서도 `database.integration.test.ts`의 전체 DB 열 대조가273 != 289로 실패했다. 이전 실패 receipt를 보존한다.
- 원인: V013은 `content.common_code_group`(7열)·`content.common_code`(9열)과 FK1개를 추가하지만 TypeORM entity 목록은23테이블·273열에 머물렀다. 두 테이블의 업무 처리는 raw SQL repository로 이미 구현돼 있다.
- 최소 보완 범위: `apps/api/src/persistence/entities.ts`에 V013 그대로2개 매핑·관계1개를 추가하고 기존 전수 검사의 고정 테이블/FK 수를25/20으로 올린다. 이는 V013 계약에 근거한 기대값 갱신이며 전체 열 대조·관계 실쿼리·스키마 불변 검사를 유지한다. SQL/migration/API 계약·업무 동작을 바꾸지 않는다.
- 승인된 도입 계획의 기존 검사 유지 조건을 충족하기 위한 보완이다. 이 변경 후 기존 quality receipt는 stale이며 새 입력으로 다시 검사한다. 다른 세션의 고정 실행 사본과 실제 DB는 변경하지 않는다.

## API 재검증 결과

- V013 매핑 보완 후 API 전체140 tests PASS, 실패/skip0. 실행 중 입력 변경 없음. `2026-10-06T11-33-58.427Z-api-94464.json`이 새 입력의 증거다.
- 초기 quality receipt를 실제 CLI로 다시 확인하면 `valid:false`, `stale-inputs`, 종료1로 거부한다. 이후 새 quality 실행을 별도로 남긴다.
- 브라우저 전체 실행은 실패로 기록됐다. 원문을 저장하지 않는 실행기 설계에 따라 동일 명령을 진단 재현하고 있으며 결과를 통과로 바꾸지 않았다.

## 브라우저 실행 환경·동기화 보완

- 첫 전체 브라우저82 tests 중80 pass/2 fail. 진단 재실행은78 pass/4 fail(추가된 navigation 하위 실패와 부모 실패 포함)이었다.
- 공통2개 실패는 실제 개발 launcher를 사용하는 fixture가3000/3100을 고정 사용하여 실행 중인 다른 세션의 서버와 충돌한 것이다. 사용자 서버는 종료하지 않았다. sandbox.json에만 Web/Core 포트를 선택하도록 하고 격리 fixture가 빈 loopback 포트를 배정한다. 일반 개발 실행의 기본3000/3100·DB 허용 범위는 유지한다.
- navigation 실패는 처리 재확인 버튼 소멸 후 목록 새로고침이 아직 busy인 시점에 back을 실행한 경우다. 지연 표시되는 progressbar가0개라는 사실만으로 route guard 해제를 증명하지 못했다. 기존 URL/목록/오류 검사는 유지하고 `조회` 버튼 enabled 확인을 추가하여 실제 사용자 조작 가능 시점까지 기다린다. timeout 증가·retry·skip을 넣지 않는다.
- 변경 경로: `scripts/local/start-development.mjs`, `tests/helpers/local-development-fixture.ts`, `tests/browser/batch-navigation.test.ts`. 기존 broad receipt 입력이 달라지므로 최종 quality/API/browser를 다시 실행하고 Collector도 최종 입력으로 기록한다.
- 첫 Collector 전체 검증:296 tests·실DB readback20건, 실패/error/skip0, 입력 전후 동일. 변경 전 수동 증거는 `verification/collector-verification.json`이다.

## 최종 입력 고정

- 별도 `todayhumor-title-prefix` 담당의 수정/검증 종료를 확인했다. 그 세션의 contracts/title test·planning/API 명세·기록은 기존 변경으로 보존한다. 공유 빌드는 해당 담당이 별도 사본으로 수행했다.
- 최종 quality14개 검사는 모두 통과, CI16·공통62 tests(추가 품질 회귀9개 포함), 실패/skip0. `2026-10-06T11-44-42.598Z-quality-99471.json`에 입력과 Node24.18.0/npm11.16.0/Python3.14.4/ESLint9.39.5/TS5.9.3/Oxlint1.78.0/Playwright1.63.0을 기록했다. Java를 직접 지정한 API 실행은 Java25.0.2도 기록한다.
- 최종 iron-laws 입력/실제 검사314파일, Vue31개 미지원, 후보114개·미검증 언어/규칙 조합66.67% 유지. `2026-10-06T11-45-05.969Z-iron-laws-1901.json`. 원문 snippet은 저장하지 않았다.
- 브라우저 집중 회귀9개는 모두 통과했다. 실제 시간 예약/취소/재시작·중복 소유 방지/일시적 회수 실패를 생략하지 않았다. 최종 전체 API/browser/Collector는 이 시점 입력으로 별도 재확인한다.

## 실행 중 입력 변경의 실제 감지

- 최종 검증 도중 별도 `batch-sticky-actions` 작업의 `apps/web/app/assets/css/admin.css`, `apps/web/app/pages/admin-batch.vue`, `docs/planning/03-screen-design.md` 변경을 감지했다. 담당 기록상 해당3개와 그 작업 기록만 수정하며 공유 빌드·이 세션 파일은 보존했고 작업 종료 상태다. 변경은 보존한다.
- quality 기록을 CLI로 재확인하면 stale-inputs 종료1. API `2026-10-06T11-45-59.102Z-api-16927.json`은140 tests PASS여도 inputs-changed-during-run으로 종료1이다. 현재 입력의 유효한 통과로 집계하지 않는다.
- 위 변경은 종료 시 남은 실제 source 차이다. 회귀 fixture뿐 아니라 공유 폴더의 실제 변경에서도 이전 PASS 재사용이 거부됨을 확인했다. 최신 입력으로 다시 검사한다.

## 진단과 재개 조건 보완

- `batch-source-concurrency`·`batch-original-link-filter`의 별도 변경과 담당 종료를 확인했다. 이번 품질 도입 source와 담당 경로를 구분하여 보존한다. 전체 snapshot은 이 변경까지 포함하므로 실행 중 변경된 quality/API/Collector 기록은 무효 상태로 남긴다.
- 최종 브라우저85 tests 중83 pass/2 fail 기록도 보존한다. 해당 실행 중 입력이 바뀌어 현재 코드 결과로 재사용하지 않는다. navigation 집중 재현3회는 각각 통과했으나 전체 실패 해결의 증거로 사용하지 않는다.
- 실패한 테스트 위치를 찾으려고 모든 로그를 다시 생성해야 했던 진단 공백을 보완했다. 실행기는 Node 실패 요약의 저장소 파일:행:열만 출력하고 테스트 이름·assertion 값·URL·원문은 출력/저장하지 않는다. 중복 제거와 비밀 모양 입력 제거 회귀를 추가했다.

## 20:58 KST 현재 판정·인계

| 단계 | 현재 판정 | 근거 |
| --- | --- | --- |
| 0 담당·기준선 | 확인 | release 일치 시작점과 두 차례 담당 인계, 다른 세션 경로 보존 |
| 1 기존 lint 연결 | 구현·실행 확인, 최종 입력 검증 대기 | 공통4개 ESLint+선택 규칙·CI 연결·workflow 문법·hook 설치 확인 |
| 2 검증 기록 | 구현·회귀 확인 | 성공/실패/0건/중단/누락/손상/dirty 변경 회귀와 실제 입력 변경 거부 |
| 3 검사 약화 후보 | 구현·표본 확인 | AST 정상/우회 대조, 정책 변경 후보15건 근거 검토 |
| 4 외부 비교 | 평가 기록 완료 | 14파일·9쌍·실행시간·전용 재검토16초·지원 공백 |
| 5 선택 도입·관찰 | 선택2규칙·실제5건 재현 관찰 완료, 전체 회귀 잔여 | EVALUATION과 실행 JSON; 장기 운영 관찰을 주장하지 않음 |

- **전체 도입 완료 아님.** 마지막 `2026-10-06T11-55-38.545Z-quality-37704.json`에서 검사14개·CI16·공통86 tests는 통과했지만 source/test/docs가 실행 중 바뀌어 유효성은 실패했다. [현재 차이](verification/handoff-state.json).
- API140·Collector296/readback20이 통과한 실행은 있으나 이후 입력 변경으로 현재 전체 통과에 재사용하지 않는다. 전체 브라우저 최신 실행은85 tests 중83 pass/2 fail이며 입력 변경도 있었다. 집중9개·navigation3회 통과만으로 전체 실패를 해소했다고 쓰지 않는다.
- 반복 입력 변경 원인: 별도 제목 접두어/버튼 고정/출처 동시성/원본 링크 수정에 이어 `all-source-title-labels`가 현재 진행 중이다. 각 담당은 이 작업 source·공유 빌드·Git을 보존하지만 전체 입력 snapshot은 달라진다. 작성 경로를 침범하지 않고 변경을 보존했다.
- 다음 담당: 이 품질 도입 세션. 재개 조건은 다른 세션 수정 종료와 약6~8분의 source 고정 구간이다. 사용자에게 두 작업의 실행 순서를 질의했으며 응답을 기다린다. 자동 승인·검사 범위 축소·기록 유효성 예외를 추가하지 않는다.
- 잔여 실행: (1) 현재 source·HEAD·다른 담당 종료 확인 (2) quality 최신 통과 (3) 별도 임시 PG55449에서 API 전체 (4) 최신 Web/API build의 browser 전체와 실패 위치 진단 (5) Collector 최종 입력 검사 (6) 현재 receipt 재검증·수용표 마감. 실패가 재현되면 해당 source/테스트 계약을 대조하고 필요한 최소 보완 후 해당 입력으로 재검사한다.
- 이번 세션의 임시 PostgreSQL 컨테이너는 테스트 연결0 확인 후 소유 ID로 제거했다. Playwright 임시 컨테이너도 각 실행기가 종료했다. 기존 개발 DB/서버·배치·다른 세션의 개인 사본은 종료하거나 초기화하지 않았다. [정리 증거](verification/cleanup.json).
- 프로젝트 stage/commit/push/merge/배포 없음. 작업 경로와 다른 세션 변경은 [담당 목록](verification/ownership.json)으로 구분하며, 이후 다른 세션 변경이 추가될 수 있으므로 다음 시작 때 다시 확인한다.
- 읽기: [도입 근거·관찰](EVALUATION.md), [수용 조건 대조](COMPLETION-AUDIT.md), [사용법](../../../docs/testing/README.md).

## 2026-10-06 21:01 KST 재개 확인

- `all-source-title-labels`20:58·`batch-sticky-list`21:00 종료 확인. HEAD b932366 유지, 각 담당 source/문서는 보존한다. 현재 품질 도입 담당이 전체 검증을 재개한다.
- 최신 quality → API build/통합 → browser 전체 및 Collector 순으로 실행한다. API/Collector 전용 PostgreSQL18을 loopback55449에 생성했고 기존 개발 DB/서버는 유지한다. 실행 중 입력이 다시 바뀌면 기존과 동일하게 결과 유효성을 거부한다.

## 21:04 KST 새 입력 변경

- quality14개·CI16/공통86 tests 통과와 실행 중 입력 동일 확인 후, `temporary-source-exclusion` 담당의 신규 설정/실행기/테스트/정본6경로 변경이 발생했다. `quality:receipt`가 stale-inputs로 거부했으며 현재 통과로 집계하지 않는다.
- 진행 중 API/browser는 진단 증거로 끝까지 확인하고 최종 수용과 구분한다. 새 담당 기록은 이 작업 파일·공유 build·Git 보존을 명시한다. 해당 변경은 건드리지 않는다.

## 전체 브라우저 진단 결과와 최종 재검증

- `2026-10-06T12-02-47.146Z-browser-docker-73044.json`: 전체85 tests PASS, 실패/skip0. 이전2개 실패는 이번 전체 실행에서 재현되지 않았다. 추가 assertion 완화·timeout 증가·skip 없이 기존 보완 상태에서 통과했다.
- 다만 출처 임시 제외 변경으로 inputs-changed-during-run이며 최종 유효한 통과로 집계하지 않는다. API도140 tests PASS이나 같은 변경으로 무효다. 변경 담당 종료 후 Collector를 새 입력으로 실행했고, browser 종료 후 quality/build부터 최종 재검증을 시작한다.

## 21:07 KST 추가 동시 변경

- `batch-review-eligibility` 작업이 새로 시작되어 API repository/통합 테스트와 Web/정본 입력이 다시 변경됐다. 이번 세션의 쓰기 경로는 보존되지만 실행 중인 quality/Collector 최종 입력은 재대조해야 한다. API/browser를 또 반복하기 전에 해당 작업의 종료와 입력 안정 여부를 확인한다.

## Collector 정책 변경 후 회귀 보완 담당

- 최신 수집 기획은3출처를 임시 비활성화하되 기존 parser·저장 HTML을 유지한다. `collector-2026-10-06T12-05-19Z.json` 실행은296개 중20개가 SOURCE_NOT_ALLOWED로 실패했다. 원인은 offline parser fixture가 운영 수집 승인 상태를 그대로 요구한 것이다. 실패 JUnit hash와 결과는 보존한다.
- 담당 종료·경로 비중복 확인 후 이 품질 세션이 test source4개만 보완한다: `ObservedFixtureMain.java`, `ManualSiteAdapterTests.java`, `SiteAdapterTests.java`, `SourceRegistryCompletenessTests.java`. 운영 SourcePolicy·source JSON·차단 조건은 변경하지 않는다.
- 기존 fixture helper에서 승인 상태의 메모리 사본만 parser 전용으로 구성하며 실제 URL/이미지 허용 경계·기존 fingerprint/assertion은 유지한다.3출처의 운영 policy가 계속 거부하고 helper 호출 후 원본 설정이 보존되는 검사를 추가한다. 외부 페이지 요청·DB 데이터 변경 없음.

- Collector 집중 첫 재검사는175개 중 기존 실패20개가 해소됐으나 신규3개에서 canonical byte[]를 참조 동등성으로 비교한 테스트 작성 오류가 드러났다. 실제 바이트 내용 비교 `assertArrayEquals`로 고쳤으며 승인/차단/원본 보존 조건은 그대로 유지한다. 이 테스트 수정도 입력 hash 변경으로 집계한다.

## 2026-10-06 21:12 KST 최종 입력 검증

- `2026-10-06T12-10-44.754Z-quality-10462.json`:14개 검사 PASS, CI16/공통86 tests PASS, 시작/종료 digest `c8b6ba759cd6bcc5947b13ffdb20b374ebca27e9670d0c8d84761fcc0d55ffed` 동일. Collector fixture 보완까지 포함한다.
- `2026-10-06T12-11-12.460Z-iron-laws-12545.json`: 같은 검토 후보114건·Vue31개 미지원 유지. 필수 gate 승격 없음.
- 최신 API의 Java fixture/Web/API build 완료와 격리 nest DB 생성을 확인한 후 browser-docker를 시작했다. API 종료 뒤 Collector 전체를 실행한다. 완료 판정 전 현재 입력과 각 기록을 다시 확인한다.

## 최종 수용 — 2026-10-06 21:18 KST

**계획0~5단계의 로컬 도입·평가·검증을 완료했다.** 아래 결과가 최종 기준이며 위 실패·중단·무효 기록은 당시 증거로 보존한다. commit·push·원격 CI·운영 배포와 향후 장기 관찰을 완료 범위에 포함하지 않는다.

| 범위 | 최종 결과 | 증거 |
| --- | --- | --- |
| 공통 품질 | 14개 검사 PASS, CI16·공통86 tests, 실패/skip0 | [quality](verification/2026-10-06T12-10-44.754Z-quality-10462.json) |
| API 통합 | 140 tests PASS, 실패/skip0 | [api](verification/2026-10-06T12-11-46.958Z-api-27335.json) |
| 전체 브라우저 | 85 tests PASS, 실패/skip0 | [browser](verification/2026-10-06T12-12-14.977Z-browser-docker-27969.json) |
| Collector | 82 suites·299 tests PASS, 그중 실DB readback20, 실패/error/skip0 | [수동 JUnit 증거](verification/collector-2026-10-06T12-14-32Z.json) |
| 21:17:36 입력 재대조 | 해당 시점3프로필 receipt CLI 모두 valid:true, Collector 시작/종료/당시 입력 hash 일치 | [최종 독립 재대조](verification/final-validation-12-17-37.json) |
| 정적·설치 확인 | git diff --check, actionlint1.7.12, hooks:check PASS; 문서 상대 링크249개 누락0(최종 요약 추가 전) | 직접 실행 결과; 아래 최종 문서 검사 참조 |
| 자원 정리 | 소유 PG의 연결0/잔여 test DB0 확인 후 소유 ID만 제거, Playwright 종료, 기존 개발 PG 보존 | [정리](verification/cleanup-final.json) |

- 공통 입력: HEAD `b9323667f39609fa42a75ae4e5870414dab9db94`, dirty/untracked 포함 digest `c8b6ba759cd6bcc5947b13ffdb20b374ebca27e9670d0c8d84761fcc0d55ffed`. 기존 변경을 포함한 동일 내용에서 검증했다. 이후 코드/문서/설정 변경 시 이 기록은 자동 stale 판정 대상이다.
- 도입: 기존4개 lint+선택2규칙을 공통 명령/기존 CI에 연결; 명시적 검사 실행/입력 기록/receipt 검증; 테스트·정책 약화 후보 표시; Attention Span/Karpathy/Verification 원칙은 기존 지침에 최소 통합했다. 별도 전역 규칙집·Superpowers 일괄 설치는 하지 않았다.
- 외부 비교:14파일·정상/결함9쌍·process-cold1/warm3·지원 공백/실행시간·라이선스/고정 버전·되돌리기 근거를 기록했다. 실제 변경5건(TS3/Vue1/Java1)은 기존 변경의 전후 재현 관찰이며 미래5회 운영이나 장기 오탐률 증거가 아니다.
- iron-laws 최신 결과는314파일/검토 후보114건/Vue31개 미지원이다. REVIEW 원문 위치를 보존했으며 전체 제품 오류 처리 감사·보안 완료·필수 CI gate로 확대하지 않는다. Collector JUnit은 실행기 미지원이므로 위 수동 증거로 따로 확인했다.
- 검증에서 드러난 최소 보완: HTMLInputElement 런타임 확인, V013 entity2개 매핑, 개발 sandbox 포트 격리와 navigation 조작 가능 상태 대기, 운영 수집 차단을 유지한 offline parser fixture 분리. 테스트 삭제·skip·지문 기대값 변경·timeout 확대·운영 source 차단 해제 없음.
- 소유 source/정책 경로37개와 다른 세션 변경은 [담당 목록](verification/ownership-collector-followup.json)으로 분리했다. Git stage/commit/push/merge, 사용자 서버 종료, 개발 데이터 초기화, 운영 배포 없음.
- 후속 운영: 실제 개발 변경마다 해당 품질/업무 프로필을 명시 실행하고 현재 receipt를 재확인한다. 새 규칙 업데이트·예외는 paired fixture와 지원 범위를 다시 검토한다. 원격 반영은 별도 요청 범위다.
- [사용 명령과 범위](../../../docs/testing/README.md#로컬-품질-검사와-결과-기록), [도입 평가](EVALUATION.md), [수용 대조](COMPLETION-AUDIT.md).

## 후속 변경과 담당 종료 — 2026-10-06 21:19 KST

- **도입 수용 시점은21:17:36 KST, digest c8b6ba7…다.** 해당 시점 quality/API/browser/Collector가 모두 같은 입력으로 통과했고 임시 자원 정리까지 끝냈다.
- 그 뒤 다른 담당의 MLBPARK·PGR21 임시 제외가 반영돼 source 설정·설정 시험·수집 기획·아키텍처4경로가 변경됐다.21:18:41 재대조는 [모두 stale](verification/final-validation-12-18-42.json)이며 현재 작업 폴더의 전체 통과를 주장하지 않는다. 새 source 설정의 기능 검증/커밋은 해당 후속 작업 범위다. 다른 담당 변경을 되돌리거나 이 결과에 소급 포함하지 않는다.
- 품질 도입 소유37경로는 수용 시점과 동일하다. 도입 구현·평가·동일 입력 전체 검증 완료를 후속 독립 변경의 통과로 확대하지 않는다. 이후 커밋으로 HEAD가 달라지면 기존 기록도 계속 stale로 남는 것이 정상이다.
- **G03 담당 종료:** 이 품질 도입 세션은 공유 build·검증 프로세스·Git 작업을 모두 종료했고 stage/commit 예정 작업이 없다. `followup-unit-commits` 담당은 자신의 기존 사용자 승인/경로 범위에서 Git 순서를 이어갈 수 있다. 이 인계는 그 범위를 넓히거나 이 세션 소유 파일의 commit/push를 승인하는 뜻이 아니다.37개 도입 파일과 본 worklog는 그대로 보존한다.
- [최종 문서 검사](verification/final-document-check.json): 상대 링크260개 누락0, git diff --check0, staged 파일0. 기존 개발 PG/서버 보존·소유 임시 PG/Playwright 종료는 cleanup-final 증거를 따른다.

## 잔여 Git 변경 소유권 확인 — 2026-10-06 21:24 KST

- 사용자 질문: 현재 변경이 모두 이 세션 작업인지, 파일 수가 많은 이유 확인. 앱 source/설정 수정·삭제·stage/commit 없이 읽기 대조하고 이 기록만 추가했다.
- 현재 HEAD85109e6, `git status --porcelain=v1 -uall`89파일: 기존 수정20/신규69. 담당 목록의 도입 파일37개 + 이 작업 worklog52개이며 목록 밖 경로0개다. 도입37개는 최종 검증 snapshot의 내용/실행권한 hash와 모두 일치한다.
- worklog52개는 설명/평가/재현 파일6개와 verification46개, 총7,055,103bytes(이 확인 기록 추가 전)다. 반복 실행의 시작/종료 전체 입력 hash와 실패/stale 증거를 각각 보존해 크기가 늘었다.
- 다른 세션 기능 변경은 후속 커밋에 반영돼 현재 미커밋 목록에서 빠졌다. Git 변경 목록은 디스크상의 미커밋 변경이며 IDE 미저장 버퍼 목록을 확인한 것은 아니다. 원격 전송/운영 반영 확인과 구분한다.

## 감사 보완·회귀·커밋 착수 — 2026-10-06 21:39 KST

- 담당: 이 품질 세션 / 현재 feature HEAD85109e6. 다른 담당 진행 중 쓰기/Git 기록 없음, Discord 검토 종료 확인. 그 신규 worklog는 보존하며 이 세션 커밋에서 제외한다.
- 사용자 요청: 감사 E1/E2 보완 뒤 회귀 검증하고 커밋. 기존 품질 도입37파일과 해당 worklog를 포함하며 push·merge·배포 권한으로 확대하지 않는다.
- E1: Docker 브라우저 기본 명령 자체에 필수 build를 연결하여 프로필·직접 실행 모두 보호하고 build 실패 시 브라우저 시작을 막는다. E2: 하위 package.json도 검사 정책 변경 후보로 포함한다.
- 먼저 두 문제의 회귀를 추가해 기존 코드에서 실패를 확인한 뒤 최소 수정한다. 관련 타입/lint/공통 테스트·실제 Docker 브라우저와 필요한 API/Collector 회귀를 확인한다. 구현/사용법과 작업 기록을 별도 커밋하고 실제 staged diff·hook·다른 변경 보존을 확인한다.

- 추가 정합성 확인: `docs/testing/local-playwright-docker.md`에 남은 ‘자동 build 안 함’ 안내도 실제 필수 build 경로로 갱신했다. 이번 커밋 소유 경로는 기존37개 + 이 사용법1개로38개다. 다른 세션 Discord 기록은 제외한다. 검증 중 이 문서 입력이 바뀐 quality 기록은 무효로 유지하고 최종 입력으로 다시 기록한다.

## 감사 보완 후 전체 회귀 — 2026-10-06 21:50 KST

- 담당: 이 품질 세션 / 브랜치: `feature/production-collection-20261004` / 상태: 진행(전체 회귀 완료, 승인된 커밋 처리).
- E1: `test:browser:docker`가 필수 build 성공 후에만 테스트를 시작한다. 오래된 산출물의 거짓 통과와 build 실패 후 테스트 진행을 막는다.
- E2: 루트뿐 아니라 하위 `package.json` 변경도 검사 정책 후보로 표시한다. 모든 변경을 의미적 약화로 확정하지 않으며 의존성·metadata 변경도 수동 검토 대상이다.
- 두 회귀를 기존 구현에 먼저 실행해 실패를 확인했고 보완 후 집중12개 및 타입/lint가 통과했다. 기존 테스트 삭제·skip·assertion 완화 없이 아래 전체 회귀를 수행했다.

| 검사 | 최종 결과 | 증거 |
| --- | --- | --- |
| 공통 품질 | 14개 검사 PASS, CI16·공통88 tests, 실패/skip0 | [quality](verification/2026-10-06T12-41-18.608Z-quality-57738.json) |
| API 통합 | 140 tests PASS, 실패/skip0 | [api](verification/2026-10-06T12-42-19.326Z-api-75552.json) |
| 전체 Docker 브라우저 | 필수 재빌드 후85 tests PASS, 실패/skip0 | [browser](verification/2026-10-06T12-45-04.527Z-browser-docker-77954.json) |
| Collector | 82 suites·299 tests PASS, 그중 실제 DB readback20, 실패/error/skip0 | [Collector JUnit](verification/collector-2026-10-06T12-45-04Z.json) |
| 독립 재대조 | 3프로필 receipt CLI valid:true, Collector 시작/종료/현재 입력 동일 | [21:49 재대조](verification/final-validation-12-49-46.json) |
| 임시 자원 정리 | 소유 PG 연결0·잔여 test DB0 확인 후 소유 ID만 제거; Playwright 종료·기존 개발 PG 보존 | [정리 증거](verification/cleanup-12-49-53.json) |

- 커밋 전 검증 기준: HEAD `85109e67779f046ddefd4b0440d163adc3df39ac`, digest `b375b0dc0f68daf2c2a4cab96141c7ae090b753ad01a5fd9b7bc1b1a2247ff68`. 증거는 이 입력의 실행 결과이며 커밋 뒤 새 HEAD에서 실행한 결과로 바꾸지 않는다. 커밋 후에는 실제 저장 내용·실행 권한과 검증 입력의 동일성을 별도 대조한다.
- 정책 후보15건을 이번 승인된 추가 검사/기록 도구/필수 build와 대조했다. 기존 CI job·ESLint·strict·업무 assertion을 완화하지 않았다. Java/Vue 등 의미 분석 미지원16경로는 자동 통과가 아니며 관련 변경은 diff와 실제 회귀로 확인했다.
- `hooks:check`, actionlint1.7.12, `git diff --check` PASS. 마지막 마감 절 추가 전 관련 문서 상대 링크262개 누락0; 마감 문서 및 staged diff는 커밋 전 다시 확인한다.
- 커밋 제외: 다른 담당의 `worklog/2026-10-06/discord-admin-review/README.md`. 원본 hash·HEAD·index를 확인했고 이 파일은 수정하거나 stage하지 않는다. push·merge·원격 CI 실행·배포는 이번 요청 범위에 포함하지 않는다.

## 커밋 처리와 담당 종료 — 2026-10-06 21:51 KST

- 구현·설정·사용법 커밋: `140a71f700080c733af6ed5f543c1389bfdbfe1f` / `feat(quality): add scoped lint rules and verified local checks` /38파일. 실제 commit 경로가 allowlist와 일치하고 staged 계약·migration·OpenAPI hook이 통과했다.
- [커밋 내용 대조](verification/implementation-commit-content.json):38파일의 Git 저장 byte·실행 권한과 검증 입력이 일치하며 전체 non-worklog 입력도 그대로다. HEAD가 바뀐 기존 receipt를 새 SHA의 실행 결과로 재사용하지 않는다.
- [감사 보완 후 정책 후보](verification/policy-review-after-audit-fixes.json)15건과 미지원16경로를 보존했다. 후보 목록을 지우거나 자동 승인으로 변경하지 않았다.
- 이 절을 포함한 도입 평가·실패/무효/최종 회귀 증거는 뒤따르는 `docs(worklog): record quality adoption and regression evidence` 커밋에만 담는다. 다른 담당 Discord 검토 기록은 제외한다.
- 상태: 종료 — E1/E2 보완·동일 입력 전체 회귀·구현 커밋 완료. 공유 build·검증 프로세스·임시 컨테이너 정리 완료. 본 기록 커밋 후 추가 Git 변경 예정 없음. push·merge·배포는 실행하지 않았다.
