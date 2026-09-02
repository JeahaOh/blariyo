# 관리자 예약 취소 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 예약 취소](../../../../system-design/03-api-design.md)
- 미검증: scheduler 경쟁·idempotency test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostCommandService`에 명령해 예약 글을 공개 전에 초안으로 되돌린다.

## 2. Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/unschedule`; 관리자 인증; `Idempotency-Key` 필수; no-store.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 대상 |
| `Idempotency-Key` | header string | Y | opaque | ops | 재전송 key |
| `lockVersion` | body integer | Y | 현재값 | post | 동시성 |

## 4. Response

`200`: `postId,status=DRAFT,lockVersion,scheduledAt=null,updatedAt`.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | path와 동일 | post | 대상 ID |
| `data.status` | enum | Y | `DRAFT` | post | 결과 상태 |
| `data.lockVersion` | integer | Y | 이전 값 +1 | post | 새 잠금 버전 |
| `data.scheduledAt` | null | Y | 항상 null | post | 예약 제거 |
| `data.updatedAt` | ISO 8601 | Y | UTC | post | 변경 시각 |

## 5. Validation과 정규화

현재 상태가 `SCHEDULED`이고 version이 일치해야 한다.

## 6. 정상 처리와 데이터 전이

`SCHEDULED→DRAFT`, 예약 시각 제거, `UNSCHEDULE` 이력과 idempotency 결과를 한 transaction에 기록한다.

## 7. 오류·권한·충돌·부분 실패

상태·version·idempotency 충돌 `409`, 인증 `401/403`, DB 장애 `503`.

## 8. 멱등성·동시성·재시도

같은 key·body는 기존 결과. scheduler가 먼저 발행하면 state/version 충돌이며 자동 되돌리지 않는다.

## 9. Pagination·cache·호환성

해당 없음. 예약은 공개 cache에 없으므로 purge하지 않는다.

## 10. 예시

Request body:

```json
{ "lockVersion": 4 }
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "postId": 1047,
    "status": "DRAFT",
    "lockVersion": 5,
    "scheduledAt": null,
    "updatedAt": "2026-09-02T05:00:00.000Z"
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `POST_STATE_CONFLICT` 또는 `POST_VERSION_CONFLICT`를 사용한다.

```json
{
  "success": false,
  "error": { "code": "POST_STATE_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

due scheduler와 취소 경쟁, key 재전송, 상태 이력을 검증한다. 미실행이다.
