# M0 구현 실행 준비

- 요청: 설계 완료까지 작업 문서를 갱신·커밋하고, 구현 task list와 구현 명령 프롬프트를 Markdown으로 작성한다.
- 담당: Codex / 구현 실행 문서 작성.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/m0-design-completion`.
- 기준: `5ab6dc198b9616bfd270dab2c49c2ec2bde165a7` — M0 설계 완료 문서33개 커밋. 그 부모는 release 기준 `bb19c486`이다.
- 상태: 종료 — 구현 task list·명령 프롬프트 작성과 문서 검증 완료. 시작: 2026-09-26 23:55 KST, 갱신: 23:57 KST.
- 쓰기 범위: 이 폴더의 README·IMPLEMENTATION-TASKS·IMPLEMENTATION-GOAL-PROMPT, 기존 설계 완료 README와 설계 프롬프트의 후속 링크, 구현 task 색인의 실행 문서 링크.
- 다른 담당: `batch-structure-research/README.md`는 별도 세션 기록이며 수정·stage·commit에서 제외한다. 장비·배치 동거 검토를 확정된 운영 구조로 승계하지 않는다.
- 제외: 실제 구현 goal 실행, source·migration·설정 변경, DB/object·계정·운영 장비 접근, 외부 전송, push·merge·배포.

## 산출물과 사용 방법

1. [구현 task list](IMPLEMENTATION-TASKS.md): 기존 17개 ID의 로컬 구현 범위, 의존성, 검증, 실제 운영 잔여를 연결한다.
2. [구현 명령 프롬프트](IMPLEMENTATION-GOAL-PROMPT.md): 새 요청으로 명시적으로 실행할 때 사용할 로컬 구현 goal이다. 작성·커밋만으로 시작하지 않는다.
3. 제품·기술 계약은 [현행 구현 인계표](../../../docs/implementation-tasks/README.md#m0-design-handoff)와 연결된 정본을 따른다. 이 폴더는 실행 계획 기록이며 새로운 제품 정본이 아니다.

설계 완료는 [이전 기록](../m0-design-completion/README.md), 개발 착수 판정은 [후속 확인](../m0-design-completion/DEVELOPMENT-READINESS.md)을 따른다. 다음 goal의 완료는 로컬 구현·검증·운영 인계 범위이며, M0 전체 운영 수용이나 실제 7일 관찰 완료와 구분한다.

## 문서 검증과 결과

- 검증 완료: 기존 17개 ID 누락/중복0, D01~D04의 7+6+6+6개 시험 묶음과 S1~S5 연결, 정본 정책·권한·백업 순서 대조. 명령 블록의 npm script14개 존재 확인. 변경 Markdown6개 상대 링크78개·anchor34개 누락0, 코드 fence·공백·`git diff --check` 통과.
- 기준 명령은 현재 package.json·테스트 안내에서 확인했다. 파일 탐색 첫 시도의 Collector `build.gradle` 경로는 존재하지 않았고 실제 `build.gradle.kts`를 확인했다. 제품 테스트는 이 문서 작업에서 실행하지 않는다.
- 첫 설계 커밋은 `5ab6dc1`이며 예상33개와 실제 commit 경로가 일치함을 재확인했다. 신규 구현 지시 문서와 링크 갱신6개는 `docs: add M0 implementation tasks and goal prompt` 커밋 대상으로 지정했다. 해당 커밋 SHA는 자기 참조 대신 Git 이력과 최종 보고에서 확인한다.
- 다른 담당 기록의 23:52:19 후속 추가를 관측해 읽기 전용 확인했다. 상담 기록만 변경됐으며 담당 경로는 분리돼 있다. 이 세션의 파일 외에는 수정·stage하지 않는다.
- 실제 구현·제품 테스트·외부 연결·운영 인수는 미실행이다. 다음 실행의 필수 로컬 검사가 실패/미실행이면 구현 goal도 완료로 처리하지 않도록 프롬프트에 명시했다.
- 두 커밋의 전체 대상36개 중 Markdown32개를 최종 대조했다. 상대 링크886개·anchor328개 누락0, 이번 허용 범위 밖 기존 파일의 예상하지 못한 변경0. 다른 담당 기록은 별도 변경으로 식별·보존했다.
