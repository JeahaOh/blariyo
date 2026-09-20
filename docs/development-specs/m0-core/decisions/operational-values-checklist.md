# M0 Core 운영 실값 체크리스트

- 문서 상태: M0 운영 입력 주입·공개 배포 완료, 후속 활성화 gate 및 일부 검증 잔여
- 기준일: 2026-09-03
- 정합성 검토일: 2026-09-20
- 관련 결정: [OD-M0-006, OD-M0-009, OD-M0-011](./open-decisions.md)
- 범위: M0 Core production 공개 또는 provider 활성화 전에 입력·검증할 실제 운영값
- 제외: secret 원문, token, password, private key, `.env` 실값

이 문서는 이미 결정된 설계와 별도로 실제 운영 환경에서 채워야 할 값만 추적한다. 값 원문은
저장소에 기록하지 않고 배포 환경 properties/config, secret store 또는 provider console에서 관리한다.

## 1. 상태 기준

| 상태 | 의미 |
| --- | --- |
| 필요 | production 공개 또는 기능 활성화 전에 입력·확인 필요 |
| 보류 | 후속 기능 또는 사업자등록 전까지 미입력 유지 |
| 완료 | 실제 값 입력, provider 설정, 문서 고지, runtime 검증까지 끝남 |
| 해당 없음 | 현재 M0 Core 공개 또는 활성 기능에 적용하지 않음 |

`완료`는 문서에 값을 적었다는 뜻이 아니다. 실제 배포 설정에 값이 있고, 공개 화면·provider console·
runtime 동작을 확인했을 때만 완료로 바꾼다.

## 2. M0 Core 운영 입력과 확인 범위

2026-09-20 기준이다. [현재 운영 상태](../../../implementation/operations/current-status.md)와
[TASK-19](../../../../worklog/task-list/09/20/infrastructure-setup/TASK-19.md)에 실행 증거를 기록한다.
설정 형식·화면 반영을 담당자 적정성이나 법률상 모든 쟁점의 확인으로 확대하지 않는다.

| 항목 | 실제 config key 또는 위치 | 현재 상태·검증 경계 |
| --- | --- | --- |
| 운영자 표시명 | `NUXT_PUBLIC_OPERATOR_DISPLAY_NAME`, Core `LEGAL_CONFIG.operatorDisplayName` | 입력·공개 정책 화면 반영 확인 |
| 시행일 | 정책 release artifact, DB | v0.1, 2026-09-20 EFFECTIVE·공개 API 확인 |
| 일반 문의 | `NUXT_PUBLIC_CONTACT_EMAIL`, `LEGAL_CONFIG.contactEmail` | 기존 입력 주입, Cloudflare Email Routing→Gmail 구성 확인 |
| 권리 문의 | `NUXT_PUBLIC_RIGHTS_EMAIL`, `LEGAL_CONFIG.rightsEmail` | 기존 입력 주입·정책 반영. 실제 신고 처리 절차 시험은 별도 |
| 개인정보 문의 | `NUXT_PUBLIC_PRIVACY_EMAIL`, `LEGAL_CONFIG.privacyEmail` | 기존 입력 주입·정책 반영 |
| 개인정보 담당자 표시 | `NUXT_PUBLIC_PRIVACY_OFFICER`, `LEGAL_CONFIG.privacyOfficer` | 실제 앱 파서·공개 본문 반영 확인. 담당자 적정성은 운영자 확인 사항 |
| 호스팅·이미지 | 현행 M0 개인정보처리방침 | AWS 서울·Cloudflare 실제 구성 반영 |
| 메일 | 현행 M0 개인정보처리방침 | Cloudflare Email Routing·일반 Gmail 반영 |
| 접속·보안 로그 근거 | 현행 M0 개인정보처리방침 | 목적·범위·제공자 처리 구분 반영. 별도 법률 검토를 완료로 표시하지 않음 |
| 진단 로그 보존 | 보안·운영 설계 §7 | 앱·Web·Nginx 최대 7일, timer·합성 만료 파일 삭제 확인. 제공자 감사 기록·법정 기록은 별도 |

후속 기능용 책임자 이름·직책·부서 표시는 전체 개인정보 초안의 확인 조건으로 유지한다.
현재 앱은 위 `privacyOfficer` 단일 공개 표시를 사용하며 존재하지 않는 환경변수를 배포에 주입하지 않는다.

## 3. 사업자등록 또는 거래 기능 전까지 보류

아래 값은 사업자등록, 통신판매, 유료 거래, 제휴 정산 등 공개 의무가 확정되기 전까지 `(미정)`으로
둔다. 추정값을 넣지 않는다.

| 항목 | config key | 현재 상태 |
| --- | --- | --- |
| 사업자명 | `BLARIYO_BUSINESS_NAME` | 보류 |
| 대표자명 | `BLARIYO_REPRESENTATIVE_NAME` | 보류 |
| 사업자등록번호 | `BLARIYO_BUSINESS_REGISTRATION_NUMBER` | 보류 |
| 통신판매업신고번호 | `BLARIYO_MAIL_ORDER_REGISTRATION_NUMBER` | 보류 |
| 주소 | `BLARIYO_OPERATOR_ADDRESS` | 보류 |
| 전화번호 | `BLARIYO_OPERATOR_PHONE` | 보류 |

## 4. 카카오톡 공유 활성화 gate

카카오톡 공유는 M0 Core에 구현할 수 있지만 아래 항목이 끝나기 전에는
`NUXT_PUBLIC_KAKAO_ENABLED=false`로 둔다. 링크 복사와 브라우저 기본 공유는 계속 동작해야 한다.

| 항목 | config key 또는 확인 위치 | 현재 상태 | 검증 방법 |
| --- | --- | --- | --- |
| 서비스 공개 URL | `NUXT_PUBLIC_SITE_ORIGIN=https://blariyo.com/` | 도메인 HTTPS 확인, 실제 게시글 공유 URL은 미검증 | 실제 배포의 SSR canonical·share URL 확인 |
| Kakao JavaScript key | `NUXT_PUBLIC_KAKAO_KEY` | 필요 | 카카오 개발자 console의 JavaScript key 확인 |
| Web domain 등록 | 카카오 개발자 console | 필요 | `https://blariyo.com` 등록 확인 |
| SDK script URL | `NUXT_PUBLIC_KAKAO_SDK_URL` | 필요 | 공식 SDK URL 재확인 |
| SDK SRI integrity | `NUXT_PUBLIC_KAKAO_INTEGRITY` | 필요 | 고정한 SDK 파일 hash 확인 |
| CSP script host | `KAKAO_CSP_SCRIPT_HOST` | 필요 | `script-src`에 필요한 host만 추가 |
| CSP connect host | `KAKAO_CSP_CONNECT_HOST` | 필요 | `connect-src`에 필요한 host만 추가 |
| 활성 flag | `NUXT_PUBLIC_KAKAO_ENABLED` | 필요 | 모든 gate 충족 전 `false`, 충족 후 `true` |

## 5. GA4 운영 활성화 gate

GA4는 M0 Core 공개 전체를 막지 않는다. 아래 항목이 끝나기 전에는
`NUXT_PUBLIC_GA4_ENABLED=false`로 두고 `NUXT_PUBLIC_GA4_MEASUREMENT_ID`를 public runtime config에서
unset한다.

| 항목 | config key 또는 확인 위치 | 현재 상태 | 검증 방법 |
| --- | --- | --- | --- |
| GA4 활성 flag | `NUXT_PUBLIC_GA4_ENABLED` | 필요 | gate 완료 전 `false` 확인 |
| Measurement ID | `NUXT_PUBLIC_GA4_MEASUREMENT_ID` | 필요 | flag false 환경에서는 미노출 확인 |
| GA4 property 보관 설정 | GA4 admin console, 개인정보처리방침 | 필요 | 실제 보관 기간과 cookie 만료 고지 일치 확인 |
| 실제 Google 계약 법인 | 개인정보처리방침 제6조·제7조 | 필요 | 위탁/국외이전 고지에 동일 법인 표시 |
| 국외이전 고지 | 개인정보처리방침 제7조 | 필요 | 국가, 항목, 시점, 방법, 기간, 거부 효과 확인 |
| Google tag host | CSP `script-src` | 필요 | 동의 후 로드에 필요한 host만 추가 |
| GA4 collect host | CSP `connect-src` | 필요 | 동의 전 request 0건, 동의 후 event 전송 확인 |
| DebugView 또는 실시간 검증 | GA4 DebugView | 필요 | 허용 event·parameter만 수신되는지 확인 |

## 6. 커밋·문서 운영 원칙

- 이 문서에는 실값 원문을 커밋하지 않는다.
- 공개해도 되는 config key 이름, 입력 필요 여부, 검증 방법만 남긴다.
- 실제 값은 production properties/config, provider console, secret store에서 관리한다.
- 값이 확정되면 `docs/legal/`, `docs/system-design/04-infrastructure-design.md`,
  `docs/system-design/05-security-operations.md`, 관련 개발 Spec을 함께 재검토한다.
- source·browser·provider console 검증 전에는 문서 상태를 `완료`로 바꾸지 않는다.
