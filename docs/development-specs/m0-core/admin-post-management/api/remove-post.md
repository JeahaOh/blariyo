# 관리자 게시글 최종 제거 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 삭제](../../../../system-design/03-api-design.md), [데이터 모델 §7·§9](../../../../system-design/02-data-model.md)
- 미검증: 30일 지연 삭제·outbox integration

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostCommandService`에 명령해 숨김 검토가 끝난 글을 복구 불가능한
`REMOVED` terminal 상태로 전환한다. row 물리 삭제는 하지 않는다.

## 2. Method·path·인증·권한

`DELETE /api/v1/admin/posts/:postId`; 관리자 인증; `Idempotency-Key`; no-store.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 대상 |
| `Idempotency-Key` | header string | Y | opaque | ops | 재전송 key |
| `lockVersion` | body integer | Y | 현재값 | post | 동시성 |
| `reasonCode` | body enum | Y | `REMOVE` | status history | 최종 제거 사유 |

## 4. Response

`200`: `postId,status=REMOVED,lockVersion,updatedAt`.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | path와 동일 | post | 대상 ID |
| `data.status` | enum | Y | `REMOVED` | post | terminal 상태 |
| `data.lockVersion` | integer | Y | 이전 값 +1 | post | 새 잠금 버전 |
| `data.updatedAt` | ISO 8601 | Y | UTC | post | 제거 시각 |

## 5. Validation과 정규화

`HIDDEN_REVIEW`이고 public image 삭제가 완료되어야 한다. reason은 `REMOVE`만 허용한다.

## 6. 정상 처리와 데이터 전이

`HIDDEN_REVIEW→REMOVED`, image `PRIVATE_DELETE_PENDING`, 30일 뒤 실행할 private 삭제 outbox,
`REMOVE` 이력과 idempotency 결과를 transaction commit한다.

## 7. 오류·권한·충돌·부분 실패

상태·version·image·idempotency 충돌 `409`. 외부 삭제 실패는 REMOVED를 되돌리지 않고 재시도한다.

## 8. 멱등성·동시성·재시도

key 재전송은 기존 결과. terminal 상태에서 다른 명령은 거부한다.

## 9. Pagination·cache·호환성

물리 row 삭제 endpoint 없음. 공개 404와 URL은 유지한다.

## 10. 예시

Request body:

```json
{ "lockVersion": 5, "reasonCode": "REMOVE" }
```

성공 `200`:

```json
{
  "success": true,
  "data": { "postId": 1047, "status": "REMOVED", "lockVersion": 6, "updatedAt": "2026-09-02T05:00:00.000Z" },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `POST_STATE_CONFLICT`, `POST_VERSION_CONFLICT` 또는
`IMAGE_STATE_CONFLICT`를 사용한다.

```json
{
  "success": false,
  "error": { "code": "POST_STATE_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

확인 UI 연계, terminal 상태, 30일 예약, raw 사유 비저장, outbox 재시도를 검증한다. 미실행이다.
