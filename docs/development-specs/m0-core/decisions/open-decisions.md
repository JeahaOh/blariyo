# M0 Core 결정 필요 항목

- 문서 상태: `초안`
- milestone: `M0 Core`
- 기준일: 2026-09-03
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
| OD-M0-001 | P0 | 공개 탐색 API | `VALIDATION_FAILED`로 통일하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). 조회 수 endpoint의 payload 오류는 `400 VALIDATION_FAILED` | [API 설계](../../../system-design/03-api-design.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [조회 수 증가 API](../public-post-browsing/public-post-browsing.dev.md#api-increment-post-view) | OpenAPI·source·contract test는 구현 단계에서 검증 |
| OD-M0-002 | P0 | 업로드 API | multi-file upload는 `all-or-nothing`으로 결정. 파일 하나라도 실패하면 전체 요청 실패, 성공한 파일도 반환하지 않음 | 확정·문서 동기화 완료 (2026-09-03). 요청 단위 파일 개수·전체 합계 gate 초과는 `413`이며 `fields`를 제공하지 않음. gate 통과 뒤 storage 전 모든 파일을 검증하고, 개별 크기 오류가 하나라도 있으면 `413`, 그 외 형식·decode 오류는 `415`. 파일별 `fields[]`에는 모든 실패 index와 일반화 reason을 제공하고 R2·DB `503`에는 제공하지 않음. validation 실패는 storage를 시작하지 않으며 기존 rollback·보상 삭제·cleanup outbox·24시간 orphan 회수 계약은 유지 | [API 설계](../../../system-design/03-api-design.md), [보안·운영](../../../system-design/05-security-operations.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [이미지 업로드 API](../admin-post-management/admin-post-management.dev.md#api-upload-images), [초안 작성 D01](../admin-post-management/admin-post-management.dev.md#d01-draft-and-publish-post), [관리자 편집기 D08](../admin-post-management/admin-post-management.dev.md#d08-admin-post-editor) | validation 우선순위·fields·object storage·DB·outbox 통합 동작은 구현 단계에서 검증 |
| OD-M0-003 | P0 | 관리자 API | 관리자 검색에서 `page`가 전체 page를 넘으면 `200`과 빈 `items`로 응답하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). 형식·범위 오류는 `400 VALIDATION_FAILED`, 유효한 초과 page는 `200` 빈 결과 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [관리자 검색 API](../admin-post-management/admin-post-management.dev.md#api-search-posts) | OpenAPI·source·contract test는 구현 단계에서 검증 |
| OD-M0-004 | P0 | 관리자 API | 관리자 `postId` 형식 오류도 `404 POST_NOT_FOUND`로 일반화하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). 형식 오류·미존재·접근 불가를 동일하게 처리 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [편집 상세 API](../admin-post-management/admin-post-management.dev.md#api-get-post-editor) | OpenAPI·source·contract test는 구현 단계에서 검증 |
| OD-M0-005 | P0 | 관리자 API | staging 이미지 폐기 성공은 `202 Accepted`와 공통 성공 envelope로 반환하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). `imageId`, `PRIVATE_DELETE_PENDING`, `requestId`를 반환하고 실제 삭제는 outbox 처리 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [이미지 폐기 API](../admin-post-management/admin-post-management.dev.md#api-discard-image) | outbox worker·재시도는 구현 단계에서 검증 |
| OD-M0-006 | P0 | 법무·정책 | 법무·문의 실값은 properties/config로 관리하기로 결정. 사업자등록 전 사업자 정보는 보류하고, 문의·권리·개인정보 contact 값과 법무 시행 필수값은 production 공개 전 확정 | 확정·문서 동기화 완료 (2026-09-03). 운영자 표시명, 시행일, 일반 문의 이메일, 권리 침해 신고/요청 이메일, 개인정보 문의 이메일, 개인정보 보호책임자 또는 담당자, M0 Core에서 실제 사용하는 호스팅·이미지 저장·이메일 수탁자 값, M0 접속·보안 로그의 적법 근거·이익형량은 production 공개 전 실값·근거 필요. 사업자명, 사업자등록번호, 통신판매업신고번호, 대표자명, 주소, 전화번호는 사업자등록 또는 거래 기능 확정 전까지 보류. 실제 값 미입력 상태이므로 `policy-and-rights` 전체 `차단`과 M0 Core production 공개 차단은 유지. 참고: [법무·문의 표시 조사](legal-contact-benchmark-research.md), [운영 실값 체크리스트](operational-values-checklist.md) | [법무 README](../../../legal/README.md), [이용약관](../../../legal/terms-of-service.md), [개인정보처리방침](../../../legal/privacy-policy.md), [권리자 요청 안내](../../../legal/rights-request.md), [인프라 설계](../../../system-design/04-infrastructure-design.md) | [정책·권리 보강서](../policy-and-rights/policy-and-rights.dev.md), [정책 조회 API](../policy-and-rights/policy-and-rights.dev.md#api-get-policy), [정책 viewer](../policy-and-rights/policy-and-rights.dev.md#d08-policy-viewer) | `BLARIYO_OPERATOR_DISPLAY_NAME`, `BLARIYO_GENERAL_CONTACT_EMAIL`, `BLARIYO_RIGHTS_CONTACT_EMAIL`, `BLARIYO_PRIVACY_CONTACT_EMAIL`, `BLARIYO_PRIVACY_OFFICER_*`, `BLARIYO_PRIVACY_DEPARTMENT`를 config로 주입. 시행일, 실제 사용 수탁자, 접속·보안 로그 적법 근거는 법무 정본에서 확정한다. 사업자 정보 key는 두되 실값은 준비 전까지 `(미정)` 유지 |
| OD-M0-007 | P0 | 권리 문의 UX | `mailto:`와 독립된 항상 접근 가능한 `이메일 주소 복사`를 함께 제공하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). 복사는 접수 이메일 주소만 대상으로 하고 제목·본문은 복사하지 않음. mail client 실행 성공·실패를 감지하지 않으며 form/API·별도 접수 DB를 만들지 않음. 실제 접수 이메일 실값은 OD-M0-006에 따름 | [서비스 기획](../../../planning/01-service-plan.md), [화면 설계](../../../planning/03-screen-design.md), [권리자 요청 안내](../../../legal/rights-request.md) | [정책·권리 보강서](../policy-and-rights/policy-and-rights.dev.md), [권리 문의 D01](../policy-and-rights/policy-and-rights.dev.md#d01-submit-rights-inquiry), [권리 문의 진입 D08](../policy-and-rights/policy-and-rights.dev.md#d08-rights-inquiry-entry) | 실제 접수 이메일과 browser의 mailto·clipboard·접근성 동작은 구현 단계에서 검증 |
| OD-M0-008 | P1 | 상세 SSR metadata | IMAGE 없는 상세는 기본 fallback 이미지와 본문 기반 description으로 처리하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). 첫 공개 TEXT block plain text의 앞뒤 Unicode whitespace를 제거하고 내부의 하나 이상 연속된 Unicode whitespace를 단일 U+0020 space로 치환한 뒤 grapheme 수를 계산. 120자 이하면 80자 미만이어도 padding 없이 사용하고, 초과하면 Unicode grapheme cluster 기준 앞 119자와 단일 `…`로 최대 120자를 만들어 세 description metadata에 동일하게 적용. TEXT가 없으면 확정 서비스 기본 문구 적용. 첫 공개 IMAGE block의 절대 HTTPS URL을 사용하고 없으면 `/og/blariyo-default.png` 적용 | [화면 설계](../../../planning/03-screen-design.md), [카피 계약](../../../planning/06-copy-contract.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [게시글 상세 D08](../public-post-browsing/public-post-browsing.dev.md#d08-post-detail) | SSR 첫 HTML·Unicode whitespace 정규화·grapheme cluster 절단·fallback 자산·viewport별 공유 미리보기는 구현 단계에서 검증 |
| OD-M0-009 | P1 | 공유 provider | 서비스 도메인은 `https://blariyo.com/`로 확정하고, 카카오톡 공유는 Kakao JavaScript SDK 기반으로 구현하기로 결정 | 결정 계약 확정·문서 동기화 완료 (2026-09-03). 도메인·SDK 방식·config 경계는 확정. 실제 JavaScript key·카카오 개발자 콘솔 Web domain 등록·SDK script URL·SRI integrity·CSP host는 미확정이므로 카카오 공유 활성화는 차단하며 링크 복사·기본 공유는 유지. 실값은 [운영 실값 체크리스트](operational-values-checklist.md)에서 추적 | [서비스 기획](../../../planning/01-service-plan.md), [보안·운영](../../../system-design/05-security-operations.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [공유 D01](../public-post-browsing/public-post-browsing.dev.md#d01-share-post), [게시글 상세 D08](../public-post-browsing/public-post-browsing.dev.md#d08-post-detail) | 미확정 운영값과 등록을 모두 확인한 뒤 카카오 항목 활성화 |
| OD-M0-010 | P1 | 분석 이벤트 | GA4는 동의 후 동적 로드하고 event별 최소 custom parameter allowlist만 전송하기로 결정 | 확정·문서 동기화 완료 (2026-09-03). 저장된 분석 동의 전 방문자 수·page open을 포함한 Google tag/request/cookieless ping 0건, 동의 후 browser 1회 동적 로드, 실패 시 공개 기능 유지·event drop, event별 allowlist와 금지값, GA 대체 자체 분석 DB·일별 방문 집계 없음 반영 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md), [개인정보처리방침](../../../legal/privacy-policy.md) | [분석 동의 보강서](../analytics-consent/analytics-consent.dev.md), [이벤트 전송 D01](../analytics-consent/analytics-consent.dev.md#d01-send-analytics-events), [GA4 loader](../analytics-consent/analytics-consent.dev.md#d08-analytics-loader) | source·browser network·GA4 DebugView는 구현 단계에서 검증 |
| OD-M0-011 | P1 | GA4 운영값 | Measurement ID, GA4 property 보관 설정, 국외이전 고지, Google 계약 법인, CSP domain 확정은 보류 | 보류·문서 동기화 완료 (2026-09-03). production 운영 활성화는 `NUXT_PUBLIC_GA4_ENABLED=false`로 유지한다. 실제 Measurement ID, property 보관 설정, Google 계약 법인, 국외이전 고지, Google tag/CSP domain이 모두 확정된 환경에서만 GA4를 켠다. flag가 false인 환경은 원인과 관계없이 Measurement ID를 public runtime config에서 unset한다. M0 Core 공개 자체는 막지 않음. 실값은 [운영 실값 체크리스트](operational-values-checklist.md)에서 추적 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md), [법무 README](../../../legal/README.md), [개인정보처리방침](../../../legal/privacy-policy.md), [쿠키 설정 안내](../../../legal/cookie-settings.md) | [분석 동의 보강서](../analytics-consent/analytics-consent.dev.md), [GA4 loader](../analytics-consent/analytics-consent.dev.md#d08-analytics-loader), [쿠키 설정 D08](../analytics-consent/analytics-consent.dev.md#d08-cookie-settings) | GA4 운영값과 법무 고지가 준비될 때까지 placeholder를 유지하고, 비활성 환경에서는 provider 값을 노출하지 않음 |
| OD-M0-012 | P2 | 예약 운영 | 하루 두 차례 기본 예약 발행 운영 시각은 `07:30`, `17:30` KST로 결정 | 확정·문서 동기화 완료 (2026-09-03). 출근·등교 전후와 퇴근·하교 전후의 기본 슬롯, per-post 임의 예약, 매분 due 확인, 장애 복구 후 지난 예약, 실패 알림과 재시도 경계 반영 | [서비스 기획](../../../planning/01-service-plan.md), [인프라 계획](../../../planning/02-infra-plan.md), [보안·운영](../../../system-design/05-security-operations.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [예약 발행 D01](../admin-post-management/admin-post-management.dev.md#d01-schedule-post), [발행 API](../admin-post-management/admin-post-management.dev.md#api-publish-post) | cron·scheduler·알림·R2·DB·outbox 통합 동작은 구현 단계에서 검증 |
| OD-M0-013 | P2 | 카피 | M0 홈·OG·푸터 브랜드 카피와 public config key를 확정 | 확정·문서 동기화 완료 (2026-09-03). 메인 `블라리요`, 보조·푸터 `블라블라블라`, 홈 title `블라리요 - 블라블라블라`, 홈 description·OG description `블라리요에서 블라블라블라`와 6개 public config key 반영 | [카피 계약](../../../planning/06-copy-contract.md), [화면 설계](../../../planning/03-screen-design.md) | [카피 계약](../../../planning/06-copy-contract.md), [짤 목록 D08](../public-post-browsing/public-post-browsing.dev.md#d08-meme-list), [게시글 상세 D08](../public-post-browsing/public-post-browsing.dev.md#d08-post-detail) | 실제 화면 줄바꿈·말줄임과 SSR metadata는 구현 단계에서 검증 |

## 4. 출시 차단 항목 요약

M0 Core production 공개 전에는 최소한 다음 항목을 확정해야 한다.

- OD-M0-006: 법무·문의 정보의 properties/config 관리 방식은 확정. 운영자 표시명, 시행일, 문의 이메일, 권리 접수 이메일, 개인정보 문의 이메일, 개인정보 보호책임자/담당자, M0 Core에서 실제 사용하는 호스팅·이미지 저장·이메일 수탁자 값, M0 접속·보안 로그의 적법 근거·이익형량은 아직 필요

OD-M0-001~005는 2026-09-03에 소유 정본과 관련 개발 Spec 동기화를 완료했다. OpenAPI·source·test·
runtime 검증은 별도 구현 증거가 필요하다.

OD-M0-006~007은 2026-09-03에 소유 정본과 관련 개발 Spec 동기화를 완료했다. 실제 contact 실값,
시행일, 실제 사용 수탁자, 접속·보안 로그 법무 근거, 법률 검토, source·browser 검증은 별도 증거가
필요하다.

OD-M0-008~009와 OD-M0-013은 2026-09-03에 소유 정본과 관련 공개 탐색 Spec 동기화를 완료했다.
Kakao 실제 운영값·Web domain 등록 확인과 source·SSR·browser 검증은 별도 증거가 필요하다.

OD-M0-010은 2026-09-03에 소유 정본과 관련 분석 동의 Spec 동기화를 완료했다. source·browser
network·GA4 DebugView 검증은 별도 구현 증거가 필요하다. OD-M0-011의 운영값은 보류 상태이며
production GA4 활성화만 차단하고 M0 Core 공개 자체는 막지 않는다.

OD-M0-012는 2026-09-03에 소유 정본과 관련 관리자 발행 Spec 동기화를 완료했다. cron·scheduler·
알림·R2·DB·outbox runtime 검증은 별도 구현 증거가 필요하다.

GA4와 카카오 공유는 기본 공개 전체를 막기보다 해당 provider 활성화를 막는 항목이다. 단, 실제로 켜서
배포하려면 OD-M0-009의 카카오 운영값·Web domain 등록과 OD-M0-010~011의 GA4 계약을 먼저 확인한다.

## 5. 갱신 절차

1. 위 표에서 항목 ID를 선택한다.
2. `소유 정본` 문서를 먼저 갱신한다.
3. 관련 개발 Spec, API, D01, D08을 동기화한다.
4. 결정이 끝난 항목은 상태를 `확정`으로 바꾸고 확정일과 변경된 정본 링크를 남긴다.
5. source·test·runtime 검증은 별도 증거로 기록하고, 문서 확정을 구현 완료로 표시하지 않는다.
