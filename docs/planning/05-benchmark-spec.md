# Blariyo 벤치마킹 스펙 정리

- 문서 상태: 4차 감사 정정 반영
- 기준일: 2026-08-12
- 대상 서비스: 블라리요
- 벤치마킹 기준: 고급유머 웹
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [04-analytics-ad-plan.md](./04-analytics-ad-plan.md)

## 1. 목적

이 문서는 고급유머를 참고해 블라리요의 기능 스펙, 기술 스펙, 메뉴 스펙을 개발 전에 정리하기 위한 기준표다.

목표는 고급유머를 그대로 복제하는 것이 아니다. 블라리요는 운영자 큐레이션형 유머 웹으로 시작하고, 사용자가 빠르게 게시글을 고르고 상세를 연속 소비하는 흐름만 먼저 검증한다.

## 2. 벤치마킹 관찰 요약

2026-08-11 Chrome 기준으로 확인한 고급유머 웹 구조는 아래와 같다.

| 영역 | 관찰 내용 | 블라리요 적용 방향 |
| --- | --- | --- |
| 홈 | 최신 게시글이 행 목록으로 바로 노출됨 | 카드형 피드보다 게시판형 목록 우선 |
| 상단 메뉴 | 적은 수의 게시판 메뉴와 PR 진입점 | 블라리요 게시판 메뉴는 `유머`, `이야기` 2개만 사용 |
| 목록 행 | 제목, 반응 수, 작성 주체, 번호, 시각이 밀도 있게 표시됨 | 번호, 게시판, 제목, 조회 수, 작성자, 시각 사용 |
| 목록 광고 | 게시글 사이에 광고 블록 삽입 | `AD-FEED-INLINE` 후보로 반영 |
| 상세 | 제목, 번호, 날짜, 본문, 출처, 반응, 댓글, 하단 목록이 세로로 이어짐 | M0에서는 댓글 대신 하단 목록 중심 |
| 상세 광고 | 우측 세로 광고, 본문 주변 광고, 하단 광고가 존재 | 블라리요는 본문·출처 다음, 하단 목록 중간, 목록 아래의 3개 위치만 반영 |
| 광고 차단 | 광고 차단 해제 요청 영역이 존재 | 열람 차단 없는 안내형 UX로 반영 |
| PR | 상품형 게시물 모음과 쿠팡 링크가 별도 흐름으로 존재 | `/partners` 후보와 상품형 상세 CTA로 분리 |
| 출처 표기 | 외부 커뮤니티나 원문 사이트 출처가 상세에 표시됨 | 자동 수집과 출처·권리 검수를 분리 |
| 페이지 이동 | 번호 기반 페이지네이션 사용 | 무한 스크롤 배제, 페이지네이션 유지 |

## 3. 메뉴 스펙

### M0 공개 메뉴

| 메뉴 | 경로 | 노출 위치 | 목적 | 상태 |
| --- | --- | --- | --- | --- |
| 블라리요 로고 | `/` | 헤더 좌측 또는 중앙 | 두 게시판 혼합 최신 목록으로 이동 | 필수 |
| 유머 | `/boards/humor` | 헤더 또는 목록 상단 탭 | 짧은 유머 게시글 목록 | 필수 |
| 이야기 | `/boards/talk` | 헤더 또는 목록 상단 탭 | 읽는 흐름이 있는 게시글 목록 | 필수 |
| 공유 | 현재 상세 URL | 상세 헤더 우측 | 링크 복사, 카카오톡, X/Twitter 공유 | 필수 |
| 이용약관 | `/terms` | 푸터 | 현행 이용약관 열람 | 필수 |
| 개인정보 처리방침 | `/privacy` | 푸터 | 현행 개인정보 처리방침 열람 | 필수 |
| 권리자 요청 | `/rights` | 푸터 | 게시 중단·수정 요청 접수 | 필수 |
| 쿠키 설정 | `/cookie-settings` | 푸터 | 분석·광고 동의 변경 | 필수 |

`/`는 `HUMOR`, `TALK`의 공개 글을 합친 최신 목록이지만 게시판이 아니며 `최신` 같은 별도 세 번째 메뉴를 만들지 않는다. 루트에서는 두 게시판 탭 중 어느 것도 선택된 게시판처럼 표시하지 않는다.

### 광고·제휴 실험 메뉴

| 메뉴 | 경로 | 노출 위치 | 시작 조건 | 비고 |
| --- | --- | --- | --- | --- |
| 제휴 상품 | `/partners` | 푸터 또는 별도 링크 | 광고 실행 게이트 통과 후 | 일반 최신 목록과 분리 |
| 제휴 상품 상세 | `/posts/:postNo` | 상품형 게시글 본문 | 제휴 링크 운영 준비 후 | `상품링크 보기` CTA 포함 |
| 광고 해제 도움말 | `/help/adblock` 후보 | 광고 차단 안내 내부 | 광고 실험 시작 후 | 본문 안에 긴 설명을 넣지 않음 |

### 관리자 메뉴

M0에서는 관리자 웹 메뉴를 만들지 않는다. 보호된 API 또는 Swagger로 운영한다.

| 메뉴 | 경로 후보 | 단계 | 목적 |
| --- | --- | --- | --- |
| 관리자 로그인 | `/admin/login` | M1 후보 | 운영자 인증 |
| 게시글 관리 | `/admin/posts` | M1 후보 | 등록, 수정, 숨김 |
| 제보 검수 | `/admin/submissions` | M1.5 후보 | 승인형 제보 처리 |
| 신고 관리 | `/admin/reports` | M1 후보 | 신고 확인과 수동 처리 |

## 4. 기능 스펙

### 홈 목록

| 기능 | 스펙 | 우선순위 |
| --- | --- | --- |
| 게시판 선택 | `유머`, `이야기` 2개 탭만 제공. 루트 혼합 목록은 별도 탭 없음 | M0 |
| 목록 조회 | `published_at DESC, post_no DESC`, 게시글 20개 고정 페이지네이션 | M0 |
| 행 표시 | 번호, 게시판, 제목, 조회 수, 작성자, 시각 | M0 |
| 상세 이동 | 행 클릭 시 `/posts/:postNo` 이동 | M0 |
| 목록 중간 광고 | 4~6번째 게시글 이후 광고 행 1개 후보. 게시글 20개 산정에서 제외 | 광고 실험 |
| 페이지네이션 | 이전, 현재 주변 번호, 다음 | M0 |
| 검색 | 제공하지 않음 | 제외 |

### 게시글 상세

| 기능 | 스펙 | 우선순위 |
| --- | --- | --- |
| 상세 조회 | `/posts/:postNo` | M0 |
| 제목·메타 | 게시판, 제목, 번호, 발행 시각, 조회 수 | M0 |
| 본문 | 텍스트와 이미지 표시, 이미지 대체 텍스트 포함 | M0 |
| 출처 | 외부 콘텐츠는 출처명과 원문 링크 필수 | M0 |
| 공유 | 기본 공유, 링크 복사, 카카오톡, X/Twitter | M0 |
| 상세 하단 목록 | 같은 게시판의 현재 글 주변 게시글을 현재 글 포함 최대 20개 재노출 | M0 |
| 현재 글 표시 | 하단 목록에서 현재 글에 `isCurrent=true`와 시각적 현재 상태 표시 | M0 |
| 상세 광고 | `AD-POST-BODY-BOTTOM`, `AD-DETAIL-LIST-INLINE`, `AD-DETAIL-LIST-AFTER`만 허용 | 광고 실험 |
| 이전·다음 | 버튼, 필드, 별도 API 모두 제공하지 않음 | 제외 |
| 댓글 | M0에서는 제외 | M1 |

### 광고 차단 해제 요청

| 기능 | 스펙 | 우선순위 |
| --- | --- | --- |
| 감지 | 광고 슬롯 로드 실패 또는 차단 추정 시 표시 | 광고 실험 |
| 위치 | 활성 광고 슬롯 내부 또는 상세 하단의 비차단 안내 영역 | 광고 실험 |
| 문구 | 운영비 안내 중심, 과도한 경고 금지 | 광고 실험 |
| 액션 | `계속 보기`, `해제 방법`, `다시 확인` | 광고 실험 |
| 제한 | 본문 열람, 공유, 목록 이동 차단 금지 | 광고 실험 |
| 재노출 | 같은 세션에서 닫으면 다시 표시하지 않음 | 광고 실험 |

### 제휴 상품형 콘텐츠

| 기능 | 스펙 | 우선순위 |
| --- | --- | --- |
| 제휴 목록 | `/partners` 후보, 상품 번호와 제목 목록 | 제휴 실험 |
| 상품 링크 | 외부 쇼핑몰 이동 CTA | 제휴 실험 |
| 자료 보기 | 관련 게시글 상세로 이동 | 제휴 실험 |
| 수수료 고지 | 목록 상단과 상세 CTA 주변에 표시 | 제휴 실험 |
| 상품형 상세 | 일반 상세 구조 유지, 본문 상단에 `상품링크 보기` | 제휴 실험 |
| 이벤트 | `affiliate_click` 기록 | 제휴 실험 |

### 출처 후보 수집

| 기능 | 스펙 | 우선순위 |
| --- | --- | --- |
| 후보 URL 등록 | 운영자가 외부 원문 URL을 입력 | M0 |
| 출처 메타 입력 | 출처명, 원문 URL, 원본 유형, 권리 상태 입력 | M0 |
| 후보 수집 도구 | 지정 URL 또는 출처별 목록의 제목, 대표 이미지 후보, 원문 링크를 임시 저장 | M1 후보 |
| 출처별 자동 수집 | 허용 목록 기반 adapter가 정해진 주기로 후보를 수집 | M1 후보 |
| 중복 감지 | 원문 URL, 제목 유사도, 이미지 해시 후보로 중복 경고 | M1 후보 |
| 후보 검수 | 운영자가 검수 상태를 승인 또는 반려로 변경. 게시글 생성 없음 | M0 수동 |
| 초안 생성 | 승인 후보에서 `DRAFT` 게시글 하나를 별도 생성 | M0 수동 |
| 최종 발행 | 권리 상태와 초안을 재확인한 뒤 별도 발행 API 실행 | M0 수동 |
| 삭제 요청 연계 | 권리자 요청 시 게시글, 이미지, 캐시를 함께 비노출 | M0 |

후보 수집은 공개 발행이 아니다. 자동 수집은 M1의 필수 기능이 아니라 수동 후보 준비 시간이 병목일 때만 여는 운영 자동화 후보다. 결과는 임시 큐에만 저장하고 운영자가 본문, 이미지, 출처, 권리 상태를 확인해야 한다. 자동 승인, 자동 초안 생성, 자동 최종 발행은 금지한다.

#### 수집 파이프라인

```text
SourceAdapter
  -> 목록 후보 수집
  -> 상세 후보 수집
  -> 정규화
  -> 중복 검사
  -> 임시 큐 저장
  -> 운영자 검수 승인
  -> 별도 API로 게시글 초안 생성
  -> 권리 상태 확정
  -> 별도 API로 최종 발행
```

자동화가 담당하는 범위는 `후보 찾기`, 허용 필드 fetch, 정규화, 중복 경고까지다. 본문 편집, 이미지 사용 판단, 후보 승인, 초안 생성, 권리 상태 확정, 공개 발행은 운영자가 각각 명시적으로 실행한다.

#### 출처별 adapter 계획

| 출처 후보 | 초기 정책 상태 | 활성화 조건 | 제한 |
| --- | --- | --- | --- |
| 이토랜드 | `UNAPPROVED` | 이용조건, robots, 허용 경로·필드, 요청 빈도, 담당자 승인 | 승인 전 수집 금지 |
| 펨코 | `UNAPPROVED` | 이용조건, robots, 허용 경로·필드, 요청 빈도, 담당자 승인 | 승인 전 수집 금지 |
| 개드립넷 | `UNAPPROVED` | 이용조건, robots, 허용 경로·필드, 요청 빈도, 담당자 승인 | 승인 전 수집 금지 |
| 고급유머 | `REFERENCE_ONLY` | 기능 관찰만 수행 | 후보 큐 저장과 발행 대상 아님 |

출처 정책에는 `allowed_paths`, `allowed_fields`, `terms_checked_at`, `robots_checked_at`, `reviewed_by`, `next_review_at`, `request_interval_seconds`를 기록한다. 기본 허용 필드는 canonical 원문 URL, 제목, 원문 게시 시각, 원문 게시판명, 대표 이미지 URL 후보, 수집 시각뿐이다. 작성자명과 반응 수는 별도 목적·보관기간 승인을 받지 않으면 수집하지 않는다. HTML 전문과 이미지 원본 파일은 저장하지 않는다.

#### 수집 상태

`fetch_status`와 `review_status`는 독립 상태 축이다. `candidate_status` 같은 중복 상태 필드는 두지 않는다.

| 필드 | 상태 | 의미 |
| --- | --- | --- |
| `fetch_status` | `NOT_REQUIRED` | 수동 입력으로 원격 fetch 불필요 |
| `fetch_status` | `PENDING` | fetch 대기 |
| `fetch_status` | `FETCHING` | 제한된 fetch 실행 중 |
| `fetch_status` | `SUCCEEDED` | 허용 필드 정규화 완료 |
| `fetch_status` | `FAILED` | 일시 실패. 제한된 재시도 가능 |
| `fetch_status` | `BLOCKED` | 정책·차단·인증 요구로 재시도 금지 |
| `review_status` | `PENDING` | 검수 대기 |
| `review_status` | `IN_REVIEW` | 운영자 검수 중 |
| `review_status` | `APPROVED` | 초안 생성 가능. 공개 상태 아님 |
| `review_status` | `REJECTED` | 품질·정책·권리 사유로 사용하지 않음 |
| `review_status` | `DUPLICATE` | 기존 후보 또는 게시글과 중복 |
| `review_status` | `EXPIRED` | 30일 안에 검수하지 못해 종료 |

허용 전이는 `PENDING -> FETCHING -> SUCCEEDED|FAILED|BLOCKED`, `FAILED -> PENDING`, `PENDING -> IN_REVIEW -> APPROVED|REJECTED|DUPLICATE`다. 수동 입력은 `fetch_status=NOT_REQUIRED`로 시작할 수 있다. `SUCCEEDED` 또는 `NOT_REQUIRED`가 아니면 검수를 시작할 수 없다.

#### 후보 보관

- `PENDING`, `IN_REVIEW` 후보 payload는 생성 후 최대 30일 보관하고 미처리 시 `EXPIRED`로 전환한다.
- `REJECTED`, `DUPLICATE`, `EXPIRED`, `BLOCKED` payload는 상태 확정 후 7일 안에 삭제한다.
- `APPROVED` payload는 초안 생성 후 7일 안에 삭제한다.
- canonical URL hash, 출처 코드, 상태, 사유 코드, 처리 시각, `draft_post_no` 연결 기록은 중복 방지와 감사 목적으로 180일 보관한다.

#### 수집 제한값

```text
SOURCE_CANDIDATE_ENABLED=false
SOURCE_CANDIDATE_INTERVAL_MINUTES=360
SOURCE_CANDIDATE_MAX_PAGES_PER_SOURCE=2
SOURCE_CANDIDATE_MAX_DETAIL_PER_RUN=30
SOURCE_CANDIDATE_TIMEOUT_SECONDS=5
SOURCE_CANDIDATE_MAX_HTML_BYTES=1048576
SOURCE_CANDIDATE_RESPECT_ROBOTS=true
```

## 5. 기술 스펙

### 프론트엔드 구조

| 영역 | 적용안 |
| --- | --- |
| 렌더링 | Nuxt 기반 SSR 또는 SSG 후보. 상세 OG 생성을 위해 서버 렌더링 우선 |
| 홈 컴포넌트 | `BoardTabs`, `PostBoardList`, `Pagination`, `InlineAdSlot` |
| 상세 컴포넌트 | `PostHeader`, `ShareMenu`, `PostBody`, `SourcePanel`, `ContextPostList` |
| 광고 컴포넌트 | `FeedInlineAdSlot`, `PostBodyBottomAdSlot`, `DetailListInlineAdSlot`, `DetailListAfterAdSlot`, `AdBlockNotice`, `AffiliateCta` |
| 제휴 컴포넌트 | `PartnerList`, `PartnerListItem`, `AffiliateDisclosure` |
| 상태 컴포넌트 | `LoadingState`, `EmptyState`, `ErrorState`, `HiddenPostState` |

### API 스펙

| Method | Path | 용도 | 단계 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/posts` | `board` 미지정 시 혼합 목록, 지정 시 게시판별 목록. 게시글 20개 고정 | M0 |
| `GET` | `/api/v1/posts/:postNo` | 상세와 같은 게시판의 `contextPosts` 최대 20개 | M0 |
| `POST` | `/api/v1/admin/posts` | 수동 게시글 초안 생성 | M0 |
| `PATCH` | `/api/v1/admin/posts/:postNo` | 초안·권리 상태 수정, 숨김, 예약 취소 | M0 |
| `POST` | `/api/v1/admin/posts/:postNo/publish` | 즉시 또는 예약 최종 발행. `Idempotency-Key` 필수 | M0 |
| `POST` | `/api/v1/events/visit` | 내부 방문 이벤트 | M0 |
| `POST` | `/api/v1/events/share` | 공유 이벤트 | M0 |
| `POST` | `/api/v1/events/adblock` | 광고 차단 안내 이벤트 | 광고 실험 |
| `POST` | `/api/v1/events/affiliate-click` | 제휴 링크 클릭 이벤트 | 제휴 실험 |
| `GET` | `/api/v1/partners` | 제휴 상품 목록 | 제휴 실험 |
| `POST` | `/api/v1/admin/source-candidates` | 후보 URL 수동 등록. `Idempotency-Key` 필수 | M0 수동 |
| `GET` | `/api/v1/admin/source-candidates` | `fetch_status`, `review_status`별 임시 큐 조회 | M0 수동 |
| `PATCH` | `/api/v1/admin/source-candidates/:candidateNo/review` | 검수 시작, 승인, 반려, 중복 판정 | M0 수동 |
| `POST` | `/api/v1/admin/source-candidates/:candidateNo/draft` | 승인 후보에서 초안 하나 생성. `Idempotency-Key` 필수 | M0 수동 |
| `POST` | `/api/v1/admin/source-candidates/collect` | 활성 출처 정책의 제한된 자동 수집 실행. `Idempotency-Key` 필수 | M1 운영 자동화 후보 |

`GET /api/v1/posts`의 공개 조건은 `post_status=PUBLISHED`, `rights_status=CLEARED`, `published_at <= now()`다. `page=1`이 기본이고 페이지 크기는 게시글 20개로 고정하며 광고 행은 응답과 페이지 계산에서 제외한다. `board` 미지정은 `/`의 `HUMOR`, `TALK` 혼합 최신 목록이고 `board=HUMOR|TALK`는 게시판별 목록이다.

상세의 `contextPosts`는 현재 글과 같은 게시판에서 `published_at DESC, post_no DESC`로 정렬하고 현재 글을 반드시 포함한다. 최신·오래된 방향 중 부족한 수량은 반대편에서 채우며 최대 20개다. `isCurrent`를 제공하고 이전·다음 필드, 별도 `/adjacent` API, 목록 페이지네이션은 두지 않는다.

검수 API는 `review_status`만 바꾸고 게시글을 생성하지 않는다. 초안 생성 API는 `review_status=APPROVED`일 때만 `post_status=DRAFT` 게시글 하나를 만들고 `draft_post_no`와 `source_candidate_no`를 연결한다. 공개는 공통 최종 발행 API만 담당한다.

### 주요 데이터 필드

| 도메인 | 필드 | 설명 |
| --- | --- | --- |
| 게시글 | `post_no` | 공개 번호 |
| 게시글 | `board_code` | `HUMOR`, `TALK` |
| 게시글 | `title` | 목록과 상세 제목 |
| 게시글 | `body` | 본문 |
| 게시글 | `summary` | OG description과 목록 보조 데이터 |
| 게시글 | `source_type` | `ORIGINAL`, `EXTERNAL` |
| 게시글 | `source_name` | 출처명 |
| 게시글 | `source_url` | 외부 원문 URL |
| 게시글 | `post_status` | `DRAFT`, `SCHEDULED`, `PUBLISHED`, `HIDDEN`, `ARCHIVED` |
| 게시글 | `rights_status` | `PENDING`, `CLEARED`, `REJECTED`, `DISPUTED` |
| 게시글 | `source_candidate_no` | 후보 초안의 nullable unique 연결키 |
| 게시글 | `submission_no` | 제보 초안의 nullable unique 연결키 |
| 게시글 | `view_count` | 조회 수 |
| 게시글 | `scheduled_at` | 예약 발행 시각 |
| 게시글 | `published_at` | 발행 시각 |
| 제휴 | `affiliate_url` | 외부 상품 링크 |
| 제휴 | `affiliate_disclosure` | 수수료 고지 문구 |
| 제휴 | `reference_post_no` | 자료보기용 게시글 번호 |
| 출처 후보 | `candidate_url` | 운영자가 입력한 원문 URL |
| 출처 후보 | `candidate_title` | 수집 또는 입력된 후보 제목 |
| 출처 후보 | `candidate_image_url` | 대표 이미지 후보 URL. 공개 저장 전 검수 필요 |
| 출처 후보 | `review_note` | 운영자 내부 검수 메모 |
| 출처 후보 | `source_site_code` | `ETOLAND`, `FMKOREA`, `DOGDRIP`, `GOODGAG_REFERENCE` |
| 출처 후보 | `canonical_url_hash` | 출처별 원문 중복 방지 키 |
| 출처 후보 | `fetch_status` | `NOT_REQUIRED`, `PENDING`, `FETCHING`, `SUCCEEDED`, `FAILED`, `BLOCKED` |
| 출처 후보 | `review_status` | `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `DUPLICATE`, `EXPIRED` |
| 출처 후보 | `draft_post_no` | 생성된 초안의 nullable unique 연결키 |
| 출처 후보 | `http_status` | 마지막 수집 HTTP 상태 |
| 출처 후보 | `duplicate_score` | 중복 가능성 점수 |

게시글 상태 전이는 `DRAFT -> SCHEDULED|PUBLISHED`, `SCHEDULED -> DRAFT|PUBLISHED`, `PUBLISHED -> HIDDEN`, `HIDDEN -> PUBLISHED`, `DRAFT|HIDDEN -> ARCHIVED`만 허용한다. 권리는 `PENDING -> CLEARED|REJECTED`, `CLEARED -> DISPUTED`, `DISPUTED -> CLEARED|REJECTED`만 허용하며 `DISPUTED` 전환은 같은 트랜잭션에서 게시글을 숨긴다. 최종 발행은 `rights_status=CLEARED`일 때만 가능하다.

후보 초안은 `candidate.draft_post_no`와 `post.source_candidate_no`, 제보 초안은 `submission.draft_post_no`와 `post.submission_no`를 각각 unique 1:1 연결키로 사용한다. 같은 `Idempotency-Key`와 payload의 재요청은 최초 결과를 반환하고, 같은 키의 다른 payload는 `409 IDEMPOTENCY_KEY_REUSED`로 거절한다. DB unique 제약과 행 잠금으로 중복 초안·중복 발행을 한 번 더 막는다.

### 광고·제휴 설정값

```text
ADS_ENABLED=false
ADS_FEED_INLINE_ENABLED=false
ADS_POST_BODY_BOTTOM_ENABLED=false
ADS_DETAIL_LIST_INLINE_ENABLED=false
ADS_DETAIL_LIST_AFTER_ENABLED=false
ADS_ADBLOCK_NOTICE_ENABLED=false

AFFILIATE_ENABLED=false
AFFILIATE_PARTNERS_PAGE_ENABLED=false
AFFILIATE_DISCLOSURE_REQUIRED=true

SOURCE_CANDIDATE_ENABLED=false
SOURCE_CANDIDATE_INTERVAL_MINUTES=360
```

### SEO와 공유

| 화면 | 필수 |
| --- | --- |
| 홈 | title, description, canonical, 기본 OG |
| 상세 | 게시글별 title, description, canonical, OG image |
| 제휴 목록 | noindex 후보 또는 별도 index 정책 결정 필요 |
| 상품형 상세 | 일반 상세 OG를 유지하되 상품 가격·구매 유도 문구를 OG에 넣지 않음 |

## 6. 우선순위

| 순서 | 항목 | 판단 |
| ---: | --- | --- |
| 1 | 게시판형 홈 목록과 상세 | M0 검증의 핵심 |
| 2 | 상세 하단 목록 | 연속 소비 장치 |
| 3 | 공유와 OG | 외부 유입 확보 |
| 4 | 광고 슬롯 자리 | 개발 전 레이아웃 고정 |
| 5 | 광고 차단 해제 요청 | 광고 실험 시점에 활성화 |
| 6 | 출처 후보 수집 큐 | 운영 시간이 병목이 될 때 |
| 7 | 제휴 상품형 콘텐츠 | 광고 게이트 이후 실험 |
| 8 | 댓글, 신고, 회원 | M1 이후 |

## 7. 제외 기준

- 네이티브 앱과 푸시
- 사용자 직접 공개 게시
- 무한 스크롤
- 검색
- 댓글 중심 경쟁
- 광고 클릭 유도 문구
- 상품 구매를 본문보다 앞세우는 상세
- 출처와 권리 확인 없는 재게시
- 후보 수집 결과의 자동 공개 발행
- 원문 사이트 차단이나 이용 조건 우회

## 8. 참고 URL

- 고급유머 홈: <https://www.goodgag.net/>
- 고급유머 상세 참고: <https://www.goodgag.net/368789>
- 고급유머 PR 목록 참고: <https://www.goodgag.net/pr>
- 고급유머 상품형 상세 참고: <https://www.goodgag.net/360583>

## 9. 4차 감사 정정 결과

- 공개 IA는 `/` 혼합 최신 목록과 `유머`, `이야기` 두 게시판 메뉴로 고정했다.
- 공개 목록과 상세 `contextPosts`는 광고를 제외한 게시글 20개로 통일했고 이전·다음 계약을 제거했다.
- 상세 광고는 본문·출처 다음, 하단 목록 중간, 목록 아래의 세 슬롯만 허용했다.
- 자동 수집은 M1 운영 자동화 후보로 제한하고 임시 큐, 운영자 검수, 초안 생성, 권리 확정, 최종 발행을 분리했다.
- 후보·게시글·권리 상태와 연결키, 멱등키, 별도 최종 발행 API를 `01-service-plan.md`와 동일하게 정리했다.
