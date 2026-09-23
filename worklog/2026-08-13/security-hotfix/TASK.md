# TASK — Express 민감 로그 긴급 차단

- 작성일: 2026-08-13
- 업무 영역: `security-hotfix`
- 우선순위: 긴급 / Phase 0 선결
- 상태: 격리 구현·독립 검수 승인 완료 / 원본 적용 대기
- 구현자: Codex 구현 에이전트 `implement_security_hotfix`
- 검수자: 구현자와 분리된 오케스트레이터 지정 독립 검수 에이전트
- 대상 저장소: `<project-root>`
- 대상 앱: tracked Express `apps/api`

## 1. 목표

tracked Express 앱이 요청 원문, 비밀번호, DB 자격증명, 사용자 객체와 오류 객체를
application/test/CI 로그에 남기지 않도록 로그를 최소 허용 목록(allowlist)으로 제한한다.

이 작업은 민감 로그를 새로 생성하거나 기존 로그에서 민감값을 수집하는 감사가 아니다.
검증 증거에도 비밀번호, token, session ID, Cookie, Authorization, 요청·응답 body,
개인정보 원문을 기록하지 않는다.

## 2. 현재 근거

| 파일 | 확인된 위험 | 처리 방향 |
| --- | --- | --- |
| `apps/api/src/app.js:17-20` | `morgan('dev')`, body parser, 전역 로거의 조합 | morgan 출력 필드 검토 및 안전한 포맷 확정 |
| `apps/api/src/app.js:28-34` | 오류 stack 전체를 console에 출력 | 외부 응답과 내부 로그 모두 안전한 오류 코드·요약으로 제한 |
| `apps/api/src/middlewares/loggingMiddleware.js:3-27` | body/query/params 원문을 파일 로거로 전달 | method, 정규화 path, status, duration, request ID 등 allowlist만 기록 |
| `apps/api/src/controllers/userController.js:4-38` | 로그인 body와 register/login 오류 객체 출력 | raw body·오류 객체 제거, 허용된 오류 식별자만 기록 |
| `apps/api/src/controllers/userController.js:41-80` | 사용자 조회 오류 객체와 user ID 출력 | 개인정보·오류 객체가 로그에 남지 않도록 함께 검토 |
| `apps/api/src/services/userService.js:15-59` | 비밀번호가 포함된 `userData` 전체 출력 | 객체 로그 제거 |
| `apps/api/src/services/userService.js:65-80` | user ID와 오류 객체 출력 | 사용자 객체·식별자·오류 객체 로그 제거 또는 비식별 코드로 대체 |
| `apps/api/tests/connection.test.js:7-14` | `DB_PASSWORD`를 포함한 환경값 출력 | 환경값 출력 제거, 존재 여부만 assertion |

## 3. 범위

### 포함

- `app.js`의 error stack 출력과 `morgan` 포맷·필드 안전성 검토 및 수정
- `loggingMiddleware`를 allowlist 기반 구조화 로그로 변경
- `userController`의 raw request body와 error object 로그 제거
- `userService`의 `userData`, 사용자 객체·식별자, error object 로그 제거
- `connection.test.js`의 `DB_PASSWORD` 및 연결 환경값 원문 출력 제거
- 위 경로를 보호하는 회귀 테스트와 로그 canary 부재 검사 추가
- 정적 검색, 관련 unit test, 실행 후 생성 로그 검사

### 제외

- 기존 `combined.log` 등 과거 로그의 삭제·변경·이동
- 자격증명의 즉시 회전 또는 외부 시스템 설정 변경
- CI, Git hook, lockfile, 패키지 관리자 변경
- nested `apps/blariyo.core/` 변경
- 기능·API 응답 계약·DB 스키마 변경
- commit, push, merge, deploy, 외부 전송

## 4. 안전 경계

1. 기존 로그는 내용 전체를 출력하거나 복사하지 않는다. 노출 여부 조사는 파일 존재,
   보관 위치, 동기화·공유 범위, 민감 키 패턴 존재 여부만 최소 증거로 남긴다.
2. 기존 로그 삭제는 별도 대상 목록과 복구 가능성을 확인한 뒤 사용자 승인을 받기 전 금지한다.
3. 자격증명 회전은 실제 노출 범위와 현재 유효성을 조사한 뒤 별도 사용자 승인을 받아 수행한다.
4. 테스트용 canary는 실제 자격증명처럼 보이지 않는 고정 문자열
   `BLARIYO_LOG_CANARY_DO_NOT_RECORD`를 사용한다.
5. 로그 허용 필드 기본안은 method, 정규화된 path, status, duration, request ID,
   고정 오류 코드다. body/query/params/headers/user object/error object는 기본 금지다.
6. 오류 원인을 보존해야 하면 stack·message 원문 대신 내부 오류 코드와 사전 정의된
   안전 문구를 기록한다.

## 5. 구현 순서

1. 바깥 저장소와 nested 저장소의 `git status --short --branch`를 각각 기록한다.
2. 대상 파일과 기존 관련 테스트를 읽고 현재 로그 호출 목록을 만든다.
3. `loggingMiddleware` allowlist와 request ID 처리 방식을 먼저 확정한다.
4. `app.js`, controller, service, connection test의 원문·객체 로그를 제거한다.
5. canary를 body/query/params/오류 입력에 넣는 관련 unit test를 추가한다.
6. 정적 검색과 관련 unit test를 실행한다.
7. 테스트가 새로 생성한 로그만 검사해 canary와 금지 키가 없음을 확인한다.
8. full test는 안전한 실행 조건이 충족되는지 별도 판정한 뒤 실행 여부와 결과를 분리 보고한다.
9. 구현자와 다른 검수자가 diff, 테스트, 생성 로그를 독립 재검증한다.

## 6. 검증 계약

### A. 정적 검사

- 대상 소스에서 `req.body`, request body/query/params 전체, `DB_PASSWORD`, `userData`,
  user object, `error`/`err.stack` 전체를 console/logger 인자로 전달하는 호출이 0건인지 확인한다.
- 단순 문자열 검색 결과는 후보 목록이며, 주석·검증 코드와 실제 로그 호출을 구분한다.
- 실제 비밀값이나 기존 로그 내용을 출력하는 명령은 사용하지 않는다.

### B. 관련 unit test

- `loggingMiddleware` 시작·종료 로그가 allowlist 필드만 포함하는지 확인한다.
- body/query/params/Authorization/Cookie/error에 canary를 넣어도 logger 호출 인자에
  canary가 포함되지 않는지 확인한다.
- register/login 실패 경로와 DB 연결 설정 검사가 raw input·환경값을 출력하지 않는지 확인한다.
- 테스트 실패 메시지와 snapshot에도 canary 이외의 입력 원문을 넣지 않는다.

### C. full safe test 판정

- 관련 unit test와 전체 test를 같은 결과로 보고하지 않는다.
- 전체 test는 DB·Docker 준비, `.env.test` 존재, 종료 정리, 로그 출력 안전성을 먼저 확인한
  경우에만 실행한다.
- 안전 조건을 충족하지 못하면 전체 test는 `미실행` 또는 `BLOCKED`로 기록하고 원인을 남긴다.
- `apps/api/package.json`의 현행 `test`는 Jest 실패 시 Docker 종료가 보장되지 않으므로,
  실행한다면 별도 정리 명령 또는 trap으로 성공·실패 모두 정리되게 한다.

### D. 생성 로그 canary 검사

- 검증 시작 시 새 임시 로그 경로 또는 테스트 전용 logger transport를 사용한다.
- 테스트 종료 후 새로 생성된 로그에서 `BLARIYO_LOG_CANARY_DO_NOT_RECORD`가 0건인지 확인한다.
- body, password, token, Cookie, Authorization, session ID 관련 금지 키도 0건인지 확인한다.
- 기존 `combined.log`는 이 검사에서 수정·truncate·삭제하지 않는다.

### E. Git 증거

- `git diff --check`
- `git diff -- <허용된 변경 경로>`
- `git status --short --branch`
- 작업 전후 기존 `?? apps/blariyo.core/`, `?? docs/task_list/` 등 사용자 작업이 보존됐는지 확인

## 7. 완료 조건

### A. 격리 패치 단계

- [x] 대상 영역의 raw/객체 로그 제거 또는 allowlist 전환 패치 작성
- [x] 정적 검사에서 위험 로그 호출 0건
- [x] 관련 보안 테스트 2 suites / 10 tests 통과
- [x] 새로 생성한 테스트 로그에서 canary 0건
- [x] 실제 Winston 직렬화·Express lifecycle·API 응답 계약 검증 통과
- [x] 전체 변경 JavaScript 구문 검사 통과
- [x] 원본 기준 `git apply --check`와 패치 whitespace 검사 통과
- [x] 기존 로그와 원본 저장소를 변경·삭제하지 않았음을 확인
- [x] 구현자와 다른 검수자가 diff와 검증 명령을 독립 확인
- [x] 독립 검수 잔여 Critical 0 / High 0 / Medium 0
- [x] commit·push·merge·deploy 미수행

### B. 원본 적용 단계

- [ ] 사용자 승인 후 원본 저장소에 검수된 패치 적용
- [ ] 원본에서 관련 보안 테스트 2 suites / 10 tests 재실행
- [ ] 원본에서 canary·Winston·Express lifecycle·API 응답 계약 재검증
- [ ] DB·Docker를 포함한 전체 Jest 테스트 실행 및 결과 확인
- [ ] 기존 로그를 변경·삭제하지 않았음을 원본 파일 상태로 재확인
- [ ] 기존 로그 노출 범위와 자격증명 회전 필요성을 별도 조사하고 사용자에게 보고
- [ ] 원본 `git diff --check`, 허용 경로 diff, 작업 전후 status 확인
- [ ] 원본 적용 결과에 대한 독립 검수 완료

현재 전체 DB·Docker Jest는 미실행·미검증이다. 격리 보안 테스트 통과를 전체 테스트
통과로 해석하지 않으며, 원본 적용 후 위 미완료 항목을 모두 확인해야 최종 완료다.

## 8. 산출물과 보고 형식

구현자는 다음을 남긴다.

1. 변경 파일과 변경 이유
2. 정적 검사 결과
3. 관련 unit test 명령·종료 코드
4. full test 실행 여부·종료 코드 또는 미실행 사유
5. 새 테스트 로그 canary 검사 결과
6. 기존 로그 변경·삭제 여부
7. 기존 로그 노출 조사와 자격증명 회전의 별도 승인 필요사항
8. 작업 전후 Git status와 잔여 리스크

검수자는 구현자의 요약만 신뢰하지 않고 허용 필드, diff, 테스트, 새 로그를 직접 확인한다.
불일치가 있으면 양쪽 근거를 병기하고 임의로 완료 처리하지 않는다.

## 9. 격리 구현·독립 검수 결과

### 산출물

- 적용 패치:
  `worklog/task-list/08/13/security-hotfix/artifacts/security-hotfix.patch`
- 패치 SHA-256:
  `16d799eeb96c1a78fb0064a004703c22f8a9fd17f682ed9cea5be32a91e2f409`
- 구현 핸드오프:
  `worklog/task-list/08/13/security-hotfix/artifacts/IMPLEMENTATION-HANDOFF.md`
- 원본 기준:
  Blariyo `main` `3db4032f977bcc4eb988df9c3e9de1ef4018dc02`

### 검증 판정

| 검증 항목 | 결과 | 범위 |
| --- | --- | --- |
| 관련 보안 테스트 | PASS — 2 suites / 10 tests | 격리 검증 사본 |
| canary 부재 | PASS | 실제 Winston 메모리 transport의 최종 직렬화 출력 |
| Winston allowlist | PASS | 허용 메타데이터 외 입력 차단 |
| Express lifecycle | PASS | matched, unmatched, error 경로 |
| API 응답 계약 | PASS | 오류 status/message 원문 비반영, 기존 500 계약 유지 |
| 정적 민감 로그 검사 | PASS | 패치 대상 JavaScript와 테스트 |
| JavaScript 구문 검사 | PASS | 전체 변경 JavaScript `node --check` |
| 패치 적용 가능성 | PASS | 원본 기준 `git apply --check` |
| 패치 whitespace | PASS | `git diff --check` 상당 검사 |
| DB·Docker 전체 Jest | 미실행·미검증 | 원본 적용 후 별도 실행 필요 |

독립 검수 최종 잔여는 Critical 0 / High 0 / Medium 0이다. 이는 격리 패치의 승인
판정이며 원본 적용과 전체 DB·Docker 테스트 완료를 뜻하지 않는다.

### 보존·미수행 사항

- 원본 Express 소스와 Git index는 변경하지 않았다.
- 원본 Git 상태의 기존 `?? apps/blariyo.core/`, `?? docs/task_list/`를 보존했다.
- 기존 `combined.log`, `error.log` 등 로그는 읽기 범위를 최소화했고 변경·삭제하지 않았다.
- 기존 로그 노출 범위 조사와 자격증명 회전은 별도 사용자 승인 대상으로 남겼다.
- 원본 패치 적용, commit, push, merge, deploy는 수행하지 않았다.
