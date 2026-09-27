# 문제별 수정·검증 횟수

- 담당: Codex / 현재 M0 구현 goal. 폴더·브랜치는 [실행 기록](README.md)과 동일. 상태: 종료. 갱신: 2026-09-27 10:17 KST. 모든 문제는 아래 후속 재검증 결과로 해소했다.
- 사용자 정정: 서로 다른 문제는 cycle을 각각 계산한다. D01 같은 task, 검사 명령, 파일 단위로 서로 다른 원인을 합산하지 않는다.
- 동일 원인의 수정 시도 최대2회, 문제별 테스트→수정→재테스트 최대3 cycle을 적용하며 먼저 도달한 상한을 따른다. 최초 실패 확인만으로 수정 cycle을 소모하지 않는다. 수정과 재검증까지가 1 cycle이다.
- 같은 원인이 만든 여러 메시지는 하나의 문제다. 파일명·명령·오류명만 바꾸거나 같은 문제의 재발을 새 ID로 만들어 횟수를 초기화하지 않는다. 독립 원인으로 나눌 때는 근거를 기록한다.
- 문제 A 해결 후 드러난 문제 B는 B의 첫 cycle부터 시작한다. A의 기록은 보존한다. 정상 대기·읽기 전용 원인 조사는 수정 cycle이 아니다.
- 과거 준비 기록의 ‘검증 단위 총3회’ 권고와 STOP-REPORT.md의 합산 중단 판단은 이 정정으로 대체된다. 과거 기록과 00:31 해시 스냅샷은 보존한다.

| 문제 ID | 원인·독립성 근거 | 수정 횟수 / 완료 cycle | 현재 결과 |
| --- | --- | --- | --- |
| R01 | D01 fixture batch_item INSERT의 동일 SQL 인자 UUID/text 타입 추론 | 1 / 1 | UUID cast 후 DB 시험 통과. 이 SQL의 수정은 유지되며 재발하지 않음 |
| R02 | fixture connection과 DataSource 종료 순서 | 1 / 1 | 자원 종료 순서 수정 후 통과; R01과 별도 cleanup 오류 |
| R03 | API DTO 최상위 보존 필드와 계약 retention 객체 불일치 | 1 / 1 | DTO 중첩 후 검수 시험 통과 |
| R04 | QueryRunner.query의 미지원 generic 인자 | 1 / 1 | rows 검증 사용 후 build/test 통과; 후속 ENOENT는 같은 빌드 실패의 파생 증상 |
| R05 | D04 단위 시험 Promise 미대기 | 1 / 1 | await 추가 후 API lint 통과 |
| R06 | migration fixture callback이 query의 any를 반환 | 2 / 2 | API/browser fixture 모두 반환 없는 callback 사용. API·tests·scripts lint 통과 |
| R07 | OpenAPI response 내부 schema deep ref가 잘못된 선언 타입 생성 | 1 / 1 | response 참조로 수정·양쪽 계약 재생성 후 API build/build:test/lint 통과 |
| R08 | Gradle wrapper를 저장소 루트에서 호출한 경로 오류 | 1 / 1 | Collector 폴더에서 같은 검사를 실행해 S3/local 객체4개 시험·Java build/fixtureClasspath 통과 |
| R09 | 과거 report fixture에 기존 V003이 요구하는 hash/행 수 누락 | 1 / 1 | fixture에 실제 합성 파일 hash와 행 수를 제공. 기존 trigger를 유지하고 setup·해당 run 삭제 시험 통과 |
| R10 | 복원 orphan은 run_id가 없는데 final purge가 NULL run의 권한 행을 생성 | 1 / 1 | run이 있을 때만 run/report/checkpoint 권한 생성. 확장 worker7 시험 통과. 후속 ledger 미정리도 같은 원인의 파생 증상이었으며 해소됨 |
| R11 | 선택 백업 시험용 게시글 INSERT의 필수 감사 시각 누락 | 1 / 1 | 감사 시각을 명시한 뒤 실제 age 암호화·격리 복원 통과. 보존52/제외13 table, 원문0, 미분류 테이블 거부·실패 spool 제거 확인 |
| R12 | apply_patch 한 호출에서 같은 파일 Delete/Add 중복 지정 | 1 / 1 | 도구가 쓰기 전 거부해 파일 변경 없음 확인. 단일 Update로 수정해 적용 완료; 제품 테스트 실패와 별개 |
| R13 | backup runner의 Docker network 입력이 하이픈으로 시작하는 옵션 모양을 허용 | 1 / 1 | 첫 문자를 영숫자로 제한. 기존 거부 assertion 유지, runner3개 시험 통과 |
| R14 | 문서 patch에서 기존 행 전체 대신 일부 문구만 context로 지정 | 1 / 1 | 쓰기 전 일괄 거부됨을 확인. 실제 제목/행 context로 바꿔 문서 갱신 완료 |
| R15 | zsh 파일 조회 loop의 path 변수가 PATH 연동 특수 변수를 덮어씀 | 1 / 1 | 해당 읽기 command 안에서만 발생. 새 shell/Python의 task_source_file 변수로 조회 완료, 저장소·환경 설정 변경 없음 |
| R16 | 기본 shell의 Node20이 Node24용 TypeScript 실행 파일을 읽지 못함 | 1 / 1 | 명령에 검증된 Node24.18.0 PATH를 명시해 build/build:test 통과. 코드 변경 없음 |
| R17 | 새 D02 mailbox fixture의 INSERT SELECT가 같은 bind 인자를 서로 다른 SQL 타입으로 추론 | 2 / 2 | 첫 수정에서 UUID/text 충돌 제거 후 source_key의 varchar/text 충돌이 남음. 같은 SQL의 파생 오류로 합산해 모든 반복 인자 타입 명시, 두 번째 재검증에서 DB 5개 모두 PASS |
| R18 | Java mailbox 시험용 제한 계정에 기존 queue trigger가 요구하는 purge_authorized 실행 권한 누락 | 1 / 1 | 운영 provisioning의 기존 grant와 대조해 시험 계정에 같은 제한 함수 권한 추가. 일반 DML/삭제 권한은 늘리지 않음. Java 포함 DB6개 PASS |
| R19 | runtime projection의 hosts 배열이 이미 좁혀졌는데 string[] 단언을 반복 | 1 / 1 | 불필요 단언 제거 후 API lint PASS |
| R20 | 공통 normalizeInput이 direct 원본 URL의 명시적 :443을 사전 제거하여 검증과 요청 digest를 바꿈 | 1 / 1 | direct create만 원래 문자열을 계약 검증/정규화기에 전달하도록 API와 BFF를 함께 수정. 원래 거부 assertion·멱등 비교·접수10건 제한 통과. BFF 브라우저 검증은 후속 |
| R21 | HTTP 시험이 Core readiness의 실제 경로 대신 Web 경로를 호출 | 1 / 1 | /internal/health/ready로 시험 경로 수정. 구현/기대 status는 유지, 신규 HTTP 포함 DB7개 PASS |
| R22 | macOS sandbox가 Chromium MachPort 생성을 거부 | 1 / 1 | 정식 require_escalated 실행으로 브라우저 구동·입력/복구/역할/CSRF assertion 실행 확인. 환경 권한 문제이며 제품 수정 없음 |
| R23 | 새 브라우저 fixture가 기존 GTM loader까지 원문 fetch로 집계 | 1 / 1 | 기존 core/collection 브라우저 시험과 같은 정확한 GTM script URL만 로컬 응답 대역으로 처리. 원문·기타 외부 요청0 assertion 유지, 실제 브라우저 시험 PASS. GTM/GA4 제품 설정은 변경하지 않음 |

R17 분리 근거: R01의 batch_item INSERT는 현재도 수정 상태이며, 새로 작성한 web_collection_request INSERT가 별도로 결함을 가진다. 같은 PostgreSQL 오류 코드만으로 두 독립 SQL 결함을 합산하지 않는다. R17 안에서 인자 번호만 달라진 파생 오류는 같은 문제로 계산한다. 직전 R01 합산 표기는 이 기준으로 정정한다.

- R24: 새 API V010 deferred trigger의 `old` SQL 별칭이 PL/pgSQL 예약 변수 OLD와 충돌(42702). 별칭을 prior로 변경, 수정1회/재검증 대기. 기존 R17 SQL bind 타입과 독립 원인.
- R25: 새 retry fixture가 FAILED item의 run을 RUNNING으로 남겨 같은 source의 다음 run을 막음. 실제 실패 종료 전이와 시험 순서를 맞춰 마지막 만료 실행 뒤 새 run을 만들지 않도록 수정1회/재검증 대기. 실행 소유권/unique/retention trigger는 유지.
- R24·R25 첫 재검증: SQL 이름 충돌과 run unique 충돌은 해소. 원래 기한을 넘긴 commit 거부 시험 PASS(수정1회/cycle1 각각).
- R26: retry fixture 출처의 enabled 기본값(false)을 누락해 정상 재시도도 SOURCE_DISABLED409로 거부. 제품 default-off와409 거부는 유지하고 합성 출처만 명시 enabled=true. 별도 정책 fixture 문제 수정1회/재검증 대기.
- R26 재검증: 정상 retry·새 UUID/version0·이전 요청 연결·멱등 replay·버전/영구중복 거부 PASS. 수정1회/cycle1로 해결.
- R27: 대기열 만료 시험이 RUNNING run을 그대로 두고 RUNNING→QUEUED를 시도해 선행 결과 전이 검사(BATCH_QUEUE_NOT_FAILED)에 걸림. 별도 QUEUED fixture의 정상 claim 전이로 만료 fence를 검증하도록 수정1회/재검증 대기. 기존 실행중 run의 원문 접근 거부 assertion은 유지.
- R14 재발: test block 이동 후 실제 행에 두 문장이 합쳐져 patch 문맥이 맞지 않아 쓰기 전 거부. 실제 전체 행을 읽고 patch 적용, 두 번째 수정으로 해결(2/2). 제품 시험 수정 횟수와 구분.
- R27 재검증: 대기 QUEUED의 claim·실행 중 run 원문 접근 거부, cleanup EXPIRED와 URL 제거 PASS. 수정1회/cycle1로 해결. retry4·expiry1·기존mailbox8 모두 PASS.
- R28: 새 만료 후 사본 링크 ref를 string으로 선언했으나 기존 postId 계약은 number. 계약의 number|null로 수정1회, Web 타입 재검증 대기.
- R28 재검증: Web typecheck/lint/build PASS. number 계약 유지, 수정1회/cycle1로 해결.
- R29: 새 오류 후 초점 복구가 busy=true인 동안 실행되어 disabled input.focus()가 무시됨. finally에서 busy 해제 후 nextTick 뒤 focus하도록 수정1회, 실제 브라우저 재검증 대기. 기한/410 화면 시험은 별도로 PASS.
- R30: SQL 개수 측정 fixture의 logger 메서드를 this 바인딩 없이 보관하여 unbound-method lint 실패. 원래 logger에 bind하여 복구하도록 수정1회, 재검증 대기. 실제 DB 쿼리 수1/20건=5회 결과는 유지.
- R29·R30 재검증: 실제 입력/인증복구 browser PASS, API lint 및 scripts 타입/lint PASS. 각각 수정1회/cycle1로 해결.
- R31: 문서 갱신 사전 검사의 planned 표시 개수 가정(4개)이 별도 BatchRetention schema를 빠뜨려 assert에서 쓰기 전에 종료. operation4개와 검증된 retention 응답schema1개를 구분하여 implemented-local로 반영. 수정1회/계약 재생성 검증 대기.

- R31 재검증: 계약 재생성 및 API build/build:test/lint PASS. 수정1회/cycle1로 해결.
- R32: 내용이 없는 Update hunk를 patch 도구에 전달해 쓰기 전 거부됨. 실제 문장 치환으로 문서의 CTE 설명을 수정했고 diff check PASS. 도구 입력 문제 수정1회/cycle1, 제품 검사 실패와 별도다.

- R33: 21개 parser 공통 fixture의 실행 interval을10000으로 맞췄으나 begin mock은0을 기대해 run/item이 연결되지 않음. mock 입력을 실제 interval과 일치시킴. 수정1회/재검증 대기. 21개 실패는 같은 fixture 원인이므로 하나의 문제다.
- R34: media budget fixture가 SourceRegistry.Source를 직접 생성해 새 필수 일일 한도 설정이 누락됨. 합성 설정 helper를 사용해 명시적 한도를 제공. 수정1회/재검증 대기. R33의 mock 인자와 독립 원인이다.

- R33·R34 재검증: 관련42 tests PASS, 실패/skip0. 각각 수정1회/cycle1로 해결.

- R35: 새 공통 gate를 queue run 생성 전에 검사해 정책 거부가 run 결과에 남지 않고 settle에서 BATCH_OWNER_LOST로 바뀜. write 실행은 run/attach 이후 gate를 검사해 기존 BLOCKED 결과 계약을 유지하고, dry-run은 저장 전 검사한다. 수정1회/재검증 대기. fixture 문제와 별도인 제품 실행 순서 결함이다.

- R35 재검증: queue 정책 변경 거부를 포함한 targeted15 tests PASS(실제 HTTP/PG 포함). 수정1회/cycle1로 해결.
- R36: 복원 후 수집 gate를 의도적으로 닫는 새 계약을 추가했으나 선택 복원 시험은 gate 변경 뒤에도 snapshot의 모든 fingerprint가 그대로라고 기대함. 전체 복원 무결성 비교는 유지하고, 명시된 gate 전이만 정확한 row/기한 검증으로 별도 대조하도록 수정 예정. 제품 복원 전 hash 검사는 유지한다.
- R37: 새 browser share 대역이 await 없는 async 함수라 lint 실패. Promise.resolve/reject를 반환하도록 바꿔 비동기 성공/취소/실패 계약 유지. 수정1회/재검증 대기. 실제 browser7 tests는 통과했다.

- R36 수정1회: collector.restore_gate의 새 계약에 따른 singleton=true/reconcile_required=true/다음KST정각을 SQL로 고정 생성한 기대 fingerprint와 대조한다. 나머지 전체 table/ledger/hash 비교를 유지하며 복원 후 quota발급 거부·보존 count1을 추가한다. 재검증 대기.

- R36 재검증: 실제 PG18/age 선택 복원과 full 대체 시험 PASS(보존53/제외17, quota1·restore gate 거부). 수정1회/cycle1로 해결.
- R37 재검증: tests lint PASS. 수정1회/cycle1로 해결. 서로 독립인 R36/R37을 합산하지 않는다.

- R38: UX05 새 browser fixture가 Storage prototype 메서드를 바인딩 없이 보관해 lint2개 실패. 동일 fixture 원인1개로 묶어 해당 context의 localStorage에 bind했다. 수정1회/재검증 대기. 기존 logger R30과 별개 위치의 새 결함이다.

- R38 재검증: tests lint 및 실제 동의 browser8 tests PASS. 수정1회/cycle1로 해결.
- R39: API build와 해당 dist를 읽는 build:test를 병렬 실행해 삭제/재생성 사이에 타입 모듈 누락. source 실패가 아닌 실행 순서 오류다. build 완료 뒤 build:test를 순차 재실행해 PASS. 수정1회/cycle1로 해결하며 이후 두 명령은 순차 실행한다.
- R40: 새 offline ACCEPTED receipt fixture INSERT의 state 인자가 varchar/text로 이중 추론됨. 이 SQL의 각 인자에 타입을 명시했다. 수정1회/재검증 대기. 기존 web_request INSERT R17은 수정 상태를 유지하며 다른 신규 SQL이다.

- R40 재검증: 실제 DB 만료1·재시도5 tests PASS, API lint PASS. 수정1회/cycle1로 해결.

- R41: 계약 재생성 후 evolution manifest에 D01/D02 계약 hash와 신규8개 migration 등록이 빠져 공통34 tests 중1개 실패. 불변 baseline/기존 SQL hash는 유지하고 승인 정본의 계약 변화 이유·신규 파일 hash만 evolution에 등록. 수정1회/재검증 대기.
- R42: additive API009/010 적용 뒤 legacy Spring readiness가 max ledger007/008만 허용해 기존 원문 통합 시험이503. 기존 feature OFF는 유지하고 명시적 호환 버전009/010을 추가했다. 수정1회/재검증 대기. 같은 readiness 때문에 파생된3개 assertion 실패는 한 문제다.

- R39 재발: API build가 dist를 재생성하는 동안 npm test의 sitemap 시험이 같은 dist를 읽어 모듈 누락. R41 계약 hash 문제와 다른 원인이며 R39의 재발로 합산한다. 모든 dist 소비 검사는 API build 종료 뒤에만 실행하도록 순서를 고정. 두 번째 수정/재검증 대기, 상한2회를 추가 초기화하지 않는다.

- R39 재검증: 순차 build/build:test 뒤 공통34 tests·실제 content3 tests PASS. 수정2회/cycle2로 해결. dist 소비자 실행 중 rebuild를 금지한다.
- R41·R42 재검증: evolution 반영 후 공통34 tests 및 readiness 수정 후 기존 원문3 tests PASS. 각각 수정1회/cycle1로 해결.
- R43: 기존 discovery/migrations 시험이 모든 최신 migration을 설치하면서 V008 되돌리기를 기대했다. 신규 V009/010은 정본에 따라 파괴적 rollback을 거부하므로, 기존 불변001–008 rollback 시험을 해당 정확한 historical schema에서 유지하고 신규009/010 거부·ledger 보존 시험을 추가한다. readiness 구현 R42와 독립인 시험 환경 구성 문제다. 수정1회/재검증 대기.

- R43 재검증: discovery5·migration2 tests PASS. 기존001–008 되돌리기/자료 보호를 유지하고009/010의 명시적 거부·ledger 불변 추가. 수정1회/cycle1로 해결.

- R44: D01-T6 새 MIME canary fixture에 이미지 row를 추가했지만 body_blocks의 IMAGE 참조를 누락해 기존 BATCH_MEDIA_INCOMPLETE guard가 거부했다. 원래 guard/assertion은 유지하고 position2 참조를 본문에 추가한다. 수정1회/재검증 대기. 다른 SQL 타입·migration 버전 문제와 별도 원인이다.

- R44 재검증: 확대 worker8·경계/경합7 tests PASS. MIME snapshot/receipt canary·timeout·JVM 강제 종료/새 worker 회수·원문0/사본 보호를 확인했다. 수정1회/cycle1로 해결.
- R45: API009/010의 새3개 테이블23컬럼 Entity metadata 누락을 전체 catalog 대조가 검출했다(250/273). 신규 metadata·명시적2개 관계를 추가하고 새 정확한23table/19FK 기대값과 PostgreSQL CASCADE 표기를 반영한다. 전후 catalog 불변·전체컬럼/FK 일치 assertion 유지. 수정1회/재검증 대기.
- R46: 새 취소 시험이 JDBC boolean getString 결과를 true로 가정했다. DB 참값·원문NULL 조건은 유지하고 SQL ::text로 명시해 문자열 비교한다. 제품 취소/권한/동시성 결함과 별도 시험 표현 문제. 수정1회/재검증 대기.

- R45 재검증: 전체 실DB API30 files/130 tests PASS, 정확한23table/273column/19FK·전후 catalog 동일·모든 relation 실제 SQL 확인. 수정1회/cycle1로 해결.
- R46 재검증: Collector 전체80suites/289tests PASS, 실패/skip0. 취소/확인 동시성·권한·원문 제거 포함. 수정1회/cycle1로 해결.
- R47: 새 복원 후 실제 API 중복 접수 fixture의 source가 기본 false여서 SOURCE_DISABLED로 거부됐다. 복원 검증 전용 합성 source INSERT에 enabled=true를 명시하고 실제 guard는 유지한다. R26의 retry fixture와 다른 신규 복원 fixture이며 R26 수정은 유지됐다. 수정1회/재검증 대기.

- R47 재검증: 실제 PG18/age 복원 뒤 실제 API DirectRequestService의 동일URL 접수 DUPLICATE·원문URL NULL·queue/item/receipt0 PASS.53보존/17제외, 과거008/006→010/010 및 원래expiry/옛ledger 보존도 PASS. 수정1회/cycle1로 해결.
- 최종 판정: R01~R48 모두 해소. 같은 원인 최대 수정2회(R06/R14/R17/R39), 독립 문제는 각각1회부터 계산했으며 합산 중단/예산 초기화 없음.

- R48: 최종 임시 placeholder 검사기가 수정된 행의 삭제 부분만 보고 유지된 `(미정)`까지 제거로 오탐했다. 실제 diff의 새 행에 동일 문구가 보존됨을 확인했다. 파일별 이전/현재의 정확한 placeholder token을 비교하도록 검사기를 수정한다. 제품/문서의 gate는 변경하지 않으며 검사범위를 줄이지 않는다. 수정1회/재검증 대기.

- R48 재검증: 변경된 정본 파일별 placeholder token 보존 PASS·실제 삭제0. 문서 자체 변경 없이 수정1회/cycle1로 해결. 최종 링크검사는 본 task Markdown30개/상대669개/anchor233개 오류0이다.
