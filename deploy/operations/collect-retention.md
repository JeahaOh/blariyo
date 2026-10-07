# Direct 원문 보존 작업의 로컬 구현과 운영 인계

- 상태: 2026-09-27 로컬 구현·검증 진행. 운영 설치·timer 활성화·R2 삭제·Discord 연결은 미실행이다.
- 정본: [D01 모델과 삭제 순서](../../docs/system-design/02-data-model.md#m0-d01-retention), [선택 백업 전환](../../docs/system-design/05-security-operations.md#m0-d03-drive).
- 구현 근거: [M0 실행 기록](../../worklog/2026-09-27/m0-implementation/README.md). 이 안내의 파일 존재를 운영 적용 증거로 사용하지 않는다.

## 실행 경계

수집 PC와 별도의 서버 사용자 `blariyo-retention`이 Java25 Collector의 `retention` 명령을 실행한다. DB는 `blariyo_collect_retention` 전용 login을 사용한다. API/batch/backup 비밀번호나 media credential을 재사용하지 않는다.

- [역할 생성](../postgresql/create-roles.py)의 `--retention-only`는 기존 역할을 덮어쓰지 않는다. 사용자 전용 `retention-password` 파일을 입력으로 받으며 초기 app/migrator/backup 역할 뒤에 추가한다.
- [권한 SQL](../postgresql/apply-privileges.sql)은 retention에 collect schema USAGE와 명시한 고정 함수 EXECUTE만 부여한다. table 직접 SELECT/DML·DDL·content/legal·다른 역할 전환은 허용하지 않는다.
- 객체 credential은 collect 저장소의 `collect/raw/`, `collect/media/`, `collect/report/` 목록·HEAD·DELETE로 제한한다. API private/public·backup 버킷 권한이 없어야 한다. 서비스 코드의 prefix 검사는 클라우드 ACL 인수를 대신하지 않는다.
- `COLLECTOR_RETENTION_DB_URL`, `COLLECTOR_RETENTION_DB_USER`, `COLLECTOR_RETENTION_DB_PASSWORD`와 `COLLECTOR_RETENTION_S3_ENDPOINT`, `COLLECTOR_RETENTION_S3_BUCKET`, `COLLECTOR_RETENTION_S3_ACCESS_KEY_ID`, `COLLECTOR_RETENTION_S3_SECRET_ACCESS_KEY`를 사용자 전용 환경 파일로 주입한다. 파일은0600, 상위 폴더는0700으로 두고 값은 로그·작업 기록에 남기지 않는다.
- `COLLECTOR_RETENTION_OBJECT_DIRECTORY`는 격리 로컬 파일 시험용이다. 운영에서 local 디렉터리로 원문을 복제하지 않는다.

## 적용 전 확인

1. 수집·검수 쓰기를 닫고 이전 적용 migration/checksum과 기존 백업을 확인한다. 기존 SQL을 고치지 않고 API V009, Collector V007/V008을 설치한다.
2. 최초 수집 시각·기한·영구 dedup·승격 사본 연결을 대조한다. 불명확한 기존 객체와 임시 디스크 잔재는 접근을 닫고 별도 inventory에 올린다.
3. D03의 선택 백업 다운로드·격리 복원 및 보존 중인 full 사본 대체를 검증한다. 실제 검증 receipt가 없으면 `batch_retention_control`의 gate를 열지 않는다. 테스트 코드의 합성 gate hash를 운영에서 사용하지 않는다.
4. 새 API의 만료 guard를 적용하고 아래 dry-run 결과를 확인한다. 기한 도달/실패 수와 backup gate만 출력하며 payload/URL/secret은 출력하지 않는다.
5. R2 최소 권한·403/timeout·부재 readback·Discord 알림 인수, timer 설치 경로와 Java25를 확인한 뒤 사용자만 회수를 활성화한다. 현재 Discord 자동 연결은 후속 구현·인수 대상이다.

```sh
bin/blariyo-collector retention --dry-run
bin/blariyo-collector retention --once --write-db
```

두 번째 명령은 gate 통과 후 실제 collect 객체와 만료 DB payload를 삭제한다. 삭제된 원문을 이전 앱이나 raw 포함 백업으로 복구하지 않는다. 게시글 사본과 영구 dedup은 유지한다.

## 반복 실행·실패 처리

- [service](blariyo-collect-retention.service)와 [timer](blariyo-collect-retention.timer)는 설치 초안이다. `/opt/blariyo/current`·환경 파일·OS 사용자·Java 실행 경로와 `/opt/blariyo/runtime/node/bin/node`의 Node24는 실제 배포 인계에서 검증해야 한다. 파일 복사만으로 활성화 완료로 보고하지 않는다.
- `run-collect-retention.mjs`는 실제 Java child 결과와 장애 알림을 분리한다. `COLLECTOR_RETENTION_ALERT_STATE_DIR`은 retention 전용0700 경로,
  `COLLECTOR_RETENTION_DISCORD_WEBHOOK_FILE`은 같은 역할의0600 secret 파일이다. 경보는 실패/지속6시간/회복과1/5/30분 재시도를 사용하고,
  알림 실패 때문에 삭제를 중복 실행하거나 성공으로 바꾸지 않는다. 원문·객체 key·raw stderr·token은 알림에 넣지 않는다.
- 매분 만료 건을 확인하며 item마다120초 lease와30초 heartbeat를 사용한다. 오래된 owner/version은 완료를 기록할 수 없다. 객체 I/O 중 DB transaction을 길게 유지하지 않는다.
- DELETE 뒤 정확한 key의 HEAD로 부재를 확인한 후 DB payload와 API 검수 기록을 정리한다. 404는 부재,403/timeout은 실패다. 실패한 manifest는 유지하며1/5/30분, 이후1시간 간격으로 다시 시도한다.
- 다음 전체 inventory는 완료 이후 늦은 PUT도 다시 PENDING으로 만든다. 2026-10-04 정책에 따라 신규 수집과 회수를 독립 실행한다. 만료·회수 대기·삭제 실패 backlog는 새 수집의 전역 차단 조건이 아니며, 회수 실패 재시도·경보와 Core 수동 운영을 유지한다. 복원 inventory 중에는 기존 배타 잠금으로 수집을 막는다. 삭제 완료 이력은7일 뒤 제거한다.
- systemd 종료·프로세스 crash 뒤에는 저장된 manifest와 lease 만료를 따라 재개한다. 물리 삭제 지연은 보존 연장으로 정상 처리하지 않는다. 비밀 없는 상태/code를 확인하며 원문·전체 SQL·credential은 로그에 넣지 않는다.

## 격리 복원

복원 서비스의 공개·입력·수집 경로를 닫고 선택 백업을 복원한 뒤 전체 collect inventory를 실행한다. 다음 명령은 복원된 item이 없는 collect 객체를 즉시 orphan으로 회수한다.

```sh
bin/blariyo-collector retention --once --write-db --restore-inventory
```

복원 inventory의 exclusive DB 잠금과 수집 writer의 shared 잠금은 서로를 거부한다. 남은 RUNNING run도 복원 실행을 차단한다. 새 원문 fetch로 누락 자료를 복구하지 않으며, private/public 사본의 참조·hash·영구 중복 판정을 별도로 확인한 뒤에만 입력·수집을 재개한다.

잔여 인수: 선택 backup/age 실제 격리 복원, 과거 디스크·object inventory, R2 실제 권한과 부재 확인, Discord 연결·실수신, 서버 timer 설치/재부팅·장애 회복, 실제7일 관찰. 로컬 테스트 결과와 구분한다.

## 이미지 실패 자동 삭제 (2026-10-05)

- Collector V011~V013과 같은 릴리스의 권한 SQL을 함께 적용한다. 목록·단건·queue는 이미지 실패 글에 추가 시도를 한 번만 허용하며 계속 실패한 미검수 자료는 즉시 목록에서 제거한다.
- retention worker는 만료 처리 전에 `batch_image_cleanup`의 삭제 대기를 처리한다. 이 명시적 실패 정리는 만료일을 바꾸지 않는다. raw/media의 정확한 item/run 경로만 삭제하고 부재를 확인한다. 실패하면 완료 시각을 남기지 않아 다음 실행에서 다시 처리한다.
- 일반 batch 계정에 object DELETE 권한을 추가하지 않는다. 승인·발행 자료와 content 사본은 보존한다. 로컬에서는 이 작업의 고정 DB/객체 경로만 적용하며 운영 반영은 배포·timer 실행 확인이 필요하다.

### 관리자 실패 삭제 파일 정리

Collector V014부터 관리자 실패/차단 삭제는 DB payload를 즉시 제거하고 `batch_manual_cleanup`에 item/run별 회수 작업을 남긴다. 기존 retention worker가 만료와 별개로 이 작업도 처리한다. 신규 SQL 함수 설치 뒤 `apply-privileges.sql`을 실행해 앱의 제한 삭제 함수와 retention의 새 wrapper 권한을 반영한다. 파일 회수 완료는 `completed_at` 및 실제 부재로 확인한다. worker 미실행/저장소 장애에서는 DB 삭제만 완료되고 파일 작업이 대기한다. 기존 `BATCH_IMAGE_CLEANUP_FAILED` 경보와 함수명은 호환성을 유지하며 수동 삭제 작업 실패도 포함한다.
