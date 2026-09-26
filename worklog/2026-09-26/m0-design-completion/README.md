# M0 기존 설계 보완 실행 기록

- 담당: Codex / M0-D01~D06 문서 설계·검증.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치: `feature/m0-design-completion`, 기준 HEAD `bb19c486f3cafa847bd34828a699382c6d5bd0b6`.
- 상태: 종료 — M0-D01~D06 설계·문서 검증·구현 인계 완료. 최초 기록: 2026-09-26 23:19:13 KST.
- 요청·완료 조건: [DESIGN-TASKS](../m0-completion-plan/DESIGN-TASKS.md)와 [실행 요청](../m0-completion-plan/DESIGN-GOAL-PROMPT.md).
- 기존 변경: m0-completion-plan의 README 수정 및 DESIGN-TASKS/DESIGN-GOAL-PROMPT 신규 3개를 보존한다. 과거 기록은 수정하지 않는다.
- 작업 폴더 확인: 이전 M0 목록·Git hook 작업은 종료 기록. 도중 release 이동으로 쓰기를 중단했으며 23:17:50의 task feature 전환을 확인한 뒤 재개. 이번 세션의 Git 변경은 없다.
- 쓰기 범위: 관련 docs/system-design, development-specs/OpenAPI, planning, legal 미발행 추가안, implementation-tasks, status/roadmap, operations/owner-setup-checklist와 이 실행 폴더의 문서만.
- 제외: source·migration·실행 설정, DB/object 쓰기·삭제, 새 출처 요청·재분석, 계정 접근·비밀값·업로드·메시지 전송, stage·commit·push·merge·배포.

## 시작 전 완료 기준

| 작업 | 산출물 | 완료를 입증할 검사 |
| --- | --- | --- |
| D01 | 시각/상태/최소 키/삭제 소유권·경쟁/부수 사본/복원 계약·migration 명세 | 경계·재검수·동시 승격·부분 삭제·복원 시나리오의 기대값 및 정본/명세 일치 |
| D02 | 두 전달안 중 선택, 요청/응답/오류/권한/재시도/실제 설정 조회·화면 | DB·API·OpenAPI·화면 매핑, 기존 검증기로 계약 형식 검사 |
| D03 | 계정별 Drive 인증·업로드/만료·복원·Discord·전환/복귀 | 공식 근거 확인일, 보존 충돌 해결, 실패별 인수 시나리오 |
| D04 | 사용자/친구/서비스 행동별 허용·거부·통제 위치 | 직접 API/스토리지/백업 접근 거부와 회수 시험 명세 |
| D05 | 출처 편입 기준·21개 증거표·후속 대상 | 시점·환경·SHA/한계, 저장 성공과 운영 검증 분리 |
| D06 | 결정→정본→개발 명세→UX/COL/OPS/CON→검증 인계 | 정책·필드·상태·권한·저장소·기간, 링크/anchor, diff 공백 및 변경 범위 검사 |

필수 계약이 미정이거나 정책 충돌이 남으면 완료가 아니다. 설계 완료와 source/운영 완료는 구분한다. 실연동 입력은 담당·확인 시점을 명시한다. 동일 문제는 최초 포함 2회, 연속 무진전 2회이면 종료하며 범위를 늘려 재시도하지 않는다.

## 시도와 진전

1. 착수 대조: 목표·6개 완료 조건·스킬·현행 보존/백업/역할 계약과 Git 기준 확인. 쓰기 전 feature 기준 복구 확인. 문서 수정·실행 증거는 아직 없음.

## 결과

D01~D06 설계 보완·문서 검증·구현 인계 완료. source·migration·운영 적용은 이번 goal 범위 밖이며 아래 후속 task로 남긴다.


2. 계약 작성: D01 시각·최소 키·삭제 경쟁·부수 사본/선택 백업, D02 mailbox pull·runtime 조회, D03 계정별 Drive·복원·전환, D04 role·허용/거부, D05 gate·21개 증거표를 기존 정본/명세에 반영. 새 source·migration 작성 없음.
3. 교차 검토: 오래된 복원 기한으로 R2 raw가 더 남는 경로를 찾아 복원 시 item 없는 collect 객체 즉시 orphan 회수로 보완. D01 migration과 선택 백업의 순서를 additive 설치→backfill→선택 백업 검증→삭제로 정렬. API 중복 키 alias와 정규화 버전 불일치·현재 실패 상태 보존을 보완.
4. 첫 OpenAPI 검사 명령의 출력 구문 오류 1회, 수정한 2회째 YAML parse·openapi-typescript 메모리 생성 통과. BatchRetention 필드 편집도 첫 메모리 parse에서 들여쓰기 오류를 발견했고 파일에 쓰지 않았으며 수정한 2회째 parse 후 저장 성공. 동일 문제의 3번째 시도 없음. 이는 제품 테스트 실패/통과가 아니라 문서 도구 실행 기록이다.
5. 병행 작업 관측: `worklog/2026-09-26/batch-structure-research/README.md` 신규 파일을 확인했다. 해당 담당이 쓰기 범위를 그 파일 하나로 제한하고 23:29 종료한 기록을 확인했으며 이번 세션에서 수정하지 않았다. branch/HEAD·기존 M0 문서3개 보존 검사를 별도로 수행한다.

## 결과·근거·후속 검증

| 작업 | 작성한 계약·근거 | 문서 검사 | 후속 구현/운영 |
| --- | --- | --- | --- |
| D01 | [데이터 모델](../../../docs/system-design/02-data-model.md#m0-d01-retention): 최초 검수·7일/28일·영구 hash 키·기한 경쟁·부수 사본·제한 회수/복원 | 정책·시각·소유권·백업 제외·retention DTO 대조 | COL-04의 D01-T1~T7, OPS-03 복원. 실제 migration/삭제 미실행 |
| D02 | [전달 선택](../../../docs/system-design/01-system-architecture.md#m0-d02-delivery)·[API](../../../docs/system-design/03-api-design.md#m0-d02-api)·수집 spec/OpenAPI: DB mailbox pull 채택,4개 route·조회 화면 | 상태/필드/멱등·함수/권한/실제 설정 표시와 OpenAPI 검사 | CON-02/P1-01의 D02-T1~T6. packages/contracts 실행 사본 동기화도 후속 |
| D03 | [Drive](../../../docs/system-design/05-security-operations.md#m0-d03-drive): 계정별 auth·file ID·업로드/만료·독립 복원·Discord·R2 전환/복귀 | Google 공식 사양과 확인일·삭제 기한·정상 backup 유지/대체 순서 대조 | OPS-03의 D03-T1~T6. 계정 로그인/업로드/실수신 미실행 |
| D04 | [권한](../../../docs/system-design/05-security-operations.md#m0-d04-roles)·관리자 spec: OWNER/EDITOR·machine별 행동/거부 | 현행 identity/AdminGuard와 목표 role 구분, 직접API 거부·회수 범위 대조 | OPS-01/02/04의 D04-T1~T6. role code/ACL·실제 두 계정 미검증 |
| D05 | [편입 gate](../../../docs/planning/content-collection/source-collection-policy.md#m0-admission)·[21개 표](../../../docs/planning/content-collection/reference-site-validation.md#m0-evidence-20260926) | 9/23 로컬104건/17출처·4실패, 환경·SHA 미확인 및 운영이전 증거 한계 확인 | COL-01/02/03/04·OPS-04, S1~S5. 편입 확정 증거0이며 실제 가동 목록 미조회. 새 사이트 요청 없음 |
| D06 | [구현 인계](../../../docs/implementation-tasks/README.md#m0-design-handoff)·status/roadmap/readiness/requirements·legal 추가안·운영 준비 | 정본 모순·링크/anchor·OpenAPI·공백/범위/기존 변경 보존 | UX 독립 병행, COL→CON/OPS 연결. I30/P9/U1·법무 발행/운영 차단 유지 |

## 문서 검증 근거

- [링크 결과](LINK-CHECK.json): 변경 Markdown 전체의 상대 링크·anchor와 기존 두 roadmap anchor alias 검사. 파일 존재/절 연결의 증거이며 내용 정확성을 대신하지 않는다.
- [OpenAPI 결과](OPENAPI-CHECK.json): 저장소 `scripts/generate-contracts.ts`와 같은 yaml/openapi-typescript 의존성으로 Node24.18.0에서 parse·내부 ref·operation/parameter·메모리 타입 생성을 검사. source 쓰기 금지이므로 `npm run contracts:generate` 자체는 실행하지 않았다. runtime 사본과 문서의 planned 차이는 CON-02 인계 사항이며 제품 build 통과가 아니다.
- 법무 변경은 개인정보처리방침 direct 미발행 추가안과 legal README만. 본문 v0.1·DB 정책·실제 검토/발행을 변경하지 않았다.
- 외부 사양 확인은 Google 공식 문서 GET만. 계정/비밀값/Drive/Discord 조작·수집 사이트 요청은 없음.

## 남은 실연동 입력

[운영 준비 목록](../../../docs/operations/owner-setup-checklist.md#m0-design-inputs)에 사용자 담당·확인 시점을 명시했다. 장비/OS/가동 시간, Drive 계정 종류·용량/권한·연결값, 별도 age 복구키 보관 확인, 두 operator 매핑, Discord 연결/수신, 비운영 시험 영역과 고지 검토다. 정책/기술 선택을 다시 미정으로 돌리지 않는다.


6. 추적성 검사에서 D03/D04 시나리오 번호의 `T2` 단축 표기를 발견했다. 최초 검사 실패 뒤 full ID(D03-T2/D04-T2 등)로 정정한 두 번째 검사에서 7+6+6+6개 시나리오와21개 출처 행을 확인했다. 개인정보처리방침은 direct 미발행 추가안 밖의 앞/뒤 본문이 HEAD와 byte 단위로 동일하다.

## 공통 완료 조건 판정

- [x] D01~D05 필수 기술 선택·모델·API·상태·권한·실패 처리·검증 기준을 정본·개발 명세에 작성했다. 정책 충돌을 보존 예외로 덮지 않았다.
- [x] 기존 UX·COL·OPS·CON ID를 유지하고 migration/호환·되돌리기·구현 순서와25개 후속 시험 시나리오 및 S1~S5를 연결했다.
- [x] 7일/28일/영구 최소 키, content 사본 분리, R2/Drive, 사용자/친구·서비스 역할, 출처 후보/편입 구분을 대조했다.
- [x] 로컬 링크·anchor, OpenAPI 형식·참조/상태/필드, 공백과 변경 범위를 검사했다. 실행 source 사본 동기화는 명시적으로 구현 task에 인계했다.
- [x] 실연동 입력의 담당·시점·계정별 적용 조건을 남겼다. 장비/OS·계정 종류/용량·연결값 미확인을 필수 기술 선택 미정과 구분했다.
- [x] 설계 완료·신규 구현 미실행·운영 미검증을 구분했다. M0 구현 집계·출시 차단·과거 source/운영 증거는 상향하지 않았다.

## 최종 변경 범위와 검사

- 관련 docs25개 및 이 폴더의 실행/검증 기록4개를 작성·수정했다. [전체 변경·보존 검사](SCOPE-CHECK.json)를 따른다.
- 기존 m0-completion-plan 문서3개 SHA-256 동일, 기준1315개 파일 중 범위 밖 수정·삭제0, staged0. 다른 세션의 batch-structure-research 기록은 종료·경로 분리 확인 후 보존했다.
- `git diff --check` 및 신규 기록 공백·코드 fence 검사, 법무 추가안 경계·상태/정책 수동 대조를 완료했다. 최종 수치는 아래 검증 결과를 따른다.
- 제품 테스트/build·DB/object/운영 계정 접근·수집/Drive/Discord 실행·stage/commit/push/merge/배포는 수행하지 않았다.

최종 문서 검사 수치: 상대 링크757개·anchor296개, 누락0. OpenAPI29 operations(기존25+신규4), 내부 ref309, planned expiry4개, YAML/메모리 타입 생성 통과. 관련 docs25개·작업 기록4개, 범위 밖 기존 파일 변경0.

- 최종 갱신: 2026-09-26 23:40:31 KST.

## 후속 — 완료 기록 갱신과 문서 커밋 준비

- 요청: 여기까지 작업 문서를 갱신·커밋하고 구현 task list와 구현 명령 프롬프트를 작성한다.
- 담당: Codex / 같은 작업 폴더, `feature/m0-design-completion@bb19c486`.
- 상태: 인계 — 문서 갱신·검증 완료, 같은 담당이 문서 커밋 후 구현 지시 문서 작성. 갱신: 2026-09-26 23:53 KST.
- 범위: 설계 정본25개, 기존 M0 계획3개, 이 폴더5개를 첫 문서 커밋 대상으로 지정한다. 기존 23:40 문서 검사 기록은 당시 결과로 보존하고 이번 검사를 별도 기록한다.
- 기록 갱신: 기존 계획·설계 요청문에 최신 완료 결과를 연결했다. 과거 작업 표·체크박스·실행 당시 권한을 소급 변경하지 않았다.
- 후속 확인: [개발 착수와 완료 범위](DEVELOPMENT-READINESS.md). 설계는 완료, 잔여 구현과 실환경 준비·운영 인수는 별도다.
- 다른 담당: `batch-structure-research/README.md`의 23:49 종료·자기 파일만 수정 범위를 확인했다. 해당 기록은 이 세션의 수정·stage·commit 대상에서 제외한다.
- Git 확인: feature와 release 기준 HEAD 일치, 시작 index 비어 있음. 설치된 Git hook 검사 통과. push·merge·배포는 요청 범위가 아니다.
- 다음 산출물: 기존 UX/COL/OPS/CON 17개를 연결한 구현 task list와 goal 요청문. 작성만으로 구현 goal을 시작하지 않는다.
- 이번 검증: 커밋 대상33개 중 Markdown29개 상대 링크847개·anchor314개 누락0. 문서 OpenAPI29 operations·기존 실행25개 보존·신규 planned4개·내부 ref309개와 메모리 타입 생성 통과. 실행 계약 사본 동기화는 구현 시 수행한다.

## 후속 — 설계 문서 커밋과 구현 실행 문서

- 담당: Codex / 같은 작업 폴더·브랜치. 상태: 종료 — 설계 문서 커밋·구현 실행 문서 작성 및 검증. 갱신: 2026-09-26 23:57 KST.
- 설계 완료 문서33개를 `5ab6dc198b9616bfd270dab2c49c2ec2bde165a7` (`docs: complete M0 design contracts and handoff`)로 커밋했다. stage 경로와 commit 경로를 대조했으며 source·다른 담당 기록은 포함하지 않았다.
- 기존 계획 파일의 대기 표시는 작성 당시 기록임을 명확히 하고 최신 완료 결과를 연결했다.
- 다음 실행 문서는 [구현 준비 기록](../m0-implementation-plan/README.md), [task list](../m0-implementation-plan/IMPLEMENTATION-TASKS.md), [goal 요청문](../m0-implementation-plan/IMPLEMENTATION-GOAL-PROMPT.md)이다. 기존17개 ID를 유지하고 로컬 구현과 실제 운영 인수의 완료 조건을 구분한다.
- 실제 구현 goal·제품 시험·외부 연동·push·merge·배포는 이번 문서 요청에서 실행하지 않는다. 후속 문서 검증·커밋 결과는 구현 준비 기록을 따른다.
