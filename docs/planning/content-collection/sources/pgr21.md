# 피지알21 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `pgr21`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목             | 2026-09-24 저장소 대조 결과                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 현행 수집 분류   | `DETAIL_ONLY`; [출처 정책](../source-collection-policy.md)                                                                                                                                                                                              |
| chart / 목록 URL | 없음 — 상세 URL 단건 경로만 사용                                                                                                                                                                                                                        |
| 구현             | `PGR21` — [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/pgr21/Pgr21DetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/pgr21/Pgr21Adapter.java) |
| 검증 범위        | 상세 응답의 Anubis 접근 확인으로 본문 수집 차단. 목록 parser는 없고 상세 parser·실패 저장 경로를 구현했다.                                                                                                                                              |
| 실행 증거        | [실패 저장 readback](../../../../apps/collector/ops/reports/dev-blocked-readback-2026-09-23.md); [전체 검증표](../reference-site-validation.md)에서 임시 DB·지속 로컬 DB·운영 환경을 구분                                                               |

- 아래 §1~10은 9월 3일 초기 정책·metadata 검토 기록이다. 당시의 `사용하지 않음`, selector 미정, fixture 미검증을 현재 코드 부재로 해석하지 않는다. 이용약관·robots·연락처와 운영 위험의 미확정 항목은 운영 활성화 전에 재확인한다.
- 9월 21~23일 절의 승인 플래그·parser 상태·실행 명령은 각 시점의 이력이다. 현행 [개발 예제 설정](../../../../apps/collector/ops/reference-sites.sources.example.json)의 `approved=true`, `batchApproved=true`는 운영 승인 증거가 아니다. 운영자의 별도 활성화 판정은 미완료다.
- 과거 일반 목록 실행의 `--chart hot`은 인기 목록 검증이 아니다. 현재 chart는 위 표를 따르며, `BLOCKED`·상세 전용 출처는 목록 성공으로 보고하지 않는다.
- 현재 보존·용량·검수는 [direct batch 계약](../README.md#12-현행-direct와-legacy의-적용-경계)을 따른다. 이후 이력의 원문 보관과 초기 metadata 임시 preview 규칙을 혼용하지 않는다.
- 이번 대조에서 외부 페이지·DB/R2·Discord를 새로 호출하지 않았다. 원격 batch writer와 Discord Gateway 실연동, 출처별 운영 활성화는 별도 인수 대상이다.

## 1. 출처 식별

| 항목        | 확인값                              |
| ----------- | ----------------------------------- |
| 출처 표시명 | PGR21                               |
| 운영 주체   | `(미정)`                            |
| 기준 URL    | `https://pgr21.com`                 |
| 허용 host   | 없음                                |
| 허용 path   | 없음                                |
| 제외 path   | 전체                                |
| 수집 목적   | 공개 유머·커뮤니티 게시글 후보 검토 |

## 2. 정책·권리 확인

| 항목                   | 확인값                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| 이용약관 URL           | `(미정)`; 검색 결과에서 사이트 이용약관 링크는 관찰되나 현재 직접 접근은 연결 확인 화면으로 차단됨 |
| 이용약관 확인일        | 2026-09-03                                                                                         |
| 수집 관련 조항 판단    | 약관 원문을 현재 세션에서 확인하지 못했다.                                                         |
| `robots.txt` URL       | `https://pgr21.com/robots.txt`                                                                     |
| `robots.txt` 확인일    | 2026-09-03                                                                                         |
| User-Agent 적용 결과   | robots 요청이 `text/html` 연결 확인 화면으로 반환되어 유효한 robots 규칙을 확인하지 못했다.        |
| 공개 API·RSS 제공 여부 | `(미정)`                                                                                           |
| 문의·중단 요청 채널    | 건의 게시판은 검색 결과에서 관찰. 수집 중단 전용 채널은 `(미정)`                                   |
| 운영 위험 판정자       | `(미정)`                                                                                           |
| 운영 위험도            | 높음                                                                                               |

## 3. 수집 방법 결정

| 단계                           | 사용 여부     | 방식·이유                                                   |
| ------------------------------ | ------------- | ----------------------------------------------------------- |
| Discord·운영자 URL 수집 보조   | 차단          | robots와 약관을 직접 확인하지 못했고 연결 확인 장치가 있다. |
| 공식 공개 API·feed             | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용                 |
| RSS·Atom                       | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용                 |
| server-rendered HTML 목록      | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용                 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외.                                             |

선택 parser type: `MANUAL`

## 4. URL 규칙

URL 규칙은 확정하지 않는다. 출처 등록 목록에 등록하지 않는다.

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

사용하지 않는다.

## 6-1. 이미지 임시 저장·승격 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

## 7. 요청·운영 제한

| 항목                       | 확인값        |
| -------------------------- | ------------- |
| 식별 User-Agent            | 사용하지 않음 |
| 연락 수단                  | `(미정)`      |
| 요청 간격                  | 사용하지 않음 |
| 일일 요청 상한             | 0             |
| 자동 수집 실행 시간        | 사용하지 않음 |
| redirect 상한              | 사용하지 않음 |
| timeout·응답 크기 상한     | 사용하지 않음 |
| 연속 실패 자동 비활성 기준 | 기본 비활성   |

## 8. 검증 fixture와 결과

fixture 작성 대상이 아니다.

## 9. 활성화 판정

- [ ] 운영 주체와 기준 URL 확인
- [ ] 이용약관·`robots.txt` 확인
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
- 판정일·운영 위험 판정자: 2026-09-03, 운영 위험 판정자 `(미정)`
- 보류·차단 사유: 연결 확인 장치가 있어 robots·약관 원문 확인 실패. 우회하지 않는다.

## 10. 변경 이력

| 날짜       | parser version | 변경 내용 | 재검증 결과      |
| ---------- | -------------- | --------- | ---------------- |
| 2026-09-03 | `(미정)`       | 최초 검토 | 확인 실패로 차단 |

## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `ROBOTS_CHALLENGE`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `PGR21`
- collection policy: `UNVERIFIED`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/{board}/{id}` / board:id
- 본문 selector: `.viewContent, .post_content, #view_content, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: synthetic fixture와 `DirectUrlRunnerAllSiteParserTests` 저장 경로만 검증. 실제 공개 URL·개발/운영 DB/S3 readback은 미검증.

## 2026-09-23 live 검증 갱신

- `https://pgr21.com/humor/123456`은 HTTP 200이지만 실제 게시글 HTML이 아니라 Anubis `연결 확인 중` challenge 페이지를 반환했다.
- `PGR21` detail parser fixture는 유지하지만, 현재 실행 환경에서는 live 게시글 fetch와 DB/S3 readback을 완료로 표시하지 않는다.
- challenge 우회는 구현하지 않는다. 공개 접근이 가능한 allowlisted 환경 또는 별도 수동 fixture 검증이 필요하다.
- 추가 확인: `https://pgr21.com/`, `https://pgr21.com/humor` 모두 실제 게시판 HTML이 아니라 Anubis `연결 확인 중` 페이지를 반환했다. 공개 대체 목록 경로로 live 검증을 완료하지 못했다.
