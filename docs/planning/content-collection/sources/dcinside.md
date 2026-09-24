# 디시인사이드 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `dcinside`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목 | 2026-09-24 저장소 대조 결과 |
| --- | --- |
| 현행 수집 분류 | `HOT_LIST`; [출처 정책](../source-collection-policy.md) |
| chart / 목록 URL | `hot` `https://gall.dcinside.com/board/lists/?id=hit` |
| 구현 | `DCINSIDE` — [목록 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/dcinside/DcinsideListParser.java), [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/dcinside/DcinsideDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/dcinside/DcinsideAdapter.java) |
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
| 출처 표시명 | 디시인사이드 |
| 운영 주체 | 주식회사 디시인사이드 |
| 기준 URL | `https://www.dcinside.com/`, `https://gall.dcinside.com/`, `https://m.dcinside.com/` |
| 허용 host | `(미정: 서면 동의 전 허용하지 않음)` |
| 허용 path | `(미정: 서면 동의 전 허용하지 않음)` |
| 제외 path | 전체 경로 |
| 수집 목적 | 운영자 검수용 짤 후보 metadata 생성 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://nstatic.dcinside.com/dc/m/policy/policy.html` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 약관 제16조가 회사의 사전 서면 동의 없는 서비스 크롤링을 목적 불문 금지한다고 명시하므로 운영 위험이 높아 수집 보조와 자동 수집 모두 차단으로 판정한다. |
| `robots.txt` URL | `https://www.dcinside.com/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `Allow: /`이나, GPTBot 등 AI·학습 크롤러는 `Disallow: /`이다. 약관 조항은 운영 위험 참고값으로 기록한다. |
| 공개 API·RSS 제공 여부 | `(미정)` |
| 문의·중단 요청 채널 | `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 사용하지 않음 | 약관상 사전 서면 동의 없는 크롤링 금지 |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외 |

선택 parser type: `MANUAL`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `(미정)` |
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
| canonical URL | 사용하지 않음 | 없음 | 후보 실패 |
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
| 식별 User-Agent | 사용하지 않음 |
| 연락 수단 | `(미정)` |
| 요청 간격 | 사용하지 않음 |
| 일일 요청 상한 | 0 |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | 0 |
| timeout·응답 크기 상한 | 사용하지 않음 |
| 연속 실패 자동 비활성 기준 | 항상 비활성 |

## 8. 검증 fixture와 결과

| 유형 | 샘플 식별값 | 기대 결과 | 확인 결과 |
| --- | --- | --- | --- |
| 정상 목록 | 없음 | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 빈 목록 | 없음 | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 정상 상세 | 없음 | 후보 생성 안 함 | 미검증 |
| 이미지 없는 상세 | 없음 | 후보 생성 안 함 | 미검증 |
| 삭제·차단 | 없음 | 후보 생성 안 함 | 미검증 |
| 구조 변경 | synthetic fixture | parser 없음 | 미검증 |
| 중복 URL | 없음 | 후보 생성 안 함 | 미검증 |

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

- Discord·운영자 URL 수집 보조: 차단
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03 / `(미정)`
- 보류·차단 사유: 약관상 사전 서면 동의 없는 크롤링 금지

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책 gate로 비활성 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `POLICY_APPROVAL_REQUIRED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `DCINSIDE`
- collection policy: `DETAIL_ONLY`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/board/view/?id=&no=` / gallery:no
- 본문 selector: `.write_div, .writing_view_box .write_div, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: live `https://gall.dcinside.com/board/view/?id=hit&no=17798`, run `dcc43afd-5297-47b4-8716-f377dc8e5aa3`로 임시 Docker 개발 DB와 로컬 object raw/media/report readback 확인. 본문 blocks 16, media 13. 운영 DB/S3와 Discord Gateway는 미검증.

## 2026-09-23 Hot 목록 → 상세 → 개발 DB/object readback

- collection policy: `HOT_LIST`; `approved=true`, `batchApproved=true`는 개발 검증용 source 설정에 반영했다.
- Hot 목록 URL: `https://gall.dcinside.com/board/lists/?id=hit`
- 목록 parser: `tr.ub-content td.gall_tit a[href*=/board/view/]`, `.gall_list a[href*=/board/view/]`에서 `id`, `no` query를 가진 상세 URL을 추출한다.
- 상세 parser: `DCINSIDE`; 본문 selector `.write_div, .writing_view_box .write_div, article .content`.
- canonical/source post key: `/board/view/?id={gallery}&no={no}` / `{gallery}:{no}`.
- pagination: `.bottom_paging_box a[href]`, `.bottom_paging_wrap a[href]`에서 같은 gallery의 `page=N+1`만 따른다.
- 실제 실행: `./bin/blariyo-collector batch --source dcinside --chart hot --max-pages 1 --max-items 2 --since 24h --interval-ms 10000 --write-db`
- 개발 DB readback: run `dbcc0585-15b6-4d38-86c5-956d40fe61e3`, state `PARTIAL`, discovered 2, fetched 1, failures 1. 저장 item `hit:16435`, title `힛갤 기념품 변경 안내 - 갤로그 배지, 갤러콘 - HIT 갤러리`, blocks 30, media 2, media bytes 12156, raw object `collect/raw/dbcc0585-15b6-4d38-86c5-956d40fe61e3/hit_16435-0a2cb1273fc0.html`, report object 확인.
- 실패 readback: `collect.batch_failure`에 `DETAIL/PARSE_FAILED` 1건 저장. 해당 URL은 후속 fixture 확보 후 삭제/공지/본문 구조 차이를 분리해야 한다.
- 상태: hot-list 연계는 부분 검증됨. 운영 DB/S3와 Discord Gateway E2E는 아직 미검증.
