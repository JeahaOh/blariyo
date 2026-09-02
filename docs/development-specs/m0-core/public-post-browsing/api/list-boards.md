# 활성 게시판 조회 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §3 활성 게시판](../../../../system-design/03-api-design.md), [데이터 모델 §3 게시판](../../../../system-design/02-data-model.md)
- 미검증: OpenAPI, BFF·Core source, contract test, runtime

## 1. 목적과 호출 경계

브라우저 또는 Nuxt SSR이 활성 게시판 메뉴를 조회한다. 외부 제공자는 Nuxt BFF, 내부 제공자는
Express Core `BoardQueryService`이며 BFF가 허용 필드만 전달한다.

## 2. Method·path·인증·권한

- `GET /api/v1/boards`
- 인증: 없음
- cache: `public, max-age=60, s-maxage=300`; body hash ETag 지원

## 3. Request

path·query·body·필수 header: 해당 없음.

## 4. Response

공통 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.items[].slug` | string | Y | 활성, slug 형식 | `content.board.slug` | URL 식별자 |
| `data.items[].displayName` | string | Y | 1~50자 | `content.board.display_name` | 표시명 |
| `data.items[].postingPolicy` | string | Y | M0 `ADMIN` | `content.board.posting_policy` | 작성 주체 |
| `data.items[].path` | string | Y | `/{slug}` | BFF mapping | 공개 목록 경로 |

## 5. Validation과 정규화

요청값이 없다. 비활성 게시판은 응답에서 제외한다.

## 6. 정상 처리와 데이터 전이

`is_active=true`를 `display_order ASC`로 조회한다. 상태 전이·transaction·외부 I/O는 없다.

## 7. 오류·권한·부분 실패

DB 장애는 공통 `503 DEPENDENCY_UNAVAILABLE`, 미분류 오류는 `500 INTERNAL_ERROR`다. 빈 배열은 정상이다.

## 8. 멱등성·동시성·재시도

읽기 요청으로 멱등이다. client는 일시 오류 시 사용자 재시도만 제공하고 무한 재시도하지 않는다.

## 9. Pagination·cache·호환성

pagination 없음. 게시판 문맥 없는 게시글 alias를 만들지 않는다.

## 10. 예시

Request:

```http
GET /api/v1/boards
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "items": [
      { "slug": "meme", "displayName": "짤", "postingPolicy": "ADMIN", "path": "/meme" }
    ]
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `503`은 [공통 오류 envelope](../../../../system-design/03-api-design.md)를 사용하며
`error.code=DEPENDENCY_UNAVAILABLE`이고 내부 DB 원인은 포함하지 않는다.

```json
{
  "success": false,
  "error": { "code": "DEPENDENCY_UNAVAILABLE", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

- 활성·비활성 필터, 표시 순서, 내부 `boardId` 비노출을 검증한다.
- 현재는 실행하지 않았다.
