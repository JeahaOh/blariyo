# TASK-16 — 실제 서버 Nginx 설치·기동과 공개 전 잔여 확인

- 기록일: 2026-09-20, KST
- 이전: [서버 앱 보관·Nginx 격리 검사](TASK-15.md)
- 요청: 계속 진행, 잔여 작업과 실제 서버 배포 시점 설명.
- 상태: **실제 서버 Nginx healthy. Web 생성·미기동, Core 미기동, 유효 정책 0개. 공개 연결 전**

## 실제 적용

[맥 설치 도구](../../../../../deploy/gateway/install-from-mac.py),
[서버 코드](../../../../../deploy/gateway/install-server.py)를 만들고 다음 명령을 실제 실행했다.

```sh
python3 deploy/gateway/install-from-mac.py --host 13.124.55.99 --install
```

서버 hostname·x86_64·DB healthy·보관 앱 image 참조·host port 없음과 파일 권한을 먼저 확인했다.
기존 application release 파일을 유지하고 `/opt/blariyo/gateway`에 Compose와 Nginx 설정을 설치했다.
정책과 무관하게 설치할 수 있는 gateway만 실제 기동했다. 기존 DB·Tunnel·공개 route는 변경하지 않았다.

Web은 Compose의 `up --no-start --no-deps`로 생성만 했다. app용 network는 해당 project가
생성·관리한다. Core를 시작하거나 합성 정책을 운영 DB에 넣지 않았다. 고정 digest의 amd64 Nginx
image를 내려받아 `nginx -t` 후 기동했다. Nginx 내부 health 응답 `UP`과 container healthy를 확인했다.

첫 실행은 `compose create`에 지원되지 않는 `--no-deps` 옵션을 사용해 중단됐다. 서버 설정 파일은
이미 설치됐지만 Web·Nginx 기동 전이었다. 공식 CLI help에서 `up --no-start --no-deps` 지원을 확인해
수정하고 기존 파일 일치 검사를 거쳐 재실행했다. 재실행과 최종 읽기 전용 조회가 통과했다.

## 최종 서버 readback

| 항목 | 관측 |
| --- | --- |
| `blariyo-gateway-nginx-1` | running, healthy, UID 101, memory limit 64MiB, read-only root, `blariyo-app_edge`만 연결 |
| `blariyo-app-web-1` | created, 프로세스 미기동, `blariyo-app_app`·`blariyo-app_edge` |
| `blariyo-db-postgresql-1` | running, healthy, `blariyo-db_data` |
| `quirky_hertz` | running, 기존 `bridge` |
| 위 container host port | 모두 없음 |
| 메모리 | total 1906MiB, used 602MiB, available 1304MiB, swap used 0MiB |

메모리는 앱을 켜기 전의 관측이며 전체 앱 용량 적정성·트래픽 수용을 증명하지 않는다.

DB는 `BEGIN READ ONLY` transaction에서 `legal.policy_version`의 현재 유효한 정책 종류 수만
조회했다. 결과는 **0**이다. 정책 본문·개인정보·비밀값을 출력하지 않았다. 실제 앱이 요구하는
약관·개인정보처리방침 2개가 아직 등록되지 않은 사실을 확인했다.

## 남은 작업

1. 정책 초안의 미확정 운영 정보를 해소하고 최종 약관·개인정보처리방침을 발행한다.
   단순 연락처·메일 재입력 단계가 아니다. 정책 문구의 미확정 조건을 임의 삭제하지 않는다.
2. Core→Web을 기동하고 readiness·정책·관리자 인증·Nginx 내부 응답을 확인한다.
3. 기존 Tunnel route를 확인한 뒤 edge 연결·`http://nginx:8080` 전환, 실제 도메인·Access·이미지 검사를 한다.
4. R2 암호화 백업·스케줄·복구 검사, 로그 보존·운영 관찰을 마친다.

이번에 수행한 실제 배포는 **gateway 설치·기동**이다. 사이트 공개 완료와 구분한다.
시행일·정책 조건이 미확정이므로 공개 완료 시각을 보장하지 않는다. Nginx healthy만으로 전체
서비스 준비 완료를 보고하지 않는다. 문서 상대 링크·Python 구문·`git diff --check` 확인, commit/push 없음.
