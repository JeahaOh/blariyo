# M0 Core 추천 결정안

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기준일: 2026-09-02
- 목적: [결정 필요 항목](open-decisions.md)의 각 항목에 대해 사용자가 선택할 수 있는 추천안을 제시한다.
- 범위: `M0 Core` 개발 Spec 결정 항목 `OD-M0-001`부터 `OD-M0-013`
- 미검증: source, migration, OpenAPI, test, build, runtime, browser, deployment

이 문서는 확정 정본이 아니라 의사결정 제안서다. 사용자가 선택한 뒤에는 `docs/planning/`,
`docs/legal/`, `docs/system-design/` 중 소유 정본을 먼저 갱신하고, 그 다음 관련 개발 Spec을
동기화한다. 실제 provider 값, 사업자 정보, credential, 연락처는 추측하지 않는다.

## 1. 추천 요약

| ID | 추천 결정 | 확정 시 먼저 고칠 정본 |
| --- | --- | --- |
| OD-M0-001 | `VALIDATION_FAILED`로 통일 | [API 설계](../../../system-design/03-api-design.md) |
| OD-M0-002 | multi-file upload는 하나라도 실패하면 전체 실패 | [API 설계](../../../system-design/03-api-design.md) |
| OD-M0-003 | 관리자 검색 page 초과는 `200` 빈 목록 | [API 설계](../../../system-design/03-api-design.md) |
| OD-M0-004 | 관리자 `postId` 형식 오류도 `404 POST_NOT_FOUND` | [API 설계](../../../system-design/03-api-design.md) |
| OD-M0-005 | staging 이미지 폐기 `202`는 공통 성공 envelope 반환 | [API 설계](../../../system-design/03-api-design.md) |
| OD-M0-006 | 법무·운영 실값은 placeholder 유지 후 실제 값 입력 시 일괄 확정 | [법무 README](../../../legal/README.md) |
| OD-M0-007 | mail client 실패 시 이메일 주소·제목·본문 복사 UI 제공 | [서비스 기획](../../../planning/01-service-plan.md), [화면 설계](../../../planning/03-screen-design.md) |
| OD-M0-008 | 기본 OG fallback 이미지 1개와 deterministic description 규칙 사용 | [화면 설계](../../../planning/03-screen-design.md), [카피 후보](../../../planning/06-copy-candidates.md) |
| OD-M0-009 | 카카오 공유는 실도메인·공식 host 확인 전 비활성 유지 | [보안·운영](../../../system-design/05-security-operations.md) |
| OD-M0-010 | GA4 custom parameter는 최소 allowlist만 허용 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md) |
| OD-M0-011 | GA4 운영값 확정 전 GA4 runtime 비활성 유지 | [법무 README](../../../legal/README.md), [개인정보처리방침](../../../legal/privacy-policy.md) |
| OD-M0-012 | 예약 발행 점검 시각은 `08:00`, `18:00` KST | [인프라 계획](../../../planning/02-infra-plan.md), [보안·운영](../../../system-design/05-security-operations.md) |
| OD-M0-013 | 카피 후보 A를 M0 기본안으로 채택 | [카피 후보](../../../planning/06-copy-candidates.md) |

## 2. P0 추천안

### OD-M0-001 공개 조회수 오류 code

추천: `VALIDATION_FAILED`로 통일한다.

이유:

- [API 설계 공통 오류표](../../../system-design/03-api-design.md)는 입력 형식·값 오류를 `VALIDATION_FAILED`로 정의한다.
- 조회 수 endpoint만 `VALIDATION_ERROR`를 쓰면 BFF 공통 오류 mapper와 contract test가 예외를 하나 더 가져야 한다.
- payload가 있으면 validation 실패라는 의미이므로 공통 오류표와 맞추는 편이 단순하다.

대안:

- `VALIDATION_ERROR` 유지: endpoint 문장은 덜 바꾸지만 공통 오류표를 흔들고 다른 API와 drift가 생긴다.

확정 문구 예시:

```text
request body와 query parameter를 받지 않는다. 값이 있으면 `400 VALIDATION_FAILED`다.
```

### OD-M0-002 multi-file upload 일부 실패

추천: 한 요청 안에서 파일 하나라도 실패하면 전체 요청을 실패시킨다.

이유:

- 이미지 업로드 뒤 초안 생성에서 image 선점과 rollback을 엄격히 다루고 있으므로, 업로드 단계도 원자적으로 보는 편이 이해하기 쉽다.
- 부분 성공은 `items[]`와 `errors[]`를 함께 반환해야 해 UI, 재시도, orphan 정리, contract test가 복잡해진다.
- 관리자는 실패한 파일을 고쳐 같은 묶음을 다시 올리면 되므로 M0에서는 UX 손실보다 구현 단순성이 더 중요하다.

대안:

- 유효 파일만 성공: 대량 업로드 UX는 좋지만 partial response schema, 중복 재시도, 일부 orphan 정리 규칙을 더 설계해야 한다.

확정 문구 예시:

```text
multipart 요청에 포함된 파일 중 하나라도 크기·MIME·decode·pixel 검증에 실패하면 전체 요청을 실패시키고
저장된 object와 image row를 남기지 않는다.
```

### OD-M0-003 관리자 검색 page 초과

추천: 유효한 query에서 page가 결과 범위를 넘으면 `200`과 빈 `items`를 반환한다.

이유:

- 관리자 검색은 SEO나 공개 URL canonical 문제가 아니라 작업용 필터 화면이다.
- 검색 조건 변경, 동시 수정, 삭제로 마지막 page가 줄어드는 상황에서 `404`보다 빈 목록이 UI 복구가 쉽다.
- 공개 목록의 `404 PAGE_NOT_FOUND`는 공개 route 품질과 crawl 제어 목적이 있으므로 관리자와 다르게 둘 수 있다.

대안:

- `404 PAGE_NOT_FOUND`: 공개 목록과 일관되지만 관리자 화면에서 필터 변경 후 오류 상태가 자주 발생할 수 있다.

확정 문구 예시:

```text
관리자 검색에서 page 값 형식은 `400 VALIDATION_FAILED`로 거부한다. 형식은 유효하지만 totalPages를 넘으면
`200`과 빈 `items`를 반환하고 meta에는 실제 totalItems, totalPages, hasPrevious=true, hasNext=false를 넣는다.
```

### OD-M0-004 관리자 postId 형식 오류

추천: `404 POST_NOT_FOUND`로 일반화한다.

이유:

- 공개 상세는 잘못된 `postId`도 `404 POST_NOT_FOUND`로 일반화한다.
- 관리자 상세에서도 존재 여부와 path 형식 차이를 굳이 노출할 이득이 작다.
- 편집 상세 API는 조회성 endpoint라 `404` 일반화가 UI 처리도 단순하다.

대안:

- `400 VALIDATION_FAILED`: path validation 원칙은 분명하지만 공개 API와 다르고, 존재 여부 노출 축소 원칙이 약해진다.

확정 문구 예시:

```text
`postId`가 10진수 양의 정수가 아니거나 범위를 벗어나도 `404 POST_NOT_FOUND`로 처리한다.
```

### OD-M0-005 staging 이미지 폐기 202 body

추천: `202`와 공통 성공 envelope를 반환한다.

이유:

- 폐기는 `PRIVATE_DELETE_PENDING` 전이와 outbox 생성을 동반하므로 UI가 현재 상태를 받는 편이 안전하다.
- 공통 API 응답 형태와 맞아 client schema가 단순하다.
- body 없는 `204`는 조회 수 증가처럼 클라이언트가 후속 상태를 몰라도 되는 경우에만 쓰는 편이 낫다.

대안:

- body 없음: 작고 단순하지만 UI가 optimistic update에 의존하거나 별도 재조회가 필요하다.

확정 문구 예시:

```json
{
  "success": true,
  "data": {
    "imageId": 501,
    "status": "PRIVATE_DELETE_PENDING"
  },
  "meta": { "requestId": "01J..." }
}
```

### OD-M0-006 법무·운영 실값

추천: 지금은 값을 만들지 말고 placeholder를 유지한다. production 공개 전 별도 입력 표로 실제 값을 받아 legal 정본을 일괄 갱신한다.

이유:

- 사업자 정보, 수탁자, 연락처, 시행일은 추정값으로 채우면 법무 문서 신뢰도가 바로 깨진다.
- 이 항목은 개발 편의가 아니라 출시 차단 항목이므로 실제 운영 주체가 확인해야 한다.

입력받을 값:

| 구분 | 필요한 값 |
| --- | --- |
| 사업자 | 운영자명, 대표자, 사업자 정보, 주소 |
| 문의 | 공통 문의 이메일, 전화번호 또는 대체 연락 수단, 운영 시간 |
| 개인정보 | 보호책임자, 담당 부서, 열람청구 채널 |
| 수탁자 | 호스팅, 이미지 저장·전송, 이메일 사업자와 계약 법인 |
| 권리 요청 | 접수 이메일, 수령인, 회신 채널 |
| 시행 | 약관·개인정보처리방침·권리 안내 시행일 |

### OD-M0-007 mail client 실패 대체 UX

추천: 별도 form/API는 만들지 않고, mail client 실패 시 이메일 주소·제목·본문을 화면에 표시하고 각각 복사 버튼을 제공한다.

이유:

- M0 범위는 권리자 요청 form 제외다.
- 이메일 노출과 복사 UI는 서버 저장, 개인정보 처리, 스팸 방어, 접수 DB를 새로 만들지 않는다.
- mailto가 실패해도 사용자는 자신의 메일 서비스에서 직접 보낼 수 있다.

대안:

- 별도 접수 form: UX는 좋지만 개인정보 저장·보관·스팸·관리자 처리 API가 새 범위로 커진다.
- 이메일 주소만 노출: 가장 단순하지만 사용자가 제목·본문을 직접 구성해야 해 접수 품질이 떨어진다.

확정 문구 예시:

```text
mailto 실행 실패 또는 사용자가 직접 접수를 선택하면 접수 이메일, 권장 제목, 현재 URL이 포함된 본문 예시를
표시하고 각 값을 복사할 수 있게 한다. 본문은 서버로 전송하거나 저장하지 않는다.
```

## 3. P1 추천안

### OD-M0-008 IMAGE 없는 상세 OG fallback

추천: 기본 OG fallback 이미지 1개를 두고, description은 공개 TEXT block에서 deterministic하게 만든다.

세부 추천:

| 항목 | 추천 |
| --- | --- |
| fallback 이미지 | `public/og/blariyo-default.png` 같은 정적 bitmap 자산 1개 |
| `og:image` | 첫 공개 IMAGE block이 있으면 해당 이미지, 없으면 fallback 이미지 |
| `og:image:alt` | 이미지가 있으면 block alt, 없으면 `블라리요` |
| description | 첫 공개 TEXT block들을 공백 정규화 후 80~120자, 없으면 카피 후보의 확정 OG description |
| 금지 | source URL, 내부 상태, 숨김 사유, 관리자 정보 포함 금지 |

이유:

- `og:image`를 생략하면 공유 미리보기 품질이 provider마다 흔들린다.
- fallback을 하나로 두면 SSR과 정적 검증이 단순하다.
- description 생성 규칙을 deterministic하게 두면 운영자가 매번 수동 입력하지 않아도 된다.

### OD-M0-009 카카오 공유 provider

추천: 카카오 공유는 실도메인, 공개 JavaScript key, 공식 CSP host를 확인하기 전까지 비활성으로 둔다.

이유:

- 카카오 host와 SDK 경로는 외부 provider 문서 기준으로 배포 직전에 재확인해야 한다.
- M0의 필수 공유 수단은 링크 복사와 browser native share로 충분히 유지할 수 있다.
- CSP를 추정해 열어두면 보안 문서의 allowlist 원칙과 충돌한다.

선택지:

| 선택 | 영향 |
| --- | --- |
| 추천: 카카오 비활성 유지 | 구현 단순, CSP 안전, provider 설정 전 배포 가능 |
| 카카오 즉시 활성 | 공유 UX는 좋아지지만 도메인·key·CSP·provider 테스트가 선행되어야 함 |

### OD-M0-010 GA4 custom parameter allowlist

추천: M0에서는 최소 parameter만 허용하고, title·본문·source URL·검색어·사용자 입력값은 보내지 않는다.

추천 allowlist:

| event | 허용 parameter | 금지 |
| --- | --- | --- |
| `page_view` | 기본 GA4 page 정보만 사용, custom parameter 없음 | title 원문 재전송, source URL |
| `select_content` | `content_type`, `board_slug`, `post_id` | 게시글 제목, 본문, 출처명, 출처 URL |
| `share` | `method`, `board_slug`, `post_id` | 공유 대상 계정, 제목, 본문 |
| `scroll` | `board_slug`, `post_id`, `scroll_depth` | 사용자 식별자, 세션 자체 식별자 |

공통 규칙:

- 404, 숨김, 삭제, 예약, 초안 상태에서는 `post_id`를 보내지 않는다.
- `post_id`는 공개 URL에 노출된 ID일 때만 사용한다.
- custom dimension 등록 전에는 event만 보내고 custom parameter 분석 의존 기능을 만들지 않는다.

### OD-M0-011 GA4 운영값

추천: GA4 운영값이 확정될 때까지 runtime flag false를 유지한다.

확정 조건:

- Measurement ID
- GA4 property 보관 설정
- Google 계약 법인과 국외이전 고지
- 실제 cookie 만료와 삭제 안내
- CSP `script-src`, `connect-src` host
- DebugView 또는 network 검증 절차

이유:

- GA4는 code path가 있어도 legal·CSP·운영값이 없으면 켜면 안 되는 기능이다.
- 기본 M0 공개는 GA4 없이도 가능하므로 출시 전체를 불필요하게 묶지 않는다.

## 4. P2 추천안

### OD-M0-012 예약 발행 운영 시각

추천: due scheduler의 정기 점검 시각은 `08:00`, `18:00` KST로 둔다.

이유:

- 출근 전후와 퇴근 전후 소비 맥락에 맞다.
- 하루 두 차례라 운영자가 오전/오후 점검하기 쉽다.
- 서버 내부 저장은 UTC ISO 8601로 유지하고, 운영 문서에는 KST 기준을 명시하면 된다.

대안:

- `09:00`, `18:00` KST: 업무 시간 기준 운영은 편하지만 출근길 노출이 늦다.
- 매시간 실행: 예약 정확도는 높지만 M0의 “하루 두 차례” 운영 전제와 달라진다.

확정 문구 예시:

```text
예약 발행 due scheduler는 매일 08:00, 18:00 KST에 실행한다. 저장·비교 시각은 UTC ISO 8601을 사용한다.
```

### OD-M0-013 카피

추천: 카피 후보 A를 M0 기본안으로 채택한다.

추천 적용:

| 위치 | 문구 |
| --- | --- |
| 메인 슬로건 | 출퇴근길엔 블라리요 |
| 서브 카피 | 오가는 길에 가볍게 넘겨보는 유머 모음. |
| OG title | 블라리요 |
| OG description | 출퇴근길에 가볍게 넘겨보는 유머를 모았습니다. 한 정거장씩 짧게 보고 가세요. |

이유:

- 서비스명 노출이 가장 직접적이다.
- 출퇴근길이라는 사용 맥락이 분명하다.
- 후속 후보보다 브랜드 기억에 유리하다.

대안:

- 후보 B/C: 부드럽지만 브랜드명이 약하다.
- 후보 D: 연속 소비 느낌은 좋지만 첫인상이 가볍다.
- 후보 E: 퇴근길에 치우쳐 출근 맥락이 빠진다.

## 5. 사용자 결정 체크리스트

아래 항목에 `채택`, `수정`, `보류` 중 하나를 표시한 뒤 정본 반영 작업을 진행한다.

| ID | 추천 | 사용자 결정 |
| --- | --- | --- |
| OD-M0-001 | `VALIDATION_FAILED` | `채택` |
| OD-M0-002 | 일부 실패 시 전체 실패 | `(미정)` |
| OD-M0-003 | 관리자 page 초과 `200` 빈 목록 | `(미정)` |
| OD-M0-004 | 관리자 `postId` 형식 오류 `404 POST_NOT_FOUND` | `(미정)` |
| OD-M0-005 | `202` 공통 성공 envelope | `(미정)` |
| OD-M0-006 | placeholder 유지 후 실제 값 입력 | `(미정)` |
| OD-M0-007 | 이메일·제목·본문 복사 fallback | `(미정)` |
| OD-M0-008 | 기본 OG fallback 이미지와 deterministic description | `(미정)` |
| OD-M0-009 | 카카오 실값 전 비활성 | `(미정)` |
| OD-M0-010 | GA4 최소 custom parameter allowlist | `(미정)` |
| OD-M0-011 | GA4 운영값 전 runtime flag false | `(미정)` |
| OD-M0-012 | `08:00`, `18:00` KST | `(미정)` |
| OD-M0-013 | 카피 후보 A | `(미정)` |
