---
name: blariyo-docs-audit
description: Audit Blariyo planning, system-design, legal, publishing, wireframe, and worklog documents for contradictions, missing evidence, stale implementation claims, broken links, and unresolved decisions. Use for review, consistency checks, readiness assessment, or evidence-backed status reports; review only unless edits are explicitly requested.
---

# Blariyo 문서 감사

작성자의 완료 설명을 그대로 신뢰하지 않고 정본, 실제 파일과 Git 상태를 독립적으로 대조한다.

## 시작 전

1. `git rev-parse --show-toplevel`로 저장소 루트를 확인한다.
2. 저장소 루트의 `AGENTS.md`와 `docs/ai/README.md`를 처음부터 끝까지 읽는다.
3. `git status --short --branch`를 확인하고 감사 범위를 확정한다.
4. 관련 planning·legal·system-design 원문과 화면 프로토타입을 직접 읽는다.
5. worklog는 과거 맥락과 반증 후보를 찾는 용도로만 사용한다.

## 감사 관점

- planning의 제품 범위를 system-design이 독자적으로 확대하거나 축소했는가
- 법무 placeholder나 출시 차단 항목이 근거 없이 완료 처리됐는가
- wireframe·publishing이 planning의 화면 상태와 동작을 반영하는가
- source·migration·OpenAPI·test가 없는데 구현 완료라고 적었는가
- 링크 대상, 파일 경로와 문서 상태가 현재 트리와 일치하는가
- 같은 사실이 여러 문서에 복제돼 서로 다른 값으로 drift했는가
- `(미정)`과 미검증 항목을 예시 값이나 추정으로 채웠는가

## 판정과 근거

발견은 중요도 순으로 제시하고 각 항목에 다음을 포함한다.

1. 심각도: Critical, High, Medium, Low
2. 근거: `파일:행`
3. 문제와 실제 영향
4. 정본 또는 반증 자료
5. 최소 수정 방향

확인된 오류와 추가 확인이 필요한 의심을 분리한다. 링크 존재, 문서 작성, 테스트 통과와 실제
요구 충족을 각각 다른 증거로 취급한다.

## 변경 경계와 종료

감사 요청만 받았으면 파일·Git·외부 상태를 변경하지 않는다. 수정까지 요청받았다면 정본을 먼저
고치고 파생 문서를 동기화한 뒤 `git diff --check`와 상대 링크를 재검사한다. 마지막에는 완료,
진행, 미검증, 차단을 나눠 보고한다.
