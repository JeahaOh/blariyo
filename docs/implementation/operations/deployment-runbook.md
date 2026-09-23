# 실서버 배포 실행서

기준: 2026-09-20. 실행 위치는 별도 표시가 없으면 저장소 루트의 **맥 터미널**이다.
현재 운영 배포 성공은 [TASK-19](../../../worklog/task-list/09/20/infrastructure-setup/TASK-19.md)에 기록돼 있다.
기존 문서에는 설치 도구별 설명이 있었지만, 최초 설치부터 재배포·복구까지 연결한 실행서는 없었다.
이 문서는 그 순서와 적용 한계를 통합한다. 오늘의 로컬 수정으로 운영 서버를 다시 배포한 것은 아니다.

## 1. 대상과 보관물

| 항목 | 현재 확인된 값·위치 |
| --- | --- |
| SSH | `ubuntu@13.124.55.99`, `ip-172-26-1-91`, 서울 Lightsail 2GB x86_64 |
| DB | `/opt/blariyo/postgresql`, Compose project `blariyo-db`, volume `blariyo-db_pgdata` |
| 앱 | `/opt/blariyo/application/release-56351a45eea650c0f02e5043`, project `blariyo-app` |
| gateway | `/opt/blariyo/gateway`, project `blariyo-gateway` |
| 운영·백업 | `/opt/blariyo/operations`, `/opt/blariyo/backup` |
| image archive | `~/task_list/blariyo-app-images-20260920T005324Z-rhn14v8g`, manifest와 SHA-256 포함 |
| runtime 입력 | `~/.config/blariyo/application-config-W8Wwp5`, env 2개·읽기 전용 secret 2개 |
| 초기 상태 증거 | TASK-19: 정책 v0.1, HTTPS·Access 경계·백업 복원 확인 |

공인 IP는 고정하지 않았다. 중지/시작이나 서버 교체 후 Lightsail 콘솔에서 주소를 확인하고
SSH host key·도구의 대상 hostname을 대조한다. `remote.py`와 일부 초기 도구의 IP/release는
고정값이므로 **새 서버에 그대로 실행하는 범용 설치기는 아니다**. host key 확인을 끄지 않는다.
Tunnel은 공인 IP 대신 기존 터널에 연결되므로 IP가 바뀌었다는 이유로 DNS를 새 IP로 바꾸지 않는다.

Node 24.18.0, Python 3, Docker/Compose, 기존 SSH 키와 비공개 입력이 필요하다.
비밀값은 이 문서에 없다. env는 Compose raw 형식이며 shell `source`로 읽지 않는다.
전체 `docker inspect`나 `docker compose config` 출력은 비밀을 포함할 수 있어 사용하지 않는다.

## 2. 최초 설치 때 수행한 순서

아래는 **최초 배포 재현을 위한 순서**다. 이미 가동 중인 서버에 초기 설치를 반복하지 않는다.
새 인스턴스는 먼저 도구의 대상 identity·경로·archive를 갱신하고 격리 검사를 해야 한다.

1. [DB 설치](../../../deploy/postgresql/README.md): 역할별 비밀번호 준비 후 설치.

   ```sh
   python3 deploy/postgresql/install-from-mac.py --host 13.124.55.99 --install-db
   python3 deploy/postgresql/migrate-from-mac.py --host 13.124.55.99 --apply
   ```

   DB healthy, host port 없음, 역할 3개, V001–V005 checksum과 app/backup 권한까지 확인한다.
   초기 migration 도구는 앞으로 생길 모든 migration의 범용 배포기가 아니다.

2. [앱 입력과 image](../../../deploy/application/README.md) 준비·격리 검증·서버 보관.

   ```sh
   node deploy/application/prepare-runtime-config.cjs --create
   python3 deploy/application/prepare-images.py --build
   python3 deploy/application/stage-from-mac.py --host 13.124.55.99 \
     --images /검증된/image-묶음 --config /검증된/runtime-묶음 --stage
   ```

   마지막 두 경로는 생성 결과의 실제 절대경로로 바꾼다. stage는 전송·해시·소유권·구문 검사만 한다.
   image와 설정 보관 성공은 앱 기동 성공이 아니다. build는 맥 또는 CI에서 하고 서버에서 하지 않는다.

3. [gateway 설치](../../../deploy/gateway/README.md)로 edge network와 Nginx를 준비한다.

   ```sh
   python3 deploy/gateway/install-from-mac.py --host 13.124.55.99 --install
   ```

4. 확정된 정책 v0.1을 실제 `policies:publish` 경로로 발행한다.

   ```sh
   python3 deploy/application/publish-policies-from-mac.py --apply
   ```

   이 도구는 최초 확정본·시행일 guard를 가진다. 새 배포 때 정책 발행을 반복하지 않는다.
   SQL로 DRAFT를 EFFECTIVE로 바꾸거나 이미 발행한 본문을 덮어쓰지 않는다.

5. 기간별 로그 수신기·AppArmor 설정을 설치하고 production logging override로 앱을 기동했다.
   다음 Python은 repo 파일을 JSON stdin으로 전달하며 secret을 출력하지 않는다.

   ```sh
   python3 - <<'PY'
   from pathlib import Path
   import json, subprocess
   base = Path('deploy/operations')
   names = ['rsyslog.conf', 'expire-logs.py', 'blariyo-logs.service',
            'blariyo-log-retention.service', 'blariyo-log-retention.timer', 'rsyslog-apparmor']
   subprocess.run(['python3', str(base/'remote.py'), str(base/'install-server.py')],
       input=json.dumps({n:(base/n).read_text() for n in names}).encode(), check=True)
   subprocess.run(['python3', str(base/'remote.py'), 'deploy/application/start-server.py'],
       input=json.dumps({'app':Path('deploy/application/production-logging.yaml').read_text(),
                         'gateway':Path('deploy/gateway/production-logging.yaml').read_text()}).encode(), check=True)
   subprocess.run(['python3', str(base/'remote.py'), str(base/'install-jobs-server.py')],
       input=json.dumps({n:(base/n).read_text() for n in ['run-job.py','start-application.py']}).encode(), check=True)
   PY
   ```

   초기 helper는 기존 파일과 다른 입력을 거부한다. 기존 설정을 덮어쓰는 도구가 아니다.

6. 기존 cloudflared container를 `blariyo-app_edge` network에 추가 연결했다.
   Cloudflare Tunnel의 공개 hostname은 `blariyo.com`, `www.blariyo.com`이고 service는
   `http://nginx:8080`이다. www는 Nginx에서 대표 도메인으로 308 이동한다.
   DNS는 각 hostname을 기존 터널의 `<TUNNEL_ID>.cfargotunnel.com`에 proxied CNAME으로 연결했다.
   `<TUNNEL_ID>`는 계정의 기존 터널 ID를 확인해 사용하며 임의 생성하지 않는다.
   MX/TXT·media R2 연결은 유지했다. HTTPS 강제·TLS 1.2 이상, 관리자 Access 경로를 확인했다.
   cloudflared를 새로 만들 때 edge 연결도 다시 적용해야 한다. 기존 토큰을 출력하거나 새 터널을 만들지 않는다.

7. `python3 deploy/backup/install-from-mac.py`로 암호화 백업·timer를 설치하고 실제 R2 다운로드·격리 복원을 확인했다.
   [백업 문서](../../../deploy/backup/README.md)에 복구키 보관과 반복 검증 범위가 있다.

8. `python3 deploy/application/check-public.py`와 아래 운영 확인을 수행했다.

## 3. 현재 release 재기동

아래는 **서버 터미널**에서 실행한다. 새 버전 배포가 아니라 현재 설치된 앱을 복구하는 명령이다.

```sh
sudo systemctl restart blariyo-application.service
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo systemctl status blariyo-application.service blariyo-logs.service --no-pager
sudo systemctl list-timers 'blariyo-*' --no-pager
```

현재 부팅 helper `start-application.py`는 최초 release를 고정 참조한다. 다른 release를
임시로 띄운 뒤 이 helper를 바꾸지 않으면 재부팅 때 옛 release로 돌아갈 수 있다.

## 4. 이후 재배포 순서

권장 정책은 [배포 정책](deployment-policy.md)이다. 현재 **자동 CD는 미구현**이다.
GitHub의 검증된 main image 또는 맥의 검증된 archive만 배포 후보로 선택한다.

보안 설정의 적용 시점은 [현재 설정 유지·다음 배포 구분](security-protection-status.md#8-현재-설정-유지와-다음-배포의-구분)을 따른다.
운영에 적용된 Nginx 오류 `no-store`와 기존 Cloudflare 캐시·알림은 유지한다. 앱 원본 JSON 오류의
`no-store` 보완은 소스·로컬 build/HTTP 회귀 검사까지 완료했고 운영 배포는 대기 중이다.
다음 후보에서 `npm run test:web-cache`를 실행하고 배포 후 원본·공개 응답을 확인한다.
정상 이용을 위한 완화 기준을 이유로 새 요청 제한을 자동 활성화하거나
기존 인증·서버 격리를 해제하지 않는다.

2026-09-23 [Core 로컬 배포 후보](../m0-interim-2026-09-23/release-candidate.md)는 수집 OFF·DB V005 유지의
호환성을 확인했다. V008로 올린 DB에서 기존 9월 20일 API는 readiness 503이므로, 이번 Core 배포를
자동 migration과 묶지 않는다. 아래 순서는 실제 ledger/checksum·최종 CI·운영자 인수 확인 뒤에만 적용한다.

1. 기존/후보 release 경로·image digest·설정 ID·Git SHA·migration 차이를 기록한다.
2. 새 입력과 이미지를 stage한다. GHCR을 쓰면 먼저 digest로 pull한다. Compose의 `pull_policy: never` 때문에
   `up`이 image를 자동 다운로드하지 않는다. `images.env`에는 실제 로컬에서 확인한 digest 참조를 넣는다.
3. 서버에서 `sudo systemctl start blariyo-backup.service` 후 성공 시각·manifest·다운로드 검증 결과를 확인한다.
4. publish/outbox/cleanup timer를 멈추고 실행 중 service 종료를 확인한다. backup/log timer는 유지한다.
   DB 변경이 있다면 기존/신규 앱과 모두 호환되는지 검사한 전용 절차로 migration을 적용한다.
   초기 `migrate-from-mac.py`를 후속 migration의 대용으로 쓰지 않는다.
5. 새 release에 검토한 `production-logging.yaml`을 root 600으로 준비하고 서버에서 순차 교체한다.

   ```sh
   # NEW_RELEASE는 stage 출력의 실제 절대경로. 아래 예시를 그대로 실행하지 않는다.
   NEW_RELEASE=/opt/blariyo/application/release-검증된식별자
   sudo docker compose --env-file "$NEW_RELEASE/images.env" \
     -f "$NEW_RELEASE/compose.yaml" -f "$NEW_RELEASE/production-logging.yaml" config --quiet
   sudo docker compose --env-file "$NEW_RELEASE/images.env" \
     -f "$NEW_RELEASE/compose.yaml" -f "$NEW_RELEASE/production-logging.yaml" \
     up -d --no-deps --wait --wait-timeout 180 api
   sudo docker compose --env-file "$NEW_RELEASE/images.env" \
     -f "$NEW_RELEASE/compose.yaml" -f "$NEW_RELEASE/production-logging.yaml" \
     up -d --no-deps --wait --wait-timeout 180 web
   ```

   각 명령이 실패하면 다음 단계로 진행하지 않는다. project 이름은 `blariyo-app`을 유지한다.
   `down -v`는 실행하지 않는다. DB·Tunnel·DNS를 일반 코드 배포마다 다시 만들지 않는다.
6. 아래 smoke 통과 후 `/opt/blariyo/operations/start-application.py`의 release 참조를 새 경로로 갱신하고
   이전 파일을 보관한다. repo의 부팅 helper와 운영 기록도 같은 경로로 갱신한다.
   현재는 수동으로 검토·갱신하는 단계이며 자동 전환 도구가 구현된 것으로 보지 않는다.
7. timer 3개를 다시 시작하고 작업 성공·로그·자원을 확인한다. 실패 시에도 timer를 멈춘 채 방치하지 않는다.
8. 별도 [정적 자산 캐시 적용 기록](security-protection-status.md)의 경로 목록을 새 빌드와 대조한다.
   신규 JS/CSS의 원래 URL·쿼리 변형 응답 해시와 Cache-Control을 확인한다. 현재 9개 규칙을 유지하는
   동안 신규 파일명 반영은 별도 관리 작업이다. 경로 규칙으로 전환해 검증한 뒤에는 매 배포마다
   파일명을 열거하지 않아도 된다. 관리 접근이 없어 미반영이면 새 자산의 쿼리 분산 방지 미적용을
   배포 기록에 남기며, 새 자산의 기본 CDN 제공과 구분한다. 일반 배포마다 전체 캐시를 purge하지 않는다.
   HTML/API/관리자 응답을 immutable 캐시에 포함하지 않는다. 이미 열린 구 버전 탭의 lazy chunk를
   지원할 구 자산 보관 경로는 현재 미구현이므로, 단순 컨테이너 교체에서 구 탭의 추가 탐색 실패가
   가능하다. 이 한계를 해소하기 전에는 무중단이라고 보고하지 않는다.

### 배포 성공 기준

- Core 내부 readiness와 Web liveness가 정상, DB/Core/Web/Nginx healthy·OOM 없음·host port 없음.
- `/meme`, `/terms`, `/privacy`, `/health/live` HTTPS 정상. www/HTTP redirect와 공개 상세 정상.
- 익명 관리자 경로는 Access로 이동, 실제 운영자 MFA 후 작성·이미지 업로드·발행·숨김 정상.
- 게시글이 없으면 상세·쓰기 검증은 미검증으로 기록한다. Access 302만으로 관리자 작업 성공이라 하지 않는다.
- 새로운 image digest와 부팅 복구 대상 일치, timer 재개·백업·로그 확인.
- 기존 Nginx 오류 캐시 금지 유지, 공개 HTML/JSON 404 `no-store`, 정상 JS/CSS 해시·캐시 정책 확인.
  원본 JSON 오류 보완을 포함한 배포라면 Web 직접 응답도 `no-store`인지 별도 확인한다.

## 5. 실패 시 복귀

새 앱이 실패하면 새 기능의 쓰기를 중지하고 **이전 release 경로**로 4절의 Compose 순차 교체를 수행한다.
DB가 이전 앱과 호환되는 경우에만 앱 rollback을 실행한다. 부팅 helper도 이전 경로로 되돌린다.
DB 비호환·데이터 훼손은 자동 역 migration이나 volume 삭제로 처리하지 않는다. 사전 백업을 격리 DB에
복원·검증한 뒤 복구 범위와 이후 생성 데이터 처리 방법을 결정한다.

운영 배포 성공을 현재 시점에 다시 확인하려면 읽기 전용 smoke와 서버 상태를 새로 확인해야 한다.
이번 문서 현행화는 기존 배포 증거와 실제 도구를 대조한 것이며 신규 재배포·VM 재부팅 검증은 아니다.
