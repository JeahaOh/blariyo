# 관리자 staging 이미지 폐기 API Spec

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-03
- 입력 근거: [API 설계 §5 preview·폐기](../../../../system-design/03-api-design.md), [데이터 모델 §5](../../../../system-design/02-data-model.md)
- 미검증: outbox·object delete integration test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `ImageCommandService`에 요청해 게시글에 연결되지 않은 staging
image의 private 삭제를 예약한다.

## 2. Method·path·인증·권한

`DELETE /api/v1/admin/images/:imageId`; 관리자 인증; `private, no-store`.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `imageId` | path integer | Y | 양수, 미연결 STAGED | `board_post_image` | 폐기 대상 |

body·query 없음.

## 4. Response

성공은 `202 Accepted`와 [API 설계 §2](../../../../system-design/03-api-design.md)의 공통 성공 envelope다.
`data.imageId`, `data.status=PRIVATE_DELETE_PENDING`, `meta.requestId`를 반환한다.

| 항목 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.imageId` | integer | Y | 요청한 image ID | image | 폐기 예약 대상 |
| `data.status` | enum | Y | `PRIVATE_DELETE_PENDING` | image | 삭제 대기 상태 |
| `meta.requestId` | string | Y | 공통 request ID | BFF | 요청 추적 |
| `Cache-Control` | header | Y | `private, no-store` | API 계약 | 저장 금지 |

## 5. Validation과 정규화

`post_id=null`이며 `STAGED`인 image만 허용한다.

## 6. 정상 처리와 데이터 전이

한 transaction에서 `STAGED→PRIVATE_DELETE_PENDING`과 `OBJECT_DELETE_PRIVATE` outbox를 기록한다.
실제 private object 삭제는 응답 전에 수행하지 않고 outbox worker가 처리한다.

## 7. 오류·권한·부분 실패

미존재 `404 IMAGE_NOT_FOUND`; 연결됨·다른 상태·삭제 중 `409 IMAGE_STATE_CONFLICT`; storage 삭제 실패는 outbox 재시도다.

## 8. 멱등성·동시성·재시도

Idempotency-Key 계약 없음. 상태 조건부 update로 경쟁을 막고 202 후 자동 재호출하지 않는다.

## 9. Pagination·cache·호환성

해당 없음; `private, no-store`.

## 10. 예시

Request와 성공 응답:

```http
DELETE /api/v1/admin/images/501

HTTP/1.1 202 Accepted
Cache-Control: private, no-store

{
  "success": true,
  "data": {
    "imageId": 501,
    "status": "PRIVATE_DELETE_PENDING"
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `IMAGE_STATE_CONFLICT`를 사용하고 object key를 노출하지 않는다.

```json
{
  "success": false,
  "error": { "code": "IMAGE_STATE_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

초안 선점과 동시 폐기, `202` 성공 envelope, outbox commit, worker 재시도·DEAD를 검증한다.
실행은 미실행이다.
