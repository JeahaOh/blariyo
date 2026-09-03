# 관리자 게시글 검색 API Spec

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-03
- 입력 근거: [API 설계 §4·§5 게시글 검색](../../../../system-design/03-api-design.md)
- 미검증: OpenAPI, auth adapter, source, contract test

## 1. 목적과 호출 경계

관리자 BFF가 운영자 identity를 검증한 뒤 Core에서 편집 대상 글을 검색한다.

## 2. Method·path·인증·권한

- `GET /api/v1/admin/posts`
- 외부 관리자 인증·allowlist 필수; Core 내부 service token·admin actor 필수
- `Cache-Control: private, no-store`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `status` | query string | N | 단일 게시 상태 | post | 상태 |
| `board` | query string | N | 게시판 slug | board | 게시판 |
| `titlePrefix` | query string | N | trim 1~100자 | API | 제목 prefix |
| `from`,`to` | ISO 8601 | N | UTC, `from<=to` | `updatedAt` | 수정 범위 |
| `page` | integer | N | 기본 1, 1~10000 | API | page |

body: 해당 없음.

## 4. Response

page size 50. item은 `postId, boardSlug, title, status, lockVersion, scheduledAt, publishedAt, updatedAt`이다.
공통 envelope는 API 설계 §2를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.items[].postId` | integer | Y | 양수 | post | 게시글 ID |
| `data.items[].boardSlug` | string | Y | 소속 slug | board | 게시판 |
| `data.items[].title` | string | Y | 1~200자 | post | 제목 |
| `data.items[].status` | enum | Y | 게시 상태 | post | 현재 상태 |
| `data.items[].lockVersion` | integer | Y | 1 이상 | post | 잠금 버전 |
| `data.items[].scheduledAt`,`publishedAt` | ISO 8601/null | Y | UTC | post | 예약·발행 시각 |
| `data.items[].updatedAt` | ISO 8601 | Y | UTC | post | 정렬 기준 |
| `meta.page`,`meta.pageSize` | integer | Y | pageSize `50` | API | page 정보 |
| `meta.totalItems`,`meta.totalPages` | integer | Y | 0 이상 | count query | 전체 수 |
| `meta.hasPrevious`,`meta.hasNext` | boolean | Y | page 기준 | API | 이동 가능 여부 |

## 5. Validation과 정규화

query 형식·상태·날짜·`page` 범위 오류는 `400 VALIDATION_FAILED`. BFF와 Core가 같은 schema를 검증한다.

## 6. 정상 처리와 데이터 전이

`updatedAt DESC, postId DESC`로 읽는다. 상태 전이 없음.

## 7. 오류·권한·부분 실패

인증 없음·만료 `401 ADMIN_AUTH_REQUIRED`, allowlist 불일치 `403 ADMIN_FORBIDDEN`, DB 장애 `503`.

## 8. 멱등성·동시성·재시도

멱등 read. 응답의 `lockVersion`은 표시 후 명령 전 상세에서 다시 확인한다.

## 9. Pagination·cache·호환성

page size 50 고정, `private, no-store`. `page`가 `1~10000` 범위 안이지만 전체 page를 초과하면
`200`과 빈 `data.items`를 반환한다. 요청한 `meta.page`와 실제 count의 `meta.totalItems`,
`meta.totalPages`를 유지하고 `meta.hasPrevious=page>1`, `meta.hasNext=false`로 계산한다.
공개 목록의 `404 PAGE_NOT_FOUND` 정책은 적용하지 않는다.

## 10. 예시

Request:

```http
GET /api/v1/admin/posts?status=DRAFT&page=1
```

성공 `200`:

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
        "updatedAt": "2026-09-02T05:00:00.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "01JEXAMPLE0000000000000000",
    "page": 1,
    "pageSize": 50,
    "totalItems": 1,
    "totalPages": 1,
    "hasPrevious": false,
    "hasNext": false
  }
}
```

잘못된 query는 `400 VALIDATION_FAILED`다.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력값을 확인해 주세요.",
    "fields": [{ "field": "page", "reason": "range" }]
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

유효한 초과 page 성공 `200`:

```json
{
  "success": true,
  "data": { "items": [] },
  "meta": {
    "requestId": "01JEXAMPLE0000000000000000",
    "page": 3,
    "pageSize": 50,
    "totalItems": 1,
    "totalPages": 1,
    "hasPrevious": true,
    "hasNext": false
  }
}
```

## 11. Contract test와 미검증

필터 조합·정렬·인증·응답 allowlist·storage key 비노출과 초과 page의 `200` 빈 결과를 검증한다.
실행은 미실행이다.
