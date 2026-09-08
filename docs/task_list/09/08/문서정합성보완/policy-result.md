# D01–D04 정책·회원 문서 보완 결과

- 작업일: 2026-09-08
- 입력: [문서 정합성 주 검수 결과](../문서정합성/review.md) D01–D04
- 상태: 문서 보완 완료, 구현·법무 적정성·운영 공개는 미검증
- 변경 경계: 지정된 planning·legal·회원 기능 명세와 이 결과 문서만 수정했다. 코드·commit·push는 수행하지 않았다.

## 변경 전 보존

기존 사용자 변경이 포함된 작업 시작 시점의 다섯 파일을 `/private/tmp/blariyo-policy-D01-D04.JH6UTv/` 아래에 경로 구조를 유지해 복사했다.

| 파일 | 변경 전 SHA-256 | 변경 후 SHA-256 |
| --- | --- | --- |
| `docs/planning/01-service-plan.md` | `9795a7673314efe6dad0f1b031c45e1c642d5c03788fa643a59767486c9abfb4` | `f7ddd956aefcaebe9c36a363ffe5e4d7b74a45f9fa7b27371a4b8fd3afde90fa` |
| `docs/planning/03-screen-design.md` | `026157587cae4b56a68399faae78f4a71b2da7a568a53c5ecd6b385cd95f4b0a` | `7927023922608d89d9c41679a89e728e9ed10459cc849e9fa7fa8301f1d45b94` |
| `docs/legal/privacy-policy.md` | `0a552308099b91d0eb00c382dae370eed3bf53d34f85a7e62d5cbccafcc26e8a` | `f946d4497c89213ef0d4898467a2f3e522fe5874872fcf22e7383ab3952ea673` |
| `docs/legal/README.md` | `37a14db6833487cf5d3c42e9785988160ac6ddde098278de13d4eea92d6cdd9a` | `9c30cac1dc03cde17ea649fb32f0af2efec3c4cc4bed570d78b99197ca71c560` |
| `docs/development-specs/m1/member-identity/member-identity.dev.md` | `f81b5fb8c6e4be0b018668365fa1a08ea2d952c7c4b1693a1b108abfbd31951f` | `2d0c5ea9caa4777ad83e8d1fdcaf6c83991467d1e76861df99a8a4d0a217bf64` |

스냅샷과 현재 파일의 unified diff를 직접 대조했다. 이번 작업의 실제 변경은 아래 D01–D04에 해당하는 11개 문장 교체·교정뿐이다.

## 보완 내용

### D01 — 탈퇴 `KEEP` 수용 조건 복구

- `docs/planning/03-screen-design.md:466`에서 `숨김·삭제·탈퇴 후 원문 비노출`을 `숨김·삭제 후 원문 비노출`로 좁혔다.
- 바로 다음 `docs/planning/03-screen-design.md:467`의 `탈퇴 시 콘텐츠 유지·계정 연결 제거` 수용 조건을 유지했다.
- 결과적으로 탈퇴한 회원의 공개 콘텐츠는 기존 공개 상태와 원문을 유지하고, 숨김·삭제 콘텐츠만 원문을 비노출한다.

### D02 — 필수 가입 동의 artifact 통일

- `docs/planning/03-screen-design.md:458`을 `Blariyo 이용약관·회원가입 개인정보 수집·이용 동의 이력`으로 고쳤다.
- `docs/legal/privacy-policy.md:116`의 보유 대상도 `이용약관·회원가입 개인정보 수집·이용 동의 이력`으로 맞췄다.
- 개인정보처리방침은 열람 문서이고 가입 시 저장하는 정책 ID는 `TERMS + SIGNUP_PRIVACY`라는 기존 기술 계약을 유지했다.

### D03 — 연령 제품 결정과 법무 미검토 범위 분리

- `docs/planning/01-service-plan.md:377`에서 `14세 미만 가입 허용 여부와 연령 확인 방식` 전체를 미정으로 두던 문구를 `직접 입력 생년월일로 만 14세 이상을 판정하는 방식의 법무 적정성 검토 결과`로 좁혔다.
- `docs/planning/01-service-plan.md:376`은 익게 세부 기능까지 미정으로 두던 표현에서 익게·뉴스의 공개 시점과 뉴스 세부 기능만 미정으로 좁히고, 익게 세부 기능은 현행 `08-member-community-plan.md`를 따르도록 연결했다.
- `docs/legal/README.md:81`의 공개 차단 항목도 직접 입력 판정 방식의 법무 적정성으로 좁혔다.
- `docs/legal/privacy-policy.md:193`의 `[출시 차단: ...]` placeholder는 삭제하지 않고 같은 법무 적정성 검토로 범위를 명확히 했다. 14세 미만 가입 금지 문장은 유지했다.
- `docs/development-specs/m1/member-identity/member-identity.dev.md:98`의 체크박스 시절 표현 `미성년 확인 미선택`을 `생년월일 누락·잘못된 날짜·만 14세 미만` 수용 시나리오로 바꿨다.

### D04 — 랜덤 이름과 `글쓴이` 배지 병기

- `docs/planning/03-screen-design.md:378`은 원글 상세에 글별 랜덤 이름과 `글쓴이` 배지를 함께 표시하도록 고쳤다.
- `docs/planning/03-screen-design.md:380`은 모든 댓글에 글별 랜덤 이름을 표시하고 원글 작성자의 댓글에만 별도 `글쓴이` 배지를 함께 표시하도록 고쳤다.
- `docs/planning/03-screen-design.md:381`의 조사 오류 `랜덤 이름를`을 `랜덤 이름을`로 바로잡았다.
- 같은 글에서 같은 이름, 다른 글에서 다른 이름을 쓰는 기존 배정·DB 계약은 변경하지 않았다.

## 검증

| 검사 | 결과 |
| --- | --- |
| 변경 전 스냅샷 대비 diff | 지정 파일 5개의 D01–D04 관련 11개 문장 교체·교정만 확인 |
| 잔존 문구 검색 | `탈퇴 후 원문 비노출`, `개인정보처리방침 동의 이력`, `14세 미만 가입 허용 여부`, `미성년 확인 미선택`, `글쓴이 또는 글별 랜덤 이름`, `익게와 뉴스의 공개 시점 및 세부 기능`, `랜덤 이름를` 0건 |
| `git diff --check` | 통과 |
| `python3 docs/system-design/validation/check-member-design.py` | 통과: 이름 조합 262,144개, 최대 19자, 명시 금칙 0건, 연령·SQLite 제약 21개, Markdown 표 pass |
| `python3 docs/task_list/09/08/문서정합성/check_structure.py` | 최종 재검사 통과: Markdown 71개·상대 링크 661개·표 342개, 끊긴 링크·앵커·표 오류 0건 |

## 남은 상태

- 완료: D01–D04 문서 문구 동기화와 오프라인 문서·회원 설계 검사.
- 미검증: source·migration·machine-readable OpenAPI·test·build·runtime·브라우저·production. 이 문서 수정은 구현 완료를 뜻하지 않는다.
- 차단 유지: 생년월일 직접 입력 판정 방식의 법무 적정성, SIGNUP_PRIVACY 운영 전문·버전·시행일과 기존 법무·운영 실값.
