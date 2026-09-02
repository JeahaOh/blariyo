# 관리자 게시글 수정 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 초안 수정](../../../../system-design/03-api-design.md), [데이터 모델 §3·§7](../../../../system-design/02-data-model.md)
- 미검증: OpenAPI, image replacement·lock integration test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostCommandService`에서 `DRAFT`, `SCHEDULED`, `HIDDEN_REVIEW`
글의 지정 field를 낙관적 잠금으로 수정한다.

## 2. Method·path·인증·권한

`PATCH /api/v1/admin/posts/:postId`; 관리자 인증; `private, no-store`. Idempotency-Key 계약 없음.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 대상 |
| `lockVersion` | integer | Y | 현재값 | post | 동시성 |
| `title` | string | N | trim 1~200 | post | 제목 |
| `source` | object/null | N | pair/null | post | 유지·교체·제거 |
| `source.name` | string | 조건부 | source가 object면 필수 | post | 출처명 |
| `source.url` | HTTPS URL | 조건부 | source가 object면 필수 | post | 원문 URL |
| `blocks` | array | N | 전체 교체, 1~40 | block | 본문 |
| `blocks[].type` | enum | 조건부 | `TEXT`,`IMAGE` | block | 본문 유형 |
| `blocks[].text` | string | 조건부 | TEXT, trim 1~20000 | block | plain text |
| `blocks[].imageId` | integer | 조건부 | IMAGE, 선점 가능 자산 | image | 이미지 |
| `blocks[].alt` | string | 조건부 | IMAGE, trim 1~300 | block | 대체 텍스트 |
| `pinnedPosition` | integer/null | N | 1~3/null | post | 공지 |

## 4. Response

`200`: `postId,status,lockVersion(+1),updatedAt`.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | path와 동일 | post | 대상 ID |
| `data.status` | enum | Y | 수정 전 상태 유지 | post | 현재 상태 |
| `data.lockVersion` | integer | Y | 이전 값 +1 | post | 새 잠금 버전 |
| `data.updatedAt` | ISO 8601 | Y | UTC | post | 수정 시각 |

## 5. Validation과 정규화

생략 field는 유지. 빈 blocks는 `400`. `HIDDEN_REVIEW`는 공지를 지정할 수 없고 public image 삭제
대기 중 block 변경을 거부한다.

## 6. 정상 처리와 데이터 전이

post field·전체 block 교체·새 STAGED image 선점·빠진 image 상태 처리를 한 transaction에서 수행하고
`EDIT` 이력을 기록한다. `SCHEDULED` 수정은 예약 시각을 유지하고 공개 검증을 다시 한다.

## 7. 오류·권한·충돌·부분 실패

상태 `409 POST_STATE_CONFLICT`, version `409 POST_VERSION_CONFLICT`, image `409 IMAGE_STATE_CONFLICT/
IMAGE_ALREADY_ATTACHED`, validation `400`.

## 8. 멱등성·동시성·재시도

lockVersion 조건부 update다. 충돌 후 최신 상세를 다시 읽고 운영자가 변경을 병합한다. 자동 재전송 금지.

## 9. Pagination·cache·호환성

해당 없음; admin no-store.

## 10. 예시

Request body:

```json
{
  "lockVersion": 3,
  "title": "수정 제목",
  "source": null,
  "blocks": [{ "type": "TEXT", "text": "수정 본문" }]
}
```

성공 `200`:

```json
{
  "success": true,
  "data": { "postId": 1047, "status": "DRAFT", "lockVersion": 4, "updatedAt": "2026-09-02T05:00:00.000Z" },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `POST_VERSION_CONFLICT`를 사용하고 최신 본문은 포함하지 않는다.

```json
{
  "success": false,
  "error": { "code": "POST_VERSION_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

partial field, block 전체 교체, 숨김 image 대기, 동시 수정, transaction rollback을 검증한다. 미실행이다.
