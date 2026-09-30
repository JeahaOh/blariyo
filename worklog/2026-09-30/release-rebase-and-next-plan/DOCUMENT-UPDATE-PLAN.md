# 현행 문서 갱신 계획

- 상태: 계획 작성 완료 / 아래 정본 일괄 갱신 미실행.
- 기준: 사용자=실제 운영자, [진행 계획](PROGRESS-PLAN.md)의 통합 후보와 실행 증거.
- 이번 release rebase에서 충돌 해결한4개 문서는 [결과](README.md)로 구분한다. 이는 아래 문서 갱신 전체 완료가 아니다.
- 원칙: 계획·로컬 구현·검증·운영 적용·사용자 확인을 각각 표기한다. 과거 작업 이력을 현재 결과로 덮어쓰지 않는다.

## 1. 갱신 대상과 내용

| 순서·문서 | 수정할 내용 | 근거·완료 기준 |
| --- | --- | --- |
| D01 / docs/planning/01-service-plan.md, docs/planning/content-collection/README.md | 실제 운영 담당은 사용자. 기존 OWNER/EDITOR 정책과 현재 확인 담당을 구분. Core 우선·선택 출처 기준 유지 | 사용자 최신 발언과 기존 역할 계약이 충돌하지 않음. 공동 운영자 역할을 임의 삭제하지 않음 |
| D02 / docs/operations/m0-operation-handoff.md | Core 사용 확인·MFA·백업/관찰 담당을 사용자로 명시. 미정인 담당과 미정인 실행 시각을 분리 | 사용자 담당 확정만 반영하고 실제 수행 결과는 미실행/미검증으로 유지 |
| D03 / docs/implementation-tasks/operations-acceptance.md, docs/testing/operator-acceptance.md | Codex의 환경 준비/기술검사와 사용자의 실제 업무 확인을 분리. EDITOR 검증은 별도 역할 항목 유지 | 12건 양식·실제 수신·7일 기록을 자동검사 PASS로 채우지 않음 |
| D04 / docs/operations/owner-setup-checklist.md | 이미 준비된 운영자·연락처·계정/Discord 채널을 다시 준비 요청하지 않도록 상태 구분 | 기존 비공개 설정과 사용자의 확정 사항을 먼저 확인. 비밀·identity 원문 기록0 |
| D05 / docs/implementation-tasks/contracts-maintenance.md, docs/implementation-tasks/README.md | 준비 도구 권한·ledger 출력 보완의 로컬 완료와 실장비 인수를 분리 | 실제 source/권한 시험·9/27 manifest 및 후속 통합 검증 연결 |
| D06 / docs/development-specs/requirements-status.md | O05/O08의 오래된 도구 미보완 사유 제거, 실제 잔여만 기재. 통합 후보의 요구사항 재집계 | I32/P8/U0을 유지/변경할 근거를 항목별 확인. 현재 feature 수치를 미통합 release에 복사하지 않음 |
| D07 / docs/operations/current-status.md | 9/25 8af7244 앱 배포, 9/23 DB 전수 검증, 9/26·9/30 공개 GET을 분리. 새 운영 조회는 실제 수행 뒤 추가 | Git main/release와 실행 서버SHA/digest를 혼동하지 않음 |
| D08 / docs/status.md | 구현 본체f1fc07d·후속 미커밋·통합 후보·실제 배포를 별도 표시. 사용자 확인/수집/운영 잔여 갱신 | 사용자에게 현재 브랜치별 차이와 다음 작업을 한눈에 설명 가능 |
| D09 / docs/roadmap.md | 끝난 준비 도구 구현을 0순위에서 내리고 G1~C1의 잔여 실행 순서로 정렬. 담당은 사용자/Codex로 구체화 | 재구현·재결정 요구0, 각 작업에 선행·산출물·완료 증거 존재 |
| D10 / docs/ai/git-workflow.md, docs/ai/harness-implementation-plan.md | 최신 feature→release→main 정책 유지. main에서 유입된 9/25 harness 설계안이 9/26 확정 정책과 다른 부분을 현행/과거로 구분 | 이번 대상 한정 rebase 요청을 일반 이력 재작성 허용으로 확대하지 않음. hook 변경 없음 |
| D11 / docs/README.md 및 관련 인접 안내 | 위 정본 링크·현재 진입점만 맞춤. 새 중복 상태 문서 추가 없음 | 상대 링크/anchor가 유효하고 상태 설명 중복 최소화 |

문서가 여럿 연결돼 있어도 이미 맞는 본문은 수정하지 않는다. 법무·정책 실값, 시행일, 수탁자/국외이전 판단은 추측해서 확정하지 않는다. 실제 고지 변경은 해당 기능 활성화 전에 별도 증거로 처리한다.

## 2. 적용 순서

1. 통합 후보에서 사용자 역할·제품 범위를 먼저 확정된 내용대로 표기한다(D01).
2. 인수/준비/task의 실제 담당·완료/잔여를 맞춘다(D02~D05).
3. 후보 소스와 검증에 따라 요구사항을 재집계하고 운영 관측을 날짜별로 연결한다(D06~D07).
4. 마지막으로 status·roadmap·문서 진입점을 동기화한다(D08~D11). 요약 문서가 세부 근거보다 앞서 완료를 선언하지 않게 한다.
5. 기존 변경 파일의 소유권을 확인하고 문서 변경 범위만 검토·반영한다. 이번 계획 파일은 작업 기록으로 유지한다.

## 3. 검증과 완료 기준

- 제품/법무/기술/기능 명세에 서로 다른 운영자·보존 기간·활성화 조건이 없는지 확인.
- 40개 요구사항 집계, 17개 기존 task ID, 완료/미검증/차단의 판정 일치.
- 상대 링크·anchor 및 실제 source/test/실행 증거의 존재 대조.
- (미정), [입력 필요], [출시 차단]을 근거 없이 제거하지 않았는지 diff 검사.
- local main, remote main, local release, remote release, 기능 브랜치, 실제 운영SHA의 구분.
- 과거 worklog 원문 보존. 이번 결정·결과는 worklog/2026-09-30/ 아래 후속 기록으로 연결.
- git diff --check, 의도한 파일 목록, 기존 변경 보존 확인.
- 완료 보고는 문서 갱신, 로컬 코드/검증, 운영 적용, 사용자 실제 확인을 따로 제시.
