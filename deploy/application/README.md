# 앱 운영 설정과 배포

2026-09-20 Lightsail 운영 서버의 정책 발행·Web/Core 기동·공개 연결을 완료했다.
마지막 [9월 23일 운영 배포](../../worklog/2026-09-23/release/production-deployment-5c581c2.md)는
`5c581c2` GHCR API/Web image를 사용했고, [DB·콘텐츠 반영](../../worklog/2026-09-23/release/production-db-promotion.md)
후 release는 `release-5c581c2-db-v008-20260923`, API V008·Collector V006이다.
아래 준비 도구의 기본 false flag·9월 20일 archive/설정 ID는 **새 입력/최초 설치 문맥**이다.
9월 23일 운영 기록에서는 관리자 batch 검수만 API/Web에서 활성이고 URL·Discord 접수·자동 수집은 비활성이다.
[현재 운영 상태](../../docs/operations/current-status.md)와
[운영 명령](../operations/README.md)을 먼저 확인한다.

아래 절은 새 입력·image·release를 준비하는 단계별 도구 설명이다. 각 준비 도구가 앱을 기동하지
않는다는 설명과 현재 운영 서버가 이미 기동했다는 사실을 구분한다. 최초 배포를 다시 실행할 필요는 없다.

명령은 저장소 루트에서 Node 24.18.0을 선택한 뒤 실행한다. 아래는 저장소 정본 도구 경로이며,
과거 `~/task_list` 복사본의 최신성을 가정하지 않는다. image 준비 도구는 현재 홈의
`.nvm/versions/node/v24.18.0/bin/node`를 사용하므로 다른 장비에서는 이 전제부터 확인한다.

## Web·Core 운영 입력 묶음

기존 키·연락처를 재입력하지 않고 다음 명령으로 분리한다.

```sh
node deploy/application/prepare-runtime-config.cjs --create
```

[도구](prepare-runtime-config.cjs)는 `~/.config/blariyo`의 입력을 읽고 **새**
`application-config-*` 폴더를 만든다. `--create` 없이 실행하면 읽기 전용 검사만 한다.
로컬 저장소의 API build와 dependencies가 필요하다. 네트워크 요청·정책 발행·서버 작업은 없다.

| 출력 | 내용 |
| --- | --- |
| `api.env` | production Core, app DB 파일 경로, private/public R2 키, 캐시 삭제 키, 내부 서비스 키, 공개 연락처 |
| `web.env` | production Web, Access issuer·AUD, 운영자 파일 경로, 서비스 키·actor 키, 공개 연락처·확정 카피 |
| `secrets/app-password` | app 역할 비밀번호만 복사 |
| `secrets/admin-operators.json` | identity·operatorId·active만 복사 |
| `compose.yaml` | [앱 계층 Compose](compose.yaml) 사본. API/Web만 정의하며 image 지정은 필수 |
| `bundle.json` | 마지막에 기록하는 입력 준비 표시. `productionReady: false`; image·gateway 미포함 |

DB migration·backup 비밀번호는 읽거나 복사하지 않는다. R2 보관 파일의 backup 키와 관리
API 토큰도 출력 묶음에서 제외한다. 원본·기존 묶음은 유지하고 폴더 700·파일 600으로 저장한다.
새 폴더에 `bundle.json`이 없으면 쓰기 중 중단된 것이므로 배포 입력으로 사용하지 않는다.

환경 파일은 Docker Compose 2.30 이상에서 지원하는 `env_file.format: raw` 전용이다.
따옴표·`$`를 그대로 전달하므로 **shell의 `source`나 `export`로 읽지 않는다**.
일반 `docker compose config`는 비밀값을 펼쳐 출력하므로 사용자 입력 묶음에는 사용하지 않는다.
구문 확인이 필요하면 검증된 image 식별자를 별도로 지정하고 `config --quiet`만 사용한다.
근거: [Docker env_file](https://docs.docker.com/reference/compose-file/services/#env_file).

Compose는 Core 4000·Web 3000을 사용하며 host port를 열지 않는다. Core 256MiB·Web 384MiB,
비루트 UID/GID 1000, 읽기 전용 root filesystem, app DB와 운영자 파일의 읽기 전용 mount를
정의한다. DB는 기존 external network `blariyo-db_data`로 연결하며 새 DB를 만들지 않는다.
Web은 data network에 연결하지 않는다. `edge`·`app` bridge는 필요한 Access JWKS·R2·캐시
API outbound를 허용하지만 외부 목적지 allowlist를 구현한 것은 아니다.

서버 설치 도구를 만들 때 `api.env`·`web.env`는 root:root 600으로, `secrets`의 파일 2개는
**1000:1000, 600**으로 설치해야 한다. 로컬 파일을 그대로 전송하면 UID가 다를 수 있으므로
container가 실제로 읽는지 별도 확인한다. 로컬 생성 도구는 기존 파일의 소유권을 바꾸지 않는다.

### 신규 release 배포 시 확인할 연결 작업

- 검증된 linux/amd64 image와 digest를 정하고 `BLARIYO_API_IMAGE`·`BLARIYO_WEB_IMAGE`에 지정한다.
  현재 Compose는 server build·자동 pull을 하지 않는다.
- 최초 DB 설치 또는 승인된 새 정책 시행 때만 약관·개인정보처리방침을 발행한다. 일반 앱 재배포에서
  v0.1 발행을 반복하지 않는다. production Core의 정책 필수 검사는 우회하지 않는다.
- Nginx의 Web 전용 upstream·Tunnel 연결과 신뢰할 IP 헤더 경계를 검증한다. 이 준비 단계는
  `NUXT_TRUSTED_CLIENT_IP_HEADER`를 비워 두며 조회 수 집계와 실제 client IP는 이후 확인한다.
- Core readiness·Web liveness 외에 Access 인증을 거친 Web readiness, 관리자 로그인,
  공개 화면·정책·R2 업로드를 확인한다. Web `/health/ready`는 운영에서 인증이 필요하므로
  Docker healthcheck에는 `/health/live`를 사용한다. `healthy`만으로 전체 기능 정상 판정을 하지 않는다.

이 준비 도구가 생성하는 설정에서는 GA4·카카오 SDK·수집 flag가 비활성이다. 실제 9월 23일 운영의
batch 검수 활성화와 구분한다. 이 구성은 설계대로 API→Web을 순차 교체하는
방식의 준비이며 블루그린 무중단 배포를 구현한 것이 아니다. 적용 전 server 자원·업무 부하 검증이 필요하다.

격리 검사는 `node deploy/application/test-runtime-config.cjs`로 수행한다. Docker와 기존 검증용
로컬 image(`blariyo-api:db-init-20260920-a17c9e4b`)가 필요하다. 합성 설정과 별도 일회성 Node
container만 사용하며 운영 앱을 기동하거나 기존 DB/Tunnel network에 연결하지 않는다.

### Core 후보와 이전 이미지 호환 검증

`prepare-runtime-config.cjs`는 manual URL·Discord·batch review의 API/Web flag를 모두 명시적 false로 만든다.
기존 비공개 입력은 보존하며, 새 사본이 실제 서버의 신뢰 IP 헤더·mount·운영 설정과 일치하는지는 별도 대조한다.

[9월 23일 로컬 후보](../../worklog/2026-09-23/release/candidate.md)와
[호환 검사](test-release-compatibility.py)는 로컬의 두 immutable API image로 일회성 DB·network·미디어를 만들어
V005→후보 쓰기→이전 앱 복귀→V008→이전 앱 readiness 거부를 검사한다. 원격 DB·SSH·운영 입력을 사용하지 않는다.
V008에서 이전 앱 503을 정상 복귀로 보고하지 않는다. 해당 검사는 당시 V005 후보의 이력이며
현재 서버가 V005라는 뜻이 아니다. 현재 V008의 호환 image·설정은 새 후보마다 확인한다.

## Lightsail amd64 image 준비

[image 준비 도구](prepare-images.py)는 새 source snapshot에서 Web·Core를 build하고 동일한
image ID를 [격리 Docker 검사](../../scripts/test-docker.ts)에 전달한다. Docker가 실행 중이어야 하며
맥의 Node 24.18.0·저장소 dependencies와 빌드된 API 검사 모듈이 필요하다.

```sh
python3 deploy/application/prepare-images.py --build
```

`~/task_list/blariyo-app-images-<UTC 시각>-<구분값>/`에 다음 결과를 새로 보관한다.

- `source/`, `source-manifest.json`: build에 사용한 파일 사본, 파일별 SHA-256, 전체 source hash,
  Git HEAD·dirty 여부. 미커밋 변경을 포함하며 HEAD만으로 빌드 대상을 표시하지 않는다.
- `images.tar`: API·Web의 linux/amd64 image 2개. 운영 설정 묶음과 별도 보관한다.
- `api-build.log`, `web-build.log`, `docker-smoke.log`: 로컬 build·합성 설정 통합 검사 로그.
- `manifest.json`: 모든 검사와 archive 내부 연결 검증을 통과한 뒤 기록하는 완료 표시.
  archive SHA-256·크기, local image ID, config digest, 검증 범위와 미검증 항목을 담는다.

선정한 source만 build context에 복사하고 `.env`·키 파일·심볼릭 링크·로컬 build 산출물이
포함되면 거부한다. 홈의 운영 입력 파일은 읽지 않는다. API image 안에서 Node 버전·amd64·
UID 1000과 Sharp PNG 생성을 검사한다. 모든 이미지에 고유 candidate tag를 붙이며 기존
image·태그·컨테이너를 교체하지 않는다. Docker Hub/npm 의존성 다운로드가 발생할 수 있지만
registry push·SSH·Cloudflare 설정 변경은 하지 않는다.

통합 검사는 임시 DB와 합성 정책·서명된 Access JWT·가짜 R2/캐시 API를 사용한다. 테스트를 위해
새 network·container·volume과 loopback 임의 포트를 만들고 종료 시 해당 자원을 정리한다.
기존 DB·Tunnel과 운영 버킷을 사용하지 않는다. production Compose의 메모리 한도·read-only
filesystem·실제 gateway·관리자 로그인은 별도 검사 대상이다.

기존 묶음은 다음 형태로 다시 확인한다. 이 검사는 Docker 기동·서버 접속 없이 파일만 읽는다.

```sh
python3 deploy/application/prepare-images.py --verify /절대경로/blariyo-app-images-생성폴더
```

`manifest.json`이 없는 중단 폴더는 완료 묶음이 아니다. 재실행은 새 폴더를 만들며 중단 결과도
임의로 삭제하지 않는다. `--verify`는 보관 파일의 일관성 검사이며 이후 source 변경·배포·
법무 승인까지 확인하는 명령은 아니다. 원격 image load는 별도 설치 도구에서 archive 해시와
config digest·플랫폼을 대조한 후 수행해야 한다.

Docker image store에 따라 local image ID가 config digest 또는 OCI index/manifest digest일 수
있으므로 서로 같은 종류인지 확인한다. 도구는 OCI index → amd64 manifest → config 연결의
각 해시를 확인하고 값들을 분리 기록한다. 근거:
[Docker containerd store](https://docs.docker.com/engine/storage/containerd/),
[OCI image index](https://github.com/opencontainers/image-spec/blob/main/image-index.md),
[OCI image manifest](https://github.com/opencontainers/image-spec/blob/main/manifest.md).

검사 도구의 부정 입력 회귀 검사는 `python3 deploy/application/test-images.py`로 실행한다.

## 서버에 image와 설정 보관

[맥 진입점](stage-from-mac.py)과 [서버 설치 코드](stage-server.py)는 먼저 검증된 파일을
서버에 보관한다. **앱 서버 기동과 공개 연결은 다음 단계**다. 기본 실행은 로컬 검사만 한다.

```sh
python3 deploy/application/stage-from-mac.py --host 13.124.55.99
```

확인한 대상에 전송·설치할 때 다음 명령을 실행한다.

```sh
python3 deploy/application/stage-from-mac.py --host 13.124.55.99 --stage
```

현재 기본 입력은 `application-config-W8Wwp5`와
`blariyo-app-images-20260920T005324Z-rhn14v8g`다. 다른 검증 묶음은 `--config`·`--images`의
절대 경로로 지정한다. **새 배포는 두 옵션을 명시해** 초기 묶음의 자동 재사용을 피한다. 최신 폴더를 추측해 선택하지 않는다. 고정 IP는 추가하지 않았으므로
서버 공인 IP가 바뀌었다면 실제 IP를 확인한다. SSH host key 검증을 비활성화하지 않는다.

`stage-from-mac.py`는 최초 경계의 고정 설정을 검사한다. 예를 들어 신뢰 IP 헤더가 빈 값이 아니면
거부하며, 운영 release의 모든 mount·flag·인증 설정을 자동 이관하지 않는다. 현행 설정과 다른
입력을 검사 통과만을 위해 초기값으로 되돌리지 않는다. 새 후보에 필요한 설정·검사 도구 변경을
검토하고 [배포 실행서](../../docs/operations/deployment-runbook.md)의 사전 대조를 따른다.

설치 동작:

1. 로컬 파일 소유자·700/600 권한·입력 분리·Compose 사본과 image archive를 검사한다.
2. 신뢰된 SSH로 `ubuntu@<host>`에 연결하고 서버 hostname `ip-172-26-1-91`·x86_64,
   관리 중인 DB·초기 migration 표시·DB health·app 비밀번호 일치를 확인한다.
3. 비공개 설정은 SSH 표준입력으로 보내고 archive 전체 크기·SHA-256을 확인한 뒤 Docker에
   load한다. 기존 동일 tag가 다른 실행 설정/layer를 가리키면 거부한다.
4. 서버 inspect의 실행 설정·RootFS layer를 archive에서 구한 값과 대조한다. Docker store별
   빈 Config 필드 차이는 [기존 검증 함수](../postgresql/migrate-server.py)로 정규화한다.
   Compose가 참조하는 `images.env`에는 검증 후 **서버의 immutable image ID**를 쓴다.
5. `api.env`·`web.env`는 root 소유 600, secret 두 파일은 1000:1000·600으로 설치한다.
   `compose config --quiet`와 image별 일회성 Node의 secret 읽기를 확인한다. Node 검사는
   네트워크 없이, 읽기 전용 filesystem·128MiB 한도로 실행하고 앱 명령을 실행하지 않는다.
6. 성공해야 `stage.json`에 `STAGED_NO_SERVICES`를 기록하고 `release-*` 폴더로 확정한다.

서버 기존 파일을 덮어쓰지 않는다. 동일 입력 재실행은 내용·권한·image·secret 읽기를 다시
확인하고 기존 release를 재사용한다. 중단된 `.incomplete-*`는 700 폴더에 남으며 완료 묶음으로
취급하지 않는다. 다른 입력은 새 release가 된다. 자동 rollback·DB 삭제·기존 image 정리는 없다.
초기 archive는 약 155MiB였다. 새 묶음의 실제 크기와 load 공간을 기준으로 여유 공간을 검사한다.

이 단계는 `compose up`, DB SQL 변경, 정책 발행, 기존 container 재시작, network 연결,
Tunnel·DNS·방화벽 변경을 수행하지 않는다. Nginx→Web과 기존 cloudflared의 edge network 연결,
정책 확정·발행, production 서비스 기동·로그인·2GB 메모리 관찰은 후속 작업이다.
소스 build와 운영 입력의 registry 전송도 하지 않는다.

```sh
python3 deploy/application/test-stage.py
python3 deploy/application/test-stage.py --docker-probe
```

첫 검사는 합성 입력과 Docker 대역을 사용해 잘린/변형된 전송, 경로 탈출·추가 secret, 기존
폴더·tag 충돌, 재실행·변경 입력 거부, 검사 실패 시 완료 표시가 없는지 확인한다. 두 번째는
실제 amd64 image와 임시 Docker volume의 합성 secret으로 Linux UID·권한·읽기를 검사한다.
실제 서버 설치와 실제 앱 기동 검증을 대신하지 않는다.

## 공개 연락처 입력

맥에서 다음 명령으로 입력 양식을 만든다. 파일이 이미 있으면 값·권한을 유지한다.

```sh
node deploy/application/prepare-public-config.cjs --create
open -e ~/.config/blariyo/public-contact.json
```

생성 파일은 본인 소유·권한 600의 JSON이며 아래 5개 문자열을 입력한다. 여기서 공개라는 말은
향후 사이트에 표시할 정보라는 뜻이다. 준비 도구가 이 값을 외부로 전송하거나 출력하지는 않는다.

| 항목 | 입력할 내용 | Web 배포 시 대응 이름 |
| --- | --- | --- |
| `operatorDisplayName` | 공개할 실제 운영자 표시명 | `NUXT_PUBLIC_OPERATOR_DISPLAY_NAME` |
| `contactEmail` | 실제 수신 가능한 일반 문의 이메일 | `NUXT_PUBLIC_CONTACT_EMAIL` |
| `rightsEmail` | 실제 수신 가능한 권리 신고 이메일 | `NUXT_PUBLIC_RIGHTS_EMAIL` |
| `privacyEmail` | 실제 수신 가능한 개인정보 문의 이메일 | `NUXT_PUBLIC_PRIVACY_EMAIL` |
| `privacyOfficer` | 실제 개인정보 보호책임자 또는 담당자 표시 | `NUXT_PUBLIC_PRIVACY_OFFICER` |

Core에는 동일 객체를 `LEGAL_CONFIG` JSON으로 전달해야 한다. 입력 파일을 Core/Web의
`.env`로 직접 연결하지 않으며 배포 설정을 만들 때 각각의 이름으로 변환한다.
이 대응표는 [Core 검사](../../apps/api/src/features/policies/policy-artifact.ts),
[Web runtimeConfig](../../apps/web/nuxt.config.ts), [Web 운영 모드 검사](../../apps/web/server/plugins/production.ts)를 기준으로 한다.

저장한 뒤 다음 명령으로 검사한다.

```sh
node deploy/application/prepare-public-config.cjs
```

[준비 도구](prepare-public-config.cjs)는 파일 소유자·권한·일반 파일·형식을 확인한 후 실제 빌드된
Core의 `assertLegalConfig`를 호출한다. 빈 값, 미정 문구, 잘못된 이메일은 완료 처리하지 않는다.
검사 통과는 이메일 수신 여부·담당자 적정성·법무 검토나 앱 기동을 증명하지 않는다.
원문·이메일을 저장소, 작업 기록, 채팅에 복사할 필요가 없다.

## 신규 DB의 정책 발행 조건

현재 production Core는 유효한 약관·개인정보처리방침이 DB에 모두 없으면
`POLICY_RELEASE_REQUIRED`로 기동을 거부한다. [실행 코드](../../apps/api/src/main.ts)와
[정책 서비스](../../apps/api/src/features/policies/policies.service.ts)에서 확인할 수 있다.

공개 연락처 입력과 정책 확정은 별개의 작업이다. 저장소의 [법무 문서](../../docs/legal/README.md)는
아직 초안과 공개 조건을 포함한다. 최종 본문·시행일·실제 사용 사업자 등의 필요한 검토를 마친 뒤
정책 artifact를 만들어 `policies:publish`로 등록하고 Web·Core를 기동한다.
이 도구는 정책을 생성·승인·발행하지 않으며 테스트용 정책을 운영 DB에 등록하지 않는다.

전체 공개 전 입력 범위는 [운영 실값 체크리스트](../../docs/development-specs/m0-core/decisions/operational-values-checklist.md)를 따른다.
연락처 검사 다음 단계는 [M0 정책 발행 전 검토표](policy-release-review.md)의 실제 운영 정보와
이번 공개 범위를 확인하는 것이다. 이 검토표는 공개 정책 전문이나 발행 파일이 아니다.

## 간결한 정책 본문 검토

[M0 공개 초안](../../docs/legal/m0-core/README.md)에 약관·개인정보·권리·쿠키 안내를 준비했다.
연락처 입력은 재사용하며 다음 명령으로 새 로컬 검토본을 만들고 연다.

```sh
node deploy/application/prepare-policy-review.cjs --open
```

[생성 도구](prepare-policy-review.cjs)는 기존 파일을 읽고 새 `policy-review-*` 폴더에만 쓴다.
폴더는 700, HTML은 600이며 외부 리소스·스크립트를 로드하지 않는다. 표시된 미확정 사항과 시행일은
본문 검토 후 확정한다. 정책 발행·서버 변경을 수행하는 명령이 아니다.

## 최초 운영 배포 (2026-09-20)와 후속 반영

위 준비 절차와 별개로 9월 20일 운영 서버의 확정 정책 발행·앱 기동·Tunnel/DNS 전환을 완료했다.
[배포 기록](../../worklog/2026-09-20/infrastructure-setup/TASK-19.md)과
[운영 실행 안내](../operations/README.md)를 따른다. 이후 release·DB·공개 수량은
[현재 운영 상태](../../docs/operations/current-status.md)의 마지막 관측일을 따른다.
기존 초기 준비 문맥의 "다음 단계"를 현재 미배포 상태로 해석하지 않는다.

- 공개: https://blariyo.com/ (`/meme`으로 이동), `www`는 대표 주소로 308 이동
- 관리자: https://blariyo.com/admin (기존 이메일 정책 + MFA + 앱 운영자 매핑)
- 확정 정책: `python3 deploy/application/publish-policies-from-mac.py --apply`
- 익명 공개 검증: `python3 deploy/application/check-public.py`
- 이후 정책 변경은 새 버전으로 발행하며 v0.1을 수정하지 않는다.
