# 21개 출처별 수집 정책

- 기준일: 2026-09-23. 설정 정본: `apps/collector/ops/reference-sites.sources.example.json`.
- 지원하는 수집 방식과 현재 접근 가능 여부는 별도다. 목록 응답만으로 상세 수집·DB/object 저장 성공을 판정하지 않는다.

## 수집 방식

- `HOT_LIST`: 실제 Hot/Top/베스트 목록의 URL을 발견하고 사이트별 상세 parser로 처리한다.
- `GENERAL_LIST`: 일반 게시판의 최신 목록이다. chart 이름은 `latest`이며 인기순이라고 표시하지 않는다.
- `DETAIL_ONLY`: chart를 만들지 않는다. 알려진 공개 상세 URL을 단건 경로로 검증한다.
- `BLOCKED`: 목록 후보/fixture는 있어도 현재 접근 차단 또는 실행 조건 미충족 상태다.
- `UNVERIFIED`: 실제 구조·공개 URL이 확인되지 않은 구현 상태다. generic metadata로 성공 처리하지 않는다.

## 현재 설정과 실제 목록 관측

아래 목록 관측은 이번 로컬 작업에서 받은 HTML의 parser 결과다. 개수는 중복 제거한 후보 수이며
공지 제외·본문·이미지·첨부·SNS·저장 검증 전체의 완료 수가 아니다. 원본 HTML은 비공개
.local-data/site-probes에 보관하고, 재현용 최소 fixture는 출처와 변환 내역을 함께 기록한다.

| source | 정책 | chart / URL | 상세 parser | 실제 목록 관측 |
|---|---|---|---|---|
| arcalive | HOT_LIST | `hot` https://arca.live/b/live | `ARCALIVE` | 45개 후보 (상세/저장 별도) |
| bobaedream | HOT_LIST | `hot` https://www.bobaedream.co.kr/list?code=best | `BOBAEDREAM` | 30개 후보 (상세/저장 별도) |
| clien | GENERAL_LIST | `latest` https://www.clien.net/service/board/park | `CLIEN` | 30개 후보 (상세/저장 별도) |
| dcinside | HOT_LIST | `hot` https://gall.dcinside.com/board/lists/?id=hit | `DCINSIDE` | 47개 후보 (상세/저장 별도) |
| dmitory | GENERAL_LIST | `latest` https://www.dmitory.com/issue | `DMITORY` | 20개 후보 (상세/저장 별도) |
| dogdrip | HOT_LIST | `hot` https://www.dogdrip.net/dogdrip?sort_index=popular | `DOGDRIP` | 후속 실제 HTTP200, 20개 후보; 이전 접근 실패와 구분 |
| etoland | GENERAL_LIST | `latest` https://etoland.co.kr/b/etohumor06/list | `ETOLAND` | 실제 저장 HTML에 공지 제외를 적용해 49개 고유 후보; 기존 공지80/81은 정식 숨김 처리와 공개404 검증 완료 |
| fmkorea | BLOCKED | `hot` https://www.fmkorea.com/best | `FMKOREA` | SOURCE_HTTP_REJECTED |
| goodgag | GENERAL_LIST | `latest` https://www.goodgag.net/ | `GOODGAG` | 15개 후보 (상세/저장 별도) |
| humoruniv | GENERAL_LIST | `latest` https://m.humoruniv.com/board/list.html?table=pds | `HUMORUNIV` | 25개 후보 (상세/저장 별도) |
| instiz | GENERAL_LIST | `latest` https://www.instiz.net/pt | `INSTIZ` | 39개 후보 (상세/저장 별도) |
| inven | HOT_LIST | `hot` https://www.inven.co.kr/best/issue | `INVEN` | 20개 후보 (상세/저장 별도) |
| mlbpark | GENERAL_LIST | `latest` https://mlbpark.donga.com/mp/b.php?m=list&b=bullpen | `MLBPARK` | 30개 후보 (상세/저장 별도) |
| natepann | GENERAL_LIST | `latest` https://pann.nate.com/talk/c20002 | `NATEPANN` | 58개 후보 (상세/저장 별도) |
| pgr21 | DETAIL_ONLY | `없음` 없음 | `PGR21` | 상세 전용; 목록 미설정 |
| ppomppu | BLOCKED | `hot` https://www.ppomppu.co.kr/hot.php | `PPOMPPU` | SOURCE_ACCESS_BLOCKED |
| ruliweb | HOT_LIST | `hot` https://bbs.ruliweb.com/best/humor | `RULIWEB` | 31개 후보 (상세/저장 별도) |
| theqoo | HOT_LIST | `hot` https://theqoo.net/hot | `THEQOO` | 18개 후보 (상세/저장 별도) |
| todayhumor | HOT_LIST | `hot` https://www.todayhumor.co.kr/board/list.php?table=humorbest | `TODAYHUMOR` | 30개 후보 (상세/저장 별도) |
| yuldo | GENERAL_LIST | `latest` https://yul-do.com/humorissue | `YULDO` | 15개 후보 (상세/저장 별도) |
| youtube-community | DETAIL_ONLY | `없음` 없음 | `YOUTUBE_COMMUNITY` | 상세 전용; 목록 미설정 |

## 실행·기간·완료 정책

- chart를 생략하면 `defaultChart`를 사용한다. 일반 목록에 `--chart hot`을 강제로 적용하지 않는다.
- `maxPages`, `maxItems`, `requestIntervalMs`는 source별 상한·최소 간격이다. 이번 표본 검증은 최대5개 고유 상세 URL이며 한도 초과·접근 차단을 성공으로 바꾸지 않는다.
- `--since`는 확인된 게시 시각을 대상으로 검사한다. `datePolicy=INCLUDE_UNKNOWN`은 시각 미확인 글도 수량 제한 내에서 처리하고 `unknownDates`를 기록하므로 엄격한 24시간 보장은 아니다. `REQUIRE_KNOWN`은 시각 미확인 글을 수집 완료 결과로 채택하지 않고 `SKIPPED_POLICY`와 제외 사유를 남긴다. parse 전에 확보한 원문 HTML은 진단용으로 보존하며 미디어는 다운로드하지 않는다. 기간 제외 수는 `skippedByDate`다.
- 삭제·로그인·CAPTCHA·차단은 우회하지 않는다. 접근 제한 및 재시도 소진은 site stop, 구조 오류 누적은 제한된 실패 후 종료한다. 설정된 이미지 한도(기본·최대 200개) 초과는 본문을 잘라 저장하지 않고 실패한다.
- 일반 목록의 공지·광고 제외는 사이트의 실제 row/badge 구조로 검증한다. 이토랜드의 중첩 공지 category는 관측 fixture로 검증한다.
- 설정의 approved/batchApproved는 해당 실행 설정의 gate이며 production 배포·법률 판단·전체 수집 완료 증거가 아니다. 운영 활성화와 Discord Gateway, 실제 원격 R2 권한은 별도 검증한다.
- 실패한 실행도 DB failure/report 및 object readback을 확인한다. 과거 임시 DB의 성공을 현재 지속 개발 DB 성공으로 옮겨 쓰지 않는다.

세부 parser·과거 실행 증거는 [출처별 검증표](reference-site-validation.md), 현재 목표별 진행은
[batch 고도화 진행 기록](../../../worklog/2026-09-23/batch-고도화/PROGRESS.md)을 따른다.
