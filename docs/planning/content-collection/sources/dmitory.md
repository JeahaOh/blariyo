# 디미토리 수집 명세

- 명세 상태: fixture parser 검증·운영 비활성
- source key: `dmitory`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-23
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `dmitory-ordered-v1`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 디미토리 |
| 운영 주체 | 디미토리 |
| 기준 URL | `https://www.dmitory.com` |
| 허용 host | `www.dmitory.com`, `dmitory.com` |
| 허용 path | 없음 |
| 제외 path | 전체. 특히 `act`, `search`, `category`, `member_srl`, pagination query |
| 수집 목적 | 공개 유머·이슈 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://www.dmitory.com/policy` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 약관 제10조에서 서비스를 통해 얻은 정보를 권리자 동의 없이 수집·복제·배포할 수 없다고 명시한다. |
| `robots.txt` URL | `https://www.dmitory.com/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `/` 허용과 함께 검색·정렬·member 관련 query를 차단한다. Content-Signal은 `search=yes`, `ai-train=no`, `use=reference`이고 GPTBot/ClaudeBot 등은 차단한다. |
| 공개 API·RSS 제공 여부 | `(미정)` |
| 문의·중단 요청 채널 | `https://www.dmitory.com/help` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 약관상 권리자 동의 없는 수집·복제·배포 금지. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외. |

선택 parser type: `MANUAL`

## 4. URL 규칙

URL 규칙은 확정하지 않는다. query 기반 검색·정렬·회원 경로는 제외한다.

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

상세 수집은 production 사용 결정 전이다. live 검증 기준 상세 본문 selector는 `.read_body .xe_content, #rd_body_content .xe_content`이고, `hot` 목록 parser는 `/issue` 목록에서 상세 URL을 추출한다.


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | `(미정)` |
| 일일 요청 상한 | 0 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | `(미정)` |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

실제 사이트 fixture는 작성하지 않았다. Synthetic fixture로 상세 parser 계약만 검증했다.

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
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
- 판정일·운영 위험 판정자: 2026-09-03, 운영 위험 판정자 `(미정)`
- 보류·차단 사유: 약관상 권리자 동의 없는 수집·복제·배포 금지 확인. 별도 허가 전 자동 수집 차단. live URL·운영 S3/R2 readback 미검증.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-23 | `dmitory-ordered-v1` | 목록 parser + 상세 parser + live 개발 DB/object readback 검증 | `ManualSiteAdapterTests`와 live batch write-db 통과 |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책 확인 완료, parser 미검증 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `HOT_LIST` 구현, 운영 source 예제는 비활성
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: 운영 DB/S3/R2와 Discord Gateway 미검증
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `DMITORY`
- collection policy: `HOT_LIST`; 운영 source 예제는 `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/issue/{id}` 또는 `/{id}`를 `/issue/{id}`로 canonicalize / issue:id
- 본문 selector: `.read_body .xe_content, #rd_body_content .xe_content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 구현. `hot` 목록에서 상세 URL을 추출하고 같은 batch 실행에서 detail parser로 이어간다.
- 검증 상태: synthetic fixture, live hot-list batch, 임시 개발 DB/object readback 검증. 운영 DB/S3/R2와 Discord Gateway는 미검증. live URL `https://www.dmitory.com/issue/426329851`, run `2995f036-5cce-46d8-adf3-c7680b76f736`, DB readback `source_post_key=issue:426329851`, blocks 11, SNS 1, media 9.

## 2026-09-23 live 개발 DB readback

- 실행: `bin/blariyo-collector batch --source dmitory --chart hot --max-pages 1 --max-items 1 --since 24h --interval-ms 10000 --write-db`
- live URL: `https://www.dmitory.com/issue/426329851`
- run id: `2995f036-5cce-46d8-adf3-c7680b76f736`
- DB readback: `blocks 11, SNS 1, media 9`
- object readback: raw HTML, media object, JSONL report 확인. 운영 DB/S3/R2와 Discord Gateway는 미검증.
