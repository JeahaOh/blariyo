# TASK-02 — Blariyo AI 협업 체계 도입 초안 독립 재검수

- 작성일: 2026-08-13
- 업무 영역: `ai-governance`
- 상태: 완료 — 최종 재검수 Medium 2건 추가 반영, 문서 잔여 Critical/High/Medium 0건
- 역할: 오케스트레이터가 작업을 분할하고, 별도 검수 에이전트가 독립 검토하며, 오케스트레이터가 최종 근거를 재검수·보고
- 작업 성격: 읽기 전용 감사 후 사용자 승인에 따른 검토 문서 보완

## 1. 목표

기존 검수 결과나 초안 작성자의 설명을 그대로 신뢰하지 않고, 비교 프로젝트 정본과 Blariyo의 실제 문서·코드·Git 상태를 직접 대조하여 AI 협업 체계 도입 초안의 정확성, 안전성, 실행 가능성을 판정한다.

## 2. 검토 대상

1. `<blariyo>/worklog/task-list/08/13/ai-governance/TASK.md`
2. `<artifact-dir>/blariyo-ai-governance-adoption-draft-20260813.md`

`<artifact-dir>`는 저장소 외부의 문서 산출물 보관 디렉터리다.

## 3. 비교 대상

- `<reference-project>/AGENTS.md`
- `<reference-project>/dev-guide.md`
- `<blariyo>/README.md`
- `<blariyo>/docs/planning/`
- `<blariyo>/docs/legal/`
- `<blariyo>/worklog/session-log/README.md`
- Blariyo의 실제 Git 상태, `package.json`, lockfile 정책, Git hook, CI 설정
- `<blariyo>/apps/blariyo.core/` 내부의 중첩 Git 상태

`<blariyo>`는 현재 Blariyo 저장소 루트를 뜻한다.

## 4. 검토 관점

1. 기존 체계에서 그대로 가져갈 것, 축소 적용할 것, 제외할 것의 분류가 적절한가
2. 비교 프로젝트 전용 규칙이 Blariyo에 잘못 이식되지 않았는가
3. Blariyo의 제품·법무 정본이 `AGENTS.md`나 `docs/ai`보다 우선하도록 설계됐는가
4. Express와 NestJS가 공존하는 현재 상태를 추측 없이 처리했는가
5. `apps/blariyo.core/.git` 중첩 저장소의 흡수·삭제 위험을 충분히 다뤘는가
6. 패키지 관리자, lockfile, 루트 workspace, CI 작업 경로를 성급히 확정하지 않았는가
7. CI 파일·실행 성공과 실제 required check 설정 전후를 구분했는가
8. 요청 body, Authorization/Cookie, token, 비밀번호, 권리 증빙의 로그 유출 방지가 포함됐는가
9. task, session, ADR, `docs/ai`의 역할과 정본 경계가 명확한가
10. 실제 실행 가능성, 유지보수성, 규칙의 과도함을 검토했는가

## 5. 작업 분할

### A. 문서·정본 경계 검수

- 비교 프로젝트 정본 규칙과 Blariyo 제품·법무 정본을 행 단위로 대조한다.
- Keep/Adapt/Drop 분류, Express/NestJS 표현, task/session/ADR/`docs/ai` 역할을 검증한다.
- 기존 검수 8건의 실제 반영 여부와 신규 문제를 분리한다.

### B. 저장소 실상 검수

- 바깥 Blariyo 저장소와 `apps/blariyo.core`의 Git 상태를 별도로 확인한다.
- `package.json`, 존재하는 lockfile, ignore 정책, hook, CI 파일과 실제 작업 경로를 확인한다.
- 중첩 저장소를 흡수·삭제·이동하지 않고 위험만 평가한다.

### C. 보안·반증 검수

- 민감 로그 방지와 법무·권리 증빙 처리 규칙을 실제 정본과 대조한다.
- 다른 검수 결과의 각 지적을 반대 근거로 한 번 더 검증한다.
- 근거가 약하거나 추측에 의존하는 지적은 최종 목록에서 제외한다.

### D. 오케스트레이터 최종 검수

- 에이전트 결과를 그대로 전달하지 않고 모든 파일:행을 직접 재확인한다.
- 중복 지적을 병합하고 상충 결론은 근거를 비교해 판정한다.
- 명령 실행 결과와 문서 표현을 혼동하지 않는다.

## 6. 필수 결과 형식

각 지적에는 다음 항목을 모두 포함한다.

- ID
- 심각도: Critical / High / Medium / Low
- 신뢰도: High / Medium / Low
- 정확한 파일:행
- 문제
- 영향
- 구체적인 수정안

추측성 지적, 단순 취향, 정확한 파일:행 근거가 없는 지적은 제외한다. Git 상태처럼 파일 행이 없는 실행 사실은 관련 주장이 적힌 초안의 파일:행을 위치로 제시하고, 별도 읽기 전용 명령 결과를 반증 근거로 병기한다.

## 7. 최종 판정 기준

- 승인: Critical/High/Medium 잔여가 없고 실행을 막는 정본 충돌이 없음
- 조건부 승인: Critical이 없으며, 반영 위치와 수정 방법이 명확한 High/Medium 보완 후 도입 가능
- 보류: Critical이 있거나 정본·저장소 기준선이 불명확하여 현재 초안으로 안전한 도입 판단이 불가능

최종 보고에는 Critical/High/Medium 잔여 건수를 명시한다.

## 8. 실행 당시 금지사항과 후속 승인

- 검토 대상 및 비교 대상 파일 수정 금지
- 소스·설정·Git hook·CI 변경 금지
- commit, push, merge, 삭제, 중첩 저장소 흡수 금지
- 패키지 설치, lockfile 재생성, 테스트 결과를 바꾸는 명령 금지
- 외부 전송 금지

독립 감사 수행 중에는 이 `TASK-02.md` 생성 외의 파일을 변경하지 않았다. 이후 사용자가
검수 결과의 문서 적용을 명시적으로 승인하여 `TASK.md`, `TASK-02.md`, 적용 검토 초안만
보완했다. 소스·설정·hook·CI는 변경하지 않았다.

## 9. 완료 조건

- [x] 세 작업 축의 독립 검수 결과 수집
- [x] 기존 검수 8건 반영 여부 재확인
- [x] 신규 문제 독립 탐색
- [x] 모든 최종 지적의 파일:행 재확인
- [x] 최종 지적 반증 및 false positive 제거
- [x] 조건부 승인 판정
- [x] 재검수 발견 건수 보고: Critical 0 / High 1 / Medium 6 / Low 2
- [x] 문서 반영 후 잔여 건수 보고: Critical 0 / High 0 / Medium 0
- [x] 사용자 승인 후 확정 지적을 검토 문서에 반영
- [x] 최종 재검수 GOV-02-R, GIT-01-R 반영 및 문서 잔여 0건 확인

## 10. 최종 검수 결과

판정은 **조건부 승인**이다. 문서 설계의 확정 지적은 초안에 반영했지만, 실제 Express
소스의 민감 로그는 이번 문서 작업 범위에서 수정하지 않았으므로 Phase 0 실행 전제는 남는다.

### SEC-01 — 민감 로그 제거보다 CI 도입이 먼저 배치됨

- 심각도: High
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:79-82`, `:362-369`;
  `<blariyo>/apps/api/src/app.js:18-20`;
  `<blariyo>/apps/api/src/middlewares/loggingMiddleware.js:5-16`;
  `<blariyo>/apps/api/src/utils/logger.js:16-17`;
  `<blariyo>/apps/api/src/controllers/userController.js:21-25`;
  `<blariyo>/apps/api/src/services/userService.js:40-43`;
  `<blariyo>/apps/api/tests/connection.test.js:8-14`
- 문제: tracked Express가 요청 body와 비밀번호·DB 비밀번호를 출력하는데 일반 CI가 먼저
  도입될 수 있었다.
- 영향: 로컬 파일 로그와 CI 로그·artifact로 자격증명과 개인정보가 확산될 수 있다.
- 구체적인 수정안: raw body/query/params와 자격증명 출력을 제거하고 allowlist logger,
  negative test, 실제 로그 부재 검사를 Phase 0 선행 게이트로 둔다.
- 반영: 초안의 결론, 하네스, Phase 0, 체크리스트, 최종 추천 순서에 반영했다.

### GOV-01 — 사용자 요청과 제품·법무 정본 권한 혼재

- 심각도: Medium
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:89-101`;
  `<blariyo>/docs/legal/README.md:38-57`
- 문제: 작업 지시 우선순위와 제품·법무 사실의 정본 권한을 하나의 서열로 표현했다.
- 영향: 일회성 요청이 정본 갱신 없이 제품 계약이나 출시 차단을 면제하는 것으로 해석될 수 있다.
- 구체적인 수정안: 사용자 요청은 작업 범위·승인을, planning/legal은 제품·법무 사실을
  결정하도록 두 축을 분리하고 충돌 시 정본 갱신 전 `BLOCKED`로 둔다.
- 반영: 초안 `작업 권한과 사실 정본` 절로 교체했다.

### GOV-02 — task/session/ADR/docs/ai 역할 중첩

- 심각도: Medium
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:103-115`;
  `<blariyo>/worklog/session-log/README.md:9-13`, `:23-32`
- 문제: 결정·핸드오프·재개 기록의 위치와 정본 승격 규칙이 겹쳤다.
- 영향: 같은 결정이 여러 문서에서 달라지거나 제품·법무 사실이 ADR에만 남을 수 있다.
- 구체적인 수정안: planning/legal=제품·법무 정본, ADR=기술 결정, task=작업 증거,
  session=재개 이력, docs/ai=절차·링크로 역할을 고정한다.
- 반영: 초안에 산출물별 역할과 권위 표를 추가했다.

### STACK-01 — 현행 Express와 NestJS scaffold의 상태 표현

- 심각도: Medium
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:24-27`, `:492`;
  `<blariyo>/docs/planning/02-infra-plan.md:21-46`, `:64`
- 문제: 기존 TASK가 현재를 승인된 Express→NestJS 전환 상태처럼 표현했다.
- 영향: 미추적·무커밋 scaffold를 승인된 전환으로 오해할 수 있다.
- 구체적인 수정안: tracked 구현·현행 planning 제안은 Express이고 NestJS 전환 승인은
  미확인이라고 명시한다.
- 반영: 기존 TASK와 초안의 결론·Phase 0·미정 항목을 정정했다.

### CI-01 — 원격 required check 상태 미검증

- 심각도: Medium
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:59`, `:355-358`, `:496`
- 문제: 로컬 hook과 저장소 workflow 부재만으로 원격 게이트까지 없다고 확정했다.
- 영향: GitHub branch protection, ruleset, 외부 status check를 누락할 수 있다.
- 구체적인 수정안: 현재는 원격 상태 `미검증`으로 제한하고 Phase 0에서 읽기 전용
  API/UI로 적용 브랜치와 check context를 확인한다.
- 반영: 현황, CI 절, Phase 0, 체크리스트, 미정 항목을 정정했다.

### PKG-01 — 기존 package-lock과 manifest 불일치

- 심각도: Medium
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:81-82`, `:329-337`, `:372`;
  `<blariyo>/apps/api/package.json:33-36`;
  `<blariyo>/apps/api/package-lock.json:25-29`, `:4617-4620`
- 문제: 기존 lockfile의 `nodemon` 범위·해석 버전이 package.json보다 오래됐다.
- 영향: 기존 파일을 그대로 추적하면 clean install 실패나 계획 밖 재생성이 발생할 수 있다.
- 구체적인 수정안: manifest-lock 일치 검사 후 재생성 diff 검수와 fresh clean install을
  통과한 파일만 추적한다.
- 반영: 패키지 관리자 절, Phase 0·2, 체크리스트, 미정 항목을 보완했다.

### GIT-01 — 중첩 저장소 복구 조건 부족

- 심각도: Medium
- 신뢰도: High
- 정확한 파일:행: 적용 검토 초안 `:374-381`, `:451-453`, `:493`
- 문제: 내부 저장소에 HEAD와 remote가 없고 전 파일이 untracked인데 포괄적인 백업만 요구했다.
- 영향: 흡수·폐기·submodule 전환 시 유일 작업본을 잃을 수 있다.
- 구체적인 수정안: 외부 백업, 파일 manifest·SHA-256, 복원 시험, 내부 `.git` 보존,
  outer index dry-run, 사용자 승인 순서를 강제한다. submodule은 초기 commit과 지속 가능한
  remote가 생긴 뒤에만 허용한다.
- 반영: Phase 0과 Git 체크리스트에 구체적인 복구 게이트를 추가했다.

### Low 사실 정합성 2건

1. 저장 완료 후에도 `BLOCKED`로 남은 상태를 `목표 저장 완료·미추적·미커밋`으로 전이했다.
2. 1차 검수 반영 건수 7/8 불일치를 해소하고 이번 독립 재검수 결과를 별도 기록했다.

## 11. 반증 결과

- Express와 NestJS가 동시에 존재한다는 관찰 자체는 맞다. 다만 현재 기준선과 승인된
  전환 여부를 구분하도록 표현을 좁혔다.
- 민감정보 금지 항목 자체는 초안에 이미 있었다. 결함은 누락이 아니라 Phase 3까지
  미룬 적용 순서였으므로 Phase 0으로 이동했다.
- 루트 workspace와 npm 명령은 조건부 예시여서 성급한 확정 지적에서 제외했다.
- CI workflow 생성과 required check 활성화의 미래 단계 구분은 적절했다. 원격의 현재
  상태만 미검증으로 정정했다.

## 12. 완료 상태와 남은 실행 리스크

- 이번 검토·반증·문서 반영: 완료
- 최종 판정: 조건부 승인
- 재검수 발견: Critical 0 / High 1 / Medium 6 / Low 2
- 문서 반영 후 잔여: Critical 0 / High 0 / Medium 0
- 실제 도입 전 보안 선결: High 1건. 문서 설계에는 반영됐지만 실제 Express 소스 수정과 자격증명 노출 조사는
  수행하지 않았으므로 별도 Phase 0 task가 필요하다.
- commit·push·삭제·중첩 저장소 변경: 수행하지 않음

## 13. 최종 재검수 Medium 2건 반영

### GOV-02-R — session 정본 예외 제거

- 심각도: Medium
- 신뢰도: High
- 문제: session을 비정본으로 규정하면서 planning 반영 전 예외 정본처럼 사용할 여지가 남아 있었다.
- 반영: session과 별도 정정 문서는 planning/legal 현행 정본 링크 탐색과 당시 실행 이력에만
  사용하도록 고정했다. 제품·법무 사실 입력으로 사용하지 않으며, 미흡수 결정은
  planning/legal 원문을 먼저 갱신하고 검수한 뒤 링크만 남긴다.
- 상태: 반영 완료

### GIT-01-R — 실행 가능한 nested Git 흡수 절차

- 심각도: Medium
- 신뢰도: High
- 문제: `.git`과 HEAD 없는 nested 원본을 그대로 둔 채 outer index dry-run을 수행할 수 없다.
- 반영: 외부 백업·manifest·SHA-256·복원 시험 후 원본을 그대로 보존하고, `.git`을 제외한
  별도 임시 복제본에서 outer index dry-run을 수행하도록 바꿨다. 결과 검수와 사용자 승인
  뒤에만 원본 `.git`을 외부 보존 위치로 이동하고 바깥 저장소에 흡수한다. submodule은
  내부 초기 commit과 접근 가능한 remote가 생긴 뒤에만 후보로 둔다.
- 상태: 반영 완료

### 최종 상태

- 문서 잔여: Critical 0 / High 0 / Medium 0
- 실제 Express 민감 로그: High 1건, 문서 확정 직후 별도 `security-hotfix` task로 시작 예정
- commit·push·삭제·nested Git 변경: 수행하지 않음
