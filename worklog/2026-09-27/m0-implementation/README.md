# M0 로컬 구현·검증 실행

- 담당: Codex / 본 구현 goal. 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/m0-design-completion`, 기준 HEAD `71ed8efe0d1cfb8ea22ed16f6464043c4aa1d81b`, release 기준 `bb19c486`.
- 상태: 종료 — 로컬 구현·검증·운영 인계 완료. 시작: 2026-09-27 00:04 KST, 종료: 2026-09-27 10:17 KST. 담당은 동일하다. 서로 다른 문제의 cycle은 개별 계산했고 모든 미해결 문제를 해소했다. [완료 감사](COMPLETION-AUDIT.md)와 [문제별 기록](RETRY-LEDGER.md)을 따른다.
- 요청: [구현 프롬프트](../../2026-09-26/m0-implementation-plan/IMPLEMENTATION-GOAL-PROMPT.md)·[task list](../../2026-09-26/m0-implementation-plan/IMPLEMENTATION-TASKS.md)의 로컬 구현·검증·운영 인계 전체. [직전 준비 기록](../m0-implementation-plan/README.md)의 반복 제한도 적용한다.
- 기존 변경: untracked `worklog/2026-09-27/m0-implementation-plan/README.md` 1개를 보존한다. 다른 진행 담당의 기록·겹치는 source 변경은 관측되지 않았다.
- 변경 범위: 관련 `apps/api`, `apps/web`, `apps/collector`, `packages/contracts`, `tests`, `scripts`, `deploy` 도구·역할 설정, 해당 docs와 이 작업 폴더. 기존 적용 migration은 수정하지 않는다.
- 금지: branch/worktree 생성·전환, stage/commit/push/merge/배포, 운영 장비·계정·비밀 접근, 실제 사이트 fetch·Drive/R2/Discord 전송/변경, 다른 담당 자원 변경.

## 시작 전 완료 조건·검증 단위

아래 표는 산출물·검증 범위이며 반복 횟수의 합산 단위가 아니다. 같은 원인 수정 최대2회와 테스트→수정→재테스트 최대3 cycle은 각각의 문제에 적용한다. 서로 다른 원인은 별도로 계산하고, 같은 원인의 파생 오류나 파일/명령 변경으로 횟수를 초기화하지 않는다. 정상 실행 대기와 읽기 전용 탐색은 실패 수정 cycle이 아니다. 무진전2회 또는 해당 문제의 반복 예산 소진 시 중단·보고하고 goal 상태는 도구 규칙에 따른다.

| 검증 단위 | task·산출물 | 필요한 완료 증거 | 최초 상태 |
| --- | --- | --- | --- |
| D04 | OPS-01/02/04 role registry·BFF·Core guard·서비스 역할 | D04-T1~T6의 로컬 허용/거부·위조/회수·secret 비노출·실DB 권한 | 대기 |
| D01 | COL-04 additive 모델·기한/최소 키·회수 worker·사본/복원 | D01-T1~T7 실DB/객체·경계/경합/부분 실패/readback | 대기 |
| D03 | OPS-03 선택 backup·Drive adapter·만료/복원·전환 검증 도구 | D03-T1~T6 로컬분기·age·실PostgreSQL 독립 복원 | 대기 |
| D02 | CON-02 mailbox/runtime·API/BFF/UI·SQL 예외/쿼리 수·계약 | D02-T1~T6·API 무fetch·동일queue0·브라우저·실행 사본 일치 | 대기 |
| COL-01/02 | direct robots/delay/budget/redirect 공통 통제 | 합성 HTTP 무요청·0/3/4redirect·재시작/날짜/누적 budget | 대기 |
| UX-01 | 정책 버전 스크롤/초점 | 실제 긴 본문·키보드/좁은 화면 | 대기 |
| UX-02 | SSR social meta | 이미지/없음/alt/크기 HTML 확인 | 대기 |
| UX-03 | 목록 페이지 초점 | 실제 키보드/접근성 트리 | 대기 |
| UX-04 | 하단 retry·공유 상태 | 오류/재시도·공유 성공/취소/미지원 화면 | 대기 |
| UX-05 | storage/cookie 예외 안내 | 실패 주입·추적 비활성·화면 | 대기 |
| UX-06 | 청록 정렬 | 토큰·대표 해상도 비교 | 대기 |
| 통합·인계 | COL-03 도구/fixture·OPS 실제 인수·CON-01 보류·상태/문서 | 관련 lint/type/build/unit/DB/Collector/browser/Docker, §8 전체 감사·운영 입력/7일 관찰표 | 대기 |

각 검사의 실패 원인·수정 횟수·cycle과 실제 결과를 이 폴더에 기록한다. 기존17개 task의 코드/로컬검증/실제인수 상태를 분리하며 실제 출처·계정·장비·운영7일은 미실행 인계로 남긴다.

## 환경·자원 기준

- Node24.18.0·Java25.0.2 확인. Java는 `/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home`를 사용한다. age·브라우저는 별도 확인 중이다.
- 기존 `blariyo-m0-core-local-postgresql-1`(5439)와 `dogdrip-postgres`(5433)는 타 용도 자원으로 보존한다.
- 이번 goal용 PostgreSQL18 `blariyo-m0-implementation-pg-20260927`을 loopback55449에 생성하고 readiness를 확인했다. label `blariyo.task=m0-implementation-20260927`. 합성 시험마다 무작위 DB를 생성·정리하며 기존 두 컨테이너는 변경하지 않는다.

## 진전과 시도

1. 지정 두 파일 전체·루트 지침·정본 상태/인계를 확인했다. 현재 AdminGuard는 token/actor만 확인하며 문서 신규4개 API와 실행 사본이 다르다. 제품 테스트 실행 전 known gap으로 기록한다. 경로 탐색에서 없는 `core.ts`·`tests/docker`를 확인했으며 실제 경로를 사용한다.
2. D04 registry에 명시적 OWNER/EDITOR·중복 operatorId 거부, BFF 내부 role 생성, Core operation allowlist를 추가했다. 누락/잘못된 role은 거부하고 local fixture는 명시적 OWNER를 주입한다. JWT 검증·active 회수·actor HMAC 경계를 유지했다.
3. D04 초기 검증: API `build`, `build:test` exit0; `tests/auth-contract.test.ts` 3 PASS; `admin-permissions.service.test.js` 2 PASS; 임시 DB의 `admin-roles.integration.test.js` 1 PASS와 `http-boundaries.integration.test.js` 4 PASS. 실패·skip 0, 수정 cycle 0. 실제 BFF 브라우저·서비스 역할·통합 검증은 남아 있으므로 D04 전체 완료는 아니다.
4. D01에 API V009·Collector V007 additive SQL과 실제 DB 경계 시험을 추가했다. 최초 실행은 고정 UTC/KST 경계1개 PASS, fixture INSERT의 동일 `$1` uuid/text 타입 추론 충돌(`42P08`)로3개 실패, 종료 callback 순서로 cleanup1개 실패였다. 제품 기대값/기존 trigger는 변경하지 않았다. D01 cycle1: fixture UUID cast를 명시하고 connection→DataSource 순서로 정리를 합쳤다. 각 원인 수정1회, 재검사 대기.
5. cycle1 재검사 `batch-retention.integration.test.js`: 5 PASS/0 FAIL/0 skip. 실제 기존 Collector V002~V006 소유권 trigger를 포함해 API V009/Collector V007을 적용하고 27일째 승인→34일, 재검수 불변, 정각 거부, 원래 기한을 넘긴 commit rollback, 최소 hash 열·교차 출처 충돌을 확인했다.
6. API 원문 읽기/멱등 재조회 guard·미리보기 deadline·목록 일괄 조회와 Collector 매 PUT fence를 연결 중이다. 계약 문서의 실행 사본을 맞추고 생성기를 실행했다(exit0). 생성된 D02 신규4개 route는 아직 구현 전이며 생성 성공을 해당 API 구현 완료로 해석하지 않는다. 전체 D01 회수·사본·복원 검증과 D02 route 구현은 남아 있다.
7. D01 기존 batch review 통합 시험 첫 실행:15 FAIL. 목록/승인 응답 `BATCH_CONTENT_INVALID`가 후속 승격 시험까지 연쇄 실패시켰다. 확인 원인: API가 보존4개 필드를 최상위에 만들었으나 현행 OpenAPI는 필수 `retention` 객체를 요구한다. cycle2(이 원인 수정1회): 계약을 유지하고 DTO를 `retention` 안에 맞췄다. 수정 후 같은 시험 재실행 예정. D01 누적 수정 cycle2/3이며 초기 fixture 원인과 별개다.
8. cycle2 재검사 `batch-review.integration.test.js`:15 PASS/0 FAIL/0 skip, API 재빌드 exit0. 긴 본문·49이미지·257프레임·첨부·중복·부분 실패/승격 보상·멱등·목록 필터를 유지했다. 새 삭제 worker와 만료 HTTP/원문 부재 시험을 추가하기 전 단계다.
9. staging outbox 사전 기록·원문 기한·게시글 연결 후 사본 보호를 추가한 뒤 API build/build:test exit0, batch review17 PASS와 retention5 PASS/0 skip. 이 검사는 객체 DELETE worker 전체 검증을 대신하지 않는다.
10. Collector V008에 비공개 transaction/행별 삭제 권한, backup gate, lease/heartbeat/fence, manifest·부분 실패·최종 정리 함수를 작성하고 SQL 시험을 추가했다. 테스트 빌드에서 QueryRunner.query에 지원하지 않는 generic 인자를 넣어 TS2558/TS2339/TS7053이 발생했다. 뒤의 통합 runner는 생성물이 없어 ENOENT로 실행되지 못했다(동일 빌드 실패의 후속 결과). D01 cycle3: 기존 `rows()` 결과 검증 함수를 사용하도록 수정1회. assertion·검사 범위를 줄이지 않았다. 재빌드·같은 통합 시험 대기. 누적 cycle3/3, 각 확인 원인의 수정은1회씩이다.
11. cycle3 재검사: build:test exit0, `batch-retention.integration.test.js` 6 PASS/0 FAIL/0 skip. backup gate 거부·실패 manifest 유지·오래된 lease 거부·제한 경로·DB 원문 및 검수 제거·영구 dedup 유지 검사를 포함한다. 아직 외부 객체 삭제 worker 자체의 시험은 아니다. 실패는 해결됐으므로 잔여 구현은 이어가되 D01 추가 실패의 자동 수정 예산은0회이며, 실패가 발생하면 추가 수정 없이 Hard Stop한다.
12. 후속 필수 검사: API lint61 error/0 warning로 실패. D01 수정 cycle3/3을 사용한 상태이므로 추가 수정·새 구현·다른 task 확대를 중단했다. 같은 묶음에서 Web typecheck와 Collector Java25 compileJava는 exit0였다. Collector 실행에는 과거 Java 설치 탐색 경고와 FSEvents 경고가 있었으나 컴파일은 성공했다.
13. 원인 확인을 위한 쓰기 없는 TypeScript 진단에서 생성 `collection-api.d.ts`의2051/2106/2159/2203행에 TS2339를 확인했다. canonical OpenAPI의410 응답 deep ref가 생성 타입의 존재하지 않는 `schema` 멤버를 참조했다. 이외 새 D04 테스트2개의 미대기 Promise와 D01 migration fixture의 unsafe return을 확인했다. generator·검사·assertion은 수정하거나 완화하지 않았다.
14. 이 goal의 임시 PostgreSQL에 무작위 시험 DB가 남지 않았음을 조회했다. 소유 label 확인 후 `blariyo-m0-implementation-pg-20260927`과 해당 익명 볼륨만 제거했다. 기존 두 컨테이너는 실행 상태를 유지한다. HEAD·브랜치와 선행 untracked 준비 기록을 보존했으며 stage/commit/push/merge/배포는 하지 않았다. 파일별 중단 기준은 [FILES.sha256](FILES.sha256)에 남긴다.
15. 00:36 KST 사용자 정정: 서로 다른 문제는 cycle을 따로 계산한다. 위 4~12번의 D01 누적 cycle/한도 소진 해석과 중단 보고의 추가 한도 승인 요구를 철회한다. UUID cast, cleanup 순서, DTO 중첩, QueryRunner 타입은 각각 수정1회로 해결됐다. 현재 lint의 미대기 Promise·unsafe return·OpenAPI deep ref는 별도 원인이며 각 첫 수정부터 진행한다. 원인별 기록은 RETRY-LEDGER.md에서 유지한다. FILES.sha256은 00:31 중단 당시 스냅샷이며 이후 변경의 최신 해시가 아니다.

16. 문제별 첫 수정 R05~R07: test Promise await, SQL fixture 반환 없는 callback, OpenAPI410 response 참조를 수정했다. 양쪽 계약 재생성·API build/build:test/lint exit0. 기존 보존 DB6·검수/승격17 PASS. 서로 다른 원인의 횟수를 합산하지 않았다.
17. D01 실제 회수 worker와 collect 전용 객체 DELETE/HEAD/페이지 inventory,120초 lease·30초 heartbeat·실패 manifest·늦은 PUT 재회수·완료 ledger7일 정리를 추가했다. 전용 login provisioning/명시 함수 권한 초안을 추가했으며 운영 설치는 하지 않았다. Java25 compileJava/testClasses/fixtureClasspath와 API build:test/lint exit0. 실제 Java worker+격리PG+local object 시험5 PASS(직접 DB 접근 거부/backup gate/403 실패/새 JVM 재시도/late PUT), 기존 보존 DB6 PASS. 전체 D01 완료는 아니며 queue/confirmation/run payload TTL·복원·교차 권한 전체와 timer/알림 인계가 남아 있다.
18. queue terminal URL 제거/24시간 만료, confirmation 즉시 원문·actor/channel 제거와24시간 최소 영수증, report/media/부수 payload의 PUT 및 commit fence를 연결했다. 격리 Collector 전체 회귀:77 suites/273 tests, failures0/errors0/skipped0, readbackTests15,2분32초. 시험 중 뒤이어 추가한 no-item run 정리·S3 object 보강·retention CLI/timer 초안은 이 통과 범위에 포함하지 않는다. worker5와 DB6도 단계별 재검증했다. 실제 timer 설치·서비스 자격증명·Discord 실수신은 하지 않았다.
19. 추가 S3/local 객체 시험4 PASS. 확장 worker7 PASS: 기존 row의24시간 queue/10분 confirmation과 no-item run28일 payload 제거, quiesced restore orphan 회수, 완료 ledger/최종 run shell7일 정리 포함. fixture report의 필수 hash/행 수 누락(R09)과 run 없는 orphan의 NULL 권한 행(R10)은 각각 첫 수정으로 해결했다.
20. 실제 provisioning/ACL·CLI 시험:5개 전용 역할의 SCRAM 접속·교차 권한·dry-run/backup gate·원문 삭제 후 게시글 사본 hash 유지 PASS. backup 역할 dump와 새 PostgreSQL DB 복원에서68개 table/16개 sequence 일치. 선택 dump/age/Drive 수용 검증을 대체하지 않는다. scripts/tests typecheck와 lint 및 diff check PASS. 이후 restore 전용 exclusive/shared 잠금과 queue backlog 선차단을 추가했으므로 그 변경은 다음 검증 대상이다.
21. restore exclusive/shared fence와 queue backlog 선차단 후 Java compile/fixtureClasspath·API build:test/lint exit0, 실제 worker7·5역할 provisioning/권한/CLI/68table·16sequence 복원을 재검증해 모두 통과했다. 실행 경로·전용 계정·backup gate·복원 절차를 deploy/operations/collect-retention.md에 연결했다. timer 설치/활성화·실제R2/Discord·선택 backup/age는 아직 미완료다.
22. D03 착수: 현행 full-dump/R2 스크립트와 정본 제외 목록을 대조했다. age/Go 실행 파일은 현재 PATH에 없다. 공식 age 릴리스에서 v1.3.2 darwin-arm64 archive와 SHA-256 e2020b073c44f692685a24d6abc378817eb81ffaaf49fd0531ef8565f767f2f5를 확인했다(2026-09-27). 격리 시험용 바이너리를 /private/tmp의 작업 전용 경로에 준비하며 시스템/운영 설치는 하지 않는다. 공식 출처: https://github.com/FiloSottile/age/releases/tag/v1.3.2 . Drive resumable 사양 재확인: https://developers.google.com/workspace/drive/api/guides/manage-uploads .
23. 선택 backup profile·pg_export_snapshot·pg_dump→age 스트리밍 구현과 실제 age1.3.2/PG18 독립 복원 시험 통과. 보존52개/제외13개 table, 제외 원문0, 게시글·dedup·최소 연결과 migration ledger 일치. 미분류 collect table 사전 거부와 pg_dump 실패 시 spool 회수도 확인했다. Drive adapter·기존 runner 연결·독립 TTL·알림·운영 전환은 아직 진행 전이다.
24. D03 Drive OAuth/Shared Drive 인증·고정ID/부모/identity·8MiB 재개·실다운로드 hash·manifest 마지막 업로드, R2 선택 profile·독립 만료·같은 암호문 fallback과 Discord incident/retry를 구현했다. 합성16개 시험과 Python runner/설치 gate3개 시험 PASS. loopback 실제 HTTP socket 단절→offset 조회→재개·독립 다운로드도 포함한다. R13 network 이름 검증은 첫 수정으로 해결했다. 실제 계정·외부 전송은 없음.
25. 전용 backup Docker image를 로컬 build하고 network none·readonly·비root로 Node24.18.0/PG18/age1.3.2 실행 확인 PASS. 최초 buildx cache 경로 쓰기는 sandbox가 거부해 정식 escalation 후 빌드했다. age Linux release hash는 공식 GitHub release API로 확인해 Docker ADD checksum에 고정했다. 이 이미지 스냅샷은 뒤에 추가한 offline recovery/legacy replacement 변경 전이며 최종 image 재빌드가 남아 있다.
26. 실제 PG18/age 복원 시험을 실행 도구로 전환하고 빈 격리 DB guard·fingerprint/ledger·제외13개 원문0·복원 후 gate닫힘을 확인했다. 과거 full dump를 별도 DB에 복원→선택 재dump/age→합성 R2 독립 다운로드→두 번째 PG 복원까지 PASS. 원래2일 전 snapshot의7일 기한 유지·원본 제거 전 검증 순서를 확인했다. production R2/Drive 인수는 아니다.
27. 공통 lock의 runner·독립 expiry/alert timer·사전 image/기존hash/R2복원 gate installer와 사용자 환경 offline recovery/full replacement CLI·runbook을 작성했다. 서버 설치/활성화는 실행하지 않았다. D03의 CLI 통합·마지막 코드 검증/문서 정합성과 D01 운영 알림·디스크 inventory 인계, D02/COL 통제·UX·전체 통합 검증은 계속 남아 있다.
28. backup 후속 source의 Node 문법·Python AST·diff check PASS. package.json의 test:backup으로 실제집계 연결, 최종17 Node/3 Python PASS. 이 집계에는 원문 회수 wrapper의 실제 child 실행·알림 실패 분리·stderr 비밀 비노출이 포함된다. 새 image build/runtime check도 PASS(실서비스 연결 없음). 회수 service는 전용0700 StateDirectory와 Node wrapper로 경보를 연결하고 timeout을 child/알림보다 길게 지정했다. D02 mailbox/API/UI와 COL 통제·UX·전체 통합 검증으로 이어간다.
29. D02 착수: source/runtime/receipt·메일함 정본을 대조하고 API의 순수 URL 정규화와 Java 공통 golden34개(21 parser)를 추가했다. API build/lint·Java fixtureClasspath·Java/API34개 대조 PASS, 외부 요청0. 기존 parser 동작을 유지했으며 보류된 출처의 재분석/활성화는 하지 않았다. API V010 mailbox와 Collector V009 receipt/runtime SQL을 작성하고 migration 목록에 연결 중이다. 이 새 DB schema는 아직 검증 전이며 앞의 backup/DB PASS는 V010/Collector V009 이전 기준이다.
30. API V010/Collector V009 격리 PostgreSQL 적용과 D02 DB5개 PASS: TypeScript/SQL UTF-8 hash 일치, SKIP LOCKED·rollback·잘못된 lease 거부, queue/receipt/ack 원자 처리·terminal URL 제거·version 증가, runtime ABSENT/CURRENT/CONFLICT 및 미허용 필드 거부. 현재 신규4개 API/Java pull·heartbeat/UI는 구현 중이다. Node20 실행 경로 오류 R16은 Node24 명시로, 새 mailbox fixture SQL 타입 충돌 R17은 두 번째 수정으로 해소했다. 같은 오류 코드의 독립 결함과 같은 SQL의 파생 오류를 구분했다.
31. Java 실제 설정 publisher·30초 heartbeat·최대20개 mailbox pull/queue/receipt/ack와 전용 feature flag를 연결했다. 새 JVM 재실행 queue 중복0·API/Batch 교차 접근 거부·설정 비밀 필드 제외를 격리 DB 제한 계정으로 확인했다. 신규4개 Core route와 BFF 별도 direct flag·명시 alias·CSRF/역할 전달·원래 URL 문자열 보존을 구현했다. DB/Java/실제 Core HTTP7개 PASS, API build/build:test/lint·Web typecheck/lint PASS. 신규 화면과 BFF의 실제 브라우저 시험은 준비 중이며 전체 D02 완료는 아니다. 일일 요청 한도 값이 없는 실제 설정은 활성으로 표시하지 않으며, 기존 예제 출처 파일은 수정하지 않았다.
32. 새 입력/상태/설정 조회 화면, direct만 활성인 화면 경계, 410 시 기존 원문 표시 폐기를 추가했다. Web build·tests typecheck/lint PASS. Chromium 최초 실행은 macOS sandbox가 거부해 require_escalated 승인 절차로 실행했다. 실제 390px 브라우저1개 PASS: EDITOR, 명시적443 거부, 응답 유실/같은 멱등키 재전송/접수1·queue0, 키보드 초점, reload/poll, 별도 BFF alias, 외부 role/service header 제거, CSRF 거부. 기존 GTM script는 정확한 URL의 로컬 대역으로 처리했고 실제 외부 전송0이다. [화면 캡처](artifacts/direct-input-390.png)를 직접 열어 가로 넘침·문구/상태를 확인했다. D02의 60초 lease·24시간/원문 만료·정상 수동 retry 및320/1280px·poll 중단/410 전체 인수와 최종 백업 재검증은 남아 있다.

33. 실제60초 lease 만료 뒤 late ack 거부·새 owner1회 인수, 복원 data-before-trigger 순서의24시간 요청/queue 만료·5분 heartbeat STALE 시험을 추가했다. 새 retry는 이전 FAILED item의 기한을 commit·batch 인수·queue claim·실제 fetch 직전에 재검사하며 기존 원문 기한을 초기화하지 않는다. API/Java build와 retry4·expiry1·mailbox8 DB 시험 PASS, 실패/skip0. R24~R27의 독립 원인은 문제별 기록대로 해소했다.
34. 새 API V010/Collector V009를 포함한 Collector 전체 회귀78 suites/277 tests, 실패0/skip0(2분39초). 실제 PG18→age→독립 복원·과거 full 사본 재암호화/원래기한 유지 재검증 PASS: 보존52개/제외17개 table, mailbox/alias/receipt/runtime canary도 복원0. 실제 Drive/R2 인수는 아니다.
35. CON-02 검수 목록1건/20건 실제 HTTP·SQL 관측: 각각5개 statement, 데이터 SELECT1개, 쓰기0. 기존 검수/사본·만료 포함18 tests PASS. 일반 legacy discoveryAllowed는 Entity 조회로 변경했으며 재활성화하지 않았다. SQL 예외 정본과 API/Web default-off 설정 후보를 갱신했다. 후보 설정 생성의 실제 격리 Node container 시험 PASS.
36. UI에 한국 시간 접수/기한/관측 시각·안전 설정 값·5초 poll·오류 초점 복구·loading/empty/error 구분을 반영했다. 실제320px의 preview410 및표시기한 종료 시 원문·이미지·원문 링크·작업 버튼 제거 시험 PASS. native img를 제거하는 방식이며 object URL은 생성하지 않는다. 입력 인증복구/초점의 확장 시험은 R29 수정 후 재검증 중이다. 전체 D02·COL 통제·UX·통합 검증·운영 인계는 여전히 잔여다.

37. 실제5개 역할의 provisioning/ACL 재검증 PASS. API V010/Collector V009, app의 mailbox 접수·batch 제한 ack·view GET·교차 권한 거부와 기존 승격/회수 사본 보호를 확인했다. backup 계정 dump의 독립 복원은72table/16sequence 전체 행·ledger 일치. 운영 역할/계정 변경 없음.
38. 확장 direct 입력 브라우저 PASS: 잘못된 URL 뒤 input 초점 복구,401 후 같은 key·URL로 재인증/접수, runtime loading/error/empty/정상 복구, 화면 이탈 뒤5초 poll 중단. 만료 preview410·정각 도달 뒤 상세/이미지/원문 링크/버튼과 목록 제목 제거도 별도 PASS. 320/1280px 캡처는 맨 위로 이동 후 다시 생성했다.
39. runtime CONFLICT503·disabled409·동시 key/재조회·GET 무쓰기 추가 시험과 retry5 PASS, 검수18 PASS(1/20건각SQL5회), 기존 collection HTTP7 PASS. API lint·scripts 타입/lint도 통과했다. 문서 OpenAPI의 신규4개operation과 retention schema를 implemented-local로 표시하고 양쪽 사본/타입을 재생성했다. source 증거에 따라 B08을 U→P로 변경해 I30/P10/U0, 운영 완료율로 쓰지 않는다. 실제 JVM의 ack 전후/commit 직후 종료와 정책 변경 거부는 추가 검증 중이다.

40. 실제 JVM의 BEFORE_ACK/AFTER_ACK/AFTER_COMMIT 중단·재시작, 변경된 출처 정책 거부를 포함한 mailbox8 시험 PASS(67.5초). commit 전 queue/receipt/ack rollback, commit 직후 재시작 중복queue0을 확인했다. 이전 step의 재검증 대기 표시는 이 결과로 해소된다.
41. COL-02 공통 요청기의 redirect0/3/4회·순환·다른host·매hop DNS 검사를 보완했다. SourceRequests7 tests PASS, 네 번째 목적지 요청0. COL-01은 새 Collector V010 aggregate budget과 DB 제한 예약 함수를 작성해 격리 시험 중이다. 아직 runner robots/budget 연결 완료로 표시하지 않는다.

42. COL-01의 batch DB quota·robots/Crawl-delay를 단건/목록/queue/probe에 공통 연결했다. 요청 한도 누락·DB/permit 불확실·robots 금지/미확인에서는 본문·미디어 요청을 거부한다. 기존 콘텐츠 lifecycle 회귀 fixture는 quota 대역을 주입해 검사 목적을 유지하고, 실제 PG quota/동시성/날짜/재시작4 tests와 공통 HTTP/42개 관련 검사를 별도로 실행했다. 새 제한 역할의 전체 pipeline·Collector 전체 회귀는 진행 중이다.
43. 문서 감사: dry-run의 기존 DB 전체 무쓰기 표현과 영속 요청 한도의 충돌을 확인해 콘텐츠/object 무저장·요청 quota 기록으로 planning→system-design→개발 명세→운영 README를 맞췄다. collector V010 최소 집계는 원문 없는 통제 metadata이므로 선택 백업 보존 목록에 포함했다. 변경Markdown19개 상대링크422개 대상 파일 존재, diff check PASS. anchor·전체 정책/운영 인수의 최종 감사는 계속 남아 있다.

44. COL 전체286 tests 중285 PASS/1 FAIL/skip0에서 queue 실패 코드 회귀 R35를 확인했다. run 생성 후 정책 검사 순서로 수정한 뒤 실제 HTTP·PG·queue targeted15 tests PASS. 현재 전체 Collector는 해당 수정 후 재실행 전이다. 실제5개 역할 시험은73 table/16 sequence 복원과 raw quota 접근 거부·quota5를 확인했다.
45. 복원 직후 direct 요청은 reconcile 및 다음 KST 정각까지 거부하도록 최소 quota 보존과 restore gate를 연결했다. PG18/age 선택 복원 및 full 사본 대체 시험 PASS: 보존53/제외17, 원문0, quota count1·gate 거부, 원래 snapshot 만료 유지. R36은 gate의 명시적 상태 전이만 별도 기대값으로 검증해 수정1회로 해소했다.
46. UX-01~04 구현: 정책 버전 전환·목록 pagination 뒤 제목 초점/상단 이동, SSR 이미지 alt/크기·없는 이미지 fallback, 하단 조회 retry/중복 방지와 공유 성공/취소/실패/미지원 안내. Web 타입/build/lint·tests 타입/lint PASS, 실제 브라우저7 tests PASS. 320px 정책/공유 캡처를 직접 확인했다. R37 test lint는 Promise 반환으로 수정1회 해결. UX-05 동의 오류/재시도·UX-06 청록 정렬은 후속 구현 중이며 아직 통과로 올리지 않는다.

47. UX-05 단위6·실제 browser8 PASS: 읽기 차단/JSON/schema, cookie 삭제 throw·무시, 철회 저장 실패·재시도, 기본 GA4 OFF. 실패 철회는 이전 허용으로 되돌리지 않는다. 감지 가능한 cookie 실패를 안내하며 JS로 볼 수 없는 쿠키까지 삭제했다고 주장하지 않는다. Web 타입/build/lint·tests 타입/lint PASS. 삭제 실패320px 캡처를 직접 확인했다.
48. UX-06 정적 탭 ::after를 --brand로 정렬하고 색상 정본의 적색 잔여를 수정했다. 공개 UX browser PASS: 앱/정적 검토물320·768·1280px 모두청록 rgb(0,161,155), 가로 넘침0, 기존 정책/공유/SSR 회귀 유지. 실제 HTML/CSS/JS를 로컬 route로 제공했으며 외부 요청0. 대표 캡처 확인 및 관련 명세·task·상태/로드맵/요구사항 갱신.
49. D02 경계 감사: batch가 꺼진 채 ACCEPTED 대기의24시간 기한을 넘기면 기존 GET이 ACCEPTED를 계속 반환했다. API 소유 기한만으로 EXPIRED projection을 계산하고 batch receipt/queue에는 쓰지 않도록 보완 중이다. RUNNING/terminal 결과는 시간으로 추정하지 않는다. 새 fixture의 SQL 타입 오류 R40 수정 후 실제 DB 재검증 예정.

50. D02 offline ACCEPTED 만료 projection을 실제 DB로 검증했다. 기한 경과 GET은 EXPIRED/version2/acceptBefore 시각을 계산하지만 receipt는 ACCEPTED 그대로다. batch cleanup 후 실제 EXPIRED/version2로 일치하며 RUNNING·SUCCEEDED는 덮어쓰지 않는다. 만료1·재시도5 PASS, API build/build:test/lint PASS. R39 빌드 순서·R40 새 fixture SQL 타입은 각각 수정1회 해결.
51. Collector 전체 회귀80 suites/287 tests PASS, failures/errors/skipped0, readback16, 3분15초. R35 이후 run/정책 거부·실제 HTTP/PG budget/restore gate를 포함한다. 뒤에 작성한 과거 schema 생성 helper는 테스트 코드만 추가했으며 별도 testClasses/선택 backup 시험으로 검증한다.
52. D04 합성 RS256/JWKS를 loopback 서버로 제공하고 실제 Web BFF를 거치는 browser1 PASS. OWNER/EDITOR 허용, 동일 JWT의 active=false 즉시403, 목록 복원 후200, 잘못된 role403, 위조 signature401을 확인했다. JWKS는 캐시돼도 운영자 registry는 매 요청 다시 읽는다. 실제 Cloudflare Access/MFA 두 계정 인수와 구분한다. tests 타입/lint PASS. 기존 적용 migration·사용자 준비 문서23개 시작 해시 일치, diff check PASS.

53. 이전 full 사본 시험을 실제 API008/Collector006 스키마로 보강했다. 불변 migration과 당시 ledger를 설치해 원문·검수·승격 연결 canary를 담은 age full snapshot을 복원하고 API010/Collector010으로 올렸다. 옛 ledger/checksum 불변, legacy 최초 검수시각 미추정, dedup/최소 연결 backfill, 선택 재dump·재다운로드·두 번째 독립 PG 복원의 원문0·게시글/dedup 유지·원래7일기한 모두 PASS. 새 fixture Java compile/testClasses 및 기존 현재schema 선택 복원53/17도 PASS. 실제 자원 전환 없음.
54. COL-03 S1~S5·OPS-01/02 사람/Access 인수·OPS-03/04 실계정/장비/Discord/복원·OPS-05 실제 Core7일·CON-01 조건부 legacy 인계를 docs/operations/m0-operation-handoff.md에 작성했다. 담당·입력·전환/되돌리기·빈 증거 양식을 제공하고 미실행 값을 채우지 않았다. 관련 task와 D04 현행 source 설명을 맞췄다. 최종 링크/계약·전체goal 감사 및 통합 검증은 계속 남아 있다.

55. 전체 실제 Chromium52 tests PASS, 실패/skip0(3분42초). 예약 실제 정각·restart·단일 owner·일시 media 실패까지 포함한다. browser 공통 fixture는 loopback/합성 route 외부 요청을 막고 GTM은 정확한 로컬 대역으로 제공한다. API/Web Docker build·signed Access·publish/hide·운영 명령·PG dump/복원·maintenance·SIGTERM/접속 해제 모두 PASS. API 통합은 기존001–008 rollback fixture 문제 R43을 보완 중이며 아직 전체PASS가 아니다.

56. 최종 감사에서 OPS-04 direct Discord 확인 전 취소 경로와 D01-T3/T4/T6의 명시적 경합·timeout/crash·MIME snapshot/receipt canary 검증 공백을 확인했다. 확인/취소 동일 잠금·actor/channel 권한·취소 즉시 URL 제거·짧은 원문 없는 식별 기록을 신규 Collector010에 추가하고 Gateway에 취소 버튼을 연결했다. 기존 적용001–006은 보존한다. 관련 실DB/전체 회귀 재검증 전이므로 해당 항목은 완료 대기다. R43 historical rollback5+2 tests PASS.

57. 최종 API 전체30 files/130 tests, 서비스35, Collector80suites/289tests(실DB readback18), 공통34, 실제 Chromium52 tests 모두PASS·실패/skip0. API의 새23table/273column/19FK metadata와 전후catalog 동일을 확인했다. API/Web 최종Docker build·signed Access·DB복원·maintenance·SIGTERM도PASS. R44~R47은 각각첫수정으로 해결했다.
58. 실제PG18→age→독립 복원은53보존/17제외·원문0·quota/restore gate·기존full008/006→010/010·옛ledger/checksum·원래기한 보존PASS. 복원된 DB에 같은URL을 실제 API service로 접수하면 DUPLICATE·URL NULL·queue/item/receipt0을 확인했다. 백업 최종image `sha256:b8c12cc4da1ec0523c40fac2a0422c8455140856ca0ed96966c1e9b320137e96`는 nonroot65532/read-only/network-none에서 Node24.18.0·pg_dump18.6·age1.3.2 PASS.
59. status/roadmap/requirements·task·운영 인계를 실제결과로 갱신했다. A01/B08의 로컬구현 근거로I32/P8/U0, 실제운영완료율은 아니다. 적용migration과기존준비기록23개 시작해시일치, Markdown32개/상대링크675개/anchor233개 오류0·diff check PASS. 마지막자원정리후목록/해시를별도파일로확정한다.
60. G03 후속확인: 다른 종료세션의 `worklog/2026-09-26/batch-structure-research/README.md`가추가된것을발견했다. 담당·쓰기범위는그기록1개이며종료10:07, HEAD동일·본작업source와겹치지않는다. 같은주제9/27기록및기존준비기록과함께변경/해시산출대상에서제외하고보존한다. 서버통합/캐시검토안은확정설계로승계하지않았다.

61. 최종 Chromium52 PASS(3분29초), 최신320px 입력 화면을 직접 열어 가로 넘침·키보드/안내 상태를 확인했다. API/Collector/backup의 필수 로컬 실패·skip·미실행은 없다. 임시 DB는 runner별 정리 후 task 전용 PG에 postgres/template0/template1만 남음을 확인했고, 그 컨테이너와 연결 anonymous volume을 제거했다. 전용 age 다운로드 폴더도 정리했다. 기존5439·5433 컨테이너와 다른 세션 문서는 보존했다. 로컬 backup image는 위 digest의 검토 산출물로 보관하며 설치/활성화하지 않았다.
62. §8의7개 조건을 모두 통과했다. [최종 검사 증거](VALIDATION.json), [최종 파일 해시](FINAL-FILES.sha256), [보호 파일 대조](PRESERVATION.json)를 남겼다. 이 완료는 로컬 구현·검증·운영 인계이며 M0 전체 운영 완료가 아니다. 실제 운영 잔여는 [인계서](../../../docs/operations/m0-operation-handoff.md)를 따른다. branch/HEAD·index는 그대로이며 stage/commit/push/merge/배포 없음.
