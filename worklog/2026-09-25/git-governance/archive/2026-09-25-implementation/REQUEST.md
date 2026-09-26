# Git 브랜치·코드 품질 게이트 설계 변경 프롬프트

- 작성일: 2026-09-25 KST
- 문서 용도: 대화에서 작성한 설계·구현 계획 변경 프롬프트 보관 및 후속 실행 인계
- 상태: 최초 인계 시점에는 프롬프트 문서만 저장했다. 이후 사용자 범위가 구현까지 확장됐다. 현재 로컬 harness·CI 일부가 구현됐고 main worktree에 hook을 설치·smoke 검증했다. branch 이관·원격 보호·원격 CI readback은 미적용이다.
- 보관 기준: [작업 기록 규칙](../../../../README.md)의 `worklog/YYYY-MM-DD/작업명/파일`
- 사용 방법: 아래 프롬프트를 설계·구현 계획을 갱신할 세션에 전달한다. 실행 시점의 source·Git·worktree 상태를 다시 확인한다.

## 실행 프롬프트

Blariyo의 Git 브랜치 전략과 개발 Harness 설계·구현 계획을 수정해줘.

먼저 AGENTS.md와 docs/ai/README.md를 읽고, 현재 Git 상태·브랜치·worktree를 확인해. 이어서 다음 문서를 정본으로 읽어:
- docs/ai/git-workflow.md
- docs/ai/harness-implementation-plan.md
- docs/status.md
- docs/roadmap.md
- 관련 CI, package.json, lint 설정, apps/api·apps/web·apps/collector의 실제 구조와 의존 관계

이번 요청은 문서만 고치는 작업이 아니라, 설계와 구현 계획을 업데이트하는 작업이야. 실제 애플리케이션 코드, lint 설정, CI workflow, Git 설정, hook 설치, 브랜치 생성·변경·삭제는 하지 마. 커밋과 push도 하지 마. 다른 세션의 변경사항을 보존하고, 문서 작업과 무관한 파일은 수정하지 마.

## 1. Git 브랜치 전략 재설계

기존 `main + 짧은 작업 브랜치` 전략을 재검토하고, 아래 브랜치 역할과 흐름을 설계 문서에 반영해.

- `main`: 운영 배포 기준. 검증된 release만 반영.
- `develop`: 다음 release를 통합·검증하는 기본 개발 통합 브랜치.
- `feature/<task-id>-<slug>`: `develop`에서 분기해 기능을 개발하고 `develop`으로 병합.
- `release/<version>`: `develop`에서 분기해 출시 후보를 안정화. 허용 변경, 버전 확정, 검증, 종료 조건을 정의하고 `main`과 `develop` 양쪽으로 반영.
- `hotfix/<task-id>-<slug>`: `main` 또는 실제 운영 SHA에서 분기해 긴급 수정. `main` 배포 후 `develop`과 활성 release 브랜치에 재반영.
- 필요하다면 `support`·장기 유지보수 브랜치의 도입 조건을 별도 판단하되, 기본 전략에 임의로 추가하지 마.

브랜치별 시작점·허용 변경·검증·병합 대상·삭제 시점·예외 흐름을 표와 흐름도로 작성해. merge commit, squash, rebase 중 허용할 전략을 선택하고 근거를 써. 동시 release, 진행 중 feature가 release에서 빠지는 경우, hotfix 중 활성 release가 있는 경우, 충돌 처리, 재반영 누락을 고려해. 모든 브랜치 이름·버전·task ID는 실제 저장소 관례와 대조하고, 불명확한 정책은 `(미정)`으로 남겨.

## 2. Lint 강제 설계

현재 lint 스크립트와 적용 범위를 실제 package/config 기준으로 조사해. 아래를 구현 계획에 넣어:

- 로컬 명령과 CI에서 동일한 lint 명령·설정·대상을 사용하는 계약
- 변경된 파일뿐 아니라 관련 workspace/package 전체 검사 범위
- lint 결과가 필수 CI gate에 연결되는 방식
- lint 설정이나 예외 목록을 낮추는 변경의 추가 검토·검증 방식
- formatter와 linter의 책임 구분 및 자동 수정 정책
- JavaScript/TypeScript, Vue, Java, SQL, shell, 문서 등 실제 저장소 언어별 적용·미적용 현황
- lint 검사 자체가 누락되거나 대상 0개인데 성공 처리되는 경우 차단
- 기존 규칙과 충돌하거나 현재 코드의 부채 때문에 단계 도입이 필요하면 신규 위반과 기존 부채를 분리하는 경로

설정 파일이나 CI workflow는 이번 작업에서 수정하지 마. 현재 도구로 강제할 수 없는 영역은 가능하다고 쓰지 말고 제약으로 기록해.

## 3. Architecture 구조 강제 설계

실제 `apps/`, `packages/`, `scripts/` 구조와 module/package 의존 관계를 조사해 아키텍처 규칙을 정의해. 기존 설계 문서의 구조 계약도 대조해.

최소한 다음을 검토해:

- 허용된 의존 방향과 금지된 역방향·순환 의존
- API/Web/Collector/contracts 및 내부 layer의 책임 경계
- 공개 API·공유 계약·DB migration 변경 시 영향 범위
- architecture test/static check가 어떤 규칙을 검증할지
- 규칙 위반을 PR 필수 CI gate에서 차단하는 방식
- 현재 예외의 정확한 경로·사유·담당·해소 조건
- 디렉터리명만 검사해서 실제 의존 위반을 놓치지 않는 방법
- 구조가 불명확하거나 자동 판정할 수 없는 경우의 수동 검토와 차단 기준

현재 확인한 사실, 설계 제안, 미결정을 구분해. 근거 없이 기존 의존 방향이나 레이어 계약을 단정하지 마.

## 4. 문서 간 정합성

- docs/ai/git-workflow.md와 docs/ai/harness-implementation-plan.md를 함께 수정해 서로 다른 정책이 생기지 않게 해.
- HARN task, 의존 순서, 우선순위, 회귀 테스트 시나리오와 완료 조건을 새 브랜치 전략·lint·architecture gate에 맞게 조정해.
- docs/status.md와 docs/roadmap.md는 현재 상태와 미구현 계획을 정확히 갱신해. 실제 구현이 없으면 완료로 표시하지 마.
- AGENTS.md나 docs/ai/README.md에서 현재 main 직접 개발 또는 기존 전략을 정본처럼 안내한다면, 이번 변경 범위의 문서 정합성만 수정해. 지원 진입점 전체를 임의로 재구성하지 마.
- 링크·task ID·브랜치명·CI job 이름·검증 명령이 실제 파일과 일치하는지 확인해.

## 5. 완료 보고

먼저 문서만 수정하고, 다음을 검증해:
- 설계·구현 계획 사이의 브랜치 흐름과 gate 일치
- 실제 package/lint/CI/architecture 구조와 주장 대조
- 내부 링크와 참조 경로
- 미정·기존 부채·미구현 상태가 숨겨지지 않았는지
- git diff --check와 이번 작업의 변경 파일 목록

작업 완료 때 다음을 구분해서 보고해:
1. 수정된 문서와 핵심 결정
2. 실제 저장소에서 확인한 사실
3. 설계 제안과 미결정 사항
4. 실행한 검증과 결과
5. 구현되지 않은 항목과 다음 구현 순서

다른 세션의 변경, 기존 worktree와 미커밋 파일을 보존하고 문서 범위를 넘어 구현하지 마.
