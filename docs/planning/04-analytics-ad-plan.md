# 블라리요 분석·광고 계획

- 문서 상태: M0 내부 조회·후속 GA4/광고 요구사항 정본
- 기준일: 2026-08-14
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [05-benchmark-spec.md](./05-benchmark-spec.md)

## 1. 화면 기준

- 초기 게시판은 `짤/meme`, URL은 `/meme`이다.
- `/`는 `/meme`으로 리다이렉트한다.
- 추후 `익게/community`, `뉴스/news`와 다른 게시판을 추가할 수 있다.
- 목록은 게시글 20개이며 광고 행은 개수에서 제외한다.
- 상세 하단 목록은 현재 글과 같은 게시판에서 페이지당 최대 20개이며 페이지 번호 이동을 제공한다.

## 2. 분석 원칙

분석은 두 종류로 분리한다.

| 구분 | 목적 | 동의 |
| --- | --- | --- |
| 필수 내부 통계 | 서비스 동작과 게시글 소비 확인 | 서비스 운영에 필요한 최소 범위 |
| 선택 GA4 | 후속 단계의 유입 경로, 기기, 화면 흐름 분석 | 분석 동의 후 |

- GA4에 동의하지 않아도 콘텐츠를 볼 수 있어야 한다.
- M1 이후에는 GA4 동의 여부와 관계없이 네이버·카카오·Google·Apple 회원가입·로그인이 동작해야 한다.
- 내부 식별자와 GA 식별자를 결합하지 않는다.
- 이메일, 닉네임, 블라리요 회원 번호, 소셜 제공자·제공자 식별자, 본문, 댓글, 권리자 요청 내용을 분석 이벤트에 넣지 않는다.
- GA4 User-ID는 초기에는 사용하지 않는다.
- 광고·제휴 기능을 켜기 전에는 관련 이벤트를 보내지 않는다.

## 3. 필수 내부 이벤트

| 이벤트 | 발생 시점 | 필드 |
| --- | --- | --- |
| `FEED_VIEW` | `/meme` 목록 응답 성공 | `anonymousId`, `sessionId`, `boardSlug`, `listPage`, `itemCount`, `occurredAt` |
| `POST_VIEW` | 공개 상세 응답 성공 | `anonymousId`, `sessionId`, `boardSlug`, `postId`, `occurredAt` |
| `DETAIL_LIST_VIEW` | 상세 하단 목록 최초·페이지 이동 응답 성공 | `anonymousId`, `sessionId`, `boardSlug`, `postId`, `listPage`, `itemCount`, `occurredAt` |

- `anonymousId`는 무작위 값으로 만들고 회원 정보와 연결하지 않는다.
- `sessionId`는 탭 또는 일정 시간 무활동 단위로 갱신한다.
- 원문 IP와 User-Agent 전체 문자열을 제품 이벤트에 저장하지 않는다.
- 구체적인 보관기간은 개인정보처리방침 확정값을 따른다.

## 4. 선택 GA4 이벤트

GA4는 M0 배포 범위가 아니다. 후속 단계에서 활성화한 뒤 분석 동의가 있을 때만 다음 이벤트를 전송한다.

| 이벤트 | 발생 시점 |
| --- | --- |
| `page_view` | route별 첫 화면 표시 |
| `select_content` | 목록에서 게시글 선택 |
| `share` | 공유 방식 선택 |
| `scroll` | 상세 주요 구간 도달 |

- `/`에서 `/meme`으로 이동할 때 중복 `page_view`를 보내지 않는다.
- 숨김·삭제 게시글의 제목과 번호를 GA4에 보내지 않는다.
- 카카오톡, X/Twitter 공유 URL에 내부 식별자를 붙이지 않는다.
- `login`, `sign_up` 이벤트를 사용하더라도 `method`에는 `naver`, `kakao`, `google`, `apple` 같은 제공자 코드만 보내고 계정 식별자·이메일·프로필 값은 보내지 않는다.

## 5. 동의 UI

- 필수 저장, 선택 분석, 선택 광고를 구분한다.
- 분석과 광고는 각각 독립적으로 선택할 수 있다.
- 저장된 선택이 없는 최초 접속에는 콘텐츠를 막지 않는 하단 배너를 표시한다.
- `필수만`, `모두 허용`, `선택 저장`을 제공한다.
- 하단 배너의 `설정`은 쿠키 설정 modal을 연다.
- `선택 저장`은 값을 저장한 뒤 modal과 하단 배너를 닫는다.
- 푸터의 `/cookie-settings`에서 언제든 변경할 수 있다.
- 동의 철회 후 관련 외부 tag와 저장값을 제거한다.
- 분석 동의 전에는 consent mode의 cookieless ping을 포함한 Google Analytics 요청을 전송하지 않는다.

## 6. 광고 위치

광고는 M0 배포 범위가 아니다. 후속 단계에서 활성화할 때 아래 위치 계약을 적용한다.

### 목록

| 슬롯 | 위치 |
| --- | --- |
| `AD-FEED-INLINE` | `/meme` 목록 중간 광고 행 1개 |

- 첫 게시글 앞에는 넣지 않는다.
- 게시글 행과 다른 배경과 `광고` 표기를 사용한다.
- 게시글 20개 산정과 페이지 계산에 포함하지 않는다.

### 상세

| 슬롯 | 위치 |
| --- | --- |
| `AD-POST-BODY-BOTTOM` | 본문과 출처 다음 |
| `AD-DETAIL-LIST-INLINE` | 하단 목록 중간 |
| `AD-DETAIL-LIST-AFTER` | 하단 목록 아래 |

- 상세 상단, 측면, 앵커, 전면형 광고는 두지 않는다.
- 로그인·정책·오류 화면에는 광고를 넣지 않는다.
- 광고를 게시글이나 출처처럼 보이게 만들지 않는다.

## 7. 광고 실패와 차단

| 상태 | 처리 |
| --- | --- |
| timeout, no-fill, 네트워크 오류 | 슬롯을 접고 콘텐츠 유지 |
| 광고 차단 확인 | 닫을 수 있는 전면 dim modal 표시 가능 |
| 판정 불명 | 일반 실패로 처리 |

- 광고 실패를 광고 차단으로 간주하지 않는다.
- modal이 열린 동안 배경 조작과 스크롤은 막되 닫기, `계속 보기`, `Escape`로 즉시 닫을 수 있다.
- modal을 닫은 뒤에는 본문, 공유, 목록 이동을 막지 않는다.
- 사용자가 `계속 보기`를 선택하면 같은 세션에서 다시 표시하지 않는다.
- 광고 script 오류가 페이지 JavaScript를 중단시키지 않게 격리한다.

## 8. 광고 이벤트

광고 기능을 실제로 시작한 뒤에만 기록한다.

| 이벤트 | 필드 |
| --- | --- |
| `ad_slot_request` | `slot`, `boardSlug`, `postId` |
| `ad_impression` | `slot`, `boardSlug`, `postId` |
| `ad_load_failed` | `slot`, `reason` |
| `adblock_notice` | `action`, `placement` |

광고 사업자가 금지하는 방식으로 노출·클릭을 자체 집계하거나 클릭을 유도하지 않는다.

## 9. 제휴

- 쿠팡 파트너스 같은 제휴 링크를 사용할 수 있다.
- 일반 게시글과 제휴 콘텐츠를 구분한다.
- 링크 가까이에 광고·제휴 관계와 수수료 수취 가능성을 표시한다.
- 외부 쇼핑몰 이동임을 버튼 문구에서 알 수 있게 한다.
- 제휴 클릭은 `affiliate_click`으로 기록할 수 있다.

## 10. 자동 수집 분석

- 후보 수집량과 실패는 내부 운영 로그로만 본다.
- 후보 제목, 본문, 원문 URL을 GA4로 보내지 않는다.
- 수집 worker는 초안·예약·발행 권한을 갖지 않는다.
- 운영자가 확인한 뒤 이미지 저장, 초안, 즉시 또는 예약 발행을 실행한다.

## 11. Feature flag 제안

```text
ANALYTICS_ENABLED=true
GA4_ENABLED=false
SOCIAL_LOGIN_NAVER_ENABLED=false
SOCIAL_LOGIN_KAKAO_ENABLED=false
SOCIAL_LOGIN_GOOGLE_ENABLED=false
SOCIAL_LOGIN_APPLE_ENABLED=false
ADS_ENABLED=false
ADS_FEED_INLINE_ENABLED=false
ADS_POST_BODY_BOTTOM_ENABLED=false
ADS_DETAIL_LIST_INLINE_ENABLED=false
ADS_DETAIL_LIST_AFTER_ENABLED=false
ADS_ADBLOCK_NOTICE_ENABLED=false
AFFILIATE_ENABLED=false
```

광고와 GA4를 실제로 시작하는 날짜나 트래픽 기준은 아직 정하지 않았다. 정하지 않은 MAU, PV, 수익 목표를 시작 조건으로 사용하지 않는다.

## 12. 검수 기준

### M0

- `/meme` 목록 조회가 한 번의 `FEED_VIEW`로 기록된다.
- 숨김 게시글의 콘텐츠 정보가 내부 이벤트에 남지 않는다.
- 게시판 추가 시 `boardSlug` 값만 확장되고 이벤트 구조는 바뀌지 않는다.

### 후속 GA4·광고·M1

- 분석 거부 시 Google tag 요청이 발생하지 않는다.
- 분석 거부 상태에서도 네 provider 가입·로그인이 정상 동작한다.
- 소셜 로그인·가입 이벤트에 회원 번호, provider subject, 이메일, 닉네임이 포함되지 않는다.
- 광고 행을 제외하고 게시글 20개가 유지된다.
- 상세 광고가 지정한 세 위치에만 있다.
- 광고 실패·차단 상태에서도 콘텐츠를 볼 수 있다.
- 숨김 게시글의 콘텐츠 정보가 분석·광고 이벤트에 남지 않는다.
