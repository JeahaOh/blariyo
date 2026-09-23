# M0 현재 진행 상황 — 2026-09-23

- **전체 판정: 부분 완료. 로컬 구현·검증과 배포 후보 준비를 마쳤으며 운영자 인수·원격 검증·수집 계약 입력을 기다린다.**
- 이번 사용자 요청: docs/worklog 갱신, 현재 상태 보관, 현재 변경의 로컬 커밋. push·배포는 요청 범위에 없다.
- 전체 목표가 `blocked`로 전환된 이유는 같은 선행 조건이 세 차례 확인됐기 때문이다. 기능 완료나 작업 폐기를 뜻하지 않는다.
- 상세 실행 순서는 [잔여 과정](remaining-process.md), 실제 커밋 식별자는 [진행 보관·커밋 기록](../../../worklog/task-list/09/23/progress-checkpoint.md)을 따른다.

## 완료 범위와 남은 조건

| 작업 | 현재 완료 범위 | 남은 조건 |
| --- | --- | --- |
| Core 관리자 P0-01~03 | 최소 화면·검색·오류 복구·저장 결과 확인·인증 실패 뒤 동일 요청 보존 | 실제 운영자 사용성·Access 인증 확인 |
| 로컬 실행 P0-04 | 격리 실행기의 예약·이미지 회수 worker, 중복 소유 방지·재시작·실패 복구와 실제 시각 검증 | 운영자가 직접 수행하는 인수 12건 |
| CI A-1/P1-07 | Java fixture 준비·Collector job·전체 검사·JAR/SBOM 및 로컬 macOS/Linux 재현 | 승인된 push 후 최종 SHA 원격 verify/collector/images·digest 확인 |
| Direct 검수 P1-02 | 정식 메뉴·필터·검수/반려·초안 이동·불확실 응답 복구 | 실제 운영자·Access·원격 object 인수 |
| 사이트 모듈 P1-06 | 21 adapter·21 상세·19 목록 parser 분리, 기존 결과 보존 | 누락 실제 표본·차단 4개 출처의 허용 경로 확보 후 재검증 |
| 문서 정합성 P1-01 | D01~D03의 direct/legacy 저장·권한·검수 규칙 정렬 | Web 입력/source 변경 권한 QD-03, 보존·고지 계약 QD-04 |
| 배포 준비 P0-05 | amd64 이미지·설정 사본·5단계 DB 호환 검사 | 운영 ledger/백업·최종 원격 CI·별도 배포 요청·실제 운영 smoke |
| 수집 실연동 P1-03~05/07 | 로컬 코드·격리 증거와 실행서 준비 | 다른 PC/Windows·비운영 DB/object·Discord·보존 회수 구현/검증 |
| 운영 관찰 P2 | 관찰 조건 정의 | 실제 운영 개시 후 7일 기록 |

## 검증 근거

아래 기존 실행들은 서로 다른 시점·환경의 증거다. 중복 합산하거나 이번 커밋 작업에서 다시 수행했다고 표시하지 않는다.

| 범위 | 확인된 결과 | 원본 |
| --- | --- | --- |
| Core 통합·실제 실행기 | 통합 93+복원 재실행1, 실행기 업무12+worker4, 전체 Chromium28 후 영향17/복구8 | [Core 보완 결과](../../../worklog/task-list/09/23/admin-core/FIX-RESULTS.md) |
| Collector 분리 | 비교40 일치, Java273/273·Core 연동5/5 | [사이트 분리](../../../worklog/task-list/09/23/collector-site-modules/RESULTS.md) |
| Collector CI 로컬 재현 | macOS273·Linux Docker arm64 273 각각 통과 | [CI 결과](../../../worklog/task-list/09/23/collector-ci/RESULTS.md) |
| Direct 검수 | API15·관련 Chromium27, 320/1280px·DB/private object 대조 | [검수 UI 결과](../../../worklog/task-list/09/23/batch-review-ui/RESULTS.md) |
| Core 이미지 후보 | V005에서 후보/이전 앱 업무 및 복귀 통과; V008에서 이전 앱 readiness503 확인 | [후보 식별·호환 행렬](release-candidate.md) |
| 이번 커밋 준비 | Node24 루트 검사29/29, 실패·생략0 | [진행 보관 기록](../../../worklog/task-list/09/23/progress-checkpoint.md) |

요구사항 집계는 [40개 대조표](requirements.md)를 따른다. C09 검색·목록 구현 증거를 반영해 **I30/P9/U1**로
갱신했다. C16의 실제 반복 업무 사용성은 부분 상태를 유지한다. 이 수치는 출시 준비율이 아니다.

## 재개 순서와 입력

1. 준비된 [인수 환경](operator-acceptance.md)에서 운영자 12건 수행·혼동/재작업/실패 기록. 인증 비밀은 전달하지 않는다.
2. 로컬 커밋 검토 후 별도 push 요청. 최종 SHA의 원격 CI와 API/Web 이미지 게시를 확인한다.
3. [배포 후보](release-candidate.md)의 실제 서버 ledger·기존 설정·백업·복귀 경로 대조 후 별도 승인 범위로 배포한다.
   V005 유지 권고는 실제 운영 조회로 확인해야 하며 V008 적용 후 이전 이미지 복귀를 보장하지 않는다.
4. 수집은 QD-03 입력/source 소유권과 QD-04 보관/회수 계약을 결정한 뒤 재개한다. 기존 30일/24시간을 direct에 임의 적용하지 않는다.
5. 실제 비운영 DB/object·Discord 시험 대상과 실행 PC/OS가 정해지면 실연동한다. 기능별 검증 전 수집 flag는 OFF다.

## 보존된 로컬 자원

- 준비된 인수 sandbox: `.local-data/admin-sandbox-eecd0319a964` (준비 당시 서버 종료; 재개 시 가동·포트 상태 확인).
- 이미지 후보: `.local-data/release-preparation/blariyo-app-images-20260923T124646Z-ij42qk3e/`.
- 비공개 runtime 설정 사본: `~/.config/blariyo/application-config-ZzkcSI/` (실값은 커밋하지 않음).
- 검사 원본은 Git 제외 `test-results/`에, 이번 커밋 전 원본·diff 백업은 `.local-data/commit-preparation/`에 보존한다.
- 위 로컬 파일 경로는 다른 PC에서 자동 복원되지 않는다. Git 문서·코드와 비공개 실행 자원을 구분한다.
