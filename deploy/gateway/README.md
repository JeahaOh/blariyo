# Nginx gateway 준비

현재 상태는 **로컬 격리 검사와 실제 서버 Nginx 기동 완료, 앱 기동·Tunnel 연결 전**이다. 기존 application release의
Compose와 비공개 입력을 수정하지 않고 `blariyo-gateway` project를 별도로 준비한다.

- [Compose](compose.yaml): nginx 1.30.5 Alpine 공식 image를 조회한 digest로 고정, linux/amd64,
  UID/GID 101, read-only filesystem, 64MiB memory, 96MiB memory+swap, 임시 공간 16MiB.
- [Nginx 설정](nginx.conf): Docker edge network의 `web:3000`으로만 전달한다. host port는 없다.
  `api`·DB network에 연결하지 않는다. 기존 `blariyo-app_edge` network가 먼저 필요하다.
- Host `blariyo.com`만 허용하고 다른 Host는 421, `/internal`·하위 경로는 404로 응답한다.
  `/__gateway_health`는 gateway 프로세스 확인용이며 Web·Core 정상 여부를 증명하지 않는다.
- 원래 요청 경로·query·Cookie·Access JWT를 Web에 전달한다. 관리자 인증은 Web의 JWT 검증을
  그대로 사용한다. HTTPS와 canonical host를 명시하고 임의 X-Forwarded-For·Forwarded는 제거한다.
- CF-Connecting-IP는 전달하되 Web 설정에서 신뢰를 켜기 전에 origin 직접 접근 차단과 실제
  cloudflared 경로를 확인해야 한다. 이번 준비는 기존 Web 설정의 빈 trusted IP header를 바꾸지 않는다.
- body 상한 101MiB는 현재 Web 업로드 상한과 맞췄다. 요청·응답을 streaming하여 Nginx가 대용량
  파일 전체를 버퍼링하지 않게 했다. 앱의 파일별 크기 검사와 메모리 한도 검증은 별개다.
- Docker DNS `127.0.0.11`을 통해 고정된 `web` 이름을 재조회한다. 요청자가 upstream을 정하지 못한다.
  Web 교체 시 잠깐의 502는 가능하며 블루그린 무중단 배포를 뜻하지 않는다.

## 로그 경계

access JSON에는 생성한 request ID, 고정 경로 분류, HTTP 상태, 소요 시간, upstream 상태만 남긴다.
raw URL·query·Cookie·JWT·IP는 기록하지 않는다. raw Nginx error log에는 요청 원문이 포함될 수
있어 이 준비물은 `emerg` 수준만 stderr로 보내고 요청 실패는 access 상태 코드로 관측한다.
따라서 상세 upstream 오류 원인이 로그에 없을 수 있으며 적용 전에 운영 진단 절차를 함께 정해야 한다.
Compose의 10MiB × 3개 rotation은 **용량 제한**이다. 설계의 14일 보존·삭제가 구현됐다는 뜻은 아니다.

## 검사

```sh
python3 deploy/gateway/test-gateway.py
```

Docker가 실행 중이어야 하며 TASK-13의 amd64 API image를 합성 Web 실행기로 사용한다.
운영 설정·JWT·R2·DB를 사용하지 않는다. Nginx image가 로컬에 없으면 공식 registry에서 내려받는다.
임시 network, 합성 Web, gateway를 만들고 검사 시에만 `127.0.0.1` 임의 포트를 열어 정리한다.

검사 범위:

1. 설정 문법, 비루트 실행, read-only root, memory 한도, 테스트 edge만 연결.
2. 공개·관리자 경로 전달, **합성 Web**의 무인증 401 보존, JWT/Cookie 전달, 잘못된 Host·내부 경로 차단.
3. 1MiB POST 내용 전달, 상한 초과 Content-Length 413, URL·query 보존, forwarded header 처리.
4. Web IP를 실제로 바꾼 뒤 Nginx 재시작 없이 재연결.
5. 합성 민감값이 로그에 없는지 확인, 임시 container·network 정리.

이 검사는 실제 Cloudflare Access 로그인이나 production Web 기동을 증명하지 않는다.

## 서버 적용 순서

[맥 설치 도구](install-from-mac.py)와 [서버 코드](install-server.py)를 통해 Nginx를 설치한다.

```sh
python3 deploy/gateway/install-from-mac.py --host 13.124.55.99 --install
```

`--install`이 없으면 로컬 파일·SSH key 검사만 한다. 현재 설치 도구는 확인된
`/opt/blariyo/application/release-56351a45eea650c0f02e5043`을 대상으로 한다.
서버 identity·DB health·앱 image 참조·host port 없음·기존 파일을 확인하고, Web은
`compose up --no-start --no-deps`로 **생성만** 하여 Compose 소유의 edge network를 준비한다.
`/opt/blariyo/gateway`에 config를 설치한 후 고정 digest image pull·`nginx -t`·Nginx 기동과
health·UID·memory·port·network를 확인한다. 기존 파일 내용이 다르면 덮어쓰지 않고 거부한다.
운영 설정·정책 DB·기존 Tunnel route는 변경하지 않는다. 앱이 이미 실행 중인 환경은 재검토하도록 거부한다.

2026-09-20 실제 서버에서 Nginx healthy, Web created(미기동)를 확인했다.
완료한 application release의 설정·image는 유지한다. 다음 작업은 정책 발행 조건을
충족한 앱 기동과 Nginx→Web 내부 응답 확인이다.
그 뒤 기존 cloudflared를 `blariyo-app_edge`에 연결하고 Tunnel의 서비스 주소를 `http://nginx:8080`으로
전환한다. 현재 대시보드 route를 읽어 대조하고, 기존 주소를 기록한 뒤 적용해야 한다.
이 문서의 주소는 **예정값**이며 실제 Tunnel 설정을 조회하거나 변경한 결과가 아니다.

공개 후 실제 Access 허용/거부·정책 화면·이미지·IP 처리와 2GB 서버 부하를 확인한다.
Nginx 자체의 healthy 상태를 전체 앱 정상 또는 공개 서비스 준비 완료로 사용하지 않는다.

근거: [Nginx proxy 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[Docker DNS](https://docs.docker.com/engine/network/#dns-services),
[공식 Nginx image](https://hub.docker.com/_/nginx).
