# Blariyo 민감 로그 제거 핫픽스 구현 핸드오프

- 작성일: 2026-08-13
- 구현자: Codex 구현 에이전트 `implement_security_hotfix`
- 원본 기준: Blariyo `main` `3db4032f977bcc4eb988df9c3e9de1ef4018dc02`
- 원본 저장소: 읽기 전용 유지
- 구현 사본: 임시 격리 작업본(현재 정본 아님)
- 적용 패치: `worklog/task-list/08/13/security-hotfix/artifacts/security-hotfix.patch`
- 패치 SHA-256: `16d799eeb96c1a78fb0064a004703c22f8a9fd17f682ed9cea5be32a91e2f409`

`<project-root>`는 현재 Blariyo 저장소 루트를 뜻한다.

## 구현 내용

1. 전역 요청 로그에서 `body`, `query`, `params`, header, raw URL을 제거했다.
2. 요청 시작 로그는 HTTP method, 내부 생성 request ID, timestamp만 기록한다.
3. 요청 종료 로그는 위 값에 라우트 템플릿, status code, duration만 추가한다.
   안전 경로 계약은 Express `req.route.path` 템플릿만이며 mount prefix는 보장하지 않는다.
   매칭하지 못한 경로는 실제 URL 대신 `unmatched`로 기록한다.
4. Winston 메타데이터에 명시적 allowlist를 적용했다.
5. `morgan('dev')`를 제거해 query string이 console에 기록되는 경로를 차단했다.
   `morgan` 패키지 의존성 제거는 lockfile 정책 결정 뒤의 별도 변경으로 남겼다.
6. 앱과 공용 error handler가 stack, error 원문, 원본 URL을 기록하지 않게 했다.
   오류 객체의 `status`와 `message`를 응답에 반영하지 않고 기존 계약인 HTTP 500과
   `{ success: false, message: '서버 오류가 발생했습니다.' }`를 그대로 유지한다.
7. 사용자 controller/service와 Joi 검증 middleware의 raw 입력·객체 로그를 제거했다.
8. DB 연결 테스트의 환경 변수 출력에서 비밀번호를 포함한 전체 연결정보 덤프를 제거했다.
9. 테스트 DB 초기화 실패 시 SQL 원문과 오류 원문을 출력하지 않게 했다.
10. canary 비밀번호·토큰·query·path 값이 logger payload에 포함되지 않는 회귀 테스트와
    정적 회귀 테스트를 추가했다.
11. 독립 검수 `TEST-01`에 따라 logger 완전 mock을 제거했다. 실제 Winston logger factory와
    메모리 stream transport를 사용해 최종 직렬화 로그를 검증한다.
    factory를 기본 logger와 분리해 테스트가 production file transport를 열지 않게 했다.
12. 테스트용 Express 앱에 프로덕션 request/error middleware를 실제 mount하고 Supertest로
    matched route, unmatched route, error lifecycle을 검증하도록 바꿨다.
13. body, query, params, Authorization, Cookie, error에 같은 고정 canary
    `BLARIYO_LOG_CANARY_DO_NOT_RECORD`를 넣어 Winston 출력 전체에서 0건임을 검사한다.
14. 오류 lifecycle의 안전 경로 기대값은 mount prefix가 제거된 `/error/:user_id`로
    검증하며, `error.status = 401`이어도 기존 500 응답 계약이 유지되는 테스트를 추가했다.

## 변경 파일

- `apps/api/src/app.js`
- `apps/api/src/controllers/userController.js`
- `apps/api/src/middlewares/errorHandler.js`
- `apps/api/src/middlewares/loggingMiddleware.js`
- `apps/api/src/middlewares/validateMiddleware.js`
- `apps/api/src/services/userService.js`
- `apps/api/src/utils/logger.js`
- `apps/api/src/utils/loggerFactory.js` 신규
- `apps/api/tests/connection.test.js`
- `apps/api/tests/setup.js`
- `apps/api/tests/logging.security.test.js` 신규
- `apps/api/tests/sensitive-log-source.security.test.js` 신규

## 검증 결과

- 전체 변경 JavaScript `node --check`: PASS
- 민감 로그 정적 검사: PASS
- 실제 Winston + Express + Supertest 보안 회귀 테스트: 독립 검수 환경에서 2 suites / 10 tests PASS
- 프로덕션 logger의 기본 console/file transport 구성: 유지
- 원본 기준 `git apply --check security-hotfix.patch`: PASS
- `git diff --check`: PASS
- 구현 사본과 전달 사본 비교: 일치
- 원본 Git 상태: 기존 `?? apps/blariyo.core/`, `?? docs/task_list/`만 유지
- DB·Docker 의존 전체 Jest: 미실행·미검증
  - 원인: 원본에 `node_modules`가 없고 package 설치·lockfile 재생성이 범위에서 제외됨
  - 적용 전 승인된 의존성 설치 기준선에서 기존 전체 테스트를 별도로 실행해야 함

## 적용 전 검수 절차

```bash
cd <project-root>
git apply --check worklog/task-list/08/13/security-hotfix/artifacts/security-hotfix.patch
```

검수자가 패치를 읽고 승인한 뒤에만 실제 적용한다. 적용 후에는 다음을 확인한다.

1. 승인된 clean install 환경에서 `apps/api` 전체 Jest 테스트 실행
2. 로그인·회원가입·회원수정·오류 응답을 canary 값으로 호출
3. console, `combined.log`, `error.log`에서 canary 값 0건 확인
4. 기존 로그의 과거 노출 범위와 외부 동기화 여부 조사
5. 실제로 노출된 자격증명이 현재도 유효하면 해당 자격증명 회전

## 남은 리스크

- 기존 `combined.log`와 `error.log`는 지시대로 삭제·수정하지 않았다.
- 신규 보안 회귀 테스트는 독립 검수 환경에서 2 suites / 10 tests를 통과했다.
- DB·Docker 의존 전체 Jest는 아직 실행하지 않았으므로 전체 회귀 통과를 의미하지 않는다.
- 패치는 원본에 적용하지 않았고 commit/push도 수행하지 않았다.

## 2026-08-19 작업 기록 이동 후 재확인

- 기록 경로를 `docs/task_list/`에서 `worklog/task-list/`로 옮겼다.
- 패치 SHA-256은 기존 값과 일치해 파일 내용은 보존됐다.
- 현재 `planning-design-only`의 `3f9008f`에서는 `git apply --check`가 실패한다.
- 원인은 패치 기준 커밋 `3db4032`와 현재 소스의 차이 및 일부 대상 파일 부재다.
- 위의 과거 PASS는 기준 커밋 당시 검증 결과이며 현재 브랜치 적용 가능성을 증명하지 않는다.
