# M0 보안·운영 설계

M1 회원·M1.5 익게의 추가 계약은 [회원·익게 기술 설계](06-member-community-design.md)를 따른다. 이 문서의 M0 한정 계약과 구분한다.
- 문서 상태: M0 보안·운영 설계 계약 · 공개 경계·정기 작업·암호화 백업 복원 검증, 관리자 쓰기·장기 관찰 잔여
- 기준일: 2026-09-04
- 문서 대조일: 2026-09-24 (운영 관측은 9월 23일 기록, 이번 실환경 재검증 아님)
- 운영 권한: 사용자만 서버·백업 관리, 공동 운영자(친구)는 게시물 권한만 갖는다(2026-09-26 결정). 실제 계정·권한 통제와 인수는 별도 검증.
- 장애 알림 채널: Discord. 사용자 보고로 채널 생성 완료·현재 사용자만 참여. 실제 연동·실수신은 미검증이며 친구 초대는 필수 조건이 아니다.
- 가용성 방식: 고가용성 대신 감지·백업·복구

2026-09-26 최종 [저장소 선택](../planning/02-infra-plan.md#6-데이터와-저장소-원칙)은 **운영 DB 백업만 Google Drive**다.
공개 전·공개 이미지/첨부는 기존 R2 private/collect·public media를 유지한다. 아래 R2 backup 권한·절차는 전환 전 현행 구현이며 Drive 적용 완료가 아니다.
DB 백업 전환 목표·검증은 §9를 따른다. 본문·검수 상태의 운영 DB는 PostgreSQL에 유지한다.

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
| 수집 후보 보존 | legacy 미승격 metadata 후보 30일; direct 이미지·첨부·원문·본문은 검수 완료·반려 후 7일 삭제, 미검수는 수집일부터 28일. 식별자·세부 계약은 수집 기획 참고 |
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
| VM·disk 소실 | 현행 R2 / 목표 Drive 선택 암호화 DB backup, image 원본 R2 저장 |
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

### robots.txt

- 제품 기준은 [서비스 기획의 검색엔진 수집 안내](../planning/01-service-plan.md#검색엔진-수집-안내)다.
- Nuxt의 `apps/web/public/robots.txt`를 정적 파일로 제공한다. 루트 `/robots.txt`의 GET·HEAD가
  인증 없이 HTTP 200과 `text/plain`으로 응답해야 한다.
- `User-agent: *`의 기본 허용 아래 `/admin`, `/api/`, `/internal`, `/health/`, `/__gateway_health`
  접두 경로를 `Disallow`한다. `/admin`은 `/admin` 자체와 하위·접두 경로를 함께 제외한다.
- 공개 목록·상세·정책 페이지, `/_nuxt/`, `/og/`, `/media/`를 차단하지 않는다.
  `Sitemap: https://blariyo.com/sitemap.xml`로 아래 자동 생성 index를 안내한다.
- 이 파일은 자발적으로 규칙을 따르는 봇의 수집 안내이며, Access·BFF 인증과 내부 경로 차단을 대신하지 않는다.
  검색 결과 제외는 별도의 404·`noindex` 계약을 따른다.
- 수집 제외와 같은 접두 경로의 Web 응답에 `X-Robots-Tag: noindex`를 붙인다. 봇이 응답을 읽을 때만
  효력이 있으므로 기존 검색 결과 삭제 완료로 판정하지 않는다. Web 앞의 Access 인증·Nginx 404 응답은
  별도 계층이며 이 Web header 검증을 그대로 승계하지 않는다.
- 2026-09-24 운영 `/robots.txt` 읽기 전용 조회에서는 HTTP 200·`text/plain`과 Cloudflare 관리 규칙만
  확인했다. 앱 경로 규칙의 운영 반영은 배포 후 별도 검증한다.
- Cloudflare 관리 기능이 켜져 있으면 origin의 HTTP 200 파일 앞에 관리 규칙을 붙인다.
  배포 후 최종 응답에 관리 규칙과 앱 규칙이 모두 있는지, 공개 경로 허용·내부 경로 제외·기존 봇별
  차단이 유지되는지 확인한다. 로컬 응답 검증은 이 운영 병합 검증을 대신하지 않는다.
- 규칙 근거: [Google robots.txt 해석](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec),
  [Cloudflare 관리 파일 병합](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/).

### 사이트맵 자동 생성

- 공개 Web의 GET·HEAD `/sitemap.xml`은 sitemap index, `/sitemap-pages.xml`은 활성 게시판 목록과
  실제 발효된 약관·개인정보 페이지, `/sitemap-posts-{shard}.xml`은 공개 게시글 URL 목록이다.
  루트의 canonical 주소만 기록하며 검색 query·관리자·미공개 글·이미지 원본 URL은 넣지 않는다.
- Web은 Core `/internal/sitemaps/{index.xml|pages.xml|posts-{shard}.xml}`만 조회한다.
  SQL·공개 상태 판정·XML 생성·캐시는 Core가 담당한다. 내부 route는 기존 Docker network 경계와
  Nginx `/internal` 거부를 유지하며 공개 `/api/v1` JSON 계약을 확장하지 않는다.
- 게시글 ID의 고정 1만 구간으로 분할한다: shard 0은 ID 1~10000, shard 1은 10001~20000이다.
  삭제·숨김으로 뒤 파일의 소속이 밀리지 않으며 본문·이미지·조회 수를 읽지 않는다.
  활성 게시판의 `PUBLISHED`이면서 `published_at <= now()`인 글만 ID 범위 조회한다.
- index는 공개 글이 존재하는 구간만 조회한다. 이 구간 집계는 전체 공개 ID에 비례하는 작업이며
  캐시가 만료된 index 요청에서만 실행한다. 게시글 파일은 PK 범위 조회로 최대 1만 행만 반환한다.
- 성공한 XML은 Core process 내에서 300초 재사용한다. 같은 파일의 동시 생성은 합치고, 캐시는
  최대 32개·16 MiB, 동시에 만드는 파일은 최대 4개로 제한한다. 오류는 저장하지 않는다.
  외부 응답은 `no-store`로 추가 캐시 지연을 막는다. 재시작·여러 replica의 캐시는 독립이다.
- 게시글 `lastmod`는 발행일·실제 수정일 중 늦은 시각을 사용한다. 생성 시각·조회 수를 수정일로 쓰지 않는다.
  index와 고정 페이지에는 신뢰할 수정일이 없으면 `lastmod`를 생략한다.
- 표준의 파일당 5만 URL·비압축 50 MiB 한도를 지킨다. index는 pages 1개와 게시글 파일 최대 49999개다.
  한도 초과·DB 장애·잘못된 응답은 오류로 처리하며 일부 목록이나 빈 성공으로 대체하지 않는다.
  비어 있는 게시글 구간은 404다. XML 특수문자와 canonical origin을 검증한다.
- 추가 cron·외부 서비스·DB migration은 없다. 요청 시 자동 갱신하며 처음 요청은 생성 비용이 든다.
  index 집계 시간이 길어지거나 여러 replica에서 중복 부하가 관측되면 변경 구간 추적과 정적 파일
  사전 생성으로 전환한다. 대규모 운영 성능은 별도 측정 대상이며 건수만으로 처리 시간을 보장하지 않는다.
- 배포 후 `/robots.txt`의 안내와 index·하위 XML의 HTTP 200, 실제 공개/비공개 포함 여부를 재확인한다.
  표준 근거: [Sitemaps protocol](https://www.sitemaps.org/protocol.html),
  [Google 사이트맵 작성](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

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

2026-09-25 사용자 요청으로 GTM `GTM-5BRTQ5T3` 컨테이너를 공통 HTML의 head 첫 부분과 body
첫 부분에 설치한다. 이 컨테이너 요청은 위 직접 GA4 adapter의 동의 gate와 별개다.
`apps/web/server/plugins/security.ts`의 `render:html`에서 삽입하고 응답별 nonce를 inline script와
동적으로 생성하는 GTM script에 전달한다. CSP의 script/img/connect/frame에는 정확한
`https://www.googletagmanager.com` origin을 허용한다. GA4·광고 목적지나 Preview Mode에 필요한
추가 origin은 자동 허용하지 않는다. [Google의 CSP 안내](https://developers.google.com/tag-platform/security/guides/csp)를
기준으로 적용하며 실제 콘솔 태그의 실행·수집 검증과 운영 배포는 별도다.

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
- 수집 제목·본문 TEXT는 plain text로 처리한다. direct는 파싱 전 응답 HTML을 비공개 raw object로 저장하며,
  공개 본문·로그에서 렌더하지 않는다. 원문 응답을 저장하지 않는 규칙은 legacy metadata 경로에 한정한다.
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

upload object key는 `content/private/staging/YYYY/MM/DD/{uploadRequestId}/{fileIndex}-{sha256}.{ext}`로 식별한다.
`uploadRequestId`는 서버 생성 고유값이고 SHA-256은 재인코딩한 bytes 기준이다. 매일 inventory는 생성 후
24시간이 지난 `content/private/staging/` 및 기존 `staging/` object를 DB image의 private key와 미완료(`PENDING`,`RUNNING`,`FAILED`,`DEAD`)
cleanup outbox의 key에 대조하고, 어느 쪽에도 없는 object만 삭제한다. 따라서 process crash로 outbox가
생성되지 않은 object도 회수하며, 후속 일반 사용자 업로드에도 같은 격리·보상 삭제 원칙을 적용한다.
M0에는 일반 사용자 업로드 endpoint를 추가하지 않는다.

일반 관리자 이미지 업로드 제한(수집 이미지 입력과 구분):

| 항목 | 제한 |
| --- | ---: |
| 파일 | 10MiB |
| 한 요청 | 10개·100MiB |
| 한 게시글 | 현행 편집·direct 초안 200개, legacy 후보 선택은 20개 |
| pixel | 40 megapixel |
| 형식 | JPEG, PNG, WebP, GIF |

GIF는 animation frame·총 decode 메모리를 제한한다. SVG는 script·외부 참조 위험 때문에 M0에서 받지 않는다.
direct 수집·API 수집 preview/초안 승격의 입력은 파일당 30MiB·글당 150MiB이며 이미지 200개·첨부 20개
상한을 별도로 적용한다. 픽셀·애니메이션 검증을 생략하지 않는다. 상세는
[수집 용량 계약](../planning/content-collection/README.md#2026-09-23-다중-이미지와-수집-용량-계약)을 따른다.

### 수집

현행 direct batch만 외부 원문을 fetch하고 비공개 수집 DB/object에 직접 저장한다. API는 batch 결과를 읽어
검수·초안 승격·별도 발행을 처리한다. 아래 통제는 [direct 기술 계약](07-spring-collector-design.md#2026-09-23-direct-batch-검수승격-구현-계약)과
출처별 정책으로 강제한다. 기존 candidate/preview·collector token 중계는 legacy 호환 경로다.

다음은 필요한 보안 계약이며 전부 구현 완료라는 뜻은 아니다. 9월 24일 대조에서 direct의 robots/Crawl-delay·
영속 일일 budget 연결 부재와 redirect 상한 차이를 확인했다. [미충족 통제](07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조)는
운영 활성화 전에 구현·검증하며 legacy의 quota/robots 테스트로 대체하지 않는다.

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
- direct 이미지·첨부·원문 HTML·본문의 검수 완료·반려 후 7일 삭제, 미검수의 수집일부터 28일 보관, 식별자 보존과 세부 계약은 [수집 기획](../planning/content-collection/README.md#13-m0-마무리-결정--2026-09-26)을 따른다. legacy 후보/preview 자동 파기와 별도 계약이다.
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
아래 주기·임계치는 설계 목표다. 외부 감시·알림 실수신·장기 관찰의 적용/미검증 상태는
[운영 상태](../operations/current-status.md)를 따르며 표만으로 설치 완료로 보지 않는다.

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

### Google Drive 전환 결정 — 2026-09-26

- 운영 DB 백업의 목적지는 **Google Drive**로 확정했다. `pg_dump`→age 암호화→SHA-256 manifest→비공개 Drive 저장으로 전환한다.
- 현행 [백업 도구](../../deploy/backup/README.md)는 R2에 업로드한다. 이 문서 변경은 전송 구현·기존 백업 중단·자료 이관·운영 적용 완료가 아니다.
- 계정 종류·용량·연결 정보는 실연동 전에 확인한다. 서버·백업 관리와 복구 권한은 사용자만 갖고 공동 운영자에게 부여하지 않는다. R2 media와 Drive DB 백업의 권한을 분리하고 백업 공개 공유를 허용하지 않는다. 이미지·첨부 binary를 Drive에 별도 백업하지 않는다.
- 전환 전에 업로드→독립 다운로드/해시 확인→격리 PostgreSQL 복원, 인증 복구·실패 시 Discord 알림을 검증한다. 암호화 복구 키는 Drive 백업과 별도 보관한다.
- 아래 일정·최근 7일 보존은 유지한다. Drive의 파일 식별·만료 삭제·복원 시 삭제 정책 재적용을 설계하며, 수집 첨부의 검수 완료·반려 후 7일과 DB 백업 보존기간을 혼동하지 않는다.
- Drive 경로의 성공·복원이 검증될 때까지 기존 정상 백업을 유지한다. 전환 이후 기존 R2 사본 처리는 확정된 보존 정책에 따라 별도 수행한다.

### 일정

| 작업 | 일정 | 보존 |
| --- | --- | --- |
| PostgreSQL custom-format logical dump | 매일 03:30·15:30 KST | 최근 7일 |
| 주간 보존 복사 | M0에서는 만들지 않음 | 최소 보관 원칙에 따라 별도 8주 복사 없음 |
| backup manifest 검증 | 매일 dump 후 | backup과 동일 |
| 실제 복원 시험 | 매월 첫째 주 | 결과 1년 |
| R2 media inventory | 매주 | 8주 |
| R2 private staging orphan inventory | 매일 1회 | 실행 결과 90일 |

### 현행 R2 구현 형식 — Drive 전환 전

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

VM snapshot은 과거 보조 수단 설명이다. direct 원문을 포함한 DB volume/snapshot을 새 백업 경로로 사용하지 않으며 M0-D03의 선택 dump를 적용한다. 기존 snapshot·수동 dump·장애 volume에 raw 사본이 있는지는 전환 inventory에 포함하고 검증된 대체·기한 회수한다. snapshot만으로 RPO를 충족했다고 간주하지 않는다.

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
- 실제 배포 architecture의 image build 성공. 현행 CI는 `linux/amd64`이며 ARM64 이동 시 별도 build·runtime 검증 필요; multi-arch 완료로 보고하지 않음
- DB backup 최근 18시간 이내
- production URL placeholder 없음
- `SITE_ORIGIN=https://blariyo.com/`·`NUXT_PUBLIC_SITE_ORIGIN=https://blariyo.com/`, `NUXT_TRUSTED_CLIENT_IP_HEADER`, `NUXT_ADMIN_OPERATORS_FILE` 주입 확인. 운영자 목록의 `active: true`인 identity만 허용한다. `COLLECT_USER_AGENT`는 수집 보조 활성 환경에서만 필수
- 카카오 공유 활성 환경은 JavaScript key, 개발자 콘솔 Web domain 등록, SDK script URL·SRI integrity와 CSP host 확인
- 위 카카오 운영값이나 등록 확인이 하나라도 없으면 `NUXT_PUBLIC_KAKAO_ENABLED=false`
- GA4 활성 환경은 Measurement ID·속성 보관 설정·국외이전 고지·실제 Google 계약 법인·Google
  tag/CSP domain 확정 확인
- 위 GA4 운영값이나 고지가 하나라도 없으면 `NUXT_PUBLIC_GA4_ENABLED=false`; 원인과 관계없이 false인
  환경은 `NUXT_PUBLIC_GA4_MEASUREMENT_ID`를 public runtime config에서 unset
- 신규 M0 Core 단독 준비 설정은 수집 flag를 모두 false로 두며 수집 gate 미완료가 Core 수동 공개를 막지 않음.
  2026-09-23 운영 DB·콘텐츠 반영 후에는 기존 direct 결과의 **관리자 batch 검수 flag만** API/Web에서
  true로 확인됐다([당시 운영 상태](../operations/current-status.md)). URL·Discord 접수와 자동 수집은
  비활성이며, 실제 MFA 검수 조작과 direct raw/media/report/queue 보존·고지 조건(§4)은 별도다.
- direct 수집 보조 활성화 시에만 Discord 확인/queue·출처·전용 DB/object 권한·보존/고지 gate 확인. Web URL 전달은 M0-D02의 확정 mailbox 목표 계약이며 collector 중계·preview gate는 legacy 경로에만 적용
- M0 자동 수집 활성화 시에만 별도 목록·feed·scheduler gate 확인

현재 `.gitignore`는 `package-lock.json`을 제외하지 않지만 `yarn.lock`은 제외한다. npm을 표준
package manager로 유지한다면 API·Web의 `package-lock.json`을 추적하고 `npm ci`로 검증한다.
다른 package manager로 바꾸려면 `.gitignore`, CI 명령과 lockfile 정책을 함께 갱신한다.

### rollback

- application-only 변경은 현재 DB와 호환성이 확인된 이전 image digest로 되돌린다.
- expand/contract migration을 사용해 이전 image와 한 버전 호환한다.
- column rename·drop은 두 번째 배포 이후 수행한다.
- 데이터 변환 migration은 실행 전 별도 backup과 검증 query를 둔다.
- 복구 불가능한 schema 변경은 자동 rollback하지 않는다.
- schema 호환성은 열/테이블뿐 아니라 이전 앱의 readiness 판정도 포함한다. `ops.is_schema_ready`는
  ledger의 최신 버전과 정확히 비교한다. 이전 앱이 모르는 최신 버전이면 additive migration이어도
  앱만 되돌리는 복귀를 보장하지 못한다. readiness 우회·ledger 값 수정으로 호환성을 만들지 않는다.
- 2026-09-23 Core 후보는 수집 OFF에서 V005 유지와 이전 이미지 복귀를 격리 검증했다
  ([Core 배포 후보](../../worklog/2026-09-23/release/candidate.md)). 이후 운영 DB에 API V008·Collector V006을
  적용했다([DB 반영 기록](../../worklog/2026-09-23/release/production-db-promotion.md)). V008에서 9월 20일
  구 API는 readiness 503이므로 앱만 복귀할 때는 V008 호환성이 확인된 직전 `5c581c2` Core release를
  기준으로 한다. 실제 운영 rollback은 미실행이다.


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
2. direct의 run/item 실패·중단 사유와 실제 source 설정 확인; `disabledReasonCode`는 legacy 출처 상태와 구분
3. 대상 사이트의 `robots.txt`와 접근 정책 변경 여부 확인
4. 차단이면 해당 batch item/source run의 실패를 보존하고 목록·상세 재시도를 중단한다. 목록 차단을 이유로 상세 경로를 자동 허용하지 않는다. 별도 공개 접근·정책 확인 뒤 상세 전용 사용 여부를 판정한다.
5. 파싱 실패면 실패 원문/fixture와 parser를 대조한다. 저장 결과를 성공으로 바꾸지 않으며 검수 대상 반려와 기술 실패를 구분한다.
6. 재활성화 전에 요청 간격·일일 상한을 다시 확인
7. 대상 사이트의 중단 요청은 권리 문의 runbook과 같은 절차로 처리

30일 파기는 legacy metadata 후보 계약이다. direct는 위 9/26 결정과 잔여 미정 계약을 따르며 기존 cleanup이
새 만료·삭제 정책을 처리한다고 가정하지 않는다. 보존을 위해 미검수 결과를 초안으로 승격하지 않는다.
raw HTML은 비공개 진단 object에만 두고 후보 화면·일반 로그에서 노출하거나 실행하지 않는다.

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

[Spring 수집 서버 상세 설계](07-spring-collector-design.md)를 따른다. 아래는 기존 Spring 서버의
Core 중계·quota·spool 계약이다. 현재 source·migration·API·격리 테스트는 존재하고 direct는 별도 실행 경로다.
현행 구현과 원격/실연동 미검증은 [요구사항 대조표](../development-specs/requirements-status.md)로 구분한다.
언어·실행 경로 변경을 이유로 접근 제한·비밀·원문 노출 통제를 완화하지 않는다.

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


<a id="m0-d03-drive"></a>
## M0-D03 — Google Drive DB 백업 목표 계약

설계일·공식 사양 확인일: 2026-09-26. **현행 run-backup.py/r2-transfer.cjs는 R2 full dump이며 아래 설계는 미구현**이다. 주기는 03:30·15:30 KST, DB backup의 기한은 snapshot 생성 시각+7×24시간, 순서는 logical dump→age 암호화→SHA-256 manifest를 유지한다. 이미지/첨부 binary는 R2에만 둔다.

### 계정·인증의 적용 조건

| 실제 계정 | 채택 방식·조건 | 실연동 전 사용자 확인 |
| --- | --- | --- |
| 개인 Google/My Drive 또는 Workspace My Drive | 사용자 OAuth offline refresh token, `drive.file`, 앱이 만든 비공개 전용 폴더와 파일만 관리 | Drive API 프로젝트·OAuth client·redirect·동의 상태·실제 용량, 재인증 담당 |
| 사용자가 관리하는 Workspace Shared Drive | 전용 Shared Drive의 서비스 계정. 회원/폴더·파일 생성/읽기/영구삭제 capability를 확인하고 그 drive 밖 권한은 주지 않음. 서비스 계정 소유 My Drive는 사용하지 않음 | 조직 정책·전용 drive ID·권한·용량·사용자 복구 접근. 영구 삭제에 필요한 organizer 권한은 해당 전용 drive로 한정 |
| 위 조건을 만족하지 못함 | Drive 전환 차단, 정상 R2 백업 유지. 계정/권한 해결 뒤 같은 계약으로 재시험 | 계정 종류는 `(미정)`, 용량·ID를 예시로 확정하지 않음 |

기본은 사용자 OAuth다. Shared Drive 조건이 실제 확인된 경우에만 서비스 계정 경로를 적용한다. 광범위한 domain-wide delegation은 도입하지 않는다. 개인 계정의 폴더를 서비스 계정에 공유하는 것만으로 저장 용량 문제가 해결된다고 가정하지 않는다. [공유 드라이브/서비스 계정](https://developers.google.com/workspace/drive/api/guides/about-shareddrives), [scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

offline 동의로 refresh token을 확보하고 만료 access token은 갱신한다. 401은 갱신 1회 후 실패 처리, invalid_grant·권한 회수는 재로그인 루프 대신 사용자 재인증과 경보다. 외부 Testing OAuth 앱의 refresh token은 보통 7일 만료이므로 이를 장기 무인 운전 조건으로 수용하지 않는다. token/client secret·resumable session URI는 서버 사용자 전용 0600 secret store에만 두고 보고서/로그에 출력하지 않는다. age 복구 private key는 사용자 오프라인/암호 관리자에 별도 보관하고 서버에는 public recipient만 둔다. [offline 갱신](https://developers.google.com/identity/protocols/oauth2/web-server), [token 만료 조건](https://developers.google.com/identity/protocols/oauth2).

### 백업에 넣을 데이터와 삭제 기한

선택은 **direct 일시 자료의 table data 제외**다. full dump를 7일 더 보관하거나 복원 시에만 삭제하는 대안은 원본 보존기간을 실제로 연장하므로 채택하지 않는다. 행별 암호화 키 파기는 별도 key 관리 시스템·복구 의존성이 커 M0에 도입하지 않는다.

- 포함: 전체 schema/함수·migration ledger, 기존 content/legal/ops 데이터(기존 보존 계약), 영구 `batch_dedup_key`, API 소유 `post_collection_origin`, 원문 없는 batch_retention·batch_purge_object와 source 설정/요청 통제의 안전 metadata. 복원 뒤 기준 시각이 지난 안전 ledger도 D01대로 정리한다.
- 제외(table schema는 포함): batch_item/media/run/report/checkpoint/failure/confirmation/queue/media_correction, batch_review/review_request, web_collection_request/web_collection_request_key, batch_input_receipt, batch_source_runtime의 **데이터**. 본문·전체 URL·snapshot·actor·receipt가 다른 JSON/outbox/audit 열에 복제되지 않는지 canary 검사를 선행한다. 데이터 제외 목록은 정확한 schema.table allowlist로 version 관리하고 새 collect 테이블이 생기면 분류 전 backup을 실패시킨다.
- 기존 legacy 후보 데이터는 기존 정책대로 유지하되 direct 원문을 legacy 테이블로 복사해 제외를 우회하지 않는다. 신규 FK가 제외 테이블을 참조하면 data-only 제외로 끝내지 않고 복구 모형을 먼저 갱신한다. 현행 review→content 참조는 content를 삭제할 이유가 아니다.
- 이는 운영 게시글·이미지 사본 복구를 유지하지만 **미검수 direct 원문/대기 요청의 장애 복구를 보장하지 않는 선택**이다. 복원 시 자동 재수집하지 않는다. 운영자가 해당 손실 범위와 dedup에 의한 재접수 거부를 OPS-03에서 인수한다. 기한 전 raw까지 백업해야 한다는 새 요구가 있으면 별도 정책 결정으로 다룬다.
- 로컬 spool도 같은 암호화된 선택 dump만 저장한다. 실패 사본을 다음 성공까지 무기한 두는 현행 동작은 목표 계약에서 제거하고 snapshot+7일, 미완료 upload+24시간 중 해당 기한에 삭제한다. 평문 dump 파일을 디스크에 만들지 않는다.

### 업로드·식별·완료

1. 실행별 잠금을 얻고 `backupId UUID`, snapshotAt/expiresAt, schema ledger hash, dumpProfileVersion과 exact 제외 테이블 목록을 고정한다. 기존 배포/수동 backup과 같은 lock을 사용한다. 주기 중복 실행은 새 backup을 만들지 않는다.
2. `pg_dump -Fc --no-owner --no-acl`에 검증된 제외 옵션을 적용해 age로 pipe한다. 암호문 SHA-256·byte size를 계산한다. 폴더 ID·drive ID·OAuth client identity를 고정하고 이름으로 파일을 식별하지 않는다.
3. archive와 manifest에 서로 다른 사전 생성 file ID를 예약해 0600 local journal에 기록한다. appProperties는 backupId, artifactKind, schemaVersion만; URL/개인정보 없음. 동일 backupId 재시도는 같은 ID·암호문으로 하며 이미 있으면 hash·size·parent를 대조한다. 불일치는 덮어쓰기 금지·충돌 경보다. [사전 file ID](https://developers.google.com/workspace/drive/api/guides/create-file), [custom properties](https://developers.google.com/workspace/drive/api/guides/properties).
4. archive는 resumable upload, chunk는 8MiB(256KiB 배수). session URI를 보관하고 중단 뒤 서버 offset을 조회해 이어 보낸다. session 404/만료이면 동일 file ID의 완료 파일 존재를 먼저 확인하고 없을 때 새 session. 308은 진행이며 성공 아님. manifest는 archive 실제 다운로드·SHA-256 확인 뒤 마지막에 올린다. Drive native 문서 형식으로 변환하지 않는다. [resumable 사양](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
5. manifest에는 backupId, archive file ID·SHA-256·size, snapshotAt/expiresAt, PostgreSQL major, API/Collector ledger hashes, dumpProfileVersion, excluded tables, age recipient fingerprint를 넣는다. 다운로드 검증 결과를 별도 receipt로 남기며 secret·원문 row는 넣지 않는다.
6. 성공은 dump/age·두 file의 실제 다운로드·manifest 관계·암호문 hash·권한 검사까지 끝난 상태다. 원격 metadata checksum만으로 성공시키지 않는다. 월간 및 전환/배포 gate의 **격리 복원 성공**은 별도 receipt이며 단순 업로드 성공과 구분한다.

### 실패·만료·Discord

| 실패 | 처리·성공 판정 |
| --- | --- |
| network·429·일시 5xx | Retry-After 우선, 그 외 1/2/4/8/16/32초+jitter 최대 6회/실행 예산30분. 파일/session 재조회 후 같은 ID로 이어가기; 완료 못 하면 FAILED |
| 403 quota/storage/permission | 사유별 구분. rate limit만 backoff, 용량 부족·권한 거부는 즉시 실패·사용자 조치. 7일 안의 정상 backup을 공간 확보용으로 조기 삭제하지 않음 |
| dump/age·hash·manifest 불일치 | 새 사본을 정상 목록에 넣지 않음, 불완전 artifact 회수. 이전 정상 사본도 자기 expiresAt까지만 유지 |
| 만료 삭제 실패 | 삭제 지연 자체를 장애로 기록·알림. 백업 성공 실패와 별개 timer가 매시간 exact file ID·parent·backupId·expiresAt을 대조해 재시도. 타 파일·폴더 재귀 삭제 금지 |
| 인증 장애 | 유효 credential 경로만 사용, 재인증은 사용자. 인증 불능 중 원격 삭제를 완료로 기록하지 않음 |
| Discord 실패 | backup 결과는 별도로 확정하고 알림 실패를 로컬 상태에 기록·재시도. 메시지 전송 실패로 backup을 중복 생성하지 않음 |

archive/manifest는 snapshotAt+7일에 **영구 삭제 API**로 제거하며 휴지통 이동으로 파기 완료 처리하지 않는다. Shared Drive는 삭제 권한·supportsAllDrives를 검증한다. 새 backup 성공을 만료 삭제의 선행 조건으로 두지 않는다. 성공/실패 양쪽 로컬·원격 사본의 초과 보존을 관찰한다. provider 내부 복제본의 즉시 물리 파기를 보장했다는 고지는 하지 않는다. [영구 삭제 API](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete), [오류 구분](https://developers.google.com/workspace/drive/api/guides/handle-errors).

Discord는 기존 사용자 전용 채널로 장애 종류, backupId, stage, 마지막 성공 시각·경과 시간, 안전 errorCode, 재시도 결과만 보낸다. 문서/본문/Drive file 링크/token/계정 식별값은 보내지 않는다. incident key=(job,stage,errorCode), 최초1회·지속6시간마다1회·회복1회로 제한한다. 전송은 1/5/30분 재시도 후 다음 주기, 영수증을 받아도 실수신 인수와 구분한다. 최신 정상 backup 18시간 초과·파기 지연은 즉시 경보다. 사용자만 참여 중이라는 보고는 연결/실수신 증거가 아니다.

### 독립 복원·전환·되돌리기

- 복구에는 현재 시각이 snapshotAt+7일 전인 검증된 backup만 선택하며 만료된 archive를 예외 복구 경로로 쓰지 않는다. 별도 사용자 복구 환경에서 Drive의 file ID로 archive/manifest를 다시 내려받는다(업로드 프로세스 캐시 재사용 금지). SHA-256·size·manifest 연결을 확인하고 오프라인 age key로 스트리밍 복호화한다. 빈 격리 PostgreSQL 18에 single transaction restore하고 역할은 별도 provisioning한다. 장애로 분리한 이전 DB volume과 수동 dump도 원문 잔존 inventory에 포함하며 보존 예외로 방치하지 않는다.
- API/Collector migration ledger·content 수량/본문·정책 hash·영구 중복 키·최소 승격 연결을 snapshot 기준과 비교한다. direct 원문 canary가 없는지 검사한다. 외부 fetch/cron/공개를 닫은 상태에서 D01 만료/삭제 ledger·R2 inventory를 적용하고 참조·미노출·재수집 방지를 검증한 뒤에만 서비스 재개한다.
- 단계1: **R2에서 선택 dump의 다운로드·격리 복원을 먼저 검증**하고 기존 full-dump 생성기를 교체한다. 기존 정상 백업 경로는 계속 동작한다. 보관 중인 7일 snapshot 각각은 사용자 복구키로 격리 복원→direct data 제외 재dump→age→동일 snapshotAt/expiresAt의 검증된 대체본을 만든 뒤 원본 archive·로컬 사본을 제거한다. 만료를 새 업로드 시각으로 초기화하지 않는다. 이미 만료된 원본 사본은 정책 위반 잔여로 즉시 회수 대상이며 예외를 부여하지 않는다.
- 단계2: 같은 선택 dump를 Drive에 병행 전송하고 독립 다운로드/해시/복원, token 갱신·권한 회수·용량 부족·Discord 수신·만료 삭제를 시험한다. 모두 통과 전 R2 정상 백업을 중단하지 않는다. 2회 연속 정기 Drive 성공과 최근18시간 내 복원 receipt를 전환 인수 증거로 남긴다.
- 단계3: 사용자만 Drive를 주 경로로 전환하고 R2 새 업로드를 중지한다. 기존 R2 선택 사본은 원래7일 기한에 정리한다. 7일 관찰은 실제 날짜로 수행한다.
- 복귀: Drive 장애/검증 실패면 동일 dump profile로 R2 전송 재개. Drive 파일·기존 R2 파일의 원래 기한은 유지한다. raw 포함 full dump·무기한 실패 spool로 돌아가지 않는다. 두 경로 모두 불능이면 장애·RPO 초과를 보고하고 Core 데이터를 임의 초기화하지 않는다.

실연동 입력: 계정 종류/용량·폴더/drive ID·OAuth 프로젝트와 secret 보관 경로·age recipient/사용자 복구키 보관 확인·Discord secret 위치와 채널 수신 확인. 사용자 담당, 단계1~2 직전에 필요하며 실값은 문서에 쓰지 않는다.

수용 시험: D03-T1 계정별 최소 권한/바깥 파일 거부, D03-T2 중단/응답 유실/동일ID 재시도, D03-T3 401·권한 회수·429·용량 부족, D03-T4 일곱 날 경계·새 backup 실패 중 만료/타 파일 보호, D03-T5 독립 다운로드·hash 오염·격리 복원과 D01-T7, D03-T6 R2 유지→Drive 전환→R2 복귀 및 Discord 실수신. 모두 후속 OPS-03/04 시험이며 이번에 실행하지 않았다.

<a id="m0-d04-roles"></a>
## M0-D04 — 최소 운영 권한 매핑

기술 role은 사용자 `OWNER`, 친구 `EDITOR`, 각 서비스의 전용 machine identity다. 범용 RBAC나 권한 관리 화면을 추가하지 않는다. 게시물 업무에는 원문 접수·검수·초안 승격이 포함되며 설정 조회는 비밀 없는 읽기만 허용한다.

| 행동 | OWNER | EDITOR | 통제 위치·서비스 |
| --- | --- | --- | --- |
| 글 작성/수정·이미지 업로드/preview·예약/발행/숨김/제거 | 허용 | 허용 | Access/MFA→BFF 활성 operator→Core AdminGuard·버전 검사. R2 key는 API만 사용 |
| direct URL 접수·조회·재시도·검수/반려·초안 승격 | 허용 | 허용 | 같은 인증+해당 feature flag, D01 만료/사본 검사. batch만 fetch |
| 실제 source 설정·실행 상태 안전 조회 | 허용 | 허용 | GET runtime-sources allowlist. source 수정 API는 direct에 없음 |
| source 파일 편집·수집 가동·계정 등록/회수·정책 시행 command | 허용 | 거부 | 사용자 전용 SSH/배포 파일. EDITOR가 legacy source PATCH에 직접 접근해도 403 또는 기능OFF 404 |
| 서버/DB 관리·migration·R2 console·Drive 다운로드·복구 | 허용 | 거부 | OS/DB/Cloud/Drive 계정 ACL. 앱 세션으로 관리 credential을 발급하지 않음 |
| Discord 장애 수신·설정 | 사용자 채널 | 필수 아님 | 친구 초대·봇 관리권 부여 불필요 |
| API machine | content·API 요청/검수 쓰기, batch 안전 조회·제한 함수 | 사람 계정 대체 불가 | batch queue/confirmation 직접 DML·외부 원문 fetch·Drive/서버 권한 없음 |
| batch machine | batch 결과/queue·runtime 쓰기, mailbox 제한 함수 | 사람 계정 대체 불가 | content/검수 일반 DML·공개 R2·Drive 없음 |
| retention / backup machine | 각각 D01 회수 / D03 읽기·암호화 전송만 | 사람 계정 대체 불가 | 서로의 secret·OS 로그인·schema 변경 권한 없음 |

현재 `identity.ts`는 active operatorId→HMAC actor, `auth.guard.ts`는 service token·actor 형식만 검사한다. OWNER/EDITOR 구분은 **미구현**이다. 최소 변경은 기존 operator 파일에 role을 추가하고 BFF가 외부 role header를 제거한 뒤 `X-Blariyo-Admin-Role`을 내부에서만 생성하는 것이다. Core는 service token 검증 뒤 해당 role과 operation allowlist를 모두 검사한다. role 누락·알 수 없는 값은 거부하고 기존 항목을 OWNER로 암묵 승격하지 않는다. Core port를 공개하지 않으며 BFF header만으로 SSH/DB/Drive 권한을 얻지 못한다.

사용자가 설정한 두 operator의 identity/ID는 `(미정)` 실연동 입력이다. 기존 operatorId 재사용·공용 로그인·서버 token 공유 금지. 회수 시 Access 허용 목록과 active=false를 함께 반영하며 BFF는 요청마다 활성 상태를 확인한다. 이미 열린 화면·오래된 cookie로 mutation을 시도해도 다음 요청이 403이어야 한다. 서비스 자격증명은 사람 계정과 별도 rotation한다.

D04-T1 두 운영자의 Core·검수 허용, D04-T2 EDITOR의 직접 legacy PATCH/설정/서버·DB·R2·Drive 거부, D04-T3 클라이언트 role 위조·Core 직접 접근 거부, D04-T4 active 회수 후 기존 세션 거부, D04-T5 batch/API/retention/backup 교차 권한 거부, D04-T6 친구 이미지 업무에 storage credential 미노출. 메뉴 숨김과 별개로 API·DB GRANT·object/Drive ACL·실제 두 계정 인수를 OPS-01~04에서 확인한다.


D04 선택·복귀 근거: 앱 기능별 새 권한 편집 UI/범용 정책 엔진 대신 기존 operator allowlist의 두 role과 명시적 operation allowlist를 선택한다. 두 사람의 게시물 협업을 유지하면서 관리 계정 credential 분리로 서버/백업 경계를 강제할 수 있다. role 배포는 Core의 선택 gate 지원→BFF role 전달·registry 검증→실제 두 계정 거부 시험→Core role 필수 gate 순서다. gate 필수화 뒤 이전 BFF로 복귀하면 관리자 쓰기를 닫고 사용자만 점검하며 역할 없는 요청을 OWNER로 허용하지 않는다. 공개 읽기·예약 worker는 별도 machine 경계로 유지한다.
