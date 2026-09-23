# M0 중간 점검 보고서 — 2026-09-23

- 결론: **M0 전체 부분 완료. Core의 기능 기반은 갖췄지만 관리자 제품화와 운영 수용 검증이 남았다.**
- 권고: **M0 Core를 먼저 마감해 콘텐츠 운영을 시작하고, 수집 보조·자동 수집은 별도 검증 후 활성화한다.** 이는 기존 출시 단계에 맞춘 순서이며 21개 출처 목표를 폐기하거나 M0 전체 완료로 바꾸는 결정이 아니다.
- 문서 역할: 현재 작업 트리의 요구사항별 중간 감사와 다음 작업 제안. 제품·기술 정본을 대신하지 않으며 아래 계획의 일정·새 정책은 확정 전 제안이다.
- 상세: [40개 요구사항 대조표](../../../docs/development-specs/requirements-status.md), [실행 순서·완료 조건·결정 목록](../m0-planning/next-plan.md).

후속 실행 안내: 아래 수치·결함은 최초 감사 시점의 기록이다. 이후 Core 보완·사이트 파일 분리·Collector CI·
direct 검수 UI·D01~D03 문서 정합성 작업은 [잔여 과정](../m0-planning/remaining-process.md)과 개별 결과로 추적한다. 현재 요구사항 대조표는
A07의 메뉴·필터·초안 연결과 C09의 검색·목록 구현을 반영해 I 30 / P 9 / U 1이며, 실제 운영 수용 완료율은 아니다.

최신 현황과 재개 입력은 [현재 진행 상황](../../../docs/status.md), 이번 로컬 커밋은
[진행 보관·커밋 기록](../progress-checkpoint.md)을 따른다.

## 1. 조사 범위와 한계

- 범위: M0 Core 4개 기능 명세, 수집 명세 및 direct batch 확장, 공개·관리자 Vue/BFF, Nest 기능·저장소·migration, Java batch/queue/parser/storage, 테스트·CI·배포·운영 문서.
- 방식: 정본 요구사항의 전 영역을 40개 점검 단위로 묶어 source와 증거를 대조했다. 모든 코드 줄의 결함 검사나 모든 테스트·외부 서비스의 재실행을 뜻하지 않는다.
- 이번 실행: Git 상태·diff 통계, 파일/호출 경로 검색, 명세·소스 읽기, 기존 JSON/XML 검증 산출물 대조, 신규 문서 링크·집계·diff 검사.
- 미실행: DB 질의·변경, 외부 사이트 재수집, 로그인·브라우저 버튼 조작, build/test 재실행, 운영 서버·Discord·S3 접속. 과거 검증은 당시 환경의 증거로 표시한다.
- 기준선: `main...origin/main [ahead 1]`, 기존 수정 87개·미추적 108개 항목. 기존 파일을 수정·삭제하지 않고 이 폴더의 보고서 3개만 추가한다.

## 2. 얼마나 개발됐는가

`구현`은 해당 점검 단위의 주요 코드가 확인됐다는 뜻이며 디자인·현재 회귀·운영 검증 완료를 포함하지 않는다. `부분`은 요구의 일부 또는 새 경로 연결이 부족하고, `미확인`은 대응 구현을 찾지 못한 상태다.

| 점검 범위 | 단위 수 | 주요 구현 확인 | 부분 구현·연결/마감 필요 | 구현 미확인 |
| --- | ---: | ---: | ---: | ---: |
| M0 Core | 16 | 14 | 2 | 0 |
| M0 수집 보조 | 8 | 5 | 3 | 0 |
| M0 자동 수집 | 8 | 6 | 1 | 1 |
| 공통 운영·출시 준비 | 8 | 3 | 5 | 0 |
| 합계 | **40** | **28** | **11** | **1** |

- **주요 구현 확인 비율: 28/40 = 70%. Core는 14/16 = 87.5%.** 이번 감사에서 정의한 같은 크기의 체크 항목 수 비율이며 공수·제품 완성도·출시 준비율이 아니다. 부분 항목을 임의로 0.5점 처리하지 않았다.
- **사이트 실제 검증 범위: 17/21 = 81.0%.** 공개 원문 수집과 로컬 DB/object readback 범위이며, 운영 연결·모든 게시물 형태 성공률이 아니다.
- **관리자 제품 완성도: 초기 UI 단계.** 작성·상태 변경 로직은 상당 부분 있으나 관리 화면 디자인·탐색·반복 업무·새 수집 경로의 통합이 부족하다.
- **운영 준비: 최신 변경분 미완료.** 9월 20일 Core 서버·정책 배포 기록은 있으나, 현재 수집·미디어·검수 변경분의 운영 배포 증거로 승계할 수 없다.

## 3. 확인된 구현과 검증 수치

| 영역 | 확인된 결과 | 해석 제한 |
| --- | --- | --- |
| 공개 화면 | 71글·본문 71건·이미지 266개, 목록 4페이지/고유 71건 | 9월 23일 기존 검증 산출물; 이번 새 브라우저 검사가 아님 |
| 브라우저 | 71개 상세 방문, 이미지 깨짐·미완료·가로 넘침 0 | DOM/로드 검사; 모든 화면 디자인을 육안 승인한 것은 아님 |
| 수집 저장 | 17출처·FETCHED 104건·이미지 380개·FILE 2개·SNS 21개, 불일치 0 | 로컬 PostgreSQL/object; 21×최신 5건 완료가 아님 |
| 실제 HTML | 17출처 목록/상세와 인벤 추가 표본, 총 36개 HTML | 4개 차단 출처는 synthetic 테스트와 구분 |
| 첨부 | 인벤 FILE 2개 hash·크기·ZIP CRC 확인 | 모든 출처 첨부 검증이나 악성코드 검사 완료가 아님 |
| 정식 검수 | 인벤 111번: 검수→승인→DRAFT→별도 PUBLISHED, private/public·404 전이 검증 | 71개 모두 이 정식 절차로 새로 생성했다고 집계하지 않음 |
| Java | 현재 XML 170/170, 실패·오류·생략 0 | 03:36 UTC 임시 PostgreSQL 최종 실행 증거; 이번 재실행 없음 |
| API/Web | unit 32/32, batch review 격리 통합 14/14 기록 | 해당 후속 변경 검증 묶음; M0 전체 테스트 총수 아님 |
| migration/권한 | API V001–V008, Collector V001–V006 및 제한 역할 4개 검증 기록 | 운영 DB 적용과 별개 |
| 복구·dry-run | 복원 61테이블·16sequence 일치; dry-run DB 12테이블/object 527개 불변 | 각 검증 시점·격리/로컬 대상에 한정 |

- 수치 근거: [첨부·브라우저·출처 보고서](../../../apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md), [최종 수용 감사](../batch-고도화/ACCEPTANCE-AUDIT.md).
- JSON 원본: `.local-data/verification/{collector-inventory,collected-content,browser-all-posts-20260923,final-java-readback-suite}.json`. Git 제외 자료이며 배포 산출물에 포함하지 않는다.
- 이전 첨부 보고서의 Java `154 통과/16 skip` 뒤 최종 `170/170, skip 0` 결과가 존재한다. 두 실행을 중복 합산하지 않는다.

## 4. 빈약하거나 위험한 부분

| ID / 우선도 | 발견·영향 | 근거와 최소 조치 |
| --- | --- | --- |
| F01 / High / Core | 관리자 화면이 기능 중심 초안이다. 상태 코드·버전 노출, 반복 편집, 오류/빈 결과 안내가 운영 작업을 어렵게 한다. | [admin.vue](../../../apps/web/app/pages/admin.vue):320–590; [편집기 명세](../../../docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md):1050. 기존 API를 유지하고 UI·사용 흐름을 마감한다. |
| F02 / High / 수집 | `/admin`의 수집 진입은 legacy `/admin/collect`이고 새 결과는 `/admin/batch`다. 관리자 URL 입력은 legacy candidate endpoint를 사용해 direct queue 통합 완료로 볼 수 없다. | [admin.vue](../../../apps/web/app/pages/admin.vue):19,324; [admin-collect.vue](../../../apps/web/app/pages/admin-collect.vue):230; [batch 화면](../../../apps/web/app/pages/admin-batch.vue):3. 정식 메뉴와 입력 소유권을 결정·연결한다. |
| F03 / High / 수집 | 출처 관리 화면은 기존 `/collect/sources`를 수정하고 direct CLI는 JSON source registry를 읽는다. 화면에서 변경한 설정이 실제 batch에 적용된다고 보장할 수 없다. | [출처 화면](../../../apps/web/app/pages/admin-collect-sources.vue):7,21; [BatchMain](../../../apps/collector/src/main/java/com/blariyo/collector/ops/BatchMain.java):86. 우선 direct 설정을 읽기 전용으로 표시하고 변경 경로를 명시한다. |
| F04 / High / 수집 상시 운영 | 새 `collect.batch_*`와 `collect/raw,media,report`의 보존·삭제 실행 경로가 확인되지 않았다. 기존 cleanup만으로 신형 데이터의 만료·실패 orphan 회수를 보장할 수 없다. | [기존 cleanup](../../../apps/api/src/features/collection/collection-cleanup.service.ts):20; [MetadataRetention](../../../apps/collector/src/main/java/com/blariyo/collector/maintenance/MetadataRetention.java); [BatchObjectStore](../../../apps/collector/src/main/java/com/blariyo/collector/storage/BatchObjectStore.java). 보존 계약·삭제 소유자·참조 보호를 정하고 전용 dry-run/readback을 구현·검증한다. |
| F05 / High / 운영 | 실제 관리자 로그인 뒤 업로드→발행→숨김 전체 흐름의 현재 운영 증거가 없다. 로컬 API 성공을 운영자 사용 가능으로 보고하면 안 된다. | [운영 상태](../../../docs/operations/current-status.md):확인된 결과와 한계. 운영자 세션으로 최종 시나리오를 실행한다. |
| F06 / High / 수집 | 실제 Discord Gateway, direct batch 원격 S3/R2, API와 다른 PC 실행이 미검증이다. 기존 Core R2 확인을 새 collect 권한 검증으로 대체할 수 없다. | [최종 수용 감사](../batch-고도화/ACCEPTANCE-AUDIT.md). 비운영 bucket/DB와 실제 batch 계정으로 실연동한다. |
| F07 / Medium / 검증 | Java 테스트는 로컬 증거가 있으나 현행 CI는 API/Web 중심이다. 새 batch UI 버튼과 Windows·별도 PC 전체 흐름도 검증 공백이다. | [CI](../../../.github/workflows/ci.yml), [browser 테스트](../../../tests/browser/collection.test.ts). direct 경로 회귀 및 collector CI를 추가한다. |
| F08 / Medium / 운영 | 실패 알림 실수신·장기 예약 처리·새 VM 복구·현재 배포 식별자 검증이 남아 있다. 문서나 timer 설치만으로 운영 안정성을 확정할 수 없다. | [운영 상태](../../../docs/operations/current-status.md), [보안 운영](../../../docs/system-design/05-security-operations.md). 출시 전 최소 장애 시험과 출시 후 관찰을 나눈다. |
| F09 / Medium / 출처 | 4개 출처 차단, 인벤에 편중된 실제 첨부 표본, 날짜 미상 포함 정책의 한계가 있다. 17개 성공을 전 게시물·21개 지원으로 표현하면 안 된다. | [출처 보고서](../../../apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md). 표본·제한을 공개적으로 기록하고 차단 원인이 바뀔 때만 재검증한다. |

F01의 구체 누락: 명세의 검색 결과 게시판·수정일, 영역별 로딩·검색 결과 없음 안내가 현재 template에 충분히 반영되지 않았다. 기본 반응형/CSS와 이미지 preview는 있으므로 “화면 소스나 디자인이 전혀 없다”는 판정도 부정확하다.

## 5. 문서 정합성 부채

아래는 이번에 발견한 정정 대상이다. 이 감사에서는 기존 정본을 일괄 덮어쓰지 않았으며, P0-01/P1-01에서 실제 계약과 함께 수정한다. 과거 worklog는 소급 변경하지 않는다.

| ID | 충돌·오래된 표현 | 정정 방향 |
| --- | --- | --- |
| D01 | [서비스 기획](../../../docs/planning/01-service-plan.md):243,272 이후에 Core로 후보 제출·metadata만 저장·임시 preview 규칙이 남음 | 현행 [수집 기획](../../../docs/planning/content-collection/README.md)·direct batch 소유권과 정렬; legacy는 별도 절로 격리 |
| D02 | [보안 운영](../../../docs/system-design/05-security-operations.md):41,191,216에 원문 HTML 미저장·BE 제출·넓은 DB 권한 설명이 남음 | private raw 보존과 로그 비노출을 구분하고 실제 분리 역할·prefix·보존 계약으로 갱신 |
| D03 | [수집 명세](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md):55–95의 요구표·상태·테이블은 legacy 중심 | 말미 direct 계약과 요구표/API/D08 추적을 일치시켜 앞부분만 읽어도 경로를 오해하지 않게 함 |
| D04 | [편집기 명세](../../../docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md):1052–1055는 초안·UI/browser 미검증, 기존 브라우저 기록은 일부 기능 통과 | 디자인 미완료·과거 synthetic 동작 검증·현행 실제 인증 UI 미검증을 각각 표시 |
| D05 | [open-decisions](../../../docs/development-specs/m0-core/decisions/open-decisions.md)의 실값 미입력 설명과 [운영 실값 체크리스트](../../../docs/development-specs/m0-core/decisions/operational-values-checklist.md)의 9월 20일 주입 기록이 다름 | 이미 확인된 입력은 재요청하지 않고 정책 v0.1 기록과 연결; 법률 검토·후속 기능 미정은 유지 |
| D06 | [배포 정책](../../../docs/operations/deployment-policy.md)의 GitHub 실행 결과 없음과 [운영 상태](../../../docs/operations/current-status.md)의 이미지 게시 설명이 다름 | 최근 workflow run/배포 digest를 조회해 갱신. CI 이미지 게시와 운영 배포는 계속 분리 |

## 6. 21개 사이트 상태

아래 수량은 9월 23일 저장 원본 readback 기록이다. 정책은 목록 종류이고 live 접근 가능 여부와 별개다. 전 사이트의 운영 S3/Discord 검증은 완료로 집계하지 않는다.

| 출처 | 목록 정책 | 실제 목록·상세 / 로컬 readback | 상태 |
| --- | --- | --- | --- |
| arcalive | HOT_LIST | 확인 | verified-local |
| bobaedream | HOT_LIST | 확인 | verified-local |
| clien | GENERAL_LIST | 확인 | verified-local |
| dcinside | HOT_LIST | 확인 | verified-local |
| dmitory | GENERAL_LIST | 확인 | verified-local |
| dogdrip | HOT_LIST | 확인 | verified-local |
| etoland | GENERAL_LIST | 확인 | verified-local |
| fmkorea | BLOCKED | 실제 본문 성공 없음 | blocked: HTTP 430/보안 페이지 |
| goodgag | GENERAL_LIST | 확인 | verified-local |
| humoruniv | GENERAL_LIST | 확인 | verified-local |
| instiz | GENERAL_LIST | 확인 | verified-local |
| inven | HOT_LIST | 확인, 실제 FILE 2개 포함 | verified-local |
| mlbpark | GENERAL_LIST | 확인 | verified-local |
| natepann | GENERAL_LIST | 확인 | verified-local |
| pgr21 | DETAIL_ONLY | 실제 본문 성공 없음 | blocked: Anubis 연결 확인 |
| ppomppu | BLOCKED | 실제 본문 성공 없음 | blocked: 302→403 |
| ruliweb | HOT_LIST | 확인 | verified-local |
| theqoo | HOT_LIST | 확인 | verified-local |
| todayhumor | HOT_LIST | 확인 | verified-local |
| yuldo | GENERAL_LIST | 확인 | verified-local |
| youtube-community | DETAIL_ONLY | 응답에 게시글 renderer 없음 | blocked/unverified: HTTP 200만 확인 |

## 7. 가장 빠른 마감 방향

- **P0: Core 관리자 제품화와 실제 운영 검증.** 설계 마감→UI→10~20건 반복 작업→전체 회귀→승인된 배포/운영 확인 순서로 진행한다.
- **P1: direct 수집 경로 연결과 실연동.** 관리자 입력·출처 설정·보존 정리·Discord·원격 object를 마감하며 자동 공개는 추가하지 않는다.
- **P2: 운영하면서 개선.** 처리 시간·실패율·미검수 잔량·저장량을 측정한 뒤 일괄 작업·UX·출처를 개선한다. 장애·정보 노출·내용 유실은 P2로 미루지 않는다.
- 추정: Core 마감은 개발자 1명 기준 **4–6 작업일**, 수집 실연동 마감은 환경 준비 후 **추가 3–5 작업일**이 목표다. 외부 접근 차단 4개와 실제 관찰 기간에는 이 일정을 적용하지 않는다.
- M0 Core 운영 개시와 M0 전체 완료를 별도 승인한다. [구체 계획과 결정 목록](../m0-planning/next-plan.md)의 종료 조건을 만족하기 전에는 완료로 표시하지 않는다.

## 8. 이번 문서 작업의 검증

- 신규 보고서 3개만 작성; 앱·DB·설정·Git index·운영 환경 변경 없음. commit/push/배포 없음.
- 요구사항 ID 40개·분류 합계 28/11/1, 출처 21개, 실행 작업 16개와 참조 ID를 검사해 통과했다. 상대 링크 109개 중 누락 파일은 0개다.
- `git diff --check` 및 미추적 신규 문서 3개의 별도 whitespace 검사 통과. Git은 `main...origin/main [ahead 1]`, 수정 87개·미추적 109개 항목으로 보고서 폴더 1개가 추가됐다.
- 앱 동작·외부 연결을 새로 검증한 결과는 아니다. 수치 근거·코드 확인·추정 일정·미검증 항목을 분리했다.
