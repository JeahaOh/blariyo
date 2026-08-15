# 개발 환경 안전 초기화 절차

이 문서는 로컬 개발 환경만 대상으로 한다. 운영·공용·복구 불가능한 데이터가 있는 환경에는 적용하지 않는다. 볼륨이나 호스트 데이터 디렉터리를 삭제하는 명령은 이 문서에 두지 않는다.

## 1. 현행 PostgreSQL 개발 구성

| 항목 | 현행 값 |
| --- | --- |
| Compose service | `postgresql` |
| DBMS | PostgreSQL 18 |
| container port | `5432` |
| local host port | `127.0.0.1:45432` |
| host data directory | `apps/data/postgresql` |
| container volume root | `/var/lib/postgresql` |
| 개발 연결 확인용 SQL | `apps/init/postgresql/scripts/init.sql` |

- PostgreSQL 18 공식 image의 영속 volume root는 `/var/lib/postgresql`을 사용한다. 이전 image 관례인 `/var/lib/postgresql/data`를 새 구성에 혼용하지 않는다.
- `init.sql`은 비어 있는 로컬 개발 DB의 연결 확인만 담당한다. M0 운영 스키마와 seed는 각각 `V001`, `V002` migration으로 적용한다.
- MySQL·MariaDB container와 기존 `apps/data/mysql`은 현행 Compose 구성에 연결하지 않는다. 기존 로컬 MySQL 파일은 자동 변환하거나 초기화하지 않는다.

M0 migration 적용과 전용 빈 DB 검증은 API 디렉터리에서 실행한다.

```bash
cd apps/api
npm run db:migrate
npm run test:migrate
```

`db:migrate`는 적용된 SQL의 checksum이 달라지면 중단한다. 적용 완료된 migration 파일을 수정하지 말고 다음 version을 추가한다.

구성과 상태를 읽기 전용으로 확인한다.

```bash
docker compose config --services
docker compose ps postgresql
docker compose exec postgresql pg_isready
```

상세 계약은 [인프라 설계](./system-design/04-infrastructure-design.md), 백업·복원은 [보안·운영 설계](./system-design/05-security-operations.md), 전환 경계는 [PostgreSQL 전환 결정](./session-log/2026-08-14-postgresql-transition.md)을 따른다.

## 2. 대상 확인

1. 현재 경로가 이 저장소의 로컬 개발 checkout인지 확인한다.
2. 적용할 Compose 파일과 project name을 확인한다.
3. 실행 중인 서비스, 연결된 볼륨, bind mount의 실제 호스트 경로를 목록으로 기록한다.
4. 운영 환경 변수나 운영 endpoint가 연결되어 있으면 즉시 중단한다.

확인에는 읽기 전용 명령만 사용한다.

```bash
pwd
git rev-parse --show-toplevel
docker compose config --services
docker compose config --volumes
docker compose ps
```

## 3. 보존 여부 결정

- 데이터가 필요하면 PostgreSQL은 `pg_dump --format=custom` 논리 백업을 만들고 업로드 파일 복사본도 별도로 만든다.
- 백업 파일을 원본과 다른 경로에 두고, 복원 가능한 형식인지 확인한다.
- PostgreSQL custom archive는 `pg_restore --list`로 읽을 수 있는지 확인한다.
- 보존 여부가 불명확하면 초기화를 진행하지 않는다.

## 4. 서비스 정지

- 개발 서비스만 정상 종료한다.
- 볼륨 제거 옵션은 사용하지 않는다.
- project name과 Compose 파일을 다시 확인한 뒤 다음 단계로 이동한다.

## 5. 데이터 격리

- 완전 초기화가 필요하면 대상이 로컬 개발용임을 재확인한다.
- 기존 데이터는 삭제하지 말고 저장소 밖의 날짜가 포함된 격리 디렉터리로 이동한다.
- 이동 전후 경로와 용량을 기록하고, 새 환경 검증이 끝날 때까지 격리본을 유지한다.
- 실제 이동은 대상 절대 경로를 확인한 운영자가 별도로 수행하며, 이 문서에는 삭제·이동 명령을 제공하지 않는다.

## 6. 재생성과 검증

1. 필요한 개발 서비스만 다시 빌드하고 기동한다.
2. 컨테이너 상태와 health check를 확인한다.
3. 개발용 migration 또는 seed만 적용됐는지 확인한다.
4. 로그인, 목록, 상세 등 핵심 개발 흐름을 smoke test한다.
5. 검증에 실패하면 새 환경을 더 변경하지 말고 격리본으로 복구한다.

## 금지 사항

- 운영 서버에서 실행
- 대상 확인 없이 볼륨 또는 bind mount 정리
- 백업·복원 확인 전 기존 데이터 제거
- 여러 초기화 동작을 한 줄로 연결
- 경로 변수, wildcard, 상대 경로를 데이터 정리 대상으로 사용
