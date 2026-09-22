# 오늘의유머 수집 명세

- 명세 상태: fixture parser 검증·운영 비활성
- source key: `todayhumor`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-23
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `todayhumor-ordered-v1`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 오늘의유머 |
| 운영 주체 | `(미정)` |
| 기준 URL | `https://www.todayhumor.co.kr/` |
| 허용 host | `(미정: 사용 결정 전 비활성)` |
| 허용 path | `(미정: 사용 결정 전 비활성)` |
| 제외 path | 전체 경로 |
| 수집 목적 | 운영자 검수용 짤 후보 metadata 생성 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `(미정: 확인 가능한 이용약관 URL을 찾지 못함)` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 개인정보취급방침은 확인했으나 수집·크롤링·게시물 재이용을 허용하는 약관 근거는 확인하지 못했다. |
| `robots.txt` URL | `https://www.todayhumor.co.kr/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `Allow: /`이나 Cloudflare Managed Content-Signal에서 `search=yes`, `ai-train=no`, `use=reference`를 표시한다. |
| 공개 API·RSS 제공 여부 | `(미정)` |
| 문의·중단 요청 채널 | `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 중간 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 이용약관 URL과 게시물 재이용 조건 미확인 |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외 |

선택 parser type: `(미정: MANUAL / HTML_LIST)`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `https://www.todayhumor.co.kr/board/view.php?table={board}&no={id}` |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 동일 host만 후보, 사용 결정 전 비활성 |
| 제거할 query parameter | `(미정)` |
| 유지할 query parameter | `table`, `no` 후보이나 미확정 |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | `(미정)` | `(미정)` | 후보 실패 |
| 제목 | `meta[property=og:title]`, `title` | 1 | 후보 실패 |
| 본문 | `#viewContent`, `.viewContent`, `.board_view .content` | 1 | 후보 실패 |
| 본문 이미지 | 본문 내부 `img` | 1 | 후보 실패 또는 운영자 보정 |
| 이미지 순서 | `(미정)` | `(미정)` | DOM 순서 |
| 게시 시각 | `(미정)` | `(미정)` | `null` |

이미지 제외 규칙:

- 로고·프로필·이모티콘: `(미정)`
- 광고·추적 pixel: `(미정)`
- 추천글 thumbnail: `(미정)`
- 최소 크기·허용 MIME: `(미정)`
- 외부 CDN host 허용 범위: `(미정)`


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | `(미정)` |
| 일일 요청 상한 | 0, 사용 결정 전 비활성 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | `(미정)` |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 항상 기본 비활성 |

## 8. 검증 fixture와 결과

| 유형 | 샘플 식별값 | 기대 결과 | 확인 결과 |
| --- | --- | --- | --- |
| 정상 목록 | `hot` 목록 | 상세 URL 추출 후 detail parser로 연계 | live 개발 DB/object readback 완료 |
| 빈 목록 | `hot` 목록 fixture | 후보 0건이면 실패 없이 report에 기록 | fixture/runner 정책으로 검증 |
| 정상 상세 | synthetic fixture | 제목·본문·이미지·SNS 추출 | `ManualSiteAdapterTests` 통과 |
| 이미지 없는 상세 | `(미정)` | 명시적 실패 또는 운영자 보정 | 미검증 |
| 삭제·차단 | `(미정)` | 실패 기록·재시도 제한 | 미검증 |
| 구조 변경 | synthetic fixture | parser 실패 감지 | 미검증 |
| 중복 URL | `(미정)` | 새 후보 생성 안 함 | 미검증 |

## 9. 활성화 판정

- [ ] 운영 주체와 기준 URL 확인
- [x] 이용약관·`robots.txt` 확인
- [x] Discord·운영자 URL 수집 보조 fixture 검증: 상세 parser 단위 테스트
- [ ] 목록·feed fixture 검증 해당 없음
- [ ] URL 정규화와 중복 방지 검증
- [ ] 요청 간격·일일 상한·연속 실패 기준 확정
- [ ] 원문 HTML·이미지·개인정보가 로그에 남지 않음
- [x] feature flag와 출처별 활성값 기본 비활성 확인
- [x] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 보류
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03 / `(미정)`
- 보류·차단 사유: 약관·운영 주체·문의 채널 미확정. live URL·운영 S3/R2 readback 미검증.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-23 | `todayhumor-ordered-v1` | 목록 parser + 상세 parser + live 개발 DB/object readback 검증 | `ManualSiteAdapterTests`와 live batch write-db 통과 |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책·기술 gate 미통과 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `HOT_LIST` 구현, 운영 source 예제는 비활성
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: 운영 DB/S3/R2와 Discord Gateway 미검증
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `TODAYHUMOR`
- collection policy: `HOT_LIST`; 운영 source 예제는 `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/board/view.php?table=&no=` / table:no
- 본문 selector: `#viewContent, .viewContent, .board_view .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 구현. `hot` 목록에서 상세 URL을 추출하고 같은 batch 실행에서 detail parser로 이어간다.
- 검증 상태: synthetic fixture, live hot-list batch, 임시 개발 DB/object readback 검증. 운영 DB/S3/R2와 Discord Gateway는 미검증. live URL `https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970`, run `0455c65f-0605-45b7-99e2-d7f6e1668d45`, DB readback `source_post_key=humorbest:1797970`, blocks 3, media 3.
## 2026-09-23 hot-list live readback

- 실행: `bin/blariyo-collector batch --source todayhumor --chart hot --max-pages 1 --max-items 1 --since 24h --interval-ms 10000 --write-db`
- 임시 승인 source 파일과 임시 Docker 개발 DB에서 검증했다. 운영 source 설정은 비활성 상태를 유지한다.
- list URL: `https://www.todayhumor.co.kr/board/list.php?table=humorbest`
- live URL: `https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970`
- run id: `0455c65f-0605-45b7-99e2-d7f6e1668d45`
- DB readback: `source_post_key=humorbest:1797970`, blocks 3, media 3, raw/report object 확인
- 결과: 목록→상세 fetch→site detail parser→raw/media/report object→`collect.batch_item` readback `COMPLETED`
- 운영 DB/S3/R2와 Discord Gateway E2E는 미검증이다.
