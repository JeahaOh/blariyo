# M0 구현 goal 중단 보고

> **00:36 KST 정정 — 이 중단 판단은 철회됐다.** 사용자는 서로 다른 문제의 cycle을 별도로 계산하도록 명시했다. 아래 문서는 00:31 당시의 실패 관측과 잘못된 합산 판단을 보존한 과거 기록이다. 검증 단위 전체 한도 소진·추가 승인 필요·continuation 금지 문구는 현행 지시가 아니다. [실행 기록](README.md)과 [문제별 시도 기록](RETRY-LEDGER.md)에 따라 기존 goal을 진행한다.

- 시각: 2026-09-27 00:31 KST. 담당: Codex. 상태: 인계/미완료.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치/HEAD: `feature/m0-design-completion` / `71ed8efe0d1cfb8ea22ed16f6464043c4aa1d81b` 유지.
- 근거: [실행 기록](README.md), [구현 task §8](../../2026-09-26/m0-implementation-plan/IMPLEMENTATION-TASKS.md#8-로컬-구현-goal-완료-조건), [사용자 실행 제어 검토](../m0-implementation-plan/README.md).

## 1. 현재 실패

```sh
PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH npm run lint -w @blariyo/api
```

- 기대: lint error0. 실제: exit1, **61 error/0 warning**.
- `apps/api/test/admin-permissions.service.test.ts:5,14`: 테스트 Promise를 기다리지 않은 오류2개.
- `apps/api/test/batch-review.integration.test.ts:30`: 새 SQL fixture callback의 unsafe return1개.
- 같은 파일의 계약 응답 접근: 생성 타입을 해석하지 못한 unsafe assignment/member access58개.
- 추가 수정하지 않았다. D01의 사전 고정 검증 단위에서 수정 cycle3/3을 사용한 뒤 필수 검사가 실패했으므로 사용자 Hard Stop에 해당한다. 파일·명령·원인을 바꿔 예산을 초기화하지 않았다.

## 2. 시도와 결과

| D01 cycle | 확인 원인 | 수정 | 같은 검증의 결과 |
| --- | --- | --- | --- |
| 1 | fixture `$1` uuid/text 추론 충돌, 정리 callback 순서 | UUID cast 명시, connection 해제 후 DataSource 종료 | DB retention5 PASS |
| 2 | DTO 최상위 보존 필드와 계약의 `retention` 객체 불일치 | 정본 계약대로 DTO 중첩 | 기존 batch review15 PASS |
| 3 | QueryRunner.query에 미지원 generic 사용 | 기존 `rows()` 결과 검증 사용 | test build exit0, 확장 DB retention6 PASS |
| 이후 검사 | API lint61개 오류 | **수정하지 않음** | 실패 상태로 중단 |

각 확인 원인의 수정은1회씩이다. 무진전 반복으로 중단한 것이 아니라 검증 단위의 수정 예산 소진 후 필수 검사 실패로 중단했다. 빌드 실패 직후 runner의 dist-test ENOENT는 같은 빌드 실패의 후속 결과이며 독립 수정 cycle로 세지 않았다.

단계별 통과 증거:

- Node24.18.0 API build·build:test, contracts:generate exit0.
- 인증 계약3, 권한 단위2, 실제 Core 역할1+HTTP 경계4 PASS.
- API 검수/승격17 PASS: 기존15개 및 만료 접근/멱등 재조회 차단, staging cleanup과 게시글 사본 보호2개.
- 마지막 retention DB 시험6 PASS: UTC/KST 경계, 최초 확정/재검수, 만료 commit rollback, 중복 키, purge gate/lease/실패 보존/DB 정리.
- Web `npm run typecheck -w @blariyo/web` exit0.
- Java25.0.2 `./gradlew compileJava --console=plain --no-daemon` exit0. JAVA_HOME는 `/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home`.
- API lint 실패. 전체 Collector·서비스 역할·브라우저·Docker·암호화 복원·전체 회귀는 미실행. 앞 단계 PASS를 이후 수정 전체의 최종 PASS로 승계하지 않는다.

DB 명령은 다음 runner로 무작위 DB를 생성·검사·정리했다. 운영 DB는 사용하지 않았다.

```sh
TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres \
  /Users/zeaha/.nvm/versions/node/v24.18.0/bin/node scripts/test-nest-integration.ts \
  apps/api/dist-test/batch-retention.integration.test.js
```

## 3. 확인된 원인과 추정

- 확인: 생성 `packages/contracts/src/collection-api.d.ts:2051,2106,2159,2203`에 TS2339가 있다. `CollectionFailure`의 `content['application/json']` 타입에는 `schema` 멤버가 없다.
- 확인: 정본 OpenAPI의410 응답4개는 `#/components/responses/CollectionFailure/content/application~1json/schema`를 참조한다. generator는 이를 존재하지 않는 TypeScript 멤버 접근으로 출력한다. 쓰기 없는 TypeScript 진단(`skipLibCheck:false,noEmit:true`)에서 이4개 오류를 직접 확인했다. 기존 build 설정은 선언 파일 내부 검사를 생략하므로 build 성공이 이 문제의 부재를 증명하지 않는다.
- 추정: 해당 참조를 정상적인 response/schema component 경계로 바꾸고 양쪽 사본을 맞춰 재생성하면 파생 타입 오류가 해소될 가능성이 높다. **수정·재검증하지 않았으므로 해결로 보고하지 않는다.**
- 확인: D04 테스트의 미대기 Promise2개와 D01 fixture unsafe return1개는 별도 원인이다. lint 비활성화·any 추가·검사 제외는 해결안이 아니다.

## 4. 남은 구현과 재개 조건

| 범위 | 현재 | 잔여 |
| --- | --- | --- |
| D04 / OPS-01·02·04 | registry/BFF/Core role 분리 및 일부 인증·HTTP 시험 | lint, 실제 BFF 위조/회수·브라우저, 전체 서비스 역할·실계정 인수 |
| D01 / COL-04 | API V009/Collector V007·V008, deadline/dedup·API 접근 차단·staging·제한 purge SQL 일부 | 실제 객체 삭제 worker/timer, role provisioning/전체 grant, queue/confirmation/부수 사본 TTL, late PUT/inventory/orphan/복원, 전체 경합·권한·canary 시험 |
| D02 / CON-02 | OpenAPI 실행 사본/타입 동기화와 목록 일괄 SQL | 생성 타입 오류, mailbox/runtime4개 route·batch pull/ack·BFF/UI, SQL 예외 목록·쿼리 수 시험 |
| D03 / OPS-03 | 미착수 | 선택 백업/Drive adapter·age·PostgreSQL 독립 복원·전환 인계 |
| UX-01~06, COL-01/02/03, OPS-05 | 이번 구현에서는 미착수 | 구현/합성 요청·브라우저·출처 S1~S5 인계·7일 관찰표 |
| CON-01 | 조건부 보류 유지 | legacy 재활성화 결정 전 임의 변경 없음 |

- 제품 정책·운영 계정·secret에 관한 새 판단은 필요하지 않다. 현재 기술 실패에 대해 외부 credential을 요청하지 않는다.
- **재개에는 사용자의 D01 추가 수정 한도 또는 검증 단위 재설정 지시가 필요하다.** 같은 goal continuation이나 새 파일명만으로 자동 초기화하지 않는다. 재개 후에는 실패한 lint/계약 타입부터 처리하고 전체 잔여 구현·검증을 이어간다.
- 이번 중단은 같은 차단이 확인된 첫 goal turn이다. goal 도구는 같은 차단이3개 연속 goal turn에서 확인돼야 `blocked`를 허용하므로 현재 도구 상태는 `active`로 남긴다. 이를 작업 계속 권한으로 해석하지 않는다. 재호출 시 새 구현/수정 없이 상태 요건만 재확인하며, 요건 충족 시 `blocked`로 변경한다.
- 실제 계정/장비/Drive/R2/Discord·운영7일은 기존 인계 대상이며 이번 로컬 PASS로 완료 처리하지 않는다.

## §8 완료 조건 감사

| 조건 | 판정 | 근거 |
| --- | --- | --- |
| 전체 지정 코드가 현행 정본 충족 | 미충족 | D01/D04 일부, 다른 주요 범위 미착수 |
| 문서/실행 계약/타입/DB/API/BFF 일치 | 미충족 | 사본 byte 일치/생성 성공과 별개로 생성 타입 오류·D02 route 미구현 |
| D01~D04 전체 로컬 분기 | 미충족 | 일부 DB/HTTP만 확인 |
| 필수 lint/type/unit/DB/Collector/browser/Docker | 미충족 | lint 실패, 전체 회귀/브라우저/Docker 등 미실행 |
| 실제 운영 인수와 조건부 항목 인계 | 부분 | 기존 조건 유지, 최종 인수 도구/관찰표 미완성 |
| 상태·기록·증거/hash·복귀 | 부분 | 중단 현황·hash 기록, 전체 구현 종료 문서는 미완성 |
| 범위/비밀/운영 자원 보호·임시 자원 정리 | 확인 | branch/HEAD 유지, Git 반영/외부 호출 없음, task DB/container/volume 정리 |

판정: **goal 미완료, 실행 Hard Stop. 배포 가능한 후보가 아니다.** 미커밋 변경은 보존했다. 실제 환경에 새 migration을 적용하지 않았으며 기존 migration 파일은 변경하지 않았다. 중단 기준 파일 hash는 [FILES.sha256](FILES.sha256), 재시작 시 이 기준과 새 변경의 담당을 다시 확인한다. 삭제된 원문을 복구하는 rollback이나 기존 변경을 지우는 reset을 제안하지 않는다.
