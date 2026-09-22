# 율도 수집 명세

- 명세 상태: fixture parser 검증·운영 비활성
- source key: `yuldo`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-23
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `yuldo-ordered-v1`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 율도 |
| 운영 주체 | `(미정)` |
| 기준 URL | `https://yul-do.com` |
| 허용 host | `yul-do.com` |
| 허용 path | 없음 |
| 제외 path | 전체. 특히 admin, file download, search query |
| 수집 목적 | 공개 커뮤니티 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `(미정)`; 회원가입 약관 화면은 403으로 접근 제한 |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 공개 약관을 확인하지 못했다. 약관 미확인 상태에서는 수집 사용 결정 불가. |
| `robots.txt` URL | `https://yul-do.com/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`에 admin, file download, 검색 query 차단 규칙이 있다. sitemap은 확인했다. |
| 공개 API·RSS 제공 여부 | sitemap 확인. 공개 API·RSS는 `(미정)` |
| 문의·중단 요청 채널 | `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 약관과 문의 채널 미확인. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외. |

선택 parser type: `MANUAL`

## 4. URL 규칙

URL 규칙은 확정하지 않는다. robots 차단 query와 다운로드 경로는 제외한다.

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

상세 수집은 production 사용 결정 전이다. fixture 기준 상세 본문 selector는 `.xe_content`, `.rd_body`, `article .content`, `.document-content`이고, 목록 parser는 구현하지 않는다.


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

- [ ] 운영 주체와 기준 URL 확인
- [ ] 이용약관·`robots.txt` 확인
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
- 보류·차단 사유: 공개 약관·운영 주체·문의 채널 미확인. live URL·운영 S3/R2 readback 미검증.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-23 | `yuldo-ordered-v1` | 상세 전용 parser fixture 추가 | `ManualSiteAdapterTests` 통과, live 미검증 |
| 2026-09-03 | `(미정)` | 최초 검토 | robots 확인, 약관 미확인 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `UNVERIFIED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `CHART_UNVERIFIED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `UNVERIFIED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `YULDO`
- collection policy: `HOT_LIST`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/{board}/{id}` / board:id
- 본문 selector: `.xe_content, .rd_body, article .content, .document-content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: live `https://yul-do.com/humorissue/102736460`, run `9d3e0701-7bba-485e-9b31-83368d9f7f0a`로 임시 Docker 개발 DB와 로컬 object raw/media/report readback 확인. 본문 blocks 7, media 7. 운영 DB/S3와 Discord Gateway는 미검증.
- hot-list batch 검증: `https://yul-do.com/humorissue`, run `92d93b92-4b2a-4bac-a094-c8ec2b3b04cb`, pages 1, discovered 2, fetched 2, state `COMPLETED`.
- duplicate/raw 보정 검증: run `e2957b9d-5989-45d1-a6f5-f7bf73ff6cab`, discovered 3, duplicate 1, fetched 2, raw object 2개로 중복 후보의 raw orphan이 생기지 않음을 확인.
