# M0 Web BFF API 설계

- 문서 상태: 설계 계약 검토 완료 · M0 OpenAPI/route/contract test 미구현
- 기준일: 2026-08-15
- base path: `/api/v1`
- content type: `application/json; charset=utf-8`

## 1. 공통 원칙

- 이 문서의 endpoint는 외부 client가 same-origin으로 호출하는 Nuxt BFF 계약이다.
- Nuxt BFF만 Express Core API를 Docker app network에서 호출한다. 브라우저·Nginx·공개 DNS는 Core API에 직접 접근할 수 없다.
- BFF는 인증·요청 검증·외부 응답 mapping만 담당하고 SQL·게시 상태 전이·transaction은 Core API에만 둔다.
- 공개 API는 인증 없이 읽을 수 있다.
- 관리자 API는 Cloudflare Access를 통과한 요청만 받는다.
- 식별자는 URL에서 `postId`처럼 표현하고 JSON은 `camelCase`를 사용한다.
- 공개 게시글 목록·상세는 게시판 하위 resource로 두고 숫자 `boardId` 대신 `boardSlug`를 path에 사용한다.
- 게시판 문맥이 없는 `/api/v1/posts`, `/api/v1/posts/:postId` 호환 route는 만들지 않는다.
- 시각은 UTC ISO 8601 문자열로 반환한다.
- 금액·날짜·상태 같은 계약 값은 locale 문자열로 반환하지 않는다.
- 빈 값은 의미가 있으면 `null`, 존재하지 않는 필드는 생략한다.
- `404`에서 숨김·삭제·미존재 원인을 구분하지 않는다.
- 외부 OpenAPI는 BFF 구현과 같은 schema source에서 생성한다. production에서 Swagger UI는 공개하지 않는다.

현재 `apps/api`의 회원·비밀번호 route와 Swagger는 개발 skeleton이며 이 M0 API의 구현이 아니다. 아래 계약을 구현한 BFF OpenAPI·Nuxt server route와 Express Core 기능이 추가되기 전에는 API를 “구현 준비 완료” 또는 “구현 완료”로 표시하지 않는다. Core API의 내부 route는 외부 호환 계약으로 취급하지 않지만 별도 schema와 contract test로 BFF 연동을 검증한다.

### M0 endpoint 목록

| 구분 | Method | Path | 역할 |
| --- | --- | --- | --- |
| health | `GET` | `/health/live` | Nuxt BFF process 생존 확인 |
| health | `GET` | `/health/ready` | Core API·PostgreSQL·migration version 준비 확인 |
| 공개 | `GET` | `/api/v1/boards` | 활성 게시판 |
| 공개 | `GET` | `/api/v1/boards/:boardSlug/posts` | 해당 게시판 목록 |
| 공개 | `GET` | `/api/v1/boards/:boardSlug/posts/:postId` | 게시판 소속을 검증한 상세와 하단 목록 context |
| 공개 | `GET` | `/api/v1/policies/:type` | 현재·과거 정책 |
| 공개 | `POST` | `/api/v1/events` | 최소 내부 조회 이벤트 |
| 관리자 | `GET` | `/api/v1/admin/posts` | 게시글 검색 |
| 관리자 | `GET` | `/api/v1/admin/posts/:postId` | 초안 편집용 상세 |
| 관리자 | `POST` | `/api/v1/admin/images` | staging 이미지 업로드 |
| 관리자 | `GET` | `/api/v1/admin/images/:imageId/preview` | 인증된 staging preview |
| 관리자 | `DELETE` | `/api/v1/admin/images/:imageId` | 미연결 staging 이미지 폐기 예약 |
| 관리자 | `POST` | `/api/v1/admin/posts` | 초안 생성과 이미지 선점 |
| 관리자 | `PATCH` | `/api/v1/admin/posts/:postId` | 초안·예약·숨김 글 수정 |
| 관리자 | `POST` | `/api/v1/admin/posts/:postId/publish` | 즉시 발행·예약 |
| 관리자 | `POST` | `/api/v1/admin/posts/:postId/unschedule` | 예약 취소 후 초안 복귀 |
| 관리자 | `POST` | `/api/v1/admin/posts/:postId/hide` | 공개 글 우선 숨김 |
| 관리자 | `POST` | `/api/v1/admin/posts/:postId/republish` | 숨김 글 재공개 |
| 관리자 | `DELETE` | `/api/v1/admin/posts/:postId` | 숨김 글 최종 제거 |

M1 소셜 인증·회원 endpoint는 이 문서의 범위가 아니다.

### Health 응답

`/health/live`는 Nuxt BFF process가 HTTP 요청을 처리할 수 있으면 `200 {"status":"UP"}`만 반환한다. `/health/ready`는 BFF가 Docker 내부 Core API의 `/internal/health/ready`를 호출해 Core process, PostgreSQL 연결과 기대 migration version을 모두 확인했을 때만 `200 {"status":"READY"}`를 반환한다. 그 외에는 상세 원인 없이 `503 {"status":"NOT_READY"}`를 반환한다. health 응답에는 host·database명·version·secret을 넣지 않는다.

## 2. 공통 응답

### 성공

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "01J..."
  }
}
```

목록형 응답:

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "meta": {
    "requestId": "01J...",
    "page": 1,
    "pageSize": 20,
    "totalItems": 1047,
    "totalPages": 53,
    "hasPrevious": false,
    "hasNext": true
  }
}
```

### 오류

```json
{
  "success": false,
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "게시글을 찾을 수 없습니다.",
    "fields": []
  },
  "meta": {
    "requestId": "01J..."
  }
}
```

- `message`는 사용자에게 표시 가능한 일반 문장이다.
- SQL, stack, object key, provider 응답과 내부 상태는 포함하지 않는다.
- 입력 오류만 `fields`를 제공한다.

```json
{
  "code": "VALIDATION_FAILED",
  "message": "입력값을 확인해 주세요.",
  "fields": [
    { "field": "title", "reason": "maxLength" }
  ]
}
```

## 3. 공개 API

공개 게시글 route의 path 변수:

| path 변수 | 규칙 |
| --- | --- |
| `boardSlug` | 활성 게시판의 소문자 영문·숫자·하이픈 slug, 내부 `board.id`는 노출하지 않음 |
| `postId` | `content.board_post.id`의 양의 정수 문자열 |

형식이 맞지 않는 `boardSlug`는 목록에서 `404 BOARD_NOT_FOUND`, 상세에서 `404 POST_NOT_FOUND`로 처리한다. `postId`가 10진수 양의 정수가 아니거나 범위를 벗어나도 `404 POST_NOT_FOUND`로 처리해 내부 식별자 규칙을 추가로 노출하지 않는다.

### 활성 게시판

`GET /api/v1/boards`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "slug": "meme",
        "displayName": "짤",
        "postingPolicy": "ADMIN",
        "path": "/meme"
      }
    ]
  },
  "meta": { "requestId": "01J..." }
}
```

비활성 게시판은 반환하지 않는다.

### 게시글 목록

`GET /api/v1/boards/:boardSlug/posts?page=1`

예: `GET /api/v1/boards/meme/posts?page=1`

| query | 타입 | 기본값 | 규칙 |
| --- | --- | --- | --- |
| `page` | integer | `1` | `1~10000` |

```json
{
  "success": true,
  "data": {
    "board": {
      "slug": "meme",
      "displayName": "짤"
    },
    "pinnedItems": [
      {
        "postId": 12,
        "title": "블라리요 운영 및 권리 문의 안내",
        "viewCount": 1842,
        "authorLabel": "운영자",
        "publishedAt": "2026-08-12T03:00:00.000Z",
        "path": "/meme/posts/12"
      }
    ],
    "items": [
      {
        "postId": 1047,
        "title": "퇴근 직전에 질문 하나만 하겠다는 사람의 진짜 의미",
        "viewCount": 1248,
        "authorLabel": "운영자",
        "publishedAt": "2026-08-13T04:45:00.000Z",
        "path": "/meme/posts/1047"
      }
    ]
  },
  "meta": {
    "requestId": "01J...",
    "page": 1,
    "pageSize": 20,
    "totalItems": 1047,
    "totalPages": 53,
    "hasPrevious": false,
    "hasNext": true
  }
}
```

- `pinnedItems`는 `0~3`건이며 `totalItems`와 page size에 포함하지 않는다.
- `boardSlug`에 해당하는 활성 게시판이 없으면 `404 BOARD_NOT_FOUND`다.
- 활성 게시판에 공개 게시글이 0건이면 page 1에서 `200`과 빈 `pinnedItems`, `items`를 반환한다.
- page가 totalPages를 넘으면 성공 빈 목록이 아니라 `404 PAGE_NOT_FOUND`를 반환한다. 단, 게시글이 0건일 때 page 1은 빈 목록 `200`이다.
- M0의 `viewCount`는 검증된 `POST_VIEW`를 5분 batch로 반영한 `content.board_post.view_count`다. 정확한 실시간 수치가 아니며 최대 5분 지연될 수 있다.

### 게시글 상세

`GET /api/v1/boards/:boardSlug/posts/:postId`

예: `GET /api/v1/boards/meme/posts/1047`

```json
{
  "success": true,
  "data": {
    "post": {
      "postId": 1047,
      "board": { "slug": "meme", "displayName": "짤" },
      "title": "퇴근 직전에 질문 하나만 하겠다는 사람의 진짜 의미",
      "authorLabel": "운영자",
      "publishedAt": "2026-08-13T04:45:00.000Z",
      "viewCount": 1248,
      "blocks": [
        { "type": "TEXT", "text": "오후 5시 57분, 가방을 닫는 소리가 들리기 시작했다." },
        {
          "type": "IMAGE",
          "image": {
            "url": "https://img.__SERVICE_DOMAIN__/posts/1047/hash.webp",
            "alt": "퇴근 직전 질문을 받은 사람의 표정",
            "width": 1200,
            "height": 900
          }
        }
      ],
      "source": {
        "name": "example.com · funny-office-story",
        "url": "https://example.com/original/funny-office-story"
      },
      "shareUrl": "https://__SERVICE_DOMAIN__/meme/posts/1047"
    },
    "context": {
      "pinnedItems": [],
      "listPage": 1,
      "items": [],
      "pageSize": 20,
      "totalItems": 1047,
      "totalPages": 53
    }
  },
  "meta": { "requestId": "01J..." }
}
```

- `context.pinnedItems`와 `context.items`는 목록 API의 각 item schema를 사용하고 현재 글에는 `current: true`를 추가한다.
- 현재 글이 일반 글이면 계산된 `listPage`의 `items`에, 공지면 page 1의 `pinnedItems`에 포함한다.
- 출처가 없으면 `source`는 `null`이다.
- 서버는 `boardSlug`로 활성 게시판을 찾고 `post.id=:postId AND post.board_id=board.id`를 함께 확인한다.
- 게시판 미존재·비활성, 게시판과 게시글 소속 불일치, 숨김·삭제·예약·초안·게시글 미존재는 모두 `404 POST_NOT_FOUND`다.
- 공개 상세 응답에는 `status`, 내부 이력과 storage key를 넣지 않는다.

### 정책

```text
GET /api/v1/policies/:type
GET /api/v1/policies/:type?version=v0.2
```

`type`은 `terms`, `privacy`다.

현재 정책 응답:

```json
{
  "success": true,
  "data": {
    "policy": {
      "type": "privacy",
      "version": "v0.3",
      "title": "개인정보처리방침",
      "bodyHtml": "<h2>...</h2>",
      "effectiveAt": "2026-08-13T00:00:00.000Z",
      "endedAt": null
    },
    "history": [
      { "version": "v0.3", "effectiveAt": "2026-08-13T00:00:00.000Z", "endedAt": null },
      { "version": "v0.2", "effectiveAt": "2026-07-01T00:00:00.000Z", "endedAt": "2026-08-12T23:59:59.999Z" }
    ]
  },
  "meta": { "requestId": "01J..." }
}
```

`bodyHtml`은 `legal.policy_version.body_html`에 저장된 허용 목록 정제 완료 HTML이다. 공개 API는 초안 원문이나 정제 전 HTML을 반환하지 않는다.

### 내부 이용 이벤트

`POST /api/v1/events`

```json
{
  "eventType": "DETAIL_LIST_VIEW",
  "anonymousId": "browser-random-value",
  "sessionId": "tab-random-value",
  "boardSlug": "meme",
  "postId": 1047,
  "listPage": 2,
  "itemCount": 20,
  "occurredAt": "2026-08-14T01:20:30.000Z"
}
```

- 서버는 두 ID를 secret HMAC으로 변환하고 원문을 저장하지 않는다.
- `occurredAt`이 서버 시각보다 10분 이상 미래이거나 24시간 이상 과거면 서버 수신 시각으로 대체한다.
- 허용되지 않은 event·field는 `400`이다.
- 정상 수신은 body 없이 `204`를 반환한다.
- IP 단위 제한은 `60회/분`, session HMAC은 동일 event 중복을 10초 window에서 합친다.

| eventType | 필수 field | 금지 field |
| --- | --- | --- |
| `FEED_VIEW` | `boardSlug`, `listPage`, `itemCount` | `postId` |
| `POST_VIEW` | `boardSlug`, `postId` | `listPage`, `itemCount` |
| `DETAIL_LIST_VIEW` | `boardSlug`, `postId`, `listPage`, `itemCount` | 없음 |

서버는 `boardSlug`를 `content.board.id`로 변환해 이벤트의 `board_id`에 저장한다. `postId`가 있으면 공개 게시글의 `board_id`와 일치하는지도 확인한다. 비공개·미존재 게시글 이벤트는 내용을 구분하지 않고 `404 POST_NOT_FOUND`다.

## 4. 관리자 인증

관리자 route:

```text
/admin/*
/api/v1/admin/*
```

Cloudflare Access가 운영자 identity를 검증한다. Origin은 tunnel만 허용하며 Nuxt BFF는 Access assertion의 서명, issuer, `aud`, `exp`를 검증한다. BFF는 원본 assertion을 Core API에 전달하고 Core API도 같은 항목을 다시 검증한다.

- 허용 identity는 운영자 이메일 allowlist 또는 지정 identity group이다.
- API log에는 이메일 원문 대신 Access `sub`의 HMAC만 남긴다.
- Access 장애 시 관리자 작업은 중지해도 공개 읽기는 계속 동작해야 한다.
- 관리자 API를 Cloudflare 우회 주소나 공인 IP로 노출하지 않는다.

## 5. 관리자 API

### 게시글 검색

`GET /api/v1/admin/posts?status=DRAFT&page=1`

| query | 타입 | 기본값 | 규칙 |
| --- | --- | --- | --- |
| `status` | string | 없음 | 생략 또는 단일 게시 상태 |
| `board` | string | 없음 | 생략 또는 게시판 slug |
| `titlePrefix` | string | 없음 | trim 후 1~100자, prefix 검색 |
| `from` | ISO 8601 | 없음 | `updatedAt` 시작, UTC 변환 |
| `to` | ISO 8601 | 없음 | `updatedAt` 종료, `from <= to` |
| `page` | integer | `1` | `1~10000` |

page size는 50으로 고정하고 `updatedAt DESC, postId DESC`로 정렬한다.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "postId": 1047,
        "boardSlug": "meme",
        "title": "제목",
        "status": "DRAFT",
        "lockVersion": 3,
        "scheduledAt": null,
        "publishedAt": null,
        "updatedAt": "2026-08-14T01:20:30.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "01J...",
    "page": 1,
    "pageSize": 50,
    "totalItems": 1,
    "totalPages": 1,
    "hasPrevious": false,
    "hasNext": false
  }
}
```

### 초안 편집 상세

`GET /api/v1/admin/posts/:postId`

공개 여부와 관계없이 운영자가 편집할 게시글을 조회한다. 응답은 `postId`, `boardSlug`, `title`, `source`, `blocks`, `pinnedPosition`, `status`, `scheduledAt`, `publishedAt`, `lockVersion`, `createdAt`, `updatedAt`을 포함한다. IMAGE block에는 `content.board_post_block.alt_text`에서 가져온 `alt`와 `imageId`, `status`, `width`, `height`, `previewPath`를 제공하고 storage key는 반환하지 않는다.

미존재는 `404 POST_NOT_FOUND`, 존재하지만 현재 운영자가 접근할 수 없는 경우도 내부 정보 노출을 줄이기 위해 같은 오류를 사용한다.

### 이미지 업로드

`POST /api/v1/admin/images`

- `multipart/form-data`
- 파일 1개당 최대 `10 MiB`
- 요청 1회 최대 10개
- 허용: JPEG, PNG, WebP, GIF
- SVG, HTML, 동영상, 압축 파일은 거부

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "imageId": 501,
        "status": "STAGED",
        "mimeType": "image/webp",
        "byteSize": 248132,
        "width": 1200,
        "height": 900,
        "previewPath": "/api/v1/admin/images/501/preview"
      }
    ]
  },
  "meta": { "requestId": "01J..." }
}
```

storage key와 staging URL은 응답하지 않는다. 관리자 preview는 인증된 image proxy endpoint를 사용한다.

업로드 직후 이미지는 특정 게시글에 연결되지 않은 `STAGED` 상태다. 초안 생성·수정 command가 image를 transaction 안에서 선점한다. 이미 다른 게시글에 연결된 image는 `409 IMAGE_ALREADY_ATTACHED`다.

### staging 이미지 preview·폐기

```text
GET /api/v1/admin/images/:imageId/preview
DELETE /api/v1/admin/images/:imageId
```

- preview는 Access 인증 후 private object를 stream하고 `Cache-Control: private, no-store`를 사용한다.
- preview에는 원본 object key나 signed R2 URL을 노출하지 않는다.
- DELETE는 게시글 block에 연결되지 않은 `STAGED` image만 `PRIVATE_DELETE_PENDING`으로 바꾸고 `OBJECT_DELETE_PRIVATE` outbox를 생성한 뒤 `202`를 반환한다.
- 연결된 image, `PUBLIC`·`PUBLIC_DELETE_PENDING`·`PRIVATE_REVIEW` image 또는 이미 private 삭제 중인 image는 `409 IMAGE_STATE_CONFLICT`다.

### 초안 생성

`POST /api/v1/admin/posts`

```json
{
  "boardSlug": "meme",
  "title": "제목",
  "source": {
    "name": "출처명",
    "url": "https://example.com/original"
  },
  "blocks": [
    { "type": "TEXT", "text": "본문" },
    { "type": "IMAGE", "imageId": 501, "alt": "이미지 설명" }
  ],
  "pinnedPosition": null
}
```

성공은 `201`과 `postId`, `lockVersion=1`, `status=DRAFT`를 반환한다.

```json
{
  "success": true,
  "data": {
    "postId": 1047,
    "status": "DRAFT",
    "lockVersion": 1
  },
  "meta": { "requestId": "01J..." }
}
```

- `blocks`는 1~40개, IMAGE block은 최대 20개다.
- `Idempotency-Key` header를 필수로 받고 다른 post command와 같은 actor·scope·key 규칙을 적용한다.
- `title`은 trim 후 1~200자다. TEXT block은 plain text이며 trim 후 비어 있으면 안 되고 block당 최대 20,000자다. `<tag>` 형태도 HTML이나 Markdown으로 해석하지 않고 문자열 그대로 저장한다.
- `source`는 `null`이거나 `name`과 `https` URL을 함께 가져야 한다. 둘 중 하나만 보내면 `400 VALIDATION_FAILED`다.
- IMAGE block의 `imageId`는 연결되지 않은 `STAGED` image여야 하고 `alt`는 trim 후 1~300자여야 한다. `alt`는 이미지 자산이 아니라 해당 IMAGE block에 저장한다.
- 게시글 insert, image의 `post_id` 선점, `image_id`·`alt_text`를 가진 block insert와 최초 상태 이력은 한 transaction에서 처리한다.
- 하나라도 선점할 수 없으면 전체 transaction을 rollback한다.

### 초안 수정

`PATCH /api/v1/admin/posts/:postId`

```json
{
  "lockVersion": 3,
  "title": "수정 제목",
  "blocks": [
    { "type": "TEXT", "text": "수정 본문" }
  ],
  "source": null,
  "pinnedPosition": null
}
```

- `DRAFT`, `SCHEDULED`, `HIDDEN_REVIEW`만 수정할 수 있다.
- 생략한 field는 유지하고 명시한 field만 교체한다. `source: null`은 출처 제거, `pinnedPosition: null`은 공지 해제를 뜻한다.
- `HIDDEN_REVIEW`에서는 `pinnedPosition`을 지정할 수 없다. 재공개 command에서 새 공지 위치를 정한다.
- `blocks`를 보내면 전체 block 목록을 교체하며 1개 이상이어야 한다. 빈 배열은 `400 VALIDATION_FAILED`다.
- 새 image는 같은 transaction에서 선점한다. `DRAFT`·`SCHEDULED`에서 교체 결과 빠진 `STAGED` image는 `post_id=NULL`로 해제해 orphan 정리 대상으로 돌린다.
- `HIDDEN_REVIEW`에서 `PUBLIC_DELETE_PENDING` image가 하나라도 있으면 block 교체를 `409 IMAGE_STATE_CONFLICT`로 막는다. 교체에서 빠진 `PRIVATE_REVIEW` image는 같은 transaction에서 연결을 해제하고 `PRIVATE_DELETE_PENDING`으로 바꾸며 private 삭제 outbox를 만든다.
- DB `lock_version`과 다르면 `409 POST_VERSION_CONFLICT`다.
- `SCHEDULED` 내용 변경 시 예약은 유지하되 다시 공개 검증을 수행한다.

성공은 갱신된 `postId`, `status`, 증가한 `lockVersion`, `updatedAt`을 `200`으로 반환한다.

### 발행·예약

`POST /api/v1/admin/posts/:postId/publish`

즉시 발행:

```json
{ "lockVersion": 3, "mode": "IMMEDIATE" }
```

예약:

```json
{
  "lockVersion": 3,
  "mode": "SCHEDULED",
  "scheduledAt": "2026-08-14T09:00:00.000Z"
}
```

- `Idempotency-Key` header를 필수로 받는다.
- 동일 key와 동일 body는 기존 결과를 반환한다.
- 동일 key에 다른 body는 `409 IDEMPOTENCY_CONFLICT`다.
- 동일 key의 첫 요청이 아직 처리 중이면 `409 IDEMPOTENCY_IN_PROGRESS`와 `Retry-After: 1`을 반환한다.
- key scope는 HTTP method, route pattern과 Access actor HMAC의 조합이며 완료 결과를 24시간 보존한다.
- `SCHEDULED`의 `scheduledAt`은 서버 수신 시각보다 최소 1분 이후여야 한다.
- 성공 후 cache purge outbox를 생성한다.

즉시 발행 성공:

```json
{
  "success": true,
  "data": {
    "postId": 1047,
    "status": "PUBLISHED",
    "lockVersion": 4,
    "publishedAt": "2026-08-14T01:30:00.000Z",
    "scheduledAt": null
  },
  "meta": { "requestId": "01J..." }
}
```

예약 성공은 같은 schema에서 `status=SCHEDULED`, `publishedAt=null`, `scheduledAt`을 반환한다.

### 예약 취소

`POST /api/v1/admin/posts/:postId/unschedule`

```json
{ "lockVersion": 4 }
```

- `SCHEDULED -> DRAFT`로 전이하고 `scheduledAt`을 `null`로 바꾼다.
- `Idempotency-Key`를 요구하며 발행 command와 같은 actor·scope·key 규칙을 적용한다.
- 성공은 `postId`, `status=DRAFT`, 증가한 `lockVersion`, `scheduledAt=null`, `updatedAt`을 반환한다.

### 숨김·재공개·삭제

```text
POST /api/v1/admin/posts/:postId/hide
POST /api/v1/admin/posts/:postId/republish
DELETE /api/v1/admin/posts/:postId
```

숨김:

```json
{ "lockVersion": 4, "reasonCode": "RIGHTS_EMAIL" }
```

- `hide`: `PUBLISHED -> HIDDEN_REVIEW`
- `republish`: `HIDDEN_REVIEW -> PUBLISHED`
- `republish`는 최초 `publishedAt`을 유지해 목록 순서를 임의로 끌어올리지 않는다.
- `hide` transaction은 연결 image를 `PUBLIC_DELETE_PENDING`으로 바꾸고 public object 삭제 outbox를 생성한다. 공개 API는 commit 직후 404이며 worker 완료 후 image는 `PRIVATE_REVIEW`가 된다.
- `republish`는 참조 image가 모두 `PRIVATE_REVIEW` 또는 새 `STAGED`일 때만 private 원본을 public bucket으로 다시 copy한다. public 삭제가 처리 중이면 `409 IMAGE_STATE_CONFLICT`다.
- `DELETE`: `HIDDEN_REVIEW -> REMOVED`; private 원본을 `PRIVATE_DELETE_PENDING`으로 바꾸고 복구 유예 30일 뒤 실행할 `OBJECT_DELETE_PRIVATE` task 생성
- 물리 row 삭제 endpoint는 제공하지 않는다.
- 세 command 모두 `Idempotency-Key`를 요구한다.
- `republish` body는 `{ "lockVersion": 5, "pinnedPosition": null }`, `DELETE` body는 `{ "lockVersion": 5, "reasonCode": "RIGHTS_EMAIL" }`을 사용한다.
- 각 성공 응답은 `postId`, 변경된 `status`, 증가한 `lockVersion`, `updatedAt`을 반환한다.
- cache purge는 DB 상태 변경과 outbox 기록이 commit된 뒤 수행한다. purge 실패는 공개 상태를 rollback하지 않고 outbox retry로 복구한다.

## 6. 상태 코드와 오류 코드

| HTTP | code | 의미 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | 요청 형식·값 오류 |
| `401` | `ADMIN_AUTH_REQUIRED` | Access assertion 없음·만료 |
| `403` | `ADMIN_FORBIDDEN` | 운영자 allowlist 불일치 |
| `404` | `BOARD_NOT_FOUND` | 목록 요청의 비활성·미존재 게시판 |
| `404` | `POST_NOT_FOUND` | 상세 요청의 게시판 불일치·미존재·비공개 게시글 |
| `404` | `PAGE_NOT_FOUND` | 존재하지 않는 페이지 |
| `404` | `POLICY_NOT_FOUND` | 정책 유형·version 미존재 |
| `404` | `IMAGE_NOT_FOUND` | 관리자 image 미존재 |
| `409` | `POST_STATE_CONFLICT` | 현재 상태에서 command 불가 |
| `409` | `POST_VERSION_CONFLICT` | 낙관적 잠금 충돌 |
| `409` | `PINNED_ORDER_CONFLICT` | 공지 순서 중복 |
| `409` | `IDEMPOTENCY_CONFLICT` | 같은 key의 다른 요청 |
| `409` | `IDEMPOTENCY_IN_PROGRESS` | 같은 key의 첫 요청 처리 중 |
| `409` | `IMAGE_ALREADY_ATTACHED` | 다른 게시글이 staging image를 선점 |
| `409` | `IMAGE_STATE_CONFLICT` | 현재 image 상태와 요청 command 충돌 |
| `413` | `UPLOAD_TOO_LARGE` | 파일·요청 제한 초과 |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | 허용하지 않은 파일 |
| `429` | `RATE_LIMITED` | 요청 제한 초과 |
| `500` | `INTERNAL_ERROR` | 분류되지 않은 서버 오류 |
| `503` | `DEPENDENCY_UNAVAILABLE` | DB·R2 등 필수 의존성 장애 |

## 7. Cache header

| API | header |
| --- | --- |
| boards | `public, max-age=60, s-maxage=300` |
| posts list | `public, max-age=15, s-maxage=60` |
| post detail | `public, max-age=30, s-maxage=300` |
| policies | `public, max-age=60, s-maxage=300` |
| events | `no-store` |
| admin | `private, no-store` |
| health | `no-store` |
| error·404 | `no-store` |

ETag는 JSON body hash로 제공하고 `If-None-Match`에 `304`를 반환한다.

## 8. API 구현 순서

1. BFF 공통 request ID·오류·validation·health와 Core API 내부 health
2. boards와 공개 목록 BFF·Core query
3. 상세와 context page 계산
4. 정책 조회
5. BFF·Core의 관리자 Access 이중 검증
6. 이미지 staging과 초안 command
7. 발행·예약·예약 취소·숨김·outbox
8. 내부 이벤트와 일별 집계

## 9. 실행 준비 gate

이 문서의 HTTP 계약 검토는 완료됐지만 다음 실행 산출물은 아직 없다.

- [ ] M0 endpoint만 포함한 OpenAPI `3.1.x` source 작성
- [ ] request·response·error schema에서 문서 예시 자동 검증
- [ ] Nuxt BFF route가 외부 OpenAPI validation을 공통 적용
- [ ] BFF와 Express Core API의 내부 schema·contract test 작성
- [ ] 공개 목록 0건·마지막 page·초과 page contract test
- [ ] 목록의 미존재·비활성·잘못된 형식 `boardSlug`가 동일한 `404 BOARD_NOT_FOUND`인지 contract test
- [ ] 상세의 게시판 불일치·잘못된 형식 `boardSlug`·`postId`가 동일한 `404 POST_NOT_FOUND`인지 contract test
- [ ] 문맥 없는 `/api/v1/posts*`, `/posts/:postId`가 노출되지 않는지 route test
- [ ] SSR `/:boardSlug/posts/:postId`의 게시판 불일치가 콘텐츠 없는 `404` HTML인지 integration test
- [ ] SSR 상세의 canonical·OG·공유 URL이 `/:boardSlug/posts/:postId`로 일치하는지 integration test
- [ ] 숨김·삭제·예약 글의 동일한 공개 `404` contract test
- [ ] image upload·선점·preview·폐기 상태 경쟁 integration test
- [ ] 숨김 글 block 교체 중 public 삭제 대기·private image 제거 contract test
- [ ] `lockVersion`와 `Idempotency-Key` 동시 요청 integration test
- [ ] BFF와 Core 각각 Access assertion 없음·만료·잘못된 issuer·`aud`에 대한 관리자 API test
- [ ] `/health/ready` migration version 불일치 test
- [ ] 현재 회원 skeleton Swagger를 제거하고 production에서 Swagger UI가 공개되지 않는지 test

모든 항목이 통과하기 전에는 API 계층을 “구현 준비 완료” 또는 “구현 완료”로 표시하지 않는다.
