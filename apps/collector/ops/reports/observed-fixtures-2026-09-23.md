# 2026-09-23 실제 fixture 및 접근 실패 재검증

## 실제 원본 회귀

17개 사이트의 목록·상세 HTML 34개를 Git 제외 원본에서 정제했다. 원본 URL/hash와 정제본 hash,
목록의 canonical identity/post key/순서/시각/페이지 이동, 상세의 블록 순서와 미디어 개수를 비교한 뒤 저장했다.
기존 합성 fixture와 구분하며 이 표의 숫자는 해당 fixture 한 건의 관측값이다.
원문 텍스트·닉네임·미디어 URL은 정제했으므로 내용의 진위를 증명하는 자료가 아니다.

| source | 목록 후보 | 상세 블록 | 이미지 | LINK | 첨부 |
|---|---:|---:|---:|---:|---:|
| arcalive | 45 | 2 | 1 | 0 | 0 |
| bobaedream | 30 | 1 | 1 | 0 | 0 |
| clien | 30 | 5 | 0 | 1 | 0 |
| dcinside | 47 | 90 | 50 | 14 | 0 |
| dmitory | 20 | 3 | 0 | 3 | 0 |
| dogdrip | 20 | 9 | 3 | 0 | 0 |
| etoland | 49 | 1 | 0 | 1 | 0 |
| goodgag | 15 | 1 | 1 | 0 | 0 |
| humoruniv | 25 | 2 | 2 | 0 | 0 |
| instiz | 39 | 16 | 9 | 0 | 0 |
| inven | 20 | 2 | 1 | 0 | 0 |
| mlbpark | 30 | 1 | 0 | 0 | 0 |
| natepann | 58 | 5 | 3 | 0 | 0 |
| ruliweb | 31 | 3 | 1 | 0 | 0 |
| theqoo | 18 | 2 | 0 | 1 | 0 |
| todayhumor | 30 | 21 | 21 | 0 | 0 |
| yuldo | 15 | 4 | 3 | 0 | 0 |

- fixture와 provenance: `apps/collector/src/test/resources/sites/observed/`.
- 테스트: `ObservedSiteFixtureTests`의 34개 회귀 + 웃긴대학 혼합 본문 테스트 1개.
- 이미지/SNS/첨부가 0인 표본은 해당 기능의 실제 성공 사례가 아니다. 별도 합성 경계 테스트와 live 사례를 구분한다.
- 웃긴대학은 `p.content_body_padding` 밖 `.body_editor` 내용을 놓치던 경로를 `.daum-wm-content` 전체 순서 보존으로 수정했다. 관측된 확대/로딩 UI만 제거한다.
- 개드립 목록은 이번 후속 probe HTTP200에서 20개 URL을 찾았다. 이전 접근 실패를 영구 차단으로 간주하지 않는다.
- 이토랜드 저장 목록에서 공지 2개의 중복 링크까지 제외해 49개 후보를 추출했다. 기존 공개 공지 post80/81은 이 fixture 수정과 별개인 데이터 정리 대상이다.

## 실패와 증거의 경계

| source | 최신 확인 내용 | readback / 재개 조건 |
|---|---|---|
| pgr21 | 상세 수집 `SOURCE_ACCESS_BLOCKED` | run `429a48ae-5926-4031-92d1-bcda418adb7a` 실패 ledger/report/item readback 통과. 본문 수집 성공 아님. 공개 정적 응답 제공 시 재검증 |
| youtube-community | HTTP 응답에 `ytInitialData`는 있으나 JSON root는 `responseContext`뿐. 게시글 renderer 없음 | run `84c83f1d-8a28-4c70-ba4f-8e9d9ab04357` FAILED/PARSE_FAILED의 readback 통과. 삭제·비공개라고 단정하지 않으며 실제 공개 본문 응답이 있는 URL/허용 경로가 필요 |
| fmkorea | 목록 probe HTTP430 / `SOURCE_HTTP_REJECTED`; chart gate로만 막힌 batch와 실제 요청을 구분 | 이번 응답 6169bytes/hash 확보. 공개 접근 허용 후 재검증. CAPTCHA/보안 우회 안 함 |
| ppomppu | 목록 probe HTTP302→403 / `SOURCE_ACCESS_BLOCKED` | 공개 접근 허용 또는 공식 경로 확인 후 재개. 실패 저장과 본문 성공은 별도 |

## 실제 실행 결과와 남은 readback

- DCInside hot run `5bef4c3f-d638-41ac-bb4e-310dfac23307`: COMPLETED, 목록1page/발견5/신규3/중복2/실패0. 원본 GIF 디코딩 제한 관련 readback은 아래와 별도로 판정한다.
- 웃긴대학 latest run `df20e175-e1fe-4cb1-85cf-79fcd6b3612f`: 새 ordered parser로 max-pages1/max-items5/since24h/write-db COMPLETED, 신규5/이미지16/실패0. DB/raw/media/report/ledger/checkpoint readback 통과. unknownDates5이므로 모두 최근24시간 글이라고 단정하지 않는다.
- 공개 화면의 70글/207이미지/본문70/SNS10 무오류 확인은 위 두 실행의 신규 공개 결과가 아니다. 이번 batch는 자동 발행하지 않는다.
- 원격 S3/R2, Windows/Docker 전체 실행, Discord Gateway 실연결을 이 로컬 fixture 검증으로 완료 처리하지 않는다.

## 공개 전 전체 수집 데이터 점검에서 발견한 내부 항목

`verify-collector-inventory.mjs`는 모든 FETCHED의 raw·본문/IMAGE/FILE/SNS 대응·canonical hash/중복·media hash/size/MIME/디코딩을 읽기 전용으로 검사한다.
공개 화면의 207장 정상과 달리, 수집 원본에는 아래 항목이 남아 있다. 검사를 완화하거나 성공으로 바꾸지 않았다.

- 오늘의유머 12개 object는 실제 JPEG인데 DB mime_type이 image/png다. 원문 서버 헤더를 바이트 서명보다 우선한 것이 원인이다. 신규 수집은 공통 SourceImageType으로 바이트 서명을 우선하도록 수정하고 테스트했다. 기존 FETCHED snapshot의 정정 절차는 아직 필요하다.
- DCInside hit:17807의 GIF 4개는 각각 800×450, 187/194/251/266프레임으로, 전체 프레임 디코딩이 현재64M픽셀 및 API256MiB 추정 메모리 한도를 넘는다. 파일 부재·손상이라고 단정하지 않는다. 정책을 임의 완화하거나 첫 프레임만 저장하지 않는다. 전체 프레임 보존과 제한된 메모리 검증/승격 방식을 함께 해결해야 한다.
- 마지막 hit:17805의 39번 이미지도 WebP 511×639/235프레임으로 같은 디코딩 한도를 넘는다. 최종 snapshot은 FETCHED103/이미지372/SNS21/FILE0이며 MIME12개와 디코딩 정책5개가 남아 있다. [전체 수집 inventory](collector-inventory-2026-09-23.json)는 공개70글/207이미지 검증과 별개다.
- 신규 MIME 수정만으로 과거 데이터 복구 완료를 주장하지 않는다.
- 최신 HTTP 상태와 응답 digest는 [차단 관측 JSON](blocked-http-observations-2026-09-23.json)에 있다. 응답 헤더·cookie·challenge token은 저장하지 않았다.
- 웃긴대학 dry-run은 collect11테이블과 object527개의 hash가 전후 동일했다. exit0/COMPLETED. DB/object 무쓰기 증거는 `.local-data/verification/dry-run-humoruniv.json`이다.
- 실행별 검증기의 `collectionComplete`에도 readbackPass를 필수로 연결했다. DB run의 COMPLETED만으로 디코딩 실패를 수집 검증 완료로 표시하지 않는다.
