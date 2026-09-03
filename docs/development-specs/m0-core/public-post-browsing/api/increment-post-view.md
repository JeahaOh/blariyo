# 게시글 조회 수 증가 API Spec

## 문서 정보

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기능: `public-post-browsing`
- 기준일: 2026-09-03
- 입력 근거: [API 설계 §3 조회 수](../../../../system-design/03-api-design.md), [분석·광고 계획 §3](../../../../planning/04-analytics-ad-plan.md)
- 미검증: OpenAPI, source, rate-limit·동시성 test

## 1. 목적과 호출 경계

정상 렌더링된 공개 상세가 참고용 누적 조회 수를 한 번 증가시킨다. 브라우저→BFF→Core
`PostCommandService`→PostgreSQL 순서이며 GA4와 무관하다.

## 2. Method·path·인증·권한

- `POST /api/v1/boards/:boardSlug/posts/:postId/views`
- 인증 없음; `Cache-Control: no-store`
- BFF client IP 기준 `60회/분` 남용 제한

## 3. Request

| 필드 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `boardSlug` | path string | Y | 활성 게시판 | board | 게시판 |
| `postId` | path integer | Y | 양의 정수 | post | 글 번호 |

body·query는 없어야 한다. 방문자·세션 ID, IP, User-Agent를 application DB에 저장하지 않는다.

## 4. Response

성공은 body 없는 `204`다. 오류는 [API 설계 §2](../../../../system-design/03-api-design.md)의 공통
error envelope를 사용한다.

| 항목 | 타입 | 필수 | 제약 | 출처·소유권 | 설명 |
| --- | --- | --- | --- | --- | --- |
| response body | 없음 | Y | `204`에서 비어 있음 | API 계약 | 증가 성공 |
| `Cache-Control` | header | Y | `no-store` | API 계약 | cache 금지 |

## 5. Validation과 정규화

payload가 있으면 `400 VALIDATION_FAILED`다.

## 6. 정상 처리와 데이터 전이

활성 게시판·공개 상태·소속을 조건에 포함한 한 SQL로 `view_count=view_count+1`을 원자 증가한다.
`updatedAt`, actor, `lockVersion`과 개별 조회 이력은 바꾸거나 만들지 않는다.

## 7. 오류·권한·부분 실패

- 비공개·미존재·소속 불일치: `404 POST_NOT_FOUND`
- 제한 초과: `429 RATE_LIMITED`
- DB 장애: `503 DEPENDENCY_UNAVAILABLE`
- 실패는 이미 표시한 상세와 viewCount를 변경하지 않는다.

## 8. 멱등성·동시성·재시도

서버 명령은 멱등하지 않다. 브라우저는 page lifecycle당 한 번 호출하고 자동 재시도하지 않는다.
동시 요청은 원자 증가로 유실만 방지하며 사람 단위 중복은 제거하지 않는다.

## 9. Pagination·cache·호환성

pagination 해당 없음. 응답·오류는 `no-store`다.

## 10. 예시

Request와 성공 응답:

```http
POST /api/v1/boards/meme/posts/1047/views

HTTP/1.1 204 No Content
Cache-Control: no-store
```

실패 `404`:

```json
{
  "success": false,
  "error": { "code": "POST_NOT_FOUND", "message": "게시글을 찾을 수 없습니다.", "fields": [] },
  "meta": { "requestId": "01JEXAMPLE0000000000000000" }
}
```

## 11. Contract test와 미검증

- 빈 payload, payload 거부, 동시 증가, 공개 상태 재검증, rate-limit, UI 비차단을 검증한다.
- 현재 실행 증거는 없다.
