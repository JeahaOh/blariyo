# TASK-04 — 내부 인증키 생성 확인과 DB 비밀번호 파일 입력 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [내부 인증키 준비](TASK-03.md)
- 사용자 증거: `prepare-blariyo-internal-auth.cjs --create` 전체 PASS 출력
- 상태: **내부 인증키 로컬 생성 확인. DB 비밀번호 파일 입력 구현·격리 검증 완료, 운영 비밀번호 생성과 DB 계정·권한 적용은 대기**

## 1. 내부 인증키 생성 확인

사용자가 제공한 실행 결과에서 다음을 확인했다. 이전 기록의 실제 키 생성 대기 이후의
새 증거이며, 원문 키를 읽거나 이 문서에 저장하지 않았다.

- `~/.config/blariyo/internal-auth.env`에 난수 32바이트의 키 2개 생성·저장 성공.
- 소유자, 파일 권한 `600`, 형식 검사 통과.
- `SERVICE_TOKEN`과 `NUXT_SERVICE_TOKEN` 값 일치, 별도의 `NUXT_ACTOR_SECRET` 확인.
- 실제 Web→Core 인증, container 주입과 서버 배포는 아직 미검증.

## 2. DB 입력 계약과 구현 정합화

[인프라 설계](../../../docs/system-design/04-infrastructure-design.md)는 역할별
`*_PASSWORD_FILE` 입력을 요구하지만 기존 실행 코드는 `DATABASE_URL`만 읽고 있었다.
별도의 DB 설치·배포를 진행하기 전에 파일 입력을 구현했다.

- 새 [DB 설정 로더](../../../apps/api/src/bootstrap/database-config.ts)는 공통
  `DB_HOST`, `DB_PORT`(기본 `5432`), `DB_NAME`과 역할별 사용자·비밀번호 파일을 읽는다.
- production API·운영 command는 `APP_DB_USER=blariyo_app`, `APP_DB_PASSWORD_FILE`을 사용한다.
- production migration은 `MIGRATION_DB_USER=blariyo_migrator`, `MIGRATION_DB_PASSWORD_FILE`을 사용한다.
- [API 시작](../../../apps/api/src/main.ts),
  [운영 command](../../../apps/api/src/commands/command.ts),
  [수집 전환 command](../../../apps/api/src/commands/collection-transition.ts),
  [migration command](../../../apps/api/src/commands/migrate.ts)에 연결했다.
- production은 `DATABASE_URL`, `PGPASSWORD`, 역할별 비밀번호 환경 변수 직접 입력과
  다른 역할의 사용자·비밀번호 파일 설정 혼합을 거부한다. 고정된 역할 사용자명도 확인한다.
- 파일은 절대경로의 일반 파일이어야 하며 그룹·타인 접근 및 실행 권한, symlink,
  짧거나 잘못된 비밀번호를 거부한다. 32~256자의 공백 없는 ASCII를 허용한다.
- 연결 URL은 메모리 안에서만 조합한다. 특수문자를 URI encoding하며 프로세스 환경 변수에
  비밀번호를 재저장하지 않는다. 파일 오류는 경로·원문을 출력하지 않는 고정 코드로 변환한다.
- migration CLI도 예외 원문 대신 고정 오류 코드를 출력하도록 바꿨다.
- local/test의 기존 `DATABASE_URL` 사용은 유지한다. 파일 입력과 혼합하거나 파일 설정이
  불완전한 경우 임의의 다른 credential로 fallback하지 않는다.

스키마·migration SQL, 기존 DB 역할·GRANT, 로컬 Compose는 변경하지 않았다.
TypeORM `synchronize: false`, `migrationsRun: false`와 migration ledger 계약을 유지한다.
[Docker 통합 검사](../../../scripts/test-docker.ts)는 격리 fixture DB에 `blariyo_app`을 만들고,
기존 migration의 app 권한 부여 기능을 사용하도록 바꿨다. 임시 Docker volume에 난수 비밀번호를
`node` 사용자용 권한 `600`으로 저장하고 운영 API·command에 읽기 전용 mount한다. volume은
검사 종료 시 정리 대상에 포함한다. 실제 운영 DB 역할에는 영향을 주지 않는다.
[README](../../../README.md)와
[운영자 체크리스트](../../../docs/operations/owner-setup-checklist.md)에도
배포 시 사용할 입력 방식과 실제 접속 검증 경계를 반영했다.

## 3. 로컬 DB 비밀번호 생성 도구

- 도구: `~/task_list/prepare-blariyo-db-secrets.cjs`.
- 보관 디렉터리: `~/.config/blariyo/db-secrets`.
- 생성 파일: `app-password`, `migrator-password`, `backup-password`.
- 각 파일은 서로 다른 난수 32바이트를 64자리 hex로 저장하며 본인 소유, 권한 `600`이다.
- 기본 실행은 검사만 한다. `--create`는 없는 파일만 생성한다. 기존 파일은 먼저 모두
  검사하며 잘못된 파일을 덮어쓰거나 권한을 바꾸지 않는다.
- 실제 빌드된 앱 로더로 app·migration 파일 파싱을 확인한다. backup 비밀번호는 보관·형식·분리만
  검사하며 backup 실행 프로그램 연결이나 `pg_dump`를 실행하지 않는다.
- 비밀번호·연결 URL을 출력하지 않고 DB 또는 외부 API에도 접속하지 않는다.

사용자 실행 명령:

```sh
/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node /Users/zeaha/task_list/prepare-blariyo-db-secrets.cjs --create
```

운영 비밀번호의 실제 생성은 위 명령의 사용자 결과로 별도 확인한다. 이번에는 격리된 임시
비밀번호만 생성해 테스트했다. 이 도구는 DB 계정을 생성하거나 서버에 파일을 전송하지 않는다.

## 4. 검증 결과

| 검사 | 결과 |
| --- | --- |
| API build / build:test | 통과 |
| API 전체 범위 ESLint | 통과 |
| 운영 스크립트 타입 검사·ESLint | 통과 |
| [DB 설정 테스트](../../../apps/api/test/database-config.service.test.ts) | 4개 통과 |
| 파일 읽기·특수문자 encoding·역할 분리·잘못된 역할 거부 | 임시 파일에서 통과 |
| production 직접 비밀번호 거부·local URL 유지·혼합 거부 | 통과, API·운영 command 진입점 포함 |
| 누락·잘못된 권한·symlink·디렉터리·상대경로·잘못된 비밀번호 거부 | 통과 |
| migration CLI 오류 비밀값 미출력 | 별도 프로세스로 통과 |
| 생성 도구 격리 테스트 | 5개 통과 |
| 생성·재실행 보존·일부 누락 보충·오류 시 원본 유지·실제 로더·출력 비밀값 미포함 | 임시 디렉터리에서 통과 |
| `npm run test:docker` | 실행 시도했으나 Docker daemon 연결 실패로 build 시작 전 중단. 통합 동작 미검증 |

최초 특수문자 테스트에서 `%` 인코딩 누락을 발견했고 명시적인 `encodeURIComponent` 적용 후
해당 테스트와 전체 DB 설정 테스트 4개를 다시 통과했다.
생성 도구 테스트 파일은 `/private/tmp/blariyo-db-secrets.test.cjs`이며 운영 파일을 사용하지 않았다.
Docker 오류는 `Cannot connect to the Docker daemon`이었으며 이번 시도에서 fixture container·DB·
volume 생성 단계에 도달하지 않았다. Docker가 실행되는 환경에서 변경한 통합 검사를 다시 실행해야 한다.

## 5. 남은 작업

- 운영 DB 비밀번호 로컬 생성 결과 확인.
- production Compose의 role별 secret mount, PostgreSQL 최초 초기화와 관리 credential 처리.
- 실제 DB 계정 생성·소유권·GRANT/default privileges, app DDL 및 migration ledger 접근 차단,
  backup 읽기 전용 접근과 dump/restore 검증.
- 실제 관리자 JWT·Web→Core 인증, production 배포와 운영 관찰.

이번 파일 입력 검사는 실제 DB 권한을 증명하지 않는다. API에 올바른 사용자명을 넣어도 그
계정이 DB 안에서 과도한 권한을 갖는지는 별도 검사해야 한다. 서버 접근, 운영 SQL 실행,
commit·push·배포는 수행하지 않았다.
