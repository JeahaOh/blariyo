# R01·R02·R08·R09 보완 결과

- 작업일: 2026-09-08
- 상태: 정본·기능 명세·현행 상태 색인 보완 및 주 검수 완료
- 범위: 회원·익게 제재, 사용자 입력 문자열, 법무 출시 차단 색인, 설계/구현/출시 상태 분리
- 제외: 앱 source·migration·OpenAPI 생성·commit·push·merge·tag, 법률 자문, 운영 실값 입력
- 수정 전 사본: `/private/tmp/blariyo-final-policy-before-20260908/owned-files.tar`

## 반영 결과

### R01 — 제재 ACTIVE 판정

- 제품·화면은 수동 해제 또는 기간 종료 뒤 정리 작업을 기다리지 않고 참여를 허용하도록 정리했다.
- 기술 정본의 유효 제재 predicate를
  `status='ACTIVE' AND starts_at<=now AND (ends_at IS NULL OR ends_at>now)`로 고정했다.
- 일반 회원 DTO와 글·댓글·신고 command는 유효 제재만 적용한다. 관리자 조회는 REVOKED·만료 row를
  이력과 version 확인용으로 반환할 수 있다.
- 참여·moderation 명세에 같은 판정과 REVOKED 무기한·미래 종료, 만료 ACTIVE, 시작 전 ACTIVE의
  참여 허용 수용 시나리오를 연결했다.

주요 반영 문서: `docs/planning/08-member-community-plan.md`, `docs/planning/03-screen-design.md`,
`docs/system-design/06-member-community-design.md`, `docs/development-specs/m1-5/community-participation/community-participation.dev.md`,
`docs/development-specs/m1-5/community-moderation/community-moderation.dev.md`.

### R02 — Unicode code point 계약

기존 제한 수치는 유지하고 계산 단위를 다음 순서로 고정했다.

1. 정규화 전에 단독 surrogate 등 잘못된 Unicode scalar sequence와 U+0000을 400으로 거부한다.
2. 여러 줄 필드는 CRLF·CR·U+2028·U+2029를 LF로 통일한다. 단일 줄 필드는 이 줄바꿈을 위치와 관계없이 거부한다.
3. C0·C1 제어 문자를 거부하되 여러 줄 필드의 LF만 허용한다. ZWJ는 code point로 세며 임의 금지하지 않는다.
4. NFC 정규화 후 ECMAScript `String.prototype.trim`과 같은 WhiteSpace·LineTerminator 집합을 앞뒤에서 제거한다.
5. JavaScript는 UTF-16 code unit인 `String.length` 대신 canonical 문자열의 `Array.from(canonical).length`를 사용한다.
6. PostgreSQL 18 UTF8 DB는 `VARCHAR(n)`의 character 상한과 `IS NFC NORMALIZED`·`char_length` CHECK를 함께 사용한다. 명시적 cast로 초과값을 자르지 않는다.

표시명 2~20, 제목 1~200, 본문 1~10,000, 댓글 1~1,000, 신고 detail 0~500(OTHER 1~500),
공개 사유 1~300, 내부 메모 0~500, 랜덤 이름 1~32 code point를 UI·API·DB 계약과 M1/M1.5 명세
네 파일에 동기화했다.

확인한 공식 기술 근거:

- [ECMAScript String iterator](https://tc39.es/ecma262/multipage/text-processing.html#sec-string-iterator-objects): String iterator가 surrogate pair를 한 code point 단위 요소로 순회하는 기준
- [ECMAScript trim](https://tc39.es/ecma262/multipage/text-processing.html#sec-string.prototype.trim): WhiteSpace·LineTerminator 기반 앞뒤 제거 기준
- [PostgreSQL 18 character type](https://www.postgresql.org/docs/18/datatype-character.html): `varchar(n)`이 byte가 아닌 character 수를 제한하며 명시적 cast는 초과값을 자를 수 있다는 기준
- [PostgreSQL 18 문자열 함수](https://www.postgresql.org/docs/18/functions-string.html): `char_length`, `normalize`, `IS NFC NORMALIZED` 기준

### R08 — 법무 차단 색인

`docs/legal/README.md`의 단일 목록을 단계 열이 있는 색인으로 바꿨다. 본문에 있던 다음 조건을
누락 없이 연결하되 법무 결과는 채우지 않았다.

- M0 Core 공개 서비스 요청 처리 근거
- 권리 요청 이메일 처리 근거·고지 방식·고지된 3년 보유 기간의 적정성
- 약관·개인정보처리방침·권리자 안내·쿠키 설정 시행일과 실제 artifact
- M1 SIGNUP_PRIVACY, provider·국외이전, 인증 cookie, 탈퇴 삭제 ledger 8주, provider guard 30일
- M1.5 약관 법무 검토·시행일, 신고 설명·운영 메모 90일, 이의제기 실값·운영 수용
- 선택 GA4·광고·제휴의 기능별 gate

삭제 ledger 8주는 M1 탈퇴부터 적용하고, 신고 90일은 M1.5에 적용하도록 서로 다른 행으로 나눴다.
실제 처리 근거·최소 기간·연령 방식·국외이전은 기존 출시 차단 상태를 유지한다.

### R09 — 현행 3상태 분리

`docs/system-design/design-readiness.md`를 새 현행 색인으로 만들고 각 단계를 다음 세 상태로 분리했다.

- 설계 기준선: 개발 입력 계약의 정합성
- 구현 수용: source·migration·test·build·DB·외부 adapter·browser 증거
- production 공개 승인: 운영 실값·법무·실계정·복구 훈련·운영 수용

과거 `docs/system-design/validation/member-readiness-review.md`는 당시 오프라인 검증 이력으로 남기고
소급 수정하지 않았다. 새 상태 문서는 `조건부 확정 가능`을 별도 기준선 분리·tag·merge 완료로
표현하지 않으며, 주 검수 후에도 실행 작업과 분리한다. 시스템 README, 서비스 planning, 법무 README가
현행 색인을 참조한다. M0 수집 보조도 Spring 상세 계약의 주 검수 완료 뒤 조건부 설계 확정 가능으로
분리했으며 source·migration·OpenAPI·test·build·runtime과 실제 출처·계정은 미검증으로 유지한다.

## 변경 파일

- planning: `01-service-plan.md`, `03-screen-design.md`, `08-member-community-plan.md`, `09-random-name-catalog.md`
- system-design: `06-member-community-design.md`, `README.md`, 신규 `design-readiness.md`,
  `validation/check-member-design.py`
- development-specs: M1 `member-identity`, `account-lifecycle`; M1.5 `community-participation`,
  `community-moderation`의 기존 네 기능 파일
- legal: `README.md`, `terms-of-service.md`, `privacy-policy.md`의 안정적인 색인 anchor
- collector 담당 위임 동기화: `system-design/04-infrastructure-design.md`, `05-security-operations.md`의
  기존 Spring 전환 절만 `07-spring-collector-design.md` 계약에 맞춤. 수정 전 사본은
  `/private/tmp/blariyo-final-policy-spring-sync-before-20260908/04-05-before.tar`
- 작업 결과: 이 문서

## 검증

- `python3 docs/system-design/validation/check-member-design.py` 통과:
  - 이름 262,144조합, 최대 19 code point, 명시 금칙어 일치 0건
  - Unicode 문자열 계약 35건
  - 제재 predicate 6건
  - 기존 연령·SQLite 제약 21건
  - Markdown 표 검사 통과
- Node.js에서 `isWellFormed()`·NFC·trim·`Array.from`으로 한글 NFC, emoji, ZWJ, 결합문자,
  FEFF trim, 단독 surrogate 6건 통과.
- 최종 상태 동기화 후 문서 구조 검사: Markdown 73개·상대 링크 700개·표 358개, 오류 0건.
- `git diff --check` 통과.

## 미검증·차단

- PostgreSQL 18 migration과 `char_length`/NFC CHECK는 설계 계약이며 실제 DB에서 실행하지 않았다.
- UI·Core·PostgreSQL의 공유 fixture 통합 테스트와 실제 browser counter는 구현 뒤 검증한다.
- 운영자·담당자·접수 이메일·시행일·provider 앱·수탁자 실값을 입력하지 않았다.
- 권리 요청·연령·보존·국외이전·약관의 법무 적정성을 확정하지 않았다.
- 설계 기준선 분리, 구현 수용, production 공개 승인, commit·push·merge·tag는 수행하지 않았다.
