# TASK — Lightsail·Cloudflare 운영 준비와 실제 앱 R2 연동

- 기록일: 2026-09-20, KST
- 대상 기간: 2026-09-19~20 대화에서 진행한 운영 준비
- 기록 요청: 다음 단계로 넘어가기 전에 지금까지의 작업을 task 단위로 보존
- 전체 상태: **진행 — 실제 앱의 R2·캐시 어댑터 연결까지 검증. 관리자 인증 연결·서버 앱 배포·운영 검증은 남음**
- 기록 시점 HEAD: `6cb7918808def09556eb6bead8fbfa9cedb3525a` (`main`)
- Git 상태: 기존 미커밋 코드·문서 변경을 포함한 작업 트리. 이 기록을 위해 commit·push하지 않음

## 1. 기록의 범위와 증거 기준

이 문서는 작업 이력이며 제품·기술 정본을 대신하지 않는다. 현재 작업 트리의 파일 확인,
이전 단계의 로컬 검증 결과, 사용자가 공유한 콘솔 화면·터미널 결과를 구분해 기록한다.
문서 작성 과정에서 클라우드 설정을 변경하거나 운영 테스트를 다시 실행하지 않았다.

| 증거 종류 | 의미 | 한계 |
| --- | --- | --- |
| 사용자 화면 | 해당 시점 콘솔 설정·등록 상태 | 실제 앱의 인증·권한 검증을 대신하지 않음 |
| 사용자 실행 결과 | 사용자가 맥·서버에서 실행해 공유한 명령 결과 | 결과에 명시된 환경·대상·범위까지만 확인 |
| 이전 단계 로컬 검증 | 이 대화의 구현 단계에서 실행한 build·test·lint 결과 | 기록 작성 시 재실행한 결과가 아님 |
| 현재 파일 확인 | 기록 시점 코드·문서·검사 스크립트 존재와 내용 | 운영 서버에 반영됐다는 증거가 아님 |
| 앞선 대화의 설정 기록 | 서버 준비 등 앞 단계에서 기록된 상태 | 현재 클라우드 상태를 이번에 재조회하지 않음 |

task의 **완료**는 제목에 적힌 범위의 완료다. 예를 들어 Access 콘솔 설정 완료는
Blariyo 앱의 관리자 인증 완료가 아니며, R2 백업 버킷 생성은 DB 백업·복원 완료가 아니다.
비밀값, 계정 식별값 원문, 개인키, JWT, MFA QR·복구 코드는 기록하지 않는다.

참조 정본:

- [인프라 계획](../../../docs/planning/02-infra-plan.md)
- [인프라 설계](../../../docs/system-design/04-infrastructure-design.md)
- [보안·운영 설계](../../../docs/system-design/05-security-operations.md)
- [운영자 준비 체크리스트](../../../docs/operations/owner-setup-checklist.md)

운영자 준비 체크리스트의 작성 당시 미확인 표시는 이 세션의 실행 이력을 대신하지 않는다.
이번에는 기존 체크리스트를 일괄 완료 처리하지 않고 아래 task별 근거를 남긴다.

## 2. 사용자가 확정한 진행 조건

| 항목 | 이번 진행 조건 |
| --- | --- |
| 서버 | AWS Lightsail 서울 2GB로 진행 |
| 증설 | 실제 트래픽·메모리 측정 없이 2GB 부족을 확정하지 않음. 4GB로 변경하지 않음 |
| IP | Static IP를 만들지 않음. 관리 접속 전 현재 공인 IP 확인 필요 |
| 토큰 | 이번 R2·캐시 토큰은 만료 없음, 클라이언트 IP 필터 비움으로 진행 |
| Access 세션 | 애플리케이션 세션 6시간. 최신 화면의 MFA 지속 시간도 6시간 |
| SSH alias | 사용자가 `.zshrc`에 직접 입력. 에이전트가 `.zshrc`를 수정하지 않음 |
| 배포 범위 | 지금까지는 운영 자원 준비와 맥에서의 연결 검증. 서버 앱 배포는 미완료 |

블루그린 무중단 배포를 구축하거나 검증한 기록은 없다. 현재 운영 방향은 단일 VM의
Docker Compose이며, 실제 배포 절차·전환·rollback 검증은 후속 task다.

## 3. Task 목록

| ID | 작업 | 상태 | 확인된 범위 |
| --- | --- | --- | --- |
| INFRA-01 | 도메인·Cloudflare 관리 기반 | 진행 | 도메인 관리 및 공개 media 연결. 루트 서비스 전환은 남음 |
| INFRA-02 | Lightsail 기본 서버·SSH·Docker 준비 | 완료 | 앞 단계 서버 접속 및 Docker 조회. 앱 배포 제외 |
| INFRA-03 | SSH 실행 파일·alias 안내 | 진행 | 로컬 실행 파일 존재. alias 실제 적용은 미확인 |
| INFRA-04 | Cloudflare Tunnel connector 실행 | 완료 | 서버의 cloudflared 실행 확인. 앱 upstream 연결 제외 |
| INFRA-05 | 관리자 Access 애플리케이션·정책 설정 | 완료 | 콘솔 대상 경로·정책 연결 확인. 실제 사용자 권한 검증 제외 |
| INFRA-06 | MFA·App Launcher 등록 | 완료 | 인증 앱 TOTP 장치 등록 및 6시간 설정 화면 확인 |
| INFRA-07 | R2 버킷별 키 발급·보관 | 완료 | 세 버킷과 별도 키 준비, 보관 파일을 이용한 후속 검사 성공 |
| INFRA-08 | R2 읽기·쓰기·삭제·목록 권한 검사 | 완료 | 세 버킷 검사 실패 0건, 다른 버킷 목록 조회 차단 |
| INFRA-09 | 검사용 Node 버전 정리 | 완료 | Node 24.18.0 절대경로로 검사 성공 |
| INFRA-10 | 캐시 삭제 전용 토큰·API 검사 | 완료 | 지정 zone에서 단일 테스트 URL 삭제 요청 수락 |
| INFRA-11 | 공개 이미지 도메인·HTTPS 검사 | 완료 | PNG 업로드·HTTPS 내용 일치·삭제 후 404 |
| INFRA-12 | 실제 앱의 R2 키 분리 구현·로컬 검증 | 완료 | 소스·설정 변경, API build·unit·lint 등 통과 |
| INFRA-13 | 실제 앱 어댑터와 운영 R2 연결 검사 | 완료 | 맥에서 private→public·HTTPS·삭제·캐시 정리 성공 |
| INFRA-14 | Access 인증을 실제 앱 설정에 연결 | 진행 | 코드 요구값 확인·AUD 저장 안내. 저장 확인과 운영자 매핑은 남음 |

### INFRA-01 — 도메인·Cloudflare 관리 기반

- **수행:** `blariyo.com`의 Cloudflare 관리 화면과 R2·Access 설정 화면으로 진행했다.
  앞 단계에서 도메인 등록 업체와 Cloudflare 네임서버 연결을 다뤘다.
- **근거:** 사용자 콘솔 화면, INFRA-11·13의 `media.blariyo.com` HTTPS 성공 결과.
- **미완료:** 루트 `blariyo.com`을 새 앱으로 전환한 증거는 없다. 앞 단계의 기존 사이트 응답을
  Blariyo 앱 배포 성공으로 취급하지 않는다. DNSSEC 최종 상태와 기존 메일 레코드 보존도 별도 확인 대상이다.

### INFRA-02 — Lightsail 기본 서버·SSH·Docker 준비

- **수행:** 서울 Lightsail 2GB 서버를 사용하고 Ubuntu 계정으로 SSH 접속했다.
  앞선 설정 기록에는 Ubuntu 24.04 x86_64, 2GB swap, 업데이트·재부팅이 포함돼 있다.
- **직접 공유된 근거:** 서버 프롬프트에서 `sudo docker ps`와 `sudo docker ps -a` 실행 결과.
  실행 중인 컨테이너는 `cloudflared` 하나였고, 종료된 `cloudflared` 컨테이너 하나가 추가로 보였다.
- **경계:** 이 출력에서 Nuxt·Nest·PostgreSQL 컨테이너는 확인되지 않았다.
  앱의 2GB 환경 부하·OOM·복원력은 미검증이며, 기록 작성 중 SSH로 재조회하지 않았다.
- **후속:** 실제 배포 때 현재 공인 IP, 방화벽, swap·디스크·Docker 상태를 다시 확인한다.

### INFRA-03 — SSH 실행 파일·alias 안내

- **수행:** `~/task_list/ssh-blariyo.sh` 실행 파일을 준비했고, 사용자가 직접 넣을
  `ssh-blariyo` alias 한 줄을 안내했다. 현재 실행 파일 존재를 확인했다.
- **alias 역할:** `ssh-blariyo`로 사용자 홈의 `task_list/ssh-blariyo.sh`를 실행한다.
  실제 안내에는 사용자 홈의 절대경로를 사용했다.
- **미검증:** `.zshrc` 반영·새 셸에서 alias 실행 결과는 공유되지 않았다.
- **주의:** Static IP를 쓰지 않으므로 서버 IP가 바뀌면 실행 파일의 접속 대상을 갱신해야 한다.
  개인키 파일의 내용은 기록하지 않는다.

### INFRA-04 — Cloudflare Tunnel connector 실행

- **수행:** `blariyo-prod` Tunnel용 cloudflared를 Docker로 실행했다.
  앞선 기록에는 connector 연결 확인과 재시작 정책 설정이 포함돼 있다.
- **사용자 실행 근거:** `quirky_hertz`가 `cloudflare/cloudflared:latest`, `Up 24 hours`.
  `magical_wilbur`는 같은 이미지의 `Exited (0) 24 hours ago`였다.
- **보존:** 종료 컨테이너 삭제를 완료한 것으로 기록하지 않는다. Tunnel token 원문은 보관하지 않는다.
- **미완료:** connector 실행과 앱의 upstream 연결은 별개다. 앱 컨테이너·Docker network·서비스
  hostname으로 이어지는 요청 검증은 아직 남아 있다.

### INFRA-05 — 관리자 Access 애플리케이션·정책 설정

- **수행:** `blariyo.com` 자체 호스팅 애플리케이션에 다음 대상을 설정했다.
  `blariyo.com/admin*`, `blariyo.com/api/v1/admin/*`.
- **정책:** `blariyo-admin-owner`, 동작 `Allow`, 규칙 1개가 애플리케이션에 연결된 화면을 확인했다.
  초기 정책 목록의 애플리케이션 사용 수 0 상태에서 이후 앱에 연결된 상태로 진행했다.
- **기타 설정:** 애플리케이션 세션 6시간, 로그인 공급자 선택, 즉시 인증 적용 켬,
  Cloudflare One Client 인증 끔, 브라우저 RDP·SSH·VNC 끔으로 진행한 화면이 있다.
- **검증 경계:** 정책 이름과 규칙 개수만으로 소유자만 허용된다고 단정하지 않는다.
  실제 Include 조건의 최종 값과 허용 사용자·비허용 사용자 접속 결과는 별도 확인이 필요하다.
  공개 페이지와 관리자 경로의 분리 동작도 서버 배포 뒤 검증한다.

### INFRA-06 — MFA·App Launcher 등록

- **수행:** Access 설정에서 인증 애플리케이션 방식의 MFA를 준비했다.
  초기 App Launcher 비활성 안내 후 사용자가 QR 등록을 마치고 계정 화면까지 진입했다.
- **사용자 화면 근거:** `MFA Devices`에 `Authenticator`, 방법 `TOTP`, 장치 1개가 표시됐다.
  최신 Access 앱 화면에는 전역 설정 준수, 전역 적용 켬, 인증 애플리케이션, 6시간이 표시됐다.
- **구분:** 애플리케이션 세션 6시간과 MFA 인증 지속 시간 6시간은 서로 다른 설정이다.
  중간 화면의 24시간 표시는 이후 6시간 화면으로 갱신됐다.
- **미검증:** 이 장치 등록만으로 Blariyo 앱의 JWT 검증·내부 운영자 권한 연결이 완료되지는 않는다.

### INFRA-07 — R2 버킷별 키 발급·보관

- **대상:** `blariyo-media-private`, `blariyo-media-public`, `blariyo-backup`.
- **수행:** 버킷별로 분리된 R2 자격증명을 발급하고 `~/.config/blariyo/r2-credentials.env`에
  보관했다. 사용자의 저장 완료 응답과 후속 실행 성공을 근거로 한다.
- **파일 형식:** `R2_ENDPOINT`와 각 `R2_PRIVATE_*`, `R2_PUBLIC_*`, `R2_BACKUP_*`의
  `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`를 사용한다.
  사용자가 추가한 `*_TOKEN` 필드는 S3 검사·앱 연결에 사용하지 않는다.
- **형식 수정:** 작은따옴표 전용 검사에서 오류가 발생한 뒤, 사용자의 수정 양식에 맞춰
  인용 없는 값·작은따옴표·큰따옴표 등을 처리하도록 검사기를 보완했다.
- **보관 경계:** secret 파일은 저장소 밖에서 소유자 전용 권한으로 관리한다.
  이 기록에는 키 값이나 Account ID를 복사하지 않는다.
- **미검증:** private·backup의 공개 URL·도메인 비활성 최종 상태는 별도 콘솔 점검 대상이다.

### INFRA-08 — R2 읽기·쓰기·삭제·목록 권한 검사

- **도구:** `~/task_list/check-blariyo-r2.cjs`.
- **사용자 실행 결과:** 세 버킷 모두 인증·목록 조회, 테스트 파일 업로드, 다운로드 내용 일치,
  삭제 확인을 통과했다. 다른 두 버킷에 대한 목록 조회 차단도 각 키로 확인했다.
- **최종 출력:** `PASS R2 검사 완료 — 실패 0건`.
- **검증 범위:** 본인 버킷 읽기·쓰기·삭제 및 총 6개의 교차 버킷 목록 조회 차단.
- **미검증:** 다른 버킷의 알려진 object key에 대한 직접 읽기·쓰기 차단은 이 검사로 증명하지 않는다.
  백업 암호화·DB dump·복원 역시 이 범위에 포함되지 않는다.

### INFRA-09 — 검사용 Node 버전 정리

- **발생:** Node 20.19.2 실행에서 AWS SDK의 향후 Node 지원 경고가 출력됐다.
- **조치:** 설치된 Node 24.18.0의 절대경로로 이후 검사를 실행했다.
- **결과:** R2 쓰기 검사, 캐시 검사, 공개 media 검사, 실제 앱 R2 검사가 이 버전으로 성공했다.
- **경계:** 사용자의 전역 기본 Node 버전이나 서버 Node 버전까지 변경한 것은 아니다.

### INFRA-10 — 캐시 삭제 전용 토큰·API 검사

- **수행:** `blariyo-cache-purge` 토큰을 지정 도메인 `blariyo.com`에 한정하고
  `Cache & Performance → Cache → Purge` 권한으로 준비했다.
- **보관:** `~/.config/blariyo/cloudflare-cache.env`의 `CACHE_ZONE_ID`, `CACHE_PURGE_TOKEN`.
  발급 결과의 Account ID와 캐시 API에 필요한 Zone ID를 구분해 안내했다.
- **도구:** `~/task_list/check-blariyo-cache.cjs --purge-test`.
- **사용자 실행 결과:** 파일 형식·권한 확인 통과, `blariyo.com`의 고유 테스트 URL 하나에 대한
  캐시 삭제 요청 수락. 전체 도메인의 캐시 삭제는 수행하지 않았다.
- **미검증:** 이 결과는 이미 캐시된 콘텐츠의 HIT→무효화 변화나 전체 CDN 전파를 증명하지 않는다.

### INFRA-11 — 공개 이미지 도메인·HTTPS 검사

- **수행:** public 버킷에 `media.blariyo.com` 사용자 지정 도메인을 연결했다.
- **사용자 화면:** 상태 활성. 당시 최소 TLS 표시값은 `1.0`, CORS 정책은 없었다.
  R2 도메인 표의 `Access: 사용됨`은 Zero Trust 관리자 정책 검증 증거로 취급하지 않는다.
- **도구:** `~/task_list/check-blariyo-public-media.cjs --write-test`.
- **사용자 실행 결과:** 고유 PNG 업로드 → HTTPS 200·`image/png`·내용 일치 → R2 삭제 확인 →
  공개 URL 404, 실패 0건.
- **미검증:** CDN 캐시 HIT, 브라우저 CORS, 모든 엣지의 삭제 전파.
  최소 TLS 조정과 public 개발 URL의 최종 비활성 여부는 운영 점검에 남긴다.

### INFRA-12 — 실제 앱의 R2 키 분리 구현·로컬 검증

- **문제:** 기존 앱은 private/public에 공통 R2 키를 사용하고 서버 측 `CopyObject`로 복사해,
  이번에 발급한 버킷별 별도 키 구조와 맞지 않았다.
- **변경:** private/public별 S3 client와 자격증명을 분리했다.
  `promote()`는 private 키로 `GetObject`, public 키로 `PutObject`를 실행한다.
  원본을 유지하고 bytes·Content-Type·Cache-Control 등 metadata를 전달한다.
- **시작 조건:** 두 버킷·두 키가 각각 필요하며 같은 버킷이나 같은 Access Key ID를 거부한다.
  이전 공통 키로의 fallback은 없다. backup 키는 Core media 어댑터에 주입하지 않는다.
- **실패 처리:** 읽기·쓰기 실패를 호출자에게 전달한다. 재시도·발행 보상 처리의 전체 DB 흐름은
  아래 실연결 검사와 별도로 검증해야 한다.
- **영향:** Core가 이미지 bytes를 메모리에 읽어 전송하므로 동시 발행 부하의 실제 자원 사용은 남은 검증이다.

관련 파일:

- [R2·캐시 어댑터](../../../apps/api/src/adapters/remote-adapters.ts)
- [환경 설정](../../../apps/api/src/bootstrap/config.ts)
- [R2 격리 테스트](../../../apps/api/test/r2-storage.service.test.ts)
- [Docker 검사 환경값](../../../scripts/test-docker.ts)
- [런타임 안내](../../../README.md)
- [인프라 설계](../../../docs/system-design/04-infrastructure-design.md)

이전 구현 단계에서 통과한 로컬 검증:

| 명령 | 결과 |
| --- | --- |
| `npm run build -w @blariyo/api` | 통과 |
| `npm run build:test -w @blariyo/api` | 통과 |
| `node --test apps/api/dist-test/*.service.test.js` | 15개 테스트 통과 |
| `npm run typecheck:scripts` | 통과 |
| `npm run lint -w @blariyo/api` | 통과 |
| `npm run lint:scripts` | 통과 |
| 변경 문서 상대 링크·`git diff --check` | 통과 |

격리 테스트는 실제 AWS SDK의 서명 요청을 로컬 S3 fixture에서 확인했다.
버킷별 자격증명, 목록 pagination, bytes·metadata 보존, 실패 전파·재시도·삭제 범위를 다뤘다.
전체 Docker E2E·운영 DB 통합·서버 배포 시험을 이 결과에 포함하지 않는다.

### INFRA-13 — 실제 앱 어댑터와 운영 R2 연결 검사

- **도구:** `~/task_list/check-blariyo-app-r2.cjs --write-test`.
- **실행 위치:** 사용자 맥, Node 24.18.0.
- **연결 대상:** 로컬에서 빌드한 실제 `apps/api/dist/bootstrap/config.js`의 R2·캐시 어댑터,
  운영 private/public 버킷, 공개 media 도메인, 단일 URL 캐시 삭제 API.
- **사용자 제공 실행 결과:**

```text
검사 경로: __blariyo_check__/app-d65dda01-9832-49c5-abae-2e77f11e58f3.png
PASS 앱 어댑터 — private 전용 키로 원본 업로드
PASS 앱 어댑터 — 별도 키로 public 복사 · 원본 유지 · 내용 일치
PASS 공개 이미지 — 앱이 복사한 PNG의 HTTPS 내용 일치
PASS 정리 — public 테스트 이미지 삭제 확인
PASS 정리 — private 테스트 이미지 삭제 확인
PASS 정리 — 테스트 이미지 URL 하나의 캐시 삭제 요청 수락
PASS 정리 — 공개 URL 404 확인
PASS 앱 R2 연동 검사 완료 — 실패 0건
```

- **결론:** 실제 앱 어댑터를 이용한 맥→운영 R2·캐시 연결까지 확인했다. 테스트 이미지 두 사본과
  해당 공개 URL의 정리도 확인했다.
- **미검증:** DB 발행 transaction, 관리자 인증, 서버 배포, 운영 부하, 전체 CDN 삭제 전파.
  검사기의 test 환경 부트스트랩을 운영 앱 전체의 startup gate 통과로 간주하지 않는다.

### INFRA-14 — Access 인증을 실제 앱 설정에 연결

- **확인:** [Nuxt 설정](../../../apps/web/nuxt.config.ts),
  [관리자 identity 처리](../../../apps/web/server/utils/identity.ts),
  [Access 검증](../../../apps/web/server/utils/access.mjs)을 읽었다.
- **현재 앱의 요구값:** `NUXT_ADMIN_AUTH_MODE`, `NUXT_ACCESS_ISSUER`, `NUXT_ACCESS_AUDIENCE`,
  `NUXT_ADMIN_OPERATORS_FILE`. 내부 API 인증·감사 식별용 secret은 별도로 필요하다.
- **안내한 다음 작업:** Access의 `blariyo.com` 애플리케이션 → 추가 설정에서 AUD를 확인하고
  `~/.config/blariyo/cloudflare-access.env`에 issuer·audience와 인증 모드를 저장한다.
- **중단 지점:** 사용자가 작업 기록을 요청했다. **AUD 파일 저장 완료 응답은 아직 받지 않았다.**
  사용자 `sub`와 내부 운영자 ID의 매핑 파일도 아직 연결하지 않았다.
- **후속 주의:** 설계의 `NUXT_ADMIN_OPERATOR_MAP_FILE` 등 이름과 현재 코드의
  `NUXT_ADMIN_OPERATORS_FILE` 등 이름, 매핑 파일 구조가 다르다. 배포 설정을 작성할 때
  정본·구현을 대조해 일치시켜야 하며 이 기록에서 임의로 설계나 코드를 변경하지 않는다.

## 4. 검사 도구와 보관 위치

`~`는 작업한 맥의 사용자 홈이다. 아래 도구는 저장소 외부 파일이며 이번 기록에 복사하거나
Git으로 추적하지 않았다. 현재 존재는 확인했지만 다른 PC에서 바로 실행할 수 있는 배포 번들은 아니다.

| 위치 | 역할 |
| --- | --- |
| `~/task_list/ssh-blariyo.sh` | SSH 실행 보조 |
| `~/task_list/blariyo-r2-credentials.env.example` | R2 보관 양식 |
| `~/task_list/check-blariyo-r2.cjs` | 세 버킷 인증·읽기·쓰기·삭제·교차 목록 차단 |
| `~/task_list/check-blariyo-cache.cjs` | 캐시 토큰·Zone ID·단일 URL 삭제 검사 |
| `~/task_list/check-blariyo-public-media.cjs` | public 버킷→HTTPS PNG 검사 |
| `~/task_list/check-blariyo-app-r2.cjs` | 실제 앱 R2·캐시 어댑터 검사 |
| `~/.config/blariyo/r2-credentials.env` | 사용자 보관 R2 자격증명. 값 비기록 |
| `~/.config/blariyo/cloudflare-cache.env` | 사용자 보관 캐시 자격증명. 값 비기록 |
| `~/.config/blariyo/cloudflare-access.env` | 저장을 안내한 Access 설정. 완료 미확인 |

이전 성공 명령은 다음과 같다. 이미 통과했으므로 기록을 위해 다시 실행할 필요는 없다.
`--write-test`는 테스트 object 생성·삭제를, `--purge-test`는 단일 URL 삭제 API 호출을 수행한다.

```bash
~/.nvm/versions/node/v24.18.0/bin/node ~/task_list/check-blariyo-r2.cjs --write-test
~/.nvm/versions/node/v24.18.0/bin/node ~/task_list/check-blariyo-cache.cjs --purge-test
~/.nvm/versions/node/v24.18.0/bin/node ~/task_list/check-blariyo-public-media.cjs --write-test
~/.nvm/versions/node/v24.18.0/bin/node ~/task_list/check-blariyo-app-r2.cjs --write-test
```

## 5. 다음 작업과 재개 기준

| 순서 | Task | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- |
| 1 | INFRA-14 Access 앱 설정 | 진행 | AUD 저장 확인, 안정적인 `sub`→내부 운영자 매핑, 실제 JWT·허용/거부 검증 |
| 2 | INFRA-15 운영 배포 설정 | 미완료 | 운영 Compose·network·secret·DB 역할·환경 변수 계약 대조, 법무·기능 gate 확인 |
| 3 | INFRA-16 서버 배포·경로 전환 | 미실행 | 앱·DB 배포, migration, Tunnel upstream, 공개·관리자 경로 smoke test 및 rollback 확인 |
| 4 | INFRA-17 운영 기능·복구 검증 | 미검증 | 발행·숨김·예약·outbox, 암호화 DB 백업과 새 DB 복원, 외부 관측·알림 |
| 5 | INFRA-18 공개 전 점검 | 미검증 | TLS·DNSSEC·private/backup 비공개·CDN·허용/거부·실부하 확인, 선택 기능 gate 유지 |

재개할 때는 INFRA-14의 AUD 저장 여부부터 확인한다. R2 키를 다시 발급하거나 이미 통과한
세 버킷·media·앱 어댑터 검사를 이유 없이 반복하지 않는다. root 도메인 전환, 서버 앱 배포,
전체 캐시 삭제가 완료됐다고 가정하지 않는다.

## 6. 이번 기록 작업의 변경 경계와 검증

- 새 파일: 이 `TASK.md`.
- 탐색용 갱신: [task 목록 README](../../2026-09-23/directory-reorganization/previous-task-list-index.md)에 이번 기록 링크 추가.
- 기존 수정 파일과 운영 준비 자료 9개의 SHA-256이 기록 전후 동일함을 확인했다.
- 기존 R2 구현·테스트·설계 변경은 이전 task의 결과이며 이번 기록 작업에서 추가 수정하지 않는다.
- 검증 완료: 두 변경 문서의 상대 링크 19개, 상세 task ID 14개의 연속성,
  코드 fence·trailing whitespace, 비밀값 패턴 검사와 수동 검토,
  `git diff --check`, 변경 범위 확인.
- 범위 제외: 클라우드 재설정, 운영 검사 재실행, commit·push·배포.
