# 관리자 초안 생성 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 초안 생성](../../../../system-design/03-api-design.md), [데이터 모델 §3·§5·§7](../../../../system-design/02-data-model.md)
- 미검증: OpenAPI, transaction·idempotency integration test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF의 인증 adapter를 거쳐 Core `PostCommandService`에 요청하고, Core가 staging
image를 선점해 `DRAFT` 게시글과 순서가 있는 block을 만든다.

## 2. Method·path·인증·권한

`POST /api/v1/admin/posts`; 관리자 인증; `Idempotency-Key` 필수; `private, no-store`.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `Idempotency-Key` | header string | Y | opaque, 최대 128자 저장 | ops | 재전송 key |
| `boardSlug` | string | Y | 활성 작성 대상 | board | 게시판 |
| `title` | string | Y | trim 1~200자 | post | 제목 |
| `source` | object/null | Y | name·HTTPS URL pair | post | 출처 |
| `source.name` | string | 조건부 | source가 있으면 필수 | post | 표시 출처명 |
| `source.url` | HTTPS URL | 조건부 | source가 있으면 필수 | post | 원문 URL |
| `blocks` | array | Y | 1~40, IMAGE 최대 20 | block | 본문 |
| `blocks[].type` | enum | Y | `TEXT`,`IMAGE` | block | 본문 유형 |
| `blocks[].text` | string | 조건부 | TEXT, trim 1~20000 | block | plain text |
| `blocks[].imageId` | integer | 조건부 | 미연결 STAGED | image | 이미지 |
| `blocks[].alt` | string | 조건부 | trim 1~300 | block | 대체 텍스트 |
| `pinnedPosition` | integer/null | Y | null 또는 1~3 | post | 공지 후보 |

## 4. Response

성공 `201`: `postId,status=DRAFT,lockVersion=1`과 공통 meta.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | 양수 | post | 생성 ID |
| `data.status` | enum | Y | `DRAFT` | post | 생성 상태 |
| `data.lockVersion` | integer | Y | `1` | post | 최초 잠금 버전 |

## 5. Validation과 정규화

TEXT는 HTML·Markdown으로 해석하지 않는다. source name/url 중 하나만 있거나 image 상태·alt가
맞지 않으면 `400 VALIDATION_FAILED` 또는 `409 IMAGE_ALREADY_ATTACHED`다.

## 6. 정상 처리와 데이터 전이

한 transaction에서 post insert, image 선점, block insert, `NULL→DRAFT/CREATE` 이력,
idempotency 완료 결과를 commit한다. 하나라도 실패하면 전체 rollback한다.

## 7. 오류·권한·충돌·부분 실패

`401/403`, `400`, `404 BOARD_NOT_FOUND`, `409 IMAGE_ALREADY_ATTACHED`, idempotency 충돌·처리 중,
`503 MAINTENANCE_READ_ONLY/DEPENDENCY_UNAVAILABLE`.

## 8. 멱등성·동시성·재시도

동일 actor·scope·key·body는 저장 결과를 반환한다. 같은 key 다른 body는 `IDEMPOTENCY_CONFLICT`,
동시 처리 중은 `IDEMPOTENCY_IN_PROGRESS`와 `Retry-After: 1`이다. 결과는 24시간 보존한다.

## 9. Pagination·cache·호환성

해당 없음. 외부 BFF와 Core 내부 계약을 BFF schema source로 검증한다.

## 10. 예시

Request body:

```json
{
  "boardSlug": "meme",
  "title": "제목",
  "source": { "name": "출처명", "url": "https://example.com/original" },
  "blocks": [
    { "type": "TEXT", "text": "본문" },
    { "type": "IMAGE", "imageId": 501, "alt": "이미지 설명" }
  ],
  "pinnedPosition": null
}
```

성공 `201`:

```json
{
  "success": true,
  "data": { "postId": 1047, "status": "DRAFT", "lockVersion": 1 },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `IMAGE_ALREADY_ATTACHED`를 사용하며 storage key를 노출하지 않는다.

```json
{
  "success": false,
  "error": { "code": "IMAGE_ALREADY_ATTACHED", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

image 선점 경쟁, 전체 rollback, key 재전송·hash 충돌, plain text escape를 검증한다. 미실행이다.
