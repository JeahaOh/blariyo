# M0 Web BFF API 설계

- 문서 상태: M0 API 설계 계약 · 현행 Core·BFF·OpenAPI·test 산출물 없음
- 기준일: 2026-09-04
- 정합성 검토일: 2026-09-04
- base path: `/api/v1`
- content type: `application/json; charset=utf-8`

## 1. 공통 원칙

- 이 문서의 endpoint는 외부 client가 same-origin으로 호출하는 Nuxt BFF 계약이다.
- Nuxt BFF만 Express Core API를 Docker app network에서 호출한다. 브라우저·Nginx·공개 DNS는 Core API에 직접 접근할 수 없다.
- BFF는 인증·요청 검증·외부 응답 mapping만 담당하고 SQL·게시 상태 전이·transaction은 Core API에만 둔다.
- 공개 API는 인증 없이 읽을 수 있다.
- 관리자 API의 외부 identity는 BFF adapter가 검증하고 Core는 BFF 내부 서비스 인증만 신뢰한다.
- 식별자는 URL에서 `postId`처럼 표현하고 JSON은 `camelCase`를 사용한다.
- 공개 게시글 목록·상세는 게시판 하위 resource로 두고 숫자 `boardId` 대신 `boardSlug`를 path에 사용한다.
- 게시판 문맥이 없는 `/api/v1/posts`, `/api/v1/posts/:postId` 호환 route는 만들지 않는다.
- 시각은 UTC ISO 8601 문자열로 반환한다.
- 금액·날짜·상태 같은 계약 값은 locale 문자열로 반환하지 않는다.
- 빈 값은 의미가 있으면 `null`, 존재하지 않는 필드는 생략한다.
- `404`에서 숨김·삭제·미존재 원인을 구분하지 않는다.
- 외부 OpenAPI는 BFF 구현과 같은 schema source에서 생성한다. production에서 Swagger UI는 공개하지 않는다.

현재 브랜치에는 기존 실험 source를 포함한 애플리케이션 source가 없다. 아래 내용은 공개
Board/Post BFF와 Core 내부 route가 향후 따라야 할 계약이며, 실제 OpenAPI·route·통합 테스트가
생기기 전에는 구현 완료로 판정하지 않는다. Core API의 내부 route는 외부 호환 계약으로
취급하지 않으며 PostgreSQL·Core·BFF 통합 테스트로 계층 간 계약을 검증해야 한다.

### M0 endpoint 목록

| 구분 | Method | Path | 역할 |
| --- | --- | --- | --- |
| health | `GET` | `/health/live` | Nuxt BFF process 생존 확인 |
| health | `GET` | `/health/ready` | Core API·PostgreSQL·migration version 준비 확인 |
| 공개 | `GET` | `/api/v1/boards` | 활성 게시판 |
| 공개 | `GET` | `/api/v1/boards/:boardSlug/posts` | 해당 게시판 목록 |
| 공개 | `GET` | `/api/v1/boards/:boardSlug/posts/:postId` | 게시판 소속을 검증한 상세와 하단 목록 context |
| 공개 | `POST` | `/api/v1/boards/:boardSlug/posts/:postId/views` | 참고용 조회 수 1 증가 |
| 공개 | `GET` | `/api/v1/policies/:type` | 현재·과거 정책 |
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
| 관리자 | `GET` | `/api/v1/admin/collect/sources` | 수집 출처 목록 |
| 관리자 | `PATCH` | `/api/v1/admin/collect/sources/:sourceId` | 출처 활성·수집 방식·상한·robots 확인 결과 수정 |
| 관리자 | `GET` | `/api/v1/admin/collect/candidates` | 수집 후보 검색 |
| 관리자 | `GET` | `/api/v1/admin/collect/candidates/:candidateId` | 후보 상세와 이미지 후보 |
| 관리자 | `POST` | `/api/v1/admin/collect/candidates` | 관리자 URL 지정 수집 작업 접수 |
| 관리자 | `POST` | `/api/v1/admin/collect/candidates/:candidateId/retry` | 실패 후보 재수집 |
| 관리자 | `POST` | `/api/v1/admin/collect/candidates/:candidateId/reject` | 후보 반려 |
| 관리자 | `POST` | `/api/v1/admin/collect/candidates/:candidateId/draft` | 후보를 초안으로 승격 |

M1 소셜 인증·회원 endpoint는 이 문서의 범위가 아니다.
위 목록의 수집 endpoint는 `M0 Core` OpenAPI와 route에 넣지 않고 `M0 수집 보조` 착수 때
추가한다. M0 수집 보조는 운영자 로컬 collector가 Discord `/collect url` 또는 관리자 URL 입력 작업으로
단일 상세 페이지 1건만 처리한다. 목록 수집 command는 후속 `M0 자동 수집` 단계에서 활성화한다.

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
    "message": "게시글을 찾을 수 없습니다."
  },
  "meta": {
    "requestId": "01J..."
  }
}
```

- `message`는 사용자에게 표시 가능한 일반 문장이다.
- SQL, stack, object key, provider 응답과 내부 상태는 포함하지 않는다.
- `fields`는 선택 필드다. 이미지 업로드에서는 요청 단위 개수·전체 크기 gate를 통과한 뒤 발견한
  파일별 크기·형식 validation 오류에만 제공한다. 요청 단위 gate의 `413 UPLOAD_TOO_LARGE`와 R2·DB
  장애를 포함한 `503 DEPENDENCY_UNAVAILABLE`에는 필드 자체를 넣지 않는다.

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
- M0의 `viewCount`는 공개 상세 화면에서 별도 endpoint가 증가시킨
  `content.board_post.view_count`다. 방문자 중복을 제거하지 않는 참고용 누적값이며 목록·상세
  cache가 만료되기 전까지 화면 값이 늦게 보일 수 있다.

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
            "url": "https://media.example.invalid/posts/1047/hash.webp",
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
      "shareUrl": "https://blariyo.com/meme/posts/1047"
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

위 image URL은 문서용 `.invalid` 예시다. 실제 응답은 배포 설정 `IMAGE_ORIGIN`과 public storage key로
만들며 `IMAGE_ORIGIN` 실값을 문서에서 추측하지 않는다.

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
      { "version": "v0.2", "effectiveAt": "2026-07-01T00:00:00.000Z", "endedAt": "2026-08-13T00:00:00.000Z" }
    ]
  },
  "meta": { "requestId": "01J..." }
}
```

`bodyHtml`은 `legal.policy_version.body_html`에 저장된 허용 목록 정제 완료 HTML이다. 공개 API는 초안 원문이나 정제 전 HTML을 반환하지 않는다.

### 게시글 조회 수 증가

`POST /api/v1/boards/:boardSlug/posts/:postId/views`

- request body와 query parameter를 받지 않는다. 값이 있으면 `400 VALIDATION_FAILED`다.
- Core는 활성 게시판과 공개 게시글의 소속을 다시 확인하고 `view_count = view_count + 1`을 원자적으로
  실행한 뒤 body 없는 `204`를 반환한다.
- 비공개·숨김·삭제·예약·미존재·게시판 불일치는 동일한 `404 POST_NOT_FOUND`다.
- 브라우저는 상세 화면을 정상 표시한 뒤 page lifecycle당 한 번만 호출하고 자동 재시도하지 않는다.
- 별도 방문자·세션 식별자, IP, User-Agent와 조회 이력을 application DB에 저장하지 않는다.
- BFF는 신뢰한 client IP 기준 `60회/분`으로 남용을 제한하지만 중복 제거에는 사용하지 않는다.
- endpoint 실패는 상세 화면을 실패시키지 않으며 이미 렌더링한 `viewCount`를 변경하지 않는다.
- 자동화 요청과 반복 새로고침을 완전히 제거하지 않으므로 광고 정산·권리 판단·사람 수의 근거로
  사용하지 않는다.

## 4. 관리자 인증

관리자 route:

```text
/admin/*
/api/v1/admin/*
```

Nuxt BFF의 `AdminIdentityProvider` adapter가 외부 운영자 identity를 검증한다. 초기 provider는 Cloudflare Access지만 adapter 밖의 route와 Core 계약은 provider claim을 사용하지 않는다.

- 허용 identity는 운영자 이메일 allowlist 또는 지정 identity group이다.
- BFF adapter는 외부 identity를 안정적인 내부 `operatorId`로 매핑하고 이를 별도 secret으로 HMAC해 `admin:vN:<base64url>` actor를 만든다.
- BFF는 Core 관리자 요청에 `X-Blariyo-Service-Token`과 `X-Blariyo-Admin-Actor`만 전달한다. 외부 assertion·이메일·subject 원문은 전달하지 않는다.
- Core는 서비스 토큰을 constant-time 비교하고 actor 형식만 확인한다. 외부 provider의 issuer·audience·JWKS를 검증하지 않는다.
- 외부 인증 provider 장애 시 관리자 작업은 중지해도 공개 읽기는 계속 동작해야 한다.
- 관리자 API를 Cloudflare 우회 주소나 공인 IP로 노출하지 않는다.

`X-Blariyo-Service-Token`은 최소 32-byte 무작위 secret이며 BFF와 Core에만 주입한다. 이 내부 header는 외부 BFF 응답·log에 남기지 않는다. provider 교체 시 새 외부 identity를 기존 `operatorId`에 매핑하고 BFF adapter만 변경한다. Core route·service·DB actor와 기존 감사 이력은 유지한다.

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
query 형식·상태·날짜·범위 오류는 `400 VALIDATION_FAILED`다. `page`가 `1~10000` 범위 안이지만
필터 결과의 전체 page를 넘으면 `200`과 빈 `data.items`를 반환한다. 이때 요청한 `meta.page`를
유지하고 `meta.totalItems`, `meta.totalPages`는 실제 count 결과를 반환하며
`meta.hasPrevious=page>1`, `meta.hasNext=false`로 계산한다. 공개 목록의
`404 PAGE_NOT_FOUND` 정책은 관리자 검색에 적용하지 않는다.

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

`postId` 형식 오류·범위 초과, 미존재와 현재 운영자 접근 불가는 내부 정보 노출을 줄이기 위해
모두 `404 POST_NOT_FOUND`로 일반화한다. 이 경우 별도 `400 VALIDATION_FAILED` 분기를 만들지 않는다.

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

다중 파일 업로드는 `all-or-nothing`이다. 먼저 요청 단위 파일 개수 10개·전체 합계 100MiB gate를
검사한다. 하나라도 초과하면 `413 UPLOAD_TOO_LARGE`를 반환하고 `fields`는 제공하지 않는다. 이 gate를
통과한 요청만 모든 파일의 개별 크기·선언 MIME·magic byte·decode·pixel·GIF 자원 제한·재인코딩 가능
여부를 끝까지 검증한다. validation 오류가 하나라도 있으면 R2 object와 image row를 만들지 않고 성공
파일 item도 반환하지 않는다.

개별 파일 크기 계열 오류가 하나라도 있으면 top-level은 `413 UPLOAD_TOO_LARGE`다. 여기에는 파일
10MiB, 40MP와 GIF decode 자원 제한 초과가 포함된다. 이 오류가 없고 형식·decode 계열 오류만 있으면
`415 UNSUPPORTED_MEDIA_TYPE`이다. `fields[]`에는 실패한 모든 파일의 `files[index]`와 일반화된
`reason`을 넣으며, 크기·형식이 섞여 `413`을 반환해도 형식 실패 파일을 빠뜨리지 않는다. 같은 파일에서
여러 검증이 실패해도 file index와 reason 조합을 중복하지 않는다. object key, decoder·provider 원문과
내부 상세는 노출하지 않는다.

모든 validation이 성공한 뒤 R2·DB storage 단계에서 실패하면 `503 DEPENDENCY_UNAVAILABLE`을 반환하고
`fields`는 제공하지 않는다. validation 실패는 storage를 시작하지 않으므로 `413`·`415`와 `503`을 한
응답에 혼합하지 않는다. storage 중간 실패로 요청 중 생성한 image row는 transaction rollback하고,
이미 저장한 private object는 즉시 보상 삭제한다. 즉시 삭제가 실패하면 rollback과 분리된 cleanup
transaction에서 `OBJECT_DELETE_PRIVATE` outbox를 commit한다. rollback된 image ID는 참조하지 않고
`aggregate_type=STORAGE_OBJECT`, `aggregate_id=NULL`, `privateStorageKey`, `objectCreatedAt`,
`cleanupReason=UPLOAD_ROLLBACK`을 사용한다. outbox commit 전 process crash로 삭제 기록도 남지 않은
object는 24시간 orphan inventory가 회수한다.

후속 단계에서 일반 사용자 업로드를 추가할 때도 같은 all-or-nothing·보상 삭제 원칙을 적용한다.
이는 M0 Core에 일반 사용자 업로드 endpoint를 미리 추가한다는 뜻이 아니다.

업로드 직후 이미지는 특정 게시글에 연결되지 않은 `STAGED` 상태다. 초안 생성·수정 command가 image를 transaction 안에서 선점한다. 이미 다른 게시글에 연결된 image는 `409 IMAGE_ALREADY_ATTACHED`다.

### staging 이미지 preview·폐기

```text
GET /api/v1/admin/images/:imageId/preview
DELETE /api/v1/admin/images/:imageId
```

- preview는 BFF 관리자 인증 후 private object를 stream하고 `Cache-Control: private, no-store`를 사용한다.
- preview에는 원본 object key나 signed R2 URL을 노출하지 않는다.
- DELETE는 게시글 block에 연결되지 않은 `STAGED` image만 `PRIVATE_DELETE_PENDING`으로 바꾸고
  `OBJECT_DELETE_PRIVATE` outbox를 생성한 뒤 `202 Accepted`와 공통 성공 envelope를 반환한다.
  `data`는 `imageId`와 `status=PRIVATE_DELETE_PENDING`, `meta`는 `requestId`를 포함한다. 실제 private
  object 삭제는 응답 전에 직접 수행하지 않고 outbox worker가 처리한다.

```json
{
  "success": true,
  "data": {
    "imageId": 501,
    "status": "PRIVATE_DELETE_PENDING"
  },
  "meta": { "requestId": "01J..." }
}
```
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
- key scope는 HTTP method, route pattern과 provider-neutral admin actor의 조합이며 완료 결과를 24시간 보존한다.
- `SCHEDULED`의 `scheduledAt`은 UTC offset을 포함한 ISO 8601 문자열이어야 하며 서버 수신 시각보다
  최소 1분 이후여야 한다. 수신 offset은 보존값으로 사용하지 않고 같은 절대 시각의 UTC로 정규화해 저장한다.
- 예약·즉시 발행 모두 같은 게시판의 `SCHEDULED`·`PUBLISHED` 공지 위치 중복을 이 시점에 검증하고 겹치면 `409 PINNED_ORDER_CONFLICT`다. due scheduler가 공지 위치 때문에 실패하지 않게 한다.
- 즉시 발행과 scheduler의 실제 공개 성공 후 cache purge outbox를 생성한다. 예약 등록만으로는 공개 cache를 변경하지 않는다.

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
- `hide` transaction은 연결 image를 `PUBLIC_DELETE_PENDING`으로 바꾸고 이미지별 public CDN URL purge·object 삭제 outbox와 목록·상세 HTML cache purge outbox를 생성한다. 공개 API는 commit 직후 404이며 worker가 이미지 URL purge와 object 삭제를 모두 완료한 뒤 image는 `PRIVATE_REVIEW`가 된다.
- `republish`는 참조 image가 모두 `PRIVATE_REVIEW` 또는 새 `STAGED`일 때만 private 원본을 public bucket으로 다시 copy한다. public 삭제가 처리 중이면 `409 IMAGE_STATE_CONFLICT`다.
- `DELETE`: `HIDDEN_REVIEW -> REMOVED`; private 원본을 `PRIVATE_DELETE_PENDING`으로 바꾸고 복구 유예 30일 뒤 실행할 `OBJECT_DELETE_PRIVATE` task 생성
- 물리 row 삭제 endpoint는 제공하지 않는다.
- 세 command 모두 `Idempotency-Key`를 요구한다.
- `republish` body는 `{ "lockVersion": 5, "pinnedPosition": null }`, `DELETE` body는 `{ "lockVersion": 5, "reasonCode": "REMOVE" }`을 사용한다.
- command별 허용 `reasonCode`는 [데이터 모델 §7](./02-data-model.md)의 표를 따른다. 허용 목록 밖의 값은 `400 VALIDATION_FAILED`다. `hide`는 `RIGHTS_EMAIL`·`EDIT`, `DELETE`는 `REMOVE`만 받는다.
- `republish` 시 지정한 `pinnedPosition`이 같은 게시판의 `SCHEDULED`·`PUBLISHED` 공지와 겹치면 `409 PINNED_ORDER_CONFLICT`다.
- 각 성공 응답은 `postId`, 변경된 `status`, 증가한 `lockVersion`, `updatedAt`을 반환한다.
- cache purge는 DB 상태 변경과 outbox 기록이 commit된 뒤 수행한다. purge 실패는 공개 상태를 rollback하지 않고 outbox retry로 복구한다.

## 5-1. 수집 관리자 API

수집 관리자 API는 모두 관리자 인증이 필요하고 공개 API에 노출하지 않는다. Discord `/collect url`은
BE 공개 Interactions endpoint가 아니라 운영자 로컬 collector가 Discord App 연결로 처리한다. Discord
incoming webhook은 결과 알림용이며 URL 수신용으로 사용하지 않는다. 외부 사이트 요청은 BE·FE가
수행하지 않고 로컬 collector만 수행한다.

collector 전용 내부 API는 브라우저·관리자 화면용 BFF 계약이 아니며 service token으로만 호출한다.
M0 수집 보조의 최소 내부 계약은 다음 네 가지다. OpenAPI 생성 시 외부 BFF 계약과 별도 `internal`
문서로 분리한다.

| Method | Path | 역할 |
| --- | --- | --- |
| `POST` | `/internal/collect/candidates/claim` | `PENDING` 또는 lease가 만료된 `RUNNING` 후보를 선점 |
| `POST` | `/internal/collect/candidates/:candidateId/heartbeat` | 긴 처리 중 lease 연장 |
| `POST` | `/internal/collect/candidates/:candidateId/result` | 추출 성공·실패 결과 제출 |
| `POST` | `/internal/collect/candidates/:candidateId/images/:candidateImageId/preview` | 관리자 미리보기 파일 업로드 |

claim은 `FOR UPDATE SKIP LOCKED`와 `lease_until`을 사용해 한 후보를 한 collector만 처리하게 한다.
heartbeat는 현재 `collector_id`와 lease가 맞는 작업만 연장한다. result는 `RUNNING`이고 lease가
유효한 후보에만 허용하며, 성공 시 `NEW`, 실패 시 `FETCH_FAILED`로 전환하고 `lease_until`은 비운다.
preview upload는 10MiB 이하 이미지 파일에 관리자 업로드와 같은 MIME·magic byte·decode·pixel 검증을
적용한 뒤 private staging object로 최대 24시간 보관하고, 응답에는 내부 storage key를 반환하지 않는다.

### 수집 출처

`GET /api/v1/admin/collect/sources`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "sourceId": 3,
        "name": "출처 표시명",
        "host": "example.com",
        "fetchMode": "URL_ONLY",
        "listUrl": null,
        "parserType": "MANUAL",
        "isActive": true,
        "isListCrawlEnabled": false,
        "robotsAllowed": null,
        "robotsCheckedAt": null,
        "requestIntervalMs": 5000,
        "dailyFetchLimit": 200,
        "lastFetchedAt": null,
        "lastErrorCode": null,
        "disabledReasonCode": null,
        "lockVersion": 1
      }
    ]
  },
  "meta": { "requestId": "01J..." }
}
```

`PATCH /api/v1/admin/collect/sources/:sourceId` 는 `lockVersion`과 함께 `isActive`, `fetchMode`, `listUrl`, `parserType`, `isListCrawlEnabled`, `robotsAllowed`, `requestIntervalMs`, `dailyFetchLimit` 만 수정한다.

- `isListCrawlEnabled: true` 는 `fetchMode=LIST_CRAWL`, `listUrl` 존재, `robotsAllowed=true` 를 모두 만족할 때만 허용하고 그 외에는 `409 SOURCE_STATE_CONFLICT`다.
- `robotsAllowed` 를 바꾸면 서버가 `robotsCheckedAt` 을 현재 시각으로 기록한다. 클라이언트가 확인 시각을 직접 보내지 않는다.
- `requestIntervalMs` 는 `1000` 이상, `dailyFetchLimit` 는 `1~10000`이다.
- `host` 와 `baseUrl` 은 수정 대상이 아니다. 다른 host를 쓰려면 새 출처를 만든다.
- 출처 생성·삭제 endpoint는 M0에 두지 않는다. 출처 추가는 순번 seed migration으로 처리하고, 중단은 `isActive=false`로 표현한다.

### 후보 검색과 상세

`GET /api/v1/admin/collect/candidates?status=NEW&page=1`

| query | 타입 | 기본값 | 규칙 |
| --- | --- | --- | --- |
| `status` | string | 없음 | 생략 또는 단일 후보 상태 |
| `sourceId` | integer | 없음 | 생략 또는 출처 식별자 |
| `discoveryMode` | string | 없음 | M0 수집 보조는 `MANUAL_URL`; 후속 자동 수집은 `LIST_CRAWL` |
| `duplicateOnly` | boolean | `false` | 중복 표시된 후보만 |
| `page` | integer | `1` | `1~10000` |

page size는 50으로 고정하고 `COALESCE(fetchedAt, requestedAt) DESC, candidateId DESC`로 정렬한다.
item은 `candidateId`, `sourceId`, `sourceName`, `originUrl`, `title`, `status`, `discoveryMode`,
`imageCandidateCount`, `duplicatePostId`, `postId`, `rejectReasonCode`, `fetchErrorCode`, `requestedAt`,
`claimedAt`, `fetchedAt`, `lockVersion`을 포함한다.

`GET /api/v1/admin/collect/candidates/:candidateId` 는 위 필드에 이미지 후보 목록을 더한다. 각 이미지
후보는 `candidateImageId`, `position`, `remoteUrl`, `status`, `imageId`, `previewPath`, `previewExpiresAt`,
`fetchErrorCode`를 가진다. `previewPath`는 collector가 업로드한 private staging object를 관리자 인증
경계 안에서 보여주는 프록시 경로이며 내부 절대 경로나 storage key가 아니다. 응답에 원문 응답 HTML,
내부 예외 메시지, 로컬 임시 파일 절대 경로와 storage key를 넣지 않는다.

### 관리자 URL 지정 수집 작업 접수

`POST /api/v1/admin/collect/candidates`

```json
{ "originUrl": "https://example.com/board/12345" }
```

- `Idempotency-Key` header를 필수로 받고 post command와 같은 actor·scope·key 규칙을 적용한다.
- `originUrl`은 `https`만 허용하고 최대 2048자다. 서버가 정규화한 뒤 처리한다.
- 정규화 URL의 host가 등록 출처와 일치하지 않으면 `403 SOURCE_NOT_ALLOWED`다.
- 정규화 URL이 이미 후보로 있으면 기존 후보를 `409 CANDIDATE_DUPLICATE`와 함께 알리고 새로 만들지 않는다.
- 성공은 `202`와 `candidateId`, `status=PENDING`, `lockVersion=1`, `duplicatePostId`를 반환한다.
- 이 요청은 외부 사이트를 호출하지 않는다. 로컬 collector가 `PENDING` 후보를 claim한 뒤 출처 활성,
  robots, 요청 상한, DNS 안전성, redirect·응답 크기·timeout 제한을 검사하고 단일 상세 페이지 1건만
  fetch한다.
- collector 결과 제출이 성공하면 후보는 `NEW` 또는 `FETCH_FAILED`가 된다. 대상 응답 실패·timeout·비HTML
  또는 parser 실패는 `FETCH_FAILED`로 남기고 운영자가 화면에서 사유를 보고 재시도 또는 반려할 수 있게
  한다.
- Discord `/collect url`은 로컬 collector가 같은 검증·fetch·parser 흐름을 직접 실행한 뒤 BE에 후보
  결과를 제출한다.

### 재수집과 반려

```text
POST /api/v1/admin/collect/candidates/:candidateId/retry
POST /api/v1/admin/collect/candidates/:candidateId/reject
```

- `retry` body는 `{ "lockVersion": 1 }`이며 `FETCH_FAILED`에서만 허용한다. 성공하면 후보를 `PENDING`으로
  되돌리고 다른 상태는 `409 CANDIDATE_STATE_CONFLICT`다.
- `retry` API는 외부 fetch를 직접 수행하지 않는다. 로컬 collector가 다시 claim할 때 출처 등록/활성·
  robots·요청 상한을 확인한다.
- `reject` body는 `{ "lockVersion": 1, "reasonCode": "LOW_QUALITY" }`이며 허용 코드는 `DUPLICATE`, `LOW_QUALITY`, `RIGHTS_RISK`, `NOT_FUNNY`, `SOURCE_GONE`, `OTHER`다.
- `reject`는 `NEW`와 `FETCH_FAILED`에서만 허용하고 성공 시 `status=REJECTED`, `reviewedAt`, 증가한 `lockVersion`을 반환한다.

### 후보 초안 승격

`POST /api/v1/admin/collect/candidates/:candidateId/draft`

```json
{
  "lockVersion": 1,
  "boardSlug": "meme",
  "title": "게시글 제목",
  "source": { "name": "출처명", "url": "https://example.com/board/12345" },
  "candidateImageIds": [77, 78],
  "leadText": "본문 첫 문단",
  "acknowledgeDuplicate": false
}
```

- `Idempotency-Key` header를 필수로 받는다.
- `NEW` 상태에서만 허용한다. 그 외에는 `409 CANDIDATE_STATE_CONFLICT`다.
- `candidateImageIds`는 해당 후보의 이미지 후보여야 하고 1~20건이다. 순서가 본문 IMAGE block 순서가 된다.
- `leadText`를 보내면 첫 TEXT block으로 넣는다. 생략하면 IMAGE block만으로 초안을 만든다.
- `title`을 생략하면 후보 제목을 사용한다. 후보 제목도 없으면 `400 VALIDATION_FAILED`다.
- `source`를 생략하면 출처명은 출처 표시명, URL은 후보 `originUrl`을 사용한다.
- `duplicatePostId`가 있는 후보는 `acknowledgeDuplicate: true` 없이는 `409 CANDIDATE_DUPLICATE`다.
- BE는 선택 이미지 후보의 원격 URL을 직접 fetch하지 않는다. 초안 승격에서 원격 이미지가 필요하면
  로컬 collector가 다시 가져와 collector preview upload API 또는 관리자 업로드와 같은 MIME·magic
  byte·decode·pixel·metadata 제거·재인코딩 검증을 통과한 파일로 제출하거나, 운영자가 관리자 업로드
  경로로 직접 올린 파일을 사용한다.
  하나도 저장하지 못하면 후보를 `NEW`로 유지하고 `502 SOURCE_FETCH_FAILED`를 반환한다.
- 이미지 저장 후 초안 생성·이미지 선점·block insert·상태 이력·후보 `APPROVED` 전환을 한 transaction에서 commit한다. transaction 실패 시 후보 상태는 바뀌지 않고 저장된 이미지는 staging orphan 정리 대상이 된다. 후보 반려·만료·재시도 교체 시 로컬 Python 임시 이미지 파일은 삭제 대상이다.
- 성공은 `201`과 `postId`, `status=DRAFT`, `lockVersion=1`, `candidateId`, `storedImageIds`를 반환한다. 이후 편집·발행은 기존 게시글 command를 사용한다.

### 후속 목록 수집 실행

목록 수집은 M0 수집 보조 범위가 아니며 HTTP endpoint로 제공하지 않는다. 후속 `M0 자동 수집`에서
`npm run collect:crawl-due` 단발성 command를 도입할 때 활성 출처의 사용 결정된 최신 목록·feed 범위를
읽고 새 원문 URL을 찾는다. command는 같은 service·repository와 `system:collector` actor를 사용하되
기본 비활성으로 둔다.

## 6. 상태 코드와 오류 코드

| HTTP | code | 의미 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | 요청 형식·값 오류 |
| `401` | `ADMIN_AUTH_REQUIRED` | BFF 외부 관리자 identity 없음·만료·검증 실패 |
| `401` | `COLLECTOR_AUTH_REQUIRED` | collector service token 없음·만료·불일치 |
| `403` | `ADMIN_FORBIDDEN` | 운영자 allowlist 불일치 |
| `403` | `COLLECTOR_FORBIDDEN` | collector token scope 불일치 |
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
| `403` | `SOURCE_NOT_ALLOWED` | 등록·활성된 수집 출처가 아닌 대상 |
| `403` | `ROBOTS_DISALLOWED` | 출처 `robots.txt`가 금지한 경로 |
| `404` | `SOURCE_NOT_FOUND` | 수집 출처 미존재 |
| `404` | `CANDIDATE_NOT_FOUND` | 수집 후보 미존재 |
| `409` | `SOURCE_STATE_CONFLICT` | 목록 수집 활성 조건 미충족 등 출처 상태 충돌 |
| `409` | `SOURCE_VERSION_CONFLICT` | 출처 낙관적 잠금 충돌 |
| `409` | `CANDIDATE_STATE_CONFLICT` | 현재 후보 상태에서 command 불가 |
| `409` | `CANDIDATE_LEASE_CONFLICT` | collector lease 만료·다른 collector 선점·lockVersion 불일치 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | 후보 낙관적 잠금 충돌 |
| `409` | `CANDIDATE_DUPLICATE` | 같은 원문 URL의 후보·게시글 존재 |
| `429` | `SOURCE_RATE_LIMITED` | 출처 요청 간격·일일 상한 초과 |
| `502` | `SOURCE_FETCH_FAILED` | 대상 사이트 응답·파싱·이미지 저장 실패 |
| `413` | `UPLOAD_TOO_LARGE` | 이미지 파일·요청 개수·전체 크기·decode 자원 제한 초과 |
| `413` | `REQUEST_TOO_LARGE` | JSON 요청 본문 크기 제한 초과 |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | 이미지 형식·decode validation 실패 |
| `429` | `RATE_LIMITED` | 요청 제한 초과 |
| `500` | `INTERNAL_ERROR` | 분류되지 않은 서버 오류 |
| `503` | `DEPENDENCY_UNAVAILABLE` | DB·R2 등 필수 의존성 장애 |
| `503` | `MAINTENANCE_READ_ONLY` | 이전·복구를 위한 전체 DB 쓰기 차단, `Retry-After` 제공 |

## 7. Cache header

| API | header |
| --- | --- |
| boards | `public, max-age=60, s-maxage=300` |
| posts list | `public, max-age=15, s-maxage=60` |
| post detail | `public, max-age=30, s-maxage=300` |
| policies | `public, max-age=60, s-maxage=300` |
| post views | `no-store` |
| admin | `private, no-store` |
| admin collect | `private, no-store` |
| health | `no-store` |
| error·404 | `no-store` |

ETag는 JSON body hash로 제공하고 `If-None-Match`에 `304`를 반환한다.

## 8. API 구현 순서

1. BFF 공통 request ID·오류·validation·health와 Core API 내부 health
2. boards와 공개 목록 BFF·Core query
3. 상세와 context page 계산
4. 게시글 조회 수 증가 endpoint
5. 정책 조회와 운영 단발성 정책 시행 command
6. BFF 외부 관리자 인증 adapter와 Core 내부 서비스 인증
7. 이미지 staging과 초안 command
8. 발행·예약·예약 취소·숨김·재공개·최종 삭제·outbox
9. 수집 출처 조회·수정과 관리자 URL 지정 후보 작업 접수
10. collector 내부 claim·heartbeat·result·preview upload API
11. 후보 검색·상세·재수집·반려와 초안 승격
12. 후속 `M0 자동 수집`에서 목록 수집 단발성 command와 출처 자동 비활성 별도 설계

## 9. 실행 준비 gate

현재 브랜치에는 Core API, BFF, 관리자 화면, outbox worker와 M0 OpenAPI source가 없다. 과거
문서가 참조한 `m0-bff.openapi.json`도 Git 전체 이력에서 추적된 파일을 확인하지 못했다.
아래 항목은 향후 구현·검증 gate이며 실제 산출물과 실행 결과를 확인한 항목만 완료로 바꾼다.

- [ ] M0 endpoint만 포함한 OpenAPI `3.1.x` source 작성
- [ ] request·response·error schema에서 문서 예시 자동 검증
- [ ] Nuxt BFF route가 외부 OpenAPI validation을 공통 적용
- [ ] PostgreSQL·BFF·Express Core API의 내부 contract integration test
- [ ] Nuxt BFF 공개 boards·목록·상세 nested route와 mock Core contract test
- [ ] 공개 목록 0건·마지막 page·초과 page Core contract test
- [ ] 정책 현재·과거 버전 조회와 초안 비공개 Core/BFF contract test
- [ ] 정책 시행 command의 미래·5분 초과 과거 시각 거부, 반개방 기간 경계·유형별 잠금·cache purge outbox transaction test
- [ ] 조회 수 endpoint의 empty payload·payload 존재 시 `400 VALIDATION_FAILED`·공개 상태·게시판 소속
  검증과 원자 증가 contract test
- [ ] `MAINTENANCE_READ_ONLY`에서 공개 GET 허용·모든 mutation `503`·`Retry-After`·`Cache-Control: no-store` contract test
- [ ] 조회 수 endpoint IP `60회/분` BFF rate-limit과 실패 시 상세 화면 유지 test
- [ ] 목록의 미존재·비활성·잘못된 형식 `boardSlug`가 동일한 `404 BOARD_NOT_FOUND`인지 Core contract test
- [ ] 상세의 게시판 불일치·잘못된 형식 `boardSlug`·`postId`가 동일한 `404 POST_NOT_FOUND`인지 Core contract test
- [ ] 문맥 없는 `/api/v1/posts*`, `/posts/:postId`가 노출되지 않는지 route test
- [ ] SSR `/:boardSlug/posts/:postId`의 게시판 불일치가 콘텐츠 없는 `404` HTML인지 integration test
- [ ] SSR 상세의 canonical·OG·공유 URL이 `/:boardSlug/posts/:postId`로 일치하는지 integration test
- [ ] SSR 상세의 앞뒤·내부 연속 Unicode whitespace, 80자 미만·120자·120자 초과 TEXT와 결합 문자·
  emoji 사례에서 whitespace를 정규화한 뒤 padding 없이 Unicode grapheme cluster 기준으로만 최대
  120자를 만들고 `description`·`og:description`·`twitter:description`이 일치하는지 integration test
- [ ] 숨김·삭제·예약 글의 동일한 Core `404` contract test
- [ ] 다중 image upload의 요청 개수·전체 크기 gate `413`과 `fields` 미제공, gate 통과 뒤 storage 전
  전체 파일 validation, 개별 크기·형식 혼합 시 `413` 우선, 형식만 실패 시 `415`, 모든 실패
  index·일반화 reason, validation 실패 시 storage 0건, R2·DB `503`의 `fields` 미제공 test
- [ ] storage 중간 실패 시 image row rollback·즉시 object 보상 삭제·별도 cleanup transaction과
  24시간 orphan inventory integration test
- [ ] image 선점·preview·폐기 상태 경쟁과 폐기 `202` 성공 envelope·outbox 삭제 integration test
- [ ] 숨김 글 block 교체 중 public 삭제 대기·private image 제거 contract test
- [ ] `lockVersion`와 `Idempotency-Key` 동시 요청 integration test
- [ ] 즉시 발행·숨김 404·public object 삭제 후 정확한 CDN 이미지 URL purge outbox Core contract test
- [ ] 재공개 시 최초 `publishedAt` 유지·private image 재승격 Core/BFF contract test
- [ ] 최종 삭제 `REMOVED` 전이·private 원본 30일 지연 삭제 outbox contract test
- [ ] 예약·취소·due scheduler 발행과 cache purge outbox contract test
- [ ] 중단된 outbox 회수·지수 backoff·8회 `DEAD` 전환 test
- [ ] Core 내부 서비스 토큰 없음·불일치와 provider-neutral actor 누락·형식 오류 test
- [ ] BFF 외부 관리자 adapter의 identity 없음·만료·잘못된 issuer·audience test
- [ ] 관리자 게시글 상태·게시판·제목 prefix·수정일·page 검색과 형식 오류 `400`·유효한 초과 page
  `200` 빈 결과 Core contract test
- [ ] 관리자 게시글 상세의 `postId` 형식 오류·미존재·접근 불가 동일 `404`, 비공개 상태·TEXT/IMAGE
  block·storage key 비노출 contract test
- [ ] BFF 관리자 query validation·응답 allowlist mapping·Core 내부 인증 header 전달 test
- [ ] `/internal/health/ready` migration version 불일치 test
- [ ] 수집 endpoint가 관리자 인증 없이 호출될 때 `401`·`403`인지, 공개 route에 노출되지 않는지 test
- [ ] collector service token 없음·scope 불일치·rotation 후 이전 token 거부 test
- [ ] collector claim이 `FOR UPDATE SKIP LOCKED`와 `lease_until`으로 중복 선점을 막는 동시성 test
- [ ] heartbeat와 result submit의 `collector_id`·`lockVersion`·lease 만료 충돌 test
- [ ] collector preview upload의 크기·형식·decode 검증, 24시간 만료, storage key 비노출 test
- [ ] 미등록 host의 관리자 접수 거부와 로컬 collector의 비활성 host, robots 금지 경로, 사설·loopback IP 대상 요청 거부 contract test
- [ ] 로컬 collector가 출처 요청 간격·일일 상한 초과 시 결과를 `SOURCE_RATE_LIMITED`로 제출하는 contract test
- [ ] 정규화 URL 중복 요청의 `409 CANDIDATE_DUPLICATE`와 동시 요청 경쟁 test
- [ ] collector fetch·파싱 실패가 `FETCH_FAILED` 후보로 기록되고 재수집이 `PENDING`으로 상태를 되돌리는 contract test
- [ ] 후보 반려 사유 코드 허용 목록과 상태 전이 test
- [ ] 후보 승격이 이미지 검증·재인코딩을 거쳐 초안·이미지·상태 이력·후보 상태를 한 transaction으로 commit하는 integration test
- [ ] 후보 승격 실패 시 후보 상태 유지와 저장 이미지 orphan 분류 test
- [ ] 중복 후보의 `acknowledgeDuplicate` 없는 승격 차단 test
- [ ] 수집 응답에 원문 HTML·storage key·내부 오류 상세가 없는지 응답 allowlist test
- [ ] 로컬 collector의 redirect 3회 초과·비HTML·응답 크기 초과 거부 test
- [ ] M0에 포함하지 않는 legacy 회원 endpoint와 Swagger UI가 Core API에서 공개되지 않는지 test

모든 항목이 통과하기 전에는 API 계층을 “구현 준비 완료” 또는 “구현 완료”로 표시하지 않는다.
