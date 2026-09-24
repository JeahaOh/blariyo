# 유튜브 커뮤니티 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `youtube-community`
- 작성일: 2026-09-21
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: `(미정)`
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목 | 2026-09-24 저장소 대조 결과 |
| --- | --- |
| 현행 수집 분류 | `DETAIL_ONLY`; [출처 정책](../source-collection-policy.md) |
| chart / 목록 URL | 없음 — 상세 URL 단건 경로만 사용 |
| 구현 | `YOUTUBE_COMMUNITY` — [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/youtubecommunity/YoutubeCommunityDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/youtubecommunity/YoutubeCommunityAdapter.java) |
| 검증 범위 | 정적 응답에 게시글 renderer가 없어 PARSE_FAILED. 목록 parser는 없고 상세 DOM/ytInitialData parser·실패 저장 경로를 구현했다. |
| 실행 증거 | [실패 저장 readback](../../../../apps/collector/ops/reports/dev-blocked-readback-2026-09-23.md); [전체 검증표](../reference-site-validation.md)에서 임시 DB·지속 로컬 DB·운영 환경을 구분 |

- 아래 §1~6은 9월 21일 초기 정책·구조 검토 기록이다. 당시의 `사용하지 않음`, selector 미정, fixture 미검증을 현재 코드 부재로 해석하지 않는다. 이용약관·robots·연락처와 운영 위험의 미확정 항목은 운영 활성화 전에 재확인한다.
- 9월 21~23일 절의 승인 플래그·parser 상태·실행 명령은 각 시점의 이력이다. 현행 [개발 예제 설정](../../../../apps/collector/ops/reference-sites.sources.example.json)의 `approved=true`, `batchApproved=true`는 운영 승인 증거가 아니다. 운영자의 별도 활성화 판정은 미완료다.
- 과거 일반 목록 실행의 `--chart hot`은 인기 목록 검증이 아니다. 현재 chart는 위 표를 따르며, `BLOCKED`·상세 전용 출처는 목록 성공으로 보고하지 않는다.
- 현재 보존·용량·검수는 [direct batch 계약](../README.md#12-현행-direct와-legacy의-적용-경계)을 따른다. 이후 이력의 원문 보관과 초기 metadata 임시 preview 규칙을 혼용하지 않는다.
- 이번 대조에서 외부 페이지·DB/R2·Discord를 새로 호출하지 않았다. 원격 batch writer와 Discord Gateway 실연동, 출처별 운영 활성화는 별도 인수 대상이다.

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 유튜브 커뮤니티 |
| 운영 주체 | Google LLC / 채널 운영자 `(법적 사용 주체 확인 필요)` |
| 기준 URL | https://www.youtube.com/ |
| 허용 host | `www.youtube.com` `(채널 URL·redirect 확인 필요)` |
| 허용 path | `/@채널핸들/community` `(실제 URL 규칙 검증 필요)` |
| 제외 path | 로그인·비공개·멤버 전용·라이브 채팅 경로 `(미정)` |
| 수집 목적 | 공개 커뮤니티 게시물 후보 검토 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | https://www.youtube.com/static?template=terms |
| 이용약관 확인일 | `(미정)` |
| 수집 관련 조항 판단 | `(법무 검토 필요)` |
| `robots.txt` URL | https://www.youtube.com/robots.txt |
| `robots.txt` 확인일 | `(미정)` |
| User-Agent 적용 결과 | `(미정)` |
| 공개 API·RSS 제공 여부 | YouTube Data API·공개 페이지 여부 확인 필요 |
| 문의·중단 요청 채널 | `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | `(미정: 낮음 / 중간 / 높음)` |

확인 전에는 출처를 활성화하지 않는다.

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | `(미정)` | 공개 커뮤니티 게시물 단일 URL 검토 |
| 공식 공개 API·feed | `(미정)` | YouTube Data API 사용 조건·quota 확인 필요 |
| RSS·Atom | 사용하지 않음 | 공식 제공 여부 확인 전 |
| server-rendered HTML 목록 | `(미정)` | 커뮤니티 탭 구조·로그인 요구 확인 필요 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위에서 인증·차단 우회 금지 |

선택 parser type: `(미정: YOUTUBE_COMMUNITY / METADATA)`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 `(미정)` |
| 상세 URL pattern | `https://www.youtube.com/@{handle}/community/{postId}` 후보, 실제 확인 필요 |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 같은 YouTube host 내 redirect만 `(미정)` |
| 제거할 query parameter | `(미정)` |
| 유지할 query parameter | `(미정)` |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | `(미정)` |
| 제목 | `(미정)` | `(미정)` | 후보 실패 |
| 본문 텍스트 | `(미정)` | `(미정)` | 후보 실패 |
| 본문 이미지 | `(미정)` | `(미정)` | 후보 실패 또는 운영자 보정 |
| YouTube 영상 링크 | 공식 watch/shorts URL을 LINK 블록으로 보존 `(미정)` | `(미정)` | 원문 링크만 보존 |
| 게시 시각 | `(미정)` | `(미정)` | `null` |

임베드 영상 자체를 내려받아 복제하지 않는다. 삭제·비공개·멤버 전용이면 원문 링크와 실패 사유만 남긴다.

## 6. 검증 fixture와 활성화 판정

- 정상 공개 커뮤니티 게시물 URL: `(미정)`
- 이미지 포함 게시물: `(미정)`
- 영상 링크 포함 게시물: `(미정)`
- 삭제·비공개·멤버 전용 게시물: `(미정)`
- 로그인 요구·구조 변경 fixture: `(미정)`
- 실제 URL·robots·약관·parser 테스트 전까지 활성화하지 않는다.


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `PLATFORM_PERMISSION_REQUIRED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `YOUTUBE_COMMUNITY`
- collection policy: `UNVERIFIED`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/post/{id}` / post id
- 본문 selector: `ytd-backstage-post-renderer #content-text, yt-formatted-string#content-text, #content-text, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: live `https://www.youtube.com/post/UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ`, run `2ad7ece4-f030-4a25-815c-9802052d1173`에서 fetch는 200이었으나 정적 HTML에 `backstagePostRenderer`/`contentText`가 없어 `PARSE_FAILED`. HTML에는 `/feed/post_detail` endpoint와 post id만 존재한다. 공식/동적 API 또는 별도 권한 경로 전까지 live DB readback 미완료.

## 2026-09-23 live 검증 갱신

- `https://www.youtube.com/post/UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ`는 HTTP 200 HTML을 반환하지만 정적 문서에는 `backstagePostRenderer`, `contentText`, `postMultiImageRenderer`가 없고 `/feed/post_detail` command만 포함한다.
- HTML에서 추출한 `youtubei/v1/browse` 공개 웹 context 호출은 `INVALID_ARGUMENT`로 실패했다.
- `YOUTUBE_COMMUNITY` detail parser fixture는 유지하지만, 현재 실행 환경에서는 live 본문 추출과 DB/S3 readback을 완료로 표시하지 않는다. 공식 API 또는 안정적인 공개 데이터 경로가 필요하다.

## 2026-09-23 parser 구현 갱신

- `YOUTUBE_COMMUNITY` detail parser에 `ytInitialData.backstagePostRenderer` fallback을 추가했다.
- fixture에서는 `contentText.runs[].text`를 `TEXT` block으로, `i.ytimg.com`/`yt3.ggpht.com` thumbnail을 `IMAGE` block과 media candidate로 추출한다.
- live `https://www.youtube.com/post/UgkxHHtsak1SC8mRGHMZewc4HzeAY3yhPPmJ` dry-run `77d264e5-aa01-4f78-9ca9-f2fe9bffeeb9`는 여전히 `PARSE_FAILED`다. 해당 HTML에는 post 본문 renderer가 없으므로 DB/S3 readback 완료로 표시하지 않는다.
