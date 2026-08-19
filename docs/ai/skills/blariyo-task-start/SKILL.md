---
name: blariyo-task-start
description: Start non-trivial Blariyo planning or system-design work by locating canonical documents, protecting existing changes, defining scope, and selecting evidence. Use for planning, architecture, policy, wireframe, or multi-document change requests; do not use for a trivial one-line answer.
---

# Blariyo 작업 착수

비단순 기획·설계 작업을 시작할 때 범위와 정본을 먼저 고정한다.

## 시작 전

1. `git rev-parse --show-toplevel`로 저장소 루트를 확인한다.
2. 저장소 루트의 `AGENTS.md`와 `docs/ai/README.md`를 처음부터 끝까지 읽는다.
3. `git status --short --branch`로 현재 브랜치와 기존 변경을 확인한다.
4. 요청을 제품 기획, 기술 설계, 법무·정책, 화면, 작업 이력 중 하나 이상으로 분류한다.
5. `docs/ai/README.md`의 정본 지도에서 관련 원문만 선택해 직접 읽는다.

## 작업 경계

- 사용자가 검토·정리·고안만 요청하면 파일을 수정하지 않는다.
- 제품 범위 변경은 planning을 먼저, 구현 방식 변경은 system-design을 먼저 다룬다.
- worklog의 과거 설명을 현재 사실로 사용하지 않는다.
- 실제 source가 없으면 구현·테스트·배포 완료를 주장하지 않는다.
- 결정에 필요한 실값이 없으면 `(미정)`과 필요한 확인 항목을 남긴다.
- task나 session 기록은 사용자가 요청했거나 여러 세션의 인계가 실제로 필요할 때만 만든다.

## 실행

1. 요청 산출물과 제외 범위를 짧게 정의한다.
2. 영향을 받는 정본과 후속 동기화 문서를 목록화한다.
3. 변경 요청이면 정본부터 최소 수정하고, 파생 문서는 사실을 복제하지 않게 링크한다.
4. 문서 링크, 상하위 계약의 모순, 완료 상태 과장을 검사한다.
5. `git diff --check`와 변경 파일 범위를 확인한다.

## 종료 보고

변경 파일, 핵심 결정, 수행한 검증, 미검증·차단 항목을 구분한다. commit과 push는 사용자가
각각 요청하지 않았다면 수행하지 않는다.
