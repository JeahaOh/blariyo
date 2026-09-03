# 후보 초안 승격 API

## 1. 작업 목적과 호출 주체·제공 주체

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-03
- 호출 주체: Nuxt BFF 관리자 화면
- 제공 주체: Express Core API
- 입력 근거: [API 설계 §5 후보 초안 승격](../../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, R2 runtime, contract/integration test

운영자가 검수한 후보를 기존 관리자 초안 생성 흐름으로 넘긴다.

## 2. Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates/{candidateId}/draft`
- 관리자 인증 필수
- `Idempotency-Key` 필수
- cache: `private, no-store`

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lockVersion` | number | Y | 현재 후보 값과 일치 | 낙관적 잠금 |
| `boardSlug` | string | Y | 활성 관리자 작성 대상 | 초안 게시판 |
| `title` | string | N | 생략 시 후보 제목 사용 | 게시글 제목 |
| `source.name` | string | N | 생략 시 출처 표시명 | 출처명 |
| `source.url` | string | N | 생략 시 후보 원문 URL | 출처 링크 |
| `candidateImageIds` | array | Y | 1~20개 | 저장할 이미지 후보 |
| `leadText` | string | N | TEXT block | 첫 문단 |
| `acknowledgeDuplicate` | boolean | Y | 중복 후보면 true 필요 | 중복 확인 |

## 4. Response

- 성공: `201`
- 공통 성공 envelope
- `data.postId`, `data.status=DRAFT`, `data.lockVersion=1`, `data.candidateId`, `data.storedImageIds`

## 5. Validation과 정상 처리

1. 후보가 `NEW`인지 확인한다.
2. `lockVersion`과 중복 확인 값을 검증한다.
3. 선택 이미지가 모두 해당 후보의 이미지 후보인지 확인한다.
4. 선택 이미지를 `SourceFetcher`로 가져온다.
5. 관리자 업로드와 같은 MIME·magic byte·decode·pixel·재인코딩 검증을 적용한다.
6. private 원본 bucket에 저장한다.
7. 기존 게시글 초안 생성 command를 재사용해 title, source, TEXT/IMAGE block을 만든다.
8. 같은 transaction에서 후보를 `APPROVED`로 바꾸고 `postId`를 연결한다.

## 6. 오류·부분 실패

| HTTP | code | 조건 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | 제목 없음, 이미지 후보 배열 오류 |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `404` | `BOARD_NOT_FOUND` | 작성 대상 게시판 없음·비활성 |
| `409` | `CANDIDATE_STATE_CONFLICT` | `NEW`가 아님 |
| `409` | `CANDIDATE_VERSION_CONFLICT` | lockVersion 불일치 |
| `409` | `CANDIDATE_DUPLICATE` | 중복 후보 확인 누락 |
| `502` | `SOURCE_FETCH_FAILED` | 선택 이미지 저장 실패 |
| `503` | `DEPENDENCY_UNAVAILABLE` | DB·R2 장애 |

하나도 저장하지 못하면 후보를 `NEW`로 유지하고 `502 SOURCE_FETCH_FAILED`를 반환한다. DB transaction
실패 시 후보 상태는 바꾸지 않고 저장된 이미지는 staging orphan 정리 대상으로 둔다.

## 7. 멱등성·동시성·재시도

- `Idempotency-Key`는 같은 actor·method·route scope에서 24시간 보존한다.
- 같은 key에 다른 body는 `409 IDEMPOTENCY_CONFLICT`다.
- 후보 lockVersion으로 동시 승격을 막는다.

## 8. Contract test와 미검증 항목

- 중복 후보 확인 누락 시 `409`
- 선택 이미지 0건·21건 validation 실패
- 이미지 fetch 실패 시 후보 `NEW` 유지
- 초안 생성 성공 시 후보 `APPROVED`
- transaction 실패와 orphan cleanup 분류
- 실제 source·OpenAPI·R2 runtime 미검증

