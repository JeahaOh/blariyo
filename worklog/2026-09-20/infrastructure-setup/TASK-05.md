# TASK-05 — DB 비밀번호 생성 확인과 PostgreSQL 역할·백업 격리 검증

- 기록일: 2026-09-20, KST
- 이전 기록: [DB 비밀번호 파일 입력 준비](TASK-04.md)
- 사용자 증거: `prepare-blariyo-db-secrets.cjs --create` 전체 PASS 출력
- 상태: **운영 비밀번호 로컬 생성 확인, 역할 생성·권한 파일과 로컬 PostgreSQL 검증 완료. Lightsail 적용·운영 배포는 미수행**

## 1. 운영 비밀번호 생성 확인

사용자가 제공한 실행 결과에서 다음을 확인했다. 비밀번호 원문은 읽거나 기록하지 않았다.

- `~/.config/blariyo/db-secrets` 아래 역할별 신규 비밀번호 3개 생성, 기존 유지 0개.
- 본인 소유, 파일 권한 `600`, 서로 다른 난수 32바이트 형식 검사 통과.
- 실제 앱 설정 로더에서 app·migration 비밀번호 파일 읽기 성공.
- 역할 이름은 `blariyo_app`, `blariyo_migrator`, `blariyo_backup`.

이 사용자 결과는 로컬 파일 준비 증거다. 운영 DB 계정 생성·접속 성공을 뜻하지 않는다.
이후 아래 검사는 해당 운영 파일 대신 매번 생성한 합성 비밀번호로 실행했다.

## 2. 최초 역할 생성과 권한 적용 파일

[PostgreSQL 준비 디렉터리](../../../deploy/postgresql/README.md)에 다음을 추가했다.

- `create-roles.py` / `create-roles.sql`: 새 `blariyo` DB 전용. 이미 역할 또는 앱 schema가
  있으면 거부하고 기존 비밀번호를 변경하지 않는다. 각 역할은 superuser·CREATEDB·CREATEROLE·
  REPLICATION·BYPASSRLS 없이 생성한다. password는 `0600` 파일에서 읽어 psql 표준입력으로
  전달하며 출력·명령 인자·환경 변수에 넣지 않는다. 오류 원문도 출력하지 않는다.
- `pg_hba.conf`: OS 사용자 `postgres`의 Unix socket peer 관리 접속과, 지정된 3개 역할의
  `blariyo` TCP SCRAM 인증만 허용한다. 관리자 TCP와 다른 DB 접근은 차단한다.
  production에서는 host DB port를 게시하지 않는다.
- `apply-privileges.sql`: 실제 앱 migration을 migrator로 실행한 다음 적용한다. 기존 객체와
  향후 객체의 권한을 모두 설정하며 재실행 가능하다. 앱의 구조 변경과 ledger 직접 접근을
  막고 readiness 함수만 허용한다. backup에는 ledger를 포함한 table·sequence 읽기를 허용한다.
- 새 `ops` table은 app에 자동 허용하지 않는다. 기존 업무 table 3개만 명시적으로 허용한다.
  이 경계를 [보안·운영 설계](../../../docs/system-design/05-security-operations.md)에 반영했다.

기존 SQL migration 파일과 TypeORM의 `synchronize: false` / `migrationsRun: false`는 유지했다.
production Compose, 영속 volume, bootstrap 관리 비밀번호와 UID별 secret mount는 아직 별도
배포 준비가 필요하다. 초기화 파일이 있다는 이유로 서버 설치 완료로 표시하지 않는다.

## 3. 실제 PostgreSQL 18 격리 검사

[test-database-roles.ts](../../../scripts/test-database-roles.ts)를 추가했다.
재실행 명령은 저장소 루트의 `npm run test:database-roles`다. API build 후 임시 container,
loopback 임의 port, 임시 비밀번호 파일을 사용하고 종료 시 검사 자원을 정리한다.
이번 실행은 이미 빌드된 API를 대상으로 `node scripts/test-database-roles.ts`로 진행했다.

| 검사 | 결과 |
| --- | --- |
| 역할 3개 생성·각 비밀번호 인증·SCRAM 저장 | 통과 |
| 잘못된 비밀번호·관리자 TCP·다른 DB 접속 차단 | 통과 |
| 최초 생성 재실행 거부·기존 app 비밀번호로 새 접속 | 통과 |
| migrator로 실제 V001–V005 적용·ledger 5행 | 통과 |
| 권한 SQL 연속 2회 적용 | 통과 |
| app readiness 함수·UTC | 통과 |
| app schema/table 생성·table 변경·ledger 조회/수정·역할 전환 거부 | 통과 |
| 실제 앱 서비스의 초안 생성·즉시 발행 | 통과 |
| board 수정 허용·slug 변경 금지 trigger 유지 | 통과 |
| future content table·identity sequence에서 app DML | 통과 |
| future ops table에서 app 조회 거부·backup 조회 허용 | 통과 |
| backup 기본 read-only·이를 끈 후에도 INSERT/CREATE/역할 전환 거부 | 통과 |
| backup 계정으로 `pg_dump -Fc --no-owner --no-acl` | 통과 |
| 같은 임시 PostgreSQL의 별도 DB에 `pg_restore --exit-on-error --single-transaction` | 통과 |
| 복원본의 19개 table 전체 행·ledger/checksum 및 12개 sequence 상태 대조 | 일치 |
| 검사 container·임시 파일 정리 | 통과, 검사 prefix container 잔존 없음 |

dump 비밀번호도 표준입력으로 container 내부 임시 `0600` pgpass 파일에 전달한다.
덤프·오류 원문·연결 URL·비밀번호는 검사 출력에 포함하지 않는다.
이 복원은 data/schema 범위를 검증하며 `--no-owner --no-acl`을 사용했으므로 운영 소유권·권한
복구, 암호화, R2 백업, 다른 서버의 재해 복구를 검증한 결과는 아니다.

## 4. 이전 Docker 실행 차단 해소

[TASK-04](TASK-04.md) 시점에는 Docker daemon이 꺼져 있어 통합 검사를 실행하지 못했다.
이번에는 Docker Desktop을 시작하고 engine `28.0.4` 연결을 확인한 뒤
`npm run test:docker`를 실제로 실행했다. 종료 코드는 `0`이다.

- API와 Web Docker image build: 통과.
- production 모드의 Core·Web·PostgreSQL, 서명된 Access fixture, 정책·발행/숨김·운영 command: 통과.
- PostgreSQL custom dump와 격리 restore/readback: 통과.
- liveness/readiness, maintenance API·CLI 거부, SIGTERM 및 DB 연결 해제: 통과.

이 Docker 검사의 Cloudflare endpoint와 JWT는 합성 fixture다. 기존 검사 DB도 fixture 인증
구성이므로 위 §3의 역할별 SCRAM·권한 검사와 독립 증거로 기록한다. 실제 Cloudflare 로그인,
운영 JWT·R2와의 전체 배포 흐름, Lightsail runtime을 증명하지 않는다.

## 5. 정적 검증과 다음 단계

- 운영 스크립트 전체 TypeScript 검사·ESLint 통과. 최초 lint에서 새 스크립트의 좁은 type assertion
  1건을 발견해 고정 role tuple로 변경한 뒤 재검사했다.
- Python wrapper AST 구문 검사 통과. 역할 생성 wrapper는 위 PostgreSQL 검사에서 실제 실행했다.
- 변경 관련 문서 6개의 상대 링크 71개 존재 확인과 `git diff --check` 통과.
- 기존 미커밋 변경을 보존했다. commit·push, SSH 접속·파일 전송·서버 SQL 실행은 수행하지 않았다.

다음은 기존 Lightsail의 메모리·swap·disk·Docker Compose·container 현황을 읽기 전용으로
확인하는 단계다. 사용자 선택에 따라 2GB와 비고정 IP를 유지한다. 그 결과에 맞춰 서버의
production Compose, role별 secret mount, DB 최초 초기화·migration·권한 적용을 준비한다.
