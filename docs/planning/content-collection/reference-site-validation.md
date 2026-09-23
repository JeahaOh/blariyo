# 출처별 수집 검증표

이 표는 source registry의 실행 상태와 별개로, 실제 HTML·정책·readback 증거를 기록한다. `implemented`는 코드와 fixture 테스트가 있다는 뜻이고, `verified-local`은 실제 공개 URL을 로컬 개발 DB와 로컬 object store에 저장한 뒤 readback했다는 뜻이다. 운영 DB/S3와 Discord Gateway E2E는 별도 증거 없이는 완료로 보지 않는다.

목록 가능 여부는 [출처별 수집 정책](source-collection-policy.md)의 `HOT_LIST`, `GENERAL_LIST`, `DETAIL_ONLY`, `BLOCKED`, `UNVERIFIED`를 따른다. 모든 사이트에 Hot 목록을 강제하지 않는다. 단, `HOT_LIST`로 분류한 사이트는 목록 parser와 상세 parser가 모두 있어야 하며 목록에서 찾은 URL을 같은 batch 실행에서 상세 fetch·parse·DB/S3 저장까지 연결해야 한다.

현재 chart 명칭과 접근 관측은 [출처별 정책](source-collection-policy.md)이 정본이다. 아래 run ID가 있는 표는 과거 검증 시점의 증거이며, 임시 DB와 현재 지속 개발 DB를 구분한다. 일반 목록의 이전 `hot` 실행 명칭은 인기 목록 검증을 뜻하지 않는다.

## 현행 fixture와 검증 경계

실제 원본에서 정제한 17개 사이트의 목록·상세 HTML 34개와 인벤 첨부 경계 상세 2개, 총 36개 및 출처/hash/구조 기대값은
[observed fixture](../../../apps/collector/src/test/resources/sites/observed/README.md)에 있다.
`ObservedSiteFixtureTests`는 34개 회귀와 웃긴대학 모바일의 혼합 본문·이미지·SNS·첨부/빈 본문 검증을 수행한다.
`InvenAttachmentTests`는 실제 상세 2개와 URL 중복·일반 텍스트 파일 링크·첨부 상한을 검증한다.
원문에 없는 첨부나 SNS까지 실제 수집했다고 해석하지 않는다. 본문 수집 실패 사이트 4개는 성공 fixture에 포함하지 않았다.

현재 접근·저장 관측은 [최근 fixture 및 차단 보고서](../../../apps/collector/ops/reports/observed-fixtures-2026-09-23.md)와
[고도화 진행 기록](../../../worklog/task-list/09/23/batch-고도화/PROGRESS.md)을 함께 확인한다.
아래 초기 실행 기록의 `hot` 이름, 20장 제한과 절단 보정, `list parser 없음`, 승인 플래그는 현재 계약이 아니다.
현행은 사이트별 Hot/일반 목록 정책과 200장/30MiB/150MiB 제한을 사용하고 초과 본문을 잘라 성공 처리하지 않는다.

### 2026-09-23 후속 지속 로컬 DB 검증

[첨부·브라우저 후속 보고서](../../../apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md)에
수집104건/17출처/이미지380/첨부2/SNS21과 공개71글/266이미지의 readback 및 브라우저 전수 결과를 기록했다.
인벤 첨부 run `a4acee83-4f31-499a-a79f-3fb3859b3cb1`은 실제 공개 URL에서 본문38블록·이미지8개·ZIP2개를 저장했고,
정식 검수·초안·별도 발행을 거쳐 로컬111번에서 확인했다. 이 결과를 다른20개 사이트의 첨부 실검증으로 확대하지 않는다.
아래 임시 DB 실행 표와 당시 승인 플래그·부분 실패는 과거 시점의 증거로 보존한다.

## 초기 실행의 공개 URL·readback 기록

| source key | host | chart/list | parser | 본문·이미지·첨부·SNS | canonical / post key | pagination·limits | fixture / 공개 URL | DB/S3 readback | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| arcalive | arca.live | `hot` https://arca.live/b/live | ARCALIVE detail; list | .article-view .article-content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/b/{board}/{id}` / id | maxPages 2, maxItems 20, interval 10000ms | live `https://arca.live/b/yandere/183756861`; run `3af6a0f0-2764-440b-8fc3-0f15f7c12604` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| bobaedream | www.bobaedream.co.kr | `hot` https://www.bobaedream.co.kr/list?code=best | BOBAEDREAM detail; list | .bodyCont[itemprop=articleBody]; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/view?code=&No=` / code:id | maxPages 2, maxItems 20, interval 10000ms | live `https://www.bobaedream.co.kr/view?code=best&No=1034027`; run `ce6d24af-a3e7-4562-b77f-190143fefe5c` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| clien | www.clien.net | `latest` https://www.clien.net/service/board/park | CLIEN list+detail | `.list_item a.list_subject`; `.post_article, article .post-content, .board_read .content_view`; image attrs; LINK SNS; 첨부 FILE 저장 | `/service/board/{board}/{id}` / board:id | maxPages 2, maxItems 20, interval 10000ms; JS pagination은 현재 next 미추적 | hot batch run `adea86a9-d476-4488-98e0-2080613821d8`, item `park:19268242` | 개발 DB + 로컬 object raw/report readback; blocks 7, media 0 | implemented, verified-local-hot-list, production-disabled |
| dcinside | gall.dcinside.com | `hot` https://gall.dcinside.com/board/lists/?id=hit | DCINSIDE list+detail | .write_div, .writing_view_box .write_div, article .content; image attrs; byte-sniffed image MIME; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/board/view/?id=&no=` / gallery:no | maxPages 2, maxItems 20, interval 10000ms | live `https://gall.dcinside.com/board/view/?id=hit&no=17798`; run `dcc43afd-5297-47b4-8716-f377dc8e5aa3` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인; blocks 16, media 13 | implemented, verified-local, production-disabled |
| dmitory | www.dmitory.com | `latest` https://www.dmitory.com/issue | DMITORY detail; list | .read_body .xe_content, #rd_body_content .xe_content; image attrs; bare image URL promotion; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/issue/{id}` 또는 `/{id}` canonicalized to `/issue/{id}` / issue:id | maxPages 2, maxItems 20, interval 10000ms | live `https://www.dmitory.com/issue/426329851`; run `2995f036-5cce-46d8-adf3-c7680b76f736` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| dogdrip | www.dogdrip.net | `hot` https://www.dogdrip.net/dogdrip?sort_index=popular | DOGDRIP detail; list | div[class~=document_[0-9]+_0].xe_content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/{id}` / id | maxPages 2, maxItems 20, interval 10000ms | live `https://www.dogdrip.net/726075392`; run `94bd2d67-0a1e-4820-a0f0-5ef23fc28f6e` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| etoland | etoland.co.kr | `latest` https://etoland.co.kr/b/etohumor06/list | ETOLAND list+detail | #bo_v_con, .view-content, .view_content, .board_view .content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/bbs/board.php?bo_table=&wr_id=` 또는 `/b/{board}/view/{slug}-{id}` / board:id | maxPages 2, maxItems 20, interval 10000ms | live `https://etoland.co.kr/b/freebbs/view/데스크탑-최종-업글-후기-7358986`; run `f54fb826-c4a4-467a-a455-4997296724ff` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인; blocks 40, media 1 | implemented, verified-local, production-disabled |
| fmkorea | www.fmkorea.com | `hot` https://www.fmkorea.com/best | FMKOREA detail; list fixture | .xe_content, .rd_body, article .content, .document-content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/{id}` / id | maxPages 2, maxItems 20, interval 10000ms; `?page=N` fixture | synthetic list/detail fixture; live `https://www.fmkorea.com/best/8468698945` 접근 차단 | 개발 DB failure/report readback `c3a478e7-f9c2-47b2-ba73-0373d4ed3d4b`; 본문 수집은 차단 | implemented, fixture-verified-list-detail, live-blocked-failure-readback, production-disabled |
| goodgag | www.goodgag.net | `latest` https://www.goodgag.net/ | GOODGAG detail; list | .content.issue, .xe_content, #bo_v_con, .view_content, article .content; `cdn.goodgag.net` image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | pretty `/{id}` 또는 `?mid=&document_srl=` / id 또는 board:id | maxPages 1, maxItems 2, interval 10000ms | live detail `https://www.goodgag.net/371411`; direct run `c745ed64-10b3-4dcc-85e7-bbf607e00288`; hot batch run `d65055f3-05b8-4132-9340-04a2c604fb4e` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인; hot batch fetched 1, duplicate 1 | implemented, verified-local, hot-list-verified-local, production-disabled |
| humoruniv | m.humoruniv.com | `latest` https://m.humoruniv.com/board/list.html?table=pds | HUMORUNIV detail; list | `.daum-wm-content`, mobile `p.content_body_padding`; `down-webp.humoruniv.com` image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/board/read.html?table=&number=` and `/pds{id}` / table:number | maxPages 1, maxItems 1 검증, interval 10000ms | live `https://m.humoruniv.com/board/read.html?table=pds&number=1425984`; run `bbd800b5-87f2-4e5f-9a81-60e67c29729d` | 개발 DB + 로컬 object raw/media/report readback; image-only sample blocks 1, media 1 | implemented, verified-local-hot-list, production-disabled |
| instiz | www.instiz.net | `latest` https://www.instiz.net/pt | INSTIZ list+detail | `a[href*=/pt/]`; `#memo_content_1, .memo_content, .post_content, article .content`; CDN image attrs; LINK SNS; 첨부 FILE 저장 | `/{board}/{id}` / board:id | maxPages 2, maxItems 20, interval 10000ms; `?page=N` | hot batch run `130feccc-7e4b-4a31-9b22-2b681922d5d3`, item `pt:7905965` | 개발 DB + 로컬 object raw/media/report readback; blocks 4, media 3 | implemented, verified-local-hot-list, production-disabled |
| inven | www.inven.co.kr | `hot` https://www.inven.co.kr/best/issue | INVEN detail; list | #powerbbsContent; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/board/{game}/{board}/{id}` / game:board:id | maxPages 2, maxItems 20, interval 10000ms | live `https://www.inven.co.kr/board/webzine/2097/2731495`; run `f53df0bb-45ef-4e96-b033-0459740485a5` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| mlbpark | mlbpark.donga.com | `latest` https://mlbpark.donga.com/mp/b.php?m=list&b=bullpen | MLBPARK detail; list | #contentDetail, .ar_txt, .view_content, article .content; optional `simg.donga.com` image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/mp/b.php?m=view&b=&id=` / board:id | maxPages 1, maxItems 2, interval 10000ms | direct run `058fe150-77be-4c34-a15f-56c340dcc502`; hot batch run `58deb42d-1763-4fbe-b2b7-702c8e95535e` | 임시 Docker 개발 DB + 로컬 object raw/report readback 확인; hot batch PARTIAL, media fetch 실패로 rough edge 있음 | implemented, verified-local-text-only, hot-list-partial-local, production-disabled |
| natepann | pann.nate.com | `latest` https://pann.nate.com/talk/c20002 | NATEPANN list+detail | `a[href^=/talk/]`; `div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea`; image attrs; LINK SNS; 첨부 FILE 저장 | `/talk/{id}` / id | maxPages 2, maxItems 20, interval 10000ms; `.paginate a.paging` | hot batch run `472a917a-8b64-46b3-8db0-8bd40930eef5`, item `375634055` | 개발 DB + 로컬 object raw/report readback; blocks 1, media 0 | implemented, verified-local-hot-list, production-disabled |
| pgr21 | pgr21.com | 목록 없음; 상세 URL 전용 | PGR21 detail; no list | .viewContent, .post_content, #view_content, article .content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/{board}/{id}` / board:id | maxPages 2, maxItems 20, interval 10000ms | synthetic fixture; live `https://pgr21.com/humor/507793` challenge page | 개발 DB failure/report readback `3a83f15c-0098-4bfe-bb99-85773debc421`; `SOURCE_ACCESS_BLOCKED` | implemented, fixture-verified, live-blocked-failure-readback, production-disabled |
| ppomppu | www.ppomppu.co.kr | `hot` https://www.ppomppu.co.kr/hot.php | PPOMPPU detail; list fixture | .board-contents, td.board-contents, #quote, article .content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/zboard/view.php?id=&no=` / board:no | maxPages 2, maxItems 20, interval 10000ms; `?page=N` fixture | synthetic list/detail fixture; live `https://www.ppomppu.co.kr/zboard/view.php?id=freeboard&no=10108060` nginx 403 | 개발 DB failure/report readback `7997fa18-fb43-4310-bbe1-6ac8afe2cfa5`; 본문 수집은 차단 | implemented, fixture-verified-list-detail, live-blocked-failure-readback, production-disabled |
| ruliweb | bbs.ruliweb.com | `hot` https://bbs.ruliweb.com/best/humor | RULIWEB detail; list | .view_content[itemprop=articleBody], .view_content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/.../board/{board}/read/{id}` / board:id | maxPages 2, maxItems 20, interval 10000ms | live `https://bbs.ruliweb.com/community/board/300143/read/76767888`; run `babebfb1-4915-456f-bf37-8d5b807c342d` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| theqoo | theqoo.net | `hot` https://theqoo.net/hot | THEQOO detail; list | article[itemprop=articleBody]; image attrs including `t1.daumcdn.net`; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/hot/{id}` and same-site redirect `/square/{id}` / id | maxPages 2, maxItems 20, interval 10000ms | live `https://theqoo.net/hot/4353370346`; run `1d4fbcf4-38f4-4d9b-88c6-8ed4eebdb461` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| todayhumor | www.todayhumor.co.kr | `hot` https://www.todayhumor.co.kr/board/list.php?table=humorbest | TODAYHUMOR detail; list | #viewContent, .viewContent, .board_view .content; image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/board/view.php?table=&no=` / table:no | maxPages 2, maxItems 20, interval 10000ms | live `https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970`; run `0455c65f-0605-45b7-99e2-d7f6e1668d45` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인 | implemented, verified-local, production-disabled |
| yuldo | yul-do.com | `latest` https://yul-do.com/humorissue | YULDO detail; list | .xe_content, .rd_body, article .content, .document-content; `img.yul-do.com` image attrs; LINK SNS; 첨부 파일은 `attachmentCandidates`와 `collect.batch_media.kind=FILE`로 저장 | `/{board}/{id}` / board:id | maxPages 1, maxItems 3, interval 10000ms | live detail `https://yul-do.com/humorissue/102736460`; direct run `9d3e0701-7bba-485e-9b31-83368d9f7f0a`; hot batch runs `92d93b92-4b2a-4bac-a094-c8ec2b3b04cb`, `e2957b9d-5989-45d1-a6f5-f7bf73ff6cab` | 임시 Docker 개발 DB + 로컬 object raw/media/report readback 확인; hot batch fetched 2, duplicate raw orphan 방지 확인 | implemented, verified-local, hot-list-verified-local, production-disabled |
| youtube-community | www.youtube.com | 목록 없음; 상세 URL 전용 | YOUTUBE_COMMUNITY detail; no list; `ytInitialData.backstagePostRenderer` fallback fixture | DOM `#content-text` 또는 `ytInitialData.contentText.runs`; `i.ytimg.com`/`yt3.ggpht.com` thumbnails; LINK SNS는 DOM parser 경로에서 저장 | `/post/{id}` / post id | maxPages 2, maxItems 20, interval 10000ms | live `https://www.youtube.com/post/UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ`; static HTML lacks post renderer | 개발 DB failure/report readback `45ca0295-ecd8-423e-9af7-4aadcaf822a0`; `PARSE_FAILED` | implemented, fixture-verified-ytinitialdata, live-parse-failure-readback, production-disabled |

공통 규칙은 목록과 상세 parser를 분리하고, 본문 순서의 `TEXT`, `IMAGE`, `LINK`를 보존한다. SNS URL은 원문 링크이며 화면 임베드는 기존 공식 allowlist가 결정한다. 삭제·비공개·로그인 필요·접근 차단은 `SOURCE_GONE`, `SOURCE_ACCESS_BLOCKED`, `PARSE_FAILED`, `CHART_UNVERIFIED` 같은 실패 사유로 저장한다.

## Hot-list 완료 기준

- `HOT_LIST` 사이트는 list parser만 있으면 실패다. 목록 URL에서 상세 URL을 찾고, 같은 `DirectBatchRunner` 실행에서 상세 fetch·site detail parser·dedup·raw/media/report 저장까지 성공해야 한다.
- 초기 임시 개발 DB 실행에서는 아래 Hot·일반 목록 사이트들의 저장을 검증했다. 현재 `HOT_LIST`는 arcalive/bobaedream/dcinside/dogdrip/inven/ruliweb/theqoo/todayhumor이고, `GENERAL_LIST`는 clien/dmitory/etoland/goodgag/humoruniv/instiz/mlbpark/natepann/yuldo다. 과거 실행의 `hot` 인자가 일반 목록을 인기 목록으로 바꾸지 않는다. DCInside 초기 실행의 부분 실패는 후속 재수집 결과와 구분한다.
- `mlbpark`의 초기 `verified-local-text-only` 판정 이후 지속 로컬 DB의 5건·이미지 2개 readback을 확인했다. 현재 수량은 아래 후속 증거를 따른다.
- `dcinside` 초기 실행의 `DETAIL/PARSE_FAILED` 이력은 유지한다. 후속 저장 원본 5건·이미지 175개 readback과 공개 글의 다중 이미지·애니메이션 검증은 별도 후속 증거다.

## 초기 조사 당시 Blocked·unverified parser feasibility split

아래 표는 초기 조사 기록이며 현재 구현 상태표가 아니다. DCInside·이토랜드의 목록 parser 부재 등은 후속 구현으로 해소됐다. `fixture parser 가능성`은 synthetic 또는 제공된 공개 HTML fixture로 상세 parser를 만들 수 있다는 뜻이었다. 현재 실제 fixture와 접근 여부는 위 현행 증거와 출처별 정책을 따른다.

| source key | fixture parser 가능성 | 당시 구현 | 당시 live 검증 차단 사유 | 당시 후속 작업 |
|---|---|---|---|---|
| arcalive | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 실제 공개 URL fixture 확보 후 live fetch→DB/S3 readback 또는 정책상 비활성 유지 |
| bobaedream | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 실제 공개 URL fixture 확보 후 live fetch→DB/S3 readback 또는 정책상 비활성 유지 |
| clien | 가능 | hot list parser + 상세 parser + 개발 DB/object readback | 운영 DB/S3 readback, Discord Gateway E2E 필요; 검증 URL에 이미지 없음 | 이미지 포함 공개글 추가 검증 또는 text-only 상태 유지 |
| dcinside | 가능 | 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요; list parser 없음 | list 후보를 별도 조사하거나 detail-only로 유지 |
| dmitory | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 승인 전까지 `approved=false`, `batchApproved=false` 유지 |
| dogdrip | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 실제 공개 URL fixture 확보 후 live fetch→DB/S3 readback 또는 정책상 비활성 유지 |
| etoland | 가능 | 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요; list parser 없음 | list 후보를 별도 조사하거나 detail-only로 유지 |
| fmkorea | 가능 | hot 후보 list parser fixture + 상세 parser fixture | HTTP 430 `에펨코리아 보안 시스템`; 개발/운영 DB/S3 live readback 차단 | 공개 접근 가능 환경 또는 허용 API 확인 전까지 blocked 유지 |
| goodgag | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 승인 전까지 `approved=false`, `batchApproved=false` 유지 |
| humoruniv | 가능 | hot list parser + 상세 parser + 개발 DB/object readback | 운영 DB/S3 readback, Discord Gateway E2E 필요; 이번 hot item은 image-only | 텍스트형 공개글 추가 검증 또는 image-only 상태 유지 |
| instiz | 가능 | hot list parser + 상세 parser + 개발 DB/object readback | 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 DB/S3 검증과 사용자 검수 |
| inven | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 실제 공개 URL fixture 확보 후 live fetch→DB/S3 readback 또는 정책상 비활성 유지 |
| mlbpark | 가능 | 목록 parser + 상세 parser + 로컬 batch readback | 이미지 포함 글 media fetch 검증 추가 필요, 운영 DB/S3 readback, Discord Gateway E2E 필요 | 이미지 포함 공개글 추가 검증 또는 media 실패 row 전이 테스트 보강 |
| natepann | 가능 | hot list parser + 상세 parser + 개발 DB/object readback | 운영 DB/S3 readback, Discord Gateway E2E 필요; 이번 hot item은 text-only | 이미지 포함 hot item 추가 검증 또는 text-only 상태 유지 |
| pgr21 | 가능 | 상세 parser + fixture 저장 경로 | 운영 승인·실제 공개 URL·개발/운영 DB/S3 readback 필요 | 실제 공개 URL fixture 확보 후 live fetch→DB/S3 readback 또는 정책상 비활성 유지 |
| ppomppu | 가능 | hot 후보 list parser fixture + 상세 parser fixture | `www`/`m` 모두 nginx 403; 개발/운영 DB/S3 live readback 차단 | 공개 접근 가능 환경 또는 허용 API 확인 전까지 blocked 유지 |
| ruliweb | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 승인 전까지 `approved=false`, `batchApproved=false` 유지 |
| theqoo | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 승인 전까지 `approved=false`, `batchApproved=false` 유지 |
| todayhumor | 가능 | 목록 parser + 상세 parser + 임시 개발 DB/object readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 승인 전까지 `approved=false`, `batchApproved=false` 유지 |
| yuldo | 가능 | 목록 parser + 상세 parser + 로컬 readback | 운영 승인과 운영 DB/S3 readback, Discord Gateway E2E 필요 | 운영 승인 전까지 `approved=false`, `batchApproved=false` 유지 |
| youtube-community | 가능 | DOM detail parser + `ytInitialData.backstagePostRenderer` fixture parser | live `/post/{id}` 정적 HTML에 post renderer가 없고 `/feed/post_detail` endpoint만 존재; `youtubei/v1/browse` 공개 웹 context는 `INVALID_ARGUMENT` | 공식 API 또는 승인된 동적 fetch 경로 없이는 live 완료로 표시하지 않음 |

## 2026-09-23 초기 임시 DB의 목록 readback 이력

임시 PostgreSQL Docker DB(`blariyo-collector-readback`)와 임시 로컬 object store에서 `approved=true` 임시 source 파일로 검증했던 기록이다. 당시 예제의 승인 플래그를 현재 설정값으로 읽지 않는다. 현행 설정은 source registry와 출처 정책을 대조하며, 예제 값은 운영 활성화 증거가 아니다.
초기 21개 통합 readback 자료는 [dev-21-site-review](../../../apps/collector/ops/reports/dev-21-site-review-2026-09-23.md)에 있다. 임시 DB 기록을 현재 지속 로컬 DB 수량이나 운영 DB/S3 검증으로 합산하지 않는다.

2026-09-23 추가 보강: `DirectUrlRunnerAllSiteParserTests`는 21개 source 전체에 대해 `collect-url`/Discord URL 주입과 같은 상세 URL 경로가 사이트별 detail parser를 사용하고, raw HTML·본문 block·이미지·첨부 FILE·SNS 링크·report object 저장 호출까지 이어지는지 fixture write-db 경로로 검증한다. 이 테스트는 운영 DB/S3 readback을 대체하지 않고, live 차단 사이트도 generic parser가 아니라 사이트별 parser로만 통과하게 하는 회귀 방지 장치다.

2026-09-23 추가 보강 2: live 본문 수집이 차단된 `pgr21`, `fmkorea`, `ppomppu`와 live renderer가 없는 `youtube-community`도 개발 DB `collect.batch_failure`와 로컬 `collect/report/*` object에 실패 상태를 저장하고 readback했다. 검토 자료는 `apps/collector/ops/reports/dev-blocked-readback-2026-09-23.md`와 `.json`이다. 이 증거는 실패 상태 저장 증거이며 본문 수집 완료 증거가 아니다.

2026-09-23 추가 보강 3: 사용자 검토용 통합 자료 `apps/collector/ops/reports/dev-21-site-review-2026-09-23.md`와 `.json`에 21개 전체 상태를 묶었다. 이 자료는 17개 `FETCHED_DEV_READBACK`과 4개 `FAILED_DEV_READBACK`을 한 표로 보여주며, `apps/collector/ops/build-21-site-review.py`로 재생성한다. 운영 DB/S3/R2 검증이나 Discord Gateway E2E 완료 증거가 아니다.

운영 DB/S3/R2 최소 검증은 `apps/collector/ops/production-readback-sample.json` manifest로 고정한다. 이 manifest는 `theqoo`, `todayhumor` hot batch, `humoruniv` latest 일반 목록 batch와 `pgr21` 차단 URL 실패 저장을 정의한다. 이번 로컬 작업에서 운영 manifest를 실행한 것은 아니다.
최소 샘플 통과 후 17개 성공 사이트 전체는 `apps/collector/ops/production-readback-17-fetched.json` manifest로 운영 batch write-db/readback을 실행한다.
본문 수집이 차단되거나 live renderer가 없는 4개 사이트 전체는 `apps/collector/ops/production-readback-4-failed.json` manifest로 운영 실패 상태 write-db/readback을 실행한다.
Discord Gateway E2E는 `apps/collector/ops/discord-e2e-checklist.md`와 `apps/collector/ops/discord-e2e-result.example.json`으로 실제 연결·명령·확인·queue·DB/object readback을 기록한다. 이 증거 전까지 Discord 기능은 완료로 표시하지 않는다.


| source | run id | live URL | DB item | media/object readback | 결과 |
|---|---|---|---|---|---|
| arcalive | `3af6a0f0-2764-440b-8fc3-0f15f7c12604` | `https://arca.live/b/yandere/183756861` | `source_post_key=183756861`, blocks 22, media 20 | raw 1, image 20, report 1 | COMPLETED |
| bobaedream | `ce6d24af-a3e7-4562-b77f-190143fefe5c` | `https://www.bobaedream.co.kr/view?code=best&No=1034027` | `source_post_key=best:1034027`, blocks 5, media 5 | raw 1, image 5, report 1 | COMPLETED |
| dogdrip | `94bd2d67-0a1e-4820-a0f0-5ef23fc28f6e` | `https://www.dogdrip.net/726075392` | `source_post_key=726075392`, blocks 23, media 4 | raw 1, image 4, report 1 | COMPLETED |
| inven | `f53df0bb-45ef-4e96-b033-0459740485a5` | `https://www.inven.co.kr/board/webzine/2097/2731495` | `source_post_key=webzine:2097:2731495`, blocks 7, SNS 1, media 1 | raw 1, image 1, report 1 | COMPLETED |
| todayhumor | `0455c65f-0605-45b7-99e2-d7f6e1668d45` | `https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970` | `source_post_key=humorbest:1797970`, blocks 3, media 3 | raw 1, image 3, report 1 | COMPLETED |
| dmitory | `2995f036-5cce-46d8-adf3-c7680b76f736` | `https://www.dmitory.com/issue/426329851` | `source_post_key=issue:426329851`, blocks 11, SNS 1, media 9 | raw 1, image 9, report 1 | COMPLETED |
| ruliweb | `babebfb1-4915-456f-bf37-8d5b807c342d` | `https://bbs.ruliweb.com/community/board/300143/read/76767888` | `source_post_key=300143:76767888`, blocks 6, media 3 | raw 1, image 3, report 1 | COMPLETED |
| theqoo | `1d4fbcf4-38f4-4d9b-88c6-8ed4eebdb461` | `https://theqoo.net/hot/4353370346` | `source_post_key=4353370346`, blocks 5, media 5 | raw 1, image 5, report 1 | COMPLETED |
| humoruniv | `bbd800b5-87f2-4e5f-9a81-60e67c29729d` | `https://m.humoruniv.com/board/read.html?table=pds&number=1425984` | `source_post_key=pds:1425984`, blocks 1, media 1 | raw 1, image 1, report 1 | COMPLETED; image-only sample |

다음은 초기 실패·보정 이력이며 현재 성공 기준이 아니다. 당시 `truncateExtraImages=true`는 본문 보존 기준을 만족하지 못한다. 현행 parser는 이를 사용하지 않고 200장 한도 초과 시 실패한다.

실패 이력도 보존한다. arcalive 최초 live run `4bd2df2f-5d10-48dc-b786-df221bfb0bfa`는 이미지 20개 초과를 실패로 처리해 `PARSE_FAILED`였고, 이후 adapter를 `truncateExtraImages=true`로 보정해 재검증했다. theqoo run `b436ec47-0a88-4289-b71b-60ab9477b52d`는 media 10MB 상한 때문에 `SOURCE_TOO_LARGE`였고, runner media 상한을 30MB로 보정한 뒤 다음 후보를 `1d4fbcf4-38f4-4d9b-88c6-8ed4eebdb461`에서 검증했다. 이 readback은 운영 DB/S3/R2 검증이 아니다.

## 2026-09-23 남은 live 차단 사유

- `fmkorea`: `https://www.fmkorea.com/best`가 Cloudflare Turnstile 기반 보안 페이지와 HTTP 430을 반환한다. CAPTCHA/Turnstile 우회는 구현하지 않는다.
- `pgr21`: Anubis 연결 확인 페이지가 내려오며 정적 HTML에 게시글 목록이 없다. challenge 우회는 구현하지 않는다.
- `ppomppu`: 목록 URL이 nginx 403을 반환한다.
- `youtube-community`: `/post/{id}` fetch는 200이나 정적 HTML에 community post 본문 renderer가 없어 live parser/readback 미완료다.

## 2026-09-23 batch rough edge

MLBPark hot batch run `58deb42d-1763-4fbe-b2b7-702c8e95535e`에서 media fetch 실패가 item insert 이후 발생해 run은 `PARTIAL`인데 일부 `collect.batch_item.state=FETCHED` row가 남는 현상을 확인했다. 이후 runner 저장 순서를 `FETCHING` claim → raw 저장 → media 저장 → `FETCHED` 완료 전이로 보정했고, Yuldo 재실행 run `e2957b9d-5989-45d1-a6f5-f7bf73ff6cab`에서 duplicates 1, fetched 2, raw object 2개로 중복 raw orphan이 생기지 않음을 확인했다. 기존 rough-edge run의 과거 row는 증거로 보존한다.
