# 아카라이브 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `arcalive`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목 | 2026-09-24 저장소 대조 결과 |
| --- | --- |
| 현행 수집 분류 | `HOT_LIST`; [출처 정책](../source-collection-policy.md) |
| chart / 목록 URL | `hot` `https://arca.live/b/live` |
| 구현 | `ARCALIVE` — [목록 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/arcalive/ArcaliveListParser.java), [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/arcalive/ArcaliveDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/arcalive/ArcaliveAdapter.java) |
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
| 출처 표시명 | 아카라이브 |
| 운영 주체 | umanle S.R.L. |
| 기준 URL | https://arca.live/ |
| 허용 host | `arca.live` |
| 허용 path | `/b/{channel}`, `/b/{channel}/{articleId}` 후보. 사용 결정 전 production 비활성. |
| 제외 path | `/u/`, `/b/my`, edit/delete 경로, 로그인·개인·관리 경로 |
| 수집 목적 | 커뮤니티 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | https://arca.live/policy |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | footer의 `POLITICA DE PRIVACIDAD Y REGLAS DE USO` 링크는 확인했으나 `/policy`는 Cloudflare challenge로 본문 직접 확인 실패. |
| `robots.txt` URL | https://arca.live/robots.txt |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`는 `Allow: /`, `/u/`, `/b/my`, edit/delete 경로 제외. |
| 공개 API·RSS 제공 여부 | 공개 API·RSS 미확인 |
| 문의·중단 요청 채널 | `support@arca.live`, https://support.arca.live |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 중간 |

확인 결과가 불명확하거나 기술 gate를 통과하지 못하면 `활성 단계`를 `비활성`으로 유지한다.

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | robots는 일부 공개 경로 허용이나 정책 본문 확인 실패. |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용 | `/b/live` HOT_LIST 목록에서 상세 URL을 추출한다. Production 활성은 정책 승인 전까지 비활성이다. |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외 |

선택 parser type: `HTML_LIST`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | `https://arca.live/b/live` |
| 상세 URL pattern | `https://arca.live/b/{channel}/{numericArticleId}` |
| canonical URL 위치 | `<link rel="canonical">` 확인 |
| 허용 redirect | `arca.live` 내부 https redirect만 후보 |
| 제거할 query parameter | `mode`, pagination query 등은 중복 키에서 제거 후보. 확정 전 보류 |
| 유지할 query parameter | 상세 식별에 필요한 값 없음으로 추정하나 미검증 |
| pagination 방식·최대 범위 | 관측된 `p` query; live 검증은 1 page / 1 item / 10s interval |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다. 2026-09-22 local verification에서 `.article-list a.title[href]`로 상세 후보를 추출했고, canonical이 실제 채널 URL(`/b/{channel}/{id}`)로 바뀌는 경우에도 같은 numeric id이면 같은 글로 처리했다.

## 6. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | `<link rel="canonical">` | 1 | 요청 URL 사용 또는 실패 |
| 제목 | meta title 또는 article title 후보 | 1 | 후보 실패 |
| 본문 이미지 | article 본문 이미지 후보 | 1 | 후보 실패 또는 운영자 보정 |
| 이미지 순서 | DOM 순서 | 1 | DOM 순서 |
| 게시 시각 | `<time datetime>` | 1 | `null` |

이미지 제외 규칙:

- 로고·프로필·이모티콘: static icon, profile, channel icon 제외
- 광고·추적 pixel: ad, analytics, captcha asset 제외
- 추천글 thumbnail: sidebar/link-list 영역 제외
- 최소 크기·허용 MIME: `(미정)`
- 외부 CDN host 허용 범위: `ac.arca.live`, `arca.live`. 예전 fixture의 `ac*.namu.la` 계열은 운영 설정에 넣지 않는다.


## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목 | 확인값 |
| --- | --- |
| 식별 User-Agent | `blariyo-collector contact-(미정)` 운영 실값 필요 |
| 연락 수단 | `(미정)` |
| 요청 간격 | 최소 10초 |
| 일일 요청 상한 | `(미정)` |
| 자동 수집 실행 시간 | 사용하지 않음 |
| redirect 상한 | `(미정)` |
| timeout·응답 크기 상한 | `(미정)` |
| 연속 실패 자동 비활성 기준 | 기본 비활성 |

## 8. 검증 fixture와 결과

| 유형 | 샘플 식별값 | 기대 결과 | 확인 결과 |
| --- | --- | --- | --- |
| 정상 목록 | `/b/live` | HOT_LIST 목록 parser | 2026-09-22 local dry-run/write-db 통과 |
| 빈 목록 | 실제 공개 fixture | 0건 또는 구조 변경 | 승인 전 보류 |
| 정상 상세 | `https://arca.live/b/browndust2/183723777` | 제목·본문·이미지·canonical 추출 | 2026-09-22 local DB/object readback 통과 |
| 이미지 없는 상세 | synthetic fixture | 명시적 실패 또는 운영자 보정 | 미수행 |
| 삭제·차단 | synthetic fixture | 실패 기록·재시도 제한 | 미수행 |
| 구조 변경 | synthetic fixture | parser 실패 감지 | 미수행 |
| 중복 URL | canonical 후보 | 새 후보 생성 안 함 | numeric source post key 기준 dedup 적용 |

## 9. 활성화 판정

- [x] 운영 주체와 기준 URL 확인
- [ ] 이용약관·`robots.txt` 확인
- [ ] Discord·운영자 URL 수집 보조 fixture 검증
- [x] 목록·feed local verification
- [x] URL 정규화와 중복 방지 local verification
- [ ] 일일 상한·연속 실패 기준 확정. 요청 간격은 최소 10초로 구현
- [ ] 원문 HTML·이미지·개인정보가 로그에 남지 않음
- [ ] feature flag와 출처별 활성값 기본 비활성 확인
- [ ] 운영자 검수 없이 공개되지 않음

판정:

- Discord·운영자 URL 수집 보조: 보류
- 자동 수집: 차단
- 판정일·운영 위험 판정자: 2026-09-03 / `(미정)`
- 보류·차단 사유: 정책 본문 Cloudflare challenge로 직접 확인 실패, 권리·재사용 위험 판정 없음, fixture 미검증.

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 비활성 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `HOT_LIST`
- Hot/Top 목록 URL: `https://arca.live/b/live`
- 현재 활성화 사유: `POLICY_APPROVAL_REQUIRED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `HOT_LIST`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `ARCALIVE`
- collection policy: `HOT_LIST`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/b/{board}/{id}` / id
- 본문 selector: `.article-view .article-content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 구현됨. HOT_LIST batch는 목록→상세→DB/S3까지 같은 pipeline을 사용한다.
- 검증 상태: 실제 공개 URL 로컬 개발 DB/object readback 확인. 운영 DB/S3와 Discord Gateway는 미검증.
## 2026-09-23 hot-list live readback

- 실행: `bin/blariyo-collector batch --source arcalive --chart hot --max-pages 1 --max-items 1 --since 24h --interval-ms 10000 --write-db`
- 임시 승인 source 파일과 임시 Docker 개발 DB에서 검증했다. 운영 source 설정은 비활성 상태를 유지한다.
- live URL: `https://arca.live/b/yandere/183756861`
- run id: `3af6a0f0-2764-440b-8fc3-0f15f7c12604`
- 결과: 목록→상세 fetch→site detail parser→raw/media/report object→`collect.batch_item` readback `COMPLETED`
- 운영 DB/S3/R2와 Discord Gateway E2E는 미검증이다.
