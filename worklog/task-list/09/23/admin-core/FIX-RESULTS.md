# 관리자 복구·로컬 worker·CI 선행 작업 — 2026-09-23

요청: `docs/implementation/m0-interim-2026-09-23/remaining-process.md 진행해`.
이번 실행은 A~D의 로컬 구현·검증과 E 인수 준비다. commit·push·배포·운영 콘텐츠 공개는 수행하지 않았다.
기존 `remaining-process.md` 수정과 앞선 커밋 `8cda23e`를 보존했다.

## 판정

| 항목 | 결과 | 남은 경계 |
| --- | --- | --- |
| A 실패 기준선 | 완료 | GitHub #9/ce25abc 실패 원문 재확인 |
| A-1 CI 보완 | 로컬 검사 완료, 원격 미실행 | 승인된 commit/push의 verify·Chromium·API/Web images·digest 필요 |
| B 저장 복구 | 로컬 구현·회귀 완료 | 실제 운영 Access는 F에서 확인 |
| C 로컬 worker | 격리 실행·재시작·실패 재시도 확인 | 기존 개발 DB에는 worker 비활성, 운영 timer와 별개 |
| D 통합 재검증 | 로컬 완료: 전체 회귀 및 최종 영향 검사 통과 | 운영자 인수는 자동화 결과로 대체하지 않음 |
| E 수동 인수 | 환경 도구·[인수 양식](../../../../../docs/implementation/m0-interim-2026-09-23/operator-acceptance.md) 준비 | 실제 운영자 12건 수행·측정·확인 미실행 |
| F~I | 미실행 | 최종 release·승인 배포·실제 Access/알림/백업·수집 실연동·실제 7일 관찰 |

## 구현과 검증 범위

### CI와 Java fixture

- `.github/workflows/ci.yml`: SHA로 고정한 `actions/setup-java` v5, Temurin 25와 `npm run test:fixtures` 추가.
  관리자 검증의 PNG/JSON도 artifact 경로에 포함한다. 이미지 게시·서버 배포의 기존 경계는 유지한다.
- `scripts/prepare-collector-fixtures.mjs`: `JAVA_HOME`의 실제 Java 25 확인 후
  `apps/collector/gradlew -p apps/collector testClasses fixtureClasspath` 실행.
- `package.json`: `test:nest` 진입점이 fixture 준비를 먼저 수행한다. Java 21은 Gradle 실행 전 거부됨을 확인했다.
- [setup-java 공식 문서](https://github.com/actions/setup-java)와 `git ls-remote`로 사용법·v5 SHA를 확인했다.
  고정값: `b6effb05e454b25005698d916606bdc6ffcbf961`.
- 기존 discovery 테스트의 V008 down 성공→V007 down SQLSTATE 23514 거부→데이터 보존을 현재 checkout에서
  재실행했다. 이번 변경에 새 migration·OpenAPI·생성 계약 변경은 없다.

### 저장 복구

- `admin.vue`: 저장 성공 응답 여부를 요청 키와 함께 보존한다. 미확인 요청의 인증 실패는 이전 제출을
  취소한 증거로 취급하지 않는다. 본문·입력·key를 유지한 채 정상 인증 후 같은 요청을 재전송한다.
- 실제 저장 뒤 응답 유실/상세 503→401 또는 403 두 번→복구 경로에서 동일 key·body, DB 글 1건,
  초안 상태 이력 1건을 대조했다. 401은 실제 cookie 제거, 403은 Access/BFF 경계 모의 응답이다.
  실제 운영 Access 허용/거부 성공으로 확대하지 않는다.
- 최초 인증 실패는 입력을 다시 편집할 수 있다. 서버에 반영되지 않은 편집의 재시도가 버전 충돌로
  확정되면 입력을 보존하고 편집 잠금을 푼다. 성공 응답을 이미 받은 요청은 상세 확인까지 보존한다.

### 실제 로컬 실행기와 미디어·예약

- `start-development.mjs --sandbox=<directory> --workers`로 기존 CLI 두 개를 순차 주기 실행한다.
  기본 실행의 worker는 OFF. sandbox DB 이름·loopback 주소·port를 검사한다.
- DB advisory lock은 프로세스 사이에서도 단일 실행 소유자를 보장한다. 진행 명령이 끝난 뒤 다음
  timer를 등록하며 종료는 진행 명령을 기다린다. 원격 storage·webhook·수집 설정은 worker에 전달하지 않는다.
- 12건 반복 업무를 기존 `fixture.flush()` 대신 실제 실행기의 timer로 처리했다. 작성·검색·편집·이미지
  2개/alt/출처/순서·발행·숨김·회수·재공개, 본문/상태/이력 및 private/public bytes·hash를 대조했다.
  320/390/768/1280px 화면·focus·오류·권한·충돌 회귀도 수행했다.
- 별도 4건에서 실제 예약 시각 도달, 취소 후 발행 0, worker 서버 재시작 2회, 두 번째 worker 소유권 거부,
  private 파일 일시 부재 후 예약 복구와 public 삭제 실패 후 실제 2분 backoff 회수를 확인했다.
  DB 시각·시스템 시각을 변경하거나 테스트에서 worker를 직접 호출하지 않았다.
- 취소 글은 DRAFT, 예약 성공/복구 글은 각각 PUBLISHED 이력 1건, 숨김/재공개 글은 의도한 발행 이력 2건이다.
  private 원본은 남고 회수한 public 객체는 없어졌으며 재공개 사본과 원본 bytes가 일치했다.
- 로컬 알림 webhook은 구성하지 않아 예약 실패 알림이 DB에 미전달로 남는다. worker 재시도 로그를
  알림 수신 성공으로 표시하지 않는다. R2·CDN purge·운영 timer·실제 알림 검증은 F에 남는다.

## 실행 증거

로그 경로: Git 제외 `test-results/admin-core-followup/`. 이미지·업무 JSON은 `test-results/admin-core/`.
깨끗한 검증 디렉터리: `/private/tmp/blariyo-ci-clean-2b7l29nj`.
로컬 HEAD를 복제하고 이번 변경만 덮어썼으며 시작 전 node_modules/API dist/Collector build가 없음을 검사했다.
Node 24.18.0, Java 25.0.2, macOS arm64, loopback 55449 PostgreSQL 18.6의 무작위 전용 DB다.
깨끗한 source 빌드이지만 의존성 다운로드 캐시는 사용할 수 있다. Ubuntu 원격 실행을 대신하지 않는다.

| 검사/로그 | 결과 |
| --- | --- |
| `npm ci --no-audit --no-fund` / clean-install.log | 통과 |
| `npm run test:fixtures` / clean-fixtures.log | Gradle 7 tasks 모두 실행, 통과 |
| `npm run build`, API `build:test` / clean-build*.log | 통과 |
| scripts/tests typecheck·lint, Web typecheck, API lint·source/test typecheck | 통과. tests lint의 unsafe array destructuring 1건 수정 후 재검사 |
| `npm test` / clean-unit.log | 26/26 |
| `node --test apps/api/dist-test/*.service.test.js` / clean-api-unit.log | 29/29 |
| `node scripts/test-nest-integration.ts --exclude-schema-restore` / clean-integration.log | 93/93, discovery/migration 5건 포함 |
| `node scripts/test-nest-integration.ts apps/api/dist-test/schema-restore.integration.test.js` / clean-restore.log | 1/1, 별도 컨테이너의 schema/data/ledger 복원 일치 |
| `node --test --test-concurrency=1 tests/browser/*.test.ts` / clean-browser.log | 28/28, 마지막 복구 경계 보강 전 전체 결과 |
| 최종 복구 경계 보강 후 Web build/typecheck, tests typecheck/lint | 통과 |
| `admin-recovery`·`admin-workflow`·`core` / clean-browser-final-affected.log | 17/17. 전체 검사 뒤 변경한 복구 코드의 영향 범위 재검사, 복구 7건 포함 |
| 추가 이탈·중복 클릭 명시 검사 / recovery-final-guards.log | 복구 묶음 8/8. 미저장 글 선택/경로 이동/탭 닫기 취소, 실제 double click의 서버 제출 1회·DB 1건 확인 |
| 기본 개발 DB worker 금지·주기 단독 설정·임의 DB 인자·Java 21 / guards.json | 모두 의도한 비정상 종료 |

초기 `local-workers.test.ts`는 테스트 입력의 이미지 alt 누락으로 저장 요청이 발생하지 않아 timeout했다.
alt 입력을 추가한 뒤 해당 검사와 전체 Chromium을 통과했다. 최초 실패는 `workers.log`, 재실행은
`workers-rerun.log`에 보존한다. 단독 worker 재실행은 실제 130.966초, clean 전체 browser는 160.491초다.
이 수치는 자동화 실행 시간이며 운영자의 업무 처리 시간·생산성 인수가 아니다.

마지막 회귀 뒤 320/1280px 편집 화면 PNG를 직접 열어 잘림·겹침 없이 목록/편집·이미지·버튼이 보임을 확인했다.
390/768px는 Chromium의 요소 가시성·폭 넘침·focus 검사 증거이며 별도 사람의 기기 인수를 뜻하지 않는다.

## 수동 인수 준비와 자원 상태

`create-admin-sandbox.mjs`로 `.local-data/admin-sandbox-eecd0319a964`를 생성했다.
`start-development.mjs --sandbox=... --workers` 기본 60초 구성에서
`open-admin.mjs --sandbox=... --verify`의 UI/API 읽기 smoke를 통과했다(글 0건·쓰기 0·미인증 401).
서버는 정상 종료했으며 인수용 무작위 DB와 비공개 설정 디렉터리는 보존했다. 실제 운영자 인수는 미실행이다.

```sh
# Node 24.18.0, 55449 시험 PostgreSQL이 가동 중인 저장소 루트
node scripts/local/start-development.mjs --sandbox=.local-data/admin-sandbox-eecd0319a964 --workers
# 다른 터미널에서
node scripts/local/open-admin.mjs --sandbox=.local-data/admin-sandbox-eecd0319a964
```

인수용 DB 외에 관측된 소유권 불명확 `m0_browser_4837613d7f64` DB는 삭제하지 않았다.
이번 테스트 fixture는 자신이 생성한 이름만 정리하며 기존 PostgreSQL 컨테이너·volume은 유지한다.
근거: `sandbox-handoff.json`, `sandbox-admin-smoke.log`, `sandbox-runtime.log`, Git 제외
`.local-data/verification/admin-core-3000.json`. 인증 값은 기록·출력하지 않았다.

원격 commit/push 전 검토 단위는 다음과 같다. 실제 commit은 만들지 않았다.

1. CI: workflow·package 진입점·Java fixture 준비·검증 실행서.
2. 관리자 저장 복구: `admin.vue`·복구/이탈/중복 요청 브라우저 검사.
3. 로컬 실행·인수 도구: sandbox 생성·worker·시작/관리자 도구·실제 실행기 fixture/업무/worker 검사.
4. 진행·검증 문서: 현재 상태·새 결과·수동 인수 양식. 과거 결과는 보존.

## 원격과 Git

2026-09-23 20:53~20:54 KST Chrome에서 Actions 목록을 새로 읽고
[CI #9](https://github.com/JeahaOh/blariyo/actions/runs/35852208616) 및
[verify 로그](https://github.com/JeahaOh/blariyo/actions/runs/35852208616/job/107152288218#step:11:192)를 확인했다.
원격 대상은 `ce25abc8cad1331257479a6ab8c44260eb6bdb68`, verify 실패·images skipped다.
원문에는 `fixture-classpath.txt` ENOENT 및 `Missing expected rejection`이 있다. 실행 재요청은 하지 않았다.

현재 로컬 HEAD `8cda23e`는 원격보다 1개 앞서 있다. 이 작업에서 commit/push를 하지 않았으므로 새 SHA·
성공 run·이미지 digest는 아직 없다. 기존 커밋과 이번 수정의 기능별 diff를 검토한 뒤 별도 승인 범위로
commit/push해야 한다. 배포는 그 다음 별도 승인 단계다.

기존 RESULTS/FOLLOW-UP·중간 점검의 당시 실행 수치와 상태는 소급 수정하지 않았다.

최종 문서 검사: 상대 파일 링크 136개·깨진 링크 0, `git diff --check` 통과.
planning/legal과의 범위 충돌·근거 없는 완료 표현·법무 placeholder 임의 제거를 변경 diff와 대조했다.
기존 계획서 수정을 포함해 tracked 수정 13개·신규 8개다. source/test의 최종 SHA-256은 Git 제외
`test-results/admin-core-followup/source-hashes.json`에 기록하며 배포 release SHA로 사용하지 않는다.
검증 서버 3000/3100은 종료됐고, commit·push·배포는 미실행이다.
