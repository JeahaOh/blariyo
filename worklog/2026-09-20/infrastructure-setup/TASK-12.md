# TASK-12 — Web·Core 운영 입력 분리와 앱 계층 Compose 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [간결한 정책 초안과 검토 도구](TASK-11.md)
- 상태: **운영 입력 읽기 전용 검사·합성 설정 격리 검사 PASS. 개인 보관 묶음 생성·image·앱 기동·배포 대기**

## 작업 범위

사용자가 다음 작업 진행을 요청했다. 정책 초안을 임의 승인하지 않고 독립적으로 진행 가능한
Web·Core 실행 입력을 준비했다. 기존 2GB Lightsail·PostgreSQL·Tunnel·고정 IP 미사용 선택을 유지한다.

## 변경

- [준비 도구](../../../deploy/application/prepare-runtime-config.cjs): 기존 R2·캐시·Access·
  내부 인증·연락처·운영자·app DB 비밀번호 입력을 검사한다. 기본은 읽기 전용이며 `--create`는
  새 `application-config-*` 폴더에 api.env·web.env·secret 파일 2개·Compose·준비 표시를 만든다.
- [앱 Compose](../../../deploy/application/compose.yaml): Web 384MiB·Core 256MiB, amd64,
  UID/GID 1000, 읽기 전용 root filesystem·mount, host port 없음, 기존 data network 참조.
- Web에는 R2·DB·캐시 키를 넣지 않고 Core에는 Access·actor 키를 넣지 않는다. DB migration/backup
  비밀번호는 읽지 않는다. R2 backup 키·관리 API 토큰은 출력하지 않는다.
- Core 4000과 Web coreOrigin을 맞췄다. Web production readiness의 관리자 인증을 유지하며
  Docker는 Web liveness와 Core readiness를 검사한다. 새 설정의 실제 앱 기동은 미검증이다.
- [인프라 정본](../../../docs/system-design/04-infrastructure-design.md)에 수집 사이트 outbound와
  Access/R2/캐시 provider 통신의 구분, 준비물의 범위를 반영했다.

## 검증 증거

1. 실제 로컬 입력에 **쓰기 없이** 준비 도구 실행 PASS. 원문·연락처·키는 출력하지 않았다.
   실제 앱의 DB 설정·R2 adapter 생성·LEGAL_CONFIG·운영자 파서를 호출했고 외부 API는 호출하지 않았다.
2. [합성 격리 검사](../../../deploy/application/test-runtime-config.cjs) PASS:
   폴더 700·파일 600, 재실행 보존, 키 분리, DB 상위 권한 파일 미사용, 잘못된 키·endpoint·권한·
   symlink·중복 항목 거부, Compose network·mount·포트·자원 기준 확인.
3. Docker Compose 2.34.0에서 구문 검사, raw 환경값의 따옴표·달러·역슬래시 보존 확인.
   `compose config`의 재입력용 `$$` 이스케이프를 반영한 비교와 별도로, network none의 일회성
   Node container에 실제 전달된 합성 문자열을 확인했다. 이것은 Web·Core 운영 기동 검사가 아니다.
4. Node 구문·CLI help, 변경 문서 상대 링크, `git diff --check`를 확인했다.

## 다음 실행

```sh
/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node /Users/zeaha/task_list/prepare-blariyo-runtime-config.cjs --create
```

생성 위치만 결과에 출력되므로 파일 본문은 공유하지 않는다. 이 명령은 서버에 연결하지 않는다.
이후 image 고정·서버 secret UID 확인·정책 발행·Nginx/Tunnel 연결을 준비하고 실제 기동을 검사한다.
신뢰 IP 헤더·관리자 로그인·업로드·전체 앱 동작·부하·R2 원격 백업은 별도 검증 대상이다.

실제 개인 보관 파일을 새로 쓰거나 서버·DB·Cloudflare 설정을 변경하지 않았다. 기존 Git 변경을
보존했고 commit·push는 하지 않았다. 정책 검토본의 사용자 실행·승인·발행도 확인되지 않았다.
