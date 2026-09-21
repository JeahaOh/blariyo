# M0 저비용 인프라 설계

M1 회원·M1.5 익게의 추가 계약은 [회원·익게 기술 설계](06-member-community-design.md)를 따른다. 이 문서의 M0 한정 계약과 구분한다.
- 문서 상태: M0 인프라 설계 계약 · Lightsail 공개 배포 완료, 관리자 쓰기 흐름·장기 관찰 미검증
- 기준일: 2026-09-04
- 정합성 검토일: 2026-09-20 (실제 배포 반영)
- 가격 기준: 2026-08-14, USD, 세금·환율·도메인·메일 비용 제외
- 관련 문서: [시스템 아키텍처](./01-system-architecture.md), [보안·운영](./05-security-operations.md)

가격과 무료 한도는 바뀔 수 있다. 배포 직전 공식 가격표를 다시 확인하고 월 예산 알림을 설정한다.

## 1. 비용 목표

| 단계 | 월 인프라 목표 | 허용 수준 |
| --- | --- | --- |
| 개발 | `$0` | 로컬 Docker Compose |
| 비공개 검증 | `$0` | OCI Always Free 확보 시 사용 |
| 초기 공개 검증 | `$0~12` | 단일 VM, 단일 리전, 백업 복구 |
| 유료 안정안 | `$12~24` | Lightsail 서울 2GB, 필요 시 4GB |

도메인 등록비와 권리 문의용 메일 주소는 인프라 월 비용에서 분리한다. 광고·소셜 provider 심사
비용도 M0 핵심 비용에 넣지 않는다. M0 GA4 연동은 기본 비활성이고 자체 분석 서버·DB 용량을
추가하지 않으며, 운영 gate를 통과한 환경에서 Web의 동의 기반 외부 tag로만 활성화한다.

## 2. 사업자 비교

### 컴퓨트

| 후보 | 위치·사양 | 월 기준 | 장점 | 위험·판단 |
| --- | --- | ---: | --- | --- |
| OCI Always Free A1 | 서울, ARM64 `2 OCPU / 12GB`, block 총 200GB 한도 내 | `$0` | 한국 지연시간, 충분한 RAM, 무료 | capacity 부족 가능, 무료 지원 없음, 계정·정책 의존. 검증용 1순위 |
| AWS Lightsail | 서울, `2 vCPU / 2GB / 60GB / 3TB` | `$12` | 낮은 지연, 단순 가격, 전환 쉬움 | OCI보다 비싸고 2GB가 빠듯함. 유료 fallback 1순위 |
| AWS Lightsail | 서울, `2 vCPU / 4GB / 80GB / 4TB` | `$24` | 여유 있는 단일 서버 | 초기에는 과함. 메모리 지표 초과 시 전환 |
| Hetzner CPX12 | 싱가포르, shared AMD | 약 `$17.99` + IPv4 선택 비용 | 단순 VPS, 유럽 대비 가까움 | 2026-06 가격 인상 후 Lightsail 서울보다 비싸고 지연도 큼. 제외 |
| Hetzner CX23 | 독일, `2 vCPU / 4GB / 40GB` | 약 `$4.09` + IPv4 | 매우 저렴 | 한국 cache miss·관리 작업 지연이 큼. 개발·백업용 외에는 제외 |
| Oracle AMD Micro | 서울, 최대 2개 `1GB` VM | `$0` | x86 무료 | 각 1GB로 Nuxt+API+PostgreSQL 통합 운영에 부족. A1 실패 시도용 |

공식 근거:

- [OCI Always Free 자원](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm): A1 월 무료량은 현재 `2 OCPU/12GB` 상당이며 block volume 총 200GB와 host capacity 제한을 명시한다.
- [OCI 리전](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm): 서울 `ap-seoul-1`과 춘천 리전을 제공한다.
- [Lightsail bundle 가격](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html): 2GB `$12`, 4GB `$24` 계획을 제공한다.
- [Lightsail 리전](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html): 서울 `ap-northeast-2`를 지원한다.
- [Hetzner 2026 가격 변경](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/): 싱가포르 CPX12 신규 가격은 `$17.99`로 공지됐다.
- [Hetzner 위치](https://docs.hetzner.com/cloud/general/locations/): 아시아 위치는 싱가포르다.

### DNS·CDN·관리자 접근

| 서비스 | M0 사용 | 월 예상 |
| --- | --- | ---: |
| Cloudflare Free | DNS, CDN, Universal SSL, DDoS 방어 | `$0` |
| Cloudflare Tunnel | origin inbound port 제거 | `$0` 범위 |
| Cloudflare Access Free | 1~2명 운영자 route 보호 | `$0` |

Cloudflare Free는 개인·취미 프로젝트에 `$0` CDN·DNS·SSL을 제공하고, Zero Trust Free는 50명 미만 팀에 `$0`이다.

- [Cloudflare application plan](https://www.cloudflare.com/plans/)
- [Cloudflare Zero Trust 가격](https://www.cloudflare.com/plans/zero-trust-services/)

Cloudflare 장애가 공개 origin 전체 장애로 이어질 수 있는 의존성을 수용한다. M0에서 이중 CDN은 비용과 운영 복잡도에 비해 이득이 작다.

### 이미지·백업 저장소

| 후보 | 가격·무료 구간 | 판단 |
| --- | --- | --- |
| Cloudflare R2 Standard | 10GB-month, Class A 100만, Class B 1,000만/월 무료; egress 무료 | 기본 선택 |
| Backblaze B2 | 첫 10GB 무료, 이후 약 `$6.95/TB-month`; egress 정책 별도 | R2 정책 변경 시 대안 |
| VM local disk | VM 요금 포함 | 임시 staging만 허용, 유일 원본 금지 |
| AWS S3 | 안정적이지만 storage·request·egress 분리 과금 | M0 비용상 제외 |

- [Cloudflare R2 가격](https://developers.cloudflare.com/r2/pricing/)
- [Backblaze B2 가격](https://www.backblaze.com/cloud-storage/pricing)

R2 bucket은 공개 범위와 자격증명을 분리하기 위해 세 개로 나눈다.

```text
blariyo-media-public
  posts/{postId}/{imageId}-{sha256}.{ext}

blariyo-media-private
  drafts/{postId|draftId}/{uuid}
  staging/YYYY/MM/DD/{uploadRequestId}/{fileIndex}-{sha256}.{ext}

blariyo-backup
  postgresql/daily/YYYY/MM/DD/{timestamp}.dump.age
  manifests/{timestamp}.json
```

공개 key는 이미지 자산 ID를 포함해 같은 게시글 안의 동일 hash 이미지도 별도 자산으로 유지한다. 같은 자산의 재시도는 같은 key를 사용한다. 이는 데이터 모델의 중복 hash 허용과 공개 key UNIQUE 제약을 함께 만족한다.

`blariyo-media-public`에만 이미지 custom domain을 연결한다. private media와 backup bucket은 public access와 custom domain을 모두 차단한다. 발행 시 검증된 private 원본을 public bucket으로 copy하고 DB에 public key를 추가하되 private 원본 key는 복구·재공개를 위해 유지한다.

발행 복사는 private 전용 key의 `GetObject`와 public 전용 key의 `PutObject`로 수행한다.
하나의 key에 두 bucket 권한이 필요한 `CopyObject`는 사용하지 않는다. Core는 이미지를 한 건씩
읽어 공개본을 저장하고 원본 bytes와 Content-Type·Cache-Control 등 object metadata를 유지한다.
읽기 또는 쓰기 실패는 발행 실패로 전달하며, 결정적 public key에 대한 재시도·보상 삭제는 기존
게시글 발행 transaction/outbox 계약을 따른다. 이 방식은 Core를 경유하는 전송과 파일별 메모리를
사용하므로 동시 발행 부하는 실제 운영 전 검증한다.

## 3. 권고 배포안

### A안: 자본 최소화 검증안

```text
Cloudflare Free
  DNS + CDN + SSL + Tunnel + Access
        |
OCI ap-seoul-1 Always Free A1
  2 OCPU / 12GB / ARM64
  Ubuntu 24.04 ARM64
  boot volume 100GB 이하
  Docker Compose
    cloudflared
    nginx
    web
    api
    postgresql
    backup job
        |
Cloudflare R2 Standard
  public media + private original + encrypted DB backup

운영자 로컬 PC
  collector
    -> Discord API/Webhook
    -> 등록된 수집 출처
    -> Blariyo BE collector API
```

월 예상:

| 항목 | 예상 |
| --- | ---: |
| OCI compute·block | `$0` Always Free 한도 내 |
| Cloudflare Free·Access·Tunnel | `$0` |
| R2 | `$0` 10GB·operation 무료 구간 내 |
| 합계 | `$0` |

전제:

- OCI home region을 서울로 만들고 A1 capacity를 확보한다.
- Always Free 표시가 붙은 shape·volume만 사용한다.
- compartment quota와 budget alert로 유료 자원 생성을 막는다.
- ARM64용 Docker image를 CI에서 빌드한다.
- 무료 계정만 사용하면 공식 지원 ticket이 없다는 점을 수용한다.

### B안: 유료 안정 fallback

```text
Cloudflare Free
        |
AWS Lightsail Seoul
  2 vCPU / 2GB / 60GB
  Ubuntu 24.04 x86_64
  2GB swap
  Docker Compose 동일
        |
Cloudflare R2 Standard
```

월 예상:

| 항목 | 예상 |
| --- | ---: |
| Lightsail 2GB | `$12` |
| Cloudflare | `$0` |
| R2 초기 무료 구간 | `$0` |
| 합계 | `$12` |

2GB 운영 제한:

- 서버에서 Nuxt·Docker image를 build하지 않는다.
- PostgreSQL `shared_buffers`는 `192MB`, `work_mem`은 `4MB`, `maintenance_work_mem`은 `64MB`로 시작하고 실제 메모리 p95와 query plan으로 조정한다.
- PostgreSQL `max_connections`는 `30`, API pool은 instance당 `10`으로 제한한다.
- web·api container memory limit을 각각 `384MB`, `256MB`로 시작한다.
- swap은 장애 완화용이며 지속적인 swap 사용은 4GB 전환 신호다.
- 최근 7일 메모리 p95가 80%를 넘거나 OOM 1회 발생 시 4GB `$24`로 올린다.

### 선택 결론

2026-09-20 사용자가 선택한 **B안 Lightsail 서울 2GB**로 공개 배포했다. 고정 IP는 추가하지 않고
Tunnel을 사용한다. A안과 위 사업자·가격 표는 과거 비교 자료이며 현재 운영 위치를 뜻하지 않는다.
실제 메모리·OOM·swap 지표를 관찰한 뒤 증설을 판단한다. 저트래픽이라는 예상만으로 용량을
보장하거나 운영 측정 없이 4GB로 올리지 않는다. 실제 결과는
[현재 운영 상태](../implementation/operations/current-status.md)를 따른다.

## 4. 네트워크 설계

```text
Internet
  -> Cloudflare edge
      -> cloudflared outbound tunnel
          -> nginx:8080
              -> web:3000
                  -> api:4000
                  -> postgresql:5432
```

- VM cloud firewall inbound rule은 기본 `deny all`이다.
- `cloudflared`의 터널 연결은 Cloudflare 지정 목적지의 outbound `7844/UDP`(QUIC) 또는 `7844/TCP`(HTTP/2)를 허용한다. 업데이트·관리 API 등 HTTPS 통신의 `443/TCP`와 구분한다. 목적지 목록은 [공식 Tunnel 방화벽 요구사항](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/)을 배포 시 확인한다.
- 긴급 복구 SSH가 필요하면 운영자 고정 IP에만 22를 임시 허용하고 작업 후 닫는다.
- PostgreSQL·Nuxt·Nest Core container port는 host public interface에 bind하지 않는다.
- Docker network를 `edge`, `app`, `data`로 분리한다.
- `edge`에는 `cloudflared`·`nginx`·`web`, `app`에는 `web`·`api`, `data`에는 `api`·`postgresql`만 연결한다.
- Nginx에는 `api` upstream을 두지 않는다. `web`만 `api`에, `api`만 `postgresql`에 접근한다.
- [Nginx 준비 구성](../../deploy/gateway/README.md)은 별도 `blariyo-gateway` project에서 기존
  `blariyo-app_edge`에만 연결하고 host port를 열지 않는다. Web 주소 재조회·header 전달·내부 경로
  차단은 로컬 격리 검사 대상이며 실제 Tunnel 연결·Access 검증은 별도다.
- 로컬 collector는 Tunnel→Nginx→Web의 `/api/collector/v1/*` 전용 중계를 사용한다. Web이 Core `/internal/collect/*`로 매핑하며 token 검증은 Core CollectorAuth가 수행한다. 경계·허용 목록은 [아키텍처](./01-system-architecture.md)의 Collector 전용 중계를 따른다.
- backup job은 `postgresql`과 R2 endpoint에만 접근한다.
- 외부 사이트로 나가는 수집 outbound HTTP는 운영자 로컬 collector에서만 허용한다. `web`, `api`,
  `nginx`, `postgresql`은 수집 대상 외부 사이트를 호출하지 않는다. Web의 Access 서명 공개키 조회와
  Core의 R2·Cloudflare 캐시 API 호출은 운영에 필요한 provider HTTPS 통신으로 별도 허용한다.
- 수집 요청은 등록된 출처 host로만 나가고, 사설·loopback·link-local·metadata 주소(`169.254.169.254` 포함)로 해석되는 대상은 로컬 collector가 차단한다.

## 5. Docker Compose 자원 기준

### OCI A1

| container | CPU limit | memory limit |
| --- | ---: | ---: |
| cloudflared | 0.25 | 128MB |
| nginx | 0.25 | 128MB |
| web | 1.00 | 768MB |
| api | 0.75 | 512MB |
| postgresql | 1.25 | 2GB |
| backup 단발성 | 0.50 | 512MB |

합계 limit은 물리 CPU보다 클 수 있지만 reservation은 설정하지 않는다. PostgreSQL과 SSR이 동시에 폭주하지 않는 M0 저트래픽을 전제로 한다.

### Lightsail 2GB

| container | memory limit |
| --- | ---: |
| cloudflared + nginx | 192MB 합계 |
| web | 384MB |
| api | 256MB |
| postgresql | 768MB |

OS page cache와 daemon을 위해 나머지를 남긴다. memory limit 초과 재시작을 숨기지 않고 알림 대상으로 둔다.

Web·Core의 [앱 계층 Compose](../../deploy/application/compose.yaml)와
[운영 입력 분리 도구](../../deploy/application/README.md#webcore-운영-입력-묶음)는 이 기준의 로컬 준비물이다.
Core `PORT=4000`과 Web `NUXT_CORE_ORIGIN=http://api:4000`을 명시한다. image·Nginx·Tunnel 연결은
별도 준비 대상이며, 입력 검사 통과를 실제 기동·자원 적정성 검증으로 보지 않는다. `data`는 기존
DB project의 internal network `blariyo-db_data`를 external 참조하고 Web은 연결하지 않는다.
`edge`·`app` bridge의 outbound 목적지 제한은 아직 구현하지 않았다.

[앱 서버 보관 도구](../../deploy/application/README.md#서버에-image와-설정-보관)는 검증된 image와
운영 입력을 `/opt/blariyo/application/release-*`에 설치하는 별도 단계다. archive 해시·image
실행 설정과 layer 식별자·비루트 secret 읽기를 확인하며, 앱 서비스 기동·정책 발행·Nginx/Tunnel
연결은 수행하지 않는다. `STAGED_NO_SERVICES` 표시는 공개 배포나 운영 검증 완료를 뜻하지 않는다.

PostgreSQL 18 공식 image는 영속 volume을 `/var/lib/postgresql`에 mount하고 내부 `PGDATA`는 `/var/lib/postgresql/18/docker`를 사용한다. PostgreSQL 17 이하의 `/var/lib/postgresql/data` 경로를 재사용하지 않는다. major upgrade는 새 volume과 `pg_upgrade` 또는 검증된 logical restore 절차로 수행한다.

Lightsail x86_64의 PostgreSQL 단독 설치 파일은 [DB Compose](../../deploy/postgresql/compose.yaml)와
[설치 절차](../../deploy/postgresql/README.md)에 있다. 별도 `blariyo-db` project의 영속 volume·
내부 data network를 사용하며 기존 Tunnel project와 분리한다. 검증한 PostgreSQL 18 image를
digest와 `linux/amd64`로 고정한다. 초기 자원값은 위 기준을 따르고 memory+swap 총량은 1GiB,
shared memory는 256MiB, 종료 유예는 60초로 둔다. 실제 트래픽에 대한 용량 보장은 별도 측정한다.
설정·원본 비밀번호 파일은 `/opt/blariyo/postgresql`에서 관리하고 SSH 설치는 기존에 신뢰한
host key와 서버 hostname을 확인한다. DB 설치만으로 app migration·테이블 권한·앱 배포가
완료된 것으로 판단하지 않는다.

최초 application schema 구성은 [초기 migration 도구](../../deploy/postgresql/migrate-server.py)로
분리한다. 맥에서 빌드·검증한 amd64 API image를 전달하고, DB만 연결된 data network에서
UID 1000의 일회성 container로 V001–V005를 적용한다. migrator credential만 임시 secret volume에
읽기 전용 mount하며 memory limit은 API와 같은 256MiB다. 적용 전 로컬 관리 dump를 보관하고
ledger checksum·테이블 권한을 확인한다. 이 관리 사본은 정기 암호화 R2 백업을 대신하지 않는다.
최초 적용과 동일 묶음의 재시도에만 사용하며 운영 중 release migration·무중단 배포는 별도 절차다.

정책 초기 데이터는 스키마 migration 뒤 [정책 seed SQL](../../deploy/postgresql/seed-policy-drafts.sql)을
실행해 등록한다. 연락처는 비공개 설정에서 주입하며 draft.2 본문은 `docs/legal/m0-core/draft-2/`를 사용한다.
미확정 정책은 `DRAFT`와 빈 시행일로만 등록한다. 같은 버전·본문의 재실행은 중복을 만들지 않고,
같은 버전의 내용이 달라지면 거부한다. 기존 `EFFECTIVE` 정책을 덮어쓰거나 기동 검사를 우회하지 않는다.
Docker의 빈 volume 초기화 hook 대신 migration 이후 별도 seed 단계로 실행하므로 이미 만들어진
운영 DB에도 적용할 수 있다. V001–V005와 기존 migration checksum은 변경하지 않는다.

## 6. 환경 분리

| 환경 | 구성 |
| --- | --- |
| local | 개발 PC Compose, local PostgreSQL, local filesystem 또는 R2 test bucket |
| test | CI service PostgreSQL, 외부 R2 호출 없이 fake adapter |
| production | OCI 또는 Lightsail 단일 VM, 공개 media·비공개 원본·backup R2 bucket |

M0에서는 별도 상시 staging 서버를 두지 않는다. 배포 후보는 CI 통합 테스트와 production의 `preview` Compose project에서 ephemeral smoke test 후 전환한다.

수집 보조 환경은 BE·FE runtime과 분리한다. 운영자 로컬 PC에서 `collector`를 실행하고, Discord bot
token·webhook URL·collector service token은 서버 `.env`와 별도 secret으로 관리한다. production
서버는 collector가 없어도 공개 읽기, 관리자 수동 작성, 예약 발행과 백업을 계속 수행해야 한다.

환경 변수는 다음 범주로 나눈다.

```text
browser public config
  SERVICE_PUBLIC_BASE_URL=https://blariyo.com/
  IMAGE_ORIGIN=(배포 시 확정한 public media origin)
  NUXT_PUBLIC_SITE_NAME
  NUXT_PUBLIC_HOME_TAGLINE
  NUXT_PUBLIC_HOME_TITLE
  NUXT_PUBLIC_HOME_DESCRIPTION
  NUXT_PUBLIC_HOME_OG_DESCRIPTION
  NUXT_PUBLIC_FOOTER_TAGLINE
  NUXT_PUBLIC_KAKAO_SHARE_ENABLED
  NUXT_PUBLIC_KAKAO_SDK_SCRIPT_URL
  NUXT_PUBLIC_KAKAO_SDK_SRI
  NUXT_PUBLIC_KAKAO_JS_KEY
  NUXT_PUBLIC_GA4_ENABLED
  NUXT_PUBLIC_GA4_MEASUREMENT_ID

server runtime config
  NUXT_TRUSTED_CLIENT_IP_HEADER
  KAKAO_CSP_SCRIPT_HOST
  KAKAO_CSP_CONNECT_HOST
  BLARIYO_OPERATOR_DISPLAY_NAME
  BLARIYO_GENERAL_CONTACT_EMAIL
  BLARIYO_RIGHTS_CONTACT_EMAIL
  BLARIYO_PRIVACY_CONTACT_EMAIL
  BLARIYO_PRIVACY_OFFICER_NAME
  BLARIYO_PRIVACY_OFFICER_TITLE
  BLARIYO_PRIVACY_DEPARTMENT
  BLARIYO_BUSINESS_NAME
  BLARIYO_REPRESENTATIVE_NAME
  BLARIYO_BUSINESS_REGISTRATION_NUMBER
  BLARIYO_MAIL_ORDER_REGISTRATION_NUMBER
  BLARIYO_OPERATOR_ADDRESS
  BLARIYO_OPERATOR_PHONE
  COLLECT_USER_AGENT
  COLLECT_MANUAL_URL_ENABLED
  COLLECT_DISCORD_COMMAND_ENABLED
  COLLECT_LIST_CRAWL_ENABLED
  COLLECT_FETCH_TIMEOUT_MS
  COLLECT_MAX_RESPONSE_BYTES
  DB_HOST
  DB_PORT
  DB_NAME
  APP_DB_USER
  MIGRATION_DB_USER
  BACKUP_DB_USER

runtime secret
  APP_DB_PASSWORD_FILE
  MIGRATION_DB_PASSWORD_FILE
  BACKUP_DB_PASSWORD_FILE
  SERVICE_TOKEN
  NUXT_SERVICE_TOKEN
  NUXT_ACTOR_SECRET
  NUXT_ADMIN_AUTH_MODE
  NUXT_ADMIN_OPERATORS_FILE
  NUXT_ACCESS_AUDIENCE
  NUXT_ACCESS_ISSUER
  R2_ENDPOINT
  R2_PRIVATE_ACCESS_KEY_ID
  R2_PRIVATE_SECRET_ACCESS_KEY
  R2_PRIVATE_BUCKET
  R2_PUBLIC_ACCESS_KEY_ID
  R2_PUBLIC_SECRET_ACCESS_KEY
  R2_PUBLIC_BUCKET
  R2_BACKUP_ACCESS_KEY_ID
  R2_BACKUP_SECRET_ACCESS_KEY
  R2_BACKUP_BUCKET
  BACKUP_AGE_RECIPIENT
  CF_ZONE_ID
  CF_CACHE_PURGE_TOKEN
```

`SERVICE_PUBLIC_BASE_URL`의 production 값은 `https://blariyo.com/`이다. `IMAGE_ORIGIN`은 public
media custom domain을 배포할 때 확정하며 이 문서에서 실값을 추측하지 않는다. `browser public config`는
브라우저에 전달해도 되는 값만 둔다. 홈·OG·푸터 카피는
`NUXT_PUBLIC_SITE_NAME`, `NUXT_PUBLIC_HOME_TAGLINE`, `NUXT_PUBLIC_HOME_TITLE`,
`NUXT_PUBLIC_HOME_DESCRIPTION`, `NUXT_PUBLIC_HOME_OG_DESCRIPTION`,
`NUXT_PUBLIC_FOOTER_TAGLINE`으로 주입하며 [카피 계약](../planning/06-copy-contract.md)의 값을 사용한다.

`NUXT_TRUSTED_CLIENT_IP_HEADER`는 조회 수 endpoint의 IP 제한에 사용할 단일 header 이름이며
Cloudflare Tunnel 운영값은 `cf-connecting-ip`다. server runtime config는 비밀값은 아니지만
브라우저로 자동 노출하지 않는 운영 설정이다.

`NUXT_PUBLIC_KAKAO_JS_KEY`, `NUXT_PUBLIC_KAKAO_SDK_SCRIPT_URL`, `NUXT_PUBLIC_KAKAO_SDK_SRI`와
`NUXT_PUBLIC_GA4_MEASUREMENT_ID`는 브라우저에 전달되는 공개 설정으로 비밀값이 아니지만 승인된
도메인·provider 설정과 함께 변경 이력을 관리한다. 실제 Kakao JavaScript key와 개발자 콘솔 Web
domain 등록을 확인하고 SDK URL·SRI·CSP host를 고정하기 전에는
`NUXT_PUBLIC_KAKAO_SHARE_ENABLED=false`로 배포한다. GA4 Measurement ID·속성 보관 설정·국외이전
고지·실제 Google 계약 법인·Google tag/CSP domain 중 하나라도 확정되지 않으면
`NUXT_PUBLIC_GA4_ENABLED=false`로 배포한다. gate 충족 여부와 관계없이 flag가 false인 환경은
`NUXT_PUBLIC_GA4_MEASUREMENT_ID`를 public runtime config에서 unset해 응답 payload와 client bundle에
provider 값을 노출하지 않는다. GA4를 켠 환경에서도
저장된 분석 동의 전에는 Google tag/request와 cookieless ping을 만들지 않는다. `COLLECT_USER_AGENT`는 블라리요를
식별할 수 있는 문자열과 연락 수단을 포함한다. `COLLECT_MANUAL_URL_ENABLED`는 관리자 화면 URL 지정, `COLLECT_DISCORD_COMMAND_ENABLED`는 Discord
`/collect url` 명령의 전체 차단 스위치다. 두 경로 모두 입력된 단일 상세 페이지 1건만 처리한다.
`COLLECT_LIST_CRAWL_ENABLED`는 legacy API 후보 호환 경로의 비활성 flag다. direct batch는 source별 `HOT_LIST`,
`DETAIL_ONLY`, `BLOCKED`, `UNVERIFIED` policy와 batch config를 사용한다. 출처별 요청 간격·일일
상한·robots 확인 결과는 환경변수가 아니라 `collect.source` 데이터로 관리한다.

`NUXT_ADMIN_OPERATORS_FILE`은 외부 identity를 안정적인 내부 `operatorId`로 매핑하는 파일 경로다. 운영자가 여러 명일 수 있으므로 단일 값 환경변수를 사용하지 않는다. 파일은 `{"identity": "<외부 식별값>", "operatorId": "<내부 식별자>", "active": true}` 항목의 목록이며 BFF container에만 읽기 전용으로 mount한다. identity를 제거해도 기존 `operatorId`는 재사용하지 않고 감사 이력을 보존한다. provider를 교체하면 identity 값만 새 provider 기준으로 바꾸고 `operatorId`는 유지한다.

Access 모드는 `NUXT_ADMIN_AUTH_MODE=access`로 설정한다. `NUXT_ACCESS_ISSUER`는
`https://<team>.cloudflareaccess.com` 전체 URL, `NUXT_ACCESS_AUDIENCE`는 관리자 Access
애플리케이션의 AUD다. `identity`에는 서명 검증된 JWT의 `sub`를 사용하며 이메일을 대신 넣지 않는다.
목록은 모든 항목의 identity·operatorId가 앞뒤 공백이 없는 비어 있지 않은 문자열이고
active가 boolean이어야 한다.
identity 중복 또는 잘못된 목록 형식은 접근을 거부한다. `active: true`인 등록 사용자만 허용하며
비활성 사용자·미등록 사용자와 과거 subject→operatorId 객체 형식은 거부한다.
Core의 `SERVICE_TOKEN`과 BFF의 `NUXT_SERVICE_TOKEN`에는 같은 내부 서비스 인증키를 주입한다.
실제 Core 실행 코드가 읽는 이름은 `SERVICE_TOKEN`이며 `CORE_SERVICE_TOKEN`은 사용하지 않는다.
`NUXT_ACTOR_SECRET`은 내부 운영자 ID를 HMAC으로 가명화하는 BFF 전용 키이며 서비스 인증키와
다른 값으로 생성한다. 두 키는 각각 암호학적으로 안전한 난수 32바이트 이상으로 생성하며,
Access JWT 또는 Cloudflare API 토큰으로 대체하지 않는다. Core에는 `SERVICE_TOKEN`만,
BFF에는 `NUXT_SERVICE_TOKEN`과 `NUXT_ACTOR_SECRET`을 전달한다. 키를 함께 보관하는 로컬 파일을
두 container의 `env_file`에 통째로 연결하지 않는다.

DB username은 각 역할의 고정된 비밀 아닌 설정이고 password 값은 환경변수에 직접 넣지 않는다. API와 application command에는 `APP_DB_*`, migration 단발성 container에는 `MIGRATION_DB_*`, backup container에는 `BACKUP_DB_*`만 주입한다. 각 `*_PASSWORD_FILE`은 해당 container에만 읽기 전용으로 mount한 secret 경로이며 세 역할은 credential을 재사용하지 않는다.

API·application command는 `APP_DB_USER=blariyo_app`, migration command는
`MIGRATION_DB_USER=blariyo_migrator`를 사용한다. `DB_HOST`·`DB_NAME`은 필수이며
`DB_PORT`의 기본값은 `5432`다. 해당 역할의 `*_PASSWORD_FILE`은 container 내부 절대경로이며
그룹·타인 접근 및 실행 권한이 없는 일반 파일이어야 한다. 비밀번호는 32~256자의 공백 없는
ASCII 문자열로 읽고, 생성 도구는 난수 32바이트를 64자리 hex 문자열로 저장한다.
연결 URL은 프로세스 메모리 안에서만 구성한다. production에서는 `DATABASE_URL`, `PGPASSWORD`,
역할별 `*_DB_PASSWORD` 직접 입력을 거부하고, 다른 역할의 사용자·비밀번호 파일 설정도 함께
주입하지 않는다. 로컬·테스트의 기존 `DATABASE_URL` 경로는 유지하되 파일 설정과 혼합하지 않는다.
이 입력 검사는 DB 안의 실제 역할 권한을 검증하지 않으므로 초기화·GRANT 후 별도 접속 검증이 필요하다.

private media·public media·backup credential은 서로 다른 bucket에만 접근할 수 있는 별도 key다.
Core는 `R2_PRIVATE_*`와 `R2_PUBLIC_*`만 사용하고 backup key는 backup 작업에만 주입한다.
공용 `R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`로의 fallback은 허용하지 않는다.
`BACKUP_AGE_RECIPIENT`는 암호화용 공개 recipient이며 복호화 private key는 서버 환경변수에 두지
않고 서버와 다른 위치에 오프라인 보관한다. `.env`는 서버에서 root만 읽을 수 있게 두고
저장소·Docker image·CI log에 넣지 않는다.

## 7. 빌드와 배포

현재 단일 VM 순차 교체 방식이며 무중단 배포는 아니다. 상세 결정과 적용 조건은
[배포 정책](../implementation/operations/deployment-policy.md), 실제 순서는
[실서버 배포 실행서](../implementation/operations/deployment-runbook.md)를 따른다.
GitHub workflow는 로컬 작성 상태이며 원격 실행·자동 CD 활성화와 구분한다.

1. CI가 Node `24.18.0`에서 타입·lint·unit·integration·브라우저 test를 실행한다.
2. 검사된 main의 `linux/amd64` image를 commit SHA tag로 build한다. 현재 서울 x86_64 대상이며 arm64는 대상 서버가 생기면 추가한다.
3. GHCR에 push하고 digest를 기록한다. main push만으로 운영 서버에 자동 배포하지 않는다.
4. 서버는 image를 pull하고 DB backup을 실행한다.
5. backward-compatible migration을 적용한다.
6. `api`, `web`을 순서대로 recreate한다.
7. `/health/live`, `/health/ready`, `/meme`, 공개 상세 smoke를 실행한다.
8. 실패하면 이전 image tag로 rollback한다. schema가 비호환이면 자동 rollback하지 않고 복구 절차를 따른다.

서버에서 `npm install`과 build를 실행하지 않는다. 배포 파일에는 image digest를 기록한다.

초기 Lightsail 준비에서는 registry 구성 전까지 로컬에서 고정한 source snapshot으로
`linux/amd64` Web·Core image를 build하고 Docker save archive로 준비할 수 있다.
이때 Git HEAD만으로 미커밋 변경을 표현하지 않는다. snapshot 파일별 SHA-256·전체 source hash,
Git dirty 여부, 각 local image ID·config digest, archive SHA-256과 수행한 격리 검증을 기록한다.
Docker classic store의 image ID는 config digest지만 containerd store는 OCI index/manifest digest를
표시할 수 있으므로 종류를 구분하고 archive의 해시 연결을 검증한다. 사본 build 뒤 원본 source가
달라지면 완료 처리하지 않는다.
운영 비밀 파일은 build context에 넣지 않고 실행 시 별도로 주입한다. archive 준비와 격리 검증은
서버 전송·DB 정책 발행·실제 배포 승인을 대신하지 않는다.

## 8. 저장 공간 예산

초기 이미지 가정:

```text
하루 30개 게시글
게시글당 이미지 1.5개
최적화 이미지 평균 350KB
public 배포본 월 약 0.47GB
private canonical 원본 포함 월 약 0.94GB
```

수집 후보 metadata와 별도로 관리자 preview는 private bucket의
`collect-preview/{candidateId}/{candidateImageId}/{uploadId}`에 최대 24시간 저장한다. public domain을
연결하지 않고 인증된 관리자 proxy로만 읽는다. 반려·만료·재시도 교체·승격 시 삭제하며 24시간 TTL
청소는 후보 30일 보존과 독립적으로 실행한다. cleanup 실패는 outbox·운영 알림으로 추적한다.
preview 저장량과 PUT/GET/DELETE 비용은 위 영구 원본 예산에 포함되지 않으므로 수집 보조 활성화 때
별도 산정한다. 로컬 임시 파일도 같은 생명주기에 맞춰 collector가 삭제한다. source가 검증되지 않아
실제 후보량과 preview 평균 크기는 `(미정)`이며 활성화 전 비용 검증 항목이다.

M0 기본은 다음과 같다.

- 사용자가 올린 raw bytes는 검증·재인코딩 후 보관하지 않는다.
- 재인코딩한 private canonical 원본과 public 배포본을 유지해 숨김·재공개를 지원한다.
- 업로드 요청이 만드는 미연결 object는
  `staging/YYYY/MM/DD/{uploadRequestId}/{fileIndex}-{sha256}.{ext}`에 둔다. key에는 원본 파일명·관리자
  identity를 넣지 않는다. `uploadRequestId`는 서버가 생성한 불투명한 고유값이고 SHA-256은 재인코딩한
  bytes 기준이다. `objectCreatedAt`은 provider metadata 또는 inventory timestamp로 확인한다.
- 다중 업로드 실패 시 DB transaction을 rollback한 뒤 이미 저장한 object를 즉시 보상 삭제한다. 삭제가
  실패하면 rollback과 분리된 cleanup transaction에서 private key 기반 `OBJECT_DELETE_PRIVATE` outbox를
  commit한다. rollback된 image ID를 aggregate나 payload에 넣지 않는다.
- 매일 inventory는 생성 후 24시간이 지난 `staging/` object 가운데 DB image row의
  `private_storage_key`와 미완료(`PENDING`,`RUNNING`,`FAILED`,`DEAD`) cleanup outbox의
  `privateStorageKey` 어느 쪽에도 없는 key만 orphan으로 삭제한다. process crash로 보상 삭제와 outbox가
  모두 남지 않은 object도 이 경계로 회수한다.
- `REMOVED` 게시글의 private canonical 원본은 30일 복구 유예 뒤 삭제한다.
- image당 최대 10MiB, 한 게시글 최대 20개로 제한한다.
- R2 저장량 7GB에서 알림, 9GB에서 새 업로드 차단 또는 유료 전환을 결정한다.
- DB backup은 12시간 간격 최근 28개(14일), weekly 8개를 유지하고 총 4GB 예산을 잡는다.

## 9. 비용 전환 기준

| 지표 | 조치 |
| --- | --- |
| OCI A1 생성 불가 3일 | Lightsail 2GB 생성 |
| 월 infra 예상 `$15` 초과 | 비용 원인 검토 후 승인 없이는 신규 유료 자원 금지 |
| R2 7GB | 저장 추세·원본 retention 점검 |
| R2 9GB | 유료 전환 또는 orphan·복구 유예 만료 원본 삭제 검증 |
| Lightsail OOM 1회 | 원인 확인, 재발 가능하면 4GB 전환 |
| swap 사용 15분 이상 지속 | 4GB 전환 검토 |
| 월 transfer 70% | CDN cache와 이미지 크기 검토 |
| 복구 4시간 초과 2회 | 유료 VM·snapshot 또는 DB 분리 검토 |

무료 구간을 유지하기 위해 사용자 요청 실패, 데이터 삭제, 보안 완화를 선택하지 않는다. 한도를 넘으면 기능을 망가뜨리는 대신 명시적으로 유료 전환한다.

## 10. 공급자 이전

OCI와 Lightsail은 같은 Compose·환경 변수·multi-arch image를 사용한다.

이전 절차:

1. 새 VM 준비와 tunnel connector 추가
2. 새 PostgreSQL 18에 최신 full backup 복원
3. 기존 BFF·Core를 `MAINTENANCE_READ_ONLY`로 전환해 공개 GET만 허용하고 관리자 command, 정책 시행, 조회 수 증가를 포함한 모든 DB 쓰기를 `503`으로 차단
4. 공개 VM의 scheduler·outbox를 중지하고, 운영자 로컬 Spring collector의 Quartz 신규 실행도 별도로
   중지한 뒤 진행 중 서비스 DB transaction이 종료됐는지 확인
5. 기존 서버에서 최종 full custom-format dump 생성·암호화·checksum 검증
6. 새 PostgreSQL 18을 비우고 최종 full dump를 한 번 복원
7. 새 서버도 쓰기 차단 상태에서 게시글 수·최신 글·정책·상태 이력과 ready·공개 GET smoke 확인
8. Cloudflare tunnel route를 새 connector로 전환
9. 새 서버의 쓰기 차단을 해제하고 쓰기 경로 readiness를 확인한 뒤 공개 VM scheduler·outbox를 재개하고,
   운영자 로컬 Spring collector의 Quartz는 별도 프로세스에서 재개 상태 확인
10. cache purge 후 기존 서버는 read-only로 보존
11. 24시간 관찰 후 기존 VM 삭제

이미지는 R2에 있으므로 compute 이전 시 복사하지 않는다. DNS TTL과 원본 IP 변경도 Cloudflare tunnel 사용으로 최소화한다.

쓰기 차단 응답은 `503 MAINTENANCE_READ_ONLY`, `Retry-After: 60`, `Cache-Control: no-store`를 사용한다. 최종 dump 시작 후 기존 서버에는 조회 수 증가를 포함한 어떤 쓰기도 허용하지 않는다.

## 로컬 Spring 수집 서버 배치 경계

[Spring 수집 서버 상세 설계](07-spring-collector-design.md)에 따라 M0 구현 저장소의 `apps/collector`를
독립 Gradle 애플리케이션으로 두고 운영자 PC에서 실행한다. 공개 VM의 Nuxt·Nest Core·서비스 PostgreSQL
구성은 유지하며 Spring 프로세스를 공개 Compose에 추가하지 않는다.

- collector 실행 저장소는 서비스 DB와 물리적으로 분리한 로컬 PostgreSQL 18이다. 한 local database의
  `batch`·`quartz`·`collector` schema를 versioned migration으로 관리하며
  `spring.batch.jdbc.initialize-schema=never`, `spring.quartz.jdbc.initialize-schema=never`를 운영 기본값으로 둔다.
- 로컬 REST는 `127.0.0.1:18787`에만 bind하고 기존 Tunnel·LAN·public reverse proxy에 연결하지 않는다.
  scope별 인증과 secret 저장 조건은 [보안·운영 설계](05-security-operations.md#spring-수집-전환의-보안운영-조건)를 따른다.
- Quartz 후보 sweep은 `Asia/Seoul` 15분 주기, misfire `DO_NOTHING`, 기본 비활성이다. 실제 출처·quota·
  collector 운영 계정 검증 전에는 활성화하지 않는다.
- macOS 자동 기동은 사용자 `launchd` LaunchAgent를 사용한다. RunAtLoad, crash backoff, 고정 작업 경로,
  JDK·jar 절대 경로, `umask 077`, log rotation, Keychain 접근 가능한 전용 OS 계정과 SIGTERM 90초 전달은
  구현 수용 조건이며 실제 계정·설치 경로·plist와 실행 결과는 아직 미검증이다.
- collector 중단·롤백은 Spring 신규 실행만 끄고 기존 Core/BFF route와 관리자 수동 작성·예약 발행·백업을
  유지한다. Core additive migration은 즉시 drop하지 않고 Python 재가동은 별도 승인·호환 검증 없이 수행하지 않는다.

Spring source·migration·OpenAPI·test·runtime과 실제 출처·Discord·운영 계정은 이 문서 동기화만으로
구현·검증됐다고 보지 않는다.

## 2026-09-20 M0 운영 배포 적용

확정 정책 v0.1을 실제 command로 발행한 뒤 Core·Web·Nginx를 기동했다. blariyo.com의 이전 Squarespace A를 proxied Tunnel CNAME으로 전환하고, www는 같은 Tunnel의 Nginx 308 대표 주소 전환 전용 경로로 연결했다. DB·Core·Web·Nginx의 host port는 없다. 기존 메일 MX/TXT와 R2 media 도메인은 유지했다. Always Use HTTPS와 최소 TLS 1.2를 적용한다.

현재는 **단일 Lightsail + Docker Compose 교체 배포**다. 블루그린·다중 서버·무중단 전환을 구현했다고 하지 않는다. image는 맥에서 빌드한 amd64 digest를 사용한다. 현재 release에 대한 부팅 복구 service와 예약 발행/outbox/cleanup timer, 7일 진단 로그, 12시간 주기 암호화 R2 DB 백업을 설치했다. 상세 검증과 제한은 [운영 기록](../../worklog/task-list/09/20/infrastructure-setup/TASK-19.md)을 따른다.
