# M0 운영 실행 안내

현재 운영 주소는 https://blariyo.com/ 이다. 2026-09-20 Lightsail 서울의 단일 VM에
PostgreSQL·Core·Web·Nginx와 기존 cloudflared를 연결했다. blue/green은 구성하지 않았다.
최초 release는 `/opt/blariyo/application/release-56351a45eea650c0f02e5043`이다.
이후 배포·DB 반영의 마지막 관측은 [현재 운영 상태](../../docs/operations/current-status.md)를 따른다.
최초 release를 현재 배포 또는 복귀 대상으로 재사용하지 않는다.

최초 설치부터 재배포·복귀까지의 순서는 [실서버 배포 실행서](../../docs/operations/deployment-runbook.md),
GitHub 검증·이미지 게시와 운영 전환 정책은 [배포 정책](../../docs/operations/deployment-policy.md)을 따른다.

## 서비스와 확인

서버에서 실행한다. `docker inspect` 전체 결과나 env를 출력하지 않는다.

```sh
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo systemctl status blariyo-application.service blariyo-logs.service --no-pager
sudo systemctl list-timers 'blariyo-*' --no-pager
sudo journalctl -u blariyo-backup.service -n 10 --no-pager
```

- `blariyo-application.service`: 현재 release와 Nginx의 부팅 복구. 실제 VM 재부팅 시험은 별도다.
- `blariyo-publish.timer`: 매분 예약 발행 command.
- `blariyo-outbox.timer`: 매분 30초에 후속 처리 command.
- `blariyo-cleanup.timer`: 매일 03:15 UTC 정리 command.
- 위 command는 같은 lock을 공유해 겹치면 다음 회차로 넘긴다.
- `blariyo-log-retention.timer`: 매일 00:05 UTC. 앱·Web·Nginx 전용 로그를 7일 미만으로 유지.
- `blariyo-backup.timer`: 매일 03:30·15:30 KST(+최대 1분 분산), 암호화 R2 DB 백업.

앱 기본 Compose에는 json-file 설정이 남아 있으므로 **운영에서는 항상 production-logging.yaml을 함께 사용한다**.
전용 rsyslog는 `/run/blariyo-logs/log.sock`으로만 수신하며 호스트 log stream과 분리한다.
AppArmor는 비활성화하지 않고 전용 설정과 socket 경로만 허용했다.

백업 설치·복구 안내는 [backup README](../backup/README.md)를 따른다.
direct 원문 회수의 로컬 구현·별도 계정·적용 gate·timer 초안은 [보존 작업 인계](collect-retention.md)를 따른다. 현재 운영에 설치·활성화한 결과가 아니다.
실패 알림의 이메일·메신저 자동 전송과 장기간 외부 가용성 관찰은 아직 구성하지 않았다.
현재 상태·journal 확인은 자동 알림을 대신하지 않는다.

## 경로와 인증

`Cloudflare → Tunnel → Nginx → Web → Core → PostgreSQL` 순서다. DB·Core·Web·Nginx의 host port는 없다.
Nginx는 내부 Core URL을 공개하지 않고 www는 대표 도메인으로 이동시키기만 한다.
관리자 `/admin*`, `/api/v1/admin/*`는 기존 Access 이메일 정책과 인증 앱 MFA를 거친다.
Web은 별도로 JWT와 운영자 매핑을 검사한다. 토큰·인증 쿠키를 로그나 채팅에 복사하지 않는다.

## 되돌리기

- 코드 복귀는 **현재 DB와 호환성을 확인한** image/runtime 묶음으로 Compose를 교체한 뒤 readiness를 확인한다.
  V008에서 9월 20일 구 API는 readiness에 실패한다. [실행서의 복귀 기준](../../docs/operations/deployment-runbook.md#5-실패-시-복귀)을 따른다.
- DB migration·정책 이력은 자동 rollback하지 않는다. 필요하면 사전 dump를 격리 DB에 먼저 복원한다.
- 배포 전 DNS는 apex `A 198.49.23.145`, www `CNAME ext-sq.squarespace.com`, 둘 다 DNS-only였다.
  이는 Squarespace 안내 페이지 복귀용 정보이며 앱 데이터 복구를 대신하지 않는다.
- 메일 MX/TXT와 media R2 도메인은 이번 전환에서 변경하지 않았다.
- 서버 IP가 바뀌면 SSH 도구의 host·known host·hostname 검증을 갱신한다. Tunnel DNS를 새 공인 IP로 바꿀 필요는 없다.

## 재현 도구

`remote.py`는 현재 검증된 host/SSH key만 사용하는 운영 실행 연결기다.
서버에서 실행되는 `*-server.py`는 표준입력 JSON으로 필요한 값만 받는다.
설정과 비밀값을 콘솔에 출력하는 범용 ssh/env 명령으로 대체하지 않는다.
`install-server.py`(로그)와 `install-jobs-server.py`(예약 작업)는 같은 파일이면 재실행을 허용하고,
다른 기존 파일은 덮어쓰지 않는다. 실제 수정은 기존 파일을 보존하고 별도로 검증해 적용한다.

## 별도 생활·유머 자동 발행 배치 — 2026-10-10

코드 산출물이며 이 문서 작성으로 운영 설치/활성화를 수행하지 않는다. 개발 예약 중지는 유지한다.

1. 운영 전용 절차에서 출처 자동 발행 OFF·진행 중 AUTO 종료를 확인하고 기존 `blariyo-publish.timer`를 일시 중지한다. 구버전의 예약 발행에 포함된 자동 발행이 migration/배포 중 실행되면 안 된다. 이후 DB 백업/격리 복원 검증 → API V017 migration(V016 포함) → 최신 역할 권한 적용 → API 배포/준비 상태 확인을 마친다. 구 API는 DB 키워드의 현재 버전을 검사하지 않으므로 함께 유지하지 않는다. 이미 별도 자동 발행 timer를 설치한 환경은 그 timer도 migration/실행 파일 교체 전에 중지하고 새 API 준비 상태 확인 뒤 재개한다.
2. 새 API에서 예약 발행 분리와 준비 상태를 확인한 뒤 기존 예약 발행 timer를 재개한다. 기존 `/opt/blariyo/operations/run-job.py`를 보존한 뒤 새 실행기로 교체하고 동작을 확인한다. 기존 설치기는 다른 파일 덮어쓰기를 거부하므로 재설치를 변경 적용 방법으로 사용하지 않는다.
3. 배포된 API에서 읽기 전용 분류를 확인한다. 출처 OFF이면 결과는 비어 있다. ON 이후 시작한 run만 대상이다.

```sh
sudo docker exec blariyo-app-api-1 node apps/api/dist/commands/command.js collection:auto-publish --dry-run --limit=20
```

4. 이 폴더의 `blariyo-auto-publish.service/timer`를 `/etc/systemd/system/`에 설치하고 `systemd-analyze verify` 후 `systemctl daemon-reload`한다. 실제 활성화가 요청된 경우에만 `systemctl enable --now blariyo-auto-publish.timer`를 실행한다. 매분20초이며 과거 실행 보충은 없다.
5. `journalctl -u blariyo-auto-publish.service`에서 `SOURCE_AUTO_PUBLISH` 결과/사유별 건수와 DB의 분류/명령/실제 게시글을 함께 확인한다. 프로세스 exit0만으로 발행 성공을 판단하지 않는다.

- 예약 글 `posts:publish-due`는 수집 자동 발행을 하지 않는다. 전용 `collection:auto-publish`는 기본 최대20건 분류/5건 접수, `--limit=1..20`으로 접수 한도를 지정한다. dry-run의 limit은 새 후보 조회 한도이며 이미 접수된 미완료 AUTO는 포함하지 않는다. 모든 작업은 읽기 전용이다.
- AUTO의 OS lock은 `/run/blariyo-auto-publish.lock`이며 예약 발행/outbox/cleanup lock과 분리한다. DB session lock은 중복 AUTO 실행을 막는다.
- 중단은 `systemctl disable --now blariyo-auto-publish.timer`로 다음 실행을 막고, 특정 출처 OFF로 최종 발행을 차단한다. 진행 중 transaction의 commit 여부는 실제 DB로 확인한다. 이미 발행한 글은 유지한다.
- 분류 보류 글은 사람 검수 대상이다. 이미지의 의미와 다른 제목의 같은 소재까지 분류하지 못한다.
