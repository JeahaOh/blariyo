# M0 구현 task list

- 작성일: 2026-09-26 KST. 설계 기준: `5ab6dc1` 및 착수 시점의 현행 정본.
- 목적: 기존 M0 구현에 설계 보완 D01~D06을 적용하고 잔여 Core UX·수집 통제·운영 도구를 검증 가능한 단위로 마감한다.
- 실행 요청문: [IMPLEMENTATION-GOAL-PROMPT.md](IMPLEMENTATION-GOAL-PROMPT.md).
- 기존 [17개 task](../../../docs/implementation-tasks/README.md)의 ID를 유지한다. 아래 순서는 실행 묶음이며 새 task 수를 추가하지 않는다.
- 작성 시 실행 상태는 **대기**다. 기존 구현이 없다는 뜻이 아니며, 착수 시 현재 코드·테스트를 대조해 이미 충족한 부분을 재작성하지 않는다.

## 1. 범위와 완료 판정

| 범위 | 이번 구현 프롬프트를 실행하면 수행할 일 | 완료 판정 |
| --- | --- | --- |
| 로컬 구현 | 앱·Collector·추가 migration·실행 계약·운영 도구의 잔여 구현, task 소유 격리 DB/object·합성 외부 응답·브라우저 검증 | 아래 로컬 완료 조건과 변경 범위별 검사 충족 |
| 실제 출처·계정·장비·운영 | 구체적 시험 절차·필요 입력·되돌리기·실행 증거 양식 준비 | 별도 실연동 권한·입력 후 수행. 미실행을 통과로 표시하지 않음 |
| 조건부 legacy | CON-01의 재활성화 조건과 기존 차이 유지, direct 변경으로 기존 비활성 경계가 깨지지 않는지 확인 | 재활성화 결정 없으면 조건부 보류. 전체 구현 완료에 합산하지 않음 |
| 실제 7일 관찰 | OPS-05의 관찰표·수집할 지표·담당 인계 | 실제 운영 7일이 지나 증거가 모인 뒤에만 OPS-05 완료 |

**로컬 구현 goal 완료와 기존 17개 task 전체 완료는 다르다.** 각 task에는 `코드 / 로컬 검증 / 실제 인수`를 따로 기록한다. 실환경 입력 대기만으로 독립 로컬 구현을 멈추지 않되, 필수 로컬 시험의 누락·실패가 남으면 로컬 goal도 완료하지 않는다.

## 2. 착수 전 확인

- [AGENTS.md](../../../AGENTS.md)·[AI 작업 안내](../../../docs/ai/README.md)·[Git workflow](../../../docs/ai/git-workflow.md)를 읽고 작업 담당·브랜치·기존 변경·기준 release SHA를 확인한다. 보호 브랜치나 다른 담당 작업 중 임의 전환하지 않는다.
- 현재 [상태](../../../docs/status.md)·[로드맵](../../../docs/roadmap.md)·[요구사항](../../../docs/development-specs/requirements-status.md)과 관련 source·migration·test를 대조한다.
- [D06 인계표](../../../docs/implementation-tasks/README.md#m0-design-handoff), [수집 명세](../../../docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md#m0-design-completion), [관리자 명세](../../../docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md#m0-d04-역할-인계--2026-09-26)를 개발 입력으로 사용한다.
- Node `24.18.0`, Java `25`, PostgreSQL `18` 및 실제 사용하는 Docker/브라우저·포트·테스트 DB 소유권을 확인한다. 과거 컨테이너 ID나 포트를 자동 재사용하지 않는다.
- 기존 API V008·Collector V006 등 적용된 migration/checksum을 보존한다. 다음 번호는 실제 파일/격리 ledger를 대조해 배정하며 운영 DB를 암묵 조회하지 않는다.
- 현재 문서 OpenAPI의 신규4개 operation과 retention 응답은 실행 사본에 아직 없다. 이 차이를 기존 build 성공으로 덮거나 생성기 검사를 끄지 않는다. CON-02 구현에서 사본·타입·실제 동작을 함께 맞춘다.

## 3. 실행 순서

| 순서 | 기존 task | 실행 내용·의존성 |
| --- | --- | --- |
| 0 | 공통 | 실제 잔여·변경 경로·완료 증거·격리 환경을 기록하고 코드 기준선을 확보 |
| 1 | COL-04, OPS-01/02/04의 D04 | 추가 저장 모델·최소 dedup·제한 함수·기한 검사 기반, OWNER/EDITOR 전달·서버 검사. 파괴적 회수는 기본 비활성 |
| 2 | OPS-03, COL-04 | 선택 backup·복원 도구를 구현하고 합성 자료로 검증한 뒤 회수 worker·부분 실패/복원 시험. 실제 R2 사본 대체 전 운영 삭제 활성화 금지 |
| 3 | CON-02, COL-01/02 | mailbox·runtime 조회·4개 endpoint·UI·실행 계약 생성, robots/budget/redirect 공통 통제. API 원문 fetch 금지 |
| 병행 | UX-01~06 | 독립 화면 개선. 실제 브라우저로 확인하며 수집 계정·장비 준비 전체를 기다리지 않음 |
| 4 | COL-03, OPS-01~04 | 로컬 회귀·합성 장애 시험, 실환경 인수용 실행 도구·관측값·입력·되돌리기 준비. 실제 출처/계정 시험은 별도 |
| 5 | 전체, OPS-05 | 변경 코드의 통합 검증·정본 상태 갱신·운영 인계·관찰표 작성. 실제 운영 관찰을 생성 데이터로 대체하지 않음 |

1~3은 코드 의존성 순서다. 로컬 task 소유 합성 자원의 삭제/복원 시험은 구현 검증에 포함한다. 실제 기존 자료의 삭제/백업 전환은 [운영 인계 순서](../../../docs/implementation-tasks/README.md#m0-design-handoff)를 그대로 지킨다.

## 4. 기존 17개 task 대응표

표의 로컬 범위는 다음 실행의 작업 항목이며 지금 구현·검증됐다는 표시가 아니다.

| ID | 로컬 구현·검증 범위 | task 전체 완료에 추가로 필요한 증거 |
| --- | --- | --- |
| UX-01 | 정책 버전 변경 뒤 본문 상단·키보드 초점·긴 본문/좁은 화면 | 실제 브라우저 스크롤·초점 확인 |
| UX-02 | 공개 상세 SSR OG/Twitter 이미지 alt·크기·이미지 없음 경계 | 렌더링된 HTML 속성 대조 |
| UX-03 | 목록 페이지 변경 뒤 결과 제목 초점·보조기기 안내 | 키보드 탐색·접근성 트리 확인 |
| UX-04 | 하단 추가 조회 오류 재시도·중복 방지, 공유 성공/취소/미지원 | 각 상태 브라우저 재현·안내 확인 |
| UX-05 | 동의 storage/cookie 삭제 예외·안내·재시도, 추적 비활성 유지 | 예외 주입 후 화면·추적 상태 확인. GA4 활성화 제외 |
| UX-06 | 청록 `#00A19B` 기준으로 앱·정적 검토물 정렬 | 관련 토큰 참조·대표 해상도 화면 비교 |
| COL-01 | 단건/목록/queue 공통 robots·Crawl-delay·영속 일일 budget | 합성 서버 요청 수·간격·날짜 경계·재시작 누적 한도. 실제 출처 허용 확인은 COL-03 |
| COL-02 | 최대3회 redirect, 순환·다른 source·안전 host/DNS 검사 | 0/3/4 경계, 4번째 redirect를 따라간 목적지 요청0 |
| COL-03 | 기존 fixture 회귀·본문 순서/미디어·since/skip·실패 분류, S1~S5 receipt/readback 준비 | 승인된 실제 출처 표본·장비·원격 DB/object·운영 인수. fixture만으로 편입 금지 |
| COL-04 | D01 lifecycle/dedup/manifest·시각·제한 권한·worker·API 만료 차단·사본 보호·복원 | D01-T1~T7 로컬 전부, 실제 제한 삭제·DB/object readback 및 백업/고지 gate |
| OPS-01 | D04 게시물/이미지/검수 권한·격리 업무 시나리오 및 자동 회귀 | 운영자가 직접 수행한 10~20건의 성공/혼동/복구 기록 |
| OPS-02 | OWNER/EDITOR guard·위조/회수 거부·안전 상태 조회 절차 | 실제 Access/MFA 두 계정·현재 SHA/digest/ledger/flag/timer·허용 콘텐츠 인수 |
| OPS-03 | D03 선택 dump/age/manifest·Drive adapter·재개/만료/실패 알림·독립 복원, 예약/outbox/복귀 회귀 | 실제 Drive/R2·독립 다운로드·격리 복원·Discord 수신·배포 직전18시간 이내 복구 증거·운영 복귀 |
| OPS-04 | mailbox/queue 중단·재시작·만료, 서비스 역할 거부, 합성 Discord 취소/만료/중복 흐름 | 선택 장비·사설 DB/R2 경로·실제 Discord Gateway와 비운영 원격 권한 인수 |
| OPS-05 | 실제 관찰에 사용할 항목·시각·담당·장애/복구 증거 양식 준비 | 실제 Core 운영7일 관찰. 코드/문서/시각 전진 시험으로 완료 금지 |
| CON-01 | legacy 비활성 경계·상한 차이(1000/40)와 조건부 인계 유지 | 재활성화 결정 후 별도 상한·DTO·MIME·auth/readiness 정합화·저장 시험 |
| CON-02 | 원래 SQL 예외/검수 N+1 검증에 D02 mailbox·runtime·4개 API/BFF/UI·migration·계약 동기화 포함 | D02-T1~T6·D04-T3/T5, 1건/다건 쿼리 수·권한·API 외부 요청0·화면·실장비 인수 |

상세 범위는 [UX](../../../docs/implementation-tasks/core-ux.md), [COL](../../../docs/implementation-tasks/collection-controls.md), [OPS](../../../docs/implementation-tasks/operations-acceptance.md), [CON](../../../docs/implementation-tasks/contracts-maintenance.md)을 따른다.

## 5. 설계 보완의 필수 구현·검증

### COL-04 — 보존·회수

- [D01 정본](../../../docs/system-design/02-data-model.md#m0-d01-retention)에 맞춰 최초 수집/검수 시각, 7일/28일 만료, 영구 최소 hash 키와 API 게시글 최소 연결을 구현한다. 재검수는 기한을 연장하지 않는다.
- worker는 수집 PC의 가동 여부에 의존하지 않는 서버 실행형으로 작성하되 설치·활성화는 이번 로컬 실행 범위 밖이다. 일반 runtime DELETE 확대·불변 trigger 해제 없이 제한 함수/역할을 사용한다.
- dry-run manifest, lease/heartbeat·늦은 writer 방지, 부분 실패/재시도·완료 readback, report/queue/receipt/correction·API 임시 staging까지 회수한다. 삭제된 원문 재생성·영구 키 삭제로 복구하지 않는다.
- **D01-T1~T7 모두**: 경계 시각, 27일 첫 검수·재검수, 승격/삭제 경합, 부분 삭제/늦은 PUT, 권한 거부, 모든 부수 사본 canary, 백업 복원 후 원문0·중복 판정·게시글 사본 유지.

### CON-02 — direct 입력·실행 설정 조회

- [D02 모델](../../../docs/system-design/02-data-model.md#m0-d02-input-model)·[API](../../../docs/system-design/03-api-design.md#m0-d02-api)·[전달 선택](../../../docs/system-design/01-system-architecture.md#m0-d02-delivery)을 따른다. API mailbox를 batch가 제한 함수로 pull/ack하며 API가 queue/item에 일반 쓰기하거나 원문을 fetch하지 않는다.
- create/get/retry/runtime-sources, 멱등 key alias·요청 digest/원문 식별 hash 구분,24시간 요청 만료, version·lease, CURRENT/STALE/ABSENT/CONFLICT, Java/API normalizer golden fixture를 구현한다.
- `/admin/batch`의 URL 요청·진행/실패/중복/만료·재시도와 안전한 runtime 설정 조회를 구현한다. 출처 편집 UI·legacy 활성화·추가 권한 관리 화면은 만들지 않는다.
- 문서 OpenAPI와 `packages/contracts/openapi`·생성 타입을 일치시키고 controller/guard/응답 검사를 연결한다. planned 표시는 실제 구현·검증 근거가 생긴 범위만 갱신한다.
- **D02-T1~T6 및 D04-T3/T5**, API 외부 요청0·중복 queue0·runtime 버전 표시·브라우저·쿼리 수 회귀를 확인한다.

### OPS-03 — 선택 백업·Drive 코드

- [D03](../../../docs/system-design/05-security-operations.md#m0-d03-drive)의 인증 적용 조건·파일 ID·중단 재개·다운로드 hash·manifest·만료·복원·전환/복귀를 구현한다. 계정 실값은 만들지 않는다.
- direct 임시 테이블 데이터 제외, content·영구 dedup 복구, 복원 후 orphan/만료 회수·자동 재수집 금지를 실제 격리 PostgreSQL로 검증한다. 대역만으로 DB 복원을 통과시키지 않는다.
- 03:30/15:30 KST, dump→age→SHA-256 manifest, snapshot+7일을 유지한다. 선택 백업 검증→기존 full snapshot 대체→회수 활성화 순서를 실행 도구의 검사 조건으로 반영한다.
- **D03-T1~T6** 중 인증/Drive/Discord의 로컬 분기는 합성 adapter로 재현하고 실제 계정 인수 항목을 따로 남긴다. 실제 Drive 검증 전 정상 R2 백업을 중단하지 않는다. 새 백업 실패를 이유로 만료 사본을 무기한 보존하지 않는다.

### OPS-01/02/04 — 역할·운영 경계

- [D04](../../../docs/system-design/05-security-operations.md#m0-d04-roles)를 기존 operator 파일·BFF·Core guard에 적용한다. 외부 role header 제거, 검증된 내부 role 전달, operation 허용 목록, 누락/위조/회수 거부를 시험한다.
- 사용자 OWNER만 서버·DB 관리·백업/복구, 친구 EDITOR는 게시물·이미지·검수 업무와 안전한 설정 읽기다. credential 공유나 누락 role의 암묵 OWNER 처리는 금지한다.
- **D04-T1~T6** 로컬 역할·직접 API·서비스 DB/object 거부 시험을 수행한다. 실제 두 계정 Access와 cloud ACL 인수는 후속이다.

### COL-03 — 출처 증거

- [S1~S5](../../../docs/planning/content-collection/source-collection-policy.md#m0-admission)와 [21개 증거표](../../../docs/planning/content-collection/reference-site-validation.md#m0-evidence-20260926)를 유지한다. 17개 과거 로컬 성공은 현재 운영 통과가 아니다.
- 새 사이트 요청 없이 기존 fixture·합성 HTTP·DB/object 재조회 도구와 증거 양식을 준비한다. 실제 편입은 권한이 있는 후속 시험에서 결정한다.
- COL-REANALYZE-01의 fmkorea·ppomppu·youtube-community는 대기, PGR21을 추가하지 않는다. CAPTCHA·로그인·보안 차단을 우회하지 않는다.

## 6. 변경 영역과 검사 명령

| 변경 영역 | 예상 경로 | 필요한 증거 |
| --- | --- | --- |
| Web/UI | `apps/web/app`, `apps/web/server`, 관련 정적 검토물·브라우저 tests | 타입/lint·build·실제 화면/키보드·오류 재현 |
| API/계약 | `apps/api/src`, `apps/api/test`, `packages/contracts`, 문서 OpenAPI | 생성 사본 일치·서비스/실DB·권한·쿼리 수 |
| 모델/Collector | `apps/api/migrations`, `apps/collector/src/main/resources/db`, Java source/test | 기존 checksum·신규 설치/기존 자료 backfill·동시성·역할·object readback |
| 백업/운영 도구 | `deploy/backup`, 관련 `deploy/operations`·역할 설정·test | 선택 dump·실제 암호화/격리 복원·합성 전송/실패·dry-run·기본 비활성 |
| 인계 | 관련 docs와 실제 작업일 worklog | task별 코드/검증/인수 상태·운영 입력·되돌리기 |

다음은 2026-09-26 package.json과 [테스트 안내](../../../docs/testing/README.md)에서 확인한 명령이다. 실행 전 대상·runner를 읽고 변경 영역에 맞춰 선택한다. 운영 DB 주소·실제 credential을 넣지 않는다.

```sh
# 공통: Node 24.18.0, 필요한 경우 JAVA_HOME=Java 25를 확인한 저장소 루트
npm run hooks:check
npm run contracts:generate
npm test
npm run build

# API·Web 변경에 맞는 정적/단위 검사
npm run typecheck -w @blariyo/api
npm run typecheck:test -w @blariyo/api
npm run lint -w @blariyo/api
npm run test:unit -w @blariyo/api
npm run typecheck:web
npm run lint -w @blariyo/web

# 소유권이 확인된 loopback PostgreSQL 18·합성 object·브라우저 환경에서만
npm run test:nest
npm run test:database-roles
npm run test:collector
npm run test:browser
npm run test:docker

git diff --check
```

- 위 명령이 모든 새 D01~D04 케이스를 이미 포함한다는 뜻은 아니다. 해당 test를 구현하고 runner가 실제 실행·집계하는지 확인한다.
- scripts/tests 변경 시 해당 `typecheck:scripts`/`lint:scripts`, `typecheck:tests`/`lint:tests`도 수행한다. Java 빌드는 `apps/collector/gradlew -p apps/collector test bootJar fixtureClasspath`를 사용하며 DB fixture 입력·skip 여부를 확인한다.
- 테스트가 만드는 임시 자원만 정리한다. 다른 작업의 DB·컨테이너·포트를 강제 종료하거나 `verify:migration`의 과거 고정 환경을 일반 완료 기준으로 사용하지 않는다.
- 하나의 새 기능 때문에 매번 전체 검사를 반복하지 않는다. 관련 검사 후 통합 시 한 번 필요한 범위를 넓히고, 이후 변경·실패·미해결 우려가 있을 때만 재실행한다.
- source commit이 없다면 검증 기준은 HEAD+작업 파일 hash다. 커밋·push·CI·운영 결과를 로컬 검사로 대신하지 않는다.

## 7. 실제 인수 전 입력과 제외 범위

[운영자 입력 목록](../../../docs/operations/owner-setup-checklist.md#m0-design-inputs)의 담당·시점을 적용한다.

| 입력 | 필요한 시점 |
| --- | --- |
| 실제 수집 장비/OS·가동/재시작·서버 사설 DB 경로 | OPS-04 실장비 시험 전 |
| Drive 계정 종류·용량·인증·전용 폴더/권한, 복구키 별도 보관 | OPS-03 실전송·기존 backup 대체·독립 복원 전 |
| 두 운영자 identity/role, Discord credential·채널 | 실제 권한·알림 수신 시험 전 |
| 비운영 DB/R2/Drive 시험 영역·회수 대상 | 외부 쓰기·삭제 인수 전 |
| direct 고지·Drive 계약/국외이전 검토 | 해당 수집 활성화·백업 전환 전 |

실환경 값은 채팅·Git에 기록하지 않는다. 장비나 VM 동거·VPN에 관한 별도 상담을 확정 정책으로 승계하지 않으며 현행 정본과 새 사용자 지시가 충돌하면 해당 배포 구성만 멈추고 판단을 받는다. 로컬 구현을 서버 증설·새 공급자 선택으로 확대하지 않는다.

M1/익게·광고·GA4 활성화, legacy 재활성화, 세 출처 재분석, 운영 정책 발행·배포·서버 설치·외부 전송·운영 자료 삭제는 기본 구현 프롬프트의 실행 범위 밖이다. 사용자 후속 요청이 대상과 범위를 명시하면 그 권한으로 별도 실제 인수를 수행한다.

## 8. 로컬 구현 goal 완료 조건

- [ ] UX-01~06, COL-01/02/04, CON-02 및 OPS-01~04에 연결된 D03/D04 코드가 현재 정본을 충족한다. 기존 구현은 검증 근거로 재사용하며 미완료를 과거 PASS로 닫지 않는다.
- [ ] 문서·실행 OpenAPI·생성 타입·DB/API/BFF 계약과 신규 migration/기존 checksum이 일치한다.
- [ ] D01-T1~T7·D02-T1~T6·D03-T1~T6·D04-T1~T6의 로컬 검증 가능한 모든 분기를 구현·실행했다. 실제 DB·암호화 복원·역할·브라우저가 필요한 부분을 대역으로 대체하지 않는다.
- [ ] 변경에 필요한 타입/lint·단위·실DB·Collector·브라우저·Docker 검사가 통과했다. 미실행·skip·환경 차단을 통과로 계산하지 않는다.
- [ ] COL-03 실제 S1~S5, OPS 실제 계정/장비/수신/복원·7일 관찰, CON-01 조건부 항목은 실행 입력·증거·담당·재개 조건으로 인계했다. 해당 task 전체 상태를 완료로 올리지 않는다.
- [ ] 상태/로드맵/요구사항·운영 도구 안내와 작업 기록에 코드·로컬 검증·실제 인수의 차이, 명령·환경·결과·기준 SHA/hash·되돌리기를 남겼다.
- [ ] 범위 밖 변경·비밀 노출·운영 자원 조작이 없고 task 소유 시험 자원만 정리했다.

필수 로컬 검사 실패·미실행 또는 미완성 코드가 있으면 이 goal은 완료가 아니다. 전체17개 task 완료는 각 정본의 실제 인수 조건까지 충족했을 때 별도 판정한다.
