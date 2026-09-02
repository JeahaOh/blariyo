# 게시글 목록 조회 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §3 게시글 목록](../../../../system-design/03-api-design.md), [데이터 모델 §8](../../../../system-design/02-data-model.md)
- 미검증: OpenAPI, source, query plan, contract·runtime test

## 1. 목적과 호출 경계

Nuxt SSR과 상세 하단 목록이 활성 게시판의 공지와 일반 글 한 page를 조회한다. BFF→Core
`BoardQueryService`/`PostQueryService`→PostgreSQL 순서다.

## 2. Method·path·인증·권한

- `GET /api/v1/boards/:boardSlug/posts?page=1`
- 인증 없음; cache `public, max-age=15, s-maxage=60`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `boardSlug` | path string | Y | lowercase 영문·숫자·하이픈, 활성 게시판 | `content.board` | 게시판 |
| `page` | query integer | N | 기본 1, 1~10000 | API 계약 | 일반 글 page |

body: 해당 없음.

## 4. Response

공통 envelope는 API 설계 §2를 참조한다. `board`, `pinnedItems`, `items`와 page meta를 반환한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.board.slug` | string | Y | 요청한 활성 slug | `content.board.slug` | 게시판 식별자 |
| `data.board.displayName` | string | Y | 1~50자 | `content.board.display_name` | 표시명 |
| `data.pinnedItems` | array | Y | 0~3, page size 제외 | `pinned_position` | 공지 |
| `data.items` | array | Y | 최대 20 | 공개 일반 글 query | 일반 글 |
| `data.pinnedItems[].postId`, `data.items[].postId` | integer | Y | 양수 | `board_post.id` | 공개 번호 |
| `data.pinnedItems[].title`, `data.items[].title` | string | Y | 1~200자 | `board_post.title` | 제목 |
| `data.pinnedItems[].viewCount`, `data.items[].viewCount` | integer | Y | 0 이상 | `view_count` | 참고 조회 수 |
| `data.pinnedItems[].authorLabel`, `data.items[].authorLabel` | string | Y | M0 `운영자` | BFF mapping | 표시 작성자 |
| `data.pinnedItems[].publishedAt`, `data.items[].publishedAt` | ISO 8601 | Y | UTC | `published_at` | 최초 발행 시각 |
| `data.pinnedItems[].path`, `data.items[].path` | string | Y | `/{slug}/posts/{id}` | BFF mapping | 상세 경로 |
| `meta.page` | integer | Y | 1 이상 | query result | 현재 page |
| `meta.pageSize` | integer | Y | `20` | API 계약 | 일반 글 page 크기 |
| `meta.totalItems` | integer | Y | 공지 제외, 0 이상 | count query | 일반 글 전체 수 |
| `meta.totalPages` | integer | Y | 0 이상 | page 계산 | 전체 page 수 |
| `meta.hasPrevious`,`meta.hasNext` | boolean | Y | page 기준 | page 계산 | 이동 가능 여부 |

## 5. Validation과 정규화

형식 오류·비활성·미존재 `boardSlug`는 동일한 `404 BOARD_NOT_FOUND`; page 형식 오류는
`400 VALIDATION_FAILED`다.

## 6. 정상 처리와 데이터 전이

공지는 `pinnedPosition ASC`, 일반 글은 `publishedAt DESC, postId DESC`다. `PUBLISHED`이고
발행 시각이 현재 이하인 글만 읽는다. 쓰기와 상태 전이는 없다.

## 7. 오류·권한·부분 실패

- 글 0건의 page 1: 빈 배열 `200`
- 전체 page 초과: `404 PAGE_NOT_FOUND`
- 게시판 없음: `404 BOARD_NOT_FOUND`
- DB 장애: `503 DEPENDENCY_UNAVAILABLE`

## 8. 멱등성·동시성·재시도

읽기 요청으로 멱등이다. 같은 정렬값에서는 `postId DESC`가 tie-breaker다.

## 9. Pagination·cache·호환성

page size 20 고정, OFFSET 방식이다. 공지는 total·page size에서 제외한다. ETag를 지원한다.

## 10. 예시

Request:

```http
GET /api/v1/boards/meme/posts?page=1
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "board": { "slug": "meme", "displayName": "짤" },
    "pinnedItems": [],
    "items": [
      {
        "postId": 1047,
        "title": "제목",
        "viewCount": 1248,
        "authorLabel": "운영자",
        "publishedAt": "2026-09-02T05:00:00.000Z",
        "path": "/meme/posts/1047"
      }
    ]
  },
  "meta": {
    "requestId": "01JEXAMPLE0000000000000000",
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasPrevious": false,
    "hasNext": false
  }
}
```

실패 `404` 예시는 [공통 오류 envelope](../../../../system-design/03-api-design.md)를 사용하며,
없는 게시판은 `BOARD_NOT_FOUND`, 초과 page는 `PAGE_NOT_FOUND`다.

```json
{
  "success": false,
  "error": { "code": "PAGE_NOT_FOUND", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

- 0건, 공지 3건, 20건, 마지막·초과 page, 정렬 tie, 비공개 글 제외를 검증한다.
- 현재 실행 증거는 없다.
