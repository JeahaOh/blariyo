# S11 — 활성 문서 정리와 취소 상태 마감

- 세션 문서 상태: **작성 완료 / 이 문서에 따른 실행은 아직 시작하지 않음**.
- 주담당 issue: **GOV-29 · GOV-31**. 교차 issue는 해당 주담당에게 인계한다.
- 권고 방향: 활성 지침은 최종 선택에 맞춤, 과거 기록은 보존. **사용자가 확정한 선택은 아니다.**
- 공통 범위·공유 파일·순서: [세션 시작 안내](README.md).
- 원본 근거: [전체 inventory](../../archive/2026-09-26-full-inventory/README.md), [495개 경로](../../archive/2026-09-26-full-inventory/FILES.md), [SHA·CI·상태 원문](../../archive/2026-09-26-full-inventory/inventory.json).
- 결과 작성 위치: `results/S11-RESULT.md`. [결과 양식](RESULT-TEMPLATE.md)을 복사해 이 세션 결과만 기록한다.

## 목표와 입력

다음 세션이 폐기한 governance 절차를 현행 지침으로 오인하지 않게 하고, 이미 끝난 T0/T1 취소와 전체 원복 상태를 분리해 기록한다.

S02~S10의 선택·적용·검증 결과, 기존 설계 2개와 취소 archive. GOV-31의 임시 selector 원복·worktree 제거·15개 자료 보관은 이미 완료됐으며 재실행 대상이 아니다.

기준 조사는 2026-09-26 14:03 KST부터 수집한 snapshot이다. 이 문서 분리는 새 원격 조회가 아니다. 다음 세션은 입력 SHA·status를 실행 직전에 확인하고 차이를 기록한다.

- 기본 저장소: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 구현 참조 작업본: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery`
- 작업본의 `AGENTS.md`와 `docs/ai/README.md`를 먼저 읽는다. 기본 checkout에 구현/설계 파일이 없으면 위 구현 작업본 또는 기록된 SHA에서 확인한다.
- 이 문서의 권고와 원본 기록의 유지/원복 문구는 실행 선택을 대신하지 않는다. 사용자 지시와 이미 명시된 실행 범위 안에서 진행하고, 미정인 선택만 남긴다.

## 대상과 공유 경계

활성 `AGENTS.md`, `README.md`, `docs/ai/README.md`, Git workflow·harness 계획, `docs/status.md`, `docs/roadmap.md`, 관련 문서 링크. 이번 session-tasks 결과 색인. 기존 archive는 변경하지 않는다.

현재/목표 차이 조사와 문서 초안은 병행 가능. 최종 상태 문구는 S10 입력 확정 후 반영하며 활성 문서 편집은 이 세션이 담당.

## 수행 순서

1. 원본 commit/worktree에서 실제 활성 문서 위치를 확인한다. 기본 checkout에 문서가 없다는 이유로 같은 이름의 새 설계를 만들거나 branch를 전환하지 않는다.
2. 최종 선택과 실제 반영을 나눠 활성 지침을 갱신한다. 폐기한 task/branch/hook 강제를 작업 시작 필수 조건으로 남기지 않는다. 유지한 lint/architecture/복원 명령과 한계만 필요한 만큼 설명한다.
3. 과거 설계/작업 이력은 사실을 소급 고치지 않고 보관 위치와 현행 여부를 안내한다. 제품·법무 문서의 정책 내용은 이 작업에서 새로 변경하지 않는다.
4. GOV-31은 완료 상태를 연결하고 paused T1 goal을 재개하지 않는다. 과거 로그를 현재 #4 또는 최종 통합 성공으로 바꾸지 않는다.
5. 분야별 후보 완료·실제 코드 반영·로컬 검증·원격 CI·원격 통합·운영 도입·철회를 구분해 최종 표에 기록한다. S01-B 정리 뒤 바뀐 PR/ref/worktree 상태만 추가 갱신한다.

## 검증과 완료 조건

- 문서 링크·참조 파일·공백과 변경 범위; 선택된 문서 format/lint.
- 남은 과거 branch·Windows·push 차단 문구가 당시 기록인지 현행 사실인지 명시.
- 구현/검증 증거 없는 완료 주장, 임의 placeholder 제거, 취소 goal 재개가 없음.

완료 조건:

- 활성 문서가 실제 선택/적용 상태와 일치하고 역사 archive가 보존됨.
- GOV-31 완료를 다시 실행하지 않았으며, 전체 governance 원복/통합/운영 도입을 각각 실제 상태로 보고.

중단/보존 조건:

- 세션 결과가 없거나 코드와 결과가 다르면 해당 항목을 미확정으로 남김.
- 제품·법무 정본의 의미 변경이 필요해지면 governance 문서 마감으로 확대하지 않음.

같은 문제 해결 시도는 최초 포함 최대 2회로 제한한다. 새 근거 없이 같은 상태를 반복 조회하지 않는다. 두 번 연속 실질적 진전이 없으면 해당 범위의 원인과 다음 입력을 기록하고 중단한다. CI가 실행 중이면 상태·URL만 남기며 이 세션 때문에 계속 기다리거나 재실행하지 않는다.

## 인계 산출물

활성 문서 변경과 최종 상태표를 S10의 문서 lint 및 S01-B 정리 입력으로 전달한다. S01-B 결과의 단순 상태 반영 후 종료.

- 결과에는 선택의 근거가 된 사용자 지시, 입력/출력 SHA·diff hash, 변경 경로, 실제 실행한 검사와 미실행을 적는다.
- 공유 파일 변경은 담당 세션에 요구사항/diff로 전달한다. 같은 파일을 여러 세션이 동시에 수정하지 않는다.
- 실행하지 않은 commit·push·PR 변경·원격 설정·DB 변경을 완료로 기록하지 않는다. 다른 task를 자동 시작하거나 취소한 T1을 재개하지 않는다.

## 다른 세션에 전달할 요청문

```text
다음 문서와 그 문서가 연결한 README.md를 읽고 S11 범위만 진행해.
/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/session-tasks/S11-docs-closeout.md
내가 함께 지정한 유지/분리/철회 방향과 실행 범위를 적용해.
미정인 선택을 권고안으로 확정하지 말고, 독립적으로 확인할 수 있는 부분부터 진행해.
기존 변경과 다른 세션 작업을 보존하고 결과는 results/S11-RESULT.md에 남겨.
공유 파일 담당과 선행 조건을 지키고 다른 세션 작업을 자동 시작하지 마.
```

## 담당 issue의 상세 상태 — 2026-09-26 조사 기록

아래는 원본 inventory의 담당 issue 기록을 옮긴 것이다. 파일:행은 당시 구현 기준이며 현재 행 번호를 실행 시 확인한다. 여기의 `완료`는 당시 구현/검증 등 명시된 범위에만 해당한다.

### GOV-29 — 설계·지침·상태 문서와 과거 기록

- 분야/중요도: 문서·작업 규칙 / Medium.
- 근거: AGENTS, docs/ai README, git-workflow, harness-implementation-plan, docs/status·roadmap, worklog. local main의 설계 원본 commit은 `21b8828`이다.
- 진척: 브랜치·hook·lint·architecture·CI·release 설계와 이력이 작성돼 있다.
- 미완료: 문서 상단의 오래된 branch 이름·PR 실패·Windows 미검증 문구와 후속 관측이 섞여 있다. 문서가 남아 있으면 다음 세션이 폐기한 정책을 여전히 실행 기준으로 읽을 수 있다.
- 유지/원복: 활성 지침은 남길 구조에 맞춰 수정하고, 과거 작업 기록은 상태를 소급 조작하지 말고 archive로 보관한다. 기존 579줄 설계 2개도 별도 선택 대상이다. 모든 제품·법무 문서를 삭제하는 일이 아니다.

### GOV-31 — 이번 T0/T1 취소 처리

- 분야/중요도: 세션 정리 / Low.
- 근거: [취소 기록](../../archive/2026-09-26-t0-t1-cancelled/README.md), [검증 결과](../../archive/2026-09-26-t0-t1-cancelled/rollback-result.json).
- 완료: 테스트 선택자 2줄 복원, T1 임시 worktree·설치/빌드 산출물 제거, 문서 3개·자료 12개 보관, 기존 ref·stash·다른 작업·공용 hook 보존 확인. T1 goal은 paused다.
- 한계: 전체 governance 작업을 제거한 것은 아니다. 당시 보존했던 대상이 이번 inventory의 주요 잔여 대상이다.
- 처리: 완료된 취소를 다시 실행하거나 T1을 자동 재개하지 않는다. 당시 성공 로그는 당시 임시 수정본의 증거로 보관한다.
