# 전체 문서 전수 검토·최신화

- 요청: 모든 문서 전수 검토 후 최신화.
- 상태: 진행. 기존 documentation-refresh의 운영 문서 정리·재검토 2건 보완 이후 범위를 저장소 전체로 확대했다.
- 시작 기준: 2026-09-24, HEAD `82c0ba9`, 로컬 `main...origin/main [ahead 5]`. 기존 Markdown 15개 수정과 9월 24일 worklog 미추적 변경을 보존한다. 원격 재조회는 아니다.
- 최초 목록: Git 추적·비무시 미추적 파일 중 Markdown/HTML/text 등 336개. 수집기 HTML fixture와 의존성 목록도 목록에는 남기되, 현행 안내 문서로 해석하지 않는다.

## 완료 조건

1. 파일별 역할·검토 상태·근거를 기록하고 누락 없이 대조한다.
2. 현행 기획·설계·개발 명세·운영·도구 안내는 실제 소스/설정/실행 기록과 맞춘다. 설계 계약과 미구현 차이는 숨기지 않는다.
3. 작업 이력·검수 기록·외부 사이트 캡처는 당시 증거를 보존한다. 이동으로 깨진 실제 문서 링크만 근거를 확인해 고친다.
4. 제품 미정·법무 차단 조건·미검증을 근거 없이 완료 처리하지 않는다. 최신 외부 가격/제약을 현행 안내로 유지할 때는 공식 근거를 확인한다.
5. 상대 링크·제목 앵커·코드/명령 참조·변경 범위·`git diff --check`를 확인한다. 화면 자료를 변경하면 해당 화면도 검증한다.
6. 날짜가 있는 `worklog/`는 당대 기록으로 보존한다. 기록의 상태·제목·참조와 연결 오류를 확인하되, 각 과거 실행 사실을 현재 사실로 승격하거나 소급 교정하지 않는다. 현행 사실은 참조된 정본/source/후속 증거로 확인한다.
7. 전체 검토 완료는 위 요구별 증거로 판정한다. 구조 검사나 일부 파일 수정만으로 전체 완료라 하지 않는다.

## 작업 묶음

| 묶음 | 범위 | 상태 |
| --- | --- | --- |
| F01 | 전체 목록·역할 분류·링크 검사 | 진행 |
| F02 | 운영·배포·앱/도구 사용법 | 진행 |
| F03 | 제품 기획·출처별 수집 계약 | 진행 |
| F04 | 기술 설계·API/DB·개발 명세 | 진행 |
| F05 | 법무·정책 artifact·화면 자료·검증 안내 | 진행 |
| F06 | AI 지침·전체 색인·과거 기록·참조 보존 | 진행 |
| F07 | 수정 후 전수 재검증·잔여 한계·종료 보고 | 대기 |

## 검토 목록과 실행 경계

- `inventory.json`: 파일별 역할·내용 해시·검토 상태·연결 검사 결과. 내용 검토와 기계 검사를 구분한다.
- `audit_documents.py`: 전체 파일 목록과 상대 링크/앵커 검사 도구. 운영 명령·네트워크 요청을 실행하지 않는다.
- `check-structured-documents.mjs`와 `structured-validation.json`: docs 내부 JSON/YAML 13개의 구문·로컬 `$ref` 검사와 결과. API 동작·명세 내용 일치를 증명하지 않는다.
- 검토 기준은 현재 작업 트리와 확인된 실행 기록이다. 최신 서버/DB 상태를 직접 조회하지 않았으면 마지막 관측 시점을 명시한다.
- source·migration·배포 설정 변경, commit·push·배포·외부 전송은 이 문서 작업에서 수행하지 않는다.

## 발견과 보완 기록

검토 중 발견한 내용은 확인 근거·수정 파일·검증 결과와 함께 아래에 누적한다.

### F01·F02 1차 진행

- 최초 336개에 이 계획 1개를 더한 337개를 목록화했다. 49개 HTML fixture·의존성 입력 1개·원문 대화 기록 1개는 당시 데이터로 보존한다.
- 전체 상대 연결을 검사하고, HTML `id`·Markdown 제목·행 참조와 JavaScript hash 전환을 구분했다. 고정 draft.2 본문 링크와 삭제된 과거 source 참조는 보존 사유를 `reference-decisions.json`에 기록한다. 예외는 파일 해시가 바뀌면 재검토 대상으로 돌아간다.
- 운영/도구 안내의 본문 대조 14개를 마쳤다. 나머지 파일은 `inventory.json`에서 pending으로 유지한다. 구조 검사 완료를 내용 검토 완료로 올리지 않는다.
- 보완: 개발 DB 5439와 과거 전환 검증 55449 분리, 로컬 정책 seed 전 migration 명시, production 모드와 실행 위치 구분, 9월 23일 DB/backup 관측과 남은 원격 batch 인수 구분.
- 보완: Python/legacy Spring/직접 저장 batch 안내 분리, direct 200장 상한·Docker config mount, Windows 명령의 수직 탭 3개 정정. Discord SQL의 존재하지 않는 `discovered_at`·`batch_failure.created_at`을 실제 migration의 run 시각·`occurred_at`으로 정정했다.
- 보완: owner 체크리스트의 `/admin-batch`를 `admin-batch.vue`의 `definePageMeta`가 지정한 `/admin/batch`로 정정했다. 앞선 documentation-refresh TASK-06의 경로 추가 기록은 당시 이력으로 보존하고 이 후속 정정을 적용한다.
- 검증 범위: source·migration·도구 파일 정적 대조 및 `git diff --check`. DB 쿼리/수집/Discord 연결/배포 명령·앱 테스트는 실행하지 않았다.

### F03·F04 2차 진행

- 수집 기획 묶음 25개(출처별 21개·공통 4개)의 본문을 대조하고 현행 direct 계약을 반영했다. Hot 8개/일반 목록 9개/차단 2개/상세 전용 2개를 개발 예제 설정·사이트 adapter와 비교했다.
- 사이트별 문서 앞부분에 현행 분류·chart·목록/상세 코드·실행 증거를 연결하고 9월 3일/21~23일 초기 정책·구현·실행 이력과 구분했다. YouTube 최초 검토는 9월 21일이며 다른 20개 사이트와 날짜가 다르다.
- 일반 목록의 과거 `hot` 명칭, 초기 parser 미구현, 개발 승인 플래그가 현행 운영 승인을 뜻하지 않도록 명시했다. 고급유머의 초기 벤치마킹 전용 결정과 9월 21일 제품 확장도 구분했다. 정책 미정·접근 차단과 과거 run ID는 보존했다.
- 새 출처 템플릿의 GENERAL_LIST 누락과 Python 임시 파일 전용 안내를 direct 저장·이미지/첨부 상한·정제 fixture·readback 기준으로 보완했다.
- `reference-sites.collection-policy.json`은 초기 참고 분류이고 현재 CLI가 읽는 파일이 아님을 명시했다. 이 JSON이나 source 설정을 변경하지 않았다.
- 시스템 설계 색인·아키텍처·코드 구조 3개를 검토했다. 현행 같은 database의 테이블/role 분리와 legacy 전용 DB를 구분하고, 컨텍스트·검수/승격 흐름에 direct 경로를 반영했다. 미완료인 Web 입력·원격 DB 경로·운영 writer 인수는 유지했다.
- 추가로 관측 fixture 안내와 날짜별 검증 보고서 2개를 읽고 당시 증거로 보존했다. 누적 내용 검토는 45개이며 나머지는 pending이다. 기계 검사 수와 내용 검토 수는 구분한다.
- 검증: 신규 링크/앵커의 대상 존재와 `git diff --check`. 실행 증거는 연결한 9월 23일 기록이며 이번에 앱 테스트·외부 수집·DB/object 변경·Discord 연결을 실행하지 않았다.

### F04 보안·수집 설계 대조와 신규 미충족 통제

- 보안·운영 설계와 수집 상세 설계 2개를 추가로 끝까지 검토했다. 누적 본문 검토는 47개다. 수집 기능 명세는 첫머리의 신규 차이만 동기화했으며 전체 본문 검토 완료로 올리지 않았다.
- 보완: legacy 원문 미보관/30일 후보 TTL을 direct에 적용하던 문장, 현재 media 다운로드 미구현 주장, 초기 Discord `queueManual` 경로, 일반 목록의 hot 명령, 날짜 미상 일괄 제외, Core quota 제출 혼용을 정정했다. 초기 검토의 parser 수는 당시 이력으로 보존했다.
- 보완: 현행 CI 이미지의 `linux/amd64`와 multi-arch 설계 목표를 구분하고, rollback은 현재 DB 호환 digest로 한정했다. 날짜별 가격·법률·정책 사실은 새 조회 없이 현재 확인으로 올리지 않았다.
- **F04-H1 / High / 미해결 구현 차이:** direct `DirectBatchRunner`/`DirectUrlRunner` → `SourceRequests`에 robots/Crawl-delay·영속 일일 budget 연결이 없다. `SourcePolicy.robotsAllows`는 legacy `CollectionPipeline`, `RobotsRules`는 legacy `DiscoveryFetcher`에서 호출되며 direct 경로에서 사용하지 않는다. 요청 간격·maxPages/maxItems·개발 승인 플래그는 이 통제의 대체가 아니다.
- **F04-H2 / Medium / 미해결 구현 차이:** `SourceRequests.java:20`의 `fetch` 5회 요청 순회는 성공 응답까지 최대4회 redirect를 허용한다. 설계 상한 3회와 다르다. 설계 한도를 임의 상향하지 않았다.
- 권장/계획: robots 금지·미확인·Crawl-delay, 재시작/날짜 경계의 일일 총량, redirect 3회 경계를 direct 단건·목록·queue에 공통 적용하고 외부 요청 차단을 테스트한다. 기술 설계·수집 기획·출처 정책·요구사항·현재 상태·P1-06·운영 안내에 동기화했다. Core 수동 공개와 별개인 수집 활성화 gate다.
- 정적 근거: `SourceRequests.java`의 fetch/request 전체, 두 direct runner의 SourceRequests 생성·fetch 호출, 전체 Java에서 robots/quota 호출자 검색, `BatchQueueWorker`의 DirectUrlRunner 조합. 소스 수정·차단 사이트 재요청·runtime 테스트는 하지 않았다.

### F04 데이터 모델·구조화 문서 추가 대조

- 목록을 OpenAPI 2개·날짜별 JSON 증거 10개·AI agent YAML 1개까지 확장해 총 350개로 집계했다. 13개 구문과 로컬 `$ref` 523개 검사를 통과했다. 내용 검토는 별도 상태로 유지한다.
- 데이터 모델 본문을 API V001~V008·Collector migration·receipt/본문 검증 소스와 대조했다. legacy source·candidate·image·멱등 영수증·quota·event의 실제 열/제약을 정정하고 direct 12개 테이블의 소유권·상태·보존 경계를 추가했다. 누적 본문 검토는 48개다.
- **F04-M3 / Medium / 미해결 구현 차이:** legacy OpenAPI `CollectionContentBlocks` 및 API `validateContent()`는 1000블록, V006 DB CHECK는 40이다. 41~1000블록은 API 검증과 저장이 불일치한다. 현재 direct 저장과 구분해 P1-01에서 추적하며 legacy 재활성화 전에 후속 migration·경계 테스트가 필요하다.
- 적용된 migration·checksum을 수정하지 않았다. DB 실행·API 제출 테스트 없이 정적 근거로 확인한 차이다.

### F03·F04 API와 후속 회원·익게 설계 대조

- API 설계의 초기 미착수 표현을 현재 증거 참조로 바꾸고, legacy source의 URL_ONLY/MANUAL 제약·현행 direct 검수 5개 endpoint·production readiness 인증·ETag 계산 범위를 소스로 대조해 보완했다. 두 docs OpenAPI는 packages/contracts 사본과 바이트가 일치한다.
- 회원·익게 제품/사전/기술 계약과 기능 명세 4개, 총 7개를 본문 대조했다. 현재 해당 API feature·migration·Web page·전용 OpenAPI 구현은 없으며 후속 설계로 유지한다. 외부 provider 자료의 기존 확인일을 최신 검증으로 바꾸지 않았다.
- 보완: MEMBER=false 가입 중단과 기존 회원 참여의 차이, KEEP 고정 정책과 contentAction 입력 금지, AAD의 명시적 배열 계약을 맞췄다. 운영 활성화·법무 검토 미정은 유지했다.
- 기존 `check-member-design.py` 재실행: 이름 262,144조합·최대19 code point·명시 금칙 목록 검출0, 문자열35·제재6·연령/SQLite 모델21 검증 통과. 이는 오프라인 설계 모델이며 PostgreSQL·JavaScript·provider·회원 runtime 검증이 아니다.
- 누적 본문 검토 56개. 구조화 계약 내용·M0 기능 명세·법무·화면·나머지 안내/이력은 pending을 유지한다.

### F01·F05·F06 안내·AI 절차와 현황 색인

- AI 진입 문서·정본 라우팅·스킬/참조·agent YAML·문서/UI 색인·fixture 기준선 안내 14개를 대조했다. OCI 계정 준비 표현을 현행 Lightsail로 정정하고 수집 OpenAPI 부재 설명을 현재 계약에 맞췄다.
- 전역 착수/감사 스킬은 원본과 해시가 같고 기능 명세 스킬은 미배치임을 로컬 확인했다. 전역 파일은 변경하지 않았다. fixture 기준 commit의 원본 `SiteAdapters.java` SHA-256과 21상세/19목록 기준값 구성을 확인했다.
- 루트 README·현재 상태·요구사항·로드맵·설계 준비·worklog 색인 6개를 추가 대조했다. 목록 수집 구현 제외 주장과 일반 검증기로 오해할 수 있던 과거 `verify:migration` 안내, 수동/수집 이미지 한도와 V003/V008 복원 경계를 정정했다. 신규 구현 차이를 현황·후속 표에도 연결했다.
- 누적 본문 검토 76개. I30/P9/U1 집계와 9월 23일 운영 관측 경계는 유지한다. 링크·정적 대조와 실제 운영 재조회/앱 테스트를 혼동하지 않는다.

### F03·F04 인프라 계획·실행 계약 대조

- 인프라 기획·기술 설계 2개를 추가 검토해 누적 78개다. 과거 OCI 대안, 현행 Lightsail/amd64, legacy 로컬 DB와 direct 공유 DB 역할을 구분하고 원격 PC 접속 미검증·이전 시 direct writer drain 조건을 연결했다.
- 사용하지 않는 Kakao·공개 origin·캐시 환경변수명을 실제 Nuxt/API/설정 생성 도구 입력으로 바꿨다. 공통 환경 안내에 연결해 복제 범위를 줄였다. 준비 단계로 남아 있던 원격 CI/배포 표현, V008 비호환 rollback, 수동20장/현행200장 혼용과 direct 보존 예산 누락을 보완했다.
- 2026-09-24 공식 자료 재확인: [Lightsail bundle](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html), [전송량](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html), [R2](https://developers.cloudflare.com/r2/pricing/), [Cloudflare Free/Zero Trust](https://www.cloudflare.com/plans/). 가격 조건과 무료량을 현행 선택에 한해 갱신했고 OCI/Hetzner/B2 대안 수치는 과거 비교로 남겼다.
- [OCI Budget 공식 설명](https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm)에 따라 예산 알림이 유료 생성/과금을 차단한다는 표현을 정정했다. 계정 청구서·현재 소비량은 조회하지 않았다.
- 검증: 상대 참조 2,626개·제목 앵커 502개·행 참조 6개 검사, 기존 22건은 해시로 고정한 보존/JS 경로 예외이며 미분류 오류0. `git diff --check` 통과. 앱 source·migration·배포 설정 변경 없이 문서와 검토 기록만 갱신했다.

### F02·F03·F04 제품·분석·운영 보호 추가 대조

- 제품 기획6개, 분석 동의 명세1개, 운영/초기 설치 안내7개, 보안·비용 보호 계획1개를 본문 대조했다. 9월 8일/23일 이력3개와 보안 JSON8개의 전체 기록도 읽고 보존했다. 누적 내용 검토104개이며 나머지는 inventory에서 pending을 유지한다.
- 기획의 HOT/GENERAL_LIST·direct 검수·legacy 플래그·원본 수집/미디어·현재 route 계약을 맞췄다. 초기 Express/Spring 단계와 과거 벤치마킹 결정을 현재 구현으로 오해하지 않도록 날짜를 구분했다.
- **F05-M1 / Medium / 미해결 구현 차이:** 분석 동의의 저장값 읽기 실패·쿠키 삭제 실패에 대한 명세상 피드백이 현행 `consent.mjs`에 없다. JSON/schema 오류는 null, 삭제 예외는 catch로 종료한다. 실패 안내·회귀 시험을 GA4 활성화 전에 보완해야 한다. mock Google 시험과 실제 GA4 전송 확인은 분리했다.
- **F05-L1 / Low / 미해결 화면 차이:** 탭 강조색은 기획/정적 검토물의 red `#C74B50`와 현행 앱의 teal `#00A19B`가 다르다. 팔레트 이미지와 CSS를 대조했고 제품 계약이나 앱 색상을 임의 변경하지 않았다. 로드맵 UI 인수 항목에서 최종 일치를 확인한다.
- 초기 애플리케이션/DB 설치 도구는 현재 운영 환경의 일반 갱신기가 아님을 명시했다. 초기 번들 고정값·helper hash 변경 실패·현행 V008/Collector V006과 원격 batch role 인수 미검증을 구분한다. DB 변경 전 서버 timer와 별도 PC writer의 drain이 필요하다.
- 보안 증거: inventory26파일(19JS/5CSS/2JSON), origin-before125요청(실패5), public-before160요청(실패8), gateway-after30요청/실패0, static-retry26요청/실패0을 전수 대조했다. 9개 캐시 대상의 before18요청·after9쌍과 통제4요청, server/deploy inventory 해시도 대조했다. before 실패를 전체 통과로 바꾸지 않았다. 전체 POP·인증·이미지 purge·장기 관찰은 이 증거의 범위 밖이다.
- 2026-09-24 공식 확인: [GA4 page view](https://developers.google.com/analytics/devguides/collection/ga4/views), [Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode), [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [GitHub 환경 보호](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [Docker env_file](https://docs.docker.com/reference/compose-file/services/#env_file), [PostgreSQL 기본 권한](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html), [Cloudflare rate limit](https://developers.cloudflare.com/waf/rate-limiting-rules/), [예산 알림](https://developers.cloudflare.com/billing/manage/budget-alerts/), [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html). 계정/콘솔/서버 설정은 재조회하지 않았다.
- 소스·설정 수정, 앱 시험·실제 Google 전송·DB·배포·수집 명령은 실행하지 않았다. 내용 검토와 연결 검사는 문서 작업의 증거이며 기능 전체 완료 판정이 아니다.

### F04·F05 결정·법무·검증 안내 대조

- Nest 결정·초기 backlog/OpenAPI 안내·M0 결정4개, 법무 Markdown7개·발행/고정 HTML6개, 테스트 안내6개·화면 검토 안내2개를 추가 검토했다. 누적132개, 내용 검토 대기167개, fixture/의존성 데이터50개·원문 대화1개 보존이다.
- 초기 scaffold·미배포·17 Entity/224컬럼/15FK 설명을 당시 기준선으로 구분했다. 현재 Entity20개/FK17개·V008·설정2flags·CSP origin 입력과 실제 계약 생성기를 대조했다. 과거 임시 컨테이너와 `verify:migration`을 일반 검증 선행 조건으로 강제하지 않도록 고쳤다.
- **F04-M4 / Medium / 정합성 잔여:** 후속 batch result/review·discovery policy 조회는 일반 Entity/QueryBuilder 원칙과 달리 직접 매개변수 SQL을 쓴다. 기존 전환 예외가 이를 승인한 것으로 쓰지 않았다. batch 검수 목록의 항목별 조회도 별도 성능 검증 대상이다. 실행 장애는 재현하지 않았으며 Nest 결정과 P1-01에 유지보수 후속을 남겼다.
- 법무 통합 초안과 9월 20일 v0.1 발행 전문/후속 기능 시행일을 분리했다. direct 원문·이미지·첨부·SNS·실행 기록의 실제 처리를 개인정보 초안에 반영하고 보존/파기 `(미정)`·QD-04를 유지했다. legacy30일·후속 회원 보안 로그90일/백업8주를 현행 M0 전체에 적용하지 않는다. 공개 HTML6개는 변경하지 않았다.
- 2026-09-24 재확인: [개인정보 보호법 제21조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651), [제30조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1029331583), [안전성 확보조치 제8조](https://www.law.go.kr/LSW/admRulSideInfoP.do?admRulSeq=2100000281400&chrClsCd=010201&dashNo=&docCls=jo&joBrNo=00&joNo=0008&urlMode=admRulScJoRltInfoR), [저작권법 제103조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029423165), [시행령 제40~44조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63336), [Cloudflare 보존](https://developers.cloudflare.com/cloudflare-one/insights/logs/). 모든 법무 근거/실제 계정의 재검증이나 출시 승인으로 확대하지 않았다.
- 테스트 안내는 초기46개에 DIR-01~06을 추가해52개다. 직접 저장 권한·원문/미디어 보존·robots/총량·queue 복구·검수/초안·보존 정리를 나눴다. 기존 테스트 존재/당시 결과와 새 ID별 전체 입력 미실행을 구분한다. 메일 복사 UX·GA4 실패 피드백도 수용 조건에 맞췄다.
- 관리자 PNG3개를 시각 확인했다. 9월 20일 UI 실행 기록의 과거 DB포트·복사 버튼·미배포 문구는 당시 기록임을 명시하고 현행 안내를 연결했다. 정적 프로토타입의 혼합 단계·탭색·동의 만료 차이는 한계로 남겼다. 화면 artifact·앱 source 변경이나 새 브라우저 실행은 없었다.
- 검증: 상대 참조2687개·제목 앵커508개·행 참조6개, 미분류 오류0·보존 예외22건. `git diff --check` 통과. 나머지 M0 기능 명세·구조화 계약 내용·과거 기록은 진행 중이다.

### F04·F05 공개 기능·정책 계약 추가 대조

- 공개 탐색과 정책·권리 기능 명세를 전문 대조했다. 초기 source/OpenAPI/운영값 부재 설명을 현행 구현·v0.1 발행 기록과 이번에 재실행하지 않은 검증으로 구분했다.
- 정책 발행 CLI 성공과 outbox 캐시 제거 완료를 분리하고 실제 서비스·환경변수·BFF ETag 계산 및 mailto 대체 안내 계약을 정정했다. 발행 artifact·정책 HTML과 실제 배포 값은 변경하지 않았다.
- **F05-L2 / Low:** 정책 이력 선택 후 본문 상단 이동이 `PolicyViewer.vue`에 명시 구현돼 있지 않다.
- **F05-M2 / Medium:** 공개 상세 SSR은 이미지 URL만 설정하며 명세가 요구하는 OG 이미지 alt/width/height와 Twitter 이미지 alt가 없다.
- **F05-L3 / Low:** 목록 page 변경 후 heading 초점 이동, 하단 목록 영역 내 재시도, 브라우저 공유 성공/취소 피드백이 명세와 완전히 일치하지 않는다. 소스 차이를 명세와 로드맵에 남겼으며 실제 브라우저 장애 재현 결과로 쓰지 않는다.

### F04 관리자·수집 명세와 구조화 계약

- 관리자1142행·수집1177행(대조 시작 시점)의 전문과 관련 image/post/source pipeline을 대조했다. 구현 서비스명, 운영 설정 존재, private staging prefix, 초안 승격 후 별도 공개 단계, legacy 멱등 키를 정정했다. Core의 전체 Buffer 읽기를 무버퍼 streaming으로 설명하지 않는다.
- **F04-M5 / Medium:** 사이트 parser의 `attachmentCandidates`와 legacy `CollectionPipeline.result`/OpenAPI 제출 DTO가 불일치한다. direct와 분리해 P1-01에 기록했다.
- **F04-M6 / Medium:** legacy preview는 JPEG/PNG/WebP/GIF를 반환하지만 OpenAPI는 PNG만 선언한다. **F04-L1 / Low:** 기계 명세의 로컬 cookie 인증·readiness 설명은 production Access 동작을 충분히 표현하지 않는다. 후속 계약/생성 타입 변경이 필요한 항목으로 OpenAPI 안내와 로드맵에 남겼다.
- OpenAPI2개의 전체 경로·schema·인증·응답을 기능 계약과 대조했다. docs/packages 사본 일치, baseline/evolution 대상27개 해시 일치를 확인했다. 적용 migration·생성 계약과 보존 JSON은 변경하지 않았다.

### F06 날짜 기록의 보존과 재검증 경계

- 기존 worklog 135개는 당시 증거·작업 지시·세션 기록이다. 저장소 지침의 기록 경계에 따라 status/제목/로컬 링크는 기계 목록에서 확인하고, 현재 사실을 과거 서술에 소급 반영하지 않는다. 최초 목록의 전체 불변 데이터 50개와 원문 대화 1개도 본문 안내로 승격하지 않는다.
- inventory는 `historical-record`를 `preserved-history`로 분류하고 SHA-256과 로컬 참조를 추적한다. 이는 135개 문서의 과거 모든 사실을 현재 source로 재현 검증했다는 뜻이 아니다. 현행 문서에서 참조한 최신 결과는 관련 파일을 직접 대조했다.

### F07 최종 전수 재검증

- 최종 inventory 350개: 프로젝트 현행 문서116과 활성 검토 ledger1, 날짜 기록·검토물31, 구조화/기계자료12, HTML 참조·보존물14, agent 설정1, 보존 데이터50, 과거 worklog134, 원문 transcript1. 역할별 수량은 아래 inventory를 정본으로 한다.
- 현행 문서는 전부 `reviewed`; 날짜 검토·참조 산출물은 전문 대조했다. historical-record 135개는 당시 기록으로 `preserved-history` 및 SHA 추적으로 분리했다. fixture/의존성 입력50개와 원문 transcript1개도 데이터로 보존한다. 보존 상태는 전문의 모든 과거 주장을 현재 사실로 재검증했다는 뜻이 아니다.
- 최종 상대 참조 2,703개·제목/HTML 앵커 510개·행 참조 6개. 22개 진단은 소스/대상 해시와 근거에 고정된 보존 artifact 3, JS route 17, 과거 source 참조1, 사용자 status 단어로 확인됐다. 미분류·미해결 참조0.
- docs JSON/YAML 13개 구문 검사·로컬 `$ref` 523개 통과, 오류0. OpenAPI 두 쌍은 바이트 동일, migration baseline/evolution 대상27개 SHA 일치. 앱 test/build/runtime은 이 문서 감사에서 실행하지 않았다.
- `git diff --check` 통과. 현재 작업 트리 변경은 Markdown·검수 도구/결과만이며 source·migration·설정은 변경하지 않았다. 기존 `main...origin/main [ahead 5]`와 시작 시 존재한 수정·미추적 파일을 보존했다. stage·commit·push·배포 없음.
- 남은 구현·운영 수용 조건은 §13/로드맵과 F04/F05 발견사항으로 연결했다. 그러므로 전체 문서 검토는 완료했지만 제품 구현, 외부 운영 인수와 미해결 계약 개선까지 완료 판정한 것은 아니다.
