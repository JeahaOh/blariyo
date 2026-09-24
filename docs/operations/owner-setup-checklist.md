# Lightsail·Cloudflare 운영자 체크리스트

- 최초 작성·공식 안내 확인일: 2026-09-10
- 마지막 상태 대조일: 2026-09-24 문서 갱신. 운영 관측은 [9월 23일 배포·DB 반영](current-status.md)을 따르며 서버·계정을 이번에 재조회하지 않았다.
- 상태: M0 공개 배포·정책 발행·API V008/Collector V006 및 콘텐츠 공개·암호화 DB 백업 복원은 당시 확인했다. 실제 Access MFA 관리자 쓰기·장기 관찰은 남아 있다.
- 사용법: [현재 운영 상태](current-status.md)를 먼저 확인한다. 아래 계정 준비 절차는 신규 환경용이며 미체크 항목이 모두 현재 미설정을 뜻하지 않는다.
- OCI와 GA4 절은 대안·후속 기능 준비 자료다. 현재 Lightsail 운영을 위해 추가 가입하거나 GA4를 켤 필요가 없다.

## 1. 먼저 알아둘 구성

**마지막 운영 확인에서 서버는 AWS Lightsail 서울 2GB다. Cloudflare는 도메인·관리자 보호·이미지·백업에 사용한다. GA4·카카오·URL/Discord 접수·자동 수집은 비활성이고 관리자 batch 검수만 활성이다.** 검수 활성은 실제 운영자 인수나 direct 보존·고지 조건 완료를 뜻하지 않는다.

| 구분 | 현재 프로젝트의 결정 | 지금 필요한 계정 |
| --- | --- | --- |
| 서버 | AWS Lightsail 서울 2GB, Docker Compose, 고정 IP 미사용 | 기존 AWS 계정 |
| 과거 대안 | OCI 서울 A1 | 현재 추가 준비 불필요 |
| DNS·HTTPS·서버 연결 | Cloudflare DNS·Tunnel | Cloudflare 계정 |
| 관리자 접근 | Cloudflare Access | 같은 Cloudflare 계정의 Zero Trust 설정 |
| 이미지·DB 백업 | Cloudflare R2 Standard, 용도별 bucket·자격증명 분리 | 같은 Cloudflare 계정에서 R2 활성화 |
| 방문 분석 | GA4, 준비 완료 및 이용자 동의 후에만 수집 | 후속 활성화를 선택할 때 Google 계정과 Analytics 계정/속성 |
| 수집기 | 운영자 PC의 Spring Collector | 이번 서버 준비와 분리 |

이 구성의 정본은 [인프라 계획](../planning/02-infra-plan.md)과
[인프라 설계](../system-design/04-infrastructure-design.md)다. GCP 서버나 별도 managed DB는 현재 계획에 없다.
웹 GA4를 준비하기 위해 GCP 서버·Firebase 앱·Google Tag Manager를 새로 만들 필요도 없다.

## 2. 신규 환경 준비 순서

현재 기준은 Lightsail이다. 기존 계정·버킷·Tunnel을 단순 상태 확인 때문에 다시 만들지 않는다.
OCI 준비는 §4의 과거 대안이며 새 서버의 필수 선행 단계가 아니다.

| 순서 | 내가 할 일 | 다음 단계로 넘어갈 기준 |
| --- | --- | --- |
| 1 | 기존 계정·도메인 관리 권한 확인 | AWS·Cloudflare 로그인과 도메인 DNS 수정 권한 확보 |
| 2 | 기존 Lightsail 서버·관리 접속 확인 | 승인된 대상 identity·x86_64·자원·SSH 경계 확인. 신규 서버가 필요할 때만 별도 준비 |
| 3 | Cloudflare 도메인 연결과 R2 준비 | 도메인 활성, 세 bucket 생성, 공개/비공개 범위 확인 |
| 4 | Access 운영자 허용 범위와 Tunnel 준비 | 개발자가 배포 설정에 연결할 자료 확보 |
| 5 | 개발자와 실제 배포·운영 검증 | 이미지·예약·관리자 인증·백업/복원 정상 |
| 6 | GA4 계정·속성·웹 스트림 준비 | ID와 측정·보관 설정 확보. 아직 운영 수집은 끈 상태 |
| 7 | GA4 고지·설정·실제 네트워크 검증 | 동의 전 0건, 동의 후 허용 이벤트, 철회 후 중단 확인 |

GA4 준비는 2~5번과 병행할 수 있다. GA4를 끈 채 M0를 공개할 수 있으므로 GA4 때문에 서버 준비를 미루지 않는다.
계정이 이미 있다면 기존 계정의 권한과 복구 방법부터 확인한다.

## 3. 계정·도메인 공통 준비

- [ ] **COMMON-01 — 서비스 관리 계정의 소유권을 확보한다.**
  AWS·Cloudflare에 사용할 계정을 확인한다. Google·OCI는 해당 후속 기능·대안을 선택할 때 준비한다. 관리 권한이 다른 사람에게만 있는 상태는 완료가 아니다.
- [ ] **COMMON-02 — 2단계 인증과 복구 수단을 준비한다.**
  인증 수단을 등록하고 복구 코드를 비밀번호 관리자 등 저장소 밖에 보관한다. 로그인 가능한지 확인한다.
- [ ] **COMMON-03 — `blariyo.com` 관리 상태를 확인한다.**
  이미 보유했다면 등록 업체·만료일·네임서버 수정 권한을 확인한다. 미보유라면 구매 가능 여부부터 확인한다.
  코드에 도메인이 적혀 있다는 사실은 실제 소유권을 의미하지 않는다.
- [ ] **COMMON-04 — 비용 알림을 받을 연락 수단을 정한다.**
  결제 정보를 확인하고 각 서비스에서 지원하는 예산·사용량 알림을 설정한다. 알림 설정을 자동 과금 차단으로 간주하지 않는다.

비밀번호, 카드 정보, 복구 코드, SSH 개인키, R2 Secret Access Key, Tunnel token, API token은 이 문서나 Git에 적지 않는다.
이 문서에는 완료 여부·확인 날짜만 남기고, 실제 값은 provider console·비밀번호 관리자·배포 secret 저장소에서 관리한다.

## 4. 과거 OCI 대안 준비 (현재 추가 가입 불필요)

아래 OCI 항목은 9월 10일 검토 이력과 대안 절차다. 현재 Lightsail 선택을 되돌리는 지시가 아니며,
실제로 대안을 재선택할 때 무료 조건·가용 용량·ARM64 image와 비용을 다시 확인한다.

OCI는 Oracle Cloud Infrastructure, VM은 클라우드에서 빌려 쓰는 가상 서버를 뜻한다.

### OCI-01 — Oracle Cloud 계정 가입·로그인

- [ ] [Oracle Cloud 가입](https://signup.cloud.oracle.com/)에서 계정을 준비한다.
- [ ] 연락처·결제 카드 확인 절차를 마친다. 일반 Oracle 웹사이트 계정과 Cloud 서비스 가입을 구분한다.
- [ ] 홈 리전을 **서울**로 확인한다. 서울 선택이 불가능하거나 기존 홈 리전이 다르면 다른 리전으로 임의 진행하지 않고 배포 계획을 다시 확인한다.
- 완료 기준: Cloud Console 로그인과 계정의 홈 리전 확인 완료.

Oracle은 가입 시 카드로 본인 확인을 하며 임시 승인 금액이 표시될 수 있다고 안내한다. Always Free compute는
홈 리전에서 생성해야 한다. [가입 FAQ](https://www.oracle.com/cloud/free/faq/),
[Always Free 공식 조건](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

### OCI-02 — 무료 A1 용량 확보 가능 여부 확인

- [ ] Compute의 인스턴스 생성 화면에서 서울의 `VM.Standard.A1.Flex`를 확인한다.
- [ ] 프로젝트 설계 목표인 **2 OCPU / 12GB RAM**과 현재 계정의 무료 한도·생성 화면의 과금 항목을 대조한다.
- [ ] 부트·추가 디스크를 포함한 저장 용량과 과금 항목을 확인한다. 생성 가능한 모든 용량이 영구 무료인 것은 아니다.
- [ ] 용량 부족이면 최초 확인 날짜와 오류 종류만 기록한다. 정본 기준인 **3일 이내 미확보 시 Lightsail 전환**을 적용한다.
- 완료 기준: 사용할 서버 자원을 확보했거나 AWS 대안으로 전환하기로 결정했다.

무료 한도와 일시 trial credit을 구분한다. 실제 서울 가용 용량은 이 문서에서 확인하지 않았으며 계정 콘솔에서
확인해야 한다. 공식 문서도 가용 자원 부족으로 생성이 실패할 수 있음을 안내한다.
[공식 자원·용량 안내](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

### OCI-03 — 서버 생성과 접속 자료 준비

- [ ] 서버 이름을 정한다. 예: `blariyo-prod`는 제안 이름이며 필수값은 아니다.
- [ ] OS 이미지·디스크 크기·관리 접속 방식은 개발자와 확인한 뒤 서버를 생성한다. A1은 ARM64이므로 배포 이미지도 맞춰야 한다.
- [ ] SSH 방식이면 공개키를 등록하고 개인키는 저장소 밖에 보관한다. 개발자에게 비밀번호나 개인키를 전달하는 대신 필요한 접근 권한을 구성한다.
- [ ] 서버 상태와 승인된 관리 경로로 접속 가능한지 확인한다.
- 완료 기준: 서버가 Running이고 실제 관리 접속에 성공했다. 애플리케이션 배포 완료와는 다르다.

네트워크·방화벽은 개발자와 함께 구성한다. 정본은 기본 inbound 차단, 긴급 SSH는 운영자 IP만 임시 허용,
앱·DB 포트 직접 공개 금지다. Tunnel의 outbound 통신도 필요하다.
[프로젝트 네트워크 계약](../system-design/04-infrastructure-design.md)

### OCI-04 — OCI를 사용할 수 없을 때

- [ ] [AWS 계정 준비 안내](https://docs.aws.amazon.com/lightsail/latest/userguide/setting-up.html)에 따라 계정을 준비한다.
- [ ] 서울 리전 Lightsail 2GB를 대안으로 확인한다. 실제 가격·디스크·전송량·IP 옵션은 생성 시점의 화면에서 확인한다.
- [ ] 유료 서버 사용을 결정한 뒤 생성한다. OCI에 남긴 자원도 따로 확인해 불필요한 과금이 없는지 확인한다.
- 완료 기준: 사용할 서버 사업자가 하나로 확정되고 실제 서버 접속 가능.

## 5. Cloudflare에서 내가 할 일

### CF-01 — 계정과 도메인 연결

- [ ] [Cloudflare Dashboard](https://dash.cloudflare.com/)에 로그인한다.
- [ ] `blariyo.com`을 추가하고 현재 계획인 Free 웹사이트 요금제로 시작한다.
- [ ] 기존 DNS의 A/AAAA/CNAME뿐 아니라 이메일용 MX·TXT 레코드를 확인하고 보존한다.
- [ ] 도메인 등록 업체에서 Cloudflare가 지정한 네임서버로 변경하고 활성 상태를 확인한다.
- 완료 기준: Cloudflare에서 도메인이 활성화되고 기존에 사용하던 이메일·도메인 기능이 유지된다.

도메인 등록 업체를 Cloudflare로 이전하는 것은 필수가 아니다. DNS 연결 과정은
[공식 도메인 연결 안내](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/)를 따른다.

### CF-02 — R2 활성화와 용도별 bucket 확인

- [ ] Dashboard의 **Storage & databases → R2 → Overview**에서 구독·결제 절차를 확인한다.
- [ ] R2를 활성화하고 아래 세 bucket을 생성한다.

| Bucket 이름 | 보관할 것 | 공개 설정 |
| --- | --- | --- |
| `blariyo-media-private` | 초안·비공개 원본 이미지 | 비공개, public URL·custom domain 연결 안 함 |
| `blariyo-media-public` | 발행한 글의 공개 이미지 | 승인된 이미지 custom domain만 연결 |
| `blariyo-backup` | 암호화한 DB 백업과 manifest | 비공개, public URL·custom domain 연결 안 함 |

- [ ] bucket의 저장 위치 관련 설정·실제 처리 사업자를 확인해 운영 정보로 관리한다.
- 완료 기준: 세 bucket이 구분되고 private/backup에 공개 접근이 활성화되어 있지 않다.

이 세 bucket은 초기 Core 구성이다. direct 수집 raw/media/report는 9월 23일 운영 private R2에
보관한 기록이 있다. 별도 PC writer·API media reader의 역할과 prefix 허용/거부는
[direct 환경 계약](environment-configuration.md#9-core-연결과-direct-batch-검수의-실행-경계)을 따른다.
bucket이 이미 있다는 사실로 해당 역할 분리와 원격 쓰기 검증을 통과 처리하지 않는다.

Cloudflare 웹사이트 Free 요금제와 R2 청구는 별개다. R2는 무료 사용량을 포함하는 사용량 기반 서비스이며
활성화에 구독 절차가 있다. [R2 시작 안내](https://developers.cloudflare.com/r2/get-started/)

### CF-03 — 공개 이미지 도메인 결정

- [ ] 현재 운영 이미지 주소 `media.blariyo.com`의 연결 상태를 확인한다. 9월 23일에는 해당 주소의 공개 이미지 308개 다운로드·해시 대조가 통과했다([운영 기록](../../worklog/2026-09-23/release/production-db-promotion.md)). 신규 환경에서는 승인된 같은 주소의 연결 대상을 확인한다.
- [ ] `blariyo-media-public`에만 해당 custom domain을 연결한다.
- [ ] 공개해도 되는 합성 검증 이미지로 HTTPS 접근을 확인한다. 민감한 원본을 시험 파일로 사용하지 않는다.
- [ ] private/backup의 public access가 여전히 꺼져 있는지 재확인한다.
- 완료 기준: 공개 이미지 domain 연결 확인. 실제 앱의 발행·숨김 연동은 배포 후 별도 검증한다.

운영 이미지에는 custom domain을 사용한다. R2의 개발용 공개 URL을 production 이미지 주소로 확정하지 않는다.
[R2 공개 bucket 안내](https://developers.cloudflare.com/r2/buckets/public-buckets/)

### CF-04 — R2 권한 자료 준비

- [ ] private/public/backup 용도를 구분한 자격증명을 준비한다. 정본은 bucket별 별도 key를 요구한다.
- [ ] 각 자격증명의 허용 bucket과 Object Read & Write 등 필요한 권한만 설정한다.
- [ ] S3 endpoint, Access Key ID, Secret Access Key를 승인된 secret 저장 위치에 보관한다.
- [ ] Secret Access Key를 문서·대화·코드에 붙이지 않는다. 해당 token의 권한 범위와 보관 완료 여부만 기록한다.
- 완료 기준: 용도별 자격증명과 허용 범위를 확인했다. 9월 20일 운영 연결과 9월 23일 공개 이미지 확인은 §7과 [운영 상태](current-status.md)의 당시 증거이며, 신규 환경 연결은 다시 검증한다.

Cloudflare는 R2 object 권한을 특정 bucket으로 제한할 수 있다. 전체 계정 관리자 권한의 token을 앱용으로
발급하는 대신 필요한 bucket만 선택한다. [R2 인증 안내](https://developers.cloudflare.com/r2/api/tokens/)

### CF-05 — 관리자 Access 설정

- [ ] Zero Trust 설정에서 사용할 조직/team을 준비하고 team domain을 확인한다.
- [ ] 관리자 로그인 방법과 허용할 운영자 계정을 정한다.
- [ ] self-hosted Access application으로 `/admin*`와 `/api/v1/admin/*`를 보호한다.
  실제 path matching은 `/admin`, `/admin/collect`, `/admin/collect/sources`, `/admin/batch`까지 빠짐없이 시험한다.
  `admin-collect.vue`·`admin-collect-sources.vue`·`admin-batch.vue`의 실제 경로는 각 `definePageMeta`가 지정한다.
  파일명에서 경로를 추정하지 않으며 `/api/admin/features`와 운영 `/health/ready`의 앱 인증도 별도 확인한다.
- [ ] 일반 이용자의 `/meme`·공개 API에는 관리자 로그인을 요구하지 않도록 범위를 확인한다.
- [ ] application의 issuer/team domain과 audience(AUD), 허용 정책을 개발자와 확인한다.
- 완료 기준: 승인된 운영자는 접근 가능, 다른 계정은 거부. **앱 내부 운영자 등록까지 마쳐야 전체 로그인 완료다.**

Access 정책은 Cloudflare에서, 앱 내부 운영자 목록은 배포 설정에서 관리한다. 현재 앱은 이메일 문자열만으로
허용하지 않고 검증된 Access `sub`를 내부 operator ID에 대응시킨다. 전체 JWT를 문서에 저장하지 않는다.
[Access 공식 설정 안내](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/),
[현재 앱 인증 코드](../../apps/web/server/utils/identity.ts)

### CF-06 — Tunnel과 캐시 삭제 권한 준비

- [ ] Tunnel을 만들고 개발자가 승인된 서버에서 connector를 실행할 수 있도록 token을 안전하게 보관한다.
- [ ] 공개 hostname은 배포 구성의 웹 진입점으로 연결한다. PostgreSQL·Nest Core를 public hostname에 직접 연결하지 않는다.
- [ ] 연결 후 Tunnel 상태와 `https://blariyo.com` 접속을 확인한다.
- [ ] 해당 도메인 zone의 캐시 삭제에 필요한 API 권한을 준비하고, 앱의 `CACHE_ZONE_ID`와 `CACHE_PURGE_TOKEN`에 연결할 자료를 보관한다.
- 완료 기준: 실제 서비스 연결과 발행/숨김 후 캐시 처리까지 확인한다. Tunnel 생성만으로 완료 표시하지 않는다.

설정 절차는 [Tunnel 공식 안내](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/)를 따른다.
collector 전용 `/api/collector/v1/*`는 별도 인증 경로이므로 관리자 Access 정책을 무조건 복사하지 않는다.

## 6. GA4에서 내가 할 일

GA4는 Google Analytics 4다. **계정·속성을 미리 만들어도 서비스의 수집 기능은 계속 꺼둘 수 있다.**
현재 앱에는 GA4 코드가 있으므로 Google이 보여주는 설치 script를 HTML에 한 번 더 붙이지 않는다.

### GA-01 — Analytics 계정과 속성 만들기

- [ ] 사용할 Google 계정으로 [Google Analytics](https://analytics.google.com/)에 로그인한다.
- [ ] Analytics 계정을 만들거나 관리 권한이 있는 기존 계정을 선택한다.
- [ ] 블라리요 전용 GA4 속성을 만든다. 속성은 한 서비스의 분석 데이터를 관리하는 단위다.
- [ ] 속성 이름, 보고 시간대, 통화를 선택한다. 제안값은 `Blariyo`, 대한민국/서울 시간, KRW다.
- [ ] 약관과 데이터 공유 선택 항목을 확인한다. 현재 필요하지 않은 데이터 공유·광고 연동을 자동으로 켜지 않는다.
- 완료 기준: 속성에 관리 권한으로 접근할 수 있다. 데이터 수신 여부는 아직 완료 조건이 아니다.

### GA-02 — 웹 데이터 스트림과 Measurement ID 준비

- [ ] 속성의 데이터 스트림에서 **Web**을 선택한다. 웹 스트림은 웹사이트가 보낼 데이터를 연결하는 설정이다.
- [ ] 웹사이트 URL을 `https://blariyo.com`으로 지정하고 스트림을 생성한다.
- [ ] `G-`로 시작하는 Measurement ID를 확인해 운영 설정 저장 위치에 보관한다.
- [ ] GA가 안내하는 script 직접 삽입이나 GTM 중복 설치를 하지 않는다. 기존 Nuxt 로더에 ID를 연결한다.
- 완료 기준: 올바른 속성·웹 스트림·ID가 확인됐다. 실제 ID를 이 Markdown에 적을 필요는 없다.

계정→속성→웹 스트림 생성과 Measurement ID 확인 절차는
[Google 공식 설정 안내](https://support.google.com/analytics/answer/14183469?hl=en)를 따른다.
이 웹 스트림 준비에는 GCP VM 생성이 필요하지 않다.

### GA-03 — 자동 수집을 끄고 프로젝트 범위를 맞추기

- [ ] 웹 스트림의 **향상된 측정(Enhanced measurement)** 자동 이벤트를 비활성화한다.
- [ ] 자동 page view·scroll·외부 링크 등 이벤트가 별도 설정이나 다른 tag로 켜져 있지 않은지 확인한다.
- [ ] Google Ads 연결·User-ID 등 현재 정본 범위 밖 기능을 활성화하지 않는다.
- [ ] 아래 네 이벤트를 앱이 직접 보내는 구성을 유지한다.

| 이벤트 | 의미 |
| --- | --- |
| `page_view` | 페이지 탐색 |
| `select_content` | 목록에서 게시글 선택 |
| `share` | 공유 방식 선택 |
| `scroll` | 상세의 스크롤 구간 도달 |

- 완료 기준: 자동 이벤트 설정을 껐으며 중복 삽입한 Google tag가 없다. 실제 전송 검증은 GA-05에서 수행한다.

Google의 일반 안내에서는 향상된 측정을 켤 수 있지만, 블라리요는 실제 제목·URL과 자동 중복 이벤트를
제한하기 위해 끄는 것으로 정해져 있다. 이는 우리 제품 정책이다.
[분석 정본의 자동 측정 제한](../planning/04-analytics-ad-plan.md#ga4-기본-필드와-자동-측정-제한)

### GA-04 — 보관·고지·운영 승인 준비

- [ ] GA4 속성의 데이터 보관 기간을 확인하고 운영에 사용할 기간을 결정한다. 현재 확정값은 `(미정)`이다.
- [ ] 실제 Google 계약 법인·국외이전 정보·처리 항목·보관 설정을 확인해 법무 담당 검토와 문서 고지에 반영한다.
- [ ] GA4 데이터 보관 기간, GA cookie 만료, 앱의 동의 선택 저장 기간이 서로 다른 설정임을 구분한다.
- [ ] 사용할 Google tag/수집 서버 domain과 CSP 허용 범위를 개발자와 확인한다.
- 완료 기준: [운영 실값 체크리스트의 GA4 gate](../development-specs/m0-core/decisions/operational-values-checklist.md#5-ga4-운영-활성화-gate)가 충족됐다.

이 문서는 법무 판단을 확정하지 않는다. 미확정이면 GA4를 비활성으로 유지하고 M0 서버 준비를 진행한다.
Measurement ID만 발급받았다고 운영 승인 flag를 켜지 않는다.

### GA-05 — 개발자와 함께 실제 수집 확인

- [ ] 승인된 검증 환경에서 기존 Nuxt GA4 설정에 ID·승인값·수집 origin을 연결한다.
- [ ] 새 브라우저 상태에서 **동의 전 Google tag·수집 요청 0건**을 확인한다.
- [ ] 동의 후 페이지 이동·글 선택·공유·스크롤을 실행해 의도한 이벤트가 도착하는지 확인한다.
- [ ] 실제 게시글 제목·URL/query·postId·본문·관리자/회원 식별자가 전송되지 않는지 네트워크 payload를 확인한다.
- [ ] 철회 후 추가 이벤트가 중단되고 접근 가능한 GA cookie가 정리되는지 확인한다.
- [ ] 관리자 경로는 tag 로딩·이벤트가 없고, 동의 거부·전송 실패 중에도 공개 콘텐츠를 읽을 수 있는지 확인한다.
- [ ] 실시간 보고서 또는 DebugView에서 수신을 확인하고 결과 날짜·검증 환경을 기록한다.
- 완료 기준: console 설정, 앱 동의 동작, 실제 Google 수신을 모두 확인했다.

DebugView를 사용하려면 테스트 장치의 debug mode가 필요하다. 현재 production에 debug 전송을 상시 켜지 않는다.
[Google DebugView 안내](https://support.google.com/analytics/answer/7201382?hl=en)
Google SDK가 자동 생성하는 기술 이벤트·필드까지 네 가지로 한정된다는 뜻은 아니며, 앱의 명시적 이벤트와
금지한 자동 측정·민감 필드가 섞이지 않는지를 확인한다.

## 7. 개발·배포 확인 결과

아래 최초 설치·정책·Access 확인은 2026-09-20 배포 기록을 기준으로 한다. 9월 23일 후속
API/Web 배포·DB 반영과 기능별 활성화는 [운영 상태](current-status.md)의 관측 시각을 따른다.

| 항목 | 확인한 상태 | 남은 확인 |
| --- | --- | --- |
| production 구성 | `deploy/` 구성으로 DB·Core·Web·Nginx healthy, Tunnel/DNS 공개 연결 | 실제 VM 재부팅·장기 부하 |
| DB 역할·권한 | 9/20 app/migrator/backup 분리·V001–V005 적용. 9/23 API V008·Collector V006와 업무 데이터 반영, ledger·API 검수/읽기 제한·backup 새 테이블 읽기 권한 확인 | 현재 ledger·권한은 재조회 필요. 이후 migration마다 재검증 |
| R2 | 버킷별 키 분리, 실제 앱 어댑터 private GET→public PUT·공개 HTTPS 확인 | 관리자 로그인 후 업로드·발행 전체 흐름 |
| Access | 이메일 Allow·6시간 MFA, 익명/위조 JWT 차단, 별도 운영자 파일 주입 | 실제 TOTP 완료 후 sub 매핑·관리자 작업 |
| 정책·연락처 | 기존 설정 주입, TERMS/PRIVACY v0.1 발행·SQL/공개 화면 확인 | 정보·처리 변경 시 새 정책 버전 |
| 백업 | 하루 두 번 암호화 R2 전송, 실제 별도 DB 복원·해시 대조 | 복구키 별도 사본, 7일 삭제 관찰·월간 복원 |
| 정기 작업·로그 | timer 설치, 수동 실행·로그 수신·합성 만료 파일 정리 확인 | 실패 자동 알림·장기 관찰 |
| GA4·카카오·수집 접수/자동 실행 | GA4·카카오·URL/Discord 접수·자동 수집은 비활성. 9/23 관리자 batch 검수 API/Web flag만 활성, 내부 service 조회·미리보기 확인 | 실제 MFA 검수 조작, direct 보존·고지(QD-04)와 수집 기능별 gate는 별도 |

확인 근거: [Core 설정](../../apps/api/src/bootstrap/config.ts),
[DB 설정](../../apps/api/src/bootstrap/database-config.ts),
[R2 adapter](../../apps/api/src/adapters/remote-adapters.ts),
[Nuxt 설정](../../apps/web/nuxt.config.ts), [Access 인증](../../apps/web/server/utils/identity.ts),
[로컬 Compose](../../compose.yaml). 코드 반영과 실제 서버 배포·운영 검증은 별도로 확인한다.

현재 GA4 관련 Nuxt 환경 변수 대응은 다음과 같다. **배포 담당자용 이름 설명이며 지금 값을 켜라는 명령이 아니다.**
이름 대응과 public 설정의 브라우저 노출은 [Nuxt runtime config 안내](https://nuxt.com/docs/4.x/guide/going-further/runtime-config)를 따른다.

| runtimeConfig.public | 대응 환경 변수 | 활성화 전 상태 |
| --- | --- | --- |
| `ga4Enabled` | `NUXT_PUBLIC_GA4_ENABLED` | false |
| `analyticsApproved` | `NUXT_PUBLIC_ANALYTICS_APPROVED` | false |
| `ga4MeasurementId` | `NUXT_PUBLIC_GA4_MEASUREMENT_ID` | 미주입/빈 값 |
| `analyticsConnectOrigins` | `NUXT_PUBLIC_ANALYTICS_CONNECT_ORIGINS` | 실제 수집 domain 확인 후 설정 |

## 8. 운영자가 이어서 확인할 일

- [ ] MFA를 직접 완료하고 실제 관리자 권한·업로드·발행·숨김·예약 작업을 검증한다.
- [ ] 암호화 백업 복구키를 맥 외의 안전한 장소에도 보관한다. 원문을 채팅·Git에 넣지 않는다.
- [ ] timer 결과와 최신 백업 시각을 관찰하고 7일 경과 후 원격 보관 동작을 확인한다.
- [ ] 별도 일정으로 VM 재부팅·새 VM 전체 복구와 월간 DB 복원을 시험한다.
- [ ] 외부 가용성·실패 알림, AWS 크레딧/무료 플랜 만료와 비용 알림을 확인한다.

완료된 설정을 다시 입력하지 않는다. 미완료 세부 범위는 [현재 운영 상태](current-status.md),
법무 후속 조건은 [정책 문서](../legal/README.md)를 따른다.

## 9. 준비 결과를 전달할 때 사용할 양식

아래에는 상태만 적는다. 계정 식별자·접속 주소·운영자 개인정보·키 원문은 승인된 별도 관리 위치에서 확인한다.

```text
확인 날짜:
Cloudflare 계정: 준비 / 진행 / 미준비
도메인 관리 권한·Cloudflare 활성화: 준비 / 진행 / 미준비
서버 선택: 기존 Lightsail 서울 / 승인된 대안 / 미확정
서버 생성·관리 접속: 준비 / 진행 / 미준비
R2 Core 세 bucket과 공개 범위: 준비 / 진행 / 미준비
direct writer / API media reader 역할·prefix 검증: 준비 / 진행 / 별도 검증 대기
R2 용도별 자격증명 안전 보관: 준비 / 진행 / 미준비
Access 운영자 정책: 준비 / 진행 / 미준비
Tunnel: 생성만 완료 / 서버 연결 확인 / 미준비
GA4 속성·웹 스트림: 준비 / 진행 / 보류
GA4 향상된 측정: 비활성 확인 / 미확인
GA4 보관·고지 검토: 완료 / 진행 / 보류
GA4 실제 수집: 미활성 / 검증 중 / 검증 완료
개발자에게 연결 작업을 요청할 항목:
막힌 항목과 일반화한 오류명:
```

## 10. 이 문서의 검증 범위

작성 시 프로젝트 정본·실제 설정 코드·공식 가입/설정 안내를 대조했다. 계정별 화면은 요금제·권한·언어에
따라 달라질 수 있으므로 메뉴 이름이 다르면 연결한 공식 안내에서 해당 기능을 찾는다.
최초 작성 당시 실제 계정 보유 여부·서울 A1 가용 용량·도메인 소유권·청구 금액·GA4 수신은
검증하지 않았다. 이후 운영 연결은 [현재 운영 상태](current-status.md)의 시점별 증거를 따르고,
실제 MFA 완료·AWS 예산/MFA·Cloudflare 알림 수신·GA4 수신은 이번 문서 갱신에서 확인하지 않았다.
