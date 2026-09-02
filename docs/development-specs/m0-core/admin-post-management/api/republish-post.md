# 관리자 게시글 재공개 API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 재공개](../../../../system-design/03-api-design.md), [데이터 모델 §7](../../../../system-design/02-data-model.md)
- 미검증: image promote·cache integration test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostCommandService`에 명령해 검토가 끝난 숨김 글을 최초 발행
순서를 유지한 채 다시 공개한다.

## 2. Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/republish`; 관리자 인증; `Idempotency-Key`; no-store.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `postId` | path integer | Y | 양수 | post | 대상 |
| `Idempotency-Key` | header string | Y | opaque | ops | 재전송 key |
| `lockVersion` | body integer | Y | 현재값 | post | 동시성 |
| `pinnedPosition` | body integer/null | Y | null 또는 1~3 | post | 재공개 공지 위치 |

## 4. Response

`200`: `postId,status=PUBLISHED,lockVersion,updatedAt`.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.postId` | integer | Y | path와 동일 | post | 대상 ID |
| `data.status` | enum | Y | `PUBLISHED` | post | 결과 상태 |
| `data.lockVersion` | integer | Y | 이전 값 +1 | post | 새 잠금 버전 |
| `data.updatedAt` | ISO 8601 | Y | UTC | post | 재공개 시각 |

## 5. Validation과 정규화

`HIDDEN_REVIEW`; 모든 참조 image가 `PRIVATE_REVIEW` 또는 새 `STAGED`; public 삭제 대기 없음;
공지 중복 없음이어야 한다.

## 6. 정상 처리와 데이터 전이

private 원본을 결정적 public key로 promote한 뒤 `HIDDEN_REVIEW→PUBLISHED`, image PUBLIC,
`REPUBLISH` 이력·cache purge outbox·idempotency 결과를 commit한다. 최초 `publishedAt`은 유지한다.

## 7. 오류·권한·충돌·부분 실패

image 삭제 중 `409 IMAGE_STATE_CONFLICT`, pin/version/state/idempotency `409`, R2 `503`.

## 8. 멱등성·동시성·재시도

key 재전송과 결정적 object key를 사용한다. DB commit 전 R2 실패면 숨김 상태 유지다.

## 9. Pagination·cache·호환성

목록·상세 purge outbox 생성. 기존 URL과 publishedAt을 유지한다.

## 10. 예시

Request body:

```json
{ "lockVersion": 5, "pinnedPosition": null }
```

성공 `200`:

```json
{
  "success": true,
  "data": { "postId": 1047, "status": "PUBLISHED", "lockVersion": 6, "updatedAt": "2026-09-02T05:00:00.000Z" },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `409`는 공통 오류 envelope와 `IMAGE_STATE_CONFLICT`, `POST_VERSION_CONFLICT` 또는
`PINNED_ORDER_CONFLICT` 중 실제 원인을 사용한다.

```json
{
  "success": false,
  "error": { "code": "IMAGE_STATE_CONFLICT", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

삭제 대기 거부, private 재승격, 최초 publishedAt 유지, pin 경쟁을 검증한다. 미실행이다.
