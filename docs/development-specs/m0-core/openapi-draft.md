# M0 Core OpenAPI 초안 작성 기준

- 문서 상태: `초안`
- milestone: `M0 Core` (`m0-core`)
- 기준일: 2026-09-03
- 입력 근거: [API 설계](../../system-design/03-api-design.md), [M0 Core 구현 Backlog](implementation-backlog.md)
- 미검증: 새 generated client/server·실제 요청/응답 contract test

이 문서는 새 M0 Core 구현에 사용할 OpenAPI 작성 기준이다.

## 1. 정본과 배치

[docs OpenAPI](openapi/m0-core.yaml)가 개발 시작 입력이다. 새 구현에는 동일 내용을
`packages/contracts/openapi/m0-core.yaml`로 배치하고 BFF 검증·공유 타입·contract test가 이를 사용한다.
기존 프로토타입의 YAML·생성 타입은 승계하지 않는다. 이후 계약 변경은 docs 원본과 구현 사본을
같은 변경에서 맞추고, 둘 중 하나에서 독립적으로 규칙을 추가하지 않는다.

## 2. 계약 탐색

공통 components와 19개 작업(health 포함)의 path·operationId·요청·응답은 [OpenAPI 원본](openapi/m0-core.yaml)을 참조한다.
업무 흐름·에러 처리의 이유는 [API 설계](../../system-design/03-api-design.md), 기능별 보충은 [구현 Backlog](implementation-backlog.md)의 기능 명세 링크를 따른다.
`fields`는 선택 필드이며 파일별 validation 오류 외에 무조건 빈 배열로 넣지 않는다.

## 3. 작성 규칙

- `operationId`는 OpenAPI 원본 값을 유지한다.
- path parameter는 `boardSlug`, `postId`, `imageId`, `type`만 사용한다.
- 관리자 상태 변경 API에는 `Idempotency-Key`를 명시한다.
- 관리자 검색의 유효한 초과 page는 `200` 빈 `items`로 정의한다.
- 공개 목록의 초과 page는 `404 PAGE_NOT_FOUND`로 정의한다.
- 공개 상세의 미존재·비공개·게시판 불일치는 `404 POST_NOT_FOUND`로 일반화한다.
- `M0 수집 보조` endpoint는 이 파일에 넣지 않고 별도 milestone OpenAPI로 분리한다.

## 4. 검증 기준

- OpenAPI schema lint
- example request/response validation
- 기능 명세의 API 절과 OpenAPI path·method·status code 대조
- BFF route, Core route, contract test operationId 일치
- generated client/server가 공통 envelope를 임의 변경하지 않는지 확인
