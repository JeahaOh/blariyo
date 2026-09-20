# Blariyo

`블라리요`는 운영자가 선별한 유머 콘텐츠를 데스크톱·모바일 웹에서 연속해서 보는 서비스다.

- 내부 코드명: `blariyo`
- 공개 서비스명: `블라리요`
- 현재 단계: M0 Core 운영 서버 배포·공개 연결 완료 (2026-09-20)
- 공개 주소: https://blariyo.com/ · 공개 이미지: https://media.blariyo.com/
- 현재 상태: Lightsail 서울 2GB에서 Nuxt Web/BFF·Nest Core·PostgreSQL·Nginx를 Cloudflare Tunnel로 연결했다. 정책 v0.1 발행, 공개 HTTPS, 암호화 R2 DB 백업과 격리 복원을 확인했다. 관리자 실제 로그인 후 작성·발행과 장기 운영 관찰은 남아 있다.
- 운영 정본: [현재 운영 상태와 남은 작업](docs/implementation/operations/current-status.md), [운영 명령](deploy/operations/README.md), [TASK-19 배포 증거](worklog/task-list/09/20/infrastructure-setup/TASK-19.md).
- 배포 방법: [최초 설치·재배포·복귀 실행서](docs/implementation/operations/deployment-runbook.md), [GitHub CI·배포 정책과 무중단 전환 조건](docs/implementation/operations/deployment-policy.md). CI workflow는 로컬 작성 상태이며 원격 실행·자동 CD는 별도다.
- 로컬 콘텐츠: [실제 HOT 25건 수집·초안 DB 저장](scripts/content/README.md). 운영 발행이나 운영 collector 활성화와 구분한다.
- Nest 전환의 DONE_LOCAL 기록은 [최종 보고](docs/migration/REPORT.md)와 [진행 기록](docs/migration/PROGRESS.md)에 보존한다. Spring Collector·회원·광고·GA4·카카오는 이번 운영에서 활성화하지 않았다.

## 문서 정본

같은 내용을 README에 다시 정의하지 않고 아래 문서를 정본으로 사용한다.

| 질문 | 정본 |
| --- | --- |
| 무엇을 어느 단계에 만드는가 | [서비스 기획서](docs/planning/01-service-plan.md) |
| 화면에서 어떻게 동작하는가 | [화면 설계서](docs/planning/03-screen-design.md) |
| 분석·광고를 언제 어떻게 적용하는가 | [분석·광고 계획](docs/planning/04-analytics-ad-plan.md) |
| 어떤 기술 경계로 구현하는가 | [M0 시스템 설계](docs/system-design/README.md) |
| PostgreSQL schema 계약은 무엇인가 | [M0 데이터 모델](docs/system-design/02-data-model.md) |
| HTTP 계약은 무엇인가 | [M0 API 설계](docs/system-design/03-api-design.md) |
| 어떻게 배포·백업·복구하는가 | [인프라 설계](docs/system-design/04-infrastructure-design.md), [보안·운영 설계](docs/system-design/05-security-operations.md) |
| AI가 어떤 순서와 근거로 작업하는가 | [AI 작업 안내](docs/ai/README.md) |

제품 범위는 planning, 구현 세부는 system-design, 실제 완료 여부는 migration·OpenAPI·source·test를 기준으로 판단한다.

현재 구현 범위는 M0 Core와 별도 feature flag의 M0 수집 보조다. 회원·광고와 목록 자동 수집은 제외한다. 단계별 제품 범위와 기술 선택은 위 정본 문서에서만 변경한다.

내부 디렉터리와 의존성 규칙은 [M0 코드 구조](docs/system-design/08-code-structure.md)를 따른다.

## 저장소 구조

```text
blariyo/
  AGENTS.md                 AI agent rules and canonical boundaries
  CLAUDE.md                 Claude entry pointer
  GEMINI.md                 Gemini entry pointer
  apps/api/                 NestJS/TypeORM Core, SQL migrations, operational commands
  apps/web/                 Nuxt SSR, BFF, public/admin UI
  apps/collector/           Spring Boot, Batch, Quartz operator-local server
  packages/contracts/       canonical OpenAPI copy, generated types and validators
  tests/                    isolated PostgreSQL and HTTP integration tests
  deploy/                   production Compose, provisioning, jobs, backup and restore
  docs/
    ai/                     canonical map and evidence contract
      skills/               project-local AI workflows
    planning/               product and stage decisions
    system-design/          M0 implementation contracts
    legal/                  release-blocking policy drafts
    publishing/             responsive publishing prototype
    wireframes/             screen references
  worklog/
    task-list/              task scopes and verification artifacts
    session-log/            decision and review history
```

## 로컬 실행

Node.js `24.18.0`, npm과 Docker가 필요하다. 이전 프로토타입의 DB·파일을 사용하지 않는다.
`nvm`을 사용하면 `nvm use 24.18.0` 후 `node --version`을 확인한다. Node 20에서는 현재 빌드가
`trustedFunctions.difference is not a function`으로 실패한다.
`compose.yaml`은 로컬 전용이며 PostgreSQL 포트는 `127.0.0.1:55439`다. trust 인증을 사용하는
로컬 fixture이므로 운영에 재사용하지 않는다. Core는 기본 `127.0.0.1:3100`에서만 수신한다.

```sh
nvm use
npm ci
docker compose up -d postgresql
export DATABASE_URL=postgres://blariyo_local@127.0.0.1:55439/blariyo_local
npm run build
npm run db:migrate
```

서로 다른 터미널에서 Core와 빌드된 Web을 실행한다. Web의 `NODE_ENV=test`는 로컬 fixture 실행용이다.
개발 서버는 `npm run dev:web`으로 실행할 수 있지만 이 작업 환경에서는 파일 감시기 `EMFILE`이
발생했으므로 파일 감시기가 없는 빌드 실행을 검증 경로로 사용했다.

```sh
# Core terminal: DATABASE_URL도 같은 터미널에 설정
npm run dev:api

# Web terminal
NODE_ENV=test node apps/web/.output/server/index.mjs
```

공개 진입은 `http://localhost:3000/meme`다. 빈 DB에는 짤 게시판만 있으며 정책·게시글은 넣지 않는다.
관리자 로컬 검증은 Core의 `SERVICE_TOKEN`과 Web의 `NUXT_SERVICE_TOKEN`에 같은 32-byte 이상
임시 난수를 주입하고, Web에 `NUXT_ADMIN_AUTH_MODE=local`, `NUXT_LOCAL_ADMIN_TOKEN`,
`NUXT_ACTOR_SECRET`을 설정한다. 직접 화면을 확인할 때는 본인이 생성한 로컬 관리자 token을
`BLARIYO_ADMIN_SESSION` 쿠키로 설정한다. token을 URL·소스·로그에 쓰지 않는다. 자동 HTTP 테스트는
실행 중에 난수를 생성해 환경과 쿠키에만 전달한다. production에서는 로컬 인증·저장소를 거부한다.

`docker compose --profile preview up --build`는 Web/Core까지 실행하는 로컬 preview 구성이다.
`SERVICE_TOKEN`, `LOCAL_ADMIN_TOKEN`, `ACTOR_SECRET`을 환경으로 주입하고 migration을 먼저 적용한다.
Core 포트는 host에 공개하지 않는다. `npm run test:docker`는 별도 이름의 임시 컨테이너와 DB에서
Web·API 이미지 빌드, 실제 실행과 백업 복구를 검증한다. 기존 preview와 데이터는 사용하지 않는다.

## 검증

전체 Nest 전환의 실행 진입점은 `npm run verify:migration`이다. 최종 PASS와 문서 감사·자원 정리가
모두 끝나야 로컬 완료로 판정한다. 현재 결과와 실패 이력은 [진행 기록](docs/migration/PROGRESS.md),
검증 대응은 [전환 계획](docs/migration/PLAN.md), 환경 준비는 [전환 보고](docs/migration/REPORT.md)를 따른다.

```sh
nvm use 24.18.0
export JAVA_HOME=/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home
export TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:55449/postgres
export PLAYWRIGHT_WS_ENDPOINT=ws://127.0.0.1:55450/

# 아래 명령은 별도 검증용 컨테이너의 ID·포트·데이터 확인 및 기동 후 실행한다.
npm run verify:migration

# 개별 검증 (전체 통과를 대신하지 않음)
npm test
npm run test:integration
npm run test:browser
npm run test:spring
npm run test:docker
```

일반 개발 Compose의 55439 DB와 migration 검증의 55449 DB를 혼용하지 않는다. 검증기는 소유가
확인된 전용 PostgreSQL에 난수 DB를 생성하고 자신이 만든 DB만 정리한다. 보존된 baseline DB는
schema 비교에 읽기만 사용한다. Chromium은 전용 Playwright 서버에 연결하고 실제 Nuxt·DB를 사용한다.
`npm test`는 DB 없는 단위·구조·계약 검증이며 통합 검증을 SKIP으로 성공 처리하지 않는다.

| 범위 | 실행 증거 |
| --- | --- |
| strict·구조 | API·Web·계약 런타임·테스트·운영 스크립트 타입 검사 및 lint, 도메인·Repository·ORM 의존성 검사 |
| API·DB·운영 | Nest 통합: 실제 PostgreSQL 잠금·transaction·멱등성·quota·lease/fencing·업로드 보상·outbox·예약·정책·운영 CLI |
| schema·복원 | 전체 schema dump, 모든 application row·sequence·migration ledger/checksum을 별도 PostgreSQL 복원본과 대조하고 실제 공개 API 확인 |
| 브라우저·BFF | 실제 Chromium의 공개·관리자·수집 검수·업로드 실패·예약·동의·반응형 흐름 |
| Spring | 실제 JVM/Batch/Quartz, 응답 유실·중단/재시작·권위 상태 변경·100건 중복·백업/복원·운영 CLI |
| Docker | 현재 작업 트리의 Core·Nuxt production image, 합성 Access/JWKS·정책 CLI, 발행·숨김, health, 유지보수·SIGTERM 및 연결 해제 |

Docker 외부 HTTP는 전용 네트워크의 합성 저장소·CDN·인증 대역으로만 연결한다.
이 로컬 검증과 별도로 운영 R2 어댑터·공개 이미지·캐시 삭제 API, 정책 발행, 서버 배포,
예약 작업의 단발 실행과 암호화 원격 백업 복원을 확인했다. 실제 관리자 로그인 후 전체 쓰기 흐름,
CDN 캐시 전파, 외부 실패 알림, 7일 관찰, live Discord·실제 수집 출처는 미검증이다.
세부 증거는 [현재 운영 상태](docs/implementation/operations/current-status.md)를 따른다. Kakao·GA4 gate는 유지한다.

## 수집 보조

이 절은 보존 커밋 `c788f18` 기준의 전환 전 Python/Core 구현과 검증 증거다. 최종 Spring 수집
서버의 구현 완료나 운영 준비 완료를 뜻하지 않는다. 이번 legacy 호환 보완과 별도 Spring V2 범위는
[수집 개발 명세의 전환 경계](docs/development-specs/m0-collection-assist/collection-assist/collection-assist.dev.md#spring-v2-전환과-이번-호환-보완의-경계)를 따른다.

`/admin/collect`에서 상세 URL 요청·후보 검수·이미지 선택과 설명·직접 대체 업로드·반려·재수집·
초안 생성을 처리한다. `/admin/collect/sources`는 등록한 출처의 활성·robots 확인·요청 제한 설정이다.
보존 중인 legacy 수집기는 운영자 PC의 별도 Python 상시 서버이며 Core/Web 컨테이너에 포함하지 않는다.
cron·로컬 HTTP 실행 API·Discord가 같은 실행기를 사용하고 실행 이력은 SQLite에 보관한다.

실행·환경변수·출처 설정·Discord 등록은 [로컬 수집기 안내](tools/collector/README.md)를 따른다.
수집 feature flag는 기본 false이고 외부 출처 seed는 없다. source 설정이 없으면 외부 요청을 하지 않는다.
Core/API 검증은 선점·lease 충돌·멱등 재시도·비공개 preview·초안 생성 rollback까지 포함한다.
Chromium에서 URL 접수 → preview → 초안 생성 → 편집기 이동과 출처 설정 저장을 확인했다.
Python 3.14.4·discord.py 2.7.1에서 로컬 테스트 14개를 통과했다. Python/Discord 권한·파서·접근 차단 검증은 외부 연결 없는 fixture 테스트이며 실제 출처 fetch와
라이브 Discord 연결은 미검증이다. 실제 수집 운영 완료로 표시하지 않는다.

## 운영 command와 설정 경계

production의 API·운영 command는 `APP_DB_USER=blariyo_app`과 `APP_DB_PASSWORD_FILE`,
DB migration command는 `MIGRATION_DB_USER=blariyo_migrator`와 `MIGRATION_DB_PASSWORD_FILE`을
받는다. `DB_HOST`·`DB_NAME`은 필수이고 `DB_PORT` 기본값은 `5432`다. 비밀번호 파일은 container
내부 절대경로의 접근 제한된 일반 파일이며, 역할별 파일을 서로 mount하지 않는다.
production의 `DATABASE_URL`·`PGPASSWORD`·역할별 비밀번호 환경 변수 직접 입력은 거부한다.
로컬·테스트에서는 기존 `DATABASE_URL`을 계속 쓰되 위 파일 설정과 혼합하지 않는다.
상세 입력 계약은 [인프라 설계](docs/system-design/04-infrastructure-design.md#6-환경-분리)를 따른다.
설정 파싱 성공은 DB 역할 생성·권한·접속 성공을 의미하지 않는다.
역할 생성·migration 이후 권한 적용 파일과 서버 적용 전제는
[PostgreSQL 준비 절차](deploy/postgresql/README.md)에 있다.
`npm run test:database-roles`는 합성 비밀번호를 사용하는 임시 PostgreSQL 18에서 실제 역할별
접속·허용/거부·앱 발행·backup 계정 dump/restore를 검사한다. 운영 서버에는 접근하지 않는다.

```sh
npm run posts:publish-due  # 매분, 지난 예약도 재처리
npm run outbox:run         # 매분, lease 회수·backoff·8회 실패 DEAD
npm run cleanup:run        # 매일, staging 24시간·orphan inventory·멱등 기록 만료
npm run policies:publish -- --artifact=/absolute/path/approved-policy.json
```

정책 artifact 필드는 `type`(`terms`/`privacy`), `version`, `title`, `body`(HTML), `effectiveAt`, `checksum`이다.
checksum은 자신을 제외한 객체의 key를 재귀 정렬한 JSON UTF-8 bytes의 SHA-256 hex다.
`apps/api/dist/features/policies/policy-artifact.js`의 `artifactChecksum`을 승인 artifact 생성 시 사용할 수 있다.
시행 시각은 실행 시점부터 과거 5분 이내이고 미래일 수 없다. production에는 승인된 실값
`LEGAL_CONFIG` JSON(`operatorDisplayName`, `contactEmail`, `rightsEmail`, `privacyEmail`, `privacyOfficer`)과
root 소유 `0600` read-only artifact가 필요하다. 사업자 보류값·법무 출시 차단은 그대로 유지한다.

- `V003` migration은 예약 실패 알림 보존 테이블을 추가한다. 기존 로컬 DB도 `npm run db:migrate` 후 실행한다.
- `SCHEDULE_ALERT_WEBHOOK_URL`: 기존 운영 webhook 수신 주소. 첫 실패부터 전달하며 같은 예약·오류는
  15분 단위로 묶는다. 수신 주소 미설정·전송 실패는 command 비정상 종료이며 DB에 전달 대상을 보존한다.
  production은 HTTPS만 허용한다. 로컬 HTTP 대체 수신기로만 검증했으며 실제 운영 전송은 하지 않았다.
- `MAINTENANCE_READ_ONLY=true`: 조회 유지, API mutation과 운영 쓰기 command 차단.
- DB application 연결은 UTC, 쿼리 30초·잠금 대기 5초·유휴 transaction 30초·연결/풀 대기 5초로 제한한다.
  migration CLI는 DDL을 위해 쿼리 300초·잠금 대기 10초·유휴 transaction 60초를 사용한다. 유휴 연결 장애는
  자격 정보 없이 `DATABASE_IDLE_CONNECTION_FAILED` event로 기록하고 pool이 실패 연결을 제거한다.
- migration은 owner 계정으로 실행한다. `DB_APP_ROLE`을 주면 별도 application role에 업무 테이블 권한과
  readiness 함수 실행 권한을 부여한다. migration ledger 직접 조회·변경은 허용하지 않는다.
- 운영 저장소: `STORAGE_MODE=r2`, `R2_ENDPOINT`, `R2_PRIVATE_ACCESS_KEY_ID`,
  `R2_PRIVATE_SECRET_ACCESS_KEY`, `R2_PUBLIC_ACCESS_KEY_ID`, `R2_PUBLIC_SECRET_ACCESS_KEY`,
  `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BUCKET`. 각 key는 자기 bucket에만 접근하며 bucket과 key ID는
  서로 달라야 한다. 공용 `R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`는 사용하지 않는다.
  발행 시 private key로 원본을 읽고 public key로 공개본을 저장한다. backup key는 Core에 넣지 않는다.
- 캐시 제거: `CACHE_ZONE_ID`, `CACHE_PURGE_TOKEN`. 실값 없이는 로컬 대체 구현으로만 검증한다.
- BFF 관리자: `NUXT_ADMIN_AUTH_MODE=access`, `NUXT_ACCESS_ISSUER`(팀 전체 HTTPS URL),
  `NUXT_ACCESS_AUDIENCE`(관리자 앱 AUD), `NUXT_ADMIN_OPERATORS_FILE`, `NUXT_SERVICE_TOKEN`,
  `NUXT_ACTOR_SECRET`. 운영자 JSON은 `[{"identity":"<JWT sub>","operatorId":"<내부 ID>","active":true}]`
  목록 형식이며 BFF에만 읽기 전용 mount한다. 비활성·미등록 사용자, 중복 identity·잘못된 형식은
  거부한다. 이전 subject→operatorId 객체는 목록으로 변환해야 한다. 외부 assertion은 Core에 중계하지 않는다.
- `SITE_ORIGIN`, `IMAGE_ORIGIN`과 Web의 `NUXT_PUBLIC_SITE_ORIGIN`, `NUXT_PUBLIC_IMAGE_ORIGIN`을 맞춘다.
- 실제 법무·문의 공개값은 Web의 `NUXT_PUBLIC_OPERATOR_DISPLAY_NAME`, `NUXT_PUBLIC_CONTACT_EMAIL`,
  `NUXT_PUBLIC_RIGHTS_EMAIL`, `NUXT_PUBLIC_PRIVACY_EMAIL`, `NUXT_PUBLIC_PRIVACY_OFFICER`에 주입한다.
- `NUXT_TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip`는 Tunnel 밖 origin 직접 접근을 차단한 배포에서만 사용한다.
- GA4 기본값은 꺼짐이다. 승인된 운영 gate 이후에만 `NUXT_PUBLIC_GA4_ENABLED`,
  `NUXT_PUBLIC_ANALYTICS_APPROVED`, `NUXT_PUBLIC_GA4_MEASUREMENT_ID`, `NUXT_PUBLIC_ANALYTICS_CONNECT_ORIGINS`를
  설정한다. 기획 계약의 변수명을 사용하며 이전 `NUXT_PUBLIC_ANALYTICS_ENABLED`·
  `NUXT_PUBLIC_MEASUREMENT_ID`는 사용하지 않는다. 비활성 환경은 Measurement ID를 공개하지 않는다. 향상된 자동 측정 비활성화와 실제 네트워크 검증이 선행되어야 한다.
- Kakao도 기본값은 꺼짐이다. 운영값·등록 domain·SRI 확인 후에만 `NUXT_PUBLIC_KAKAO_ENABLED`,
  `NUXT_PUBLIC_KAKAO_KEY`, `NUXT_PUBLIC_KAKAO_SDK_URL`, `NUXT_PUBLIC_KAKAO_INTEGRITY`,
  `NUXT_PUBLIC_KAKAO_CONNECT_ORIGINS`를 주입한다.
- GIF decode는 최대 200 frame·누적 RGBA 256MiB로 제한하며 공통 40MP·10MiB 제한도 적용한다.

로컬 백업·복구 확인은 `pg_dump -Fc`로 만든 dump를 **새 별도 DB**에 `pg_restore --exit-on-error`한 뒤
`ops.is_schema_ready('V003')`와 게시글·상태 이력을 대조했다. 운영에서는
[암호화 R2 백업·복원](deploy/backup/README.md)까지 확인했다. 새 VM 전체 복구와 RTO 달성은
[보안·운영 설계](docs/system-design/05-security-operations.md)에 따른 별도 미검증 항목이다.

## 주요 결정 기록

- [작업 기록 안내](worklog/README.md)
- [세션 기록 규칙](worklog/session-log/README.md)
- [PostgreSQL 전환 결정](worklog/session-log/2026-08-14-postgresql-transition.md)
- [planning·system-design 경계 재검토](worklog/session-log/2026-08-14-planning-system-design-boundary-review.md)
- [게시판·권리 정책 정정](worklog/session-log/2026-08-12-board-policy-correction.md)


## M0 Core + Spring 수집 보조 진행

이전 `feature/m0-core`의 [1~7 완료 조건](docs/implementation/m0-completion/acceptance.md), [실행 검증 기록](docs/implementation/m0-completion/evidence.md), [Spring 설치·복구 안내](apps/collector/ops/README.md)를 참고한다. 로컬 통과와 실제 운영 전환·7일 관찰은 별도이며 전체 완료로 표시하지 않는다.
