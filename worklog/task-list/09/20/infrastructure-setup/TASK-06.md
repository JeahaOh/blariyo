# TASK-06 — Lightsail 상태 확인과 PostgreSQL 단독 설치 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [DB 역할·백업 격리 검증](TASK-05.md)
- 상태: **서버 자원 현황 사용자 확인, DB 단독 설치 도구·Compose와 격리 검사 완료. 실제 서버 설치·SSH 전송은 미수행**

## 1. 사용자 제공 서버 현황

`uname`, `free`, `df`, `docker compose version`, `docker ps` 출력으로 확인했다.

| 항목 | 사용자 출력 |
| --- | --- |
| CPU 아키텍처 | x86_64 |
| 메모리 | 총 1.9GiB, 사용 490MiB, available 1.4GiB |
| swap | 총 2GiB, 사용 0B |
| 루트 파일시스템 | 총 58GiB, 사용 4.8GiB, 여유 53GiB, 사용률 9% |
| Docker Compose | v5.5.1 |
| 실행 container | `quirky_hertz`, `cloudflare/cloudflared:latest`, Up 26 hours, 게시 port 없음 |
| 서버 hostname | `ip-172-26-1-91` |

`docker ps`는 실행 중인 container만 확인한다. 중지 container·volume이 없다고 판단하지 않는다.
현재 DB 준비를 진행할 여유를 확인했지만 전체 앱의 부하·운영 용량을 증명하지 않는다.
사용자 결정인 2GB와 비고정 IP를 유지한다.

## 2. DB 단독 Compose와 설치 도구

[DB Compose](../../../../../deploy/postgresql/compose.yaml)와
[설치 안내](../../../../../deploy/postgresql/README.md)를 추가·갱신했다.
현재 [인프라 정본](../../../../../docs/system-design/04-infrastructure-design.md)의 자원·네트워크
기준을 따르며 전체 앱 Compose의 대체물이 아니다.

- PostgreSQL 18 공식 image를 확인한 multi-platform index digest로 고정하고 `linux/amd64`를 명시.
  registry manifest에 해당 플랫폼이 포함되는 것을 확인했다.
- memory 768MiB, memory+swap 총 1GiB, shm 256MiB. DB 설정은 shared_buffers 192MB,
  work_mem 4MB, maintenance_work_mem 64MB, max_connections 30, UTC.
- 별도 project `blariyo-db`, 영속 volume `blariyo-db_pgdata`를 `/var/lib/postgresql`에 mount.
- network `blariyo-db_data`는 internal. host port 게시 없음. 기존 Tunnel·DNS·방화벽 미변경.
- healthy 확인, `unless-stopped` 재시작 정책, 종료 유예 60초, log 10MB × 3개 회전.
- [install-from-mac.py](../../../../../deploy/postgresql/install-from-mac.py)는 로컬 비밀번호 3개와
  SSH key 파일 권한을 검사한다. 기본은 로컬 검사만 하며 `--install-db`에서만 전송한다.
- 로컬 진입점은 `/Users/zeaha/task_list/install-blariyo-postgres.py`다. SSH는 `ubuntu`의 기존
  key, strict host-key 검증, 비대화식 sudo를 사용한다. 서버 hostname이 다르면 쓰기 전에 거부한다.
- 비밀번호는 JSON 표준입력으로 SSH를 통해 전달한다. 로컬 credential 묶음 파일, 명령 인자,
  환경 변수, 출력에 넣지 않는다. 비밀번호 원문을 작업 기록에 저장하지 않았다.
- [install-server.py](../../../../../deploy/postgresql/install-server.py)는 Linux x86_64 root에서
  `/opt/blariyo/postgresql`의 전용 디렉터리·파일만 준비한다. 비밀번호 파일은 root `0600`,
  보관 디렉터리는 `0700`이다. bootstrap 관리 비밀번호는 별도로 서버에서 생성한다.
- 동일한 관리 파일·비밀번호로 재실행하면 기존 DB를 유지한다. 입력 변경·비관리 디렉터리·
  다른 소유자의 Docker resource·부분 생성 역할은 거부한다. 실패 시 자동 삭제·초기화 없음.
- 설치 후 DB healthy·network·memory limit·host port 미게시와 역할 3개 TCP 인증을 확인한다.

현재 설치 범위는 PostgreSQL과 역할 생성까지다. app schema migration, 테이블 권한 적용,
Core·Web의 container UID별 secret mount, 앱 배포와 R2 원격 백업은 포함하지 않는다.

## 3. 검증

[test-setup.py](../../../../../deploy/postgresql/test-setup.py)를 Mac Docker Desktop에서 실행했다.
난수 project·임시 디렉터리·합성 비밀번호만 사용했고 검사 완료 후 해당 project의 container·
network·volume과 임시 파일을 정리했다. 운영 설치 도구에는 volume 삭제 동작이 없다.

| 검사 | 결과 |
| --- | --- |
| 잘못된 파일 권한·중복 비밀번호·비관리 디렉터리 거부 | 통과 |
| 실제 DB Compose 실행·healthy·공개 port 없음·internal network·memory 768MiB | 통과 |
| 실행 container `uname -m`과 Compose platform | x86_64 / linux/amd64 확인 |
| PostgreSQL 주요 자원값 실제 조회 | 192MB / 4MB / 64MB / 30 일치 |
| 역할 3개 생성·각 비밀번호 TCP 인증 | 통과 |
| 동일 설치 재실행 | 비밀번호·DB 유지 |
| 다른 비밀번호로 재실행 | 거부, 원본 파일 유지 |
| container 강제 재생성 후 영속성 | 검사 행 42와 기존 역할·접속 유지 |
| 출력에 합성 비밀번호 포함 여부 | 미포함 |
| Python 구문·CLI help | 통과 |
| 실제 맥 보관 파일을 사용하는 기본 검사 실행 | 통과, 비밀값 미출력·SSH 미실행 |
| 변경 관련 문서 상대 링크·diff 공백 오류 | 상대 링크 38개 존재 확인, `git diff --check` 통과 |
| 테스트 project 자원 정리 | 난수 project container·volume·network 잔존 없음 |

최초 검사의 image architecture 판정은 image store의 기본 ARM 항목을 조회해 실패했다.
Compose에 `linux/amd64`를 명시했고, 검증기도 image 목록의 기본 항목 대신 실행 container의
`uname -m`과 Compose platform을 확인하도록 수정했다. 최종 전체 검사 종료 코드는 `0`이다.
이 검사는 Docker Desktop의 x86_64 실행을 검증하며 실제 Lightsail의 SSH·sudo·image pull·
운영 역할 생성 결과는 사용자 설치 실행 후 별도로 확인한다.

## 4. 사용자 다음 실행

맥의 새 터미널에서 아래 명령은 **실제 서버 파일 전송·DB 설치**를 실행한다.
현재 SSH 대상 IP가 그대로일 때 사용하며, 서버 재시작으로 변경됐다면 현재 주소로 교체한다.

```sh
python3 /Users/zeaha/task_list/install-blariyo-postgres.py --host 13.124.55.99 --install-db
```

예상 완료 출력은 DB healthy, 역할 3개 접속 PASS다. 실제 결과가 도착하기 전에는 서버 DB
설치 완료로 표시하지 않는다. 이후 앱 image와 migration·테이블 권한 적용 단계로 이어간다.
기존 사용자 변경을 보존했고 commit·push를 하지 않았다.
