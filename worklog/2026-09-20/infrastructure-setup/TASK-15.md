# TASK-15 — 서버 앱 보관 완료와 Nginx 연결 구성 검사

- 기록일: 2026-09-20, KST
- 이전: [서버 보관 도구](TASK-14.md)
- 상태: **서버 앱 보관 사용자 PASS·읽기 전용 재확인. Nginx 로컬 격리 검사 PASS. 앱 기동·공개 연결 전**

## 서버 보관 결과

사용자가 `stage-blariyo-application.py --host 13.124.55.99 --stage` 성공 결과를 제공했다.
설치 폴더는 `/opt/blariyo/application/release-56351a45eea650c0f02e5043`이다.
archive 크기·SHA-256, amd64 Web/Core image, Compose 구문, UID 1000 secret 읽기 PASS.

추가 SSH 읽기 전용 확인:

- stage 표시 `STAGED_NO_SERVICES`, servicesStarted=false, gatewayConnected=false.
- api.env·web.env root 소유 600, secret 두 파일 UID 1000·600 확인. 비밀 원문 비출력.
- DB healthy, cloudflared 실행 중. 앱 서비스는 아직 기동하지 않았다.

## 메일 설정 재질문 정정

사용자는 메일 설정이 이미 완료됐다고 재확인했다. 연락처 입력과 설정 작업을 다시 요구하지 않는다.
기존 private public-contact.json을 재사용한다. 이번 확인으로 계약 법인·수신 경유 유형을 새로
추정하거나 법무 초안의 미확정 정보를 확정한 것은 아니다. 기록·정책 파일에 실제 주소를 복사하지 않았다.

## Nginx 준비

[Gateway 설명](../../../deploy/gateway/README.md),
[Compose](../../../deploy/gateway/compose.yaml),
[Nginx 설정](../../../deploy/gateway/nginx.conf),
[검사 코드](../../../deploy/gateway/test-gateway.py)를 추가했다.

공식 stable-alpine image를 조회·내려받아 nginx/1.30.5·amd64를 확인했다.
사용 digest: `sha256:ef8676b33d681f272ba429b27658bdd7e640963279714c96bddf1dc76307f7b6`.

Web 전용 upstream, 내부 경로 차단, Host 제한, query·JWT·Cookie 전달, 임의 forwarded IP 제거,
Docker DNS 재조회, 비루트·read-only·64MiB 구성을 준비했다. 실제 Access 검증은 Web에 유지한다.
로그는 raw 요청 정보 대신 고정 분류·상태·시간을 남긴다. 상세 raw error log 제한과 보존 기간
미구현은 gateway 설명에 명시했다. 기존 앱 release·운영 설정·메일 설정은 변경하지 않았다.

## 검증

실제 Nginx와 합성 Web을 별도 Docker network에서 검사했다.

- Nginx 문법, UID 101, read-only root, memory 한도, 테스트 edge만 연결 PASS.
- 공개·정책·관리자 경로 전달, 합성 무인증 401, 내부 경로 404, 다른 Host 421 PASS.
- URL·query·JWT·Cookie 전달, HTTPS header, 임의 forwarded IP 제거 PASS.
- 1MiB POST 내용 일치, 101MiB 상한 초과 Content-Length 413 PASS.
- Web 주소 변경 후 gateway 재시작 없이 새 Web 응답 PASS.
- 합성 query·Cookie·JWT·IP의 access 로그 비노출, 임시 자원 정리 PASS.

첫 검사는 자동 할당 subnet에서 테스트용 정적 IP를 지정해 Docker에 거부됐다. 앱 설정 문제는
아니며 테스트의 IP 점유 container를 자동 할당으로 수정했다. 수정 후 실제 새 IP 여부를 확인하고
전체 검사를 다시 통과했다. 실패 실행과 성공 실행의 임시 자원 모두 정리했다.

앱 production 기동, 실제 Access 로그인, Nginx 서버 설치, Tunnel route 변경, 전체 공개 요청,
2GB 부하, 14일 로그 보존, 원격 백업은 이번 검사 범위가 아니다. 기존 정책 필수 검사를 우회하거나
초안을 운영 DB에 발행하지 않았다. Git commit/push 없음.
