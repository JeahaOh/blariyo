# 웃긴대학 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `humoruniv`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목             | 2026-09-24 저장소 대조 결과                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 현행 수집 분류   | `GENERAL_LIST`; [출처 정책](../source-collection-policy.md)                                                                                                                                                                                                                                                                                                                                                |
| chart / 목록 URL | `latest` `https://m.humoruniv.com/board/list.html?table=pds`                                                                                                                                                                                                                                                                                                                                               |
| 구현             | `HUMORUNIV` — [목록 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/humoruniv/HumorunivListParser.java), [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/humoruniv/HumorunivDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/humoruniv/HumorunivAdapter.java) |
| 검증 범위        | 목록·상세 parser 구현. 9월 23일 실제 공개 URL의 개발 DB/object readback과 정제한 관측 fixture가 있다. 모든 글·모든 첨부 유형의 성공을 뜻하지 않는다.                                                                                                                                                                                                                                                       |
| 실행 증거        | [관측 fixture](../../../../apps/collector/src/test/resources/sites/observed/README.md); [전체 검증표](../reference-site-validation.md)에서 임시 DB·지속 로컬 DB·운영 환경을 구분                                                                                                                                                                                                                           |

- 아래 §1~10은 9월 3일 초기 정책·metadata 검토 기록이다. 당시의 `사용하지 않음`, selector 미정, fixture 미검증을 현재 코드 부재로 해석하지 않는다. 이용약관·robots·연락처와 운영 위험의 미확정 항목은 운영 활성화 전에 재확인한다.
- 9월 21~23일 절의 승인 플래그·parser 상태·실행 명령은 각 시점의 이력이다. 현행 [개발 예제 설정](../../../../apps/collector/ops/reference-sites.sources.example.json)의 `approved=true`, `batchApproved=true`는 운영 승인 증거가 아니다. 운영자의 별도 활성화 판정은 미완료다.
- 과거 일반 목록 실행의 `--chart hot`은 인기 목록 검증이 아니다. 현재 chart는 위 표를 따르며, `BLOCKED`·상세 전용 출처는 목록 성공으로 보고하지 않는다.
- 현재 보존·용량·검수는 [direct batch 계약](../README.md#12-현행-direct와-legacy의-적용-경계)을 따른다. 이후 이력의 원문 보관과 초기 metadata 임시 preview 규칙을 혼용하지 않는다.
- 이번 대조에서 외부 페이지·DB/R2·Discord를 새로 호출하지 않았다. 원격 batch writer와 Discord Gateway 실연동, 출처별 운영 활성화는 별도 인수 대상이다.

## 1. 출처 식별

| 항목        | 확인값                     |
| ----------- | -------------------------- |
| 출처 표시명 | 웃긴대학                   |
| 운영 주체   | `(미정)`                   |
| 기준 URL    | https://web.humoruniv.com/ |
| 허용 host   | `(미정)`                   |
| 허용 path   | 없음                       |
| 제외 path   | 전체 경로                  |
| 수집 목적   | 커뮤니티 게시글 후보 검토  |

## 2. 정책·권리 확인

| 항목                   | 확인값                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이용약관 URL           | `(미정)`                                                                                                                                                             |
| 이용약관 확인일        | 2026-09-03                                                                                                                                                           |
| 수집 관련 조항 판단    | 이용약관 본문 직접 확인 실패.                                                                                                                                        |
| `robots.txt` URL       | https://web.humoruniv.com/robots.txt                                                                                                                                 |
| `robots.txt` 확인일    | 2026-09-03                                                                                                                                                           |
| User-Agent 적용 결과   | `User-agent: *`는 `/search/`, `/user/`, `/chat/`, `/memo/`, `/battle/`, `/board/best/`, `/*.php` 등 다수 경로 금지. GPTBot, ClaudeBot, OAI-SearchBot 등은 전체 금지. |
| 공개 API·RSS 제공 여부 | `(미정)`                                                                                                                                                             |
| 문의·중단 요청 채널    | `(미정)`                                                                                                                                                             |
| 운영 위험 판정자       | `(미정)`                                                                                                                                                             |
| 운영 위험도            | 높음                                                                                                                                                                 |

확인 결과가 불명확하거나 기술 gate를 통과하지 못하면 `활성 단계`를 `비활성`으로 유지한다.

## 3. 수집 방법 결정

| 단계                           | 사용 여부     | 방식·이유                                                                               |
| ------------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| Discord·운영자 URL 수집 보조   | 차단          | robots에서 주요 `.php` 상세로 보이는 경로와 AI/OAI 계열 봇 전체 금지. 약관 본문 미확인. |
| 공식 공개 API·feed             | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용                                             |
| RSS·Atom                       | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용                                             |
| server-rendered HTML 목록      | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용                                             |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외                                                                          |

선택 parser type: `MANUAL`

## 4. URL 규칙

| 항목                      | 확인값                                           |
| ------------------------- | ------------------------------------------------ |
| 목록·feed URL             | 사용하지 않음                                    |
| 상세 URL pattern          | `/board/.../read.html?...` 후보. 사용 패턴 아님. |
| canonical URL 위치        | `(미정)`                                         |
| 허용 redirect             | 없음                                             |
| 제거할 query parameter    | `(미정)`                                         |
| 유지할 query parameter    | `(미정)`                                         |
| pagination 방식·최대 범위 | 사용하지 않음                                    |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

| 대상          | 추출 규칙     | 우선순위 | 실패 처리 |
| ------------- | ------------- | -------- | --------- |
| canonical URL | 사용하지 않음 | 없음     | 실패      |
| 제목          | 사용하지 않음 | 없음     | 후보 실패 |
| 본문 이미지   | 사용하지 않음 | 없음     | 후보 실패 |
| 이미지 순서   | 사용하지 않음 | 없음     | 후보 실패 |
| 게시 시각     | 사용하지 않음 | 없음     | `null`    |

이미지 제외 규칙:

- 로고·프로필·이모티콘: 전체 제외
- 광고·추적 pixel: 전체 제외
- 추천글 thumbnail: 전체 제외
- 최소 크기·허용 MIME: `(미정)`
- 외부 CDN host 허용 범위: 없음

## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목                       | 확인값        |
| -------------------------- | ------------- |
| 식별 User-Agent            | `(미정)`      |
| 연락 수단                  | `(미정)`      |
| 요청 간격                  | 요청하지 않음 |
| 일일 요청 상한             | 0             |
| 자동 수집 실행 시간        | 사용하지 않음 |
| redirect 상한              | 0             |
| timeout·응답 크기 상한     | `(미정)`      |
| 연속 실패 자동 비활성 기준 | 기본 비활성   |

## 8. 검증 fixture와 결과

| 유형             | 샘플 식별값        | 기대 결과                 | 확인 결과     |
| ---------------- | ------------------ | ------------------------- | ------------- |
| 정상 목록        | 없음               | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 빈 목록          | 없음               | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 정상 상세        | 해당 없음          | 후보 실패                 | 미수행        |
| 이미지 없는 상세 | 해당 없음          | 후보 실패                 | 미수행        |
| 삭제·차단        | robots 광범위 금지 | 실패 기록                 | 정책상 미수행 |
| 구조 변경        | synthetic fixture  | parser 실패 감지          | 미수행        |
| 중복 URL         | 해당 없음          | 새 후보 생성 안 함        | 미수행        |

## 9. 활성화 판정

- [ ] 운영 주체와 기준 URL 확인
- [ ] 이용약관·`robots.txt` 확인
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
- 보류·차단 사유: robots 금지 경로가 넓고 AI/OAI 계열 봇 전체 금지, 이용약관 본문 미확인.

## 10. 변경 이력

| 날짜       | parser version | 변경 내용 | 재검증 결과 |
| ---------- | -------------- | --------- | ----------- |
| 2026-09-03 | `(미정)`       | 최초 검토 | 비활성      |

## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_DISALLOWED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `HUMORUNIV`
- collection policy: `UNVERIFIED`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/board/.../read.html?table=&number=` / table:number
- 본문 selector: `#cnts, #board_view, .view_content, .board-view-contents, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: synthetic fixture와 `DirectUrlRunnerAllSiteParserTests` 저장 경로만 검증. 실제 공개 URL·개발/운영 DB/S3 readback은 미검증.

## 2026-09-23 Hot 목록/detail parser 재검증 진행

- 공개 모바일 목록 URL `https://m.humoruniv.com/board/list.html?table=pds`와 모바일 상세 URL `https://m.humoruniv.com/board/read.html?table=pds&number={id}`를 기준으로 list adapter와 `HUMORUNIV` 전용 detail parser를 추가했다.
- source 설정은 `hostAliases`로 `m.humoruniv.com`, `web.humoruniv.com`, `humoruniv.com`을 같은 출처로 취급한다.
- 상세 parser는 공통 ordered parser가 아니라 사이트 전용으로 `p.content_body_padding` 본문 텍스트와 `.daum-wm-content .wrap_img img` 본문 이미지만 추출한다. 모바일 HTML에서 댓글 영역이 같은 컨테이너 뒤에 붙어 있어 공통 selector를 쓰면 댓글 이미지까지 섞이기 때문이다.
- 실제 검증 결과: direct run `2063e865-50c5-4480-907a-aca22aaf7509`는 `SOURCE_NOT_ALLOWED`, batch run `5bc5876f-f86a-4b13-b294-b7760b847bf6`은 discovered 2 후 `PARSE_FAILED` 2건으로 실패했다. 따라서 개발 DB readback은 아직 미완료이며 완료로 표시하지 않는다.
- 다음 조치: PinnedHttp referer/cookie 유지 상태와 모바일 상세 응답 차이를 fixture로 저장해 parser 입력 HTML을 고정하고, media fetch에서 막히는 URL을 `collect.batch_failure.detail`에 남기도록 실패 기록을 확장한다.

## 2026-09-23 검증 갱신

- hot list → detail → write-db 개발 DB readback 확인.
- 실행 run: `bbd800b5-87f2-4e5f-9a81-60e67c29729d`
- 실제 상세 URL: `https://m.humoruniv.com/board/read.html?table=pds&number=1425984`
- source post key: `pds:1425984`
- DB readback: `collect.batch_item.state=FETCHED`, `body_blocks=1`, `batch_media=1`, raw object 저장 확인.
- Object readback: `collect/report/bbd800b5-87f2-4e5f-9a81-60e67c29729d.jsonl`, `collect/raw/bbd800b5-87f2-4e5f-9a81-60e67c29729d/pds_1425984-0a5bdda040c3.html`, `collect/media/ce005ed4-5cab-46be-9093-e5694ce5cad8/1`.
- 이 샘플은 이미지형 글이어서 본문 block은 `IMAGE` 1개로 저장됐다. 텍스트형 글의 본문 보존은 별도 샘플로 추가 검증 필요.
- 보강 사항: 모바일 상세의 본문 이미지 CDN `https://down-webp.humoruniv.com/`을 media allowlist에 추가했다.
