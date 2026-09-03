# 관리자 이미지 업로드 API Spec

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `admin-post-management`
- 기준일: 2026-09-03
- 입력 근거: [API 설계 §5 이미지 업로드](../../../../system-design/03-api-design.md), [보안·운영 §4 이미지](../../../../system-design/05-security-operations.md)
- 미검증: object storage, decoder, security test

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

먼저 요청 단위 10개·전체 합계 100MiB gate를 검사한다. 초과하면 파일별 validation을 시작하지 않고
`413 UPLOAD_TOO_LARGE`와 `fields` 없는 오류를 반환한다. gate를 통과한 경우에만 storage 전에 모든
파일의 개별 10MiB·선언 MIME→magic byte→decode→40MP·GIF 자원 제한→metadata 제거·안전 형식
재인코딩→SHA-256 검증을 끝까지 완료한다. 하나라도 실패하면 R2 object와 image row를 만들지 않는다.

## 6. 정상 처리와 데이터 전이

모든 validation을 통과한 뒤에만 각 파일의 R2 private object와 `post_id=null,status=STAGED` metadata를
만든다. storage 요청 전체가 성공해야 commit한다. R2·DB 중간 실패 시 생성된 image row는 transaction
rollback하고 이미 저장한 object는 즉시 보상 삭제한다. 즉시 삭제 실패는 rollback과 분리된 cleanup
transaction에서 `OBJECT_DELETE_PRIVATE` outbox로 재시도한다. rollback된 image ID는 참조하지 않고
`aggregate_type=STORAGE_OBJECT`, `aggregate_id=NULL`을 사용하며 payload는 `privateStorageKey`,
`objectCreatedAt`, `cleanupReason=UPLOAD_ROLLBACK`만 포함한다.

private key는 `staging/YYYY/MM/DD/{uploadRequestId}/{fileIndex}-{sha256}.{ext}` 형식이며 서버 생성
고유 `uploadRequestId`를 사용하고 원본 파일명과 관리자 identity를 넣지 않는다. outbox commit 전 process
crash가 나면 매일 inventory가 생성 후 24시간이 지난 `staging/` object를 DB image private key와
미완료(`PENDING`,`RUNNING`,`FAILED`,`DEAD`) cleanup outbox key에 대조해 어느 쪽에도 없는 object만 삭제한다.

## 7. 오류·권한·부분 실패

다중 파일은 all-or-nothing이다. 요청 단위 개수·전체 합계 gate 초과는 `413 UPLOAD_TOO_LARGE`이며
`fields`를 제공하지 않는다. gate를 통과한 요청에서 개별 파일 크기 validation 오류가 하나라도 있으면
top-level `413 UPLOAD_TOO_LARGE`다. 파일 10MiB, 40MP와 GIF decode 자원 제한 초과가 이에 포함된다.
개별 크기 오류 없이 형식·decode validation만 실패하면 `415 UNSUPPORTED_MEDIA_TYPE`이다. `fields[]`에는
실패한 모든 `files[index]`와 일반화된 `reason`을 제공하며, 혼합 `413`에서도 형식 실패 파일을 포함한다.
같은 index·reason은 중복하지 않는다.

R2·DB storage 실패는 `503 DEPENDENCY_UNAVAILABLE`이며 `fields`를 제공하지 않는다. validation 실패는
storage를 시작하지 않으므로 `413`·`415`와 `503`을 혼합하지 않는다. 어떤 오류도 성공 item, object key,
decoder·provider 원문이나 내부 상세를 노출하지 않는다.

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

단일 파일 validation 실패는 `UNSUPPORTED_MEDIA_TYPE` 또는 `UPLOAD_TOO_LARGE`를 사용한다. 아래처럼
형식 오류만 있으면 `415`이며, 크기 오류와 형식 오류가 섞이면 모든 실패 index를 담되 top-level은
`413 UPLOAD_TOO_LARGE`를 사용한다. R2·DB `503` 응답에는 `fields`가 없다.

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "(미정)",
    "fields": [{ "field": "files[1]", "reason": "unsupportedMediaType" }]
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

요청 개수·전체 합계 gate `413` fields 미제공·gate 통과 뒤 storage 전 전체 파일 검증·형식 위장·
pixel bomb·GIF 자원·개별 크기/형식 혼합 `413` 우선·형식만 실패 `415`·모든 실패 index/reason·
validation 실패 storage 0건·R2/DB `503` fields 미제공·
성공 item 미반환·R2/DB rollback과 즉시 보상 삭제·별도 cleanup transaction·rollback image ID 비참조·
24시간 orphan inventory를 검증한다. 현재 실행 증거는 없다.

후속 단계에서 일반 사용자 업로드를 추가할 때도 같은 all-or-nothing·보상 삭제 원칙을 적용한다. 이는
M0 Core 범위에 일반 사용자 업로드 endpoint를 추가한다는 뜻이 아니다.
