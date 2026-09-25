# 수집기 운영 — direct batch와 legacy 호환 서버

현재 구현·테스트 단계다. 실제 출처·Discord·운영 PC 값과 7일 관찰 전에는 운영 완료가 아니다.

현행 direct batch는 [직접 저장 batch 실행](#직접-저장-batch-실행)과
[환경별 연결·권한](../../../docs/operations/environment-configuration.md#9-core-연결과-direct-batch-검수의-실행-경계)을 따른다.
아래 legacy 운영 절의 Core 전송·별도 collector DB·spool 명령은 기존 호환 코드에 해당하며
새 direct batch 실행 절차가 아니다. 새 batch는 같은 PostgreSQL database에 제한 role로 직접 저장한다.

2026-09-24 코드 대조: direct의 robots/Crawl-delay·영속 일일 budget 연결과 설계 redirect 상한에
미충족 항목이 있다. 아래 실행 명령·예제의 승인 플래그를 운영 활성화 허가로 해석하지 않는다.
[필수 보완과 검증 조건](../../../docs/system-design/07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조)을 먼저 따른다.

## 변경 검증과 CI

Node 24.18.0·Java 25와 격리 PostgreSQL 18을 준비하고 저장소 루트에서 `npm run test:collector`를 실행한다.
`TEST_DATABASE_ADMIN_URL`을 지정하면 localhost/127.0.0.1의 5439 또는 55449 `/postgres` 관리 DB에서
임시 DB만 생성해 전체 Java 테스트를 실행하고 정리한다. 생략 시 기존 로컬 5439 관리 DB를 사용한다.
건너뜀 0·실패 0을 요구하며 실행 결과는 `test-results/collector-ci/summary.json`에 남긴다.

[CI workflow](../../../.github/workflows/ci.yml)의 `collector` job은 같은 검사 뒤 `bootJar fixtureClasspath`로
JAR·SBOM을 만들고 검사 artifact를 보관한다. 원격 실행, Windows·별도 PC, 운영 설치·외부 연동 완료와는
구분한다. 자세한 DB 제한과 명령은 [테스트 실행서](../../../docs/testing/README.md#실행-환경)를 따른다.

## Legacy 호환 서버 설정과 기동

JDK 25, 별도 PostgreSQL 18, `pg_dump`·`pg_restore`가 필요하다. 서비스 Core DB와 물리 인스턴스를 분리한다. `apps/collector/gradlew -p apps/collector test bootJar cyclonedxBom`으로 jar·SBOM을 만든다. wrapper의 distribution SHA-256과 dependency lock을 유지한다.

운영자 전용 macOS 계정의 Keychain에 서비스 이름 `com.blariyo.collector`로 아래 account를 등록한다. Keychain Access 앱으로 입력하며 secret을 shell argument·plist·문서에 복사하지 않는다.

- `collector-id`: `collector-` + 소문자 base32 16자리. 재설치·복구 때도 같은 ID.
- `core-token`, `local-run-token`, `local-read-token`, `local-stop-token`: 역할별 독립 credential. 로컬 token은 최소 32자.
- `spool-key`, `request-key`, `backup-key`: 각각 독립적인 임의 32 byte를 base64로 저장.
- `database-password`: 별도 collector DB 계정의 암호.
- `discord-token`: Discord 기능을 켤 때만 필요.

평문 설정 파일은 0600, spool·backup·log 폴더는 0700으로 만든다. 경로에 심볼릭 링크를 사용하지 않는다. 예시의 값은 실제 승인 대상으로 바꿔야 한다.

```properties
spring.datasource.url=jdbc:postgresql://127.0.0.1:55440/collector
spring.datasource.username=collector
collector.core-origin=https://(승인된 BFF 주소)
collector.spool-directory=/(운영자 전용 경로)/spool
collector.sources-file=/(운영자 전용 경로)/sources.json
collector.processing-enabled=false
collector.quartz-enabled=false
collector.discord-enabled=false
collector.pg-dump=/(PostgreSQL 18 설치 경로)/bin/pg_dump
collector.pg-restore=/(PostgreSQL 18 설치 경로)/bin/pg_restore
```

출처 파일은 source ID별 `approved`, `host`, `pathPrefixes`, `titleSelector`, `imageSelector`, `userAgent`를 가진다. 이용 조건·robots·선택자·Core 출처 설정을 확인한 대상만 `approved=true`로 둔다. production에서 fixture profile·fixture secret file을 사용하지 않는다.

정상 서버 기동은 DDL을 수행하지 않는다. 첫 기동 전에 별도 CLI로 migration을 실행한다.

```sh
java -Dloader.main=com.blariyo.collector.ops.MigrationMain \
  -cp collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  /absolute/collector.properties
java -jar collector.jar --spring.config.additional-location=file:/absolute/collector.properties
```

`/actuator/health/liveness`는 loopback에서 확인한다. readiness와 `/local/v1/status`는 read token이 필요하다. 브라우저 Origin·Cookie 요청은 거부한다. 수동 실행은 `/local/v1/jobs/collect`에 run token, `Idempotency-Key`, `{ "mode": "COLLECT", "candidateId": 123 }`를 전달한다. URL로 시작하려면 `/local/v1/candidates`에 `{ "originUrl": "https://theqoo.net/hot/(게시물 ID)" }`를 보낸다. 인증과 Idempotency-Key는 동일하다. 응답 유실 때 같은 key와 URL로 재전송한다.

## launchd

`render-launchd.py`는 설치 후보만 만든다. 실행 파일·절대 경로·설정 파일 권한·secret 포함 여부를 검사한다. config JSON에는 `java`, `jar`, `workingDirectory`, `properties`, `logDirectory`의 기존 절대 경로를 넣고, daily backup을 만들 때는 `backupDirectory`도 지정한다.

```sh
python3 apps/collector/ops/render-launchd.py --config /absolute/launchd-paths.json --output /absolute/generated
plutil -lint /absolute/generated/com.blariyo.collector.plist
```

렌더링된 plist와 runner를 검토한 뒤 해당 운영자 계정의 `~/Library/LaunchAgents/`에 plist를 설치하고 `launchctl bootstrap gui/<uid> <plist 경로>`로 등록한다. `launchctl bootout gui/<uid>/com.blariyo.collector`는 서버에 종료를 전달한다. 제거할 때는 등록을 해제한 뒤 설치한 plist만 제거하며 DB·spool·Keychain은 별도 보존 판단 없이 삭제하지 않는다. backup agent도 별도로 등록·해제한다.

서버는 `umask 077`, crash backoff 30초, SIGTERM 유예 90초를 사용한다. 로그 파일은 10MiB 단위로 회전하며 합계 200MiB·14일 제한을 적용한다. launchd 출력에는 원문·secret을 남기지 않는다. 백업 agent는 매일 03:15에 실행하며 최근 7개 암호화 파일을 유지한다. 실제 설치·백업 실패 관측과 절전 복귀 시험은 운영 대상에서 별도로 검증해야 한다.

## 백업과 복원

```sh
java -Dloader.main=com.blariyo.collector.ops.BackupMain \
  -cp collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  backup /absolute/backups /absolute/collector.properties
java -Dloader.main=com.blariyo.collector.ops.BackupMain \
  -cp collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  restore /absolute/collector-backup.enc /absolute/isolated-restore.properties
```

DB 덤프는 plaintext 파일 없이 AES-256-GCM으로 암호화한다. 백업 암호화 키는 DB 백업에 포함하지 않는다. 인증을 먼저 검사하고 **빈 DB에만** 복원한다. 복원 파일 상한은 256MiB이며 초과 시 실패한다. 백업에서 자동 실행 허용 행을 제외하므로 복원 도중 중단돼도 실행이 열리지 않는다. 복원 후 `restore_gate.reconcile_required=true`와 기존 미완료 작업의 `RECONCILE_REQUIRED`를 확인한다.

DB 백업만으로 암호화 spool과 Keychain이 복구되지는 않는다. 기존 키·spool이 없거나 Core 소유권이 달라졌으면 자동 재송신하지 않는다. Core `execution-state`의 execution ID·버전·result/preview digest와 대조해야 하며, 조정 완료 전에는 처리/Quartz/Discord flag와 restore gate를 열지 않는다.

## Core 전환

운영자 확인으로 Python 신규 실행과 legacy mutation을 먼저 중지한다. 기존 RUNNING·preview는 정상 종료/TTL 정리로 비운다.

```sh
node apps/api/dist/commands/collection-transition.js check
node apps/api/dist/commands/collection-transition.js apply
```

명령은 Core migration 계정의 `DATABASE_URL`을 사용한다. `apply`는 DB 쓰기 잠금 아래 잔여 legacy 데이터를 검사하고 CHECK를 추가·검증한다. 데이터 삭제·가짜 hash backfill을 하지 않는다. strict 검증 뒤에만 Core `COLLECT_CONTRACT_MODE=SPRING_V2`와 Spring 자격을 켠다. rollback은 Spring 신규 실행을 끄고 Core 수동 게시를 유지하며 legacy 자동 재활성화는 하지 않는다.

## 실패 작업 조회·재개와 복원 차단 해제

먼저 launchd 서버를 중지한다. 운영 CLI는 background 처리·Quartz·Discord·알림 전달을 켜지 않으며, 같은 DB worker 잠금을 얻지 못하면 실패한다. 출력에는 일반화된 작업 상태만 포함한다.

```sh
java -Dloader.main=com.blariyo.collector.ops.JobControlMain \
  -cp collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  inspect <jobRequestId> /absolute/collector.properties
```

`inspect`를 `resume` 또는 `reconcile`로 바꿔 호출한다. `resume`은 7일 이내의 재개 가능한 FAILED/STOPPED만 대기열로 되돌리고 Core 소유권을 검사한다. 실제 처리는 이후 서버 기동 때 시작된다. `reconcile`은 Core 상태와 result digest를 읽어 성공·중단·수동 확인 필요 상태로 정리하며 원문 요청을 재전송하지 않는다. Core가 계속 RUNNING이거나 결과가 불분명하면 RECONCILE_REQUIRED를 유지한다. 실행 중 작업은 먼저 중지·종료해야 한다.

```sh
java -Dloader.main=com.blariyo.collector.ops.JobControlMain \
  -cp collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  release-restore /absolute/collector.properties
```

QUEUED/RUNNING/STOP_REQUESTED/RECONCILE_REQUIRED가 남으면 해제를 거부한다. 실제 출처·계정·Core 상태 확인 후 운영자가 명시적으로 실행한다. DB 상태를 직접 성공으로 바꾸거나 spool 없이 재개하지 않는다.

## 상태와 운영 지표

read token으로 `/local/v1/status?windowHours=24`를 조회한다. 범위는 1~168시간이다. Core가 끊겨도 local DB가 정상이면 HTTP 200과 `partial=true`, Core UNAVAILABLE를 반환한다. local DB 장애는 503이며 복원 차단 여부는 `reconcileRequired`로 확인한다. Core 관측에는 마지막 성공 시각을 포함한다.

`/actuator/metrics`와 `/actuator/metrics/<이름>`도 read token이 필요하다.

| 지표                                                                                                                   | 용도                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `collector.jobs`, `collector.jobs.restartable`                                                                         | 상태별 대기·실행·중단·재개·수동 확인 필요 수                |
| `collector.jobs.submitted`, `collector.jobs.rejected`                                                                  | 진입점별 접수·중복·거부                                     |
| `collector.step.duration`, `collector.job.duration`                                                                    | Step 성공/실패와 작업 실행 시간                             |
| `collector.operations`, `collector.heartbeats`                                                                         | claim·heartbeat·result·preview·lease/fencing·복구·정리 결과 |
| `collector.quota.remaining`, `collector.quota.rate.limited`, `collector.reservations`                                  | numeric source별 잔여/제한과 요청 종류별 예약               |
| `collector.spool.files`, `collector.spool.bytes`, `collector.spool.ready`                                              | 암호화 임시 파일 상태                                       |
| `collector.core.ready`, `collector.core.last.success.epoch`, `collector.database.ready`, `collector.discord.connected` | 의존성 연결 상태                                            |
| `collector.notifications`                                                                                              | 전달·재시도·최종 실패                                       |

JSON 로그는 Spring Boot ECS 형식을 사용하고 exception message·전체 stack 필드는 제외한다. 작업 완료 로그에는 작업 ID·상태·일반화된 outcome을 넣는다. URL·제목·token·Discord 원본 ID는 로그나 metric label에 넣지 않는다. JDA 내부 로그는 비활성으로 두고 연결·전달 상태를 위 지표와 일반화 이벤트로 확인한다. [Spring Boot 구조화 로그 설정](https://docs.spring.io/spring-boot/reference/features/logging.html)을 따른다.

알림 4회 실패 후 암호화된 전달 대상은 즉시 제거한다. 최종 실패 이벤트 자체는 Core가 복구될 때까지 일반화된 outbox로 보존한다. 소유권 상실·lease 종료는 재개 불가능한 STOPPED, 버전 불일치는 RECONCILE_REQUIRED로 표시하며 원문을 재전송하지 않는다.

운영 PC에서 backup agent의 마지막 종료 코드(`launchctl print gui/<uid>/com.blariyo.collector.backup`)와 최신 암호화 파일의 생성 시각을 함께 확인해야 한다. 실제 계정에 설치하지 않은 현재 상태에서는 자동 백업 성공·실패 관측을 운영 검증 완료로 간주하지 않는다.

## 웹/API와 다른 컴퓨터에서 실행

수집 CLI와 Discord 입력은 **배치 PC**에서 실행한다. 서비스 서버가 외부 사이트 수집을 실행하지 않는다.
Direct batch는 Core HTTP API를 글마다 호출하지 않는다. API와 batch는 현재 같은 PostgreSQL database를
공유하되 batch는 collect 소유 테이블만 쓰고 API는 검수·content를 소유한다. 다른 PC에서는 VPN/사설망으로
DB에 연결하며 API/owner credential 대신 batch 제한 role을 사용한다. DB를 공개 인터넷에 노출하지 않는다.
수집 PC가 꺼져 있어도 기존 공개 서비스는 계속 동작한다.

목록은 HOT_LIST/hot, GENERAL_LIST/latest로 구분하고 DETAIL_ONLY는 URL만 받는다.
BLOCKED/UNVERIFIED 목록을 generic parser로 성공 처리하지 않는다. `--since`는 날짜 미확인 정책과
함께 해석한다. 시각 미확인은 INCLUDE_UNKNOWN에서 unknownDates로 보고하고 REQUIRE_KNOWN에서는 제외한다.

더쿠 원문 모드의 축약 source 설정 예시(실제 승인값과 확인한 CDN으로 대체):

```json
{
  "theqoo": {
    "approved": false,
    "host": "theqoo.net",
    "pathPrefixes": ["/hot/"],
    "parser": "THEQOO",
    "userAgent": "(출처 명세에서 정한 contact 포함 식별자)",
    "imageOrigins": {
      "https://img.theqoo.net": ["/"],
      "https://img-static.theqoo.net": ["/"]
    }
  }
}
```

`imageOrigins`는 확인한 첨부 CDN의 정확한 origin·경로만 넣는다. source 승인과 robots 확인은 위 예시로 대신하지 않는다.
위 예시는 상세 URL 정책의 일부다. 목록 batch에는 `batchApproved`, `chartVerified`, `charts`, 상한·간격 등의
추가 설정이 필요하다. [source 예시 파일](reference-sites.sources.example.json)의 해당 출처 전체 설정과 대조한다.
direct parser는 본문 1000블록과 source별 `mediaLimits.maxImages`(기본 200장)를 넘으면
SOURCE_BODY_LIMIT_EXCEEDED/SOURCE_IMAGE_LIMIT_EXCEEDED로 실패하며 잘라서 저장하지 않는다.
파일/글 전체 용량은 [글별 미디어 한도](#글별-미디어-한도)를 따른다. SNS 주소는 보존하고 화면에서 임베드한다.
Node/Python 일회성 25건 교체 스크립트나 서비스 DB 직접 쓰기는 이 실행 경로에서 사용하지 않는다.
secret은 macOS Keychain 또는 `collector.secrets-directory`의 계정별 파일에서 읽는다.
파일 backend는 `COLLECTOR_SECRETS_DIRECTORY`로도 지정할 수 있다. 파일 이름은 위 Keychain account와 같고
내용은 해당 값 하나다. 설정 파일·명령 인자·환경 변수에 token 원문을 넣지 않는다.
POSIX는 디렉터리 0700·파일 0600 또는 0400, Windows NTFS는 소유자만 허용한 ACL을 요구한다.
FAT/exFAT처럼 POSIX 권한도 ACL도 확인할 수 없는 저장소는 거부한다. spool·백업도 같은 검사와 암호화를 사용한다.
Windows에서는 [권한 설정 스크립트](set-private-acl.ps1)를 운영자 전용 경로에 적용한다.
Windows의 설정 경로는 properties에서 `C:/Blariyo/...`처럼 `/`를 사용한다. launchd는 macOS용이고 Windows 자동 시작은
작업 스케줄러, Linux는 서비스 관리자를 사용한다. OS별 실제 자동 시작·절전 복구 시험은 별도다.

### Legacy URL 접수 CLI

실행 중인 로컬 수집기에 다음 요청 파일(비공개 권한)을 전달한다. 같은 요청을 재시도할 때 key를 바꾸지 않는다.

```json
{ "idempotencyKey": "operator-request-0001", "originUrl": "https://theqoo.net/hot/(게시물 ID)" }
```

```sh
java -Dloader.main=com.blariyo.collector.ops.SubmitUrlMain \
  -cp collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  /absolute/request.json /absolute/collector.properties
```

CLI는 자기 컴퓨터의 loopback API만 호출하고 candidateId와 jobRequestId만 출력한다. 원문 URL은 명령 인자·로그에
출력하지 않는다. 실패 시 파일을 그대로 두고 같은 key로 재시도할 수 있다. 다른 사이트는 검증된 parser와 source 설정이 필요하다.

### 직접 저장 batch 실행

먼저 실행 중인 batch를 종료하고 DB/object 백업 후 MigrationMain으로 V006까지 적용한다.
V003과 새 collector 코드는 함께 사용한다. V003 DB에서 구버전 collector만 재시작하는 rollback은 지원하지 않는다.
DB 연결은 직접 연결 또는 session pooling이어야 하며 transaction pooling은 지원하지 않는다.
새 media key는 collect/media/{runId}/{itemId}/{position}이고 기존 key는 조회 호환을 유지한다.
DB가 source 잠금 소유·상태 전이·version을 검사하며, 완성 report/checkpoint와 run 종료를 함께 확정한다.

`batch`는 목록·상세 요청과 parser 결과를 직접 collect DB와 object store에 기록한다. Core 후보 endpoint를 호출하지
않는다. `--dry-run`은 network read와 robots 확인만 수행하고 DB/object store를 쓰지 않는다.

```sh
COLLECTOR_SOURCES_FILE=/config/sources.json \
COLLECTOR_OBJECT_STORE_DIRECTORY=/state/objects \
./bin/blariyo-collector batch --source theqoo --chart hot --max-pages 2 --max-items 20 --since 24h --dry-run

COLLECTOR_SOURCES_FILE=/config/sources.json \
COLLECTOR_OBJECT_STORE_S3_ENDPOINT=https://(account).r2.cloudflarestorage.com \
COLLECTOR_OBJECT_STORE_S3_BUCKET=blariyo-collect-private \
COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID=(운영자 주입) \
COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY=(운영자 주입) \
./bin/blariyo-collector batch --source theqoo --chart hot --max-pages 2 --max-items 20 --since 24h --write-db
```

object store는 `COLLECTOR_OBJECT_STORE_DIRECTORY`가 있으면 로컬 파일시스템에 쓰고, 없으면
`COLLECTOR_OBJECT_STORE_S3_*` 또는 batch 전용 `COLLECTOR_R2_*` 환경 변수로 S3/R2-compatible PUT 후 HEAD 응답을 확인한다.
API의 `R2_PRIVATE_*`는 batch fallback으로 사용하지 않는다. HEAD 성공만으로 bytes 검증을 완료하지 않으며
아래 별도 readback에서 실제 GET bytes/hash를 대조한다. 로컬 실행은 [로컬 명령](../../../scripts/local/README.md#정식-batch-검수-실행)을 따른다.
legacy presigned PUT template(`COLLECTOR_OBJECT_STORE_PUT_URL_TEMPLATE`)은 마지막 fallback이다.
운영 secret 값은 shell history에 남지 않게 별도 0600 env 파일을 source하거나 process manager의 비공개 환경으로 주입한다.

PowerShell에서는 `COLLECTOR_SOURCES_FILE`, `COLLECTOR_OBJECT_STORE_DIRECTORY` 또는 `COLLECTOR_OBJECT_STORE_S3_*`를 `$env:`로 설정하고
`bin\blariyo-collector.ps1 batch ...`를 실행한다. Docker Linux에서는 같은 변수를 compose의 collector에 주입한다.
실제 설정의 source는 `batchApproved`, `chartVerified`, robots·약관 검토가 모두 확인된 경우에만 활성화한다.
운영 DB/S3/R2 readback은 비밀값이 주입된 운영 터미널에서 다음 검증 스크립트로 제한 실행한다.
스크립트는 기본적으로 `theqoo`, `humoruniv`, `todayhumor` 각 1건을 `--write-db`로 실행하고,
`collect.batch_run`·`collect.batch_item` readback을 markdown과 JSONL로 남긴다. 비밀값은 출력하지 않는다.

```sh
apps/collector/ops/verify-write-db-readback.sh theqoo humoruniv todayhumor
```

운영 최소 샘플은 batch 3건과 접근 차단 실패 저장 1건을 함께 검증한다. manifest는 `apps/collector/ops/production-readback-sample.json`이다.

```sh
apps/collector/ops/verify-write-db-readback.sh --manifest apps/collector/ops/production-readback-sample.json
```

최소 샘플이 통과한 뒤에는 개발 DB에서 `FETCHED_DEV_READBACK`을 확인한 17개 사이트를 같은 형식으로 검증한다.

```sh
apps/collector/ops/verify-write-db-readback.sh --manifest apps/collector/ops/production-readback-17-fetched.json
```

본문 수집이 차단되거나 live renderer가 없는 4개 사이트는 실패 상태 저장/readback을 별도 manifest로 확인한다.

```sh
apps/collector/ops/verify-write-db-readback.sh --manifest apps/collector/ops/production-readback-4-failed.json
```

Windows PowerShell도 같은 manifest를 받는다.

```powershell
apps\collector\ops\verify-write-db-readback.ps1 --manifest apps\collector\ops\production-readback-sample.json
apps\collector\ops\verify-write-db-readback.ps1 --manifest apps\collector\ops\production-readback-17-fetched.json
apps\collector\ops\verify-write-db-readback.ps1 --manifest apps\collector\ops\production-readback-4-failed.json
```

Windows PowerShell에서는 같은 환경 변수를 `$env:`로 설정한 뒤 다음을 실행한다. `psql`은 PATH에 있어야 한다.

```powershell
apps\collector\ops\verify-write-db-readback.ps1 theqoo humoruniv todayhumor
```

실행 report에는 run ID·상태·개수·일반 오류 코드만 남기며 원문 URL·본문·cookie·secret·절대 경로를 넣지 않는다.

개발 DB readback 검토 자료를 다시 묶을 때는 성공 readback JSON과 실패 readback JSON을 만든 뒤 다음을 실행한다.
이 명령은 DB나 object store에 접속하지 않고, 기존 JSON 산출물을 21개 통합 검토 표로 재생성한다.

```sh
python3 apps/collector/ops/build-21-site-review.py
```

출력은 `apps/collector/ops/reports/dev-21-site-review-2026-09-23.md`와 `.json`이다.

Discord Gateway E2E는 실제 bot token과 테스트 guild/channel에서만 검증할 수 있다. fixture test나 코드 존재를 완료로 표시하지 않는다.
운영 검증 절차와 결과 템플릿은 다음 파일을 사용한다.

- `apps/collector/ops/discord-e2e-checklist.md`
- `apps/collector/ops/discord-e2e-result.example.json`

### Legacy 호환 서버 Docker 설치

아래 [Compose 파일](compose.yaml)은 별도 DB와 Spring 서버를 기동하는 **legacy 호환 구성**이며 direct batch의
공유 DB/제한 role 구성이 아니다. direct queue의 Docker 실행은 [Direct Discord queue](#direct-discord-queue-v005)를 따른다.
서비스용 루트 compose와 독립이며 Mac·Windows의 Docker Desktop에서도 Linux
container로 실행한다. collector·실행 DB의 host port는 공개하지 않으며 URL 접수는 container 안에서 공통 CLI로 한다.

1. JDK 25에서 `apps/collector/gradlew -p apps/collector test bootJar`로 jar를 만든다. Windows에서 빌드만 할 때는
   `apps\collector\gradlew.bat -p apps\collector bootJar`를 사용한다. 기존 POSIX fixture 시험을 Windows 실행 검증으로 간주하지 않는다.
2. 배치 PC에 config, secrets, state 전용 폴더를 준비한다. non-secret 환경 변수 `COLLECTOR_CONFIG_PATH`,
   `COLLECTOR_SECRETS_PATH`, `COLLECTOR_STATE_PATH`, `COLLECTOR_CORE_ORIGIN`을 지정한다.
3. `COLLECTOR_UID`·`COLLECTOR_GID`는 container에서 폴더를 소유하는 사용자와 일치시킨다. 기본 10001이다.
   Docker 안에서 실제 0700/0600과 읽기·쓰기 가능 여부를 확인한다. Windows bind mount가 이 권한을 제공하지 않으면
   배치용 Linux 파일시스템/volume에 비밀 파일을 준비해야 하며 권한 검사를 끄지 않는다.
4. config의 `collector.properties`는 `collector.sources-file=/config/sources.json`, 처리·Quartz·Discord flag를 포함한다.
   secret directory와 DB·Core origin은 compose 환경에서 주입한다. 실제 source·credential 확인 전 flag는 false다.

```sh
docker compose -f apps/collector/ops/compose.yaml build
docker compose -f apps/collector/ops/compose.yaml up -d database
docker compose -f apps/collector/ops/compose.yaml run --rm --no-deps --entrypoint java collector \
  -Dloader.main=com.blariyo.collector.ops.MigrationMain \
  -cp /app/collector.jar org.springframework.boot.loader.launch.PropertiesLauncher /config/collector.properties
docker compose -f apps/collector/ops/compose.yaml up -d collector
docker compose -f apps/collector/ops/compose.yaml exec collector java \
  -Dloader.main=com.blariyo.collector.ops.SubmitUrlMain \
  -cp /app/collector.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  /config/request.json /config/collector.properties
```

기본 runtime image에는 PostgreSQL 백업 client를 넣지 않는다. `BackupMain`을 container 안에서 운영하려면
`pg_dump`·`pg_restore` 18이 있는 이미지를 별도로 준비하고 복원 시험을 해야 한다. DB volume만으로 백업이 끝난 것으로 보지 않는다.
Docker 파일 mount의 권한·소유자 제한은 [Docker secrets 문서](https://docs.docker.com/compose/how-tos/use-secrets/)와
[서비스 mount 계약](https://docs.docker.com/reference/compose-file/services/)을 따른다. Compose 선언만으로 host 파일 권한이 바뀐다고 가정하지 않는다.

V004 item lifecycle: 상세 fetch 이전 claim → raw 저장 → parse → 날짜 정책 → 본문/미디어 → FETCHED.
상세 fetch/parse 실패는 item과 failure phase/code에 남고, 날짜 제외는 SKIPPED_POLICY/skip_reason으로
기록한다. 중복 FETCHED는 외부 상세 요청 전에 skip하며 기간 제외·실패 item은 재시도할 수 있다.

## Direct Discord queue (V005)

`discord --write-db`는 독립 batch JVM에서 Gateway 입력과 queue worker를 함께 실행한다.
Core API, Spring Web 서버, Quartz, legacy `collector.run` dispatcher는 필요하지 않다.
`COLLECTOR_SOURCES_FILE`, DB 및 object 설정은 기존 direct batch와 같다.

```sh
# macOS: JDK 25와 DB/object 설정을 주입한 같은 셸
./bin/blariyo-collector queue --once --write-db
./bin/blariyo-collector discord --write-db
```

```powershell
# Windows PowerShell: 동일 환경 변수와 소유자 전용 secret 디렉터리
.\bin\blariyo-collector.ps1 queue --once --write-db
.\bin\blariyo-collector.ps1 discord --write-db
```

```sh
# Linux Docker: 예시 image 이름은 배포 전에 실제 빌드한 것으로 교체한다.
# private env 파일에는 원격 DB/R2 설정, COLLECTOR_SOURCES_FILE=/config/sources.json,
# COLLECTOR_SECRETS_DIRECTORY=/run/collector-secrets를 지정한다.
docker run --rm --env-file /secure/collector.env \
  --mount type=bind,src=/secure/collector-config,dst=/config,readonly \
  --mount type=bind,src=/secure/collector-secrets,dst=/run/collector-secrets,readonly \
  --entrypoint java blariyo-collector:local \
  -Dloader.main=com.blariyo.collector.ops.BatchMain -cp /app/collector.jar \
  org.springframework.boot.loader.launch.PropertiesLauncher queue --once --write-db
```

추가 환경 변수는 `COLLECTOR_DISCORD_GUILDS`, `COLLECTOR_DISCORD_CHANNELS`,
`COLLECTOR_DISCORD_USERS` 또는 `COLLECTOR_DISCORD_ROLES`이며 쉼표 구분 allowlist다.
`COLLECTOR_DISCORD_REGISTER_COMMANDS=true`는 최초 테스트 guild 명령 등록 때만 사용한다.
`COLLECTOR_SECRETS_DIRECTORY`의 `discord-token`, `request-key` 파일을 사용한다.
`request-key`는 32바이트 키의 base64이며 다른 PC에서도 같은 키를 사용해야 확인 재전송을 검증할 수 있다.
secret 원문을 환경변수·CLI 인자·로그에 넣지 않는다. 실제 ID/키는 예시 파일에 기록하지 않는다.

`DISCORD_GATEWAY_CONNECTED`는 실제 JDA ready 이벤트에서만 출력한다.
연결 로그만으로 전체 E2E 완료를 판정하지 않고 [실연동 체크리스트](discord-e2e-checklist.md)를 수행한다.
`/collect status`는 batch queue 상태별 수량을 반환한다. `/collect url`은 10분 동안 유효한 확인을 준비하고,
확인 후 stable request ID를 반환한다. confirmation receipt 외에는 확인 전에 수집 DB/object를 변경하지 않는다.

queue request는 실행마다 새 `batch_run`을 연결한다. 중단 후 재개 시 기존 실행 기록을 보존하고,
이미 완료된 run은 재수집하지 않는다. source advisory lock이 유지되는 동안 다른 PC의 worker는 건너뛴다.
네트워크/DNS/일시 서버 오류 또는 실행 중단은 최대 3회(30초·60초 backoff) 실행한다.
403·삭제·parser·크기 초과·rate-limit은 요청을 종결한다. 403/정책 거부/rate-limit 뒤 같은 source의
다른 대기 요청도 15분간 유예한다. 만료된 confirmation은 접수하지 않고, 확인 완료 receipt는 재전송에 같은 ID를 반환한다.
`queue --once`는 한 건의 처리/복구 결과 또는 IDLE을 JSON으로 출력하며, 장기 실행 `queue --write-db`는 JSONL로 기록한다.
queue/discord 명령은 `--write-db`가 필수다. 기존 `batch --dry-run`은 여전히 DB/object 무쓰기다.

V005 migration은 기존 QUEUED run의 payload를 같은 ID의 request로 옮기고 이전 run에
`BATCH_QUEUE_MIGRATED`를 기록한다. 원문·미디어·기존 게시글은 삭제하지 않는다.
모든 수집 실행을 중지한 뒤 migration owner로 적용하고 제한 role 권한을 재적용한다.
batch role에는 기존 7개 ledger와 `collect.batch_queue`, `collect.batch_confirmation`을 허용한다.
API role은 queue/confirmation에 SELECT도 허용하지 않는다. `prepare-batch-review.mjs --apply`는
로컬 백업·migration·권한·기존 object readback을 수행한다. 원격 환경에도 동일 소유권을 적용해야 한다.

### 글별 미디어 한도

source JSON의 선택적 `mediaLimits`로 제한을 낮출 수 있다. 생략하면 다음 상한을 적용한다.

```json
"mediaLimits": { "maxImages": 200, "maxFileBytes": 31457280, "maxTotalBytes": 157286400 }
```

이미지와 첨부 파일을 합해 글당 150MiB, 파일당 30MiB다. 200장/1000블록을 넘는 원문을 잘라
성공으로 처리하지 않는다. 남은 용량보다 큰 파일은 object 저장 전에 실패하며 다음 글은 새 예산으로
진행한다. dry-run은 파싱만 수행하므로 실제 파일 용량 검증은 write-db/readback에서 확인한다.
