# TASK-01 — 최초 계획·현재 범위 기준선

- 조사 기준: `c69aa53c0112bcff8f50405c3a81b80969bef05a` (`main`, 2026-09-22)
- 범위: Git 최초 기획, 현행 `planning/` 전체, M1/M1.5 기술·기능 명세, 정적 publishing/wireframe의 표현 경계
- 제외: 실제 Core/Web/Collector의 요구별 구현·실행 검증은 TASK-02의 소관이다. 이 문서는 source 경로의 존재만 보조 근거로 쓴다.

## 판정

프로젝트의 최초 계획은 **2025-04-01 범용 커뮤니티 CMS**이며, 현행 제품 기준선은 **2026-08-11 운영자 큐레이션 유머 피드 재기획**이다. 두 기준선은 같은 제품의 연속 기능 목록이 아니다. 2025 계획의 대댓글·좋아요/싫어요·알림 등은 현행 범위에서 제외 또는 폐기됐고, 2025 프로토타입 구현은 현행 완료로 승계하면 안 된다. 네이티브 앱 제외는 2026 재기획의 별도 경계다. 현행 M0은 `M0 Core → 수집 보조 → 자동 수집`으로 분리되며, M1·M1.5 및 광고/제휴는 독립 gate를 갖는 후속 범위다.

`docs/ai/README.md:5-8`도 폐기 대상으로 정했던 과거 프로토타입을 이어 개발하지 않고 docs 기준 새 구현을 사용한다고 명시한다. 따라서 아래 진행 항목은 **현행 2026 재기획 분모**를 기준으로 한다.

## 기준선 이력

| 기준 | Git 근거 | 범위와 해석 |
| --- | --- | --- |
| 2025 최초 계획 | `5792943f1b5787fc10d2aa581db4416e427bbdb2:README.md:1-4,17-58` | 범용 커뮤니티 CMS: 회원, 사용자 게시글, 댓글·대댓글, 좋아요/싫어요, 신고, 관리자, 선택 알림. 이 commit은 `2025 04 01 기획 및 설계`이며 최초 제품 기획이다. |
| 2025 기술 초안 | `5792943:README.md:62-102,106-146,192-253` | Express/MySQL/MongoDB, JWT, Docker/Nginx, API·ERD 초안. 현재 기술 계약의 완료 근거가 아니다. |
| 2026 재기획 시작 | `d53514eea2dc3313777e4bfe46cd50f72fa7d26b:docs/planning/01-service-plan.md:1-26` | 운영자 선별 유머 웹 피드로 범위를 축소하고 M0/M1/M1.5를 분리했다. `d53514e^`와 2025 기획 tree에는 `docs/planning/`이 없어, 현행 문서 체계의 최초 제품 기획 commit은 d53514e다. |
| 현행 기준 | `docs/planning/01-service-plan.md:1-36` | M0 Core, 수집 보조, 자동 수집, M1, M1.5를 다시 명시하고 각 공개 gate를 분리한다. |

## 최초 대비 변경 분류

| 2025 최초 기능 묶음 | 현행 대응 | 분류 | 근거 |
| --- | --- | --- | --- |
| 이메일 가입/JWT, 선택 OAuth | M1 소셜 4종, 최소 정보, 동의·재동의·탈퇴 | 변경·후속 | `5792943:README.md:19-25`; `docs/planning/01-service-plan.md:66-76`; `docs/planning/08-member-community-plan.md:27-39` |
| 모든 사용자의 게시글 CRUD·카테고리·이미지 | M0은 운영자만 짤 게시, 사용자 텍스트 익게는 M1.5 | 축소·단계 이동 | `5792943:README.md:26-33`; `docs/planning/01-service-plan.md:11-19,357-363`; `docs/planning/08-member-community-plan.md:12-15` |
| 댓글과 대댓글 | M1.5 댓글만, 대댓글은 제외 | 축소·후속 | `5792943:README.md:34-37`; `docs/planning/08-member-community-plan.md:12-15` |
| 게시글·댓글 좋아요/싫어요 | 현행 M1/M1.5 계약·명세에 없음 | 폐기(현행 잔여 아님) | `5792943:README.md:39-41`; `docs/planning/08-member-community-plan.md:12-15` |
| 신고·관리자 조치 | M1.5 신고·수동 moderation·제재로 유지 | 변경·후속 | `5792943:README.md:43-53`; `docs/planning/01-service-plan.md:418-422`; `docs/development-specs/m1-5/community-moderation/community-moderation.dev.md:1-28` |
| 실시간 알림 | 현행 첫 버전 제외 | 폐기(현행 잔여 아님) | `5792943:README.md:55-58`; `docs/planning/08-member-community-plan.md:12-15` |
| 범용 CMS 기술 스택 | Nest/PostgreSQL/Nuxt·Spring collector 등 새 계약 | 교체, 이행률 비산정 | `5792943:README.md:64-79`; `docs/ai/README.md:5-8`; `docs/system-design/08-code-structure.md:1-77` |
| 네이티브 앱 | 2026 재기획과 현행 범위 모두 제외 | 제외(잔여 아님) | `d53514e:docs/planning/01-service-plan.md:103-112`; `docs/planning/01-service-plan.md:13-19` |
| PWA | d535 재기획의 M1 제외 목록에는 있으나 현행 planning 정본에 별도 범위 정의가 없음 | 현행 잔여·제외로 단정하지 않음 | `d53514e:docs/planning/01-service-plan.md:189-202`; `docs/planning/01-service-plan.md:1-36` |

### 2026 재기획 내부의 단계 변경

| d535 재기획(2026-08-11) | 현행 제품 계약 | 분류 | 근거 |
| --- | --- | --- | --- |
| M1: 이메일 가입, 좋아요, 댓글, 신고, 최소 관리자 | M1: 네 소셜 제공자 가입·로그인·계정 생명주기만 | 재분할·축소 | `d53514e:docs/planning/01-service-plan.md:174-202`; `docs/planning/01-service-plan.md:21-35,66-76,412-416` |
| M1.5: 로그인 사용자 승인형 제보, 이미지 1개, 관리자 검수·발행 | M1.5: 텍스트 익게 글·댓글·신고·moderation; 승인형 제보는 현행 정본 단계로 유지되지 않음 | 대체·재분할 | `d53514e:docs/planning/01-service-plan.md:204-241`; `docs/planning/01-service-plan.md:28-29,357-363,418-422`; `docs/planning/08-member-community-plan.md:12-15,64-112` |

## 현행 기능 묶음 inventory

상세 기계 판독 목록은 [01-plan-items.json](01-plan-items.json)에 있다. 아래 `구현 관찰`은 source·migration·test의 **존재만** 표시한 것이며 요구 충족이나 실행 PASS가 아니다.

| 단계 | 기능 묶음 | 현행 정본 | 현재 문서 상태 | 구현 관찰·잔여 수용 조건 |
| --- | --- | --- | --- | --- |
| M0 Core | 공개 게시글 탐색·공유/OG | `docs/planning/01-service-plan.md:391-401`, `docs/development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md:1` | 설계·명세 있음 | `apps/api/src/features/public/`, `apps/web/` 존재. TASK-02가 route/DB/test/runtime을 검증해야 한다. |
| M0 Core | 운영자 초안·이미지·예약/발행/숨김 | `docs/planning/01-service-plan.md:393-400`, `docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md:1` | 설계·명세 있음 | `apps/api/src/features/posts/`, `images/`, migration `V001`~`V003` 존재. 실제 수용은 별도. |
| M0 Core | 정책 공개·권리 문의/숨김 | `docs/planning/01-service-plan.md:98-119,399-400`, `docs/development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md:1` | 설계·명세 있음 | 정책·권리 source 존재 여부만 관찰. 현행 법무·운영 실값과 처리 증거는 TASK-03이 별도로 확인한다. |
| M0 Core | 분석 동의·GA4 준비 | `docs/planning/01-service-plan.md:401,426-429`, `docs/development-specs/m0-core/analytics-consent/analytics-consent.dev.md:1` | 기본 비활성 설계 | GA4 운영 활성화는 M0 Core 완료와 별개이며 실값·법무·CSP gate 전에는 비활성이다. |
| M0 수집 보조 | 단일 URL 후보·검수/반려/초안 승격 | `docs/planning/01-service-plan.md:403-406`, `docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md:1` | 설계·명세 있음 | API collection 모듈과 `V004`~`V006`은 존재하나 end-to-end 수용은 TASK-02 소관이다. |
| M0 수집 보조 | 로컬 Spring/Discord 실행 경계 | `docs/planning/content-collection/README.md:240-362,456-475`, `docs/system-design/07-spring-collector-design.md:14-24` | 설계 계약 있음 | `apps/collector/`와 Discord/Batch source 존재. 실제 Discord·출처·운영 증거의 현행 상태는 TASK-03 확인 대상이다. |
| M0 자동 수집 | 출처 정책·활성화 제한 | `docs/planning/content-collection/README.md:62-72,384-408`, `docs/planning/content-collection/source-collection-policy.md:1-34` | 이번 구현 범위이나 activation 별도 | 21개 registry는 production 활성화 근거가 아니다. 출처별 외부·운영 증거는 TASK-03이 확인한다. |
| M0 자동 수집 | Hot/Top batch discovery | `docs/planning/content-collection/README.md:477-490`, `docs/system-design/07-spring-collector-design.md:706-749` | 최근 추가된 구현 범위 | collector batch source·`V007` 존재. `design-readiness.md:21`의 2026-09-09 “미구현”은 9/21 확장보다 오래되어 현행 상태 근거로 단독 사용 불가; TASK-02가 최신 commit을 검증해야 한다. |
| M1 | 소셜 인증·가입·필수 동의 | `docs/planning/01-service-plan.md:66-76,412-416`, `docs/development-specs/m1/member-identity/member-identity.dev.md:1-28` | 조건부 설계 확정 가능 | `docs/system-design/design-readiness.md:22`는 구현 미검증으로 판정한다. provider·법무·운영 증거의 현행 상태는 TASK-03 확인 대상이다. |
| M1 | 계정 연결·세션·탈퇴 | `docs/planning/08-member-community-plan.md:41-61`, `docs/development-specs/m1/account-lifecycle/account-lifecycle.dev.md:1-29` | 조건부 설계 확정 가능 | 구현·경쟁·worker·복원은 TASK-02, provider·운영 실증은 TASK-03이 확인한다. |
| M1.5 | 익게 글·댓글·내 활동·글별 랜덤 이름 | `docs/planning/01-service-plan.md:418-422`, `docs/development-specs/m1-5/community-participation/community-participation.dev.md:1-28` | 조건부 설계 확정 가능 | `docs/system-design/design-readiness.md:23` 기준 구현 미검증, M1이 선행이다. 운영 공개 근거는 TASK-03 확인 대상이다. |
| M1.5 | 신고·운영 검토·제재 | `docs/planning/08-member-community-plan.md:84-112`, `docs/development-specs/m1-5/community-moderation/community-moderation.dev.md:1-28` | 조건부 설계 확정 가능 | API/DB/UI/동시성은 TASK-02, 보존 근거·운영 수용은 TASK-03이 확인한다. |
| 별도 활성화 | 광고·제휴 | `docs/planning/04-analytics-ad-plan.md:92-216`, `docs/planning/01-service-plan.md:424` | gate만 확정·비활성 | M1/M1.5 완료 분모에 넣지 않는다. M0 Core 공개도 이 기능만으로 막지 않는다. |
| 후속 미정 | 뉴스·추가 게시판 | `docs/planning/01-service-plan.md:364-373,375-386` | 상세 요구 미정 | 이름·운영 방식이 정해지지 않아 현행 완료 분모에서 제외한다. |

## 21개 수집 출처 coverage

출처별 명세 파일은 21개이고, 목록 정책은 `source-collection-policy.md:12-32`가 정본이다. `HOT_LIST` 4개(arcalive, bobaedream, dogdrip, inven), `DETAIL_ONLY` 1개(theqoo), `UNVERIFIED` 1개(yuldo), `BLOCKED` 15개다. `HOT_LIST`도 policy 승인이 전까지 `approved=false`, `batchApproved=false`다(`source-collection-policy.md:34`). 그러므로 21개 문서·registry가 있다는 사실은 21개 출처의 네트워크 수집 또는 production 활성화 완료가 아니다.

## 정적 화면 표현의 경계

- `docs/publishing/responsive/README.md:3-16,26-59`는 정적 프로토타입이 M0·M1 로그인·후속 광고를 섞어 표현한다고 명시하고, M0 구현 완료 증거가 아니라고 규정한다.
- `docs/wireframes/community/index.html:70-91,113-119`는 익게 M1.5 참고안이며 초기 공개 대상·구현 증거가 아님을 표시한다.
- 화면의 제품 계약은 `docs/planning/03-screen-design.md:23-52`가 우선이다. publishing/wireframe의 존재는 기능 구현 분자에 포함하지 않는다.

## 제품 가설 검증의 별도 부족 항목

최초 재기획의 핵심 가설은 “운영자가 고른 유머를 연속 소비하고 7일 안에 재방문하는가”였다(`d53514e:docs/planning/01-service-plan.md:14-18`). 당시에는 제한 공개 100명 내외와 4주 지표 수집 시작을 개발 계획에 넣었다(`d53514e:docs/planning/01-service-plan.md:746-756`). 현행 M0 Core 완료 조건은 하루 두 번 발행과 목록·상세 연속 열람이라는 **기능·운영 가능 상태**로 재정의돼 있다(`docs/planning/01-service-plan.md:426-429`). 이는 제품 가설의 검증 완료 조건과 다르다.

현행 분석 계약은 production GA4를 기본 비활성으로 두고 자체 방문·세션·원시 이벤트 수집을 만들지 않으며(`docs/planning/04-analytics-ad-plan.md:18-27`), `viewCount`도 방문자·세션·조회 이력을 저장하지 않는 참고용 누적값이라고 명시한다(`docs/planning/04-analytics-ad-plan.md:38-45`). 따라서 GA4가 비활성인 현재 상태와 조회수만으로는 재방문·고유 방문자·연속 소비를 측정하거나 최초 가설의 통과를 판정할 수 없다.

| 필요 결정 | 현재 근거 | 부족한 결정·증거 |
| --- | --- | --- |
| 성공/중단 기준 | 재방문 우선 원칙과 가설은 남아 있음(`d53514e:docs/planning/01-service-plan.md:14-18,121-128`) | KPI 정의와 통과·중단·M1 착수 기준이 현행 정본에서 정량/정성 모두 확정되지 않음 |
| 측정 방식 | 동의형 GA4 event 계약만 있음(`docs/planning/04-analytics-ad-plan.md:47-73`) | 동의 편향·차단·지연을 포함한 해석 규칙과 어떤 보고서를 제품 가설 판단에 쓸지 미결 |
| 관찰 기간/대상 | 과거 계획의 100명·4주 수집은 역사적 참고임 | 현행 공개 대상, 관찰 기간, 재방문 cohort 정의와 판정 책임자가 없음 |
| 콘텐츠 공급 가능성 | 하루 2회·20~40개·07:30/17:30 KST 운영값은 있음(`docs/planning/01-service-plan.md:88-96`) | 실제 공급자, 준비·권리 확인 시간, 지속 가능 운영 시간, 관찰 기간 동안 발행 이력/중단 조건이 정본에서 추적되지 않음 |

이 항목은 구현률 분모에 넣지 않는 **제품 검증 gate**다. 수치나 KPI 목표를 임의로 만들지 말고, M0 공개 전 또는 제한 공개 시작 전에 기준·측정·관찰 기간·책임자를 planning 정본에서 확정해야 한다.

## 진행률 산정 제안

공수·문서량·commit 수로 퍼센트를 만들지 않는다. 아래처럼 **동일 가중 기능 묶음**마다 `구현됨`, `부분`, `미구현`, `후속·제외`를 TASK-02/03의 증거로 판정한다.

| 계산 | 규칙 |
| --- | --- |
| 기능 묶음 coverage | 이 표의 M0 Core 4, 수집 보조 2, 자동 수집 2, M1 2, M1.5 2는 범위 누락을 찾기 위한 대분류 골격일 뿐 최종 퍼센트 분모가 아니다. |
| 최종 단계별 분모 | TASK-02가 각 대분류를 요구별 세부 inventory로 분해하고 source/test/runtime 증거를 붙인 뒤 확정한다. 광고/제휴·뉴스·네이티브 앱은 해당 단계 분모에서 제외한다. PWA는 현행 정본 범위가 확정되기 전 분모에 넣지 않는다. |
| 엄격 완료 하한 | `구현됨 수 / 해당 단계 분모`. 구현됨은 요구별 source·migration/API·자동 test/build 또는 명시한 실제 실행 증거가 모두 있는 경우만 쓴다. |
| 부분 포함 상한 | `(구현됨 수 + 부분 수) / 해당 단계 분모`. 부분은 적어도 하나의 요구 구현 증거가 있으나 수용 조건이 남은 경우다. |
| 문서 준비율 | 설계/명세가 있는 항목의 비율을 별도 지표로만 기록한다. 구현률과 합산하지 않는다. |
| 운영 공개 상태 | 각 기능의 production gate는 별도 `승인/차단`으로 표시하며 구현률 분자에 넣지 않는다. |
| 제품 가설 검증 | KPI·측정·관찰 기간·콘텐츠 공급 관찰은 별도 `판정 가능/미정` gate로 기록하며 구현률과 합산하지 않는다. |

현재 TASK-01의 결론은 정본·잔여 경계와 기능 묶음 coverage 확정이다. 최종 퍼센트 분모와 숫자 산출은 TASK-02의 요구별 세부 inventory를 우선하며, TASK-03의 운영 gate 검증 뒤에만 확정할 수 있다.

## 부족·보완 우선순위

1. **High — 기준선 혼동 방지:** 최종 보고서에는 2025 CMS와 2026 피드 재기획을 별도 표로 두고, 과거 prototype PASS를 현행 분자에서 제외한다.
2. **High — 자동 수집 상태 정정 필요:** `design-readiness.md:21`의 9/9 상태와 9/21 batch 확장(`content-collection/README.md:477-490`)이 시간상 충돌한다. 최신 source·migration·test 증거로 TASK-02가 상태를 판정한다.
3. **High — M1/M1.5 잔여 분리:** 문서가 “작성 완료”여도 `design-readiness.md:22-23`은 구현 미검증과 production 차단을 명시한다. 설계 준비와 구현·운영 공개를 합산하지 않는다.
4. **Medium — 수집 활성화의 근거 대조:** registry·fixture·batch code와 별개로 출처별 robots/약관/연락처/요청 상한 및 운영 승인 증거를 TASK-03이 현재 상태에서 대조해야 한다(`content-collection/README.md:393-408,485-490`).
5. **Medium — 정적 화면 과장 방지:** publishing/wireframe은 화면 비교 자료로만 보고 browser/runtime 검증은 실제 `apps/web`에서 별도 수집한다.
6. **High — 제품 검증 기준 부재:** 최초 가설은 남았지만 현행 M0 완료 조건은 구현·발행 가능 상태이고, GA4 off 및 참고용 조회수로는 재방문을 판정할 수 없다. KPI/측정/관찰 기간/콘텐츠 공급 책임을 정본에 확정해야 한다.

## 조사 coverage와 한계

- 직접 확인: Git 2025 최초 README, 2026 d535 계획, 현행 planning `01`~`09`, 콘텐츠 수집 README·정책·21 source 목록, M1/M1.5 system-design·4개 기능 명세, 9개 development spec 제목, publishing/wireframe 경계, source directory 존재.
- 미검증: 서비스 기동, DB readback, browser, 외부 provider/Discord/GA4/법무/출처 정책, 코드 요구별 충족. 이들은 각각 TASK-02·TASK-03의 독립 검증 대상이다.
