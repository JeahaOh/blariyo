# 관리자 이미지 업로드 API Spec

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §5 이미지 업로드](../../../../system-design/03-api-design.md), [보안·운영 §4 이미지](../../../../system-design/05-security-operations.md)
- 미검증: 일부 실패 계약, object storage, decoder, security test

## 1. 목적과 호출 경계

관리자 화면이 Nuxt BFF의 인증·multipart 제한을 거쳐 Core `ImageCommandService`에 파일을 전달한다.
Core는 검증·재인코딩해 private 원본으로 저장하고 미연결 `STAGED` image를 만든다.

## 2. Method·path·인증·권한

`POST /api/v1/admin/images`; 관리자 인증; `multipart/form-data`; `private, no-store`.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `files` | multipart files | Y | 1~10개, 각 10MiB, 요청 100MiB | API·보안 | 이미지 |

JPEG·PNG·WebP·GIF만 허용. SVG·HTML·동영상·압축파일 금지.

## 4. Response

성공 item은 `imageId,status=STAGED,mimeType,byteSize,width,height,previewPath`. storage key와 signed URL은 없다.
성공·오류 envelope는 [API 설계 §2](../../../../system-design/03-api-design.md)를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.items[].imageId` | integer | Y | 양수 | image | staging ID |
| `data.items[].status` | enum | Y | `STAGED` | image | 자산 상태 |
| `data.items[].mimeType` | string | Y | 안전 재인코딩 결과 | decoder | MIME |
| `data.items[].byteSize` | integer | Y | 0 초과 | object metadata | byte 크기 |
| `data.items[].width`,`height` | integer | Y | 양수, 40MP 이하 | decoder | 픽셀 크기 |
| `data.items[].previewPath` | path | Y | 인증 preview route | BFF | 편집기 미리보기 |

## 5. Validation과 정규화

선언 MIME→magic byte→decode→40MP·GIF 자원 제한→metadata 제거·안전 형식 재인코딩→SHA-256 순서다.

## 6. 정상 처리와 데이터 전이

R2 private 저장 후 `post_id=null,status=STAGED` metadata를 만든다. DB 실패 object는 orphan 정리 대상으로 남긴다.

## 7. 오류·권한·부분 실패

크기 `413 UPLOAD_TOO_LARGE`, 형식 `415 UNSUPPORTED_MEDIA_TYPE`, R2 `503 DEPENDENCY_UNAVAILABLE`.
여러 파일 중 일부가 실패할 때 전체 실패인지 유효 파일만 성공인지 상위 계약에 없어 `(결정 필요)`다.

## 8. 멱등성·동시성·재시도

Idempotency-Key 계약 없음. 자동 재시도는 중복 staging을 만들 수 있어 금지하고 운영자가 결과 확인 후 재시도한다.

## 9. Pagination·cache·호환성

해당 없음; 응답과 preview는 `private, no-store`.

## 10. 예시

Request:

```http
POST /api/v1/admin/images
Content-Type: multipart/form-data; boundary=...

files=<safe-image.png>
```

단일 파일 성공 `200`:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "imageId": 501,
        "status": "STAGED",
        "mimeType": "image/webp",
        "byteSize": 248132,
        "width": 1200,
        "height": 900,
        "previewPath": "/api/v1/admin/images/501/preview"
      }
    ]
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

단일 파일 실패는 공통 오류 envelope와 `UNSUPPORTED_MEDIA_TYPE` 또는 `UPLOAD_TOO_LARGE`를 사용한다.
다중 파일 혼합 성공·실패 예시는 부분 실패 계약 확정 전 만들지 않는다.

```json
{
  "success": false,
  "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

형식 위장·pixel bomb·GIF 자원·10/11개·100MiB·R2/DB 보상과 결정된 부분 실패 동작을 검증한다.
