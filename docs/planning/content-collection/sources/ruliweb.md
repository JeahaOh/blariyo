# 루리웹 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `ruliweb`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목 | 2026-09-24 저장소 대조 결과 |
| --- | --- |
| 현행 수집 분류 | `HOT_LIST`; [출처 정책](../source-collection-policy.md) |
| chart / 목록 URL | `hot` `https://bbs.ruliweb.com/best/humor` |
| 구현 | `RULIWEB` — [목록 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/ruliweb/RuliwebListParser.java), [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/ruliweb/RuliwebDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/ruliweb/RuliwebAdapter.java) |
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
| 출처 표시명 | 루리웹 |
| 운영 주체 | 루리웹닷컴 |
| 기준 URL | `https://bbs.ruliweb.com` |
| 허용 host | `bbs.ruliweb.com`, `www.ruliweb.com` |
| 허용 path | `(미정)` |
| 제외 path | `/search`, `/timeline`, `/allbbs`, `/member`, 검색·정렬 query 포함 URL |
| 수집 목적 | 공개 유머·커뮤니티 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://bbs.ruliweb.com/etcs/board/10/read/123` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 약관 제13조에서 회사 서비스 정보를 사전 승낙 없이 복제·출판·방송·제3자 제공하는 행위를 금지한다. Discord·운영자 URL 수집 보조와 자동 수집 모두 운영 위험 판정이 필요하다. |
| `robots.txt` URL | `https://bbs.ruliweb.com/robots.txt`, `https://www.ruliweb.com/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`에 검색·타임라인·회원·검색/정렬 query 차단 규칙이 있다. 전체 게시글 경로가 일괄 차단되지는 않지만 약관 제한 때문에 사용 결정 근거로 사용하지 않는다. |
| 공개 API·RSS 제공 여부 | `(미정)` |
| 문의·중단 요청 채널 | `https://bbs.ruliweb.com/etcs/board/10/read/4` 기사제보/Press 확인. 수집 중단 전용 채널은 `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 높음 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 상세 1회 fetch도 약관상 사전 승낙 필요 여부가 불명확하다. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외. |

선택 parser type: `MANUAL`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `https://bbs.ruliweb.com/*/board/*/read/*` 형식 관찰. 사용 결정 전 비활성. |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 같은 host의 `https` redirect만 검토 가능. |
| 제거할 query parameter | 검색·정렬·view 계열 query는 제외 후보. |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

상세 추출은 사용 결정하지 않는다. 제목·본문 이미지·게시 시각 selector와 이미지 제외 규칙은 `(미정)`이다.


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `(미정)` |
| 연락 수단 | `(미정)` |
| 요청 간격 | `(미정)` |
| 일일 요청 상한 | `(미정)` |
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
- 보류·차단 사유: 약관상 사전 승낙 없는 정보 복제·제공 금지 조항 확인. 별도 허가 전 자동 수집 차단.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책 확인 완료, parser 미검증 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `HOT_LIST` 구현, 운영 source 예제는 비활성
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: 운영 DB/S3/R2와 Discord Gateway 미검증
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `RULIWEB`
- collection policy: `HOT_LIST`; 운영 source 예제는 `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/.../board/{board}/read/{id}` / board:id
- 본문 selector: `.view_content[itemprop=articleBody], .view_content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 구현. `hot` 목록에서 상세 URL을 추출하고 같은 batch 실행에서 detail parser로 이어간다.
- 검증 상태: synthetic fixture, live hot-list batch, 임시 개발 DB/object readback 검증. 운영 DB/S3/R2와 Discord Gateway는 미검증. live URL `https://bbs.ruliweb.com/community/board/300143/read/76767888`, run `babebfb1-4915-456f-bf37-8d5b807c342d`, DB readback `source_post_key=300143:76767888`, blocks 6, media 3.

## 2026-09-23 live 개발 DB readback

- 실행: `bin/blariyo-collector batch --source ruliweb --chart hot --max-pages 1 --max-items 1 --since 24h --interval-ms 10000 --write-db`
- live URL: `https://bbs.ruliweb.com/community/board/300143/read/76767888`
- run id: `babebfb1-4915-456f-bf37-8d5b807c342d`
- DB readback: `blocks 6, media 3`
- object readback: raw HTML, media object, JSONL report 확인. 운영 DB/S3/R2와 Discord Gateway는 미검증.
