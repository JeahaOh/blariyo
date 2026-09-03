# 블라리요 분석·광고 계획

- 문서 상태: M0 GA4·게시글 조회 수·후속 광고 요구사항 정본
- 기준일: 2026-09-03
- 정합성 검토일: 2026-09-03
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [05-benchmark-spec.md](./05-benchmark-spec.md)

## 1. 화면 기준

- 초기 게시판은 `짤/meme`, URL은 `/meme`이다.
- `/`는 `/meme`으로 리다이렉트한다.
- 추후 `익게/community`, `뉴스/news`와 다른 게시판을 추가할 수 있다.
- 목록은 게시글 20개이며 광고 행은 개수에서 제외한다.
- 상세 하단 목록은 현재 글과 같은 게시판에서 페이지당 최대 20개이며 페이지 번호 이동을 제공한다.

## 2. 분석 원칙

- M0 Core에 GA4 연동과 동의 제어를 구현하되 production 기본값은 비활성으로 둔다. 자체 이용
  이벤트 수집 API·원시 이벤트 테이블·일별 집계 테이블은 만들지 않는다.
- M0에서 운영하는 자체 수치는 기존 참고용 게시글 조회 수뿐이며, 보안·오류 로그는 방문 분석이
  아니라 장애 대응과 비정상 요청 차단 목적으로만 유지한다.
- GA4 운영 활성화는 M0 Core 완료 조건과 분리한다. Measurement ID·속성 보관 설정·국외이전
  고지·실제 Google 계약 법인·Google tag/CSP domain이 모두 확정된 환경에서만 feature flag를 켠다.
- GA4는 저장된 분석 동의가 있을 때만 browser에서 Google tag를 한 번 동적 로드하는 기본 동의
  방식으로 사용한다.
- 동의 전에는 방문자 수·page open을 포함해 Google tag/request와 consent mode의 cookieless ping을
  0건으로 유지하고, 거부해도 콘텐츠를 볼 수 있어야 한다.
- 이메일, 닉네임, 블라리요 회원 번호, 소셜 제공자·제공자 식별자, 본문, 댓글, 권리자 요청
  내용을 분석 이벤트에 넣지 않는다.
- GA4 User-ID는 초기에는 사용하지 않는다.
- 광고·제휴 기능을 켜기 전에는 관련 이벤트를 보내지 않는다.
- GA4 보고서는 동의·브라우저 차단·처리 지연의 영향을 받으므로 공개 조회 수, 광고 정산,
  권리 판단과 사업 KPI의 단독 근거로 사용하지 않는다.

구현 시 Google의 [Consent Mode 개요](https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=en)와
[GA4 데이터 최신성](https://support.google.com/analytics/answer/11198161?hl=en)을 다시 확인한다.

## 3. 게시글 조회 수

- 목록에 표시하는 `viewCount`는 `content.board_post.view_count`의 참고용 누적값이다.
- 공개 상세 화면을 정상 표시한 브라우저가 payload 없는 전용 endpoint를 한 번 호출하면 서버가
  해당 공개 게시글의 값을 원자적으로 1 증가시킨다.
- 별도 방문자·세션 식별자, IP 원문, User-Agent, 조회 이력과 일별 집계는 저장하지 않는다.
- 새로고침, 자동화 요청과 여러 탭을 완전히 구분하지 않으므로 사람 수나 정산 수치로 사용하지 않는다.
- endpoint 실패가 상세 열람을 막아서는 안 되며 화면은 응답 전 조회 수를 그대로 표시한다.

## 4. GA4 이벤트

GA4를 활성화한 환경에서 분석 동의가 있을 때만 다음 이벤트를 전송한다.

| 이벤트 | 발생 시점 | 허용 custom parameter |
| --- | --- | --- |
| `page_view` | route별 첫 화면 표시 | `page_type`, `route_template` |
| `select_content` | 목록에서 게시글 선택 | `board_slug`, `content_type`, `list_position_bucket` |
| `share` | 공유 방식 선택 | `share_method`, `board_slug` |
| `scroll` | 상세 주요 구간 도달 | `page_type`, `scroll_depth_bucket` |

- `/`에서 `/meme`으로 이동할 때 중복 `page_view`를 보내지 않는다.
- 위 표에 없는 custom parameter는 추가하지 않는다.
- 게시글 제목·본문·원문 URL·내부 `postId`, 회원·소셜 식별자, IP, GA4 User-ID와 수집 후보
  정보는 GA4에 보내지 않는다.
- 숨김·삭제 게시글의 콘텐츠와 내부 식별자를 GA4에 보내지 않는다.
- 카카오톡, X/Twitter 공유 URL에 내부 식별자를 붙이지 않는다.
- tag 로드나 이벤트 전송이 실패하면 재시도 queue나 자체 분석 fallback을 만들지 않고 event를
  drop하며 공개 기능은 유지한다.

## 5. 동의 UI

- M0 Core에 아래 선택 UI를 구현하되, 동의가 필요한 선택 기능이 모두 비활성이면 배너를 표시하지 않는다.
- 필수 저장, 선택 분석, 선택 광고를 구분한다.
- 분석과 광고는 각각 독립적으로 선택할 수 있다.
- 비활성 기능의 선택 항목은 숨기거나 `사용 안 함`으로 표시하고 동의를 미리 받지 않는다.
- 활성 선택 기능이 있고 저장된 선택이 없는 최초 접속에만 콘텐츠를 막지 않는 하단 배너를 표시한다.
- `필수만`, `모두 허용`, `선택 저장`을 제공한다.
- 하단 배너의 `설정`은 쿠키 설정 modal을 연다.
- `선택 저장`은 값을 저장한 뒤 modal과 하단 배너를 닫는다.
- 푸터의 `/cookie-settings`에서 언제든 변경할 수 있다.
- 새 선택 기능을 활성화해 이용자가 이전에 고르지 않았던 항목이 추가되면 기존 선택 범위를
  그대로 확대하지 않고 배너를 다시 표시한다.
- 동의 철회 후 관련 외부 tag와 저장값을 제거한다.
- 분석 동의 전에는 Google tag를 로드하지 않고 consent mode의 cookieless ping을 포함한 Google
  Analytics 요청을 전송하지 않는다.

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

## 10. 수집 운영 측정

수집은 `M0 수집 보조` 이후 범위이지만 제품 분석 이벤트가 아니라 운영 지표로만 다룬다.

- 후보 수집량, 승격·반려 수, 실패와 차단은 내부 운영 로그·지표로만 본다.
- 후보 제목, 본문, 원문 URL을 GA4나 제품 이벤트에 보내지 않는다.
- 수집 실행 주체는 초안·예약·발행 권한을 갖지 않는다.
- 운영자가 확인한 뒤 이미지 저장, 초안, 즉시 또는 예약 발행을 실행한다.
- 출처별 요청 수, 오류율, 차단 응답은 출처 단위로 집계해 상한과 자동 비활성 판단에 사용한다.
- 수집 지표를 GA4로 보내거나 별도 제품 이용 분석 DB에 저장하지 않는다.

## 11. Feature flag 제안

```text
NUXT_PUBLIC_GA4_ENABLED=false
COLLECT_MANUAL_URL_ENABLED=false
COLLECT_DISCORD_COMMAND_ENABLED=false
COLLECT_LIST_CRAWL_ENABLED=false
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

`COLLECT_MANUAL_URL_ENABLED`와 `COLLECT_DISCORD_COMMAND_ENABLED`는 `M0 수집 보조` gate가 끝난 뒤에만
켠다. 두 경로 모두 입력된 단일 상세 페이지 1건만 처리하고 목록·feed·pagination·scheduler를
호출하지 않는다. `COLLECT_LIST_CRAWL_ENABLED`는 후속 `M0 자동 수집` 전역 차단 스위치이며, 자동
수집 단계 도입 전까지 `false`로 유지한다. `M0 Core` production의 수집 관련 flag 기본값은 모두
`false`다.

GA4 Measurement ID·속성 보관 설정·국외이전 고지·실제 Google 계약 법인·Google tag/CSP domain 중
하나라도 확정되지 않으면 M0 Core production에서 `NUXT_PUBLIC_GA4_ENABLED=false`를 유지한다.
원인과 관계없이 `NUXT_PUBLIC_GA4_ENABLED=false`인 환경은 `NUXT_PUBLIC_GA4_MEASUREMENT_ID`를
public runtime config에서 unset해 응답 payload와 client bundle에 provider 값을 노출하지 않는다.
gate가 끝난 뒤 M0 운영 중에도 별도 배포 설정으로
`true`로 전환할 수 있으며, 이 gate는 M0 Core 첫 공개를 차단하지 않는다. gate가 늦어져도 자체
분석 테이블로 대체하지 않고 게시글 조회 수만 운영한다. 광고를 실제로 시작하는 날짜나 트래픽
기준은 아직 정하지 않았다.

## 12. 검수 기준

### M0 Core

- 공개 상세 화면당 조회 수 endpoint가 한 번만 호출되고 실패해도 상세 열람이 유지된다.
- 조회 수 증가를 위해 방문자·세션 식별자와 원시 이벤트가 저장되지 않는다.
- GA4 비활성 환경에는 선택 배너와 Google 요청이 없다.

### GA4 운영 활성화 gate

- GA4 활성 환경에서 저장된 선택이 없으면 비차단형 배너가 표시되고, 분석 거부 상태에서는
  방문자 수·page open을 포함한 Google tag/request·cookieless ping과 `_ga*` 생성이 0건이다.
- 분석 동의 뒤에만 `page_view`, `select_content`, `share`, `scroll` 이벤트가 전송된다.
- 전송 event의 custom parameter가 §4 allowlist 안에 있고 금지값이 포함되지 않는다.
- tag 로드 실패 시 event를 drop하고 공개 기능을 유지한다.
- 숨김 게시글의 콘텐츠와 수집 후보·출처 정보가 GA4 이벤트에 남지 않는다.

### 후속 광고·M1

- 분석 거부 시 Google tag 요청이 발생하지 않는다.
- 분석 거부 상태에서도 네 provider 가입·로그인이 정상 동작한다.
- 소셜 로그인·가입 이벤트에 회원 번호, provider subject, 이메일, 닉네임이 포함되지 않는다.
- 광고 행을 제외하고 게시글 20개가 유지된다.
- 상세 광고가 지정한 세 위치에만 있다.
- 광고 실패·차단 상태에서도 콘텐츠를 볼 수 있다.
- 숨김 게시글의 콘텐츠 정보가 분석·광고 이벤트에 남지 않는다.
