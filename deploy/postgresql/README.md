# PostgreSQL 역할과 권한 준비

운영 DB의 역할 분리와 Lightsail x86_64의 PostgreSQL 단독 설치 파일이다.
**전체 앱의 운영 Compose·앱 배포 완료를 의미하지 않는다.**
2026-09-20 사용자 실행 출력으로 Lightsail의 DB healthy·영속 volume·역할 3개 접속을 확인했다.
초기 앱 migration 도구는 로컬 임시 PostgreSQL 18과 합성 비밀번호로 검사했으며,
이후 실제 서버 V001–V005·테이블 권한 적용과 정책 v0.1 정식 발행까지 완료했다.
[9월 23일 DB 운영 반영](../../worklog/2026-09-23/release/production-db-promotion.md)에서는 별도 검토 절차로
API V008·Collector V006을 적용하고 ledger/checksum·역할 권한과 데이터를 대조했다. 이는 당시 관측이며
2026-09-24에 DB를 재조회하지 않았다. 아래 V001–V005 도구는 **최초 설치·과거 호환 검사 문맥**이며,
가동 중인 V008 DB의 후속 schema upgrade나 자동 복구에 사용하지 않는다.
[배포 실행서](../../docs/operations/deployment-runbook.md)에 전체 순서가 있다.
아래 초안 seed 설명은 최초 준비 단계이며 현재 유효 정책이 없다는 뜻이 아니다.

계약은 [보안·운영 설계](../../docs/system-design/05-security-operations.md#6-db-권한)와
[인프라 설계](../../docs/system-design/04-infrastructure-design.md)를 따른다.
SQL migration과 `ops.schema_migration`이 스키마 변경의 정본이며 TypeORM 자동 동기화는 사용하지 않는다.

## 정책 초기 데이터 등록

[seed-policy-drafts.sql](seed-policy-drafts.sql)은 **migration 이후** 실행하는 정책 데이터 초기화 SQL이다.
기존 [약관·개인정보처리방침](../../docs/legal/m0-core/README.md)에 저장된 공개 연락처를 주입해
`v0.1-draft.2` 버전의 `TERMS`, `PRIVACY`를 등록한다. 본문·연락처는 저장소나 로그에 추가하지 않는다.
입력은 SSH 표준입력으로 전달하며 서버 `policy-seeds/<SHA-256>/`에 root 700/600으로 보관한다.
등록 전 DB dump를 남기고, 등록 후 유형·버전·상태·시행일과 본문 SHA-256을 다시 대조한다.

아래는 migration을 마친 **최초 설치 당시 서버**에 draft seed만 적용한 명령이다. 현재 운영 정책
조회나 일반 재배포를 위해 반복 실행하지 않는다.

```sh
python3 deploy/postgresql/seed-policies-from-mac.py --host 13.124.55.99 --apply
```

새 서버에서 DB·역할 설치 후에는 아래 초기화 진입점이 **V001–V005 및 권한 적용 → 정책 seed**를
순서대로 실행한다. 검증된 migration archive와 기존 비공개 연락처 파일이 있어야 한다.
현재 helper는 기존 서버 hostname을 검사하므로 다른 인스턴스를 준비할 때 대상 검사를 갱신해야 한다.
초기 archive manifest는 helper·권한 SQL 해시도 고정한다. 현행 권한 SQL은 direct 역할을 포함하므로
9월 20일 묶음과 다를 수 있다. `TESTED_HELPER_CHANGED`를 우회하거나 manifest만 다시 해시하지 말고
새 초기 구성 묶음을 격리 재검증한 뒤 사용한다.

```sh
python3 deploy/postgresql/initialize-from-mac.py --host 13.124.55.99 --apply
```

`--apply`를 빼면 로컬 입력만 검사한다. Docker `/docker-entrypoint-initdb.d`에 넣지 않는다.
그 hook은 빈 PostgreSQL volume에서 실행되고, 그 시점에는 앱 schema가 없기 때문이다.
앱의 매 기동에도 seed를 실행하지 않는다. 배포 초기화 단계에서 한 번 실행하며, 동일 입력은
재실행해도 ID·작성일·본문이 그대로 유지된다. 같은 버전의 다른 본문은 transaction 전체를 취소한다.

초기 seed의 초안 본문은 `DRAFT`, `effective_at=NULL`로 보관된다. 기존 발행본은 보존되며,
공개 API에서 조회되지 않고 production 기동 조건도 충족하지 않는다. 최종 본문은 초안과 다른
정식 버전(예: `v0.1`)으로 앱의 `policies:publish` 명령을 통해 발행해야 한다. SQL로 상태만 바꾸면
본문 검사·이전 버전 종료·캐시 삭제 작업을 빠뜨리므로 그렇게 활성화하지 않는다.

검사: `python3 deploy/postgresql/test-policy-seed.py` — 격리 PostgreSQL 18에서 실제 migration SQL,
중복 실행, 동일 버전 충돌의 전체 취소, EFFECTIVE 입력 거부, 기존 발행본 보존을 검사한다.

## 파일별 역할

| 파일                                                   | 실행 주체와 용도                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [create-roles.py](create-roles.py)                     | 서버의 Docker 관리 권한 사용자. 역할별 파일을 읽어 SQL을 표준입력으로 전달       |
| [create-batch-role.sql](create-batch-role.sql)         | 초기 3역할 이후 batch login만 추가, 기존 비밀번호 유지                           |
| [create-roles.sql](create-roles.sql)                   | PostgreSQL의 `postgres`. 새 `blariyo` DB에 역할·기본 접근 권한 생성              |
| [pg_hba.conf](pg_hba.conf)                             | PostgreSQL 시작 설정. Unix socket 관리 접근과 역할별 TCP 인증 제한               |
| [apply-privileges.sql](apply-privileges.sql)           | `blariyo_migrator`. migration 이후 기존·향후 객체 권한 적용                      |
| [compose.yaml](compose.yaml)                           | PostgreSQL만 실행. 영속 volume, 내부 network, 공개 host port 없음, memory 768MiB |
| [install-from-mac.py](install-from-mac.py)             | 맥의 비밀번호 파일 검사, 명시적 설치 옵션에서만 SSH 표준입력 전송                |
| [install-server.py](install-server.py)                 | 서버 root로 전용 파일 보관·Compose 실행·역할 생성·접속 검사                      |
| [migrate-from-mac.py](migrate-from-mac.py)             | 검증된 image archive 검사, `--apply`에서만 SSH 전송·초기 migration 요청          |
| [migrate-server.py](migrate-server.py)                 | 서버 사전 검사·변경 전 DB 사본·non-root 앱 migration·역할별 권한 검사            |
| [test-initial-migration.py](test-initial-migration.py) | 실제 배포 archive를 load하고 합성 DB에서 최초 적용·재실행·변조 거부 검사         |

## Lightsail에 DB만 설치하는 단계

2026-09-20 최초 설치 전 사용자 확인값은 x86_64, 사용 가능 메모리 1.4GiB, swap 2GiB, 디스크 여유 53GiB,
Compose v5.5.1, 기존 cloudflared container 1개다. 설치는 별도 project `blariyo-db`를 사용한다.
기존 Tunnel, DNS, 방화벽, SSH 설정을 변경하지 않는다. 서버에서 앱 image를 빌드하지 않는다.

맥의 저장소 루트에서 보관 파일만 검사하려면:

```sh
python3 deploy/postgresql/install-from-mac.py --host 13.124.55.99
```

동일 명령에 `--install-db`를 추가하면 **실제 서버로 DB 파일·비밀번호 3개를 전달하고 설치한다**.
이 IP는 기존 SSH 접속 대상이며 고정 IP가 아니다. 서버 중지·시작 후에는 콘솔의 현재 주소를 확인한다.
host key가 새 주소에 등록되어 있지 않거나 기존 키와 다르면 설치 도구는 거부한다. SSH 확인을
생략하는 옵션으로 우회하지 않는다. 기본 서버 hostname은 사용자 출력의 `ip-172-26-1-91`이며
다르면 설치 전에 중단한다. 인스턴스를 실제로 교체한 경우에만 `--expected-hostname`으로 바꾼다.

```sh
python3 deploy/postgresql/install-from-mac.py --host 13.124.55.99 --install-db
```

설치에 필요한 것은 맥의 Python 3·기존 SSH key, 서버의 Python 3·Docker Compose·비대화식 sudo다.
SSH key 경로는 기존 접속 helper와 동일한 두 위치를 확인하며 필요하면 `--key`로 지정한다.
키와 비밀번호 원문은 출력하지 않는다. 별도 비밀번호 묶음 파일을 맥 디스크에 만들지 않고,
SSH의 표준입력으로 전달하여 서버의 root 소유 `0700` 디렉터리·`0600` 파일로 저장한다.
bootstrap 관리 비밀번호는 서버에서 별도로 생성하며 관리자 TCP 접속은 허용하지 않는다.

완료 시 확인하는 범위:

- PostgreSQL healthy, host port 없음, 내부 data network, memory limit 768MiB.
- 기본 설정 `shared_buffers=192MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=30`.
- 영속 volume `blariyo-db_pgdata`와 network `blariyo-db_data`.
- 역할 3개 각각의 비밀번호로 TCP 접속, 관리자급 role flag 없음.

설치는 해당 도구가 관리한 동일 파일·비밀번호이면 재실행할 수 있다. 입력 변경, 비관리
디렉터리, 다른 소유자의 Docker resource, 부분 생성된 역할은 거부한다. 실패 시 자동으로
volume을 삭제하거나 DB·비밀번호를 초기화하지 않는다. 오류 원문 대신 단계·고정 코드를 확인한다.
운영에서는 `docker compose down --volumes`를 사용하지 않는다.

DB 단독 설치 후 앱 migration·테이블 권한·앱 image의 역할별 mount·R2 백업은 다음 단계로 진행한다.
추후 앱 Compose의 Core만 external network `blariyo-db_data`에 연결하고 `postgresql:5432`로 접속한다.
Web이나 기존 Tunnel을 data network에 연결하지 않는다.

## DB 설치 후 초기 앱 migration

이 도구는 V001–V005 최초 스키마 구성 전용이다. 이후 운영 중인 앱의 무중단 배포·schema upgrade
명령으로 재사용하지 않는다. 첫 실행은 application schema가 없는 DB만 허용한다. 재시도는
서버에 기록한 동일한 migration 묶음만 허용하며 기존 DB·역할·비밀번호를 초기화하지 않는다.
data network에 DB 이외 container가 있거나 app·migrator·backup 접속이 남아 있으면 중단한다.

맥에서 실행한다. `--apply`가 없으면 로컬 archive·도구·SSH key 권한 검사만 수행한다.

```sh
python3 deploy/postgresql/migrate-from-mac.py --host 13.124.55.99 --apply
```

- 로컬 묶음: `/Users/zeaha/task_list/blariyo-db-migration-20260920/`의 `api.tar`와 `manifest.json`.
  archive에는 운영 비밀번호가 없다. 기본 Dockerfile의 `api` target을 `linux/amd64`로 빌드했다.
- image archive SHA-256, 검증한 server helper·권한 SQL checksum을 검사한다. 서버에서는 load한
  image의 OS·architecture·runtime config·순서 있는 filesystem layer digest를 대조한 뒤
  확인된 image ID로 실행한다. Docker image store별 index/config ID 차이를 fingerprint로 처리한다.
  inspect API 버전에 따라 생략되는 문서화된 빈 값·기본값만 같은 표현으로 정규화한다.
  실제 설정값·미지정 신규 필드·파일 layer의 내용과 순서 차이는 계속 거부한다.
  근거: [Docker inspect API 변경](https://docs.docker.com/engine/deprecated/#empty-nil-fields-in-image-config-from-inspect-api).
- 기존 strict SSH host key, 서버 hostname·아키텍처·관리 marker·디스크 여유를 확인하고 image를
  전송한다. source build는 맥에서 끝낸다. 새 비밀번호를 전송하거나 기존 비밀번호를 바꾸지 않는다.
- 적용 직전 root `0600`의 `before-initial-migration-<난수>.dump`를 DB 관리 디렉터리에 저장하고
  `pg_restore --list`로 archive 판독을 확인한다. 이는 초기 구성용 로컬 관리 사본이다. Unix peer로
  접속하는 `postgres` 관리 역할을 사용하며, 정기 backup 역할·암호화·원격 R2 백업·복원 검증을
  대신하지 않는다. 사본에 DB 데이터가 들어갈 수 있으므로 외부에 그대로 공유하지 않는다.
- 일회성 migration container는 UID 1000, memory 256MiB, read-only root, data network만 사용한다.
  migrator 비밀번호만 임시 secret volume의 UID 1000·`0600` 파일에 넣고 읽기 전용 mount한다.
  원본은 root `0600`을 유지한다. 정상·오류 종료 때 자기 container와 임시 secret volume을 정리한다.
- 실제 앱 `apps/api/dist/commands/migrate.js up`을 실행한다. ledger version·filename·SHA-256을
  검증한 뒤 migrator로 `apply-privileges.sql`을 별도 transaction에서 적용한다.
- app readiness·테이블 조회, app DDL/ledger 직접 접근 거부, backup ledger 조회·쓰기 거부와
  schema 소유자를 확인한다. 오류 시 자동 schema rollback·DB 삭제를 하지 않는다.

권한 적용 실패 전 migration transaction이 이미 성공했을 수 있다. 같은 묶음으로 재실행하면
앱 migration은 ledger checksum을 확인하고 이미 적용한 SQL을 건너뛴 뒤 권한을 다시 적용한다.
image·migration 묶음 변경은 거부한다. 실제 서버 출력의 PASS와 종료 코드를 확인한 후 앱 배포로
진행한다. 기존 Tunnel·DNS·방화벽 설정 변경과 앱 서비스 시작은 이 명령에 포함하지 않는다.

## 서버 적용 전제와 순서

아래는 전체 배포 연결 순서다. 위 DB 단독 설치 도구는 1–3단계와 역할별 접속 검사만 수행한다.
테이블 migration·권한 적용은 앱 image 준비 후 별도로 진행한다.

1. PostgreSQL 18의 별도 영속 volume, `blariyo` DB, 위 `pg_hba.conf`를 준비한다.
   production에는 PostgreSQL host port를 게시하지 않는다. Core와 migration·backup 작업만
   data network에 연결한다. Docker image 최초 초기화에 필요한 별도의 `postgres` bootstrap
   비밀번호 파일은 단독 설치 도구가 별도로 생성한다. app·migrator·backup 비밀번호를 재사용하지 않는다.
2. 운영 원본 비밀번호 3개를 root 소유 `0600` 파일로 보관한다. 이름은
   `app-password`, `migrator-password`, `backup-password`다. 디렉터리는 `0700`으로 둔다.
3. `create-roles.py`에 실제 PostgreSQL container 이름과 원본 비밀번호 디렉터리의 절대경로를
   전달한다. Python 3와 Docker CLI가 필요하다. wrapper는 container의 OS 사용자 `postgres`로
   Unix socket에 접속한다. peer 인증은 이 OS 사용자와 DB 사용자가 일치할 때만 허용한다.
4. 실제 앱 migration command를 `blariyo_migrator`로 실행한다. `DB_HOST`, `DB_NAME=blariyo`,
   `MIGRATION_DB_USER=blariyo_migrator`, `MIGRATION_DB_PASSWORD_FILE`을 사용한다.
5. 같은 DB에 `blariyo_migrator`로 [apply-privileges.sql](apply-privileges.sql)을 실행한다.
   이 SQL은 transaction 단위이며 매 배포의 migration 뒤에 다시 적용할 수 있다.
6. 역할별 접속, app 허용·거부, backup dump와 별도 DB 복원을 확인한 다음 앱을 연결한다.

비밀번호는 명령 인자·연결 URL 환경 변수에 넣지 않는다. 역할 생성 wrapper는 owner·`0600`·
일반 파일·서로 다른 64자리 hex를 검사하며 psql 표준입력에만 값을 전달한다. SQL 실행 오류의
원문은 출력하지 않는다. 기존 역할 또는 앱 schema가 있으면 transaction을 실패시켜 기존
비밀번호를 변경하지 않는다. **기존 DB 변경, 비밀번호 교체와 복구 작업에는 이 최초 생성
wrapper를 사용하지 않는다.**

non-root container에 mount할 때는 container 실행 UID가 읽을 수 있는 별도 staging 파일 또는
secret volume이 필요하다. 서버 원본은 root `0600`으로 유지하고 staging 파일은 해당 UID의
`0600`, mount는 읽기 전용으로 맞춘다. `0644`로 넓혀 해결하지 않는다. API에는 app,
migration에는 migrator, backup에는 backup 비밀번호만 전달한다. 앱의 최초 mount 구성은
[앱 배포 안내](../application/README.md)를 따르며 새 후보의 UID·mount·권한은 매번 대조한다.

## 권한 범위

- `blariyo_app`: content/legal 및 명시한 API 소유 collect table의 읽기·추가·수정·삭제와 sequence 사용.
  batch 결과 7개 table은 SELECT만, batch queue/confirmation 및 Collector framework schema는 접근 금지.
  schema/table 생성·변경, 다른 역할로 전환, migration 이력 직접 접근은 금지한다.
  `ops.is_schema_ready(TEXT)` 함수로 준비 여부만 확인한다.
- `blariyo_migrator`: application schema의 소유자이며 DDL을 실행한다. DB를 새로 만드는
  `CREATEDB`, 역할을 만드는 `CREATEROLE`, superuser 권한은 주지 않는다.
- `blariyo_backup`: 모든 application table·sequence와 migration 이력 읽기만 허용한다.
  기본 read-only 설정을 사용자가 끄더라도 객체 권한으로 쓰기를 차단한다.
- `blariyo_batch`: batch 결과 7개와 queue/confirmation에 SELECT/INSERT/UPDATE, media에만 DELETE.
  API 검수/content/legal/ops와 Collector framework schema에는 접근하지 않는다.
  소유권 trigger가 호출하는 `assert_source_owner(text)`, `assert_run_owner(uuid)`만 직접 실행할 수 있다.
- future `content`, `legal` table에는 app DML, backup SELECT를 부여한다.
  future `ops`, `collect`, `collector`, `batch`, `quartz` table에는 backup SELECT만 자동 부여한다.
  API/batch는 새 collect table/sequence 권한을 자동 상속하지 않는다. 각 허용 목록을 명시적으로 갱신한다.
  모든 framework schema/ledger도 backup dump·restore 비교에 포함한다.

기존 객체 권한과 향후 객체의 기본 권한은 별개이므로 둘 다 적용한다. 기본 권한은 객체를
생성한 역할에 종속된다. 따라서 schema 변경은 지정된 migrator로 실행해야 한다.
근거: [PostgreSQL 18 기본 권한](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html),
[클라이언트 인증 규칙](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html).

## 격리 검사

Docker, Node 24, JDK 25가 준비된 macOS/Linux 저장소 루트에서 (`JAVA_HOME`은 해당 JDK 경로):

```sh
PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH npm run test:database-roles
```

[검사 스크립트](../../scripts/test-database-roles.ts)는 매번 임시 PostgreSQL container와 합성
비밀번호를 생성한다. 검사 때만 loopback의 임의 host port를 사용하고 종료 시 container·임시
파일을 정리한다. `~/.config/blariyo`와 운영 서버에는 접근하지 않는다.

검사 항목은 API V001–V008와 Collector V001–V006 migration, 4역할 비밀번호 인증,
별도 Java 프로세스의 제한 batch 계정 수집·중복 skip·DB/local object readback,
제한 API 계정의 검수·private DRAFT·별도 publish,
DDL·ledger 접근 거부, trigger 유지, 향후 객체 권한, backup의 쓰기 거부, backup 계정의
custom-format dump와 별도 DB 복원이다. 복원 후 모든 application table의 행·ledger와
sequence 값을 비교한다. 복원 검사는 `--no-owner --no-acl`을 사용하므로 복원 대상의
운영 소유권·권한 재적용을 증명하지 않는다. 암호화·R2 업로드·주기 실행·서버 장애 복구와
전체 production 연결도 별도 검증 대상이다.

Compose 설치·재실행·컨테이너 재생성 뒤 데이터 보존은
[test-setup.py](test-setup.py)로 별도로 검사한다. 이 검사는 `/private/tmp`의 임시 파일과
난수 project만 사용하고 마지막에 자기 project의 volume까지 정리한다. 운영 설치 도구에는
이 정리 동작이 없다. Mac의 Docker Desktop에서 `python3 deploy/postgresql/test-setup.py`로 실행한다.
공식 구성 근거: [Docker Compose service 속성](https://docs.docker.com/reference/compose-file/services/),
[PostgreSQL 공식 image](https://hub.docker.com/_/postgres/).

`python3 deploy/postgresql/test-image-fingerprint.py`는 구·신 Docker API의 빈 항목 표시 차이만
허용하고 실행 사용자·명령·환경·파일 layer 등의 실제 변경은 거부하는 회귀 검사다.

### 확정 정책까지 포함한 신규 초기 구성

초기 SQL의 draft.2 본문은 `docs/legal/m0-core/draft-2/`에 고정했다. 이후 편집한 공개 본문으로
과거 draft.2를 덮어쓰지 않는다. 2026-09-20의 운영 v0.1은 별도 실제 앱 발행 command로 등록했다.

Web/Core image·runtime이 먼저 stage된 신규 서버에서는 아래 선택 항목으로
migration → 고정 draft seed → 확정 정책 발행까지 연결할 수 있다.

```sh
python3 deploy/postgresql/initialize-from-mac.py --host 13.124.55.99 --apply --publish-policies
```

이 최초 설치 도구의 서버 hostname·release 경로는 현재 검증 대상에 고정돼 있다.
서버 교체 시 대상 검증값을 갱신해야 하며, 운영 중 일반 release migration용으로 반복하지 않는다.
이미 배포된 서버에서 단순 확인을 위해 위 초기화 명령을 다시 실행하지 않는다.

## Direct batch 역할 추가 (초기 3역할과 별도 절차)

9월 23일 운영 기록은 API V008·Collector V006과 API/backup 권한을 확인했다. 별도 PC의 batch
login·실제 쓰기 권한은 별도 인수 대상이다. 현재 역할 존재 여부를 조회하지 않고 추가를 다시
실행하지 않는다. 아래는 batch 역할이 없는 대상의 추가 절차다.

초기 설치는 app/migrator/backup 3개 역할만 만든다. batch를 활성화할 때는 별도
`batch-password` 파일을 소유자 전용 `0600`으로 준비하고 다음을 실행한다.
값은 64자리 hex이며 다른 역할과 공유하지 않는다. 동일 디렉터리의 기존 비밀번호 파일이
있으면 wrapper는 해당 **값과 같은 비밀번호의 재사용**을 거부한다. 기존 파일의 존재 자체를 거부하는 것은 아니다.
파일·비밀번호 값을 터미널 출력이나 명령 인자에 넣지 않는다.

```sh
python3 deploy/postgresql/create-roles.py --container <postgres-container> \
  --secrets-dir <absolute-private-directory> --batch-only
```

이 명령은 이미 존재하는 batch 역할을 재설정하지 않는다. 같은 migrator로 API/Collector migration을
적용하고 `apply-privileges.sql`을 실행해야 table 권한이 생긴다. Collector migration 전후 및 역할
추가 전후 모두 권한 SQL을 재실행할 수 있다. 실행 중 batch를 멈추고 백업한 뒤 적용한다.
HBA의 batch login 추가는 새 네트워크 공개를 의미하지 않는다. 원격 PC는 별도로 검증한
VPN/사설 경로만 사용하며 PostgreSQL port를 인터넷에 공개하지 않는다.

Collector V006의 MIME 정정 함수와 `batch_media_correction`은 migrator 전용이다.
`apply-privileges.sql`의 API/batch 명시 목록에 이 테이블·함수를 추가하지 않는다.
소유자는 백업과 파일 검증 manifest를 확인한 뒤 별도 유지보수로 실행하며 runtime은 완료 media를
직접 수정하지 않는다. 운영 적용은 위 9월 23일 기록으로 확인하며, 새 로컬 검사만으로 현재 운영
migration 상태를 판정하지 않는다.
