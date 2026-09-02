# 관리자 staging 이미지 preview API Spec

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 preview·폐기](../../../../system-design/03-api-design.md)
- 미검증: private object proxy, range·content security test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF·Core `ImageQueryService` proxy를 통해 private staging 이미지를 확인한다.
BFF/Core proxy만 object를 읽고 storage provider URL은 client에 주지 않는다.

## 2. Method·path·인증·권한

`GET /api/v1/admin/images/:imageId/preview`; 관리자 인증; `Cache-Control: private, no-store`.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `imageId` | path integer | Y | 양수 | `board_post_image.id` | preview 대상 |

query·body 없음.

## 4. Response

검증된 이미지 binary stream과 안전한 `Content-Type`. JSON envelope 해당 없음.

| 항목 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| response body | binary | Y | 검증된 이미지 bytes | private object | 미리보기 |
| `Content-Type` | header | Y | 허용 이미지 MIME | image metadata | browser 해석 |
| `Cache-Control` | header | Y | `private, no-store` | API 계약 | 저장 금지 |

## 5. Validation과 정규화

운영자가 접근할 수 있는 image와 preview 가능 상태를 확인한다. object key 입력은 받지 않는다.

## 6. 정상 처리와 데이터 전이

private object를 stream한다. DB·object 상태 변화 없음.

## 7. 오류·권한·부분 실패

`401/403`, `404 IMAGE_NOT_FOUND`, storage 장애 `503`. signed R2 URL·key·내부 오류를 노출하지 않는다.

## 8. 멱등성·동시성·재시도

멱등 read. 화면은 실패한 image만 오류 처리한다.

## 9. Pagination·cache·호환성

pagination 없음; browser/CDN cache 금지.

## 10. 예시

Request와 성공 응답:

```http
GET /api/v1/admin/images/501/preview

HTTP/1.1 200 OK
Content-Type: image/webp
Cache-Control: private, no-store

<binary image bytes>
```

실패 `404`는 JSON 공통 오류 envelope와 `IMAGE_NOT_FOUND`를 사용하며 signed URL·object key를 넣지 않는다.

```json
{
  "success": false,
  "error": { "code": "IMAGE_NOT_FOUND", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

인증, 상태, key 비노출, cache header, 삭제 경쟁을 검증한다. 미실행이다.
