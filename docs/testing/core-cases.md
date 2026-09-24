# M0 Core 테스트 케이스

[구현 안내](README.md)의 환경·상태·데이터 규칙을 공통으로 적용한다. 신규 ID는 전부 **미실행**이다.
아래 `기존 확장`/`보강 제안`은 구현 방향이며 통과 상태가 아니다. API path는 Core와 BFF에서 구분해서
실행한다. Core 직결 테스트가 통과해도 BFF 인증·필드 제거·요청 제한까지 검증한 것은 아니다.
2026-09-24 대조: 정책/문의 UX와 분석 동의의 현재 계약을 보완했다. 각 ID의 전체 입력을 이번에 실행한 것은 아니다. 관리자 수동 이미지 한도와 direct 수집200장/1000블록 경계는 별도 케이스로 구분한다.

## 공개 조회 — PUB

근거: [공개 탐색 명세](../development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md),
[API 설계 §3](../system-design/03-api-design.md).
기본 참고: [public-http](../../apps/api/test/public-http.integration.test.ts),
[public 서비스](../../apps/api/test/public.service.test.ts), [BFF](../../apps/api/test/bff.integration.test.ts).

### PUB-01 — 활성 게시판만 정렬해 반환한다

- **P1 / 보강 제안 / API·DB**. 목록이 `meme`에 고정되지 않았는지 검사한다.
- 준비: A·B 활성 ADMIN 게시판, C 비활성 ADMIN 게시판. B의 display_order를 A보다 작게 설정한다.
- 실행: `GET /api/v1/boards`를 Core와 BFF에 각각 요청한다.
- 기대: 200, B→A 순서, C 없음. slug·displayName·postingPolicy는 계약과 일치한다.
- 추가 검증: DB row·감사값 불변. board 내부 ID·관리자 정보가 공개 응답에 없다. 캐시 헤더와 ETag를 검사한다.
- 확장: 동일 ETag로 조건부 요청 시 304와 빈 body. USER 게시판은 이 케이스에 섞지 않는다.

### PUB-02 — 공지와 일반 글의 페이지 경계를 분리한다

- **P1 / 기존 확장 / API·DB**.
- 준비: A에 일반 공개 글 21개와 공지 3개. 일반 글 중 2개는 published_at이 같고 ID가 다르게 만든다.
- 실행: page=1, 2를 조회하고, 일반 글 수를 0·1·20·21로 바꾼 독립 하위 테스트도 실행한다.
- 기대: 21개일 때 일반 목록은 20/1개, 공지는 각 페이지의 pinnedItems에만 3개, totalItems=21.
  일반 글은 `publishedAt DESC, postId DESC`, 공지는 위치순. 같은 글이 일반 목록과 공지에 중복되지 않는다.
- 추가 검증: 두 페이지 일반 ID의 합집합이 정확히 21개이고 교집합은 0개. 다른 게시판 글은 없다.
- 구현: [완전한 예제](README.md#5-따라-작성할-수-있는-완전한-예제)에서 공지·동률 정렬을 확장한다.

### PUB-03 — 잘못된 페이지와 빈 게시판을 구분한다

- **P1 / 기존 확장 / API·DB**. 준비: 글이 없는 활성 A와 미존재 slug.
- 실행/기대: A의 page 생략·1은 200 빈 목록, page=2는 404 `PAGE_NOT_FOUND`.
  page=0, -1, 1.2, abc, 10001은 400 `VALIDATION_FAILED`.
- 실행/기대: 잘못된 형식 slug와 미존재·비활성 slug의 목록은 404 `BOARD_NOT_FOUND`.
- 추가 검증: 오류 응답 no-store, SQL·DB 오류 원문 없음. 요청 전후 글 수와 조회 수가 같다.
- 주의: 관리자 검색의 초과 페이지는 200 빈 목록이다. 공개 목록 기대값을 관리자에 복사하지 않는다.

### PUB-04 — 비공개 글과 다른 게시판 글은 같은 404다

- **P0 / 기존 확장 / API·DB**.
- 준비: A의 초안·예약·숨김·제거 글과 B의 공개 글. A의 PUBLISHED이지만 발행 시각이 미래인 행도 준비한다.
- 실행: 각 ID를 `/api/v1/boards/meme/posts/:id`로 조회한다. 미존재·0·abc ID도 각각 실행한다.
- 기대: 전부 404 `POST_NOT_FOUND`. 제목·본문·출처·이미지·실제 상태·숨김 사유가 응답에 없다.
- 추가 검증: 메타 requestId를 제외한 오류 구조가 같다. 조회 수·version·감사값이 바뀌지 않는다.
- 확장: 비활성 A로 바꾼 뒤 원래 공개 글도 404인지 확인한다. DB 변경은 테스트 준비에서만 수행한다.

### PUB-05 — 상세 하단 목록은 현재 글과 같은 게시판 문맥이다

- **P1 / 기존 확장 / 서비스 + API·DB**.
- 준비: A 일반 글 41개·공지 1개, B 일반 글 1개. A의 21번째 글과 공지를 각각 연다.
- 기대: 21번째 일반 글의 listPage=2, context 일반 목록에서 해당 글만 current=true.
  공지는 listPage=1이고 pinnedItems에서 current=true. B의 글은 어떤 context에도 없다.
- 추가 검증: 상세와 context를 한 읽기 snapshot으로 검사한다. 별도 연결에서 숨김을 commit해도 이미
  열린 snapshot의 집계·행이 서로 모순되지 않고, commit 후 시작한 새 조회는 404다.
- 구현: [public.service](../../apps/api/test/public.service.test.ts)와
  [database.integration](../../apps/api/test/database.integration.test.ts)의 snapshot 검증을 분리해서 사용한다.

### PUB-06 — 조회 수는 동시 요청 수만큼 증가한다

- **P0 / 기존 확장 / API·실제 DB**.
- 준비: 공개 글 1개. view_count·lock_version·updated_at·updated_by를 저장한다.
- 실행: body/query 없는 views POST 12개를 동시에 보낸다.
- 기대: 모두 204, body 없음, no-store. DB view_count는 정확히 +12다.
- 추가 검증: lock_version·updated_at·updated_by는 그대로다. 방문자별 행이나 개별 조회 이력은 생기지 않는다.
- 변형: 숨김·다른 게시판 글은 404, `{}` body 또는 query 있는 요청은 400. 모두 카운터 증가 0.

### PUB-07 — 조회 수 제한은 BFF에서 검사한다

- **P1 / 기존 확장 / BFF 통합**.
- 준비: 새 BFF 프로세스, 공개 글, 동일한 신뢰 client IP. 다른 테스트의 제한 카운터가 섞이지 않게 한다.
- 실행: 같은 분 안에 views POST를 60회 보낸 후 61번째 요청을 보낸다.
- 기대: 앞 60회는 204, 61번째는 429 `RATE_LIMITED`. DB 증가량은 60이다.
- 추가 검증: 임의 전달 헤더를 바꿔 같은 client의 제한을 우회할 수 없는지 BFF의 신뢰 proxy 계약에 맞춰 확인한다.
  제한 창 이후 정상화는 제어 가능한 시계/카운터 단위 테스트로 분리한다.
- 주의: Core 직결에서는 BFF 제한을 기대하지 않는다. 제한을 사람 단위 방문자 중복 제거로 해석하지 않는다.

### PUB-08 — 공개 응답에서 내부 필드를 제거한다

- **P0 / 기존 확장 / BFF 계약 + API**.
- 준비: 허용 응답에 `privateStorageKey`, 관리자 식별자, 상태 이력 등 미허용 필드를 중첩해서 넣은 Core 대역.
- 실행: BFF 목록·상세를 요청한다. 실제 Core에 대해서도 정상 공개 응답을 별도 확인한다.
- 기대: 허용 필드만 남고 중첩 block/image/context에서도 주입한 필드가 제거된다.
- 추가 검증: HTML의 SSR payload와 metadata에도 내부 값이 없다. key 이름뿐 아니라 합성 비밀값도 검색한다.
- 참고: [auth-contract](../../tests/auth-contract.test.ts). 대역 시험은 BFF 제거 기능만 증명한다.

## 인증 — AUTH

근거: [관리자 명세](../development-specs/m0-core/admin-post-management/admin-post-management.dev.md),
[보안·운영](../system-design/05-security-operations.md).
참고: [HTTP 경계](../../apps/api/test/http-boundaries.integration.test.ts),
[인증 계약](../../tests/auth-contract.test.ts), [BFF 통합](../../apps/api/test/bff.integration.test.ts).

### AUTH-01 — Core 관리자 인증과 입력 오류를 분리한다

- **P0 / 기존 확장 / API·DB**. 준비: 정상 JSON의 초안 요청과 합성 관리자 인증값.
- 실행/기대: 인증 헤더 누락은 401 `ADMIN_AUTH_REQUIRED`, 유효 service token + 형식이 잘못된 actor는
  403 `ADMIN_FORBIDDEN`. 정상 인증 + 업무 입력 오류는 400 `VALIDATION_FAILED`다.
- 추가 검증: 거부된 요청에서 게시글·이미지·이력·업무 receipt가 추가되지 않는다.
- 변형: 문법 자체가 깨진 JSON `{`는 parser 단계의 400이다. 이를 인증이 먼저라는 테스트와 섞지 않는다.

### AUTH-02 — BFF가 위조·만료 identity를 거부한다

- **P0 / 기존 확장 / 인증 단위 + BFF**.
- 준비: 합성 signing key/JWKS와 정상 allowlist. 정상, 서명 위조, 만료, issuer 불일치,
  audience 불일치, allowlist 밖 identity를 각각 만든다.
- 실행: 각 identity로 같은 관리자 요청을 보낸다.
- 기대: 정상만 허용. 나머지는 인증 계약의 401/403으로 거부하고 Core 업무 호출·DB 쓰기는 0이다.
- 추가 검증: 브라우저가 넣은 service token/actor를 신뢰하지 않는다. 외부 인증 장애 중에도 공개 조회는 유지한다.
- 주의: 로컬 서명 시험은 실제 Access 계정·정책 설정 검증을 대신하지 않는다.

### AUTH-03 — 이미지 preview에도 권한이 필요하다

- **P0 / 기존 확장 / API + BFF**.
- 준비: 관리자 staging image와 수집 후보 private preview. 둘 다 ID를 알고 있는 상황을 만든다.
- 실행: 인증 없이 각 preview URL 요청, 정상 인증으로 재요청.
- 기대: 무인증은 차단되고 이미지 bytes·private key·저장소 서명 URL이 노출되지 않는다. 정상 인증은 200 binary.
- 추가 검증: 공개 상세 DTO로 이 preview URL이 유출되지 않는다. 오류는 no-store.
- 참고: [images-http](../../apps/api/test/images-http.integration.test.ts),
  [collection-admin](../../apps/api/test/collection-admin.integration.test.ts).

## 게시글 관리 — ADM

근거: [관리자 명세](../development-specs/m0-core/admin-post-management/admin-post-management.dev.md),
[API 설계 §5](../system-design/03-api-design.md).
참고: [admin-http](../../apps/api/test/admin-http.integration.test.ts),
[회귀 테스트](../../apps/api/test/review-regressions.integration.test.ts),
[실패 테스트](../../apps/api/test/failures.integration.test.ts).

### ADM-01 — 초안 생성과 입력 경계를 검사한다

- **P1 / 기존 확장 / API·DB**. 준비: 활성 ADMIN 게시판과 정상 운영자, 요청마다 새 key.
- 실행: POST `/api/v1/admin/posts`에 title·TEXT block·source=null·pinnedPosition=null을 보낸다.
- 기대: 201, DRAFT, postId 반환. post/block 저장, 공개 상세는 404.
- 변형: trim 후 제목 0·1·200·201자, TEXT 0·1·20000·20001자, blocks 빈 배열을 독립 시험한다.
  허용 경계만 성공하고 나머지는 400 `VALIDATION_FAILED`, 업무 데이터 추가 0이다.
- 추가 검증: source의 name 또는 URL 한쪽만 있거나 비-HTTPS이면 400. `<script>` TEXT는 실행되지 않는 문자열이다.

### ADM-02 — 같은 요청 재전송은 한 번만 생성한다

- **P0 / 기존 확장 / API·DB**. 준비: A 운영자, 같은 key·같은 body.
- 실행: 초안 생성 요청을 두 번 보낸다. 이어 같은 key로 제목만 바꿔 요청한다.
- 기대: 첫 두 요청은 같은 postId·업무 결과. 세 번째는 409 `IDEMPOTENCY_CONFLICT`.
- 추가 검증: 글·block·생성 이력은 최초 한 묶음뿐이다. 다른 요청의 requestId까지 같다고 요구하지 않는다.
- 변형: 객체 key 순서만 변경하면 동일 요청, block 배열 순서 변경은 다른 요청.
  actor 또는 method/route scope가 다른 요청은 별도 key scope로 검사한다.

### ADM-03 — 동시 수정에서 오래된 버전이 덮어쓰지 못한다

- **P0 / 기존 확장 / API·DB**.
- 준비: 같은 글의 lockVersion=v를 A/B 편집자가 읽는다. 서로 다른 key를 사용한다.
- 실행: A가 제목 A로 수정 성공 후 B가 v로 제목 B를 수정한다.
- 기대: A는 200·version=v+1, B는 409 `POST_VERSION_CONFLICT`. 저장 제목은 A다.
- 추가 검증: B의 block 교체·image 연결·이력은 반영되지 않는다. 최신 버전 재조회 후 새 요청으로만 수정 가능하다.
- 확장: 독립 DB 연결을 사용하는 동시 요청에서도 성공 1건, 충돌 1건을 확인한다.

### ADM-04 — 발행 중 재전송과 완료 후 재전송을 구분한다

- **P0 / 기존 확장 / API·DB + Storage 대역**.
- 준비: 이미지가 있는 DRAFT. 첫 발행의 public copy를 중간에서 멈춘다.
- 실행: 첫 요청과 같은 key/body로 두 번째 발행을 보낸 뒤 첫 요청을 완료시키고 세 번째 재전송한다.
- 기대: 진행 중 두 번째는 409 `IDEMPOTENCY_IN_PROGRESS`, `Retry-After: 1`. 완료 후에는 최초 업무 결과 재생.
- 추가 검증: 실제 발행 이력·version 증가는 1회, 재전송으로 추가 copy 없음.
- 변형: 발행→숨김 후 원래 발행 key 재전송은 최초 결과를 재생하지만 DB는 숨김 유지, 새 공개 조회는 404.

### ADM-05 — 숨김은 파일 삭제 실패와 무관하게 공개 조회를 막는다

- **P0 / 기존 확장 / API·DB + Storage/Cache 대역**.
- 준비: 공개 이미지 글. public 삭제·cache purge가 실패하도록 만든다.
- 실행: hide 요청 성공/commit 후 새 목록·상세를 요청한다.
- 기대: HIDDEN_REVIEW, 목록 제외·상세 404. 삭제/purge는 outbox에 남아 재시도된다.
- 추가 검증: PUBLIC_DELETE_PENDING 동안 재공개·최종 제거·숨김 글 block 교체는 409 `IMAGE_STATE_CONFLICT`.
  대역을 정상으로 바꾸고 outbox 실행 후 삭제 상태와 재공개 가능 여부를 각각 확인한다.
- 경계: 이미 전송된 응답이나 실제 CDN에 남은 bytes의 즉시 회수까지 이 로컬 케이스가 보장하지 않는다.

### ADM-06 — 예약과 두 scheduler의 중복 실행을 검사한다

- **P0 / 기존 확장 / API·실제 DB**.
- 준비: DB 기준 충분히 미래인 시각(예: +2분)으로 SCHEDULED 발행. 외부 전송은 대역 사용.
- 기대: 예약 직후 공개 404. 테스트 DB에서 due 시각을 과거로 옮긴 뒤 두 worker를 독립 연결로 실행한다.
  최종 PUBLISHED와 성공 이력은 한 번뿐이며 재실행으로 추가 발행하지 않는다.
- 변형: IMMEDIATE에 scheduledAt 포함, offset 없는 예약값, 최소 1분보다 명백히 짧은 예약은 400.
  정확한 1분 경계는 시계를 제어할 수 있는 검증으로 분리하고 네트워크 지연에 기대지 않는다.
- 추가 검증: SCHEDULED 취소 후 DRAFT·공개 404. 장애로 지난 예약도 복구 시 처리한다.
- 참고: [예약 알림](../../apps/api/test/schedule-alerts.integration.test.ts).

### ADM-07 — 관리자 검색과 상태 제약을 검사한다

- **P1 / 기존 확장 / API·DB**.
- 준비: A/B 게시판에 서로 다른 상태·제목 prefix·수정일의 글. 검색 데이터는 결과를 직접 계산할 수 있게 만든다.
- 실행: 게시판·상태·titlePrefix·from/to 필터를 하나씩, 이어 조합해서 조회한다.
- 기대: 조건에 맞는 ID만 `updatedAt DESC, postId DESC`, page size 50. 유효한 초과 page는 200 빈 items.
- 변형: from>to·잘못된 상태·page 범위 오류는 400. 제거 글을 재공개하거나 허용되지 않은 상태 전이는
  409 `POST_STATE_CONFLICT`이며 row·version 불변이다.
- 추가 검증: 같은 게시판의 예약/공개 공지 위치 충돌은 409 `PINNED_ORDER_CONFLICT`.
  다른 게시판의 같은 위치까지 충돌시키지 않는다.

## 이미지 — IMG

근거: [관리자 명세의 이미지 API](../development-specs/m0-core/admin-post-management/admin-post-management.dev.md),
[API 설계](../system-design/03-api-design.md).
참고: [images-http](../../apps/api/test/images-http.integration.test.ts),
[images.service](../../apps/api/test/images.service.test.ts), [failures](../../apps/api/test/failures.integration.test.ts).

### IMG-01 — 정상 이미지와 소유권을 검사한다

- **P0 / 기존 확장 / API·DB + 로컬 저장소**.
- 준비: 유효 JPEG·PNG·WebP·GIF를 각각 생성해 multipart files로 업로드한다.
- 기대: 200, STAGED image row·재인코딩된 private object, 공개 object 없음. width/height와 MIME이 실제 bytes와 일치.
- 실행: 반환 imageId를 글 A에 연결한 뒤 글 B에 다시 연결한다.
- 기대: B는 409 `IMAGE_ALREADY_ATTACHED`, A의 연결은 유지된다. 연결된 이미지 폐기도 409 `IMAGE_STATE_CONFLICT`.
- 추가 검증: 미연결 staging 폐기는 202, outbox 처리 후 object 없음. preview와 소유권 검사는 별도 수행한다.

### IMG-02 — 여러 파일 중 하나라도 잘못되면 전체를 거부한다

- **P0 / 기존 확장 / API·DB + 저장소 관측**.
- 준비/실행: ①유효 PNG+SVG ②10MiB 초과 파일+SVG ③유효 이미지 11개를 별도 요청한다.
- 기대: ①415 `UNSUPPORTED_MEDIA_TYPE`, SVG index 포함 ②413 `UPLOAD_TOO_LARGE`, 두 실패 index 포함
  ③413, 요청 단위 개수 제한이므로 fields 없음.
- 추가 검증: 모든 경우 새 image row·private/public object 0, Storage.put 호출 0. 성공 파일만 반환하지 않는다.
- 확장: 10/11개·10MiB/10MiB+1·40MP 경계, MIME/bytes 불일치, decode 불가, GIF 자원 제한을 추가한다.
  경계 크기의 정상 파일은 실제 decoder가 읽는 fixture로 만들고 임의 padding으로 정상이라고 가정하지 않는다.

### IMG-03 — 저장 중 실패해도 반쪽 데이터가 남지 않는다

- **P0 / 기존 확장 / 실제 DB + 실패 주입**.
- 준비: 유효 이미지 2개, 두 번째 Storage.put 실패. 별도 변형은 두 번째 DB insert 실패.
- 실행: 업로드 요청을 보낸다.
- 기대: 503 `DEPENDENCY_UNAVAILABLE`, fields 없음. 이번 요청 image row는 전부 rollback.
- 추가 검증: 먼저 저장한 private object를 보상 삭제한다. 보상 삭제도 실패시키면 cleanup outbox가 남고,
  저장소를 복구해 outbox 실행 후 이번 요청 object만 제거된다. 기존 다른 object는 보존된다.

### IMG-04 — 오래된 미연결 파일만 정리한다

- **P0 / 기존 확장 / DB + 저장소 + cleanup**.
- 준비: 오래된 미연결 staging, 새 staging, 글에 연결된 private, 공개 object를 각각 준비한다.
- 실행: cleanup을 실행하고 재실행한다. 각 보존 시간은 [보안·운영](../system-design/05-security-operations.md)의
  현재 정리 계약을 사용하며 코드의 숫자를 그대로 복사하지 않는다.
- 기대: 정리 대상만 outbox/삭제 상태로 이동한다. 새 파일·연결 파일·공개 파일은 보존, 재실행 부수 효과 중복 없음.
- 추가 검증: 파일의 row 유무뿐 아니라 bucket별 inventory를 대조한다. REMOVED 원본의 30일 유예는
  경계 직전/직후 시각을 준비해서 별도 검사한다.

## 화면 — UI

근거: [화면 설계](../planning/03-screen-design.md) 및 공개·관리자 기능 명세.
참고: [실제 Chromium 흐름](../../tests/browser/core.test.ts),
[브라우저 환경 helper](../../tests/helpers/browser-fixture.ts).

### UI-01 — 작성부터 숨김까지 화면과 서버가 일치한다

- **P1 / 기존 확장 / 브라우저**.
- 준비: 합성 관리자 세션·빈 게시판·유효 이미지. 브라우저에서 `/admin` 진입.
- 실행: 제목/TEXT/이미지 입력→저장→발행→공개 상세 열기→관리자 숨김→공개 상세 새로 열기.
- 기대: 저장 후 DRAFT, 발행 후 본문·이미지 표시, 숨김 후 404. 각 단계 API와 DB 상태가 일치한다.
- 추가 검증: 저장하지 않은 변경·업로드 진행 중에는 상태 명령을 막는다. console 오류 없음.
  최종 제거 확인 dialog의 취소는 요청을 보내지 않고, 확인 후 REMOVED는 되돌리지 못한다.

### UI-02 — 실패한 작업의 입력과 재시도 key를 보존한다

- **P1 / 기존 확장 / 브라우저 + 통제된 응답 실패**.
- 준비: 편집 중인 글. 저장 성공 뒤 편집 상세 재조회만 503으로 실패시키거나, 응답 유실을 따로 재현한다.
- 실행: 실패 표시 후 재시도한다.
- 기대: 사용자가 입력한 내용이 사라지지 않는다. 동일 작업 재시도 key가 유지돼 글이 중복 생성되지 않는다.
- 추가 검증: 인증 오류·버전 충돌·validation 오류는 해당 피드백으로 구분한다. 모든 실패를 자동 재전송하지 않는다.
  이미지 files[index] 오류가 실제 사용자가 선택한 파일명에 대응한다.

### UI-03 — 본문·metadata·공유 실패를 검사한다

- **P0 / 기존 확장 / 브라우저 + SSR**.
- 준비: `<script>` 형태의 TEXT, HTML 특수문자 제목, 이미지 없는 글, 숨김 글.
- 실행: 상세의 HTML·DOM·canonical·OG를 확인하고 공유 provider 실패를 재현한다.
- 기대: TEXT가 실행되지 않는다. canonical은 해당 게시판 상세 URL, 이미지 없는 글은 계약의 OG fallback.
  숨김 페이지는 본문 노출 없이 404/noindex. provider 실패 중에도 링크 복사 등 가능한 공유 경로 유지.
- 추가 검증: 상세 정상 표시 뒤 views는 lifecycle당 한 번, views 실패를 자동 재시도하지 않고 본문 유지.

### UI-04 — 화면 폭과 키보드 동작을 검사한다

- **P1 / 기존 확장 / 브라우저·수동 시각 검토**.
- 준비: 긴 제목·다중 이미지·여러 페이지, viewport 너비 360·768·1280px.
- 실행: 목록→상세→하단 페이지 이동, Tab/Enter/Escape로 공유·정책 modal 조작.
- 기대: 가로 스크롤 없음, 현재 글 표시, 읽을 수 있는 본문, 접근성 이름·focus 이동/복귀 정상.
- 추가 검증: 스크린샷 저장 후 겹침·잘림을 직접 확인한다. DOM assertion 통과만으로 시각 검토를 완료 처리하지 않는다.
- 범위: Chromium 증거다. Safari·Firefox 확인은 별도 실행 결과로 남긴다.

## 정책·분석 동의 — POL / CNS

근거: [정책·권리 명세](../development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md),
[분석 동의 명세](../development-specs/m0-core/analytics-consent/analytics-consent.dev.md),
[법무 정본](../legal/README.md). 법무 실값 확정이나 외부 GA4 활성화는 이 테스트의 산출물이 아니다.

### POL-01 — 승인된 정책만 시행하고 과거 본문은 보존한다

- **P0 / 기존 확장 / DB·정책 CLI·API**.
- 준비: 실제 법무 내용을 대신하는 합성 artifact, 기존 시행 버전. checksum·시행 시각·권한을 준비한다.
- 실행: 정상 artifact 발행, 이어 잘못된 checksum·미래 시행 시각·기존 버전 본문 변경을 각각 시도한다.
- 기대: 정상 전환만 성공. 이전 본문은 보존되고 현재 EFFECTIVE는 유형별 하나다. 거부 요청은 전환을 남기지 않는다.
- 추가 검증: terms/privacy 현재·과거 버전 API는 시행된 버전만 공개하고 sanitize된 본문을 반환한다.
  production의 root 소유·0600 검사는 로컬 개발 모드 통과와 구분한다.
- 참고: [policies.integration](../../apps/api/test/policies.integration.test.ts), [Docker runner](../../scripts/test-docker.ts).

### POL-02 — 정책 열람과 권리 문의는 정해진 진입만 제공한다

- **P1 / 기존 확장 / 브라우저**.
- 준비: 합성 정책·문의 이메일 설정. 공개 상세를 연다.
- 실행: footer 정책 modal과 `/terms`, `/privacy` 직접 route를 비교하고 과거 버전을 선택한다.
- 기대: 같은 버전 전문, 적용 기간·이력 정상. 권리 mailto에 현재 URL이 포함된다.
- 추가 검증: 독립 복사 버튼은 없다. `권리 문의` 선택 뒤 1.6초 동안 blur/hidden 신호가 없을 때 주소·제목·양식을 복사하고 안내한다. 전환 신호가 있으면 복사를 취소하며, 클립보드 거부는 읽기 전용 양식으로 복구한다. mail client 실행 성공을 확정하거나 별도 접수 form/API/DB를 만들지 않는다. 실제 이메일 발송은 수행하지 않는다.

### CNS-01 — 동의 전 외부 분석 요청이 없다

- **P0 / 기존 확장 / 브라우저·네트워크 관측**.
- 준비: 새 browser context. 먼저 GA4/분석 승인 flag=false, 이어 테스트용 두 flag=true·미동의 환경을 별도로 만든다. production의 승인 flag 누락은 별도 기동 실패 검사다.
- 실행: 목록·상세·공유·스크롤을 수행한다.
- 기대: 비활성이면 분석 선택 UI·Measurement ID 노출과 신규 선택 저장 없음. 과거 localStorage 값까지 자동 삭제된다고 기대하지 않는다. 두 flag=true라도 미동의 상태의 Google 요청·ping·신규 _ga cookie는 0.
- 추가 검증: 거부 상태에서도 콘텐츠와 views API는 작동한다. 네트워크 listener를 페이지 이동 전에 등록한다.
- 참고: [consent browser](../../tests/browser/consent.test.ts), [consent 단위](../../tests/consent.test.ts).

### CNS-02 — 동의 철회와 늦은 callback이 전송을 재개하지 않는다

- **P0 / 기존 확장 / 브라우저 + 단위**.
- 준비: GA4·분석 승인 flag=true, 합성 analytics adapter. tag 로드를 보류할 수 있게 만든다.
- 실행: 동의→로드 완료 전 철회→늦은 load/error callback 전달→다시 탐색.
- 기대: 철회 후 event 0, 현재 domain _ga/_ga_* 삭제. 늦은 callback이 새 동의 상태를 덮어쓰지 않는다.
- 변형: 손상·만료 저장값, localStorage 읽기/쓰기 예외, 허용 후 경로 재방문을 독립 검사한다.
- 추가 검증: 허용 event에도 제목·본문·원문 URL·내부 postId·회원 식별자 없음. 자체 전송 queue/DB fallback 없음.
- 잔여: 저장값 읽기·쿠키 삭제 실패 안내는 현행 구현에서 누락돼 있다. 실패 입력별 요구 피드백을 보완하기 전 전체 케이스를 통과로 올리지 않는다. 실제 GA4 자동 page_view/Enhanced Measurement·DebugView 검사는 대체 tag 결과와 분리한다.
