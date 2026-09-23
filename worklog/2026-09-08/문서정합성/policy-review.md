# 제품·회원·법무 정책 정합성 검토

- 검토일: 2026-09-08
- 범위: `docs/planning/01-service-plan.md`, `03-screen-design.md`, `08-member-community-plan.md`, `09-random-name-catalog.md`, `docs/legal/`, `docs/system-design/06-member-community-design.md`, `docs/development-specs/m1/`, `docs/development-specs/m1-5/`
- 변경 경계: 정본은 수정하지 않았고 이 검토 보고서만 작성했다.
- 판정 기준: 2026-09-08 사용자 확정 정책인 탈퇴 `KEEP`, 생년월일 직접 입력 후 원문 미보관, 같은 글 이름 고정·다른 글 이름 재사용 금지를 우선 기준으로 삼았다. 법률 적법성은 판단하지 않고 문서 사이 정책·구현 계약만 대조했다.
- 증거 한계: source·migration·OpenAPI·test·build·runtime·브라우저는 확인 대상이 아니며 구현 완료를 뜻하지 않는다. 문서에 명시된 법무 검토·운영값 미정·미실행 수용 검증은 그 자체로 오류로 세지 않았다.

## 확인된 오류

### High — M1.5 화면 수용 조건이 탈퇴 시 공개 원문을 비노출하라고 요구해 `KEEP`을 반대로 검증함

**상충 근거**

- 사용자 확정 제품 정책은 탈퇴 시 글·댓글 본문과 기존 공개/숨김/삭제 상태를 유지하고 작성자 연결만 제거한다: `docs/planning/08-member-community-plan.md:17-23`, `54-62`.
- 기술 정본도 콘텐츠 본문·공개 상태를 바꾸지 않고 숨김·삭제 상태를 그대로 유지하며, 정책 통합표에서 탈퇴를 콘텐츠 삭제나 재공개로 변환하지 말라고 명시한다: `docs/system-design/06-member-community-design.md:186-195`, `629-640`.
- 익게 기능 명세도 탈퇴 `KEEP`에서 계정 FK만 null로 바꾸고 본문과 기존 상태를 유지한다: `docs/development-specs/m1-5/community-participation/community-participation.dev.md:68-74`.
- 그런데 화면의 M1.5 수용 조건은 `숨김·삭제·탈퇴 후 원문 비노출`을 한 묶음으로 검증하라고 적었다: `docs/planning/03-screen-design.md:462-466`. 바로 다음 줄은 탈퇴 시 콘텐츠 유지·계정 연결 제거를 검증하라고 해 같은 수용 절 안에서도 충돌한다: `docs/planning/03-screen-design.md:467`.
- 약관도 탈퇴한 회원의 글·댓글을 계정 연결만 제거하고 유지한다고 고지한다: `docs/legal/terms-of-service.md:162-169`.

**영향**

수용 테스트가 `탈퇴 후 원문 비노출`을 정답으로 구현하면 공개 상태였던 글·댓글이 탈퇴만으로 숨겨진다. 이는 사용자 확정 `KEEP`을 사실상 일괄 숨김 정책으로 바꾸고, 약관 고지와 기술 worker의 상태 유지 계약도 위반한다.

**최소 조치**

`docs/planning/03-screen-design.md:466`에서 탈퇴를 숨김·삭제와 분리한다. `숨김·삭제 후 원문 비노출`과 `탈퇴 후 공개 상태 콘텐츠는 원문 유지, 계정 연결·공개 계정 식별자만 비노출`을 각각 검증하도록 문장을 바꾼다.

**판정:** 확정. 같은 화면 수용 절의 다음 줄 및 제품·기술·법무 정본이 모두 반대 계약을 명시한다.

### High — 가입 필수 동의 대상이 일부 문서에서 `개인정보처리방침 동의`로 잘못 되돌아감

**상충 근거**

- 화면의 현행 가입 계약은 이용약관과 `회원가입 개인정보 수집·이용 전문` 동의를 각각 받고, 개인정보처리방침은 전문 링크로만 제공한다: `docs/planning/03-screen-design.md:299-302`.
- 기술 정본은 `TERMS`와 `SIGNUP_PRIVACY` 정책 ID를 저장하며 `PRIVACY` 열람을 수집·이용 동의로 대체하지 말라고 명시한다: `docs/system-design/06-member-community-design.md:130-135`.
- 회원 기능 명세도 가입 요청의 두 정책 ID를 현재 시행 버전과 비교하고 실제 policy FK로 동의 row를 저장한다: `docs/development-specs/m1/member-identity/member-identity.dev.md:37-41`, `59-62`.
- 그런데 화면 수용 조건은 `이용약관·개인정보처리방침 동의 이력`을 각각 저장한다고 적었다: `docs/planning/03-screen-design.md:456-460`.
- 개인정보처리방침의 기본 보유표도 `약관·개인정보처리방침 동의 이력`이라고 적었다: `docs/legal/privacy-policy.md:114-117`. 같은 문서의 수집표는 올바르게 `이용약관·회원가입 수집이용 동의 버전과 시각`이라고 적어 내부에서도 기준이 갈린다: `docs/legal/privacy-policy.md:64-70`.

**영향**

화면 수용 검증이나 DB 구현이 오래된 문구를 따르면 `PRIVACY` 열람 이력을 필수 동의 증거로 저장하고, 정작 `SIGNUP_PRIVACY` 동의가 빠질 수 있다. 이는 가입 API의 정책 ID, 동의 FK와 법무 공개 gate를 서로 다른 대상으로 검증하게 만든다.

**최소 조치**

`docs/planning/03-screen-design.md:458`과 `docs/legal/privacy-policy.md:116`의 대상 명칭을 `이용약관·회원가입 개인정보 수집·이용 동의 이력`으로 맞춘다. 개인정보처리방침은 열람 링크이며 동의 artifact가 아니라는 기존 계약은 유지한다.

**판정:** 확정. 동일 문서 안의 수집표와 기술 정본까지 반증이 있어 단순 표현 취향이 아니다.

### Medium — 확정된 가입 연령 정책이 상위 미정 목록과 법무 차단 문구에 미정으로 남아 있음

**상충 근거**

- 제품 계약은 생년월일 직접 입력, 만 14세 이상 서버 판정, 원문 미보관을 사용자 확정 정책으로 선언한다: `docs/planning/08-member-community-plan.md:17-24`, `29-33`.
- 화면 계약도 체크박스로 대체하지 않는다고 명시한다: `docs/planning/03-screen-design.md:295-303`.
- 그런데 상위 서비스 기획은 여전히 `14세 미만 회원가입 허용 여부와 연령 확인 방식`을 미정으로 둔다: `docs/planning/01-service-plan.md:374-378`.
- 법무 출시 차단표도 같은 항목 전체를 미정으로 둔다: `docs/legal/README.md:79-82`. 개인정보처리방침의 placeholder도 허용 여부와 방식을 함께 미정으로 표현한다: `docs/legal/privacy-policy.md:191-194`.
- 반면 가입 동의 전문은 `만 14세 미만은 가입할 수 없음`을 분명히 하고, 남은 조건을 직접 입력 방식의 적정성 검토로 한정한다: `docs/legal/signup-privacy-consent.md:50-54`, `80-86`. 법무 README의 최신 보완 절도 동일하게 직접 입력 판정의 적정성만 공개 차단으로 둔다: `docs/legal/README.md:117-126`.
- 회원 명세의 기존 수용 목록에는 `미성년 확인 미선택`이라는 체크박스 시절 표현도 남았다: `docs/development-specs/m1/member-identity/member-identity.dev.md:95-102`. 같은 명세의 현행 계약은 생년월일 누락·날짜 오류·만 14세 미만 거부를 검증 대상으로 둔다: `docs/development-specs/m1/member-identity/member-identity.dev.md:126-131`.

**영향**

제품 담당자는 정책 자체가 미정이라고 읽을 수 있고, 법무 담당자는 이미 확정된 금지 정책까지 다시 결정해야 하는 gate로 읽을 수 있다. 개발 수용 검증은 직접 입력값 검증 대신 존재하지 않는 확인 체크박스를 대상으로 만들 위험이 있다.

**최소 조치**

상위 기획의 미정 항목은 제거하고, 법무 차단 문구는 삭제하지 말고 `직접 입력 생년월일로 만 14세 이상을 판정하는 방식의 적정성 검토`로 좁힌다. `privacy-policy.md:193`도 `14세 미만 가입 금지` 정책과 `확인 방식 법무 검토`를 분리한다. 회원 명세의 `미선택`은 `생년월일 누락·유효하지 않은 날짜·만 14세 미만`으로 바꾼다.

**판정:** 확정. 법적 적정성은 여전히 미정이지만, 제품의 허용 여부와 입력 방식은 확정됐다.

### Medium — 화면 설계가 원글 작성자의 랜덤 이름과 `글쓴이` 배지를 대체 관계로 표현함

**상충 근거**

- 제품 계약은 원글과 댓글 모두 랜덤 이름을 표시하고, 원글 작성자의 댓글에는 별도 `글쓴이` 배지를 붙인다. 같은 회원은 같은 글에서 같은 이름을 쓰고 다른 글에서는 이전 이름을 쓰지 않는다: `docs/planning/08-member-community-plan.md:69-75`.
- 기술 계약도 글·댓글에 `authorLabel`을 반환하고 댓글의 `isPostAuthor`를 별도 필드로 강제한다: `docs/system-design/06-member-community-design.md:610-624`.
- 기능 명세 역시 기존 participant의 랜덤 이름을 표시한 뒤 원글 작성자에게 별도 배지를 붙이도록 한다: `docs/development-specs/m1-5/community-participation/community-participation.dev.md:59-66`, `92-98`.
- 그러나 화면 설계는 원글 상세의 작성자 자리를 `글쓴이`로만 적고, 댓글은 `글쓴이 또는 글별 랜덤 이름`이라고 표현한다: `docs/planning/03-screen-design.md:374-381`.
- 이용약관은 같은 글에서 고정되는 랜덤 이름을 사용한다고 올바르게 고지한다: `docs/legal/terms-of-service.md:149-159`.

**영향**

화면 구현이 `또는`을 따르면 원글 작성자의 댓글에서 랜덤 이름이 사라지고 `글쓴이`만 표시될 수 있다. 같은 글에서 동일 참여자를 같은 이름으로 구분한다는 대화 계약과 API의 `authorLabel + isPostAuthor` 구조가 깨진다.

**최소 조치**

원글은 랜덤 작성자 이름을 표시하고, 댓글은 모든 참여자의 랜덤 이름을 표시하며 원글 작성자의 댓글에만 `글쓴이` 배지를 추가한다고 화면 문구를 고친다. `글쓴이`를 랜덤 이름의 대체값으로 사용하지 않도록 한다.

**판정:** 확정. 제품·기술·기능 명세와 약관이 같은 방향이고 화면 설계 두 문장만 다르다.

## 추가 확인이 필요한 의심

별도 의심 항목은 기록하지 않았다. `법령상 분리 보존 항목`, 신고 90일, 삭제 ledger 8주, 외부 해제 guard 30일은 근거·기간 검토 전 공개 차단으로 명시되어 있어 정상적인 미정·설계값으로 판정했다.

## 정책별 교차 확인 결과

### 탈퇴 `KEEP` — 핵심 계약 일치, 화면 수용 조건 1건 예외

- 제품은 탈퇴 시 글·댓글과 기존 상태를 유지하고 계정 연결을 제거하며 삭제/유지 선택을 제공하지 않는다: `docs/planning/08-member-community-plan.md:54-62`.
- 화면은 같은 안내와 선택 없음, 외부 해제 실패와 회원 탈퇴 완료의 분리를 요구한다: `docs/planning/03-screen-design.md:321-327`.
- DB와 API는 `content_action=KEEP` 고정, preview의 `contentPolicy:KEEP`, 요청의 `contentAction` 거부를 명시한다: `docs/system-design/06-member-community-design.md:113-122`, `234-239`.
- 계정·익게 명세와 약관·가입 동의 전문도 계정 FK만 제거하고 콘텐츠를 유지한다: `docs/development-specs/m1/account-lifecycle/account-lifecycle.dev.md:63-74`, `84-100`; `docs/development-specs/m1-5/community-participation/community-participation.dev.md:68-74`; `docs/legal/terms-of-service.md:162-169`; `docs/legal/signup-privacy-consent.md:30-47`.
- 다만 화면 수용 조건의 `탈퇴 후 원문 비노출`은 위 첫 번째 High 발견처럼 수정이 필요하다: `docs/planning/03-screen-design.md:462-467`.

### 생년월일 원문 미보관 — 저장·전송 계약 일치

- 가입 API는 `birthDate`를 요청 body로 일시 받아 서버가 계산하지만, DB·임시 payload·멱등 receipt·요청 hash·로그·분석·브라우저 저장소에는 남기지 않는다: `docs/system-design/06-member-community-design.md:587-603`.
- `Idempotency-Key` 의무 대상은 글·댓글·신고·운영 조치이며 가입 POST가 아니다: `docs/system-design/06-member-community-design.md:330-335`. 따라서 생년월일을 receipt/request hash에서 빼는 계약과 가입 멱등 계약이 충돌하지 않는다.
- 가입 결과에는 `age_confirmed_at`만 남고, 법무 수집·이용 표도 원문 즉시 폐기와 통과 시각 보관을 분리한다: `docs/system-design/06-member-community-design.md:137-141`; `docs/legal/signup-privacy-consent.md:17-28`.

### 글별 랜덤 이름 — 배정·DB 제약 일치

- 사전은 같은 글 중복과 같은 계정의 다른 글 이름 재사용을 기술 제약으로 방지하며, 탈퇴 후 재가입 계정에는 과거 이름을 연결하지 않는다: `docs/planning/09-random-name-catalog.md:35-49`.
- `thread_participant`는 `(post_id, account_id)`, `(post_id, alias_label)`, `(account_id, alias_label)` 고유 제약으로 같은 글 고정·글 안 중복 방지·계정별 다른 글 재사용 금지를 각각 표현한다: `docs/system-design/06-member-community-design.md:148-152`.
- 배정 흐름은 기존 `(post_id, account_id)`를 재사용하고, 다른 글에서 그 계정이 사용한 이름을 제외하며, 댓글 삭제·사전 교체·탈퇴 뒤에도 기존 label을 바꾸지 않는다: `docs/system-design/06-member-community-design.md:605-627`.

## 종료 상태

- 완료: 지정 정책 문서의 탈퇴, 연령 판정, 가입 동의 artifact, 랜덤 이름 배정·표시 계약을 대조하고 확인된 오류 4건을 기록했다.
- 미검증: source·migration·OpenAPI·test·build·runtime·브라우저·production.
- 차단: 없음. 법무 적정성·운영 실값은 기존 문서가 기능 공개 차단으로 올바르게 남겨 둔 항목이다.
