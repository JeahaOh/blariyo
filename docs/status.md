# M0 현재 진행 상황

- 2026-10-09 이미지 정책 변경: direct 수집의 HTTP·HTTPS/외부 CDN 이미지 허용, 이미지 오류의 글 단위 격리, 이미지 호스트별 영속 대기 코드를 보완했다. 검증 결과와 운영 반영 여부는 [작업 기록](../worklog/2026-10-09/image-source-policy/README.md)을 따른다. 개발 배치 자동 실행은 중지 유지하며 운영 적용은 별도다.


- 2026-10-08 Discord 검수 로컬·운영 반영: main `f8067ab`, API V014·Collector V015, 공통 승인/반려/발행 명령·관리자 우선권·비동기 삭제 복구·Java worker를 활성화했다. 실제 운영 수집 1건이 헤드와 본문 4개 메시지로 전송돼 READY/48시간·봇 반응만 존재·미발행을 확인했다. 수집04:30/15:30, 검수07:30/17:00 KST 예약 enabled/active. 첫04:30 정기 실행·사람의 운영 승인/발행·실시간48시간 만료 관찰은 아직 미실행이다. [배포·실연동 근거](../worklog/2026-10-08/discord-review-deployment/README.md).

- 2026-10-06 AI 품질 도구: 공통 lint·검증 입력/결과 기록·정책 약화 검토·선택 Oxlint 규칙을 구현했다. iron-laws는 검토 보조다. 도입 검증과 실제 변경 관찰의 완료 여부는 [현재 실행 기록](../worklog/2026-10-06/ai-quality-adoption/README.md)을 따른다. 원격 CI·배포·운영 수용을 뜻하지 않는다.

- 2026-10-06 수집 요청 정책 변경: robots 자동 조회/차단 제거, 기본 요청 간격5초·출처별 일일5000 HTTP 요청, Collector V015 Retry-After 영속 대기·일시 장애의 이미지 삭제 제외를 구현했다. 로컬21개 source 설정도300→5000회·10→5초로 변경했다. Collector296 tests·실제5개역할/backup-restore 검증 통과, 로컬V015 반영 전후 수집85·게시글117건 보존. 운영 반영·재수집·commit/push 미실행. [작업 기록](../worklog/2026-10-06/collector-request-policy/README.md).


- 2026-10-06 관리자 실패 삭제: FAILED/BLOCKED 미검수 항목의 단건/선택 삭제·공통 확인창·항목별 결과·동일 요청 재확인을 구현했다. Collector V014 제한 함수와 정확한 item/run 파일 정리, 기존 검수·게시글·활성 수집 보호를 검증했다. 로컬 schema/서버 반영, 실제 사용자 데이터 삭제·운영 배포·commit/push 미실행. [작업 기록](../worklog/2026-10-06/batch-failure-delete/README.md).


- 2026-10-05 이미지 실패 자동 처리: 목록·단건·queue에 글당 추가 재시도1회와 재실패 미검수 항목 삭제, 서버 파일 정리·중복 차단 구현. 로컬 기존6건 재시도 후 모두 재실패해 삭제, 파일 정리 대기0·대상 외 DB/파일 해시 보존 확인. [작업 기록](../worklog/2026-10-05/image-failure-retry-cleanup/README.md). 운영 배포·commit/push 미실행.

- 2026-10-05 제목 표기 보완: `| 보배드림 베스트글` 등 확인된 게시판/사이트 접미사4종 추가, 검수 목록·상세·초안에 공통 보정 적용. 원제목/출처 보존과 발행 제목을 Chromium16 tests·단위/계약2 tests로 검증, Web 빌드·타입/lint 통과 및 로컬 반영. [작업 기록](../worklog/2026-10-05/collection-title-labels/README.md). commit/push·운영 배포 미실행.

- 2026-10-05 로컬 검수 전 정리·재수집: 기존192건과 원문/첨부673개 백업 후 삭제, 승인47·반려7·게시글111 보존. 등록21개 출처 배치 실행을 마쳐 정상27건·실패9/차단1의 새 검수 전37건 적재. 원문37·첨부122개 해시, 목록/정상 상세 API·대표 이미지 미리보기 검증 통과. 미검증 목록·robots/접근 제한·파싱 오류·디시 HTTP 대기 정체는 [작업 기록](../worklog/2026-10-05/local-unreviewed-recollection/README.md)에 구분했다. 로컬 작업이며 운영 변경·발행·commit/push 미실행.

- 2026-10-05 검수 버튼 정렬: 제목 중앙 SVG 도움말, 필터 라벨/입력 grid 공통행과 조회44px, 상세 작업 버튼 입력칸 오른쪽 정렬, 안내 확인 버튼 규격 통일. 화면 폭5종의 도움말 중심·조회 위치/높이 검사 포함 Chromium19 tests·Web build/type/lint 통과, 로컬 반영. [작업 기록](../worklog/2026-10-05/batch-button-position/README.md). commit/push·운영 배포 미실행.


- 2026-10-05 검수 안내·상단 구성: 안내를 승인/반려 두 문장으로 줄이고 제목 옆 보조 도움말 아이콘으로 변경, 결과 건수를 목록 머리글로 이동, 필터 카드/여백 제거·입력/조회 정렬. Web 빌드·타입/lint·Chromium19 tests 통과, 모바일/데스크톱 화면 확인·로컬 반영 완료. [작업 기록](../worklog/2026-10-05/batch-help-layout/README.md). commit/push·운영 배포 미실행.


- 2026-10-05 수집 빈 화면: 미선택 상세 패널 제거·목록 전체 너비, 0건의 목록 제목/빈 리스트/페이지 제거, 단일 페이지 이동 숨김. Web 빌드·타입/lint 및 Chromium20 tests 통과, 390/1280px 화면 확인·로컬 반영 완료. [작업 기록](../worklog/2026-10-05/batch-empty-state/README.md). commit/push·운영 배포 미실행.


- 2026-10-05 수집 검수 후속: 웃대 EUC-KR 재파싱 깨짐 수정, 수동 목록 재조회 시 상세/주소 선택 해제, `승인 및 발행`으로 검수→초안→즉시 발행 연결, 공통 사용 안내 dialog 구현. Chromium26·Web 빌드/타입/lint 통과, Collector271 통과·DB 전제20 skip, 로컬 서버 반영. 기존 웃대 제목 깨짐6건의 DB 정정은 미실행이며 원문7건 재파싱 가능 확인. [작업 기록](../worklog/2026-10-05/batch-review-publish/README.md). commit/push·운영 배포 미실행.


- 2026-10-05 수집 항목 주소: 목록 선택 시 `/admin/batch?itemId=<UUID>`를 반영하고 새로고침·직접 링크·뒤로/앞으로 이동을 동기화했다. 별도 목록으로 버튼 제거. 브라우저24 tests·Web 빌드/타입/lint 통과, 로컬 반영 완료. [작업 기록](../worklog/2026-10-05/batch-detail-navigation/README.md). commit/push·운영 배포 미실행.

- 2026-10-05 공통 로딩바: 전체 화면의 페이지 이동·사용자 조회/저장/업로드에 상단3px 표시를 연결하고 자동 폴링을 제외했다. 공통 상태는 동시 작업과 화면 이탈을 처리한다. 브라우저52 tests(분리 실행·중복 제외), Web 빌드/타입 검사 통과, 로컬 서버 반영 완료. 기존 admin.vue lint1건은 유지. [작업 기록](../worklog/2026-10-05/global-loading-bar/README.md). commit/push·운영 배포 미실행.

- 2026-10-05 초안 제목 보정: 수집 결과에서 초안을 만들 때 제목 끝의 알려진 출처 표기를 제거한다. 원제목·출처 정보는 보존한다. 단위/계약2·API21·브라우저12 tests 및 API/Web 빌드 통과, 로컬 재시작 완료. [작업 기록](../worklog/2026-10-05/draft-title-source/README.md). 기존 초안 일괄 수정·commit/push·운영 배포 미실행.

- 2026-10-05 공통코드 그룹 전환: 출처 전용 관리를 `/admin/common-codes`의 공통코드 관리로 변경했다. `source` 그룹에 사용자 지정 thqo/pmpu/yldo/invn/dgdp/rlwb 포함21개4자리 코드를 이관하고 기존 수집 식별자는 연결 키로 보존한다. 그룹/코드 추가·이름 수정, API/DB29·브라우저14 tests, 제한5역할 및75테이블/16시퀀스 복원 통과. 로컬 API V013·서버·실화면 적용 완료. [후속 기록](../worklog/2026-10-05/common-code-groups/README.md). commit/push·운영 배포 미실행.

- 2026-10-05 검수 흐름 단순화: 검수 시작/다시 검수 버튼과 REVIEWING 중간 상태를 제거하고 상세에서 바로 승인·반려하도록 변경했다. API/DB 회귀42 tests·브라우저13 tests·실제5역할 검사 통과, 로컬 DB V011 및 서버 재시작·실화면 확인 완료. [구현·검증 기록](../worklog/2026-10-05/batch-direct-decision/README.md). 기존 검수 데이터는 보존하며 commit/push·운영 배포는 미실행이다.

- 2026-10-04 후속 정책: 신규 수집과 만료 원문 회수를 독립 실행하도록 로컬 정책·코드를 변경했다. Collector289·보존/회수/Web 통합23 tests PASS. backlog 전역 차단 제거와 회귀 검증은 [작업 기록](../worklog/2026-10-04/collection-retention-independence/README.md), 운영 적용·만료8건 처리·실제 재수집은 별도 증거로 구분한다. 아래 과거 검증 결과를 이번 변경의 통과로 재사용하지 않는다.

- 문서 갱신: 2026-09-30. Git 반영 현황을 갱신했으며 운영 관측 날짜는 각각의 증거를 따른다. [사용자 결정·입력](roadmap.md#5-추가로-확정할-항목) → [잔여 작업](roadmap.md#1-다음-시작점) 순으로 확인한다. 로컬 구현과 운영 인수의 오래된 상태 표기를 동기화했고 [갱신 검증](../worklog/2026-09-27/m0-status-refresh/README.md)에 범위를 기록한다.

- 개발 데이터 부분 적재 완료: [로컬 준비 도구의 최신 DB 권한·ledger 출력 정렬](implementation-tasks/contracts-maintenance.md#로컬-준비-도구-후속--2026-09-27-문서-대조)을 보완하고 격리 권한 시험과 개발 DB API010/Collector010 적용을 확인했다. 사용자 요청에 따라 21개 사이트를 판정해 5개 사이트의 신규 31건·이미지 70개를 개발 서버에 공개했다. 16개 사이트는 차단/실패이며 기존 글 75건을 보존했다. [실행 결과](../worklog/2026-09-27/dev-21-site-publish/README.md).

- 2026-09-27 M0 로컬 코드: UX-01~06·보존/회수·mailbox/4개API/입력UI·robots/quota/redirect·선택백업/Drive 도구·OWNER/EDITOR를 구현했다. API010/Collector010이며 운영 migration을 적용했다는 뜻이 아니다.
- 로컬 검증: API 실DB30 files/130 tests·서비스35·Collector289·공통34 PASS, 실제5역할73table/16sequence 복원·PG18/age 선택복원53보존/17제외·과거full008/006→010/010·Docker API/Web PASS. 실제 Chromium52와 범위·자원 감사까지 통과해 로컬 구현·검증·운영 인계를 완료했다. 상세는 [완료 조건 감사](../worklog/2026-09-27/m0-implementation/COMPLETION-AUDIT.md)에서 판정한다.
- 다음 실제 작업: [운영 인계](operations/m0-operation-handoff.md)의 계정/장비·허용 출처·법무·비운영 대상 입력을 확인한 뒤 별도 승인된 범위로 인수한다. M0 구현은 `f1fc07d`, 개발 데이터 적재 보완은 `3c3902b`에 커밋됐다. 9/30 원격 feature `578c058` 반영을 확인했으며 release 통합·검증·원격 반영은 `53873d0`에서 완료했다. [Git 정리 실행 기록](../worklog/2026-09-30/git-cleanup-execution/README.md)을 따른다. 운영 배포 완료를 뜻하지 않는다.
- 범위 경계: GA4·광고·legacy 기본 OFF. 사용자 승인된 개발 데이터 수집 요청은 별도 실행했고 Drive/R2/Discord 전송·운영 삭제·설치는 미실행. 실제 운영 담당은 사용자(OWNER)다. OWNER/EDITOR 역할의 Access 허용·거부·회수 검증, 출처 S1~S5·Core7일과 CON-01 조건부 항목은 남아 있다.

- **전체 판정: 부분 완료. 9월 25일 `8af7244` 앱 배포·GTM 실제 로딩과 9월 26일 공개 HTTP에서 robots·사이트맵·일부 noindex와 GTM HTML 삽입을 확인했다. 실제 운영자 인수와 수집 실연동·계약은 남아 있다.**
- 마지막 공개 HTTP 점검: 2026-09-26 소스·정본 대조 및 16:39 KST 이후 공개 GET. 현재 서버 image digest·DB·백업·원격 CI는 재조회하지 않았다. DB·콘텐츠 전수 검증은 9월 23일, 최근 앱 배포·GTM 로딩은 [9월 25일 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)으로 구분한다. [운영 상태](operations/current-status.md)와 [오늘 점검 근거](../worklog/2026-09-26/m0-progress-audit/EVIDENCE.md)를 따른다.
- Git 확인: 2026-09-30 통합 `53873d0`을 일반 push했고 local/origin release 동일·이력 차이0/0을 서버 조회로 확인했다. local/origin main은 `8af7244` 유지. 마감 기록과 종료 브랜치 정리는 [실행 결과](../worklog/2026-09-30/git-cleanup-execution/README.md)를 따른다. 별도 파비콘8파일은 `feature/brand-favicon@3f35388`에 보존했고 Web/HTTP 검증과 기존 작업의 유실 재검토를 완료했다. 기존 feature 마감·최종 release 반영 절차는 [후속 기록](../worklog/2026-09-30/favicon-release-preservation/README.md)을 따른다. 별도 m0-core의 미커밋88파일은 보존한다. [9/26 기록](../worklog/2026-09-26/m0-progress-audit/STATUS-SYNC.md)은 당시 증거로 유지한다.
- 과거 전체 goal의 `blocked` 기록은 당시 선행 조건 판단이다. 현재 도구 상태나 기능 폐기를 뜻하지 않는다.
- 상세 실행 순서는 [잔여 과정](roadmap.md), 실제 커밋 식별자는 [진행 보관·커밋 기록](../worklog/2026-09-23/progress-checkpoint.md)을 따른다.
- 9/26 최종 결정: 운영 DB 백업만 Google Drive로 전환하고 공개 전·공개 이미지/첨부는 기존 R2를 유지한다. [백업 전환 조건](planning/02-infra-plan.md#6-데이터와-저장소-원칙)의 실제 계정·운영 전환은 잔여다. 로컬 전환 도구·실제 age/격리DB 복원은 위9/27 증거를 따른다. 에펨코리아·뽐뿌·유튜브 커뮤니티 [재분석 task](../worklog/2026-09-26/collection-source-reanalysis/README.md)는 생성 완료·분석 대기다.

## 완료 범위와 남은 조건

| 작업 | 현재 완료 범위 | 남은 조건 |
| --- | --- | --- |
| Core 관리자 P0-01~03 | 최소 화면·검색·오류 복구·저장 결과 확인·인증 실패 뒤 동일 요청 보존 | 실제 운영자 사용성·Access 인증 확인 |
| 로컬 실행 P0-04 | 격리 실행기의 예약·이미지 회수 worker, 중복 소유 방지·재시작·실패 복구와 실제 시각 검증 | 운영자가 직접 수행하는 인수 12건 |
| CI A-1/P1-07 | Java fixture·Collector job·로컬 macOS/Linux 재현. SHA `8af7244`의 원격 verify/collector/API·Web images 성공·digest 확인 | 다음 후보 SHA의 원격 CI·digest 확인, Windows·별도 PC 검증 |
| Direct 검수 P1-02 | 정식 메뉴·필터·검수/반려·초안 이동·불확실 응답 복구. 9/23 운영 검수 flag ON, 내부 service 108건 조회·16개 출처 미리보기 | 실제 MFA 운영자 화면 조작·Access·원격 object 인수. QD-04 보존·고지 별도 |
| 사이트 모듈 P1-06 | 21 adapter·21 상세·19 목록 parser 분리, 기존 결과 보존 | 검증된 M0 적용 목록의 실제 수용 증거. 요청 통제는9/27 로컬 검증 완료. 차단·미검증은 후속 후보이며 전체 21개 통과 조건 아님 |
| 문서 정합성 P1-01 | D01~D03의 direct/legacy 저장·권한·검수 규칙 정렬 | QD-03/04 실제 고지·운영 인수, legacy API/DB 본문 상한 1000/40 불일치 |
| 배포·DB 반영 P0-05 | 9/25 `8af7244` API/Web 교체·GTM 로딩·새 백업 복원·timer 재개 확인. API V008·Collector V006 유지. 9/23 게시글 74·이미지 308 공개·전수 readback | 실제 MFA 작성/업로드/발행/숨김·예약/알림 인수, 다음 후보별 호환성·백업·복귀 확인. 실제 rollback·재부팅 미검증 |
| 검색엔진 설정·GTM 공개 반영 | 9/26 robots 앱 규칙·사이트맵 XML·API/health noindex·공개 HTML의 GTM 삽입 확인 | 현재 배포 SHA/digest, 비공개 글 제외 전수 대조·검색 색인, GTM 실제 태그·동의·공개 정책·GA4 수신 검증 |
| 수집 실연동 P1-03~05/07 | 로컬 코드·격리 증거와 실행서 준비 | 다른 PC/Windows·비운영 DB/object·Discord·보존 회수 실제 인수 |
| 운영 관찰 P2 | 관찰 조건 정의 | 실제 운영 개시 후 7일 기록 |

## 분석 확장 analytics-v1 — 2026-09-25 명세 확정

- [개발 명세 §13](development-specs/m0-core/analytics-consent/analytics-consent.dev.md#analytics-v1)에 첫 수동 이벤트
  9개·필드·발생 조건·동의 version3·직접 GA4 단일 전송·BigQuery 일별 저장과 기본 집계를 확정했다.
- 기획·API/아키텍처/보안 설계·법무 편집 초안을 동기화했다. 운영 법무 값과 원시·집계 보관·비용은 미정이다.
- 콘텐츠 키·확장 계측·OpenAPI/타입·동의v3는 [9/25 구현 기록](../worklog/2026-09-25/analytics-v1/RESULTS.md)의 범위로 구현됐으며, 9/30 release 통합에서 동의 오류 복구·공유 결과 처리와 함께 로컬 회귀 검증했다.
- GTM 동일 목적지 태그 중지, GA4/BQ 콘솔 설정·실제 수신·확장 버전 운영 배포는 미실행이다. 로컬 구현·시험을 운영 수집 활성화 완료로 승계하지 않는다.

## Google Tag Manager — 2026-09-25 운영 반영

- `GTM-5BRTQ5T3` script를 `<head>` 맨 앞에, `noscript` iframe을 `<body>` 바로 뒤에 삽입했다.
- CSP nonce·GTM origin 허용과 기존 GA4 adapter의 공용 `dataLayer` 보존을 반영했다.
- 로컬 Web build·타입·lint, 단위 5건·HTTP 4건·동의 Chromium 검사 통과. 최초 CI #14의 네트워크 기대값 실패를 보완하고 전체 Chromium 41/41을 통과했다([CI 보완](../worklog/2026-09-25/google-tag-manager/CI-FIX.md)).
- `8af7244`의 CI #15 성공 후 01:47:24 KST API/Web을 교체했다. 운영 HTML의 삽입 위치·nonce, 실제 Chrome의 GTM script HTTP 200·1회 요청·컨테이너 초기화·시작 이벤트를 확인했다.
- 로컬 검사의 Google 응답은 대체 응답이고, 위 운영 검사는 실제 요청이다. Tag Assistant 태그별 실행·GA4 이벤트 수신·GTM 콘솔 동의 조건·공개 정책 대조는 미검증이다.
  [운영 배포 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md), [초기 구현 기록](../worklog/2026-09-25/google-tag-manager/RESULTS.md)을 구분한다.
- 9월 26일 후속 공개 GET에서 `/meme` HTML의 `GTM-5BRTQ5T3` 삽입과 `ga4Enabled:false`를 확인했다.
  HTML 반영 증거이며 실제 script 로드·태그 실행·동의/철회 network·GA4 수신·법무 검토 완료는 아니다.
  GTM 내부 태그가 GA4 feature flag에 따라 비활성이라고 가정하지 않는다. [공개 관측과 한계](operations/current-status.md#공개-http-후속-확인--2026-09-26).

<a id="검색엔진-설정--2026-09-24-로컬-변경"></a>

## 검색엔진 설정 — 2026-09-25 운영 반영

- `robots.txt` 경로 수집 규칙과 관리자·API·내부·health 경로 Web 응답의 `noindex`, 분할 사이트맵 자동 생성 구현.
- [사이트맵 계약](system-design/05-security-operations.md#사이트맵-자동-생성): 파일당 최대 1만 건, 5분 process cache,
  공개 상태 필터, 본문·이미지 조회 없음. DB migration 없음.
- [단위 검사](../apps/api/test/sitemap.service.test.ts)와 [PostgreSQL→빌드 Web 통합 검사](../apps/api/test/sitemap-http.integration.test.ts)에서
  공개 10001건의 10000/1 분할·중복 없음, 비공개 제외, TTL·동시 생성·오류·GET/HEAD·noindex 경계를 검증했다.
- API/Web build·lint와 Web typecheck 통과. 검색엔진 설정은 9/25 배포한 `8af7244`에 포함됐다. 실제 검색엔진 색인·노출과 대규모 운영 부하는 미검증이다.
- 커밋 전 CI 사전 검사: 기존 build 산출물이 없는 사본에서 Node 24.18.0의 `npm ci`, Java 25 fixture 준비,
  API/Web·API test build, scripts/tests 타입·lint, Web typecheck, 루트 테스트 33건·PostgreSQL 18 통합 95건·
  Chromium 41건이 통과했다. 통합 범위는 CI와 같은 schema-restore 제외이며 실패·skip 0건이다.
- Dockerfile의 Linux amd64 build stage와 사이트맵 단위 4건·DB→Web 통합 1건도 통과했다.
  [CI 테스트 진입점](../tests/sitemap.test.ts)을 추가해 사이트맵 단위 검사를 `npm test`에 포함했다.
  원격 GitHub Actions·Collector 전체 job·이미지 게시 결과를 대신하는 검증은 아니다.
- 후속 원격 확인: SHA `1531cf118a39470c616277ac06e3d8aeeb4b8df7`의
  [CI #13](https://github.com/JeahaOh/blariyo/actions/runs/36015059290)이 8분 30초에 성공했다.
  `verify`·`collector`·API/Web `images`와 artifact 5개, 사이트맵 단위 4건·DB→Web 통합 실행을 확인했다.
  이미지 게시 완료이며 운영 서버 교체 증거는 아니다.
- 2026-09-24 23:59~09-25 00:01 KST 운영 읽기 전용 확인: `/meme`와 CSS·JS 표본은 200,
  공개 목록의 canonical은 `https://blariyo.com/meme`이고 noindex는 없었다. 실제 브라우저 목록도 정상 표시됐다.
- 같은 확인에서 `/robots.txt` GET·HEAD는 200이지만 Cloudflare 관리 규칙만 있고 앱의 경로 제외·Sitemap 안내는 없었다.
  `/sitemap.xml` GET·HEAD와 `/sitemap-pages.xml`·`/sitemap-posts-0.xml` GET은 404 HTML이었다.
  당시에는 사이트맵 XML·앱 robots 규칙의 운영 반영을 확인하지 못했고, 공개·비공개 URL의 사이트맵 포함 여부도 확인할 수 없었다.
- `/api/v1/boards`·`/health/live` GET은 200이지만 `X-Robots-Tag`가 없었다. `/admin`은 Access 로그인으로 302,
  `/internal`은 Nginx 404, `/__gateway_health`는 Nginx 200이며 이 응답들에도 해당 header가 없었다.
  Access·Nginx가 직접 반환하는 응답은 Web middleware를 거치지 않으므로 앱 배포 후에도 계층별 재확인이 필요하다.
  해당 점검에서 서버 image digest·DB 상태·검색엔진 실제 색인 상태는 조회하지 않았다.
- 9/25 `8af7244` 배포 후 공개 robots·사이트맵 XML, 일반 페이지 3개·공개 게시글 74개 및 대표 상세 200을 확인했다([배포 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md)).
- **2026-09-26 후속 확인:** `/robots.txt`에 앱 경로 제외·Sitemap 안내가 있고, 사이트맵 인덱스와 하위 XML 2개가 모두 200이었다.
  페이지 XML의 URL은 3개, 게시글 XML은 74개이며 `/api/v1/boards`·`/health/live` 응답에는 `X-Robots-Tag: noindex`가 있었다.
  공개 응답 반영을 확인했으므로 위 9/24~25 미반영 관측을 현재 상태로 재사용하지 않는다.
  현재 DB와 공개/비공개 글 전수 대조, 실제 색인·부하, `/admin`·`/internal`·`/__gateway_health`의 최신 응답은 미검증이다.
  [운영 관측](operations/current-status.md#공개-http-후속-확인--2026-09-26)에서 배포 식별자·내부 상태의 한계를 구분한다.

## CI 액션 런타임 정비 — 2026-09-25 CI 실행 확인

- CI #13의 Node 20 경고 원인인 `upload-artifact` 3곳과 Docker 액션 3곳의 고정 SHA를 갱신했다.
  공식 release는 upload-artifact `v7.0.1`, setup-buildx `v4.4.1`, login `v4.6.0`, build-push `v7.4.0`이다.
- 공식 tag→전체 SHA와 해당 `action.yml`을 대조했다. CI·backup-restore workflow의 전체 7종 액션은
  `runs.using: node24`이고 현재 입력·필수 입력·build digest 출력이 호환된다. upload-artifact의 ZIP 기본값도 유지된다.
- `actionlint v1.7.12`의 workflow 2개 검사와 YAML 구조 대조 통과. 액션 SHA 외 job·권한·실행 명령·입력 변경은 없다.
  변경을 포함한 `8af7244`의 CI #15는 verify·collector·API/Web images가 성공했다. backup-restore workflow의 갱신 후 실행과 전체 로그의 경고 0건 여부는 별도 미검증이다.

## 검증 근거

아래 실행들은 서로 다른 시점·환경의 증거다. 중복 합산하거나 후속 문서 갱신에서 다시 수행했다고 표시하지 않는다.

| 범위 | 확인된 결과 | 원본 |
| --- | --- | --- |
| Core 통합·실제 실행기 | 통합 93+복원 재실행1, 실행기 업무12+worker4, 전체 Chromium28 후 영향17/복구8 | [Core 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md) |
| Collector 분리 | 비교40 일치, Java273/273·Core 연동5/5 | [사이트 분리](../worklog/2026-09-23/collector-site-modules/RESULTS.md) |
| Collector CI 로컬 재현 | macOS273·Linux Docker arm64 273 각각 통과 | [CI 결과](../worklog/2026-09-23/collector-ci/RESULTS.md) |
| Direct 검수 | API15·관련 Chromium27, 320/1280px·DB/private object 대조 | [검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md) |
| Core 이미지 후보 | V005에서 후보/이전 앱 업무 및 복귀 통과; V008에서 이전 앱 readiness503 확인 | [후보 식별·호환 행렬](../worklog/2026-09-23/release/candidate.md) |
| 원격 CI·배포 | SHA `8af7244` CI #15 성공·API/Web digest 교체·실제 GTM 로딩·새 백업 복원·공개 smoke | [9/25 앱 배포 기록](../worklog/2026-09-25/google-tag-manager/PRODUCTION-DEPLOYMENT.md) |
| DB·공개 | API V008·Collector V006, 74 게시글·308 이미지·108 수집 항목 반영. 목록/상세·이미지 전수 대조, 전후 백업 복원 | [DB·콘텐츠 반영 기록](../worklog/2026-09-23/release/production-db-promotion.md) |
| 9/23 커밋 준비 당시 | Node24 루트 검사29/29, 실패·생략0 | [진행 보관 기록](../worklog/2026-09-23/progress-checkpoint.md) |
| 9/26 공개 HTTP | 인증 없는 GET 7개 200, robots·사이트맵·일부 noindex·GTM HTML 반영. 내부 운영·브라우저 실인수 제외 | [점검 근거](../worklog/2026-09-26/m0-progress-audit/EVIDENCE.md) |

요구사항 집계는 9월27일 로컬 구현을 반영한 [40개 대조표](development-specs/requirements-status.md)의 **I32/P8/U0**다. 주요 구현 확인32/40(80%)이며 개발 공수·출시 준비율이 아니다. 남은 부분 항목은 C16·A08·B07·O02·O05~O08이다. 실제 운영 인수와 조건부 legacy 작업은 [로드맵](roadmap.md#1-다음-시작점), 17개 task의 현재 상태는 [구현 목록](implementation-tasks/README.md)을 따른다.

## 재개 순서와 입력

1. 운영자가 준비된 [격리 인수 환경](testing/operator-acceptance.md)에서 반복 업무 12건을 수행하고 혼동·재작업·실패를 기록한다. 별도로 승인된 운영 콘텐츠 범위에서 실제 Access MFA 세션의 작성·업로드·발행·예약·취소·숨김을 인수한다. 인증 비밀은 전달하지 않는다.
2. 운영 담당이 현재 release·flag·DB ledger·백업/timer·공개 API를 먼저 읽기 전용으로 재조회한다. 그 결과에 따라 별도 운영 시나리오에서 예약 실행·알림 실수신·복귀 가능성을 검증한다. 다음 배포에는 최근 18시간 이내 백업·복원 증거가 필요하며, 9월 25일 배포 전 백업과 과거 공개 수량을 다음 배포의 현재값으로 재사용하지 않는다.
3. 다음 코드 배포가 필요하면 [배포 실행서](operations/deployment-runbook.md)에 따라 그 후보 SHA의 원격 CI·digest, 현행 운영 ledger에서 API010/Collector010으로의 이행·이전 앱 호환성, 최신 선택 백업·복원 및 복귀 경로를 새로 대조한다. V008에서 9월 20일 구 API는 readiness 503이다.
4. 9/26 최종 결정: 이미지·첨부·원문 HTML·본문은 검수 완료·반려 후 7일 삭제, 미검수는 수집일부터 28일, 중복 방지용 최소 식별자는 무기한 보관한다. 검증된 출처만 M0 범위다. QD-03 초기 출처 설정은 개발자 설계 위임을 유지하고 QD-03/04의 기술 계약은 [설계 인계](implementation-tasks/README.md#m0-design-handoff)로 확정했으며 회수 구현·로컬 검증은9/27 완료했고 실제 고지·운영 회수 인수는 남아 있다. 사용자가 서버·백업을 관리하고 친구는 게시물 권한만 갖는다. Discord 채널은 사용자 보고로 생성 완료·현재 사용자만 참여하며 실연동·수신은 미검증이다. 수집 장비는 Raspberry Pi 4 후보로 실연동 전 선택한다. [최신 결정](../worklog/2026-09-26/m0-completion-plan/README.md#retention-scope-roles-20260926)을 따르며, 문서 반영을 운영 적용 완료로 해석하지 않는다.
5. direct의 robots/Crawl-delay·영속 일일 budget·redirect 최대3회는9/27 구현·로컬 검증했다([코드 대조 근거](system-design/07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조)). 비운영 DB/object·Discord 시험 대상과 실행 PC/OS가 정해지면 다른 PC batch·원격 권한·Gateway를 실연동한다. 출처별 활성화와 실제 7일 관찰은 별도다.

## 보존된 로컬 자원

- 준비된 인수 sandbox: `.local-data/admin-sandbox-eecd0319a964` (준비 당시 서버 종료; 재개 시 가동·포트 상태 확인).
- 과거 로컬 이미지 후보: `.local-data/release-preparation/blariyo-app-images-20260923T124646Z-ij42qk3e/` (V005 권고 시점의 후보이며 9/23 운영 release 식별자로 재사용하지 않음).
- 비공개 runtime 설정 사본: `~/.config/blariyo/application-config-ZzkcSI/` (실값은 커밋하지 않음).
- 9월 23일 커밋 준비 당시 검사 원본은 Git 제외 `test-results/`에, 당시 원본·diff 백업은 `.local-data/commit-preparation/`에 보존했다. 이번 문서 갱신의 테스트 실행 기록은 아니다.
- 위 로컬 파일 경로는 다른 PC에서 자동 복원되지 않는다. Git 문서·코드와 비공개 실행 자원을 구분한다.

## M0 기존 설계 보완 — 2026-09-26

M0-D01~D06의 보존/삭제·Web mailbox·Drive 백업·역할·출처 편입 계약을 [인계표](implementation-tasks/README.md#m0-design-handoff)로 연결했다. [문서 검증](../worklog/2026-09-26/m0-design-completion/README.md)과 구현/운영 증거를 구분한다. 9월26일 설계 단계에서는 애플리케이션 source·migration·실행 계약 사본을 변경하지 않았다. 이후9월27일의 미커밋 구현·검증과 집계는 이 문서 상단을 따른다. 출처 편입 확정을 입증하는 증거는 현재 없고, 17개 로컬 성공 이력도 운영 통과가 아니다. 독립적인 UX 작업은 병행할 수 있다.

## M0.5 body-html 후속 결정 — 2026-10-04

운영 게시글 저장 구조를 `TEXT/IMAGE block`에서 `body_html` 단일 본문과 image reference 검증으로 전환하는 후속 작업을 [로드맵](roadmap.md#45-m05--게시글-본문-html-저장-구조-전환)에 등록했다. 수집 원문·검수 화면은 block 단위 보관·표시를 유지하고, 검수 승인 또는 수동 작성 저장 시점에만 게시글 HTML로 변환하는 방향이다. 이 항목은 구현·migration·배포 완료가 아니며, 현행 M0 운영 인수 release에는 적용하지 않는다.
