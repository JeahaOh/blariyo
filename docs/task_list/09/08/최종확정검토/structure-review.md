# M1·M1.5 최종 확정 준비 구조 검토

- 검토일: 2026-09-08
- 범위: M1/M1.5 제품 계약, `06-member-community-design.md`, M1·M1.5 개발 명세 전부, 회원가입 개인정보 동의·개인정보처리방침, responsive 정책 modal과 community 정적 화면
- 변경 경계: 정본과 정적 화면은 수정하지 않았다. 이 파일만 이번 검토 산출물이다.
- 전제: 기존 12건의 보완 완료 상태를 다시 결함으로 세지 않았다. 정적 파일은 시각 검토물이며 source·migration·OpenAPI 생성·test·build·runtime 증거가 아니다.

## 결론

아래 다섯 건 중 **F-01과 F-02는 구현 시작 전에 설계를 확정해야 한다.** F-03은 정책 열람 화면으로 사용하기 전 고쳐야 한다. F-04~F-05는 제품 설계와 운영 공개의 차단 조건이 아니라 **정적 검토물 정확성 보완**이다. M1/M1.5 구현 자체나 운영 공개가 완료됐다는 증거는 이번 검토에서 확인하지 않았다.

| ID | 심각도 | 구분 | 핵심 문제 |
| --- | --- | --- | --- |
| F-01 | 높음 | 설계 확정 차단 | 수동 해제한 제재가 참여 gate에서 계속 적용된다. |
| F-02 | 중간 | 설계 확정 차단 | 입력 길이의 `문자 수` 단위가 정의되지 않아 API·DB·UI의 판정이 갈릴 수 있다. |
| F-03 | 중간 | 출시 검증 차단 | 개인정보 modal이 Apple refresh credential의 보유 예외를 누락한다. |
| F-04 | 낮음 | 정적 검토물 정확성 보완 | 정책 modal의 예시 버전과 실제 발행 artifact의 구분이 충분히 드러나지 않는다. |
| F-05 | 낮음 | 정적 검토물 정확성 보완 | 정책 이력 행을 눌러도 선택 버전의 전문으로 바뀌지 않는다. |

## 확정 발견

### F-01 — `REVOKED` 제재가 만료 시각까지 참여를 막음

- **근거:** [06-member-community-design.md](../../../../system-design/06-member-community-design.md) 155행은 `moderation.restriction.status`를 `ACTIVE/REVOKED`로 정의하지만 실제 참여 판정을 `starts_at<=now AND (ends_at IS NULL OR ends_at>now)`로만 정한다. 같은 문서 287~288행에서 생성은 `ACTIVE`, 수동 해제는 `REVOKED`라고 응답 계약을 둔다. [community-moderation.dev.md](../../../../development-specs/m1-5/community-moderation/community-moderation.dev.md) 66~71행도 수동 해제를 `REVOKED` 저장으로 확정한다.
- **영향:** 30일 또는 무기한 제재를 운영자가 해제해도, `ends_at`이 미래이거나 null이면 글·댓글·신고 gate가 계속 `PARTICIPATION_RESTRICTED`를 반환할 수 있다. 이는 기획의 해제 이력·참여 제한 해제 약속([08-member-community-plan.md](../../../../planning/08-member-community-plan.md) 91~94행)과 다르다.
- **최소 수정:** 실제 참여 조건을 `status='ACTIVE' AND starts_at<=now AND (ends_at IS NULL OR ends_at>now)`로 정본에 명시한다. 같은 조건을 회원 쓰기 gate, 유효 제재 조회 인덱스/쿼리, 수동 해제 수용 시나리오에 함께 적고, `REVOKED`·미래 `ends_at` 조합의 글·댓글·신고 허용 테스트를 필수로 둔다.
- **차단:** 설계 확정 차단. 구현 전 DB query와 권한 테스트의 단일 조건을 결정해야 한다.

### F-02 — 사용자 입력 길이의 Unicode 단위가 API·DB·UI에 공통으로 정해지지 않음

- **근거:** [08-member-community-plan.md](../../../../planning/08-member-community-plan.md) 34행은 표시명을 `2~20 Unicode 문자`, 68행은 글·본문·댓글을 `trim·NFC 후 문자 수`로 제한한다. 기술 정본도 [06-member-community-design.md](../../../../system-design/06-member-community-design.md) 207행에서 같은 표현만 쓴다. 그러나 저장소는 표시명 `VARCHAR(20)`(06 문서 113행), 댓글 `VARCHAR(1000)`(152행), 제목 `VARCHAR(200)`과 TEXT `TEXT`([02-data-model.md](../../../../system-design/02-data-model.md) 320·424행)로 서로 다른 한계를 쓴다. 화면 계약은 글자 수를 표시해야 한다([03-screen-design.md](../../../../planning/03-screen-design.md) 388행)지만, 정적 wireframe도 어떤 단위인지는 밝히지 않는다.
- **영향:** JavaScript `length`(UTF-16 code unit), PostgreSQL `VARCHAR`/`length`의 문자 단위, 사용자에게 보이는 grapheme cluster가 결합 문자·emoji에서 다르다. 클라이언트는 20자로 보이는데 서버/DB가 거부하거나, 반대로 카운터와 API 허용 결과가 달라질 수 있다. M0 metadata에는 grapheme cluster와 UTF-16·byte 배제를 명시한 선례가 있다([public-post-browsing.dev.md](../../../../development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md) 507~511행).
- **최소 수정:** M1/M1.5의 단일 길이 단위를 선택해 제품·API·검증 계약에 적는다. 예를 들어 **NFC+trim 뒤 Unicode code point 수**를 채택하면 browser와 Core의 계산 방법, PostgreSQL 저장 한계가 그 값을 거부하지 않는지, UI 카운터의 동일 계산을 명시한다. 사람 눈의 글자 수(grapheme)를 요구한다면 서버 검증을 최종 기준으로 하고 DB column은 필요한 최장 code point 길이를 수용하게 정해야 한다. 제목 1~200, 본문 1~10,000, 댓글 1~1,000, 표시명 2~20 모두에 같은 결정을 적용한다.
- **차단:** 설계 확정 차단. 구현 테스트만으로 어느 단위를 제품 계약으로 삼을지 결정할 수 없다.

### F-03 — 개인정보 modal이 Apple refresh credential 예외를 고지하지 않음

- **근거:** 정적 modal은 [app.js](../../../../publishing/responsive/app.js) 353행에서 `로그인용 token은 세션 발급까지`라고만 적는다. 반면 개인정보처리방침은 Apple refresh credential을 자격 상태 확인·연동 철회 때문에 암호화 보관하고 연동 종료 때 삭제하는 예외로 명시한다([privacy-policy.md](../../../../legal/privacy-policy.md) 94·118행). 가입 동의 전문도 Apple refresh token을 연결 종료까지 보관한다고 고지한다([signup-privacy-consent.md](../../../../legal/signup-privacy-consent.md) 24행). 제품 계약과 기술 저장 모델도 같은 예외다([08-member-community-plan.md](../../../../planning/08-member-community-plan.md) 51~53행, [06-member-community-design.md](../../../../system-design/06-member-community-design.md) 115행).
- **영향:** modal을 정책 열람의 기준 화면으로 사용할 경우, Apple 이용자에게 예외 보유 기간을 일반 로그인 token과 같은 것으로 오인하게 한다.
- **최소 수정:** 정적 개인정보 본문에 Apple refresh credential의 목적, 암호화 보관 기간, 연결 종료·분리 작업 완료 또는 최대 24시간 후 폐기 조건을 넣거나, modal을 현행 정책 전문의 시각 검토물이 아님으로 명확히 낮춘다. 실제 공개본은 법무 확정 artifact만 렌더링한다.
- **차단:** 출시 검증 차단. 이 검토는 정적 문구 대조이며 실제 Apple adapter·암호화 저장·파기 실행을 검증한 결과가 아니다.

### F-04 — 정책 modal의 예시 버전과 실제 발행 artifact 구분이 약함

- **근거:** [app.js](../../../../publishing/responsive/app.js) 114~134행은 이용약관·개인정보처리방침의 화면 예시로 `v0.3`, `v0.2`, `v0.1`과 placeholder 기간을 둔다. 예시 버전 자체는 허용할 수 있다. 다만 정본은 이용약관 최초 버전을 `v0.1`로 두고([terms-of-service.md](../../../../legal/terms-of-service.md) 144~147행), 개인정보처리방침도 `v0.1`이며 시행일 출시 차단 상태다([privacy-policy.md](../../../../legal/privacy-policy.md) 3~6행). README는 이 modal을 현재 적용 본문과 개정 이력을 제공하는 검토물로 설명한다([publishing/responsive/README.md](../../../../publishing/responsive/README.md) 46~50행).
- **영향:** 화면의 `현재 초안`만으로는 예시 버전 목록과 실제 발행 artifact·시행 이력이 구분되지 않아, 시각 검토물이 실제 정책 이력 증거로 잘못 사용될 수 있다.
- **최소 수정:** `예시 정책 이력`과 `실제 발행 artifact 아님`을 version 목록 근처에 명시하거나, 실제 artifact가 생긴 뒤에는 artifact의 version·시행 기간만 표시하도록 정적 안내를 맞춘다.
- **차단:** 정적 검토물 정확성 보완. 제품 설계, 정책 artifact 발행, 법무 승인이나 운영 공개의 차단 조건을 새로 만들지는 않는다.

### F-05 — 정책 이력 선택 동작이 선택 버전 전문을 렌더링하지 않음

- **근거:** [app.js](../../../../publishing/responsive/app.js) 318행은 행 선택 시 문서 전체가 해당 버전으로 바뀐다고 안내하고, 478~479행은 실제로 `selectedVersion`을 전달한다. 하지만 327~370행의 `body`는 `type`만으로 정하고 `selected`는 상태·버전·기간 표시와 행 강조에만 쓴다. 어떤 과거 행을 눌러도 본문은 같다. 이는 법무 정본의 행 선택 시 해당 버전 전문을 열어야 한다는 계약([privacy-policy.md](../../../../legal/privacy-policy.md) 262~267행)과 M0 정책 화면 명세([policy-and-rights.dev.md](../../../../development-specs/m0-core/policy-and-rights/policy-and-rights.dev.md) 408·418행)에 맞지 않는다.
- **영향:** 사용자는 이전 전문을 보고 있다고 생각하지만 현재 mock 본문을 읽는다. 개정 이력 화면의 핵심 동작을 검증할 수 없다.
- **최소 수정:** 버전별 mock body를 명시적으로 두어 선택값으로 렌더링하거나, 실물 artifact가 나오기 전에는 이력 행의 동작·안내를 제거한다. 운영 UI는 `GET /policies/:type?version=...`의 승인된 본문만 써야 한다.
- **차단:** 정적 검토물 정확성 보완. 현 정적 파일의 JavaScript 동작 대조 결과이며, 실제 정책 API·SSR의 동작 증거는 아니다.

## 오탐 제거와 확인한 계약

- **제재 수정의 `lockVersion` 누락:** 제외했다. [06-member-community-design.md](../../../../system-design/06-member-community-design.md) 289행의 관리자 회원 조회 `restriction`에는 이미 `lockVersion`이 있고, 292~293행도 기존 제재에는 실제 version을 요구한다.
- **공개 조회 수 POST의 일반 회원 쓰기 규칙 충돌:** 설계 결함으로 세지 않았다. M1.5 endpoint는 기존 조회 수 계약을 재사용하고([06-member-community-design.md](../../../../system-design/06-member-community-design.md) 257행), M0 정본은 이 endpoint를 명시적으로 인증 없음으로 정한다([03-api-design.md](../../../../system-design/03-api-design.md) 211~222행, [public-post-browsing.dev.md](../../../../development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md) 196~234행).
- **정적 익게가 실동작하지 않는 점:** 제외했다. 화면 자체가 M1.5 설계 참고이고 구현·운영 활성화 증거가 아니라고 표시한다([wireframes/community/index.html](../../../../wireframes/community/index.html) 70~73행).

## 재현과 증거 범위

```sh
python3 docs/task_list/09/08/문서정합성/check_structure.py
python3 docs/system-design/validation/check-member-design.py
git diff --check
```

- 구조 검사 결과: `markdown_files=71`, `local_links_checked=661`, `tables_checked=342`, `issues=0`.
- 이름 사전 오프라인 검사 결과: 262,144개 조합, 최대 길이 19, 명시 금칙어 0건, SQLite 제약 검증 21건 통과. 출력은 스스로 `offline_design_model_not_implementation`, PostgreSQL/provider runtime `not_tested`라고 표시한다. 따라서 이름 사전의 전체 표현 적절성, PostgreSQL migration, API·권한·동시성, provider callback, 탈퇴 worker, 브라우저/운영 배포는 이번 통과로 확인되지 않았다.
- `git diff --check`는 통과했다. 링크·표 검사 통과를 의미 정합성 점수나 구현 완료 근거로 환산하지 않았다.

## 검토 시점 정본 해시

| 파일 | SHA-256 |
| --- | --- |
| `docs/system-design/06-member-community-design.md` | `03ba1bfd91d56e3a60496c52046566d34d5b291e84cce993c9874f0c07c33756` |
| `docs/planning/08-member-community-plan.md` | `2535e7df3d47b2e43b9d648716d2a3fcbd539d64da4668dd91d9732030eb4e07` |
| `docs/planning/09-random-name-catalog.md` | `33c3a65d4f72910836cb964697df540822b0fcad2c2880fb8f4bfb73153217a4` |
| `docs/development-specs/m1/member-identity/member-identity.dev.md` | `2d0c5ea9caa4777ad83e8d1fdcaf6c83991467d1e76861df99a8a4d0a217bf64` |
| `docs/development-specs/m1/account-lifecycle/account-lifecycle.dev.md` | `fb8b45b55c219fb4747127f1ac1f822ed77ad06086f3bd8a9c14c796e1c5a8ad` |
| `docs/development-specs/m1-5/community-participation/community-participation.dev.md` | `9aa16c150655c50c41272670a3943171f43a921fe5f91537f8224181a3ed6c92` |
| `docs/development-specs/m1-5/community-moderation/community-moderation.dev.md` | `b52c013224d7f619898a622b40998bb7e2267e7445a9bcc6982293dacb06800b` |
| `docs/publishing/responsive/app.js` | `b3f109b79fb610b1cbceb26e8384a1cc15c991f1a18d7b0b9416a55634551994` |
| `docs/wireframes/community/index.html` | `5585ba1eaf611238c6a261aa07538963aec0665d665165aceda5187cf01dca7c` |
