# M0 점검 근거·검증 범위 — 2026-09-26

## 1. 관측 시점과 Git 경계

- 아래 점검 결과는 같은 대화에서 수행한 2026-09-26 선행 점검의 도구 출력을 정리한 것이다. 기록 작성 중 재실행한 문서 검증은 §5에 분리한다.
- 점검 시작: `develop@6c7abd4`, `develop...origin/develop [ahead 2]`, clean.
- 점검 중 다른 작업에서 checkout 변경 관측. 최종: `release@02c041a680df1fc1a7318ed4c1fff8c1e7663837`, `release...origin/release [ahead 1]`, clean.
- 기록 작성 시작 16:42 KST에도 같은 release·SHA·clean 상태를 확인했다. 이 작업에서 checkout·commit·reset을 실행하지 않았다.
- 시작/종료 SHA 사이의 변경은 Git 검사 도구와 governance 작업 기록이었다. 아래 비교는 종료 코드 0으로 M0 대조 대상의 차이가 없음을 확인했다.

```sh
git diff --quiet 6c7abd4 HEAD -- apps packages docs tests/browser tests/consent.test.ts deploy .github
```

- 원격 조회·fetch 없이 로컬 추적 참조를 읽었다. ahead 수치를 원격 서버의 현재 상태로 해석하지 않는다.

## 2. 요구사항·소스 대조

| 검사 | 실제 수행 방식 | 결과·한계 |
| --- | --- | --- |
| 요구사항 집계 | Python으로 `requirements-status.md`의 C/A/B/O 행 ID와 I/P/U 열 추출 | 40행, I30/P9/U1. 영역별 C15/1/0, A6/2/0, B6/1/1, O3/5/0 |
| 요구사항 참조 | 같은 파일의 로컬 Markdown 링크에서 fragment를 제외하고 파일 존재 검사 | 링크 발생 96개, 없는 파일 0. 내용 충족·anchor 유효성 검사는 아님 |
| M0 범위 | planning 서비스·분석 계획, legal 안내, system-design, 상태·로드맵·task 원문 대조 | M0 Core/수집 보조/자동 수집과 후속 기능 구분 |
| 테스트 근거 | 기존 실행 보고서·테스트 소스 읽기 | 오늘 테스트 통과로 집계하지 않음 |
| diff 형식 | 선행 점검의 `git diff --check` | 통과. 당시 작업 트리 clean |

주요 구현 차이의 소스 위치는 점검 SHA 기준이다.

| 항목 | 소스 근거 | 확인 내용 |
| --- | --- | --- |
| 정책 이력 | [PolicyViewer.vue](../../../apps/web/app/components/PolicyViewer.vue), 4–11·36–41행 | 버전 선택값 변경만 있고 명시적 본문 상단·초점 이동 없음 |
| 상세 공유·하단 오류 | [상세 페이지](../../../apps/web/app/pages/[boardSlug]/posts/[postId].vue), 55–71·95–134행 | 이미지 alt·크기 meta, 하단 영역 재시도, native 공유 성공/취소 안내 잔여 |
| 목록 초점 | [목록 페이지](../../../apps/web/app/pages/[boardSlug]/index.vue), 3–7·38·48–52행 | 페이지 이동 뒤 heading 초점 처리 없음 |
| 동의 실패 | [consent.mjs](../../../apps/web/app/utils/consent.mjs), 37–38·144–151행 | 읽기 실패 null 처리·쿠키 접근 예외 흡수. 해당 실패 UI는 별도 잔여 |
| URL 입력 | [admin-collect.vue](../../../apps/web/app/pages/admin-collect.vue), 66·230행 | 기존 `collect/candidates` API 사용 |
| 출처 설정 | [admin-collect-sources.vue](../../../apps/web/app/pages/admin-collect-sources.vue), 7·21행 | 기존 source API 사용. direct 설정과 소유권 분리 |
| direct 요청 통제 | [SourceRequests.java](../../../apps/collector/src/main/java/com/blariyo/collector/run/SourceRequests.java), 19–54행 | host/path 허용·간격·retry 존재. robots·Crawl-delay·영속 일일 한도 연결 없음, redirect loop `redirects < 5` |
| direct 진입점 | [DirectBatchRunner.java](../../../apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java), 28행; [DirectUrlRunner.java](../../../apps/collector/src/main/java/com/blariyo/collector/run/DirectUrlRunner.java), 49행 | 같은 SourceRequests 사용. legacy robots 함수 존재로 통과 판정하지 않음 |
| 보존·회수 | [MetadataRetention.java](../../../apps/collector/src/main/java/com/blariyo/collector/maintenance/MetadataRetention.java), [요구사항 B08](../../../docs/development-specs/requirements-status.md) | 기존 정리는 legacy collector 자료 중심. direct raw/media/report/queue 보존·회수 구현 미확인 유지 |

색상 기준·계약 정렬·운영 인수 등은 보고서의 정본 링크를 따른다. 정적 소스 차이를 실제 화면 장애나 운영 성능 장애로 확대하지 않는다.

## 3. 공개 HTTP 관측

- 첫 요청 묶음 시작: `2026-09-26T07:39:15.305712+00:00` = 16:39:15 KST.
- 첫 묶음: robots·사이트맵 인덱스·공개 목록. 두 번째 묶음은 같은 점검에서 이어서 실행했으며 별도 정확한 시각은 도구 출력에 남기지 않았다.
- 방법: Python `urllib.request`, 인증 없는 GET, `User-Agent: Blariyo-status-readonly/1.0`, timeout 20초/15초, 응답 읽기 최대 2MB. 공개 응답의 선택 필드만 출력했다.
- 공개 GET만 실행했다. 상세 페이지 JavaScript·조회 수 POST·관리자 요청·로그인·DB/object 쓰기를 실행하지 않았다.

| URL | 상태 | 선택 관측값 |
| --- | ---: | --- |
| [robots.txt](https://blariyo.com/robots.txt) | 200 | `text/plain; charset=utf-8`. `/admin`, `/api/`, `/internal`, `/health/`, `/__gateway_health` 제외와 `Sitemap: https://blariyo.com/sitemap.xml` 존재 |
| [사이트맵 인덱스](https://blariyo.com/sitemap.xml) | 200 | `application/xml; charset=utf-8`, sitemap XML. 아래 2개 하위 XML 연결 |
| [페이지 사이트맵](https://blariyo.com/sitemap-pages.xml) | 200 | XML의 loc 3개, `/admin`·`/internal` 포함 URL 0개 |
| [게시글 사이트맵](https://blariyo.com/sitemap-posts-0.xml) | 200 | XML의 loc 74개, `/admin`·`/internal` 포함 URL 0개 |
| [공개 목록](https://blariyo.com/meme) | 200 | HTML canonical `https://blariyo.com/meme`, `GTM-5BRTQ5T3` 문자열 존재, `ga4Enabled:false` |
| [게시판 API](https://blariyo.com/api/v1/boards) | 200 | `application/json`, `X-Robots-Tag: noindex` |
| [생존 상태](https://blariyo.com/health/live) | 200 | `application/json`, `X-Robots-Tag: noindex` |

관측 한계:

- 전체 응답 원문·응답 해시를 파일로 보존한 검사는 아니다. 위 표는 실제 도구 출력의 선택 필드를 옮긴 기록이다.
- 사이트맵 loc 74개는 공개 XML 수량이다. DB의 현재 게시글 총수·공개 상태 전수 대조, 9/23 게시글과 동일 ID 집합 확인은 수행하지 않았다.
- `/admin`·`/internal` 부재만 검사했으며 모든 비공개 상태의 제외를 DB와 대조한 것은 아니다.
- GTM 문자열 존재는 HTML 삽입 증거다. 실제 script 로드·태그 실행·GA4 수신·동의/철회 network 검사는 아니다. `ga4Enabled:false`만으로 GTM 내부 태그까지 비활성이라고 결론내리지 않는다.
- 현재 배포 SHA/digest, DB ledger/checksum, 역할, batch flag, timer, 백업은 조회하지 않았다.

## 4. 실패·미실행과 과거 증거

- 웹 열기 도구로 robots·사이트맵·공개 목록을 요청했으나 세 URL 모두 `not accessible via this tool`을 반환했다. 이 실패를 사이트 장애로 판정하지 않고 별도 HTTP GET 결과를 기록했다.
- `gh` 실행 파일을 현재 셸에서 찾지 못했다. 원격 CI 조회를 수행하지 않았고, GitHub의 현재 통과 상태를 주장하지 않았다.
- 초기 파일 탐색에 지정한 `infra` 경로는 존재하지 않아 rg 오류가 있었다. 실제 운영 파일 경로는 `deploy` 및 `docs/operations`로 확인했다.
- [9/25 GTM CI 보완](../../2026-09-25/google-tag-manager/CI-FIX.md)의 격리 Linux Chromium 41/41은 당시 기록이다. 이번 기록 작성이나 현재 원격 CI의 새 통과가 아니다.
- [9/23 DB·콘텐츠 반영](../../2026-09-23/release/production-db-promotion.md)의 이미지 308개·수집 항목 108개·백업 복원 등은 당시 기록이다. 오늘의 사이트맵 수량과 합쳐 현재 DB/object 전수 검증으로 보고하지 않는다.
- 미실행: 제품 unit/통합/build/브라우저 재실행, 실제 Access MFA 업무, 수집·Discord·Windows/별도 PC 연동, DB/object readback, 복구 훈련·7일 관찰, 운영 변경.

## 5. 기록 검증

- 검증 대상: 전체 worklog 색인, 2026-09-26 색인, REPORT.md, EVIDENCE.md.
- Python 문서 검사: 로컬 링크 발생 50개, 없는 대상 0개, 명시된 Markdown anchor 오류 0개. 전체 저장소 링크 감사는 아니다.
- 정본 40행의 영역별 I/P/U와 보고서 수량·반올림 비율이 모두 일치했다.
- 변경 범위: `worklog/README.md` 1개 수정, 오늘 색인·보고서·근거 기록 3개 추가. 범위 밖 tracked 변경 없음.
- `git diff --check` 통과. 새 untracked 문서 3개는 `git diff --no-index --check /dev/null <파일>`로 별도 검사했다.
- 신규 파일 검사의 첫 wrapper는 변경 존재를 뜻하는 종료 코드 1을 실패로 잘못 단정했다. 판정을 바로잡아 3개를 재검사했고 whitespace 오류 출력은 모두 없었다.
- 제품·기술·법무 정본을 수정하거나 미정 값·출시 조건을 제거하지 않았다. 과거 실행 기록을 소급 수정하지 않았다.
- 제품 테스트·build·브라우저·외부 조회 재실행 없이 문서 검증을 수행했다. commit·push·배포는 수행하지 않았다.
