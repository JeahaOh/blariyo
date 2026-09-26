# Nest / TypeORM 전환 결정

- 기준: 2026-09-09 사용자 지시. TypeORM은 필수이며 다른 ORM은 검토하지 않는다.
- 전환 범위: 9월 9일 당시 미출시 M0 Core 내부 구현. 제품·API·DB 계약과 Nuxt BFF → Core, legacy Spring → BFF → Core 경계 유지.
- 검토일: 2026-09-24, 현재 소스·migration·실행 기록 정적 대조. 아래 수치·시험 결과는 별도 표시가 없으면 9월 9일 전환 기준선이다.
- 전환 당시 완료 근거는 [PROGRESS](../../worklog/2026-09-09/nest-transition/PROGRESS.md), 요구사항은 [PLAN](../../worklog/2026-09-09/nest-transition/PLAN.md)에 보존한다. 현재 구현/운영 상태는 [현황](../status.md)과 [운영 상태](../operations/current-status.md)를 따른다. 후속 direct batch → 공유 DB/R2 경로는 [수집 설계](07-spring-collector-design.md)의 별도 계약이다.

## 의존성 및 실행 구조

Nest 11의 기본 Express adapter를 사용한다. HTTP 라우트는 도메인별 Controller에 명시적으로 등록한다.
Service는 유스케이스, 입력 Pipe는 기존 OpenAPI 검증, Guard는 인증·인가, Filter는 기존 오류 envelope,
Interceptor는 응답 검증·헤더·상태 코드를 담당한다. Controller에 Express 객체를 전달하지 않는다.
multipart·binary·raw body는 HTTP transport 경계에서만 처리하며 256KB JSON, 조회 수의 빈 body,
이미지 101MB/수집 preview 11MB 상한을 유지한다. Nest 기본 POST 201에 의존하지 않는다.

Repository는 추상 클래스 DI 토큰과 TypeORM 구현으로 분리한다. 도메인 모델은 ORM 엔티티와 별개다.
Controller DTO는 `@blariyo/contracts/api` 생성 타입을 사용한다. 검증 스키마를 새로 복제하지 않는다.
`@blariyo/contracts`의 런타임 선언은 입력을 unknown으로 받아 boolean을 반환하는 실제 함수를 기술한다.

## 데이터와 트랜잭션

- TypeORM 0.3의 DataSource / QueryRunner와 PostgreSQL driver를 사용한다.
- 전환 기준선 SQL V001–V005, down SQL과 기존 checksum ledger를 변경하지 않는다. 후속 migration은 V008까지 추가됐으며 적용된 파일을 소급 수정하지 않는다.
- `synchronize: false`, `dropSchema: false`, `migrationsRun: false`. 엔티티별 synchronize도 false로 둔다.
- identity PK를 `PrimaryGeneratedColumn('identity')`, bigint를 string, timestamptz를 Date,
  bytea를 Buffer, JSONB를 unknown으로 매핑한다. ORM이 초기화하는 엔티티 필드에만 `!`를 허용한다.
- 전환 당시 17개 테이블 224개 컬럼의 metadata를 실제 격리 DB와 대조했다. 현재는 source discovery policy·batch review·receipt Entity가 추가됐으므로 이 수치를 전체 현행 DB로 사용하지 않는다. 새 변경은 컬럼/제약/인덱스의 전후 catalog를 비교한다.
- SQL migration이 인덱스·제약·trigger의 정본이다. Entity metadata에서 DDL을 생성하지 않는다.
- UnitOfWork는 AsyncLocalStorage로 QueryRunner를 공유한다. 여러 Repository가 같은 트랜잭션에 참여한다.
  Service는 DataSource/EntityManager/QueryRunner를 받지 않는다.
- 공개 목록·상세는 REPEATABLE READ READ ONLY snapshot을 유지한다.
- 게시물 잠금 key는 기존 `post-storage:<postId>`, 멱등성 key는 기존 actor/scope/key 조합을 유지한다.
  session advisory lock을 object I/O, commit, 보상 처리 전체에 유지하고 외부 I/O 중 SQL transaction은 열지 않는다.
- lease 잠금 CTE·quota의 단일 DB 시각·예약 실패 알림 원자 upsert 등 제한된 예외만 내부 매개변수 SQL로 유지한다.
  일반 fencing·outbox·receipt 처리는 Entity/QueryBuilder를 사용하며 아래 raw SQL 목록에서 예외별 근거를 구분한다.
- UPDATE의 statement_timestamp와 DB now() 기준을 보존한다. 프레임워크 timestamp/version 자동 증가로 바꾸지 않는다.

## 직렬화 / 성능

외부 bigint의 number 변환과 ISO UTC Date 문자열은 기존 공개 계약대로 DTO에서 수행한다.
공개 목록 20개, 관리자 목록 50개, 정렬 및 공지 순서를 유지한다. 본문 이미지 조회는 블록마다 쿼리하지 않고
일괄 조회한다. 기존 부분 인덱스가 사용하는 상태·시간 predicate를 유지한다.

## 운영 및 이행

개발 중 도메인 단위 검증은 허용하지만 최종 주 실행 경로는 단일 Nest 앱이어야 한다.
기존 Express 서비스에 위임하는 wrapper로 완료 처리하지 않는다. 기존 함수는 해당 도메인의 회귀 검증과
운영 명령 이전이 끝난 뒤 제거한다. 9월 9일 전환 작업은 commit/push/배포 없이 사용자 기준선을 보존했다. 이후 작업 권한은 현재 사용자 요청과 AGENTS.md를 따르며 당시 제한을 영구 배포 금지로 해석하지 않는다.

참고: [Nest 공식 시작 문서](https://docs.nestjs.com/first-steps),
[TypeORM DataSource](https://typeorm.io/docs/data-source/data-source-api/),
[Nest 데이터베이스 문서](https://docs.nestjs.com/techniques/database).

## 수집 전환·운영 이벤트 경계

CollectionOperationsService는 Spring readiness와 drain/엄격 제약 적용 순서를 소유한다.
Repository는 이벤트 TypeORM 조회·원자적 확인, schema readiness/catalog 점검 및 기존 전환 DDL을 맡는다.
전환 apply는 기존처럼 두 테이블 ACCESS EXCLUSIVE 잠금 아래 drain 검사와 ADD/VALIDATE를
한 트랜잭션으로 실행한다. 이는 기존 명시적 운영 명령의 보존이며 기동 시 schema 변경이 아니다.
운영 이벤트 Controller는 관리자 인증·기능 flag·maintenance·기존 OpenAPI를 적용한다.
CLI는 listener 없는 Nest application context를 사용한다. 남은 수집 서비스와 같은 모듈 경계를 재사용한다.

이벤트 확인의 eventId는 기존 OpenAPI path parameter `format: uuid`다. 기존 공통 validator가
path를 건너뛰어 잘못된 UUID가 PostgreSQL 22P02/HTTP 500까지 내려가던 오류를 Controller에서
400 VALIDATION_FAILED로 처리한다. 유효한 미존재 UUID의 404 EVENT_NOT_FOUND는 유지한다.
정본은 변경하지 않았고 `collection-operations.integration.test.ts`에서 두 경우를 검증한다.

수집 일반 조회·설정·후보 상태·preview·receipt 저장은 실제 Entity/QueryBuilder를 사용한다.
claim과 만료는 기존 PostgreSQL SKIP LOCKED/잠금 CTE를 유지하고 source는 batch 조회하여
claim 개수에 비례한 출처 조회를 피한다. V2 preview의 파일 업로드는 DB transaction 전에 실행하며
메타데이터와 receipt를 같은 transaction에 기록한다. 실패 후 DB가 object 참조 없음으로 확인한 경우만
파일을 보상 삭제한다. commit 응답 유실로 참조가 남은 경우 파일과 receipt를 보존한다.

## 관리자 수집 초안 승격

CollectionPromotionService가 후보/멱등 key session 잠금 아래 이미지 준비를 수행한다.
ImagesModule과 PostsModule의 동일한 DI 등록을 재사용하고 저장·상태 전이는 기능 Repository로 처리한다.
외부 storage I/O 뒤 최종 transaction에서 후보/version과 이미지 STAGED 소유권을 다시 확인하고,
게시 초안·후보 승인·preview 삭제 outbox·24시간 POST receipt를 원자 저장한다.
준비된 STAGED 이미지는 최종 실패 시 기존 정리 정책을 유지하며 자동 발행하지 않는다.

## 실제 브라우저 실행 환경

macOS 프로세스 권한 제한으로 Chromium 시작이 실패하면 동일 버전의 공식 Playwright Docker 서버를
작업 전용 loopback 55450에서 실행한다. 테스트는 BrowserType.connect의 exposeNetwork를 loopback에만
제한하고 실제 Nuxt/DB/브라우저 assertion을 유지한다. 가짜 브라우저나 HTML 조회로 대체하지 않는다.
근거: [Playwright Docker](https://playwright.dev/docs/docker),
[BrowserType.connect](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-option-expose-network).

## 전체 schema dump와 복원 비교

원본 SQL 기준선과 Nest 신규 설치/재기동 전후는 전체 pg_dump schema를 비교한다.
복원 시 PostgreSQL이 CHECK 배열 캐스트를 배열 전체에서 각 원소 캐스트로 재표현하므로,
별도 폐기 DB에 원본 schema를 같은 PostgreSQL parser로 재생한 정규화 기준선과 복원 schema를 비교한다.
DDL/ACL 문장은 제외하지 않으며, pg_dump 18의 무작위 psql restrict 토큰만 텍스트 비교에서 제거한다.
행·migration ledger/checksum·sequence 상태는 별도로 전체 비교한다.

## 개발 감시와 HTTP 예외 보존 보완

개발 진입점은 TypeScript 내장 DynamicPriorityPolling watch를 사용한다. native Node recursive watch가
실행 환경에서 EMFILE로 실패해도 파일 수 제한·시스템 설정을 변경하지 않는다. 컴파일 오류 시 emit과
재기동을 막고 마지막 정상 Nest 프로세스를 유지하며, 성공한 컴파일 후에만 SIGTERM으로 교체한다.
compiled main은 production과 동일하고 개발 감시 프로세스는 운영 기동에 포함되지 않는다.

Nest routes-resolver는 parser SyntaxError를 BadRequestException으로 재포장한다. 기존 JSON parse 오류를
HTTP parser 직후 ApiError로 변환하고 Nest Filter에서 400 VALIDATION_FAILED를 출력하여 계약을 유지한다.
일반 예외를 모두 400으로 바꾸지 않는다. 관리자 HEAD 등 미지원 method는 인증 전에 operation을 확인하고,
수집 prefix의 미등록 경로는 기존 CANDIDATE_NOT_FOUND를 반환한다. 기존 정본·OpenAPI는 변경하지 않았다.

## Web 타입 검사와 테스트 fixture 전환

Nuxt build는 타입 검사를 대신하지 않으므로 vue-tsc 3.3.11과 `nuxt typecheck`를 개발 검사로 추가한다.
Nuxt app/server/node/shared 네 생성 tsconfig 모두 strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes,
기존 mjs 유틸리티에는 checkJs를 적용한다. 생성 설정을 직접 수정하지 않고 nuxt.config.ts에서 설정한다.
화면 응답 타입은 기존 OpenAPI의 생성 타입에서 가져오며 BFF는 기존 canonical validateResponse와
projectResponse를 계속 실행한다. 수동 Swagger 정본이나 서버 Entity를 화면 타입으로 가져오지 않는다.
DOM·SDK·catch 입력과 null 상태는 실제 값 확인으로 좁히며 any나 검사 제외로 오류를 숨기지 않는다.
근거: [Nuxt TypeScript](https://nuxt.com/docs/4.x/guide/concepts/typescript), 설치된 Nuxt kit/Nitro의 설정 생성 코드.

browser/Spring fixture는 strict TS로 전환하여 실제 Nest migration context와 TypeORM DataSource를 사용한다.
테스트 SQL 결과는 QueryRunner의 records/affected를 검사해 기존 rows/rowCount assertion을 유지한다.
업무 코드에 호환 계층을 추가하지 않는다. 전용 임시 DB와 생성된 자원만 teardown하며 원래 baseline을 보존한다.

## Entity 외래키 관계 매핑 보완

실제 baseline PostgreSQL catalog에 존재하는 외래키 15개를 Entity의 명시적 ManyToOne/JoinColumn으로
매핑한다. `board_post_block(post_id,image_id)`의 복합 참조도 두 컬럼을 모두 사용한다.
외래키 컬럼 자체와 기존 SQL이 정본이며 관계 메타데이터로 DDL을 생성하지 않는다.
관계에는 cascade/eager/lazy/persistence/createForeignKeyConstraints를 false로 명시하고,
nullable 및 ON DELETE/UPDATE는 기존 FK와 맞춘다. 업무 갱신은 기존 Repository의 FK 컬럼 연산으로 유지한다.
`Relation<T>`와 callback target을 사용해 ES module의 선언 순서 및 decorator reflection 순환 문제를 피한다.
관계 필드는 실제로 로드할 때만 존재하므로 선택 속성이며 무조건 존재한다고 단언하지 않는다.

검증은 catalog FK와 전체 관계 join 컬럼/참조 테이블/삭제·수정 정책 대조, 각 관계의 실제 JOIN 실행,
복합 관계가 올바른 이미지와 TEXT 블록의 null을 반환하는 readback 및 전후 전체 catalog 비교로 수행한다.
근거: 설치된 TypeORM 0.3.31의 RelationOptions/Relation 타입과
[관계·JoinColumn 공식 설명](https://typeorm.io/docs/relations/relations/).
현재 공식 웹 문서는 1.0 안내도 표시하므로 선택한 0.3.31을 임의 업그레이드하지 않고 설치본과 실제 DB로 검증한다.

## Docker production 검증의 외부 대역

최종 Docker 검증은 실제 빌드된 Core·Nuxt를 NODE_ENV=production으로 기동한다.
전용 internal Docker network 안에서 합성 정책 artifact와 서명된 Access JWT/JWKS, S3/CDN HTTP 대역을 사용한다.
실제 정책 발행 CLI의 root 소유·0600 검사를 통과한 뒤 Core를 시작하며 제품의 기동 검증을 우회하지 않는다.
테스트 전용 --import 모듈은 정확히 지정한 CDN/JWKS URL만 로컬 대역으로 연결하고 예상 밖 fetch를 거부한다.
이 모듈·대역은 검증 때 readonly bind mount하며 운영 image·애플리케이션 소스에 포함하지 않는다.
인증·발행·숨김·정책·운영 명령과 health/maintenance/SIGTERM 종료를 실제 프로세스로 확인한다.
실제 외부 계정·R2/CDN·Access 운영 검증과는 구분한다.

Docker internal network는 host port publish를 제공하지 않아 최초 production 실행에서 proxy port 조회가 실패했다.
Core·Nuxt·DB·외부 대역은 internal network에 유지하고, 고정된 Nuxt로만 전달하는 테스트 ingress proxy에만
별도의 작업 전용 bridge를 연결한다. host port는 loopback에만 publish한다.
유지보수 모드의 기존 health readiness는 schema 준비 여부이며 공개 GET은 계속 제공한다.
쓰기 차단은 유효한 관리자 command의 503/Retry-After:60/no-store와 CLI 거부로 검증하며,
health를 503으로 바꾸는 새 동작을 도입하지 않는다. 근거: 04-infrastructure-design의 복원·쓰기 차단 계약.

## raw SQL의 제한된 예외 목록

일반 목록·조회·갱신은 Entity/Repository/QueryBuilder로 처리하는 것이 전환 계약이다. 아래 전환 당시 raw SQL도 모두
DatabaseContext의 TypeORM manager 또는 같은 QueryRunner를 사용한다. 외부 입력은 값 매개변수로 전달한다.

2026-09-24 대조에서 후속 `batch-result.repository.ts`, `batch-review.repository.ts`의 일반 조회·갱신·receipt와 `collection.repository.ts`의 `discoveryAllowed`가 직접 SQL을 사용하는 차이를 확인했다. 이는 아래의 기존 예외 승인 근거로 자동 포괄하지 않는다. TypeORM manager와 매개변수는 사용하지만 일반 ORM 처리 계약과의 정합성은 [로드맵](../roadmap.md)에서 후속 정리한다. batch 목록의 항목별 재조회도 존재하므로 아래의 과거 공개/관리자 게시글 쿼리 수를 direct 검수 목록에 적용하지 않는다.

| 파일 (persistence/)                 | 예외와 이유                                                                                     | 검증                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| database.ts                         | READ ONLY transaction, session/xact advisory lock·unlock. PostgreSQL 연결 수명과 잠금 의미 보존 | database/migrations 통합, 동시 요청  |
| migrations.repository.ts            | 기존 ledger 준비·checksum 기록, 원래 SQL 실행·권한 GRANT. 별도 TypeORM migration 이력 미생성    | migrations/schema-restore 통합       |
| health.repository.ts                | 보안 함수 ops.is_schema_ready, catalog 및 역할별 schema/table/sequence 권한 확인                | migrations/core-isolation/HTTP 경계  |
| cleanup.repository.ts               | collect 테이블 부재를 to_regclass로 확인해 Core-only 환경에서도 정리 유지                       | core-isolation/runtime-operations    |
| collection-cleanup.repository.ts    | V2 receipt 테이블 존재 확인. 실제 만료 삭제는 Entity QueryBuilder                               | collection-v2/core-isolation         |
| collection-operations.repository.ts | catalog 검사와 기존 drain 뒤 ACCESS EXCLUSIVE·ADD/VALIDATE 제약 적용. 식별자는 고정 allowlist   | collection-operations/collection-v2  |
| collector-lease.repository.ts       | 만료 대상 SELECT FOR UPDATE SKIP LOCKED와 UPDATE RETURNING을 한 CTE로 실행                      | collector-lease/collection-v2·Spring |
| collector-quota.repository.ts       | MATERIALIZED clock_timestamp 한 값으로 KST 날짜·다음 자정 계산. 예산/예약 저장은 ORM            | collection-v2·quota 경계             |
| posts.repository.ts                 | 예약 실패 알림의 ON CONFLICT 카운트 증가와 GREATEST 시각을 단일 문장으로 처리                   | schedule-alerts/failures             |

GRANT role 이름은 소문자 identifier 형식 검증 후 사용하고, 전환 제약의 table/name은 고정 목록만 허용한다.
값 매개변수를 식별자에 대신 적용했다고 주장하지 않는다. Repository 계약에는 SQL·ORM 객체를 노출하지 않는다.

## 설치 버전과 Nest DB 연결 선택 재확인

2026-09-09 설치 package metadata에서 Nest core/common 11.2.3, TypeORM 0.3.31, pg 8.23.0,
TypeScript 5.9.3을 확인했다. Nest core의 Node >=20, TypeORM의 Node >=16.13 및 pg ^8.5.1,
pg의 Node >=16 조건에 Node 24.18.0/pg 8.23.0이 포함된다. 기존 lockfile 선택을 유지한다.

공식 npm metadata의 @nestjs/typeorm 11.0.0은 Nest 10/11과 TypeORM ^0.3.0을 지원한다.
이 프로젝트는 해당 편의 모듈을 추가하지 않고 PersistenceModule의 명시적 async DataSource provider와
종료 hook을 사용한다. 이유는 업무 Repository 토큰·AsyncLocalStorage transaction과 기존 migration 경로를
이미 구성한 DI에서 일관되게 소유하기 위해서다. Service에 ORM Repository를 직접 주입하는 대안은 선택하지 않는다.
[Nest DB 공식 문서](https://docs.nestjs.com/techniques/database)는 일반 ORM 직접 연동과
@nestjs/typeorm의 편의 통합을 구분한다. 호환 범위 확인은 실제 build/DB/production 검증을 대신하지 않는다.

## 조회 범위와 기존 인덱스 확인

실제 compiled Public/Posts Repository가 만든 SQL을 보존된 baseline DB의
REPEATABLE READ + READ ONLY transaction에서 EXPLAIN FORMAT JSON으로 확인했다.
공개 페이지는 1개 조회와 ix_board_post__public, 본문 블록·이미지는 2개 일괄 조회와
board_post_block_post_id_position_key / board_post_image_post_id_id_key를 사용했다.
관리자 검색은 목록·count·board의 3개 조회이며 ix_board_post__public / board_slug_key를 사용했다.
공개 20개·관리자 50개 페이지 제한, 정렬·필터와 이미지/게시판 일괄 조회를 유지하며 eager 로딩은 없다.
원문은 `/private/tmp/blariyo-nest-migration/query-plan-audit.json`이다.

이 결과는 소규모 기준 DB의 쿼리 형태와 planner 선택을 확인한 것이며 대량 데이터 부하 시험은 아니다.
예약 발행·정리 배치와 정책 이력의 기존 전체 대상 처리 의미는 보존한다. 데이터 증가 시 배치 상한·
분할 처리·이력 페이지 정책은 별도 설계 및 동시성 검토 대상이며 이번 전환에서 schema나 정책을 바꾸지 않는다.

## 공유 계약 런타임의 strict 검사

생성 OpenAPI/type/schema 산출물은 유지하고 직접 작성한 index.mjs에 checkJs와
strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes 및 type-aware lint를 적용한다.
외부 값은 unknown에서 객체·배열·문자열을 검사하며 기존 요청 변환·응답 검증·필드 투영을 유지한다.
교체 전 두 구현을 39 operation, 요청 1872건·응답 및 투영 각각 5424건과 normalizeInput으로 대조했다.
검사용 후보는 실제 index.mjs 연결 후 제거한다. 인접 선언 파일만 검사한 것으로 오인하지 않도록
TypeScript 파일 목록에서 실제 index.mjs가 포함되는 것도 확인한다.
