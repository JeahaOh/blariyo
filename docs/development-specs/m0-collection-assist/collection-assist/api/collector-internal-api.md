# Collector 내부 API Spec

## 1. 작업 목적과 호출 주체·제공 주체

- 문서 상태: `초안`
- milestone: `M0 수집 보조`
- 기능: `collection-assist`
- 기준일: 2026-09-04
- 호출 주체: 운영자 로컬 collector
- 제공 주체: Express Core API internal route
- 입력 근거: [API 설계 §5-1 수집 관리자 API](../../../../system-design/03-api-design.md)
- 미검증: source, OpenAPI, contract test, 실제 Discord Gateway·출처 fetch

로컬 collector가 관리자 화면에서 접수된 `PENDING` 후보를 선점하거나 Discord `/collect url` 명령으로
생성한 결과를 BE에 제출한다. 이 API는 브라우저와 Nuxt BFF 공개 계약이 아니며 collector service token
없이는 호출할 수 없다.

## 2. Endpoint 목록

| Method | Path | 역할 |
| --- | --- | --- |
| `POST` | `/internal/collect/candidates/claim` | 처리 가능한 후보 선점 |
| `POST` | `/internal/collect/candidates/{candidateId}/heartbeat` | 처리 중 lease 연장 |
| `POST` | `/internal/collect/candidates/{candidateId}/result` | 추출 성공·실패 결과 제출 |
| `POST` | `/internal/collect/candidates/{candidateId}/images/{candidateImageId}/preview` | 관리자 preview 파일 업로드 |

## 3. 공통 인증·권한

- `Authorization: Bearer <collector service token>` 필수.
- token은 candidate claim, result submit, preview upload 전용이다.
- token 값은 log, Discord 메시지, error response, Git에 남기지 않는다.
- 모든 응답은 공통 envelope를 사용하되 내부 storage key와 원문 HTML을 반환하지 않는다.

## 4. 후보 Claim

`POST /internal/collect/candidates/claim`

```json
{
  "collectorId": "local-macbook-main",
  "maxItems": 1,
  "leaseSeconds": 300
}
```

- `maxItems`는 M0에서 `1~5`만 허용한다.
- `leaseSeconds`는 `60~900`초만 허용한다.
- Core는 `PENDING` 후보 또는 `lease_until < now()`인 `RUNNING` 후보를 `FOR UPDATE SKIP LOCKED`로 선점한다.
- 선점 시 `status=RUNNING`, `collector_id`, `claimed_at`, `lease_until`, `attempt_count+1`, `lock_version+1`을 저장한다.
- 응답 item은 `candidateId`, `sourceId`, `sourceHost`, `originUrl`, `discoveryMode`, `attemptCount`,
  `leaseUntil`, `requestIntervalMs`, `dailyFetchLimit`, `robotsAllowed`, `robotsCheckedAt`을 포함한다.
- 처리 대상이 없으면 `200`과 빈 `items`를 반환한다.

## 5. Heartbeat

`POST /internal/collect/candidates/{candidateId}/heartbeat`

```json
{
  "collectorId": "local-macbook-main",
  "leaseSeconds": 300,
  "lockVersion": 4
}
```

- 현재 후보가 `RUNNING`이고 `collector_id`와 `lockVersion`이 일치할 때만 허용한다.
- 성공하면 `lease_until`과 `lockVersion`을 갱신한다.
- lease가 이미 만료됐거나 다른 collector가 선점했으면 `409 CANDIDATE_LEASE_CONFLICT`다.

## 6. Result Submit

`POST /internal/collect/candidates/{candidateId}/result`

성공:

```json
{
  "collectorId": "local-macbook-main",
  "lockVersion": 5,
  "status": "NEW",
  "title": "후보 제목",
  "canonicalUrl": "https://example.com/board/12345",
  "sourcePublishedAt": null,
  "parserVersion": "example-v1",
  "warnings": [],
  "imageCandidates": [
    { "position": 1, "remoteUrl": "https://example.com/image/1.jpg" }
  ]
}
```

실패:

```json
{
  "collectorId": "local-macbook-main",
  "lockVersion": 5,
  "status": "FETCH_FAILED",
  "fetchErrorCode": "ROBOTS_DISALLOWED",
  "warnings": ["robots_disallowed"]
}
```

- 현재 후보가 `RUNNING`이고 `collector_id`, `lockVersion`, `lease_until`이 유효할 때만 허용한다.
- 성공 status는 `NEW`, 실패 status는 `FETCH_FAILED`만 허용한다.
- 성공 시 기존 후보 이미지 metadata를 교체하고 최대 20건만 저장한다.
- 실패 시 `fetch_error_code`를 필수로 저장한다.
- result 처리 후 `lease_until`은 `NULL`로 비운다.
- 원문 HTML, 원문 이미지 binary, local temp path, stack trace는 request에 넣지 않는다.

## 7. Preview Upload

`POST /internal/collect/candidates/{candidateId}/images/{candidateImageId}/preview`

- `multipart/form-data`
- 필드: `collectorId`, `lockVersion`, `file`
- 파일 제한: 10MiB 이하, JPEG·PNG·WebP·GIF
- Core는 관리자 업로드와 같은 MIME·magic byte·decode·pixel 검증을 적용한다.
- 성공하면 private staging object로 저장하고 `preview_storage_key`, `preview_expires_at=now()+24h`를 기록한다.
- 응답에는 `candidateImageId`, `previewPath`, `previewExpiresAt`만 반환하고 storage key는 반환하지 않는다.

## 8. 오류 코드와 수용 기준

| HTTP | code | 조건 |
| --- | --- | --- |
| `401` | `COLLECTOR_AUTH_REQUIRED` | token 없음·만료·불일치 |
| `403` | `COLLECTOR_FORBIDDEN` | token scope 불일치 |
| `404` | `CANDIDATE_NOT_FOUND` | 후보 없음 |
| `409` | `CANDIDATE_LEASE_CONFLICT` | lease 만료·다른 collector 선점·lockVersion 불일치 |
| `409` | `CANDIDATE_STATE_CONFLICT` | 현재 상태에서 처리 불가 |
| `413` | `UPLOAD_TOO_LARGE` | preview 파일 크기 초과 |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | preview 파일 형식·decode 실패 |

- 같은 후보를 두 collector가 동시에 처리하지 않는다.
- `RUNNING`이 lease 만료 뒤 다시 claim될 수 있다.
- collector가 중단돼도 공개 목록·상세, 관리자 수동 작성과 발행은 계속 동작한다.
- preview가 만료돼도 후보 metadata는 유지하고, 승격 전 재업로드 또는 운영자 직접 업로드를 요구한다.
