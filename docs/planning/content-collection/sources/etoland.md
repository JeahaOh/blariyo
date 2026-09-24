# 이토랜드 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `etoland`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목 | 2026-09-24 저장소 대조 결과 |
| --- | --- |
| 현행 수집 분류 | `GENERAL_LIST`; [출처 정책](../source-collection-policy.md) |
| chart / 목록 URL | `latest` `https://etoland.co.kr/b/etohumor06/list` |
| 구현 | `ETOLAND` — [목록 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/etoland/EtolandListParser.java), [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/etoland/EtolandDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/etoland/EtolandAdapter.java) |
| 검증 범위 | 목록·상세 parser 구현. 9월 23일 실제 공개 URL의 개발 DB/object readback과 정제한 관측 fixture가 있다. 모든 글·모든 첨부 유형의 성공을 뜻하지 않는다. |
| 실행 증거 | [관측 fixture](../../../../apps/collector/src/test/resources/sites/observed/README.md); [전체 검증표](../reference-site-validation.md)에서 임시 DB·지속 로컬 DB·운영 환경을 구분 |

- 아래 §1~10은 9월 3일 초기 정책·metadata 검토 기록이다. 당시의 `사용하지 않음`, selector 미정, fixture 미검증을 현재 코드 부재로 해석하지 않는다. 이용약관·robots·연락처와 운영 위험의 미확정 항목은 운영 활성화 전에 재확인한다.
- 9월 21~23일 절의 승인 플래그·parser 상태·실행 명령은 각 시점의 이력이다. 현행 [개발 예제 설정](../../../../apps/collector/ops/reference-sites.sources.example.json)의 `approved=true`, `batchApproved=true`는 운영 승인 증거가 아니다. 운영자의 별도 활성화 판정은 미완료다.
- 과거 일반 목록 실행의 `--chart hot`은 인기 목록 검증이 아니다. 현재 chart는 위 표를 따르며, `BLOCKED`·상세 전용 출처는 목록 성공으로 보고하지 않는다.
- 현재 보존·용량·검수는 [direct batch 계약](../README.md#12-현행-direct와-legacy의-적용-경계)을 따른다. 이후 이력의 원문 보관과 초기 metadata 임시 preview 규칙을 혼용하지 않는다.
- 이번 대조에서 외부 페이지·DB/R2·Discord를 새로 호출하지 않았다. 원격 batch writer와 Discord Gateway 실연동, 출처별 운영 활성화는 별도 인수 대상이다.

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 이토랜드 |
| 운영 주체 | 주식회사 컨택트 |
| 기준 URL | `https://etoland.co.kr` |
| 허용 host | `etoland.co.kr` |
| 허용 path | 없음 |
| 제외 path | 전체. 특히 `/private/`와 회원·포인트·출석·광고·검색 관련 경로 |
| 수집 목적 | 공개 유머 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://etoland.co.kr/terms/service` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 약관에서 매크로·봇 자동화, 사이트 콘텐츠 무단 수집·복제·외부 재공개, 운영 방해를 금지하는 조항을 확인했다. |
| `robots.txt` URL | `https://etoland.co.kr/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `/` 허용, `/private/` 차단. Yeti/Googlebot에 crawl-delay 2, 여러 GenAI user-agent에 `Disallow: /`가 있다. |
| 공개 API·RSS 제공 여부 | sitemap 확인. 공개 API·RSS는 `(미정)` |
| 문의·중단 요청 채널 | 약관상 고객 문의 `etoland3@gmail.com` 확인 |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 약관의 무단 수집·복제 금지 조항 때문에 별도 허가 전 상세 fetch 불가. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외. |

선택 parser type: `MANUAL`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `/b/{board}/view/{slug-or-id}` 형식 관찰. 사용 결정 전 비활성. |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 같은 host의 `https` redirect만 검토 가능. |
| 제거할 query parameter | 검색·필터·page 등은 `(미정)` |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

상세 수집은 사용 결정하지 않는다. selector와 이미지 제외 규칙은 `(미정)`이다.


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | `(미정)`; robots에는 일부 검색 봇 crawl-delay 2/10 관찰 |
| 일일 요청 상한 | 0 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | `(미정)` |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

실제 fixture는 작성하지 않았다. 원문 HTML·이미지 복제 없이 synthetic fixture를 별도 작성해야 한다.

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
- [x] 이용약관·`robots.txt` 확인
- [ ] Discord·운영자 URL 수집 보조 fixture 검증
- [ ] 목록·feed fixture 검증 해당 없음
- [ ] URL 정규화와 중복 방지 검증
- [ ] 요청 간격·일일 상한·연속 실패 기준 확정
- [ ] 원문 HTML·이미지·개인정보가 로그에 남지 않음
- [x] feature flag와 출처별 활성값 기본 비활성 확인
- [x] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 보류
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03, 운영 위험 판정자 `(미정)`
- 보류·차단 사유: 약관상 무단 수집·복제·외부 재공개 금지 확인. 별도 허가 전 자동 수집 차단.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책 확인 완료, parser 미검증 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_AGENT_BLOCKED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `ETOLAND`
- collection policy: `DETAIL_ONLY`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/bbs/board.php?bo_table=&wr_id=` 또는 `/b/{board}/view/{slug}-{id}` / board:id
- 본문 selector: `#bo_v_con, .view-content, .view_content, .board_view .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: live `https://etoland.co.kr/b/freebbs/view/데스크탑-최종-업글-후기-7358986`, run `f54fb826-c4a4-467a-a455-4997296724ff`로 임시 Docker 개발 DB와 로컬 object raw/media/report readback 확인. 본문 blocks 40, media 1. 운영 DB/S3와 Discord Gateway는 미검증.

## 2026-09-23 Hot 목록 → 상세 → 개발 DB/object readback

- collection policy: `HOT_LIST`; `approved=true`, `batchApproved=true`는 개발 검증용 source 설정에 반영했다.
- Hot 목록 URL: `https://etoland.co.kr/b/etohumor06/list`
- 목록 parser: 현재 board의 `a[href*=/b/{board}/view/]`에서 `/b/{board}/view/{slug}-{id}` 상세 URL을 추출하고 comment fragment는 제거한다.
- 상세 parser: `ETOLAND`; 본문 selector `#bo_v_con, .view-content, .view_content, .board_view .content, .view-wrap .content, article .content`.
- canonical/source post key: `/b/{board}/view/{slug}-{id}` / `{board}:{id}`.
- pagination: 같은 path의 `?page=N+1` 링크만 따른다. CLI의 `maxPages`, `maxItems`, `since`, `interval-ms`는 공통 runner에서 적용된다.
- 실제 실행: `./bin/blariyo-collector batch --source etoland --chart hot --max-pages 1 --max-items 2 --since 24h --interval-ms 10000 --write-db`
- 개발 DB readback: run `e91bb38b-a31b-4692-b578-6c9220f9b731`, state `COMPLETED`, discovered 2, fetched 2. 저장 items `etohumor06:2803717` blocks 9, `etohumor06:2812904` blocks 5, raw 2건과 report object 확인.
- 상태: hot-list 연계는 개발 DB/object까지 검증됨. 운영 DB/S3와 Discord Gateway E2E는 아직 미검증.
