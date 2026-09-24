# 블라리요 고급유머 벤치마킹 스펙

- 문서 상태: 벤치마킹 파생 참고자료 · 제품·화면 정본 아님
- 기준일: 2026-09-03
- 정합성 검토일: 2026-09-24 (현행 정본·소스 대조, 외부 화면 재관측 아님)
- 벤치마킹 대상: 고급유머 웹
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [04-analytics-ad-plan.md](./04-analytics-ad-plan.md)

## 1. 목적

고급유머의 화면 밀도와 연속 소비 흐름을 참고하되 블라리요의 게시판, 운영 방식, URL을 적용한다.
이 문서는 화면 참고자료이며 수집 사용 여부를 결정하지 않는다. 초기에는 벤치마킹 전용이었지만
9월 21일 확장된 수집 기획에는 포함됐다. 현행 분류·사용 조건은 [고급유머 출처 명세](content-collection/sources/goodgag.md)를 따른다.

제품 범위와 단계는 [서비스 기획서](./01-service-plan.md), 실제 화면 계약은 [화면 설계서](./03-screen-design.md)가 우선한다. 이 문서는 두 정본의 내용을 대체하지 않으며 충돌하면 해당 정본을 따른다.

## 2. 참고할 구조

| 고급유머 관찰 요소 | 블라리요 적용 |
| --- | --- |
| 첫 화면의 최신 게시글 목록 | `/meme`에서 바로 짤 목록 표시 |
| 행 중심 게시판 목록 | 번호, 제목, 조회 수, 작성자, 시각 표시 |
| 번호 페이지네이션 | 게시글 20개 단위 페이지 이동 |
| 목록 사이 광고 | 후속 광고 활성화 시 게시글과 구분된 광고 행 1개 |
| 게시판 하위 상세 URL | `/:boardSlug/posts/:postId` |
| 상세 하단 목록 | 같은 게시판의 현재 글 주변 20개와 페이지네이션 |
| 상세 출처 | 본문 하단의 출처명 전체를 원문 링크로 1회 표시 |
| 광고 차단 안내 | 화면을 dim 처리하되 닫을 수 있는 해제 요청 modal |
| PR·제휴 흐름 | 일반 글과 구분된 제휴 표시 및 외부 이동 |

## 3. 적용하지 않을 구조

- 고급유머의 게시판 이름과 URL
- 고급유머의 전체 메뉴 수
- 앱 중심 기능
- 댓글·랭킹·사용자 활동을 초기 핵심으로 삼는 구조
- 화면을 가리는 전면형 광고
- 출처 표시만으로 권리가 확보됐다고 표현하는 문구
- 수집 후보의 즉시 자동 발행

## 4. 게시판·메뉴 스펙

| 공개 순서 | 표시명 | 코드 | URL | 노출 |
| --- | --- | --- | --- | --- |
| 초기 | 짤 | `meme` | `/meme` | 초기 헤더 또는 생략 가능 |
| 추후 | 익게 | `community` | `/community` | 개발 후 노출 |
| 추후 | 뉴스 | `news` | `/news` | 개발 후 노출 |

- `/`는 `/meme`으로 리다이렉트한다.
- 초기에는 `짤`만 노출한다.
- 활성 게시판은 데이터로 관리하며 앞으로 더 추가할 수 있다.
- 로고는 `/meme`으로 이동한다.
- 공유 버튼은 상세 헤더에서 일반적인 세 점 연결형 아이콘으로 표시한다.
- M0 상세에서는 게시판 tab을 숨기고 `← / 한 줄 제목 / 공유 아이콘` 고정 헤더를 사용하며, `←`와 공유 아이콘의 접근성 이름은 각각 `목록으로`, `공유하기`로 제공한다.
- M1부터 비로그인 상태에는 `로그인`, 로그인 상태에는 최소 계정 메뉴를 두되 게시판 탐색보다 강조하지 않는다.
- 정책 링크는 푸터에 둔다.

## 5. 기능 스펙

### 짤 목록

| 기능 | 기준 |
| --- | --- |
| 경로 | `/meme` |
| 정렬 | `publishedAt DESC, postId DESC` |
| 고정 공지 | 목록 상단 0~3개, 일반 게시글·광고 산정에서 제외 |
| 게시글 수 | 페이지당 20개 |
| 행 정보 | 번호, 제목, 조회 수, 작성자, 시각 |
| 광고 | M0 미노출, 후속 활성화 시 목록 중간 광고 행 1개를 게시글 수에서 제외 |
| 이동 | 번호 페이지네이션 |
| 검색 | 초기 제외 |

### 게시글 상세

| 기능 | 기준 |
| --- | --- |
| 경로 | `/:boardSlug/posts/:postId` |
| 본문 | 텍스트와 서버 저장 이미지 |
| 출처 | 본문 하단의 출처명 전체를 원문 링크로 1회 표시 |
| 공유 | 데스크톱 floating popup·모바일 하단 share sheet에서 기본 공유, 링크 복사, 카카오톡, X/Twitter 제공 |
| 하단 목록 | 같은 게시판의 현재 글 포함 최대 20개 |
| 현재 글 | 강조하고 링크 비활성화 |
| 하단 페이지 이동 | 현재 글이 포함된 페이지를 기본 선택하고 홈과 같은 페이지 번호 방식 사용 |
| 이전·다음 | 별도 버튼과 API 없음 |

### M1 회원가입·로그인

| 기능 | 기준 |
| --- | --- |
| 제공자 | 네이버, 카카오, Google, Apple |
| 공개 열람 | 로그인 없이 가능 |
| 가입 동의 | provider 동의와 Blariyo 이용약관·개인정보 수집이용 동의를 분리 |
| 계정 키 | `provider + provider_subject`; 이메일 자동 병합 금지 |
| 계정 기능 | 로그아웃, 연결·해제, 탈퇴 |
| GA4 | 분석 동의 후 로드, 회원·provider 식별자 전송 금지 |

## 6. 콘텐츠 운영 스펙

- 선별 기준은 `관리자가 보기에 웃긴 것`이다.
- 하루 2회 게시한다.
- 1회당 10~20개를 게시한다.
- 외부 콘텐츠에는 출처명 전체를 원문 URL 링크로 표시하고 별도 `원문 보기` 버튼은 두지 않는다.
- 출처 표시는 권리 확보를 뜻하지 않는다.
- 권리 확인 완료 상태를 공개 조건으로 사용하지 않는다.
- 1차에서는 푸터 이메일로 권리자 요청을 받고 운영자가 확인한 뒤 먼저 숨기며 재공개·수정·삭제를 판단한다.

## 7. 수집 스펙

수집은 `M0 Core` 이후 수집 보조와 자동 수집 순서로 활성화한다. 계약 정본은
[콘텐츠 수집 기획](./content-collection/README.md)과 [서비스 기획서 §8](./01-service-plan.md)이다.

```text
확인된 상세 URL 또는 허용 목록에서 발견한 URL
  -> 별도 PC batch가 원문 본문·이미지·첨부·외부 링크 수집
  -> 비공개 collect DB/object에 원본·수집 결과 저장
  -> /admin/batch에서 운영자 검수 시작·승인 또는 반려
  -> 승인 결과의 본문과 검증된 이미지를 private 사본으로 승격
  -> 초안
  -> 즉시 또는 예약 발행
```

- 현재 21개 출처의 HOT_LIST·GENERAL_LIST·DETAIL_ONLY·BLOCKED 분류와 실제 접근 결과는
  [출처별 수집 명세](content-collection/README.md)에서 관리한다. 코드 존재와 운영 사용 승인은 별개다.
- Web direct URL 전달·source 설정 수정은 아직 미연결이다. `/admin/collect`의 metadata/preview 후보 흐름은 legacy 계약으로 구분한다.
- 수집 결과를 즉시 공개하지 않는다.
- M0 수집 보조는 목록·feed·pagination 없이 단일 상세 페이지 1건만 요청한다.
- 로그인, CAPTCHA, 403·429 차단을 우회하지 않고 `robots.txt` 금지 경로는 수집하지 않는다.
- 출처별 요청 간격과 일일 상한을 지키고 식별 가능한 User-Agent를 사용한다.
- 위 항목은 요구사항이며 direct robots/Crawl-delay·영속 일일 총량·redirect 상한 차이는 [P1-06](../roadmap.md)에서 추적한다.
- 동일 원문과 기존 게시글 연결을 확인한다. 이미지 checksum 검증과 운영자 화면의 중복 표시 기능은 구분한다.
- 운영자가 최종 게시 여부를 결정한다.

## 8. 이미지 스펙

- direct batch는 검수 전에 이미지·첨부를 비공개 collect 저장소에 적재한다. 승인한 결과만 검증·복사해
  content 초안으로 만들고 공개 발행은 별도 처리한다.
- legacy 후보 preview의 24시간 보존을 direct 원본에 적용하지 않는다. direct raw/media/report/queue
  보존·파기 계약은 `(미정)`이며 [수집 기획](content-collection/README.md)과 법무 정합성 검토를 따른다.
- 외부 사이트 이미지를 직접 핫링크하지 않는다.
- M0 저장소는 Cloudflare R2 Standard를 사용하고 collect 원본·content private·public media 접근을 분리한다.
  실제 이전·공개 이미지의 마지막 관측은 [운영 현재 상태](../operations/current-status.md)를 따른다.
- DB에는 저장소 key 또는 상대 경로를 저장한다.
- 저장소 구현을 바꿔도 게시글 데이터와 화면 계약이 바뀌지 않게 한다.

## 9. 광고 스펙

이 절은 후속 광고 기능의 참고 스펙이며 M0에서는 광고 행과 슬롯을 렌더링하지 않는다.

### 목록

- 게시글 사이에 `AD-FEED-INLINE` 1개를 넣을 수 있다.
- 게시글 행과 다른 시각 표현과 `광고` 표기를 사용한다.

### 상세

| 슬롯 | 위치 |
| --- | --- |
| `AD-POST-BODY-BOTTOM` | 본문과 출처 다음 |
| `AD-DETAIL-LIST-INLINE` | 하단 목록 중간 |
| `AD-DETAIL-LIST-AFTER` | 하단 목록 아래 |

- 상세에 다른 광고 슬롯을 추가하지 않는다.
- 광고 실패 시 슬롯만 접는다.
- 광고 차단이 확인된 경우에만 해제 요청을 표시한다.
- 해제 요청은 화면 전체를 dim 처리하고 열린 동안 배경 조작과 스크롤을 막는다.
- 닫기, `계속 보기`, `Escape`로 닫을 수 있으며 닫은 뒤 콘텐츠 열람을 제한하지 않는다.

### 정책

- 푸터의 이용약관·개인정보처리방침·쿠키 설정은 현재 화면 위 modal로 열고 직접 URL도 유지한다.
- 이용약관과 개인정보처리방침은 현재 적용 본문 전체를 먼저 보여주고 하단의 `버전 / 적용 기간` 행을 선택해 다른 버전을 연다.
- 권리 침해·게시 중단 문의는 푸터의 `권리 문의` 한 링크로 제공한다. mailto 실행 후 전환 신호가 없을 때 주소·제목·양식을 복사하고 alert로 알린다.
  확정 판정의 한계와 복사 실패 처리는 [화면 설계](./03-screen-design.md#권리-침해게시-중단-이메일)를 따른다.

## 10. 공유·SEO 스펙

- 목록 canonical: `https://blariyo.com/meme`
- 상세 canonical: `https://blariyo.com/{boardSlug}/posts/{postId}`
- 목록과 상세 모두 SSR 첫 응답에 OG와 Twitter Card를 제공한다.
- 상세 공유 이미지는 첫 공개 IMAGE의 절대 HTTPS URL이며 없으면 `/og/blariyo-default.png`를 사용한다.
  별도 게시글별 OG 이미지 생성기를 구현했다는 뜻은 아니다.
- 숨김 또는 삭제된 글은 404와 `noindex`를 사용한다.

## 11. 최소 API 스펙

아래는 주요 동작의 요약이며 전체 계약은 [API 설계](../system-design/03-api-design.md)가 우선한다.

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/v1/boards` | 활성 게시판 |
| `GET` | `/api/v1/boards/:boardSlug/posts?page=1` | 해당 게시판의 고정 공지 0~3개와 목록 20개 |
| `GET` | `/api/v1/boards/:boardSlug/posts/:postId` | 게시판 소속을 검증한 상세와 현재 글이 포함된 목록 페이지 번호 |
| `POST` | `/api/v1/admin/posts` | 초안 생성 |
| `PATCH` | `/api/v1/admin/posts/:postId` | 게시글·출처·예약 수정 |
| `POST` | `/api/v1/admin/posts/:postId/publish` | `mode`에 따라 즉시 또는 예약 발행 |
| `GET` | `/api/v1/admin/collect/batch-items` | direct 수집 결과 목록 |
| `POST` | `/api/v1/admin/collect/batch-items/:itemId/review` | direct 검수 상태 변경 |
| `POST` | `/api/v1/admin/collect/batch-items/:itemId/draft` | 승인한 direct 결과의 초안 승격 |
| `POST` | `/api/v1/admin/collect/candidates` | legacy 관리자 URL 지정 후보 작업 접수 |
| `POST` | `/api/v1/admin/collect/candidates/:candidateId/draft` | legacy 후보의 초안 승격 |

공개 조건은 `status=PUBLISHED`와 `publishedAt <= 현재 시각`이다. 별도 권리 확인 완료 상태를 요구하지 않는다.

## 12. 참고 URL

초기 벤치마킹에 사용한 주소다. 현재 화면·응답·수집 허용 여부를 이번에 재검증한 기록은 아니다.

- 고급유머 홈: <https://www.goodgag.net/>
- 고급유머 상세: <https://www.goodgag.net/368789>
- 고급유머 PR 목록: <https://www.goodgag.net/pr>
- 고급유머 상품형 상세: <https://www.goodgag.net/360583>
