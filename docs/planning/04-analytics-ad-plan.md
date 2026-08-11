# Blariyo 분석 및 광고 운영 설계서

- 문서 상태: 기획 재정의에 따른 광고 UX 기준 보강
- 기준일: 2026-08-11
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [02-infra-plan.md](./02-infra-plan.md), [03-screen-design.md](./03-screen-design.md), [05-benchmark-spec.md](./05-benchmark-spec.md)
- 분석 도구: MySQL 내부 이벤트 + Google Analytics 4
- 광고 후보: Google AdSense 수동 배너 + 정책상 허용되는 전면형 광고 + 쿠팡 파트너스형 제휴 링크

## 1. 결론

M0부터 GA4와 내부 방문 이벤트를 함께 사용한다. 광고는 실제 노출을 트래픽 게이트 이후로 미루되, 광고가 들어갈 화면 구조와 UX 원칙은 개발 전에 기획으로 확정한다. 나중에 광고를 억지로 붙이면 본문 소비 흐름, CLS, 동의 UI, 이전·다음 이동이 깨질 가능성이 크다.

```text
사용자 브라우저
  |-- 서비스 요청 ----------> Nuxt / Express
  |                              `-- TB_VISIT_EVENT
  |
  `-- 분석 동의 후 ---------> GA4

광고 게이트 통과 후
  `-- 광고 동의 후 ---------> 목록 중간 광고 + 상세 배너 + 차단 해제 요청 + 일 3회 제한 대형 광고

제휴 게이트 통과 후
  `-- 제휴 고지 후 ---------> 제휴 상품 목록 + 상품형 게시글 CTA
```

- 내부 이벤트는 핵심 제품 지표의 정본이다.
- GA4는 유입 채널, 기기, 화면 흐름, 캠페인 분석에 사용한다.
- GA4와 광고 태그에 이메일, 닉네임, 본문, 댓글, 제보 내용 같은 개인정보와 사용자 생성 원문을 보내지 않는다.
- 자동 배치 광고와 앵커 광고는 사용하지 않는다.
- 대형 광고는 광고 사업자가 허용하는 전면형 상품만 사용하며 자체 modal에 일반 배너를 강제로 확대하지 않는다.
- 광고 차단 해제 요청은 열람 차단이 아니라 운영비 안내로만 사용한다.
- 제휴 링크는 외부 쇼핑몰 이동과 수수료 고지를 명확히 표시한다.
- 광고·제휴 수익보다 반복 소비와 재방문을 먼저 보호한다.

## 2. 단계별 적용

| 단계 | 내부 이벤트 | GA4 | 광고 |
| --- | --- | --- | --- |
| M0 | 피드·상세·세션 | 유입·화면·콘텐츠 선택 | 노출 없음, 슬롯 후보와 동의 UX만 설계 |
| M1 | 좋아요·댓글·신고 추가 | 로그인·가입·참여 이벤트 추가 | 없음 |
| M1.5 | 제보 접수·처리 추가 | 제보 전환 이벤트 추가 | 없음 |
| 광고 실험 | 기존 측정 유지 | 광고 전후 행동 비교 | 목록 중간 광고 + 상세 배너 + 차단 해제 요청 + 대형 광고 일 최대 3회 |
| 제휴 실험 | 제휴 클릭 이벤트 추가 | 캠페인 유입 비교 | 제휴 상품 목록 + 상품형 게시글 CTA |

광고 코드는 광고 실험 시작 전까지 production bundle에 포함하지 않는다. 단, CSS layout과 컴포넌트 경계는 광고 후보를 고려해 설계한다. GA4는 M0 제한 공개 전에 적용해 비교 기준을 확보한다.

## 3. 광고 시작과 중단 게이트

### 시작 조건

다음 중 하나를 충족하면 4주 광고 실험을 검토한다.

- MAU 10,000명 이상
- 최근 30일 50,000 page view 이상
- 최소 보장 금액이 있는 직접 광고 제안 확보

아래 조건은 함께 충족해야 한다.

- M0 계속 조건을 통과함
- 최근 4주 운영 시간이 주 4시간 이하
- 광고 적용 전 Core Web Vitals 기준값을 확보함
- 개인정보처리방침, 쿠키 설정, Consent Mode가 준비됨
- AdSense 정책 검토와 `ads.txt` 배포가 완료됨
- 제휴 실험은 제휴 고지 문구, 외부 이동 표시, 수익 정산 정책이 준비됨

### 계속 조건

4주 실험 후 다음을 모두 확인한다.

- 페이지 RPM 500원 이상 또는 직접 광고 최소 보장 달성
- 광고 수익이 광고 운영에 추가된 비용보다 큼
- 피드에서 상세로 이동한 세션 비율이 기준값 대비 10% 이상 하락하지 않음
- 세션당 상세 조회 수 중앙값이 기준값 대비 10% 이상 하락하지 않음
- 모바일 CLS가 `0.1`을 넘지 않음
- 광고·제휴 관련 사용자 불만이 주 3건 이하

### 중단 조건

- 정책 위반 경고 또는 무효 트래픽 경고 발생
- 페이지 RPM이 4주 연속 300원 미만
- 광고 적용 후 핵심 소비 지표가 15% 이상 하락
- 광고가 본문, 버튼, 댓글 작성 영역을 가림
- 광고 운영과 문의 처리로 주 4시간 상한 초과
- 제휴 상품 목록이 일반 게시글 소비를 대체하거나 피드 신뢰도를 떨어뜨림

중단 시 광고 스크립트와 슬롯을 feature flag로 비활성화하고 광고 없는 기준 화면으로 즉시 복귀한다.

## 4. 손익 기준

Google AdSense의 page RPM 계산식은 다음과 같다.

```text
page RPM = 예상 수익 / page view * 1,000
월 광고 수익 = 월 page view / 1,000 * page RPM
```

도메인, 세금, 백업을 포함한 월 운영비 계획값은 50,000원으로 잡는다.

| page RPM | 월 운영비 손익분기 page view |
| ---: | ---: |
| 300원 | 약 167,000 |
| 500원 | 100,000 |
| 1,000원 | 50,000 |
| 1,500원 | 약 34,000 |

- 광고 실험 시작 기준과 손익분기 기준을 구분한다.
- 월 50,000 page view는 데이터 수집을 위한 실험 기준이다.
- 안정적인 운영비 회수 목표는 월 100,000 page view다.
- 예상 수익은 무효 트래픽 조정 전 값이므로 월 운영비와 같은 수익만 발생한 상태를 안정 구간으로 보지 않는다.

## 5. 측정 책임 분리

| 측정 항목 | 정본 | 이유 |
| --- | --- | --- |
| 일별 피드 조회 | MySQL | 서비스 내부 집계와 운영 판단 |
| 게시글별 상세 조회 | MySQL | 게시글 관리 지표와 직접 연결 |
| 세션당 상세 조회 수 | MySQL | M0 계속·중단 기준 |
| 7일 재방문율 | MySQL | 익명 사용자 기준을 직접 통제 |
| 검색·SNS·직접 유입 | GA4 | acquisition report 활용 |
| 기기·브라우저 비율 | GA4 | 화면 품질과 우선순위 판단 |
| 피드에서 상세 이동 흐름 | GA4 + MySQL | UX 분석과 정본 지표 교차 확인 |
| 광고 RPM·예상 수익 | AdSense | 광고 사업자 정산 기준 |

GA4 수치와 MySQL 수치가 다를 수 있음을 전제로 한다. 동의 거부, 광고 차단, 봇 필터, 네트워크 실패 때문에 GA4를 정산 또는 핵심 제품 지표의 단독 정본으로 사용하지 않는다.

## 6. 내부 이벤트

### `TB_VISIT_EVENT`

| `event_type` | 발생 조건 | 주요 값 |
| --- | --- | --- |
| `FEED_VIEW` | 홈 피드 응답 성공 | `anonymous_id`, `session_id`, `occurred_at` |
| `POST_VIEW` | 공개 상세 응답 성공 | 위 값 + `post_no` |

- 같은 세션의 같은 게시글 조회는 30분 안에 한 번만 조회 수에 반영한다.
- preview, 관리자, health check, 알려진 crawler 요청은 집계에서 제외한다.
- 원문 IP와 User-Agent 원문을 장기 저장하지 않는다.
- 익명 식별자는 무작위 값으로 만들고 인증 사용자 번호와 직접 결합하지 않는다.
- 원시 이벤트는 90일 보관 후 일별 집계만 남긴다.

M1 이후 좋아요, 댓글, 신고, 제보는 각 도메인 테이블 자체를 정본으로 사용하며 `TB_VISIT_EVENT`에 중복 적재하지 않는다.

## 7. GA4 이벤트

### 자동·기본 이벤트

- `page_view`
- `session_start`
- `first_visit`
- `user_engagement`
- `scroll`
- `click`

Nuxt route 변경마다 `page_view`를 한 번만 전송한다. GA4의 자동 history 변경 측정과 수동 전송을 동시에 켜서 중복 page view를 만들지 않는다.

### M0

| 이벤트 | 발생 조건 | parameter |
| --- | --- | --- |
| `select_content` | 피드 항목 선택 | `content_type=post`, `item_id`, `item_list_name=latest` |
| `post_engagement` | 상세 15초 체류 또는 본문 50% 도달 | `item_id`, `board_code` |
| `bottom_list_post_click` | 상세 하단 목록 글 선택 | `item_id`, `item_list_name=detail_bottom` |
| `source_click` | 원문 링크 선택 | `item_id`, `source_domain` |
| `share` | 공유 명령 실행 | `content_type=post`, `item_id`, `method` |
| `adblock_notice` | 광고 차단 안내 표시·닫기·다시 확인 | `action`, `placement` |
| `affiliate_click` | 제휴 상품 링크 선택 | `item_id`, `placement` |

`post_engagement`는 한 상세 화면에서 한 번만 전송한다.

### M1

| 이벤트 | 발생 조건 | parameter |
| --- | --- | --- |
| `login` | 로그인 성공 | `method=email` |
| `sign_up` | 회원가입 성공 | `method=email` |
| `like_post` | 좋아요 설정 | `item_id` |
| `comment_submit` | 댓글 등록 성공 | `item_id` |
| `report_submit` | 신고 접수 성공 | `target_type` |

### M1.5

| 이벤트 | 발생 조건 | parameter |
| --- | --- | --- |
| `submission_start` | 제보 작성 첫 입력 | 없음 |
| `submission_submit` | 제보 접수 성공 | `source_type`, `has_image` |
| `submission_withdraw` | 검수 대기 제보 철회 | 없음 |

GA4에는 다음 값을 전송하지 않는다.

- 이메일, 닉네임, 사용자 번호
- 게시글 제목과 본문
- 댓글과 제보 원문
- 출처 URL 원문
- 관리자 메모와 신고 사유 원문

## 8. 동의와 개인정보

### 기본 동작

- 첫 방문에서는 분석과 광고 동의를 모두 `denied`로 시작한다.
- M0에서는 필수 기능과 내부 익명 이벤트만 동작한다.
- 사용자가 분석을 허용한 뒤 GA4 tag를 로드한다.
- 광고 실험 단계에서 광고 동의를 별도로 받는다.
- 거부해도 피드, 상세, 댓글, 제보 기능을 사용할 수 있어야 한다.
- 푸터의 `쿠키 설정`에서 선택을 변경할 수 있게 한다.

### Consent Mode

| consent type | 용도 | 기본값 |
| --- | --- | --- |
| `analytics_storage` | GA4 cookie와 방문 분석 | `denied` |
| `ad_storage` | 광고 cookie와 identifier | `denied` |
| `ad_user_data` | 광고 측정을 위한 사용자 데이터 | `denied` |
| `ad_personalization` | 개인화 광고 | `denied` |

초기에는 basic consent mode를 사용한다. 동의 전에는 Google tag 자체를 로드하지 않는다. 광고 실험 시에도 개인화 광고는 별도 동의를 받지 못하면 비개인화 상태로 유지한다.

동의 문구, 보관 기간, 외부 전송 항목은 실제 배포 전 개인정보처리방침과 일치시키고 배포 국가 기준을 다시 검토한다.

## 9. 광고 노출 설계

### 기본 모델

```text
게시글 상세 진입
  -> 상단 배너
  -> 본문
  -> 출처
  -> 하단 배너
  -> 광고 차단 해제 요청 후보
  -> 이전·다음 게시글

상품형 게시글 진입
  -> 제휴 고지
  -> 상품링크 보기
  -> 본문
  -> 출처
  -> 하단 목록

상세를 연속 소비하는 중간 전환
  -> 조건 충족 시 대형 광고
  -> 닫기
  -> 다음 게시글
```

고급유머에서 확인되는 광고형 수익 구조는 `일반 유머 소비 흐름 + 목록 중간 광고 + 상세 광고 + 광고 차단 해제 요청 + 상품형 게시물 분리`다. 블라리요는 이를 그대로 복제하지 않고, 목록 중간 광고 행, 상세 본문 하단 광고, 상세 하단 목록 광고, 차단 해제 요청, 제한된 대형 광고, 제휴 상품형 콘텐츠를 단계별 후보로 둔다. 광고 형식과 실제 노출 방식은 계약한 광고 사업자의 최신 정책을 우선한다.

### 위치

| ID | 화면 | 위치 | 적용 |
| --- | --- | --- | --- |
| `AD-POST-BODY-BOTTOM` | 상세 | 본문과 출처 다음 | 광고 실험 기본 |
| `AD-DETAIL-LIST-INLINE` | 상세 | 상세 하단 목록 중간 | 광고 실험 기본 |
| `AD-DETAIL-LIST-AFTER` | 상세 | 상세 하단 목록 아래 | 광고 실험 후보 |
| `AD-INTERSTITIAL` | 상세 전환 | 연속 소비 중 다음 게시글로 이동하기 전 | 단계적 적용 |
| `AD-FEED-INLINE` | 홈 | 네 번째~여섯 번째 게시글 다음 | 광고 실험 후보 |
| `AD-SIDE-RAIL` | 홈·상세 | 데스크톱 보조 영역 | 광고 실험 후보 |
| `ADBLOCK-NOTICE` | 상세 | 상세 하단 목록 전 또는 우측 보조 영역 | 광고 차단 감지 시 후보 |
| `AFFILIATE-CTA` | 상품형 상세 | 본문 상단 상품링크 보기 | 제휴 실험 후보 |

홈 피드 중간 광고와 상세 하단 목록 중간 광고는 게시글 행과 구분되는 별도 광고 행으로만 넣는다. 댓글 목록에는 M1 댓글 도입 전까지 광고를 넣지 않는다. 제휴 상품 목록은 일반 최신 피드와 분리해 별도 경로에서 실험한다.

### 대형 광고 빈도 제한

- 사용자 현지 날짜 기준 하루 최대 3회다.
- 첫 방문과 첫 게시글에서는 노출하지 않는다.
- 한 세션에서 첫 대형 광고는 상세 2개를 소비한 뒤부터 후보가 된다.
- 다음 대형 광고까지 최소 3개 상세 조회와 20분 간격을 모두 충족해야 한다.
- 새로고침, 뒤로 가기, 오류 복구를 노출 횟수 증가 조건으로 사용하지 않는다.
- 광고를 닫거나 광고 호출이 실패해도 원래 이동하려던 다음 게시글로 즉시 진행한다.
- 브라우저 저장소의 일별 횟수와 마지막 노출 시각을 사용하되, 조작 방지가 수익 정산의 필수 조건은 아니다.
- 광고 사업자가 일 3회 제한을 보장하지 못하면 더 낮은 사업자 제공 빈도를 사용한다. 임의의 자체 전면 광고로 우회하지 않는다.

### 금지 위치

- 홈의 브랜드와 첫 게시글 사이
- 본문 이미지 위를 가리는 위치
- 댓글 입력과 등록 버튼 사이
- 로그인, 회원가입, 제보 작성, 내 제보
- 관리자 화면
- 오류, 404, 권리자 요청 화면
- 첫 진입, 앱 복귀, 뒤로 가기, 외부 링크 이동
- 닫을 수 없는 전면 화면과 광고 시청 강제 대기
- 콘텐츠 카드와 동일한 스타일로 위장한 광고
- 출처·권리자 요청 영역보다 먼저 사용자의 문의 경로를 가리는 광고

### 표현 규칙

- 광고 위에 `광고` 표기를 둔다.
- 콘텐츠 카드와 광고를 같은 모양으로 만들지 않는다.
- responsive 광고 영역 높이를 미리 확보해 layout shift를 막는다.
- 광고가 채워지지 않으면 빈 테두리를 남기지 않고 슬롯을 접는다.
- 하단 배너는 viewport 접근 전까지 lazy load한다.
- 광고 클릭을 유도하는 문구, 화살표, 보상 표현을 사용하지 않는다.
- 대형 광고에는 명확한 닫기 수단을 두고 시스템 뒤로 가기 동작을 막지 않는다.

### UI/UX 판정 기준

광고 시안은 아래 기준을 통과해야 한다.

| 기준 | 통과 조건 |
| --- | --- |
| 콘텐츠 우선성 | 제목, 본문 첫 이미지, 이전·다음 이동보다 광고가 더 강하게 보이지 않음 |
| 구분 가능성 | 사용자가 1초 안에 광고와 게시글을 구분할 수 있음 |
| 흐름 보존 | 광고 닫기, 실패, 차단 상태에서도 다음 글 이동이 끊기지 않음 |
| 성능 | 광고 로딩 전후 CLS `0.1` 이하 |
| 빈도 | 첫 글 금지, 일 최대 3회, 상세 3개와 20분 간격 준수 |

## 10. 구현 구조

### Nuxt

- GA4 measurement ID는 public runtime config로 주입한다.
- AdSense publisher ID와 slot ID도 환경별 public config로 분리한다.
- `AnalyticsConsent`, `AnalyticsEvent`, `AdSlot`, `InterstitialAdGate` 컴포넌트 경계를 둔다.
- GA4 script와 AdSense script는 각각 한 번만 비동기로 로드한다.
- local, test 환경에서는 실제 tag 대신 console adapter를 사용한다.
- production에서도 crawler, preview, 관리자 route에서는 분석·광고를 비활성화한다.

### Feature flag

```text
ANALYTICS_ENABLED=true
ADS_ENABLED=false
ADS_POST_BANNERS_ENABLED=false
ADS_INTERSTITIAL_ENABLED=false
ADS_INTERSTITIAL_DAILY_CAP=3
ADS_INTERSTITIAL_MIN_POST_VIEWS=3
ADS_INTERSTITIAL_MIN_INTERVAL_MINUTES=20
```

광고 중단 시 코드 배포 없이 `ADS_ENABLED=false`로 광고 기능을 끌 수 있어야 한다.

### 정적 파일

- `https://service.example.com/ads.txt`를 root에서 제공한다.
- `robots.txt`, `sitemap.xml`, `ads.txt`는 Nuxt 또는 Nginx 중 한 곳만 정본으로 관리한다.
- AdSense publisher ID가 확정되기 전에는 가짜 `ads.txt`를 배포하지 않는다.

## 11. 성능과 보안

- 광고와 분석 script는 main bundle을 막지 않게 비동기로 로드한다.
- 광고 도입 전후 LCP, CLS, INP를 같은 device 구간으로 비교한다.
- 목표 CLS는 `0.1` 이하로 유지한다.
- CSP는 처음에 `Report-Only`로 외부 요청을 확인한 뒤 enforcement로 전환한다.
- Google tag와 광고에 필요한 domain만 `script-src`, `connect-src`, `frame-src`, `img-src`에 허용한다.
- 동의 값과 measurement ID를 로그에 반복 기록하지 않는다.
- 광고 script 오류가 서비스 화면과 API 요청을 중단시키지 않게 격리한다.
- 외부 광고 iframe에 서비스 인증 정보나 사용자 생성 원문을 전달하지 않는다.

## 12. 대시보드

### 제품 대시보드

- 일별 순사용자와 세션
- 세션당 상세 조회 수 중앙값
- 피드에서 상세 이동 비율
- 1일·7일 재방문율
- 게시글별 조회와 연속 이동
- 유입 채널과 기기 비율

### 광고 대시보드

- 월 page view
- 광고가 표시된 page view 비율
- page RPM
- 슬롯별 viewability와 예상 수익
- 광고 적용 전후 상세 이동률
- 광고 적용 전후 세션당 상세 조회 수
- 월 운영비 대비 광고 수익

광고 수익만 단독으로 보지 않고 소비 지표와 함께 판단한다.

## 13. 구현 순서

### M0 제한 공개 전

1. GA4 property와 web data stream을 만든다.
2. 동의 상태 저장과 basic consent mode를 구현한다.
3. Nuxt route `page_view`와 M0 이벤트를 연결한다.
4. `TB_VISIT_EVENT` 중복 제거와 bot 제외 규칙을 구현한다.
5. GA4 DebugView와 내부 집계를 대조한다.
6. 개인정보처리방침과 쿠키 설정 링크를 연결한다.
7. 4주 기준값을 수집한다.

### 광고 게이트 통과 후

1. AdSense 계정과 사이트 검토를 진행한다.
2. `ads.txt`를 배포한다.
3. 광고·분석 동의를 분리한다.
4. `AD-POST-BODY-BOTTOM`, `AD-DETAIL-LIST-INLINE`만 먼저 켠다.
5. 2주 후 성능과 소비 지표를 점검한다.
6. 문제가 없을 때만 `AD-INTERSTITIAL`을 일 1회로 시작한다.
7. 주 단위로 일 2회, 최대 일 3회까지 단계적으로 올린다.
8. 4주 후 계속 또는 중단을 결정한다.

## 14. 완료 체크리스트

- [ ] GA4와 MySQL 지표의 역할이 화면과 코드에 반영됨
- [ ] SPA route 이동당 `page_view`가 한 번만 전송됨
- [ ] GA4에 개인정보와 사용자 원문이 전송되지 않음
- [ ] 분석 거부 상태에서 Google tag 요청이 발생하지 않음
- [ ] 쿠키 설정을 다시 열고 선택을 변경할 수 있음
- [ ] 내부 이벤트 중복 조회와 crawler 제외가 검증됨
- [ ] 광고 feature flag로 광고 슬롯을 즉시 끌 수 있음
- [ ] 광고 영역 때문에 CLS가 `0.1`을 넘지 않음
- [ ] 로그인·제보·관리자·오류 화면에 광고가 없음
- [ ] 대형 광고가 첫 게시글에 나오지 않고 일 3회·20분 간격을 넘지 않음
- [ ] 대형 광고 실패·닫기 후 원래 게시글 이동이 유지됨
- [ ] 광고 전후 제품 지표를 같은 기준으로 비교 가능함

## 참고 자료

- [Google Analytics 이벤트 설정](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [Google Analytics Consent Mode](https://support.google.com/analytics/answer/10000067)
- [Google Analytics consent type](https://support.google.com/analytics/answer/12334711)
- [Google AdSense page RPM](https://support.google.com/adsense/answer/112030)
- [Google AdSense 예상 수익](https://support.google.com/adsense/answer/32852)
