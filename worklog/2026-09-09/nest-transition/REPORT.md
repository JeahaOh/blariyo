# Nest 전환 구현·검증 보고

**DONE_LOCAL — 2026-09-09 최종 Nest 코드의 필수 로컬 검증과 완료 감사를 마쳤다.** 현재 실행 결과는 [PROGRESS](PROGRESS.md),
요구사항과 기능 대응은 [TASK](TASK.md)·[PLAN](PLAN.md), 선택 근거는 [DECISIONS](../../../docs/system-design/nest-implementation-decisions.md)를 따른다.
판정 근거는 최종 종합 실행 `migration-ks4zg0`의 22개 단계 exit 0과 문서·계약·보존·자원 정리 감사다.
실제 운영 공개·외부 서비스 수용을 뜻하지 않는다.

## 구현 구조

- Core는 NestJS의 기본 Express adapter와 도메인별 Controller·Module을 사용한다.
  업무 처리는 Public, Posts, Images, Policies, Collection 및 Operations 서비스가 맡는다.
- 기능별 추상 Repository 토큰과 `persistence/`의 TypeORM 구현을 DI로 연결한다.
  Controller·Service에는 SQL·TypeORM·pg 연결을 전달하지 않는다. HTTP·업무·Entity 모델을 구분한다.
- TypeORM 0.3.31의 17개 Entity·224개 컬럼·15개 FK를 기존 PostgreSQL에 매핑한다.
  bigint는 내부 string, timestamp는 Date, bytea는 Buffer, JSON은 unknown 검사로 처리한다.
- DatabaseContext의 AsyncLocalStorage가 한 업무 범위의 QueryRunner를 공유한다.
  transaction 격리·row/advisory lock·receipt/quota/lease/fencing·outbox 원자성은 실제 PostgreSQL로 검사한다.
- `synchronize`, `dropSchema`, `migrationsRun`은 false다. 기존 V001–V005 SQL과
  ops.schema_migration ledger/checksum을 명시적 MigrationsService/Repository가 처리한다.
- 저장소·CDN은 Storage/EdgeCache Adapter 계약으로 주입한다. Collector는 Spring → BFF → Core 경계를 유지한다.
- 직접 작성한 Express 실행 구현은 제거했고 기본 dev/start/운영 CLI/Docker는 compiled Nest 경로를 사용한다.
  기존 Collector LEGACY_V1 계약은 SPRING_V2와 함께 유지하며 프레임워크 legacy와 구분한다.

## 개발·운영 실행

Node 24.18.0과 저장소 lockfile을 사용한다. 먼저 `npm ci`, `npm run build`를 실행한다.
개발 DB는 Compose의 loopback 55439이며 아래 검증용 55449와 다르다.

| 목적 | 명령 |
| --- | --- |
| API 개발 감시 | `npm run dev:api` — TypeScript polling compile 성공 후 compiled main 재시작 |
| API 빌드 실행 | `npm run start -w @blariyo/api` |
| Web 개발 / 빌드 | `npm run dev:web` / `npm run build -w @blariyo/web` |
| 기존 SQL 적용 | `npm run db:migrate` |
| 예약 발행·실패 알림 | `npm run posts:publish-due` |
| outbox / 정리 | `npm run outbox:run` / `npm run cleanup:run` |
| 정책 발행 | `npm run policies:publish -- --artifact=/absolute/path/policy.json` |
| 수집 전환 상태 / 적용 | `npm run collection:transition -- check` / `npm run collection:transition -- apply` |

운영 명령은 listener 없는 Nest application context를 사용하고 종료 시 연결을 해제한다.
production은 HTTPS origin·법무 설정·시행 정책·R2/CDN 설정을 요구하고 local 저장소/인증을 거부한다.
정책 artifact는 production에서 root 소유·0600이어야 한다. 실제 값이나 token을 문서·로그에 넣지 않는다.

## 전환 전용 검증 환경

이 환경은 이번 main 미커밋 작업을 검증하는 전용 자원이다. 다른 컨테이너를 대체하지 않는다.

| 자원 | 식별자와 보존 조건 |
| --- | --- |
| PostgreSQL | `blariyo-nest-migration-pg`, ID `df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe`, loopback 55449 |
| PG volume | `5d483ffa7c7203d49395622d01d409afed4ebcdf7dd08cb5a537d5bfd62ab7a1`; `nest_schema_baseline` 보존 |
| Chromium 서버 | `blariyo-nest-playwright-20260909`, ID `8de8b7dee5c7526c74c6f4c0b0d7c138d979f2834356f3ade82a654b72384079`, loopback 55450 |
| Playwright mount | 현재 저장소의 node_modules/playwright와 playwright-core를 readonly로 연결; 이미지/패키지 버전 일치 필요 |

ID·volume·port가 위와 일치하는지 `docker inspect`와 `docker port`로 먼저 확인한다.
불일치하면 사용자 자원을 초기화하지 않는다. 일치하며 stopped인 전용 자원만 다음처럼 시작한다.

```sh
docker start blariyo-nest-migration-pg blariyo-nest-playwright-20260909
export PATH=/Users/zeaha/.nvm/versions/node/v24.18.0/bin:$PATH
export JAVA_HOME=/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home
export npm_config_cache=/private/tmp/blariyo-nest-migration/npm-cache
npm run verify:migration
```

종합 실행기는 정확한 Node 버전·main·컨테이너 ID/포트·진행 중 DB 연결 부재를 확인하고,
외부 자격 정보를 전달하지 않는 환경에서 테스트를 실행한다. macOS에서는 실행 수명에 묶인 caffeinate로
idle sleep을 막는다. 필터·skip 인자를 받지 않으며 실패한 단계와 로그를 남기고 nonzero로 종료한다.

## 검증 결과를 읽는 방법

`test-results/migration-*/results.json`은 종합 실행별 단계 결과이며 각 단계의 원문 로그를 연결한다.
최종 종합 실행은 **22개 단계 모두 exit 0**이다. 단위/통합/브라우저/Spring의 fail·skip·cancelled는 0이다.
진행 과정의 개별 통과와 실패 이력은 PROGRESS에 별도로 보존했다.

- strict/lint: Core·Web·공유 계약 런타임·테스트·운영 코드, 강화 옵션과 타입 회피·구조 경계 검사.
- 단위·아키텍처·계약: Repository 대역 단위와 실제 소스 import/순환 구조, SQL·OpenAPI·생성 타입 해시.
- Nest 통합: 실제 독립 PostgreSQL 연결의 transaction·잠금·동시성, 모든 M0 API·운영 CLI·개발 감시.
- schema/복원: baseline과 빈 설치/재기동 전후 전체 schema dump, 별도 PostgreSQL 복원 후
  모든 application row·sequence·migration ledger/checksum, 공개 목록·정책·readiness API 대조.
- 실제 Nuxt/Chromium: 공개·관리자·수집 검수·동의·실패 UI·반응형 흐름.
- Spring: 실제 JVM·Batch·Quartz·독립 DB, 응답 유실·SIGKILL 재시작·권위 상태/fencing·중복·복원/운영 CLI.
- Docker: 미커밋 작업 트리 image build와 Core/Web production 설정, 합성 Access/JWKS·정책 CLI,
  발행/숨김·운영 명령·dump/readback·maintenance·SIGTERM 후 DB 연결 해제.

Docker 외부 HTTP 대역은 internal network에 있으며 ingress proxy만 별도 전용 bridge와 loopback port를 사용한다.
테스트용 preload/fixture는 readonly mount로 제공하고 runtime image에는 포함하지 않는다.
정상 SIGTERM은 0 또는 signal 종료 143으로 확인하며 timeout SIGKILL(137)·OOM과 구분한다.

## 계약·사용자 변경 보존

[contract-baseline.json](../../../docs/migration/contract-baseline.json)은 전환 착수 사본의 SQL/OpenAPI/생성 계약 해시를 복사한 것이다.
현재 Nest 동작에서 새 기준을 만든 것이 아니다. `tests/migration-contracts.test.ts`와 실제 schema 복원이 이를 검사한다.
최초 작업 파일은 `/private/tmp/blariyo-nest-migration/baseline.tar.gz`, 삭제 직전·중단 시점 사본과 로그도
같은 임시 경로에 보존한다. 장기 백업을 대신하지 않는다.

main의 사용자 index·HEAD를 유지하며 commit·push·staging·브랜치 전환·배포를 수행하지 않는다.
정본 기술 명칭과 실행 경로는 현재 Nest 구조에 맞추되 worklog·과거 중단/실패·handoff 이력은 소급 수정하지 않는다.

## 외부 운영 미검증과 실행 자원 보존

TASK의 필수 로컬 작업은 남아 있지 않다. 최종 검증 뒤 코드·설정·테스트 314개의 해시와 HEAD/index를 대조했다.
임시 Spring/Docker 컨테이너·네트워크·image와 테스트 DB를 정리했고, 점검 연결 외 DB client는 0개였다.
기존 전용 PG는 exit 0, Chromium은 SIGTERM exit 143으로 종료하고 ID·volume·readonly mount를 보존했다.
이번 실행에서 만든 유휴 Gradle 9.7.1 데몬 하나는 공식 종료 명령으로 종료했다. 다른 기존 자원은 유지했다.

실제 출처 수집·live Discord·운영 R2/CDN/Access·법무 실값·승인 정책·운영 cron·Keychain/launchd·
원격 백업 보관·배포·7일 관찰은 별도의 외부 운영 미검증 항목이다. 로컬 합성 검증으로 완료 처리하지 않는다.

## 최종 종합 실행의 요구사항 대응

실행 디렉터리: `test-results/migration-ks4zg0/`. 아래 번호는 TASK [10]의 필수 검증과 대응한다.
종합 실행 세션 94630은 exit 0이며, 요구사항별 최종 감사와 전용 자원 종료까지 완료했다.

| TASK 번호 | 실행 증거 | 현재 결과 |
| --- | --- | --- |
| 1 strict | 03–09 로그: Core·테스트·dev/build·Web·운영·공유 runtime | PASS |
| 2 lint·구조 | 10–16 로그: type-aware lint·실제 import graph·순환·ORM 경계 | PASS |
| 3 단위 | root 14, API service 8, 새로 실행한 Spring JUnit 15 | PASS; fail/skip 0 |
| 4 PostgreSQL·동시성 | 17 로그: 실제 독립 연결·transaction·lock·quota·lease·fencing·outbox | PASS |
| 5 설치·기존 DB·이력 | 17 로그: migrations 및 기존 데이터·ledger/checksum | PASS |
| 6 schema·API 계약 | 15/17 로그: 원래 계약 해시 16개, 전체 schema dump·Entity/FK | PASS |
| 7 M0 API·CLI | 17 로그: [PLAN](PLAN.md)의 39 operation과 운영 묶음, 전체 72 tests | PASS; fail/skip 0 |
| 8 build·compiled 서버 | 01/02/17 로그: 실제 compiled Nest·CLI·개발 감시 | PASS |
| 9 Nuxt·브라우저 | 18 로그: 실제 Chromium 9 tests; 모바일·데스크톱 screenshot 8개 시각 확인 | PASS; fail/skip 0 |
| 10 Spring 실프로세스 | 20 로그: 5 tests, 운영·fencing·preview·6개 응답 유실·12개 Step 경계·암호화 백업 | PASS; fail/skip 0 |
| 11 Docker production | 21 로그: 최종 작업 트리 image·운영·maintenance·SIGTERM·DB 연결 해제 | PASS |
| 12 백업·격리 복원 | 17 로그: 독립 PostgreSQL의 전체 schema·28개 table/sequence 상태·복원 API | PASS |
| 13 legacy 잔존 | 구조 검사·기본 실행 경로·중복 파일 재귀 검사·22 diff-check·HEAD/index | PASS |

브라우저 screenshot은 `test-results/m0-browser/`에 있다. 실제 외부 연동, 대용량 부하 시험과
production 배포의 증거로 확대하지 않는다. 종합 실행 중과 이후 코드·설정·테스트는 변경하지 않았고 결과 문서만 갱신했다.

## 2026-09-23 이후 기능 계약의 검증 경계

Nest 전환 당시 `contract-baseline.json`은 과거 증거로 보존한다. 전환 뒤 승인된 direct batch
조회·검수·초안 API와 본문/이미지 확장은 `contract-evolution.json`에 원래 해시와 새 해시,
정본·변경 사유를 따로 기록한다. `migration-contracts.test.ts`는 기존 SQL 원본의 불변성,
새 migration 전체 목록과 해시, 명시적으로 변경한 계약 해시, 정본/패키지 사본 일치를 모두 검사한다.
과거 migration SQL을 현재 구현에 맞춰 재생성하거나 기준선 해시를 덮어쓰지 않는다.
