# Spring 수집 서버 상세 설계

- 기준일: 2026-09-08
- 상태: source·migration·OpenAPI 구현 및 격리 환경 검증 진행. 실제 출처·Discord·운영 전환은 미검증
- 대상 단계: `M0 수집 보조`
- 상위 계약: [시스템 아키텍처](./01-system-architecture.md#spring-collector-transition), [데이터 모델](./02-data-model.md#spring-수집-배치-저장-경계), [API 설계](./03-api-design.md#spring-수집-서버의-실행-api와-기존-중계)
- 기능 명세: [M0 수집 보조 개발 명세](../development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md)

현행 수집 경로는 웹/API와 별도 컴퓨터에서 실행하는 Java direct batch다. batch가 외부 fetch,
목록/상세 parser, Discord queue와 `collect.batch_*`·collect object 저장을 소유한다. API는 저장된
결과의 조회·검수·content 초안 승격·별도 발행만 소유한다. 글별 Core HTTP 전송은 하지 않는다.
Spring Batch·Quartz·Core 후보/lease를 사용하는 아래 초기 절은 legacy 호환 경로를 설명한다.
현행 direct 경로의 정본은 이 문서의 Direct batch Discord 계약, §17~18과 2026-09-23 구현 계약이다.

`M0 Core` 공개와 이 서버의 구현·활성화는 분리한다. 이 설계가 확정되어도 Spring source, Core migration,
OpenAPI, 실제 출처, Discord App, 운영 계정과 runtime이 검증됐다는 뜻은 아니다. 현재 구현 범위와 실행 결과는 [M0 완료 조건](../implementation/m0-completion/acceptance.md)과 [검증 기록](../implementation/m0-completion/evidence.md)에서 분리해 관리한다.

내부 패키지·의존성 규칙과 CLI 배치는 [M0 코드 구조](08-code-structure.md)를 따른다.

## Direct batch Discord 대기열 계약 (2026-09-23)

현행 direct batch의 Discord 입력은 아래 계약을 따른다. 이 문서의 Core 후보·spool·Spring Batch 설명은 legacy 호환 경로이며 이 대기열에 적용하지 않는다.

- `collect.batch_confirmation`은 공개 canonical URL, source/post key, interaction·actor·channel HMAC과 10분 만료 시각만 보관한다. 확인 전 외부 fetch·수집 실행은 없다.
- 확인 버튼은 행 잠금 transaction으로 `collect.batch_queue` 등록과 confirmation 연결을 함께 확정한다. 같은 확인의 재전송은 같은 request UUID를 반환한다. 다른 사용자의 확인은 거부한다.
- queue request UUID와 실행 attempt의 `batch_run.id`는 분리한다. 실행마다 새 run과 object prefix를 사용하며 request에 현재 run·시도 횟수·다음 실행 시각·version을 보관한다.
- worker는 source session advisory lock을 확보한 뒤 queue를 claim한다. 일반 CLI 수집과도 같은 lock을 사용한다. 네트워크 I/O 동안 DB transaction을 유지하지 않는다.
- 다른 PC가 lock을 얻으면 이전 owner가 종료된 실행을 복구한다. 완료 run은 다시 fetch하지 않고 queue 결과를 확정한다. 중단된 run은 실패 기록을 보존하고 최대 3회까지만 새 attempt를 허용한다.
- 네트워크·DNS·일시 서버 오류는 30초부터 지수 backoff한다. 403·삭제·parser·크기 제한·rate-limit은 자동 queue 재시도를 하지 않는다. 요청 내부의 제한 재시도와 queue 재시도를 각각 기록한다.
- queue/confirmation의 상태 전이·version·식별자 불변성과 active 중복 제약은 V005 migration으로 보장한다. 두 테이블은 batch role만 읽고 쓴다. API는 기존 item/run/media 결과를 읽는다.
- `bin/blariyo-collector queue --once --write-db`는 대기 작업을 한 건 처리한다. `discord --write-db`는 API 없이 Gateway와 동일 worker를 실행한다. 두 명령은 명시적 쓰기 모드만 허용하며 batch/collect-url의 dry-run 계약은 그대로 유지한다.
- 실제 Gateway 접속·명령 등록·interaction 실행은 별도 실연동 증거가 필요하다. 로컬 queue test를 Gateway 완료로 표시하지 않는다.

## 1. 확정 선택과 되돌리기 조건

| 항목 | 기본 선택 | 선택 이유 | 되돌리기 조건 |
| --- | --- | --- | --- |
| 코드 위치 | M0 구현 저장소의 `apps/collector` 독립 Gradle 애플리케이션 | 기존 Core/BFF contract와 한 변경에서 검증하면서 Node runtime과 배포 프로세스는 분리 | 별도 release cadence·접근 권한·장애 격리가 실제 운영 요구가 되면 별도 저장소로 분리 |
| Java | JDK 25 LTS | 2026-09-08 현재 LTS이고 Boot 4.1 지원 범위 안 | 선택 배포판의 macOS 지원·라이선스·보안 업데이트가 운영 조건을 충족하지 못하면 지원되는 다른 JDK 25 배포판 사용 |
| Spring | Spring Boot 4.1.1, Boot BOM이 관리하는 Spring Batch 6.0.5·Quartz 2.5.2 | 현재 stable 조합을 한 BOM으로 맞춰 임의 버전 혼합을 피함 | source 작성 시 공개된 보안 수정 patch가 있으면 같은 minor 최신 patch로 올리고 전체 test 재실행 |
| Build | Gradle Wrapper 9.7.1, Kotlin DSL | Boot 4.1이 Gradle 9.x를 지원하고 wrapper checksum으로 재현 가능 | plugin 호환 실패가 재현되면 Boot 지원 범위인 Gradle 8.14 최신 patch로 한시 하향 |
| parser·Discord | jsoup 1.23.2, JDA 6.4.2 | 설계 minor를 유지하고 구현 의존성을 patch 버전으로 고정 | 실제 fixture·Discord Gateway contract test 실패 또는 보안 공지가 있으면 호환 patch로 갱신 |
| Core HTTP | Spring `RestClient`, 외부 출처 HTTP는 JDK `HttpClient`와 수동 redirect | Core JSON 호출과 SSRF 통제가 필요한 외부 fetch를 분리 | HTTP/2·proxy·관측 요구가 기본 client로 충족되지 않을 때 보안 contract test를 유지한 채 교체 |
| 외부 fetch 제한 | connect 5초·요청 20초, HTML 2MiB·robots 512KiB·이미지 10MiB, redirect 최대 3회·같은 host | 단건 M0에서 자원 고갈을 제한하고 기존 preview 10MiB 계약과 맞춤 | 실제 fixture가 정상 응답을 반복 차단하면 출처별 더 낮은 값부터 검증하고 상향 변경 기록 |
| 실행 저장소 | 운영자 PC의 전용 PostgreSQL 18, `batch`·`quartz`·`collector` schema | Batch restart·Quartz misfire·중복 실행·outbox를 crash 뒤에도 복구 | 단일 PC에서 PostgreSQL 운영 부담이 실제로 과도하고 동일 fault test를 통과하는 대체 JDBC 저장소가 확인될 때 교체 |
| 처리 단위 | 후보 1건당 Tasklet Job 1개, 기본 동시 실행 1 | 외부 HTTP와 Core API는 chunk transaction으로 원자화할 수 없고 M0는 단건 처리 | backlog·CPU·quota 지표와 동시성 fault test가 통과하면 서로 다른 후보만 제한 병렬화 |
| Quartz | 15분 주기, `Asia/Seoul`, misfire `DO_NOTHING`, 기본 비활성 | PC 복귀 때 몰아서 외부 요청하지 않고 M0 단건 부하를 제한 | 처리 대기 SLA와 실제 quota 근거가 생기면 주기·동시성을 함께 재산정 |
| 로컬 REST | `127.0.0.1:18787`, 전용 bearer scope, cookie·CORS 없음 | 알려진 Python 8787 값을 승계하지 않고 외부 노출을 기본 차단 | 원격 운영이 필요해지면 loopback 우회를 열지 말고 mTLS 또는 인증 reverse proxy를 별도 설계 |

### 공식 호환 근거

- [Spring Boot 4.1.1 system requirements](https://docs.spring.io/spring-boot/system-requirements.html): Java 17~26과 Gradle 8.14+·9.x 지원. 확인일 2026-09-08.
- [Spring Boot 4.1.1 managed dependencies](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): Spring Batch 6.0.5, Quartz 2.5.2, PostgreSQL JDBC 42.7.13. 확인일 2026-09-08.
- [Spring Batch 6 JDBC JobRepository](https://docs.spring.io/spring-batch/reference/job/configuring-repository.html): resourceless repository는 restart·동시 실행에 맞지 않으며 JDBC repository를 별도 구성할 수 있다. 확인일 2026-09-08.
- [Spring Boot Quartz JDBC store](https://docs.spring.io/spring-boot/4.0/reference/io/quartz.html): JDBC JobStore를 지원하며 기본 schema initializer가 재시작 때 테이블을 삭제할 수 있어 운영 자동 초기화를 사용하지 않는다.
- [Quartz 2.5 문서](https://www.quartz-scheduler.org/documentation/): Java 11+ `jakarta.*` 계열 stable 문서. 확인일 2026-09-08.
- [Oracle Java SE roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html): Java 25는 LTS. 실제 배포판의 라이선스·업데이트 채널은 설치 전에 별도 확인한다.
- [Gradle releases](https://gradle.org/releases/): 9.7.1 stable과 배포 checksum을 확인했다. 확인일 2026-09-08.
- [jsoup releases](https://jsoup.org/news/): 1.23.2 stable을 확인했다. 확인일 2026-09-08.
- [JDA releases](https://github.com/discord-jda/JDA/releases): 구현은 6.4.2에 고정했다. 로컬 의존성 해석·빌드로 확인했으며 전체 최신 버전이라는 주장은 하지 않는다. 확인일 2026-09-09.
- [PostgreSQL 18 `ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html): `NOT VALID` CHECK도
  새 INSERT·UPDATE에는 적용되므로 legacy 전환 1차 migration에는 엄격 CHECK를 추가하지 않는다. 확인일 2026-09-08.

patch 번호는 설계 작성 시점 기준이다. 구현을 시작할 때 같은 major·minor의 최신 보안 patch와 BOM,
Gradle distribution checksum을 다시 확인하고 lockfile·SBOM·build 결과를 남긴다. 확인 없이 major·minor를
올리지 않는다.

## 2. 배포·데이터 소유권

```text
Discord Gateway ----+
Quartz trigger ------+--> CollectorRunService --> Spring Batch collectCandidateJob
loopback REST -------+                              |
                                                    +--> BFF /api/collector/v1/* --> Core API
                                                    +--> approved external source

collector JVM --> local PostgreSQL 18
                  - batch.*     Spring Batch metadata
                  - quartz.*    Quartz JDBC JobStore
                  - collector.* request dedup, outbox, spool reference, audit metadata

Core API --> service PostgreSQL collect.* / ops.*
Core API --> private preview object storage
```

- legacy 수동 collector PostgreSQL은 공개 VM의 서비스 PostgreSQL과 다른 물리 인스턴스다. direct batch 모드에서는
  별도 batch DB role이 `collect.batch_*`에만 쓰기 권한을 가지며 API service DB role과 분리한다. batch object-store
  credential은 `collect/raw`, `collect/media`, `collect/report` prefix에만 제한한다.
- 한 local database에서 schema를 분리하되 framework와 애플리케이션 migration을 한 versioned migration
  묶음으로 관리한다. `spring.batch.jdbc.initialize-schema=never`와
  `spring.quartz.jdbc.initialize-schema=never`를 운영 기본값으로 사용한다. startup DDL·drop을 허용하지 않는다.
- legacy Batch `ExecutionContext`, Quartz `JobDataMap`과 `collector.*`에는 ID·상태·시각·hash·암호화 spool 참조만
  저장한다. token, 원문 HTML, title 원문, 원문 URL 전체, image binary, 파일 절대 경로는 저장하지 않는다.
- local PostgreSQL metadata는 매일 암호화 backup 1개, 최근 7개를 유지한다. 유실되어도 Core 후보 상태를
  권위 원천으로 다시 조정할 수 있어야 하며, restore 뒤 Quartz trigger와 Job을 바로 실행하지 않고 reconcile을
  먼저 수행한다.
- `collectorId`는 최초 기동에 `collector-`와 random 80-bit base32를 조합해 생성하고 local DB와 Keychain에
  고정한다. host명·사용자명·serial을 넣지 않으며 재설치로 ID가 바뀌면 새 Core credential을 발급한다.

## 3. 공통 실행 요청과 식별자

이 절의 `Core 후보·lease·reservation` 설명은 기존 수동 URL 호환 collector 경로에만 적용한다. 새 direct batch는
Core HTTP를 글마다 호출하지 않고 `collect.batch_*`와 batch object store를 직접 사용한다. 출처별 목록 가능 여부는
[출처별 수집 정책](../planning/content-collection/source-collection-policy.md)의 `HOT_LIST`, `DETAIL_ONLY`, `BLOCKED`,
`UNVERIFIED`로 결정한다.

모든 진입점은 controller나 listener에서 Job을 직접 만들지 않고 `CollectorRunService.submit()`을 호출한다.
서비스는 권한·feature flag·중복을 확인하고 같은 `RunCommand`를 만든다.

| 값 | 역할 | 생성·중복 규칙 |
| --- | --- | --- |
| `triggerRequestKey` | 진입 요청 멱등 식별 | Discord는 interaction ID 기반 HMAC, REST는 필수 `Idempotency-Key`의 HMAC, Quartz는 trigger key와 scheduled fire time의 HMAC. 원문 key는 로그에 남기지 않음 |
| `jobRequestId` | Batch JobInstance 식별 UUID | `triggerRequestKey` 최초 접수 때 한 번 생성하며 재전송은 같은 값 반환. 유일한 identifying JobParameter |
| `candidateId` | Core 후보 | Discord URL은 기존 후보 접수 API 성공 후 획득, 관리자·재시도는 전달된 ID, Quartz는 claim 성공 후 확정. Batch context에는 ID만 저장 |
| `collectorExecutionId` | 한 후보 처리 소유권 UUID | 일반 claim 또는 NEW 후보의 `PREVIEW_REFRESH` 시작마다 새로 생성. RUNNING에서는 lease·lockVersion, NEW preview에서는 execution ID·lockVersion으로 fencing |
| `apiRequestId` | 한 Core 호출 추적 | 응답 `meta.requestId`를 기록하되 로그 상관용이며 멱등 key를 대신하지 않음 |

- 동일 `triggerRequestKey` 재전송은 같은 `jobRequestId`와 현재 실행 상태를 반환한다. payload가 다르면
  `409 IDEMPOTENCY_CONFLICT`이며 새 Job을 만들지 않는다.
- 기본 active Job은 1개다. 다른 요청은 local `QUEUED`로 저장하고 FIFO로 실행한다. 같은 candidate가 다른
  요청으로 들어오면 Core claim 결과를 권위로 사용해 하나만 진행한다.
- Discord는 기존 확인 interaction이 끝나기 전에 후보 접수나 Job을 만들지 않는다. 일반 메시지를 감시하지 않는다.
- 기존 Quartz 후보 처리 경로는 기본 비활성이며 이미 접수된 수동 후보만 claim한다. direct batch의 Hot 목록 발견은
  별도 `DirectBatchRunner`가 source policy에 따라 수행한다.

## 4. Job·Step과 상태

Job 이름은 `collectCandidateJob`이며 후보 1건을 다음 Tasklet Step으로 처리한다.

| 순서 | Step | 성공 checkpoint | 실패·restart 기준 |
| --- | --- | --- | --- |
| 1 | `resolveCandidate` | Discord·관리자 요청은 candidateId, Quartz는 `NEXT_PENDING` 선택 의도 | Discord 접수는 같은 key로 replay. Quartz는 candidateId 없이 Step 2로 갈 수 있으나 외부 fetch로 가지 않음 |
| 2 | `claimCandidate` | 일반 모드는 candidateId·collectorExecutionId·lockVersion·leaseUntil, refresh 모드는 NEW candidate의 새 execution ID·version | Quartz의 candidateId는 이 Step의 일반 claim 응답으로 확정. claim 응답 유실은 같은 key replay |
| 3 | `fetchAndExtract` | quota reservation ID별 network 상태, parser version, 암호화 result spool ref·SHA-256 | 원격 요청은 rollback 불가. `NETWORK_STARTED`이면 같은 요청을 자동 재송신하지 않고 새 quota 예약의 명시적 retry로 분리. refresh mode는 result 추출을 건너뛰고 Step 2가 준 이미지 URL만 받음 |
| 4 | `submitResult` | Core status, result payload SHA-256, 새 lockVersion, position→candidateImageId | 같은 key·동일 bytes replay. 멱등 보존 뒤에는 execution-state의 digest와 terminal 상태 대조. refresh mode는 이 Step을 건너뜀 |
| 5 | `uploadPreviews` | 이미지별 source SHA-256, idempotency key hash, preview expiry, 새 lockVersion | 이미지별 순차 처리. 성공 이미지 다음부터 restart하고 response loss는 same-key replay 또는 execution-state 대조 |
| 6 | `notifyAndFinalize` | 후보 결과·preview 결과·Discord 결과·Core 운영 이벤트 결과를 별도 기록 | Discord 실패가 수집 성공을 rollback하지 않음. outbox로 제한 재시도 |

chunk는 사용하지 않는다. 후보 1건과 원격 side effect를 로컬 DB transaction으로 묶을 수 없기 때문이다.
Step 2 claim 자체가 ownership 획득 gate다. claim 성공 뒤 Step 3~6에 들어갈 때와 restart할 때 Core 상태를
재확인한다. 이때 `APPROVED`·`REJECTED` 또는 다른 execution 소유이면 재처리를 중단하고 local spool을 즉시
폐기한다. `PREVIEW_REFRESH`는 NEW 후보의 만료·누락 preview만 처리하고 result·후보 상태를 다시 만들지 않는다.

Spring Batch 결과와 후보 결과는 별개다.

| 상황 | Batch 결과 | Core 후보 해석 |
| --- | --- | --- |
| fetch gate가 금지하고 실패 결과 제출 성공 | `COMPLETED` + business outcome `FETCH_FAILED` | `FETCH_FAILED` |
| result 성공, preview 일부 실패 | `COMPLETED_WITH_WARNINGS`에 대응하는 custom exit code | `NEW`, 일부 preview 없음 |
| Core 응답을 재확인할 수 없음 | `STOPPED` 또는 restartable failure | 추측하지 않고 기존 상태 유지 |
| stale lease/version | non-retryable execution failure | 새 소유자 상태 유지, 자동 새 result 금지 |
| 알림만 최종 실패 | Job 수집 결과 유지, notification outcome `FINAL_FAILED` | 후보 상태 유지, 운영 이벤트 별도 |

## 5. Core API 확장

기존 다섯 path와 BFF `/api/collector/v1/*` 중계는 유지한다. Spring 전환 전에 Core/BFF를 먼저 배포한다.
collector credential 등록에 `contractVersion=LEGACY_V1|SPRING_V2`를 두고 legacy 필드 허용은
`LEGACY_V1` token에만 한정한다. `SPRING_V2` token은 첫 요청부터 새 멱등 header와
`collectorExecutionId`가 필수다. Python 신규 실행을 중지하고 진행 lease를 drain한 뒤에만 Spring token을
활성화하며, 두 contract의 token이 같은 후보를 동시에 claim하도록 허용하지 않는다. 종료 후 7일 관찰이
끝나면 legacy token을 폐기한다. route를 바꾸거나 Core를 직접 공개하지 않는다.

### 5.1 기존 endpoint의 강화

| Endpoint | 추가 계약 |
| --- | --- |
| `POST /internal/collect/candidates` | 기존처럼 `Idempotency-Key` 필수. 성공 replay 보존을 24시간에서 7일로 연장 |
| `POST /internal/collect/candidates/claim` | `Idempotency-Key`, `jobRequestId`, `collectorExecutionId`, `mode=COLLECT\|PREVIEW_REFRESH` 추가. current execution이 유효한 같은 key replay는 같은 items·version·lease 응답. refresh는 candidateId 필수·NEW만 허용하고 status·attempt·`lease_until`을 바꾸지 않음 |
| `POST /internal/collect/candidates/{id}/heartbeat` | `Idempotency-Key`, `collectorExecutionId` 추가. 같은 key replay는 같은 갱신 결과. current execution·version·유효 lease가 아니면 부수 효과 없이 409 |
| `POST /internal/collect/candidates/{id}/result` | `collectorExecutionId`와 server-computed canonical payload SHA-256 저장. 기존 key replay 7일. RUNNING의 current execution·version·유효 처리 lease만 첫 반영 |
| `POST /internal/collect/candidates/{id}/images/{imageId}/preview` | `Idempotency-Key`, `collectorExecutionId`, `X-Content-SHA256` 필수. NEW·current execution·version만 검사하고 종료된 처리 lease는 요구하지 않음. 같은 key·같은 bytes는 version을 다시 올리지 않음 |

collector 요청의 **2xx 완료 receipt**만 7일 보존한다. 429·503·일시 dependency 오류는 완료 receipt를
남기지 않고 짧은 in-progress lock을 해제해 같은 key 재시도가 현재 상태를 다시 평가하게 한다. 400·401·
403·409도 내구 replay 대상으로 저장하지 않는다. 일반 관리자·게시글 API의 기존 24시간 보존은 바꾸지
않는다.

7일은 local restart 허용 기간과 맞춘 새 결정이다. 멱등 저장소에는 canonical request SHA-256과 최소
receipt만 둔다. claim receipt는 candidate ID·execution ID·응답 version·lease·source 설정 snapshot만 저장하고
원문 URL은 저장하지 않는다. `COLLECT`는 후보가 아직 RUNNING이고 해당 execution·lease가 유효할 때의 현재
candidate origin URL과 receipt를 조합해 최초와 같은 claim 응답을 재구성한다. result 뒤 URL이 정규화돼
바뀌었거나 실행 소유권이 끝났거나 후보·source row를 재구성할 수 없으면 오래된
2xx를 재생하지 않고 `409 CANDIDATE_EXECUTION_CONFLICT`로 execution-state 조정을 지시한다. 이는 claim의
민감 payload를 7일 snapshot으로 보존하지 않기 위한 명시적 예외다. title·URL·binary가 든 exact result bytes와
preview file은 Core idempotency row가 아니라 local encrypted spool에 보관한다.

### 5.2 추가 endpoint

| Method | Core path | 목적 |
| --- | --- | --- |
| `GET` | `/internal/collect/status?windowHours=24` | `/collect status`용 Core 집계. `windowHours` 기본 24, 범위 1~168 |
| `GET` | `/internal/collect/candidates/{candidateId}/execution-state` | response loss·restart용 최소 후보, lease, result digest, 이미지 preview 상태 조회 |
| `POST` | `/internal/collect/sources/{sourceId}/request-reservations` | 외부 HTTP 한 번의 quota를 원자 예약·즉시 차감 |
| `POST` | `/internal/collect/operational-events` | 알림 최종 실패·reconcile 필요 같은 일반화 운영 이벤트를 멱등 기록 |

모두 기존 BFF collector prefix로만 호출하고 `system:collector` scope를 세분화한다.

- `collector:run`: 후보 접수·claim·heartbeat·result·preview·quota reservation
- `collector:read`: status·execution-state
- `collector:event`: operational-events

관리자 API 권한과 cookie를 사용하지 않는다. GET 응답은 `private, no-store`이며 원문 URL·제목·다른
collector의 식별자·storage key를 반환하지 않는다.

`execution-state`의 최소 응답은 `candidateId`, `status`, `collectorExecutionId`, `lockVersion`, `leaseUntil`,
`attemptCount`, `resultPayloadSha256`,
`images[{candidateImageId,position,previewSourceSha256,previewPath,previewExpiresAt}]`다. 요청 execution이 current
owner가 아니면 상태와 관계없이 409만 반환하고 다른 owner ID나 조정 필드를 숨긴다.

`status`의 Core 부분은 기준 시각, PENDING·RUNNING·NEW·FETCH_FAILED 수, 비활성 출처 수, 최근 일반화
오류 수, 마지막 갱신 시각만 반환한다. local collector는 이를 Batch Job 집계와 합치며 두 원천을 각각
표시한다. Core 조회 실패 시 local 결과만 `partial=true`로 반환하고 전체 정상으로 표시하지 않는다.

### 5.3 request·response 최소 계약

`GET /internal/collect/status` 성공 `data`는 다음 필드만 가진다.

```json
{
  "asOf": "2026-09-08T00:00:00Z",
  "windowHours": 24,
  "candidateCounts": { "pending": 0, "running": 0, "new": 0, "fetchFailed": 0 },
  "disabledSourceCount": 0,
  "recentErrorCounts": [{ "code": "SOURCE_RATE_LIMITED", "count": 0 }]
}
```

`windowHours`가 1~168 범위를 벗어나면 `400 VALIDATION_FAILED`다. 이 조회는 candidate를 claim하거나
source를 변경하지 않는다.

`GET /internal/collect/candidates/{candidateId}/execution-state`에는 query
`collectorExecutionId=<UUID>`가 필수다. path candidate가 저장한 current execution과 일치할 때만 200을
반환한다. `RUNNING`은 lease·attempt를 포함하고, `NEW`·`FETCH_FAILED`는 result digest와 NEW일 때의 이미지
preview 조정 필드를 포함한다. 불일치는 상태와 관계없이 다른 owner ID·digest·이미지 정보를 주지 않고
`409 CANDIDATE_EXECUTION_CONFLICT`를 반환한다. 여기서 terminal은 `APPROVED`·`REJECTED`만 뜻하며, 같은
execution에 한해 `{candidateId,status,terminal:true}`만 반환해 spool 폐기를 지시한다. 미존재는 404다.

`POST /internal/collect/sources/{sourceId}/request-reservations` body는 다음과 같다.

```json
{
  "collectorId": "local-macbook-main",
  "jobRequestId": "00000000-0000-0000-0000-000000000000",
  "collectorExecutionId": "00000000-0000-0000-0000-000000000000",
  "candidateId": 1,
  "lockVersion": 1,
  "requestKey": "opaque-per-attempt-key",
  "requestKind": "DETAIL"
}
```

`requestKind`는 `ROBOTS|DETAIL|REDIRECT|IMAGE`다. 성공은 201과 `reservationId`, `budgetDate`,
`reservedCount`, `remainingCount`, `serverNow`, `validUntil`, `nextAllowedAt`을 반환한다. same key·same body는 같은
201을 replay하되 `serverNow`는 receipt에 저장하지 않고 각 HTTP 응답 생성 시점의 새 서버 시각으로 채운다.
`reservationId`·차감량·permit 시각만 최초 값과 같다. 상한·간격은 429 `SOURCE_RATE_LIMITED`와
`retryAfterSeconds`, inactive/host gate는
403 `SOURCE_NOT_ALLOWED`, stale execution/version은 409다.

`POST /internal/collect/operational-events` body는 `collectorId`, 선택 `jobRequestId`·`candidateId`,
`deliveryId`, allowlist `eventCode`, `severity`, `occurredAt`, `attemptCount`다. title·URL·stack·message 자유
문자열은 받지 않는다. `eventCode`는 `NOTIFICATION_FINAL_FAILED`, `RECONCILE_REQUIRED`,
`SPOOL_CLEANUP_FAILED`, `LEASE_EXPIRED`, `QUOTA_INTERVAL_VIOLATION`, `COLLECTOR_CLOCK_UNSAFE`만 허용하고,
`severity`는 `INFO|WARN|ERROR`다. 같은 delivery ID는 같은 202 `eventId`를 반환하며 다른 body는 409다.

### 5.4 공통 field 형식과 nullable 규칙

- `candidateId`·`sourceId`는 1 이상의 64-bit integer, `jobRequestId`·`collectorExecutionId`·
  `reservationId`·`deliveryId`·`eventId`는 UUID다. `collectorId`는 등록된 1~100자 식별자다.
- timestamp는 UTC RFC 3339 문자열로 밀리초까지 반환한다. `budgetDate`는 `Asia/Seoul` 기준 `YYYY-MM-DD`다.
  count·version·attempt·window·retry 값은 JSON integer이며 count는 0 이상, version은 1 이상이다.
- 응답의 optional 값은 schema에 nullable로 선언한 `leaseUntil`, `resultPayloadSha256`, preview 세 필드만
  명시적 `null`을 쓴다. 권한이나 상태상 반환하면 안 되는 필드는 `null` 대신 생략한다.
- reservation 성공 응답에서 `reservedCount`·`remainingCount`는 0 이상, `serverNow`·`validUntil`·
  `nextAllowedAt`은 필수다. 429의 `retryAfterSeconds`는 1 이상의 integer다.
- operational event의 `jobRequestId`·`candidateId`만 nullable이고 나머지 body 필드는 필수다. `occurredAt`은 미래 5분을
  넘을 수 없고 `attemptCount`는 0~100이다. 202 응답은 `{eventId,acceptedAt,deduplicated}`이며
  `deduplicated`는 boolean이다.

## 6. Core 데이터 계약

`collect.source`에 전역 `next_request_at TIMESTAMPTZ(3) NULL`을 추가한다. 날짜별 budget row가 바뀌어도
마지막 reservation의 최소 간격을 유지하는 권위 시각이다.

### 6.1 후보·이미지 추가 필드

`collect.candidate`에 다음 nullable 필드를 추가한다.

| 열 | 타입 | 용도 |
| --- | --- | --- |
| `collector_execution_id` | `UUID` | 현재 또는 마지막 Spring 처리 실행. retry→PENDING에서 NULL |
| `last_heartbeat_at` | `TIMESTAMPTZ(3)` | 마지막으로 성공한 heartbeat |
| `result_payload_sha256` | `BYTEA` | canonical result bytes SHA-256. NEW/FETCH_FAILED에서 재확인 |

`collect.candidate_image`에는 다음 필드를 추가한다.

| 열 | 타입 | 용도 |
| --- | --- | --- |
| `preview_source_sha256` | `BYTEA` | collector가 제출한 file bytes SHA-256 |
| `preview_uploaded_at` | `TIMESTAMPTZ(3)` | 현재 preview 첫 성공 시각 |

`collector_execution_id`는 claim 때 설정하고 heartbeat·result·preview의 fencing 조건에 포함한다.
`result_payload_sha256`는 result와 같은 transaction에서 기록한다. preview 교체·삭제 때 source hash와
uploaded_at도 함께 비운다. 관리자 retry가 `FETCH_FAILED→PENDING`으로 바꿀 때 execution ID, heartbeat,
result digest를 비우고 현재 retry cycle의 `attempt_count`를 0으로 되돌린다. 누적 시도는 운영 이벤트로 남긴다.

### 6.2 quota

Core가 소유하는 `collect.source_request_budget`을 둔다.

| 열 | 타입 | 조건 |
| --- | --- | --- |
| `source_id` | `BIGINT` | `collect.source` FK |
| `budget_date` | `DATE` | `Asia/Seoul` 기준 날짜 |
| `reserved_count` | `INTEGER` | 0 이상, 성공 reservation 때 1 증가 |
| `lock_version` | `INTEGER` | 1 이상 |

PK는 `(source_id,budget_date)`다. `collect.source_request_reservation`은 UUID PK, source/candidate,
collector execution ID, HMAC한 request key, request kind, budget date, reserved 시각, `valid_until`, 상태를
가진다. 상태는 `ISSUED|EXPIRED`이며 사용 여부를 원격 exactly-once 증거로 해석하지 않는다.
`(source_id, request_key_hash)`는 unique이며 30일 후 삭제한다. 후보가 먼저 보존 기간 만료로 삭제되면 reservation과 운영 이벤트의 `candidate_id`는 NULL로 전환하고 일반화 이력은 원래 보존 기간까지 유지한다. URL, host 전체, response body는 저장하지 않는다.

### 6.3 운영 이벤트

`collect.collector_operational_event`는 UUID PK, 선택 candidate/job request ID, 일반화 event code,
severity, delivery status, attempt count, occurred/last attempted/acknowledged 시각만 가진다. 원문·Discord
user ID·stack·secret을 넣지 않는다. 미확인 이벤트는 관리자 화면에 표시하고 확인 후에도 30일 보존한다.

## 7. quota 권위와 HTTP 계산

외부 출처 요청 quota의 권위는 Core다. collector PostgreSQL이나 메모리 카운터는 표시용 cache로만 쓰며
허용 판단을 하지 않는다. reservation API는 source row와 당일 budget row를 한 transaction에서 잠그고
source 활성, 현재 execution·version, 처리 mode에 맞는 상태, `source.next_request_at`, 일일 상한을 검사한다.
RUNNING 수집은 유효 처리 lease가 필요하다. result 뒤 IMAGE와 `PREVIEW_REFRESH`는 NEW·current execution·
version을 검사하며 종료된 `lease_until`을 요구하지 않는다.

quota는 다음 **실제 외부 HTTP 시도 각각** 1회로 계산한다.

- network에서 새로 받는 `robots.txt`
- 상세 HTML 요청
- 3xx redirect의 각 hop
- 각 preview 원본 이미지 요청
- HEAD 뒤 GET처럼 두 HTTP 요청을 보내면 각각 1회

DNS 조회, local cache hit, parser 처리, Core/BFF API, 로컬 validation에서 차단된 URL은 세지 않는다.
redirect는 기존 계약대로 원래 source와 같은 host만 허용하고, 각 hop을 원래 source budget에서 센다.

collector는 SSRF·scheme·host·path local gate를 먼저 통과한 뒤 network socket을 열기 전에 reservation을
요청한다. 성공 reservation은 **즉시 사용량으로 확정하며 refund하지 않는다.** permit 유효창은 10초이고
`validUntil`은 `reservedAt+10초`와 `budgetDate`의 종료 시각 중 빠른 값이다. Core는 source의
`next_request_at=validUntil+request_interval_ms`로 갱신하므로 자정에 budget row가 바뀌어도 예약 간격이
초기화되지 않는다.

응답 유실은 같은 `Idempotency-Key`·request key로 replay해 같은 reservation ID와 `validUntil`을 받는다.
collector는 Core 응답의 `serverNow`로 local clock 차이를 계산한다. NTP 동기화 상태가 아니거나 절대 차이가
2초를 넘으면 readiness를 내리고 송신하지 않는다. source별 local mutex 안에서 `NETWORK_STARTED`를 암호화
spool에 fsync한 뒤, socket 호출 바로 전에 Core 시각 추정치가 `validUntil-2초`보다 이른지 다시 확인하고 한
번만 socket을 연다.

- `NETWORK_STARTED` 전 crash는 permit이 아직 유효할 때만 같은 reservation을 복구해 한 번 송신할 수 있다.
  permit이 만료되었거나 budget date가 바뀌었으면 송신하지 않고 새 request key·새 reservation을 사용하며
  이전 차감은 환불하지 않는다.
- `NETWORK_STARTED` 뒤 응답 유실·crash는 원격 송신 여부를 알 수 없으므로 같은 reservation으로 자동
  재송신하지 않는다. retry는 새 request key·새 reservation으로 별도 시도하고 두 번 모두 quota로 센다.
- quota 응답 유실 자체는 외부 요청 전이므로 same-key replay 뒤 유효 permit일 때만 송신한다.
- 오래된 execution·version 또는 mode에 필요한 lease/state는 reservation을 받지 못한다. 이미 시작된 외부 요청은 취소를 보장할 수 없지만
  stale result는 fencing으로 거부한다.

reservation 간격은 실제 socket 시작 시각과 같지 않으므로 위 10초 유효창, 2초 안전 여유와
`validUntil+interval`을 함께 적용한다. 이 방식은 실제 요청보다 quota를 보수적으로 더 쓰고 설정 interval보다
더 기다릴 수 있다. 일일 예약 상한은 Core transaction으로 보장하지만, fsync·최종 시각 검사 뒤 OS scheduling과
socket syscall 사이의 지연까지 실제 송신 시각을 절대 증명하지는 않는다. clock 이상이면 차단하고 계측한
socket 시작 시각이 간격을 어기면 local source circuit breaker로 신규 실행을 막고 Core 운영 이벤트를
남긴다. `daily_fetch_limit`은
후보 수가 아니라 위 HTTP 시도 합계다. 날짜는 `Asia/Seoul` 00:00 경계이고 DB timestamp는 UTC로 저장한다.
해외 출처가 자체 시간대 상한을 요구하면 source별 quota timezone 필드를 추가하는 변경 검토를 거친다.

## 8. lease·heartbeat·재선점

- API 허용 범위 `leaseSeconds=60~900`은 유지한다. Spring 기본값은 300초다.
- heartbeat 기본 간격은 60초다. network 요청 중에도 별도 scheduler가 heartbeat하며 같은 호출의 응답
  유실은 같은 idempotency key로 replay한다.
- 후보 execution마다 Core mutation을 하나의 local mutex와 증가 sequence로 직렬화한다. heartbeat·quota·
  result·preview 성공 응답의 새 `lockVersion`을 같은 checkpoint 경로로 반영한다. Core mutation의 응답
  수신과 checkpoint 완료까지 mutex를 유지하되, 외부 출처 fetch·parser 동안에는 잡지 않는다. result
  직전에는 새 heartbeat 예약을 막고 진행 중 heartbeat를 drain한 뒤 최신
  version으로 제출한다. same-key replay가 checkpoint보다 오래된 version을 반환하면 local 최신값을 덮지 않고
  execution-state로 조정한다.
- 일반 claim은 `collectorExecutionId`, `lockVersion`, 유효 처리 lease를 함께 갱신한다. heartbeat·RUNNING
  quota·result는 세 값을 모두 fencing 조건으로 검사한다. result는 `lease_until=NULL`, status=NEW와 새
  version을 commit하지만 execution ID는 preview를 위해 유지한다.
- preview와 NEW 상태 IMAGE quota는 current `collectorExecutionId`·lockVersion·NEW만 검사한다. 종료된 처리
  lease를 요구하지 않는다. `PREVIEW_REFRESH` claim은 candidateId가 있는 NEW 후보에서
  `(status,lockVersion)` compare-and-set으로 새 execution ID와 version만 부여하고
  status·attempt_count·`lease_until=NULL`을 유지한다. 동시에 두 refresh가 요청되면 한 transaction만
  성공하고 패자는 execution/version 409로 끝난다. 성공 응답은 current owner에게만
  `images[{candidateImageId,position,remoteUrl}]`을 반환하며, 이것이 해당 refresh claim version이 current인
  동안 새 quota를 받아 이미지를 다시 가져오는 유일한 입력이다. execution-state나 local REST status는
  remote URL을 반환하지 않는다.
- `attempt_count < 3`이고 `requested_at`부터 24시간 미만인 만료 RUNNING은 claim transaction에서 직접
  재선점할 수 있다. 외부에 중간 PENDING 상태를 노출하지 않는다.
- `attempt_count >= 3` 또는 요청 후 24시간이 지난 만료 RUNNING은 `FETCH_FAILED/LEASE_EXPIRED`로 바꾸고
  claim 결과에 포함하지 않는다. Core의 24시간 maintenance도 같은 규칙을 사용한다.
- 24시간 지난 PENDING은 상태를 유지하고 운영 알림을 만든다. collector 중단만으로 사용자가 접수한 작업을
  실패로 만들지 않는다.
- PENDING 복귀는 운영자가 `FETCH_FAILED`를 retry할 때만 사용한다. 이때 새 retry cycle을 시작한다.

stale worker의 heartbeat·reservation·result·preview는 `409 CANDIDATE_LEASE_CONFLICT`,
`409 CANDIDATE_EXECUTION_CONFLICT` 또는 `409 CANDIDATE_VERSION_CONFLICT`로 끝나며 object·후보 상태·
quota를 바꾸지 않는다. preview는 lease 충돌 대신 execution·version 충돌을 사용한다. 단, reservation
성공 뒤 이미 시작된 외부 요청은 되돌릴 수 없으므로 외부 fetch exactly-once를 주장하지 않는다.

## 9. 멱등·응답 유실·restart

### 9.1 replay 저장

collector의 state-changing Core 호출은 모두 idempotency key와 canonical payload hash를 사용한다.
2xx 완료 receipt를 7일 보존하며 같은 key·다른 hash는 409다. claim·heartbeat 응답도 재생하므로 응답
유실 뒤 최신 lease/version을 잃지 않는다. 429·503과 일시 dependency 오류는 완료로 저장하지 않고
in-progress receipt를 해제해 같은 key가 현재 quota·dependency 상태를 다시 평가한다. 새 key로 일시 오류를
우회할 필요가 없다.

7일이 지나면 자동으로 이전 mutation을 다시 보내지 않는다.

- candidate가 `APPROVED`·`REJECTED`이면 Job을 종료하고 spool을 즉시 삭제한다.
- candidate가 NEW/FETCH_FAILED이고 stored result digest가 local digest와 같으면 result 성공으로 조정한다.
- NEW 이미지의 stored preview source digest가 local digest와 같고 preview가 유효하면 해당 업로드 성공으로 조정한다.
- digest가 없거나 다르고 current owner/version을 확정할 수 없으면 `RECONCILE_REQUIRED`로 중지한다.
- PENDING 또는 다른 execution의 RUNNING이면 기존 실행을 재사용하지 않고 새 일반 claim cycle만 허용한다.
- NEW에서 preview가 없거나 만료됐으면 `PREVIEW_REFRESH` claim으로 새 execution ID를 받은 뒤 이미지
  fetch·preview만 실행한다. 일반 claim이나 result를 다시 수행하지 않는다.

### 9.2 장애창 판정

| 장애창 | restart 동작 | 금지 동작 |
| --- | --- | --- |
| 후보 접수 commit 뒤 응답 유실 | 같은 key로 candidateId replay | 새 key로 같은 URL 후보 생성 |
| claim commit 뒤 응답 유실 | 같은 key로 items·lease·version replay | candidate 미상태로 외부 fetch |
| heartbeat commit 뒤 응답 유실 | 같은 key replay 또는 execution-state 조회 | 이전 version으로 result |
| reservation commit 뒤 응답 유실 | 같은 key로 reservation replay 후 최초 송신 | quota 새 예약부터 생성 |
| network 시작 뒤 응답 유실 | 같은 요청 자동 재송신 금지, retry 결정 시 새 reservation | 이전 reservation 재사용 송신 |
| result commit 뒤 응답 유실 | 같은 key·동일 bytes replay, 7일 뒤 digest reconcile | 새 key·다른 payload 제출 |
| result 성공 뒤 Batch checkpoint 전 종료 | Core digest·version 조회 후 preview부터 계속 | fetch·result 무조건 반복 |
| preview object·DB commit 뒤 응답 유실 | same-key replay, 7일 뒤 source digest reconcile | 이전 version으로 다음 이미지 업로드 |
| 여러 preview 중 종료 | 성공 digest 다음 position부터 순차 진행 | 성공 이미지 재생성·병렬 업로드 |
| NEW preview 만료·누락 | `PREVIEW_REFRESH` claim 뒤 새 quota로 image와 preview만 처리 | NEW를 RUNNING/PENDING으로 변경·result 반복 |
| 반려·승격과 restart 경합 | terminal 상태 확인, Job 중단·spool 삭제 | 후보를 NEW/PENDING으로 되돌림 |
| 알림 전후 종료 | persistent outbox delivery ID로 재개 | 후보 result rollback |

## 10. 암호화 작업 spool과 이미지 수명주기

Core result를 같은 bytes로 replay하려면 title·remote image URL이 포함된 canonical payload를 복원할 수
있어야 한다. 이를 Batch `ExecutionContext`에 넣지 않고 local encrypted spool에 둔다.

- 위치 기본값은 애플리케이션 data directory 아래 상대 경로다. directory `0700`, 파일 `0600`이며
  절대 경로를 DB·로그·Discord에 남기지 않는다.
- 파일은 AES-256-GCM으로 암호화하고 파일마다 새 nonce를 쓴다. master key는 macOS Keychain에 저장하며
  환경 변수·PostgreSQL·plist·Git에 넣지 않는다.
- DB에는 random `spoolRef`, payload SHA-256, 상태, 생성·만료 시각만 저장한다. `spoolRef`에서 외부 URL이나
  candidate 정보를 추론할 수 없어야 한다.
- result payload spool은 restartable 실패에서 최대 7일 보존한다. Job 완료 또는 candidate
  APPROVED/REJECTED 확인 시 즉시 삭제한다. 7일 뒤에는 삭제하고 자동 restart를 `RECONCILE_REQUIRED`로 닫는다.
- image temp는 생성 후 최대 24시간이다. 각 preview의 durable 성공을 확인하면 해당 local image를 즉시
  삭제한다. response loss이면 replay/reconcile 전까지 보존하되 24시간을 넘기지 않는다.
- 24시간 뒤 preview가 필요하면 `mode=PREVIEW_REFRESH`로 NEW 후보의 새 execution ID·version을 얻고 기존
  원격 URL metadata를 새 quota reservation으로 다시 받는다. 일반 claim·result는 반복하지 않는다.
  만료 local 파일이나 server preview를 영구 원본으로 승격하지 않는다.
- spool cleanup은 startup, Job terminal, 매시간 수행한다. 삭제 실패는 일반화 event와 metric으로 남기고
  파일명·경로를 외부 알림에 싣지 않는다.

서버 private preview는 기존처럼 Core가 최대 24시간 보관하고 반려·만료·재시도 교체·승격 때 삭제한다.
초안 승격에서 선택한 이미지만 검증·재인코딩해 영구 private 원본으로 저장한다. local temp와 server
private preview는 서로 다른 저장물이며 같은 cleanup worker가 관리한다고 가정하지 않는다.

## 11. 로컬 REST·Discord 보안

로컬 API 기본 origin은 `http://127.0.0.1:18787`이다. `0.0.0.0`, LAN 주소, 기존 Cloudflare Tunnel과
public reverse proxy bind는 거부한다. 다음 endpoint만 둔다.

| Method | Path | scope |
| --- | --- | --- |
| `POST` | `/local/v1/jobs/collect` | `collector.local.run` |
| `GET` | `/local/v1/jobs/{jobRequestId}` | `collector.local.read` |
| `POST` | `/local/v1/jobs/{jobRequestId}/stop` | `collector.local.stop` |
| `GET` | `/local/v1/status` | `collector.local.read` |
| `GET` | `/actuator/health/liveness` | loopback, 상세 없음 |
| `GET` | `/actuator/health/readiness` | `collector.local.read` |

- `POST /local/v1/jobs/collect` body는 `mode=COLLECT|PREVIEW_REFRESH`, 선택 `candidateId`, `lockVersion`,
  `nextPending`만 허용한다. 새 수동 `PREVIEW_REFRESH`는 관리자 검수 응답에서 받은 candidateId와 현재
  lockVersion이 필수다. 같은 execution의 자동 restart는 execution-state에서 재확인한 version을 사용한다.
  `COLLECT`는 candidateId 또는
  `nextPending=true` 중 정확히 하나가 필요하다. 원문 URL은 받지 않는다. 성공은 202와 `jobRequestId`,
  `state=QUEUED|RUNNING`, deduplicated 여부를 반환한다. 같은 `Idempotency-Key`·같은 body는 같은 응답,
  다른 body는 409다.
- `GET /local/v1/jobs/{jobRequestId}`는 trigger, Job/Step 상태, 선택 candidateId, 일반화 outcome,
  `createdAt`, `startedAt`, `finishedAt`, `restartable`만 반환한다. URL·title·spool ref·token은 반환하지 않는다.
- `POST /local/v1/jobs/{jobRequestId}/stop`은 202와 `state=STOP_REQUESTED`를 반환한다. terminal Job은 현재
  상태를 멱등 반환하고 다른 Job을 멈추지 않는다.
- `GET /local/v1/status`는 `asOf`, `partial`, `local` Job 집계, `core` 후보 집계, dependency별 상태·마지막
  성공 시각을 반환한다. Core 실패는 200 partial, local DB 실패는 503이다.

local API의 `jobRequestId`는 UUID, timestamp는 UTC RFC 3339 millisecond, 집계는 0 이상의 integer다.
`trigger`는 `DISCORD|REST|QUARTZ`, Job `state`는
`QUEUED|RUNNING|STOP_REQUESTED|STOPPED|COMPLETED|COMPLETED_WITH_WARNINGS|FAILED|RECONCILE_REQUIRED`다.
`POST /local/v1/jobs/collect`의 `candidateId`는 1 이상의 64-bit integer, `lockVersion`은 1 이상의 integer이고
`nextPending`은 boolean이다.
job 조회에서 아직 정해지지 않은 candidateId와 시작·종료 시각만 nullable이며 나머지 필드는 필수다.
모든 Core·local 오류는 공통 `{error:{code,message,details},meta:{requestId,timestamp}}` envelope를 사용하고,
`details`에는 allowlist field 오류만 넣으며 URL·owner·spool·stack은 넣지 않는다.

- 256-bit random bearer token을 scope별로 발급해 macOS Keychain에 저장한다. application DB에는 HMAC hash와
  발급·회전 시각만 둔다. Discord token과 Core service token을 재사용하지 않는다.
- cookie session, form login, CORS를 사용하지 않는다. state-changing REST에는 bearer와
  `Idempotency-Key`가 모두 필요하다.
- body size, content type, JSON schema를 제한한다. REST는 raw URL로 신규 후보를 직접 만들지 않고 기존
  candidateId 또는 `nextPending=true`만 받아 기존 접수 경계를 우회하지 않는다.
- Discord listener는 JDA Gateway를 사용하고 허용 guild·channel·user·role을 확인한다. `/collect url`은
  대상·source·예상 요청 종류를 보여준 뒤 확인해야 한다. `/collect status`는 읽기 전용이며 Job을 만들지 않는다.
- liveness는 JVM event loop만, processing readiness는 local DB·spool·Core BFF 연결을 본다. Discord 연결은
  별도 component 상태이며 Discord 장애가 Quartz·REST와 공개 서비스를 차단하지 않는다.

## 12. Quartz·stop·launchd

- candidate sweep trigger 기본 cron은 `0 0/15 * * * ?`, timezone `Asia/Seoul`이다. feature flag 기본값은
  false다. 실제 출처·quota·collector 계정 gate가 끝난 뒤에만 true로 바꾼다.
- `@DisallowConcurrentExecution`과 local active Job unique constraint를 함께 사용한다. misfire는
  `DO_NOTHING`이며 시작·절전 복귀 때 지난 fire를 몰아서 실행하지 않는다.
- 한 fire는 후보 1건만 처리한다. 대기 건이 남아도 같은 실행에서 loop하지 않고 다음 fire 또는 운영자
  수동 실행을 기다린다.
- stop은 새 Step 진입과 새 quota reservation을 즉시 막는다. network 요청이 이미 시작됐으면 제한 timeout까지
  기다리고, current lease가 유효하면 실패 result를 임의 생성하지 않은 채 `STOPPED`로 기록한다. heartbeat는
  shutdown 유예 동안 유지하고 종료 뒤 lease 만료 회수에 맡긴다.
- graceful shutdown 유예 기본값은 90초다. 완료하지 못한 Job은 restartable `STOPPED`로 남긴다.

macOS 자동 기동은 `launchd` 사용자 LaunchAgent를 기본안으로 확정한다. 이번 설계에서는 plist나 설치
script를 만들지 않는다. 구현 수용 조건은 RunAtLoad, crash 재시작 backoff, 고정 working directory,
JDK·jar 절대 경로, `umask 077`, stdout/stderr rotation, Keychain 접근 가능한 전용 OS 계정, 종료 시 SIGTERM
90초 전달이다. secret과 token을 plist argument나 environment에 넣지 않는다. PC·OS 계정과 실제 설치
경로는 운영자가 제공해야 한다.

## 13. 관측·상태·알림

구조화 log와 Micrometer metric을 사용한다. local 상세 실행 metadata는 14일, 일별 일반화 집계와
Core 운영 이벤트는 30일 보존한다. 로그는 200MiB 또는 14일 중 먼저 도달한 기준으로 순환한다.

상관 필드는 `jobRequestId`, Batch job/step execution ID, candidateId, collectorExecutionId,
quota reservation ID, Core `meta.requestId`다. source는 numeric ID 또는 HMAC alias만 기록한다. 원문 URL,
title, HTML, image bytes, local path, Discord raw user ID, token, stack 전체는 일반 로그·metric·알림에서 제외한다.

필수 metric은 다음과 같다.

- trigger별 submitted·deduplicated·rejected 수
- queued·running·stopped·restartable·reconcile-required Job 수와 실행 시간
- claim·heartbeat·lease expiry·stale fencing 수
- source별 quota remaining·rate limited 수와 request kind별 reservation 수
- fetch·parser·result·preview 성공·실패·응답 유실 조정 수
- spool 파일 수·bytes·expiry·cleanup 실패
- Discord 연결, notification retry·final failure, Core/BFF·local DB readiness

`/collect status` 기본 window는 24시간, 최대 7일이다. local Job 집계와 Core 집계를 `local`·`core`로 나눠
기준 시각과 stale 여부를 표시한다. PENDING 수를 알아내기 위해 claim하지 않는다.

Discord 결과 알림은 즉시 1회 뒤 1분·5분·15분에 최대 3회 재시도한다. 모두 실패하면 local outbox를
`FINAL_FAILED`로 기록하고 Core operational event를 보낸다. Core도 단절이면 outbox를 30일 보존하고
연결 복구 뒤 최대 시간당 1회로 전달한다. 같은 delivery ID는 중복 관리자 이벤트를 만들지 않는다.
후보 성공·실패와 알림 성공·실패를 별도로 표시한다.

## 14. 구현·전환 순서

1. 1차 Core migration은 candidate execution/result digest와 candidate image digest를 nullable로 추가하고,
   quota budget/reservation·operational event를 만든다. PostgreSQL `NOT VALID` CHECK도 새 row에는 적용되므로
   RUNNING execution 필수와 preview key/hash 동치 CHECK는 아직 추가하지 않는다. legacy row를 임의 값으로
   backfill하지 않는다.
2. 기존 5개 endpoint에 legacy 호환과 `SPRING_V2` 멱등·execution fencing을 함께 추가하고 4개 읽기·quota·
   event endpoint와 BFF 중계를 OpenAPI에 추가한다. old/new contract test를 통과시키되 Spring token은 비활성이다.
3. `apps/collector`와 전용 local PostgreSQL migration을 만들고 Boot/BOM·Gradle dependency lock과 SBOM을
   생성한다.
4. synthetic fixture로 Job/Step, SSRF, quota, spool, response-loss fault test를 통과시킨다.
5. Spring을 Quartz disabled 상태로 배포하고 local REST까지 검증하되 Core mutation은 아직 허용하지 않는다.
6. legacy Python 신규 claim을 중지하고 진행 lease·result·preview를 drain한다. 남은 legacy RUNNING은 정상
   종료 또는 기존 만료 규칙으로 처리한다. private preview는 재인코딩된 bytes라 업로드 원본 hash를 복원할
   수 없으므로 기존 row를 backfill하지 않고 24시간 TTL cleanup으로 key·expiry를 모두 비운다.
7. legacy mutation을 차단한 상태에서 RUNNING/preview 잔여 row를 확인한 뒤 2차 migration으로 엄격 CHECK를
   ADD·VALIDATE한다. 그 다음에만 `SPRING_V2` token을 활성화하고 REST→Discord→Quartz
   순으로 검증한다. 두 token을 동시에 claim 가능 상태로 두지 않는다.
8. 7일 관찰과 Spring smoke·reconcile이 끝난 뒤 Python 설정·credential을 폐기한다. 이 단계 전에는 Python
   파일을 삭제하지 않는다.
9. 실제 출처·robots·이용 조건, Discord App, 운영 계정·연락처와 go-live 승인을 받은 뒤 Quartz flag를 켠다.

rollback은 Spring 신규 실행을 끄고 기존 Core/BFF route와 수동 게시를 유지하는 방식이다. Core의 additive
필드·테이블은 즉시 drop하지 않는다. Python 재가동은 credential·contract 호환과 별도 승인 없이 자동으로
수행하지 않는다.

## 15. 수용 시험

### 계약·동시성

- legacy token만 old request를 허용하고 `SPRING_V2` token은 첫 요청부터 execution fencing을 적용한다.
- Python lease drain 전 Spring claim이 거부되고 Spring 활성화 뒤 legacy token의 신규 claim이 거부된다.
- 1차 nullable migration은 legacy RUNNING·preview row가 있어도 배포되고, preview hash나 legacy execution
  ID를 임의 생성하지 않는다. drain·기존 preview 전체 TTL cleanup 뒤 2차 엄격 CHECK ADD·VALIDATE가
  실패하면 Spring mutation 활성화를 중단한다.
- claim·heartbeat·result·preview 각각 commit 뒤 응답 유실에서 same-key replay가 같은 응답을 반환한다.
- 7일 멱등 만료 전후에 digest reconcile 또는 `RECONCILE_REQUIRED`로 끝나며 mutation을 추측 재실행하지 않는다.
- stale execution, stale lockVersion, 만료 lease, 반려·승격 경합이 Core 상태와 object를 바꾸지 않는다.
- Discord·REST·Quartz 동시 요청이 한 candidate를 두 번 처리하지 않고 다른 candidate도 기본 동시 1을 지킨다.

### quota·외부 요청

- robots, detail, redirect 각 hop, 각 image, HEAD+GET을 정의대로 각각 센다.
- 100개 병렬 reservation과 날짜 경계에서 daily limit을 넘지 않는다.
- reservation 응답 유실은 중복 차감하지 않고, `NETWORK_STARTED` 뒤 retry는 새 reservation으로 센다.
- restart·local DB restore·Core timeout에도 quota가 초기화되지 않는다.
- DNS rebinding, private·loopback·link-local·metadata IP, redirect 3회 초과, 비HTML, 크기·timeout을 차단한다.

### restart·이미지·운영

- 모든 장애창을 process kill로 재현하고 Step checkpoint와 Core 상태가 설계표와 일치한다.
- 여러 preview 중 각 position 전후 종료, 24시간 만료, reject/retry/promote race에서 중복·고아 object를 회수한다.
- 암호화 spool 권한·복호화 실패·Keychain 잠금·TTL cleanup을 검증하고 금지 데이터가 DB/log/alert에 없는지 검사한다.
- Quartz overlap·misfire·절전 복귀가 catch-up 폭주를 만들지 않는다.
- REST 외부 bind·무인증·wrong scope·replay를 거부하고 Discord 단절 중 REST·Quartz와 공개 BE·FE가 정상 동작한다.
- 알림 3회 실패가 후보 결과와 분리되고 관리자 운영 이벤트에 한 번 나타난다.
- local PostgreSQL backup restore 뒤 자동 실행 전에 reconcile이 수행된다.

## 16. 외부 사실·미검증

다음은 설계 미완료가 아니라 실제 입력·승인 또는 구현 증거가 필요한 항목이다.

- 실제 실행 PC, 전용 macOS 계정, 설치 경로, 선택 JDK 배포판의 라이선스·업데이트 운영
- Discord Application·guild·channel·user·role, bot token, 보고 webhook과 Core collector token 발급·회전
- 실제 출처 URL·허용 path·이용 조건·robots 확인일·parser selector·User-Agent 연락처·출처별 interval·daily limit
- Spring source, Core/local migration, OpenAPI, fixture·contract·integration·fault test, build·SBOM·runtime
- 실제 BFF/Core/R2/Discord/출처 연동과 운영자 go-live 승인

위 실제 값은 문서에 secret 원문으로 기록하지 않는다. 구현 증거가 없고 주 검수가 진행 중이므로 현재
상태는 `설계 보완안`이며 `구현 완료`나 `수집 활성화 가능`이 아니다.


## 16. 원문 수집과 별도 PC 실행 확장

2026-09-20 사용자 결정에 따른 설계. 문서 작성과 구현·실제 Discord·원격 PC 운영 검증은 별도다.
기존 metadata 모드와 여섯 Batch Step·lease·quota·spool·멱등 계약을 유지하면서 아래 계약을 추가한다.

### 실행과 URL 입력

- `apps/collector` Java/Spring 프로세스와 Quartz는 서비스 서버와 **다른 컴퓨터**에 설치한다.
  `COLLECTOR_CORE_ORIGIN`은 서비스의 HTTPS origin이고 기존 `/api/collector/v1/*` 중계를 사용한다.
  `127.0.0.1:3000` 기본값은 같은 개발 PC에서의 테스트용이다. 원격 PC에서는 자기 자신을 가리키므로 사용할 수 없다.
- 수집기 제어 API `127.0.0.1:18787`과 실행 이력 PostgreSQL은 수집 PC 안에만 둔다.
  서버에 수집기 container·cron을 추가하거나 서비스 PostgreSQL 포트를 외부에 열지 않는다.
  실행 PC는 macOS·Windows·Docker/Linux를 지원 대상으로 한다. 전용 계정·설치 경로는 `(미정)`이며 OS별 실제 실행 검증은 별도다.
- `POST /local/v1/candidates`는 `{originUrl}` 한 건을 받는다. 기존 loopback bearer `collector:run` 권한과
  `Idempotency-Key`를 적용한다. 승인된 source 설정으로 URL을 검증하고 Core `/candidates`에 먼저 접수한 뒤
  반환 candidateId로 `CollectorRunService.submit(REST, ...)`를 호출한다. 응답은 candidateId·jobRequestId·state다.
  응답 유실은 같은 key/같은 URL로 재전송한다. 다른 URL은 Core receipt가 409로 거부한다.
  Core 접수 후 로컬 queue 기록 전 중단도 같은 key replay로 복구한다. 새 key의 같은 URL은 기존 중복 계약을 따른다.
- 기존 수동 Discord 경로는 Core 후보 queue 호환을 유지한다. direct batch Discord 경로는 확인 후 `collect.batch_run`과
  `collect.batch_item(DISCOVERED)`을 직접 만든다. 수집 PC가 꺼지면 batch checkpoint 기준으로 재시작한다.

### 원문 parser와 네트워크 경계

- source 설정의 `parser=THEQOO`가 원문 모드를 선택한다. 미지정은 기존 metadata parser다.
  더쿠는 `article[itemprop=articleBody]` 한 개를 요구하며 제목·본문이 없거나 구조가 달라지면 실패한다.
- 본문을 순회해 TEXT, IMAGE, LINK 블록을 만든다. raw HTML과 임의의 iframe HTML은 보내지 않는다.
  SNS blockquote/iframe은 참조 URL로 치환한다. 동영상·오디오 binary는 받지 않고 출처 URL을 LINK로 보존한다.
- detail URL과 redirect는 출처 host/path 제한을 그대로 적용한다. 첨부 CDN은 `imageOrigins`의 정확한 HTTPS
  origin과 path prefix를 따로 허용한다. wildcard host·임의 외부 URL은 허용하지 않는다. 이미지 redirect도 같은
  허용 origin 안에서만 처리한다. 모든 실제 요청은 기존 pinned DNS·public IP 검사·quota·timeout·크기 제한을 거친다.
- 반복된 같은 이미지도 본문의 위치를 잃지 않도록 각 IMAGE 위치에 독립 후보 번호를 부여한다.
  빈 이미지 주소·알 수 없는 본문 iframe 주소·한도 초과를 조용히 버리지 않고 PARSE_FAILED로 처리한다.

### Result와 후보 보관

- 성공 result의 optional `contentBlocks`는 원문 모드의 표시이며 1~1000개다. 없으면 기존 metadata 모드다.
  TEXT는 `{type:TEXT,text}`(trim 후 1~20,000자), IMAGE는 `{type:IMAGE,imagePosition,alt}`(1~20, alt 0~300자),
  LINK는 `{type:LINK,url,label}`(HTTP(S) URL 2,048자 이하, label 0~300자)다. LINK는 서버의 fetch 명령이 아니다.
- imageCandidates는 direct batch 원문 모드에서 0~200개, metadata 모드에서 기존 1~20개다. imagePosition은 연속된 후보
  position을 빠짐없이 정확히 한 번씩 참조해야 한다. source title·본문은 요약하거나 한도에 맞춰 자르지 않는다.
- `collect.candidate.content_blocks JSONB NULL`에 저장한다. NULL은 legacy/PENDING/실패/반려 상태이며
  result metadata·image row·digest·NEW 전환과 같은 transaction에서 저장한다. retry·reject 시 비운다.
  승인 후에는 해당 후보의 기존 보존 정책을 따른다. 이미지 binary는 DB에 넣지 않는다.
- 관리자가 상세 조회할 때만 contentBlocks를 받는다. 공개 후보 API는 만들지 않는다. 수집기에서는 exact result bytes를
  기존 암호화 spool에만 보관하고 Batch/Quartz 실행 metadata·로그에는 본문·URL을 넣지 않는다.

### 검수와 초안 승격

- 원문 모드에서는 본문 순서와 첨부 연결을 검수 화면에 보여준다. 본문 전체 대신 leadText를 입력하거나 일부 이미지를
  선택해 누락시키지 않는다. 모든 이미지의 preview 또는 운영자 대체 업로드가 필요하며 설명은 수정할 수 있다.
- 승격은 저장된 contentBlocks를 사용한다. TEXT를 그대로 복사하고 IMAGE의 position을 새 imageId로 연결한다.
  LINK는 label(있으면) TEXT와 URL TEXT로 변환해 기존 게시글 표시기를 사용한다. 변환 후 1000블록 초과도 거부한다.
  링크 label과 URL이 같으면 URL 한 블록만 만든다. SNS URL은 독립 TEXT로 남아 공식 임베드 대상이 된다.
- contentBlocks가 있으면 이미지 0건도 허용한다. 모든 참조 이미지의 선택을 요구하며 leadText는 거부한다.
  metadata 후보는 기존 이미지 선택·leadText 방식을 유지한다. 부분 파일 실패는 NEW를 유지하고 초안을 만들지 않는다.
- 새 migration V006은 additive SQL로 적용하며 기존 25건 게시글·원문 보관 schema를 변경하지 않는다.
  V006은 원문 보존 migration이다. 현재 수집 기능과 Spring transition readiness는 §17의 V007을 요구한다. 수집 기능이 꺼진 Core는 V003~V007의 호환 범위를 유지한다.

### 수용 검증

1. 같은 fixture의 문단·이미지·SNS 순서, 텍스트/SNS만 있는 원문, 중복 이미지, 한도 초과·구조 변경을 검사한다.
2. 허용 CDN·사설 주소·redirect·미등록 host 경계를 검사한다. 비밀·본문을 로그에 남기지 않는다.
3. 성공 result DB readback·재전송·다른 payload 충돌·stale execution 거부를 검증한다.
4. 첨부 누락 승격 차단·전체 본문 승격·TEXT-only·SNS 링크 보존·retry/reject 초기화를 확인한다.
5. URL 접수·Discord·Quartz의 공통 queue와 기존 restart/response-loss 검증을 재실행한다.
6. 격리 test 통과와 실제 다른 PC 설치·Discord Gateway·출처 호출을 구분해 보고한다.


### 운영체제별 설정 경계

- 사용자 추가 결정: 실행 PC는 macOS, Windows 또는 Docker의 Linux일 수 있다. 동일 jar·원문 계약·Core API를 사용한다.
- macOS Keychain은 기존 기본값이다. `collector.secrets-directory` 또는 `COLLECTOR_SECRETS_DIRECTORY`를 지정하면
  계정별 파일 backend를 사용한다. CLI migration·backup·URL 접수에도 같은 경로를 적용한다.
- secret·config·암호화 spool·백업은 POSIX 소유자 권한 또는 Windows 소유자 전용 ACL로 검사한다. symlink와
  권한 검증 불가 파일시스템은 거부한다. 파일은 이미지에 COPY하지 않고 외부 mount로 제공한다.
- macOS launchd, Windows 작업 스케줄러, Linux 서비스/별도 PC Compose는 시작 방식만 다르다.
  Docker의 collector와 실행 DB는 host port를 열지 않는다. 제어 API는 container 내부 loopback에 유지하고
  `SubmitUrlMain`으로 URL 요청 파일을 접수한다. 서비스 Core·DB의 공개 범위는 바꾸지 않는다.
- 실제 Windows ACL·서비스 등록, 각 OS의 절전 복구·Docker host mount 권한·backup 도구 검증은 별도 수용 증거다.

## 17. Hot/Top discovery와 출처 registry (2026-09-21)

이번 개발 범위는 planning의 21개 출처 확장이다. 기존 여섯 Step은 상세 수집 pipeline으로 유지한다.
`source key`는 arcalive 같은 안정된 문자열이며 Core의 숫자 `sourceId`와 다르다. registry는 host와
선택 coreSourceId를 대조하고 모호한 중복 설정을 거부한다. 이름만 등록한 출처는 BLOCKED이며 METADATA로 대체하지 않는다.

- source registry → site list adapter → canonical/post key 중복 제거 → 공통 후보 접수 → 기존 상세 pipeline.
- registry는 `source/sites/`의 사이트별 adapter를 선택한다. 21개 adapter·상세 parser와 목록을
  지원하는 19개 parser를 독립 파일로 분리했다. 구조·의존 규칙·검증 근거는 [사이트별 모듈 계약](08-code-structure.md#collector-site-modules)을 따른다.
  DOM 순서 보존기는 공유하지만 본문 selector는 사이트별로 고정한다. 목록 미지원 사이트는 상세 전용으로 유지하며
  목록 접근 성공을 상세 수집 성공으로 간주하지 않는다. 실측 selector·chart URL·본문/이미지·canonical·post key·fixture는
  planning의 검증표와 설정에 기록한다.
- CLI: `bin/blariyo-collector batch --source <key> --chart hot --max-pages 2 --max-items 20 --since 24h --dry-run|--write-db`.
- DETAIL_ONLY 또는 Discord/manual URL 경로는 목록 discovery 없이 단일 상세 URL만 처리한다. CLI는
  `bin/blariyo-collector collect-url --source <key> --url <detail-url> --dry-run|--write-db`를 사용한다.
  이 경로도 Core API를 글마다 호출하지 않고 `collect.batch_run`, `collect.batch_item`, `collect.batch_media`와
  `collect/raw/*`, `collect/media/*`, `collect/report/*` object prefix를 직접 사용한다. `theqoo`는 fixture 기반으로
  이 write path를 검증했지만, live URL·운영 S3/R2·Discord Gateway E2E는 별도 검증 전까지 완료로 표시하지 않는다.
  Java 25 jar를 macOS·PowerShell·Docker Linux에서 공통 실행한다. `COLLECTOR_SOURCES_FILE`,
  `COLLECTOR_CONFIG_FILE`, `COLLECTOR_JAR`로 경로를 주입하고 secret은 기존 전용 파일 backend를 사용한다.
- max-pages 1~10, max-items 1~100, since 1h~720h, interval 최소 10초·최대 1시간. 출처 설정이 더 엄격하면 낮출 수 없다.
  게시 시각을 확정하지 못하면 since 필터를 통과시키지 않는다. 다음 페이지는 실제 목록의 허용 pagination 링크만 따른다.
- robots는 query·wildcard·가장 구체적인 User-agent와 Allow/Disallow를 평가한다. HTML challenge·미확인은 차단한다.
  robots가 지정한 Crawl-delay와 설정 interval 중 큰 값을 적용한다. 403·429·robots 금지 시 출처 실행을 즉시 멈춘다.
  목록 redirect는 변경된 base URL을 검토할 때까지 SOURCE_REDIRECT_REVIEW_REQUIRED로 차단한다.
  목록 timeout/5xx는 최대 2회만 추가 재시도(1초·2초 backoff와 최소 간격 적용), parser 오류는 자동 재시도하지 않는다.
- 목록 요청도 Core 전역 source budget에서 예약한다. `discovery:true` 예약은 candidateId/lockVersion 없이
  ROBOTS/LIST/REDIRECT만 허용하고, V007의 `source_discovery_policy.enabled`를 확인한다. 후보는 LIST_CRAWL로 생성한다.
  실행 모드는 검증 fixture와 실제 출처를 구분하며, 로컬 카운터로 Core quota를 우회하지 않는다.
- 재수집 기본 skip. update는 기존 승인/반려 후보를 덮어쓰지 않는 version·검수 계약을 추가한 뒤 제공하며,
  미구현 update 옵션을 성공으로 받지 않는다. canonical과 source post key가 다른 게시물을 합치면 안 된다.
- 본문 이미지는 `img[src]`, `data-src`, `data-original`, `data-original-src`, `data-lazy-src`,
  `data-srcset`/`srcset`, CSS `background-image`를 순서대로 해석한다. `srcset`은 가장 큰 width/density 후보를 선택한다.
  후보 URL은 `SourcePolicy.imageOrigins`의 정확한 HTTPS host/path prefix를 다시 통과해야 하며 실패 시 성공 처리하지 않는다.
- 목록 discovery는 타 사이트 공지·필독·운영 안내를 후보 큐에 넣지 않는다. 공통 필터는 row/link class·id의
  `notice/noti/fixed/sticky/pinned`, badge text `공지/알림/필독/NOTICE`, 제목 prefix `공지:`·`[필독]`을 제외한다.
  일반 게시글 제목 중간에 같은 단어가 들어간 경우까지 광범위하게 제거하지 않는다.
- SNS는 a[href], iframe[src], blockquote의 permalink/cite 및 본문 URL을 LINK로 보존한다.
  SNS API·영상 binary·로그인 요청은 하지 않는다. mp4/mov/mp3/wav는 현재 첨부 다운로드 대상이 아니라 LINK 블록으로만
  보존한다. 화면의 기존 공식 임베드 allowlist를 그대로 적용한다.
- JSON/JSONL 보고는 run ID·출처 key·상태·개수·일반 오류 코드·candidate/job ID만 포함한다.
  제목·본문·원문 URL·secret·쿠키·내부 경로를 일반 로그로 출력하지 않는다.
- 성공은 목록→상세→본문/이미지/SNS→Core API 저장→개발 DB readback으로 판정한다.
  실제 Discord Gateway 연결·확인 interaction 검증은 fixture 시험과 별도다.

### V007 저장 계약과 당시 구현 한계 — legacy 경로

이 절은 API candidate 중심 경로를 만들던 당시의 계약과 한계다. 현행 batch CLI의 저장·dry-run·parser 상태는
아래 §18 이후 direct ownership 계약과 실제 출처별 검증표를 따른다. 아래 API quota 예약·파일 미저장 설명을
현행 direct batch 실행의 동작으로 해석하지 않는다.

- `collect.source_discovery_policy`: source별 별도 opt-in, 검토일·정책 버전·목록 URL. migration은 출처를 활성화하지 않는다.
- `collect.candidate.discovery_mode`: MANUAL_URL 또는 LIST_CRAWL. 두 경로는 같은 claim/fencing/result/media 단계를 사용한다.
- `source_post_key`: Core가 URL에서 계산하며 `(source_id, source_post_key)` 부분 unique index로 보호한다.
  기존 후보의 NULL 키는 자동 backfill하지 않았다. 기존 데이터의 URL 별칭 중복 감사와 backfill은 운영 전 필요하다.
- V007 down은 LIST_CRAWL 후보 또는 LIST 예약이 있으면 먼저 거부한다. 데이터를 삭제해 rollback을 통과시키지 않는다.
- `--dry-run`도 실제 robots/list GET과 Core quota 예약은 발생한다. 후보/본문/이미지는 저장하지 않는다.
  `--write-db`의 QUEUED는 candidate/job 접수이며 상세 저장 성공이 아니다. 별도 job 상태와 DB readback이 필요하다.
- 실제 URL 상세 parser 4종, 기존 THEQOO parser 1종. 다른 16종 상세 parser와 17종 목록 adapter는 미구현이다.
  첨부 파일은 LINK 참조만 보존한다. 파일 binary 저장, update 재수집, 전체 사이트 E2E는 미완료다.
- 상세 내용과 현재 증거는 [출처별 검증 계약](../planning/content-collection/reference-site-validation.md)을 따른다.

## 18. Batch direct ownership reset (2026-09-21)

기존 `CandidateIntake`·`CoreClient` 경로는 수동 URL 호환 경로로 남아 있지만 batch 기본 실행 경로가 아니다. batch는
외부 목록·상세 GET, parser, dedup, Discord 확인 입력, PostgreSQL `collect.batch_*` 쓰기, object store 업로드와 report를
직접 소유한다. 글마다 Core API를 호출하거나 Core quota/lease를 중계하지 않는다. `DirectBatchRunner`의 write 경로는
`collect.batch_run`, `batch_item`, `batch_media`, `batch_failure`, `batch_report`, `batch_checkpoint`만 변경한다.

API 애플리케이션 role은 이 batch 테이블에 SELECT만 가지며, `batch-items/:itemId`는 조회 전용이다. 운영자 검수와
승인된 결과의 content 초안 승격은 API가 소유한다. batch는 `content.*`와 공개 상태를 변경하지 않는다. batch migration은
`collector-v002.sql`로 직접 적용되며 기존 API V001~V007 migration과 독립적이다. 운영 DB에서는 batch role에 collect.batch*
쓰기, API role에 SELECT만 부여한다.

object store는 `BatchObjectStore`가 `collect/raw`, `collect/media`, `collect/report` prefix만 허용한다. 환경 변수로
로컬 readback 디렉터리 또는 운영자가 제공한 S3/R2 presigned PUT URL template을 선택한다. DB row는 object key·SHA-256·MIME·size를
기록하고 binary를 PostgreSQL에 넣지 않는다. upload 후 DB insert가 실패하면 실행은 실패로 남기고 object cleanup/retry 작업이
필요하다. 현재 구현은 media 원격 binary 다운로드와 실제 S3/R2 readback을 아직 완료하지 않았으므로 운영 성공으로 표시하지 않는다.

Discord `/collect url`의 확인 전 단계는 암호화 spool과 confirmation만 만든다. 확인 버튼 이후 `BatchStore.queueManual`이
`collect.batch_run`과 `collect.batch_item(DISCOVERED)`을 직접 만들며 API 후보·예약·결과 endpoint를 호출하지 않는다.
Gateway 자체 연결·상호작용은 별도 운영 증거로 기록하며, 테스트에서 Gateway를 대신 표시하지 않는다.

## 2026-09-23 direct batch 검수·승격 구현 계약

- API/batch는 같은 PostgreSQL database의 collect schema를 서로 다른 role로 접근한다. 별도 실행 컴퓨터가 별도 database를 뜻하지 않는다.
- batch-owned 7개 테이블은 API SELECT only. API-owned `collect.batch_review`, `collect.batch_review_request`는 batch에 권한을 주지 않는다.
- review는 item UUID를 unique key로 보관하고 item version, canonical hash, source key/post key, 검수 상태, lock version, post ID를 갖는다. batch migration과 독립 적용을 위해 item의 존재와 version은 서비스가 검사하며 content post FK와 중복 제약은 DB에서 보장한다.
- API: GET `/api/v1/admin/collect/batch-items`, GET `/{itemId}`, POST `/{itemId}/review`, POST `/{itemId}/draft`. 인증·별도 `COLLECT_BATCH_REVIEW_ENABLED` gate·OpenAPI 검증을 사용한다.
- 목록은 page·source·state(수집 상태)·reviewStatus(검수 상태)를 조합하고 같은 조건으로 전체 건수와 페이지를 계산한다.
  검수 행이 없으면 UNREVIEWED로 분류한다. 검수 필터가 수집 item 상태를 변경하지 않는다.
- 관리자 메뉴의 수집 결과 검수는 기존 Web `collectBatchReviewEnabled`가 켜진 경우만 표시한다.
  BFF의 인증된 `GET /api/admin/features`는 메뉴 표시용 batchReview boolean만 반환하며 private/no-store다.
  실제 API는 기존 Web/Core feature gate와 관리자 인증을 각각 유지한다. 초안 링크는 `/admin?postId=<id>`로 연결한다.
- review 명령은 `itemVersion`, `lockVersion`(최초 0), `decision`을 받는다. 모든 쓰기는 Idempotency-Key를 사용한다. 동일 key/동일 body는 결과 재생, 다른 body는 409. version 충돌·이미 승격된 item·승인 없는 승격을 거부한다.
- 승격은 collect reader의 고정 local root 또는 전용 read credential의 S3 bucket만 읽는다. object key prefix/path 검증, byte limit, DB sha/size 확인 후 이미지 decode/재인코딩을 수행한다. 원문 remote URL로 대체 fetch하지 않는다.
- private 이미지 준비 뒤 transaction에서 item/review version과 중복을 재확인하고 전체 순서의 DRAFT와 post 연결·receipt를 함께 commit한다. 실패 시 준비된 미연결 이미지를 정리한다. 공개 object는 별도 발행에서만 만든다.
- preview는 관리자 인증 경로만 사용한다. 일반 공개 media 프록시는 collect/private를 허용하지 않는다.
- 완료는 서비스/API 실행·migration/state/unique/optimistic lock·실패재시도·중복·DB/object readback·별도 발행·격리 숨김/재발행 테스트로 판정한다. 설계 기록만으로 완료가 아니다.

검수 일관성 보강(2026-09-23): REVIEWING 시작 시 item 식별자·버전·본문·SNS·첨부·media 위치/hash/key의
SHA-256 snapshot을 API 소유 review 행에 기록한다. 승인과 초안 승격 때 같은 snapshot인지 대조한다.
변경된 원문은 기존 승인으로 승격하지 않고 REVIEWING을 다시 시작한다. 조회는 PostgreSQL repeatable-read로
item/media를 함께 읽는다. 승격 최종 트랜잭션에서도 snapshot을 재대조하며 외부 원문 fetch는 없다.
초안 응답의 lockVersion은 content 게시글 버전이고 reviewLockVersion은 검수 행 버전이다.
승격 제목은 운영자가 200자 이내로 별도 지정할 수 있으며, 지정하지 않으면 원문 제목을 사용한다.
신규 API private 이미지는 content/private/staging/*를 사용하며, 기존 staging/*의 조회·회수 호환은 유지한다.

관리자 batch 이미지 preview는 인증된 GET `/api/v1/admin/collect/batch-items/{itemId}/media/{position}/preview`만 제공한다.
DB에 저장된 collect object key를 읽고 hash/size를 대조하며 허용한 실제 이미지 형식으로 디코딩·검증한다.
외부 URL을 재요청하거나 collect prefix를 익명 공개하지 않는다. 수집 서버의 잘못된 Content-Type은 파일의
실제 디코더 형식으로 판정한다. 수집 이미지의 preview와 초안 승격은 같은 전용 검증을 사용한다.
수집 파일당 30MiB, 한 프레임 40,000,000픽셀, 최대 500프레임을 유지한다.
전체 64Mi픽셀 이내는 기존 재인코딩 경로를 사용한다. 이를 넘는 GIF/WebP는 아래 분할 디코딩·컨테이너
정제 경로를 사용하며, 메모리 제한을 해제하지 않는다. 일반 업로드의 200프레임/
40,000,000 디코딩 픽셀 제한은 변경하지 않는다. 수집 GIF는 중복 프레임과 지연·반복 정보를 유지한다.
한도 초과는 일부 프레임으로 잘라 성공시키지 않고 명시적으로 거부한다. 검수 UI는 이미지 로딩 실패 시
미리보기 불가 안내와 원문 확인 링크를 표시한다. 제한 자체를 우회하는 다운로드 경로는 만들지 않는다.
원본 bytes는 collect에 남고 API private/public에는 검증·재인코딩 또는 아래 컨테이너 정제를 마친 사본을 사용한다.

Direct batch 재시도 계약(2026-09-23): 목록/상세/redirect/이미지/첨부에 같은 요청 간격을 적용한다.
429/408/5xx 및 제한된 DNS/transport 오류는 최초 포함 최대3회, interval과 지수 대기 및 Retry-After 중
긴 값을 사용한다. Retry-After가60초를 넘으면 일찍 재요청하지 않고 이번 사이트 실행을 중단한다.
403/401은 재시도하지 않는다. 접근 제한·일시 장애의 재시도 소진은 site stop이며 HTML 구조 오류는
최대3개 실패 후 중단한다. 404/410 삭제는 SOURCE_GONE으로 구분한다. 개별 글 삭제·파일 크기·본문/이미지
한도 초과는 다른 글의 구조 장애로 합산하지 않고 최대 글 수 안에서 skip한다. 실패 자체는 report와 failure에 남긴다.
DB session advisory lock으로 동일 source의 manual/list write 실행을 직렬화한다. 잠금이 있으면
BATCH_SOURCE_BUSY로 종료하며, 잠금 확보 후 남은 RUNNING 실행은 BATCH_OWNER_LOST로 실패 처리한다.
새 실행에서 미완성 DISCOVERED/FETCHING/FAILED/BLOCKED item만 다시 처리하며 미완성 media 행을
같은 트랜잭션에서 교체한다. FETCHED snapshot과 API 검수/content는 변경하지 않는다.
이 동작은 사용자가 새 CLI 실행을 요청했을 때의 재시도이며 차단 우회가 아니다.
batch object 설정은 COLLECTOR_*만 사용한다. API의 R2_PRIVATE_* 자격 증명으로 fallback하지 않는다.

목록 유형 보정(2026-09-23): HOT_LIST는 hot, GENERAL_LIST는 latest를 사용하고 chart 생략 시 defaultChart를 따른다.
DETAIL_ONLY에는 chart를 정의하지 않는다. 날짜 미확인 항목은 INCLUDE_UNKNOWN에서 unknownDates로 보고하며,
REQUIRE_KNOWN에서는 FETCHED로 저장하지 않고 SKIPPED_POLICY 상태와 skippedByDate에 포함한다. since 24h만으로 시각 미확인 글까지 최근24시간으로
판정하지 않는다. 상세 수량·페이지·요청 간격은 source별 상한/최솟값을 준수한다.

### Batch V003 상태 전이와 실행 소유권

이 절은 구현 계약이다. 실제 적용·검증은 migration ledger와 테스트 결과로 별도 확인한다.

- source advisory lock을 보유한 동일 PostgreSQL 연결에서 모든 수집 쓰기를 실행한다. 연결이 끊기면
  다른 pool 연결로 쓰기를 이어가지 않는다. `RUNNING`은 source당 하나이며 run의 backend 소유자를 기록한다.
- DB trigger가 해당 source 잠금 보유, 실행 상태, backend, version 증가, item/source 일치를 검사한다.
  종료된 run과 FETCHED item/media는 runtime에서 불변이다. 아래 V006의 소유자 전용 MIME 정정은 별도 감사 경로다. 새 잠금 소유자만 이전 RUNNING을 BATCH_OWNER_LOST로 종료할 수 있다.
- DISCOVERED/FETCHING/FAILED/BLOCKED의 재시도는 새 실행에서 FETCHING으로 claim한다.
  V004에서 상세 fetch 전 item 등록과 fetch·parse 오류의 item 상태 기록, 기간 제외 상태를 추가한다.
  V003까지의 과거 parser 이전 실패는 failure 행만 남을 수 있다.
- 네트워크 대기 동안 DB transaction을 유지하지 않는다. 잠금은 session 범위이며 DB 변경만 짧은 transaction이다.
- 새로운 media key는 `collect/media/{runId}/{itemId}/{position}`이다. 연결을 잃은 이전 실행의 늦은 object PUT이
  새 실행의 사본을 덮어쓰지 못한다. 기존 `collect/media/{itemId}/{position}`는 읽기 호환을 유지한다.
- `batch_report`는 실제 저장한 report key/hash/JSONL 행 수를, `batch_checkpoint`는 실행의 진행 상태/version을 기록한다.
  report·checkpoint 기록과 run 종료는 동일 DB transaction으로 확정한다. 갑작스러운 process 종료는 완성 report 없이
  owner lost로 남을 수 있으며, 새 실행이 성공했다고 과거 실행을 성공으로 바꾸지 않는다.
- V003 적용 전 실행 중인 batch를 정상 종료하고 백업한다. 기존 ledger checksum은 수정하지 않는다.
  migration·lost backend·무잠금 쓰기·불법 전이·완료 snapshot 불변·재시도는 격리 PostgreSQL에서 검증한다.

### Batch V004 개별 실패와 기간 제외 계약

- 목록과 수동 URL 모두 상세 fetch 전에 source post key/canonical hash로 item을 FETCHING claim한다.
  FETCHED 중복은 상세·미디어 요청 전에 건너뛴다. fetch 성공 원문은 parse 전에 저장한다.
- fetch/parse/raw/media 실패는 해당 item의 FAILED/BLOCKED와 failure phase/code를 함께 기록한다.
  과거 item 없는 failure 행을 성공·실패 item으로 소급 조작하지 않는다.
- 날짜 미확인 REQUIRE_KNOWN, 기간 밖 날짜는 SKIPPED_POLICY로 구분한다. skip_reason은
  SOURCE_DATE_UNKNOWN 또는 SOURCE_OUTSIDE_WINDOW다. 실패 건수에는 더하지 않으며 재실행 시 다시 판단할 수 있다.
- API 결과 조회는 failureCode와 skipReason을 반환한다. 실패·기간제외 항목은 승인/초안 승격할 수 없다.
- V004는 V003 위에 새 migration으로 적용한다. 기존 완료 snapshot과 migration checksum을 변경하지 않는다.


## 2026-09-23 다중 이미지와 수집 용량 계약

- Web 중계 대기 시간은 batch 초안 승격 180초, batch 이미지 preview 60초다. 일반 JSON 요청 15초와 일반 이미지 업로드 60초는 유지한다. 응답을 받지 못하면 새 요청 키로 다시 생성하지 않고 같은 멱등 키와 본문으로 완료 결과를 조회한다.
- 멱등 영수증은 관리자 식별값에도 종속된다. 지속적인 로컬 개발 서버는 cookie 토큰을 재발급해도 관리자 식별용 비밀값을 권한 600의 Git 제외 파일로 보존한다. 이전 임시 식별값의 영수증은 이력으로 남기며 새 식별값에 임의로 이전하지 않는다.
- API 초안의 이미지 준비에는 120초의 처리 예산을 둔다. 이미지 처리 전·후와 DB 확정 직전에 경과 시간을 검사하며, 초과하면 503으로 거부하고 준비한 사본을 기존 회수 경로로 넘긴다. 이미 시작된 파일 I/O를 강제로 중단하는 전체 요청의 절대 기한은 아니다. 이미지 디코딩/재인코딩은 작업당 30초로 제한한다. 잠금·저장소 지연으로 중계 응답을 잃어도 DB에 확정한 초안과 영수증을 먼저 확인해 사본을 잘못 삭제하지 않는다.
- direct batch는 원문 이미지 최대 200개, 첨부 최대 20개, 본문 최대 1000블록을 보존한다. 초과한 원문을 잘라 성공 처리하지 않는다.

- source 설정 `mediaLimits`의 `maxImages`(1~200), `maxFileBytes`(1~31457280), `maxTotalBytes`(1~157286400)는 생략하면 각 상한을 기본값으로 사용한다. 사이트별로 낮출 수 있고 전역 상한을 높일 수 없다.
- 파일당 30MiB, 이미지와 첨부를 합친 글당 150MiB를 순차 다운로드 중 검증한다. 남은 용량을 넘는 파일은 object 저장 전에 실패한다. HTML 원문 30MiB 제한은 별도다.
- API 수집 이미지 preview/초안 승격은 동일한 30MiB 입력 한도를 사용한다. 승격 전에 모든 media의 크기 합계 150MiB를 확인하며, 재인코딩한 이미지도 개별 30MiB·합계 150MiB를 넘으면 쓰기 전에 거부한다. 이미 준비한 사본은 기존 실패 복구 경로로 회수한다.
- 일반 관리자 업로드 요청의 파일당 10MiB·요청당 10개/100MiB와 이미지 픽셀·애니메이션 디코딩 한도는 유지한다. 게시글 편집 계약은 200장까지 허용해 수집 초안을 내용 손실 없이 편집할 수 있다.
- 레거시 candidate/metadata 선택 이미지 20개 계약과 direct batch를 구분한다. DB migration으로 기존 결과를 강제로 성공 처리하지 않는다.
- `SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED`는 해당 글 실패이며 다음 글 수집을 중단시키는 사이트 오류로 누적하지 않는다.
- 원문 이미지 HTTP Content-Type은 실제 파일과 다를 수 있다. 알려진 PNG/JPEG/GIF/WebP/AVIF 바이트 서명이 있으면 이를 DB/object MIME에 우선 사용하고, 실제 디코딩 검증과 구분한다. 과거 FETCHED 결과의 MIME 정정은 완료 snapshot 불변 규칙을 우회하지 않는 별도 복구 절차로 처리한다.
- 검증은 20장 초과 성공, 200장 경계와 201장 실패, 설정 상한 거부, 전체 용량 초과 무쓰기, 승격 실패 복구, 실제 실패 글 재수집·DB/object readback을 각각 증거로 남긴다.

### 실제 HTML 회귀와 웃긴대학 모바일 본문

- 정제 fixture는 원본 SHA-256, 공개 URL, 정제본 SHA-256, 목록의 식별자·순서·시각·다음 페이지와 상세의 블록 순서·미디어 수를 함께 저장한다. 정제 전후 결과가 달라지면 저장하지 않는다. fixture 통과는 실시간 접근이나 DB/object readback 성공을 대신하지 않는다.
- 웃긴대학 모바일은 `p.content_body_padding`만 읽으면 브라우저의 HTML 보정으로 그 밖에 놓인 `.body_editor`의 텍스트·링크를 잃을 수 있다. `.daum-wm-content` 전체를 문서 순서대로 읽는다. 실제 관측한 이미지 확대 버튼 `#btn_nemo_expand_all`과 로딩 표시 `[id^=timg_prog_]`, `img[src*=loading_bar]`만 제외하고 본문·이미지·SNS·첨부 링크는 공통 ordered parser로 보존한다.
- 이미지 전부를 먼저 나열하고 본문을 한 문단으로 붙이는 모바일 경로는 사용하지 않는다. 실제 HTML 회귀와 혼합 본문·이미지·SNS·첨부 테스트를 함께 실행하며, 변경 후 live 저장 증거는 별도 기록한다.

### 인벤 첨부 영역과 파일 참조

- 실제 공개 상세 HTML에서 확인한 `#tbArticle > .articleFile a[href]`는 `#powerbbsContent` 바깥의 첨부 영역이다. 인벤 adapter는 이 영역의 링크를 본문 앞에 문서 순서대로 연결하고 본문 parser는 기존 본문·이미지를 유지한다. 작성자 정보·댓글·추천글은 포함하지 않는다.
- 첨부 anchor 안의 다운로드 아이콘은 본문 이미지가 아니다. 링크 URL과 표시명만 연결한다. 원문 charset을 해석한 뒤 UTF-8로 직렬화하므로 CP949/EUC-KR 페이지의 한글을 중복 디코딩하지 않는다.
- 지원 확장자의 파일 링크는 anchor와 일반 텍스트 URL 모두 첨부 후보로 등록한다. 본문 내 반복 LINK는 원문 순서대로 유지하되 같은 절대 파일 URL은 한 번만 다운로드한다. 첨부 한도20개는 고유 URL 기준이며, 이미지는 이 규칙으로 임의 제거하지 않는다.
- 저장은 기존 정확한 CDN origin 허용·요청 간격·파일/합계 크기 제한을 따른다. 첨부 bytes는 collect에만 보관하고 API 초안/공개에는 원문 링크를 보존한다. 압축 파일의 압축 해제·실행과 익명 collect 다운로드는 하지 않는다.


### Batch V006 완료 이미지 MIME 정정

- 목적: 원문 HTTP Content-Type을 우선했던 과거 IMAGE 행의 MIME만 실제 파일 형식에 맞게 정정한다. API/batch runtime의 완료 snapshot 쓰기 권한은 확대하지 않는다.
- migrator 소유자만 `collect.correct_batch_media_mime`를 실행한다. SECURITY DEFINER나 trigger 비활성화를 사용하지 않는다. PUBLIC과 runtime 역할에는 함수 실행·정정 ledger 쓰기 권한을 주지 않는다.
- 정정 전에 백업과 고정 대상 manifest를 만든다. 파일 SHA256/크기/전체 디코딩/실제 MIME을 확인하고 media ID, 기존 MIME, 파일 hash/size, item version, 정정 revision을 조건부 대조한다.
- 함수는 source 및 API의 `batch-review:{itemId}` advisory lock을 얻고 종료된 실행의 FETCHED IMAGE만 허용한다. 정정 ledger INSERT와 MIME UPDATE는 한 transaction이다. 다른 media 필드, item 본문·version·상태, object bytes, 기존 report, content 공개 상태는 변경하지 않는다.
- `batch_media_correction`은 operation UUID, media ID, 증가하는 revision, 변경 전 media snapshot, 새 MIME, item version, 사유 코드, 실행자·transaction·시각을 append-only로 보존한다. 동일 요청 UUID의 같은 내용은 재실행해도 한 번만 반영되고 다른 내용은 거부한다.
- API 검수 digest는 media MIME을 포함한다. 기존 미승격 승인은 정정 이후 다시 검수해야 하며, 정정 함수는 검수/발행을 대신하지 않는다. 이미 승격한 글의 과거 검수 이력과 content 사본을 소급 수정하지 않는다.
- 복구는 새 operation UUID와 현재 revision으로 역방향 정정을 남기는 방식이다. 감사 행 삭제나 version 되감기를 하지 않는다. 원래 MIME이 틀렸던 상태로 되돌아간다는 점을 복구 보고에 표시한다.
- 이 경로는 DB metadata 정정이다. 원격 S3 Content-Type metadata 정정이나 원문 재수집을 자동으로 수행하지 않는다. 로컬 파일 저장소 검증을 원격 bucket 검증으로 간주하지 않는다.
- 수용: 격리 DB에서 migration 재실행, stale 조건/hash/size 거부, 중복 요청, rollback, runtime 직접 수정·함수 실행 거부, 감사 변경 금지, review 잠금 경합을 검증하고 실제 로컬 파일/DB를 재대조한다.


### 큰 수집 애니메이션의 분할 검사

- 전체 64Mi픽셀을 넘는 GIF/WebP만 별도 경로로 처리한다. 최대500프레임/총200,000,000프레임픽셀/파일30MiB, 프레임당40,000,000픽셀 한도를 둔다. 여러 프레임을 동시에 펼치는 대신 chunk당 최대16프레임 및40,000,000픽셀(추정RGBA160MB)로 순차 검사한다.
- 각 chunk를 엄격한 decoder(`failOn=warning`)로 끝까지 디코딩한다. chunk당10초, 전체30초 기한을 두며 시간 초과·잘린 마지막 프레임·틀린 크기·프레임 개수 불일치는 실패한다. 이는 decoder 작업량/버퍼 상한이며 프로세스 전체 RSS의 OS hard limit을 뜻하지 않는다.
- 큰 애니메이션을 새로 양자화하거나 첫 프레임으로 바꾸지 않는다. GIF는 색상표·이미지 데이터·GCE 및 인식한 반복 확장을 유지하고 comment/뒤따른 bytes를 제거한다. 해석하지 못한 application/plain-text 확장은 내용을 버리지 않고 실패시킨다.
- WebP는 VP8X/ICCP/ANIM/ANMF와 프레임 ALPH/VP8/VP8L 데이터를 보존하고 EXIF/XMP/비표시 unknown chunk/뒤따른 bytes를 제거한다. VP8X metadata flags와 RIFF 크기를 재작성한다. orientation이 필요한 원문은 이 경로에서 거부한다.
- 정제 출력의 프레임수·크기·지연·반복을 원본과 대조한다. 컨테이너 구조 검사는 전체 프레임 디코딩을 대체하지 않는다. 테스트에서 각 프레임 픽셀 해시도 원본과 대조한다.
- 원본 readback과 공개 이미지 readback도 같은 분할 디코딩 한도를 사용한다. 실제 원본을 모두 읽지 않고 검사 기대값만 바꿔 성공시키지 않는다. 일반 정적 이미지와 작은 애니메이션의 기존 처리 경로는 유지한다.
- 근거: [sharp의 page/pages와 animated 처리](https://sharp.pixelplumbing.com/api-constructor/), [GIF89a 구조](https://www.w3.org/Graphics/GIF/spec-gif89a.txt), [WebP RIFF 구조](https://developers.google.com/speed/webp/docs/riff_container).
