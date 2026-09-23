# TASK-07 — Lightsail DB 설치 확인과 초기 앱 migration 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [PostgreSQL 단독 설치 준비](TASK-06.md)
- 상태: **실제 서버 DB 설치 사용자 PASS. 초기 migration image·도구·격리 검사 완료, 실제 서버 migration 대기**

## 1. 실제 서버 설치 증거

사용자가 `install-blariyo-postgres.py --host 13.124.55.99 --install-db`를 실행한 결과를 제공했다.
에이전트가 서버에 다시 접속하거나 독립적으로 readback한 결과와 구분한다.

- 대상 Ubuntu 서버: `ip-172-26-1-91`, DB 경로 `/opt/blariyo/postgresql`.
- PostgreSQL healthy, host port 없음, 내부 data network, memory 768MiB PASS.
- DB 역할 3개 각각의 비밀번호로 TCP 인증 성공, 기존 비밀번호 유지 PASS.
- 설치 결과의 범위는 DB·영속 volume·역할 접속이다. 앱 테이블·테이블 권한·앱 배포·원격 백업은
  이 출력으로 검증되지 않는다. 기존 TASK-06의 당시 대기 상태는 소급 수정하지 않았다.

## 2. 준비한 다음 실행 단위

[초기 migration 절차](../../../deploy/postgresql/README.md)에 명령·복구 경계와 보관 위치를 기록했다.

- 기존 Dockerfile API target을 맥에서 `linux/amd64`로 빌드했다.
- image tag: `blariyo-api:db-init-20260920-a17c9e4b`.
- 실행 image에서 `x64 v24.18.0` 확인. archive 크기 162,114,048 bytes.
- image·manifest는 `/Users/zeaha/task_list/blariyo-db-migration-20260920/`에 보관한다.
  운영 비밀번호는 포함하지 않는다. archive SHA-256과 runtime config/layer fingerprint를 검사한다.
- [맥 도구](../../../deploy/postgresql/migrate-from-mac.py)는 기본 로컬 검사이며 `--apply`에서만
  기존 SSH 인증으로 image를 전송하고 [서버 도구](../../../deploy/postgresql/migrate-server.py)를 실행한다.
- 서버 hostname·아키텍처·관리 marker·DB healthy·network 단독 연결·동일 초기 묶음을 확인한다.
- root `0600`의 변경 전 DB dump를 저장하고 archive 목록 판독을 확인한다. 초기 유지보수용 관리
  사본이며 정기 backup 역할·암호화 R2 업로드·재해 복구 증거가 아니다.
- UID 1000·memory 256MiB·read-only root의 일회성 container에서 실제 앱 migration command를
  실행한다. migrator password만 UID 1000·`0600` 임시 volume에 전달하고 읽기 전용 mount한다.
- V001–V005 ledger checksum을 비교하고 migrator로 권한 SQL을 적용한다. app readiness·조회,
  app DDL/ledger 거부, backup 조회/쓰기 거부와 schema 소유자를 확인한다.
- 기존 DB 삭제·비밀번호 변경·자동 downgrade·앱 시작·Tunnel/DNS/방화벽 변경을 하지 않는다.

최초 Docker build는 기본 Buildx metadata 경로의 쓰기 제한으로 시작하지 못했다.
`BUILDX_CONFIG`를 작업 전용 `/private/tmp` 경로로 지정한 뒤 동일 Dockerfile build를 완료했다.
권한을 확대하거나 기존 Docker 설정을 변경하지 않았다.

## 3. 로컬 검증

[test-initial-migration.py](../../../deploy/postgresql/test-initial-migration.py)를 실제 image archive와
난수 Compose project, 합성 비밀번호로 실행했다. 테스트 fixture만 종료·삭제했다.

| 항목 | 결과 |
| --- | --- |
| Dockerfile API target amd64 build·runtime Node | 통과, x64 / v24.18.0 |
| archive SHA-256 및 load 후 image fingerprint | 통과 |
| 새 amd64 PostgreSQL DB·역할 설치 | 통과 |
| 잘못된 image/grants checksum 사전 거부 | 통과, migration marker 생성 전 거부 |
| 변경 전 DB 사본 저장·archive 목록 판독 | 통과, 파일 0600 |
| 실제 앱 V001–V005 적용·ledger version/filename/hash | 통과 |
| app readiness/조회 및 DDL/ledger 거부 | 통과 |
| backup ledger 조회·read-only 설정을 끈 뒤에도 쓰기 거부 | 통과 |
| schema 4개 migrator 소유 | 통과 |
| 동일 묶음 재실행 | ledger 적용 시각·checksum·duration 및 비밀번호 유지 |
| 기존 ledger checksum 변조 | 실제 앱 migration 실패, 자동 초기화 없음 |
| 출력 내 합성 비밀번호 | 미포함 |
| 실제 맥 진입점 기본 검사 | 통과, archive·도구·SSH key 권한 확인, SSH 미실행 |
| Python 구문·문서 상대 링크·diff 공백 오류 | 8개 Python·31개 링크 확인, `git diff --check` 통과 |
| 일회성 migration container·secret volume 정리 | 잔존 없음, 테스트 DB project 정리 종료 코드 0 |

기존 TASK-05의 실제 draft/publish·향후 객체 권한·backup dump/restore 검증과는 별도의
실행 image·초기 설치 경로 검사다. 이번 검사는 SSH 전송·Linux root main·Lightsail의 실제
migration을 실행한 증거가 아니다. 서버용 secret staging은 같은 Docker 실행 경로로 검사했다.

## 4. 다음 사용자 실행

맥에서 아래 명령으로 검증한 image를 서버에 전송하고 실제 초기 migration·권한을 적용한다.

```sh
python3 /Users/zeaha/task_list/migrate-blariyo-db.py --host 13.124.55.99 --apply
```

고정 IP를 사용하지 않으므로 주소가 바뀌었다면 현재 Lightsail 주소로 교체한다.
이후 출력으로 서버 migration 상태를 확인하고 앱 배포 준비로 이어간다.
Web→Core 실제 인증·관리자 로그인·앱 배포·전체 운영 부하·원격 백업은 미검증이다.
기존 미커밋 변경을 보존했다. commit·push·SSH 전송·서버 migration은 실행하지 않았다.
