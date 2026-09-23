# M0 시스템 아키텍처

M1 회원·M1.5 익게의 추가 계약은 [회원·익게 기술 설계](06-member-community-design.md)를 따른다. 이 문서의 M0 한정 계약과 구분한다.
- 문서 상태: M0 아키텍처 설계 계약 · 프로토타입 폐기 후 신규 개발 기준
- 기준일: 2026-09-04
- 정합성 검토일: 2026-09-04
- 관련 문서: [데이터 모델](02-data-model.md), [API 설계](03-api-design.md), [인프라 설계](04-infrastructure-design.md), [보안·운영](05-security-operations.md)

## 1. 목표와 제약

### 목표

- 한국 사용자가 목록과 상세를 빠르게 연속 탐색한다.
- 운영자 한 명이 하루 20~40개를 초안·예약·발행할 수 있다.
- 서버 한 대 장애 시 새 서버에 복구할 수 있다.
- 월 고정비를 가능한 한 `$0~12`에서 시작한다.
- 게시판, 이미지 저장소와 컴퓨트 사업자를 교체할 수 있다.

### 의도적으로 수용하는 제약

- 단일 VM과 단일 PostgreSQL은 단일 장애 지점이다.
- M0에는 무중단 배포와 다중 리전이 없다.
- 페이지 번호 방식은 낮은 데이터 규모를 전제로 `OFFSET`을 사용한다.
- 업로드 안전성 확보를 위한 metadata 제거·재인코딩은 필수다. 다중 해상도 파생 이미지 서비스·동영상 호스팅·실시간 알림은 없다.
- 소셜 로그인과 광고는 M0 runtime·schema·API에 포함하지 않는다. GA4는 M0 Web에 기본 비활성
  연동으로 포함하고 운영 gate를 통과한 환경에서도 분석 동의 후에만 로드하며 Core API와
  PostgreSQL에 자체 분석 저장 경로를 만들지 않는다.
- 수집은 `M0 Core` 뒤의 수집 보조·자동 수집 단계에 포함하지만 외부 사이트 구조 변경에
  취약하다. 파싱 실패를 장애가 아닌 후보 실패로 처리하고 운영자 수동 작성 경로를 항상 유지한다.
- 수집 대상은 등록·활성 출처와 그 하위 경로로만 제한하고, 임의 URL을 로컬 collector가 무제한
  fetch하지 않는다. BE·FE는 외부 사이트를 직접 fetch하지 않는다.

## 2. 시스템 컨텍스트

```text
[공개 사용자 브라우저] -- 기능 활성 + 분석 동의 후 --> [Google Analytics 4]
      |
      v
[Cloudflare DNS/CDN/SSL]
      |
      v
[Cloudflare Tunnel] ------ [외부 관리자 인증 provider] <------ [운영자]
      |                              |
      v                              v
[Nginx] ------------------------ /admin*, /api/v1/admin/*
  |
  v
[Nuxt SSR Web + BFF]
  |
  v
[Nest Core API] ----> [PostgreSQL 18]
  |
  +--------------------> [Cloudflare R2]
  +--------------------> [Cloudflare Cache Purge API]
  +<---- [Nuxt collector 전용 중계] <---- [운영자 로컬 collector] (Discord /collect url, 외부 fetch/parser)
[운영자 로컬 collector] ----> [Discord API/Webhook]
[운영자 로컬 collector] ----> [등록된 수집 출처] (outbound only, allowlist)
```

공개 사용자는 Cloudflare를 통해서만 원본 서버에 접근한다. 운영자 경로는 현재 Cloudflare Access를 외부 인증 provider로 사용하지만 이 검증은 Nuxt BFF adapter에만 둔다. VM의 80·443·5432 포트는 공용 인터넷에 열지 않고 `cloudflared`가 outbound tunnel을 만든다.

## 3. 컨테이너 구성

| 컨테이너 | 역할 | 외부 공개 |
| --- | --- | --- |
| `cloudflared` | Cloudflare Tunnel 연결 | outbound only |
| `nginx` | 내부 reverse proxy, 보안 header, 요청 크기 제한 | tunnel 내부 |
| `web` | Nuxt SSR, SEO·OG HTML, 외부 `/api/v1` BFF | Nginx 경유 |
| `api` | Core API, 조회·발행·숨김 transaction과 단발성 cron command | Docker app network에서 Web만 HTTP 접근 |
| `postgresql` | 게시글·정책·운영 작업 저장 | Docker private network only |
| `backup` | 정기 DB dump 암호화·R2 업로드 | outbound only |

수집은 서버 VM에 별도 fetch 컨테이너를 만들지 않는다. 별도 batch 컴퓨터의 `collector`가 source policy에 따라
Discord URL 확인 입력, 목록·상세 fetch, parser, `collect.batch_*`, object store와 report를 소유한다. `api`는
batch 결과 조회, 검수와 초안 승격·공개를 담당하며 외부 사이트를 fetch하지 않는다. source policy는 `HOT_LIST`,
`DETAIL_ONLY`, `BLOCKED`, `UNVERIFIED`로 구분한다.

`worker`는 별도 상시 컨테이너로 시작하지 않는다. 예약 발행과 정리 작업은 API 이미지의 단발성
명령을 cron에서 실행한다. 수집용 상시 worker는 M0 서버에 두지 않고 로컬 collector로 분리한다.
batch 컴퓨터 의존성은 현재 의도한 경계다. 운영 병목이 확인될 때만 별도 worker를 검토하며 API가 외부 fetch를
소유하도록 되돌리지 않는다.

M0 Core 반복 명령은 `npm run posts:publish-due`, `npm run outbox:run`이다. 예약 발행과 outbox는
매분 실행한다. 서버 목록 수집 command는 두지 않는다. direct batch CLI가 source policy에 따라 목록을
조회한다. 실제 요청 간격·일일 상한은 사용 결정된 출처 명세를 따른다. 정책
시행은 자동 scheduler가 아니라 승인된 정책 release artifact를 사용하는 운영 단발성 명령
`npm run policies:publish`로 수행한다. 각 명령은 공개 HTTP endpoint를 추가하지 않고 서버의 승인된 실행 경로에서 동일한
repository·service와 전용 system actor를 사용한다.

## 4. 애플리케이션 컴포넌트

### Nuxt Web

```text
pages
  /meme
  /:boardSlug/posts/:postId
  /terms
  /privacy
  /cookie-settings
  /admin
  /admin/collect
  /admin/collect/sources

server adapters
  BffRouteHandler
  CoreApiClient
  AdminIdentityProvider

ui
  board-list
  pagination
  article
  share-menu
  policy-modal
  state-view
```

- 공개 페이지는 SSR 응답에 실제 목록·본문·canonical·OG 정보를 포함한다.
- 상세 SSR의 `description`, `og:description`, `twitter:description`은 첫 공개 TEXT block plain text의
  앞뒤 Unicode whitespace를 제거하고 내부의 하나 이상 연속된 Unicode whitespace를 단일 U+0020
  space로 치환한 같은 값을 사용한다. 이 정리 뒤 grapheme 수가 120자 이하면 80자 미만이어도 문구를
  덧붙이지 않고 그대로 두며, 120자 초과는 Unicode grapheme cluster 기준 앞 119자와 단일 `…`로
  최대 120자를 만든다. UTF-16 code unit·byte 기준으로 자르지 않는다. 공개 TEXT block이 없으면
  확정 서비스 기본 문구를 사용한다.
- 없는 글과 숨김 글은 같은 `404` HTML을 반환하고 콘텐츠 데이터를 포함하지 않는다.
- 외부에 보이는 `/api/v1`은 Nuxt BFF 계약이다. 브라우저는 Core 주소나 Core API route를 알 수 없다.
- SSR은 같은 BFF handler를 호출하고, 상세 하단 페이지 이동은 same-origin `/api/v1/boards/:boardSlug/posts`를 호출한다.
- BFF는 공개 응답을 필요한 필드로 제한하고 외부 관리자 identity를 provider adapter로 검증한다.
- BFF는 외부 assertion을 Core에 전달하지 않는다. adapter가 외부 identity를 안정적인 내부 `operatorId`로 매핑하고 이를 HMAC actor로 변환해 내부 서비스 토큰과 함께 전달한다.
- BFF에는 SQL, 게시 상태 전이, outbox 생성 같은 업무 규칙을 두지 않는다.
- 카카오톡 공유는 브라우저에서 카카오 공유 script를 사용한다. script와 연결 도메인은 CSP allowlist에 명시하고 JavaScript key는 공개 config로 주입한다. script를 불러오지 못하면 공유 popup은 카카오 항목 없이 동작한다.
- GA4 feature flag 기본값과 운영 활성화 gate는 [분석·광고 계획 §2·§11](../planning/04-analytics-ad-plan.md)을
  따른다. gate를 통과한 환경도 저장된 분석 동의가 있기 전에는 Google tag를 로드하지 않는다. `page_view`,
  `select_content`, `share`, `scroll`은 브라우저에서 GA4로 직접 보내며 BFF·Core·PostgreSQL에
  복제하지 않는다.
- 수집 관련 화면과 API는 게시글 관리자 경로와 같은 인증 경계를 사용하고, 외부 사이트 fetch는 BFF가 직접 수행하지 않는다.

### Nest Core API

내부 디렉터리·의존성·언어 기준은 [M0 코드 구조](08-code-structure.md)를 따른다.
HTTP 입력·응답 처리와 업무 처리를 분리하며, M0의 기능 모듈이 업무 처리와 해당 SQL을 함께 소유한다.
DB 접근은 Repository와 Unit of Work에 격리하고 저장소·CDN 구현은 `adapters`에 둔다. 전환 구조와 상태는 [코드 구조](08-code-structure.md)를 따른다.

`features/collection`의 수집 서비스가 출처·후보 상태를 관리하고, 후보를 초안으로 승격할 때는 `features/posts`의 `PostsService` 초안 생성 경로를 재사용해 게시글·이미지·상태 이력 규칙을 중복 구현하지 않는다.

- Controller는 SQL과 상태 전이 규칙을 직접 처리하지 않는다.
- 공개 조회와 관리자 명령 모델을 분리한다.
- `PostsService`만 게시 상태를 변경하고 이력 행을 같은 transaction에 기록한다.
- R2 업로드나 캐시 제거 같은 외부 I/O는 DB transaction 밖에서 수행하고 보상·재시도 상태를 남긴다.
- host port, public DNS, Nginx upstream을 만들지 않는다. HTTP 호출자는 Docker app network의 `web` 하나로 제한한다.
- cron은 외부·내부 HTTP route를 호출하지 않고 API image의 단발성 command로 같은 service·repository 계층을 실행한다.
- 관리자 route는 BFF와 공유한 내부 서비스 토큰과 `admin:vN:<HMAC>` actor 형식만 검증한다. Core는 외부 인증 provider, JWT claim과 JWKS를 알지 않는다.
- Core API에는 외부 사이트 fetch adapter를 두지 않는다. 외부 fetch와 parser 실행은 로컬 collector의
  책임이다. Core는 collector service token, 후보 상태 전이, 출처 활성 상태, 요청 상한 기록,
  제출된 metadata schema와 중복만 검증한다.

### Collector 전용 중계 경계

M0 수집 보조에서만 `https://<service-origin>/api/collector/v1/*`를 Nuxt의 기계 호출 전용
중계 경로로 연다. Nginx는 기존처럼 Web에만 연결하며, Web은 명시한 method·path만
Core `/internal/collect/*`로 매핑한다. 공개 브라우저 `/api/v1`와 관리자 session 계약에 섞지 않는다.
collector bearer token은 이 경로에서만 Core CollectorAuth로 전달하고 외부 입력의 Core service token·
admin actor header는 제거한다. Core는 token의 해시·scope·collectorId 매핑을 검증하며 관리자 권한을
부여하지 않는다. CORS는 허용하지 않고 TLS·요청 크기 제한·token별 rate limit을 적용한다.
전체 flag가 false이면 중계 route를 등록하지 않고 404다. Core 직접 공개 포트와 DNS는 만들지 않는다.

이 방식은 기존 Tunnel·Web 경계를 재사용한다. private network 신규 도입보다 구성이 작지만 Web이
collector 파일 중계 부하를 받으므로 preview를 파일당 10MiB로 제한한다. 운영상 병목이 확인되면
전용 ingress 또는 private network로 이전하되 Core의 후보 서비스와 token 권한은 유지한다.
실제 origin·token·rate-limit 운영값은 배포 전에 확정하며 기능 활성화 전까지 미검증이다.

GA4 기본 `page_title`, `page_location`, `page_referrer`도 [분석 계획 §4](../planning/04-analytics-ad-plan.md)의 고정값 규칙을 따른다. 자동 page view와 향상된 측정을 끄고, 실제 제목·URL·postId가 기본 필드로 전송되지 않는지 network 검증을 운영 활성화 조건에 포함한다.

## 5. 주요 흐름

### 목록 조회

```text
GET /meme
  -> Cloudflare cache bypass
  -> Nuxt SSR
  -> Nuxt BFF GET /api/v1/boards/meme/posts?page=1
  -> Nest Core API
  -> PostgreSQL: 공지 0~3 + 일반 글 20 + total count
  -> SSR HTML
  -> Cache-Control: no-store
```

- M0 공개 게시글 목록·상세 API와 HTML은 `no-store`이며 CDN cache rule도 이를 덮어쓰지 않는다.
- 게시·숨김 성공 시 `/meme`와 영향을 받는 상세 URL을 URL 단위로 purge한다.
- 공지는 모든 목록 페이지에 동일하게 붙고 일반 글 20개 계산에서 제외한다.

### 상세 조회

```text
GET /meme/posts/:postId
  -> boardSlug=meme인 활성 게시판 확인
  -> 게시글의 board_id와 요청 게시판 일치·공개 여부 확인
  -> 본문 block + 이미지 + 출처 조회
  -> 같은 board에서 현재 글이 포함된 listPage 계산
  -> SSR HTML + 상세 하단 목록 20개
```

- `PUBLISHED`이며 `published_at <= now()`인 글만 공개한다.
- `HIDDEN_REVIEW`, `REMOVED`, 존재하지 않는 번호와 게시판 불일치는 동일한 `404` 응답이다.
- 상세 하단의 다른 페이지를 누르면 본문은 유지하고 목록 API만 다시 호출한다.
- 상세 화면을 정상 표시한 브라우저는 payload 없는 조회 수 endpoint를 페이지 lifecycle당 한 번
  호출한다. endpoint는 공개 상태를 다시 확인하고 `view_count`를 원자적으로 증가시킨다.
- 조회 수 호출 실패는 상세 화면을 실패시키지 않는다. 별도 방문자·세션 식별자와 조회 이력은
  저장하지 않으므로 새로고침·자동화 요청을 사람 단위로 보정하지 않는다.

### 이미지 등록과 발행

```text
운영자 -> BFF 외부 인증 -> 업로드 요청
  -> API가 MIME·크기·decode 검증
  -> private 원본 key로 R2 저장
  -> 이미지 metadata 저장
  -> 게시글 block 구성
  -> publish command
  -> private 원본을 public media bucket의 결정적 key로 copy
  -> DB post·image status + image public key + status history commit
  -> cache purge
```

공개 media bucket의 custom domain은 bucket 전체를 읽을 수 있으므로 private 원본과 같은 bucket을 쓰지 않는다. private 원본 key는 발행 후에도 복구·재공개를 위해 유지한다. 발행 transaction 성공 전에는 공개 URL이 생성돼도 게시글 API가 public key를 참조하지 않는다. R2 copy 성공 후 DB 반영에 실패한 orphan public object는 매일 정리 후보로 기록한다.

### 권리 요청 숨김

```text
이메일 확인
  -> 운영자가 관리자 화면에서 숨김 실행
  -> PUBLISHED -> HIDDEN_REVIEW
  -> 상태 이력 기록
  -> image PUBLIC_DELETE_PENDING + 이미지 URL purge·public object 삭제 outbox
  -> /:boardSlug/posts/:postId, /:boardSlug HTML cache purge outbox
  -> 공개 API 즉시 404
  -> worker가 public object 삭제 후 이미지 URL을 purge하고 PRIVATE_REVIEW 전환
```

이메일 수신만으로 자동 숨김하지 않는다. 이메일 본문과 소명 자료는 애플리케이션 DB·로그에 복사하지 않는다. `OBJECT_DELETE_PUBLIC` 작업은 public object를 먼저 삭제하고 payload의 정확한 공개 이미지 URL을 purge한 뒤에만 성공 처리한다. 어느 단계든 실패하면 공개 API는 계속 404를 유지하고 worker가 전체 작업을 재시도한다. object 삭제는 멱등 처리하므로 purge 재시도 중 원본 cache가 다시 채워지지 않는다. 재공개는 public 삭제가 끝난 뒤 private 원본에서 다시 promote한다.

### 예약 발행

```text
매분 cron
  -> due SCHEDULED candidate 조회
  -> staging image를 결정적 public key로 R2 copy
  -> SCHEDULED·lock version 조건부 DB transaction
     -> image public key·status
     -> post PUBLISHED·published_at
     -> status history·cache purge outbox
  -> commit 후 cache purge worker
```

예약 등록 시점에 같은 게시판의 `SCHEDULED`·`PUBLISHED` 공지 위치 중복을 미리 거부하므로 due 발행이 공지 위치 제약으로 실패하지 않는다. 그래도 제약 위반이 발생하면 scheduler는 해당 글을 `DRAFT`로 되돌리고 `PINNED_ORDER_CONFLICT` 사유를 상태 이력과 운영 알림에 남긴다. 같은 글을 무한 재시도하지 않는다.

R2 copy 동안 DB row lock이나 transaction을 유지하지 않는다. 여러 scheduler가 같은 candidate를 집어도 public key가 결정적이라 copy는 같은 결과가 되고, DB의 `status=SCHEDULED`와 `lock_version` 조건부 update 한 건만 성공한다. 조건을 잃은 worker는 DB 변경 없이 종료한다. R2 실패 시 글은 `SCHEDULED`에 남겨 다음 실행에서 재시도하며 공개 API에는 노출하지 않는다. 서버가 내려가 있던 동안 지난 예약은 복구 후 다음 실행에서 발행한다.

### 수집 후보 생성

```text
관리자 URL 지정
  -> BFF 외부 인증
  -> Core가 URL 정규화·출처 매칭
  -> 후보 작업 PENDING 저장
  -> 로컬 collector가 작업 claim
  -> 출처 등록/활성·robots·요청 상한 확인
  -> 로컬 collector가 단일 상세 페이지 1회 GET과 parser 실행
  -> 제목·이미지 후보 URL 추출
  -> 로컬 수집기 작업 경로에 이미지 후보 임시 preview 저장
  -> Core collector 제출 API로 후보 결과 전송
  -> 원문 URL 중복·기존 게시글 중복 확인
  -> 후보 + 이미지 후보 metadata 저장

Discord /collect url
  -> 로컬 collector의 Discord App 연결
  -> guild·channel·user 권한 검증
  -> collector 전용 중계로 URL 접수(PENDING) 후 해당 candidateId claim
  -> 같은 단일 상세 페이지 추출과 Core 제출 흐름 실행
```

```text
M0 자동 수집
  -> source policy별 목록·feed·pagination
  -> batch direct DB/object-store 저장
  -> API read-only 조회·검수·초안 승격
```

후보 생성은 원문 URL과 metadata까지만 DB에 저장한다. Java/Spring 추출기는 운영자 검수 미리보기를
위해 로컬 작업 경로에 이미지 후보를 임시 파일로 둔다. 관리자 preview는 검증·재인코딩 후 별도
`collect-preview/` private object로 최대 24시간 저장할 수 있으며 영구 원본·content image row와 구분한다.
반려·만료·재시도 교체·승격 시 preview를 삭제하고 만료 object는 매일 정리한다. 이미지 영구 저장은
운영자가 후보를 초안으로 승격할 때 수행하며,
그 시점에 로컬 collector가 다시 제출하거나 운영자가 업로드한 파일을 기존 관리자 업로드와 같은
MIME·magic byte·decode·재인코딩 검증을 거쳐 private 원본 bucket에 넣는다. 검수 전 파일은
접근이 제한되고 만료가 있는 preview로만 보관한다.

같은 원문 URL의 batch item은 정규화된 URL hash와 source post key 기준으로 한 건만 유지한다. `403`, `429`, robots 금지,
timeout이 발생하면 item 또는 source run을 실패·차단으로 남기고 운영 알림을 만든다. `HOT_LIST` source는 연속 실패 시
목록 실행을 중단하며 `DETAIL_ONLY` source는 목록을 호출하지 않는다.

### 후보 초안 승격

```text
운영자 승격 요청
  -> 후보 상태·중복 재확인
  -> collector preview upload 또는 운영자 업로드 파일 검증·재인코딩
  -> private 원본 bucket 저장과 이미지 metadata insert
  -> 초안 생성 transaction(제목·block·출처·이미지 선점·상태 이력)
  -> 후보를 APPROVED로 바꾸고 생성된 게시글 연결
```

이미지 저장은 DB transaction 밖에서 수행하고, 저장에 성공한 이미지 key만 초안 transaction에 넣는다. transaction이 실패하면 후보는 원래 상태로 남고 저장된 이미지는 staging orphan 정리 대상이 된다.

## 6. 캐시 정책

| 대상 | 기본값 | 비고 |
| --- | --- | --- |
| `/meme?page=n` | `no-store` | 모든 query 변형 포함 |
| `/:boardSlug/posts/:postId` | `no-store` | 상세와 내장 목록 포함 |
| 정책 현재 본문 | CDN `300초` | 새 버전 시행 시 purge |
| 404·오류 | `no-store` | 숨김 정보가 cache에 남지 않게 함 |
| R2 공개 이미지 | `public, max-age=31536000, immutable` | storage key에 content hash 포함 |
| 관리자·계정 화면 | `private, no-store` | CDN cache 금지 |

게시글 API·HTML은 저장하지 않고 이미지는 불변 key로 길게 cache한다. 게시글 이미지가 바뀌면 기존 key를 덮어쓰지 않고 새 key를 발급한다.
숨김 commit 이후 시작된 조회는 목록에서 제외하고 상세는 일반화된 404를 반환한다.
이미 진행 중인 응답과 내려받은 콘텐츠의 회수는 보장하지 않는다. 이미지 원본 삭제·CDN purge는
별도 outbox 완료로 추적하며 즉시 차단을 보장하지 않는다. 기존 cache가 있는 환경에 적용할 때는
게시글 API·HTML의 모든 query 변형을 제거해야 한다. 기존 HTML purge outbox는 방어적으로 유지한다.

## 7. 확장 경계

다음 조건 전에는 구조를 늘리지 않는다.

| 관측 조건 | 다음 조치 |
| --- | --- |
| 메모리 7일 p95가 80% 초과 또는 OOM 발생 | VM RAM 상향 |
| DB CPU·I/O가 병목이고 앱 CPU는 여유 | PostgreSQL 전용 VM 또는 관리형 DB 분리 |
| 이미지 10GB 또는 R2 무료 operation 초과 | R2 유료 사용 유지, 비용 알림 추가 |
| 월 공개 요청이 단일 VM 처리량의 60% 초과 | Web BFF·Core API 컴퓨트 분리 또는 Core API replica 검토 |
| 배포 중단이 사업 손실로 이어짐 | 2대 구성·관리형 DB·load balancer 검토 |
| M0 검증 조건 충족 | 소셜 계정·참여 기능 설계 활성화 |
| 로컬 collector 운영 시간이 병목이거나 자동 수집이 공개 운영에 필요해짐 | 서버 worker 컨테이너 또는 외부 job runner 도입 검토 |
| 특정 출처의 차단·파싱 실패가 반복됨 | 해당 출처 목록 수집 중단, 운영자 URL 지정만 유지 |

Redis, queue broker, Kubernetes, Elasticsearch는 위 조건과 직접 연결된 필요가 확인되기 전에는 도입하지 않는다.

<a id="spring-collector-transition"></a>
## Spring 수집 서버 전환 계약 (2026-09-08)

상태: 전환 방향 확정·설계 정본 반영, Spring 구현 미착수·검증 미완료.
입력은 구현 작업 트리의 `worklog/2026-09-08/handoff/spring-collector-design-handoff.md`다.
인계 문서의 결정만 반영했으며 구현 브랜치나 docs 전체를 가져온 것이 아니다.

### 확정한 컴포넌트와 경계

| 컴포넌트 | 책임 |
| --- | --- |
| 운영자 로컬 Spring Boot 서버 | 상시 프로세스·REST 진입·공통 배치 실행 경로 |
| Spring Batch | 수집 Job·Step 실행, 실행 이력·재시작 관리 |
| Quartz | cron에 따른 실행 요청. 자체적으로 후보 상태나 발행 상태를 변경하지 않음 |
| REST API·Discord | 권한 확인 후 같은 배치 실행 경로 호출. 독립 runner·중복 추출 경로를 만들지 않음 |
| Java/Spring 추출기 | 허용 출처의 fetch·parser·로컬 임시 이미지 처리 |
| 기존 Web/BFF | `/api/collector/v1/*`를 `/internal/collect/*`로 중계 |
| 기존 Core | collector 인증·후보·이미지·검수·초안·발행과 서비스 DB의 유일한 쓰기 주체 |

```text
운영자 로컬: Quartz cron / REST API / Discord
  -> 공통 배치 실행 경로 -> Spring Batch Job -> 후보 선점·추출
  -> 기존 Web/BFF collector 중계 -> Core -> 후보 DB·비공개 이미지 저장소
  -> 기존 FE 검수 -> 초안 -> 별도 발행
Spring Batch·Quartz -> 운영자 PC의 전용 PostgreSQL 18 (`batch`·`quartz`·`collector` schema)
```

공개 Nuxt·Core의 배포 단위는 유지한다. Core 내부 스택은 08의 Nest/TypeORM 전환 계약을 따른다. 수집 서버 중단은 공개 BE·FE의 장애로
전파하지 않는다. Python 중심 실행·추출은 교체 대상이며 병행 운영을 기본안에 포함하지 않는다.
`s2b_batch`는 상시 서버 동작 구조의 참고일 뿐 업무 코드·인증·DB·설정 복사나 S2B 연결 대상이 아니다.

### 저장·API·복구 원칙

- Batch 메타데이터에 대한 직접 기록과 서비스 데이터 기록을 분리한다. Spring에서 `collect.*`·`content.*`를
  직접 INSERT/UPDATE하지 않는다. 서비스 DB 계정·이미지 저장소 자격을 수집기에 부여하지 않는다.
- 접수→claim→heartbeat→result→preview의 기존 API와 BFF 경로를 유지한다. Spring 계약은 모든 변경 호출의
  멱등 key, `collectorExecutionId`, lockVersion·lease fencing과 이미지 position→candidateImageId 대응을
  강화하고, 필요한 상태 조회·quota 예약·운영 이벤트 endpoint만 additive하게 확장한다.
- Batch transaction은 원격 Core API와 단일 transaction이 아니다. 응답 유실 시 같은 payload·멱등 key로
  결과를 재확인하며 새 key로 중복 결과를 만들지 않는다. lease·version 불일치는 재선점 계약에 따라 복구한다.
- Core 상태 조회와 로컬 중지는 [Spring 상세 설계](07-spring-collector-design.md)에 정의한 새 계약만 사용한다.
  응답 유실·멱등 만료·Job/Step restart는 execution-state와 payload digest로 재확인하며 추측 재실행하지 않는다.
- source host/CDN·robots·요청 간격/일일 한도·DNS/SSRF·redirect·크기·timeout 통제를 유지한다.
  quota 저장소를 바꾸더라도 재시작으로 일일 상한이 초기화되면 안 된다.

### 상세 설계 기준선

[Spring 수집 서버 상세 설계](07-spring-collector-design.md)를 구현 정본으로 사용한다.

- M0 구현 저장소의 `apps/collector`, JDK 25 LTS, Spring Boot 4.1.1 BOM, Spring Batch 6.0.5,
  Quartz 2.5.2와 전용 local PostgreSQL 18을 사용한다. patch 호환성과 실제 runtime은 구현 때 재검증한다.
- 후보 1건당 Tasklet Job 1개, 기본 동시 실행 1, lease 300초·heartbeat 60초·처리 cycle 최대 claim 3회,
  15분 Quartz·`Asia/Seoul`·misfire `DO_NOTHING`·기본 비활성으로 시작한다.
- 외부 HTTP quota는 Core API가 원자 예약 즉시 차감하며 robots·상세·redirect 각 hop·이미지 요청을 각각 센다.
  재시작해도 초기화하지 않고 오래된 execution은 예약·결과·preview를 변경할 수 없다.
- 로컬 REST는 loopback `127.0.0.1:18787`과 전용 scope bearer만 허용한다. Discord·Core token을 재사용하지
  않고 기존 Tunnel에 추가하지 않는다.
- 암호화 local spool은 동일 result payload 재생과 임시 이미지만 보관한다. result spool은 restartable
  상태에서 최대 7일, 이미지는 최대 24시간이며 terminal 후보와 durable 완료는 즉시 삭제한다.
- Batch·Quartz metadata, 상태 조회, 알림 outbox, macOS `launchd`, 보존·복구·fault test의 상세 조건은 07을 따른다.

실제 실행 PC·OS 계정·Discord와 Core token·출처·연락처·법무 승인·source/migration/OpenAPI/test/build/runtime은
미정 또는 미검증이다. 기존 Python의 8787 포트·5필드 cron·SQLite·대기 100건·이력 30일은 승계하지 않는다.
