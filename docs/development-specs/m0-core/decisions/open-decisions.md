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
| OD-M0-001 | P0 | 공개 탐색 API | `VALIDATION_FAILED`로 통일하기로 결정 | 결정 완료. [API 설계](../../../system-design/03-api-design.md)의 조회 수 endpoint 본문과 관련 공개 탐색 Spec 동기화 필요 | [API 설계](../../../system-design/03-api-design.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [조회 수 증가 API](../public-post-browsing/api/increment-post-view.md) | endpoint 본문의 `VALIDATION_ERROR`를 `VALIDATION_FAILED`로 정정하고 차단 문구 제거 |
| OD-M0-002 | P0 | 업로드 API | multi-file upload는 `all-or-nothing`으로 결정. 파일 하나라도 실패하면 전체 요청 실패, 성공한 파일도 반환하지 않음 | 결정 완료. M0 Core 관리자 업로드와 추후 일반 사용자 업로드 모두 같은 원칙 적용. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 동기화 필요 | [API 설계](../../../system-design/03-api-design.md), [보안·운영](../../../system-design/05-security-operations.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [이미지 업로드 API](../admin-post-management/api/upload-images.md), [초안 작성 D01](../admin-post-management/d01/draft-and-publish-post.md) | 상위 API에 부분 성공 없음, 저장된 object·image row rollback 또는 보상 삭제, 실패 파일 `fields[]` 표기를 명시 |
| OD-M0-003 | P0 | 관리자 API | 관리자 검색에서 `page`가 전체 page를 넘으면 `200`과 빈 `items`로 응답하기로 결정 | 결정 완료. page 형식 오류는 `400 VALIDATION_FAILED`, page 값은 유효하지만 결과 범위를 넘는 경우는 빈 결과로 처리. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 동기화 필요 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [관리자 검색 API](../admin-post-management/api/search-posts.md) | 관리자 검색 page 초과는 `200` empty list로 명시하고 공개 목록의 `404 PAGE_NOT_FOUND` 정책과 분리 |
| OD-M0-004 | P0 | 관리자 API | 관리자 `postId` 형식 오류도 `404 POST_NOT_FOUND`로 일반화하기로 결정 | 결정 완료. 미존재·접근 불가·형식 오류 모두 같은 오류로 처리. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 동기화 필요 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [편집 상세 API](../admin-post-management/api/get-post-editor.md) | 관리자 상세 path 오류는 `404 POST_NOT_FOUND`로 명시하고 별도 `400` 분기를 만들지 않음 |
| OD-M0-005 | P0 | 관리자 API | staging 이미지 폐기 성공은 `202 Accepted`와 공통 성공 envelope로 반환하기로 결정 | 결정 완료. `data.imageId`, `data.status=PRIVATE_DELETE_PENDING`, `meta.requestId`를 반환하고 실제 object 삭제는 outbox로 처리. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 동기화 필요 | [API 설계](../../../system-design/03-api-design.md) | [관리자 보강서](../admin-post-management/admin-post-management.dev.md), [이미지 폐기 API](../admin-post-management/api/discard-image.md) | `202` 성공 response schema와 outbox 재시도 경계를 상위 API에 명시 |
| OD-M0-006 | P0 | 법무·정책 | 법무·문의 실값은 properties/config로 관리하기로 결정. 사업자등록 전 사업자 정보는 보류하고, 문의·권리·개인정보 contact 값은 production 공개 전 확정 | 부분 결정 완료. 운영자 표시명, 일반 문의 이메일, 권리 침해 신고/요청 이메일, 개인정보 문의 이메일, 개인정보 보호책임자 또는 담당자는 production 공개 전 실값 필요. 사업자명, 사업자등록번호, 통신판매업신고번호, 대표자명, 주소, 전화번호는 사업자등록 또는 거래 기능 확정 전까지 보류. 실제 값 미입력 상태이므로 `policy-and-rights` 전체 `차단`과 M0 Core production 공개 차단은 유지. 참고: [법무·문의 표시 조사](./legal-contact-benchmark-research.md) | [법무 README](../../../legal/README.md), [이용약관](../../../legal/terms-of-service.md), [개인정보처리방침](../../../legal/privacy-policy.md), [권리자 요청 안내](../../../legal/rights-request.md) | [정책·권리 보강서](../policy-and-rights/policy-and-rights.dev.md), [정책 조회 API](../policy-and-rights/api/get-policy.md), [정책 viewer](../policy-and-rights/d08/policy-viewer.md) | `BLARIYO_OPERATOR_DISPLAY_NAME`, `BLARIYO_GENERAL_CONTACT_EMAIL`, `BLARIYO_RIGHTS_CONTACT_EMAIL`, `BLARIYO_PRIVACY_CONTACT_EMAIL`, `BLARIYO_PRIVACY_OFFICER_*`, `BLARIYO_PRIVACY_DEPARTMENT`를 config로 주입. 사업자 정보 key는 두되 실값은 준비 전까지 `(미정)` 유지 |
| OD-M0-007 | P0 | 권리 문의 UX | mail client를 열 수 없으면 별도 대체 접수 UX 없이 넘어가기로 결정 | 결정 완료. `mailto:` 실행을 시도하되 실패해도 form/API/copy fallback을 만들지 않음. 실제 접수 이메일 실값은 OD-M0-006의 contact 실값 입력에 따름 | [서비스 기획](../../../planning/01-service-plan.md), [화면 설계](../../../planning/03-screen-design.md), [권리자 요청 안내](../../../legal/rights-request.md) | [정책·권리 보강서](../policy-and-rights/policy-and-rights.dev.md), [권리 문의 D01](../policy-and-rights/d01/submit-rights-inquiry.md), [권리 문의 진입 D08](../policy-and-rights/d08/rights-inquiry-entry.md) | 권리 문의는 확정 이메일 `mailto:`만 제공하고 client 실패 감지는 별도 persistence 없이 무시 |
| OD-M0-008 | P1 | 상세 SSR metadata | IMAGE 없는 상세는 기본 fallback 이미지와 본문 기반 description으로 처리하기로 결정 | 결정 완료. 첫 공개 IMAGE block이 있으면 해당 절대 HTTPS URL을 `og:image`로 사용하고, 없으면 `/og/blariyo-default.png`를 사용. `description`은 첫 공개 TEXT block에서 공백 정리 후 80~120자로 생성하며 TEXT도 없으면 확정 서비스 기본 문구 사용 | [화면 설계](../../../planning/03-screen-design.md), [카피 후보](../../../planning/06-copy-candidates.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [게시글 상세 D08](../public-post-browsing/d08/post-detail.md) | 상세 D08에 IMAGE 유무별 metadata 생성 우선순위, fallback 자산 경로, description truncation 규칙을 반영 |
| OD-M0-009 | P1 | 공유 provider | 서비스 도메인은 `https://blariyo.com/`로 확정하고, 카카오톡 공유는 Kakao JavaScript SDK 기반으로 구현하기로 결정 | 부분 결정 완료. 서비스 도메인과 SDK 사용 방식은 확정. 서비스 도메인, Kakao JavaScript SDK URL·integrity, JavaScript key, CSP host는 배포 환경 properties/config로 관리한다. 단, 실제 카카오 앱 JavaScript key와 카카오 개발자 콘솔의 Web domain 등록 확인 전까지 카카오 공유 항목 활성화는 차단; 링크 복사·기본 공유는 유지 가능 | [서비스 기획](../../../planning/01-service-plan.md), [보안·운영](../../../system-design/05-security-operations.md) | [공개 탐색 보강서](../public-post-browsing/public-post-browsing.dev.md), [공유 D01](../public-post-browsing/d01/share-post.md), [게시글 상세 D08](../public-post-browsing/d08/post-detail.md) | `SERVICE_PUBLIC_BASE_URL=https://blariyo.com/`, `NUXT_KAKAO_JS_KEY`, Kakao SDK script URL·SRI integrity, `script-src`/`connect-src` CSP host를 config로 주입하고, 카카오 앱 Web domain 등록 확인 후 활성화 |
| OD-M0-010 | P1 | 분석 이벤트 | GA4는 동의 후 동적 로드하고 event별 최소 custom parameter allowlist만 전송하기로 결정 | 결정 완료. GA4 활성 flag가 켜진 환경에서도 저장된 분석 동의 전에는 방문자 수·page open을 포함한 Google tag/request/cookieless ping을 만들지 않음. 동의 후 browser에서 Google tag를 1회 동적 로드하고, 실패하면 공개 기능을 유지하며 event를 drop. 허용 parameter는 `page_view`=`page_type`,`route_template`; `select_content`=`board_slug`,`content_type`,`list_position_bucket`; `share`=`share_method`,`board_slug`; `scroll`=`page_type`,`scroll_depth_bucket`만 사용. 게시글 제목·본문·원문 URL·내부 `postId`·회원/소셜 식별자·IP·GA4 User-ID·수집 후보 정보는 금지. M0는 GA 대체 자체 분석 DB·일별 방문 집계를 만들지 않고 기존 참고용 게시글 조회 수와 보안·오류 로그만 운영 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md), [개인정보처리방침](../../../legal/privacy-policy.md) | [분석 동의 보강서](../analytics-consent/analytics-consent.dev.md), [이벤트 전송 D01](../analytics-consent/d01/send-analytics-events.md), [GA4 loader](../analytics-consent/d08/analytics-loader.md) | event 전송 D01과 GA4 loader D08에 동의 후 동적 로드, 동의 전 Google 요청 0건, 실패 시 drop, parameter allowlist·금지값, GA 대체 자체 분석 집계 없음 원칙을 반영 |
| OD-M0-011 | P1 | GA4 운영값 | Measurement ID, GA4 property 보관 설정, 국외이전 고지, Google 계약 법인, CSP domain 확정은 보류 | 보류. GA4 구현은 가능하지만 production 운영 활성화는 `NUXT_PUBLIC_GA4_ENABLED=false`로 유지한다. 실제 Measurement ID, property 보관 설정, Google 계약 법인, 국외이전 고지, Google tag/CSP domain이 모두 확정된 환경에서만 GA4를 켠다. M0 Core 공개 자체는 막지 않음 | [분석·광고 계획](../../../planning/04-analytics-ad-plan.md), [법무 README](../../../legal/README.md), [개인정보처리방침](../../../legal/privacy-policy.md), [쿠키 설정 안내](../../../legal/cookie-settings.md) | [분석 동의 보강서](../analytics-consent/analytics-consent.dev.md), [GA4 loader](../analytics-consent/d08/analytics-loader.md), [쿠키 설정 D08](../analytics-consent/d08/cookie-settings.md) | GA4 운영값과 법무 고지가 준비될 때까지 placeholder를 유지하고, 비활성 환경에서는 provider 값을 노출하지 않음 |
| OD-M0-012 | P2 | 예약 운영 | 하루 두 차례 기본 예약 발행 운영 시각은 `07:30`, `17:30` KST로 결정 | 결정 완료. 운영 기본 슬롯은 출근·등교 전후와 퇴근·하교 전후를 겨냥해 `07:30`, `17:30` Asia/Seoul로 둔다. per-post 임의 예약 시각은 계속 허용하고, scheduler는 매분 due post를 확인한다 | [인프라 계획](../../../planning/02-infra-plan.md), [보안·운영](../../../system-design/05-security-operations.md) | [예약 발행 D01](../admin-post-management/d01/schedule-post.md), [발행 API](../admin-post-management/api/publish-post.md) | 예약 발행 D01에 기본 슬롯, 장애 복구 후 지난 예약 발행, 실패 알림, 재시도 경계를 반영 |
| OD-M0-013 | P2 | 카피 | M0 홈·OG·푸터 브랜드 카피와 public config key를 확정 | 결정 완료. 홈 메인은 `블라리요`, 보조 문구와 푸터는 `블라블라블라`, 홈 title은 `블라리요 - 블라블라블라`, 홈 description·OG description은 `블라리요에서 블라블라블라`로 결정. 카피는 `NUXT_PUBLIC_SITE_NAME`, `NUXT_PUBLIC_HOME_TAGLINE`, `NUXT_PUBLIC_HOME_TITLE`, `NUXT_PUBLIC_HOME_DESCRIPTION`, `NUXT_PUBLIC_HOME_OG_DESCRIPTION`, `NUXT_PUBLIC_FOOTER_TAGLINE`로 properties/config 관리 | [카피 후보](../../../planning/06-copy-candidates.md), [화면 설계](../../../planning/03-screen-design.md) | [카피안](./copy-proposals.md), [짤 목록 D08](../public-post-browsing/d08/meme-list.md), [게시글 상세 D08](../public-post-browsing/d08/post-detail.md) | 카피 후보·화면 설계·공개 탐색 D08·인프라 설정 문서에 확정 카피와 config key를 동기화 |

## 4. 출시 차단 항목 요약

M0 Core production 공개 전에는 최소한 다음 항목을 확정해야 한다.

- OD-M0-006: 법무·문의 정보의 properties/config 관리 방식은 확정. 운영자 표시명, 문의 이메일, 권리 접수 이메일, 개인정보 문의 이메일, 개인정보 보호책임자/담당자 실값 입력은 아직 필요

결정은 완료됐지만 아직 정본 동기화가 남은 항목:

- OD-M0-001: 공개 조회수 증가 오류 code는 `VALIDATION_FAILED`로 결정. [API 설계](../../../system-design/03-api-design.md)와 관련 공개 탐색 Spec 반영 필요.
- OD-M0-002: multi-file upload는 `all-or-nothing`으로 결정. 관리자 업로드와 추후 일반 사용자 업로드 모두 같은 원칙을 적용하며, [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 반영 필요.
- OD-M0-003: 관리자 검색 page 초과는 `200` 빈 목록으로 결정. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 반영 필요.
- OD-M0-004: 관리자 `postId` 형식 오류는 `404 POST_NOT_FOUND`로 결정. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 반영 필요.
- OD-M0-005: staging 이미지 폐기 성공은 `202 Accepted`와 공통 성공 envelope로 결정. [API 설계](../../../system-design/03-api-design.md)와 관련 관리자 Spec 반영 필요.
- OD-M0-007: mail client가 열리지 않으면 별도 대체 UX 없이 넘어가기로 결정. 관련 정책·권리 Spec 반영 필요.
- OD-M0-008: IMAGE 없는 상세는 `/og/blariyo-default.png`와 본문 기반 `description`으로 처리하기로 결정. 관련 공개 탐색 Spec 반영 필요.
- OD-M0-009: 서비스 도메인은 `https://blariyo.com/`, 카카오톡 공유는 Kakao JavaScript SDK 기반, 관련 값은 properties/config 관리로 결정. 실제 JavaScript key와 카카오 Web domain 등록 확인 후 관련 Spec 반영 필요.
- OD-M0-010: GA4는 동의 후 동적 로드하고 event별 최소 allowlist parameter만 전송하기로 결정. 관련 분석 동의 Spec 반영 필요.
- OD-M0-012: 기본 예약 발행 운영 시각은 `07:30`, `17:30` KST로 결정. 관련 예약 발행 Spec 반영 필요.
- OD-M0-013: M0 홈·OG·푸터 브랜드 카피와 public config key는 [카피안](./copy-proposals.md) 기준으로 결정. 관련 planning·D08·인프라 설정 문서 반영 필요.

GA4와 카카오 공유는 기본 공개 전체를 막기보다 해당 provider 활성화를 막는 항목이다. 단, 실제로 켜서
배포하려면 OD-M0-009~011을 먼저 확정한다.

## 5. 갱신 절차

1. 위 표에서 항목 ID를 선택한다.
2. `소유 정본` 문서를 먼저 갱신한다.
3. 관련 개발 Spec, API, D01, D08을 동기화한다.
4. 결정이 끝난 항목은 상태를 `확정`으로 바꾸고 확정일과 변경된 정본 링크를 남긴다.
5. source·test·runtime 검증은 별도 증거로 기록하고, 문서 확정을 구현 완료로 표시하지 않는다.
