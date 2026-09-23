# 운영자 게시글 관리 기능 명세

## 1. 문서 정보와 입력 근거

- 문서 상태: `초안`
- milestone: `M0 Core` (`m0-core`)
- 기능: `admin-post-management` — 검색·이미지·초안·발행·예약·숨김·삭제
- 기준일: 2026-09-07
- 미검증: `/admin` source, 외부 관리자 adapter, migration, OpenAPI, test, R2·outbox·scheduler runtime
- 주요 근거:
  - [서비스 기획 §3~§5, §10, §14](../../../planning/01-service-plan.md)
  - [화면 설계 §2 관리자 게시글 화면](../../../planning/03-screen-design.md)
  - [시스템 아키텍처 §4·§5](../../../system-design/01-system-architecture.md)
  - [데이터 모델 §3·§5·§7·§9](../../../system-design/02-data-model.md)
  - [API 설계 §4·§5·§6](../../../system-design/03-api-design.md)
  - [보안·운영 §3~§5·§12](../../../system-design/05-security-operations.md)

## 2. 목표와 대상 milestone

인증된 운영자가 하루 20~40개의 짤을 같은 편집기에서 작성·예약·발행하고, 권리 문의가 오면 먼저
숨긴 뒤 재공개·수정·최종 제거할 수 있게 한다.

## 3. 행위자와 진입 조건

- 행위자: 외부 관리자 인증 allowlist를 통과한 운영자
- 진입: `/admin`
- 선행: BFF `AdminIdentityProvider`, Core service token·actor, 활성 게시판, R2 private/public 분리
- 외부 인증 장애는 관리자 작업만 중지하며 공개 목록·상세는 유지한다.

## 4. 범위와 범위 밖

범위:

- 상태·게시판·제목 prefix·수정일·page 검색과 편집 상세
- JPEG·PNG·WebP·GIF staging upload·preview·미연결 폐기
- TEXT/IMAGE block 초안 생성·수정, 즉시·예약 발행, 예약 취소
- 공개 글 숨김, 숨김 글 수정·재공개·최종 제거, cache/object outbox
- lockVersion·Idempotency-Key와 상태별 UI 제한

범위 밖:

- 수집 후보·출처 화면/API, 회원·사용자 작성, 광고
- 정책 시행 command, 물리 row 삭제, 권리 문의 form/API
- R2 account·bucket·custom domain 실값 확정과 infrastructure 생성

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| 상태·게시판·제목 prefix 검색 | 확정 | 화면 설계 §2 | `search-posts`, D08 | 반영 |
| TEXT/IMAGE·출처·공지 편집 | 확정 | 화면 설계 §2 | create/update API, D08 | 반영 |
| 즉시·예약·예약 취소 | 확정 | API 설계 §5 | publish/unschedule, D01 | 반영 |
| 기본 예약 슬롯·임의 예약·장애 복구 | 확정 | 인프라 계획 §8, 보안·운영 §12 | publish, D01 | `07:30`·`17:30` KST와 매분 due 처리 반영 |
| 숨김 후 재공개·최종 제거 | 확정 | 서비스 기획 §3 | hide/republish/remove, D01 | 반영 |
| 이미지 검증·private/public 분리 | 확정 | 보안 §4, 아키텍처 §5 | image API, D01 | 반영 |
| multi-file upload validation·object 회수 | 확정 | 데이터 모델 §5, API 설계 §5, 보안·운영 §4 | `upload-images`, D01·D08 | 요청 gate fields 없음·파일별 413 우선순위·503 fields 미제공·cleanup 반영 |
| 관리자 검색의 전체 page 초과 처리 | 확정 | API 설계 §5 | `search-posts` | `200` 빈 items 반영 |
| 관리자 `postId` 형식 오류 처리 | 확정 | API 설계 §5 | `get-post-editor` | `404 POST_NOT_FOUND` 반영 |
| staging 이미지 폐기 `202` 성공 body | 확정 | API 설계 §5 | `discard-image` | 공통 성공 envelope 반영 |
| 실제 R2·관리자 provider 운영값 | 미검증 | infra·보안 정본 | 전체 | 실행 전 확인 |
| 수집·회원·광고 | 범위 밖 | 서비스 기획 §1 | 전체 | 제외 |

## 6. 업무 규칙과 수용 조건

- 새 초안과 기존 글은 같은 편집기를 사용하고 저장되지 않은 변경이 있으면 상태 명령을 막는다.
- 상태 명령은 `lockVersion`과 허용 상태를 모두 확인한다. command는 `Idempotency-Key`가 필요하다.
- `REMOVED`는 terminal이며 물리 삭제하지 않는다. 최종 제거 전 되돌릴 수 없음을 확인한다.
- 숨김 commit 직후 공개 API는 404이고 image 삭제·purge 실패는 outbox로 재시도한다.
- public image 삭제 대기 중에는 재공개·최종 제거와 숨김 글 block 교체를 막는다.
- 기본 예약 슬롯은 `07:30`, `17:30` KST(`Asia/Seoul`)이며 게시글별 임의 미래 시각도 허용한다.
- scheduler는 매분 due 글을 확인하고 장애 중 지난 예약도 복구 후 처리한다. 일시 장애는 첫 실패부터
  알림 후 성공 또는 운영자 취소까지 재시도하며, 영구 업무 오류는 알림 후 자동 재시도하지 않는다.

## 7. 데이터·권한·법무 영향

- 소유 데이터: `content.board_post`, image, block, status history; `ops.outbox_task`, idempotency request.
- BFF만 외부 identity를 검증하고 provider-neutral actor·service token만 Core에 보낸다.
- 이메일 본문·소명 자료·관리자 identity 원문은 DB·application log에 저장하지 않는다.
- 최종 제거 private 원본은 30일 복구 유예 뒤 삭제한다.

## 8. API 작업 목록

- [검색](#api-search-posts), [편집 상세](#api-get-post-editor)
- [이미지 업로드](#api-upload-images), [preview](#api-preview-image), [폐기](#api-discard-image)
- [초안 생성](#api-create-post), [수정](#api-update-post)
- [발행·예약](#api-publish-post), [예약 취소](#api-unschedule-post)
- [숨김](#api-hide-post), [재공개](#api-republish-post), [최종 제거](#api-remove-post)

## 9. 처리 흐름 찾아보기

- [초안 작성과 즉시 발행](#d01-draft-and-publish-post)
- [예약 발행 관리](#d01-schedule-post)
- [권리 문의 게시글 처리](#d01-handle-rights-request)

## 10. 화면·프로그램 찾아보기

- [관리자 게시글 편집기](#d08-admin-post-editor)

## 11. 결정·가정·미정·차단 항목

- 확정된 업로드 validation·전체 실패·보상 삭제·orphan 복구는 [이미지 업로드](#api-upload-images)를 따른다.
- 검색 초과 page는 [검색](#api-search-posts), 상세 오류는 [편집 상세](#api-get-post-editor),
  비동기 이미지 삭제 응답은 [폐기](#api-discard-image)를 따른다.
- 기본 슬롯·임의 시각·scheduler 복구와 재시도는 [예약 발행 관리](#d01-schedule-post)를 따른다.
- 실제 관리자 allowlist·provider 운영 설정과 R2 production 식별값은 `(미정)`이다.
- 새 구현과 검증 범위는 [현재 준비 상태](../../../system-design/README.md#현재-준비-상태)를 따른다. 이 명세 전체의 구현·test·runtime 완료를 뜻하지 않는다.

## 12. 기능 계약 상세

아래 API·처리 흐름·화면 절을 이 파일에서 함께 관리한다. 각 절의 미검증·차단 조건은 유지하며, 문서 통합은 구현 완료를 뜻하지 않는다.

오류 응답에는 storage key·signed URL·권리 메일 원문·최신 본문을 포함하지 않는다.

요청·응답 형식은 [M0 Core OpenAPI](../openapi/m0-core.yaml)를 참조한다. 아래 필드 보충은 데이터 매핑과 업무 제약을 설명하며, 타입·필수 여부를 별도 계약으로 재정의하지 않는다.

<a id="api-create-post"></a>

### 관리자 초안 생성 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 초안 생성](../../../system-design/03-api-design.md), [데이터 모델 §3·§5·§7](../../../system-design/02-data-model.md)
- 미검증: OpenAPI, transaction·idempotency integration test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF의 인증 adapter를 거쳐 Core `PostsService`에 요청하고, Core가 staging
image를 선점해 `DRAFT` 게시글과 순서가 있는 block을 만든다.

#### Method·path·인증·권한

`POST /api/v1/admin/posts`; 관리자 인증; `Idempotency-Key` 필수; `private, no-store`.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `Idempotency-Key`: opaque, 최대 128자 저장; ops; 재전송 key
- `boardSlug`: 활성 작성 대상; board; 게시판
- `title`: trim 1~200자; post; 제목
- `source`: name·HTTPS URL pair; post; 출처
- `source.name`: source가 있으면 필수; post; 표시 출처명
- `source.url`: source가 있으면 필수; post; 원문 URL
- `blocks`: 1~1000, IMAGE 최대 200; block; 본문
- `blocks[].type`: `TEXT`,`IMAGE`; block; 본문 유형
- `blocks[].text`: TEXT, trim 1~20000; block; plain text
- `blocks[].imageId`: 미연결 STAGED; image; 이미지
- `blocks[].alt`: trim 1~300; block; 대체 텍스트
- `pinnedPosition`: null 또는 1~3; post; 공지 후보

#### Response

`201`: 새 `DRAFT`, `lockVersion=1`. 생성 게시글 ID와 공통 meta를 반환한다.

#### Validation과 정규화

TEXT는 HTML·Markdown으로 해석하지 않는다. source name/url 중 하나만 있거나 image 상태·alt가
맞지 않으면 `400 VALIDATION_FAILED` 또는 `409 IMAGE_ALREADY_ATTACHED`다.

#### 정상 처리와 데이터 전이

한 transaction에서 post insert, image 선점, block insert, `NULL→DRAFT/CREATE` 이력,
idempotency 완료 결과를 commit한다. 하나라도 실패하면 전체 rollback한다.

#### 오류·권한·충돌·부분 실패

`401/403`, `400`, `404 BOARD_NOT_FOUND`, `409 IMAGE_ALREADY_ATTACHED`, idempotency 충돌·처리 중,
`503 MAINTENANCE_READ_ONLY/DEPENDENCY_UNAVAILABLE`.

#### 멱등성·동시성·재시도

동일 actor·scope·key·body는 저장 결과를 반환한다. 같은 key 다른 body는 `IDEMPOTENCY_CONFLICT`,
동시 처리 중은 `IDEMPOTENCY_IN_PROGRESS`와 `Retry-After: 1`이다. 결과는 24시간 보존한다.

#### Pagination·cache·호환성

해당 없음. 외부 BFF와 Core 내부 계약을 BFF schema source로 검증한다.

#### Contract test와 미검증

image 선점 경쟁, 전체 rollback, key 재전송·hash 충돌, plain text escape를 검증한다. 미실행이다.

<a id="api-discard-image"></a>

### 관리자 staging 이미지 폐기 API

- 계약 상태: `초안`

- 입력 근거: [API 설계 §5 preview·폐기](../../../system-design/03-api-design.md), [데이터 모델 §5](../../../system-design/02-data-model.md)
- 미검증: outbox·object delete integration test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `ImageCommandService`에 요청해 게시글에 연결되지 않은 staging
image의 private 삭제를 예약한다.

#### Method·path·인증·권한

`DELETE /api/v1/admin/images/:imageId`; 관리자 인증; `private, no-store`.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `imageId`: 양수, 미연결 STAGED; `board_post_image`; 폐기 대상

body·query 없음.

#### Response

`202`: 요청 imageId의 `PRIVATE_DELETE_PENDING`과 requestId를 반환한다. 실제 object 삭제 완료 응답이 아니다.

#### Validation과 정규화

`post_id=null`이며 `STAGED`인 image만 허용한다.

#### 정상 처리와 데이터 전이

한 transaction에서 `STAGED→PRIVATE_DELETE_PENDING`과 `OBJECT_DELETE_PRIVATE` outbox를 기록한다.
실제 private object 삭제는 응답 전에 수행하지 않고 outbox worker가 처리한다.

#### 오류·권한·부분 실패

미존재 `404 IMAGE_NOT_FOUND`; 연결됨·다른 상태·삭제 중 `409 IMAGE_STATE_CONFLICT`; storage 삭제 실패는 outbox 재시도다.

#### 멱등성·동시성·재시도

Idempotency-Key 계약 없음. 상태 조건부 update로 경쟁을 막고 202 후 자동 재호출하지 않는다.

#### Pagination·cache·호환성

해당 없음; `private, no-store`.

#### Contract test와 미검증

초안 선점과 동시 폐기, `202` 성공 envelope, outbox commit, worker 재시도·DEAD를 검증한다.
실행은 미실행이다.

<a id="api-get-post-editor"></a>

### 관리자 게시글 편집 상세 API

- 계약 상태: `초안`

- 입력 근거: [API 설계 §5 초안 편집 상세](../../../system-design/03-api-design.md)
- 미검증: OpenAPI, source, contract test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF의 인증 adapter를 거쳐 Core `PostQueryService`에서 공개 여부와 관계없이 한
게시글의 편집 모델을 조회한다.

#### Method·path·인증·권한

`GET /api/v1/admin/posts/:postId`; 관리자 인증 필수; `private, no-store`.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 편집 글

query·body 없음.

#### Response

게시글·board·block·image의 편집 projection을 반환한다. 현재/과거 소속 slug와 UTC 감사·예약·발행 시각을 포함하며, IMAGE alt는 block, 크기·상태는 image에서 읽는다. previewPath는 인증 BFF 경로다.

#### Validation과 정규화

`postId` 형식 오류·범위 초과, 미존재와 접근 불가는 모두 `404 POST_NOT_FOUND`로 일반화한다.
형식 오류에 별도 `400 VALIDATION_FAILED`를 반환하지 않는다.

#### 정상 처리와 데이터 전이

post·block·image 편집 projection을 읽는다. storage key와 외부 identity는 mapping에서 제거한다.

#### 오류·권한·부분 실패

인증 오류 `401/403`, 미존재 `404`, DB 장애 `503`. 일부 block만 반환하지 않고 전체 오류다.

#### 멱등성·동시성·재시도

멱등 read. 편집 저장에는 받은 `lockVersion`을 사용한다.

#### Pagination·cache·호환성

해당 없음; `private, no-store`.

#### Contract test와 미검증

모든 상태, TEXT/IMAGE mapping, previewPath, storage key 비노출과 path 형식 오류의 동일한 `404`를
검증한다. 실행은 미실행이다.

<a id="api-hide-post"></a>

### 관리자 게시글 숨김 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 숨김](../../../system-design/03-api-design.md), [아키텍처 §5 권리 요청 숨김](../../../system-design/01-system-architecture.md)
- 미검증: public 404·object/CDN purge integration

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostsService`에 명령해 공개 글을 우선 비노출하고 public
image 삭제와 cache purge를 예약한다.

#### Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/hide`; 관리자 인증; `Idempotency-Key`; no-store.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 대상
- `lockVersion`: 현재값; post; 동시성
- `reasonCode`: `RIGHTS_EMAIL`,`EDIT`; history; 사유

#### Response

`200`: `HIDDEN_REVIEW`, 증가한 lockVersion과 UTC updatedAt(숨김 시각). postId는 요청 대상과 같다.

#### Validation과 정규화

현재 `PUBLISHED`; 사유 허용 목록·version을 검증한다. 이메일 본문은 받지 않는다.

#### 정상 처리와 데이터 전이

한 transaction에서 `PUBLISHED→HIDDEN_REVIEW`, pin 해제, image `PUBLIC_DELETE_PENDING`, 상태 이력,
object 삭제·정확한 image URL 및 목록·상세 purge outbox, idempotency 결과를 기록한다.

#### 오류·권한·충돌·부분 실패

commit 직후 공개 API는 404다. 외부 삭제·purge 실패는 공개 상태를 rollback하지 않고 outbox 재시도한다.

#### 멱등성·동시성·재시도

Idempotency-Key 24시간. object 삭제는 멱등이며 URL purge까지 모두 끝나야 `PRIVATE_REVIEW`다.

#### Pagination·cache·호환성

영향 목록·상세·image URL을 정확히 purge하며 오류·404는 no-store다.

#### Contract test와 미검증

즉시 404, pin 해제, 모든 image outbox, purge 실패 재시도, raw mail 비저장을 검증한다. 미실행이다.

<a id="api-preview-image"></a>

### 관리자 staging 이미지 preview API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 preview·폐기](../../../system-design/03-api-design.md)
- 미검증: private object proxy, range·content security test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF·Core `ImageQueryService` proxy를 통해 private staging 이미지를 확인한다.
BFF/Core proxy만 object를 읽고 storage provider URL은 client에 주지 않는다.

#### Method·path·인증·권한

`GET /api/v1/admin/images/:imageId/preview`; 관리자 인증; `Cache-Control: private, no-store`.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `imageId`: 양수; `board_post_image.id`; preview 대상

query·body 없음.

#### Response

검증된 이미지 binary와 image metadata의 안전한 Content-Type을 반환한다. 성공 JSON envelope는 없으며 `private, no-store`다.

#### Validation과 정규화

운영자가 접근할 수 있는 image인지와 [시스템 API의 preview 허용 상태](../../../system-design/03-api-design.md#staging-이미지-preview폐기)를 확인한다. object key 입력은 받지 않는다.

#### 정상 처리와 데이터 전이

private object를 stream한다. DB·object 상태 변화 없음.

#### 오류·권한·부분 실패

`401/403`, `404 IMAGE_NOT_FOUND`, storage 장애 `503`. signed R2 URL·key·내부 오류를 노출하지 않는다.

#### 멱등성·동시성·재시도

멱등 read. 화면은 실패한 image만 오류 처리한다.

#### Pagination·cache·호환성

pagination 없음; browser/CDN cache 금지.

#### Contract test와 미검증

인증, 상태, key 비노출, cache header, 삭제 경쟁을 검증한다. 미실행이다.

<a id="api-publish-post"></a>

### 관리자 게시글 발행·예약 API

- 계약 상태: `작성 완료`

- 입력 근거: [인프라 계획 §8 기본 예약 슬롯](../../../planning/02-infra-plan.md), [API 설계 §5 발행·예약](../../../system-design/03-api-design.md), [아키텍처 §5 이미지·예약](../../../system-design/01-system-architecture.md), [보안·운영 §12 예약 발행 실패](../../../system-design/05-security-operations.md)
- 미검증: R2·DB·outbox·scheduler integration

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostsService`에 명령해 초안을 즉시 공개하거나 미래
발행으로 예약한다. Core만 상태·이미지·이력·outbox를 조정한다.

#### Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/publish`; 관리자 인증; `Idempotency-Key` 필수; no-store.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 대상
- `Idempotency-Key`: opaque; ops; 재전송
- `lockVersion`: 현재값; post; 동시성
- `mode`: `IMMEDIATE`,`SCHEDULED`; API; 방식
- `scheduledAt`: 예약일 때 필수·수신보다 최소 1분 후·offset 필수, 즉시 발행에서는 금지; post; 예약 시각

#### Response

`200`: 즉시는 `PUBLISHED`, 예약은 `SCHEDULED`. 증가한 lockVersion, 최초 publishedAt과 scheduledAt을 반환한다. 즉시 발행 시 발행 시각, 예약 시 정규화한 요청 예약 시각을 사용한다.

#### Validation과 정규화

block·image·source pair와 공지 위치를 검증한다. 같은 게시판의 예약·공개 공지 위치 중복은
`409 PINNED_ORDER_CONFLICT`다.

운영 UI는 `07:30`, `17:30` KST(`Asia/Seoul`)를 기본 슬롯으로 제안하지만 API는 이 두 시각으로
제한하지 않고 조건을 만족하는 게시글별 임의 `scheduledAt`을 받는다. 수신 offset을 보존값으로
해석하지 않고 같은 절대 시각의 UTC로 정규화해 저장한다.

#### 정상 처리와 데이터 전이

- 즉시: private image를 결정적 public key로 copy한 뒤 `DRAFT/SCHEDULED→PUBLISHED`, image PUBLIC,
  status history, cache purge outbox와 idempotency 결과를 transaction commit한다.
- 예약: `DRAFT→SCHEDULED`, `scheduledAt`, history와 idempotency 결과를 commit하며 cache는 바꾸지 않는다.
- scheduler: 매분 `scheduledAt <= now`인 `SCHEDULED` 글을 처리하므로 장애 중 지난 예약도 복구 후
  다음 실행에서 발행 대상이 된다.

#### 오류·권한·충돌·timeout·부분 실패

version/state/pin/image/idempotency 충돌은 각 `409`; 즉시 발행의 R2 장애는 `503`이며 DB 상태를 공개로
바꾸지 않는다. scheduler의 일시 R2·DB·network 실패는 `SCHEDULED`를 유지하고 첫 실패부터 운영
알림을 보낸 뒤 다음 분 실행에서 성공 또는 운영자 취소까지 횟수 제한 없이 재시도한다. 같은 입력으로
성공할 수 없는 공지 위치 충돌은 `DRAFT`로 되돌리고 한 번 알린 뒤 자동 재시도하지 않는다. copy 후
DB 실패 object는 보상 삭제 outbox와 orphan 정리 대상이다. 보상 삭제는 현재 PUBLIC 상태의
동일 key를 지우지 않는다. 게시글별 session advisory lock으로 copy부터 상태 commit·보상 등록까지
직렬화하며, 숨김·최종 제거·image 삭제 worker·public orphan 정리도 같은 잠금을 사용한다.
worker는 잠금 획득 후 작업 lease와 이미지 상태를 다시 확인하여 오래된 작업이 재공개 이미지를
삭제하지 않게 한다. 외부 I/O 동안 SQL transaction은 열어 두지 않는다.

#### 멱등성·동시성·재시도

actor·scope·key 기준 24시간 보존하고 대상 경로 매개변수와 body를 함께 비교한다.
같은 key에 다른 대상 또는 body는 `409 IDEMPOTENCY_CONFLICT`이며 동일 요청만 성공 결과를 재사용한다.
즉시 발행과 scheduler의 외부 copy는 결정적 key로
재실행 가능하고, scheduler의 `status=SCHEDULED`·lockVersion 조건부 update 한 건만 성공한다.

#### Pagination·cache·호환성

해당 없음. 성공 후 영향 목록·상세 URL을 outbox로 purge한다.

#### 예시

기본 오전 슬롯 예약 body 예시는
`{"lockVersion":3,"mode":"SCHEDULED","scheduledAt":"2026-09-03T07:30:00+09:00"}`다. 같은 형식으로
기본 슬롯이 아닌 임의 미래 시각도 요청할 수 있다.
실패 `409`는 공통 오류 envelope와 상태에 맞는 `POST_VERSION_CONFLICT`, `POST_STATE_CONFLICT` 또는
`PINNED_ORDER_CONFLICT`를 사용한다.

#### Contract test와 미검증

즉시·기본 슬롯·임의 예약·SCHEDULED 즉시 전환, 공지 경쟁, R2/DB 실패, idempotency, purge outbox,
매분 due 조회, 장애 복구 후 지난 예약, 실패 알림 묶음, 일시 실패 무제한 재시도와 영구 업무 오류의
자동 재시도 중단을 검증한다. 미실행이다.

<a id="api-remove-post"></a>

### 관리자 게시글 최종 제거 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 삭제](../../../system-design/03-api-design.md), [데이터 모델 §7·§9](../../../system-design/02-data-model.md)
- 미검증: 30일 지연 삭제·outbox integration

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostsService`에 명령해 숨김 검토가 끝난 글을 복구 불가능한
`REMOVED` terminal 상태로 전환한다. row 물리 삭제는 하지 않는다.

#### Method·path·인증·권한

`DELETE /api/v1/admin/posts/:postId`; 관리자 인증; `Idempotency-Key`; no-store.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 대상
- `Idempotency-Key`: opaque; ops; 재전송 key
- `lockVersion`: 현재값; post; 동시성
- `reasonCode`: `REMOVE`; status history; 최종 제거 사유

#### Response

`200`: terminal `REMOVED`, 증가한 lockVersion과 UTC updatedAt(제거 시각). postId는 요청 대상과 같다.

#### Validation과 정규화

`HIDDEN_REVIEW`이고 public image 삭제가 완료되어야 한다. reason은 `REMOVE`만 허용한다.

#### 정상 처리와 데이터 전이

`HIDDEN_REVIEW→REMOVED`, image `PRIVATE_DELETE_PENDING`, 30일 뒤 실행할 private 삭제 outbox,
`REMOVE` 이력과 idempotency 결과를 transaction commit한다.

#### 오류·권한·충돌·부분 실패

상태·version·image·idempotency 충돌 `409`. 외부 삭제 실패는 REMOVED를 되돌리지 않고 재시도한다.

#### 멱등성·동시성·재시도

key 재전송은 기존 결과. terminal 상태에서 다른 명령은 거부한다.

#### Pagination·cache·호환성

물리 row 삭제 endpoint 없음. 공개 404와 URL은 유지한다.

#### Contract test와 미검증

확인 UI 연계, terminal 상태, 30일 예약, raw 사유 비저장, outbox 재시도를 검증한다. 미실행이다.

<a id="api-republish-post"></a>

### 관리자 게시글 재공개 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 재공개](../../../system-design/03-api-design.md), [데이터 모델 §7](../../../system-design/02-data-model.md)
- 미검증: image promote·cache integration test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostsService`에 명령해 검토가 끝난 숨김 글을 최초 발행
순서를 유지한 채 다시 공개한다.

#### Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/republish`; 관리자 인증; `Idempotency-Key`; no-store.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 대상
- `Idempotency-Key`: opaque; ops; 재전송 key
- `lockVersion`: 현재값; post; 동시성
- `pinnedPosition`: null 또는 1~3; post; 재공개 공지 위치

#### Response

`200`: `PUBLISHED`, 증가한 lockVersion과 UTC updatedAt(재공개 시각). postId는 요청 대상과 같다.

#### Validation과 정규화

`HIDDEN_REVIEW`; 모든 참조 image가 `PRIVATE_REVIEW` 또는 새 `STAGED`; public 삭제 대기 없음;
공지 중복 없음이어야 한다.

#### 정상 처리와 데이터 전이

private 원본을 결정적 public key로 promote한 뒤 `HIDDEN_REVIEW→PUBLISHED`, image PUBLIC,
`REPUBLISH` 이력·cache purge outbox·idempotency 결과를 commit한다. 최초 `publishedAt`은 유지한다.

#### 오류·권한·충돌·부분 실패

image 삭제 중 `409 IMAGE_STATE_CONFLICT`, pin/version/state/idempotency `409`, R2 `503`.

#### 멱등성·동시성·재시도

key 재전송과 결정적 object key를 사용한다. DB commit 전 R2 실패면 숨김 상태 유지다.

#### Pagination·cache·호환성

목록·상세 purge outbox 생성. 기존 URL과 publishedAt을 유지한다.

#### Contract test와 미검증

삭제 대기 거부, private 재승격, 최초 publishedAt 유지, pin 경쟁을 검증한다. 미실행이다.

<a id="api-search-posts"></a>

### 관리자 게시글 검색 API

- 계약 상태: `초안`

- 입력 근거: [API 설계 §4·§5 게시글 검색](../../../system-design/03-api-design.md)
- 미검증: OpenAPI, auth adapter, source, contract test

#### 목적과 호출 경계

관리자 BFF가 운영자 identity를 검증한 뒤 Core에서 편집 대상 글을 검색한다.

#### Method·path·인증·권한

- `GET /api/v1/admin/posts`
- 외부 관리자 인증·allowlist 필수; Core 내부 service token·admin actor 필수
- `Cache-Control: private, no-store`

#### Request

**필드 보충 — 제약·데이터 매핑**

- `status`: 단일 게시 상태; post; 상태
- `board`: 게시판 slug; board; 게시판
- `titlePrefix`: trim 1~100자; API; 제목 prefix
- `from`,`to`: UTC, `from<=to`; `updatedAt`; 수정 범위
- `page`: 기본 1, 1~10000; API; page

body: 해당 없음.

#### Response

게시글 검색 projection과 page meta를 반환한다. pageSize는 50이고 updatedAt이 정렬 기준이다. 게시판 slug는 소속 board에서, 상태·version·UTC 예약/발행/수정 시각은 post에서 읽는다.

#### Validation과 정규화

query 형식·상태·날짜·`page` 범위 오류는 `400 VALIDATION_FAILED`. BFF와 Core가 같은 schema를 검증한다.

#### 정상 처리와 데이터 전이

`updatedAt DESC, postId DESC`로 읽는다. 상태 전이 없음.

#### 오류·권한·부분 실패

인증 없음·만료 `401 ADMIN_AUTH_REQUIRED`, allowlist 불일치 `403 ADMIN_FORBIDDEN`, DB 장애 `503`.

#### 멱등성·동시성·재시도

멱등 read. 응답의 `lockVersion`은 표시 후 명령 전 상세에서 다시 확인한다.

#### Pagination·cache·호환성

page size 50 고정, `private, no-store`. `page`가 `1~10000` 범위 안이지만 전체 page를 초과하면
`200`과 빈 `data.items`를 반환한다. 요청한 `meta.page`와 실제 count의 `meta.totalItems`,
`meta.totalPages`를 유지하고 `meta.hasPrevious=page>1`, `meta.hasNext=false`로 계산한다.
공개 목록의 `404 PAGE_NOT_FOUND` 정책은 적용하지 않는다.

#### 예시

잘못된 query는 `400 VALIDATION_FAILED`다.


#### Contract test와 미검증

필터 조합·정렬·인증·응답 allowlist·storage key 비노출과 초과 page의 `200` 빈 결과를 검증한다.
실행은 미실행이다.

<a id="api-unschedule-post"></a>

### 관리자 예약 취소 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 예약 취소](../../../system-design/03-api-design.md)
- 미검증: scheduler 경쟁·idempotency test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostsService`에 명령해 예약 글을 공개 전에 초안으로 되돌린다.

#### Method·path·인증·권한

`POST /api/v1/admin/posts/:postId/unschedule`; 관리자 인증; `Idempotency-Key` 필수; no-store.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 대상
- `Idempotency-Key`: opaque; ops; 재전송 key
- `lockVersion`: 현재값; post; 동시성

#### Response

`200`: `DRAFT`, 증가한 lockVersion, `scheduledAt=null`, UTC updatedAt. postId는 요청 대상과 같다.

#### Validation과 정규화

현재 상태가 `SCHEDULED`이고 version이 일치해야 한다.

#### 정상 처리와 데이터 전이

`SCHEDULED→DRAFT`, 예약 시각 제거, `UNSCHEDULE` 이력과 idempotency 결과를 한 transaction에 기록한다.

#### 오류·권한·충돌·부분 실패

상태·version·idempotency 충돌 `409`, 인증 `401/403`, DB 장애 `503`.

#### 멱등성·동시성·재시도

같은 key·body는 기존 결과. scheduler가 먼저 발행하면 state/version 충돌이며 자동 되돌리지 않는다.

#### Pagination·cache·호환성

해당 없음. 예약은 공개 cache에 없으므로 purge하지 않는다.

#### Contract test와 미검증

due scheduler와 취소 경쟁, key 재전송, 상태 이력을 검증한다. 미실행이다.

<a id="api-update-post"></a>

### 관리자 게시글 수정 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §5 초안 수정](../../../system-design/03-api-design.md), [데이터 모델 §3·§7](../../../system-design/02-data-model.md)
- 미검증: OpenAPI, image replacement·lock integration test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF를 거쳐 Core `PostsService`에서 `DRAFT`, `SCHEDULED`, `HIDDEN_REVIEW`
글의 지정 field를 낙관적 잠금으로 수정한다.

#### Method·path·인증·권한

`PATCH /api/v1/admin/posts/:postId`; 관리자 인증; `private, no-store`. Idempotency-Key 계약 없음.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `postId`: 양수; post; 대상
- `lockVersion`: 현재값; post; 동시성
- `title`: trim 1~200; post; 제목
- `source`: pair/null; post; 유지·교체·제거
- `source.name`: source가 object면 필수; post; 출처명
- `source.url`: source가 object면 필수; post; 원문 URL
- `blocks`: 전체 교체, 1~1000; block; 본문
- `blocks[].type`: `TEXT`,`IMAGE`; block; 본문 유형
- `blocks[].text`: TEXT, trim 1~20000; block; plain text
- `blocks[].imageId`: IMAGE, 선점 가능 자산; image; 이미지
- `blocks[].alt`: IMAGE, trim 1~300; block; 대체 텍스트
- `pinnedPosition`: 1~3/null; post; 공지

#### Response

`200`: 수정 전 상태를 유지하고 lockVersion을 1 증가시킨다. postId는 요청 대상이며 updatedAt은 UTC 수정 시각이다.

#### Validation과 정규화

생략 field는 유지. 빈 blocks는 `400`. `HIDDEN_REVIEW`는 공지를 지정할 수 없고 public image 삭제
대기 중 block 변경을 거부한다.

#### 정상 처리와 데이터 전이

post field·전체 block 교체·새 STAGED image 선점·빠진 image 상태 처리를 한 transaction에서 수행하고
`EDIT` 이력을 기록한다. `SCHEDULED` 수정은 예약 시각을 유지하고 공개 검증을 다시 한다.

#### 오류·권한·충돌·부분 실패

상태 `409 POST_STATE_CONFLICT`, version `409 POST_VERSION_CONFLICT`, image `409 IMAGE_STATE_CONFLICT/
IMAGE_ALREADY_ATTACHED`, validation `400`.

#### 멱등성·동시성·재시도

lockVersion 조건부 update다. 충돌 후 최신 상세를 다시 읽고 운영자가 변경을 병합한다. 자동 재전송 금지.

#### Pagination·cache·호환성

해당 없음; admin no-store.

#### Contract test와 미검증

partial field, block 전체 교체, 숨김 image 대기, 동시 수정, transaction rollback을 검증한다. 미실행이다.

<a id="api-upload-images"></a>

### 관리자 이미지 업로드 API

- 계약 상태: `초안`

- 입력 근거: [API 설계 §5 이미지 업로드](../../../system-design/03-api-design.md), [보안·운영 §4 이미지](../../../system-design/05-security-operations.md)
- 미검증: object storage, decoder, security test

#### 목적과 호출 경계

관리자 화면이 Nuxt BFF의 인증·multipart 제한을 거쳐 Core `ImageCommandService`에 파일을 전달한다.
Core는 검증·재인코딩해 private 원본으로 저장하고 미연결 `STAGED` image를 만든다.

#### Method·path·인증·권한

`POST /api/v1/admin/images`; 관리자 인증; `multipart/form-data`; `private, no-store`.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `files`: 1~10개, 각 10MiB, 요청 100MiB; API·보안; 이미지

JPEG·PNG·WebP·GIF만 허용. SVG·HTML·동영상·압축파일 금지.

#### Response

성공 image는 `STAGED`다. mimeType·크기는 안전 재인코딩 결과이고 byteSize는 저장 object metadata다. 40MP 이하의 크기와 인증 previewPath를 반환하며 storage key·signed URL은 노출하지 않는다.

#### Validation과 정규화

먼저 요청 단위 10개·전체 합계 100MiB gate를 검사한다. 초과하면 파일별 validation을 시작하지 않고
`413 UPLOAD_TOO_LARGE`와 `fields` 없는 오류를 반환한다. gate를 통과한 경우에만 storage 전에 모든
파일의 개별 10MiB·선언 MIME→magic byte→decode→40MP·GIF 자원 제한→metadata 제거·안전 형식
재인코딩→SHA-256 검증을 끝까지 완료한다. 하나라도 실패하면 R2 object와 image row를 만들지 않는다.

#### 정상 처리와 데이터 전이

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

#### 오류·권한·부분 실패

다중 파일은 all-or-nothing이다. 요청 단위 개수·전체 합계 gate 초과는 `413 UPLOAD_TOO_LARGE`이며
`fields`를 제공하지 않는다. gate를 통과한 요청에서 개별 파일 크기 validation 오류가 하나라도 있으면
top-level `413 UPLOAD_TOO_LARGE`다. 파일 10MiB, 40MP와 GIF decode 자원 제한 초과가 이에 포함된다.
개별 크기 오류 없이 형식·decode validation만 실패하면 `415 UNSUPPORTED_MEDIA_TYPE`이다. `fields[]`에는
실패한 모든 `files[index]`와 일반화된 `reason`을 제공하며, 혼합 `413`에서도 형식 실패 파일을 포함한다.
같은 index·reason은 중복하지 않는다.

R2·DB storage 실패는 `503 DEPENDENCY_UNAVAILABLE`이며 `fields`를 제공하지 않는다. validation 실패는
storage를 시작하지 않으므로 `413`·`415`와 `503`을 혼합하지 않는다. 어떤 오류도 성공 item, object key,
decoder·provider 원문이나 내부 상세를 노출하지 않는다.

#### 멱등성·동시성·재시도

Idempotency-Key 계약 없음. 자동 재시도는 중복 staging을 만들 수 있어 금지하고 운영자가 결과 확인 후 재시도한다.

#### Pagination·cache·호환성

해당 없음; 응답과 preview는 `private, no-store`.

#### Contract test와 미검증

요청 개수·전체 합계 gate `413` fields 미제공·gate 통과 뒤 storage 전 전체 파일 검증·형식 위장·
pixel bomb·GIF 자원·개별 크기/형식 혼합 `413` 우선·형식만 실패 `415`·모든 실패 index/reason·
validation 실패 storage 0건·R2/DB `503` fields 미제공·
성공 item 미반환·R2/DB rollback과 즉시 보상 삭제·별도 cleanup transaction·rollback image ID 비참조·
24시간 orphan inventory를 검증한다. 현재 실행 증거는 없다.

후속 단계에서 일반 사용자 업로드를 추가할 때도 같은 all-or-nothing·보상 삭제 원칙을 적용한다. 이는
M0 Core 범위에 일반 사용자 업로드 endpoint를 추가한다는 뜻이 아니다.

<a id="d01-draft-and-publish-post"></a>

### 초안 작성과 즉시 발행

- 계약 상태: `초안`

- 입력 근거: [아키텍처 §5 이미지 등록과 발행](../../../system-design/01-system-architecture.md), [관리 API 목록](#8-api-작업-목록)
- 미검증: UI·R2·DB·outbox runtime

#### 프로세스 목적과 범위

운영자가 이미지를 staging하고 TEXT/IMAGE block 초안을 저장한 뒤 즉시 공개한다.

#### 행위자·시작·선행 조건

인증된 운영자가 `/admin` 새 글 편집기를 열며 활성 게시판과 R2·DB 쓰기가 가능해야 한다.

#### 정상 흐름

1. 운영자는 필요 이미지를 업로드하고 각 preview를 확인한다.
2. 제목·본문 block·alt·출처·공지 위치를 입력한다.
3. client가 새 Idempotency-Key로 초안 생성 API를 호출한다.
4. Core가 image를 선점하고 `DRAFT`·block·상태 이력을 한 transaction에 저장한다.
5. 운영자가 저장 결과와 lockVersion을 확인하고 `즉시 발행`을 선택한다.
6. client가 새 key와 현재 version으로 발행 API를 호출한다.
7. Core가 image를 public으로 promote하고 글·image·이력·purge outbox를 commit한다.
8. 화면은 `PUBLISHED`와 갱신 version을 표시하고 공개 상세 link를 제공한다.

#### 대안·실패 흐름

- upload 실패: [이미지 업로드 API](#api-upload-images)의 gate·파일 validation·dependency 오류를 구분한다.
  화면은 gate·dependency 오류에 파일별 오류를 만들지 않고, 파일 validation 오류에만 모든 실패 index를 표시한다.
  실패 요청의 성공 파일을 preview나 초안 생성에 사용하지 않는다. rollback·보상 삭제·orphan 복구는 해당 API 계약을 따른다.
- image 선점·version 충돌: 최신 편집 상세를 다시 읽고 운영자가 병합한다.
- R2 실패: 글은 DRAFT에 남고 공개 성공으로 표시하지 않는다.
- purge 실패: 발행 성공을 유지하고 운영 상태로 재시도한다.

#### 단계별 API 매핑

1 [upload](#api-upload-images)·[preview](#api-preview-image), 3~4 [create](#api-create-post),
6~7 [publish](#api-publish-post), 미사용 image는 [discard](#api-discard-image).

#### 데이터·상태 전이

`STAGED` image → `DRAFT`에 연결 → `PUBLIC`; post `없음→DRAFT→PUBLISHED`.

#### 권한·트랜잭션·멱등성·재시도

관리자 인증 필수. 초안·발행은 각각 key를 사용하고 domain 변경·history·outbox와 함께 commit한다.

#### 완료 조건과 수용 기준

공개 API에서 본문·이미지·alt·출처가 보이고 관리자 상태·version이 PUBLISHED와 일치해야 한다.

#### 미정·차단·미검증

upload all-or-nothing·storage 전 전체 validation·오류 우선순위·즉시 보상 삭제·별도 cleanup
transaction·24시간 orphan inventory 계약은 확정됐다. 실제 공개·cache·object·보상 삭제·inventory
실행 증거는 없다.

<a id="d01-handle-rights-request"></a>

### 권리 문의 게시글 처리

- 계약 상태: `차단`

- 입력 근거: [권리자 안내 §3~§5](../../../legal/rights-request.md), [보안·운영 §12](../../../system-design/05-security-operations.md)
- 미검증: 실제 접수 이메일·수령인, 법률 검토, 운영·outbox runtime

#### 프로세스 목적과 범위

권리 문의 이메일을 확인한 운영자가 자료 완전성 판단 전 게시글을 먼저 숨기고 최종 조치를 결정한다.

#### 행위자·시작·선행 조건

행위자는 확정 접수 채널을 관리하는 운영자다. 접수 이메일·수령인·회신 채널은 출시 전 확정이 필요하다.

#### 정상 흐름

1. 운영자가 메일에서 대상 공개 URL을 확인한다.
2. `/admin`에서 게시글과 현재 상태를 찾는다.
3. `RIGHTS_EMAIL`로 숨김 명령을 실행한다.
4. 공개 상세 404·목록 제거·모든 image/cache purge 상태를 확인한다.
5. 요청자에게 접수·비노출을 회신하고 필요한 보완을 받는다.
6. 운영·법률 판단에 따라 수정 후 재공개, 재공개, 비노출 유지 또는 최종 제거를 선택한다.
7. 결과를 당사자에게 회신한다.

#### 대안·실패 흐름

- 자료 부족: 숨김 유지, 보완 요청.
- public image 삭제·해당 이미지 URL purge 실패: 공개 API 404 유지, `PUBLIC_DELETE_PENDING` 해소 전 재공개·삭제 금지. 목록·HTML cache purge 재시도만 남은 경우는 이미지 상태 조건으로 판단한다.
- 법정 재개 절차 적용: 일반 흐름 대신 승인된 법률 절차와 기한을 따른다.

#### 단계별 API 매핑

검색 [search](#api-search-posts), 숨김 [hide](#api-hide-post), 수정 [update](#api-update-post),
재공개 [republish](#api-republish-post), 제거 [remove](#api-remove-post). 이메일 송수신 API는 해당 없음.

#### 데이터·상태 전이

`PUBLISHED→HIDDEN_REVIEW→PUBLISHED|REMOVED`. 메일 본문·소명 자료는 application DB·log에 복사하지 않는다.

#### 권한·트랜잭션·멱등성·재시도

관리자 인증·key·version 필수. outbox는 최대 8회 후 DEAD 알림이며 자동으로 공개 상태를 되돌리지 않는다.

#### 완료 조건과 수용 기준

접수 직후 비노출과 최종 상태·회신이 확인되고 raw 요청이 application log/DB에 없어야 한다.

#### 미정·차단·미검증

`[출시 차단: 권리자 요청 수령인·이메일·시행일 입력 필요]`; 법률 검토와 실제 운영은 미검증이다.

<a id="d01-schedule-post"></a>

### 예약 발행 관리

- 계약 상태: `작성 완료`

- 입력 근거: [인프라 계획 §8](../../../planning/02-infra-plan.md), [아키텍처 §5 예약 발행](../../../system-design/01-system-architecture.md), [보안·운영 §12 예약 발행 실패](../../../system-design/05-security-operations.md), [발행 API](#api-publish-post)
- 미검증: cron·scheduler·R2·outbox runtime

#### 프로세스 목적과 범위

초안을 미래 시각으로 예약하고 필요하면 취소하며, due scheduler가 장애 중 지난 예약을 포함해 한 번만 공개한다.

#### 행위자·시작·선행 조건

운영자는 저장된 DRAFT와 현재 version을 가진다. 기본 운영 슬롯은 `07:30`, `17:30`
KST(`Asia/Seoul`)지만 게시글별 임의 미래 시각도 허용한다. scheduler는 매분 실행된다.

#### 정상 흐름

1. 운영자가 기본 슬롯 또는 수신 시각보다 최소 1분 뒤인 임의 시각을 선택한다.
2. 발행 API `mode=SCHEDULED`를 호출해 `DRAFT→SCHEDULED`로 바꾼다.
3. 매분 scheduler가 `scheduledAt <= now`인 due candidate를 선택한다. 장애 중 지난 예약도 복구 후
   다음 실행에서 같은 기준으로 선택하고 private image를 결정적 public key로 copy한다.
4. `status=SCHEDULED`와 lockVersion 조건부 transaction 한 건만 `PUBLISHED`로 바꾼다.
5. history·cache purge outbox를 commit하고 worker가 purge한다.

#### 대안·실패 흐름

- 취소: 실제 발행 전 `SCHEDULED`이면 예약 취소 API로 `SCHEDULED→DRAFT`. 예정 시각이 지났어도 미발행이면 취소할 수 있다.
- 일시 R2·DB·network 실패: `SCHEDULED` 유지, 첫 실패부터 운영 알림, 다음 분 실행에서 재시도.
  같은 게시글·오류의 반복 알림은 묶고, 성공하거나 운영자가 취소할 때까지 자동 재시도 횟수를
  제한하지 않는다.
- 조건부 update 실패: 다른 worker가 처리한 것으로 보고 DB 변경 없이 종료.
- 공지 제약 예외: 같은 입력으로 성공할 수 없는 영구 업무 오류이므로 `DRAFT`로 되돌리고
  `PINNED_ORDER_CONFLICT`를 한 번 운영 알림한 뒤 자동 재시도하지 않는다.

#### 단계별 API 매핑

운영자 예약·즉시 전환은 [publish](#api-publish-post), 취소는 [unschedule](#api-unschedule-post).
Scheduler는 HTTP API가 아니라 같은 service/repository를 쓰는 `posts:publish-due` command다.

#### 데이터·상태 전이

`DRAFT→SCHEDULED→PUBLISHED` 또는 `SCHEDULED→DRAFT`. image는 실제 공개 성공 때 PUBLIC이다.

#### 권한·트랜잭션·멱등성·재시도

운영자 command는 key·version, scheduler는 system actor·조건부 update를 사용한다. R2 copy는 결정적
key다. 일시 장애는 `SCHEDULED` 상태를 재시도 표지로 사용하고 별도 시도 횟수로 발행을 포기하지 않는다.

#### 완료 조건과 수용 기준

기본 슬롯·임의 예약 모두 예약 전 비공개, due 후 1회 공개, 취소 시 비공개, 장애 복구 후 지난 예약
발행, 일시 실패 알림·재시도, 영구 업무 오류의 `DRAFT` 전환·재시도 중단을 확인해야 한다.

#### 미정·차단·미검증

기본 슬롯은 `07:30`, `17:30` KST로 확정됐고 per-post 임의 예약도 허용한다. cron·scheduler·알림·
R2·DB·outbox runtime은 미검증이다.

<a id="d08-admin-post-editor"></a>

### 관리자 게시글 편집기

- 계약 상태: `초안`

- 입력 근거: [화면 설계 §2 관리자 게시글 화면](../../../planning/03-screen-design.md), [관리 API 목록](#8-api-작업-목록)
- 미검증: publishing 산출물 없음, 실제 UI·browser·accessibility test

#### 목적·route·milestone

`/admin`에서 게시글 검색 목록과 같은 편집기로 새 글·기존 글의 콘텐츠와 상태를 관리한다.

#### 진입·이탈·권한 조건

외부 관리자 인증·allowlist 필수. 미인증은 provider 로그인, 불허는 접근 거부. 저장하지 않은 변경이
있으면 이동·선택·상태 명령 전에 경고한다. 관리자 화면은 검색 노출·CDN cache 금지다.

#### UI 영역과 구성요소

- 검색: 상태, 게시판, 제목 prefix, 수정일, page
- 결과: 제목·상태·게시판·수정일·lockVersion
- 편집: 제목, source pair, TEXT/IMAGE block 추가·제거·순서, alt, 공지 위치
- 이미지: upload, 인증 preview, 미사용 폐기
- 상태 action: 저장, 즉시 발행, 예약, 예약 취소, 숨김, 재공개, 최종 제거
- 예약: `07:30`, `17:30` KST(`Asia/Seoul`) 기본 슬롯과 게시글별 임의 미래 시각 입력
- desktop 좌측 목록/우측 편집; mobile 상하 배치

#### 필드·표시값·validation

제목 1~200, block 1~1000, IMAGE 최대 200, TEXT 1~20000, alt 1~300, source는 name·HTTPS URL pair,
image file 10MiB·요청 10개/100MiB. 오류는 field 가까이에 표시한다.

#### 이벤트·버튼·이동·후처리

- 검색·글 선택: 목록/상세 API.
- 이미지 선택: upload 요청 전체가 성공한 뒤에만 모든 preview를 표시한다. 하나라도 실패하면 성공한
  파일도 표시하지 않는다. 파일 개수·전체 합계 gate의 `413`은 `fields` 없이 요청 단위 제한으로
  안내한다. gate 통과 뒤 파일별 `413`·`415` validation 응답은 `fields[]`의 모든 실패 index와 일반화
  reason을 해당 파일 가까이에 표시한다. 크기·형식이 섞인 `413`에서도 형식 오류 파일을 빠뜨리지 않는다.
  R2·DB `503`은 특정 파일 오류로 표시하지 않고 요청 단위 장애와 전체 재시도를 안내한다. 제거는 block과
  asset 상태를 구분한다.
- 저장: 새 글 create, 기존 글 patch 후 version 갱신.
- 상태 action: 저장되지 않은 변경이 없고 현재 상태에 허용된 버튼만 활성.
- 예약: 기본 슬롯을 바로 선택하거나 offset이 포함된 임의 미래 시각을 입력한다. 기본 슬롯 외 시각도
  허용하며 API 응답의 UTC 정규화 시각을 현재 예약 상태에 반영한다.
- 최종 제거: `REMOVED`가 되돌릴 수 없음을 명시한 확인창 후 실행.

#### 화면 상태

- loading: 검색/편집/image 영역별 표시.
- REMOVED는 읽기 전용이다. private 삭제 중·삭제 완료 이미지의 previewPath=null은 이미지 없음으로 표시하고 preview를 요청하지 않는다.
- empty: 검색 결과 없음 또는 새 초안 안내.
- error: field validation, version conflict, dependency 장애를 구분해 복구 동작 제공.
- 권한 없음: 콘텐츠·관리자 identity 상세 없이 접근 거부.
- 부분 실패: public image 삭제 중에는 재공개·최종 제거·해당 block 교체 비활성, 새로고침 안내.

#### 반응형과 접근성

label·오류 연결, block 순서 키보드 조작 대안, dialog focus trap/return, 상태를 색만으로 구분하지 않기,
44px touch target을 적용한다.

#### 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| 검색·선택 | 공통 편집 진입 | [search](#api-search-posts), [detail](#api-get-post-editor) |
| upload·폐기 | [초안 발행](#d01-draft-and-publish-post) | [upload](#api-upload-images), [preview](#api-preview-image), [discard](#api-discard-image) |
| 저장·발행 | [초안 발행](#d01-draft-and-publish-post) | [create](#api-create-post), [update](#api-update-post), [publish](#api-publish-post) |
| 예약·취소 | [예약 관리](#d01-schedule-post) | [publish](#api-publish-post), [unschedule](#api-unschedule-post) |
| 숨김·재공개·제거 | [권리 처리](#d01-handle-rights-request) | [hide](#api-hide-post), [republish](#api-republish-post), [remove](#api-remove-post) |

#### 메시지와 사용자 피드백

충돌 문구는 [화면 설계의 관리자 안내](../../../planning/03-screen-design.md#관리자-게시글-화면)를 따른다. 최신 내용을 재조회한 뒤 운영자가 병합하며 입력을 자동 덮어쓰지 않는다.
내부 provider·SQL·object key·메일 내용은 표시하지 않는다.

#### 화면 수용 조건

상태별 허용 action, dirty guard, version conflict 복구, image 대기 제한, 최종 제거 확인과 desktop/mobile
배치가 planning 계약과 일치해야 한다.

#### 미정·차단·미검증

upload 실패 UX는 all-or-nothing, 요청 단위 gate `413`의 `fields` 없음, 파일별 `413`·`415`의 모든
실패 파일 표시, `503`의 파일 표시 없음으로 확정됐다. 관리자 화면 publishing과 실제 UI·browser 증거가
없어 `초안`이다.


수집 초안의 원문 보존을 위해 게시글 편집 IMAGE 블록 상한은 200개다. 일반 업로드 요청의 10개/100MiB·파일당 10MiB 제한은 유지한다. direct batch 미디어 용량은 [수집 명세](../../m0-collection-assist/collection-assist/collection-assist.dev.md#2026-09-23-다중-이미지와-수집-용량-계약)를 따른다.
