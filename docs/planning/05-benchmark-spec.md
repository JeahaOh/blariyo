# Blariyo 벤치마킹 스펙 정리

- 문서 상태: 기획 보강안
- 기준일: 2026-08-11
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
| 상단 메뉴 | 적은 수의 게시판 메뉴와 PR 진입점 | 블라리요는 `유머`, `이야기` 2개 게시판 우선 |
| 목록 행 | 제목, 반응 수, 작성 주체, 번호, 시각이 밀도 있게 표시됨 | 번호, 게시판, 제목, 조회 수, 작성자, 시각 사용 |
| 목록 광고 | 게시글 사이에 광고 블록 삽입 | `AD-FEED-INLINE` 후보로 반영 |
| 상세 | 제목, 번호, 날짜, 본문, 출처, 반응, 댓글, 하단 목록이 세로로 이어짐 | M0에서는 댓글 대신 하단 목록 중심 |
| 상세 광고 | 우측 세로 광고, 본문 주변 광고, 하단 광고가 존재 | 상세 상·하단, 우측, 하단 목록 앞 후보로 반영 |
| 광고 차단 | 광고 차단 해제 요청 영역이 존재 | 열람 차단 없는 안내형 UX로 반영 |
| PR | 상품형 게시물 모음과 쿠팡 링크가 별도 흐름으로 존재 | `/partners` 후보와 상품형 상세 CTA로 분리 |
| 출처 표기 | 외부 커뮤니티나 원문 사이트 출처가 상세에 표시됨 | 자동 수집과 출처·권리 검수를 분리 |
| 페이지 이동 | 번호 기반 페이지네이션 사용 | 무한 스크롤 배제, 페이지네이션 유지 |

## 3. 메뉴 스펙

### M0 공개 메뉴

| 메뉴 | 경로 | 노출 위치 | 목적 | 상태 |
| --- | --- | --- | --- | --- |
| 블라리요 로고 | `/` | 헤더 좌측 또는 중앙 | 홈 이동 | 필수 |
| 유머 | `/boards/humor` | 헤더 또는 목록 상단 탭 | 짧은 유머 게시글 목록 | 필수 |
| 이야기 | `/boards/talk` | 헤더 또는 목록 상단 탭 | 읽는 흐름이 있는 게시글 목록 | 필수 |
| 공유 | 현재 상세 URL | 상세 헤더 우측 | 링크 복사, 카카오톡, X/Twitter 공유 | 필수 |
| 권리자 요청 | `mailto:` 또는 안내 페이지 | 푸터 | 게시 중단·수정 요청 접수 | 필수 |
| 쿠키 설정 | `/privacy/cookie` 후보 | 푸터 | 분석·광고 동의 변경 | 필수 |

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
| 게시판 선택 | `유머`, `이야기` 2개 탭만 제공 | M0 |
| 목록 조회 | 최신순, 페이지네이션, 기본 20개 단위 | M0 |
| 행 표시 | 번호, 게시판, 제목, 조회 수, 작성자, 시각 | M0 |
| 상세 이동 | 행 클릭 시 `/posts/:postNo` 이동 | M0 |
| 목록 중간 광고 | 4~6번째 게시글 이후 광고 행 1개 후보 | 광고 실험 |
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
| 이전·다음 | 현재 글 주변 게시글로 이동 | M0 |
| 상세 하단 목록 | 최신 목록 또는 현재 글 주변 목록 재노출 | M0 |
| 상세 광고 | 상단, 하단, 하단 목록 전 후보 | 광고 실험 |
| 우측 광고 | 데스크톱 보조 영역 후보 | 광고 실험 |
| 댓글 | M0에서는 제외 | M1 |

### 광고 차단 해제 요청

| 기능 | 스펙 | 우선순위 |
| --- | --- | --- |
| 감지 | 광고 슬롯 로드 실패 또는 차단 추정 시 표시 | 광고 실험 |
| 위치 | 상세 하단 목록 위, 데스크톱 우측 보조 영역 후보 | 광고 실험 |
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
| 발행 승인 | 운영자 검수 완료 후 공개 게시글로 전환 | M0 |
| 삭제 요청 연계 | 권리자 요청 시 게시글, 이미지, 캐시를 함께 비노출 | M0 |

후보 수집은 공개 발행이 아니다. 수집 도구가 있더라도 결과는 임시 큐에만 저장하고 운영자가 본문, 이미지, 출처, 권리 상태를 확인해야 한다.

#### 수집 파이프라인

```text
SourceAdapter
  -> 목록 후보 수집
  -> 상세 후보 수집
  -> 정규화
  -> 중복 검사
  -> 임시 큐 저장
  -> 운영자 검수
  -> 게시글 초안 생성
  -> 최종 발행
```

자동화가 담당하는 범위는 `후보 찾기`와 `정규화`까지다. 본문 편집, 이미지 사용 판단, 권리 상태 확정, 공개 발행은 운영자가 한다.

#### 출처별 adapter 계획

| 출처 | 목록 후보 | 상세 후보 | 수집 방식 | 제한 |
| --- | --- | --- | --- | --- |
| 이토랜드 | 유머, 인기, 생활관, 핫딜 목록 | 제목, 작성자, 작성 시각, 추천 수, 조회 수, 본문 이미지 후보, 원문 링크 | HTML 목록 파싱 우선. 필요 시 운영자가 URL 직접 등록 | 광고성 핫딜과 일반 유머를 분리 |
| 펨코 | 포텐, 유머성 게시글 후보 | 제목, 작성자, 조회 수, 추천 수, 댓글 수, 첨부 이미지 후보, 복사 URL | 공개 상세 URL 기반 파싱. 목록은 최소 빈도 수집 | 로그인 요구·차단 발생 시 중지 |
| 개드립넷 | 개드립, 유저 개드립, 읽을거리 후보 | 제목, 댓글 수, 게시판명, 본문 이미지 후보, 출처 표시 후보 | 공개 목록과 상세 URL 파싱 | JavaScript 의존 페이지는 수집 실패로 기록 |
| 고급유머 | 구조 벤치마킹 | 메뉴, 목록 광고, 상세 하단 목록, PR 흐름 | 기능 관찰용 | 발행 후보로 저장하지 않음 |

#### 수집 상태

| 상태 | 의미 |
| --- | --- |
| `DISCOVERED` | 목록에서 후보 URL을 찾음 |
| `FETCHED` | 상세 HTML 또는 메타 정보를 가져옴 |
| `NORMALIZED` | 공통 필드로 정리함 |
| `DUPLICATE` | 기존 후보나 게시글과 중복 가능성이 높음 |
| `NEEDS_REVIEW` | 운영자 검수 필요 |
| `APPROVED` | 게시글 초안 생성 가능 |
| `REJECTED` | 사용하지 않음 |
| `BLOCKED` | 차단, 로그인 요구, CAPTCHA, 요청 실패 |

#### 수집 제한값

```text
SOURCE_CANDIDATE_ENABLED=false
SOURCE_CANDIDATE_AUTO_PUBLISH=false
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
| 상세 컴포넌트 | `PostHeader`, `ShareMenu`, `PostBody`, `SourcePanel`, `AdjacentNav`, `BottomPostList` |
| 광고 컴포넌트 | `AdSlot`, `AdBlockNotice`, `InterstitialAdGate`, `AffiliateCta` |
| 제휴 컴포넌트 | `PartnerList`, `PartnerListItem`, `AffiliateDisclosure` |
| 상태 컴포넌트 | `LoadingState`, `EmptyState`, `ErrorState`, `HiddenPostState` |

### API 스펙

| Method | Path | 용도 | 단계 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/posts` | 게시글 목록 | M0 |
| `GET` | `/api/v1/posts/:postNo` | 게시글 상세 | M0 |
| `GET` | `/api/v1/posts/:postNo/adjacent` | 이전·다음 및 하단 목록 후보 | M0 |
| `POST` | `/api/v1/events/visit` | 내부 방문 이벤트 | M0 |
| `POST` | `/api/v1/events/share` | 공유 이벤트 | M0 |
| `POST` | `/api/v1/events/adblock` | 광고 차단 안내 이벤트 | 광고 실험 |
| `POST` | `/api/v1/events/affiliate-click` | 제휴 링크 클릭 이벤트 | 제휴 실험 |
| `GET` | `/api/v1/partners` | 제휴 상품 목록 | 제휴 실험 |
| `POST` | `/api/v1/admin/source-candidates` | 후보 URL 수동 등록 | M1 후보 |
| `GET` | `/api/v1/admin/source-candidates` | 후보 수집 큐 조회 | M1 후보 |
| `POST` | `/api/v1/admin/source-candidates/collect` | 허용 출처 후보 수집 실행 | M1 후보 |
| `POST` | `/api/v1/admin/source-candidates/:candidateNo/approve` | 후보 검수 후 게시글 초안 생성 | M1 후보 |

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
| 게시글 | `view_count` | 조회 수 |
| 게시글 | `published_at` | 발행 시각 |
| 제휴 | `affiliate_url` | 외부 상품 링크 |
| 제휴 | `affiliate_disclosure` | 수수료 고지 문구 |
| 제휴 | `reference_post_no` | 자료보기용 게시글 번호 |
| 출처 후보 | `candidate_url` | 운영자가 입력한 원문 URL |
| 출처 후보 | `candidate_title` | 수집 또는 입력된 후보 제목 |
| 출처 후보 | `candidate_image_url` | 대표 이미지 후보 URL. 공개 저장 전 검수 필요 |
| 출처 후보 | `candidate_status` | `DISCOVERED`, `FETCHED`, `NORMALIZED`, `DUPLICATE`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, `BLOCKED` |
| 출처 후보 | `review_note` | 운영자 내부 검수 메모 |
| 출처 후보 | `source_site_code` | `ETOLAND`, `FMKOREA`, `DOGDRIP`, `GOODGAG_REFERENCE` |
| 출처 후보 | `fetch_status` | `DISCOVERED`, `FETCHED`, `NORMALIZED`, `BLOCKED` |
| 출처 후보 | `http_status` | 마지막 수집 HTTP 상태 |
| 출처 후보 | `duplicate_score` | 중복 가능성 점수 |

### 광고·제휴 설정값

```text
ADS_ENABLED=false
ADS_FEED_INLINE_ENABLED=false
ADS_POST_BANNERS_ENABLED=false
ADS_SIDE_RAIL_ENABLED=false
ADS_ADBLOCK_NOTICE_ENABLED=false
ADS_INTERSTITIAL_ENABLED=false
ADS_INTERSTITIAL_DAILY_CAP=3
ADS_INTERSTITIAL_MIN_POST_VIEWS=3
ADS_INTERSTITIAL_MIN_INTERVAL_MINUTES=20

AFFILIATE_ENABLED=false
AFFILIATE_PARTNERS_PAGE_ENABLED=false
AFFILIATE_DISCLOSURE_REQUIRED=true

SOURCE_CANDIDATE_ENABLED=false
SOURCE_CANDIDATE_AUTO_PUBLISH=false
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
