# Blariyo 문서 안내

현재 기준과 실행 지침을 찾는 진입점이다. 수행 당시의 결과·보고서는 [작업 기록](../worklog/README.md)에 보관한다.

| 찾는 내용 | 위치 | 관리 원칙 |
| --- | --- | --- |
| 지금 어디까지 진행됐는가 | [현재 상태](status.md) | 구현·로컬 검증·운영 수용을 구분 |
| 다음에 무엇을 해야 하는가 | [로드맵](roadmap.md) | 남은 작업·우선순위·완료 조건·미정 결정 |
| 요구사항별 근거는 무엇인가 | [요구사항 대조](development-specs/requirements-status.md) | ID별 source·증거·잔여 조건 |
| 제품·화면·운영 정책 | [기획](planning/01-service-plan.md) | 제품 범위의 정본 |
| 법무·권리·개인정보 | [법무](legal/README.md) | 고지 본문·미정·활성화 조건 보존 |
| 아키텍처·DB·API·보안 | [기술 설계](system-design/README.md) | 기술 계약의 정본 |
| 기능별 구현 계약 | [개발 명세](development-specs/) | 기능별 API·업무 흐름·수용 조건 |
| 실행 환경·배포·백업·복구 | [운영 안내](operations/README.md) | 문서는 지침, deploy는 실행 도구 |
| 테스트·운영자 인수 | [검증 안내](testing/README.md), [인수 기록](testing/operator-acceptance.md) | 합성 검사와 실제 인수 구분 |
| 정적 화면 검토물 | [화면 자료](ui/README.md) | 제품 정본과 구분 |
| AI 작업 지침 | [AI 안내](ai/README.md) | 경로 탐색·정본·검증 규칙 |
| 계약 변경 검사 입력 | [계약 baseline](migration/contract-baseline.json), [변경 이력](migration/contract-evolution.json) | 자동 검사 경로 유지, 수동 재작성 금지 |

## 파일을 추가할 때

- 상태는 status.md, 앞으로 할 일은 roadmap.md에 갱신한다. 날짜별 진행 문서를 docs에 중복 생성하지 않는다.
- 수행 기록은 `worklog/YYYY-MM-DD/작업명/`에 두며 다른 날짜의 사실을 현재 상태로 덮어쓰지 않는다.
- 운영 실행 파일과 사용법은 deploy의 인접 README에 둔다. 공통 운영 절차는 docs/operations가 소유한다.
- 자동 생성 타입·schema, DB migration, 원본 fixture는 앱/패키지의 기존 경로에서 관리한다.
- 디렉터리 재구성의 이동표·검증은 [정리 기록](../worklog/2026-09-23/directory-reorganization/RESULTS.md)을 따른다.
