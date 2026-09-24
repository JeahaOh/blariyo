# M0 Core OpenAPI 초안 작성 기준

- 문서 상태: 현행 M0 Core OpenAPI 작성·동기화 기준. 파일명은 초기 초안 단계의 이름을 유지한다.
- milestone: `M0 Core` (`m0-core`)
- 기준일: 2026-09-03
- 입력 근거: [API 설계](../../system-design/03-api-design.md), [M0 Core 구현 Backlog](implementation-backlog.md)
- 검토일: 2026-09-24. docs/구현 YAML의 동일성·19개 operation·생성기/검증 runtime 연결을 정적으로 확인했다. 실행 결과는 [검증 기록](../../../README.md#검증)이며 이번 검토에서 contract test를 재실행하지 않았다.

이 문서는 M0 Core OpenAPI의 작성·변경 기준이다.

## 1. 정본과 배치

[docs OpenAPI](openapi/m0-core.yaml)가 개발 시작 입력이다. 현행 구현은 동일 내용의
`packages/contracts/openapi/m0-core.yaml`과 생성 타입/runtime schema를 BFF 검증·공유 타입·contract test에 사용한다.
기존 프로토타입의 YAML·생성 타입을 승계하지 않고 구축했다. 이후 계약 변경은 docs 원본과 구현 사본을
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

## 2026-09-24 구조화 계약 대조의 잔여

- 문서용 OpenAPI 2개는 `packages/contracts/openapi/` 사본과 바이트가 같다. migration baseline/evolution의 대상27개 해시가 일치한다. 기존 계약을 문서 정리 과정에서 생성·변경하지 않았다.
- 인증 표기의 `BLARIYO_ADMIN_SESSION`은 로컬 시험 cookie다. 실제 production BFF는 Cloudflare Access의 JWT assertion과 운영자 allowlist를 검증한다. M0 Core OpenAPI의 `/health/ready` 표기과 별개로 Web production readiness는 관리자 인증 실패 시 `503 NOT_READY`다. 기계 명세의 인증 설명·환경별 보안 표기를 후속 계약 변경에서 맞춰야 한다.
- legacy 후보 preview의 OpenAPI 성공 MIME은 `image/png`만 기술돼 있으나 구현은 검증된 JPEG/PNG/WebP/GIF를 반환한다. 실제 Content-Type을 제한하는 계약과 문서 표현을 동기화해야 하며, 이번 문서 작업에서 API/생성 타입은 수정하지 않았다.
- legacy 결과의 `attachmentCandidates` 및 1000/40블록 불일치는 [수집 명세](../m0-collection-assist/collection-assist/collection-assist.dev.md)의 후속 항목이다. 이 검토는 API runtime 재실행이 아니다.
