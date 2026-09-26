# 개발 harness 구현 계획

- 작성: 2026-09-25. 설계 정본: [Git 브랜치 전략과 개발 harness](git-workflow.md).
- 상태: **계획 문서 작성. HARN-01~07 전부 대기**. 코드·hook 설치·CI 변경·원격 보호 설정·배포는 미실행이다.
- 이번에 `HARN-01~07`을 개발 도구용 로컬 task ID로 등록한다. 외부 발급 ID가 아니며 [기존 제품 task 17개](../implementation-tasks/README.md)의 수량·상태를 바꾸지 않는다.
- 아래 P0/P1/P2는 개발 도구 내부 구현 우선순위다. 기존 Core 출시·Collector 활성화 우선순위와 별도로 운영한다. 시작일·납기·담당자는 `(미정)`이며 공수나 날짜를 임의 확정하지 않는다.

## 1. 구현 원칙과 제외 범위

1. Node CLI 하나와 공통 정책 엔진을 만들고 기존 npm·Gradle·PostgreSQL·브라우저 runner를 재사용한다. 새 웹 관리 화면이나 중앙 DB를 만들지 않는다.
2. 작업·검증·승인·전달 상태를 분리한다. 문서화 요청을 구현·설치·commit·push·원격 설정 승인으로 확대하지 않는다.
3. 각 task는 독립적으로 리뷰·되돌리기 가능한 변경 단위다. 아래 커밋명은 실행 시 사용할 제안이며 이번 문서화에서 커밋하지 않는다.
4. 제품 요구사항·법무 placeholder·배포 계약을 복제하지 않고 링크한다. 민감한 설정과 테스트 데이터는 기존 격리 규칙을 따른다.
5. 최초 도입부터 모든 AI 도구의 편집 차단을 보장하지 않는다. 공통 CLI·Git·CI를 우선 구현하고 도구별 adapter는 실제 지원 범위를 확인한다.
6. 기존 브랜치 정리, 자동 push·merge·배포, S2B 관리대장 연결, 공수 통계와 활동 추적 대시보드는 제외한다.

## 2. 순서와 의존성

| ID | 우선순위 | 변경 단위 | 선행 | 상태 |
| --- | --- | --- | --- | --- |
| HARN-01 | 도구 P0 | 정책·task 계약·CLI·doctor | 이 설계 | 대기 |
| HARN-02 | 도구 P0 | worktree·자원 소유권·재개 | HARN-01 | 대기 |
| HARN-03 | 도구 P0 | 검증 runner·증거·ready/handoff | HARN-01, HARN-02 | 대기 |
| HARN-04 | 도구 P0 | Git hook·설치/복원·로컬 시범 적용 | HARN-01, HARN-03 | 대기 |
| HARN-05 | 도구 P0 | CI gate·원격 보호 활성화 | HARN-03, HARN-04 | 대기 |
| HARN-06 | 도구 P1 | 자기검사·어댑터·영향 범위 최적화 | HARN-01~05 | 대기 |
| HARN-07 | 도구 P2 | 배포 증거 대조 | HARN-03, HARN-05, 현행 배포 계약 | 대기 |

순서는 구현 의존성이다. 별도 에이전트 자동 위임이나 동시 실행 승인이 아니다. 같은 정책·runner 파일을 동시에 수정하지 않도록 실제 구현자가 범위를 배정한다.

## 3. 제안 파일 구조

다음은 **구현 예정 경로**이며 이 문서와 링크된 기존 문서를 제외하면 아직 존재한다고 가정하지 않는다.

```text
.harness/
  policy.json
  schemas/                    # task·policy·evidence 검증 schema
  tasks/<task-id>.json
.githooks/
  pre-commit
  commit-msg
  pre-push
  post-commit
scripts/harness/
  cli.mjs
  policy.mjs
  git.mjs
  workspace.mjs
  verify.mjs
  evidence.mjs
  doctor.mjs
  eslint.config.mjs           # harness source·test의 .mjs lint 대상 명시
tests/harness/
  *.test.mjs
```

- 로컬 소유권·실행 메타데이터는 Git이 알려주는 common directory 아래의 전용 영역, 큰 결과물은 Git 제외 출력 영역을 사용하는 안으로 구현 시 확정한다. `.git` 문자열을 하드코딩하지 않는다.
- 실제 사용자 홈·worktree 경로·승인 대화·비밀을 추적 설정에 넣지 않는다. CI에는 필요한 검증 결과만 artifact로 남긴다.
- 문서 진입점과 상태 요약은 기존 [AI 안내](README.md), [task 목록](../implementation-tasks/README.md), [status](../status.md), [roadmap](../roadmap.md)을 사용한다.

## 4. 작업별 구현 계약

### HARN-01 — 정책·task·doctor

- 변경 범위: `.harness/policy.json`, schema, `cli.mjs`, `policy.mjs`, `git.mjs`, `doctor.mjs`, `scripts/harness/eslint.config.mjs`, `package.json`의 진입·test/lint script, 관련 테스트.
- 내용: task 정본 참조·유효성 검사, 규칙 ID·경로·profile, Git 상태/HEAD/worktree와 hook 설정 출처 조회, 필수 환경 진단. runtime 버전은 현재 source 설정에서 읽는다.
- 필수 동작: 조회 명령이 파일·Git 설정·네트워크를 임의 변경하지 않음. 없는 task·검사기·정본·잘못된 schema를 이유와 함께 표시. path escape·symlink 경계를 처리.
- 수용: 임시 저장소에서 정상/누락/손상 입력을 구분하고, `doctor` 실행 전후 Git 설정·index·사용자 파일이 동일함. 존재하는 task 참조만 인정.
- 검사 연결: `test:harness`는 `tests/harness/*.test.mjs`를 Node test runner로 실제 실행하고 report·실행 테스트 수를 확인한다. `lint:harness`는 harness source·test의 `.mjs`를 명시적으로 포함한다. 기존 `test`·`lint:scripts`·`lint:tests`의 TS 전용 glob이나 typecheck가 이를 검사한다고 가정하지 않는다. 테스트 0개·필수 report 누락·의도적으로 넣은 실패 테스트와 lint 위반이 비정상 종료되는지 검증한다. HARN-05에서 이 두 명령을 필수 CI job에 연결한다.
- 커밋 제안: `feat(harness): add policy contracts and doctor`.

### HARN-02 — 작업 공간·자원·재개

- 변경 범위: `workspace.mjs`, `git.mjs`, CLI의 start/resume, 로컬 실행기와 연결하는 최소 adapter, 관련 테스트.
- 내용: 명시된 기준 SHA에서 branch/worktree 생성, repo/task/change/worktree/run 연결, 단일 작성자 lease, 충돌 탐지, 테스트 자원 배정·직렬화.
- 필수 동작: 원본 dirty/untracked 보존, 기존 branch/worktree 재사용 여부 명시, 네트워크·원격 push·운영 설정 복사 없음. 자원 일부 준비 실패 시 이번 실행이 만든 자원만 정리.
- 수용: 두 실행의 같은 작업·자원 충돌 탐지, 비정상 종료 뒤 stale lease와 실제 작업을 구분, HEAD 변경 탐지. 다른 작업의 폴더·PID·DB를 정리하지 않음.
- 커밋 제안: `feat(harness): isolate task workspaces and resume state`.

### HARN-03 — 검증·증거·인계

- 변경 범위: `verify.mjs`, `evidence.mjs`, CLI verify/ready/handoff, 기존 runner adapter, schema와 관련 테스트.
- 내용: 고정된 소스 스냅샷에서 허용된 profile 실행, 입력 hash·환경·검사·결과 기록, CI/로컬/수동 증거 분리, task 요약·다음 행동 생성.
- 필수 동작: runner를 임의 shell 문자열로 받지 않음. build 산출물 재사용 때문에 다른 소스를 검증하지 않음. 실행 전후 입력 변경·missing report·timeout·0 tests·skip을 명시적으로 판정.
- 수용: SHA·policy·lockfile·필수 환경 변경 시 이전 증거 무효화, 결과와 source hash의 순환 없음. 수동 기록을 자동 통과로 승격하지 않음. 비밀이 artifact에 포함되지 않음.
- 식별 계약: [설계](git-workflow.md) §8.3·§9.1의 `changeBindings`와 `executionContext` schema를 구현한다. PR head/base/merge-result, main before/after와 여러 변경, 수동 target/base/change 집합을 구분한다. CI의 로컬 `worktreeId`는 null로 두고 provider run/job/attempt·checkout ID를 기록한다. 자동 merge trailer 부재는 검증된 변경 연결로 처리하며 연결 누락·상충·다른 SHA 결과 재사용은 차단한다.
- 커밋 제안: `feat(harness): record verification evidence and handoffs`.

### HARN-04 — Hook·설치·복원

- 변경 범위: `.githooks/`, installer/restore 진입점, 공통 검사와 관련 테스트. 설치 명령과 단순 npm 의존성 설치를 분리한다.
- 내용: 빠른 index 검사, commit 메시지, 모든 push ref/SHA와 전송 이력의 비밀 검사, commit 뒤 로컬 기록. 지정 worktree 설치·기존 hook 보존·재귀 방지·원상 복원.
- 필수 동작: 부분 staging, 임시 index, 공백·한글·rename·삭제 경로 처리. 필수 validator가 없으면 차단. post-commit은 외부 전송이나 추가 commit을 실행하지 않음.
- 수용: 임시 저장소에서 실제 commit·로컬 bare remote push로 검증. 기존 hook의 결과·호출 순서 보존, 재설치 멱등, linked worktree 설치·실행·복원 성공. 실제 사용자 remote에는 테스트 push하지 않음.
- 이력 검사: [설계](git-workflow.md) §7.1대로 기존 ref의 old/new 범위, 새 branch 전체 도달 이력, 다중 ref, tag 메시지·이력, 삭제·0 OID를 처리한다. 중간 commit에서 비밀을 추가한 뒤 삭제해도 전송 전에 차단해야 한다. shallow/객체 부재는 BLOCKED/ERROR로 처리하고 hook에서 fetch하지 않는다. 최종 SHA의 앱 검증 증거로 이력 검사를 대신하지 않는다.
- 설치 범위: §7.2대로 대상 worktree의 `core.hooksPath`만 설정한다. `extensions.worktreeConfig` 활성화는 공통 설정 변경이므로 모든 worktree의 기존 유효 설정·Git 호환성·필요 이관을 먼저 확인·백업한다. 미지원·미확인은 BLOCKED이며 공유 설치로 우회하지 않는다. branch 전환에도 유지되는 dispatcher와 runner 누락 차단을 검증한다. A에 설치·제거해도 비대상 B의 hook 선택·동작은 보존하고, B가 사용하는 공통 확장을 제거하지 않는다.
- 커밋 제안: `feat(hooks): enforce task scope and verify outgoing commits`.

### HARN-05 — CI gate·원격 보호

- 변경 범위: 기존 `ci.yml`, 필요한 정책 검증 runner, CI 결과 schema·회귀. 원격 ruleset 변경은 별도 실행 단위로 보고한다.
- 내용: 기존 verify·collector를 유지하면서 필수 `harness` job, 전송 이력 비밀 검사, 조건부 `restore` job과 최종 `harness-gate` 추가. 이미지 게시에 gate 성공을 연결. 필수 job 성공·skip 이유·artifact 유무 판정.
- 필수 동작: PR 전체 workflow를 경로 필터로 생략하지 않음. 실패·취소·예상 외 skip 때 gate 실패. workflow 전체 취소로 gate 자체가 미실행이면 성공 check 부재로 병합·이미지 게시 차단. PR head·merge 결과·main image SHA를 구분.
- Harness job: HARN-01의 `npm run test:harness`, `npm run lint:harness`를 매 실행의 필수 job에서 호출하고 테스트 실행 수·report를 gate가 확인한다. `.mjs` 테스트 실패·lint 위반·0 tests로 gate가 실패하는지 검증한다.
- Restore job: [설계](git-workflow.md) §9.2 경로 분류를 구현하고 PR/main의 동일 subject SHA에서 기존 schema restore runner를 실행한다. migration·복구·검사기 변경은 job 성공과 SHA·policy·run/attempt가 일치하는 report를 요구한다. 일반 변경만 규칙·변경 목록 hash를 기록한 NOT_APPLICABLE로 처리한다. Collector DB 등 기존 suite 밖의 범위는 전용 검증을 보완하기 전까지 BLOCKED다. 별도 예약·수동 workflow는 운영 점검으로 유지하고 다른 SHA의 성공으로 gate를 채우지 않는다.
- 이벤트 입력: HARN-03 schema에 PR/main/수동 이벤트 adapter를 연결한다. 모든 job이 같은 SHA·변경 집합을 검사하는지 대조한다. 이력 비밀 검사는 중간 commit까지 포함하며, push 이후 CI 검사로 이미 전송된 비밀 노출을 막았다고 보고하지 않는다.
- 정책 신뢰: 기준 정책/runner와 후보 정책을 구분한다. 정책 변경자가 workflow까지 고칠 때의 우회 가능성을 검토하고 신뢰 실행 주체·보호 기능의 실제 지원을 확인한다.
- 수용: workflow 정적 검증과 HV-20/21/23 회귀 후 실제 허용된 PR/원격 CI에서 성공·필수 실패 차단 확인. 실패 시험은 비밀 없는 synthetic fixture로 수행한다. 그 후 해당 check 이름을 원격 필수 검사로 등록하고 설정을 readback. 원격 검증 전에는 로컬/YAML 검증 완료까지만 보고한다.
- 원격 전제: 저장소 공개 범위·요금제·관리 권한·검토자·현재 ruleset `(미정)`. 불가능하면 강제력 미완료로 남기고 로컬 성공으로 대체하지 않는다.
- 커밋 제안: `ci: require harness gate before publishing images`.

### HARN-06 — 자기검사·어댑터·검사 범위 최적화

- 변경 범위: 정본/설치/증거/도구 진입점 검사, adapter, 영향 범위 분류와 회귀. 기능별로 필요하면 이 task 안에서 PR을 나눈다.
- 내용: 존재를 주장한 경로·명령 검사, 문서의 현행 설명과 미래 요구사항 구분, 정책 중복·버전 drift 탐지, 기존 부채의 정확한 예외 관리.
- 필수 동작: AI 도구가 지원하지 않는 hook은 미지원으로 표시. 검사가 대상 0개·입력 부재인 상태를 PASS로 처리하지 않음. 신규 위반을 자동 allowlist에 넣지 않음.
- 수용: 일부러 만든 누락·충돌·낡은 증거를 검출하고 과거 worklog·미래 설계를 현행 오류로 오인하지 않음. 영향 범위 선택과 전체 검사 비교로 누락 없음 확인 후에만 생략 최적화를 활성화.
- 커밋 제안: `feat(harness): detect policy drift and verify affected checks`.

### HARN-07 — Release 증거 대조

- 변경 범위: release-check, 배포 manifest의 검증 adapter, 기존 배포 문서 연결과 테스트.
- 내용: 지정 후보 SHA·원격 CI·image digest·DB 호환·백업/복원·복귀 대상 증거를 읽기 전용으로 대조.
- 필수 동작: 실제 deploy/migration·외부 발송·수집 flag 활성화 없음. DB readiness와 backup freshness를 시간·환경별로 평가. stale 운영 관측을 현재 사실로 재사용하지 않음.
- 수용: fixture에서 잘못된 SHA/digest·만료 백업·비호환 DB·누락 증거를 차단. 실제 환경 검증은 허용된 읽기 전용 확인으로 별도 기록. 배포·운영 인수·7일 관찰은 별도 task로 유지.
- 커밋 제안: `feat(harness): check release evidence and compatibility`.

## 5. 명령 계약

아래는 **미구현 명령 예시**다. 구현 전 실행 지침으로 사용하지 않는다.

```bash
npm run harness -- doctor
npm run harness -- start UX-01 --type fix --slug policy-viewer-focus
npm run harness -- resume UX-01
npm run harness -- check --staged
npm run harness -- verify --ref HEAD --profile affected
npm run harness -- ready UX-01
npm run harness -- handoff UX-01
npm run harness -- release-check --manifest <release-manifest>
npm run test:harness
npm run lint:harness
```

| 명령 | 효과 | 권한 경계 |
| --- | --- | --- |
| doctor | 진단 결과 출력 | 읽기 전용; 실제 동작 self-test는 별도 임시 저장소 사용 |
| start | 로컬 branch/worktree·실행 기록 준비 | 구현 착수 범위에서만 실행, 자동 원격 push 없음 |
| resume | 이전 기록·현재 상태 비교와 실행 소유권 재설정 | 살아 있는 소유권 자동 강탈 없음 |
| check | 현재 index 검사 | index·소스 자동 수정 없음 |
| verify | 격리 소스·허용된 비운영 자원으로 테스트 | 운영 DB·외부 발송 사용 없음 |
| ready / handoff | 결과·미완료·재개 정보 기록 | 제품 완료·승인 상태 자동 승격 없음 |
| release-check | 지정 증거 대조 | 배포·DB 쓰기 없음 |
| test:harness / lint:harness | harness `.mjs` 테스트·lint와 결과 확인 | 임시 저장소·synthetic fixture 사용; 테스트 0개·누락을 성공 처리하지 않음 |

설치·복구·제거 명령의 최종 인자는 HARN-04에서 확정한다. npm `prepare` 같은 의존성 설치 후크에 Git 설정 변경을 숨기지 않는다.

## 6. 필수 회귀 시나리오

| ID | 입력·상황 | 기대 결과 | 담당 task |
| --- | --- | --- | --- |
| HV-01 | task·정본·validator·schema 누락 | 명시적 BLOCKED/ERROR, 성공 아님 | 01/04 |
| HV-02 | 부분 staging·임시 index | 실제 커밋 대상만 검사, 비스테이징 수정 보존 | 04 |
| HV-03 | 한글·공백·rename·삭제·symlink 경로 | 누락·경로 이탈 없이 정책 판정 | 01/04 |
| HV-04 | `HEAD:main`, 다중 ref, 새 branch, 삭제 push | 실제 목적지·각 SHA별 판정 | 04 |
| HV-05 | 정상 main merge와 수동 충돌 해결 | 승인된 유입과 신규 변경 구분; 최종 검사 유지 | 04 |
| HV-06 | 검사 도중 코드·HEAD·정책 변경 | 낡은 결과 재사용 금지 | 03 |
| HV-07 | 두 실행의 동일 worktree·포트·DB 요청 | 충돌 탐지·격리/직렬화, 다른 자원 보존 | 02 |
| HV-08 | crash·stale lease·PID 재사용 | 실제 소유권 재확인, 자동 삭제/kill 없음 | 02 |
| HV-09 | 기존 hook·중복 설치·linked worktree | 기존 동작 보존, 재귀 없음, 복원 가능 | 04 |
| HV-10 | tests=0·필수 report 없음·timeout·skip | 필수 검사 성공 아님 | 03/05 |
| HV-11 | CI 선행 실패·취소·예상 외 skip·workflow 전체 취소 | 실행 가능한 gate는 실패; gate 미실행도 성공 check 부재로 병합·이미지 게시 차단 | 05 |
| HV-12 | PR에서 정책·runner·workflow 약화 | 기준 정책 검사·보호 경계 검증, 우회 한계 명시 | 05/06 |
| HV-13 | 문서만 변경했지만 계약 입력 포함 | 필요한 앱·계약 검사 유지 | 06 |
| HV-14 | 다른 run 결과·변조된 로컬 PASS 파일 | CI가 독립 재실행, 증거 불일치 표시 | 03/05 |
| HV-15 | post-commit 기록 실패 | commit 존재 유지·기록 오류 분리, 자동 재커밋 없음 | 04 |
| HV-16 | 기존 부채 예외와 새 위반 | 정확한 기존 대상만 구분, 새 위반 차단 | 06 |
| HV-17 | 만료 백업·DB 비호환·다른 digest | release 준비 실패, 자동 배포 없음 | 07 |
| HV-18 | 앞선 commit에 synthetic 비밀 추가 후 마지막 commit에서 삭제 | 최종 tree가 깨끗해도 pre-push가 이력의 비밀을 검출·전송 차단; 원문 로그 금지 | 04/05 |
| HV-19 | 새 branch·다중 ref·annotated tag·삭제·0 OID·shallow·old 객체 부재 | 모든 ref 이력·tag 메시지 검사; 실제 빈 범위만 N/A, 증명 불가 범위는 차단; 자동 fetch 없음 | 04/05 |
| HV-20 | `.mjs` 테스트에 의도된 실패·lint 위반 또는 테스트 0개/report 누락 | 전용 명령과 CI harness job·최종 gate 실패; 정상 fixture에서는 실제 테스트 수 확인 | 01/05 |
| HV-21 | migration/복구 PR·main, 일반 변경, 다른 SHA의 예약 복원 성공 | 영향 변경은 동일 SHA restore 필수; 일반 변경만 근거 있는 N/A; skip·범위 미지원·증거 불일치는 차단 | 05 |
| HV-22 | A에 hook 설치·재설치·제거, B는 wrapper 없는 branch; 확장 미지원·설정 이관 필요 | 비대상 B의 hook 경로·동작 보존, A 복원·runner 누락 차단, 미지원은 공유 설치 없이 BLOCKED | 04 |
| HV-23 | PR detached merge·여러 PR 포함 main push·수동 실행·CI 재실행·연결 누락 | 실제 subject SHA·변경별 task/manifest·attempt·checkout ID 일치, CI worktreeId null; 누락·불일치 차단 | 03/05 |

로컬 회귀는 임시 Git 저장소·로컬 bare remote와 synthetic fixture를 사용한다. 사용자 저장소에 시험 커밋을 만들거나 실제 remote·운영 DB를 로컬 회귀 대상으로 사용하지 않는다. HARN-05의 원격 수용은 별도로 허용된 PR/CI 범위에서 실행한다. Windows/macOS/Linux의 경로·실행권한·셸·GUI Git 환경은 각 환경별로 검증하고 미실행 환경은 명시한다.

## 7. 단계별 도입과 되돌리기

1. **로컬 기반:** HARN-01~03의 임시 저장소 검사 완료. 기존 작업 공간을 보존한 상태로 신규 개발 준비가 가능한지 확인한다.
2. **로컬 시범:** HARN-04 설치 전 전체 worktree의 유효 설정·hook과 공통 확장 호환성을 확인·보관하고 지정한 worktree 하나에 적용한다. 정상 commit·전송 이력 차단·제거 후 복원과 비대상 worktree의 동작 보존을 확인한다.
3. **원격 관찰:** HARN-05 CI를 먼저 추가하고 허용된 PR에서 실제 check 이름·성공·실패를 확인한다. 아직 필수 보호가 없으면 미활성으로 보고한다.
4. **원격 강제:** 확인된 check를 required로 등록하고 main 직접 변경·필수 실패 병합 거부를 안전한 시험 범위에서 검증한다. 설정 readback 후 활성화 완료로 표시한다.
5. **후속 최적화:** HARN-06~07을 도입한다. 영향 범위 생략에 누락이 발견되면 전체 검사로 복귀하고 제품 검증을 유지한다.

되돌리기는 installer가 기록한 대상 worktree의 원래 hook·설정 연결로 복원한다. 다른 worktree가 쓰는 공통 확장·설치 후 설정은 삭제하지 않는다. CI gate 제거·이름 변경은 원격 required check와 함께 조정한다. 오탐 때문에 `--no-verify`·광범위 예외·전체 검사 비활성화를 표준 운영 방식으로 만들지 않는다.

## 8. 구현 전 결정과 완료 보고

| 결정 | 현재 상태 | 결정 시점 |
| --- | --- | --- |
| worktree 루트·공유 상태 경로 | 설정 가능 설계, 실제 경로 `(미정)` | HARN-02 |
| lease 갱신 주기·회수 절차 | 자동 강탈 금지, 수치 `(미정)` | HARN-02 |
| 증거 schema·보존기간·장기 release 보관 | 최소 필드 설계, 실제 저장·기간 `(미정)` | HARN-03/07 |
| hook 설치 범위·공존·대상 OS·복원 | 지정 worktree 하나·기존 연결 보존 확정; 지원 환경·호환성 `(미정)` | HARN-04 |
| 원격 보호 지원·권한·독립 검토자·신뢰 runner | 미조회 | HARN-05 |
| 도구별 AI hook 지원 범위 | 미검증 | HARN-06 |

완료 보고는 task ID, 변경 경로, 기준/대상 SHA, 실행 환경, 검사·결과·artifact, 남은 조건, commit·push·원격 설정 상태를 분리한다. 필요한 로컬·원격 수용이 남으면 해당 task를 완료 처리하지 않는다.

문서 작성만 끝난 현재에는 **설계·계획 문서화 완료 / HARN-01~07 구현 대기 / hook·CI gate·원격 보호 미적용**으로 보고한다.

## 9. Review Findings 반영과 변경 파일

2026-09-25 1차 감사의 D1-1·E1-1·C1-1·A1-1·A1-2 모두 사용자 선택에 따라 문서에 반영했다. 심각도·신뢰도·발견 내용·반영 위치의 정본은 [설계서 Review Findings](git-workflow.md#14-review-findings)에 둔다. 추가 회귀 HV-18~23은 **정의 완료·실행 대기**다. 기존 HV-01~17도 이 문서 작성으로 통과한 것이 아니다.

| 이번 문서 반영 파일 | 변경 내용 |
| --- | --- |
| [git-workflow.md](git-workflow.md) | 5건의 계약 보완, 1차 감사 결과·task/회귀 연결 |
| [harness-implementation-plan.md](harness-implementation-plan.md) | HARN-01/03/04/05 수용 조건, 회귀 6건 추가, 설치·복원 절차 |
| [status.md](../status.md) | 감사 반영 완료와 구현·실행 대기 구분 |
| [roadmap.md](../roadmap.md) | 초기 구현 단계에서 빠뜨리지 않을 5건 명시 |

§3과 각 HARN task의 코드·package·workflow 경로는 앞으로 구현할 변경 범위다. 이번 반영에서 해당 실행 파일을 생성·수정하거나 hook·Git 설정을 바꾸지 않았다.
