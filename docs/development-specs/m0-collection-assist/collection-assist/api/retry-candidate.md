# 후보 재시도 API

## 1. 작업 목적과 호출 주체·제공 주체

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-04
- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Express Core API
- 입력 근거: [API 설계 §5 재수집과 반려](../../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test, 실제 출처 fetch

`FETCH_FAILED` 후보를 같은 출처 규칙으로 다시 조회하도록 로컬 collector 작업으로 되돌린다.

## 2. Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/retry`
- 관리자 인증 필수
- cache: `private, no-store`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |

## 4. Response

- 성공: 공통 성공 envelope, `candidateId`, `status=PENDING`, 증가한 `lockVersion`
- 실제 재시도 결과는 로컬 collector 제출 뒤 `NEW` 또는 `FETCH_FAILED`가 된다.

## 5. Validation과 정상 처리

1. 후보가 존재하고 `FETCH_FAILED`인지 확인한다.
2. `lockVersion`을 비교한다.
3. 기존 이미지 후보 metadata를 재시도 교체 대상으로 표시한다.
4. 후보를 `PENDING`으로 되돌리고 로컬 collector가 다시 claim할 수 있게 한다.
5. 로컬 collector가 출처 등록·활성 상태, robots, 요청 상한을 다시 확인한다.
6. collector는 기존 후보의 단일 상세 페이지 원문 URL만 다시 fetch하고 parser를 실행한다. 목록·feed·pagination은 호출하지 않는다.
7. 성공하면 기존 이미지 후보 metadata와 로컬 Python 임시 preview 파일을 새 결과로 교체하고 `NEW`로 바꾼다.
8. 실패하면 `FETCH_FAILED`를 유지하고 실패 분류와 `lockVersion`을 갱신한다.
9. 교체되거나 더 이상 참조하지 않는 로컬 Python 임시 이미지 파일은 삭제 대상에 넣는다.

## 6. 오류·동시성

| HTTP | code | 조건 |
| --- | --- | --- |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `409` | `CANDIDATE_STATE_CONFLICT` | `FETCH_FAILED`가 아님 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |
| `403` | `SOURCE_NOT_ALLOWED` | 출처 비활성 또는 사용 결정 전 |
| `403` | `ROBOTS_DISALLOWED` | robots 금지 |
| `429` | `SOURCE_RATE_LIMITED` | 요청 상한 초과 |

## 7. Contract test와 미검증 항목

- `NEW`, `APPROVED`, `REJECTED` 후보 retry 거부
- lockVersion 충돌 거부
- 재시도 접수 시 `PENDING`
- collector 재시도 성공 시 `NEW`
- collector 재시도 실패 시 `FETCH_FAILED`
- 실제 source·OpenAPI·runtime 미검증
