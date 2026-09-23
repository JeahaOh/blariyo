# M0 보안·운영 설계

M1 회원·M1.5 익게의 추가 계약은 [회원·익게 기술 설계](06-member-community-design.md)를 따른다. 이 문서의 M0 한정 계약과 구분한다.
- 문서 상태: M0 보안·운영 설계 계약 · 공개 경계·정기 작업·암호화 백업 복원 검증, 관리자 쓰기·장기 관찰 잔여
- 기준일: 2026-09-04
- 정합성 검토일: 2026-09-20 (실제 배포 반영)
- 운영 인원: 초기 1명
- 가용성 방식: 고가용성 대신 감지·백업·복구

2026-09-20 추가 점검에 따른 [보안·비용 보호 적용 계획](09-security-cost-protection-plan.md)은 정상 이용
측정, 캐시·요청 제한·알림·원본 보호의 단계별 검증과 되돌리기를 정의한다. 정적 JS 캐시·비용/DDoS
알림의 [1차 적용 결과](../operations/security-protection-status.md)는 별도로 기록한다.
이를 본문의 전체 미검증 항목 완료로 확대하지 않는다. 공개 이용 제한을 포함한 비상 정책은 별도 확정한다.

## 1. 운영 목표

| 항목 | M0 목표 |
| --- | --- |
| RPO | 최대 24시간 데이터 손실 |
| RTO | 장애 확인 후 4시간 이내 공개 읽기 복구 |
| 관리자 접근 | 등록 운영자만, BFF 외부 인증 adapter 필수 |
| 공개 장애 감지 | 5분 이내 |
| 권리 요청 숨김 | 운영자가 메일 확인 후 30분 이내 목표 |
| 보안 로그 보존 | 현재 M0 앱·Web·Nginx 진단 로그 최대 7일. 제공자 보안 기록과 법정 개인정보 접근 기록은 §7에서 구분 |
| 수집 후보 보존 | 미승격 후보 30일 |
| 수집 출처 robots 재확인 | 90일마다 또는 차단 발생 시 |

RPO·RTO는 SLA가 아니라 단일 서버 저비용 운영 목표다. 초기 검증에서 24시간 RPO를 받아들일 수 없게 되면 WAL archive와 point-in-time recovery 또는 관리형 DB 비용을 추가한다.

## 2. 주요 위협과 통제

| 위협 | 통제 |
| --- | --- |
| origin 직접 공격 | Cloudflare Tunnel, inbound deny all |
| 관리자 route 탈취 | BFF 외부 identity 검증·allowlist, Core 서비스 토큰, 짧은 session |
| SQL injection | parameterized query, validation, DB 최소 권한 |
| 저장형 XSS | 게시글 TEXT는 plain text escape, 정책 HTML은 허용 목록 sanitize, CSP |
| 악성 이미지 | MIME·magic byte·decode 검사, SVG 금지, 크기 제한 |
| SSRF | BE·FE는 외부 수집 URL을 직접 fetch하지 않는다. 외부 fetch는 운영자 로컬 collector만 수행하고, collector는 등록·활성 출처 host 매칭, DNS 결과의 사설·loopback·link-local·metadata 주소 차단, redirect 3회·응답 크기·timeout 제한, 문서·이미지·첨부 종류별 형식 검증을 강제한다 |
| 수집 대상 사이트 과부하·차단 | 출처별 요청 간격·일일 상한, 식별 가능한 User-Agent, `robots.txt` 준수, `403`·`429` 누적 시 자동 비활성 |
| 수집 콘텐츠를 통한 저장형 공격 | 제목·본문 TEXT escape, raw HTML은 비공개 collect object로 격리하고 화면에서 렌더하지 않음. 이미지 승격 시 magic byte·decode·metadata 제거·재인코딩, 익명 collect/private 접근 거부 |
| secret 유출 | 저장소·image·log 제외, provider별 최소 권한 key |
| 숨김 콘텐츠 cache 잔존 | 상태 transaction과 목록·상세·이미지 URL purge outbox, 404 no-store |
| VM·disk 소실 | R2 암호화 DB backup, image 원본 R2 저장 |
| 무료 계정 정지·capacity 부족 | provider-neutral Compose, Lightsail 전환 runbook |
| 분석 데이터 재식별 | GA4 User-ID 미사용, 회원·소셜 식별자·본문·수집 후보 정보 전송 금지 |
| dependency 변조 | lockfile 추적, `npm ci`, image digest 고정, 주기 audit |

GA4 기본 `page_title`, `page_location`, `page_referrer`도 [분석 계획 §4](../planning/04-analytics-ad-plan.md)의 고정값 규칙을 따른다. 자동 page view와 향상된 측정을 끄고, 실제 제목·URL·postId가 기본 필드로 전송되지 않는지 network 검증을 운영 활성화 조건에 포함한다.

## 3. 관리자 접근

### 외부 관리자 인증 provider

- `/admin*`, `/api/v1/admin/*`를 외부 관리자 인증 application으로 보호한다. 초기 provider는 Cloudflare Access다.
- 허용 운영자 이메일 또는 identity group을 명시적으로 allowlist한다.
- one-time PIN 또는 외부 IdP 로그인에 MFA를 적용한다.
- session duration은 8시간 이하로 시작한다.
- 퇴사·분실·침해 시 provider seat와 allowlist를 즉시 제거한다.
- Nuxt BFF의 provider adapter만 외부 assertion의 서명, issuer, audience와 expiry를 검증한다.
- BFF adapter는 외부 identity를 안정적인 내부 `operatorId`로 매핑하고 이를 HMAC한 admin actor와 내부 서비스 토큰만 Nest Core API에 전달한다.
- Core는 내부 서비스 토큰과 actor 형식만 검증하며 외부 assertion·provider 설정을 참조하지 않는다.
- 관리자 identity 원문은 상태 이력에 저장하지 않는다.
- 이벤트 IP 제한은 임의의 `X-Forwarded-For`를 사용하지 않는다. Cloudflare Tunnel 배포에서 `NUXT_TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip`를 명시하고, origin 직접 접근을 차단한 상태에서만 해당 값을 신뢰한다.

외부 provider의 activity log 보존 기간과 무관하게 게시 상태 변경은 `content.board_post_status_history`에 별도로 남는다.

### 서버 관리

- 평상시 SSH 22는 닫는다.
- Cloudflare Tunnel SSH 또는 OCI Bastion을 우선 사용한다.
- 긴급 public SSH는 고정 운영자 IP `/32`에만 임시 허용한다.
- root password login을 끄고 key authentication만 허용한다.
- 운영자 개인 key와 CI deploy key를 분리한다.
- deploy 사용자는 Docker·배포 디렉터리에만 필요한 권한을 가진다.

## 4. 애플리케이션 보안

### HTTP header

Nginx와 Nuxt가 다음 기준을 적용한다.

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy:
  default-src 'self';
  img-src 'self' (배포 설정 IMAGE_ORIGIN) data:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

M0 카카오톡 공유는 Kakao JavaScript SDK를 사용한다. SDK script URL·SRI integrity·JavaScript key와
`script-src`·`connect-src` CSP host는 배포 환경 properties/config로 관리한다. 실제 JavaScript key와
카카오 개발자 콘솔 Web domain 등록을 확인하고 SDK URL·SRI·CSP host를 고정하기 전에는 카카오톡
항목을 비활성한 상태로 배포한다. 비활성 또는 script 로드 실패 시 공유 popup은 카카오 항목 없이
열리고 링크 복사와 브라우저 기본 공유는 동작해야 한다.

```text
script-src 'self' (미정: 카카오 공유 script 호스트);
connect-src 'self' (미정: 카카오 공유 API 호스트)
```

M0 GA4는 Measurement ID·속성 보관 설정·국외이전 고지·실제 Google 계약 법인·Google tag/CSP
domain이 모두 확정된 환경에서만 활성화한다. 하나라도 미확정이면
`NUXT_PUBLIC_GA4_ENABLED=false`를 유지한다. 활성 환경에서도 저장된 분석 동의 전에는 방문자 수·
page open을 포함한 Google tag/request와 cookieless ping을 만들지 않는다. 광고·소셜 로그인은 해당
기능을 활성화하기 전에 별도로 검토한다. 편의를 위해 `*`나 광범위한 `unsafe-eval`을 추가하지
않는다. 수집은 브라우저가 아니라 로컬 collector에서 수행하므로 CSP `connect-src`에 수집 대상
도메인을 추가하지 않는다.

### 입력 검증

- X 게시물 표시는 `NUXT_PUBLIC_X_EMBEDS_ENABLED`로 제어하며 기본값은 false다. false에서는
  로컬 카드와 원문 링크만 표시하고 X script/frame/request를 생성하지 않는다.
  true에서는 공식 `https://platform.x.com/widgets.js`와 정규화된 게시물 ID를 사용해
  `createTweet(..., { dnt: true })`를 호출한다. `dnt`를 외부 요청·쿠키가 없다는 보장으로 해석하지 않는다.
  CSP는 X 플랫폼의 정확한 script/frame/connect origin만 허용하고 wildcard·unsafe-eval을 추가하지 않는다.
  수집 HTML이나 임의 oEmbed HTML을 실행하지 않으며 제한 시간 초과·실패 시 원문 링크와 안내를 표시한다.
  로컬 검증을 운영 고지·활성화 완료로 취급하지 않는다.
- YouTube·TikTok·Instagram은 `NUXT_PUBLIC_SOCIAL_EMBEDS_ENABLED`로 제어한다(기본 false).
  정확한 HTTPS 호스트·경로·게시물 ID만 허용하고 공식 SDK 또는 공식 프레임 URL을 직접 구성한다.
  YouTube 오류 이벤트와 TikTok 메시지의 origin·source를 확인하며 임의 window message는 무시한다.
  YouTube 프레임은 `strict-origin-when-cross-origin` referrer policy로 플레이어 식별 정보를 제공한다.
  Instagram·TikTok 프레임의 로드와 콘텐츠 정상 여부를 구분한다. TikTok은 재생 전 ready 이벤트가
  오지 않아도 로드된 공식 프레임을 유지하고 이후 오류 이벤트를 처리한다. 각 SDK는 필요할 때 1회 로드하고
  실패·시간 초과·컴포넌트 해제 시 timer·observer·listener를 정리한다. 비활성 환경에서는 외부 요청을 만들지 않는다.
  임베드 오류가 나도 원문 DB를 수정·삭제하지 않는다. SNS 삭제 탐지 작업이나 저장 사본의 일괄 삭제는 이 UI 변경에 포함하지 않는다.

- JSON body 기본 최대 `256KB`
- 관리자 이미지 multipart만 별도 최대 `100MiB/request`
- title·IMAGE block alt·source 길이는 API schema와 DB 길이를 일치시킨다.
- source URL은 `https`만 허용하고 사용자 클릭 링크에 `rel="noopener noreferrer"`를 사용한다.
- 게시글에 저장된 출처 URL을 서버가 배경에서 자동 fetch하지 않는다. M0 수집 보조의 외부 요청은
  운영자 로컬 collector가 Discord `/collect url` 또는 관리자 화면 URL 입력 작업을 처리할 때만
  발생한다. 목록 수집은 별도 batch가 source policy에 따라 수행하며 API는 외부 사이트를 호출하지 않는다.
- 게시글 TEXT block은 HTML·Markdown으로 해석하지 않고 출력 시 escape한다.
- 정책 `body_html`은 저장·미리보기에 같은 허용 목록 sanitizer를 사용한다. script·style·iframe·form·SVG·`on*` 속성·inline style을 허용하지 않는다.
- 정책 링크는 `https`, `mailto`, 서비스 내부 상대 경로와 `#` anchor만 허용하고 외부 새 창 링크에는 `rel="noopener noreferrer"`를 강제한다.
- 수집 대상 URL은 `https`만 허용하고 최대 2048자다. BE는 접수 시 정규화한 뒤 등록 출처 host와
  대조하고, collector는 실행 직전 활성 상태·robots·DNS·redirect 경계를 다시 확인한다.
- 수집으로 얻은 제목은 plain text로만 저장하고 원문 응답 HTML 전체는 저장하지 않는다.
- 운영자 검수 미리보기용 이미지는 Java/Spring 추출기 작업 경로에 임시 저장할 수 있지만 내부 절대 경로,
  image binary와 storage key를 application log·Discord·공개 API에 남기지 않는다.
- 수집 응답의 content-type이 예상과 다르거나 `COLLECT_MAX_RESPONSE_BYTES`를 넘으면 즉시 중단한다.
- 모든 DB query는 placeholder를 사용한다.

### 이미지

1. 업로드 크기와 선언 MIME 확인
2. magic byte 확인
3. 이미지 decoder로 실제 decode
4. 최대 pixel 수 확인
5. metadata 제거 후 안전한 형식으로 재인코딩
6. SHA-256 계산
7. private 원본 bucket 저장

다중 업로드는 all-or-nothing이다. 중간 실패 시 image row transaction을 rollback한 뒤 이미 저장한
private object를 즉시 보상 삭제한다. 즉시 삭제가 실패하면 rollback과 분리된 cleanup transaction에서
`OBJECT_DELETE_PRIVATE` outbox를 남긴다. 이 outbox는 rollback된 image ID 대신
`aggregate_type=STORAGE_OBJECT`, `aggregate_id=NULL`을 사용하고 payload에는 `privateStorageKey`,
`objectCreatedAt`, `cleanupReason=UPLOAD_ROLLBACK`만 둔다. 원본 파일명·관리자 identity·token은 넣지 않는다.

upload object key는 `staging/YYYY/MM/DD/{uploadRequestId}/{fileIndex}-{sha256}.{ext}`로 식별한다.
`uploadRequestId`는 서버 생성 고유값이고 SHA-256은 재인코딩한 bytes 기준이다. 매일 inventory는 생성 후
24시간이 지난 `staging/` object를 DB image의 private key와 미완료(`PENDING`,`RUNNING`,`FAILED`,`DEAD`)
cleanup outbox의 key에 대조하고, 어느 쪽에도 없는 object만 삭제한다. 따라서 process crash로 outbox가
생성되지 않은 object도 회수하며, 후속 일반 사용자 업로드에도 같은 격리·보상 삭제 원칙을 적용한다.
M0에는 일반 사용자 업로드 endpoint를 추가하지 않는다.

기본 제한:

| 항목 | 제한 |
| --- | ---: |
| 파일 | 10MiB |
| 한 요청 | 10개·100MiB |
| 한 게시글 | 현행 편집·direct 초안 200개, legacy 후보 선택은 20개 |
| pixel | 40 megapixel |
| 형식 | JPEG, PNG, WebP, GIF |

GIF는 animation frame·총 decode 메모리를 제한한다. SVG는 script·외부 참조 위험 때문에 M0에서 받지 않는다.

### 수집

현행 direct batch만 외부 원문을 fetch하고 비공개 수집 DB/object에 직접 저장한다. API는 batch 결과를 읽어
검수·초안 승격·별도 발행을 처리한다. 아래 통제는 [direct 기술 계약](07-spring-collector-design.md#2026-09-23-direct-batch-검수승격-구현-계약)과
출처별 정책으로 강제한다. 기존 candidate/preview·collector token 중계는 legacy 호환 경로다.

1. 입력·redirect·이미지·첨부 URL을 정규화하고 허용된 source/미디어 host와 대조한다.
2. robots·공개 범위·연락 수단·출처별 간격과 요청 상한을 확인한다. 차단을 우회하지 않는다.
3. DNS 결과의 사설·loopback·link-local·metadata 주소를 거부하고 연결 주소를 검증한다.
4. timeout·응답 크기·redirect 횟수/host 이탈 제한을 적용하며 문서·이미지·파일의 형식을 구분한다.
5. raw HTML과 원본 미디어는 비공개 collect 경로에 보관한다. raw는 파싱 전 응답이므로 댓글·프로필·개인정보가
   전혀 없다고 보장하지 않는다. 웹 렌더링·익명 제공·로그 출력과 분리하고 보존/파기·고지 정합성을 확인한다.
6. API preview/승격은 DB object key·hash·size와 실제 bytes를 대조한다. 이미지 decode·metadata 제거·재인코딩 또는
   허용된 애니메이션 정제를 거쳐 private 사본을 만든다. 첨부 파일은 원문 링크만 노출한다.
7. 검수/승격은 관리자 인증·기능 flag·item/review 버전·검수 snapshot·멱등 키를 검사한다. 공개 복사는 별도 발행 명령에서만 수행한다.

- source 차단·실패·날짜 제외를 성공으로 바꾸지 않는다. 수집 장애는 공개 읽기와 수동 작성의 준비 상태를 막지 않는다.
- batch에 content/public 쓰기 credential을 주지 않는다. API에 batch queue/confirmation 쓰기나 원문 fetch 권한을 주지 않는다.
- direct의 raw/media/report/queue 보존 기간·승격 후 원본 유지·실패 orphan 유예는 `(미정)`이다. legacy 후보/preview 자동 파기와 별도 계약이다.
- 기존 개인정보처리방침의 metadata 중심 설명과 direct 저장 범위가 다르므로 항목·목적·보존/파기·고지를 맞춘 뒤 활성화한다.
  이는 수집 기능의 확인 조건이며 Core 수동 운영의 새로운 차단 조건이 아니다.
- legacy collector service token은 기존 전용 중계 API scope만 갖는다. direct CLI/queue의 DB/object 역할과 혼동하지 않으며,
  분실·PC 교체·운영자 변경 시 해당 역할의 credential을 교체한다. 비밀 원문은 로그·보고서에 쓰지 않는다.

## 5. Secret 관리

| secret | 권한 |
| --- | --- |
| PostgreSQL app password | content/legal·허용 ops 및 API 소유 collect만 DML, batch 결과 7개 테이블 SELECT only, queue/confirmation 접근 없음. migration 권한 없음 |
| PostgreSQL migration password | schema 변경, 배포 시에만 주입 |
| PostgreSQL batch password | 명시된 batch 소유 테이블·framework 상태만 처리. API 검수/content/정책/운영 ledger 접근 없음 |
| Collect object credential | batch는 collect 전용 쓰기, API는 collect 전용 읽기. content/public 권한과 분리 |
| R2 private media key | private 원본 bucket object read/write/delete, bucket 관리 금지 |
| R2 public media key | public media bucket object write/delete, bucket 관리 금지 |
| R2 backup key | backup bucket write/read, media·staging 접근 금지 |
| cache purge token | 해당 zone cache purge only |
| admin actor HMAC secret | BFF only, 내부 `operatorId` 가명화 |
| Core service token | BFF·Core만 공유, 외부 노출 금지 |
| Collector service token | 로컬 collector 보유, 전용 Web 중계에서만 Core로 전달. 후보 접수·claim·heartbeat·결과·preview 전용, 관리자 권한 없음 |
| 외부 provider audience/team | BFF adapter 설정, 비밀값과 분리 |
| 운영자 identity·`operatorId` 매핑 파일 | BFF only, 읽기 전용 mount, 비밀값 아님이나 접근 제한 |
| 카카오 공유 JavaScript key | 공개 config, 허용 도메인 등록으로 오용 제한 |

- `.env.template`에는 이름과 설명만 넣고 값은 넣지 않는다.
- production secret 파일은 root 소유 `0600`으로 둔다.
- CI secret은 protected branch deployment에서만 주입한다.
- token·password·private key를 command argument와 process list에 노출하지 않는다.
- 90일마다 사용 여부를 점검하고 침해·운영자 변경 시 즉시 rotation한다.
- backup 암호화 복구 key는 서버와 다른 위치에 오프라인 보관한다.

## 6. DB 권한

```text
blariyo_app
  CONNECT
  USAGE on content, legal, ops, collect
  DML on content/legal and explicitly allowed ops/API-owned collect tables
  SELECT only on batch-owned result tables; no batch queue/confirmation access
  USAGE, SELECT on M0 identity sequences
  no direct access on ops.schema_migration
  EXECUTE on ops.is_schema_ready(TEXT) only (Boolean readiness)
  no CREATE on application schemas or public

blariyo_batch (별도 수집 활성 환경)
  explicitly allowed batch result/queue/framework tables only
  no access to API-owned review, content, legal or ops migration ledger

blariyo_migrator
  CONNECT, application schema owner, migration 실행에 필요한 DDL

blariyo_backup
  CONNECT
  USAGE on content, legal, ops, collect
  SELECT on M0 application tables and sequences
```

- application은 root 계정을 사용하지 않는다.
- API·application command, batch, migration, backup은 각각 분리된 `blariyo_app`, `blariyo_batch`, `blariyo_migrator`, `blariyo_backup` credential만 사용하고 password file을 서로 mount하지 않는다.
- application SQL은 schema-qualified 물리명을 사용하고 `public` schema의 `CREATE` 권한은 회수한다.
- Core PostgreSQL은 Docker data network에서만 listen하고 `pg_hba.conf`는 application·migration·backup role의 database 접근만 허용한다.
  별도 PC batch를 연결할 때는 승인된 비운영/운영 네트워크와 batch 전용 역할의 제한 접속을 별도 구성·검증한다. 현재 Core 구성이 원격 batch 접속을 허용한다고 가정하지 않는다.
- production seed에 공용 비밀번호와 샘플 회원을 넣지 않는다.
- migrator는 역할별 default privilege와 명시적 허용 목록을 적용한다. 새 collect table/sequence/function은 app/batch에 자동 허용하지 않는다.
  실제 허용 목록은 [권한 SQL](../../deploy/postgresql/apply-privileges.sql)과 [API 소유권 목록](../../apps/api/src/persistence/collect-ownership.ts)을 대조한다.
- `ops`의 새 table에는 app 권한을 자동 부여하지 않는다. app이 사용하는
  `outbox_task`, `idempotency_request`, `schedule_failure_alert`만 명시적으로 허용하고,
  새 운영 table은 용도를 검토한 뒤 허용 목록에 추가한다. backup의 읽기 권한에는
  복원 검증에 필요한 `ops.schema_migration`도 포함한다.
- 최초 역할 생성·migration 후 권한 적용 순서는 [PostgreSQL 준비 절차](../../deploy/postgresql/README.md)를 따른다.
- migration은 배포 한 번에 한 process만 실행하도록 `pg_advisory_lock`을 사용한다.
- production database와 application role의 `timezone`은 `UTC`로 고정하고 API 연결에 `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`을 설정한다.

readiness 함수의 소유권·고정 search_path·PUBLIC EXECUTE 회수는 [데이터 모델 §6](02-data-model.md)을 따른다. API에 migrator credential을 주입하지 않는다.

## 7. 로깅

### 구조화 application log

```json
{
  "timestamp": "2026-08-14T01:00:00.000Z",
  "level": "info",
  "service": "api",
  "requestId": "01J...",
  "method": "GET",
  "route": "/api/v1/boards/:boardSlug/posts/:postId",
  "status": 200,
  "durationMs": 18,
  "errorCode": null
}
```

저장 금지:

- password, OAuth code·token, cookie, Authorization header
- 이메일 원문, provider subject, 권리 문의 내용
- 게시글 본문, source URL 전체, image binary
- 수집 대상의 응답 HTML 원문과 후보 제목 전체
- DB connection string, R2 key

IP는 보안 목적의 필요성이 있는 log에서만 사용하고, 일반 보안 기록의 90일 설계값과 법정 접속기록을 구분하며 product event와 결합하지 않는다. 일반 access log에는 Cloudflare request ID와 축약 경로를 사용한다.

### 보존

| 로그 | 보존 |
| --- | --- |
| application JSON log | 최대 7일. 운영 전용 rsyslog·일별 만료 timer 적용 및 합성 파일 삭제 검증 |
| Nginx access·error | 최대 7일. 운영 전용 rsyslog·일별 만료 timer 적용 및 합성 파일 삭제 검증 |
| 관리자 상태 변경 | DB에 운영 기간 유지 |
| 일반 로그인·접근 보안 기록 | 별도 저장소의 90일은 후속 설계값. 현재 M0는 Cloudflare Free Access 24시간·계정 관리자 감사 18개월의 제공자 보존을 구분해 고지 |
| 개인정보처리시스템의 개인정보 접근 기록 | 안전성 확보조치 기준 제8조 적용 시 최소 1년, 2년 대상 요건이면 최소 2년 |
| backup 실행 결과 | 현재 M0는 secret 없는 systemd journal 결과와 latest.json 상태. 별도 90일 외부 이력 저장은 미구현 |

2026-09-20 사용자가 위임한 최소 보관 원칙에 따라 일반 진단 로그의 목표 상한을 14일에서 7일로 줄였다.
기본 Compose의 `json-file` 용량 제한만으로는 기간이 보장되지 않는다. 운영에서는 `production-logging.yaml`로 전용 syslog로 교체하고 Docker 이중 cache를 껐다. `/var/log/blariyo/application`의 당일·이전 5일 파일만 유지하며 매일 UTC 00:05에 만료시킨다. 10일 된 합성 로그 삭제·소유자·symlink 방어와 실제 수신을 검증했다. DB 이력·Cloudflare 제공자 감사 로그·호스트 로그는 이 삭제 작업 대상이 아니다.
문의·권리 요청은 별도 접수 DB 없이 메일에서 처리하며 목적 달성 후 지체 없이 파기한다.
법정 절차·진행 중 분쟁의 최소 보존 예외와 사업자 내부 백업은 별도로 관리한다.

디스크 사용량이 70%를 넘으면 log level·rotation을 확인한다. 디스크 부족 시 공개 요청을 죽이는 것보다 오래된 일반 log부터 제거한다. 보안 로그는 외부 backup 후 제거한다.

## 8. 모니터링과 알림

M0는 유료 APM을 사용하지 않는다.

### 외부 감시

무료 구간이 있는 외부 HTTP monitor 한 곳에서 5분마다 확인한다.

```text
GET https://blariyo.com/health/live
GET https://blariyo.com/meme
```

외부 monitor 사업자는 배포 시 선택한다. 자기 서버에서 자기 자신만 확인하는 방식은 전체 VM 장애를 감지하지 못하므로 단독 사용하지 않는다.

### 내부 지표

cron이 5분마다 다음을 수집하고 임계 초과 시 이메일 또는 webhook을 보낸다.

| 지표 | 경고 | 심각 |
| --- | ---: | ---: |
| disk 사용률 | 70% | 85% |
| memory 사용률 15분 | 80% | 90% |
| swap 지속 | 5분 | 15분 |
| container restart | 1회/시간 | 3회/시간 |
| API 5xx | 1%/5분 | 5%/5분 |
| p95 응답 | 1초 | 3초 |
| DB backup 나이 | 18시간 | 24시간 |
| 수집 출처 연속 실패 | 3회 | 5회 |
| 수집 차단 응답(`403`·`429`) | 1회 | 3회 |
| 목록 수집 미실행 시간 | 1시간 | 3시간 |
| outbox DEAD | 1건 | 5건 |
| R2 사용량 | 7GB | 9GB |

### Health endpoint

| endpoint | 검사 | 공개 |
| --- | --- | --- |
| `/health/live` | Nuxt BFF process event loop 응답 | 예, 상세 없음 |
| `/health/ready` | BFF가 Core `/internal/health/ready`를 호출하고 결과만 일반화해 전달 | 외부 관리자 인증 또는 내부만 |
| Core `/internal/health/ready` | Core process·PostgreSQL·migration version | Docker app network only |

R2 장애는 공개 읽기의 ready 실패 조건으로 두지 않는다. 업로드·발행 command만 `503`으로 막는다.

## 9. 백업

### 일정

| 작업 | 일정 | 보존 |
| --- | --- | --- |
| PostgreSQL custom-format logical dump | 매일 03:30·15:30 KST | 최근 7일 |
| 주간 보존 복사 | M0에서는 만들지 않음 | 최소 보관 원칙에 따라 별도 8주 복사 없음 |
| backup manifest 검증 | 매일 dump 후 | backup과 동일 |
| 실제 복원 시험 | 매월 첫째 주 | 결과 1년 |
| R2 media inventory | 매주 | 8주 |
| R2 private staging orphan inventory | 매일 1회 | 실행 결과 90일 |

### 형식

```text
pg_dump --format=custom --no-owner --no-acl
  -> age encryption
  -> SHA-256 manifest
  -> private R2 backup bucket
```

복원은 복호화한 archive를 새 PostgreSQL 18에 `pg_restore --exit-on-error --single-transaction --no-owner --no-acl`로 적용한다. role과 database는 인프라 provisioning으로 먼저 만들고 dump 안의 소유자를 신뢰하지 않는다.

- dump 성공, 암호화, upload와 remote checksum 확인이 모두 끝나야 성공이다.
- 실패한 로컬 dump는 다음 성공 전까지 지우지 않는다.
- private media·public media·backup key는 서로 분리한다.
- backup bucket은 public domain을 연결하지 않는다.
- M0는 검증된 새 업로드 뒤 `db/daily/`의 엄격한 파일명 규칙과 R2 수정 시각으로 7일 지난 archive·manifest만 삭제한다. 다른 prefix는 건드리지 않는다. 자동 실행 실패가 장기화되면 기간을 넘길 수 있으므로 timer 결과와 최신 백업 시각을 확인한다.

VM snapshot은 보조 수단이다. snapshot만으로 RPO를 충족했다고 간주하지 않는다.

## 10. 복구 절차

### DB 손상·삭제

1. 관리자 쓰기와 scheduler 중지
2. 손상 DB volume을 보존하고 새 PostgreSQL 18 생성
3. 최신 정상 backup과 manifest 다운로드
4. 오프라인 key로 복호화·checksum 검증
5. 빈 DB에 migration version 확인 후 restore
6. 게시글 수, 최신 post, 정책, 상태 이력 검증
7. API ready·smoke 통과 후 공개 전환
8. 원인·손실 구간 기록

### VM 전체 손실

1. OCI 재생성 또는 Lightsail 서울 VM 생성
2. cloud-init으로 Docker·방화벽·deploy user 구성
3. commit SHA image와 production compose 배치
4. 최신 DB backup 복원
5. R2 media 접근 확인
6. 새 tunnel connector 연결
7. health·목록·상세·숨김 404 smoke
8. tunnel route 전환과 cache purge

### R2 장애

- 기존 CDN cache가 만료된 이미지는 깨질 수 있음을 수용한다.
- 신규 이미지 업로드와 발행을 중지한다.
- 게시글 목록·텍스트 본문·관리자 숨김은 계속 동작한다.
- 장기 장애 시 B2로 media adapter를 전환하되 DB의 private·public storage key 분리 계약은 유지한다.

## 11. 배포와 rollback

### 배포 전 gate

- Node `24.18.0`과 `npm ci`
- lockfile이 저장소에 추적됨
- lint·unit·integration·migration test 통과
- secret scan 통과
- multi-arch image build 성공
- DB backup 최근 18시간 이내
- production URL placeholder 없음
- `SITE_ORIGIN=https://blariyo.com/`·`NUXT_PUBLIC_SITE_ORIGIN=https://blariyo.com/`, `NUXT_TRUSTED_CLIENT_IP_HEADER`, `NUXT_ADMIN_OPERATORS_FILE` 주입 확인. 운영자 목록의 `active: true`인 identity만 허용한다. `COLLECT_USER_AGENT`는 수집 보조 활성 환경에서만 필수
- 카카오 공유 활성 환경은 JavaScript key, 개발자 콘솔 Web domain 등록, SDK script URL·SRI integrity와 CSP host 확인
- 위 카카오 운영값이나 등록 확인이 하나라도 없으면 `NUXT_PUBLIC_KAKAO_ENABLED=false`
- GA4 활성 환경은 Measurement ID·속성 보관 설정·국외이전 고지·실제 Google 계약 법인·Google
  tag/CSP domain 확정 확인
- 위 GA4 운영값이나 고지가 하나라도 없으면 `NUXT_PUBLIC_GA4_ENABLED=false`; 원인과 관계없이 false인
  환경은 `NUXT_PUBLIC_GA4_MEASUREMENT_ID`를 public runtime config에서 unset
- M0 Core는 수집 flag를 모두 false로 유지하며 수집 gate 미완료가 공개를 막지 않음
- M0 수집 보조 활성화 시에만 Discord·관리자 URL 접수, collector 중계·인증·출처·preview gate 확인
- M0 자동 수집 활성화 시에만 별도 목록·feed·scheduler gate 확인

현재 `.gitignore`는 `package-lock.json`을 제외하지 않지만 `yarn.lock`은 제외한다. npm을 표준
package manager로 유지한다면 API·Web의 `package-lock.json`을 추적하고 `npm ci`로 검증한다.
다른 package manager로 바꾸려면 `.gitignore`, CI 명령과 lockfile 정책을 함께 갱신한다.

### rollback

- application-only 변경은 이전 image digest로 되돌린다.
- expand/contract migration을 사용해 이전 image와 한 버전 호환한다.
- column rename·drop은 두 번째 배포 이후 수행한다.
- 데이터 변환 migration은 실행 전 별도 backup과 검증 query를 둔다.
- 복구 불가능한 schema 변경은 자동 rollback하지 않는다.
- schema 호환성은 열/테이블뿐 아니라 이전 앱의 readiness 판정도 포함한다. `ops.is_schema_ready`는
  ledger의 최신 버전과 정확히 비교한다. 이전 앱이 모르는 최신 버전이면 additive migration이어도
  앱만 되돌리는 복귀를 보장하지 못한다. readiness 우회·ledger 값 수정으로 호환성을 만들지 않는다.
- 2026-09-23 Core 후보는 수집 OFF에서 V005 유지와 이전 이미지 복귀를 격리 검증했다.
  V006~V008 적용은 수집 release의 별도 호환·복귀 검증 뒤 수행한다. 적용 대상과 실제 검증 경계는
  [Core 배포 후보](../../worklog/2026-09-23/release/candidate.md)를 따른다.


## 12. 운영 runbook

### 권리 문의

1. 메일의 대상 URL 확인
2. 관리자에서 게시글 번호·현재 상태 확인
3. `RIGHTS_EMAIL`로 숨김
4. 공개 상세 `404`와 목록 제거 확인
5. 연결된 모든 이미지 URL과 목록·상세 HTML cache purge 상태 확인
6. 요청자에게 접수·비노출 회신
7. 재공개·수정·삭제 결정

메일 본문은 DB·ticket·application log에 복사하지 않는다. 메일 시스템의 보유·접근 정책을 따른다.

### 예약 발행 실패

기본 예약 발행 운영 슬롯은 `07:30`, `17:30` KST(`Asia/Seoul`)이며 게시글별 임의 미래 시각도
허용한다. scheduler는 매분 `scheduled_at <= now()`인 `SCHEDULED` 글을 확인하므로 중단 중 지난
예약도 복구 후 다음 실행의 due 대상에 포함한다.

일시적인 R2·DB·network 실패는 글을 `SCHEDULED`로 유지하고 다음 분 실행에서 다시 시도한다.
첫 실패부터 게시글 ID·예약 시각·오류 코드·시도 시각을 운영 알림으로 보내되 본문·source URL·
관리자 identity 원문은 넣지 않으며, 같은 게시글과 오류의 반복 알림은 묶는다. 자동 재시도 횟수는
제한하지 않고 성공하거나 운영자가 예약을 취소할 때까지 계속한다. 반면 공지 위치 충돌처럼 같은
입력으로 성공할 수 없는 업무 제약 오류는 `DRAFT`로 되돌리고 한 번 알린 뒤 자동 재시도하지 않는다.

구현은 `ops.schedule_failure_alert`에 실패와 전달 상태를 보존하고 기존 cron command에서
`SCHEDULE_ALERT_WEBHOOK_URL`로 JSON 알림을 전달한다. 첫 실패부터 전달을 시도하고 같은 예약·오류는
15분 단위로 묶으며, 전송 실패는 다음 실행에서 재시도한다. 수신 주소가 없거나 전송이 실패하면
command는 비정상 종료하여 성공으로 표시하지 않는다. 실제 수신 경로는 운영 설정으로 남기고,
로컬에서는 대체 HTTP 수신기로 검증한다. 알림에는 게시글 ID·예약 시각·오류 코드·최초/최근 시도 시각·
누적/추가 실패 횟수·groupKey만 포함한다.

1. scheduler last successful run과 overdue due row 확인
2. 같은 게시글의 중복 발행 여부 확인
3. R2 image와 DB 상태 확인
4. 일시 실패면 조건부 command로 재실행하고, 영구 업무 오류면 운영자가 수정 후 다시 예약
5. 목록·상세 cache purge 확인

운영 cron은 API image에서 다음 단발성 명령을 실행한다.

```text
매분     npm run posts:publish-due
매분     npm run outbox:run
매일 1회 npm run images:cleanup-orphans
```

정책 시행은 cron에 등록하지 않는다. 승인된 정책 release artifact의 checksum과 시행 시각을 운영자가 확인한 뒤 시행 시각부터 5분 안에 `npm run policies:publish -- --artifact=<path>`를 한 번 실행하고 `/api/v1/policies/:type`, `/terms` 또는 `/privacy`의 현재 버전·이력과 cache purge 결과를 확인한다. window를 놓치면 과거 시행 시각을 강제하지 않고 새 시행 시각으로 법무 문서·artifact를 다시 승인한다. 정책 본문·버전·시행 시각을 command argument에 직접 넣지 않는다. host artifact는 root 소유 `0600`으로 보관하고 실행 시 command container에만 읽기 전용 secret으로 mount하며 종료 후 mount와 임시 파일을 제거한다.

outbox worker는 중단된 `RUNNING`을 5분 뒤 회수하고 실패할 때마다 지수 backoff를 적용한다. 8회 실패한 `DEAD` 작업은 자동 재실행하지 않고 원인과 대상 object 상태를 확인한 뒤 운영자가 처리한다.

### 수집 실패와 차단

1. 알림의 출처와 오류 코드 확인
2. `disabledReasonCode`로 자동 비활성 여부 확인
3. 대상 사이트의 `robots.txt`와 접근 정책 변경 여부 확인
4. 차단이면 해당 batch item 또는 source run을 실패 처리한다. `HOT_LIST`면 목록 수집을 끄고 `DETAIL_ONLY` 수동 URL 경로만 유지한다.
5. 파싱 실패면 후보를 반려하고 파서 수정 여부를 판단
6. 재활성화 전에 요청 간격·일일 상한을 다시 확인
7. 대상 사이트의 중단 요청은 권리 문의 runbook과 같은 절차로 처리

수집 후보는 30일이 지나면 삭제되므로 보류가 필요한 후보는 초안으로 승격해 둔다. 후보 화면과 로그에 원문 응답 HTML을 남기지 않는다.

### 비용 이상

1. compute, R2 storage, R2 operations를 분리 확인
2. 알 수 없는 bucket·VM·volume·snapshot 확인
3. credential 오용이면 key revoke·rotation
4. 무료 한도 초과가 정상 성장인지 장애·공격인지 분류
5. 서비스 실패로 비용을 막지 말고 승인된 상한 안에서 유료 전환

## 13. 정기 점검

| 주기 | 점검 |
| --- | --- |
| 매일 | backup, 외부 health, disk, outbox DEAD, private staging orphan inventory 결과 |
| 매주 | container update 후보, R2 orphan 추세, 예약 발행 결과 |
| 매월 | 실제 restore, 비용, secret·외부 관리자 사용자, dependency audit, 수집 출처 오류·차단 추세 |
| 분기 | 런타임 LTS patch, 보존 데이터 삭제, 공급자 가격·무료 정책, 수집 출처 `robots.txt`·이용약관 재확인 |

Node patch는 검증 후 같은 LTS major 안에서 올린다. major 전환은 별도 호환성 테스트와 설계 변경으로 처리한다.

## Spring 수집 전환의 보안·운영 조건

[Spring 수집 서버 상세 설계](07-spring-collector-design.md)를 따른다. 언어 변경으로 기존 수집 통제를
완화하지 않으며 Spring source·Core migration·OpenAPI·runtime이 아직 없다는 상태를 유지한다.

- 로컬 REST는 `127.0.0.1:18787`에만 bind한다. 실행·조회·중지 scope별 256-bit bearer를 발급해 macOS
  Keychain에 저장하고 애플리케이션 DB에는 HMAC hash와 발급·회전 시각만 둔다. Discord token과 Core
  service token을 재사용하지 않으며 cookie·CORS·public reverse proxy를 사용하지 않는다.
- REST·Discord·Quartz는 `CollectorRunService` 한 경로를 사용하고 active Job 1개와 Core execution fencing을
  함께 적용한다. RUNNING의 기본 lease는 300초, heartbeat는 60초이고 재선점은 `attempt_count < 3`과
  요청 후 24시간 미만을 모두 만족해야 한다. `PREVIEW_REFRESH`는 NEW의 execution·version을 확인하며
  종료된 처리 lease를 요구하지 않는다.
- 외부 HTTP는 socket을 열기 전에 Core quota reservation을 받아 즉시 차감한다. permit은 10초이며
  `source.next_request_at`가 전체 collector의 최소 간격을 통제한다. `NETWORK_STARTED` 뒤에는 같은
  reservation으로 자동 재송신하지 않는다.
- collector state-changing Core 호출은 2xx 완료 receipt만 7일 replay하고 그 이후에는 digest로
  reconcile한다. 429·503·일시 dependency 오류와 400·401·403·409를 내구 완료 receipt로 저장하지 않는다.
- 원문 title·URL과 image binary가 필요한 restart 자료는 DB·ExecutionContext·로그가 아니라 AES-256-GCM
  암호화 spool에 둔다. master key는 Keychain에 보관하고 result payload는 최대 7일, image temp는 최대
  24시간 보존한 뒤 삭제 또는 `RECONCILE_REQUIRED`로 닫는다.
- Discord 결과 알림은 즉시 1회 뒤 1분·5분·15분에 최대 3회 재시도한다. 모두 실패하면 후보 결과와
  분리해 `FINAL_FAILED` outbox로 기록하고 Core operational event를 보낸다. Core 단절 시 local outbox는
  30일 보존하며 같은 delivery ID는 중복 운영 이벤트를 만들지 않는다.
- token, 원문 HTML·URL·title, image binary, 개인정보, 내부 절대 경로와 stack 전체는 JobParameters,
  ExecutionContext, Quartz JobDataMap, 일반 로그·metric·외부 알림에 남기지 않는다.

실제 출처·robots·이용 조건, Discord App, 운영 계정·설치 경로, Keychain·launchd·PostgreSQL 복구,
Core/BFF 연동과 장애 시험은 구현·운영 공개 전 별도 검증한다. collector 장애는 공개 읽기·관리자 수동
발행·백업의 ready 조건이 아니다.
