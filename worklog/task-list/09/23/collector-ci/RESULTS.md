# Collector CI 보강 결과 — 2026-09-23

## 판정

- **구현 완료:** Ubuntu Collector job, 전체 Java·fixture·격리 DB 검사, JAR·SBOM 보관, API/Web 이미지 게시 선행 조건.
- **로컬 검증 완료:** macOS 273건, Linux Docker 273건 각각 통과. 원격 GitHub 실행 증거와 구분한다.
- **미실행:** 새 변경의 원격 GitHub Actions, Windows, 실제 운영 Compose·별도 PC·외부 서비스 연동.
- P1-07과 M0 전체는 부분 완료다. commit·push·배포·Collector 이미지 게시를 수행하지 않았다.

## 변경 범위

| 파일 | 변경 |
| --- | --- |
| [CI workflow](../../../../../.github/workflows/ci.yml) | `verify`와 별도인 Ubuntu 24.04 `collector` job. PostgreSQL 18 서비스, Node 24.18.0·Java 25, `test:collector`, `bootJar fixtureClasspath` |
| [검증 runner](../../../../../scripts/test-collector-readback.mjs) | CI의 `TEST_DATABASE_ADMIN_URL` 지원, Java 25 확인, 임시 DB 생성·정리, 결과 집계 |
| [검증 공통 함수](../../../../../scripts/collector-test-support.ts) | 관리 DB 주소 제한, JUnit 누락·실패·건너뜀·DB readback suite 부재 거부 |
| [보호 조건 테스트](../../../../../tests/collector-verification.test.ts) | 원격/지속 DB·query override 거부, JUnit 실패·건너뜀·결과 누락 검사 |
| [package.json](../../../../../package.json) | `npm run test:collector` 진입점 |

- `images`는 `verify`·`collector` 두 job 성공 후에만 실행한다. 게시 대상은 기존 API/Web이다.
- Collector 검사 결과와 JAR·SBOM(소프트웨어 구성 목록)은 GitHub artifact로 7일 보관한다.
  이 artifact는 Collector 운영 설치·배포 증거가 아니다.
- 기존 Java fixture 준비와 Core/관리자 검사 변경을 보존했다. Collector job에는 운영 비밀을 추가하지 않았다.

## DB와 실패 처리

- 연결 대상은 `127.0.0.1`/`localhost`, 포트 5439/55449, DB 이름 `postgres`로 제한한다.
- 생략 시 기존 `postgresql://blariyo_local@127.0.0.1:5439/postgres`를 사용한다.
- 대상 안에서 생성한 `blariyo_collector_test_<임의값>` DB만 검사·제거한다. 기존 DB 이름은 테스트 대상으로 받지 않는다.
- query parameter·fragment·원격 host·다른 DB/포트, Java 25 미지정은 연결 전에 거부한다.
- Gradle 전체 검사를 강제 재실행하고 JUnit의 실패·오류·건너뜀 0, DB readback suite 존재를 확인한다.
- 새 실행은 기존 집계를 `RUNNING`으로 바꾸며 성공·실패·정리 실패를 `summary.json`에 기록한다.
  연결 문자열과 DB driver 오류 원문은 출력하지 않는다.

## 실행 검증

| 검사 | 결과 |
| --- | --- |
| 보호 조건 단위 검사 | 2/2 통과 |
| 실제 프로세스 입력 거부 | 지속 DB·원격 DB·query override·Java 미지정 4건 모두 DB 연결 전 거부 |
| macOS 전체 Java·격리 DB | 273/273 통과, suite 77개, 실패·오류·건너뜀 0. readback 이름의 suite에 포함된 테스트 15건 |
| macOS 정리 확인 | 55449 관리 DB에서 남은 해당 임시 DB 0개 확인 |
| Linux Docker 전체 Java·격리 DB | 273/273 통과, suite 77개, 실패·오류·건너뜀 0. 새 Gradle 준비 뒤 전체 task 4분 20초 |
| Linux 산출물·정리 | JAR·fixture classpath 생성, 사이트 adapter 21개·과거 중첩 class 잔존 0, SBOM 구성 항목 130개 확인. 임시 DB 0·컨테이너 2개·검증 이미지 정리 |
| TypeScript·ESLint | scripts/tests 모두 통과 |
| workflow | YAML 파싱, DB 서비스/포트·명령·artifact·이미지 선행 조건 확인. 원격 실행 증거 아님 |
| 문서·변경 경계 | 상대 링크 309개 정상, `git diff --check` 통과, 이번 단계의 API/migration/법무 변경 없음 |

macOS: Node 24.18.0·OpenJDK 25.0.2, 새 CI 관리 DB 주소를 사용했다.
Linux: Docker Desktop의 `linux/arm64` Ubuntu Noble 컨테이너, Node 24.18.0·Temurin 25.0.4.
기존 `node_modules`·Gradle cache·build 결과 없이 source를 복사해 새로 설치·컴파일했다.
PostgreSQL은 외부 포트를 열지 않은 임시 컨테이너에서 55449로 실행했고 검사 컨테이너가 그 network namespace를 사용했다.
이 결과는 GitHub Ubuntu `amd64` 실행이나 실제 운영 이미지의 비특권 계정·mount·기동 검증을 대신하지 않는다.

핵심 재현 명령:

```sh
# Node 24.18.0, JAVA_HOME=Java 25, 해당 로컬 PostgreSQL이 준비된 환경
TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres npm run test:collector
apps/collector/gradlew -p apps/collector bootJar fixtureClasspath
node --test tests/collector-verification.test.ts
npm run typecheck:scripts
npm run lint:scripts
npm run typecheck:tests
npm run lint:tests
```

Git 시작·종료 상태는 `main...origin/main [ahead 1]`이며 기존 관리자·사이트 모듈 변경을 보존했다.
Git 제외 증거 폴더: `test-results/collector-ci-local/`.
macOS 실행/집계/정리, 입력 거부, YAML 검사, 타입·lint 결과를 각각 남겼다.
Linux의 일회성 `Dockerfile.verify`·`linux-replay.py`·source 대조·실행 log·JUnit·JAR·SBOM·정리 결과도 같은 폴더에 둔다.

## 수정 중 실패

- 새 보호 조건 테스트의 tuple 전개가 TypeScript 검사에서 거부됐다. 명시적인 4개 인자로 수정했고,
  단위 테스트와 scripts/tests 타입·lint 검사를 다시 통과했다. 제품/Collector 동작 변경은 없었다.

## 남은 검증

- 승인된 commit/push 뒤 실제 `verify`·`collector`·API/Web images 성공과 SHA·run URL·artifact·digest를 확인한다.
- branch protection에서 `CI / verify`·`CI / collector` 필수 지정 여부는 별도 확인한다. 이번 로컬 작업에서 원격 설정을 변경하지 않았다.
- Windows PowerShell, 실제 Collector 운영 이미지·전용 계정·mount·재시작, 다른 PC의 비운영 DB/object·Discord는 후속 검증이다.
- [전체 잔여 과정](../../../../../docs/implementation/m0-interim-2026-09-23/remaining-process.md),
  [수집 후속 계획](../../../../../docs/implementation/m0-interim-2026-09-23/collector-follow-up.md)을 따른다.
