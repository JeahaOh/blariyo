# M0 보안·운영 설계

- 문서 상태: M0 보안·운영 설계 계약 · 현행 운영 검증 산출물 없음
- 기준일: 2026-08-20
- 정합성 검토일: 2026-08-20
- 운영 인원: 초기 1명
- 가용성 방식: 고가용성 대신 감지·백업·복구

## 1. 운영 목표

| 항목 | M0 목표 |
| --- | --- |
| RPO | 최대 24시간 데이터 손실 |
| RTO | 장애 확인 후 4시간 이내 공개 읽기 복구 |
| 관리자 접근 | 등록 운영자만, BFF 외부 인증 adapter 필수 |
| 공개 장애 감지 | 5분 이내 |
| 권리 요청 숨김 | 운영자가 메일 확인 후 30분 이내 목표 |
| 원시 이벤트 보존 | 90일 |
| 보안 로그 보존 | 90일 |
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
| SSRF | 외부 fetch는 `SourceFetcher` adapter만 수행. 등록 출처 host allowlist, DNS 결과의 사설·loopback·link-local·metadata 주소 차단, redirect 3회·응답 크기·timeout 제한, 비HTML·비이미지 content-type 거부 |
| 수집 대상 사이트 과부하·차단 | 출처별 요청 간격·일일 상한, 식별 가능한 User-Agent, `robots.txt` 준수, `403`·`429` 누적 시 자동 비활성 |
| 수집 콘텐츠를 통한 저장형 공격 | 후보 제목은 plain text로 저장·escape, 원문 HTML 미저장, 이미지는 승격 시 magic byte·decode·재인코딩 |
| secret 유출 | 저장소·image·log 제외, provider별 최소 권한 key |
| 숨김 콘텐츠 cache 잔존 | 상태 transaction과 목록·상세·이미지 URL purge outbox, 404 no-store |
| VM·disk 소실 | R2 암호화 DB backup, image 원본 R2 저장 |
| 무료 계정 정지·capacity 부족 | provider-neutral Compose, Lightsail 전환 runbook |
| 이벤트 재식별 | browser ID 원문 미저장, HMAC, 90일 삭제 |
| dependency 변조 | lockfile 추적, `npm ci`, image digest 고정, 주기 audit |

## 3. 관리자 접근

### 외부 관리자 인증 provider

- `/admin*`, `/api/v1/admin/*`를 외부 관리자 인증 application으로 보호한다. 초기 provider는 Cloudflare Access다.
- 허용 운영자 이메일 또는 identity group을 명시적으로 allowlist한다.
- one-time PIN 또는 외부 IdP 로그인에 MFA를 적용한다.
- session duration은 8시간 이하로 시작한다.
- 퇴사·분실·침해 시 provider seat와 allowlist를 즉시 제거한다.
- Nuxt BFF의 provider adapter만 외부 assertion의 서명, issuer, audience와 expiry를 검증한다.
- BFF adapter는 외부 identity를 안정적인 내부 `operatorId`로 매핑하고 이를 HMAC한 admin actor와 내부 서비스 토큰만 Express Core API에 전달한다.
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
  img-src 'self' https://img.__SERVICE_DOMAIN__ data:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

M0 공유 기능은 카카오 공유 script를 사용하므로 `script-src`에 카카오 script 호스트, `connect-src`에 카카오 API 호스트를 명시한다. 실제 호스트 값은 배포 전 카카오 개발자 문서로 확인해 고정하고, 확인 전에는 `(미정)`으로 두고 카카오 항목을 비활성한 상태로 배포한다. script를 불러올 수 없으면 공유 popup은 카카오 항목 없이 동작해야 한다.

```text
script-src 'self' (미정: 카카오 공유 script 호스트);
connect-src 'self' (미정: 카카오 공유 API 호스트)
```

GA4·광고·소셜 로그인을 활성화하기 전 CSP domain을 기능별로 검토한다. 편의를 위해 `*`나 광범위한 `unsafe-eval`을 추가하지 않는다. 수집은 서버에서 수행하므로 CSP `connect-src`에 수집 대상 도메인을 추가하지 않는다.

### 입력 검증

- JSON body 기본 최대 `256KB`
- 관리자 이미지 multipart만 별도 최대 `100MiB/request`
- title·IMAGE block alt·source 길이는 API schema와 DB 길이를 일치시킨다.
- source URL은 `https`만 허용하고 사용자 클릭 링크에 `rel="noopener noreferrer"`를 사용한다.
- 게시글에 저장된 출처 URL을 서버가 배경에서 자동 fetch하지 않는다. 외부 요청은 운영자 요청 또는 목록 수집 command에서 `SourceFetcher` adapter를 통해서만 발생한다.
- 게시글 TEXT block은 HTML·Markdown으로 해석하지 않고 출력 시 escape한다.
- 정책 `body_html`은 저장·미리보기에 같은 허용 목록 sanitizer를 사용한다. script·style·iframe·form·SVG·`on*` 속성·inline style을 허용하지 않는다.
- 정책 링크는 `https`, `mailto`, 서비스 내부 상대 경로와 `#` anchor만 허용하고 외부 새 창 링크에는 `rel="noopener noreferrer"`를 강제한다.
- 수집 대상 URL은 `https`만 허용하고 최대 2048자다. 서버가 정규화한 뒤 등록 출처 host와 대조한다.
- 수집으로 얻은 제목은 plain text로만 저장하고 원문 응답 HTML 전체는 저장하지 않는다.
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

기본 제한:

| 항목 | 제한 |
| --- | ---: |
| 파일 | 10MiB |
| 한 요청 | 10개·100MiB |
| 한 게시글 | 20개 |
| pixel | 40 megapixel |
| 형식 | JPEG, PNG, WebP, GIF |

GIF는 animation frame·총 decode 메모리를 제한한다. SVG는 script·외부 참조 위험 때문에 M0에서 받지 않는다.

### 수집

수집은 외부 사이트에 요청을 보내는 유일한 경로이므로 아래 통제를 코드로 강제한다.

1. 대상 URL 정규화 후 등록·활성 출처의 host와 정확히 일치하는지 확인
2. 출처 `robots.txt` 판정 확인. 금지 경로와 미확인 출처의 목록 수집은 거부
3. 출처별 최소 요청 간격과 일일 상한 확인
4. DNS 해석 결과가 공인 주소인지 확인. 사설·loopback·link-local·metadata 주소는 거부
5. timeout, 응답 크기 상한, redirect 최대 3회, 같은 출처 host 이탈 금지
6. content-type 확인. 문서 요청은 HTML, 이미지 요청은 허용 이미지 형식만 수용
7. 이미지는 관리자 업로드와 같은 magic byte·decode·pixel·재인코딩 절차 적용

- 요청에는 `COLLECT_USER_AGENT`를 사용하고 서비스명과 연락 수단을 포함한다.
- 로그인, CAPTCHA, 유료 담장, 접근 차단을 우회하지 않는다. 인증이 필요한 페이지는 수집하지 않는다.
- `403`, `429`, robots 금지, timeout이 출처 기준 연속 임계를 넘으면 해당 출처의 목록 수집을 자동 비활성하고 사유를 기록한다. 재활성화는 운영자 확인 후에만 가능하다.
- 대상 사이트가 중단 요청을 보내면 해당 출처를 즉시 비활성하고 이미 발행된 게시글은 권리 문의 절차로 처리한다.
- 수집 실패·차단은 공개 읽기 ready 조건에 넣지 않는다. 수집이 멈춰도 공개 목록·상세와 운영자 발행은 계속 동작해야 한다.

## 5. Secret 관리

| secret | 권한 |
| --- | --- |
| PostgreSQL app password | `content`·`legal`·`analytics`·`ops`·`collect` DML·sequence 사용, migration 권한 없음 |
| PostgreSQL migration password | schema 변경, 배포 시에만 주입 |
| R2 private media key | private 원본 bucket object read/write/delete, bucket 관리 금지 |
| R2 public media key | public media bucket object write/delete, bucket 관리 금지 |
| R2 backup key | backup bucket write/read, media·staging 접근 금지 |
| cache purge token | 해당 zone cache purge only |
| event HMAC keyring | event service only, active version과 보존 중 raw가 참조하는 이전 version만 포함 |
| admin actor HMAC secret | BFF only, 내부 `operatorId` 가명화 |
| Core service token | BFF·Core만 공유, 외부 노출 금지 |
| 외부 provider audience/team | BFF adapter 설정, 비밀값과 분리 |
| 운영자 identity·`operatorId` 매핑 파일 | BFF only, 읽기 전용 mount, 비밀값 아님이나 접근 제한 |
| 카카오 공유 JavaScript key | 공개 config, 허용 도메인 등록으로 오용 제한 |

- `.env.template`에는 이름과 설명만 넣고 값은 넣지 않는다.
- production secret 파일은 root 소유 `0600`으로 둔다.
- CI secret은 protected branch deployment에서만 주입한다.
- token·password·private key를 command argument와 process list에 노출하지 않는다.
- 90일마다 사용 여부를 점검하고 침해·운영자 변경 시 즉시 rotation한다.
- backup 암호화 복구 key는 서버와 다른 위치에 오프라인 보관한다.

event HMAC의 정상 rotation은 UTC 날짜 경계에서 끝나는 기존 schedule과 같은 시각에 시작하는 새 schedule을 배포한다. 수신 시각이 아니라 보정된 `occurredAt`이 포함된 schedule을 선택해 지연 이벤트도 원래 UTC 날짜의 key를 사용한다. 이전 key는 해당 version의 raw 보존 기간이 끝날 때까지만 유지한 뒤 삭제한다. 침해가 의심되는 key는 시각과 관계없이 즉시 비활성화하고 그 version을 참조하는 raw 이벤트를 삭제한 뒤 일별 비식별 집계만 유지한다. 폐기 schedule을 가리키는 지연 이벤트는 서버 수신 시각과 현재 emergency version으로 다시 보정한다. raw row의 key version 없이 secret만 교체하지 않는다.

## 6. DB 권한

```text
blariyo_app
  CONNECT
  USAGE on content, legal, analytics, ops, collect
  SELECT, INSERT, UPDATE, DELETE on M0 application tables
  USAGE, SELECT on M0 identity sequences
  no access on ops.schema_migration
  no CREATE on application schemas or public

blariyo_migrator
  CONNECT, application schema owner, migration 실행에 필요한 DDL

blariyo_backup
  CONNECT
  USAGE on content, legal, analytics, ops, collect
  SELECT on M0 application tables and sequences
```

- application은 root 계정을 사용하지 않는다.
- API·application command, migration, backup container는 각각 `blariyo_app`, `blariyo_migrator`, `blariyo_backup` credential만 받고 password file을 서로 mount하지 않는다.
- application SQL은 schema-qualified 물리명을 사용하고 `public` schema의 `CREATE` 권한은 회수한다.
- PostgreSQL은 Docker data network에서만 listen하고 `pg_hba.conf`는 application·migration·backup role의 database 접근만 허용한다.
- production seed에 공용 비밀번호와 샘플 회원을 넣지 않는다.
- migrator는 향후 생성되는 table·sequence에도 역할별 default privilege를 설정한다.
- migration은 배포 한 번에 한 process만 실행하도록 `pg_advisory_lock`을 사용한다.
- production database와 application role의 `timezone`은 `UTC`로 고정하고 API 연결에 `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`을 설정한다.

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

IP는 보안 log에서만 최소 기간 90일 사용하고 product event와 결합하지 않는다. 일반 access log에는 Cloudflare request ID와 축약 경로를 사용한다.

### 보존

| 로그 | 보존 |
| --- | --- |
| application JSON log | 14일 local rotation |
| Nginx access·error | 14일 local rotation |
| 관리자 상태 변경 | DB에 운영 기간 유지 |
| 로그인·접근 보안 기록 | 90일 |
| backup 실행 결과 | 90일 |

디스크 사용량이 70%를 넘으면 log level·rotation을 확인한다. 디스크 부족 시 공개 요청을 죽이는 것보다 오래된 일반 log부터 제거한다. 보안 로그는 외부 backup 후 제거한다.

## 8. 모니터링과 알림

M0는 유료 APM을 사용하지 않는다.

### 외부 감시

무료 구간이 있는 외부 HTTP monitor 한 곳에서 5분마다 확인한다.

```text
GET https://__SERVICE_DOMAIN__/health/live
GET https://__SERVICE_DOMAIN__/meme
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
| PostgreSQL custom-format logical dump | 매일 03:30·15:30 KST | 최근 28개(14일) |
| 주간 보존 복사 | 매주 월요일 | 8개 |
| backup manifest 검증 | 매일 dump 후 | backup과 동일 |
| 실제 복원 시험 | 매월 첫째 주 | 결과 1년 |
| R2 media inventory | 매주 | 8주 |

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
- lifecycle 삭제는 daily·weekly prefix별로 적용한다.

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
- production placeholder `__SERVICE_DOMAIN__` 없음
- `NUXT_TRUSTED_CLIENT_IP_HEADER`, `NUXT_KAKAO_JS_KEY`, `NUXT_ADMIN_OPERATOR_MAP_FILE`, `COLLECT_USER_AGENT` 주입 확인
- 카카오 공유 CSP 호스트가 확정값이거나 카카오 공유가 비활성 상태
- 목록 수집을 켠 출처의 `robots_allowed`·`robots_checked_at` 기록 존재

현재 `.gitignore`는 `package-lock.json`을 제외하지 않지만 `yarn.lock`은 제외한다. npm을 표준
package manager로 유지한다면 API·Web의 `package-lock.json`을 추적하고 `npm ci`로 검증한다.
다른 package manager로 바꾸려면 `.gitignore`, CI 명령과 lockfile 정책을 함께 갱신한다.

### rollback

- application-only 변경은 이전 image digest로 되돌린다.
- expand/contract migration을 사용해 이전 image와 한 버전 호환한다.
- column rename·drop은 두 번째 배포 이후 수행한다.
- 데이터 변환 migration은 실행 전 별도 backup과 검증 query를 둔다.
- 복구 불가능한 schema 변경은 자동 rollback하지 않는다.

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

1. scheduler last run과 due row 확인
2. 중복 발행 여부 확인
3. R2 image 상태 확인
4. 조건부 command로 재실행
5. 목록·상세 cache purge 확인

운영 cron은 API image에서 다음 단발성 명령을 실행한다.

```text
매분     npm run posts:publish-due
매분     npm run outbox:run
5분마다  npm run events:aggregate
10분마다 npm run collect:crawl-due
```

정책 시행은 cron에 등록하지 않는다. 승인된 정책 release artifact의 checksum과 시행 시각을 운영자가 확인한 뒤 시행 시각부터 5분 안에 `npm run policies:publish -- --artifact=<path>`를 한 번 실행하고 `/api/v1/policies/:type`, `/terms` 또는 `/privacy`의 현재 버전·이력과 cache purge 결과를 확인한다. window를 놓치면 과거 시행 시각을 강제하지 않고 새 시행 시각으로 법무 문서·artifact를 다시 승인한다. 정책 본문·버전·시행 시각을 command argument에 직접 넣지 않는다. host artifact는 root 소유 `0600`으로 보관하고 실행 시 command container에만 읽기 전용 secret으로 mount하며 종료 후 mount와 임시 파일을 제거한다.

outbox worker는 중단된 `RUNNING`을 5분 뒤 회수하고 실패할 때마다 지수 backoff를 적용한다. 8회 실패한 `DEAD` 작업은 자동 재실행하지 않고 원인과 대상 object 상태를 확인한 뒤 운영자가 처리한다.

### 수집 실패와 차단

1. 알림의 출처와 오류 코드 확인
2. `disabledReasonCode`로 자동 비활성 여부 확인
3. 대상 사이트의 `robots.txt`와 접근 정책 변경 여부 확인
4. 차단이면 목록 수집을 끄고 운영자 URL 지정 경로만 유지
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
| 매일 | backup, 외부 health, disk, outbox DEAD |
| 매주 | container update 후보, R2 orphan, 예약 발행 결과 |
| 매월 | 실제 restore, 비용, secret·외부 관리자 사용자, dependency audit, 수집 출처 오류·차단 추세 |
| 분기 | 런타임 LTS patch, 보존 데이터 삭제, 공급자 가격·무료 정책, 수집 출처 `robots.txt`·이용약관 재확인 |

Node patch는 검증 후 같은 LTS major 안에서 올린다. major 전환은 별도 호환성 테스트와 설계 변경으로 처리한다.
