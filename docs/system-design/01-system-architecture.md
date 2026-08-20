# M0 시스템 아키텍처

- 문서 상태: M0 아키텍처 설계 계약 · 현행 구현 산출물 없음
- 기준일: 2026-08-20
- 정합성 검토일: 2026-08-20
- 관련 문서: [데이터 모델](./02-data-model.md), [API 설계](./03-api-design.md), [인프라 설계](./04-infrastructure-design.md), [보안·운영](./05-security-operations.md)

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
- 원본 이미지 변환·동영상 호스팅·실시간 알림은 없다.
- 소셜 로그인, 광고와 GA4는 M0 runtime·schema·API에 포함하지 않는다.
- 수집은 M0에 포함하지만 외부 사이트 구조 변경에 취약하다. 파싱 실패를 장애가 아닌 후보 실패로 처리하고 운영자 수동 입력 경로를 항상 유지한다.
- 수집 대상은 등록된 출처와 그 하위 경로로만 제한하고, 임의 URL을 서버가 무제한 fetch하지 않는다.

## 2. 시스템 컨텍스트

```text
[공개 사용자]
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
[Express Core API] ----> [PostgreSQL 18]
  |
  +--------------------> [Cloudflare R2]
  +--------------------> [Cloudflare Cache Purge API]
  +--------------------> [등록된 수집 출처] (outbound only, allowlist)
```

공개 사용자는 Cloudflare를 통해서만 원본 서버에 접근한다. 운영자 경로는 현재 Cloudflare Access를 외부 인증 provider로 사용하지만 이 검증은 Nuxt BFF adapter에만 둔다. VM의 80·443·5432 포트는 공용 인터넷에 열지 않고 `cloudflared`가 outbound tunnel을 만든다.

## 3. 컨테이너 구성

| 컨테이너 | 역할 | 외부 공개 |
| --- | --- | --- |
| `cloudflared` | Cloudflare Tunnel 연결 | outbound only |
| `nginx` | 내부 reverse proxy, 보안 header, 요청 크기 제한 | tunnel 내부 |
| `web` | Nuxt SSR, SEO·OG HTML, 외부 `/api/v1` BFF | Nginx 경유 |
| `api` | Core API, 조회·발행·숨김 transaction과 단발성 cron command | Docker app network에서 Web만 HTTP 접근 |
| `postgresql` | 게시글·정책·이벤트 저장 | Docker private network only |
| `backup` | 정기 DB dump 암호화·R2 업로드 | outbound only |

수집은 별도 컨테이너를 만들지 않는다. 운영자 URL 지정 후보 생성은 `api`의 요청 처리 안에서, 허용 출처 목록 수집은 `api` image의 단발성 command에서 같은 service·repository 계층으로 실행한다.

`worker`는 별도 상시 컨테이너로 시작하지 않는다. 예약 발행, 정리 작업과 목록 수집은 API 이미지의 단발성 명령을 cron에서 실행한다. 수집 출처가 늘어 목록 수집이 API 응답에 영향을 주면 그때 별도 worker를 추가한다.

M0 반복 명령은 `npm run posts:publish-due`, `npm run outbox:run`, `npm run events:aggregate`, `npm run collect:crawl-due`다. 예약 발행과 outbox는 매분, 이벤트 집계는 5분마다, 목록 수집은 출처별 요청 간격을 지키는 10분 주기로 실행한다. 정책 시행은 자동 scheduler가 아니라 승인된 정책 release artifact를 사용하는 운영 단발성 명령 `npm run policies:publish`로 수행한다. 각 명령은 HTTP 관리자 경계를 우회하지 않고 동일한 repository·service와 전용 system actor를 사용한다.

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
- 없는 글과 숨김 글은 같은 `404` HTML을 반환하고 콘텐츠 데이터를 포함하지 않는다.
- 외부에 보이는 `/api/v1`은 Nuxt BFF 계약이다. 브라우저는 Express 주소나 Core API route를 알 수 없다.
- SSR은 같은 BFF handler를 호출하고, 상세 하단 페이지 이동은 same-origin `/api/v1/boards/:boardSlug/posts`를 호출한다.
- BFF는 공개 응답을 필요한 필드로 제한하고 외부 관리자 identity를 provider adapter로 검증한다.
- BFF는 외부 assertion을 Core에 전달하지 않는다. adapter가 외부 identity를 안정적인 내부 `operatorId`로 매핑하고 이를 HMAC actor로 변환해 내부 서비스 토큰과 함께 전달한다.
- BFF에는 SQL, 게시 상태 전이, outbox 생성 같은 업무 규칙을 두지 않는다.
- 카카오톡 공유는 브라우저에서 카카오 공유 script를 사용한다. script와 연결 도메인은 CSP allowlist에 명시하고 JavaScript key는 공개 config로 주입한다. script를 불러오지 못하면 공유 popup은 카카오 항목 없이 동작한다.
- 수집 관련 화면과 API는 게시글 관리자 경로와 같은 인증 경계를 사용하고, 외부 사이트 fetch는 BFF가 직접 수행하지 않는다.

### Express Core API

```text
routes
  public
  admin
  internal

controllers
  validation + response mapping

services
  BoardQueryService
  PostQueryService
  PostCommandService
  PolicyQueryService
  EventService

repositories
  PostgreSQL query and transaction

adapters
  ObjectStorage
  EdgeCache
  InternalServiceAuth
  SourceFetcher
  Clock
```

services에는 `CollectSourceService`와 `CollectCandidateService`를 둔다. `CollectCandidateService`만 후보 상태를 바꾸고, 후보를 초안으로 승격할 때는 `PostCommandService`의 초안 생성 경로를 재사용해 게시글·이미지·상태 이력 규칙을 중복 구현하지 않는다.

- Controller는 SQL과 상태 전이 규칙을 직접 처리하지 않는다.
- 공개 조회와 관리자 명령 모델을 분리한다.
- `PostCommandService`만 게시 상태를 변경하고 이력 행을 같은 transaction에 기록한다.
- R2 업로드나 캐시 제거 같은 외부 I/O는 DB transaction 밖에서 수행하고 보상·재시도 상태를 남긴다.
- host port, public DNS, Nginx upstream을 만들지 않는다. HTTP 호출자는 Docker app network의 `web` 하나로 제한한다.
- cron은 외부·내부 HTTP route를 호출하지 않고 API image의 단발성 command로 같은 service·repository 계층을 실행한다.
- 관리자 route는 BFF와 공유한 내부 서비스 토큰과 `admin:vN:<HMAC>` actor 형식만 검증한다. Core는 외부 인증 provider, JWT claim과 JWKS를 알지 않는다.
- 외부 사이트로 나가는 HTTP 요청은 `SourceFetcher` adapter만 수행한다. adapter는 등록된 출처 allowlist, `robots.txt` 판정, 요청 간격·일일 상한, redirect·응답 크기·timeout 제한과 사설 IP 차단을 강제한다. service·controller가 adapter를 우회해 직접 fetch하지 않는다.

## 5. 주요 흐름

### 목록 조회

```text
GET /meme
  -> Cloudflare cache miss
  -> Nuxt SSR
  -> Nuxt BFF GET /api/v1/boards/meme/posts?page=1
  -> Express Core API
  -> PostgreSQL: 공지 0~3 + 일반 글 20 + total count
  -> SSR HTML
  -> Cloudflare short cache
```

- 공개 목록 cache TTL은 `60초`부터 시작한다.
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
운영자 URL 지정
  -> BFF 외부 인증
  -> Core가 URL 정규화·출처 매칭
  -> 출처 allowlist·robots·요청 상한 확인
  -> SourceFetcher가 해당 페이지 1회 GET
  -> 제목·이미지 후보 URL 추출
  -> 원문 URL 중복·기존 게시글 중복 확인
  -> 후보 + 이미지 후보 metadata 저장
```

```text
10분 cron: collect:crawl-due
  -> 목록 수집이 활성이고 요청 간격이 지난 출처 선택
  -> 출처 목록·피드 1회 GET
  -> 새 원문 URL만 후보로 적재(상세 페이지는 승격 시점에 가져옴)
  -> 출처의 최근 수집 시각·오류·요청 수 갱신
```

후보 생성은 원문 URL과 metadata까지만 저장하고 이미지 binary는 저장하지 않는다. 이미지 저장은 운영자가 후보를 초안으로 승격할 때 수행하며, 그 시점에 기존 관리자 업로드와 같은 MIME·magic byte·decode·재인코딩 검증을 거쳐 private 원본 bucket에 넣는다. 즉 검수하지 않은 외부 이미지가 블라리요 저장소에 남지 않는다.

같은 원문 URL의 후보는 정규화된 URL 기준으로 한 건만 유지한다. `403`, `429`, robots 금지, timeout이 연속으로 발생하면 해당 출처의 목록 수집을 자동 비활성하고 운영 알림을 만든다. 자동 비활성 해제는 운영자 확인이 필요하다.

### 후보 초안 승격

```text
운영자 승격 요청
  -> 후보 상태·중복 재확인
  -> 선택한 이미지 후보를 SourceFetcher로 가져와 검증·재인코딩
  -> private 원본 bucket 저장과 이미지 metadata insert
  -> 초안 생성 transaction(제목·block·출처·이미지 선점·상태 이력)
  -> 후보를 APPROVED로 바꾸고 생성된 게시글 연결
```

이미지 저장은 DB transaction 밖에서 수행하고, 저장에 성공한 이미지 key만 초안 transaction에 넣는다. transaction이 실패하면 후보는 원래 상태로 남고 저장된 이미지는 staging orphan 정리 대상이 된다.

## 6. 캐시 정책

| 대상 | 기본값 | 비고 |
| --- | --- | --- |
| `/meme?page=n` | CDN `60초` | publish·hide 시 관련 URL purge |
| `/:boardSlug/posts/:postId` | CDN `300초` | hide 시 해당 URL 즉시 purge |
| 정책 현재 본문 | CDN `300초` | 새 버전 시행 시 purge |
| 404·오류 | `no-store` | 숨김 정보가 cache에 남지 않게 함 |
| R2 공개 이미지 | `public, max-age=31536000, immutable` | storage key에 content hash 포함 |
| 관리자·계정 화면 | `private, no-store` | CDN cache 금지 |

HTML은 짧게 cache하고 이미지는 불변 key로 길게 cache한다. 게시글 이미지가 바뀌면 기존 key를 덮어쓰지 않고 새 key를 발급한다.

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
| 수집 출처가 5곳을 넘거나 목록 수집이 API 응답 지연을 만듦 | 수집을 별도 worker 컨테이너로 분리 |
| 특정 출처의 차단·파싱 실패가 반복됨 | 해당 출처 목록 수집 중단, 운영자 URL 지정만 유지 |

Redis, queue broker, Kubernetes, Elasticsearch는 위 조건과 직접 연결된 필요가 확인되기 전에는 도입하지 않는다.
