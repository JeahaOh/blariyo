# 2026-09-23 작업 문서 목차

오늘 작성한 M0 점검·수집 검증·후속 계획을 찾기 위한 목차다. 원본 문서는 기존 위치에 유지한다.
**보고서는 수행한 작업의 기록이고, 계획서는 앞으로 수행할 작업이다. 문서 작성·커밋 완료가 기능 완료를 뜻하지 않는다.**
제품·기술 판단은 [수집 기획](../../docs/planning/content-collection/README.md)과
[Collector 설계](../../docs/system-design/07-spring-collector-design.md)를 따른다.

## 먼저 읽을 문서

| 확인하려는 내용 | 문서 | 성격 |
| --- | --- | --- |
| 현재 진행 상태·남은 입력·이번 커밋은 무엇인가 | [현재 진행 상황](../../docs/status.md), [진행 보관·커밋 기록](progress-checkpoint.md) | 최신 재개 위치와 로컬 Git 기록; push·배포 별도 |
| M0 전체에서 무엇이 남았는가 | [M0 중간 점검](m0-audit/report.md), [40개 요구사항 대조](../../docs/development-specs/requirements-status.md) | 작성 시점의 감사 결과. M0 전체 부분 완료 |
| 로컬 수집 목표를 어디까지 검증했는가 | [수용 기준 감사](batch-고도화/ACCEPTANCE-AUDIT.md) | 로컬 최종 종합 판정과 한계 |
| 전체 개발을 어떤 순서로 재개하는가 | [M0 실행 계획](m0-planning/next-plan.md) | 앞으로 할 일의 전체 우선순위·완료 조건 |
| 재검토 후 전체 남은 순서와 완료 조건은 무엇인가 | [M0 잔여 과정](m0-planning/remaining-process.md) | 결함 보완→재검증→인수→배포→운영→수집·관찰 |
| 수집 후속 작업의 준비 조건은 무엇인가 | [수집 후속 작업](m0-planning/collector-follow-up.md) | 수집 작업의 구체 범위·선행 입력·검증 절차 |

전체 작업 순서는 M0 실행 계획에서 관리하고, 수집 세부 절차는 수집 후속 작업에 연결한다.
이 목차에 별도 진행 체크리스트나 완료율을 복제하지 않는다.

## 이미 수행한 작업과 검증 보고서

### Core 관리자 후속 마감

- [CI·저장 복구·실제 로컬 worker 보완 결과](admin-core/FIX-RESULTS.md): 새 실행기의 격리12+4건, 깨끗한 checkout 회귀, 원격 CI·수동 인수 잔여 구분.

- [관리자 마감 결과](admin-core/RESULTS.md): 최초 로컬 검증 기록. 후속 재검토에서 P0-03/04는 부분 완료로 정정했다. 과거 검사 결과를 소급 변경하지 않는다.
- [후속 검토·GitHub 오류 확인](admin-core/FOLLOW-UP.md): 저장 복구·로컬 실행 연결의 잔여 결함과 CI 확인 결과. [커밋 메시지](admin-core/COMMIT-MESSAGE.txt)는 초안이며 실제 커밋은 하지 않았다.
- [관리자 진행 기록](admin-core/PROGRESS.md), [화면 검토물](../../docs/ui/publishing/admin-core-review.md): 기존 변경 보존, 실제 결함·회귀 수리 및 반응형 상태 비교.

### Core 배포 후보 준비

- [로컬 이미지·설정·DB 호환 결과](release/candidate.md): amd64 API/Web archive, runtime 사본, V005 Core 업무·이전 앱 복귀 통과. V008에서는 이전 앱 readiness 503. 실제 서버·최종 원격 CI·운영 인수는 미검증.

### Direct 수집 검수 UI 후속 결과

- [관리 메뉴·필터·선택 초안·실패 복구](batch-review-ui/RESULTS.md): API 통합 15건·관련 브라우저 27건, 응답 유실 뒤 401/403 복구·단일 DRAFT·private 이미지·320/1280px 확인. 실제 운영자·Access·원격 인수는 미검증.

### 수집 계약 문서 정합성

- [D01~D03 기획·보안·명세 보완](collection-contract-alignment/RESULTS.md): direct/legacy 저장·권한·검수 경계와 raw HTML 취급 정렬. Web 입력/source 변경·보존/고지 결정은 미완료.

### Collector CI 후속 결과

- [Collector CI 구성·macOS/Linux 재현](collector-ci/RESULTS.md): Java 전체·격리 DB 각 273건, JAR·SBOM, 검사 누락/건너뜀 거부와 임시 자원 정리. 원격 CI·Windows·실제 운영 기동은 미검증.

### 사이트 모듈 분리 후속 결과

- [사이트별 parser 분리·회귀 결과](collector-site-modules/RESULTS.md): 21개 adapter·상세/19개 목록 parser, 기존 결과 40개 일치, 격리 DB 포함 Java 273건과 Core 연동 5건 통과. 실제 수집·운영 검증과 구분.

### 수집 작업의 기존 보고서

수집 결과의 검수·초안 승격·별도 발행, 로컬 공개 이미지와 본문/링크 보존, 출처별 parser와
DB/object readback을 구현·검증한 기록이다. 아래의 최종 보고서와 중간 보고서는 작성 시점이 다르므로
수량을 합산하거나 중간 수치를 최신 결과로 사용하지 않는다. 이번 목차 작성에서 실행 검증을 다시 수행하지 않았다.

| 구분 | 보고서 | 읽는 목적 |
| --- | --- | --- |
| 최종 종합 | [수용 기준 감사](batch-고도화/ACCEPTANCE-AUDIT.md) | 요구별 통과·미검증·차단과 최종 테스트 실행 근거 |
| 최종 상세 | [첨부·전체 브라우저 검증](../../apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md) | 공개 상세·이미지·첨부, 21개 출처와 저장 원본 대조 |
| 최종 커밋 준비 | [커밋 계획과 후속 확인](batch-고도화/COMMIT-PLAN.md) | fixture 정규화 후 회귀 검사와 실제 커밋 완료 기록 |
| 중간 점검 | [개발 DB readback 검토](../../apps/collector/ops/reports/dev-readback-review-2026-09-23.md), [21개 출처 점검](../../apps/collector/ops/reports/dev-21-site-review-2026-09-23.md) | 당시 출처별 저장 상태와 누락 조사 |
| 중간 점검 | [차단 결과 readback](../../apps/collector/ops/reports/dev-blocked-readback-2026-09-23.md), [역할·후속 수집 점검](../../apps/collector/ops/reports/local-role-followup-2026-09-23.md) | 차단 상태 저장과 역할별 실행 근거 |
| 중간 화면 검증 | [3000 재검증](../../apps/collector/ops/reports/local-3000-review-2026-09-23.md), [작업 측 검토 기록](batch-고도화/REVIEW-3000.md) | 로컬 화면 문제와 해결 과정 |
| 문제별 검증 | [갤러리 제한](../../apps/collector/ops/reports/local-gallery-limits-2026-09-23.md), [MIME 정정](../../apps/collector/ops/reports/collector-mime-correction-2026-09-23.md) | 다중 이미지와 파일 형식 오류 처리 |
| parser·정책 증거 | [실제 HTML fixture](../../apps/collector/ops/reports/observed-fixtures-2026-09-23.md), [미디어·공지·동영상 정책](../../apps/collector/ops/reports/media-notice-video-policy-2026-09-23.md) | 정제 fixture, 실제 접근 한계, 공지·미디어 분류 |

기계 판독용 JSON·TSV는 [Collector 보고서 폴더](../../apps/collector/ops/reports)의 같은 이름 파일과
`collector-inventory-2026-09-23.json`, `blocked-http-observations-2026-09-23.json`,
`local-21-hot-run-20260923-072050.tsv`를 참고한다. 비공개 원본·자격증명은 이 목차에 복사하지 않는다.

## 앞으로 수행할 작업

- M0 Core 관리자: **P0-03 로컬 보완 완료, P0-04 운영자 인수 잔여**. 저장 복구·실제 실행기·격리 회귀의 새 근거는 위 보완 결과를 따른다. 원격 CI·배포·운영 인증은 별도다.
- 사이트별 adapter·목록/detail parser 독립 파일 분리: **로컬 완료**. [분리 결과](collector-site-modules/RESULTS.md)의 새 실행 근거를 따른다. 실제 차단 출처·원격 연동·운영 검증은 별도다.
- 실제 관리자 인증 UI, 다른 PC의 공유 개발 DB·원격 S3/R2, Discord Gateway, Windows·원격 CI: **후속 구현 또는 실연동 검증 필요**. 세부 준비 조건은 수집 후속 작업에 있다.
- fmkorea·ppomppu·pgr21·youtube-community: **차단 또는 실제 본문 미검증**. 허용된 공개 응답/경로가 준비되면 해당 출처를 재검증한다.
- 관리자 URL 입력 전달과 direct 원본 보존·회수: **계약 결정과 후속 구현 필요**. 검증 보고서가 존재한다는 이유로 완료 처리하지 않는다.

## 작업 이력

- [원래 작업 요청](batch-고도화/BACKLOG.md): 당시 범위와 수용 조건. 이후 명시된 커밋 권한은 아래 후속 기록으로 구분한다.
- [진행 기록](batch-고도화/PROGRESS.md): 수정·실행·실패와 복구 이력.
- [P2 실제 검증 기록](batch-고도화/P2-LIVE.md): 해당 단계의 관측 결과와 제약.
- 과거 Git 상태·수량·미검증 설명은 당시 증거로 보존한다. 이후 결과는 새 기록으로 추가한다.

## 커밋 완료 확인

사용자가 커밋을 완료한 뒤 `git log`로 아래 6개를 확인했다. 확인 시 작업 트리는 깨끗했고,
`main...origin/main [ahead 7]`이었다. 기존 `d22dd96`과 이번 6개 커밋을 구분한다.
원격 fetch·push·배포는 이번 문서 작업에서 수행하지 않았다.

| 커밋 | 메시지 |
| --- | --- |
| `4730bf0` | feat: 수집기 직접 저장 큐와 원문·미디어 수집 보강 |
| `548c84b` | feat: 수집 결과 검수와 게시글 초안 승격 구현 |
| `d4ea9a0` | feat: 관리자 수집 검수 화면과 공개 미디어 표시 개선 |
| `5354c3d` | chore: 환경별 설정과 DB 권한·로컬 검증 도구 정리 |
| `d0e78d8` | docs: 수집 소유권과 사이트별 모듈 설계 정렬 |
| `47e2dd3` | docs: 수집 검증 결과와 M0 후속 작업 기록 |

이 목차와 커밋 완료 후속 기록은 위 6개 커밋 이후에 작성한 문서 변경이다.
