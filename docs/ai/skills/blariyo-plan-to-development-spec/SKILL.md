---
name: blariyo-plan-to-development-spec
description: Create or update one Blariyo feature Markdown spec from planning, legal and system-design. Consolidate API notes, process flows and screen contracts in the existing feature file; reference OpenAPI and canonical documents instead of duplicating them. Not for direct coding or deployment.
---

# Blariyo 기능 명세 작성

기능마다 `docs/development-specs/<milestone>/<feature-slug>/<feature-slug>.dev.md` 하나를 관리한다.
API·D01·D08은 API 계약·처리 흐름·화면/프로그램을 뜻하는 관점이며 별도 파일 생성 의무가 아니다.
사용자가 승인한 docs 축소 원칙에 따라 기존 기능 문서를 갱신하고 작은 변경에 새 보고서를 만들지 않는다.

## 시작과 범위

1. 저장소 루트, AGENTS와 [AI 안내](../../README.md), Git 상태를 확인한다.
2. [정본 라우팅](references/canonical-routing.md)에 따라 관련 planning·legal·system-design을 직접 읽는다.
3. 기능의 현재 명세 전체를 읽고 milestone·권한·미정·기존 변경을 확인한다.
4. 요청이 검토인지 변경인지 구분한다. 변경 권한은 사용자 요청 범위를 따르며 코드·migration·배포로 확대하지 않는다.

## 작성 순서

1. 목적·범위·행위자·진입 조건을 정리한다. 기능·단계를 확대하거나 축소하지 않는다.
2. [산출물 계약](references/artifact-contracts.md)에 따라 기능 고유 API 처리, 사용자 흐름과 화면 상태를 같은 파일에 연결한다.
3. OpenAPI에 있는 타입·필수 여부·응답 정의는 링크한다. YAML에 없는 업무 제약·호출 경계·실패 처리·데이터 매핑은 남긴다.
4. UI 동작을 처리 흐름과 API 또는 `API 해당 없음`에 연결한다. 고유 anchor를 써서 다른 문서가 해당 절을 참조하게 한다.
5. [품질 게이트](references/spec-quality-gates.md)로 정본·예외·링크·기존 내용 보존을 검증한다.

## 경계와 보고

- 제품 결정은 planning, 법무 본문·차단은 legal, 공통 기술 계약은 system-design이 소유한다.
- 미확정 ID·URL·사업자·운영값은 `(미정)`으로 남기고 법무 placeholder를 제거하지 않는다.
- 상위 정본과 충돌하면 확정된 정본·사용자 결정을 우선한다. 새 결정이 필요한 충돌은 기록하고 임의 확정하지 않는다.
- 기능별 파일 하나에 대한 예외 분리는 고유 계약을 안전하게 유지하기 어려운 근거와 사용자 요청이 있을 때만 한다.
- source·test·build·runtime은 문서 상태와 별도로 보고한다. 미실행 검증을 PASS로 쓰지 않는다.
- docs만 요청받으면 전역 스킬 복사본·소스·루트 지침을 변경하지 않는다. 외부 파일 의존성이 있으면 확인 결과를 보고한다.
- commit·push는 각각 요청된 경우에만 수행한다.
