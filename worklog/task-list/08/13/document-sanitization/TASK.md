# TASK — AI 협업 문서의 로컬·비교 프로젝트 정보 중립화

- 작성일: 2026-08-13
- 업무 영역: `document-sanitization`
- 상태: 완료 — 문서 중립화 및 정적 검증 완료
- 작업자: Codex
- 변경 범위: 이번 AI 협업 체계 검토에서 새로 만든 Markdown 문서

## 1. 목표

공유 또는 재사용 가능한 문서에 로컬 사용자명, 볼륨명, 절대경로, 비교 프로젝트의
조직·저장소·도구 고유명이 남지 않도록 중립화한다. Blariyo의 기술적 의사결정,
검수 근거, 보안 패치의 의미와 적용 대기 상태는 유지한다.

## 2. 치환 원칙

- 로컬 절대경로는 `<project-root>`, `<artifact-dir>`, `<temporary-dir>`로 표현한다.
- 비교 원본은 `기존 대규모 프로젝트의 협업 체계` 또는
  `<reference-project>`로 표현한다.
- Blariyo 저장소 안의 산출물은 가능한 한 저장소 상대경로로 기록한다.
- 조직 전용 저장소명, 데이터베이스명, 관리 도구명은 역할 중심 표현으로 바꾼다.
- 일반적인 Node.js 기술 용어와 Blariyo 자체 파일·앱 이름은 유지한다.

`<project-root>`는 현재 Blariyo 저장소 루트, `<artifact-dir>`는 저장소 외부의
문서 산출물 보관 디렉터리, `<temporary-dir>`는 과거 임시 검수본 보관 디렉터리다.

## 3. 변경 대상

- `worklog/task-list/08/13/ai-governance/*.md`
- `worklog/task-list/08/13/` 아래 이번 작업에서 만든 Markdown 문서와 산출물
- `<artifact-dir>/blariyo-ai-governance-adoption-draft-20260813.md`
- 이 작업 기록

## 4. 보존 경계

- `worklog/task-list/08/13/security-hotfix/artifacts/security-hotfix.patch`는
  검수된 코드 변경분이므로 수정하지 않는다.
- `apps/blariyo.core/`는 기존 미추적 작업으로 수정하지 않는다.
- 원본 애플리케이션 코드, 기존 로그, Git index는 수정하지 않는다.
- commit과 push는 수행하지 않는다.

## 5. 검증 결과

- 금지된 프로젝트명·사용자 절대경로·볼륨 고유명 검색: 0건
- 비교 프로젝트의 저장소·데이터베이스·도구 고유명 검색: 0건
- Markdown fenced code block 열림·닫힘 짝 검사: 통과
- trailing whitespace 검사: 통과
- 저장소 상대경로로 바꾼 보안 패치와 핸드오프 경로 확인: 통과
- 보안 패치 SHA-256 보존 확인: 통과
- 기존 `apps/blariyo.core/`와 패치 파일 미수정 확인: 통과
- 독립 검수 지적 3건(테스트 상태 모순, 조직 전용 표현, placeholder 설명): 수정 후 통과
- 보안 패치 SHA-256:
  `16d799eeb96c1a78fb0064a004703c22f8a9fd17f682ed9cea5be32a91e2f409`

## 6. 상태

문서 중립화는 완료했다. 이 작업은 문서 표현만 정리했으며, 보안 패치를 원본 코드에
적용하거나 기존 민감 로그를 삭제한 작업이 아니다.
