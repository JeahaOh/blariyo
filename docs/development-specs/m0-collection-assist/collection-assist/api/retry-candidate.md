# 후보 재시도 API

## 1. 작업 목적과 호출 주체·제공 주체

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-03
- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Express Core API
- 입력 근거: [API 설계 §5 재수집과 반려](../../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test, 실제 출처 fetch

`FETCH_FAILED` 후보를 같은 출처 규칙으로 다시 조회한다.

## 2. Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/retry`
- 관리자 인증 필수
- cache: `private, no-store`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |

## 4. Response

- 성공: 공통 성공 envelope, `candidateId`, `status`, 증가한 `lockVersion`, `imageCandidateCount`
- 성공 상태는 재시도 결과에 따라 `NEW` 또는 `FETCH_FAILED`

## 5. Validation과 정상 처리

1. 후보가 존재하고 `FETCH_FAILED`인지 확인한다.
2. `lockVersion`을 비교한다.
3. 출처 allowlist, robots, 요청 상한을 다시 확인한다.
4. 원문 URL을 다시 fetch하고 parser를 실행한다.
5. 성공하면 기존 이미지 후보 metadata를 새 결과로 교체하고 `NEW`로 바꾼다.
6. 실패하면 `FETCH_FAILED`를 유지하고 실패 분류와 `lockVersion`을 갱신한다.

## 6. 오류·동시성

| HTTP | code | 조건 |
| --- | --- | --- |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `409` | `CANDIDATE_STATE_CONFLICT` | `FETCH_FAILED`가 아님 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |
| `403` | `SOURCE_NOT_ALLOWED` | 출처 비활성 또는 미승인 |
| `403` | `ROBOTS_DISALLOWED` | robots 금지 |
| `429` | `SOURCE_RATE_LIMITED` | 요청 상한 초과 |

## 7. Contract test와 미검증 항목

- `NEW`, `APPROVED`, `REJECTED` 후보 retry 거부
- lockVersion 충돌 거부
- 재시도 성공 시 `NEW`
- 재시도 실패 시 `FETCH_FAILED`
- 실제 source·OpenAPI·runtime 미검증

