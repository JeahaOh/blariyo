# 관리자 게시글 숨김 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 숨김](../../../../system-design/03-api-design.md), [아키텍처 §5 권리 요청 숨김](../../../../system-design/01-system-architecture.md)
- 미검증: public 404·object/CDN purge integration

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostCommandService`에 명령해 공개 글을 우선 비노출하고 public
image 삭제와 cache purge를 예약한다.

## 2. Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/hide`; 관리자 인증; `Idempotency-Key`; no-store.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 대상 |
| `lockVersion` | integer | Y | 현재값 | post | 동시성 |
| `reasonCode` | enum | Y | `RIGHTS_EMAIL`,`EDIT` | history | 사유 |

## 4. Response

`200`: `postId,status=HIDDEN_REVIEW,lockVersion,updatedAt`.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | path와 동일 | post | 대상 ID |
| `data.status` | enum | Y | `HIDDEN_REVIEW` | post | 결과 상태 |
| `data.lockVersion` | integer | Y | 이전 값 +1 | post | 새 잠금 버전 |
| `data.updatedAt` | ISO 8601 | Y | UTC | post | 숨김 시각 |

## 5. Validation과 정규화

현재 `PUBLISHED`; 사유 허용 목록·version을 검증한다. 이메일 본문은 받지 않는다.

## 6. 정상 처리와 데이터 전이

한 transaction에서 `PUBLISHED→HIDDEN_REVIEW`, pin 해제, image `PUBLIC_DELETE_PENDING`, 상태 이력,
object 삭제·정확한 image URL 및 목록·상세 purge outbox, idempotency 결과를 기록한다.

## 7. 오류·권한·충돌·부분 실패

commit 직후 공개 API는 404다. 외부 삭제·purge 실패는 공개 상태를 rollback하지 않고 outbox 재시도한다.

## 8. 멱등성·동시성·재시도

Idempotency-Key 24시간. object 삭제는 멱등이며 URL purge까지 모두 끝나야 `PRIVATE_REVIEW`다.

## 9. Pagination·cache·호환성

영향 목록·상세·image URL을 정확히 purge하며 오류·404는 no-store다.

## 10. 예시

Request body:

```json
{ "lockVersion": 4, "reasonCode": "RIGHTS_EMAIL" }
```

성공 `200`:

```json
{
  "success": true,
  "data": { "postId": 1047, "status": "HIDDEN_REVIEW", "lockVersion": 5, "updatedAt": "2026-09-02T05:00:00.000Z" },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `POST_VERSION_CONFLICT` 또는 `POST_STATE_CONFLICT`를 사용하며
권리 메일 원문을 포함하지 않는다.

```json
{
  "success": false,
  "error": { "code": "POST_VERSION_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

즉시 404, pin 해제, 모든 image outbox, purge 실패 재시도, raw mail 비저장을 검증한다. 미실행이다.
