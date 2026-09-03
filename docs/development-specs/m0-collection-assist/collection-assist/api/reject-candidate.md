# 후보 반려 API

## 1. 작업 목적과 호출 주체·제공 주체

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-03
- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Express Core API
- 입력 근거: [API 설계 §5 재수집과 반려](../../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test

운영자가 후보를 공개 게시글로 쓰지 않기로 결정하고 반려 사유를 남긴다.

## 2. Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/reject`
- 관리자 인증 필수
- cache: `private, no-store`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |
| `reasonCode` | string | Y | 허용 코드 | 반려 사유 |

허용 reason code: `DUPLICATE`, `LOW_QUALITY`, `RIGHTS_RISK`, `NOT_FUNNY`, `SOURCE_GONE`, `OTHER`.

## 4. Response

- 성공: 공통 성공 envelope, `candidateId`, `status=REJECTED`, `reviewedAt`, 증가한 `lockVersion`

## 5. 정상 처리와 상태 전이

- `NEW`와 `FETCH_FAILED`에서만 허용한다.
- 성공 시 `reviewedAt`과 `rejectReasonCode`를 기록한다.
- `APPROVED`, `REJECTED`는 terminal 상태로 반려할 수 없다.

## 6. 오류·동시성

| HTTP | code | 조건 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | reasonCode 누락·허용값 아님 |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `409` | `CANDIDATE_STATE_CONFLICT` | 반려 불가 상태 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |

## 7. Contract test와 미검증 항목

- 허용 reason code만 통과
- `APPROVED` 후보 반려 거부
- lockVersion 충돌 거부
- 실제 source·OpenAPI·runtime 미검증

