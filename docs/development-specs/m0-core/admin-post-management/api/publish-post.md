# 관리자 게시글 발행·예약 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 발행·예약](../../../../system-design/03-api-design.md), [아키텍처 §5 이미지·예약](../../../../system-design/01-system-architecture.md)
- 미검증: R2·DB·outbox·scheduler integration

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostCommandService`에 명령해 초안을 즉시 공개하거나 미래
발행으로 예약한다. Core만 상태·이미지·이력·outbox를 조정한다.

## 2. Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/publish`; 관리자 인증; `Idempotency-Key` 필수; no-store.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 대상 |
| `Idempotency-Key` | header | Y | opaque | ops | 재전송 |
| `lockVersion` | integer | Y | 현재값 | post | 동시성 |
| `mode` | enum | Y | `IMMEDIATE`,`SCHEDULED` | API | 방식 |
| `scheduledAt` | ISO 8601 | 조건부 | 예약일 때 수신보다 최소 1분 후 | post | 예약 시각 |

## 4. Response

`200`: `postId,status,lockVersion,publishedAt,scheduledAt`. 즉시는 `PUBLISHED`, 예약은 `SCHEDULED`.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | 요청 path와 동일 | post | 대상 ID |
| `data.status` | enum | Y | `PUBLISHED`,`SCHEDULED` | post | 결과 상태 |
| `data.lockVersion` | integer | Y | 이전 값 +1 | post | 새 잠금 버전 |
| `data.publishedAt` | ISO 8601/null | Y | 즉시면 현재 발행 시각 | post | 최초 발행 시각 |
| `data.scheduledAt` | ISO 8601/null | Y | 예약이면 요청 시각 | post | 예약 시각 |

## 5. Validation과 정규화

block·image·source pair와 공지 위치를 검증한다. 같은 게시판의 예약·공개 공지 위치 중복은
`409 PINNED_ORDER_CONFLICT`다.

## 6. 정상 처리와 데이터 전이

- 즉시: private image를 결정적 public key로 copy한 뒤 `DRAFT/SCHEDULED→PUBLISHED`, image PUBLIC,
  status history, cache purge outbox와 idempotency 결과를 transaction commit한다.
- 예약: `DRAFT→SCHEDULED`, `scheduledAt`, history와 idempotency 결과를 commit하며 cache는 바꾸지 않는다.

## 7. 오류·권한·충돌·timeout·부분 실패

version/state/pin/image/idempotency 충돌은 각 `409`; R2 장애 `503`이며 DB 상태를 공개로 바꾸지 않는다.
copy 후 DB 실패 object는 orphan 정리 대상이다.

## 8. 멱등성·동시성·재시도

actor·scope·key·body 기준 24시간 재사용한다. 즉시 발행의 외부 copy는 결정적 key로 재실행 가능하다.

## 9. Pagination·cache·호환성

해당 없음. 성공 후 영향 목록·상세 URL을 outbox로 purge한다.

## 10. 예시

즉시 발행 request body:

```json
{ "lockVersion": 3, "mode": "IMMEDIATE" }
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "postId": 1047,
    "status": "PUBLISHED",
    "lockVersion": 4,
    "publishedAt": "2026-09-02T05:00:00.000Z",
    "scheduledAt": null
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

예약 body는 `{"lockVersion":3,"mode":"SCHEDULED","scheduledAt":"2026-09-03T00:00:00.000Z"}`다.
실패 `409`는 공통 오류 envelope와 상태에 맞는 `POST_VERSION_CONFLICT`, `POST_STATE_CONFLICT` 또는
`PINNED_ORDER_CONFLICT`를 사용한다.

```json
{
  "success": false,
  "error": { "code": "POST_VERSION_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

즉시·예약·SCHEDULED 즉시 전환, 공지 경쟁, R2/DB 실패, idempotency, purge outbox를 검증한다. 미실행이다.
