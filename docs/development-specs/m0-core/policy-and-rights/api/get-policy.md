# 정책 버전 조회 API Spec

## 문서 정보

- 문서 상태: `차단`
- milestone: `M0 Core`
- 기능: `policy-and-rights`
- 기준일: 2026-09-02
- 입력 근거: [API 설계 §3 정책](../../../../system-design/03-api-design.md), [데이터 모델 §4](../../../../system-design/02-data-model.md)
- 미검증: 승인 본문·시행일, OpenAPI, source, contract test

## 1. 목적과 호출 경계

공개 화면과 SSR이 현재 또는 지정 과거 정책 전문과 전체 공개 이력을 읽는다. 외부 제공자는 Nuxt
BFF, 내부 제공자는 Core `PolicyQueryService`이며 초안·정제 전 원문은 어느 경계에서도 반환하지 않는다.

## 2. Method·path·인증·권한

`GET /api/v1/policies/:type?version=v0.2`; 인증 없음; `public, max-age=60, s-maxage=300`.

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `type` | path enum | Y | `terms`,`privacy` | policy_type mapping | 유형 |
| `version` | query string | N | 공개된 version label | policy | 생략 시 current |

body 없음.

## 4. Response

`data.policy`: `type,version,title,bodyHtml,effectiveAt,endedAt`; `data.history[]`: version과 적용 시각.
공통 envelope는 API 설계 §2를 참조한다.

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `data.policy.type` | enum | Y | `terms`,`privacy` | `policy_type` | 정책 유형 |
| `data.policy.version` | string | Y | 공개 version label | policy | 표시 버전 |
| `data.policy.title` | string | Y | 승인된 제목 | policy | 문서 제목 |
| `data.policy.bodyHtml` | string | Y | allowlist 정제 완료 | policy | 공개 전문 |
| `data.policy.effectiveAt` | ISO 8601 | Y | UTC | policy | 시행 시작 |
| `data.policy.endedAt` | ISO 8601/null | Y | current면 null | policy | 시행 종료 |
| `data.history[].version` | string | Y | 공개 version | policy | 이력 버전 |
| `data.history[].effectiveAt` | ISO 8601 | Y | UTC | policy | 이력 시작 |
| `data.history[].endedAt` | ISO 8601/null | Y | 반개방 구간 | policy | 이력 종료 |

## 5. Validation과 정규화

허용 type/version만 조회한다. `bodyHtml`은 저장 전 정제 완료 값이며 BFF가 다시 내부 field를 제거한다.

## 6. 정상 처리와 데이터 전이

생략 version은 유형별 `EFFECTIVE`, 지정 version은 `EFFECTIVE|RETIRED`를 읽는다. 쓰기·상태 전이 없음.

## 7. 오류·권한·충돌·부분 실패

유형·version 미존재/초안은 `404 POLICY_NOT_FOUND`; DB 장애 `503`; 오류 응답 no-store.

## 8. 멱등성·동시성·재시도

멱등 read. 정책 시행 경계에서 ETag/cache purge로 current 전환을 반영한다.

## 9. Pagination·cache·호환성

history pagination 없음. body hash ETag와 `304`를 지원한다.

## 10. 예시

Request:

```http
GET /api/v1/policies/privacy?version=v0.2
```

성공 `200`:

```json
{
  "success": true,
  "data": {
    "policy": {
      "type": "privacy",
      "version": "v0.2",
      "title": "개인정보처리방침",
      "bodyHtml": "<h2>...</h2>",
      "effectiveAt": "2026-07-01T00:00:00.000Z",
      "endedAt": "2026-08-13T00:00:00.000Z"
    },
    "history": [
      { "version": "v0.3", "effectiveAt": "2026-08-13T00:00:00.000Z", "endedAt": null },
      { "version": "v0.2", "effectiveAt": "2026-07-01T00:00:00.000Z", "endedAt": "2026-08-13T00:00:00.000Z" }
    ]
  },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

실패 `404`는 공통 오류 envelope와 `POLICY_NOT_FOUND`만 반환하며 초안 존재 여부를 노출하지 않는다.

```json
{
  "success": false,
  "error": { "code": "POLICY_NOT_FOUND", "message": "(미정)", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

현재·과거·초안 비공개, sanitize, 반개방 기간 경계, cache purge를 검증한다. 승인 실값과 실행 증거가 없어 `차단`이다.
