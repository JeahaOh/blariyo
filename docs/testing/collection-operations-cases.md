# 수집·운영 테스트 케이스

[구현 안내](README.md)의 공통 규칙을 따른다. 신규 ID는 전부 **미실행**이다.
Core는 수집 상태·허용량을 관리하고, 외부 페이지 요청은 운영자 로컬 Spring Collector가 수행한다.
테스트에서는 실제 출처·Discord로 요청하지 않고 합성 HTTP 서버와 합성 이벤트를 사용한다.

## 수집 — COL

근거: [수집 보조 명세](../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md),
[Spring 기술 계약](../system-design/07-spring-collector-design.md),
[수집 API 계약](../development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml).

### COL-01 — 허용 출처만 후보로 접수하고 중복을 막는다

- **P0 / 기존 확장 / API·DB + Spring HTTP 대역**.
- 준비: 승인·활성·robots 허용이 갖춰진 합성 source와 비활성/미승인 source. 허용 URL을 준비한다.
- 실행: 관리자 후보 접수, 같은 정규화 URL 재접수, 비허용 source 접수 순서로 검사한다.
  이어 source PATCH의 활성화 조건 위반과 오래된 lockVersion을 각각 보낸다.
- 기대: 정상 후보만 추가. 중복은 409 `CANDIDATE_DUPLICATE`와 기존 후보 안내, 새 후보 추가 0.
  source 활성화 조건 위반은 409 `SOURCE_STATE_CONFLICT`, 잘못된 version은 409 `SOURCE_VERSION_CONFLICT`.
- 추가 검증: 허용되지 않은 host·scheme·내부 IP·redirect 대상은 외부 socket을 열기 전에 막는다.
  테스트 서버의 수신 횟수로 확인하며 외부 실제 사이트로 시험하지 않는다.
- 변형: 후보 검색의 상태/source/page 필터와 초과 page=200 빈 목록, 잘못된 ID=404를 각각 검사한다.
- 참고: [collection-admin](../../apps/api/test/collection-admin.integration.test.ts),
  [collection-http](../../apps/api/test/collection-http.integration.test.ts),
  [Spring preview](../../tests/spring/preview.test.ts). SSRF 상세 입력은 기존 Collector 검사에 맞춰 추가한다.

### COL-02 — 한 후보의 처리 권한은 한 실행에만 있다

- **P0 / 기존 확장 / 실제 DB·독립 연결**.
- 준비: PENDING 후보 1개와 서로 다른 collectorExecutionId를 가진 worker A/B.
- 실행: 동시에 claim. 성공 worker의 lease를 만료시켜 새 worker가 다시 claim한 뒤 옛 worker가
  heartbeat/result/preview/execution-state를 요청한다.
- 기대: 처음 소유권 획득은 한 worker만 성공. 재획득 후 옛 실행은 409로 거부되고 새 owner 상태는 유지된다.
- 추가 검증: stale 요청으로 version·lease·result·preview·receipt가 갱신되지 않는다.
  오류에 다른 owner 식별자나 조정용 내부 필드를 노출하지 않는다.
- 구현: lease 만료는 테스트 DB에서 시각을 조절한다. 실제 독립 연결·SKIP LOCKED 동작을 사용한다.
- 참고: [collector-lease](../../apps/api/test/collector-lease.integration.test.ts),
  [collection-v2](../../apps/api/test/collection-v2-http.integration.test.ts),
  [Spring fencing](../../tests/spring/fencing.test.ts).

### COL-03 — 요청 허용량은 한 번만 차감하고 만료 허가를 사용하지 않는다

- **P0 / 기존 확장 / 실제 DB + Spring HTTP 대역**.
- 준비: 작은 dailyFetchLimit, 유효 owner·version·lease, 요청 간격을 만족하는 source.
- 실행: 같은 key/request key로 reservation 재전송, 이어 서로 다른 key의 예약을 상한까지 요청한다.
- 기대: 재전송 reservationId와 최초 차감량은 동일. 새 허용마다 +1, 상한·간격 위반은
  429 `SOURCE_RATE_LIMITED`. 거부 요청은 외부 HTTP 호출 0이다.
- 추가 검증: 실제 외부 시도별로 ROBOTS·DETAIL·REDIRECT·IMAGE도 각각 차감한다. redirect로 상한 우회 불가.
  성공 예약 후 네트워크 실패해도 refund하지 않는다.
- 변형: 10초 permit 만료/날짜 변경 시 송신 금지. NETWORK_STARTED 후 crash는 같은 예약으로 자동 재송신하지
  않는다. 응답 유실이 예약 API에서 발생한 경우에는 같은 key replay로 조정한다.
- 참고: [collection-v2](../../apps/api/test/collection-v2-http.integration.test.ts),
  [Spring runtime](../../tests/spring/runtime.test.ts), [preview](../../tests/spring/preview.test.ts).

### COL-04 — 후보를 초안으로 승격해도 자동 공개하지 않는다

- **P0 / 기존 확장 / API·DB + 저장소**.
- 준비: 검수 가능한 NEW 후보, 사용 가능한 preview 이미지 2개, 활성 ADMIN 게시판.
- 실행: draft 승격 요청→같은 key 재전송. 별도 후보에는 반려 후 승격, copy/DB 중간 실패를 각각 재현한다.
- 기대: 정상은 후보 APPROVED와 게시글 DRAFT, 연결된 이미지·block을 한 번만 만든다. 공개 상세는 404.
  반려 후보 등 허용 상태 밖에서는 `CANDIDATE_STATE_CONFLICT`로 거부한다.
- 추가 검증: 승격 실패 때 후보 상태·post/block/image·receipt의 부분 저장 없음. 외부 object는 보상 또는
  cleanup outbox로 회수된다. 재전송은 같은 postId이고 중복 초안 없음.
- 변형: 관리자 retry는 FETCH_FAILED에서만 PENDING으로 되돌리고 외부 fetch를 직접 수행하지 않는다.
  reject는 NEW/FETCH_FAILED에서 REJECTED로 전환한다. 그 밖의 상태는 409 `CANDIDATE_STATE_CONFLICT`다.
- 참고: [collection-http](../../apps/api/test/collection-http.integration.test.ts),
  [collection 실패](../../apps/api/test/collection-operations.integration.test.ts),
  [브라우저 수집](../../tests/browser/collection.test.ts).

### COL-05 — 운영 이벤트와 프로토콜 전환을 중복 없이 처리한다

- **P0 / 기존 확장 / API·DB + 운영 CLI**.
- 준비: 합성 deliveryId, 운영 이벤트 권한이 있는/없는 인증값, LEGACY_V1 진행 lease.
- 실행: 같은 deliveryId/body 이벤트를 두 번 등록하고 body를 바꿔 재전송한다. 운영자가 확인 처리를 재전송한다.
- 기대: 같은 이벤트는 같은 202 eventId, 다른 body는 409. 이벤트·확인 상태가 중복 생성되지 않는다.
  권한 없는 목록·등록·확인은 거부하고 후보 내부값을 노출하지 않는다.
- 추가 검증: legacy 실행이 남아 있을 때 전환 적용은 차단된다. drain 후 공식 CLI로 전환하고,
  이전 프로토콜의 늦은 쓰기가 새 실행을 변경하지 못하는지 검사한다.
- 범위: CLI는 테스트 전용 DB에서만 실행. 운영 환경 전환이나 실제 Discord 발송을 하지 않는다.
- 참고: [collection-operations](../../apps/api/test/collection-operations.integration.test.ts),
  [collector-events 브라우저](../../tests/browser/collector-events.test.ts),
  [Spring control](../../tests/spring/control.test.ts).

## 구조·운영 — OPS

근거: [데이터 모델](../system-design/02-data-model.md),
[인프라](../system-design/04-infrastructure-design.md),
[보안·운영](../system-design/05-security-operations.md),
[코드 구조](../system-design/08-code-structure.md),
[Spring 설계](../system-design/07-spring-collector-design.md).

### OPS-01 — migration과 Entity가 기존 DB를 임의 변경하지 않는다

- **P0 / 기존 확장 / 실제 PostgreSQL**.
- 준비: 원래 SQL 계약 baseline, 빈 테스트 DB, 기존 데이터가 있는 테스트 DB를 구분한다.
- 실행: 빈 DB에 migration→schema dump. 기존 DB에는 Nest 시작·migration 재실행→다시 dump.
- 기대: 승인된 원래 schema와 일치. 기존 데이터·감사값·migration ledger/checksum 불변.
  `synchronize`, `dropSchema`, `migrationsRun`은 false다.
- 추가 검증: 17 Entity의 224컬럼·15FK는 현재 M0 기준값이다. 실제 relation join과 제약도 실행한다.
  checksum 불일치는 실패해야 하며 잘못된 파일에 맞춰 ledger를 고치지 않는다.
- 주의: 미래에 승인된 migration이 추가되면 근거와 함께 기준값을 갱신한다. 숫자 고정을 영구 요구사항으로 삼지 않는다.
- 참고: [database](../../apps/api/test/database.integration.test.ts),
  [migrations](../../apps/api/test/migrations.integration.test.ts),
  [계약 해시](../../tests/migration-contracts.test.ts).

### OPS-02 — 별도 PostgreSQL에 백업을 복원해 사용할 수 있다

- **P0 / 기존 확장 / 실제 PostgreSQL 2개**.
- 준비: 합성 게시글·정책·운영 데이터·sequence·migration ledger를 가진 원본 DB. 대상별 row snapshot 저장.
- 실행: pg_dump custom archive 생성→독립 PostgreSQL에 pg_restore→복원 DB를 보는 Nest 기동.
- 기대: 전체 application row·sequence·ledger/checksum 및 schema가 원본과 일치.
  복원 후 readiness 200, 공개 목록과 정책 조회가 준비 데이터와 일치한다.
- 추가 검증: 파일 생성 성공만으로 끝내지 않는다. 복원 API 조회 뒤에도 데이터를 다시 대조한다.
  실패 시 원본 DB가 변경되지 않았는지도 확인한다.
- 참고: [schema-restore](../../apps/api/test/schema-restore.integration.test.ts).
  로컬 합성 데이터 복원은 운영 대용량 복구 시간·원격 보관·재해 복구 목표 달성의 증거가 아니다.

### OPS-03 — Spring 단계 중단 후 중복 없이 복구한다

- **P0 / 기존 확장 / 실제 JVM + 전용 DB + 합성 HTTP**.
- 준비: 후보 1개, 제어 가능한 source/Core 응답 대역, 실행 상태·요청 횟수·result digest 관측.
- 실행 A: claim, heartbeat, reservation, result, preview, 보존 만료 후 result 조정의 응답 유실을 각각 재현한다.
- 실행 B: 아래 6개 Step의 checkpoint 직전/직후에서 프로세스를 SIGKILL하고 같은 실행을 재기동한다.

| Step | 확인할 결과 |
| --- | --- |
| resolveCandidate | 동일 접수에서 후보·Job 중복 없음 |
| claimCandidate | 소유권·version을 Core와 재대조 |
| fetchAndExtract | network 시작 여부·예약 유효성에 따라 재송신 여부 결정 |
| submitResult | 같은 payload digest·결과를 한 번만 반영 |
| uploadPreviews | 이미 저장한 preview 보존, 빠진 것만 계약대로 복구 |
| notifyAndFinalize | 완료 상태·알림 delivery 중복 방지 |

- 추가 검증: 매 변형마다 실제 exit와 새 PID, DB checkpoint·Core 권위 상태, 외부 수신 횟수를 남긴다.
  stale 소유권이면 다음 외부 요청이나 새 result를 보내지 않는다. private preview bytes/hash도 비교한다.
- 구현: 임의 시간 sleep 후 kill하지 않고 테스트 hook으로 정확한 지점을 기다린다.
- 참고: [runtime](../../tests/spring/runtime.test.ts),
  [step-boundaries](../../tests/spring/step-boundaries.test.ts),
  [fencing](../../tests/spring/fencing.test.ts).

### OPS-04 — production 빌드·maintenance·정상 종료를 검사한다

- **P0 / 기존 확장 / 실제 Docker + 합성 외부 의존성**.
- 준비: 현재 작업 트리로 Core/Web 이미지를 빌드한다. 합성 Access/JWKS·저장소·정책 artifact를 연결한다.
- 실행: production 기동→health와 관리자 발행/숨김→maintenance 모드→운영 CLI→SIGTERM.
- 기대: readiness는 schema·DB 준비 때만 200, 상세 원인·secret 노출 없음. maintenance에서는 계약에 따른
  API/CLI 작업 차단. 정상 종료 후 프로세스·DB 연결이 남지 않는다.
- 추가 검증: SIGKILL 137/OOM을 정상 SIGTERM 종료로 간주하지 않는다. runtime image 안에 테스트 fixture·
  개발 인증 우회가 포함되지 않았는지 확인한다. 개발 watch도 compile 성공 후 새 compiled 서버로 교체돼야 한다.
- 참고: [Docker runner](../../scripts/test-docker.ts),
  [runtime-operations](../../apps/api/test/runtime-operations.integration.test.ts),
  [dev-watch](../../apps/api/test/dev-watch.integration.test.ts),
  [core-isolation](../../apps/api/test/core-isolation.integration.test.ts).

### OPS-05 — 업무 경계와 테스트 실행 누락을 검사한다

- **P1 / 기존 확장 / 정적 검사 + runner 결과**.
- 준비: 전체 source, OpenAPI/생성 계약 baseline, 현재 테스트 파일 목록.
- 실행: strict/lint·import 구조 검사·계약 검사 후 테스트 source와 compiled 파일 목록을 대조한다.
- 기대: Controller/Service에서 직접 SQL·TypeORM을 사용하지 않고 persistence 경계 유지. 순환 의존 없음.
  원래 계약의 무승인 변경 없음. 새 테스트가 빌드 및 runner 목록에서 빠지지 않는다.
- 추가 검증: runner가 하위 프로세스 실패를 nonzero로 전달하는지 코드를 확인한다. 결과의 fail·skip·cancelled,
  명령·로그·검증 코드 hash를 기록하고 단순 PASS 문자열/테스트 개수로 품질을 판단하지 않는다.
- 참고: [architecture](../../tests/architecture.test.ts),
  [API architecture](../../apps/api/test/architecture.service.test.ts),
  [종합 runner](../../scripts/verify-migration.ts), [통합 runner](../../scripts/test-nest-integration.ts).

## 로컬 케이스 이후의 별도 검증

아래는 이번 10개 케이스로 완료 처리할 수 없다. 실제 환경 검증을 계획할 때 별도 케이스 ID와
실값·관측 방법·합격 기준을 정한다.

| 항목 | 필요한 추가 증거 |
| --- | --- |
| 실제 R2/CDN/Access | 운영 설정의 인증·이미지 접근·숨김 후 cache/object 처리 관측 |
| 실제 출처·Discord | 승인 범위의 수집/발송·재연결 결과. 외부 전송은 별도 승인 범위에서 수행 |
| 성능·장기 실행 | 동시 사용자 수·데이터 규모·응답 시간·에러율·관찰 기간의 합격 기준 `(미정)` |
| 원격 백업/OS 자동 실행 | 원격 readback·복원, cron/Keychain/launchd 및 재부팅 후 실행 증거 |
| 법무·공개 운영 | 실값과 승인 정책, 출시 차단 조건 확인 |

합격 기준을 임의로 정해 부하 시험을 PASS 처리하지 않는다. 실패 복구 사례의 통과도 모든 장애 조합을
검증했다는 뜻은 아니다.
