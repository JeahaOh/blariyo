# 뽐뿌 수집 명세

- 명세 상태: 현행 구현·과거 정책 검토 분리 · 운영 활성화 미완료
- source key: `ppomppu`
- 작성일: 2026-09-03
- 최종 문서 대조일: 2026-09-24 (외부 접근 관측은 2026-09-23 기록)
- 확인 담당자: Codex
- 활성 단계: 로컬 검증과 운영 활성화 분리; 아래 현행 요약 참조
- parser version: 상세 parser의 `parserVersion` 출력과 Git revision으로 확인; 최초 검토의 `(미정)`과 구분

## 현행 구현과 검증 경계

| 항목 | 2026-09-24 저장소 대조 결과 |
| --- | --- |
| 현행 수집 분류 | `BLOCKED`; [출처 정책](../source-collection-policy.md) |
| chart / 목록 URL | `hot` `https://www.ppomppu.co.kr/hot.php` |
| 구현 | `PPOMPPU` — [목록 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/ppomppu/PpomppuListParser.java), [상세 parser](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/ppomppu/PpomppuDetailParser.java), [URL 식별·조합](../../../../apps/collector/src/main/java/com/blariyo/collector/source/sites/ppomppu/PpomppuAdapter.java) |
| 검증 범위 | 목록 HTTP 403 접근 차단. 목록·상세 parser와 합성 fixture는 있으나 실제 본문 수집 성공은 확인되지 않았다. |
| 실행 증거 | [실패 저장 readback](../../../../apps/collector/ops/reports/dev-blocked-readback-2026-09-23.md); [전체 검증표](../reference-site-validation.md)에서 임시 DB·지속 로컬 DB·운영 환경을 구분 |

- 아래 §1~10은 9월 3일 초기 정책·metadata 검토 기록이다. 당시의 `사용하지 않음`, selector 미정, fixture 미검증을 현재 코드 부재로 해석하지 않는다. 이용약관·robots·연락처와 운영 위험의 미확정 항목은 운영 활성화 전에 재확인한다.
- 9월 21~23일 절의 승인 플래그·parser 상태·실행 명령은 각 시점의 이력이다. 현행 [개발 예제 설정](../../../../apps/collector/ops/reference-sites.sources.example.json)의 `approved=true`, `batchApproved=true`는 운영 승인 증거가 아니다. 운영자의 별도 활성화 판정은 미완료다.
- 과거 일반 목록 실행의 `--chart hot`은 인기 목록 검증이 아니다. 현재 chart는 위 표를 따르며, `BLOCKED`·상세 전용 출처는 목록 성공으로 보고하지 않는다.
- 현재 보존·용량·검수는 [direct batch 계약](../README.md#12-현행-direct와-legacy의-적용-경계)을 따른다. 이후 이력의 원문 보관과 초기 metadata 임시 preview 규칙을 혼용하지 않는다.
- 이번 대조에서 외부 페이지·DB/R2·Discord를 새로 호출하지 않았다. 원격 batch writer와 Discord Gateway 실연동, 출처별 운영 활성화는 별도 인수 대상이다.

## 1. 출처 식별

| 항목 | 확인값 |
| --- | --- |
| 출처 표시명 | 뽐뿌 |
| 운영 주체 | 주식회사 뽐뿌커뮤니케이션 |
| 기준 URL | `https://www.ppomppu.co.kr/` |
| 허용 host | `(미정: 사용 결정 전 비활성)` |
| 허용 path | `(미정: 사용 결정 전 비활성)` |
| 제외 path | `/include/`, `/zboard/view.php?id=my`, `/search_bbs.php`, `/zboard/view_info2.php`, `/bookmark/`, `/openapi/`, `/redirect.php` |
| 수집 목적 | 운영자 검수용 짤 후보 metadata 생성 |

## 2. 정책·권리 확인

| 항목 | 확인값 |
| --- | --- |
| 이용약관 URL | `https://m.ppomppu.co.kr/new/bbs_view.php?id=regulation&no=4` |
| 이용약관 확인일 | 2026-09-03 |
| 수집 관련 조항 판단 | 약관은 회원 게시물 이용과 사전 동의 없는 정보 이용 제한을 포함한다. 크롤링 전용 허용 조항은 확인하지 못했다. |
| `robots.txt` URL | `https://www.ppomppu.co.kr/robots.txt` |
| `robots.txt` 확인일 | 2026-09-03 |
| User-Agent 적용 결과 | `User-agent: *`에서 `/zboard/`는 허용하나 일부 검색·개인·redirect·openapi 경로는 차단한다. |
| 공개 API·RSS 제공 여부 | `/openapi/`는 robots에서 차단되어 사용하지 않음 |
| 문의·중단 요청 채널 | `(미정)` |
| 운영 위험 판정자 | `(미정)` |
| 운영 위험도 | 중간 |

## 3. 수집 방법 결정

| 단계 | 사용 여부 | 방식·이유 |
| --- | --- | --- |
| Discord·운영자 URL 수집 보조 | 보류 | 상세 URL 1회 조회 허용 여부와 권리 판단 미확정 |
| 공식 공개 API·feed | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| RSS·Atom | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| server-rendered HTML 목록 | 사용하지 않음 | M0 수집 보조는 단일 상세 페이지 추출만 사용 |
| headless browser·로그인 자동화 | 사용하지 않음 | 초기 범위 제외 |

선택 parser type: `(미정: HTML_LIST / MANUAL)`

## 4. URL 규칙

| 항목 | 확인값 |
| --- | --- |
| 목록·feed URL | 사용하지 않음 |
| 상세 URL pattern | `https://www.ppomppu.co.kr/zboard/view.php?id={board}&no={id}` 후보이나 사용 결정 전 |
| canonical URL 위치 | `(미정)` |
| 허용 redirect | 동일 host만 후보, `/redirect.php` 사용 안 함 |
| 제거할 query parameter | `page`, `ppck`, `extref`, fragment 등 후보 |
| 유지할 query parameter | `id`, `no` 후보이나 미확정 |
| pagination 방식·최대 범위 | 사용하지 않음 |

## 5. 목록·feed 추출 규칙

[공통 추출·임시 파일 규칙](../README.md#source-common-rules)을 따른다.

목록 제외 규칙도 같은 공통 계약을 따른다.

## 6. 상세 추출 규칙

| 대상 | 추출 규칙 | 우선순위 | 실패 처리 |
| --- | --- | --- | --- |
| canonical URL | `(미정)` | `(미정)` | 후보 실패 |
| 제목 | `(미정)` | `(미정)` | 후보 실패 |
| 본문 이미지 | `(미정)` | `(미정)` | 후보 실패 또는 운영자 보정 |
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
| 정상 목록 | 없음 | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 빈 목록 | 없음 | BLOCKED/UNVERIFIED policy | 실행하지 않음 |
| 정상 상세 | `(미정)` | 제목·이미지 후보 추출 | 미검증 |
| 이미지 없는 상세 | `(미정)` | 명시적 실패 또는 운영자 보정 | 미검증 |
| 삭제·차단 | `(미정)` | 실패 기록·재시도 제한 | 미검증 |
| 구조 변경 | synthetic fixture | parser 실패 감지 | 미검증 |
| 중복 URL | `(미정)` | 새 후보 생성 안 함 | 미검증 |

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
- 판정일·운영 위험 판정자: 2026-09-03 / `(미정)`
- 보류·차단 사유: 약관상 수집 위험 있음, fixture·운영 위험 판정 미정

## 10. 변경 이력

| 날짜 | parser version | 변경 내용 | 재검증 결과 |
| --- | --- | --- | --- |
| 2026-09-03 | `(미정)` | 최초 검토 | 정책·기술 gate 미통과 |


## 2026-09-21 출처별 자동 수집 정책

- 자동 수집 정책: `BLOCKED`
- Hot/Top 목록 URL: `(없음)`
- 현재 활성화 사유: `SOURCE_ACCESS_BLOCKED`
- 이 정책은 공통 Hot 목록을 강제하지 않는다. `BLOCKED`가 `HOT_LIST`가 아니면 목록 parser와 pagination을 성공으로 표시하지 않는다.
- `HOT_LIST`도 정책 승인·robots·실제 fixture·DB/S3 readback 전까지 `approved=false`, `batchApproved=false`로 유지한다.

## 2026-09-23 상세 parser 구현 상태

- collector parser: `PPOMPPU`
- collection policy: `UNVERIFIED`; `approved=false`, `batchApproved=false` 유지
- 상세 URL 규칙: `/zboard/view.php?id=&no=` / board:no
- 본문 selector: `.board-contents, td.board-contents, #quote, article .content`
- 이미지 selector: `img[data-original]`, `img[data-src]`, `img[data-lazy-src]`, `img[src]`
- 첨부 파일 추출: `a[href]` 중 파일 확장자(`pdf`, `zip`, `hwp`, `docx`, `xlsx`, `pptx`, `mp4` 등)를 `attachmentCandidates`로 분리하고 write-db에서는 `FILE` media로 저장한다.
- SNS 추출: 본문 DOM 순서의 `a[href]`, `blockquote.twitter-tweet`, `data-instgrm-permalink`, `iframe[src]`를 `LINK` 블록으로 보존한다. X/Twitter, Instagram, YouTube, TikTok은 원문 URL로 저장한다.
- 목록 parser: 미구현. `collect-url`/Discord URL 수동 입력용 detail-only 경로만 있다.
- 검증 상태: synthetic fixture와 `DirectUrlRunnerAllSiteParserTests` 저장 경로만 검증. 실제 공개 URL·개발/운영 DB/S3 readback은 미검증.

## 2026-09-23 live 검증 갱신

- `https://www.ppomppu.co.kr/zboard/view.php?id=humor&no=123456`, `https://m.ppomppu.co.kr/new/bbs_view.php?id=humor&no=123456` 모두 nginx 403을 반환했다.
- `PPOMPPU` detail parser fixture는 유지하지만, 현재 실행 환경에서는 live 게시글 fetch와 DB/S3 readback을 완료로 표시하지 않는다.
- 403 우회 구현 없이 공개 접근 가능한 경로가 확인될 때만 verified로 승격한다.

## 2026-09-23 parser 구현 갱신

- 공식 안내와 공개 검색 결과에서 확인되는 `https://www.ppomppu.co.kr/hot.php`를 HOT 후보 URL로 source registry에 기록했다.
- `PPOMPPU` list parser fixture는 `/zboard/view.php?id={board}&no={id}` 상세 링크와 `?page=N` pagination을 추출하도록 구현했다.
- live 실행은 `www`와 `m` 경로 모두 nginx 403으로 차단되므로 `chartVerified=false`, `collectionPolicy=BLOCKED`로 유지한다.
- 추가 확인: `https://www2.ppomppu.co.kr/hot.php`, `https://m.ppomppu.co.kr/new/hot_bbs.php`, `https://m.ppomppu.co.kr/new/hot.php`, `https://m.ppomppu.co.kr/new/menu_list.php?menu=4`도 모두 nginx 403을 반환했다. 공개 대체 host로 live 검증을 완료하지 못했다.
