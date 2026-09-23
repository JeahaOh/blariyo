# TASK — 기존 협업 체계의 Blariyo 적용성 검토

- 작성일: 2026-08-13
- 업무 영역: `ai-governance`
- 상태: 완료 — 최종 재검수 Medium 2건까지 반영, 문서 잔여 Critical/High/Medium 0건
- 구현자: Codex 구현 에이전트 `draft_author`
- 검수자: 오케스트레이터 지정 독립 검수자
- 검수 결과: 보완 필요 8건, 전건 수용·반영

## 1. 목표

기존 대규모 프로젝트에서 사용하는 팀 규칙, AI 스킬,
도구·검증 하네스를 Blariyo에 그대로 복사하지 않고 현재 프로젝트 규모와
Node.js 환경에 맞춰 다음 세 부류로 분류한다. 현행 tracked 구현과 planning 제안은
Express이며, untracked nested NestJS scaffold는 목적과 전환 승인 여부가 미정이다.

1. 그대로 가져갈 운영 원칙(Keep)
2. Blariyo에 맞게 축소·변환할 항목(Adapt)
3. 기존 프로젝트 전용이거나 현 단계에 과한 항목(Drop)

## 2. 범위

### 포함

- 기존 협업 헌장, 개발 정본, 에이전트별 진입 파일 구조
- 기존 Claude/Codex 스킬과 호환 어댑터의 역할 분리
- Git hook, 테스트, 완료 판정, 세션/핸드오프 관행
- Blariyo의 현재 문서 정본, Git 상태, Express/NestJS 테스트 설정
- 최소 도입안, 단계별 적용 순서, 검증 체크리스트

### 제외

- Blariyo 소스 코드, 빌드 설정, Git hook의 실제 변경
- 기존 `apps/blariyo.core/` 미추적 작업물의 편집·정리
- commit, push, merge, 배포, 외부 전송
- 기존 프로젝트 스킬/도구의 기계적 복사

## 3. 산출물

`<artifact-dir>`는 저장소 외부의 문서 산출물 보관 디렉터리이고,
`<temporary-dir>`는 과거 임시 검수본 보관 디렉터리다.

| 구분 | 경로 | 현재 역할·상태 |
| --- | --- | --- |
| 1차 작업 기록 | `<blariyo>/worklog/task-list/08/13/ai-governance/TASK.md` | 저장 완료, 미추적·미커밋 |
| 독립 재검수 기록 | `<blariyo>/worklog/task-list/08/13/ai-governance/TASK-02.md` | 조건부 승인 결과와 수정 반영 기록 |
| 최종 적용 검토 초안 | `<artifact-dir>/blariyo-ai-governance-adoption-draft-20260813.md` | 재검수 지적 반영 완료 |
| 과거 임시본 | `<temporary-dir>/blariyo-ai-governance-20260813/` | 최초 저장 전 실행 이력, 현행 정본 아님 |

## 4. 검증 계획

- [x] 비교 프로젝트의 협업 헌장, 에이전트 진입 문서, 개발 정본 확인
- [x] 대표 `.agents/skills`, `.claude/skills`, 호환 문서, hook/settings 확인
- [x] Blariyo tracked 파일, 최신 정본, 패키지/테스트/포맷 설정 확인
- [x] Blariyo 현재 Git 상태와 기존 미추적 파일 확인
- [x] Keep/Adapt/Drop 분류와 단계별 도입안 작성
- [x] 임시본 필수 섹션, whitespace 진단, staging↔임시본 checksum 확인
- [x] 독립 검수자가 근거 경로·판정·누락을 재확인하고 8건 보완 요청
- [x] 독립 검수 8건을 초안과 TASK에 반영
- [x] Blariyo Git 목표 파일 존재와 `git status` 확인
- [x] 비-Git `ai-use` 목표 파일 존재 확인
- [x] 두 목표 저장 완료로 상태 전이
- [x] 독립 재검수 수행 및 `TASK-02.md`에 최종 결과 기록
- [x] 최종 재검수 GOV-02-R, GIT-01-R 반영 및 문서 잔여 0건 확인

## 5. 현재 판정

- 기존 체계의 핵심은 특정 기술 규칙이 아니라 `정본 계층 → 작업 라우팅 → 실행 검증 →
  독립 검수 → 사실 기반 보고`의 폐쇄 루프다. 이 구조는 가져간다.
- 비교 프로젝트의 기술 스택 전용 규칙, 관리대장 ID, 폐쇄망, 응답 코드 감사, 개인별
  권한 allowlist, 조직 전용 커밋 트레일러는 Blariyo에 적용하지 않는다.
- Blariyo는 tracked Express 앱과 untracked NestJS 초안이 공존하므로 API 개발
  스킬과 CI 명령을 확정하기 전에 백엔드 기준선을 결정해야 한다.
- `apps/blariyo.core/`는 바깥 저장소에서 미추적인 동시에 자체 `.git`을 가진
  별도 무커밋 저장소다. 의도를 결정하기 전 바깥 저장소 staging에서 제외하고
  양쪽 `git status`를 따로 확인한다.
- 루트 `.gitignore`가 lockfile을 무시하므로 재현 가능한 설치 하네스 도입의
  최우선 선행 항목이다. 단, 패키지 관리자 선택 전 파일을 수정하지 않는다.

## 6. 리스크

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| Express/NestJS 기준선 미정 | 잘못된 스킬·CI 고착 | 기술 기준선 결정 전 공통 규칙만 도입 |
| nested `.git` 의도 미정 | 실수로 중첩 저장소 흡수·삭제 | 양쪽 status 분리, 삭제·흡수는 명시 승인 |
| 기존 규칙 전체 복사 | 문서 과밀·충돌·무용한 게이트 | Keep/Adapt/Drop 단위로 선별 |
| lockfile 미추적 | 설치·CI 결과 비재현 | 패키지 관리자 확정 후 lockfile 추적 |
| 로컬 hook만 신뢰 | 우회 가능·머신별 차이 | CI를 정본 게이트, hook은 빠른 피드백으로 한정 |
| 광범위 AI 권한 복사 | 비밀/외부 전송/파괴 위험 | 최소 권한, deny 기본, 로컬 설정만 허용 |
| 일일 task와 정본 혼재 | 과거 작업이 현행 결정으로 오인 | 정본/ADR/세션/task 역할을 명시 |
| 문서 미추적 | 검토 기록이 Git 이력에 아직 없음 | commit/push는 별도 사용자 승인 후 수행 |

## 7. 최초 작성 당시 쓰기 차단 이력

아래 오류는 최초 작성 당시의 과거 실행 기록이다. 현재는 두 목표 파일 모두 지정
경로에 저장되어 있으며 이 오류를 현행 상태로 해석하지 않는다.

최초 저장 시 대상 디렉터리에 대한 권한 오류가 발생했으나, 이후 승인된 경로에
정상 저장하고 파일 존재와 상태를 다시 확인했다.

## 8. 독립 검수 8건 처리 결과

| ID | 검수 의견 | 처리 결과 | 상태 |
| --- | --- | --- | --- |
| R1 | 제품·법무 정본이 AGENTS보다 우선이며 읽기 순서와 우선순위를 분리 | 정본 서열과 착수 읽기 순서를 별도 표로 명시 | 반영 |
| R2 | `docs/ai`가 제품·법무 사실을 복제하면 drift 발생 | 링크맵·절차·증거계약만 허용하고 docs-audit/release에 `docs/legal` 추가 | 반영 |
| R3 | 루트 npm 명령과 npm 추천이 기준선 확정 전 과도함 | root workspace 채택 시 예시로 조건화하고 Phase 0 결정 항목 확대 | 반영 |
| R4 | 보안 증거가 민감 정보 로그를 만들 수 있음 | body/Auth/cookie/token/rights evidence 로그 금지, redaction allowlist·negative test·로그 검사를 추가 | 반영 |
| R5 | `apps/blariyo.core/.git`의 nested repo 의미가 누락 | 양쪽 status, staging 제외, 삭제·흡수 승인 게이트를 추가 | 반영 |
| R6 | CI 파일 생성과 자동 gate 활성화는 별개 | provision→required check 순서와 그 전 임시 증거, 승인·법무 비대체를 명시 | 반영 |
| R7 | 목표 차단 시 임시 정본과 상태 전이가 불명확 | 임시 정본, staging/target/checksum과 승격 절차를 명시 | 반영 |
| R8 | Git 저장소 내부 목표와 비-Git `ai-use`에 같은 검증을 적용함 | 목표별 검증을 분리하고 둘 다 성공해야 저장 완료로 판정 | 반영 |

## 9. 저장 상태 전이 결과

1. `TASK.md`와 적용 검토 초안은 지정 목표 경로에 저장됐다.
2. 1차 독립 검수 R1~R8은 초안에 반영했다.
3. 별도 `TASK-02.md`에서 문서·저장소·보안 3축 재검수와 반증을 수행했다.
4. 재검수에서 발견한 Critical 0 / High 1 / Medium 6 / Low 2를 초안에 반영했다.
5. 최종 재검수에서 남은 Medium 2건(GOV-02-R, GIT-01-R)을 추가 반영했다.
   session의 정본 예외와 병렬 사실 입력 표현을 모두 제거하고, 제품·법무 사실은
   planning/legal만 정본으로 사용하도록 통일했다. nested Git 흡수 dry-run은 원본이
   아닌 `.git` 제외 임시 복제본에서 수행하도록 절차를 정정했다.
6. 반영 후 문서 잔여 Critical/High/Medium은 0건이며, 실제 소스의 보안 선결 High 1건은
   별도 Phase 0 실행 리스크로 남겼다.
7. Blariyo `docs/task_list/08/13/`는 현재 미추적이며 commit/push하지 않았다.
8. 임시본과 staging은 과거 전달용 사본으로 현행 정본이 아니다.

## 10. 완료 및 후속 경계

- 이번 문서 검토와 재검수 반영은 완료했다. 상세 결과는 `TASK-02.md`를 따른다.
- 소스·설정·hook·CI는 변경하지 않았다.
- 다음 작업은 Phase 0 민감 로그 차단을 별도 `security-hotfix` task로 시작할 예정이다.
- nested Git 처리, lockfile 재생성, 원격 required check 확인, commit/push는 이번 범위 밖이다.
