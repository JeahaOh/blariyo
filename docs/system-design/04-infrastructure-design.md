# M0 저비용 인프라 설계

- 문서 상태: M0 인프라 설계 계약 · 현행 배포 산출물 없음
- 기준일: 2026-09-03
- 정합성 검토일: 2026-09-03
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
  posts/{postId}/{sha256}.{ext}

blariyo-media-private
  drafts/{postId|draftId}/{uuid}
  staging/YYYY/MM/DD/{uploadRequestId}/{fileIndex}-{sha256}.{ext}

blariyo-backup
  postgresql/daily/YYYY/MM/DD/{timestamp}.dump.age
  manifests/{timestamp}.json
```

`blariyo-media-public`에만 이미지 custom domain을 연결한다. private media와 backup bucket은 public access와 custom domain을 모두 차단한다. 발행 시 검증된 private 원본을 public bucket으로 copy하고 DB에 public key를 추가하되 private 원본 key는 복구·재공개를 위해 유지한다.

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

1. OCI 서울 A1 capacity를 3일 이내 확보할 수 있으면 A안으로 비공개·초기 공개 검증을 시작한다.
2. capacity를 확보하지 못하거나 계정 정지·지원 위험을 받아들이기 어렵다면 B안으로 바로 간다.
3. A안 장애가 2회 반복되거나 복구 시간이 4시간을 넘으면 B안으로 영구 전환한다.
4. Hetzner 싱가포르는 현재 가격에서 Lightsail 서울보다 비용·지연 모두 우위가 없어 선택하지 않는다.

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
- `cloudflared`가 outbound 443으로 연결한다.
- 긴급 복구 SSH가 필요하면 운영자 고정 IP에만 22를 임시 허용하고 작업 후 닫는다.
- PostgreSQL·Nuxt·Express container port는 host public interface에 bind하지 않는다.
- Docker network를 `edge`, `app`, `data`로 분리한다.
- `edge`에는 `cloudflared`·`nginx`·`web`, `app`에는 `web`·`api`, `data`에는 `api`·`postgresql`만 연결한다.
- Nginx에는 `api` upstream을 두지 않는다. `web`만 `api`에, `api`만 `postgresql`에 접근한다.
- backup job은 `postgresql`과 R2 endpoint에만 접근한다.
- 외부 사이트로 나가는 수집 outbound HTTP는 `api` container에서만 허용한다. `web`, `nginx`, `postgresql`은 외부 사이트를 호출하지 않는다.
- 수집 요청은 등록된 출처 host로만 나가고, 사설·loopback·link-local·metadata 주소(`169.254.169.254` 포함)로 해석되는 대상은 adapter가 차단한다.

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
| collect 단발성 | 0.50 | 384MB |

합계 limit은 물리 CPU보다 클 수 있지만 reservation은 설정하지 않는다. PostgreSQL과 SSR이 동시에 폭주하지 않는 M0 저트래픽을 전제로 한다.

### Lightsail 2GB

| container | memory limit |
| --- | ---: |
| cloudflared + nginx | 192MB 합계 |
| web | 384MB |
| api | 256MB |
| postgresql | 768MB |

OS page cache와 daemon을 위해 나머지를 남긴다. memory limit 초과 재시작을 숨기지 않고 알림 대상으로 둔다.

PostgreSQL 18 공식 image는 영속 volume을 `/var/lib/postgresql`에 mount하고 내부 `PGDATA`는 `/var/lib/postgresql/18/docker`를 사용한다. PostgreSQL 17 이하의 `/var/lib/postgresql/data` 경로를 재사용하지 않는다. major upgrade는 새 volume과 `pg_upgrade` 또는 검증된 logical restore 절차로 수행한다.

## 6. 환경 분리

| 환경 | 구성 |
| --- | --- |
| local | 개발 PC Compose, local PostgreSQL, local filesystem 또는 R2 test bucket |
| test | CI service PostgreSQL, 외부 R2 호출 없이 fake adapter |
| production | OCI 또는 Lightsail 단일 VM, 공개 media·비공개 원본·backup R2 bucket |

M0에서는 별도 상시 staging 서버를 두지 않는다. 배포 후보는 CI 통합 테스트와 production의 `preview` Compose project에서 ephemeral smoke test 후 전환한다.

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
  CORE_SERVICE_TOKEN
  NUXT_ADMIN_ACTOR_HMAC_SECRET
  NUXT_ADMIN_IDENTITY_PROVIDER
  NUXT_ADMIN_OPERATOR_MAP_FILE
  NUXT_CLOUDFLARE_ACCESS_AUDIENCE
  NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN
  R2_PRIVATE_ACCESS_KEY_ID
  R2_PRIVATE_SECRET_ACCESS_KEY
  R2_PRIVATE_MEDIA_BUCKET
  R2_PUBLIC_ACCESS_KEY_ID
  R2_PUBLIC_SECRET_ACCESS_KEY
  R2_PUBLIC_MEDIA_BUCKET
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
식별할 수 있는 문자열과 연락 수단을 포함하고, `COLLECT_MANUAL_URL_ENABLED`·
`COLLECT_LIST_CRAWL_ENABLED`는 출처별 설정과 별개인 전체 차단 스위치다. 출처별 요청 간격·일일
상한·robots 확인 결과는 환경변수가 아니라 `collect.source` 데이터로 관리한다.

`NUXT_ADMIN_OPERATOR_MAP_FILE`은 외부 identity를 안정적인 내부 `operatorId`로 매핑하는 파일 경로다. 운영자가 여러 명일 수 있으므로 단일 값 환경변수를 사용하지 않는다. 파일은 `{"identity": "<외부 식별값>", "operatorId": "<내부 식별자>", "active": true}` 항목의 목록이며 BFF container에만 읽기 전용으로 mount한다. identity를 제거해도 기존 `operatorId`는 재사용하지 않고 감사 이력을 보존한다. provider를 교체하면 identity 값만 새 provider 기준으로 바꾸고 `operatorId`는 유지한다.

DB username은 각 역할의 고정된 비밀 아닌 설정이고 password 값은 환경변수에 직접 넣지 않는다. API와 application command에는 `APP_DB_*`, migration 단발성 container에는 `MIGRATION_DB_*`, backup container에는 `BACKUP_DB_*`만 주입한다. 각 `*_PASSWORD_FILE`은 해당 container에만 읽기 전용으로 mount한 secret 경로이며 세 역할은 credential을 재사용하지 않는다.

private media·public media·backup credential은 서로 다른 bucket에만 접근할 수 있는 별도 key다.
`BACKUP_AGE_RECIPIENT`는 암호화용 공개 recipient이며 복호화 private key는 서버 환경변수에 두지
않고 서버와 다른 위치에 오프라인 보관한다. `.env`는 서버에서 root만 읽을 수 있게 두고
저장소·Docker image·CI log에 넣지 않는다.

## 7. 빌드와 배포

1. CI가 Node `24.18.0`에서 lint·unit·integration test를 실행한다.
2. `linux/arm64`, `linux/amd64` multi-arch image를 commit SHA tag로 build한다.
3. container registry에 push한다.
4. 서버는 image를 pull하고 DB backup을 실행한다.
5. backward-compatible migration을 적용한다.
6. `api`, `web`을 순서대로 recreate한다.
7. `/health/live`, `/health/ready`, `/meme`, 공개 상세 smoke를 실행한다.
8. 실패하면 이전 image tag로 rollback한다. schema가 비호환이면 자동 rollback하지 않고 복구 절차를 따른다.

서버에서 `npm install`과 build를 실행하지 않는다. 배포 파일에는 image digest를 기록한다.

## 8. 저장 공간 예산

초기 이미지 가정:

```text
하루 30개 게시글
게시글당 이미지 1.5개
최적화 이미지 평균 350KB
public 배포본 월 약 0.47GB
private canonical 원본 포함 월 약 0.94GB
```

수집 후보는 원문 URL·제목·이미지 후보 URL만 DB에 저장하므로 object storage를 쓰지 않는다. 이미지 저장은 승격 시점에만 발생하고 위 예산에 이미 포함된다. 후보 행은 30일 보존 기준으로 정리한다.

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
4. scheduler·outbox·수집 cron을 중지하고 진행 중 DB transaction이 종료됐는지 확인
5. 기존 서버에서 최종 full custom-format dump 생성·암호화·checksum 검증
6. 새 PostgreSQL 18을 비우고 최종 full dump를 한 번 복원
7. 새 서버도 쓰기 차단 상태에서 게시글 수·최신 글·정책·상태 이력과 ready·공개 GET smoke 확인
8. Cloudflare tunnel route를 새 connector로 전환
9. 새 서버의 쓰기 차단을 해제하고 쓰기 경로 readiness를 확인한 뒤 scheduler·outbox·수집 cron 시작 상태 확인
10. cache purge 후 기존 서버는 read-only로 보존
11. 24시간 관찰 후 기존 VM 삭제

이미지는 R2에 있으므로 compute 이전 시 복사하지 않는다. DNS TTL과 원본 IP 변경도 Cloudflare tunnel 사용으로 최소화한다.

쓰기 차단 응답은 `503 MAINTENANCE_READ_ONLY`, `Retry-After: 60`, `Cache-Control: no-store`를 사용한다. 최종 dump 시작 후 기존 서버에는 조회 수 증가를 포함한 어떤 쓰기도 허용하지 않는다.
