# M0 로드맵 — 남은 작업과 완료 조건

> 2026-09-25 전달 상태: 현재 checkout은 검토용 `feature/HARN-09-ci-diagnostics`다. 원본 stash와 복구 branch `5957492`, 기존 PR #1/#2를 보존하고 새 Draft PR #3~#8을 생성했다. 실제 분리 범위·검증·선행 관계는 [CI 복구·전달 기록](../worklog/2026-09-25/git-governance/CI-RECOVERY.md)을 따른다. develop 통합·원격 보호·배포는 미완료다.

- 최신 상태·재개 입력·로컬 자원: [현재 진행 상황](status.md).
- 실행 가능한 task 단위와 의존성: [구현 task 목록](implementation-tasks/README.md).

- 기준: [9/25 앱 배포·운영 상태](operations/current-status.md), [요구사항 40개](development-specs/requirements-status.md). DB·콘텐츠 반영은 9/23 기록과 구분한다. 단계·요구사항 ID와 미완료 조건을 유지하고 과거 실행 결과는 worklog에 보존한다.
- 목표: **Core 관리자와 운영 흐름을 먼저 마감해 콘텐츠 운영을 시작하고, 수집 기능은 운영과 병행해 검증 후 활성화한다.**
- 전제: 기존 Core/API·DB 모델을 재사용한다. 신규 관리자 프레임워크, 통계 대시보드, 회원·광고, 자동 발행을 추가하지 않는다.
- 순서: P0-01~04의 개발자 로컬 작업, 9/23 DB·콘텐츠 반영과 9/25 API/Web·GTM 배포 이후 **운영자 인수→운영 예약/알림·복귀 확인**이 다음 단계다. P1은 입력 계약·시험 자원이 준비된 범위부터 병행하고 P2는 실제 운영 기간으로 관찰한다.
- 과거 일정: P0 4–6 작업일, P1 추가 3–5 작업일은 최초 계획 당시 추정이다. 현재 잔여 공수나 납기로 재사용하지 않는다.

## 1. 다음 시작점

검색엔진 설정의 [운영 반영 결과](status.md#검색엔진-설정--2026-09-25-운영-반영)를 따른다.
9/25 배포 후 robots의 Sitemap 안내·사이트맵 XML 200·공개 게시글 74개를 확인했다.
남은 검사는 robots 전체 병합 규칙·비공개 URL 제외·Web 및 Access/Nginx 계층별 `noindex`, 실제 검색엔진 색인·노출이다.
GTM 컨테이너 로딩은 완료됐으며 태그·동의 조건·공개 정책 대조·GA4 실제 수신은 별도 검증한다.

현재 구현·검증은 [진행 상태](status.md)를 확인한다. `8af7244`의 CI·API/Web 배포·GTM 로딩과 API V008·Collector V006 유지, 새 백업 복원을 [9/25 실행 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)에서 확인했다. 다음 실행은 운영자 MFA 인수, 예약/알림·복귀 확인이다. 수집은 QD-03/04/05/06 입력이 준비된 단계부터 병행하고 다음 배포는 새 후보별로 검증한다.

- 화면: 게시글 목록/검색, 기존 편집기, 상태별 저장·발행·예약·숨김, 이미지 preview, 권한·빈 결과·오류 상태.
- desktop: 공통 관리 메뉴 + 목록/편집 2영역. mobile: 목록→편집 전환과 목록 복귀, 작은 화면에서도 저장 상태 확인.
- 표시: 상태는 한국어 label, 날짜는 KST, 기술용 `lockVersion`은 평상시 주 정보에서 제외한다. 버전 검사는 서버·클라이언트에서 유지한다.
- 편집: 현재 TEXT/IMAGE block과 위/아래 이동을 유지한다. drag-and-drop, WYSIWYG 교체, 일괄 발행은 첫 마감에 추가하지 않는다.
- 디자인: 기존 색상·글꼴·버튼 기준을 재사용하고 간격·구획·버튼 우선순위만 통일한다. 장식보다 10~20건 반복 작업의 혼동과 오조작을 줄인다.
- 산출물: `docs/planning/03-screen-design.md`와 관리자 개발 명세 정렬, 관리자 화면 검토물 1개와 상태별 체크리스트. 이번 감사 폴더는 구현 정본으로 사용하지 않는다.

## 2. P0 — Core 콘텐츠 운영 개시

| 작업  | 범위·산출물                                                                                         | 완료 조건                                                                                                           | 선행·담당                                                   | 최초 계획 추정    |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------- |
| P0-01 | 최소 관리자 화면 설계; Core 요구·법무 입력 상태·현행 배포 기록의 문서 충돌 정리                     | C09/C16 상태별 화면과 필수 동작 확정, 기능/운영 검증 구분; 이미 입력된 법무 실값 재요청 없음                        | 개발자 정리, 운영자 사용 흐름 확인                          | 0.5일             |
| P0-02 | 관리 메뉴·검색 목록·한국어 상태·날짜·loading/empty/error/retry                                      | 상태/제목/게시판 검색, 게시판·수정일 표시, 빈 결과·오류 후 복구; 숨긴 수집 기능 메뉴 미노출                         | P0-01 / 개발자                                              | 1–1.5일           |
| P0-03 | 편집·이미지·저장 상태·상태별 액션 UI 마감                                                           | 미저장 이탈 경고, 실패 파일 안내, 순서/alt/출처 편집, 예약·숨김·제거 확인, 중복 클릭 방지                           | P0-02 / 개발자                                              | 0.5–1일           |
| P0-04 | 격리 로컬 Core 회귀 완료; 운영자 반복 업무 인수 잔여                                                | 운영자가 10~20건 작성/편집, 즉시·예약·취소·숨김·재공개 완주; 시간·혼동·재작업·내용 유실·중복 발행 기록              | [인수 절차](testing/operator-acceptance.md) / 운영자+개발자 | 최초 계획 1–1.5일 |
| P0-05 | 9/25 `8af7244` CI·API/Web·GTM 운영 반영, 새 백업 복원·V008/Collector V006 유지 확인; 운영 인수 잔여 | 실제 Access MFA·업로드·발행·예약·숨김·알림, 다음 배포의 ledger/timer·최근 18시간 이내 백업/복원·호환 복귀 경로 확인 | 운영자 인수·운영 접근 / 운영 담당+개발자                    | 최초 계획 0.5–1일 |

### P0-04 검증 묶음

- 코드·화면: 9/23 API/Web compile·typecheck·lint·unit·통합·migration, 320/390/768/1280px와 오류·충돌 회귀는 [개발자 로컬 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md)에 기록했다. 후속 코드 변경 때는 영향 범위만 재검증하고 과거 성공을 새 SHA에 승계하지 않는다.
- 업무: 운영자가 격리 인수 환경에서 10~20건을 처리하고 소요 시간·클릭 반복·복구 실패를 기록한다. 시간 기준은 첫 측정 후 정하며 측정 전 생산성을 보장하지 않는다.
- 분리: 합성 정책·테스트 인증의 통과와 실제 설정/Access MFA 인수를 각각 기록한다. 운영 게시글을 테스트 때문에 초기화하지 않는다.

### Core 운영 개시 조건

- [ ] 운영자 실제 로그인·허용/거부가 확인되고 수동 작성→업로드→발행→숨김을 끝까지 수행한다.
- [ ] 9/23 목록·상세 74건·이미지 308개 전수 대조 뒤 변경 여부를 재조회하고, 현재 버전의 404·공유·정책 화면 및 private/collect 비노출을 확인한다.
- [ ] 예약 글 1건과 취소 1건, timer·outbox 실패 후 복구를 확인한다. 공개 처리 중복이 없다.
- [ ] 실제 장애 알림을 운영자가 수신하고, 다음 작업 시점의 최근 **18시간 이내** 백업·복원 증거와 V008 호환 이미지 복귀 경로를 확인한다. 9/23 전후 백업 복원은 당시 완료다.
- [ ] GA4/Kakao와 URL·Discord 접수/자동 수집은 비활성으로 유지하고 비활성 메뉴/식별값이 노출되지 않는다. batch 검수 flag는 9/23 활성 관측이며 실제 운영자 조작·QD-04 법무 gate는 별도다.
- [ ] 운영에서 쓸 콘텐츠·연락처·권리 요청 처리 담당을 확인한다. 수집 성공은 게시 권리 판단을 대신하지 않는다.
- [ ] 변경 파일의 기능별 검토와 최종 테스트를 마치고 승인된 release만 배포한다. commit/push/배포/공개 요청은 각각의 권한 범위에서 수행한다.

운영 서버가 이미 존재하므로 새 인프라 구축을 P0 선행으로 넣지 않는다. 위 조건 통과는 **M0 Core 콘텐츠 운영 개시**이며 수집 보조·자동 수집 또는 M0 전체 완료는 아니다.

2026-09-24 추가 대조: 공개 게시판 탭의 퍼블리싱 적색과 앱 청록 차이는
[색상표](planning/07-color-palette.md)에서 추적한다. UI 수용 시 적용색과 화면 증거를 맞춘다.
GA4 활성화 전에는 [분석 동의 명세](development-specs/m0-core/analytics-consent/analytics-consent.dev.md)의
읽기·cookie 삭제 실패 안내 차이와 실제 Google 속성/자동 측정/network를 확인한다.
GA4 OFF 상태의 Core 공개와 별개이며, 로컬 대체 tag 테스트를 실제 Google 검증으로 승계하지 않는다.

분석 확장의 첫 구현 계약은 [analytics-v1 명세 §13](development-specs/m0-core/analytics-consent/analytics-consent.dev.md#analytics-v1)로
확정했다. Core 공개 키·OpenAPI/타입 → 동의 v3·단일 adapter·9개 이벤트 → 격리 검증 → 실제 고지·GTM/GA4/BQ
설정·일별 수신 → 핵심 집계 대조 순으로 진행한다. 직접 GA4가 유일한 전송 담당이며 같은 목적지의 GTM 태그는
중지·검증해야 한다. 이는 별도 확장 개발 순서이며 현재 P0 완료·운영 활성화를 뜻하지 않는다.

정책 viewer는 이력 선택 뒤 본문 상단 이동 계약에 대한 명시 처리가 없다(`PolicyViewer.vue`). 긴 본문에서 버전 전환·스크롤/포커스 회귀를 보완한다. [정책·권리 명세](development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md)의 잔여 화면 조건이며 실제 브라우저 장애를 이번 문서 검토에서 재현한 것은 아니다.

공개 화면 잔여: 상세 SSR의 OG/Twitter 이미지 alt·크기 메타정보와 목록 page 변경 뒤 heading 초점 처리가 없다. 하단 목록 오류의 영역 내 재시도·브라우저 공유 성공/취소 안내도 명세대로 인수되지 않았다. [공개 탐색 명세 §13](development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md#13-2026-09-24-소스-대조와-남은-수용-조건)의 소스 차이를 P0 화면 마감/인수에서 추적한다.

## 3. P1 — 수집 보조·자동 수집 마감

최초 계획의 추가 3–5 작업일은 현재 잔여 공수가 아니다. QD-03/04 입력 전달·보존 migration, 실제 실행 PC/시험 자원과 차단 4개 출처의 허용 경로를 확인한 뒤 재산정한다.

| 작업  | 구체 작업                                                                                                     | 완료 조건                                                                                                                                          | 선행·담당                                         |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| P1-01 | 서비스 기획/보안/수집 spec의 legacy/direct 분리; 관리자 URL 입력 소유권·source 설정 정본 확정                 | API가 collect 큐를 무제한 수정하거나 원문을 fetch하지 않는 입력 계약, legacy 활성화 범위, 설정 버전 규칙을 문서·contract로 일치                    | 결정 QD-02/03 / 개발자+운영자                     |
| P1-02 | 정식 메뉴→batch 결과→검수→선택 초안 편집 이동의 로컬 구현·격리 검증 완료, 운영 검수 flag ON                   | 실제 MFA 인증 브라우저에서 승인·반려·중복·실패·충돌·초안 이동 인수; QD-04 gate 유지                                                                | 운영자 MFA·원격 object / 운영자+개발자            |
| P1-03 | 실제 다른 PC batch→공유 비운영 DB/S3/R2→API 검수·승격 readback                                                | DB run/item/media·object hash/size 일치, 역할 간 쓰기 거부, dry-run 무쓰기, worker 재시작, 미승인 공개0                                            | 비운영 자원·제한 계정 / 개발자+운영 담당          |
| P1-04 | Discord 실제 Gateway·slash 등록·확인·큐·완료/실패 조회                                                        | 취소·만료·권한 없음·중복 interaction 포함, 외부 fetch는 확인 뒤만 발생, 끝까지 실제 증거 기록                                                      | 테스트 guild/channel/역할·실행 PC / 운영자+개발자 |
| P1-05 | direct DB/object 보존·실패 orphan 회수                                                                        | 대상 manifest dry-run→제한 대상 삭제→DB/object readback; 진행 중/검수 중/승격 참조 보호·재실행 멱등·부분 실패 복구                                 | QD-04 계약과 migration 검토 / 개발자              |
| P1-06 | direct robots/Crawl-delay·일일 budget·redirect 상한 보완; 17출처 누락 표본·since/skip, 차단4개 재개 조건 추적 | 단건·목록·queue 모두 금지/미확인 robots 요청 차단, 재시작·날짜 경계 일일 총량, redirect 3회 상한 검사; 본문·미디어 표본과 live/fixture·실패를 분리 | source별 허용 공개 접근·공통 통제 보완 / 개발자   |
| P1-07 | collector CI job·macOS/Linux Docker arm64 로컬 재현과 `5c581c2` 원격 CI 완료                                  | 다음 변경 SHA의 원격 CI 재검증, Windows PowerShell·별도 Linux/실제 PC 실행 결과 구분                                                               | P1-03, 시험 장비 / 개발자                         |

2026-09-23 P1-01 후속: D01~D03의 현행 direct/legacy 문서 충돌을 보완했다.
[문서 정합성 결과](../worklog/2026-09-23/collection-contract-alignment/RESULTS.md)를 따른다.
Web URL 전달·source 변경 권한과 보존/고지는 QD-03/04로 남아 있어 P1-01 전체 완료는 아니다.

2026-09-24 P1-01 추가 차이: legacy 원문 API는 최대 1000블록을 허용하지만 V006 DB CHECK는 40이다.
legacy 재활성화 전에 새 migration과 40/41/1000/1001 경계 검증으로 저장 계약을 맞춘다.
[DB 근거](system-design/02-data-model.md#원문-수집-후보-확장-2026-09-20). direct batch 경로의 상한과 별개다.

P1-01 legacy 추가 차이: 사이트 parser의 `attachmentCandidates`를 `CollectionPipeline.result`가 그대로 제출하나 legacy result OpenAPI는 이를 허용하지 않는다. [수집 명세](development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md)의 DTO 변환·첨부 보존 계약을 재활성화 전에 보완한다.

기계 명세 정렬 잔여: [OpenAPI 대조 결과](development-specs/m0-core/openapi-draft.md#2026-09-24-구조화-계약-대조의-잔여)의 production 인증/readiness 설명과 legacy preview MIME 표기를 소스·생성 계약과 함께 정렬한다.

P1-01 유지보수 잔여: 후속 batch result/review와 discovery policy 조회의 직접 SQL이 기존 일반 ORM 처리 계약의 예외 목록에 포함돼 있지 않다. [Nest 결정 문서](system-design/nest-implementation-decisions.md#raw-sql의-제한된-예외-목록)의 정합성을 맞추고, 검수 목록의 항목별 재조회는 일괄 조회·쿼리 수 회귀 검증 대상으로 관리한다. 정적 차이이며 운영 장애나 성능 한계가 재현됐다는 뜻은 아니다.

2026-09-23 P1-02 후속: direct 관리 메뉴·필터·검수·선택 초안 이동과 오류 복구의 격리 로컬 구현/검증을 완료했다.
[검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md)의 API 15건·브라우저 27건을 따른다.
P1-01의 URL 입력/source 설정 계약과 실제 운영자·Access·원격 환경 인수는 별도로 남아 있다.

2026-09-23 P1-07 후속: Collector job 구성과 macOS·Linux Docker 검사 재현을 완료했고, `5c581c2` 원격 collector job도 성공했다([앱 배포](../worklog/2026-09-23/release/production-deployment-5c581c2.md)). Windows·별도 PC·실제 운영 Collector 기동은 남아 있다.

2026-09-24 문서 전수 대조에서 P1-06 선행 구현 차이를 확인했다. direct `SourceRequests` 경로에
robots 판정·Crawl-delay·영속 일일 budget 연결이 없고, redirect는 설계 3회와 달리 성공 시 최대4회까지 가능하다.
legacy의 `DiscoveryFetcher`/Core quota를 direct 통과 근거로 사용할 수 없다. 운영 활성화 전 공통 실행 통제와
실패 시 네트워크 무요청·재시작/날짜 경계 테스트가 필요하다. [기술 근거](system-design/07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조).

### 관리자 URL 입력의 미정 경계

- 현재 Web URL 입력은 legacy 후보 API이고 direct Discord/CLI queue와 연결됐다고 볼 수 없다. API가 새 batch 큐에 직접 쓰는 방식으로 임의 해결하지 않는다.
- 추천: 먼저 direct 검수·조회 화면을 통합하고, URL 입력은 batch가 소비할 **별도 입력 요청 전달 계약**을 설계한다. batch만 자신의 queue·item 상태를 확정하고 API는 fetch하지 않는다.
- 검토안: API 소유 입력 요청을 batch가 묶음 조회/확인하는 방식 또는 인증된 batch 입력 endpoint 방식. 네트워크 노출·DB role·확인/멱등·장애 시 보존 비용을 비교한 후 결정한다.
- 첫 Core 운영에는 수집 입력을 끌 수 있다. 단, 관리자 URL 입력이 미완료인 상태를 수집 보조 전체 완료로 표시하지 않는다.

### direct 보존/삭제의 미정 경계

- 기존 30일 후보/legacy spool 정책이 raw/media/report/confirmation/queue에 그대로 적용된다고 추정하지 않는다.
- 새 객체별 보존 기간·승격 후 원본 유지 여부·실패/orphan 유예·감사 이력 보존·예외 보류를 확정한다. 운영 비용·보존 계약과 맞추되 실제 기간은 결정 전 `(미정)`이다.
- 완료 snapshot 불변 trigger와 삭제 권한을 함께 설계한다. 무제한 UPDATE/DELETE 권한을 batch/API에 추가하지 않는다.
- 삭제는 batch 소유 작업으로 만들고 운영 콘텐츠 사본은 API 소유로 유지한다. 자동 수집 상시 활성화 전에 dry-run과 보호 대상 음성 시험이 필요하다.

## 4. P2 — 운영하며 개선

| 작업                   | 시작 시점·선행 입력                                        | 확인할 수치·종료 조건                                                                                                   | 담당             |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
| P2-01 운영 관찰        | Core 운영 인수 뒤 매일; 수집 활성화 시 수집 관찰 별도 시작 | 실제 7일의 예약 실패·알림·백업·용량·오류·권리 요청 대응 기록. fixture 시간 전진으로 대체하지 않음                       | 운영 담당        |
| P2-02 관리자 개선      | 운영자 첫 10~20건 측정 후                                  | 한 묶음 처리 시간, 실패/재작업 수, 검색·편집 왕복 수를 기준으로 다음 기능 1개씩 선정                                    | 운영자+개발자    |
| P2-03 수집 품질        | 허용 source별 활성화 후                                    | source별 발견/성공/중복/차단/빈 본문/미디어 실패 수, parser 변경 전후 회귀. 출처 비율만으로 내용 완전성을 평가하지 않음 | 운영 담당+개발자 |
| P2-04 복구·배포 자동화 | 초기 운영 안정화와 보존 계약 확정 후                       | 새 VM 복구·media 복구 훈련, 실제 보관기간 삭제 관찰, 필요 시 수동 CD 자동화. CI image 게시를 배포로 표시하지 않음       | 운영 담당+개발자 |

**첫 운영에서 미뤄도 되는 것:** 관리 통계 대시보드, drag-and-drop, 일괄 발행, 고급 필터, GA4/Kakao 활성화, 광고·회원, 무중단 배포, 4개 차단 출처의 우회 없는 접근 조건 대기.

**미루면 안 되는 것:** 관리자 접근 통제, 원문/이미지 유실, 잘못된 공개, 숨김 실패, 데이터 역할 침범, 백업 없는 배포, 오류를 성공으로 표시하는 보고, 수집 활성화 전 robots/일일 요청 통제와 상시 수집의 보존·회수 부재.

## 5. 추가로 확정할 항목

| 결정 ID | 결정 사항                               | 권고·현재 상태                                                                                                                                     | 결정 시점·책임                                                         |
| ------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| QD-01   | 첫 운영 범위                            | 9/23 Core 공개와 batch 검수 flag ON 관측. URL·Discord 접수와 자동 수집은 비활성, 수집 목표는 별도 추적                                             | 운영 담당: 현재 flag 재조회·실제 관리자 인수                           |
| QD-02   | 관리자 UI 최소안·정식 수집 메뉴         | Core 최소안·저장 복구·실행 연결과 direct 메뉴 통합 로컬 완료. 비활성 수집 메뉴 미노출, 운영자 수동 인수 잔여                                       | Core 운영자 사용성 인수 및 P1-01 계약 확인                             |
| QD-03   | Web URL 입력 전달·source 변경 권한      | API 수집/queue 무제한 쓰기 금지 유지. batch가 입력 소비·queue 확정, source UI는 처음에는 읽기 전용 권고                                            | P1-01, 기술 계약 확정 필요                                             |
| QD-04   | direct 원본·첨부·report·queue 보존·고지 | 구체 기간·승격 후 원본·실패 orphan 유예 `(미정)`; 기존 legacy 30일을 자동 적용하지 않음. 9/23 검수 ON·데이터 이전으로 법무 gate가 충족된 것은 아님 | P1-05/수집 활성화 전, 운영자 보존 요구+법무 고지+개발자 비용/참조 분석 |
| QD-05   | 실제 수집 실행 PC·OS·상시 실행 방식     | macOS 실제 사용 장비부터 통과; Windows/Linux 요구는 그대로 후속 검증. 재시작·업데이트 담당 필요                                                    | P1-03/07 전, 운영 담당                                                 |
| QD-06   | 비운영 S3/R2·DB·Discord 테스트 대상     | 전용 제한 역할·bucket/prefix·guild/channel 준비; secret 원문은 문서/채팅에 기록하지 않음                                                           | P1-03/04 전, 운영 담당                                                 |
| QD-07   | source별 운영 활성화·21개 목표 처리     | 검증·공개 접근·운영 정책 확인한 출처만 활성화. 4개는 blocked 유지, 제외 완료로 바꾸려면 별도 범위 결정                                             | P1-06/활성화 전, 운영자                                                |
| QD-08   | 장애 알림 수신자·운영 일정·release 인수 | 기본 발행 07:30/17:30 KST 유지, 담당자와 실제 알림 수신·복귀 담당 확인                                                                             | 운영 인수 전, 운영자                                                   |

법무 연락처·정책 v0.1은 기존 주입 기록을 먼저 확인한다. 사용자에게 이미 입력한 값을 다시 요구하거나, 후속 기능의 미정/법무 조건을 근거 없이 삭제하지 않는다.

## 6. 실행 시 사용할 검증 명령

아래는 후속 코드 변경이 있을 때 필요한 검사를 고르기 위한 명령이다. 2026-09-23 당시 수행 범위·실패 후 재검증은 [Core 결과](../worklog/2026-09-23/admin-core/RESULTS.md)와 [실행기 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md)에 있다. 변경 없는 성공 검사의 재실행 요구가 아니다. Collector 전체·원격 실연동 명령까지 실행한 것으로 해석하지 않는다. 독립 테스트 DB·Playwright·JDK/Node 설정은 [현재 README](../README.md), [migration 실행서](../worklog/2026-09-09/nest-transition/REPORT.md), [로컬 실행서](../scripts/local/README.md)를 먼저 따른다. 사용자 개발 DB를 테스트용으로 재사용하지 않는다.

```sh
# 현재 코드의 build/타입/단위/격리 통합/브라우저
npm run build
npm run typecheck:web
npm run typecheck:scripts
npm run lint:scripts
npm run typecheck:tests
npm run lint:tests
npm test
npm run test:integration
npm run test:browser

# collector 변경 및 역할 경계: 전용 테스트 인프라에서 실행
node scripts/test-collector-readback.mjs
npm run test:database-roles

# 산출물 검사
git diff --check
git status --short --branch
```

- API/Web package의 lint와 해당 변경 단위 테스트도 실행한다. 위 명령은 운영 R2·Discord 검증을 대신하지 않는다.
- CI 검증 통과 후에도 배포는 별도 실행이다. 원격 쓰기/공개 smoke는 승인된 테스트 대상·운영 콘텐츠 범위에서 수행한다.
- 기능별 변경 단위 권고: 관리자 UI / direct 입력·검수 / DB·보존·저장 / 실행·CI / 문서·증거. 기존 미커밋 파일을 범위 확인 없이 한 커밋으로 묶지 않는다.

## 7. 종료 보고 형식

- **Core:** 관리자 반복 업무·실제 인증·예약/숨김·공개 읽기·백업/알림·배포 식별자별 결과.
- **수집 보조:** Web URL / Discord Gateway / queue / API 검수 / 원격 object별 결과.
- **자동 수집:** source별 implemented/verified/blocked/unverified, 성공·실패 수, DB/object readback, 보존 작업·지원 OS 결과.
- **전체:** 운영 시작과 M0 전체 완료를 구분하고 잔여 요구사항 ID를 남긴다. 4개 차단 또는 실연동 공백을 감춘 완료 선언은 하지 않는다.

## 8. 단계별 실행 상세

### A. 문서와 CI 실패 기준선 정리

9월 23일 CI 실패 원인과 로컬 대응은 [CI 실패 보완 기록](../worklog/2026-09-23/admin-core/FIX-RESULTS.md)에 있다. 당시 실패를 현재 장애로 다시 표시하지 않는다.

### A-1. GitHub CI 오류 수정과 재검증 — 정식 선행 작업

Java fixture·migration 회귀를 보완했고 SHA `5c581c2`의 원격 verify·collector·API/Web images가 [CI·앱 배포 기록](../worklog/2026-09-23/release/production-deployment-5c581c2.md)에서 성공했다. 이후 SHA에는 해당 결과를 승계하지 않는다.

### B. P0-03 저장 결과 복구 보완

[Core 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md)의 응답 유실→401/403→인증 회복·동일 요청 재시도 격리 검증은 완료했다. 운영자 직접 인수는 E에 남아 있다.

### C. P0-04 로컬 작업 실행 연결

[Core 실행기 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md#실제-로컬-실행기와-미디어예약)에서 격리 실행기의 예약·outbox 주기 실행과 재시작·실패 복구를 확인했다. 기본 개발 DB의 worker OFF 경계는 [로컬 실행서](../scripts/local/README.md)를 따른다.

### D. 실제 구성의 로컬 통합 재검증

[Core 실행기 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md#실제-로컬-실행기와-미디어예약)에서 실제 launcher timer로 처리한 반복 업무 12건과 예약/취소/실패 복구 4건, API/DB/미디어 readback을 확인했다. 이는 실제 운영자 사용성이나 운영 MFA 조작을 대신하지 않는다.

### E. 실제 운영자 수동 인수

상태: **운영자 직접 인수 미실행**. [12건 수동 인수 기록](testing/operator-acceptance.md)과 격리 환경 생성·브라우저 도구를 준비했다.

- 개발자 자동 검증과 별도로 운영자가 10~20건을 검색·작성·편집·이미지·발행·예약·취소·숨김·재공개한다.
- 시간·반복 클릭·혼동·재작업·복구 실패를 측정한다. 최초 측정 전에 임의 성능 목표를 통과로 정하지 않는다.
- 로컬 테스트 인증의 사용성 인수와 운영 Access 인증 검증을 구분한다. 실제 로그인/MFA는 운영자가
  직접 수행하며 token·쿠키·인증 코드를 채팅이나 문서로 전달하지 않는다.
- 완료: 운영자 확인·불편사항 처리 또는 명시적 잔여 수용. 실제 운영 인증은 F에서 별도로 확인한다.

### F. P0-05 배포 준비와 승인 후 운영 검증

상태: **9월 25일 `8af7244` CI·API/Web·GTM 운영 반영, API V008·Collector V006 유지·새 백업 복원 확인 / 실제 MFA 관리자 인수·rollback·재부팅 미실행**. [9/25 앱 배포](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)와 [9/23 DB·콘텐츠 반영](../worklog/2026-09-23/release/production-db-promotion.md)을 구분한다. [V005 로컬 후보](../worklog/2026-09-23/release/candidate.md)는 DB 반영 전 판단이다.

- 운영 담당: 현재 release·부팅 helper·실행 digest·DB ledger/checksum·flag·timer·최신 백업을 읽기 전용으로 재조회한다. 이 조회는 9월 25일 배포 결과를 다음 작업의 현재값으로 고정하지 않기 위한 선행 작업이다.
- 운영자+개발자: 별도 승인된 운영 콘텐츠 범위에서 실제 Access MFA 허용/거부, 작성·업로드·발행·예약·취소·숨김·R2/CDN 회수·알림 실수신을 확인한다. 격리 인수 환경의 12건 측정은 E에서 별도로 진행한다.
- 다음 배포가 필요하면 [정책](operations/deployment-policy.md)과 [실행서](operations/deployment-runbook.md)에 따라 그 후보 SHA의 CI·digest·설정·V008/Collector V006 호환성·최근 18시간 이내 새 백업/복원·복귀 경로를 대조한다. V008에서 9월 20일 구 API는 readiness 503이고, 실제 운영 rollback·VM 재부팅은 아직 시험하지 않았다.

### G. Core 콘텐츠 운영 개시

- 기존 [Core 운영 개시 조건](roadmap.md#core-운영-개시-조건)을 모두 확인한다.
- 운영용 콘텐츠·권리 요청 담당·연락 수신을 확인한다. 기존 비공개 연락처와 현행 공개 정책을 재사용하고
  후속 기능의 법무 placeholder·활성화 조건은 유지한다.
- GA4·Kakao와 URL·Discord 접수/자동 수집은 비활성으로 유지한다. 9월 23일 batch 검수 flag ON은 실제 운영자 검수 인수나 QD-04 법무 gate 완료를 뜻하지 않는다.
- 완료: Core 수동 콘텐츠 운영 개시. 수집을 포함한 M0 전체 완료와 구분한다.

### H. P1 수집 후속 작업

[수집 후속 계획](roadmap.md)과 기존 P1-01~07을 따른다.

상태: **P1-06의 사이트 파일 분리·로컬 회귀 완료**. 21개 adapter·상세 parser, 19개 목록 parser를
분리했고 기존 40개 결과 일치·Java 273건·Core 연동 5건을 확인했다. 실제 사이트 fetch·원격 object·
Discord 검증은 이번 실행에 포함하지 않았으며, P1 전체는 부분 완료다.

**P1-07의 CI 구성·로컬 재현과 해당 SHA 원격 job 완료:** `collector` job에 Java·fixture·격리 DB와 JAR·SBOM 생성을 추가했다. macOS 273건·Linux Docker arm64 273건과 SHA `5c581c2`의 원격 collector job이 통과했다. Windows·별도 실행 PC·실제 운영 Collector 기동은 남아 있다. [Collector 로컬 결과](../worklog/2026-09-23/collector-ci/RESULTS.md)와 [원격 CI·배포](../worklog/2026-09-23/release/production-deployment-5c581c2.md)를 구분한다.

**P1-02의 화면 연결·격리 브라우저 검증 완료:** 조건부 관리 메뉴, 출처/수집 상태/검수 상태 필터,
원문·이미지·첨부 확인, 승인/반려, `postId` 초안 편집 연결과 응답 유실 복구를 구현했다.
API 통합 15건·관련 브라우저 27건을 통과했다. 로컬 테스트 인증·격리 DB/object 증거이며 실제 운영자
수동 인수·Access·원격 object 검증과 URL 입력/source 소유권 결정은 남아 있다. 9월 23일 운영에서는 검수 flag를 켜고 내부 service 조회·미리보기를 확인했으나 실제 MFA 화면 조작은 미실행이다.
[검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md)를 따른다.

**9월 23일 P1-01의 direct/legacy 문서 보완 완료 / 입력 계약은 미정:** 서비스 기획·수집 기획·보안·개발 명세의
현행 direct/legacy 경계를 정리했다. raw HTML 비공개 저장, 결과 조회/검수/queue 역할 분리,
원문 보존과 별도 발행을 실제 source·권한 SQL·OpenAPI와 대조했다. 보존 기간·고지 정합성과
Web 입력/source 변경 계약(QD-03/04)은 확정하지 않았다.
[문서 정합성 결과](../worklog/2026-09-23/collection-contract-alignment/RESULTS.md)를 따른다.

| 순서     | 작업                                                                                | 확인할 결과                                                                                    |
| -------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P1-01/02 | URL 입력 전달·source 소유권 계약과 실제 운영자 검수 인수                            | API 외부 fetch·batch queue 무제한 쓰기 금지, MFA 검수·반려·선택 초안 이동, 자동 공개0          |
| P1-03    | 다른 PC batch→공유 비운영 DB/object→API 검수·승격                                   | 역할별 쓰기 거부·dry-run 무쓰기·DB/object hash/size·재시작 복구                                |
| P1-04    | 실제 Discord Gateway/slash·확인·큐·완료 조회                                        | 권한·취소·만료·중복·실패를 실제 환경에서 검증                                                  |
| P1-05    | 원본/첨부/report/queue 보존·orphan 회수                                             | 기간 계약 확정, dry-run manifest, 진행/승격 참조 보호, 제한 삭제·readback                      |
| P1-06    | direct robots·일일 budget·redirect 보완, 모듈 분리 후 누락 표본·차단 출처 재개 조건 | 외부 요청 통제·3회 redirect 경계, 원문/이미지/파일/SNS 보존, live/fixture 분리, 차단 우회 없음 |
| P1-07    | Collector CI 해당 SHA 성공 후 지원 OS·별도 PC 확인                                  | 다음 SHA CI, macOS·Windows·Linux·별도 PC 실행 결과 분리                                        |

비운영 DB/object 제한 계정, Discord 테스트 대상, 실제 실행 PC/OS, 보존 기간은 각 단계 전에 확인한다.
기존 입력을 먼저 확인하며 비밀 원문은 기록하지 않는다. 차단 4개 출처를 임의로 완료/제외 처리하지 않는다.

### I. P2 운영 관찰과 개선

- Core 개시일부터 실제 7일 예약 실패·알림·백업·용량·오류·권리 요청 대응을 기록한다.
  수집 관찰은 해당 기능 활성화일부터 별도로 시작한다.
- 관리자 개선은 수동 인수의 시간·재작업·왕복 수로 우선순위를 정한다.
- source별 수집 품질, 새 VM/미디어 복구 훈련, 실제 보존기간 회수, 필요 시 CD 개선을 진행한다.
- 완료: 실제 기간의 관측 기록과 미해결 항목. fixture 시간 전진으로 관찰을 대체하지 않는다.

## 9. 차단된 4개 출처의 재개 조건

| 출처              | 직전 실제 관측                                           | 재개 조건                                                         |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| fmkorea           | HTTP 430 보안 응답                                       | 허용된 공개 응답 또는 공식 수집 경로 확보                         |
| ppomppu           | 302 이동 뒤 HTTP 403                                     | 공개 접근 허용 또는 공식 경로 확보                                |
| pgr21             | Anubis 연결 확인, 상세 접근 차단                         | challenge 없는 허용된 공개 본문 응답 확보                         |
| youtube-community | HTTP 200이나 게시글 renderer 없이 responseContext만 존재 | 공개 게시글 renderer가 있는 실제 URL 또는 허용된 데이터 경로 확보 |

조건이 바뀔 때 해당 출처만 제한적으로 재검증한다. 차단 우회·generic parser 대체로 성공 처리하지 않는다.
fixture 구현 가능성, 실제 fetch, DB 저장, object readback 상태를 각각 기록한다.

## 10. 기존 전환 조건의 보존

이전 Spring/legacy 전환의 미체크 항목은 [당시 수용표](../worklog/2026-09-08/core-spring-acceptance/acceptance.md)에
남아 있다. S2-04/05, S4-03, S5-01/03, S6-05, S7-01~06의 실제 계정·Keychain·종료/절전·외부 연동·drain·관찰 조건을
디렉터리 이동만으로 완료/폐기하지 않는다. 현행 direct 적용 범위는 P1 기술 계약과 대조하고 필요 시 별도 결정한다.
과거 설계의 제약을 새 경로에 무조건 적용하지도 않는다. [전환 관찰 양식](operations/collector-transition-observation.md)은
legacy 전환 조건을 포함하며 Core 실제 운영 관찰과 구분해 사용한다.

## 개발 도구 — Git·harness 도입 계획

- [설계](ai/git-workflow.md), [구현 계획](ai/harness-implementation-plan.md), [현재 CI 근거](../worklog/2026-09-25/git-governance/CI-RECOVERY.md)를 따른다. HARN-01~07 전체 도입은 부분 구현이다.
- 완료한 전달: develop 생성·tracking, stash 복구와 기존 8개 SHA 보존, 단계별 commit·push, Draft PR #3~#9 생성. 후속 HARN-09 `8c1b5c1`·HARN-07 `0fe6255`는 원격에 반영됐다.
- PR #3은 develop `1ad626c`로 병합했고 병합 후 CI `36212646767`의 verify·Collector가 성공했다. 후속 로컬 수정은 checksum 쌍 고정, #7 CI 선행 수정 포함, #4~#9 선행 브랜치 merge 동기화다. 자동 승인 검토의 push 거절로 새 후보는 아직 원격 미반영이다.

| 우선순위 | 남은 작업                             | 완료 조건·의존성                                                                                                                                             |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | 후속 수정 커밋 원격 반영·CI 수용      | PR #6 checksum 수정 `a1a4802`, PR #7 선행 CI 수정 `f782c0b`와 #4~#9 동기화 커밋 push. 자동 승인 검토 차단 해소 후 정확한 SHA의 CI 확인                       |
| P0       | 기존 local main 8개 commit 검토       | PR #4의 SHA 보존, trailer 없는 기존 commit을 새 gate 활성화 전에 검토·검증. 정책 PR과 설계 문서 충돌 해결                                                    |
| P0       | 정책·cleanup·harness와 후속 수정 통합 | #5 → #6 → #7 → #8 → #9 검토. 선행 통합 뒤 각 PR을 develop 기준으로 retarget하고 정확한 head/base의 전체 CI 통과. 현재 feature → feature 차단을 우회하지 않음 |
| P0       | CI artifact 내용 수용                 | 진단·receipt 생성/업로드와 내용 검증을 구분. 실제 JSON의 subject SHA·run/attempt·binding·job 결과·hash를 대조                                                |
| P0       | 원격 보호와 검사기 변경 보호          | 마지막 관측에서 classic protection/ruleset 없음. 별도 승인 후 stable required check와 trusted-ref 또는 code-owner 보호 설정·readback 및 실패 병합 거부 확인  |
| P0       | 도입 이후 정책·task 등록 검토 경로    | manifest 자기확장 차단 유지. 미구현 governance 전용 gate의 등록 승인·검사기 보호·거부 회귀를 원격 강제 전 수용                                               |
| P1       | HARN-01~04 잔여 계약                  | 증거 schema·보존기간, 자동 heartbeat·다중 host·지원 OS의 미구현/미정 범위 확정 및 회귀                                                                       |
| P2       | HARN-07 실제 release/hotfix 수용      | version/tag/image 규약, 단일 release ref 처리, provider artifact·배포 SHA·main/develop/active release 재반영 확인                                            |

- Windows lease 통과는 Windows 전체 lint나 모든 GUI Git 지원을 증명하지 않는다. PR #9의 Core/Collector restore skip은 복원 성공으로 계산하지 않는다. 최종 develop 통합 SHA에서 분류와 필요한 restore job을 다시 확인한다.
- 실제 통합 순서는 [CI 복구 계획](../worklog/2026-09-25/git-governance/CI-RECOVERY.md)을 따른다. PR #1/#2와 복구 branch는 보존한다. 같은 변경의 중복 병합·자동 rebase·기존 SHA 재작성은 하지 않는다.
- 현재 worktree·Git metadata 쓰기 권한은 확보됐다. 후속 commit·push는 승인 범위지만 push 실행이 환경에서 거절됐다. 선행 PR 병합 전 #7~#9의 feature → feature 실패는 남으며, 정책 완화나 실패 무시 병합은 하지 않는다. #4~#9 병합·배포·원격 보호 설정은 승인 범위 밖이다.
- 기존 제품 출시 조건을 추가하지 않는다. 담당자·기한은 `(미정)`이며 원격 수용 전 전체 진척률을 임의의 백분율로 표시하지 않는다.

## 11. 갱신 규칙

- 이 파일은 앞으로 할 일·완료 조건·결정 대기 항목의 단일 진입점이다. 실제 결과는 worklog에 기록하고 status.md에서 요약한다.
- 단계 완료는 해당 범위의 source/test/runtime/운영 증거로 판단한다. 파일 이동·commit·원격 추적 동기화만으로 완료 처리하지 않는다.
- 과거 세 계획서는 당시 근거로 보관한다. [기존 실행 계획](../worklog/2026-09-23/m0-planning/next-plan.md),
  [기존 잔여 과정](../worklog/2026-09-23/m0-planning/remaining-process.md), [기존 수집 후속](../worklog/2026-09-23/m0-planning/collector-follow-up.md).
