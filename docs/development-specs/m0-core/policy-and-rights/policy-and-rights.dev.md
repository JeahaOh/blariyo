# 정책 공개와 권리 문의 기능 명세

## 1. 문서 정보와 입력 근거

- 문서 상태: `차단`
- milestone: `M0 Core` (`m0-core`)
- 기능: `policy-and-rights` — 약관·개인정보 버전 조회와 권리 문의 진입
- 기준일: 2026-09-07
- 미검증: 법률 확정, 실제 정책 artifact, 접수 이메일, policy command/API/source/runtime
- 주요 근거:
  - [서비스 기획 §3·§11·§14](../../../planning/01-service-plan.md)
  - [화면 설계 §10·§13](../../../planning/03-screen-design.md)
  - [법무 문서 목록과 출시 차단](../../../legal/README.md)
  - [이용약관](../../../legal/terms-of-service.md), [개인정보처리방침](../../../legal/privacy-policy.md), [권리자 안내](../../../legal/rights-request.md)
  - [데이터 모델 §4](../../../system-design/02-data-model.md), [API 설계 §3 정책](../../../system-design/03-api-design.md)

## 2. 목표와 대상 milestone

이용자가 현재·과거 이용약관과 개인정보처리방침 전문을 modal 또는 직접 route에서 확인하고,
현재 URL이 포함된 권리 문의 이메일을 작성할 수 있게 한다. 승인된 정책은 버전별 불변 기록으로 시행한다.

## 3. 행위자와 진입 조건

- 공개 이용자: footer의 이용약관·개인정보처리방침·권리 문의, `/terms`, `/privacy`
- 운영자: 승인된 policy release artifact를 시행 시각부터 5분 안에 단발성 command로 발행
- 선행: 운영자 표시명·시행일·일반 문의·권리 침해 신고/요청·개인정보 문의 이메일,
  개인정보 보호책임자 또는 담당자, 실제 사용 수탁자 실값 확정과 법률 검토

## 4. 범위와 범위 밖

범위:

- `terms`,`privacy` 현재·과거 버전 조회와 본문·이력 UI
- modal focus·scroll 제어와 직접 route fallback
- 정책 시행 command의 checksum·sanitize·version 전환·cache purge
- footer `권리 문의` mailto·주소 및 문의 양식 복사 대체 안내와 관리자 우선 숨김 프로세스 연결

범위 밖:

- 권리 문의 form·`/rights`·권리 요청 API
- mail client 실행 성공·실패의 확정 판정, 별도 접수 DB
- 법률 문구 자체 확정, 이메일 사업자 선정, ticket/민감자료 저장
- 쿠키 선택 UI는 [analytics-consent](../analytics-consent/analytics-consent.dev.md)가 소유한다.

## 5. 요구사항 추적표

| 요구사항 | 분류 | 출처 | 반영 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| current 전문과 버전·적용 기간 이력 | 확정 | 화면 설계 §10 | get-policy, D01·D08 policy | 반영 |
| 시행된 본문 불변·버전 보관 | 확정 | 데이터 모델 §4 | publish-policy, D08 command | 반영 |
| modal·직접 route 동등 내용 | 확정 | 서비스 기획 §11 | policy-viewer | 반영 |
| 현재 URL을 넣은 권리 mailto | 확정 | 화면 설계 §10 | submit-rights-inquiry, rights-entry | 반영 |
| 법무·문의 실값의 properties/config 주입 | 확정 | OD-M0-006·legal README | policy D01·D08 | 실값 미입력으로 `[출시 차단]` 유지 |
| 사업자등록 전 사업자 정보 보류 | 확정 | OD-M0-006·legal README | policy D01·D08 | `(미정)` 유지 |
| 단일 권리 문의 링크와 복사 대체 안내 | 확정 | 2026-09-20 사용자 결정·화면 설계 | rights D01·D08 | 이메일 주소·제목·본문 전체 복사 |
| mail client 실행 결과 확정 판정 없음 | 확정 | 화면 설계 | rights D01·D08 | 1.6초 동안 blur·hidden 신호 없음은 대체 안내 조건일 뿐 |
| form·API | 범위 밖 | 서비스 기획 §11 | 전체 | 생성 안 함 |

## 6. 업무 규칙과 수용 조건

- 정책 API는 `terms`,`privacy`만 받고 `EFFECTIVE`와 `RETIRED`만 공개한다.
- 본문은 허용 목록으로 sanitize한 `bodyHtml`만 반환하고 초안·원문은 공개하지 않는다.
- 현재 적용 기간은 `시행 중`, 과거는 시작~종료이며 행 선택 시 같은 modal 본문을 교체한다.
- 권리 mailto에는 현재 URL과 요청 내용 입력란만 미리 넣고 개인정보 원문을 자동 수집하지 않는다.
- 권리 문의는 `BLARIYO_RIGHTS_CONTACT_EMAIL` 실값을 사용한다. 메일 전환 신호가 없으면 주소·제목·양식을 복사하고 alert로 알린다. 실행 결과는 확정하지 않으며 form·API·접수 DB는 만들지 않는다.

## 7. 데이터·권한·법무 영향

- `legal.policy_version`의 시행 버전은 불변이며 유형별 EFFECTIVE 한 건이다.
- policy artifact는 root `0600`, command container read-only mount, 종료 후 제거한다.
- 권리 메일 본문·소명자료는 application DB·log에 복사하지 않는다.
- 법무 placeholder는 근거 없이 제거하지 않는다.

## 8. API 작업 목록

- [정책 버전 조회](#api-get-policy)
- 정책 시행은 HTTP API 해당 없음. 운영 단발성 command를 사용한다.

## 9. 처리 흐름 찾아보기

- [정책 본문과 이력 열람](#d01-view-policy)
- [승인 정책 시행](#d01-publish-policy)
- [권리 문의 이메일 작성](#d01-submit-rights-inquiry)

## 10. 화면·프로그램 찾아보기

- [정책 viewer](#d08-policy-viewer)
- [정책 시행 command](#d08-policy-publish-command)
- [권리 문의 진입](#d08-rights-inquiry-entry)

## 11. 결정·가정·미정·차단 항목

- 출시 차단: legal README의 운영자 표시명·시행일·수탁자·일반 문의·권리·개인정보 접수 이메일과
  개인정보 보호책임자 또는 담당자 실값. 사업자 정보는 사업자등록 또는 거래 기능 확정 전까지 보류한다.
- 확정: 별도 복사 버튼 없이 권리 문의에서 mailto를 연다. 1.6초 동안 전환 신호가 없으면 주소·제목·양식을 복사하고 alert로 알린다.
- 미검증: 법률 자문, 실제 release artifact/checksum, SMTP/mail client, policy cache purge.
- 문서 계약은 작성했지만 실값이 없으므로 production 공개 상태를 `차단`으로 유지한다. 로컬 조회·시행 command·UI는 별도 테스트 fixture로 개발한다.

## 12. 기능 계약 상세

아래 API·처리 흐름·화면 절을 이 파일에서 함께 관리한다. 각 절의 미검증·차단 조건은 유지하며, 문서 통합은 구현 완료를 뜻하지 않는다.

요청·응답 형식은 [M0 Core OpenAPI](../openapi/m0-core.yaml)를 참조한다. 아래 필드 보충은 데이터 매핑과 업무 제약을 설명하며, 타입·필수 여부를 별도 계약으로 재정의하지 않는다.

<a id="api-get-policy"></a>

### 정책 버전 조회 API

- 계약 상태: `차단`

- 입력 근거: [API 설계 §3 정책](../../../system-design/03-api-design.md), [데이터 모델 §4](../../../system-design/02-data-model.md)
- 미검증: 승인 본문·시행일, OpenAPI, source, contract test

#### 목적과 호출 경계

공개 화면과 SSR이 현재 또는 지정 과거 정책 전문과 전체 공개 이력을 읽는다. 외부 제공자는 Nuxt
BFF, 내부 제공자는 Core `PolicyQueryService`이며 초안·정제 전 원문은 어느 경계에서도 반환하지 않는다.

#### Method·path·인증·권한

`GET /api/v1/policies/:type?version=v0.2`; 인증 없음; `public, max-age=60, s-maxage=300`.

#### Request

**필드 보충 — 제약·데이터 매핑**

- `type`: `terms`,`privacy`; policy_type mapping; 유형
- `version`: 공개된 version label; policy; 생략 시 current

body 없음.

#### Response

공개된 policy와 history를 반환한다. 제목은 승인값, bodyHtml은 allowlist 정제값이다. UTC 적용 기간은 `[effectiveAt,endedAt)`이며 current의 endedAt은 null이다.

#### Validation과 정규화

허용 type/version만 조회한다. `bodyHtml`은 저장 전 정제 완료 값이며 BFF가 다시 내부 field를 제거한다.

#### 정상 처리와 데이터 전이

생략 version은 유형별 `EFFECTIVE`, 지정 version은 `EFFECTIVE|RETIRED`를 읽는다. 쓰기·상태 전이 없음.

#### 오류·권한·충돌·부분 실패

유형·version 미존재/초안은 `404 POLICY_NOT_FOUND`; DB 장애 `503`; 오류 응답 no-store.

#### 멱등성·동시성·재시도

멱등 read. 정책 시행 경계에서 ETag/cache purge로 current 전환을 반영한다.

#### Pagination·cache·호환성

history pagination 없음. body hash ETag와 `304`를 지원한다.

#### Contract test와 미검증

현재·과거·초안 비공개, sanitize, 반개방 기간 경계, cache purge를 검증한다. 승인 실값과 실행 증거가 없어 `차단`이다.

<a id="d01-publish-policy"></a>

### 승인 정책 시행

- 계약 상태: `차단`

- 입력 근거: [데이터 모델 §4 정책 버전](../../../system-design/02-data-model.md), [보안·운영 §12](../../../system-design/05-security-operations.md)
- 미검증: 승인 artifact, command source, DB·cache runtime

#### 프로세스 목적과 범위

법무 승인 artifact를 고지된 시행 시각에 정책 version으로 원자 시행한다.

#### 행위자·시작·선행 조건

권한 있는 운영자, 유형·version·제목·원문·시행 시각·checksum이 든 승인 artifact, root `0600` 보관이
필요하다. 운영자 표시명·일반 문의·권리·개인정보 접수 이메일과 개인정보 보호책임자 또는 담당자
config 실값이 artifact에 반영돼야 하며 해당 placeholder가 남아 있으면 시행할 수 없다.

#### 정상 흐름

1. 시행 시각과 checksum을 확인한다.
2. artifact를 command container에 read-only로 mount한다.
3. `npm run policies:publish -- --artifact=<path>`를 시행 시각부터 5분 안에 한 번 실행한다.
4. command가 schema·checksum, 필수 법무·문의 실값과 placeholder 부재를 검증하고 body를 allowlist sanitize한다.
5. 유형 advisory lock transaction에서 기존 EFFECTIVE를 같은 경계 시각 RETIRED로 바꾸고 새 EFFECTIVE를 insert한다.
6. 정책 API와 직접 route cache purge outbox를 기록하고 commit한다.
7. current·history·cache purge 결과를 확인하고 mount·임시 파일을 제거한다.

#### 대안·실패 흐름

- 미래 시각 또는 5분 초과 과거: 거부. 새 시행 시각으로 법무 문서·artifact를 다시 승인한다.
- checksum/schema/필수 법무·문의 실값/sanitize/DB 실패: 전체 rollback, 기존 current 유지.
- purge 실패: DB 시행 유지, outbox 재시도.

#### 단계별 API 매핑

시행 HTTP API 해당 없음. 확인은 [정책 조회 API](#api-get-policy)를 사용한다.

#### 데이터·상태 전이

동일 유형 `EFFECTIVE→RETIRED`와 새 `EFFECTIVE`; 구간은 `[effectiveAt,endedAt)`다.

#### 권한·트랜잭션·멱등성·재시도

유형 advisory lock과 unique EFFECTIVE 제약을 사용한다. 실패 artifact를 과거 시각으로 강제 재실행하지 않는다.

#### 완료 조건과 수용 기준

API·route current version, 이력 경계, 필수 법무·문의 실값, placeholder 부재, sanitize 본문, purge와
artifact 제거를 확인해야 한다. 사업자 정보 placeholder는 사업자등록 또는 거래 기능 확정 전 보류값이므로
필수값 실패로 처리하지 않는다.

#### 미정·차단·미검증

승인된 production artifact와 법무 실값이 없어 차단이다.

<a id="d01-submit-rights-inquiry"></a>

### 권리 문의 이메일 작성

- 계약 상태: `차단`

- 입력 근거: [화면 설계 §10 권리 이메일](../../../planning/03-screen-design.md), [권리자 안내](../../../legal/rights-request.md)
- 미검증: 실제 수령인·메일 client·법률 고지

#### 프로세스 목적과 범위

현재 화면에서 권리자가 확정 접수 이메일로 대상 URL과 요청을 작성하게 한다.

#### 행위자·시작·선행 조건

공개 이용자. `BLARIYO_RIGHTS_CONTACT_EMAIL` 실값과 고지 문구가 확정돼야 한다.

#### 정상 흐름

1. footer `권리 문의`를 선택한다.
2. client가 제목에 서비스명·문의 유형, 본문에 현재 URL·요청 내용 입력란을 넣은 `mailto`를 연다.
3. 이용자가 필요한 최소 정보와 소명 자료를 직접 검토해 보낸다.
4. 이후 운영 처리는 관리자 [권리 문의 처리 D01](../admin-post-management/admin-post-management.dev.md#d01-handle-rights-request)을 따른다.

footer에는 `권리 문의` 한 링크만 둔다. 클릭 후 1.6초 동안 window blur·document hidden 신호가 없으면 이메일 주소·제목·현재 URL과 입력란을 복사하고 alert로 알린다. 반복 클릭·route 전환·unmount는 이전 대기를 취소한다.

#### 대안·실패 흐름

- 전환 신호가 없는 경우: “메일 작성 창이 열리지 않았다면 …”으로 안내한다. 메일 앱 실행 실패나 전송 성공으로 단정하지 않는다.
- 자동 복사 실패: 실패 alert와 읽기 전용 양식 dialog를 제공해 직접 복사할 수 있게 한다. 닫기·Escape 후 권리 문의 링크로 포커스를 돌린다.
- canonical URL 생성 실패는 수용 조건 미충족이다. 빈 URL이나 복사 안내로 대체하지 않는다.

#### 단계별 API 매핑

API 해당 없음. 초기에는 form·`/rights`·권리 요청 endpoint를 만들지 않는다.

#### 데이터·상태 전이

Blariyo application DB 상태 전이 없음. 메일 내용은 client가 이메일 사업자에 전달한다.

#### 권한·트랜잭션·멱등성·재시도

해당 없음. 사용자가 전송을 통제한다.

#### 완료 조건과 수용 기준

mailto 본문에는 현재 URL이 포함되고 footer에는 `권리 문의` 한 링크가 보인다. 복사 대체 동작은 주소·제목·본문을 포함하며 application log에는 남기지 않는다. 전환 신호가 있으면 대기 중 복사·alert를 취소하고, clipboard 거부 시 성공 안내 없이 수동 복사를 지원한다.

#### 미정·차단·미검증

`[출시 차단: 권리 침해 신고·요청 이메일·시행일 입력 필요]`. 전환 신호에 따른 대체 안내 계약은 확정됐으나 실제 외부 메일 앱 실행은 별도 검증 대상이다.

<a id="d01-view-policy"></a>

### 정책 본문과 이력 열람

- 계약 상태: `차단`

- 입력 근거: [화면 설계 §10](../../../planning/03-screen-design.md), [정책 API](#api-get-policy)
- 미검증: 승인 본문, SSR/modal browser test

#### 프로세스 목적과 범위

이용자가 footer modal 또는 직접 route에서 현재·과거 정책 전문을 확인한다.

#### 행위자·시작·선행 조건

공개 이용자가 이용약관 또는 개인정보처리방침 link를 선택한다. 필요한 법무·문의 config 실값이
반영되고 placeholder가 제거된 EFFECTIVE 정책이 있어야 한다.

#### 정상 흐름

1. modal 진입이면 현재 화면을 유지하고 정책 API current를 호출한다.
2. 현재 전문과 하단 `버전 / 적용 기간` 이력을 표시한다.
3. 과거 행 선택 시 해당 version API를 호출해 같은 modal 본문을 바꾸고 상단으로 이동한다.
4. 닫으면 원래 화면·스크롤·포커스로 돌아간다.
5. 직접 route면 같은 내용을 독립 SSR 화면과 canonical로 제공한다.

#### 대안·실패 흐름

- JavaScript 없음/modal 실패: 직접 route 이동.
- API 실패: 내부 상세 없이 재시도와 닫기/목록 이동을 제공.
- version 미존재: current로 자동 대체하지 않고 오류를 알린다.

#### 단계별 API 매핑

1~3 [정책 버전 조회](#api-get-policy).

#### 데이터·상태 전이

읽기 전용. 이력 선택이 정책 상태를 변경하지 않는다.

#### 권한·트랜잭션·멱등성·재시도

인증 없음, 조회 멱등. 사용자 재시도만 제공한다.

#### 완료 조건과 수용 기준

전문·현재/과거 적용 기간·focus/scroll·직접 route가 같은 공개 version을 표시해야 한다.

#### 미정·차단·미검증

운영자 표시명·시행일·일반 문의·권리·개인정보 접수 이메일, 개인정보 보호책임자 또는 담당자와
승인 본문이 확정 전이라 production은 차단된다. 사업자 정보는 사업자등록 또는 거래 기능 확정
전까지 `(미정)`으로 보류한다.

<a id="d08-policy-publish-command"></a>

### 정책 시행 Command

- 계약 상태: `차단`

- 입력 근거: [데이터 모델 §4](../../../system-design/02-data-model.md), [보안·운영 §12](../../../system-design/05-security-operations.md)
- 미검증: CLI source·artifact·runtime

#### 프로그램 목적·route·milestone

화면 route 해당 없음. `npm run policies:publish -- --artifact=<path>` 단발성 운영 프로그램이다.

#### 진입·이탈·권한 조건

권한 있는 deploy 운영자만 실행하며 artifact는 root `0600`, container read-only mount다. 종료 후 mount·임시 파일을 제거한다.

#### UI 영역과 구성요소

CLI 입력은 artifact path만 받는다. stdout/stderr에는 단계·일반 오류 code·최종 version만 표시하고 본문·secret·checksum 전체를 출력하지 않는다.

#### 필드·표시값·validation

artifact의 type, version, title, raw body, effectiveAt, checksum schema를 검증한다. 운영자 표시명·일반
문의·권리·개인정보 접수 이메일과 개인정보 보호책임자 또는 담당자 config 실값이 반영됐는지,
필수값 placeholder가 남지 않았는지도 검증한다. 사업자등록 전 보류한 사업자 정보 placeholder는 허용한다.
값은 command argument로 직접 받지 않는다.

#### 이벤트·이동·후처리

validate→sanitize→lock/transaction→outbox→결과 확인 순서다. 성공 뒤 운영자가 API·route를 별도 확인한다.

#### 프로그램 상태

schema·필수 실값·placeholder 검증 실패, 시행 window 오류, lock/DB 오류, purge pending, 성공을 exit
code와 일반 메시지로 구분한다.

#### 반응형과 접근성

CLI이므로 반응형 해당 없음. 색 없이도 exit code·텍스트로 상태를 구분하고 비대화형 실행이 가능해야 한다.

#### 이벤트별 D01·API 매핑

[승인 정책 시행](#d01-publish-policy)을 수행하며 확인은 [정책 조회](#api-get-policy)를 사용한다.

#### 메시지와 사용자 피드백

미래·5분 초과 과거·checksum·sanitize·DB·purge를 구분하되 raw body·secret을 출력하지 않는다.

#### 프로그램 수용 조건

필수 법무·문의 실값과 placeholder 부재, 실패 rollback, 유형별 current 한 건, 이력 경계, purge
outbox, artifact 제거를 검증해야 한다.

#### 미정·차단·미검증

승인 artifact와 실행 source가 없어 차단이다.

<a id="d08-policy-viewer"></a>

### 정책 Viewer

- 계약 상태: `차단`

- 입력 근거: [화면 설계 §10](../../../planning/03-screen-design.md), [퍼블리싱 기준](../../../publishing/responsive/README.md)
- 미검증: 승인 본문, actual browser·accessibility test

#### 목적·route·milestone

`/terms`, `/privacy` 직접 화면과 어느 공개 화면에서나 여는 modal로 정책 전문·이력을 제공한다.

#### 진입·이탈·권한 조건

인증 없음. modal 닫기·Escape·dim 클릭으로 원래 포커스와 스크롤에 복귀한다. 직접 route는 browser 뒤로가기·footer 이동을 제공한다.

#### UI 영역과 구성요소

제목, 현재/선택 version 상태, 전문, 하단 `버전 / 적용 기간` 행 목록, 닫기와 오류 상태다.

#### 필드·표시값·validation

현재는 `yyyy.mm.dd ~ 시행 중`, 과거는 `yyyy.mm.dd ~ yyyy.mm.dd`. 허용 HTML만 렌더링하며 외부
link는 안전 속성을 사용한다. 운영자 표시명과 문의·책임자 공개값은 승인된 policy artifact에
properties/config 실값이 반영된 결과만 표시한다.

#### 이벤트·버튼·이동·후처리

footer click은 modal, 직접 URL은 page. 이력 행 전체 선택은 해당 version 전문으로 바꾸고 문서 상단으로 이동한다.

#### 화면 상태

loading, current 없음/error, 과거 version 없음, empty history를 구분한다. 권한 없음은 해당 없음.

#### 반응형과 접근성

`role=dialog`, `aria-modal`, focus trap/return, background `inert`, scroll lock, heading 구조와 keyboard row selection을 적용한다.

#### 이벤트별 D01·API 매핑

열기·version 전환은 [정책 열람](#d01-view-policy)과 [정책 조회](#api-get-policy)에 연결한다.

#### 메시지와 사용자 피드백

내부 DB·sanitize 오류를 노출하지 않는다. 법무 placeholder가 남은 문서를 production current로 표시하지 않는다.

#### 화면 수용 조건

modal/direct route의 version·전문이 같고 focus·scroll·history 전환이 동작해야 한다.

#### 미정·차단·미검증

법무 승인·시행일·운영자 표시명·일반 문의·권리·개인정보 접수 이메일과 개인정보 보호책임자 또는
담당자 실값이 없어 production은 차단된다. 사업자 정보는 사업자등록 또는 거래 기능 확정 전까지
`(미정)`으로 보류한다.

<a id="d08-rights-inquiry-entry"></a>

### 권리 문의 진입

- 계약 상태: `차단`

- 입력 근거: [화면 설계 §10 권리 이메일](../../../planning/03-screen-design.md), [권리자 안내](../../../legal/rights-request.md)
- 미검증: 실제 이메일·mailto/browser test

#### 목적·route·milestone

별도 route 없이 공개 footer의 `권리 문의`로 mail client를 열고 전환 신호가 없으면 복사 대체 안내를 제공한다.

#### 진입·이탈·권한 조건

모든 공개 화면에서 인증 없이 사용한다. mail client로 이탈하며 원래 page는 유지된다.

#### UI 영역과 구성요소

footer에는 짧은 `권리 문의` 링크만 노출한다. 자동 복사가 거부될 때만 읽기 전용 양식 dialog를 표시하며 접수 form은 없다.

#### 필드·표시값·validation

mailto 제목은 서비스명·문의 유형, body는 현재 canonical URL·요청 입력란이다. 수령 주소는
`BLARIYO_RIGHTS_CONTACT_EMAIL`의 확정 실값만 사용한다. 대체 복사는 같은 이메일 주소와 mailto 제목·본문 전체를 포함한다.

#### 이벤트·이동·후처리

`권리 문의` 선택 시 안전하게 encode한 mailto를 연다. 전환 신호가 없을 때 복사·alert로 안내하되 실행 성공·실패는 확정하지 않는다. form·API·접수 DB로 분기하지 않는다.

#### 화면 상태

loading 해당 없음. 이메일 미정이면 production에서 깨진 link를 노출하지 않고 출시를 차단한다.

#### 반응형과 접근성

링크와 dialog 닫기 버튼의 accessible name이 문구와 일치하고 키보드·focus 표시를 지원한다.

#### 이벤트별 D01·API 매핑

[권리 문의 이메일 작성](#d01-submit-rights-inquiry); API 해당 없음.

#### 메시지와 사용자 피드백

메일 전송 성공이나 mail client 실행 실패를 확정적으로 표시하지 않는다. 복사 성공 시 주소·양식 복사 사실을 alert로 알리고, 실패 시 직접 복사할 수 있는 dialog와 실패 alert를 제공한다.

#### 화면 수용 조건

현재 URL 포함, 개인정보 자동 수집 없음, `/rights`·접수 form·API·DB 미생성, 주소·제목·양식 복사, 전환 신호에 따른 취소, clipboard 거부 시 수동 복사를 확인한다.

#### 미정·차단·미검증

권리 침해 신고·요청 이메일 실값과 시행일이 `[출시 차단]` 상태다. mail client 결과 미감지와 독립된
주소 복사는 확정됐지만 실제 mailto·clipboard·browser 동작은 미검증이다.
