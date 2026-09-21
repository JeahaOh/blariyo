# M0 구현 검증 기록

현재 main의 Nest/TypeORM 전환 결과는 [진행 기록](../../migration/PROGRESS.md)과
[종합 검증 보고](../../migration/REPORT.md)를 따른다. 아래 feature 브랜치 및 main 구조 정리 표는
전환 전 실행 이력이며 당시 mjs 경로·통과 수·JAR hash를 현재 최종 검증에 재사용하지 않는다.
현재 명령은 `npm run verify:migration`이며 필수 환경과 자원 식별자는 전환 보고에 있다.

- 검증일: 2026-09-09 (Asia/Seoul)
- 브랜치: `feature/m0-core`, 시작 HEAD `a273f3c`
- 커밋·push: 수행하지 않음. 기존 README/DB/migration/constraints 변경 보존.
- 실제 출처·Discord·운영 배포·7일 관찰: 미검증

## 실행 증거

| 검증 | 결과 | 재현 코드 / 산출물 |
| --- | --- | --- |
| Core·legacy·V2 PostgreSQL/HTTP | 50 통과, 실패 0, skip 0 | `scripts/test-integration.mjs`, `tests/collection-v2.test.mjs`; `/private/tmp/blariyo-v2-integration.log` |
| Chromium | 9 통과, 실패 0, skip 0 | `tests/browser/`; `/private/tmp/blariyo-m0-browser.log` |
| 운영 이벤트 UI | 조회·확인 처리·재호출 안정성, 390px 가로 넘침 없음 | `tests/browser/collector-events.test.mjs`, `test-results/m0-browser/collector-events-mobile.png` 및 desktop PNG 시각 확인 |
| Docker | api/web 실제 build·Core/Web/DB·게시/숨김·작업·dump 격리 restore 통과 | `scripts/test-docker.mjs`; `/private/tmp/blariyo-m0-docker.log` |
| Spring build·보안 | JDK 25 / Wrapper 9.7.1 / Boot 4.1.1, 단위·TLS·관측·설정 보안 15개 통과 (실패/skip 0) | `apps/collector/build/reports/tests/test/index.html`; `/private/tmp/blariyo-spring-final-build.log` |
| SBOM | CycloneDX 1.6, component 130개·dependency 131개 생성 | `apps/collector/build/reports/cyclonedx/application.cdx.json` |
| Spring 실제 프로세스 E2E | 전용 PostgreSQL, migration 2회, 6 Batch Step, BFF/Core preview, 브라우저 검수→초안→수동 발행 | `tests/spring/runtime.test.mjs`; `/private/tmp/blariyo-spring-runtime.log`; 최종 재실행 통과 |
| Spring 제어 | Quartz 1 fire/1 후보, synthetic Discord dedup, 알림 4회 후 단건 Core event, TTL/orphan·14일 metadata/30일 요약, metrics, stop, 100-submit 동일 Job, CLI 복원 reconcile·gate 통과 | `tests/spring/control.test.mjs`; `/private/tmp/blariyo-spring-control.log` |
| Step 경계·백업 회전 | 6 Step 직전/직후 12번 SIGKILL/restart, 외부 요청 중복 0; 실제 암호화 dump 8개 생성 뒤 최근 7개만 보존 | `tests/spring/step-boundaries.test.mjs`; `/private/tmp/blariyo-spring-step.log` |
| 다중 이미지·redirect | 첫 preview commit 응답 유실 후 재시작·손상 이미지 부분 실패·NEW 누락 이미지 refresh·기존 preview 유지, redirect 3회 제한·종류별 quota | `tests/spring/preview.test.mjs`; `/private/tmp/blariyo-spring-preview.log` |
| 권위 상태·SIGTERM | owner 변경·반려·관리자 초안 승격 후 STOPPED/재개 불가·추가 network 없음; active fetch 중 SIGTERM 90초 내 종료 | `tests/spring/fencing.test.mjs`; `/private/tmp/blariyo-spring-fencing.log` |
| launchd 렌더러 | 1개 테스트 통과: 파일 권한·secret/링크 거부·umask·90초 종료·03:15 backup 템플릿 | `apps/collector/ops/test-render-launchd.py` |

## 장애·보안 검증 내용

- Core claim/heartbeat/reservation/result/preview commit 직후 응답을 끊고 Spring을 SIGKILL한다. 같은 작업을 재시작해 Core attempt_count=1과 완료를 확인한다.
- 7일 result receipt와 local run을 만료시키고 spool 파일도 제거한 상태에서 Core result digest로 조정한다. 결과 재전송 없이 COMPLETED_WITH_WARNINGS/RESULT_DIGEST_RECONCILED로 닫는다.
- 외부 요청이 시작된 뒤 강제 종료한 작업은 재요청하지 않고 RECONCILE_REQUIRED로 남으며 network attempt는 1건이다.
- 실제 pg_dump를 plaintext 파일 없이 AES-256-GCM 암호화하고 빈 별도 DB에 복원한다. nonempty restore는 거부하고 restore gate는 닫힌 상태를 유지한다.
- 별도 운영 CLI로 복원 차단 상태의 resume 거부, Core RUNNING의 조정 보류, Core 종료 상태의 STOPPED 전환, 미해결 작업 존재 시 gate 해제 거부를 확인했다. CLI가 외부 요청을 추가하지 않는 것도 확인했다.
- 실제 TLS 서버로 원래 hostname 인증, redirect 자동 추적 없음, DNS public→private 재연결 차단, 응답 크기·encoding·전체 20초 제한을 검증했다. 실제 외부 출처 허용을 뜻하지 않는다.
- Core strict CHECK는 legacy RUNNING·preview 잔여가 있으면 거부하며 임의 backfill을 하지 않는다. 정상 drain 뒤 ADD/VALIDATE 재실행과 strict 상태의 claim/preview가 통과했다.
- 후보 보존 만료 시 quota·event는 candidate_id=NULL로 보존된다. 7일 receipt, 30일 quota/event, 14일 local metadata, daily summary 재집계 방지를 시험했다.

## 재현 명령

Node 24.18.0, JDK 25, Docker, 테스트 전용 PostgreSQL을 준비한다. TEST_DATABASE_ADMIN_URL은 격리 테스트 DB를 생성·삭제할 수 있는 로컬 계정이어야 한다. 실제 운영 URL을 넣지 않는다.

```sh
npm run test:integration
npm run test:browser
npm run test:docker
apps/collector/gradlew -p apps/collector test bootJar fixtureClasspath cyclonedxBom
node --test tests/spring/runtime.test.mjs
node --test tests/spring/control.test.mjs
node --test tests/spring/preview.test.mjs
node --test tests/spring/fencing.test.mjs
node --test tests/spring/step-boundaries.test.mjs
python3 apps/collector/ops/test-render-launchd.py
```

Spring 시험은 JAVA_HOME과 TEST_DATABASE_ADMIN_URL을 사용한다. secret fixture는 0600 임시 파일에 생성하고 종료 시 제거한다. 임시 로그는 장기 보관 산출물이 아니며 위 테스트 코드와 이 기록을 함께 확인한다.

## 추가 수정과 검증

- redirect마다 출처 요청 간격을 기다린 뒤 새 quota를 예약한다. 최대 3회 redirect 초과는 FETCH_FAILED로 기록되며 요청 종류별 예약 수를 실제 DB에서 대조했다.
- Core가 손상 이미지의 media type·크기를 거부하면 해당 preview만 경고로 남긴다. 인증·소유권·버전 오류는 이미지 오류로 숨기지 않는다.
- 소유권 상실·lease 종료는 재개 불가 STOPPED, 버전 불일치는 RECONCILE_REQUIRED로 분리했다. 작업 완료·outbox 기록과 실행 시간은 같은 local transaction 결과를 사용한다.
- Core 503에서 local status는 200/partial을 유지하며 마지막 성공 시각·지표를 제공한다. JSON 로그의 exception/stack 필드 0, 원문 URL·secret 비노출을 시험했다.
- 운영 CLI도 공개 읽기 권한 설정 파일·평문 token/password/key를 거부한다. migration/backup과 같은 설정 검사 경계를 사용한다.

## 남은 조건

- 실제 운영 계정: Keychain 잠금/해제 상태의 기동·재시작, 설치된 launchd와 절전 복귀, 실제 daily backup 성공·실패 관측. fixture는 해당 계정의 동작을 보장하지 않는다.
- 외부: 승인 출처/robots/selector/quota/User-Agent 연락처, Discord App·guild/channel/사용자/역할, 실행 PC·운영자 계정·설치 경로, Core R2/Access/CDN/cron/알림/원격 backup·전체 restore·법무 실값.
- 운영 전환: Python drain→strict 전환→REST/Discord/Quartz 실제 시험→실제 7일 관찰→legacy 자격 폐기·go-live 승인. 자동 또는 fixture 시간 이동으로 완료하지 않는다.

따라서 1~7 전체 완료는 아직 아니다. 상세 판정은 [완료 조건](acceptance.md), 설치·복구 명령은 [운영 안내](../../../apps/collector/ops/README.md)를 따른다.


## 빌드 산출물과 최종 점검

- JAR: `apps/collector/build/libs/blariyo-collector-0.1.0.jar`
- SHA-256: `249daab8634380d10ab97e19fb897f12c42196f1b4197779d486f88e08c8afa5`
- production JAR 내 fixture/test class: 0개
- Core/Web Docker build context에서 `apps/collector` 제외. 최종 api/web build·통합·격리 restore 재실행 통과.
- OpenAPI 두 정본 사본 동일, 관련 문서 상대 링크·신규 텍스트 공백·`git diff --check` 통과.
- 실제 운영 입력과 일별 관찰은 [운영 전환·7일 관찰 기록](operations-observation.md)에 남긴다. 현재 미시작이다.

## main 내부 구조 정리 (2026-09-09)

설계 기준은 [M0 코드 구조](../../system-design/08-code-structure.md)다. `main`의 미커밋 작업으로 수행하며
기존 M0 구현·운영 미검증 조건을 보존한다. 아래 결과는 위 feature 브랜치의 과거 검증과 별도로 실행한다.

- 아키텍처의 계층 도식을 기능별 모듈·SQL 소유권 기준으로 구체화하고 migration 실행 경로를 맞췄다.
- API를 HTTP·기능·DB·adapter·운영 작업·CLI로 나눴다. HTTP의 readiness·수집 운영 이벤트 SQL을
  DB/수집 기능으로 옮기고, CLI와 전환 처리 함수를 분리했다. 공통 JSON·outbox 기록·DB 잠금은
  하위 모듈로 분리해 기능과 worker 사이의 순환 참조를 없앴다.
- Collector를 책임별 패키지로 나누고 공통 요청 검증을 `run.RunCommandValidation`으로 옮겼다.
  `CollectorRunService`는 REST Controller를 참조하지 않는다. 운영 설정의 교차 패키지 접근 API만 공개했다.
- Java 테스트도 대상 패키지로 나눴으며 package-private 테스트 대상 메서드를 일괄 public으로 바꾸지 않았다.
  Gradle·launchd·운영 CLI 문서·통합 테스트의 클래스명과 import 경로를 동기화했다.
- API migration SQL 10개, Collector resource 2개, Web 파일 36개는 작업 전 snapshot과 바이트가 같다.
  Java 본문 비교에서 package/import/공백 외 변경은 요청 검증 이동과 OperatorSettings 접근 범위뿐이다.

| 검증 | 이번 main 결과 |
| --- | --- |
| 구조 검사 | 3개 통과: Core 의존 방향·순환, Collector 의존 방향·순환, Web 앱 경계 |
| Core 통합 | 53개 통과, 실패·skip 0. 구조 검사 3개 포함 |
| Chromium | 9개 통과, 실패·skip 0 |
| Nuxt build | 통과 |
| Spring 단위·보안 및 JAR | 15개 통과, 실패·skip 0. 운영 JAR에 fixture/test class 0개, ops CLI 3개 포함 |
| launchd 렌더러 | 1개 통과 |
| Spring 실제 프로세스 5개 시나리오 | runtime·control·preview·fencing·step-boundaries 모두 통과. 12개 단계 경계 SIGKILL/restart 및 암호화 백업 8개 생성·최근 7개 보존 포함 |
| Docker build·운영 명령·복원 | API/Web build, 인증·게시·숨김·운영 명령, custom dump·격리 restore/readback 통과 |
| 문서·범위 | 관련 상대 링크 존재, 변경 소스 79개 공백 검사, `git diff --check` 통과 |

재현: `npm run test:architecture`, 기존 Core/브라우저/Docker/Spring 재현 명령을 동일하게 사용한다.
이번 로그는 `/private/tmp/blariyo-structure-*.log`에 있으며 임시 증거다. 초기 경로 누락과 sandbox의
브라우저·Docker 실행 제한은 수정/허용 후 재실행하며, 위 표는 최종 실행 결과만 판정한다.
실제 출처·Discord·운영 계정·배포·7일 관찰은 여전히 미검증이다.


## 2026-09-20 원문 수집·별도 PC 실행 확장 검증

- 설계: [Spring 수집기 §16](../../system-design/07-spring-collector-design.md#16-원문-수집과-별도-pc-실행-확장).
  원문 순서·첨부 연결·SNS URL 참조, 다른 PC의 macOS/Windows/Docker Linux 실행 계약을 추가했다.
- Java: JDK 25에서 `test bootJar fixtureClasspath` 통과(11개 suite, 20개 test, 실패·skip 0).
  더쿠 본문 fixture·빈 본문·한도 초과·중복 이미지·CDN 경계·private file secret·ACL 판단을 포함한다.
- Nest/PostgreSQL: `collection-content`, 기존 `collection-http`, `collection-v2-http`, `collection-admin`,
  `migrations` 통합 시험 통과(하위 시험 포함 25개). V006 up/down/up과 제한된 application role readiness,
  원문 DB readback·본문 순서·TEXT/SNS-only·전체 첨부 승격·동일 요청 재전송·잘못된 참조 거부를 확인했다.
- Spring 실제 프로세스: `tests/spring/runtime.test.ts`, `control.test.ts` 통과. URL 접수부터 여섯 Step,
  브라우저 원문 검수·초안·격리 시험 발행, claim/heartbeat/reservation/result/preview/expired-result 응답 유실 후
  강제 종료·재시작, Quartz·알림 outbox·100개 요청 중복 제거·stop/restore 조정을 검증했다.
  외부 SNS·Discord 실전송과 실제 더쿠 network는 fixture로 대체했으므로 운영 실연동 증거가 아니다.
- Linux: `blariyo-collector:local-20260920` 이미지 빌드와 `tests/spring/container.test.ts` 통과.
  Linux arm64 컨테이너의 파일 secret·전용 PostgreSQL migration·실제 기동·host port 미공개·로그 비밀 미노출을 확인했다.
  Windows native·Windows Docker Desktop mount·실제 별도 PC 설치·자동 시작·절전 복귀는 미검증이다.
- Web/API build·typecheck, script/test typecheck, 변경 대상 ESLint, 수집/SNS 표시 관련 Node test 19개,
  관련 문서 7개 상대 파일 링크·`git diff --check` 통과. 최초 브라우저 실행은 macOS sandbox 제한으로 실패했고
  권한을 받아 재실행한 통합 시험이 통과했다.
- 개발 DB: 기존 `127.0.0.1:5439/blariyo_local`에 V006만 추가했다. 기존 게시글 25건·본문 186블록의
  적용 전후 SHA-256이 `a376d919b1bcb66676ffac57e6049489e800757b193d7c8c65a2d84c9e664158`로 같았다.
  시험용 DB/container는 종료 시 제거했다. 별도 서비스 DB·상시 preview 포트를 만들지 않았다.
- 미검증/미활성: Windows 실기 실행, 실제 출처별 운영 설정·robots·Discord 자격, 운영 배포와 수집 활성화,
  HOT 목록 신규 URL 자동 발견. 예약 실행은 기존에 접수된 후보 처리만 포함한다.
