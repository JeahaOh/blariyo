# 더쿠 HOT 25건 — 원문 수집과 로컬 DB 교체

## 코드 구성과 재사용 범위

수집·추출·SNS 처리·DB 적재의 주 코드는 Node.js(JavaScript `.mjs`)다. `public-fetch.mjs`가
Python 표준 라이브러리 기반 `fetch-public.py`를 호출해 허용된 공개 HTTPS 응답을 내려받는다.
Python 단독 scraper가 아니며 별도 운영 수집기 `apps/collector`(Java/Spring)와도 구분한다.

- `theqoo-parser.mjs`는 HTML과 원문 URL을 받는 순수 함수여서 같은 더쿠 article 구조에 재사용할 수 있다.
- `scrape-originals.mjs`와 DB 교체 도구는 날짜·고정 25건·보관 경로·관측 DB에 묶인 일회성 실행기다.
  다른 글이나 사이트용 범용 CLI·예약 수집기로 그대로 재실행하지 않는다.
- 다른 사이트를 지원하려면 사이트별 본문 parser, URL 입력·저장 설정 분리, 실패·재시도·중복 처리와
  실제 샘플 검증이 필요하다. Python downloader만 있다고 어떤 사이트든 수집할 수 있는 것은 아니다.
- 현행 URL 한 건 수집은 `./bin/blariyo-collector collect-url --source theqoo --url <승인된-공개-URL> --write-db`의
  direct 경로를 사용한다. `/local/v1/candidates`는 기존 Core 후보 전송 방식의 legacy 경로다.
  다른 PC의 DB/object 연결·권한·실연동은 [수집기 운영 안내](../../apps/collector/ops/README.md#웹api와-다른-컴퓨터에서-실행)를 따른다.
  아래 고정 25건 Node/Python 도구는 과거 적재 재현용이며 운영 batch에 연결하지 않는다.
- SNS 임베드는 수집기와 별개인 Web 표시 기능이다. 현재 게시글의 단독 X·YouTube·TikTok·Instagram
  URL을 인식하며, 삭제·비공개·불러오기 실패 시 원문 링크와 안내를 제공한다. 기존 원문과 첨부 DB를
  다시 적재하거나 삭제하지 않는다. TikTok 단축 URL은 게시물 ID가 없어 원문 링크로 표시한다.

**기존 25건은 원문 스크랩 완료물이 아니다.** 아래 최초 적재는 원문·첨부·SNS 내용을
보존하지 않고 요약문을 넣은 작업이다. 원문 재수집과 DB 교체의 완료 증거로 사용하지 않는다.

**2026-09-20 원문 교체 완료:** 고정 25건의 원문 HTML·본문 순서와 이미지 105개를 보존하고,
로컬 초안 DB 및 기존 `http://127.0.0.1:59689` 미리보기 DB를 실제로 교체했다.
최종 본문은 186개 블록이며 수집 오류는 0건이다. SNS는 X 9건, Instagram 2건,
YouTube 5건이다. 영상 파일 다운로드와 영상 플레이어 UI 구현은 이 결과에 포함되지 않는다.

## 원문 재수집 점검 도구

- `theqoo-parser.mjs`: 실제 article 영역에서 텍스트·이미지·일반 링크·SNS·영상 참조를
  DOM 순서대로 추출한다. 요약문을 생성하지 않는다. 본문 누락은 오류이며, 추출할 수 없는
  첨부는 `issues`에 기록한다.
- `audit-source-references.mjs`: 기존 JSON의 고정 URL 25건과 로컬 DB를 URL로 대조한다.
  공개 페이지의 참조·구성·응답 해시를 점검하고 `.local-data/content-review/`에 보고서를 쓴다.
  DB는 읽기 전용 transaction으로 조회하며 본문 텍스트·이미지 binary는 보고서에 저장하지 않는다.
- `theqoo-parser.test.mjs`: 자체 작성한 HTML로 순서·지연 로딩 이미지·SNS URL·영상·본문 밖
  요소 제외·본문 누락·title fallback을 검증한다.

```sh
node --test scripts/content/theqoo-parser.test.mjs
node scripts/content/audit-source-references.mjs
```

참조 점검 통과는 원문·첨부·SNS 내용을 DB에 넣었다는 뜻이 아니다. 실제 원문 복제,
첨부 저장, SNS 내용 확보, DB readback과 화면 검증은 각각 별도 확인해야 한다.
2026-09-20 사용자가 이 고정 25건의 원문·첨부·SNS 복제 허락을 받았다고 확인했다.
`audit-source-references.mjs` 자체는 여전히 DB를 변경하지 않는 점검 도구다.
공개 화면용 임시 DB의 게시글 ID와 `blariyo_local`의 ID는 다르므로 ID를 대응키로 사용하지 않는다.

## 허락받은 원문 저장 계약

사용 범위는 `community-hot-20260920.json`의 고정 25개 원문 URL이다. 새 목록 탐색,
운영 DB 반영, 운영 자동 수집 활성화와 운영 공개를 포함하지 않는다.

- `scrape-originals.mjs`는 article 본문과 순서, 이미지 원본 파일, X 공개 syndication 응답,
  Instagram 공개 embed 본문·첨부, YouTube 공식 oEmbed 제목·채널·썸네일·재생 정보를 수집한다.
  X 긴 글 3건은 공개 페이지의 해당 NoteTweet ID와 전체 본문을 대조해 보완했다.
  Instagram carousel 2건은 각각 이미지 3개·5개를 보존했다. 영상 binary를 내려받은 것으로
  표시하지 않는다. SNS 긴 글의 잘림과 첨부 실패를 상태·오류로 보존하며 본문을 요약으로 대체하지 않는다.
- 만료된 첨부 URL 2개는 공식 공개 이미지 페이지가 제공한 새 서명 URL을 사용했다.
  원래 이미지와 host·path가 같은지 확인하며 서명 삭제·생성이나 접근 제한 우회는 하지 않는다.
- `.local-data/content-review/originals-20260920/`에 원본 파일과 SHA-256, 수집 snapshot을 보존한다.
  binary는 파일 저장소에 두고 DB에는 본문과 파일 참조·해시를 저장한다.
- `scrape_archive`는 로컬 원문 증거 보관용 별도 schema이며
  `migrations/001_source_capture.sql`과 자체 `schema_migration` checksum으로 관리한다.
  애플리케이션 V001–V005 migration이나 준비 상태 판정을 변경하지 않는다.
- 기존 초안은 URL로 대응하고 교체 전 백업·행 잠금·version 확인 후 정상 PostsService로 수정한다.
  원문 snapshot은 같은 transaction으로 보관한다. 초안의 공개 상태는 바꾸지 않는다.
- 일반 이미지는 기존 검증·재인코딩을 사용한다. GIF가 일반 업로드 제한을 초과하면 이 로컬
  importer에서만 원본 20 MiB 이하, 프레임당 4천만 pixel 이하, 최대 1,500프레임·총 6억 pixel
  이하를 확인하고 FFmpeg의 제한 시간 내 전체 프레임 streaming decode를 통과한 원본을 보존한다.
  정지 이미지로 대체하거나 프레임을 잘라내지 않는다. 운영 업로드 제한은 그대로 유지한다.

## 실행 결과와 검증

| 대상                                                       | 실제 반영 결과                               | 확인 증거                                                          |
| ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `127.0.0.1:55439/blariyo_local`                            | 기존 25건을 원문으로 교체, `DRAFT` 유지      | 별도 읽기 전용 연결로 제목·본문·순서·이미지 해시·원문 archive 대조 |
| 기존 미리보기 DB `127.0.0.1:55449/m0_browser_f3351c5d9ee9` | 기존 25건을 교체, fixture의 `PUBLISHED` 유지 | HTTP API 25건 및 이미지 105개 상태·MIME·파일 해시 대조             |
| 원본 저장소                                                | 원문 HTML, 원본 이미지, SNS 본문·첨부·출처   | `snapshot.json` 및 `assets/` SHA-256 대조                          |

원본 파일과 증거는 Git 제외 경로 `.local-data/content-review/originals-20260920/`에 있다.

- `backup-before-replace-2026-09-20T07-15-10-271Z.json`: 로컬 DB 최초 교체 전 백업
- `preview-backup-2026-09-20T07-15-47-431Z.json`: 미리보기 DB 최초 교체 전 백업
- `replace-result-2026-09-20T07-15-10-271Z.json`, `preview-result-2026-09-20T07-15-47-431Z.json`:
  최초 교체 증거. 당시 이미지 103개 및 수집 미완료 5건이 있었으며 최종 결과가 아니다.
- `completion-backup-{local,preview}-2026-09-20T07-21-42-656Z.json`,
  `completion-result-2026-09-20T07-21-42-656Z.json`: 긴 X 본문 3개와 이미지 2개 보완 증거
- `final-verification.json`: 최종 25건·186블록·105이미지·SNS 16건·수집 오류 0건 검증

`replace-local-originals.mjs`, `replace-existing-preview.mjs`, `complete-originals.mjs`는 관측한
로컬 DB·기존 내용·백업에 고정된 일회성 도구다. 기존 내용이 백업과 다르면 편집 보호를 위해
중단한다. 현재 완료된 DB에 변경 도구를 다시 실행할 필요가 없다. 검증만 반복하려면:

```sh
nvm use 24.18.0
node --test scripts/content/theqoo-parser.test.mjs
node scripts/content/verify-originals.mjs
node scripts/content/verify-preview-browser.mjs
```

마지막 명령은 기존 미리보기의 9·8·16·17번 페이지를 Chromium에서 열어 이미지를 decode하고
9번 전체 화면을 저장한다. `browser-check.json`과 `preview-post-9.png`가 별도 증거다.
최초 실행 결과 4개 페이지의 이미지 23개는 모두 로드됐다. 당시 9번 화면의 기존 stylesheet
`/_nuxt/entry.wT40LmiF.css`가 HTTP 500이며 현재 build에는 다른 hash의 CSS가 있으므로,
레이아웃 정상 통과로 보고하지 않는다. 본문·이미지 표시 확인과 CSS 오류를 구분한다.
애플리케이션 migration V001–V005 및 운영 배포 상태는 이 작업으로 변경하지 않는다.

### 2026-09-20 최신 CSS 재적용

사용자 요청에 따라 `start-existing-preview.mjs`로 기존 59689 웹 프로세스만 교체했다.
원문 DB·첨부는 그대로 사용하며 교체 전후 25개 게시글·186개 블록·105개 이미지 행의
SHA-256이 동일하다. 최초 요약을 생성하는 `preview-ui.mjs`를 재실행하지 않았다.

- 3000번과 59689번 모두 `entry.DcMbgmiu.css`를 HTTP 200으로 제공하며 파일 SHA-256이 같다.
- 최신 Web build를 `.local-data/content-preview/2026-09-20T07-51-39-131Z/web-output/`에 복사해
  이후 공유 `.output` 재빌드로 이 미리보기의 정적 파일이 없어지는 문제를 방지했다.
- `runtime.json`은 같은 디렉터리에 있으며 실행 주소·CSS 비교·데이터 보존 검증을 기록한다.
- Chromium에서 4개 상세 페이지의 CSS와 이미지 23개 로드를 확인했다. 390px 화면 가로 넘침이 없다.
- 화면: `preview-post-9-styled.png` 전체, `preview-post-9-desktop.png` 데스크톱,
  `preview-post-9-mobile.png` 모바일. 최신 `browser-check.json`에 스타일 로드 성공을 기록한다.

재시작 도구는 관측한 교체 전 PID에 고정된 일회성 명령이다. 59689는 원문 표시를 확인하는
임시 미리보기이며, 현재 개발 UI·실제 정책 검수 기준은 계속 `localhost:3000`이다.

## 최초 요약 초안 적재

2026-09-20 KST에 더쿠 HOT 목록 1~3페이지와 상세 페이지에서 수집했다.
허구 게시글 생성이나 예전 예제 데이터 복사가 아니다. 단일 커뮤니티의 그 시점 HOT 목록이며
전체 커뮤니티 인기 순위나 게시물에 적힌 주장의 진실성을 뜻하지 않는다.

[수집 묶음](community-hot-20260920.json)에 25개 각각의 상세 URL, 원제목, 원문 표시 시각,
관측 시각, HOT 목록 URL, 조회/댓글 수와 응답 SHA-256을 남겼다. 본문은 직접 작성한 검토 요약이다.
이미지·영상만 있는 글은 보지 않은 장면을 창작하지 않고 추가 확인이 필요하다고 표시했다.
원문 이미지·댓글·전체 본문은 복제하지 않았다. 다운로드해 읽은 본문 텍스트도 최종 묶음에 남기지 않았다.
`robots.txt`는 관측 당시 404였으며, 이것을 이용 허가로 해석하지 않았다.
[이용약관](https://theqoo.net/service)을 확인했으나 이미지 재사용 허가는 확보되지 않았다.

## 최초 요약 DB 저장 이력

대상은 이 저장소의 로컬 PostgreSQL `127.0.0.1:55439/blariyo_local`이다.
`content.board_post`에 출처·제목을, `content.board_post_block`에 요약을 저장했다.
운영 DB를 대상으로 하는 옵션은 제공하지 않는다. 실제 앱 PostsService와 migration을 사용한다.
수집은 단발 작업이며 운영 collector나 자동 발행을 켜지 않았다.

```sh
nvm use 24.18.0
docker compose up -d postgresql
npm run build -w @blariyo/api
node scripts/content/import-local-drafts.mjs --apply
```

최초 실행 결과: 신규 25, `DRAFT=25`, `PUBLISHED=0`.
재실행 결과: 신규 0, 기존 25 유지. source URL로 중복을 피하며 기존 편집 내용을 덮어쓰지 않는다.
검사 결과와 실제 ID는 `.local-data/content-review/import-result.json`에 저장한다. 이 파일은 Git 제외다.
최초 실패는 DB의 작성자 식별자 제약 때문이었고 transaction이 취소됐다. 규정된 `system:collector`로
수정한 뒤 25개 모두 성공했다. DB 제약을 완화하지 않았다.

## 발행 전

최초 원문 교체 시 기본 로컬 DB의 상태는 **원문이 반영된 검토 초안**이었다. 허락 확인 이후 원문을 반영했으며,
원출처·개인정보·사실관계를 검토하고 문장을 편집한 뒤
앱의 정상 발행 절차를 사용한다. 수집 목록에 오른 사실과 원문의 주장 검증을 구분한다.
특히 자산 추정, 교통 운임, 제도·사건 관련 주장은 공식 자료 대조 전 단정하지 않는다.
운영 게시판에 이 25개를 자동 공개하는 기능은 없다.

## 개발 게시판 표시 반영 — 2026-09-20

사용자가 `http://127.0.0.1:3000/meme`에 기존 수집 글이 보이지 않는다고 요청하여,
현재 개발 DB `127.0.0.1:5439/blariyo_local`의 고정 25건을 정상 PostsService 발행 절차로
`PUBLISHED` 처리했다. `publish-development-originals.mjs`는 고정된 로컬 DB와 원문 URL만
대상으로 하며, 게시글·본문·이미지 사전 백업과 수집 완료 상태를 확인한 뒤 실행한다.
본문 186개 블록을 그대로 보존했고 이미지 105개의 공개 파일 해시를 HTTP 응답과 대조했다.
목록은 1페이지 20건·2페이지 5건이며, 처음 비교한 원문은 개발 DB의 `/meme/posts/10`이다.

증거: `.local-data/content-review/originals-20260920/development-publish-result-2026-09-20T10-44-06-177Z.json`.
원문 교체 당시 DRAFT 결과와 59689 미리보기 결과는 그 시점의 이력이며 현재 개발 DB 발행 상태와 구분한다.
