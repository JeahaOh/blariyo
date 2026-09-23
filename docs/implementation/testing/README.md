# Blariyo 테스트 케이스 구현 안내

작성일: 2026-09-10. 대상: 현재 NestJS·TypeORM 기반 M0 Core와 수집 보조.

이 문서는 **개발자가 테스트를 직접 작성하기 위한 명세**다. 제품 요구사항을 새로 결정하지 않는다.
각 케이스는 준비 데이터, 실행, 기대 결과와 확인할 저장 상태를 설명한다.
이번 작업에서는 문서만 작성했다. 아래 케이스를 새로 구현하거나 실행한 것으로 표시하지 않는다.

## 1. 어디부터 읽을까

| 문서 | 용도 |
| --- | --- |
| [M0 Core 케이스](core-cases.md) | 공개 조회, 권한, 게시글·이미지, 화면, 정책과 동의 30개 |
| [수집·운영 케이스](collection-operations-cases.md) | 수집 소유권, 복구, DB·배포 실행 구조 10개 |
| [향후 게시판·익게 케이스](future-board-cases.md) | M1.5 및 선택적인 게시판 관리 기능 6개. 현재 M0 통과 조건에 포함하지 않음 |

추천 순서는 `PUB-02 → PUB-04 → ADM-01 → ADM-02 → IMG-03 → ADM-05 → COL-03 → OPS-02`다.
앞부분에서 HTTP·DB 검증 방법을 익힌 뒤, 동시성·외부 실패·프로세스 복구로 넓힌다.
같은 기능의 기존 테스트가 있으면 새 파일에 복제하기보다 빠진 입력과 검증문을 추가한다.

## 2. 상태와 우선순위 읽기

- **P0**: 데이터 손상·비공개 정보 노출·중복 처리와 직결. 해당 기능을 변경할 때 우선 검사한다.
- **P1**: 주요 기능·경계 입력·화면의 오류를 검사한다.
- **기존 확장**: 관련 테스트 파일을 찾았다. 해당 파일을 읽고 아래 세부 조건 중 빠진 것을 보강한다.
- **보강 제안**: 독립 케이스로 명확히 만들 것을 권한다. 테스트 부재나 현재 결함을 확정한 표시는 아니다.
- **후속 설계**: 아직 구현 대상이 아니거나 제품 결정이 필요하다. 현재 테스트 실패로 집계하지 않는다.

**모든 신규 케이스 ID의 실행 상태는 `미실행`이다.** 기존 테스트 결과와 이 문서의 결과를 구분한다.
기존 종합 실행의 범위·결과는 [Nest 검증 보고](../../migration/REPORT.md), API별 대응은
[전환 계획](../../migration/PLAN.md)에 있다. 이 문서의 46개 ID는 기존 테스트 개수와 일대일 대응하지 않는다.
한 ID 안의 입력 표는 가능하면 `t.test()`로 나눠 실패한 조건을 바로 알 수 있게 한다.

## 3. 테스트의 기본 구조

테스트는 세 부분으로 작성한다.

1. **준비**: 필요한 데이터와 실패 조건을 만든다. 예: 공개 글 21개.
2. **실행**: 실제 검증 대상에 요청한다. 예: 목록 API의 1·2페이지 조회.
3. **검증**: 기대한 값과 비교한다. 예: 각각 20개·1개, 두 페이지에 같은 글 없음.

| 종류 | 쉽게 말하면 | 현재 작성 위치 | 실제로 사용할 대상 |
| --- | --- | --- | --- |
| 서비스 단위 | 한 업무 함수의 판단 검사 | `apps/api/test/*.service.test.ts` | Repository 대역 허용 |
| API·DB 통합 | 서버 응답과 저장 결과 함께 검사 | `apps/api/test/*.integration.test.ts` | compiled Nest + 실제 PostgreSQL |
| 브라우저 | 사람이 화면에서 하는 동작 검사 | `tests/browser/*.test.ts` | 실제 Nuxt·BFF·Nest + Chromium |
| 프로세스 복구 | 프로그램이 죽었다 살아난 뒤 검사 | `tests/spring/*.test.ts`, 기존 Docker runner | 실제 JVM/컨테이너 + 독립 DB |

대역은 실패를 원하는 시점에 재현하는 가짜 외부 의존성이다. 저장소 오류를 재현할 때는 유용하지만,
DB 롤백·잠금을 검증하면서 DB까지 대역으로 바꾸면 실제 DB의 동작은 검증되지 않는다.

## 4. 환경과 데이터 준비

### 실행 환경

현재 저장소의 Node 버전은 `24.18.0`이다. 의존성은 lockfile을 사용한다. 준비 명령과 테스트 전용
컨테이너의 정확한 ID·volume·port는 [검증 환경](../../migration/REPORT.md#전환-전용-검증-환경)을 따른다.
이 문서를 읽는 시점에 컨테이너가 실행 중이라고 가정하지 않는다. ID가 다르면 해당 자원을 사용하지 않는다.

2026-09-23 추가: discovery 통합 검사는 실제 Java parser fixture를 호출한다. `JAVA_HOME`을 Java 25
JDK로 설정한 뒤 `npm run test:fixtures`를 실행한다. 이 명령은 Java 버전을 확인하고
`apps/collector/gradlew -p apps/collector testClasses fixtureClasspath`를 실행한다.
`npm run test:nest`도 이 준비를 먼저 수행한다. 개별 runner 직접 호출 전에는 별도로 준비해야 한다.
Git 제외 `apps/collector/build`가 이미 있다는 이유로 준비 단계를 생략하지 않는다.
CI 역시 Java 25 설정→`test:fixtures`→build→통합 검사를 수행한다. 별도 Collector job은 다음을 실행한다.

```sh
# Node 24.18.0, JAVA_HOME=Java 25, 로컬 PostgreSQL 18의 /postgres 관리 DB
TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres npm run test:collector
apps/collector/gradlew -p apps/collector bootJar fixtureClasspath
```

`test:collector`는 무작위 `blariyo_collector_test_<값>` DB만 생성·제거한다. 주소를 생략하면 기존 로컬
`blariyo_local@127.0.0.1:5439/postgres`를 사용한다. 허용 대상은 localhost/127.0.0.1의 5439/55449 포트와
`/postgres`이며 지속 개발 DB 이름·원격 host·query override는 연결 전에 거부한다.
JUnit 결과에 실패·건너뜀이 있거나 DB readback suite가 없으면 실패한다.
최종 집계는 `test-results/collector-ci/summary.json`에 저장한다. Linux/macOS 로컬 실행과 원격 CI 성공은
별도 증거이며 Windows 전체 검증을 대신하지 않는다.

`admin-workflow.test.ts`와 `local-workers.test.ts`는 실제 [로컬 실행기](../../../scripts/local/README.md)를
별도 DB·임시 미디어로 기동한다. `localhost:3000`과 `127.0.0.1:3100`이 비어 있어야 하며,
브라우저 파일은 `--test-concurrency=1`로 실행한다. 예약 검사는 실제 1~2분을 기다리고 outbox 실패는
기존 2분 backoff를 기다리므로 브라우저 전체 실행에 수 분이 걸린다. worker 직접 호출이나 DB 시각
조작으로 대체하지 않는다. 자동화 통과와 운영자 수동 인수·실제 Access 인증은 별개다.

- Nest 통합 runner는 loopback `55449/postgres`에 연결해 파일마다 `nest_<임의값>` DB를 만들고 삭제한다.
- 개발용 DB나 운영 DB를 `TEST_NEST_DATABASE_URL`에 직접 넣지 않는다.
- `node --test apps/api/dist-test/…`를 직접 실행하기보다 아래 전용 runner를 사용한다.
- 파일 안의 하위 테스트는 DB를 공유한다. 행 수를 셀 때 해당 케이스의 ID로 범위를 제한하거나,
  각 하위 테스트의 준비·정리를 분리한다. 실행 순서에 의존하는 새 테스트는 피한다.
- 임시 파일·서버·DB 연결은 `t.after()`/`finally`로 정리한다. 기존 baseline DB·volume은 지우지 않는다.
- 테스트용 인증값은 실행 중 생성하며 실제 token·개인정보·외부 발송 대상을 사용하지 않는다.

### 공통 데이터 이름

| 이름 | 준비 값과 주의점 |
| --- | --- |
| 운영자 A/B | 서로 다른 합성 actor. Core 테스트는 service token/actor를 주입하고, BFF 인증은 별도 검사 |
| 게시판 A | migration의 `meme`, 활성·ADMIN |
| 게시판 B | 테스트 DB에만 `qa-board`, 활성·ADMIN·겹치지 않는 display_order로 추가 |
| 게시판 C | 테스트 DB에만 `qa-hidden`, 비활성·ADMIN으로 추가 |
| 공개 글 | `PUBLISHED`, DB 현재 시각보다 과거의 `published_at`, TEXT block 포함 |
| 숨김·예약·초안·제거 글 | 각각 `HIDDEN_REVIEW`, `SCHEDULED`, `DRAFT`, `REMOVED`. 필수 시각·사유는 DB 제약 준수 |
| 이미지 | `sharp`로 생성한 작은 유효 PNG. 확장자만 PNG인 문자열은 정상 이미지가 아님 |
| 요청 key | `randomUUID()`. 재전송 케이스에서만 의도적으로 같은 key 재사용 |

조회 테스트는 SQL로 데이터를 준비해도 된다. **발행 기능을 테스트할 때는 SQL로 이미 발행된 상태를
만들고 성공했다고 판단하지 않는다.** 초안을 준비한 뒤 실제 발행 API/서비스를 호출한다.
예약 시각은 PostgreSQL 시각을 기준으로 만든다. 실제 시간을 바꾸거나 1분 넘게 잠들어 기다리지 않는다.

## 5. 따라 작성할 수 있는 완전한 예제

아래 예제는 `PUB-02` 중 **21개 일반 글의 페이지 경계**를 구현한다. 공지·동률 정렬은 별도 하위
테스트로 추가한다. 파일 위치는 `apps/api/test/pagination-example.integration.test.ts`다.
기존 [공개 API 테스트](../../../apps/api/test/public-http.integration.test.ts)와 중복되므로 학습 후에는
기존 파일에 필요한 검증만 합친다. 아래 코드는 문서 예제이며 저장소에 테스트 파일을 생성하지 않았다.

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource } from '../dist/persistence/database.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { contractSuccess } from './contract-response.js';

await test('PUB-02: 일반 글 21개는 20개와 1개로 나뉜다', async (t) => {
  const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(databaseUrl, '전용 통합 runner로 실행하세요');

  const migration = await migrationContext(databaseUrl);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }

  const db = await createDataSource(databaseUrl).initialize();
  t.after(() => db.destroy());
  await db.query(`
    INSERT INTO content.board_post
      (board_id, title, status, published_at,
       created_by, created_at, updated_by, updated_at)
    SELECT (SELECT id FROM content.board WHERE slug = 'meme'),
      'TC-PUB-02-' || n, 'PUBLISHED', now() - n * interval '1 second',
      'system:test', now(), 'system:test', now()
    FROM generate_series(1, 21) AS n
  `);
  await db.query(`
    INSERT INTO content.board_post_block
      (post_id, position, type, text_content,
       created_by, created_at, updated_by, updated_at)
    SELECT id, 1, 'TEXT', '페이지 테스트 본문',
      'system:test', now(), 'system:test', now()
    FROM content.board_post WHERE title LIKE 'TC-PUB-02-%'
  `);

  const app = await createNestApplication({ databaseUrl });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();

  const response1 = await fetch(origin + '/api/v1/boards/meme/posts?page=1');
  assert.equal(response1.status, 200);
  const page1 = await contractSuccess('listPosts', response1);
  const response2 = await fetch(origin + '/api/v1/boards/meme/posts?page=2');
  assert.equal(response2.status, 200);
  const page2 = await contractSuccess('listPosts', response2);

  assert.equal(page1.data.items.length, 20);
  assert.equal(page2.data.items.length, 1);
  assert.equal(page1.meta.totalItems, 21);
  assert.equal(page1.meta.totalPages, 2);
  const all = [...page1.data.items, ...page2.data.items];
  assert.equal(new Set(all.map((post) => post.postId)).size, 21);
  assert.deepEqual(
    all.map((post) => post.title),
    Array.from({ length: 21 }, (_, index) => `TC-PUB-02-${index + 1}`)
  );
});
```

`contractSuccess`는 기존 OpenAPI 응답 검사 helper다. 이 검사에 더해 **HTTP status와 업무상 값**을
직접 비교해야 한다. 응답 형식이 올바르더라도 글 20개 대신 19개를 반환할 수 있기 때문이다.

예제는 2026-09-10 현재 저장소의 `apps/api/tsconfig.test.json` 설정으로 파일 출력 없이 타입 검사했고
오류 0건이었다. 예제의 DB 실행은 하지 않았으므로 런타임 통과로 해석하지 않는다.

### 다른 케이스에서 재사용할 파일

| 작성하려는 테스트 | 먼저 읽을 구현 예시 |
| --- | --- |
| 관리자 JSON/multipart 요청 | [admin-http](../../../apps/api/test/admin-http.integration.test.ts)의 `request` 함수와 합성 인증값 |
| 예상 오류 응답 검사 | [contract-response](../../../apps/api/test/contract-response.ts)의 `contractError`; status는 별도 assert |
| DB 상태·행 수 확인 | [failures](../../../apps/api/test/failures.integration.test.ts)의 `requiredRow`·`rows`와 대상 조건 SELECT |
| 실제 화면 준비·정리 | [browserFixture](../../../tests/helpers/browser-fixture.ts), [브라우저 흐름](../../../tests/browser/core.test.ts) |
| Spring 기동·중단·복구 | [spring-runtime helper](../../../tests/helpers/spring-runtime.ts), [Step 경계 테스트](../../../tests/spring/step-boundaries.test.ts) |

본문에서 `초안 생성 요청`, `hide 요청`처럼 부르는 명령의 정확한 body·header는
[M0 OpenAPI](../../development-specs/m0-core/openapi/m0-core.yaml)와
[수집 OpenAPI](../../development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml)를 사용한다.
위 helper를 가져올 때 운영자 token을 고정 실값으로 바꾸지 않는다. case ID를 테스트 이름 앞에 붙이면
문서와 실패 로그를 연결하기 쉽다.

### 예제를 추가한 뒤 실행하는 명령

아래 명령은 저장소 루트, 의존성 설치 완료, 전용 DB 확인·기동 완료를 전제로 한다.
일반 통합 테스트 실행은 먼저 전체 build로 공유 계약과 Web 산출물도 준비한다.

```sh
export PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH
export TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres
npm run build
npm run build:test -w @blariyo/api
npm run typecheck:test -w @blariyo/api
npm run lint -w @blariyo/api
node scripts/test-nest-integration.ts apps/api/dist-test/pagination-example.integration.test.js
```

기존 공개 테스트를 수정했다면 마지막 인자를 `apps/api/dist-test/public-http.integration.test.js`로 바꾼다.
runner는 새 파일의 `.integration.test.js`도 자동 수집한다. `.service.test.ts`는 API 단위 테스트,
`tests/browser/*.test.ts`는 브라우저 실행 대상이다. 이름을 다르게 지어 실행 대상에서 빠뜨리지 않는다.
전체 검증은 [REPORT의 환경 준비와 명령](../../migration/REPORT.md)을 사용한다. 단일 케이스 통과를
전체 `verify:migration` 통과로 기록하지 않는다.

## 6. 실패와 동시성을 제대로 만드는 방법

### 실패 주입

예: `IMG-03`은 저장소의 두 번째 `put`만 예외를 던지도록 만든다. 업무 서비스 자체를 성공 대역으로
바꾸지 않고 실제 Nest 서비스·DB를 사용한다. [기존 실패 테스트](../../../apps/api/test/failures.integration.test.ts)의
Storage adapter와 Repository 복구 패턴을 참고한다. 변경한 대역은 `finally`에서 원상 복구한다.

### 동시 요청

`Promise.all()`만 사용하면 두 요청이 실제 충돌 지점에서 겹쳤는지 확실하지 않다.
첫 요청을 저장소 copy 직전에서 멈추고, 그 지점에 도착했다는 신호를 받은 뒤 두 번째 요청을 보낸다.
두 번째 결과를 검사한 뒤 `finally`에서 첫 요청을 풀어준다. 대기에는 제한 시간을 둬 무한 대기를 막는다.
DB 잠금은 서로 다른 연결을 사용해야 하며 같은 transaction의 순차 SQL로 대체하지 않는다.

### 관측 지점

| 검증할 것 | 확인할 값 |
| --- | --- |
| 정상 응답 | status + error/success envelope + 필요한 업무 필드 + cache header |
| 저장 성공 | 대상 row의 상태·내용·version, 관련 block/image/history/receipt |
| 중복 방지 | 같은 postId, 대상 데이터·업무 이력의 증가량 1, 외부 copy 추가 0 |
| 실패 원자성 | 요청 전후 업무 데이터 동일. 실패 정리용 outbox는 별도 기대값으로 확인 |
| 비공개 처리 | 새 공개 조회의 404 + 본문/제목/key/사유 부재. 화면만 숨겼는지 확인하지 않음 |
| 외부 실패 복구 | 실제 object inventory·outbox 상태. HTTP 503만 보고 종료하지 않음 |

requestId·현재 시각처럼 요청마다 바뀌는 값은 무조건 전체 JSON 비교하지 않는다. 형식·상호 일치와
업무 결과를 따로 비교한다. 로그에서 `PASS`라는 문자열을 찾는 것으로 검증을 대신하지 않는다.

## 7. 구현·실행 기록 양식

구현자는 케이스별로 다음을 남긴다. 모든 입력 변형이 통과하지 않았다면 `부분 검증`으로 기록한다.

```text
케이스 ID / 입력 변형:
구현 파일 / 테스트 이름:
요구사항 근거:
검증한 코드: commit SHA + 미커밋 변경 여부/관련 파일 hash
실행 시각 / Node·DB·브라우저 버전:
명령:
준비 데이터와 실패 주입 지점:
기대 결과:
실제 결과 / 로그 경로:
상태: 미실행 | 통과 | 실패 | 부분 검증 | 차단
차단 또는 생략 사유:
정리 결과: 서버·DB 연결·임시 파일
```

좋은 테스트인지 확인하려면 검증 대상 조건을 임시로 깨뜨렸을 때 해당 테스트가 실패하는지 점검한다.
예: 목록 page size를 잘못 바꾸면 `PUB-02`가 실패해야 한다. 사용자 작업 트리를 보존한 격리 사본에서
수행하고 변경을 남기지 않는다. 이는 선택적인 테스트 품질 점검이며 이번 문서 작성에서 수행하지 않았다.

## 8. 문서의 근거와 변경 원칙

기대 결과의 우선 근거는 [제품 기획](../../planning/01-service-plan.md),
[API 설계](../../system-design/03-api-design.md), [데이터 모델](../../system-design/02-data-model.md),
각 케이스의 기능 명세다. 법무 판단은 [법무 정본](../../legal/README.md)을 따른다.
기존 테스트 코드는 구현 예시이며 기대 결과의 최종 정본이 아니다.
정본과 테스트가 다르면 현재 코드에 맞춰 기대값부터 바꾸지 말고 충돌을 기록한다.
문서의 `기존 확장` 표시는 관련 코드를 찾았다는 뜻이며 세부 입력 전체의 통과를 보증하지 않는다.
