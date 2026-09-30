# 21개 출처별 수집 정책

- 문서 대조일: 2026-09-24. 접근 관측은 2026-09-23 기록이며 이번에 외부 사이트를 재요청하지 않았다.
- 개발 예제 설정: `apps/collector/ops/reference-sites.sources.example.json`. 운영 적용 파일·승인 판정은 별도다.
- 지원하는 수집 방식과 현재 접근 가능 여부는 별도다. 목록 응답만으로 상세 수집·DB/object 저장 성공을 판정하지 않는다.
- 2026-09-26 사용자 결정으로 **M0 완료 범위는 검증된 출처만**이다. 아래 21개 목록은 구현·검증 이력으로 유지한다. 실제 M0 적용 목록은 [수집 기획 §1.3](README.md#13-m0-마무리-결정--2026-09-26)의 조건과 출처별 증거로 정하며, 차단·미검증 출처는 후속 후보로 남긴다. 이 변경은 출처 재분석이나 운영 활성화가 아니다.

## 수집 방식

- `HOT_LIST`: 실제 Hot/Top/베스트 목록의 URL을 발견하고 사이트별 상세 parser로 처리한다.
- `GENERAL_LIST`: 일반 게시판의 최신 목록이다. chart 이름은 `latest`이며 인기순이라고 표시하지 않는다.
- `DETAIL_ONLY`: chart를 만들지 않는다. 알려진 공개 상세 URL을 단건 경로로 검증한다.
- `BLOCKED`: 목록 후보/fixture는 있어도 현재 접근 차단 또는 실행 조건 미충족 상태다.
- `UNVERIFIED`: 실제 구조·공개 URL이 확인되지 않은 구현 상태다. generic metadata로 성공 처리하지 않는다.

## 현재 설정과 실제 목록 관측

아래 목록 관측은 9월 23일 로컬 작업에서 받은 HTML의 parser 결과다. 개수는 중복 제거한 후보 수이며
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
| etoland | GENERAL_LIST | `latest` https://etoland.co.kr/b/etohumor06/list | `ETOLAND` | 저장 HTML에 공지 제외를 적용해 49개 고유 후보; 로컬 공지80/81 숨김·공개404는 당시 로컬 검증 결과 |
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

- 요청 통제: 9/27 direct의 공통 robots/Crawl-delay·영속 일일 한도·redirect gate를 구현하고 로컬 검증 중이다. [구현 계약](../../system-design/07-spring-collector-design.md#col-0102-direct-요청-통제-보완--2026-09-27)을 따르며, 합성 시험은 실제 source의 S1 허용 판정을 대신하지 않는다. 명시적 일일 한도가 없는 예제 설정은 실행하지 않는다.
- chart를 생략하면 `defaultChart`를 사용한다. 일반 목록에 `--chart hot`을 강제로 적용하지 않는다.
- `maxPages`, `maxItems`, `requestIntervalMs`는 source별 상한·최소 간격이다. 이번 표본 검증은 최대5개 고유 상세 URL이며 한도 초과·접근 차단을 성공으로 바꾸지 않는다.
- `--since`는 확인된 게시 시각을 대상으로 검사한다. `datePolicy=INCLUDE_UNKNOWN`은 시각 미확인 글도 수량 제한 내에서 처리하고 `unknownDates`를 기록하므로 엄격한 24시간 보장은 아니다. `REQUIRE_KNOWN`은 시각 미확인 글을 수집 완료 결과로 채택하지 않고 `SKIPPED_POLICY`와 제외 사유를 남긴다. parse 전에 확보한 원문 HTML은 진단용으로 보존하며 미디어는 다운로드하지 않는다. 기간 제외 수는 `skippedByDate`다.
- 삭제·로그인·CAPTCHA·차단은 우회하지 않는다. 접근 제한 및 재시도 소진은 site stop, 구조 오류 누적은 제한된 실패 후 종료한다. 설정된 이미지 한도(기본·최대 200개) 초과는 본문을 잘라 저장하지 않고 실패한다.
- 일반 목록의 공지·광고 제외는 사이트의 실제 row/badge 구조로 검증한다. 이토랜드의 중첩 공지 category는 관측 fixture로 검증한다.
- 설정의 approved/batchApproved는 해당 실행 설정의 gate이며 production 배포·법률 판단·전체 수집 완료 증거가 아니다. 운영 활성화와 Discord Gateway, 실제 원격 R2 권한은 별도 검증한다.
- `collectionPolicy` 분류명만으로 실행 차단을 보장하지 않는다. 현재 direct runner는 `approved`/`blockedReason`, `batchApproved`, `chartVerified`와 URL·요청 제한을 검사한다. 개발 예제의 차단/상세 전용 4개 출처는 `chartVerified=false`이며, 예제 승인 플래그를 그대로 운영 승인으로 사용하지 않는다.
- `reference-sites.collection-policy.json`은 초기 분류가 남은 참고 파일이며 현재 CLI가 읽는 source 설정이 아니다. 현재 예제와 위 표를 사용하고, 초기 파일의 BLOCKED/DETAIL_ONLY 값을 현행 구현 분류로 복사하지 않는다.
- 실패한 실행도 DB failure/report 및 object readback을 확인한다. 과거 임시 DB의 성공을 현재 지속 개발 DB 성공으로 옮겨 쓰지 않는다.

세부 parser·과거 실행 증거는 [출처별 검증표](reference-site-validation.md), 현재 목표별 진행은
[batch 고도화 진행 기록](../../../worklog/2026-09-23/batch-고도화/PROGRESS.md)을 따른다.


<a id="m0-admission"></a>
## M0 출처 편입 기준 — M0-D05

기준일: 2026-09-26. 출처+수집 방식+adapter/config version+시험 SHA 단위로 아래 증거를 모두 연결한 경우만 M0 적용 목록에 편입한다. adapter 존재나 예제 approved 플래그는 승인 증거가 아니다. 실제 운영 가동 목록은 이번에 조회하지 않았다.

| gate | 필요한 증거 | 실패/누락 처리 |
| --- | --- | --- |
| S1 허용/통제 | 공개 접근·robots/정책·UA 연락·간격/일일 budget·redirect/DNS 제한, 차단 시 무요청 | 후보 유지, 우회 금지 |
| S2 발견/원문 | HOT/GENERAL은 목록→실제 상세가 같은 실행으로 연결; DETAIL_ONLY는 검증된 상세 URL | 목록만·synthetic fixture만으로 통과 불가 |
| S3 내용 보존 | 실제 원문의 순서·본문·이미지·해당되는 첨부·외부 링크/SNS 대조, 한도 초과 무절단 | 실제 없는 콘텐츠 종류는 N/A 근거와 fixture 경계검사; 존재하는 누락은 실패 |
| S4 저장/복구 | 제한 DB/object 역할에서 bytes/hash/size·raw/media/report readback, 부분 실패/중복/재시작 | 로컬 저장과 원격 인수를 분리 |
| S5 운영 수용 | 선택 장비·실제 config/권한, D01 보존/복원·법무 gate, 운영자 검수·수집 알림과 오류 수신 | 현재 SHA·시각·환경·담당이 없는 과거 증거는 보충 필요 |

활성화 직전 7일 이내 실제 표본과 현재 배포/config SHA를 대조한다. parser/정책/출처 구조 변경 또는 차단 관측 시 해당 source를 후보로 되돌리고 영향 gate만 재검증한다. 샘플은 목록2페이지 이내·상세최대5개(실제 더 적으면 근거), 첨부/SNS가 없으면 억지 수집을 확대하지 않는다. 이 수치는 future 시험 상한이며 기존 source별 더 낮은 한도·robots가 우선한다.

현재 문서 증거로 **M0 편입 확정을 입증한 출처는 0개**다. 이는 실제 운영 설정이 전부 OFF라는 조회 결과가 아니다. 17개는 로컬 성공 이력이 있는 후보, 4개는 차단/미검증 후속 후보다. [현재 증거표](reference-site-validation.md#m0-evidence-20260926)의 부족분을 COL-01/02/03/04·OPS-04에서 보완한다. COL-REANALYZE-01의 에펨코리아·뽐뿌·유튜브 커뮤니티는 대기 유지하며 PGR21을 그 task에 추가하지 않는다. 이번에는 사이트 요청·재수집을 실행하지 않는다.
