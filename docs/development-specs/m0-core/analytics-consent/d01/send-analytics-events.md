# 허용된 GA4 이벤트 전송 D01

## 문서 정보

- 문서 상태: `작성 완료`
- milestone: `M0 Core`
- 기능: `analytics-consent`
- 기준일: 2026-09-03
- 입력 근거: [분석 계획 §2·§4](../../../../planning/04-analytics-ad-plan.md), [시스템 아키텍처 §4](../../../../system-design/01-system-architecture.md)
- 미검증: source, browser, GA4 DebugView·network

## 1. 프로세스 목적과 범위

분석 활성·동의 상태에서만 `page_view`, `select_content`, `share`, `scroll`을 browser가 GA4로 보낸다.

## 2. 행위자·시작·선행 조건

공개 이용자 interaction. flag true, 유효 consent의 analytics=true, loader 성공이 모두 필요하다.

## 3. 정상 흐름

1. route 첫 화면 표시에서 `page_view`를 한 번 보낸다.
2. 목록에서 글 선택 시 `select_content`를 보낸다.
3. 공유 방식을 선택할 때 `share`를 보낸다.
4. 상세 주요 구간에 최초 도달할 때 `scroll`을 보낸다.

각 event는 아래 custom parameter만 허용한다.

| event | 허용 custom parameter |
| --- | --- |
| `page_view` | `page_type`, `route_template` |
| `select_content` | `board_slug`, `content_type`, `list_position_bucket` |
| `share` | `share_method`, `board_slug` |
| `scroll` | `page_type`, `scroll_depth_bucket` |

## 4. 대안·실패 흐름

- `/→/meme` redirect는 중복 `page_view`를 보내지 않는다.
- flag false·미동의·철회·loader 실패면 event를 drop하고 공개 기능을 유지한다.
- 숨김/404 화면은 제목·번호를 event에 포함하지 않는다.
- 전송 실패를 자체 queue·분석 DB·일별 방문 집계로 우회하거나 자동 재시도하지 않는다.

## 5. 단계별 API 매핑

Blariyo API 해당 없음. browser가 GA4로 직접 전송하며 자체 queue·DB fallback을 만들지 않는다.

## 6. 데이터·상태 전이

Blariyo DB 변화 없음. 위 allowlist 밖의 custom parameter는 추가하지 않는다. 게시글 제목·본문·원문
URL·내부 `postId`, 회원·소셜 식별자, IP, GA4 User-ID와 수집 후보 정보는 값으로도 전송하지 않는다.

## 7. 권한·트랜잭션·멱등성·재시도

서버 transaction 없음. route·scroll lifecycle guard로 같은 화면의 의도하지 않은 중복만 막고 실패 자동 재시도는 하지 않는다.

## 8. 완료 조건과 수용 기준

동의 후 네 event 시점과 allowlist, 미동의 상태의 방문자 수·page open을 포함한 Google
tag/request·cookieless ping 0건, 금지값 미전송, loader 실패 시 공개 기능 유지를 확인해야 한다.

## 9. 미정·차단·미검증

event 계약은 확정됐다. GA4 운영 gate의 실값과 source·browser·DebugView·network는 미검증이다.
