# Discord·운영자 URL 지정 후보 생성 API

## 1. 작업 목적과 호출 주체·제공 주체

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-03
- 호출 주체: Nuxt BFF 관리자 화면, Discord Interactions handler
- 제공 주체: Express Core API
- 입력 근거: [API 설계 §5 Discord·운영자 URL 지정 후보 생성](../../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test, 실제 출처 fetch

운영자가 관리자 화면 또는 Discord `/collect url`로 입력한 단일 상세 페이지 원문 URL을 등록·활성 출처
규칙으로 한 번 조회해 수집 후보를 만든다. 목록·feed·pagination은 이 API에서 호출하지 않는다.

## 2. Method·path·인증·권한

- `POST /api/v1/admin/collect/candidates`
- 관리자 인증 필수
- `Idempotency-Key` 필수
- cache: `private, no-store`

Discord에서 시작한 경우에도 외부 공개 Core API를 추가하지 않는다. Interactions handler가 Discord
서명·guild·channel·user 권한을 검증한 뒤 같은 관리자 후보 생성 service를 호출한다. Discord incoming
webhook은 처리 결과 알림용으로만 사용한다.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `originUrl` | string | Y | `https`, 최대 2048자 | 입력값 | 운영자가 지정한 원문 URL |

```json
{ "originUrl": "https://example.com/board/12345" }
```

## 4. Response

공통 성공 envelope를 사용한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `candidateId` | number | 생성 또는 실패 기록된 후보 ID |
| `status` | string | `NEW` 또는 `FETCH_FAILED` |
| `lockVersion` | number | 최초 `1` |
| `duplicatePostId` | number 또는 null | 같은 원문 URL의 기존 게시글 |
| `imageCandidateCount` | number | 저장한 이미지 후보 metadata 수 |

## 5. Validation과 정규화

- `originUrl`은 `https`만 허용한다.
- 서버 정규화 뒤 host가 등록·활성 출처와 일치해야 한다.
- 이용약관 판단은 자동 차단 조건이 아니라 운영 위험 참고값이다.
- 사설·loopback·link-local·metadata 주소로 해석되면 거부한다.
- 출처 `robots.txt`가 해당 경로를 금지하면 fetch하지 않는다.
- 요청 간격과 일일 상한을 넘으면 fetch하지 않는다.

## 6. 정상 처리와 데이터·상태 전이

1. 관리자 actor와 idempotency key를 검증한다.
2. URL을 정규화한다.
3. `collect.source` 활성 출처와 host를 대조한다.
4. robots·요청 상한·DNS 안전성·redirect 경계를 확인한다.
5. 상세 페이지를 1회 fetch한다.
6. 출처별 parser로 제목과 이미지 후보 URL을 추출한다.
7. Python extractor는 미리보기에 필요한 이미지 후보만 작업 경로에 임시 저장한다.
8. `collect.candidate`, `collect.candidate_image` metadata와 preview 식별자를 저장한다.
9. 성공 추출이면 `NEW`, 실패 추출이면 `FETCH_FAILED`로 만든다.

## 7. 오류·권한·충돌·timeout·부분 실패

| HTTP | code | 조건 |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | URL 형식·길이 오류 |
| `401` | `ADMIN_AUTH_REQUIRED` | 관리자 인증 없음 |
| `403` | `ADMIN_FORBIDDEN` | allowlist 불일치 |
| `403` | `SOURCE_NOT_ALLOWED` | 등록·활성 출처가 아님 |
| `403` | `ROBOTS_DISALLOWED` | robots 금지 |
| `409` | `CANDIDATE_DUPLICATE` | 같은 정규화 URL 후보 존재 |
| `429` | `SOURCE_RATE_LIMITED` | 요청 간격·일일 상한 초과 |
| `503` | `DEPENDENCY_UNAVAILABLE` | DB 등 내부 의존성 장애 |

fetch·timeout·비HTML·parser 실패는 후보를 `FETCH_FAILED`로 만들고 `201`을 반환한다.

## 8. 멱등성·동시성·재시도

- 같은 actor·method·route·idempotency key는 같은 결과를 반환한다.
- 같은 정규화 URL 동시 요청은 unique constraint로 중복 생성을 막는다.
- 운영자 재시도는 별도 `retry` API를 사용한다.

## 9. Contract test와 미검증 항목

- 등록되지 않은 host `403`
- robots 금지 `403`
- Discord 권한 없는 guild·channel·user 거부
- 중복 후보 `409`
- fetch 실패 시 `201` + `FETCH_FAILED`
- 원문 HTML·내부 오류·secret 로그 미기록
- Python 임시 이미지 파일의 내부 절대 경로·binary 로그 미기록
- 실제 source·OpenAPI·runtime 미검증
