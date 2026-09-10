# Spring 수집 서버 운영

현재 구현·테스트 단계다. 실제 출처·Discord·운영 PC 값과 7일 관찰 전에는 운영 완료가 아니다.

## 설정과 기동

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

`/actuator/health/liveness`는 loopback에서 확인한다. readiness와 `/local/v1/status`는 read token이 필요하다. 브라우저 Origin·Cookie 요청은 거부한다. 수동 실행은 `/local/v1/jobs/collect`에 run token, `Idempotency-Key`, `{ "mode": "COLLECT", "candidateId": 123 }`를 전달한다. 원문 URL을 로컬 REST에 넣지 않는다.

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

| 지표 | 용도 |
| --- | --- |
| `collector.jobs`, `collector.jobs.restartable` | 상태별 대기·실행·중단·재개·수동 확인 필요 수 |
| `collector.jobs.submitted`, `collector.jobs.rejected` | 진입점별 접수·중복·거부 |
| `collector.step.duration`, `collector.job.duration` | Step 성공/실패와 작업 실행 시간 |
| `collector.operations`, `collector.heartbeats` | claim·heartbeat·result·preview·lease/fencing·복구·정리 결과 |
| `collector.quota.remaining`, `collector.quota.rate.limited`, `collector.reservations` | numeric source별 잔여/제한과 요청 종류별 예약 |
| `collector.spool.files`, `collector.spool.bytes`, `collector.spool.ready` | 암호화 임시 파일 상태 |
| `collector.core.ready`, `collector.core.last.success.epoch`, `collector.database.ready`, `collector.discord.connected` | 의존성 연결 상태 |
| `collector.notifications` | 전달·재시도·최종 실패 |

JSON 로그는 Spring Boot ECS 형식을 사용하고 exception message·전체 stack 필드는 제외한다. 작업 완료 로그에는 작업 ID·상태·일반화된 outcome을 넣는다. URL·제목·token·Discord 원본 ID는 로그나 metric label에 넣지 않는다. JDA 내부 로그는 비활성으로 두고 연결·전달 상태를 위 지표와 일반화 이벤트로 확인한다. [Spring Boot 구조화 로그 설정](https://docs.spring.io/spring-boot/reference/features/logging.html)을 따른다.

알림 4회 실패 후 암호화된 전달 대상은 즉시 제거한다. 최종 실패 이벤트 자체는 Core가 복구될 때까지 일반화된 outbox로 보존한다. 소유권 상실·lease 종료는 재개 불가능한 STOPPED, 버전 불일치는 RECONCILE_REQUIRED로 표시하며 원문을 재전송하지 않는다.

운영 PC에서 backup agent의 마지막 종료 코드(`launchctl print gui/<uid>/com.blariyo.collector.backup`)와 최신 암호화 파일의 생성 시각을 함께 확인해야 한다. 실제 계정에 설치하지 않은 현재 상태에서는 자동 백업 성공·실패 관측을 운영 검증 완료로 간주하지 않는다.
