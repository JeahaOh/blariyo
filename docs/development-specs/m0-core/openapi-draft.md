# M0 Core OpenAPI 초안 작성 기준

- 문서 상태: `초안`
- milestone: `M0 Core` (`m0-core`)
- 기준일: 2026-09-03
- 입력 근거: [API 설계](../../system-design/03-api-design.md), [M0 Core 구현 Backlog](./implementation-backlog.md)
- 미검증: schema validator, generated client/server, contract test

이 문서는 M0 Core OpenAPI YAML의 작성 기준이다. 현재 문서 계약용 초안은
[openapi/m0-core.yaml](./openapi/m0-core.yaml)에 둔다. 현재 브랜치에 애플리케이션 source 구조가
없으므로 OpenAPI 파일을 구현 완료 증거처럼 만들지 않는다.

## 1. 파일 배치 제안

실제 애플리케이션 구조가 생기면 아래 중 하나로 둔다.

| 후보 | 장점 | 단점 | 추천 |
| --- | --- | --- | --- |
| `apps/api/openapi/m0-core.yaml` | Core API와 가까움 | Web/BFF same-origin 계약을 함께 보기 애매함 | 보통 |
| `apps/web/openapi/m0-core.yaml` | 외부 BFF 계약과 가까움 | Core 내부 계약과 분리 필요 | 보통 |
| `packages/contracts/openapi/m0-core.yaml` | Web·Core·test가 함께 참조 | 초기 scaffold가 필요함 | 추천 |

초기 구현에서는 `packages/contracts/openapi/m0-core.yaml`을 추천한다. 같은 계약을 BFF, Core contract
test, 문서 검증에서 공유하기 쉽다.

## 2. 공통 components

| component | 내용 | 근거 |
| --- | --- | --- |
| `SuccessEnvelope` | `success=true`, `data`, `meta.requestId` | API 설계 공통 envelope |
| `ErrorEnvelope` | `success=false`, `error.code`, `error.message`, 선택 `fields`, `meta.requestId` | API 설계 오류 원칙 |
| `FieldError` | `field`, `reason` | validation 오류 |
| `PaginationMeta` | `page`, `pageSize`, `totalItems`, `totalPages`, `hasPrevious`, `hasNext` | 목록·관리자 검색 |
| `IdempotencyKeyHeader` | 상태 변경 command 필수 header | 관리자 command |
| `AdminAuthHeaders` | BFF 내부 service token·actor 전달 | 관리자 API |

`fields`는 선택 필드다. 이미지 업로드의 파일별 validation 오류 외에는 무조건 빈 배열을 넣지 않는다.

## 3. paths 초안

| Method | path | operationId | Spec |
| --- | --- | --- | --- |
| `GET` | `/api/v1/boards` | `listBoards` | [list-boards](./public-post-browsing/api/list-boards.md) |
| `GET` | `/api/v1/boards/{boardSlug}/posts` | `listPosts` | [list-posts](./public-post-browsing/api/list-posts.md) |
| `GET` | `/api/v1/boards/{boardSlug}/posts/{postId}` | `getPost` | [get-post](./public-post-browsing/api/get-post.md) |
| `POST` | `/api/v1/boards/{boardSlug}/posts/{postId}/views` | `incrementPostView` | [increment-post-view](./public-post-browsing/api/increment-post-view.md) |
| `GET` | `/api/v1/policies/{type}` | `getPolicy` | [get-policy](./policy-and-rights/api/get-policy.md) |
| `GET` | `/api/v1/admin/posts` | `searchAdminPosts` | [search-posts](./admin-post-management/api/search-posts.md) |
| `GET` | `/api/v1/admin/posts/{postId}` | `getPostEditor` | [get-post-editor](./admin-post-management/api/get-post-editor.md) |
| `POST` | `/api/v1/admin/images` | `uploadImages` | [upload-images](./admin-post-management/api/upload-images.md) |
| `GET` | `/api/v1/admin/images/{imageId}/preview` | `previewImage` | [preview-image](./admin-post-management/api/preview-image.md) |
| `DELETE` | `/api/v1/admin/images/{imageId}` | `discardImage` | [discard-image](./admin-post-management/api/discard-image.md) |
| `POST` | `/api/v1/admin/posts` | `createPost` | [create-post](./admin-post-management/api/create-post.md) |
| `PATCH` | `/api/v1/admin/posts/{postId}` | `updatePost` | [update-post](./admin-post-management/api/update-post.md) |
| `POST` | `/api/v1/admin/posts/{postId}/publish` | `publishPost` | [publish-post](./admin-post-management/api/publish-post.md) |
| `POST` | `/api/v1/admin/posts/{postId}/unschedule` | `unschedulePost` | [unschedule-post](./admin-post-management/api/unschedule-post.md) |
| `POST` | `/api/v1/admin/posts/{postId}/hide` | `hidePost` | [hide-post](./admin-post-management/api/hide-post.md) |
| `POST` | `/api/v1/admin/posts/{postId}/republish` | `republishPost` | [republish-post](./admin-post-management/api/republish-post.md) |
| `DELETE` | `/api/v1/admin/posts/{postId}` | `removePost` | [remove-post](./admin-post-management/api/remove-post.md) |

## 4. 작성 규칙

- `operationId`는 위 표를 유지한다.
- path parameter는 `boardSlug`, `postId`, `imageId`, `type`만 사용한다.
- 관리자 상태 변경 API에는 `Idempotency-Key`를 명시한다.
- 관리자 검색의 유효한 초과 page는 `200` 빈 `items`로 정의한다.
- 공개 목록의 초과 page는 `404 PAGE_NOT_FOUND`로 정의한다.
- 공개 상세의 미존재·비공개·게시판 불일치는 `404 POST_NOT_FOUND`로 일반화한다.
- `M0 수집 보조` endpoint는 이 파일에 넣지 않고 별도 milestone OpenAPI로 분리한다.

## 5. 검증 기준

- OpenAPI schema lint
- example request/response validation
- API Spec 파일의 path·method·status code와 OpenAPI 대조
- BFF route, Core route, contract test operationId 일치
- generated client/server가 공통 envelope를 임의 변경하지 않는지 확인
