# 고급유머 수집 명세

- 명세 상태: 1차 검토
- source key: `goodgag`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-03
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `(미정)`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 고급유머 |
| 운영 주체 | `(미정)`; 앱 스토어 노출 개발자: SmapIe/FunHanApp 계열로 관찰 |
| 기준 URL | `https://www.goodgag.net` |
| 허용 host | `www.goodgag.net` |
| 허용 path | 없음 |
| 제외 path | 전체 |
| 수집 목적 | 벤치마킹 참고. 수집 출처로는 사용하지 않음. |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://www.goodgag.net/mbr/join/rule` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 기존 Blariyo 기획상 고급유머는 벤치마킹 대상이지 수집 출처가 아니다. 별도 수집 허가도 확인하지 못했다. |
| `robots.txt` URL | `https://www.goodgag.net/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `/` 허용으로 보이나 GPTBot, OAI-SearchBot, ChatGPT-User 등 AI 크롤러와 주요 scraper/SEO bot을 명시 차단한다. |
| 공개 API·RSS 제공 여부 | sitemap은 확인, 공개 API·RSS는 `(미정)` |
| 문의·중단 요청 채널 | 앱 스토어 설명상 `hello@goodgag.net` 관찰. 문서에는 비밀값 없음. |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 대상 아님 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 사용하지 않음 | 벤치마킹 대상이며 수집 출처로 등록하지 않는다. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외. |

선택 parser type: `MANUAL`

## 4. URL 규칙

모든 URL은 수집 대상에서 제외한다. benchmark 문서 링크 외 수집 allowlist에 넣지 않는다.

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

사용하지 않는다.


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | 사용하지 않음 |
| 연락 수단 | `(미정)` |
| 요청 간격 | 사용하지 않음 |
| 일일 요청 상한 | 0 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | 사용하지 않음 |
| timeout·응답 크기 상한 | 사용하지 않음 |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

fixture 작성 대상이 아니다.

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
- [x] 이용약관·`robots.txt` 확인
- [ ] Discord·운영자 URL 수집 보조 fixture 검증
- [ ] 목록·feed fixture 검증 해당 없음
- [ ] URL 정규화와 중복 방지 검증
- [ ] 요청 간격·일일 상한·연속 실패 기준 확정
- [x] feature flag와 출처별 활성값 기본 비활성 확인
- [x] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 차단
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03, 운영 위험 판정자 `(미정)`
- 보류·차단 사유: Blariyo 내 역할은 벤치마킹 대상이며 수집 출처가 아니다. AI/스크래퍼 bot 차단 신호도 있어 수집하지 않는다.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 차단 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_AGENT_BLOCKED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `GOODGAG`
- collection policy: `HOT_LIST`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `?mid=&document_srl=` 또는 `/bbs/board.php` / board:id
- 본문 selector: `.xe_content, #bo_v_con, .view_content, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: live `https://www.goodgag.net/371411`, run `c745ed64-10b3-4dcc-85e7-bbf607e00288`로 임시 Docker 개발 DB와 로컬 object raw/media/report readback 확인. 본문 blocks 2, media 2. 운영 DB/S3와 Discord Gateway는 미검증.
- hot-list batch 검증: `https://www.goodgag.net/`, run `d65055f3-05b8-4132-9340-04a2c604fb4e`, pages 1, discovered 2, fetched 1, duplicate 1, state `COMPLETED`.
