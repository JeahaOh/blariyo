# Nest 전환 진행 기록

## 최종 판정 — DONE_LOCAL (2026-09-09)

**NestJS + TypeORM + TypeScript strict 전환과 TASK의 필수 로컬 검증·완료 감사를 마쳤다.**
아래 중단·진행·실패 기록은 당시 이력이며, 현재 판정은 이 절을 따른다. 실제 외부 운영 공개는 미검증이다.

### 최종 변경과 실행 경로

- main의 기존 미커밋 source를 재사용·보완하여 도메인별 Module/Controller/Service와
  업무 Repository·TypeORM 구현·Adapter·Unit of Work를 연결했다. Controller/Service에 ORM/SQL을 두지 않는다.
- 기본 dev·compiled production·운영 CLI·Docker를 Nest로 통일했다. 검증 후 직접 작성한 Express 구현과
  대체된 중복 테스트·runner·generator를 정리했다. 수집 LEGACY_V1/SPRING_V2 외부 계약은 모두 유지한다.
- Core·Web·공유 계약 runtime·테스트·운영 코드의 strict/type-aware lint를 연결했다.
  17개 Entity·224개 컬럼·15개 FK와 기존 SQL·OpenAPI·생성 계약을 보존했다.
- planning/system-design/development-specs/README/docs/ai와 PLAN/DECISIONS/REPORT의 현행 설명을 맞췄다.
  법무 실값·출시 차단과 과거 worklog·실패/중단 이력은 유지한다. 기존 CI 파일은 없으며 새 배포 경로를 만들지 않았다.

### 최종 종합 검증

명령: Node 24.18.0/JDK 25 환경의 `npm run verify:migration`.
**세션 94630 exit 0, 22개 단계 모두 exit 0**, 결과 `test-results/migration-ks4zg0/results.json`.
상위 로그: `/private/tmp/blariyo-nest-migration/verify-migration-final.log`.

| 검증 | 최종 결과 |
| --- | --- |
| production build·테스트 build·strict·lint·의존성/순환 구조 | PASS |
| root 단위·구조·계약 | 14 pass |
| API 서비스 단위 | 8 pass |
| 실제 PostgreSQL API·Repository·transaction·동시성·CLI·migration·복원 | 72 pass |
| 실제 Nuxt/Chromium | 9 pass; 새 screenshot 8개 시각 확인 |
| Spring JUnit | 15 pass; Gradle 9 tasks를 --rerun-tasks로 실제 실행 |
| 실제 Spring 프로세스 | 5 pass; 6개 응답 유실·12개 Step 전후 SIGKILL/restart·암호화 백업/복원 |
| 최종 Docker production | image build·인증·정책 CLI·발행/숨김·운영·백업/readback·health·maintenance·SIGTERM PASS |
| legacy 재귀 검사·Git diff check·HEAD/index | PASS |

위 테스트의 fail·skip·cancelled는 모두 0이다. PostgreSQL 독립 복원에서 전체 schema·28개 table/sequence
상태·ledger/checksum·복원 후 주요 API를 대조했다. 계약 기준선 16개 해시가 유지됐다.
쿼리/인덱스 확인은 소규모 기준 DB에서 수행한 읽기 전용 점검이며 대용량 성능 검증으로 확대하지 않는다.

### 자원 종료와 보존

- 모든 테스트 session이 종료됐고 임시 Spring/Docker 컨테이너·네트워크·image·fixture DB가 남지 않았다.
- Core PG 점검 연결 외 client 0건, 남은 비-template DB는 `postgres`, `nest_schema_baseline`뿐이었다.
- `blariyo-nest-migration-pg`: exited / exit 0, `2026-09-09T11:50:20.220477293Z` 종료.
  ID `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`와
  volume `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1` 보존.
- `blariyo-nest-playwright-20260909`: exited / SIGTERM exit 143,
  `2026-09-09T11:50:20.207488459Z` 종료. 기존 ID와 readonly mount 유지.
- 이번 재개가 20:04:57에 만든 Gradle PID 76275는 이 저장소의 작업만 수행했고 IDLE이었다.
  OS kill은 권한 거부됐지만 공식 --status에서 이 버전의 유일한 daemon임을 확인한 뒤
  `gradlew --stop` exit 0 / `1 Daemon stopped`로 종료했다. 전역 강제 종료나 Docker prune은 하지 않았다.
- 테스트용 caffeinate 종료, PreventUserIdleSystemSleep 0. 다른 기존 컨테이너·서비스는 유지한다.
  전체 ps 조회는 sandbox 제한으로 미검증이며, session/종료 결과·listener·Docker 자원 관찰을 근거로 한다.
- 종합 실행 중과 이후 코드·설정·테스트 314개 해시가 동일하다. HEAD/index를 보존했고
  commit·push·staging·reset·stash·브랜치 전환·배포를 수행하지 않았다.

### 최종 감사·작업 트리 사본

- 문서 상대 링크 430개: 누락 0. 법무·과거 이력·기존 사용자 정리 문서 71개: 재개 사본과 해시 동일.
- 코드·설정·테스트 314개: 종합 실행 기준과 동일. HEAD/index 동일, 최종 `git diff --check` 통과.
- Gradle --status는 실행 daemon 없음, lsof에는 이 작업 Node/Java와 55449/55450 listener 없음.
  새 테스트 컨테이너·네트워크·image 없음. 원문은 `final-acceptance-audit.json`, `final-gradle-status.log`,
  `final-listeners.txt`, `final-power-assertions.txt`에 보존했다.
- 최종 tracked/untracked 파일 **489개** 사본 접두사: `/private/tmp/blariyo-nest-migration/done-local-20260909-205320`.
  `.tar.gz`, `-sha256.json`, `-head.txt`, `-index.txt`, `-status.txt`를 보존하고 archive를 원본 해시로 재검증했다.
  이전 baseline·삭제 전·중단 사본은 유지한다. 임시 경로 사본은 장기 백업을 대신하지 않는다.

### 남은 범위와 재검증 명령

TASK의 필수 로컬 작업은 없다. 실제 출처 수집·live Discord·운영 R2/CDN/Access·법무/승인 정책 실값·
운영 cron·Keychain/launchd·원격 백업 보관·배포·7일 관찰은 미수행이며 별도 운영 수용 대상이다.
새 변경 뒤에는 [REPORT의 전용 자원 확인·기동 절차](REPORT.md)를 거쳐 `npm run verify:migration`을 실행한다.
기존 데이터를 초기화하지 않는다. 이전 사본과 검증 로그는 `/private/tmp/blariyo-nest-migration/`에 보존한다.

## Spring strict·Docker production·종합 실행기 — 2026-09-09

**IN_PROGRESS. 최종 전체 검증과 완료 감사는 남아 있다.**

- Spring 5개 테스트의 strict TS/type-aware lint 통과(12704 exit 0). 실제 전체 실행 **9098 exit 0**,
  `strict-spring-full.log`: **5 pass / 0 fail / 0 skip / 0 cancelled**. control/fencing/preview/runtime/Step,
  12개 단계 경계 SIGKILL/restart와 암호화 백업 8회·최신 7개 보존을 통과했다.
  종료 후 사본 해시를 대조하고 대체된 Spring mjs 5개를 제거했다.
- Docker TS runner를 production Core/Nuxt·정책 CLI·서명 Access/JWKS·로컬 S3/CDN 대역으로 보완했다.
  첫 실행은 internal network의 port publish 부재로 실패했다. ingress proxy에만 전용 bridge를 연결한
  후속 실행 **37441 exit 0**, `docker-production-ingress.log`. 실제 API/Web build·인증·발행/숨김·정책·
  운영 명령·백업/readback·health·maintenance·SIGTERM/DB 연결 해제를 통과했다.
  검증 뒤 기존 test-docker.mjs를 제거하고 root test:docker를 TS에 연결했다.
- 계약 runtime strict 후보 `packages/contracts/src/strict-runtime.mjs`는 strict/type-aware lint 통과.
  기존 runtime과 39 operation, 요청 1872건·응답 5424건·투영 5424건 및 normalizeInput을 대조해 동일했다.
  `contracts-parity.log`. Spring 종료 뒤 실제 index.mjs로 연결하고 임시 후보를 제거했다.
  계약 패키지 자체의 checkJs strict/type-aware lint를 종합 실행에 연결했다.
- `verify:migration` 단일 실행기를 작성하고 scripts typecheck/lint 통과(20517 exit 0).
  필수 단계에 필터/skip이 없고 실행별 로그·결과, test source/compiled 목록, Git HEAD/index를 확인한다.
  최종 종합 실행을 **세션 94630**에서 시작했다. 결과 디렉터리는 `test-results/migration-ks4zg0/`,
  상위 로그는 `/private/tmp/blariyo-nest-migration/verify-migration-final.log`다. 진행 중이며 완료 주장은 하지 않는다.
- 착수 기준선의 SQL/OpenAPI/생성 계약 16개 해시가 현재와 일치한다. 이를 contract-baseline.json에 보존하고
  migration-contracts.test.ts로 자동 대조한다. SQL·생성 API 계약 내용을 변경하지 않았다.
- planning/system-design/development-specs의 Core 명칭·서비스/runner 경로와 README·PLAN·REPORT를
  현재 구조에 맞추고 완료·미검증을 분리했다. 기존 이력·법무 실값·운영 차단은 유지한다.
- 교체 전 변경/미추적 파일 358개 사본과 해시를 `pre-final-runtime-20260909-202420`에 보존했다.
  이전 전체 480개 사본도 유지한다. 조회 SQL/인덱스 읽기 전용 점검과 문서 상대 링크 411개 확인을 통과했다.
- 다음: 최종 종합 검증 → 실패 수정/재검증·문서/링크·범위/계약 감사·전용 자원 종료.

## 명시적 재개 — 2026-09-09 20:03 KST

**IN_PROGRESS. 최신 재개 요청으로 아래 중단 상태를 해소했다.**
중단 사본 `stop-20260909-195815`의 480개 파일과 HEAD/index가 현재 상태와 일치한다.
직전 중단 처리는 테스트 종료·자원 보존·해시 검증을 완료하여 다음 작업 근거를 확보했다.
TASK의 전체 완료 조건을 유지하며 남은 Spring strict 이관, Docker production/운영 검증,
단일 종합 검증 진입점과 최종 문서 동기화를 이어간다.

## 최신 상태 — 사용자 요청으로 안전 중단 (2026-09-09 20:02 KST)

**PAUSED_BY_USER. 전체 Nest 전환은 미완료이며 DONE_LOCAL이 아니다.**
이 절이 아래 IN_PROGRESS·재개·과거 중단 기록보다 우선한다. 새 구현·빌드·테스트는 시작하지 않는다.
사용자 메시지의 “기존 지시 중 다음 조건을 변경한다:” 뒤에 조건 본문이 없어 추가 조건은 추정하지 않았다.
명시적인 재개 요청 전에는 구현을 이어가지 않는다.

### 완료한 변경과 확인된 검증

- Nest Controller/Service/Repository, TypeORM transaction, 운영 CLI와 compiled main 전환을 보존했다.
  실제 FK 15개의 Entity 관계 매핑과 실제 JOIN·복합 FK·catalog 무변경 검증을 추가했다.
- Nuxt app/server/node/shared의 strict 타입 검사와 type-aware lint, Web SFC·BFF·직접 작성한 JS의
  입력 타입 및 unknown 검사, root/browser 공통 fixture와 테스트의 strict TS 이관을 반영했다.
- API build:test 산출물 분리·정리와 noEmitOnError를 적용했다. 대체 검증 후 legacy Express source
  30개·중복 Core 테스트 9개·옛 integration runner를 제거했고, 삭제 전 518개 파일은 별도 사본에 보존했다.
  이 삭제는 중단 요청 이전 작업이다. 이번 중단 처리에서 코드를 삭제하거나 되돌리지 않는다.
- 마지막 전체 Nest 로그 `nest-relations-web-all.log`: **72 pass / 0 fail / 0 skip / 0 cancelled**.
  같은 빌드의 Chromium `browser-relations-web-all.log`: **9 pass / 0 fail / 0 skip / 0 cancelled**.
  root `strict-root-tests.log`: **13 pass / 0 fail / 0 skip / 0 cancelled**.
  중단 처리에서 로그를 다시 집계한 것이며, 마지막 legacy/generator/Docker 변경 이후 전체 재실행은 아니다.
- `scripts/generate-contracts.ts` strict 이관·검사 후 기존 generator mjs를 제거했다.
  생성 api.d.ts·collection-api.d.ts·schema.mjs의 이전/이후 해시 동일성을 확인했다.
- `scripts/test-docker.ts`와 typed proxy fixture를 작성했다. buildx의 기본 캐시 쓰기가 sandbox에서
  거부된 첫 실행은 실패로 보존했다. 실행별 임시 BUILDX_CONFIG를 사용한 후속 실행은 **exit 0**이었다.
  scripts typecheck/lint와 Docker API/Web build, Core/Web/PostgreSQL 인증·발행/숨김·운영 CLI,
  dump/별도 DB 복원 readback을 통과했다. 로그 `strict-docker-isolated-buildx.log`, 세션 68091.
  NODE_ENV=test 기반 검증이므로 최종 production·maintenance·정상 종료 요구를 대신하지 않는다.
  기존 test-docker.mjs와 package.json의 기존 test:docker 연결은 아직 남아 있다.
- 로그와 재개용 사본의 기준 경로는 `/private/tmp/blariyo-nest-migration/`이다.

### 실행 중 테스트·프로세스와 자원

- Spring Step 세션 **56677 exit 0**. `strict-spring-step.log`: **1 pass / 0 fail / 0 skip / 0 cancelled**.
  실행 중이던 12개 Step 전후 SIGKILL/restart와 실제 암호화 백업 8회·최신 7개 보존 검증이 종료될 때까지
  기다렸다. 새 테스트는 시작하지 않았다. 전용 임시 Spring 컨테이너와 fixture DB는 테스트 teardown에서 정리됐다.
- Docker 세션 **68091 exit 0**. 해당 실행의 임시 컨테이너·네트워크·이미지가 목록에 남지 않았다.
- 전용 Core DB는 점검 연결 외 client 연결 **0건**, DB 목록은 `postgres`, `nest_schema_baseline`뿐임을
  SELECT로 확인한 뒤 종료했다. baseline DB와 볼륨은 보존했다.
- `blariyo-nest-migration-pg`: **exited / exit 0**, 종료 `2026-09-09T11:01:41.717188095Z`.
  ID `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`,
  볼륨 `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1` 유지.
- `blariyo-nest-playwright-20260909`: **exited / exit 143(SIGTERM)**,
  종료 `2026-09-09T11:01:41.704939637Z`.
  ID `8de8b7dee5c7526c74c6f4c0b0d7c138d979f2834356f3ade82a654b72384079`와 기존 readonly mount 유지.
- 다른 기존 Docker 컨테이너는 변경하지 않았다. `lsof`에서 이 작업 Node/Nuxt/Spring listener와
  55449/55450 listener가 사라졌고, `pmset`의 PreventUserIdleSystemSleep은 0이었다.
  전체 프로세스 조회는 sandbox에서 `ps`가 거부되어 미검증이다. 호스트 전체의 프로세스 부재로 확대하지 않는다.

### 보존 상태

- 중단 직전 Git tracked/untracked 작업 파일 **480개**를 SHA-256과 함께 기록하고,
  `.tar.gz`를 다시 읽어 480개 모두 일치함을 검증했다.
- 사본 접두사: `/private/tmp/blariyo-nest-migration/stop-20260909-195815`.
  삭제 전 사본 `pre-legacy-removal-20260909-195141`도 보존한다.
- 이번 중단 처리의 저장소 수정은 **이 PROGRESS.md 하나**다. 480개 파일의 전후 비교에서 유실은 0개이며,
  HEAD/index와 기존 사용자 변경을 보존했다. `git diff --check`와 최신 절의 TASK 상대 링크 확인을 통과했다.
- 사본은 `-before-sha256.json`, `-before.tar.gz`, 최종 `-sha256.json`, `.tar.gz`,
  `-status.txt`, `-head.txt`, `-index.txt`로 구성한다. 최종 archive도 원본 해시와 대조한다.
- commit/push/staging/reset/clean/stash/브랜치 전환/배포는 수행하지 않았다.
- 임시 경로의 사본은 재개를 위한 것이며 장기 백업을 대신하지 않는다.

### 재개 시 우선순위와 남은 작업

1. 재개 요청과 추가 조건을 확인하고 [TASK](../task_list/09/09/TASK.md)의 미충족 조건을 유지한다.
   중단 사본과 파일·HEAD/index를 비교하고 전용 컨테이너 ID·볼륨을 확인한 뒤 필요한 자원만 시작한다.
2. 나머지 Spring mjs 테스트의 strict TS 이관, Step의 원본/대체 경로 정리,
   shared contracts의 직접 작성한 JS까지 strict 검사 범위를 완성한다. Step 단독 결과를 전체 Spring 통과로 쓰지 않는다.
3. Docker TS runner의 package 연결·기존 runner 정리, 실제 production 설정의 compiled server,
   readiness/liveness·maintenance·정상 SIGTERM 종료 검증을 완성한다. 테스트용 외부 대역은 로컬 격리를 유지한다.
4. 모든 필수 검증을 실패 누락 없이 실행하는 단일 검증 진입점을 완성하고, 최종 파일 상태로 strict/lint·
   단위·실제 DB 잠금/transaction·빈/기존 DB migration·schema/data/ledger·API/CLI·실제 Nuxt/브라우저·
   전체 Spring 재시작/fencing·최종 Docker·백업/독립 복원 검증을 실행한다.
5. legacy 잔여 참조와 링크, SQL/OpenAPI/생성 계약의 무변경 여부를 최종 대조하고
   README·PLAN·DECISIONS·REPORT·설계 정본을 실제 구현 및 검증 결과와 동기화한다.

## 관계 매핑·전체 Nest 회귀·legacy 정리 — 2026-09-09 19:52 KST

**IN_PROGRESS. 최종 Docker·전체 Spring·잔여 운영 strict와 문서 동기화는 미완료다.**

- Web strict/type-aware lint와 root strict/type-aware lint 및 단위 13개 통과(85668 exit 0).
- 실제 baseline FK 15개를 Entity 관계로 매핑했다. catalog와 관계 컬럼/대상/nullable/삭제·수정 정책 대조,
  15개 실제 JOIN, 복합 FK의 이미지/null readback과 자동 로딩 부재, 전후 catalog 동일성 통과.
  로그 `entity-relations.log`. 관계의 cascade/eager/lazy/persistence/DDL 생성은 모두 false다.
- 최신 전체 build + Nest 통합 **72 pass/0 fail/0 skip/0 cancelled**,
  `nest-relations-web-all.log`. 같은 빌드의 strict Chromium **9 pass/0 fail/0 skip**,
  `browser-relations-web-all.log`. 실행 세션 70919 exit 0.
- 원래 root Core 회귀와 strict 대체 테스트의 title/assertion 목록을 추출해 대조했다.
  `core-test-inventory.jsonl`. constraints의 개별 4개 CHECK assertion은 동일 입력을 순회하는 하나의
  assertion 호출로 바뀌었고, Core isolation은 startup 2개·실제 migration readiness·cleanup 3개로 분리됐다.
  단순 assertion 개수를 완료 증거로 사용하지 않고 해당 원문도 직접 비교했다.
- 검증 뒤 기존 직접 Express source mjs 30개, 중복 root Core 테스트 9개, 직접 pg를 사용하던
  `scripts/test-integration.mjs`를 제거했다. `test:integration`은 strict Nest 전체 명령으로 연결했다.
  `pre-legacy-removal-20260909-195141` 사본에 삭제 전 작업 파일 518개와 해시·HEAD/index를 보존했다.
  경로는 `/private/tmp/blariyo-nest-migration/`이며 archive readback이 원본 해시와 일치했다.
- Spring Step 경계 테스트를 strict TS로 이관하여 typecheck/lint 통과했다. 실제 12개 재시작·백업 회전을
  `strict-spring-step.log`로 실행 중이다. 나머지 Spring 파일의 strict 이관과 최종 전체 실행은 남는다.
- 다음: Spring/운영 runner strict, 최종 Docker/production·전체 종합 검증 진입점,
  legacy 제거 후 최종 재검증과 README·정본·PLAN/REPORT 동기화.

## 브라우저·Web 단위 테스트 strict 이관 — 2026-09-09

**IN_PROGRESS. 남은 Spring/운영 코드와 최종 전체 검증은 미완료다.**

- Web 타입 보완 후 실제 Nuxt rebuild와 Chromium 전체 **9 pass**, `web-typed-build.log`, `web-typed-browser.log`.
- 브라우저 4개 파일과 launch helper를 strict TS로 이전하고 원래 assertion을 유지했다.
  native TS로 실제 Chromium **9 pass/0 fail/0 skip**, `strict-browser.log`. 이후 top-level test promise는 await로 명시했다.
- Web 단위 검증을 root strict TS로 이전했다. 인증 JWT와 projection, consent/analytics·요약,
  업로드 오류, 관리자 SSR의 9개와 구조/정본 4개를 합쳐 새 `npm test` **13 pass/0 fail/0 skip**.
  타입 검사와 type-aware lint도 통과했다(세션 4374 exit 0).
  이전 auth-contract의 Core 401/403·maintenance는 `http-boundaries.integration.test.ts`,
  policy-consent의 정책 DB/rollback 부분은 `policies.integration.test.ts`로 이미 검증된 대체 경로를 유지한다.
- 기존 Web 단위 mjs 4개, browser mjs 4개와 launch-browser.mjs를 대체 검증 후 제거했다.
  남은 root Core mjs와 Spring mjs, 운영 runner는 아직 최종 정리 전이다.
- API build.ts는 `--test`로 dist-test만 먼저 정리하고 컴파일한다. 잘못된 인자는 삭제 전에 거부한다.
  API compiler에 noEmitOnError를 명시했다. API build/build:test/typecheck:dev/lint와 root 검사 통과.
- Nuxt app/server/node/shared 검사와 직접 작성한 JS utility의 checkJs를 유지한다. 실제 DOM과 단위 대역은
  analytics가 사용하는 script/document 범위의 generic 타입으로 표현한다. Document 전체를 대역이라고 단언하지 않는다.
  마지막 generic 보완 후 `typecheck:web` 통과(4374). Web type-aware lint도 추가하여 확인할 예정이다.
- 다음: Web lint, 최종 API/브라우저/BFF 재검증, Spring·운영 스크립트 strict 전환,
  legacy 제거와 전체 필수 Docker/backup/격리 복원·정본 문서 동기화.

## Web strict 검사·공통 fixture 복구 — 2026-09-09

**IN_PROGRESS. 전체 TASK 최종 검증과 잔여 legacy/테스트 이관은 계속 진행한다.**

- `tests/helpers/browser-fixture.ts`를 실제 Nest migration + TypeORM 연결로 이관했다.
  strict 타입 검사와 lint 통과 후 browser/Spring import를 연결하고 옛 helper mjs를 제거했다.
  첫 브라우저 실행에서는 테스트 결과의 rowCount 누락으로 7 pass/2 fail(상위 묶음 포함),
  records/affected 전달 보완 후 실제 Chromium **9 pass/0 fail/0 skip**.
  로그 `typed-fixture-browser.log`, `typed-fixture-browser-fixed.log`. 기존 assertion을 유지했다.
- Nuxt app/server/node/shared와 직접 작성한 mjs의 strict/강화 옵션/checkJs를 설정했다.
  SFC 입력·편집 상태·API 응답은 canonical 생성 타입을 사용하고 DOM/SDK/오류 입력을 좁힌다.
  BFF projectResponse의 빠진 함수 선언은 unknown 반환으로 보완하고 실제 응답 meta를 확인한다.
  `npm run typecheck -w @blariyo/web` **exit 0**, 로그 `web-typecheck-final.log`.
- 기존 Web 관련 단위 검증 9개(인증 JWT, 응답 projection, 동의/분석 4개, 요약, 업로드 오류, 관리자 SSR)
  **9 pass/0 fail/0 skip**, 로그 `web-unit-typed.log`. 이 실행은 이름으로 Web 관련 테스트만 선택했다.
- 위 Chromium 통과는 이후의 Web 타입 보완 전 산출물이었다. 최종 Web rebuild·브라우저/BFF/Spring과
  최종 API/Docker/backup 등 필수 검증을 아직 대신하지 않는다.
- 전용 PostgreSQL/Playwright는 ID·volume/mount 확인 후 재기동했으며 현재 사용 중이다.
- 다음: Web build와 실제 browser/BFF 회귀, root/browser/Spring·운영 runner strict 전환과
  종합 검증 진입점 정비, legacy 제거와 최종 전체 검증·문서 동기화.

## 명시적 재개 — 2026-09-09 19:35 KST

**IN_PROGRESS. 최신 재개 요청에 따라 바로 아래 중단 상태를 해소했다.**
중단 사본 `stop-20260909-193238`의 작업 파일 508개와 HEAD/index가 현재 상태와 일치한다.
전체 TASK 조건을 유지한다. 먼저 공통 browser/Spring fixture의 누락 import와 Web strict 타입 검사를
보완하고, 잔여 테스트·운영 경로 전환과 최종 전체 검증을 이어간다.

## 최신 상태 — 사용자 요청으로 안전 중단 (2026-09-09 19:33 KST)

**PAUSED_BY_USER. 전체 Nest 전환은 미완료이며 DONE_LOCAL이 아니다.**
이 절을 최신 상태로 사용한다. 아래 재개·IN_PROGRESS·이전 중단 기록은 당시 이력이다.
새 구현·빌드·테스트는 시작하지 않았다. 사용자 메시지의 “기존 지시 중 다음 조건을 변경한다:”
뒤에 조건 본문이 없어 추가 조건은 추정하지 않았다. 명시적 재개 요청 전에는 구현을 이어가지 않는다.

### 완료한 변경과 확인된 검증

- Nest Controller/Service/Repository, TypeORM 저장·transaction, 운영 명령과 compiled main 연결,
  관리자·공개·이미지·정책·수집 legacy/V2 테스트의 strict TypeScript 이관 상태를 보존한다.
- HTTP 미지원 method/미등록 경로·인증 우선순위·잘못된 JSON 응답의 계약 차이를 수정했다.
  TypeScript polling 기반 개발 감시로 변경→컴파일→재기동과 타입 오류 시 정상 서버 유지를 검증했다.
- 가장 최근 Nest 통합 로그 `strict-nest-all.log`를 중단 시 다시 집계했다:
  20개 파일 실행 결과 합계 **72 pass / 0 fail / 0 skip / 0 cancelled**.
  당시 contracts 생성·API/Web build·strict 테스트 컴파일을 포함했다. 최종 전체 TASK 완료를 뜻하지 않는다.
- 이전 실행에서 API 단위·구조·startup 8 pass, root 구조·정본 계약 4 pass,
  scripts/root TS typecheck·lint 통과를 확인했다. 이번 중단 처리에서는 재실행하지 않았다.
- `spring-step-awake.log`는 **1 pass**, 12개 Step 전후 SIGKILL/restart와 실제 암호화 백업 8회·최신 7개 보존을
  확인했다. 이전 Spring 전체 묶음 4 pass/1 fail과는 별도 실행이다. 최종 전체 Spring 재검증은 남아 있다.
  당시 timeout과 macOS Idle Sleep의 대응은 아래 기록에 남겨 두었다.
- 마지막 변경은 `apps/web/package.json`과 `package-lock.json`의 **vue-tsc 3.3.11 개발 의존성 추가**다.
  설치는 종료됐지만 Nuxt typecheck 설정·실제 타입 검사·타입 보완은 아직 시작하지 않았다.
  위 72 pass를 이 의존성 추가 이후의 검증으로 사용하지 않는다.
- 로그 기준 경로는 `/private/tmp/blariyo-nest-migration/`이다.

### 실행 중 테스트·프로세스와 자원

- 직전 실행 기록상 Nest 전체(38789), Spring 재시도(73327), 의존성 설치(26361),
  scripts/root 검사(44302)는 모두 exit 0이었다. 중단 시 해당 핸들을 조회하니 모두
  `Unknown process id`로 더 이상 활성 세션이 아니었다. 이 조회 자체를 새 테스트 통과로 해석하지 않는다.
- 전용 DB의 점검 연결을 제외한 client 연결 **0건**. DB 목록은 `postgres`, `nest_schema_baseline`뿐으로
  임시 테스트 DB가 남지 않았음을 확인한 뒤 전용 PostgreSQL만 정상 종료했다.
- `blariyo-nest-migration-pg`: **exited / exit 0**, 종료 `2026-09-09T10:32:45.990047125Z`.
  ID `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`,
  볼륨 `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1`과 baseline DB를 보존했다.
- `blariyo-nest-playwright-20260909`: 기존 **exited / exit 143(SIGTERM)** 상태를 확인했다.
  ID `8de8b7dee5c7526c74c6f4c0b0d7c138d979f2834356f3ade82a654b72384079`.
  재기동·삭제하지 않았다. 다른 기존 Docker 컨테이너는 변경하지 않았다.
- `lsof`의 확인 가능한 TCP listener에는 이 작업의 Node/Nuxt/Spring 서버가 나타나지 않았다.
  `pmset`의 PreventUserIdleSystemSleep은 0이었다. macOS 전체 프로세스 조회는 sandbox에서 `ps`가
  거부되어 확인하지 못했다. 전체 시스템에 관련 프로세스가 전혀 없다고 단정하지 않는다.

### 보존 상태

- 중단 처리 직전 tracked/untracked 작업 파일 **508개**의 SHA-256, Git status·HEAD·index를 기록했다.
  직전 `strict-checkpoint-20260909-192834` 대비 변경은 위 Web package·lock 두 파일뿐이며 파일 유실은 0개다.
- 이번 중단 처리의 저장소 수정은 **이 PROGRESS.md 하나**로 제한한다. 구현 수정·삭제·되돌리기 없이 보존한다.
- 사본 접두사: `/private/tmp/blariyo-nest-migration/stop-20260909-193238`.
  `-before-sha256.json`, `-sha256.json`, `-status.txt`, `-head.txt`, `-index.txt`, `.tar.gz`로 보존한다.
  임시 경로의 재개용 사본이며 장기 백업을 대신하지 않는다.
- commit/push/staging/reset/clean/stash/브랜치 전환/배포는 수행하지 않았다.

### 재개 시 우선순위와 남은 작업

1. 재개 요청과 추가 조건을 확인하고 [TASK](../task_list/09/09/TASK.md)의 미충족 조건을 유지한다.
   위 사본과 작업 파일·HEAD/index를 먼저 비교하고 전용 컨테이너 ID·볼륨을 확인한 뒤 필요한 자원만 시작한다.
2. **브라우저/Spring fixture 참조부터 보완한다.** `tests/helpers/browser-fixture.mjs:10`이 삭제된
   `../nest/helpers.mjs`를 계속 import하며, 9행은 legacy DB helper를 사용한다.
   이번에 파일을 직접 읽어 확인했다. 중단 요청에 따라 수정하지 않았고, 이 상태의 브라우저/Spring 실행은
   미검증이다. 이전 Chromium 9 pass를 현 상태의 통과로 사용하지 않는다.
3. 설치된 vue-tsc를 이용한 Nuxt strict 타입 검사 설정·오류 보완, 남은 root/browser/Spring 테스트와
   운영 runner의 strict 전환을 수행한다. 현재 root npm test는 원래 mjs 테스트 경로를 포함한다.
4. root 검증 진입점을 통합하고, 기존 회귀의 대체 검증 후 legacy Express·중복 실행 경로를 정리한다.
   build:test 산출물 정리/테스트 목록 일치와 Entity 관계 매핑도 최종 점검한다.
5. 최종 코드로 필수 검증 전체를 수행한다: strict/구조·단위·실제 DB 잠금/transaction·빈/기존 DB migration·
   전체 schema/data/ledger·API/CLI·compiled production·실제 Nuxt/브라우저·전체 Spring 재시작/fencing·
   최종 Docker·백업/독립 복원. 장시간 macOS 테스트는 실행 수명에 묶인 caffeinate 사용을 고려한다.
6. README·PLAN·DECISIONS·REPORT와 설계 정본을 실제 구현·검증에 맞춰 동기화한다.
   `08-code-structure.md`의 posts→images 의존성 반영 여부도 확인한다.


## 기존 테스트 strict 이관과 통합 재검증 — 2026-09-09

**IN_PROGRESS. 필수 최종 Docker·브라우저/Spring·잔여 strict 검증과 legacy 정리는 계속 진행한다.**

- `tests/nest`의 관리자·공개·이미지·정책·DB/ORM·migration·BFF·수집 legacy/V2 전체를
  `apps/api/test/*.integration.test.ts`로 이관하고 실제 실행했다. 기존 assertion은 보존하고
  canonical OpenAPI가 검증한 응답을 생성 타입으로 좁혀 사용한다. type assertion으로 응답을 신뢰하지 않는다.
- 이관된 파일별 검증: 관리자 6, 공개 4, 이미지 1, 정책 1, DB/ORM 1, migration 1, BFF 1,
  수집 legacy 7, V2 8 pass. 검증 뒤 중복 `tests/nest/*.mjs`와 helper·디렉터리를 제거했다.
- 기존 root constraints의 실제 lock/statement timeout, 연결 생존, M0 CHECK, 금지 schema와
  restricted readiness 검증을 `migrations.integration.test.ts`에 보완하여 통과했다.
- 기존 root Core isolation의 수집 부재/cleanup 실패/reference 실패에도 Core 정리를 수행하고
  preview를 보존하는 검증은 `core-isolation.integration.test.ts` 4 pass로 이전했다.
  disabled token file 무접근·enabled UTF-8 로딩은 `startup.service.test.ts`에 이전했다.
  enabled 테스트의 기존 문자열 배열 대역은 실제 credential 모양으로 바꾸었고, 문자열 배열 등
  잘못된 구조를 거부하는 별도 assertion을 추가했다. 기존 설정 검증 정책의 근거는 startup 입력 경계다.
- `npm run test:nest`가 contracts 생성·전체 API/Web build·테스트 컴파일 후 strict 테스트 전체를 실행한다.
  **72 pass / 0 fail / 0 skip / 0 cancelled**, 로그 `strict-nest-all.log`, 세션 38789 exit 0.
  API 단위·구조·startup 묶음은 **8 pass**. 각 개별 이관 로그도 전용 임시 경로에 남겼다.
- root 구조·계약 검사를 TypeScript로 이관했다. 새 Core TS 구조 검사와 기존 Collector 패키지 cycle/
  역방향 의존성·Web cross-app 경계·정본 OpenAPI 동일성 **4 pass**. 대응 old root mjs 2개만 제거했다.
- 추가·갱신된 scripts와 root TS 테스트에는 strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes 및
  type-aware lint를 적용한다. **아직 mjs로 남은 root/browser/Spring 테스트와 Web 관련 검사까지
  전체 strict 검사가 완료된 것은 아니다.** `npm test`도 아직 잔여 원본 mjs를 실행하므로 최종 전환 전이다.
- 다음 작업: 남은 root 테스트의 Core 중복/프런트 검증 분리·이관, browser/Spring 공통 fixture와 runner
  strict 전환, 최종 Docker/production/환경 검증, legacy 코드 제거, 전체 필수 검증과 문서 동기화.

## HTTP 경계·strict 테스트·개발 감시·Spring 재검증 갱신 — 2026-09-09

**IN_PROGRESS. 전체 TASK 완료 조건은 유지하며 최종 DONE_LOCAL 아님.**

- 마지막 build.ts/dev.ts 변경은 API build/build:test/typecheck:dev/lint와 단위·구조 6개를 검증했다.
- HTTP 회귀에서 미지원 관리자 HEAD의 인증 우선 처리(401 대신 기존 404 필요), Nest가 SyntaxError를
  다시 포장하여 잘못된 JSON이 500으로 바뀌는 오류를 재현했다. 계약 method 확인을 인증 전에 수행하고,
  JSON parser 오류만 transport에서 도메인 오류로 전달하여 Nest Filter의 기존 400 envelope를 유지했다.
  수집 prefix의 미등록 경로는 CANDIDATE_NOT_FOUND를 유지한다. HTTP 신규 4개 검증 통과.
- 수정 후 당시 Nest 통합 전체 묶음 **67 pass / 0 fail / 0 skip / 0 cancelled**.
  로그 `nest-current-all.log`. 이 실행 이후 추가된 개발 감시 검증·strict 이관의 최종 묶음 재실행은 남아 있다.
- 통합 runner를 `scripts/test-nest-integration.ts`로 옮기고 실제 TypeORM 연결을 사용한다.
  scripts strict/강화 옵션과 type-aware lint를 추가하여 통과했다. 예전 자체 mjs runner는 검증 후 제거했다.
  현재 실행: `TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres npm run test:nest`.
- DB/ORM·migration·이미지 HTTP·정책 테스트 4개와 공개 HTTP 테스트 4개를 strict TS로 이관하여 통과했다.
  이전 자체 `tests/nest/{database,migrations,images,policies,public}.test.mjs`는 대체 검증 후 제거했다.
  원본 root 회귀는 아직 남아 있다. HTTP 응답은 canonical OpenAPI 검증을 통과한 값만 생성 타입으로 좁힌다.
- 실제 dev 시험에서 Node native watch가 EMFILE로 시작 실패했다(현재 ulimit 1048575).
  TypeScript 내장 polling watch로 바꾸었다. 성공한 컴파일 후 compiled main을 새 프로세스로 실행하고,
  타입 오류 때는 emit/restart 없이 마지막 정상 서버를 유지한다. 별도 사본에서 실제 npm dev로
  변경→재컴파일→재기동, 타입 오류→서버 유지, 수정→재기동, 종료 후 listener 해제를 검증했다.
  `dev-watch-recovery.log` **1 pass**. 원래 native watch 실패 로그 `dev-watch.log`도 보존한다.
- Spring 이전 timeout 시각과 macOS 전원 로그를 대조했다: 18:47:10 Idle Sleep, 1009초 뒤 19:03:59 DarkWake.
  제한 시간을 늘리지 않고 `/usr/bin/caffeinate -i node --test --test-concurrency=1 tests/spring/step-boundaries.test.mjs`
  로 재실행했다. `spring-step-awake.log`: 12개 Step before/after, 실제 암호화 pg_dump 8회·최신 7개 보존,
  **1 pass / 0 fail / 0 skip**, 세션 73327 exit 0. 잠자기 방지는 종료 시 자동 해제됐다.
  이전 4 pass와 이번 1 pass는 서로 다른 실행이다. 최종 코드의 전체 Spring 묶음 검증은 별도로 남는다.
- 위 로그는 `/private/tmp/blariyo-nest-migration/`에 보존한다. 전용 DB는 기동 중이고 baseline/volume은 보존한다.
- 남은 순서: 관리자/수집/BFF·root/browser/Spring 테스트의 strict 검사와 Nest 연결, legacy 제거,
  최종 Docker/production과 전체 필수 종합 검증, 정본·README·PLAN/REPORT 최종 동기화.

## 명시적 재개 — 2026-09-09 19:06 KST

**IN_PROGRESS. 최신 재개 요청에 따라 아래 중단 상태를 해소했다.**
중단 사본 `stop-20260909-184301`의 파일 500개가 현재 파일과 모두 일치하고 HEAD/index도 같다.
전체 TASK를 유지한다. 먼저 마지막 build/dev 변경 검증과 Spring 기동 timeout 원인 조사를 수행하고,
남은 strict 테스트 이관·HTTP 계약·Docker·최종 검증을 이어간다. 이전 실패 기록은 그대로 보존한다.

## 최신 상태 — 사용자 요청으로 일시 중단 (2026-09-09 19:04 KST)

**PAUSED_BY_USER. 전체 Nest 전환은 미완료이며 DONE_LOCAL이 아니다.**
최신 중단 요청을 이전 재개 지시보다 우선한다. 새 구현·빌드·테스트를 시작하지 않는다.
“기존 지시 중 다음 조건을 변경한다:” 뒤에 본문이 없어 변경 조건은 추정하지 않았다.
이 절이 현재 상태이며 아래 IN_PROGRESS·재개·중단 기록은 당시 이력으로 보존한다.

### 완료한 변경과 검증 범위

- 관리자 후보의 초안 승격을 Nest Controller/Service/Repository에 연결했다. 후보·receipt 잠금,
  preview 검증, 기존 이미지·게시물 Service 재사용, 최종 승인·receipt transaction을 구현했다.
- 만료 이미지·receipt·고아 object cleanup과 collection 참조 오류 시 preview 보존을 연결했다.
  일반 이미지·게시물·정책·outbox·멱등 저장·예약 알림 갱신은 TypeORM QueryBuilder로 전환했다.
- remote adapter, 환경·collector token 검증, 운영 command, main, 로컬 media와 정상 종료 hook을 추가했다.
  기본 API start/dev, 루트 build·운영 script, Docker CMD를 Nest dist 경로로 바꿨다.
- 기존 실패 보상·잠금·발행 경합·응답 유실·스케줄러 알림 회귀를 strict TS Nest 테스트로 옮겼다.
  단위 테스트 5개와 구조 검사 1개가 통과했다. Nuxt/BFF/브라우저 fixture도 Nest에 연결했다.
- 아래는 각 실행 시점의 로그를 이번 중단 처리에서 재확인한 결과다. 최종 코드 전체 재검증이 아니다.
  로그 기준 경로: `/private/tmp/blariyo-nest-migration/`.

| 검증 | 관측 결과 | 보존 로그 |
| --- | --- | --- |
| ORM·운영·수집·API 통합 묶음 | 54 pass, fail/skip/cancelled 0 | `orm-runtime-integration.log` |
| 실제 Nuxt·Chromium | 9 pass, fail/skip/cancelled 0 | `nest-browser-docker.log` |
| Nuxt BFF/Core/SSR HTTP | 1 pass, fail/skip/cancelled 0 | `nest-bff.log` |
| 전체 schema·기존 data/ledger/sequence·별도 PostgreSQL 백업 복원·API | 1 pass, fail/skip/cancelled 0 | `schema-restore-recheck2.log` |
| storage 보상·DB rollback·outbox 소진 | 1 pass, fail/skip/cancelled 0 | `nest-failures.log` |
| 발행 소유권·오래된 삭제·commit 응답 유실·예약·알림 회귀 | 6 pass, fail/skip/cancelled 0 | `nest-review-regressions.log` |
| 루트 전체 build | 당시 완료 로그 확인 | `full-build.log` |

- 복원 검증은 17개 테이블과 11개 sequence, migration ledger/checksum, 데이터와 API를 비교했다.
  PostgreSQL이 복원 시 CHECK 표현식을 다시 출력하는 차이는 동일 서버의 별도 reference DB에
  원본 DDL을 적용해 전체 schema를 비교했다. 제약을 제외하여 통과시킨 것이 아니다.
- **마지막 변경인 `apps/api/build.ts`와 이를 호출하도록 바꾼 `dev.ts`는 아직 검증하지 않았다.**
  앞선 build/lint/typecheck 통과를 이 변경 이후의 통과로 사용하지 않는다.
  dev watch의 실제 재빌드·재기동과 최종 production/Docker 실행도 미검증이다.
- 모든 테스트를 한 번에 최종 실행한 결과는 아직 없다. 개별 통과 수를 최종 완료 판정으로 합산하지 않는다.

### 실행 중 작업의 종료 확인

- 중단 요청 시 테스트 세션 `89288`에서 Spring 전체 5개 파일을 실행 중이었다.
  새 테스트를 실행하지 않고 해당 실행의 종료·teardown까지 확인했다. 최종 **exit 1**,
  **4 pass / 1 fail / 0 skip / 0 cancelled**. control·fencing·preview·runtime 네 파일은 통과했다.
- step-boundaries는 12개 재시작 지점 중 `uploadPreviews after`까지 10개 PASS를 기록한 뒤
  다음 프로세스 기동 대기에서 `Runtime condition timed out`으로 실패했다.
  위치: `tests/spring/step-boundaries.test.mjs:195`, 호출 `:213`, timeout 발생 `:33`.
  나머지 2개 지점과 마지막 백업 회전 검증은 완료되지 않았다. 원인은 미조사이며 재실행하지 않았다.
  이 실패를 사용자 취소나 제품 결함으로 단정하지 않는다.
- 원본 로그 `nest-spring-process.log`와 redaction을 거친 `/private/tmp/blariyo-spring-step-process.log`를
  아래 사본 접두사의 `-spring-test.log`, `-spring-step-process.log`로 추가 보존했다.
- 테스트의 임시 Spring DB `blariyo-spring-test-6d2bf4be1555`는 teardown 후 목록에서 사라졌고,
  전용 Core PostgreSQL의 테스트 DB도 정리됐다. 점검 연결 제외 client 연결 **0건**을 확인했다.
- 전용 PostgreSQL `blariyo-nest-migration-pg`를 정상 종료했다: `exited`, exit **0**,
  종료 `2026-09-09T10:04:20.066277127Z` (19:04 KST).
  ID `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`,
  볼륨 `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1`과
  기준선 DB `nest_schema_baseline`을 보존했다. 컨테이너·볼륨을 삭제하지 않았다.
- 사용이 끝난 Playwright 서버 `blariyo-nest-playwright-20260909`를 Docker stop으로 종료했다:
  `exited`, exit **143** (SIGTERM), 종료 `2026-09-09T09:44:57.069125303Z`.
  ID `8de8b7dee5c7526c74c6f4c0b0d7c138d979f2834356f3ade82a654b72384079`.
  컨테이너·이미지를 보존했다. 당시 남은 step-boundaries는 브라우저를 사용하지 않는 코드로 확인했다.
- 알려진 테스트 핸들의 종료와 테스트 자원 정리를 확인했다. 다른 기존 Docker 컨테이너는 변경하지 않았다.
- macOS 전체 프로세스 목록은 sandbox의 `ps` 거부로 확인하지 못했다.
  알려진 테스트 핸들·Docker·DB 연결을 확인하며, 시스템 전체 프로세스가 없다고 단정하지 않는다.

### 보존한 변경과 사본

- 이번 중단 처리의 저장소 수정 범위는 이 `PROGRESS.md` 하나다. 구현 코드를 추가 수정하지 않는다.
- 중단 직전 tracked/untracked 파일 500개의 SHA-256을 기록했다. 초기 사용자 기준선의 파일 유실 0개,
  원본 migration/OpenAPI 해시 차이 0개, 이전 중단 시점 대비 HEAD/index 동일함을 확인했다.
- 이전 18:13 사본 477개 대비 변경 49개·신규 25개이며, 이전 작업에서 만든 중복 단위 테스트 mjs 2개만
  strict TS 대체 테스트 통과 뒤 제거되어 있다. 이번 중단 처리에서는 삭제하지 않았고 이전 사본에 남아 있다.
- 사본 접두사: `/private/tmp/blariyo-nest-migration/stop-20260909-184301`.
  `-before-sha256.json`, `-sha256.json`, `-status.txt`, `-head.txt`, `-index.txt`, `.tar.gz`를 보존한다.
  임시 경로의 작업 사본이므로 장기 백업을 대신하지 않는다.
- commit/push/staging/reset/clean/stash/브랜치 전환/배포는 수행하지 않았다.

### 재개 시 남은 작업과 명령

1. 사용자 재개 지시와 추가 조건을 반영하고 [최종 TASK](../task_list/09/09/TASK.md)의 전체 13개 조건을 유지한다.
   이 사본과 현재 파일·HEAD/index를 비교한 뒤 전용 PostgreSQL의 ID/볼륨을 확인하고 필요할 때 재기동한다.
2. 먼저 보존한 Spring step-boundaries 기동 timeout 로그를 조사한다. 실패를 해결한 뒤 해당 전체 검증을 다시 수행한다.
   마지막 build.ts/dev.ts 변경도 API build, build:test, typecheck:dev, lint, 단위 테스트로 검증한다.
3. collection 및 일반 API의 미지원 method/HEAD/OPTIONS·미등록 경로·인증/계약 검사 순서를 기존 계약과 대조한다.
   collection fallback 404 코드와 Guard 우선순위는 조사 중 발견한 확인 대상이며 아직 수정·회귀 검증하지 않았다.
4. 남은 원래 root 테스트와 `tests/nest/*.mjs`, 운영·테스트 runner를 Nest 및 strict TS에 연결한다.
   root npm test는 아직 legacy 테스트 경로를 포함한다. 최종 통합 검증 진입점과 구조 검사도 완성한다.
5. 기존 회귀를 모두 이관·검증한 뒤 legacy Express 실행 경로·중복 코드를 정리한다.
   현재 legacy mjs가 남아 있으므로 전환 완료로 판정하지 않는다.
6. 최종 코드 기준으로 전체 필수 검증을 실행한다: strict/구조, 단위, 실제 DB 잠금·transaction,
   빈/기존 DB migration·전체 schema/권한/data/ledger, API·CLI, compiled production, 실제 Nuxt·브라우저,
   실제 Spring 재시작·fencing, 최종 Docker, 백업·독립 복원. 이전 일부 통과는 최종 재검증을 대신하지 않는다.
7. PLAN/DECISIONS/REPORT·정본 문서를 최종 구현과 동기화하고 링크·diff·placeholder를 검사한다.

재개 후 사용할 환경과 첫 검증 명령(이번 중단 처리에서는 실행하지 않음):

```sh
export PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH
export npm_config_cache=/private/tmp/blariyo-nest-migration/npm-cache
export JAVA_HOME=/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home
set -e
npm run build -w @blariyo/api
npm run build:test -w @blariyo/api
npm run typecheck:dev -w @blariyo/api
npm run lint -w @blariyo/api
npm run test:unit -w @blariyo/api
```

DB 통합 runner는 소유 확인 후 기동한 loopback `55449`의 전용 PostgreSQL만 사용한다.
실행 예: `TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres node scripts/test-nest-integration.mjs`.
브라우저/Spring은 전용 Playwright 서버의 ID·mount를 확인해 기동한 뒤
`PLAYWRIGHT_WS_ENDPOINT=ws://127.0.0.1:55450/`를 사용한다. 실제 외부 수집·Discord 전송·배포와 구분한다.

## 승격·운영·주 실행 경로 갱신 — 2026-09-09

**IN_PROGRESS. 아래 중단 기록은 이전 이력이며 현재 작업은 재개됐다.**

- CollectionPromotionService와 Repository 승인 저장, 관리자 draft Controller 연결 완료.
  ImagesModule/PostsModule의 동일한 DI 등록을 재사용한다. 기존 legacy 수집 assertion 7개를
  `tests/nest/collection.test.mjs`에서 Nest 경로로 실행했고 V2와 함께 검증했다.
- CollectionCleanupService에 이어 CleanupService/Repository를 연결했다. 만료 STAGED 이미지,
  멱등 receipt, 고아 object 정리와 collection 참조 실패 시 preview 보존·실패 보고를 유지한다.
- remote adapter, 환경 설정, collector token 입력 검증, 운영 command.ts, main.ts와 로컬 media 경로 추가.
  내장 Nest 정상 종료 hook과 정책 기동 조건을 연결했다. 운영 command는 HTTP listener 없는 context를 사용한다.
- 일반 이미지·게시물·정책·outbox·멱등 저장 및 예약 알림 갱신을 실제 TypeORM QueryBuilder로 전환했다.
  PostgreSQL 원자 upsert, lease SKIP LOCKED, catalog/DDL 등의 제한된 SQL은 DB 인프라에 남긴다.
- 실제 DB 통합 **54 pass / 0 fail / 0 skip**, 로그 `orm-runtime-integration.log` (전용 임시 경로).
  build/build:test/lint 및 dev launcher strict 타입 검사 통과. 운영 테스트의 초기 fixture 오류
  (필수 시각/컬럼명/생성시각 순서)은 fixture를 수정한 뒤 재검증했다. 초기 실패 로그도 보존한다.
- built command의 정책 발행·예약 발행·outbox·cleanup, 오류 종료 코드, built main HTTP/health/local media/
  HEAD/SIGTERM을 검증했다. production 모드/Docker 전체 검증과 실제 dev 자동 재빌드는 아직 남아 있다.
- API dev/start, 루트 build/운영 scripts와 Docker CMD를 Nest dist 경로로 변경했다.
  dev.ts는 소스 변경 때 먼저 TS를 컴파일한 뒤 서버를 시작한다. 정식 Docker 검증은 아직 하지 않았다.
- 실제 Nuxt BFF/브라우저 fixture를 Nest로 연결했다. 전체 build 통과, 실제 Chromium 9 pass / 0 fail / 0 skip.
  macOS Chromium은 MachPortRendezvous permission denied로 시작 실패했고, 공식 Docker Playwright
  1.63.0 서버를 loopback 55450에 띄워 같은 assertion을 실행했다. `nest-browser-docker.log`에 통과 결과를 보존한다.
  컨테이너 `blariyo-nest-playwright-20260909`, ID `8de8b7dee5c7526c74c6f4c0b0d7c138d979f2834356f3ade82a654b72384079`.
  권한 확대 없이 공식 connect/exposeNetwork(<loopback>)를 사용한다. 패키지는 읽기 전용 mount이고 저장소 코드를 보내지 않는다.
- Service 단위 테스트 5개를 strict TS로 전환해 통과했고 이전 중복 mjs 2개를 제거했다.
  실제 TS source의 import cycle·Service/Controller SQL/ORM 경계 자동 검사 1개도 통과했다.
  다른 mjs 테스트와 최종 legacy 잔존 검사는 별도로 남아 있다.
- 현재 JDK 25와 기존 Gradle 잠금 의존성으로 Collector test/fixtureClasspath를 검증한 뒤
  실제 Spring 프로세스의 restart/recovery/fencing 테스트를 실행한다.
- 필수 잔여: 전체 앱·테스트·운영 strict 검사/의존성 구조 검사, 모든 기존 실패 회귀의 Nest 연결,
  실제 Spring 재시작/fencing, schema 전체 객체·권한/data/ledger 전후 대조, 최종 Docker,
  백업/독립 복원, legacy 제거와 문서 최종 동기화. 전체 13 lane 완료 전 DONE_LOCAL 금지.
- 전용 PostgreSQL은 현재 기동 중이며 baseline DB/volume을 보존한다. HEAD/index는 변경하지 않았다.

## 명시적 재개 — 2026-09-09 18:15 KST

**IN_PROGRESS. 최신 사용자 지시로 이전 중단과 조건 본문 대기는 해소됐다.**
중단 사본 477개 파일의 해시와 현재 파일이 모두 같고 HEAD/index 동일함을 확인했다.
전용 DB의 ID/볼륨/55449 포트를 확인하고 재기동했다. 추가 구현은 관리자 초안 승격부터 이어간다.
최종 TASK의 전체 완료 조건을 유지하며 부분 통과를 DONE_LOCAL로 판정하지 않는다.

## 최신 상태 — 사용자 요청으로 일시 중단 (2026-09-09 18:13 KST)

**PAUSED_BY_USER. 전체 Nest 전환은 미완료이며 DONE_LOCAL이 아니다.**
최신 중단 요청을 이전 재개 지시보다 우선한다. 추가 구현과 새 테스트 실행은 중단했다.
“기존 지시 중 다음 조건을 변경한다:” 뒤의 본문은 제공되지 않아 조건 변경은 추정하지 않았다.
이 절이 현재 상태이며 아래 IN_PROGRESS/재개/중단 기록은 당시 이력으로 보존한다.

### 테스트와 프로세스 상태

- 직전 통합 테스트 세션 `44367`은 이전 실행에서 exit 0으로 종료됐다. 이번 점검에서는
  핸들이 이미 해제되어 `Unknown process id 44367`을 반환했다.
- 보존 로그 `/private/tmp/blariyo-nest-migration/collector-http-integration.log`를 다시 확인했다:
  합계 **42 pass / 0 fail / 0 skip / 0 cancelled**. 테스트를 새로 실행한 결과는 아니다.
- 직전 구현 구간에서 API build/build:test/lint가 통과했다. 이전 API 단위 테스트는 5 pass이며,
  이번 중단 처리에서는 build/lint/단위 테스트를 재실행하지 않았다.
- 전용 PostgreSQL `blariyo-nest-migration-pg`의 기존 ID, 볼륨과 loopback `55449`를 확인했다.
  `pg_stat_activity`에서 점검 연결을 제외한 client 연결 0건을 확인한 뒤 정상 종료했다.
- Docker 최종 상태: `exited`, exitCode `0`, 종료 `2026-09-09T09:13:23.303398927Z`.
  컨테이너 ID: `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`.
  보존 볼륨: `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1`.
  컨테이너·볼륨・기준선 DB `nest_schema_baseline`은 삭제하지 않았다. 다른 컨테이너는 변경하지 않았다.
- 알려진 작업 테스트 세션은 종료됐다. macOS 전체 프로세스 목록은 sandbox가 `ps`를 거부해
  확인하지 못했다. 시스템 전체에 실행 중인 프로세스가 없다고 단정하지 않는다.

### 완료한 구현과 검증 범위

- 기존 Nest 기반, TypeORM Repository, 공개 API, 관리자 게시물·이미지, 정책, outbox,
  migration, health, 예약 알림과 수집 관리자/lease/result/preview/전환 CLI 코드를 보존했다.
- 직전 구간에서 Collector legacy/V2 HTTP Guard·Pipe·multipart·Controller를 연결했다.
  HMAC receipt/replay, execution 소유 검증, quota 예약, status/execution-state,
  운영 이벤트, PREVIEW_REFRESH와 수집 cleanup의 Service/Repository를 추가했다.
- 원래 V2 테스트의 assertion을 유지한 Nest 연결본 `tests/nest/collection-v2.test.mjs`를 추가했다.
  V2 8개를 포함한 위 42개 통합 테스트는 실제 전용 PostgreSQL에서 통과했다.
  동시 quota 예약 100건, 응답 유실 후 재시도, 실행 소유권 갱신, 후보 정리 후 운영 이력 보존을 포함한다.
- 일부 기존 테스트는 여전히 `.mjs`다. 모든 앱/테스트/운영 코드의 strict TS 전환 완료를 뜻하지 않는다.
- 관리자 후보의 게시물 초안 승격은 아직 Nest에 구현하지 않았다. 다음 구현으로 조사 중 멈췄다.
  API `dev`/`start`는 여전히 기존 Express `src/index.mjs`이며 전체 기본 진입점 전환도 남아 있다.

### 기존 변경과 코드 보존

- 이번 중단 처리의 저장소 파일 수정은 이 `PROGRESS.md` 하나다. 구현 파일은 수정하지 않았다.
- 직전 구간 사본 `collection-checkpoint-20260909-1803`의 461개 파일 중 유실 0개.
  이번 기록 전에는 기존 파일 5개가 구현 과정에서 변경됐고 신규 파일 16개가 추가되어 총 477개다.
  변경된 기존 파일은 AppModule, collection-admin.guard, collection.module, collection.service,
  http/contracts의 TypeScript 파일이다. 이전 소스는 구간 사본에 보존되어 있다.
- HEAD와 Git index는 18:03 구간 사본과 동일하다. 기존 사용자 변경을 되돌리지 않았으며
  commit/push/staging/reset/clean/stash/브랜치 전환/배포를 수행하지 않았다.
- 중단 사본: `/private/tmp/blariyo-nest-migration/stop-20260909-181320.tar.gz`.
  같은 접두사의 `-before-sha256.json`, `-sha256.json`, `-status.txt`, `-head.txt`, `-index.txt`로
  기록 전후 파일과 Git 상태를 비교할 수 있다. 임시 경로의 사본이므로 장기 백업을 대신하지 않는다.

### 재개 시 남은 작업

1. 사용자 재개 지시와 추가 조건을 반영하고 [최종 TASK](../task_list/09/09/TASK.md), 이 기록,
   중단 사본과 현재 worktree/HEAD/index를 대조한다. 전용 DB는 소유 확인 후 필요할 때 재기동한다.
2. 관리자 초안 승격을 구현한다. candidate/receipt 잠금, preview 검증·이미지 준비,
   기존 ImagesService/PostsService 재사용, 최종 transaction의 APPROVED 전환과 receipt를 연결한다.
   외부 storage I/O를 열린 DB transaction 안에 넣지 않는다.
3. 기존 legacy 수집 전체 회귀를 Nest 경로에 연결한다. 새 V2 테스트 fixture는 setup 실패 시에도
   app/pool 정리가 실행되도록 후속 점검한다.
4. 나머지 운영 command/config/remote storage/main, health HTTP/local media/shutdown을 연결한다.
5. 앱·테스트·운영 strict 타입 검사와 최종 검증 진입점을 완성하고, 이전 기능 검증 후
   legacy 실행 코드와 중복 의존성을 정리한다.
6. 최종 TASK의 13개 검증 lane 전체를 수행한다: 실제 DB/API, 빈 DB·기존 DB migration/checksum,
   전체 schema 객체·권한·data·ledger, production 빌드 실행, 실제 Nuxt BFF/브라우저,
   실제 Spring 재시작·복구, 최종 Docker, 백업·독립 복원 후 schema/data/ledger/API 비교.
7. PLAN/DECISIONS/REPORT 및 설계 문서를 최종 구현과 동기화하고 링크·diff를 검수한다.
   현재 문서와 부분 검증 결과를 전체 전환 완료 증거로 사용하지 않는다.

아래는 이전 구현 구간과 재개·중단 당시 기록이다.

## 수집 전환 구현 갱신 — 2026-09-09

**IN_PROGRESS. 이전 중단은 최신 사용자 재개 지시로 해소됐다. 전체 DONE_LOCAL 아님.**

- 재개 기준: `stop-20260909-1740` 사본 434개 파일. 시작 시 해시 차이 0개, HEAD/index 동일.
- 현재 Nest HTTP 연결: 수집 출처 조회/수정, 후보 목록/상세/preview/접수/재시도/반려,
  운영 이벤트 조회/확인. 기능 flag → 관리자 인증 → 수집 maintenance → 계약 검증 순서를 보존했다.
- CollectorLeaseService/Repository: claim/heartbeat, SKIP LOCKED, 재획득·만료, execution 소유 검증.
- CollectorResultService와 CollectionRepository: 결과/이미지 메타데이터/출처 실패 횟수/결과 digest 원자 저장.
- CollectorPreviewService와 CollectorReceiptRepository: 재인코딩 preview·원본 digest·7일 receipt 원자 저장,
  실패 보상 및 commit 응답 유실 시 object 보존. 원본 legacy/V2 HTTP 조합은 아직 미연결이다.
- CollectionOperationsService/Repository와 built `commands/collection-transition.js`: 기존 drain 확인,
  두 테이블 ACCESS EXCLUSIVE 잠금, 엄격 CHECK ADD/VALIDATE, rollback, CLI exit 0/1/2 검증.
- 예약 알림: 실제 DB, 앱 context 종료 후 재기동, 로컬 HTTP 503 재시도, 15분 묶음,
  독립 연결의 numeric lock 경합, 전달 중 발생한 추가 실패 보존을 검증했다.
  실제 cron/production 운영과 Spring 프로세스 재시작 검증을 대신한 것은 아니다.
- 새 TS 테스트 4개 파일은 `tsconfig.test.json`의 strict/강화 옵션으로 컴파일하고 type-aware lint한다.
  기존 mjs 앱/테스트 전체의 타입 검사 전환은 여전히 남아 있다.
- 최근 완료 검증: build/build:test/lint exit 0, API 단위 5 pass.
  uppercase UUID 소유 판정·canonical URL 경쟁까지 포함한 통합 34 pass / 0 fail / 0 skip.
  로그: `/private/tmp/blariyo-nest-migration/collector-current-integration.log`, 세션 `5214` exit 0 확인.
  현재 실행 중인 작업 테스트 핸들은 없다. `git diff --check` 통과.
- 작업 구간의 테스트 자원을 정리했다. 전용 PostgreSQL은 client 연결 0건 확인 후 정상 종료:
  `exited`, exitCode 0, `2026-09-09T09:02:51.381408551Z`. 컨테이너/volume/기준선 DB는 보존했다.
  이는 사용자 중단이나 차단이 아니며 goal은 IN_PROGRESS다. 다음 구간에서 소유 확인 후 재기동한다.
- 구간 사본: `/private/tmp/blariyo-nest-migration/collection-checkpoint-20260909-1803.tar.gz`,
  같은 접두사의 `-sha256.json`, `-status.txt`, `-head.txt`, `-index.txt`.
- 이번 단계의 대표 변경: `apps/api/src/features/collection/*.ts`, `persistence/collection*.ts`,
  `commands/collection-transition.ts`, AppModule, idempotency Repository의 active/expired 옵션,
  4개 `apps/api/test/*.integration.test.ts`, test tsconfig/lint/scripts와 test runner.
  `.gitignore`에는 새 test 빌드 폴더만 추가했다. 기존 사용자 변경을 되돌리지 않았다.

다음 구현:

1. 작업 트리와 구간 사본의 변경을 대조하고 전용 PostgreSQL을 다시 기동한다. 마지막 검증은 정상 종료됐다.
2. Collector legacy/V2 Guard·Pipe·multipart·Controller, V2 HMAC receipt/replay,
   status/execution-state/quota reservation/operational event/PREVIEW_REFRESH를 구현한다.
   기존 `collection-v2.mjs`와 `http/collection-routes.mjs`의 계약·검사 순서를 직접 대조한다.
3. preview 외부 I/O를 열린 DB transaction 안으로 옮기지 않는다. V2 preview receipt는
   CollectorPreviewService 내부의 DB transaction에 포함되며 replay/fencing은 상위 collector 유스케이스가 담당해야 한다.
4. 관리자 초안 승격(이미지 검증/기존 ImagesService·PostsService 재사용), collection cleanup,
   나머지 운영 command/config/remote storage/main 연결을 마무리한다.
5. 기존 mjs 테스트를 최종 Nest 경로/strict 검사에 연결하고 종합 검증 진입점을 완성한다.
6. 최종 TASK의 전체 13 lane, 실제 BFF/브라우저·Spring·최종 Docker·백업/독립 복원과
   schema 전체 객체/권한/data/ledger 검증·문서 동기화는 필수로 남아 있다.

재실행 기본 명령 (전용 DB가 종료돼 있으면 먼저 소유 확인 후 `docker start blariyo-nest-migration-pg`):

```sh
export PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH
export npm_config_cache=/private/tmp/blariyo-nest-migration/npm-cache
npm run build -w @blariyo/api
npm run build:test -w @blariyo/api
npm run lint -w @blariyo/api
TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres node scripts/test-nest-integration.mjs
```

아래는 이전 재개·중단 당시의 기록이며 현행 상태와 구분한다.


## 재개 — 2026-09-09 17:43 KST

**현재 상태: IN_PROGRESS. 최신 사용자 goal의 명시적 재개를 적용한다.**
중단 사본 434개 파일과 현행 파일의 해시가 모두 같고 HEAD/index도 동일함을 확인했다.
전용 DB ID/볼륨을 확인했다. 아래 중단 기록은 과거 이력으로 보존한다.
다음 구현은 수집 전환/운영 이벤트의 Repository·Service·Controller·CLI와 예약 알림 실제 DB 검증이다.
전체 수집 legacy/V2, 주 진입점 전환과 최종 TASK의 모든 검증은 계속 남아 있다.


## 최신 상태 — 사용자 요청으로 일시 중단 (2026-09-09 17:40 KST)

**PAUSED_BY_USER. 전체 Nest 전환은 미완료이며 DONE_LOCAL이 아니다.**
최신 중단 요청을 이전 재개 명세보다 우선 적용했다. “기존 지시 중 다음 조건을 변경한다:” 뒤의
조건 본문은 제공되지 않아 변경 내용을 추정하지 않았다. 추가 구현·새 테스트는 실행하지 않는다.
아래의 이전 재개/중단 내용은 당시 기록이며, 현재 상태는 이 절을 기준으로 한다.

### 실행 상태 확인과 안전 종료

- 실행 중이던 검증 세션 `28657`의 최종 결과를 회수했다: exit 0, 정상 종료.
- 해당 실행의 API typecheck/lint/build는 모두 통과했고, 단위 테스트는 5 pass / 0 fail / 0 skip이다.
- 같은 실행의 Nest 통합 테스트는 14 pass / 0 fail / 0 skip이다.
  로그: `/private/tmp/blariyo-nest-migration/resume-integration.log`.
- 통합 회귀를 다시 실행했지만 예약 실패 알림의 전용 DB/재시작/15분 억제 테스트가 추가된 것은 아니다.
  해당 동작과 숫자 잠금 경합의 별도 검증은 여전히 남아 있다.
- 전용 DB 컨테이너의 ID와 데이터 볼륨이 기존 기록과 같음을 확인했다.
  `pg_stat_activity`에서 점검 연결을 제외한 client 연결 0건을 확인한 뒤 정상 종료했다.
- `blariyo-nest-migration-pg`: `exited`, exitCode 0,
  종료 시각 `2026-09-09T08:40:40.972267838Z` (KST 17:40:40).
  컨테이너와 데이터 볼륨은 삭제하지 않았다. 다른 사용자 컨테이너는 변경하지 않았다.
- 확인한 작업 도구 세션은 종료됐다. macOS 전체 프로세스 목록은 sandbox의 `ps` 실행 거부로
  확인하지 못했으므로 시스템 전체에 실행 프로세스가 없다고 단정하지 않는다.

### 완료한 변경과 보존 확인

- 기존 Nest 기반·공개 API·이미지·게시물·outbox·정책·migration·health·예약 알림 전환 코드는
  아래 구현 목록대로 보존했다. 구현 범위와 검증 범위는 구분한다.
- 직전 재개 이후: DataSource의 `dropSchema: false` 명시, PLAN의 최종 명세 참조와 Core health
  경로 수정, `docs/migration/TASK.md` 진입점 추가, 진행 기록 갱신을 수행했다.
- 이번 중단 처리에서 저장소 파일 수정은 이 `PROGRESS.md`에 한정한다.
- 재개 기준선 433개 파일 중 유실 0개. 이번 기록 전 변경 파일은
  `apps/api/src/persistence/database.ts`, `docs/migration/PLAN.md`, 이 문서 3개이며 TASK 진입점은 신규다.
- 최초 기준선 356개 파일도 유실 0개. 기존 5개 승인 범위 변경 외 351개는 SHA-256이 동일하다.
  기존 API `.mjs`, SQL, OpenAPI, 원래 테스트, Web/Spring 코드를 되돌리거나 삭제하지 않았다.
- HEAD와 Git index는 `resume-head.txt`, `resume-index.txt`와 동일하다.
  commit/push/staging/reset/clean/stash/브랜치 변경/배포를 수행하지 않았다.
- 중단 시점 사본과 해시·Git 기록은 `/private/tmp/blariyo-nest-migration/stop-20260909-1740.*`
  및 같은 접두사의 `-sha256.json`, `-status.txt`, `-head.txt`, `-index.txt`에 보존한다.

### 남은 작업과 다음 시작점

1. 사용자 재개 지시와 추가 변경 조건을 받은 뒤 최종 TASK 및 이 중단 기록을 대조한다.
2. worktree/HEAD/index와 중단 사본을 확인하고, 필요할 때만 전용 PostgreSQL을 재기동한다.
3. 예약 알림의 DB·재시작·동시성·15분 억제 검증을 추가한다.
4. collection legacy/V2의 Repository·Service·Controller·Guard 전환을 구현한다.
   legacy 파일 전체와 operations/transition은 조사했지만 collection TS 전환은 아직 시작하지 않았다.
5. cleanup·transition·운영 CLI·remote storage/config·health HTTP·local media·shutdown을 전환/검증한다.
6. `main.ts` 주 진입점과 npm/scripts/Docker/테스트를 연결한다.
   현재 API dev/start는 여전히 기존 Express `src/index.mjs`다.
7. 모든 기능 이전과 검증 뒤 기존 실행 코드·중복 의존성을 정리한다.
8. 최종 TASK의 전체 검증을 수행한다: 앱/테스트/운영 strict 타입 검사, lint/구조, 단위·실제 DB·API,
   빈 DB/기존 DB migration·checksum·전체 schema/data, production 빌드 실행,
   실제 Nuxt BFF/브라우저, 실제 Spring 재시작·복구, 최종 Docker,
   백업과 독립 DB 복원 후 schema/data/ledger/API 대조, 문서·링크·최종 diff 검수.

## 이전 기록 (현재 상태 아님)


## 명시적 재개 — 2026-09-09

**현재 상태: IN_PROGRESS. 이전 중단·조건 본문 대기는 최종 명세로 해소됐다.**

- 최종 사용자 명세: [TASK](../task_list/09/09/TASK.md). 기존 중단 기록은 아래에 과거 이력으로 보존한다.
- goal 도구 readback: 갱신된 Nest 전환 목표가 active임을 확인했다.
- 재개 기준선: main 작업 트리 433개 파일. paused snapshot 대비 TASK.md만 사용자 변경됨.
- 재개 backup/index/HEAD/status: `/private/tmp/blariyo-nest-migration/resume.tar.gz`, `resume-sha256.json`, `resume-index.txt`, `resume-head.txt`, `resume-status.txt`.
- 보존 컨테이너 ID `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`, 이름 `blariyo-nest-migration-pg`, loopback 55449.
  볼륨 `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1` 소유·마운트 확인. 재기동 후 새 고유 DB에서만 반복 테스트한다.
- 실행 순서: 기존 Nest 재검증/예약 알림 → 수집 legacy/V2와 운영 경로 → Nest 주 진입점 → 전체 최종 검증·문서.
- 완료 gate: 최종 명세 §10의 13개 lane, 실제 브라우저·Spring·Docker·백업/격리 복원 포함. 모두 통과하기 전 DONE_LOCAL 금지.
- 재개 이후에도 commit/push/배포/임의 staging/브랜치 변경/실제 수집·Discord 발송은 금지.

### 재개 전 중단 기록

**상태: 사용자 요청으로 일시 중단. 전체 전환 미완료.**

- 중단 기록: 2026-09-09T17:16:25+09:00
- 사용자 지시: 안전한 지점에서 작업 중단, 실행 상태 확인, 코드와 기존 사용자 변경 보존.
- 사용자가 “기존 지시 중 다음 조건을 변경한다:”까지 작성했으나 변경할 조건의 본문은 아직 제공하지 않았다.
  조건 변경은 추정하지 않았고, 추가 구현은 재개 지시 전까지 진행하지 않는다.
- 목표를 완료 또는 기술적 BLOCKED로 처리하지 않았다. 이번 상태는 사용자 요청에 따른 일시 중단이다.

## 현재 실행 상태

- 본 작업에서 실행한 테스트·빌드·포맷터의 도구 세션은 모두 종료 결과를 확인했다. 실행 중인 테스트 핸들은 없다.
- 마지막 `typecheck`, `lint`, API `build`는 모두 exit 0. 그 뒤 애플리케이션 소스 수정 없이 중단 기록만 작성했다.
- 전용 PostgreSQL `blariyo-nest-migration-pg`는 다른 client 연결이 없음을 `pg_stat_activity`로 확인한 뒤 정상 종료했다.
  Docker readback: `status=exited`, `exitCode=0`, 종료 `2026-09-09T08:15:16.887794299Z`.
- 컨테이너·데이터 볼륨은 삭제하지 않았다. 재개 시 `docker start blariyo-nest-migration-pg`로 다시 사용할 수 있다.
- 기존 PostgreSQL 컨테이너와 다른 사용자 서비스는 변경하지 않았다.
- macOS 전체 프로세스 목록은 sandbox가 `ps` 실행을 거부하여 확인하지 못했다. 종료 확인은 본 작업의 도구 세션과 전용 Docker 컨테이너 범위다.
- Nest 서버는 테스트 fixture 안에서만 기동했고 각 테스트 종료 시 닫았다. production/개발 서버를 별도로 띄우지 않았다.

## 사용자 기준선 보존

- 브랜치 `main`, 시작 당시 HEAD와 현재 HEAD 동일. stash/reset/clean/commit/push/배포 미수행.
- 최초 기준선 356개 파일 중 유실 0개. 아래 5개를 제외한 351개는 시작 당시 SHA-256과 동일하다.
- 아래 5개는 이번 요청 범위에서 변경한 파일이며, 원본은 baseline archive에 보존했다.

- `apps/api/package.json`
- `docs/system-design/08-code-structure.md`
- `package-lock.json`
- `packages/contracts/package.json`
- `docs/system-design/01-system-architecture.md`

- 기존 API `.mjs` 전체, SQL migration/down SQL, OpenAPI, 기존 테스트, Web/Spring source는 기준선과 바이트가 같다.
- 시작 사본: `/private/tmp/blariyo-nest-migration/baseline.tar.gz`
- 시작 해시·Git: `baseline-sha256.json`, `baseline-status.txt`, `baseline-head.txt` (같은 디렉터리).
- 중단 사본: `/private/tmp/blariyo-nest-migration/paused.tar.gz`
- 중단 파일 해시·Git: `paused-sha256.json`, `paused-status.txt` (같은 디렉터리).
- 새 TypeScript·테스트·문서는 현재 worktree에 그대로 보존했다. 중단을 위해 코드나 의존성을 되돌리지 않았다.

## 구현한 전환 코드

다음은 작성된 코드의 범위이며, 전체 애플리케이션 완료를 뜻하지 않는다.

| 영역 | 작성한 코드 / 상태 |
| --- | --- |
| 설계·대응표 | [PLAN](PLAN.md)에 39개 HTTP operation 및 운영 명령 대응, [DECISIONS](DECISIONS.md), [REPORT](REPORT.md), 기술 정본 01/08 갱신 |
| 기반 | Nest 11.2.3, TypeORM 0.3.31, strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes |
| 영속성 | 17개 entity / 224개 column, identity·bigint·Date·Buffer 매핑, synchronize/migrationsRun false |
| UnitOfWork | QueryRunner·AsyncLocalStorage, 중첩 transaction, session/xact advisory lock, 숫자 lock namespace |
| 공개 | Public Module/Controller/Service/Repository/DTO: 게시판·목록·상세·조회 수·공개 정책 |
| 이미지 | Images Module/Controller/Service/Repository: decode/re-encode·업로드·preview·폐기·보상 outbox |
| 게시물 | Posts Module/Controller/Service/Repository: 초안·수정·발행·예약·취소·숨김·재발행·삭제·동시 due |
| outbox | Outbox Service/Repository/OperationsModule: claim·lease·fencing·삭제·cache purge·재시도 |
| 정책 | Policies Module/Service/Repository: artifact checksum·시행 순서·정제·발행·원자적 outbox |
| migration | Migrations Module/Service/Repository, `commands/migrate.ts`: 기존 SQL/ledger/grant 유지 |
| health | Health Module/Controller/Service/Repository: liveness/readiness 작성, readiness Repository 검증 |
| 예약 실패 알림 | ScheduleAlerts Service/Repository·webhook adapter·OperationsModule 등록 작성, 타입/린트/빌드만 검증 |
| HTTP | ContractPipe·AdminGuard·ExceptionFilter·envelope/binary interceptor·multipart transport 경계 |
| 공유 타입 | 생성 OpenAPI 타입 export 및 런타임 함수의 unknown 입력 타입 선언 |

**주 실행 경로 `apps/api/src/index.mjs`와 `npm run dev:api`/API start는 아직 기존 Express다.**
현재 Nest fixture는 전환한 도메인을 직접 처리하며 기존 Express 라우터에 위임하지 않는다.
최종 주 실행 교체와 기존 `.mjs` 제거는 아직 수행하지 않았다.

## 실제 검증 결과와 한계

| 검증 | 결과 | 적용 범위 / 증거 |
| --- | --- | --- |
| 전환 전 `npm test` | 18 pass / 9 skip / 0 fail | DB 미설정 기준, `baseline-unit.log` |
| 전환 전 `npm run build` | exit 0 | 기존 Nuxt build, `baseline-build.log`; 기존 API에는 TS build/lint가 없었음 |
| 전환 전 기존 격리 DB 회귀 | 53 pass / 0 skip / 0 fail | `baseline-integration.log` |
| `npm run typecheck -w @blariyo/api` | exit 0 | 마지막 예약 알림 추가 포함 TS 전환분. 남은 mjs까지 검사했다는 의미가 아님 |
| `npm run lint -w @blariyo/api` | exit 0 | 마지막 예약 알림 추가 포함 TS 전환분 |
| `npm run build -w @blariyo/api` | exit 0 | 마지막 예약 알림 추가 포함 API `dist/` 생성 |
| `npm run test:unit -w @blariyo/api` | 5 pass / 0 fail | 공개·이미지 Mock Repository 테스트. 이후 정책/예약 알림 등의 단위 테스트 추가·재검증 필요 |
| `node scripts/test-nest-integration.mjs` | 합계 14 pass / 0 skip / 0 fail | 관리자 6, 공개 4, 이미지 1, DB/ORM 1, migration 1, 정책 1. `nest-integration.log` |

로그 디렉터리: `/private/tmp/blariyo-nest-migration/`.

최근 Nest 통합 검증은 정책·TypeORM migration·health Repository까지 반영한 상태에서 실행했다.
그 뒤 추가한 **예약 실패 알림 서비스와 숫자 session lock 분기는 타입/린트/빌드만 통과**했으며,
전체 통합 검증을 다시 실행하기 전에 사용자 요청으로 중단했다.

검증 세부 사항:

- DB: 17개/224개 metadata, 전후 컬럼·제약·인덱스 동일, 중첩 rollback, REPEATABLE READ,
  read-only write 거부, 두 DataSource 간 잠금 경합과 해제.
- 관리자: 이미지 소유권·멱등 재시도/충돌·version, 게시→숨김→outbox 장애 복구→재발행→삭제,
  예약 취소와 동시 due worker 1회 발행. 새 TypeORM OutboxService 경로로 통과했다.
- 정책: checksum·시행 window·HTML 정제·이력·중복 발행·outbox 실패 시 rollback.
- migration: 기존 V001–V005 전체 down/up, ledger checksum, 제한 role에서 readiness 및 ledger 접근 차단.
- 기존 테스트 assertion은 수정하지 않았다. `tests/nest`의 원본 기반 회귀는 fixture/주입 경로를 Nest로 바꾼 추가 테스트다.
- 마지막 전환 후 전체 기존 53개/BFF/Spring/브라우저/Docker/production build smoke는 아직 실행하지 않았다.

## 남은 작업 / 재개 지점

1. 먼저 사용자가 이어서 전달할 변경 조건을 반영하고 작업 범위를 다시 확인한다. 현재 조건을 추정하지 않는다.
2. 저장소·중단 snapshot·최종 Git 상태를 대조하고 전용 PostgreSQL을 다시 시작한다.
3. 예약 실패 알림의 실제 DB/재시작/동시성/15분 억제 검증 및 변경 후 전체 Nest 회귀를 실행한다.
4. `features/collection/collection.mjs`와 `collection-v2.mjs`의 도메인 모델·Repository·Service 전환.
   마지막 조사는 legacy 파일 1–490행까지 읽었으며 어떤 collection 소스도 아직 변경하지 않았다.
   admin 출처/후보/검수/반려/승격, legacy/V2 quota·lease·receipt·execution/version fencing·preview 보존이 필요하다.
5. collection 인증/권한/전환 gate를 Guard/Pipe로, HTTP 분기를 명시적 도메인 Controller로 이전한다.
6. cleanup·collection-transition·운영 command CLI 및 remote storage/config를 전환한다.
7. health의 실제 HTTP 상태 코드, local media, maintenance 입력 처리 순서, 모든 header/body/multipart 경계,
   production 기동 조건·shutdown을 검증한다.
8. `main.ts`를 주 진입점으로 연결하고 npm/scripts/Docker/테스트 import를 갱신한다.
   모든 경로가 이전된 뒤 불필요한 기존 Express `.mjs`·중복 테스트·의존성을 제거한다.
9. 전체 타입/린트/단위/격리 DB/API/BFF/Spring/E2E/production build/빌드 프로세스 smoke 검증.
10. 구조 검사에 TS 소스·DI·Repository 경계를 반영하고 schema/OpenAPI/범위 밖 파일 해시·링크·최종 보고를 검수한다.

재개 환경:

```sh
export PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH
export npm_config_cache=/private/tmp/blariyo-nest-migration/npm-cache
docker start blariyo-nest-migration-pg
export TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres
```

55449는 이번 작업 전용 loopback 포트다. 테스트 runner는 고유 DB를 생성하고 자신이 만든 DB만 삭제한다.

## 신규/변경 산출물 목록

시작 기준선에서 변경한 파일 5개는 위 보존 절에 열거했다. 나머지 신규 산출물:

- `apps/api/eslint.config.mjs`
- `apps/api/src/adapters/schedule-webhook.ts`
- `apps/api/src/adapters/storage.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/bootstrap/application.ts`
- `apps/api/src/commands/migrate.ts`
- `apps/api/src/commands/migrations.module.ts`
- `apps/api/src/commands/migrations.repository.ts`
- `apps/api/src/commands/migrations.service.ts`
- `apps/api/src/features/health/health.controller.ts`
- `apps/api/src/features/health/health.module.ts`
- `apps/api/src/features/health/health.repository.ts`
- `apps/api/src/features/health/health.service.ts`
- `apps/api/src/features/images/image-validation.ts`
- `apps/api/src/features/images/images.controller.ts`
- `apps/api/src/features/images/images.module.ts`
- `apps/api/src/features/images/images.repository.ts`
- `apps/api/src/features/images/images.service.ts`
- `apps/api/src/features/policies/policies.module.ts`
- `apps/api/src/features/policies/policies.repository.ts`
- `apps/api/src/features/policies/policies.service.ts`
- `apps/api/src/features/policies/policy-artifact.ts`
- `apps/api/src/features/posts/posts.controller.ts`
- `apps/api/src/features/posts/posts.dto.ts`
- `apps/api/src/features/posts/posts.model.ts`
- `apps/api/src/features/posts/posts.module.ts`
- `apps/api/src/features/posts/posts.repository.ts`
- `apps/api/src/features/posts/posts.service.ts`
- `apps/api/src/features/public/public.controller.ts`
- `apps/api/src/features/public/public.dto.ts`
- `apps/api/src/features/public/public.module.ts`
- `apps/api/src/features/public/public.repository.ts`
- `apps/api/src/features/public/public.service.ts`
- `apps/api/src/http/auth.guard.ts`
- `apps/api/src/http/contracts.ts`
- `apps/api/src/http/multipart.ts`
- `apps/api/src/http/response.ts`
- `apps/api/src/operations/operations.module.ts`
- `apps/api/src/operations/outbox.repository.ts`
- `apps/api/src/operations/outbox.service.ts`
- `apps/api/src/operations/schedule-alerts.repository.ts`
- `apps/api/src/operations/schedule-alerts.service.ts`
- `apps/api/src/persistence/database.ts`
- `apps/api/src/persistence/entities.ts`
- `apps/api/src/persistence/health.repository.ts`
- `apps/api/src/persistence/idempotency.repository.ts`
- `apps/api/src/persistence/images.repository.ts`
- `apps/api/src/persistence/migrations.repository.ts`
- `apps/api/src/persistence/outbox.repository.ts`
- `apps/api/src/persistence/persistence.module.ts`
- `apps/api/src/persistence/policies.repository.ts`
- `apps/api/src/persistence/posts.repository.ts`
- `apps/api/src/persistence/public.repository.ts`
- `apps/api/src/persistence/rows.ts`
- `apps/api/src/persistence/schedule-alerts.repository.ts`
- `apps/api/src/shared/canonical.ts`
- `apps/api/src/shared/errors.ts`
- `apps/api/src/shared/idempotency.repository.ts`
- `apps/api/src/shared/storage.ts`
- `apps/api/src/shared/unit-of-work.ts`
- `apps/api/test/images.service.test.mjs`
- `apps/api/test/public.service.test.mjs`
- `apps/api/tsconfig.json`
- `docs/migration/DECISIONS.md`
- `docs/migration/PLAN.md`
- `docs/migration/PROGRESS.md`
- `docs/migration/REPORT.md`
- `docs/task_list/09/09/TASK.md`
- `packages/contracts/src/index.d.mts`
- `scripts/test-nest-integration.mjs`
- `tests/nest/admin.test.mjs`
- `tests/nest/database.test.mjs`
- `tests/nest/helpers.mjs`
- `tests/nest/images.test.mjs`
- `tests/nest/migrations.test.mjs`
- `tests/nest/policies.test.mjs`
- `tests/nest/public.test.mjs`
