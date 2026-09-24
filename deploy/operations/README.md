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
