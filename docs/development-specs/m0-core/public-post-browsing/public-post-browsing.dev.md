# 공개 게시글 탐색 기능 명세

## 1. 문서 정보와 입력 근거

- 문서 상태: `작성 완료`
- milestone: `M0 Core` (`m0-core`)
- 기능: `public-post-browsing` — 공개 게시판 목록·상세·공유·조회 수
- 최초 계약: 2026-09-07 / 소스·문서 대조: 2026-09-24
- 구현: Nuxt·BFF·Core·migration·OpenAPI와 관련 시험이 존재한다. 실행 결과는 [현재 상태](../../../status.md)와 연결된 날짜별 증거를 따른다. 이번 문서 대조에서 앱·서버를 재실행하지 않았다.
- 잔여: §13의 소스 차이, 실제 공유 provider·접근성·운영 인수. 정적 계약 작성 완료와 전체 수용 조건 통과를 구분한다.
- 주요 근거:
  - [서비스 기획 §1, §2, §5, §7, §10, §14](../../../planning/01-service-plan.md)
  - [화면 설계 §2, §5~§7, §13](../../../planning/03-screen-design.md)
  - [분석·광고 계획 §1~§4, §12](../../../planning/04-analytics-ad-plan.md)
  - [시스템 아키텍처 §4~§6](../../../system-design/01-system-architecture.md)
  - [데이터 모델 §3, §7~§9](../../../system-design/02-data-model.md)
  - [API 설계 §1~§3, §6~§9](../../../system-design/03-api-design.md)
  - [반응형 퍼블리싱 프로토타입](../../../ui/publishing/responsive/README.md)

## 2. 목표와 대상 milestone

비로그인 이용자가 `/meme`의 최신 게시글을 페이지 단위로 탐색하고, 게시글 상세·같은 게시판의
하단 목록·공유 기능을 연속해서 이용하게 한다. 초기 게시판은 `meme` 한 개지만 공개 조회 계약은
활성 게시판 데이터와 `boardSlug`를 기준으로 확장 가능해야 한다.

## 3. 행위자와 진입 조건

- 행위자: 인증하지 않은 공개 이용자
- 진입: `/` 또는 `/meme`, 공유받은 `/:boardSlug/posts/:postId`
- 선행 조건: 활성 게시판과 공개 상태 게시글. 공개 조건은 `PUBLISHED`이고 `publishedAt <= now`다.
- `/`는 별도 페이지가 아니라 `/meme`으로 리다이렉트한다.

## 4. 범위와 범위 밖

범위:

- 활성 게시판 조회, `meme` 목록, 상세와 하단 목록 context
- 고정 공지 0~3건과 일반 글 20건 분리, 번호 페이지네이션
- 상세 최초 정상 표시 뒤 참고용 조회 수 1 증가
- 링크 복사·브라우저 공유·카카오톡·X 공유와 SSR canonical·OG
- loading·empty·error·404·공유 provider 부분 실패

범위 밖:

- M0 수집 보조·자동 수집, M1 회원, 사용자 작성, 광고 슬롯
- 이전 글·다음 글, 무한 스크롤, 게시판 문맥 없는 `/posts/:postId`
- 방문자 중복 제거, 자체 이용 이벤트 API·원시 이벤트 저장
- health endpoint는 공통 운영 계약이며 화면 기능 Spec 대상이 아니다.

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| `/`를 `/meme`으로 이동 | 확정 | 서비스 기획 §2 | D01 `browse-posts`, D08 `meme-list` | 반영 |
| 확장 가능한 게시판 구조와 `meme` 초기 데이터 | 확정 | 서비스 기획 §14, 데이터 모델 §3·§10 | `list-boards`, D01 `browse-posts`, migration contract test | 반영 |
| 공지 0~3건과 일반 글 20건 분리 | 확정 | 서비스 기획 §5 | `list-posts`, D08 `meme-list` | 반영 |
| 같은 게시판 상세와 하단 20건 | 확정 | 화면 설계 §6 | `get-post`, D01·D08 `view-post` | 반영 |
| 숨김·삭제·예약·초안을 같은 404로 처리 | 확정 | API 설계 §3 | `get-post`, D08 `post-detail` | 반영 |
| 정상 상세 표시 뒤 조회 수 1 증가, 실패는 비차단 | 확정 | 분석 계획 §3 | `increment-post-view`, D01 `view-post` | 반영 |
| 공유 popup/sheet와 provider fallback | 확정 | 화면 설계 §7 | D01 `share-post`, D08 `post-detail` | 반영 |
| 상세 SSR canonical·OG·Twitter metadata와 404 `noindex` | 확정 | 화면 설계 §7, 퍼블리싱 SSR 계약 | D01 `view-post`, D08 `post-detail`, SSR integration test | 반영 |
| payload 오류 code 이름 | 확정 | API 설계 §3·§6 | `increment-post-view` | `VALIDATION_FAILED` 반영 |
| IMAGE 없는 상세의 OG fallback·description 생성 규칙 | 확정 | 화면 설계 §7 | D08 `post-detail` | 기본 이미지·TEXT 요약 반영 |
| 서비스 도메인·카카오 공유 방식 | 확정·활성화 차단 | 서비스 기획 §7, 보안·운영 §4 | D01 `share-post`, D08 `post-detail` | 도메인·SDK 방식 반영, 운영값 전 활성화 차단 |
| 로그인·광고·수집 | 범위 밖 | 서비스 기획 §1 | 모든 산출물 | 제외 |

## 6. 업무 규칙과 수용 조건

- 목록 정렬·페이지 경계는 [목록 API](#api-list-posts), 소속 검증·비공개 404는 [상세 API](#api-get-post)를 따른다.
- 하단 목록 갱신·SSR metadata·OG fallback은 [상세 화면](#d08-post-detail)을 따른다.
- 카카오 활성화 차단과 실패 시 fallback은 [공유 흐름](#d01-share-post)을 따른다.
- 권리 문의와 이메일 복사는 [정책·권리 명세](../policy-and-rights/policy-and-rights.dev.md#d08-rights-inquiry-entry)를 따른다.
- 360px·768px·1280px에서 가로 스크롤이 없고 키보드로 목록·공유·페이지 이동이 가능해야 한다.

## 7. 데이터·권한·법무 영향

- 읽기: `content.board`, `content.board_post`, `content.board_post_block`, `content.board_post_image`.
- 쓰기: 조회 수 endpoint만 `view_count`를 원자 증가하며 감사·lock version을 변경하지 않는다.
- 공개 API는 인증 없음. 관리자 identity나 내부 storage key·상태 이력은 반환하지 않는다.
- 출처 링크는 권리 확보를 뜻하지 않으며 source URL은 새 창에서 안전한 link 속성을 사용한다.

## 8. API 작업 목록

- [활성 게시판 조회](#api-list-boards)
- [게시글 목록 조회](#api-list-posts)
- [게시글 상세 조회](#api-get-post)
- [게시글 조회 수 증가](#api-increment-post-view)

## 9. 처리 흐름 찾아보기

- [게시글 목록 탐색](#d01-browse-posts)
- [게시글 상세 열람](#d01-view-post)
- [게시글 공유](#d01-share-post)

## 10. 화면·프로그램 찾아보기

- [짤 목록](#d08-meme-list)
- [게시글 상세](#d08-post-detail)

## 11. 결정·가정·미정·차단 항목

- 확정: 조회 수 endpoint의 payload 오류 code는 `VALIDATION_FAILED`다.
- 확정: 서비스 공개 기준 URL은 `https://blariyo.com/`이며 홈·OG·푸터 카피와 상세 metadata fallback을 반영했다.
- 확정: 카카오톡 공유는 Kakao JavaScript SDK를 사용하고 provider가 비활성이어도 링크 복사·브라우저 기본 공유를 유지한다.
- 실값 필요: Kakao JavaScript key, 개발자 콘솔 Web domain 등록 확인, SDK script URL·SRI integrity와 CSP host.
- 미검증: 정적 프로토타입은 혼합 단계 검토물이며 실제 SSR·API·접근성·공유 동작 증거가 아니다.
- 활성화 차단: 위 카카오 운영값과 Web domain 등록을 확인하기 전에는 카카오톡 공유 항목을 켜지 않는다.

## 12. 기능 계약 상세

아래 API·처리 흐름·화면 절을 이 파일에서 함께 관리한다. 각 절의 미검증·차단 조건은 유지하며, 문서 통합은 구현 완료를 뜻하지 않는다.

요청·응답 형식은 [M0 Core OpenAPI](../openapi/m0-core.yaml)를 참조한다. 아래 필드 보충은 데이터 매핑과 업무 제약을 설명하며, 타입·필수 여부를 별도 계약으로 재정의하지 않는다.

<a id="api-get-post"></a>

### 게시글 상세 조회 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §3 게시글 상세](../../../system-design/03-api-design.md), [데이터 모델 §3·§8](../../../system-design/02-data-model.md)
- 검증 경계: OpenAPI·source와 기존 테스트/실행 기록이 있다. 이번 문서 대조에서 contract·runtime·성능 시험을 재실행하지 않았다.

#### 목적과 호출 경계

Nuxt SSR이 공개 글 본문과 현재 글이 포함된 같은 게시판 목록 context를 받는다. 외부 제공자는 Nuxt
BFF, 내부 제공자는 Core `PublicService.detail`이다. Core의 공개 DTO가 storage key·내부 상태·이력을 제외하고 BFF가 이를 전달한다.

#### Method·path·인증·권한

- `GET /api/v1/boards/:boardSlug/posts/:postId`
- 인증 없음; cache `no-store` (내장 목록 포함)

#### Request

**필드 보충 — 제약·데이터 매핑**

- `boardSlug`: 활성 slug; `content.board`; 요청 게시판
- `postId`: 양의 정수; `board_post.id`; 글 번호

query·body: 해당 없음.

#### Response

board/post/block/image에서 공개 projection을 읽는다. authorLabel은 M0 `운영자`, IMAGE는 공개 media URL·block alt·image 크기를 사용한다. shareUrl은 canonical 절대 URL이다. 하단 context는 공지와 일반 목록을 분리하고 현재 글 page 및 공지 제외 집계값을 제공한다.

#### Validation과 정규화

형식 오류, 게시판 불일치, 비활성 게시판, 비공개·미존재 글을 모두 `404 POST_NOT_FOUND`로 일반화한다.
API는 공개 TEXT block의 plain text를 반환하며 metadata 전용 요약 필드를 별도로 만들지 않는다.
Nuxt SSR metadata 변환은 [상세 화면의 표시값 계약](#d08-post-detail)을 따른다.

#### 정상 처리와 데이터 전이

게시판과 글의 `board_id`를 함께 확인하고 공개 본문·이미지·출처를 조회한다. 현재 글이 일반 글이면
정렬상 앞선 글 수로 `listPage`를 계산하고, 공지면 1이다. 조회 자체의 상태 전이는 없다.

#### 오류·권한·부분 실패

404에는 제목·본문·이미지·출처·숨김 이유가 없다. 공개 image URL 생성 실패나 DB 장애는
`503 DEPENDENCY_UNAVAILABLE`; error 응답은 `no-store`다.

#### 멱등성·동시성·재시도

읽기 요청으로 멱등이다. 숨김 commit 이후 시작된 조회는 purge 완료와 관계없이 404다. 이미 진행 중인 응답의 회수는 보장하지 않는다.

#### Pagination·cache·호환성

context의 page size는 20이다. 게시판 문맥 없는 상세 alias는 제공하지 않는다.

#### 예시

`media.example.invalid`는 문서 전용 예시 origin이다. 실제 응답의 절대 HTTPS 이미지 URL은 배포 환경
설정 `IMAGE_ORIGIN`을 기준으로 생성하며, 이 예시를 실제 origin으로 사용하지 않는다.

실패 `404`는 공통 오류 envelope와 `POST_NOT_FOUND`만 반환하며 제목·본문·상태·숨김 사유를 넣지 않는다.

#### Contract test와 미검증

- 소속 불일치·숨김·삭제·예약·초안의 동일 404, storage key 비노출, context 현재 행을 검증한다.
- 관련 시험과 날짜별 실행 기록은 존재한다. 이번 문서 대조에서는 재실행하지 않았다.

<a id="api-increment-post-view"></a>

### 게시글 조회 수 증가 API

- 계약 상태: `작성 완료` (구현 잔여·인수는 별도)

- 입력 근거: [API 설계 §3 조회 수](../../../system-design/03-api-design.md), [분석·광고 계획 §3](../../../planning/04-analytics-ad-plan.md)
- 검증 경계: OpenAPI·source와 기존 테스트/실행 기록이 있다. 이번 문서 대조에서 contract·runtime·성능 시험을 재실행하지 않았다.

#### 목적과 호출 경계

정상 렌더링된 공개 상세가 참고용 누적 조회 수를 한 번 증가시킨다. 브라우저→BFF→Core
`PublicService.view`→PostgreSQL 순서이며 GA4와 무관하다.

#### Method·path·인증·권한

- `POST /api/v1/boards/:boardSlug/posts/:postId/views`
- 인증 없음; `Cache-Control: no-store`
- BFF client IP 기준 `60회/분` 남용 제한

#### Request

**필드 보충 — 제약·데이터 매핑**

- `boardSlug`: 활성 게시판; board; 게시판
- `postId`: 양의 정수; post; 글 번호

body·query는 없어야 한다. 방문자·세션 ID, IP, User-Agent를 application DB에 저장하지 않는다.

#### Response

성공은 body 없는 `204`, `no-store`다. 오류만 공통 error envelope를 사용한다.

#### Validation과 정규화

payload가 있으면 `400 VALIDATION_FAILED`다.

#### 정상 처리와 데이터 전이

활성 게시판·공개 상태·소속을 조건에 포함한 한 SQL로 `view_count=view_count+1`을 원자 증가한다.
`updatedAt`, actor, `lockVersion`과 개별 조회 이력은 바꾸거나 만들지 않는다.

#### 오류·권한·부분 실패

- 비공개·미존재·소속 불일치: `404 POST_NOT_FOUND`
- 제한 초과: `429 RATE_LIMITED`
- DB 장애: `503 DEPENDENCY_UNAVAILABLE`
- 실패는 이미 표시한 상세와 viewCount를 변경하지 않는다.

#### 멱등성·동시성·재시도

서버 명령은 멱등하지 않다. 브라우저는 page lifecycle당 한 번 호출하고 자동 재시도하지 않는다.
동시 요청은 원자 증가로 유실만 방지하며 사람 단위 중복은 제거하지 않는다.

#### Pagination·cache·호환성

pagination 해당 없음. 응답·오류는 `no-store`다.

#### Contract test와 미검증

- 빈 payload, payload 거부, 동시 증가, 공개 상태 재검증, rate-limit, UI 비차단을 검증한다.
- 기존 실행 증거는 [현재 상태](../../../status.md)에서 추적한다. 이 절의 모든 경계 조건을 이번에 재실행한 것은 아니다.

<a id="api-list-boards"></a>

### 활성 게시판 조회 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §3 활성 게시판](../../../system-design/03-api-design.md), [데이터 모델 §3 게시판](../../../system-design/02-data-model.md)
- 검증 경계: OpenAPI·source와 기존 테스트/실행 기록이 있다. 이번 문서 대조에서 contract·runtime·성능 시험을 재실행하지 않았다.

#### 목적과 호출 경계

브라우저 또는 Nuxt SSR이 활성 게시판 메뉴를 조회한다. 외부 제공자는 Nuxt BFF, 내부 제공자는
Nest Core `PublicService.boards`이며 BFF가 허용 필드만 전달한다.

#### Method·path·인증·권한

- `GET /api/v1/boards`
- 인증: 없음
- cache: `public, max-age=60, s-maxage=300`; BFF가 `requestId`를 제외한 공개 응답 전체의 hash로 ETag 생성

#### Request

path·query·body·필수 header: 해당 없음.

#### Response

활성 board의 slug·displayName·postingPolicy를 반환한다. M0 작성 정책은 `ADMIN`이며 Core `boardsDto`가 `/{slug}` 목록 경로를 만든다.

#### Validation과 정규화

요청값이 없다. 비활성 게시판은 응답에서 제외한다.

#### 정상 처리와 데이터 전이

`is_active=true`를 `display_order ASC`로 조회한다. 상태 전이·transaction·외부 I/O는 없다.

#### 오류·권한·부분 실패

DB 장애는 공통 `503 DEPENDENCY_UNAVAILABLE`, 미분류 오류는 `500 INTERNAL_ERROR`다. 빈 배열은 정상이다.

#### 멱등성·동시성·재시도

읽기 요청으로 멱등이다. client는 일시 오류 시 사용자 재시도만 제공하고 무한 재시도하지 않는다.

#### Pagination·cache·호환성

pagination 없음. 게시판 문맥 없는 게시글 alias를 만들지 않는다.

#### 예시

실패 `503`은 [공통 오류 envelope](../../../system-design/03-api-design.md)를 사용하며
`error.code=DEPENDENCY_UNAVAILABLE`이고 내부 DB 원인은 포함하지 않는다.

#### Contract test와 미검증

- 활성·비활성 필터, 표시 순서, 내부 `boardId` 비노출을 검증한다.
- 관련 시험과 날짜별 실행 기록은 존재한다. 이번 문서 대조에서는 재실행하지 않았다.

<a id="api-list-posts"></a>

### 게시글 목록 조회 API

- 계약 상태: `작성 완료`

- 입력 근거: [API 설계 §3 게시글 목록](../../../system-design/03-api-design.md), [데이터 모델 §8](../../../system-design/02-data-model.md)
- 검증 경계: OpenAPI·source와 기존 테스트/실행 기록이 있다. 이번 문서 대조에서 contract·runtime·성능 시험을 재실행하지 않았다.

#### 목적과 호출 경계

Nuxt SSR과 상세 하단 목록이 활성 게시판의 공지와 일반 글 한 page를 조회한다. BFF→Core
`PublicService`→PostgreSQL 순서다.

#### Method·path·인증·권한

- `GET /api/v1/boards/:boardSlug/posts?page=1`
- 인증 없음; cache `no-store` (모든 query 변형 포함)

#### Request

**필드 보충 — 제약·데이터 매핑**

- `boardSlug`: lowercase 영문·숫자·하이픈, 활성 게시판; `content.board`; 게시판
- `page`: 기본 1, 1~10000; API 계약; 일반 글 page

body: 해당 없음.

#### Response

board의 slug·표시명과 공개 post 목록을 반환한다. 공지 0~3건은 pageSize·집계에서 제외하고 일반 글은 최대 20건이다. 작성자는 M0 `운영자`, 시각은 UTC 최초 발행 시각, 상세 path는 `/{slug}/posts/{id}`다. page·전체 수·이동 가능 여부는 공지를 제외한 query/count 결과에서 계산한다.

#### Validation과 정규화

형식 오류·비활성·미존재 `boardSlug`는 동일한 `404 BOARD_NOT_FOUND`; page 형식 오류는
`400 VALIDATION_FAILED`다.

#### 정상 처리와 데이터 전이

공지는 `pinnedPosition ASC`, 일반 글은 `publishedAt DESC, postId DESC`다. `PUBLISHED`이고
발행 시각이 현재 이하인 글만 읽는다. 쓰기와 상태 전이는 없다.

#### 오류·권한·부분 실패

- 글 0건의 page 1: 빈 배열 `200`
- 전체 page 초과: `404 PAGE_NOT_FOUND`
- 게시판 없음: `404 BOARD_NOT_FOUND`
- DB 장애: `503 DEPENDENCY_UNAVAILABLE`

#### 멱등성·동시성·재시도

읽기 요청으로 멱등이다. 같은 정렬값에서는 `postId DESC`가 tie-breaker다.

#### Pagination·cache·호환성

page size 20 고정, OFFSET 방식이다. 공지는 total·page size에서 제외한다. ETag를 지원한다.

#### 예시

실패 `404` 예시는 [공통 오류 envelope](../../../system-design/03-api-design.md)를 사용하며,
없는 게시판은 `BOARD_NOT_FOUND`, 초과 page는 `PAGE_NOT_FOUND`다.

#### Contract test와 미검증

- 0건, 공지 3건, 20건, 마지막·초과 page, 정렬 tie, 비공개 글 제외를 검증한다.
- 기존 실행 증거는 [현재 상태](../../../status.md)에서 추적한다. 이 절의 모든 경계 조건을 이번에 재실행한 것은 아니다.

<a id="d01-browse-posts"></a>

### 게시글 목록 탐색

- 계약 상태: `작성 완료`

- 입력 근거: [서비스 기획 §2·§5](../../../planning/01-service-plan.md), [목록 API](#api-list-posts)
- 미검증: SSR, browser, accessibility, runtime

#### 목적과 범위

공개 이용자가 루트에서 짤 목록으로 이동해 공지와 일반 글을 page 단위로 탐색한다.

#### 행위자·시작·선행 조건

- 행위자: 공개 이용자
- 시작: `/` 또는 `/meme?page=n`
- 선행: `meme` 활성 게시판 seed와 공개 글 query 가능

#### 정상 흐름

1. `/` 요청이면 서버가 `/meme`으로 리다이렉트한다.
2. Nuxt SSR은 목록 API page 1 또는 요청 page를 호출한다.
3. Core는 활성 게시판, 공지 0~3건, 일반 글 최대 20건과 page meta를 반환한다.
4. SSR은 실제 데이터가 포함된 HTML을 응답한다.
5. 이용자가 page를 고르면 같은 목록 API의 해당 page를 조회해 목록과 pagination을 갱신한다.
6. 글 행을 고르면 해당 게시판 상세 route로 이동한다.

#### 대안·실패 흐름

- page 1이 비면 empty 상태를 표시한다.
- page 초과·게시판 없음은 일반 오류 상태와 목록 복귀를 제공한다.
- 네트워크 오류는 skeleton 종료 후 오류·`다시 시도`를 표시한다.

#### API 매핑

| 단계 | API |
| --- | --- |
| 2~3 | [게시글 목록 조회](#api-list-posts) |
| 게시판 메뉴 확장 시 | [활성 게시판 조회](#api-list-boards) |

#### 데이터·상태 전이

읽기 전용이다. page 이동은 URL query로 재현 가능해야 하며 게시글 상태를 바꾸지 않는다.

#### 권한·트랜잭션·멱등성·재시도

인증 없음. 조회는 멱등이다. 자동 무한 재시도는 하지 않는다.

#### 완료 조건과 수용 기준

공지와 일반 글이 분리되고 일반 글 최대 20건, page 번호, loading·empty·error·마지막 page 상태가
정확히 표시되면 완료다.

#### 미정·차단·미검증

카피는 planning의 확정 계약을 따른다. 기존 SSR·브라우저 기록과 이번 소스 대조는 분리한다. 전체 접근성·viewport 재인수는 남아 있다.

<a id="d01-share-post"></a>

### 게시글 공유

- 계약 상태: `작성 완료`

- 입력 근거: [화면 설계 §7](../../../planning/03-screen-design.md), [보안·운영 §4](../../../system-design/05-security-operations.md)
- 미검증: 카카오 운영 설정, browser·provider runtime

#### 목적과 범위

상세 canonical URL을 링크 복사, 기기 공유, 카카오톡 또는 X로 공유한다.

#### 행위자·시작·선행 조건

공개 상세를 정상 표시한 이용자가 헤더의 `공유하기` 버튼을 누른다.

#### 정상 흐름

1. 데스크톱은 버튼 아래 popup, 모바일은 하단 share sheet를 연다.
2. 선택한 방식에 상세 `shareUrl`과 공개 제목을 전달한다.
3. 성공·취소·실패 결과를 `aria-live` 영역에 알린다.
4. 닫기·바깥 클릭·Escape 후 포커스를 공유 버튼으로 돌린다.

`shareUrl`은 Core `SITE_ORIGIN`과 Web `NUXT_PUBLIC_SITE_ORIGIN`의 `https://blariyo.com/`를 기준으로 만든 canonical 절대 URL이다.
카카오톡은 Kakao JavaScript SDK를 사용한다.

#### 대안·실패 흐름

- `navigator.share` 미지원이면 해당 항목을 숨기거나 다른 방식을 유지한다.
- 실제 Kakao JavaScript key와 개발자 콘솔 Web domain 등록을 확인하지 않았거나 SDK script/CSP 설정이
  준비되지 않았으면 카카오 항목을 활성화하지 않는다.
- 카카오 비활성 또는 script/CSP 실패 시 카카오 항목만 숨기고 링크 복사와 브라우저 기본 공유는 유지한다.
- clipboard 실패면 선택 가능한 URL과 실패 안내를 제공한다.

#### API 매핑

API 해당 없음. 브라우저 공유 기능과 외부 공유 provider를 사용하며 BFF·Core에 공유 API를 만들지 않는다.

#### 데이터·상태 전이

Blariyo DB 상태 전이 없음. GA4가 활성이고 분석 동의가 있을 때만 `share` 이벤트를 브라우저에서 보낸다.

#### 권한·트랜잭션·멱등성·재시도

인증·transaction 해당 없음. 사용자의 명시적 재선택 없이 자동 재시도하지 않는다.

#### 완료 조건과 수용 기준

카카오 비활성·실패 환경에서도 popup, 링크 복사와 브라우저 기본 공유가 동작하고 키보드로 열고
닫을 수 있어야 한다.

#### 미정·차단·미검증

서비스 도메인과 Kakao JavaScript SDK 사용 방식은 확정됐다. SDK script URL·SRI integrity,
JavaScript key, CSP host는 properties/config로 관리하며 실제 값은 `(미정)`이다. 실제 JavaScript key와
카카오 개발자 콘솔 Web domain 등록을 확인하기 전에는 카카오톡 공유 항목 활성화를 차단한다.

<a id="d01-view-post"></a>

### 게시글 상세 열람

- 계약 상태: `작성 완료` (구현 잔여·인수는 별도)

- 입력 근거: [화면 설계 §6](../../../planning/03-screen-design.md), [상세 API](#api-get-post), [조회 수 API](#api-increment-post-view)
- 미검증: SSR·조회 수 호출 lifecycle·cache purge integration

#### 목적과 범위

공개 이용자가 상세 본문과 같은 게시판의 현재 page 목록을 보고 탐색을 이어간다.

#### 행위자·시작·선행 조건

공개 이용자가 `/:boardSlug/posts/:postId`에 진입하며 게시판과 글이 공개 상태여야 한다.

#### 정상 흐름

1. SSR이 상세 API를 호출한다.
2. Core가 게시판 소속·공개 조건을 검증하고 본문·출처·하단 context를 반환한다.
3. SSR이 canonical·OG와 실제 본문이 든 HTML을 표시한다. 첫 공개 TEXT block plain text의 앞뒤
   Unicode whitespace를 제거하고 내부의 하나 이상 연속된 Unicode whitespace를 단일 U+0020 space로
   치환한 뒤 grapheme 수를 센다. 120자 이하면 그대로 사용하고, 120자 초과면 Unicode grapheme
   cluster 기준 앞 119자와 단일 `…`로 최대 120자를 만들어 `description`, `og:description`,
   `twitter:description`에 동일하게 넣는다.
4. 정상 표시 뒤 브라우저가 조회 수 API를 page lifecycle당 한 번 호출한다.
5. 이용자가 하단 page를 누르면 목록 API만 호출해 본문·스크롤을 유지하고 목록을 교체한다.
6. 다른 글을 고르면 해당 상세 route로 이동한다. 현재 글 행은 동작하지 않는다.

#### 대안·실패 흐름

- 상세 404는 콘텐츠·사유 없이 `볼 수 없는 게시글입니다`와 목록 링크만 표시한다.
- 조회 수 증가 실패는 무시하고 상세 열람을 유지한다.
- 하단 목록 실패는 본문을 유지하고 목록 영역에 재시도를 제공한다.

#### API 매핑

| 단계 | API |
| --- | --- |
| 1~2 | [게시글 상세 조회](#api-get-post) |
| 4 | [게시글 조회 수 증가](#api-increment-post-view) |
| 5 | [게시글 목록 조회](#api-list-posts) |

#### 데이터·상태 전이

상세 조회는 읽기, 단계 4만 `view_count`를 1 증가시킨다.

#### 권한·트랜잭션·멱등성·재시도

인증 없음. 조회 수 명령은 자동 재시도하지 않는다. 상세·목록 읽기는 멱등이다.

#### 완료 조건과 수용 기준

상세·출처 1회·현재 글 하단 목록·동일 404·비차단 조회 수 증가가 계약대로 연결돼야 한다. metadata
description은 80자 미만도 padding하지 않고, 120자 초과 시 UTF-16 code unit·byte가 아닌 Unicode
grapheme cluster 기준으로만 잘라 세 metadata 값이 일치해야 한다.

#### 미정·차단·미검증

조회 수 payload 오류는 `400 VALIDATION_FAILED`로 확정·동기화됐다. runtime은 미검증이다.

<a id="d08-meme-list"></a>

### 짤 목록

- 계약 상태: `작성 완료`

- 입력 근거: [화면 설계 §2·§5·§13](../../../planning/03-screen-design.md), [퍼블리싱 기준](../../../ui/publishing/responsive/README.md)
- 미검증: 실제 Nuxt 화면, browser visual·accessibility test

#### 목적·route·milestone

최신 공개 짤을 빠르게 탐색하는 `/meme` 화면이다. `/`는 `/meme`으로 리다이렉트한다.

#### 진입·이탈·권한

인증 없이 진입한다. 글 행은 `/meme/posts/:postId`, 로고는 `/meme`으로 이동한다. M1 메뉴는 노출하지 않는다.

#### UI 영역과 구성요소

헤더 로고 `블라리요`, 홈 보조 문구 `블라블라블라`, 제목 `짤`, 공지 0~3건, 일반 글 최대 20건,
page navigation, 브랜드 문구 `블라블라블라`와 정책·권리 footer 순서다. footer의 권리 영역에는
`문의·오류 제보`는 contactEmail, `권리 문의`는 rightsEmail로 연결하며 각 mailto와 주소·문의 양식 복사 대체 안내를 제공한다. 헤더와 같은 B 마크와 서비스명 아래 브랜드 문구를 두고, 정책·문의 아래 `© 2026 Blariyo. All rights reserved.`를 표시한다. 상세 동작은 [화면 설계](../../../planning/03-screen-design.md#권리-침해게시-중단-이메일)를 따른다.

#### 필드·표시값·validation

| 표시 | 데스크톱 | 모바일 | 규칙 |
| --- | --- | --- | --- |
| 번호 | 표시 | 표시 | 공지는 `공지` badge |
| 제목 | 한 줄 | 1~2줄 | 행 전체 상세 link |
| 조회 수 | 표시 | 필요 시 숨김 | 참고값 |
| 작성자 | `운영자` | 숨김 가능 | M0 고정 표시 |
| 시각 | 표시 | 표시 | locale formatting |

page는 1 이상만 허용한다.

#### 이벤트·이동·후처리

- page 선택: 목록 API 재조회, URL page query 동기화, 목록 heading으로 초점 이동.
- 글 선택: 상세 route 이동.
- `다시 시도`: 현재 page 재조회.

#### 화면 상태

- loading: 행 skeleton과 `aria-busy`.
- empty: `아직 올라온 짤이 없습니다`.
- error: 일반 오류와 `다시 시도`.
- 마지막 page: 다음 비활성.
- 권한 없음: 공개 화면이므로 해당 없음.
- 부분 실패: 게시판 메뉴 실패 시 초기 `/meme` 목록 자체를 우선 유지할 수 있으나 실제 fallback은 미검증.

#### 반응형과 접근성

360·768·1280px에서 가로 스크롤이 없어야 한다. 터치 대상 44px 이상, 현재 page에
`aria-current="page"`, 공지 badge는 텍스트로 구분한다.

#### 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| 최초·page 조회 | [목록 탐색](#d01-browse-posts) | [목록 조회](#api-list-posts) |
| 상세 이동 | [상세 열람](#d01-view-post) | 상세 route SSR |

#### 메시지와 피드백

empty·error 문구는 화면 설계를 사용한다. 홈 `<title>`은 `블라리요 - 블라블라블라`, 홈
`description`과 `og:description`은 `블라리요에서 블라블라블라`, `og:title`은 `블라리요`를 사용한다.
카피는 `NUXT_PUBLIC_SITE_NAME`, `NUXT_PUBLIC_HOME_TAGLINE`, `NUXT_PUBLIC_HOME_TITLE`,
`NUXT_PUBLIC_HOME_DESCRIPTION`, `NUXT_PUBLIC_HOME_OG_DESCRIPTION`,
`NUXT_PUBLIC_FOOTER_TAGLINE`의 public config로 주입한다.

#### 화면 수용 조건

공지와 일반 글 수·정렬·page가 분리되고 M1 로그인·후속 광고·미활성 게시판이 렌더링되지 않는다.
권리 문의는 Web `NUXT_PUBLIC_RIGHTS_EMAIL`을 사용한다. 단일 mailto 링크 실행 뒤 1.6초 동안 앱 이탈이 감지되지 않으면 주소·제목·본문 전체를 복사할 대체 안내를 제공한다.

#### 미정·차단·미검증

정적 prototype은 혼합 단계이므로 로그인·광고 요소는 M0 구현 근거가 아니다. 실제 앱과 기존 화면 기록은 존재하며 현재 브라우저 재인수는 이번 검토에 포함하지 않았다.

<a id="d08-post-detail"></a>

### 게시글 상세

- 계약 상태: `작성 완료`

- 입력 근거: [화면 설계 §4·§6·§7·§13](../../../planning/03-screen-design.md), [퍼블리싱 기준](../../../ui/publishing/responsive/README.md)
- 미검증: SSR metadata, browser sharing, viewport·accessibility test

#### 목적·route·milestone

`/:boardSlug/posts/:postId`에서 글과 같은 게시판의 탐색 맥락을 제공한다. 초기 route는
`/meme/posts/:postId`다.

#### 진입·이탈·권한

인증 없음. 뒤로가기는 현재 게시판 목록으로 이동한다. 미존재·숨김·소속 불일치는 동일 404다.

#### UI 영역과 구성요소

고정 헤더(`목록으로`·한 줄 제목·`공유하기`), 전체 제목·메타, TEXT/IMAGE 본문, 출처 링크,
같은 게시판 하단 목록과 pagination, 브랜드 문구 `블라블라블라`와 정책 footer 순서다. footer에는
`문의·오류 제보`는 contactEmail, `권리 문의`는 rightsEmail로 연결하며 각 mailto와 주소·문의 양식 복사 대체 안내를 제공한다. 헤더와 같은 B 마크와 서비스명 아래 브랜드 문구를 두고, 정책·문의 아래 `© 2026 Blariyo. All rights reserved.`를 표시한다. 상세 동작은 [화면 설계](../../../planning/03-screen-design.md#권리-침해게시-중단-이메일)를 따른다. M0에서는 광고·로그인 진입을
렌더링하지 않는다.

#### 필드·표시값·validation

- IMAGE는 비율 공간, alt, 공개 media URL을 사용한다.
- 단독 X·YouTube·TikTok·Instagram URL의 공식 임베드와 실패 시 원문 링크·안내 표시는
  [화면 설계의 본문 규칙](../../../planning/03-screen-design.md#본문과-이미지)을 따른다.
  저장된 TEXT/IMAGE API 응답을 표시 계층에서 묶으며 원문 DB를 변경하지 않는다.
- 출처는 본문 뒤 1회, name 전체가 HTTPS link이며 없으면 영역을 생략한다.
- 현재 하단 행은 `aria-current="true"`, link와 tab stop이 없다.
- 정상 상세의 SSR 첫 HTML은 다음 metadata를 게시글별로 넣는다.
  - `<title>`과 `og:title`, `twitter:title`: 공개 게시글 제목을 사용한다.
  - `description`, `og:description`, `twitter:description`: 첫 공개 TEXT block plain text의 앞뒤
    Unicode whitespace를 제거하고 내부의 하나 이상 연속된 Unicode whitespace를 단일 U+0020 space로
    치환한 뒤 grapheme 수를 센다. 이 결과를 세 값에 동일하게 사용한다. 120자 이하는 80자 미만이어도
    padding 없이 그대로 사용한다. 120자를 초과하면 Unicode grapheme cluster 기준 앞 119자 뒤에 단일
    `…`를 붙여 총 120자 이하로 만들며, UTF-16 code unit이나 byte 기준으로 자르지 않는다. 공개 TEXT
    block이 없으면 `NUXT_PUBLIC_HOME_OG_DESCRIPTION`의 `블라리요에서 블라블라블라`를 사용한다.
  - `canonical`, `og:url`: 상세 `shareUrl`과 같은 절대 URL.
  - `og:site_name`: `NUXT_PUBLIC_SITE_NAME`의 `블라리요`; `og:type=article`.
  - `og:image`, `twitter:image`: 첫 공개 IMAGE block의 절대 HTTPS URL. 공개 IMAGE block이 없으면
    상세 `shareUrl`의 origin과 `/og/blariyo-default.png`를 결합한
    `https://blariyo.com/og/blariyo-default.png`를 사용한다.
  - `og:image:alt`, `og:image:width`, `og:image:height`, `twitter:image:alt`: 첫 공개 IMAGE block이
    있을 때 같은 block의 alt·width·height를 사용한다. fallback인 경우 게시글 IMAGE block의 값을
    임의로 만들지 않는다.
  - `twitter:card=summary_large_image`.

#### 이벤트·이동·후처리

- 정상 표시: 조회 수 API를 lifecycle당 한 번 호출하되 화면은 기다리지 않는다.
- 공유: popup/sheet를 열고 선택 방식 실행.
- 하단 page: 본문·스크롤 유지, 목록 영역만 교체.
- 하단 글: 새 상세 route로 이동.

#### 화면 상태

- loading·error: `← / 상태 제목`, 공유와 게시판 menu 숨김.
- 404: `noindex`를 넣고 내용·제목·이미지·출처·내부 사유 없이 `볼 수 없는 게시글입니다`와 목록 link.
- 하단 목록 부분 실패: 본문 유지, 해당 영역 재시도.
- 공유 provider 실패: popup 유지, 방식별 피드백과 다른 방식 제공.
- 카카오톡 공유: Kakao JavaScript SDK를 사용하되 실제 key·Web domain 등록·SDK URL·SRI·CSP host
  확인 전에는 항목을 숨긴다. 링크 복사와 브라우저 기본 공유는 계속 제공한다.
- 권한 없음: 공개 화면이므로 해당 없음.

#### 반응형과 접근성

데스크톱 공유는 header 아래 floating panel, 모바일은 bottom sheet다. Escape·바깥 클릭·닫기와
focus return을 지원한다. 이미지 alt, 44px target, 360px 이상 무가로스크롤을 검증한다.

#### 이벤트별 D01·API 매핑

| 이벤트 | D01 | API |
| --- | --- | --- |
| 최초 표시 | [상세 열람](#d01-view-post) | [상세 조회](#api-get-post) |
| 조회 수 | [상세 열람](#d01-view-post) | [조회 수 증가](#api-increment-post-view) |
| 하단 page | [상세 열람](#d01-view-post) | [목록 조회](#api-list-posts) |
| 공유 | [게시글 공유](#d01-share-post) | API 해당 없음 |

#### 메시지와 사용자 피드백

공유 성공·실패는 `aria-live`로 알린다. 숨김 여부나 내부 사유를 메시지로 구분하지 않는다.

#### 화면 수용 조건

출처 1회, 하단 현재 글 포함 최대 20건, page 이동 시 본문 유지, 카카오 비활성·실패 시 링크 복사와 기본 공유 유지,
404 콘텐츠 비노출·`noindex`, metadata별 값 출처·canonical·공유 URL 일치를 만족해야 한다. IMAGE가 있는
정상 상세는 절대 HTTPS OG 이미지와 alt·크기를 첫 HTML에 포함하고, IMAGE가 없으면 확정 fallback
이미지를 사용한다. TEXT 유무에 따른 description 우선순위도 첫 HTML에 반영한다.
권리 문의는 Web `NUXT_PUBLIC_RIGHTS_EMAIL`의 단일 mailto 링크를 사용하며, 1.6초 안에 앱 이탈이 감지되지 않으면 주소·제목·본문 전체 복사와 수동 선택 안내를 제공한다. 상세 계약은 정책·권리 명세를 따른다.

#### 미정·차단·미검증

서비스 도메인, 상세 metadata fallback과 카피 계약은 확정됐다. Kakao SDK script URL·SRI integrity,
JavaScript key, CSP host의 실제 값과 개발자 콘솔 Web domain 등록은 미검증이다. 이를 확인하기 전에는
카카오톡 공유 항목 활성화를 차단한다. SSR·browser runtime과 접근성 검증은 별도 구현 증거가 필요하다.

## 13. 2026-09-24 소스 대조와 남은 수용 조건

- 공개 API는 `PublicService`·공개 DTO, 화면은 `pages/[boardSlug]/index.vue`와 `posts/[postId].vue`에 구현돼 있다. direct 수집 글도 공개 승격 뒤 같은 DTO/화면을 사용한다. 수집 실행·검수 권한은 이 명세 범위 밖이다.
- **공유 이미지 metadata:** 상세 `useSeoMeta`에는 이미지 URL이 있지만 `og:image:alt`, `og:image:width`, `og:image:height`, `twitter:image:alt`가 없다. 본문 IMAGE의 alt·크기 표시와 SSR metadata 계약을 구분하고, 첫 IMAGE 유무별 HTML 회귀 검사로 보완한다.
- **목록 초점:** page 변경은 `navigateTo`로 query를 갱신하지만 목록 heading으로 명시적으로 초점을 옮기는 처리는 없다. 키보드·스크린리더 인수와 함께 구현을 확인한다.
- **부분 실패/공유 안내:** 상세 하단 목록 실패는 피드백 문구와 기존 page 버튼 재선택으로 복구한다. 별도 영역 내 재시도 버튼은 없다. 브라우저 기본 공유 성공·사용자 취소에는 별도 피드백을 설정하지 않는다. 명세의 실패/성공/취소 안내 수용 조건을 전부 통과한 것으로 기록하지 않는다.
- 위 차이는 소스에서 확인한 잔여이며 이번에 브라우저 장애·공유 provider 실패를 재현한 결과가 아니다. 카카오 실제 운영 활성화와 CDN 전체 검증도 별도다.
