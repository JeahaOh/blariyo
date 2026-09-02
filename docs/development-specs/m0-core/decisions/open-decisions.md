# M0 Core 결정 필요 항목

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기준일: 2026-09-02
- 목적: 기능별 개발 Spec에 흩어진 `결정 필요`, `(미정)`, `[출시 차단]` 항목을 한곳에서 추적한다.
- 범위: `docs/development-specs/m0-core/`의 공개 탐색, 관리자 게시글, 분석 동의, 정책·권리 문서
- 제외: `M0 수집 보조`, `M0 자동 수집`, `M1`, `M1.5`, 후속 광고·제휴·회원 기능
- 미검증: source, migration, OpenAPI, test, build, runtime, browser, deployment

이 문서는 결정 추적용 색인이다. 제품 범위는 `docs/planning/`, 법무 실값과 출시 차단은
`docs/legal/`, 공통 기술 계약은 `docs/system-design/`이 소유한다. 여기서 결정을 확정하지 않고,
확정 뒤에는 소유 정본을 먼저 갱신한 다음 관련 개발 Spec을 동기화한다.

## 1. 상태 기준

| 상태 | 의미 |
| --- | --- |
| 결정 필요 | 제품·기술·법무 정본에 선택지가 남아 구현 계약이 달라질 수 있음 |
| 실값 필요 | 도메인, provider key, 사업자 정보처럼 운영 전에 실제 값 입력 필요 |
| 활성화 차단 | 기본 M0 Core 공개는 가능하지만 해당 선택 기능을 켤 수 없음 |
| 출시 차단 | M0 Core production 공개 전 반드시 확정 필요 |
| 미검증 | 문서 계약은 있으나 실행 증거가 없음 |

## 2. 우선순위

| 우선순위 | 처리 기준 |
| --- | --- |
| P0 | M0 Core production 공개 또는 전체 번들 `작성 완료` 승격을 막음 |
| P1 | 기능 일부 활성화, provider 연동 또는 특정 API 구현 계약을 막음 |
| P2 | 구현은 가능하지만 운영값·카피·화면 검증 전 확정 필요 |

## 3. 결정 항목

| ID | 우선순위 | 영역 | 결정 항목 | 현재 영향 | 소유 정본 | 관련 Spec | 권장 다음 조치 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-M0-001 | P0 | 공개 탐색 API | 조회 수 증가 endpoint payload 오류 code를 `VALIDATION_ERROR`와 `VALIDATION_FAILED` 중 무엇으로 통일할지 결정 | `public-post-browsing` 번들 `작성 완료` 승격 차단 | [API 설계](../../../system-design/03-api-design.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [조회 수 증가 API](../public-post-browsing/api/increment-post-view.md) | 공통 오류표와 endpoint 본문 중 하나를 고쳐 단일 code로 확정 |
| OD-M0-002 | P0 | 관리자 API | multi-file upload에서 일부 파일만 실패할 때 전체 실패인지 유효 파일만 성공인지 결정 | `admin-post-management` 번들, upload API, 초안 작성 D01 상태 `초안` 유지 | [API 설계](../../../system-design/03-api-design.md), [보안·운영](../../../system-design/05-security-operations.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [이미지 업로드 API](../admin-post-management/api/upload-images.md), [초안 작성 D01](../admin-post-management/d01/draft-and-publish-post.md) | 보안·운영 복잡도를 고려해 성공·실패 응답 schema를 상위 API에 명시 |
| OD-M0-003 | P0 | 관리자 API | 관리자 검색에서 `page`가 전체 page를 넘을 때 빈 `200`인지 `404 PAGE_NOT_FOUND`인지 결정 | 검색 API와 관리자 번들 `작성 완료` 승격 차단 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [관리자 검색 API](../admin-post-management/api/search-posts.md) | 공개 목록 page 초과 정책과 맞출지, 관리자 UX에 맞춰 별도 정책을 둘지 확정 |
| OD-M0-004 | P0 | 관리자 API | 관리자 `postId` 형식 오류를 `400 VALIDATION_FAILED`로 볼지 `404 POST_NOT_FOUND`로 일반화할지 결정 | 편집 상세 API와 관리자 번들 `작성 완료` 승격 차단 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [편집 상세 API](../admin-post-management/api/get-post-editor.md) | 공개 상세의 정보 노출 축소 원칙을 관리자 API에도 적용할지 확정 |
| OD-M0-005 | P0 | 관리자 API | staging 이미지 폐기 `202` 성공 응답 body를 생략할지 공통 성공 envelope로 반환할지 결정 | 폐기 API와 관리자 번들 `작성 완료` 승격 차단 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [이미지 폐기 API](../admin-post-management/api/discard-image.md) | `202`가 비동기 접수인지 완료 접수인지 먼저 정하고 response schema를 고정 |
| OD-M0-006 | P0 | 법무·정책 | 사업자·운영자명, 대표자, 주소, 문의처, 시행일, 개인정보 보호책임자, 수탁자, 권리 접수 채널 입력 | `policy-and-rights` 전체 `차단`; M0 Core production 공개 차단 | [법무 README](../../../legal/README.md), [이용약관](../../../legal/terms-of-service.md), [개인정보처리방침](../../../legal/privacy-policy.md), [권리자 요청 안내](../../../legal/rights-request.md) | [정책·권리 보강서](../policy-and-rights/policy-and-rights.dev.md), [정책 조회 API](../policy-and-rights/api/get-policy.md), [정책 viewer](../policy-and-rights/d08/policy-viewer.md) | 실제 사업자·운영자·수탁자·연락처와 시행일을 확인한 뒤 legal 정본부터 갱신 |
| OD-M0-007 | P0 | 권리 문의 UX | mail client를 열 수 없는 환경의 대체 접수 UX 결정 | 권리 문의 D01·D08 `차단`; 별도 form/API를 임의 생성할 수 없음 | [서비스 기획](../../../planning/01-service-plan.md), [화면 설계](../../../planning/03-screen-design.md), [권리자 요청 안내](../../../legal/rights-request.md) | [정책·권리 보강서](../policy-and-rights/policy-and-rights.dev.md), [권리 문의 D01](../policy-and-rights/d01/submit-rights-inquiry.md), [권리 문의 진입 D08](../policy-and-rights/d08/rights-inquiry-entry.md) | 단순 이메일 노출, 복사 버튼, 별도 접수 form 중 M0 범위에 맞는 대안을 planning에 먼저 확정 |
| OD-M0-008 | P1 | 상세 SSR metadata | IMAGE 없는 상세의 OG fallback 자산과 description 생성 규칙 결정 | 상세 D08와 공개 탐색 번들 `작성 완료` 승격 차단 | [화면 설계](../../../planning/03-screen-design.md), [카피 후보](../../../planning/06-copy-candidates.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [게시글 상세 D08](../public-post-browsing/d08/post-detail.md) | fallback 이미지 자산, 본문 요약 길이, 이미지 없는 글의 `og:image` 생략 여부를 확정 |
| OD-M0-009 | P1 | 공유 provider | 실제 서비스 도메인, 카카오 공유 CSP host, 공개 JavaScript key 확정 | 카카오 공유 항목 활성화 차단; 링크 복사·기본 공유는 유지 가능 | [서비스 기획](../../../planning/01-service-plan.md), [보안·운영](../../../system-design/05-security-operations.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [공유 D01](../public-post-browsing/d01/share-post.md), [게시글 상세 D08](../public-post-browsing/d08/post-detail.md) | 배포 도메인과 카카오 개발자 설정을 확인한 뒤 CSP와 provider 설정을 고정 |
| OD-M0-010 | P1 | 분석 이벤트 | GA4 전송 event별 custom parameter allowlist 결정 | `analytics-consent` 번들, event 전송 D01, loader D08 상태 `초안` 유지 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md), [개인정보처리방침](../../../legal/privacy-policy.md) | [분석 동의 보강서](../analytics-consent/analytics-consent.dev.md), [이벤트 전송 D01](../analytics-consent/d01/send-analytics-events.md), [GA4 loader](../analytics-consent/d08/analytics-loader.md) | `page_view`, `select_content`, `share`, `scroll`별 허용 parameter와 금지값을 표로 확정 |
| OD-M0-011 | P1 | GA4 운영값 | Measurement ID, GA4 property 보관 설정, 국외이전 고지, Google 계약 법인, CSP domain 확정 | GA4 운영 활성화 차단; 기본 비활성 M0 동작은 가능 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md), [법무 README](../../../legal/README.md), [개인정보처리방침](../../../legal/privacy-policy.md), [쿠키 설정 안내](../../../legal/cookie-settings.md) | [분석 동의 보강서](../analytics-consent/analytics-consent.dev.md), [GA4 loader](../analytics-consent/d08/analytics-loader.md), [쿠키 설정 D08](../analytics-consent/d08/cookie-settings.md) | GA4를 켤 시점에 실제 property와 법무 고지를 확인하고, 꺼진 상태에서는 provider 값을 노출하지 않음 |
| OD-M0-012 | P2 | 예약 운영 | 하루 두 차례 예약 발행 운영 시각 확정 | per-post 예약 API 계약은 막지 않지만 scheduler 운영 검증 전 미정 | [인프라 계획](../../../planning/02-infra-plan.md), [보안·운영](../../../system-design/05-security-operations.md) | [예약 발행 D01](../admin-post-management/d01/schedule-post.md), [발행 API](../admin-post-management/api/publish-post.md) | 운영 시간대, 장애 알림, 재처리 SLA와 함께 scheduler 실행 시각 확정 |
| OD-M0-013 | P2 | 카피 | 홈 보조 문구, 홈·상세 title/description, 공유 기본 문구 최종 확정 | 화면 동작·API 계약은 막지 않지만 최종 UI/OG 검증 전 필요 | [카피 후보](../../../planning/06-copy-candidates.md), [화면 설계](../../../planning/03-screen-design.md) | [짤 목록 D08](../public-post-browsing/d08/meme-list.md), [게시글 상세 D08](../public-post-browsing/d08/post-detail.md), [공유 D01](../public-post-browsing/d01/share-post.md) | 후보 A~E 중 선택하거나 새 후보를 확정한 뒤 화면·metadata 문구를 동기화 |

## 4. 출시 차단 항목 요약

M0 Core production 공개 전에는 최소한 다음 항목을 확정해야 한다.

- OD-M0-001: 공개 조회수 증가 오류 code 충돌 해소
- OD-M0-002~005: 관리자 API 상위 계약 4건 확정
- OD-M0-006: 법무·운영 실값 입력
- OD-M0-007: mail client 실패 대체 UX 확정

GA4와 카카오 공유는 기본 공개 전체를 막기보다 해당 provider 활성화를 막는 항목이다. 단, 실제로 켜서
배포하려면 OD-M0-009~011을 먼저 확정한다.

## 5. 갱신 절차

1. 위 표에서 항목 ID를 선택한다.
2. `소유 정본` 문서를 먼저 갱신한다.
3. 관련 개발 Spec, API, D01, D08을 동기화한다.
4. 결정이 끝난 항목은 상태를 `확정`으로 바꾸고 확정일과 변경된 정본 링크를 남긴다.
5. source·test·runtime 검증은 별도 증거로 기록하고, 문서 확정을 구현 완료로 표시하지 않는다.
