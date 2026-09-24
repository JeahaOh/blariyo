# M0 현재 진행 상황

- **전체 판정: 부분 완료. SHA `5c581c2`의 CI·API/Web 운영 배포와 9월 23일 DB·콘텐츠 공개는 당시 검증됐고, 실제 운영자 인수와 수집 실연동·계약은 남아 있다.**
- 갱신: 2026-09-24 문서 대조. 아래 운영 수량·release는 [9월 23일 운영 상태 기록](operations/current-status.md)의 관측값이며, 이번에 서버·DB·CI를 재조회하지 않았다.
- Git 확인: 2026-09-24 로컬 HEAD `82c0ba9`, `main`이 로컬 `origin/main` 추적 참조보다 5커밋 앞섰다([대조 근거](../worklog/2026-09-24/documentation-refresh/EVIDENCE.md)). 이는 원격 현재 상태 확인이 아니다.
- 과거 전체 goal의 `blocked` 기록은 당시 선행 조건 판단이다. 현재 도구 상태나 기능 폐기를 뜻하지 않는다.
- 상세 실행 순서는 [잔여 과정](roadmap.md), 실제 커밋 식별자는 [진행 보관·커밋 기록](../worklog/2026-09-23/progress-checkpoint.md)을 따른다.

## 완료 범위와 남은 조건

| 작업 | 현재 완료 범위 | 남은 조건 |
| --- | --- | --- |
| Core 관리자 P0-01~03 | 최소 화면·검색·오류 복구·저장 결과 확인·인증 실패 뒤 동일 요청 보존 | 실제 운영자 사용성·Access 인증 확인 |
| 로컬 실행 P0-04 | 격리 실행기의 예약·이미지 회수 worker, 중복 소유 방지·재시작·실패 복구와 실제 시각 검증 | 운영자가 직접 수행하는 인수 12건 |
| CI A-1/P1-07 | Java fixture 준비·Collector job·로컬 macOS/Linux 재현. SHA `5c581c2`의 원격 verify/collector/API·Web images 성공·digest 확인 | 다음 후보 SHA의 원격 CI·digest 확인, Windows·별도 PC 검증 |
| Direct 검수 P1-02 | 정식 메뉴·필터·검수/반려·초안 이동·불확실 응답 복구. 9/23 운영 검수 flag ON, 내부 service 108건 조회·16개 출처 미리보기 | 실제 MFA 운영자 화면 조작·Access·원격 object 인수. QD-04 보존·고지 별도 |
| 사이트 모듈 P1-06 | 21 adapter·21 상세·19 목록 parser 분리, 기존 결과 보존 | direct robots/Crawl-delay·영속 일일 budget·redirect 상한 보완, 누락 실제 표본·차단 4개 재개 조건 |
| 문서 정합성 P1-01 | D01~D03의 direct/legacy 저장·권한·검수 규칙 정렬 | Web 입력/source 변경 권한 QD-03, 보존·고지 계약 QD-04, legacy API/DB 본문 상한 1000/40 불일치 |
| 배포·DB 반영 P0-05 | 9/23 `5c581c2` CI·GHCR digest→API/Web 배포, API V008·Collector V006, 게시글 74·이미지 308 공개·전수 readback, 전후 백업 다운로드·격리 복원 | 현재 상태 재조회, 실제 MFA 작성/업로드/발행/숨김·예약/알림 인수, 다음 배포 후보별 호환성·백업·복귀 확인. 실제 rollback·재부팅 미검증 |
| 수집 실연동 P1-03~05/07 | 로컬 코드·격리 증거와 실행서 준비 | 다른 PC/Windows·비운영 DB/object·Discord·보존 회수 구현/검증 |
| 운영 관찰 P2 | 관찰 조건 정의 | 실제 운영 개시 후 7일 기록 |

## 검증 근거

아래 실행들은 서로 다른 시점·환경의 증거다. 중복 합산하거나 9월 24일 문서 갱신에서 다시 수행했다고 표시하지 않는다.

| 범위 | 확인된 결과 | 원본 |
| --- | --- | --- |
| Core 통합·실제 실행기 | 통합 93+복원 재실행1, 실행기 업무12+worker4, 전체 Chromium28 후 영향17/복구8 | [Core 보완 결과](../worklog/2026-09-23/admin-core/FIX-RESULTS.md) |
| Collector 분리 | 비교40 일치, Java273/273·Core 연동5/5 | [사이트 분리](../worklog/2026-09-23/collector-site-modules/RESULTS.md) |
| Collector CI 로컬 재현 | macOS273·Linux Docker arm64 273 각각 통과 | [CI 결과](../worklog/2026-09-23/collector-ci/RESULTS.md) |
| Direct 검수 | API15·관련 Chromium27, 320/1280px·DB/private object 대조 | [검수 UI 결과](../worklog/2026-09-23/batch-review-ui/RESULTS.md) |
| Core 이미지 후보 | V005에서 후보/이전 앱 업무 및 복귀 통과; V008에서 이전 앱 readiness503 확인 | [후보 식별·호환 행렬](../worklog/2026-09-23/release/candidate.md) |
| 원격 CI·배포 | SHA `5c581c2` verify·collector·images 성공, GHCR digest 기반 API/Web 교체·공개 smoke | [앱 배포 기록](../worklog/2026-09-23/release/production-deployment-5c581c2.md) |
| DB·공개 | API V008·Collector V006, 74 게시글·308 이미지·108 수집 항목 반영. 목록/상세·이미지 전수 대조, 전후 백업 복원 | [DB·콘텐츠 반영 기록](../worklog/2026-09-23/release/production-db-promotion.md) |
| 9/23 커밋 준비 당시 | Node24 루트 검사29/29, 실패·생략0 | [진행 보관 기록](../worklog/2026-09-23/progress-checkpoint.md) |

요구사항 집계는 [40개 대조표](development-specs/requirements-status.md)의 **I30/P9/U1**이다. 40개 묶음 중 주요 구현 확인 30개(75%)이며 개발 공수·제품 완성도·출시 준비율이 아니다. C16 운영자 사용성, O07 실제 인수·복귀를 포함한 부분 항목은 유지한다.

## 재개 순서와 입력

1. 운영자가 준비된 [격리 인수 환경](testing/operator-acceptance.md)에서 반복 업무 12건을 수행하고 혼동·재작업·실패를 기록한다. 별도로 승인된 운영 콘텐츠 범위에서 실제 Access MFA 세션의 작성·업로드·발행·예약·취소·숨김을 인수한다. 인증 비밀은 전달하지 않는다.
2. 운영 담당이 현재 release·flag·DB ledger·백업/timer·공개 API를 먼저 읽기 전용으로 재조회한다. 그 결과에 따라 별도 운영 시나리오에서 예약 실행·알림 실수신·복귀 가능성을 검증한다. 다음 배포에는 최근 18시간 이내 백업·복원 증거가 필요하며, 9월 23일 백업과 공개 수량을 현재값으로 재사용하지 않는다.
3. 다음 코드 배포가 필요하면 [배포 실행서](operations/deployment-runbook.md)에 따라 그 후보 SHA의 원격 CI·digest, V008/Collector V006 호환성, 최신 백업·복원 및 복귀 경로를 새로 대조한다. V008에서 9월 20일 구 API는 readiness 503이다.
4. 수집은 QD-03 입력/source 소유권과 QD-04 direct 보관/회수·법무 고지 계약을 결정한다. 운영 검수 flag ON을 URL·Discord·자동 수집 활성화나 QD-04 충족으로 해석하지 않는다.
5. direct의 robots/Crawl-delay·영속 일일 budget 연결과 redirect 상한 차이를 먼저 보완한다([코드 대조 근거](system-design/07-spring-collector-design.md#direct-실행의-미충족-통제--2026-09-24-코드-대조)). 비운영 DB/object·Discord 시험 대상과 실행 PC/OS가 정해지면 다른 PC batch·원격 권한·Gateway를 실연동한다. 출처별 활성화와 실제 7일 관찰은 별도다.

## 보존된 로컬 자원

- 준비된 인수 sandbox: `.local-data/admin-sandbox-eecd0319a964` (준비 당시 서버 종료; 재개 시 가동·포트 상태 확인).
- 과거 로컬 이미지 후보: `.local-data/release-preparation/blariyo-app-images-20260923T124646Z-ij42qk3e/` (V005 권고 시점의 후보이며 9/23 운영 release 식별자로 재사용하지 않음).
- 비공개 runtime 설정 사본: `~/.config/blariyo/application-config-ZzkcSI/` (실값은 커밋하지 않음).
- 9월 23일 커밋 준비 당시 검사 원본은 Git 제외 `test-results/`에, 당시 원본·diff 백업은 `.local-data/commit-preparation/`에 보존했다. 이번 문서 갱신의 테스트 실행 기록은 아니다.
- 위 로컬 파일 경로는 다른 PC에서 자동 복원되지 않는다. Git 문서·코드와 비공개 실행 자원을 구분한다.
