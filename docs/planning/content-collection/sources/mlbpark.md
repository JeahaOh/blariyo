# MLBPARK 수집 명세

- 명세 상태: 정책 확인 후 비활성
- source key: `mlbpark`
- 작성일: 2026-09-03
- 최종 확인일: 2026-09-03
- 확인 담당자: Codex
- 활성 단계: 비활성
- parser version: `(미정)`

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | MLBPARK |
| 운영 주체 | 동아닷컴 |
| 기준 URL | https://mlbpark.donga.com/ |
| 허용 host | `(미정)` |
| 허용 path | 없음 |
| 제외 path | 전체 경로 |
| 수집 목적 | 커뮤니티 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | https://secure.donga.com/mlbpark/policy/service.php |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 회원은 회사 사전 승낙 없이 서비스 정보를 영리 목적으로 복제·송신·출판·전송·배포·방송하거나 제3자에게 이용하게 할 수 없다고 명시. 회원 게시물 저작권은 해당 저작권자에게 귀속. |
| `robots.txt` URL | https://mlbpark.donga.com/robots.txt |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`에 `Disallow: /` 적용. 일부 검색·소셜 봇만 별도 허용. |
| 공개 API·RSS 제공 여부 | `(미정)` |
| 문의·중단 요청 채널 | https://mlbpark.donga.com/mp/ 의 `메일문의`, `mlbpark@donga.com` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

확인 결과가 불명확하거나 기술 gate를 통과하지 못하면 `활성 단계`를 `비활성`으로 유지한다.

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 차단 | 일반 User-Agent 전체 robots 금지. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외 |

선택 parser type: `MANUAL`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `https://mlbpark.donga.com/mp/b.php?...` 형태 확인. 수집 차단 상태라 사용 패턴 아님. |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 없음 |
| 제거할 query parameter | `(미정)` |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | 사용하지 않음 | 없음 | 실패 |
| 제목 | 사용하지 않음 | 없음 | 후보 실패 |
| 본문 이미지 | 사용하지 않음 | 없음 | 후보 실패 |
| 이미지 순서 | 사용하지 않음 | 없음 | 후보 실패 |
| 게시 시각 | 사용하지 않음 | 없음 | `null` |

이미지 제외 규칙:

- 로고·프로필·이모티콘: 전체 제외
- 광고·추적 pixel: 전체 제외
- 추천글 thumbnail: 전체 제외
- 최소 크기·허용 MIME: `(미정)`
- 외부 CDN host 허용 범위: 없음


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | 요청하지 않음 |
| 일일 요청 상한 | 0 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | 0 |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

| 유형 | 샘플 식별값 | 기대 결과 | 확인 결과 |
| --- | --- | --- | --- |
| 정상 목록 | 없음 | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 빈 목록 | 없음 | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 정상 상세 | 해당 없음 | 후보 실패 | 미수행 |
| 이미지 없는 상세 | 해당 없음 | 후보 실패 | 미수행 |
| 삭제·차단 | robots 전체 금지 | 실패 기록 | 정책상 미수행 |
| 구조 변경 | synthetic fixture | parser 실패 감지 | 미수행 |
| 중복 URL | 해당 없음 | 새 후보 생성 안 함 | 미수행 |

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
- [x] 이용약관·`robots.txt` 확인
- [ ] 운영 위험 판정
- [ ] Discord·운영자 URL 수집 보조 fixture 검증
- [ ] 목록·feed fixture 검증 해당 없음
- [ ] URL 정규화와 중복 방지 검증
- [x] 요청 간격·일일 상한·연속 실패 기준 확정
- [ ] 원문 HTML·이미지·개인정보가 로그에 남지 않음
- [ ] feature flag와 출처별 활성값 기본 비활성 확인
- [ ] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 차단
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03 / `(미정)`
- 보류·차단 사유: robots 일반 User-Agent 전체 금지와 약관상 사전 승낙 없는 영리 이용 제한.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 비활성 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_DISALLOWED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `MLBPARK`
- collection policy: `HOT_LIST`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/mp/b.php?m=view&b=&id=` / board:id
- 본문 selector: `#contentDetail, .ar_txt, .view_content, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: live `https://mlbpark.donga.com/mp/b.php?id=202609230118885833&p=1&b=bullpen&m=view...`, run `058fe150-77be-4c34-a15f-56c340dcc502`로 임시 Docker 개발 DB와 로컬 object raw/report readback 확인. 본문 blocks 34, media 0인 공개글이다. 이미지 포함 공개글·운영 DB/S3·Discord Gateway는 미검증.
- hot-list batch 검증: `https://mlbpark.donga.com/mp/b.php?m=list&b=bullpen`, run `58deb42d-1763-4fbe-b2b7-702c8e95535e`, pages 1, discovered 2, report fetched 1, failures 1, state `PARTIAL`. 이후 저장 순서 보정 후 run `961b90ce-87d1-43af-a33f-f760195357dd`는 pages 1, discovered 6, fetched 4, duplicates 2, state `COMPLETED`. 이미지 포함 글 media 검증은 추가 필요.
