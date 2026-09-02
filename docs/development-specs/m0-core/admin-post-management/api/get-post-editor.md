# 관리자 게시글 편집 상세 API Spec

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 초안 편집 상세](../../../../system-design/03-api-design.md)
- 미검증: OpenAPI, source, contract test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF의 인증 adapter를 거쳐 Core `PostQueryService`에서 공개 여부와 관계없이 한
게시글의 편집 모델을 조회한다.

## 2. Method·path·인증·권한

`GET /api/v1/admin/posts/:postId`; 관리자 인증 필수; `private, no-store`.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 편집 글 |

query·body 없음.

## 4. Response

`postId, boardSlug, title, source, blocks, pinnedPosition, status, scheduledAt, publishedAt, lockVersion,
createdAt, updatedAt`. IMAGE block은 `alt, imageId, status, width, height, previewPath`를 포함한다.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | 양수 | post | 게시글 ID |
| `data.boardSlug` | string | Y | 활성/과거 소속 slug | board | 게시판 |
| `data.title` | string | Y | 1~200자 | post | 제목 |
| `data.source` | object/null | Y | `name`,`url` pair | post | 출처 |
| `data.blocks[].type` | enum | Y | `TEXT`,`IMAGE` | block | 블록 유형 |
| `data.blocks[].text` | string | 조건부 | TEXT | block | 본문 |
| `data.blocks[].imageId` | integer | 조건부 | IMAGE | image | 편집 이미지 |
| `data.blocks[].alt` | string | 조건부 | IMAGE | block | 대체 텍스트 |
| `data.blocks[].status` | enum | 조건부 | IMAGE 상태 | image | 자산 상태 |
| `data.blocks[].width`,`height` | integer | 조건부 | 양수 | image | 크기 |
| `data.blocks[].previewPath` | path | 조건부 | 인증 preview route | BFF | 미리보기 |
| `data.pinnedPosition` | integer/null | Y | null 또는 1~3 | post | 공지 위치 |
| `data.status` | enum | Y | 게시 상태 | post | 현재 상태 |
| `data.scheduledAt`,`publishedAt` | ISO 8601/null | Y | UTC | post | 예약·발행 시각 |
| `data.lockVersion` | integer | Y | 1 이상 | post | 낙관적 잠금 |
| `data.createdAt`,`updatedAt` | ISO 8601 | Y | UTC | post | 감사 시각 |

## 5. Validation과 정규화

미존재·접근 불가는 동일 `404 POST_NOT_FOUND`다. `postId` 형식 오류를 `400 VALIDATION_FAILED`로
처리할지 `404 POST_NOT_FOUND`로 일반화할지는 상위 관리자 API 계약에 없어 `(결정 필요)`다.

## 6. 정상 처리와 데이터 전이

post·block·image 편집 projection을 읽는다. storage key와 외부 identity는 mapping에서 제거한다.

## 7. 오류·권한·부분 실패

인증 오류 `401/403`, 미존재 `404`, DB 장애 `503`. 일부 block만 반환하지 않고 전체 오류다.

## 8. 멱등성·동시성·재시도

멱등 read. 편집 저장에는 받은 `lockVersion`을 사용한다.

## 9. Pagination·cache·호환성

해당 없음; `private, no-store`.

## 10. 예시

Request:

```http
GET /api/v1/admin/posts/1047
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "postId": 1047,
    "boardSlug": "meme",
    "title": "제목",
    "source": null,
    "blocks": [{ "type": "TEXT", "text": "본문" }],
    "pinnedPosition": null,
    "status": "DRAFT",
    "scheduledAt": null,
    "publishedAt": null,
    "lockVersion": 3,
    "createdAt": "2026-09-02T04:00:00.000Z",
    "updatedAt": "2026-09-02T05:00:00.000Z"
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `404`는 공통 오류 envelope와 `POST_NOT_FOUND`를 사용한다. path 형식 오류 예시는 상위 계약
확정 전 만들지 않는다.

```json
{
  "success": false,
  "error": { "code": "POST_NOT_FOUND", "message": "게시글을 찾을 수 없습니다.", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

모든 상태, TEXT/IMAGE mapping, previewPath, storage key 비노출과 확정된 path 형식 오류를 검증한다.
상위 계약 확정 전 문서 상태는 `초안`이며 실행도 미실행이다.
