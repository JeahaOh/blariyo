# Blariyo AI 작업 안내

이 문서는 AI가 필요한 정본을 빠르게 찾고 검증 결과를 같은 기준으로 보고하기 위한 안내다.
제품 요구사항, 법무 문구와 기술 계약을 복제하지 않고 원문 링크만 제공한다.

## 정본 지도

| 작업 질문 | 먼저 읽을 문서 |
| --- | --- |
| 서비스 범위와 단계 | [서비스 기획](../planning/01-service-plan.md) |
| 인프라 방향과 비용 전제 | [인프라 계획](../planning/02-infra-plan.md) |
| 화면 흐름과 상태 | [화면 설계](../planning/03-screen-design.md) |
| 분석·광고 적용 시점 | [분석·광고 계획](../planning/04-analytics-ad-plan.md) |
| 콘텐츠 수집 범위와 규칙 | [서비스 기획 §8](../planning/01-service-plan.md), [시스템 아키텍처](../system-design/01-system-architecture.md), [보안·운영](../system-design/05-security-operations.md) |
| 비교 기준과 수용 조건 | [벤치마크 명세](../planning/05-benchmark-spec.md) |
| 문구와 색상 후보 | [문구 후보](../planning/06-copy-candidates.md), [색상표](../planning/07-color-palette.md) |
| 시스템 경계·DB·API·운영 | [시스템 설계](../system-design/README.md) |
| 약관·개인정보·권리·쿠키 | [법무 문서](../legal/README.md) |
| 정적 화면의 현재 표현 | [퍼블리싱 프로토타입](../publishing/responsive/README.md), [와이어프레임](../wireframes/) — 단계는 화면 설계와 재대조 |
| 과거 작업과 다음 시작점 | [작업 기록](../../worklog/README.md) — 비정본 |

## 작업 유형별 흐름

### 기획 변경

관련 planning 문서를 먼저 수정하고, 영향을 받는 system-design·legal·화면 문서를 찾아
같은 변경에서 동기화할지 후속 작업으로 분리할지 명시한다.

### 기술 설계 변경

상위 planning 범위를 바꾸지 않는지 확인한다. 기술 선택은 대안, 선택 이유, 비용·운영 영향,
되돌리기 조건을 남긴다. 실행 source가 없으면 구현 완료나 테스트 통과로 표시하지 않는다.

### 법무·정책 변경

`docs/legal/README.md`의 출시 차단 항목과 관련 planning을 함께 확인한다. 실제 사업자·수탁자·
연락처·시행일을 확인하지 못했으면 placeholder를 유지하고 법률 확정처럼 표현하지 않는다.

### 화면 변경

planning의 화면 규칙과 publishing·wireframe을 함께 비교한다. HTML이 존재한다는 사실은 제품
구현 완료 증거가 아니라 정적 설계 프로토타입 증거다.

### 작업 이력 확인

`worklog/`는 당시 판단과 검증 기록이다. 오래된 구현 상태, 경로와 선택은 현재 정본·Git·실제
파일로 재확인한다. 새 제품 결정은 worklog에만 기록하지 않고 해당 정본에 반영한다.

## 증거 계약

결과는 가능한 범위에서 다음을 분리한다.

| 상태 | 의미 |
| --- | --- |
| 완료 | 요청 산출물과 필요한 검증이 모두 끝남 |
| 진행 | 일부 산출물 또는 검증이 남음 |
| 미검증 | 문서나 파일은 있으나 실행·화면·외부 상태를 확인하지 않음 |
| 차단 | 사용자 결정, 권한, 실제 값 또는 외부 상태가 필요함 |

- 문서 근거는 `파일:행`으로 제시한다.
- 설계, source, test, build, runtime, 브라우저와 배포 증거를 서로 대신 사용하지 않는다.
- 링크 검사는 파일 존재만 증명하며 내용의 정확성을 증명하지 않는다.
- 과거 PASS 기록은 당시 기준의 증거이며 현재 브랜치 통과로 재사용하지 않는다.

## 프로젝트 스킬

- [blariyo-task-start](./skills/blariyo-task-start/SKILL.md): 비단순 작업의 범위·정본·검증 계획 수립
- [blariyo-docs-audit](./skills/blariyo-docs-audit/SKILL.md): 문서 정합성, 누락, 과장과 stale 상태 검수

`docs/ai/skills/`가 Blariyo 프로젝트 스킬의 편집 정본이다. 현재 Codex 전역 배치본은 아래처럼
`~/.agents/skills/`에 두며, 다른 저장소에서 잘못 적용하지 않도록 각 스킬의 Blariyo 범위를 유지한다.

| 원본 | 현재 Codex 전역 배치 경로 |
| --- | --- |
| `docs/ai/skills/blariyo-task-start/SKILL.md` | `~/.agents/skills/blariyo-task-start/SKILL.md` |
| `docs/ai/skills/blariyo-docs-audit/SKILL.md` | `~/.agents/skills/blariyo-docs-audit/SKILL.md` |

스킬은 `docs/ai/skills/`에서만 수정하고 전역 배치본을 다시 복사한다. 복사 후 두 파일을 `diff`
또는 SHA-256으로 비교해 동일성을 확인한다. `~/.agents/skills/`의 배치본을 별도 정본으로 운영하지 않는다.
