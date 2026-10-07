# M0 로드맵 — 남은 작업과 완료 조건

- 2026-10-08 Discord 검수: 로컬·운영 구현과 실제 수집→메시지 전송 검증 완료. 남은 관찰은 첫04:30 정기 수집, 사람의👍/❌에 따른07:30 처리, 실제48시간 만료·장기 삭제 복구다. 제목/문장 수정 기능은 합의대로 후속 개발이다. [운영 결과](../worklog/2026-10-08/discord-review-deployment/README.md). 아래 과거 인수 목록 전체가 완료된 것은 아니다.

- 2026-10-06 AI 품질 도구: 공통 lint·검증 입력/결과 기록·정책 약화 검토·선택 Oxlint 규칙을 구현했다. iron-laws는 검토 보조다. 도입 검증과 실제 변경 관찰의 완료 여부는 [현재 실행 기록](../worklog/2026-10-06/ai-quality-adoption/README.md)을 따른다. 원격 CI·배포·운영 수용을 뜻하지 않는다.

- 2026-09-27 로컬 구현: UX-01~06, D01~D04, COL-01/02 및 CON-02의 코드·계약·추가migration·운영 도구를 반영했다. 검수1/20건의 SQL은 모두5회이며 신규 입력/회수 기능은 기본 OFF다.
- 실행 결과와 최종 판정: [완료 조건 감사](../worklog/2026-09-27/m0-implementation/COMPLETION-AUDIT.md), [현재 상태](status.md), [17개 task](implementation-tasks/README.md).
- 남은 실제 인수: [운영 인계](operations/m0-operation-handoff.md)의 OWNER/EDITOR Access/MFA, 장비·사설 DB/R2 경로, Drive/Discord 실연동·18시간 이내 복구 증거, source별 S1~S5·고지, Core 운영7일. CON-01은 재활성화 결정 전 조건부다.
- 다음 승인된 배포는 통합·검증을 마친 release 후보의 SHA/digest·migration/권한·선택백업·복귀를 새로 검증한다. 기존 R2 정상 백업을 Drive 실제 인수 전에 중단하지 않는다.

- 기준: [9/25 앱 배포·운영 상태](operations/current-status.md), [요구사항 40개](development-specs/requirements-status.md). DB·콘텐츠 반영은 9/23 기록과 구분한다. 단계·요구사항 ID와 미완료 조건을 유지하고 과거 실행 결과는 worklog에 보존한다.
- 목표: **Core 관리자와 운영 흐름을 먼저 마감해 콘텐츠 운영을 시작하고, 수집 기능은 운영과 병행해 검증 후 활성화한다.**
- 전제: 기존 Core/API·DB 모델을 재사용한다. 신규 관리자 프레임워크, 통계 대시보드, 회원·광고, 자동 발행을 추가하지 않는다.
- 순서: P0-01~04의 개발자 로컬 작업, 9/23 DB·콘텐츠 반영과 9/25 API/Web·GTM 배포 이후 **운영자 인수→운영 예약/알림·복귀 확인**이 다음 단계다. P1은 입력 계약·시험 자원이 준비된 범위부터 병행하고 P2는 실제 운영 기간으로 관찰한다.
- 9/26 최종 결정: [운영 DB 백업만 Google Drive, 공개 전·공개 이미지/첨부는 기존 R2 유지](planning/02-infra-plan.md#6-데이터와-저장소-원칙). 백업 공급자 선택은 확정, Drive 계정·권한·실다운로드/복원·실제 전환 인수는 잔여다. 로컬 전환/복원 도구는9/27 증거를 따른다. 기존 R2 백업 성공을 Drive 인수 증거로 재사용하지 않는다.
- 출처 범위: **검증된 출처만 M0에 포함**한다. 에펨코리아·뽐뿌·유튜브 커뮤니티는 [COL-REANALYZE-01](../worklog/2026-09-26/collection-source-reanalysis/README.md) 한 task로 대기하며 현재 작업 종료 후 사용자 재개 지시 전에는 분석하지 않는다. PGR21도 미검증 후속 후보로 남긴다. 기존 21개 구현·관측 이력은 보존한다.
- 과거 일정: P0 4–6 작업일, P1 추가 3–5 작업일은 최초 계획 당시 추정이다. 현재 잔여 공수나 납기로 재사용하지 않는다.

## 1. 다음 시작점

2026-09-30 Git 반영과 로컬 준비 도구 보완을 반영한 잔여 실행 목록이다. 기존 ID를 유지하며 로컬 완료 항목을 다시 구현하지 않는다.
아래 순서는 의존성 기준이고 운영자 인수·계정 준비는 병행할 수 있다. 정확한 설치/백업/회수 순서는 [운영 인계](operations/m0-operation-handoff.md#인수-순서와-중단-시-조치)를 따른다.

| 순서·우선순위 | 잔여 task | 착수 입력·담당 | 완료 증거 |
| --- | --- | --- | --- |
| 0 · 완료 | CON-02 후속/O05: 로컬 개발 준비 도구 권한·상태 출력 정렬 | 로컬 보완 `3c3902b`; 운영 적용은 별도 | [후속 작업](implementation-tasks/contracts-maintenance.md#로컬-준비-도구-후속--2026-09-27-문서-대조)의 최신 권한·ledger·격리 DB 허용/거부 검증 완료. 운영 인수는 아래 잔여로 유지 |
| 1 · 통합 완료 | feature→release 통합·검증·원격 동기화 | `53873d0` 일반 push·서버 readback 완료 | [통합 결과](../worklog/2026-09-30/git-cleanup-execution/README.md):22개 충돌 해결·회귀 통과·원격 일치. 별도 파비콘8파일은 `3f35388`에 보존·검증했고 기존 feature는 정리했다. [유실 재검토·후속 반영](../worklog/2026-09-30/favicon-release-preservation/README.md)을 따른다. image digest·배포는 후속 범위 |
| 2 · P0 | OPS-01/02: 사람의 반복 업무·실제 Access/MFA 인수 | 사용자(OWNER)·역할별 시험 계정/콘텐츠·시간 | 인수12개 시나리오/10~20건 업무의 소요·혼동·재작업, OWNER/EDITOR 허용·거부·기존 세션 회수 |
| 3 · P0 | P0-05/OPS-02/03: 운영 상태 재조회·새 후보 반영·복귀 | 운영 접근·적용 범위/시간 / 사용자+개발자 | 현재 SHA/digest/ledger/flag/timer, 최근18시간 내 백업·격리 복원, API009/010·Collector007~010/권한·호환 복귀·실제 재부팅 |
| 4 · P1 | OPS-04/P1-03/04/07: 실제 장비·원격 DB/R2·Discord | QD-05/06의 장비·사설 경로·제한 계정 | DB/object byte/hash readback, 권한 거부, 재시작·24시간 만료, Discord 취소/중복/권한·실수신. 지원 OS별 증거 분리 |
| 5 · P0/P1 | OPS-03/COL-04: 선택 백업·Drive 전환·보존 회수 | Drive·R2·age 복구·비운영 삭제 대상 / 사용자 | R2 선택 대체본·기존 full 처리, Drive 정기2회 성공·독립 복원·만료/알림·R2 복귀, 제한 회수와 content 사본 보호. 실제 수집 회수 활성 전 필수 |
| 6 · P1 | COL-03/A08: 선택 출처·설정·고지 인수 | 승인된 표본/source 설정·고지 검토 | source/방식/config hash/SHA별 S1~S5·실제 운영 적용 목록, 고지 발행과 범위 내 활성화 |
| 6-1 · P1 · 미착수 | [COL-QUALITY-01: 출처별 스크래핑 만족도 검사](#col-quality-01) | 원문과 수집 결과를 대조할 대표 표본 / 개발자 검사·OWNER 만족도 판정 | 출처별 누락·순서·중복·저장/화면 대조 결과, 운영자 만족도와 보완 우선순위 |
| 7 · P2 | OPS-05: Core 실제7일 관찰 | 운영 개시·담당/시작일 | 실제 날짜별 예약·알림·백업·용량·오류·권리 요청과 미해결 장애 조치 |
| 별도 · M0.5 | BODY-HTML-01: 게시글 본문 저장 구조 전환 | M0 Core 운영 인수 후 별도 승인 / 개발자+운영자 | 수집 검수는 block 유지, 게시글 저장·공개·관리자 편집은 `body_html` 단일 본문과 이미지 참조로 전환. migration/API/UI/브라우저/rollback 증거 |

문서 상태 동기화는 이번 요청에서 수행한다. 운영 인수 미완료를 앱 미구현으로 표시하지 않는다.
CON-01 legacy는 재활성화 결정 후, COL-REANALYZE-01은 사용자 재개 지시 후에만 착수한다.
GA4/Kakao·회원·광고·캐시·서버 통합/증설과 대시보드는 현재 마감의 필수 잔여에 포함하지 않는다.

<a id="col-quality-01"></a>
**COL-QUALITY-01 — 출처별 스크래핑 만족도 검사**

- 등록: 2026-10-04 사용자 요청. **다음 할 일 / P1 / 미착수**, 착수일·완료 기한은 `(미정)`. 기존 COL-03/A08 출처 인수와 연결하며 검사 결과를 출처별로 남긴다.
- 대상: 검증된 출처부터 대표 표본을 선정한다. 텍스트 위주·이미지 위주·혼합·긴 글·SNS/첨부 포함 유형을 확인하고 출처별 표본 URL·건수·검사 시각·수집기 버전·설정 기준을 기록한다. 재분석 대기 출처는 위의 기존 범위를 유지하며 미검증으로 구분한다.
- 정확성: 원문과 제목·본문·이미지·첨부·외부/SNS 링크를 직접 대조해 누락, 잘림, 깨짐, 순서 변경, 중복과 광고·댓글 혼입을 확인한다. SNS는 현행 계약대로 링크 보존 여부를 검사한다. [원문 수집 기획](planning/content-collection/README.md#11-원문-수집-확장--2026-09-20-결정)을 기준으로 한다.
- 저장·화면: 목록 발견 → 상세 수집 → DB·비공개 객체 재조회 → 관리자 미리보기까지 확인한다. 요청 성공이나 저장 건수만으로 품질 통과를 판정하지 않는다. 중복 URL 재수집과 실패·차단 사유가 정확히 기록되는지도 확인한다.
- 만족도: 출처별 검사 건수, 정상 건수, 누락·오류 건수와 비율(분모 포함), 대표 문제, 수동 보정 필요 여부를 정리한다. OWNER가 실제 검수·게시 준비에 충분한지 `만족 / 보완 필요 / 부적합`으로 판정하고 이유를 남긴다. 운영자 확인 전에는 만족도 `(미정)`으로 둔다.
- 완료 조건: 대상 출처별 결과표·원문/저장/화면 대조 근거·OWNER 판정이 있으며, 문제별 수정 우선순위와 재검사 대상을 지정한다. 만족도 검사는 기존 출처 활성화·보존·접근 제한 조건을 대체하지 않는다. 실제 검사 실행과 운영 반영은 할 일 등록 완료와 구분한다.


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

| 작업 | 범위·산출물 | 완료 조건 | 선행·담당 | 최초 계획 추정 |
| --- | --- | --- | --- | --- |
| P0-01 | 최소 관리자 화면 설계; Core 요구·법무 입력 상태·현행 배포 기록의 문서 충돌 정리 | C09/C16 상태별 화면과 필수 동작 확정, 기능/운영 검증 구분; 이미 입력된 법무 실값 재요청 없음 | 개발자 정리, 운영자 사용 흐름 확인 | 0.5일 |
| P0-02 | 관리 메뉴·검색 목록·한국어 상태·날짜·loading/empty/error/retry | 상태/제목/게시판 검색, 게시판·수정일 표시, 빈 결과·오류 후 복구; 숨긴 수집 기능 메뉴 미노출 | P0-01 / 개발자 | 1–1.5일 |
| P0-03 | 편집·이미지·저장 상태·상태별 액션 UI 마감 | 미저장 이탈 경고, 실패 파일 안내, 순서/alt/출처 편집, 예약·숨김·제거 확인, 중복 클릭 방지 | P0-02 / 개발자 | 0.5–1일 |
| P0-04 | 격리 로컬 Core 회귀 완료; 운영자 반복 업무 인수 잔여 | 운영자가 10~20건 작성/편집, 즉시·예약·취소·숨김·재공개 완주; 시간·혼동·재작업·내용 유실·중복 발행 기록 | [인수 절차](testing/operator-acceptance.md) / 운영자+개발자 | 최초 계획 1–1.5일 |
| P0-05 | 9/25 `8af7244` CI·API/Web·GTM 운영 반영, 새 백업 복원·V008/Collector V006 유지 확인; 운영 인수 잔여 | 실제 Access MFA·업로드·발행·예약·숨김·알림, 다음 배포의 ledger/timer·최근 18시간 이내 백업/복원·호환 복귀 경로 확인 | 운영자 인수·운영 접근 / 운영 담당+개발자 | 최초 계획 0.5–1일 |

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

2026-09-27 UX-01~06 로컬 구현·브라우저 검증 완료: 정책 이력/목록 초점, SSR 이미지 메타정보,
하단 retry/공유 안내, 동의 읽기·cookie 삭제 실패/재시도, 청록 탭 정렬을 확인했다.
[Core 화면 task와 증거](implementation-tasks/core-ux.md)를 따른다. GA4 기본 OFF는 유지하고 실제
Google 속성/자동 측정/network·카카오 활성화·운영 배포는 해당 별도 인수 전까지 미검증이다.

분석 확장의 첫 구현 계약은 [analytics-v1 명세 §13](development-specs/m0-core/analytics-consent/analytics-consent.dev.md#analytics-v1)로
확정했다. Core 공개 키·OpenAPI/타입 → 동의 v3·단일 adapter·9개 이벤트 → 격리 검증 → 실제 고지·GTM/GA4/BQ
설정·일별 수신 → 핵심 집계 대조 순으로 진행한다. 직접 GA4가 유일한 전송 담당이며 같은 목적지의 GTM 태그는
중지·검증해야 한다. 이는 별도 확장 개발 순서이며 현재 P0 완료·운영 활성화를 뜻하지 않는다.



## 3. P1 — 수집 보조·자동 수집 마감

최초 계획의 추가 3–5 작업일은 현재 잔여 공수가 아니다. M0-D01/D02 입력 전달·보존 migration, 실제 실행 PC/시험 자원과 검증 대상 출처의 허용 경로를 확인한 뒤 재산정한다. 차단4개 통과를 M0 전체 선행 조건으로 두지 않는다.

| 작업 | 구체 작업 | 완료 조건 | 선행·담당 |
| --- | --- | --- | --- |
| P1-01 | 서비스 기획/보안/수집 spec의 legacy/direct 분리; 관리자 URL 입력 소유권·source 설정 정본 확정 | API가 collect 큐를 무제한 수정하거나 원문을 fetch하지 않는 입력 계약, legacy 활성화 범위, 설정 버전 규칙을 문서·contract로 일치 | 결정 QD-02/03 / 개발자+운영자 |
| P1-02 | 정식 메뉴→batch 결과→검수→선택 초안 편집 이동의 로컬 구현·격리 검증 완료, 운영 검수 flag ON | 실제 MFA 인증 브라우저에서 승인·반려·중복·실패·충돌·초안 이동 인수; QD-04 gate 유지 | 운영자 MFA·원격 object / 운영자+개발자 |
| P1-03 | 실제 다른 PC batch→공유 비운영 DB/S3/R2→API 검수·승격 readback | DB run/item/media·object hash/size 일치, 역할 간 쓰기 거부, dry-run 콘텐츠/object 무저장·요청 quota 기록, worker 재시작, 미승인 공개0 | 비운영 자원·제한 계정 / 개발자+운영 담당 |
| P1-04 | Discord 실제 Gateway·slash 등록·확인·큐·완료/실패 조회 | 취소·만료·권한 없음·중복 interaction 포함, 외부 fetch는 확인 뒤만 발생, 끝까지 실제 증거 기록 | 테스트 guild/channel/역할·실행 PC / 운영자+개발자 |
| P1-05 | direct DB/object 보존·실패 orphan 회수의 실제 인수 | 로컬 D01-T1~T7 완료. 실제 대상 manifest→제한 삭제→DB/object readback, 기한·사본 보호·부분 실패 복구 | 선택 백업/기존 full 대체·고지·제한 자원 / 사용자+개발자 |
| P1-06 | 검증된 M0 적용 출처와 미검증 후속 후보의 실제 수용 | robots/Crawl-delay·영속 budget·redirect3회 로컬 완료. 적용 출처별 S1~S5·원문/미디어·DB/object·운영 수용, 21개 전부 통과 조건 없음 | source별 허용 설정·승인 표본·실장비 / 사용자+개발자 |
| P1-07 | collector CI job·macOS/Linux Docker arm64 로컬 재현과 `5c581c2` 원격 CI 완료 | 다음 변경 SHA의 원격 CI 재검증, Windows PowerShell·별도 Linux/실제 PC 실행 결과 구분 | P1-03, 시험 장비 / 개발자 |

2026-09-23 P1-01 후속: D01~D03의 현행 direct/legacy 문서 충돌을 보완했다.
[문서 정합성 결과](../worklog/2026-09-23/collection-contract-alignment/RESULTS.md)를 따른다.
Web URL 전달·source 조회·보존은 M0-D01/D02 확정 후9/27 구현·로컬 검증했다. 실제 장비·고지·운영 인수는 QD-03/04와 OPS-04로 남아 있어 P1-01 전체 완료는 아니다.

2026-09-24 P1-01 추가 차이: legacy 원문 API는 최대 1000블록을 허용하지만 V006 DB CHECK는 40이다.
legacy 재활성화 전에 새 migration과 40/41/1000/1001 경계 검증으로 저장 계약을 맞춘다.
[DB 근거](system-design/02-data-model.md#원문-수집-후보-확장-2026-09-20). direct batch 경로의 상한과 별개다.

P1-01 legacy 추가 차이: 사이트 parser의 `attachmentCandidates`를 `CollectionPipeline.result`가 그대로 제출하나 legacy result OpenAPI는 이를 허용하지 않는다. [수집 명세](development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md)의 DTO 변환·첨부 보존 계약을 재활성화 전에 보완한다.

기계 명세 정렬 잔여: [OpenAPI 대조 결과](development-specs/m0-core/openapi-draft.md#2026-09-24-구조화-계약-대조의-잔여)의 production 인증/readiness 설명과 legacy preview MIME 표기를 소스·생성 계약과 함께 정렬한다.

P1-01/CON-02 유지보수 로컬 완료(9/27): direct batch result/review·discovery policy 조회의 [SQL 예외](system-design/nest-implementation-decisions.md#raw-sql의-제한된-예외-목록)를 정렬하고 검수1건/20건 모두 SQL5회(데이터1회)로 검증했다. 같은 코드를 다시 구현할 잔여로 세지 않는다.

2026-09-23 P1-02 후속: direct 관리 메뉴·필터·검수·선택 초안 이동과 오류 복구의 격리 로컬 구현/검증을 완료했다.
[검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md)의 API 15건·브라우저 27건을 따른다.
P1-01의 URL 입력/source 설정 계약과 실제 운영자·Access·원격 환경 인수는 별도로 남아 있다.

2026-09-23 P1-07 후속: Collector job 구성과 macOS·Linux Docker 검사 재현을 완료했고, `5c581c2` 원격 collector job도 성공했다([앱 배포](../worklog/2026-09-23/release/production-deployment-5c581c2.md)). Windows·별도 PC·실제 운영 Collector 기동은 남아 있다.

2026-09-24에 발견한 P1-06 통제 차이는9/27 `SourceRequests`·영속 budget에서 구현·로컬 검증했다.
robots 금지/미확인 무요청, Crawl-delay, 재시작/KST 날짜 경계, redirect 최대3회·4번째 목적지 무요청을 확인했다.
[기술 근거](system-design/07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조)를 따르며 실제 출처 S1~S5 인수는 남아 있다.

<a id="관리자-url-입력의-미정-경계"></a>
<a id="관리자-url-입력--설계-확정구현-잔여"></a>
### 관리자 URL 입력 — 로컬 완료·실제 인수 잔여

- [M0-D02](system-design/01-system-architecture.md#m0-d02-delivery)는 API 소유 입력 mailbox를 batch가 DB pull/ack하는 방식으로 확정했다. 인증된 batch endpoint 대안은 장비 노출·상시 가동 비용 때문에 채택하지 않았다.
- API/Web 원문 fetch 금지, batch queue/item 소유권을 유지한다. 접수/상태/재시도와 runtime source 읽기 전용 조회는 [API·OpenAPI](system-design/03-api-design.md#m0-d02-api)에 연결했다. 새 `/admin/batch` 입력은9/27 구현·로컬 검증됐으며 기존 `/admin/collect` 폼은 legacy다.
- CON-02/P1-01의 DB 함수·queue 연결·BFF/controller·화면·실행 계약 사본을 함께 구현·로컬 검증했다. 실제 장비/운영 인수는 남아 있다. Core 수동 운영은 이 작업 전체를 기다리지 않는다.

<a id="direct-보존삭제의-미정-경계"></a>
<a id="direct-보존삭제--설계-확정구현-잔여"></a>
### direct 보존·삭제 — 로컬 완료·실제 인수 잔여

- [M0-D01](system-design/02-data-model.md#m0-d01-retention)에 최초 검수 후7일/미검수28일·영구 최소 중복 키·동시 처리·부수 사본·제한 삭제·복원 계약을 확정했다. 재검수로 기한을 연장하지 않는다.
- COL-04의 새 migration·권한/worker·dry-run·격리 삭제/DB/object readback은9/27 로컬 검증했다. 실제 제한 자원 삭제 인수는 남아 있다. 기존 불변 trigger를 끄거나 runtime 일반 DELETE를 부여하지 않는다.
- [M0-D03](system-design/05-security-operations.md#m0-d03-drive)의 선택 백업으로 원본 보존과 백업7일을 분리한다. 정상 R2 대체본 검증→Drive 병행·독립 복원→전환은 OPS-03에서 인수하며 고지·실제 삭제 완료는 잔여다.

## 4. P2 — 운영하며 개선

| 작업 | 시작 시점·선행 입력 | 확인할 수치·종료 조건 | 담당 |
| --- | --- | --- | --- |
| P2-01 운영 관찰 | Core 운영 인수 뒤 매일; 수집 활성화 시 수집 관찰 별도 시작 | 실제 7일의 예약 실패·알림·백업·용량·오류·권리 요청 대응 기록. fixture 시간 전진으로 대체하지 않음 | 운영 담당 |
| P2-02 관리자 개선 | 운영자 첫 10~20건 측정 후 | 한 묶음 처리 시간, 실패/재작업 수, 검색·편집 왕복 수를 기준으로 다음 기능 1개씩 선정 | 운영자+개발자 |
| P2-03 수집 품질 | 허용 source별 활성화 후 | source별 발견/성공/중복/차단/빈 본문/미디어 실패 수, parser 변경 전후 회귀. 출처 비율만으로 내용 완전성을 평가하지 않음 | 운영 담당+개발자 |
| P2-04 복구·배포 자동화 | 초기 운영 안정화와 보존 계약 확정 후 | 새 VM 복구·media 복구 훈련, 실제 보관기간 삭제 관찰, 필요 시 수동 CD 자동화. CI image 게시를 배포로 표시하지 않음 | 운영 담당+개발자 |

**첫 운영에서 미뤄도 되는 것:** 관리 통계 대시보드, drag-and-drop, 일괄 발행, 고급 필터, GA4/Kakao 활성화, 광고·회원, 무중단 배포, 4개 차단 출처의 우회 없는 접근 조건 대기.

**미루면 안 되는 것:** 관리자 접근 통제, 원문/이미지 유실, 잘못된 공개, 숨김 실패, 데이터 역할 침범, 백업 없는 배포, 오류를 성공으로 표시하는 보고, 수집 활성화 전 robots/일일 요청 통제와 상시 수집의 보존·회수 부재.

## 4.5 M0.5 — 게시글 본문 HTML 저장 구조 전환

M0.5는 운영 게시글의 저장 구조를 `TEXT/IMAGE block` 배열에서 `body_html` 단일 본문과 이미지 참조 계약으로 바꾸는 별도 구조 변경이다. 현행 M0 Core 운영 인수와 release 안정화를 먼저 마감하고, 별도 승인된 migration/API/UI 작업으로 진행한다.

목표 방향:

- 수집 원문과 수집 검수 화면은 현행처럼 `TEXT/IMAGE/LINK` block 단위로 보관·표시한다.
- 운영자가 수집 결과를 검토해 게시글 초안을 만들 때 block을 안전한 HTML로 변환한다.
- 실제 게시글 저장·수정·공개 응답은 `body_html` 단일 본문을 기준으로 한다.
- 이미지 binary와 공개/private object 상태, alt, 크기, 해시는 별도 image 테이블에서 계속 추적한다.
- 저장 HTML에는 외부 이미지 URL이나 public object key를 직접 고정하지 않고, post 소유 image 참조를 검증해 렌더링 단계에서 public URL을 조립한다.

완료 조건:

- 데이터 모델에 `body_html` 저장 위치, 이미지 참조 방식, `content.board_post_block`의 전환·보존·제거 순서를 확정한다.
- 기존 게시글의 block 데이터를 `body_html`로 변환하는 migration과 rollback 또는 읽기 호환 기간을 둔다.
- `CreatePostRequest`, `UpdatePostRequest`, 공개 상세, 관리자 편집 상세의 OpenAPI·생성 타입·BFF/API 구현을 같은 SHA에서 정렬한다.
- 수집 검수→초안 생성 converter가 TEXT/IMAGE/LINK block을 허용 HTML과 image reference로 변환하고, XSS sanitize·post 소유권·alt·누락 이미지 실패를 검증한다.
- 숨김·재공개·최종 제거·object cleanup·public cache purge가 HTML 참조 기반에서도 기존 상태 전이와 같은 결과를 보인다.
- 기존 public SSR, OG description, 본문 도달 analytics, 광고 위치 후보가 `body_html` 기준으로 재검증된다.
- 운영 배포 전 기존 게시글 readback, 공개 HTML, 관리자 편집, 수집 승격, 브라우저 회귀와 DB rollback rehearsal 증거를 남긴다.

범위 밖:

- 수집 raw HTML을 공개 게시글에 그대로 저장하거나 렌더링하지 않는다.
- 수집 검수 전 block 구조를 폐기하지 않는다.
- M0 Core 운영 인수 중인 release에 끼워 넣어 배포하지 않는다.

## 5. 추가로 확정할 항목

2026-09-27 대조. 정책 결정과 실제 계정 입력, 실검증 후 인수를 구분한다. 아래 미정 값은 추정하지 않으며 문서 작성만으로 실행을 승인하지 않는다.

| 시점 | 사용자 결정·확인 | 구분·현재 상태 | 확정 결과를 쓰는 작업 |
| --- | --- | --- | --- |
| 실장비 인수 전 | 수집 장비·OS·가동 시간·재시작 담당 | QD-05 결정 필요. 현행은 별도 장비, RPi4는 후보. 서버 통합·캐시·4GB 증설 연구는 미승인·미적용 | OPS-04, P1-03/07 |
| 외부 시험 전 | 사용할 Drive 계정·종류·남은 용량·전용 폴더, 비운영 DB/R2/Drive 시험 영역 | QD-06 실제 대상 지정·입력 필요. DB 백업 공급자를 Drive로 정한 결정은 유지 | OPS-03/04·COL-04 |
| 실제 업무·배포 전 | 운영자 인수 시간, 운영 반영 범위/시점, 백업 전환과 7일 관찰 담당·시작일 | QD-01/08 실행 일정·인수 필요. 사용자만 서버/백업 관리, 공동 운영자는 게시물 업무 | OPS-01~05·P0-05 |
| 출처별 실검증 후 | 첫 M0 적용 source/방식/config 목록 | QD-07 조건부 인수. 검증된 출처만 포함하며 S1~S5 증거가 없는 후보는 활성화하지 않음 | COL-03·A08 |
| 수집/Drive 활성화 전 | 실제 처리 항목·계약 대조와 고지 검토 후 시행 시점 | QD-04 고지 인수 필요. 정책 7일/28일·최소 중복 키 무기한은 확정 | COL-03/04·OPS-03 |

**이미 확정된 사항:** QD-01 Core 우선 운영·수집은 검증 후 활성화, QD-02 최소 관리자/정식 검수 메뉴,
QD-03 API mailbox pull·runtime 읽기 전용 조회(설정 편집 UI 없음), QD-04 최초 검수/반려 후7일·미검수28일·최소 중복 키 무기한,
QD-06 DB 백업만 Drive·공개 전/공개 이미지와 첨부는 R2, QD-07 검증된 출처만 M0,
QD-08 사용자 OWNER/서버·백업 관리·공동 운영자 EDITOR/게시물 업무 및 기본 발행07:30/17:30 KST.
이 정책과 역할을 다시 결정받지 않는다. 구현은 로컬 완료, 실제 계정 적용과 운영 수용은 별도다.

**준비 입력:** 두 운영자 identity 매핑, Discord bot/guild/channel 연결, age 복구키 접근, 제한 역할/credential은
[운영자 준비 목록](operations/owner-setup-checklist.md#m0-design-inputs)의 기존 비공개 설정부터 확인한다.
Discord 채널 생성·사용자만 참여는 사용자 보고로 확인됐으며 다시 만들거나 친구를 초대할 필요는 없다.
법무 연락처·정책 v0.1도 기존 주입·발행 기록을 우선한다. 비밀 원문을 채팅·Git으로 받지 않는다.

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
- 다음 배포가 필요하면 [정책](operations/deployment-policy.md)과 [실행서](operations/deployment-runbook.md)에 따라 그 후보 SHA의 CI·digest·설정·현재 ledger에서 API010/Collector010 이행·이전 앱 호환성·최근18시간 이내 새 백업/복원·복귀 경로를 대조한다. V008에서 9월 20일 구 API는 readiness 503이고, 실제 운영 rollback·VM 재부팅은 아직 시험하지 않았다.

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
수동 인수·Access·원격 object 검증은 남아 있다. URL 입력/source 소유권은9/26 확정했고9/27 구현·로컬 검증했다. 9월 23일 운영에서는 검수 flag를 켜고 내부 service 조회·미리보기를 확인했으나 실제 MFA 화면 조작은 미실행이다.
[검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md)를 따른다.

**9월 23일 당시 P1-01 기록 / 9월 26일 M0-D02로 입력 설계 후속 확정:** 서비스 기획·수집 기획·보안·개발 명세의
현행 direct/legacy 경계를 정리했다. raw HTML 비공개 저장, 결과 조회/검수/queue 역할 분리,
원문 보존과 별도 발행을 실제 source·권한 SQL·OpenAPI와 대조했다. 보존 기간·고지 정합성과
당시 Web 입력/source 계약(QD-03/04)은 미확정이었다. 현재 M0-D01/D02 구현·로컬 검증은9/27 완료했고 실제 고지·운영 인수는 남아 있다.
[문서 정합성 결과](../worklog/2026-09-23/collection-contract-alignment/RESULTS.md)를 따른다.

| 순서 | 작업 | 확인할 결과 |
| --- | --- | --- |
| P1-01/02 | URL 입력 전달·source 소유권 계약과 실제 운영자 검수 인수 | API 외부 fetch·batch queue 무제한 쓰기 금지, MFA 검수·반려·선택 초안 이동, 자동 공개0 |
| P1-03 | 다른 PC batch→공유 비운영 DB/object→API 검수·승격 | 역할별 쓰기 거부·dry-run 콘텐츠/object 무저장·요청 quota 기록·DB/object hash/size·재시작 복구 |
| P1-04 | 실제 Discord Gateway/slash·확인·큐·완료 조회 | 권한·취소·만료·중복·실패를 실제 환경에서 검증 |
| P1-05 | 원본/첨부/report/queue·orphan 회수의 실제 인수 | 확정7일/28일, 로컬 D01 완료 이후 선택 백업·고지·제한 삭제/readback |
| P1-06 | 로컬 통제 검증 후 선택 출처 S1~S5·운영 인수 | 요청 통제·원문/이미지/파일/SNS·DB/object 증거, live/fixture 분리·차단 우회 없음 |
| P1-07 | Collector CI 해당 SHA 성공 후 지원 OS·별도 PC 확인 | 다음 SHA CI, macOS·Windows·Linux·별도 PC 실행 결과 분리 |

비운영 DB/object 제한 계정, Discord 테스트 대상, 실제 실행 PC/OS는 각 단계 전에 확인한다. 보존 기간7일/28일은 확정값을 적용한다.
기존 입력을 먼저 확인하며 비밀 원문은 기록하지 않는다. 차단 4개 출처를 임의로 완료/제외 처리하지 않는다.

### I. P2 운영 관찰과 개선

- Core 개시일부터 실제 7일 예약 실패·알림·백업·용량·오류·권리 요청 대응을 기록한다.
  수집 관찰은 해당 기능 활성화일부터 별도로 시작한다.
- 관리자 개선은 수동 인수의 시간·재작업·왕복 수로 우선순위를 정한다.
- source별 수집 품질, 새 VM/미디어 복구 훈련, 실제 보존기간 회수, 필요 시 CD 개선을 진행한다.
- 완료: 실제 기간의 관측 기록과 미해결 항목. fixture 시간 전진으로 관찰을 대체하지 않는다.


## 9. 차단된 4개 출처의 재개 조건

2026-09-26 결정으로 미검증 출처의 재개는 후속 후보 작업이다. 아래 조건을 모두 해결해야 M0를 마감할 수 있다는 의미가 아니다. M0는 검증된 적용 출처 목록의 수용 증거로 판정하며 세 출처 재분석 task의 보류 상태를 유지한다.

| 출처 | 직전 실제 관측 | 재개 조건 |
| --- | --- | --- |
| fmkorea | HTTP 430 보안 응답 | 허용된 공개 응답 또는 공식 수집 경로 확보 |
| ppomppu | 302 이동 뒤 HTTP 403 | 공개 접근 허용 또는 공식 경로 확보 |
| pgr21 | Anubis 연결 확인, 상세 접근 차단 | challenge 없는 허용된 공개 본문 응답 확보 |
| youtube-community | HTTP 200이나 게시글 renderer 없이 responseContext만 존재 | 공개 게시글 renderer가 있는 실제 URL 또는 허용된 데이터 경로 확보 |

조건이 바뀔 때 해당 출처만 제한적으로 재검증한다. 차단 우회·generic parser 대체로 성공 처리하지 않는다.
fixture 구현 가능성, 실제 fetch, DB 저장, object readback 상태를 각각 기록한다.


## 10. 기존 전환 조건의 보존

이전 Spring/legacy 전환의 미체크 항목은 [당시 수용표](../worklog/2026-09-08/core-spring-acceptance/acceptance.md)에
남아 있다. S2-04/05, S4-03, S5-01/03, S6-05, S7-01~06의 실제 계정·Keychain·종료/절전·외부 연동·drain·관찰 조건을
디렉터리 이동만으로 완료/폐기하지 않는다. 현행 direct 적용 범위는 P1 기술 계약과 대조하고 필요 시 별도 결정한다.
과거 설계의 제약을 새 경로에 무조건 적용하지도 않는다. [전환 관찰 양식](operations/collector-transition-observation.md)은
legacy 전환 조건을 포함하며 Core 실제 운영 관찰과 구분해 사용한다.

## 11. 갱신 규칙

- 이 파일은 앞으로 할 일·완료 조건·결정 대기 항목의 단일 진입점이다. 실제 결과는 worklog에 기록하고 status.md에서 요약한다.
- 단계 완료는 해당 범위의 source/test/runtime/운영 증거로 판단한다. 파일 이동·commit·원격 추적 동기화만으로 완료 처리하지 않는다.
- 과거 세 계획서는 당시 근거로 보관한다. [기존 실행 계획](../worklog/2026-09-23/m0-planning/next-plan.md),
  [기존 잔여 과정](../worklog/2026-09-23/m0-planning/remaining-process.md), [기존 수집 후속](../worklog/2026-09-23/m0-planning/collector-follow-up.md).


## M0-D06 구현 인계

[결정→문서→기존 task→검증 대응표](implementation-tasks/README.md#m0-design-handoff)를 따른다. 신규 기능 설계 완료는 M0 구현·운영 수용 완료가 아니다. 계정 종류·용량·장비·Discord 연결값은 [실연동 전 입력](operations/owner-setup-checklist.md#m0-design-inputs)으로 분리한다. COL-REANALYZE-01은 대기 유지하고 PGR21은 추가하지 않는다.
