# TASK-13 — 운영 입력 생성 확인과 amd64 Web·Core image 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [운영 입력·앱 Compose 준비](TASK-12.md)
- 상태: **사용자 운영 입력 생성 PASS. 로컬 image build·격리 통합·archive 검증 PASS. 서버 배포 대기**

## 사용자 실행 결과

사용자가 `prepare-blariyo-runtime-config.cjs --create` 결과를 제공했다. 파일 권한·키 분리·실제 앱
파서 검사 및 새 `application-config-W8Wwp5` 폴더 생성이 PASS다. 원문·키·연락처는 기록하지 않는다.
이 결과는 로컬 준비이며 운영 로그인·정책 발행·서버 기동을 증명하지 않는다.

## 이번 준비

- [image 도구](../../../../../deploy/application/prepare-images.py)와 사용자 진입점
  `/Users/zeaha/task_list/prepare-blariyo-images.py`를 만들었다.
- 224개 source 파일을 별도 snapshot에 복사해 linux/amd64 API·Web image를 build했다.
  Git HEAD는 `6cb7918808def09556eb6bead8fbfa9cedb3525a`, dirty=true이며 source hash를 별도 기록했다.
- `.dockerignore`에 하위 `.env`·PEM/key·dist/dist-test 제외를 추가했다. snapshot 선정에서도
  해당 비밀 파일·생성물·symlink를 거부한다. 홈의 운영 입력 파일은 build에 읽거나 주입하지 않았다.
- [Docker 통합 검사](../../../../../scripts/test-docker.ts)에 immutable image ID 입력을 추가해,
  export할 image를 그대로 검사하도록 했다. 기존 기본 build 방식과 자원 정리 범위를 유지한다.
  전달받은 image는 검사 도구가 삭제하지 않는다.

## 최종 산출물

- 폴더: `/Users/zeaha/task_list/blariyo-app-images-20260920T005324Z-rhn14v8g`
- archive: `images.tar`, 162,812,416 bytes, 약 155MiB
- archive SHA-256: `9820174a2b8c5afea126e8519b541d2e812b75f87e257126a75f1f7ce9882ac9`
- source SHA-256: `9990b055330dace4faaa2cf05d340205280671ad10ec4e3862f6d0745974c914`
- API tag: `blariyo-api:candidate-20260920t005324z-9990b055330d-rhn14v8g`
- Web tag: `blariyo-web:candidate-20260920t005324z-9990b055330d-rhn14v8g`
- local image ID·config digest는 폴더의 `manifest.json`에 각각 기록했다.

초기 실행의 `20260920T005129Z-jqc_0wnp` 폴더는 archive 검사에서 중단됐고 완료 manifest가 없다.
Docker containerd가 OCI index digest를 image ID로 표시하는데 config digest와 직접 비교하던
검증 오탐을 수정했다. 검사를 생략하지 않고 index→amd64 manifest→config의 해시 연결을
검증하도록 고쳤으며, 수정 도구로 새 묶음을 처음부터 준비해 통과했다. 중단 결과는 임의 삭제하지 않았다.

## 검증

1. Web·Core amd64 build, Node 24.18.0·x64·UID 1000 실행 PASS. Core Sharp PNG 생성 PASS.
2. 최종 image ID를 이용한 격리 Docker 통합 PASS:
   - production Web·Core·PostgreSQL, 합성 정책 조회, 서명된 합성 Access 인증
   - 관리자 무인증 차단, 게시글 생성·발행·숨김과 공개 상세 상태
   - 예약 발행·outbox·cleanup 명령, 가짜 provider 호출 관측
   - DB custom dump·별도 DB restore·readback
   - liveness/readiness, maintenance API/CLI 거부, SIGTERM·DB 연결 해제
3. [archive/source 부정 입력 회귀](../../../../../deploy/application/test-images.py) 8개 PASS:
   파일 변형, 다른 architecture/ID, 누락 완료 표시, 변경 source manifest, symlink,
   private source, classic 및 containerd OCI 연결과 잘못된 config 연결.
4. scripts TypeScript 검사·수정한 Docker 검사 스크립트 ESLint PASS.
5. 최종 묶음 `--verify` PASS. Python 구문·CLI help, 문서 상대 링크·공백·`git diff --check` 확인.

## 다음 연결 작업과 경계

다음 단계는 이 image·운영 입력 묶음을 사용하는 서버 설치 도구, Nginx→Web 경로와 기존 Tunnel
연결을 준비하는 것이다. 실제 실행 전 정책 확정·발행과 secret UID/GID를 확인해야 한다.

이번 검사는 production 모드를 쓰는 **합성 로컬 환경**이다. 실제 운영 DB·정책·R2·Access 로그인,
production Compose 자원 제한·read-only root filesystem, 서버 부하·배포·원격 백업은 미검증이다.
서버·DB·Cloudflare를 변경하지 않았고 registry push·Git commit/push도 하지 않았다.
현재 설계는 API·Web 순차 교체이며 블루그린 무중단 배포를 구현한 것이 아니다.
