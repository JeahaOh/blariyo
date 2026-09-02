# 게시글 상세 조회 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §3 게시글 상세](../../../../system-design/03-api-design.md), [데이터 모델 §3·§8](../../../../system-design/02-data-model.md)
- 미검증: OpenAPI, SSR·Core source, contract·security test

## 1. 목적과 호출 경계

Nuxt SSR이 공개 글 본문과 현재 글이 포함된 같은 게시판 목록 context를 받는다. 외부 제공자는 Nuxt
BFF, 내부 제공자는 Core `PostQueryService`다. BFF는 storage key, 상태와 이력을 제거하고 공개 field만 응답한다.

## 2. Method·path·인증·권한

- `GET /api/v1/boards/:boardSlug/posts/:postId`
- 인증 없음; cache `public, max-age=30, s-maxage=300`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `boardSlug` | path string | Y | 활성 slug | `content.board` | 요청 게시판 |
| `postId` | path integer string | Y | 양의 정수 | `board_post.id` | 글 번호 |

query·body: 해당 없음.

## 4. Response

`data.post`는 board, title, authorLabel, publishedAt, viewCount, blocks, source, shareUrl을 가진다.
`data.context`는 목록 item schema, `listPage`, page 정보를 가진다.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.post.postId` | integer | Y | 양수 | `board_post.id` | 게시글 번호 |
| `data.post.board` | object | Y | `slug`,`displayName` | board | 게시판 |
| `data.post.title` | string | Y | 1~200자 | post | 공개 제목 |
| `data.post.authorLabel` | string | Y | M0 `운영자` | BFF mapping | 표시 작성자 |
| `data.post.publishedAt` | ISO 8601 | Y | UTC | post | 최초 발행 시각 |
| `data.post.viewCount` | integer | Y | 0 이상 | post | 참고 조회 수 |
| `data.post.blocks[].type` | enum | Y | `TEXT`,`IMAGE` | block | 본문 유형 |
| `data.post.blocks[].text` | string | 조건부 | TEXT | `text_content` | plain text |
| `data.post.blocks[].image.url` | HTTPS URL | 조건부 | 공개 media만 | storage adapter | 이미지 |
| `data.post.blocks[].image.alt` | string | 조건부 | 1~300자 | `alt_text` | 대체 텍스트 |
| `data.post.blocks[].image.width`,`height` | integer | 조건부 | 양수 | image metadata | 비율 공간·OG 크기 |
| `data.post.source` | object/null | Y | `name`·HTTPS `url` pair | post | 출처 |
| `data.post.shareUrl` | URL | Y | canonical 상세 URL | BFF | 공유 URL |
| `data.context.pinnedItems`,`items` | array | Y | 목록 item schema | 공개 목록 query | 하단 목록 |
| `data.context.listPage` | integer | Y | 1 이상 | page 계산 | 현재 글 page |
| `data.context.pageSize` | integer | Y | `20` | API 계약 | 하단 목록 크기 |
| `data.context.totalItems`,`totalPages` | integer | Y | 0 이상 | page 계산 | page 정보 |

## 5. Validation과 정규화

형식 오류, 게시판 불일치, 비활성 게시판, 비공개·미존재 글을 모두 `404 POST_NOT_FOUND`로 일반화한다.

## 6. 정상 처리와 데이터 전이

게시판과 글의 `board_id`를 함께 확인하고 공개 본문·이미지·출처를 조회한다. 현재 글이 일반 글이면
정렬상 앞선 글 수로 `listPage`를 계산하고, 공지면 1이다. 조회 자체의 상태 전이는 없다.

## 7. 오류·권한·부분 실패

404에는 제목·본문·이미지·출처·숨김 이유가 없다. 공개 image URL 생성 실패나 DB 장애는
`503 DEPENDENCY_UNAVAILABLE`; error 응답은 `no-store`다.

## 8. 멱등성·동시성·재시도

읽기 요청으로 멱등이다. 조회 중 상태가 숨김으로 바뀌면 이후 요청과 cache purge 후 404가 기준이다.

## 9. Pagination·cache·호환성

context의 page size는 20이다. 게시판 문맥 없는 상세 alias는 제공하지 않는다.

## 10. 예시

Request:

```http
GET /api/v1/boards/meme/posts/1047
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "post": {
      "postId": 1047,
      "board": { "slug": "meme", "displayName": "짤" },
      "title": "제목",
      "authorLabel": "운영자",
      "publishedAt": "2026-09-02T05:00:00.000Z",
      "viewCount": 1248,
      "blocks": [
        { "type": "TEXT", "text": "본문" },
        {
          "type": "IMAGE",
          "image": {
            "url": "https://img.__SERVICE_DOMAIN__/posts/1047/hash.webp",
            "alt": "이미지 설명",
            "width": 1200,
            "height": 900
          }
        }
      ],
      "source": null,
      "shareUrl": "https://__SERVICE_DOMAIN__/meme/posts/1047"
    },
    "context": {
      "pinnedItems": [],
      "listPage": 1,
      "items": [],
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `404`는 공통 오류 envelope와 `POST_NOT_FOUND`만 반환하며 제목·본문·상태·숨김 사유를 넣지 않는다.

```json
{
  "success": false,
  "error": { "code": "POST_NOT_FOUND", "message": "게시글을 찾을 수 없습니다.", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

- 소속 불일치·숨김·삭제·예약·초안의 동일 404, storage key 비노출, context 현재 행을 검증한다.
- 현재 실행하지 않았다.
