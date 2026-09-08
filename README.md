# Blariyo

`블라리요`는 운영자가 선별한 유머 콘텐츠를 데스크톱·모바일 웹에서 연속해서 보는 서비스다.

- 내부 코드명: `blariyo`
- 공개 서비스명: `블라리요`
- 현재 단계: M0 Core 기능 구현·로컬 검증
- 현재 상태: Nuxt Web/BFF, Express Core, PostgreSQL migration과 로컬 브라우저·Docker 검증. 운영 외부 서비스·법무 실값·배포 검증은 별도다.

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

## 저장소 구조

```text
blariyo/
  AGENTS.md                 AI agent rules and canonical boundaries
  CLAUDE.md                 Claude entry pointer
  GEMINI.md                 Gemini entry pointer
  apps/api/                 Express Core, SQL migrations, operational commands
  apps/web/                 Nuxt SSR, BFF, public/admin UI
  packages/contracts/       canonical OpenAPI copy, generated types and validators
  tests/                    isolated PostgreSQL and HTTP integration tests
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
npm run db:migrate
npm run build
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

```sh
# 순수 단위 검증. DB 환경변수가 없으면 통합 항목은 SKIP으로 표시된다.
npm test

# 매번 별도 빈 DB 8개 생성 → migration → Core/BFF/SSR HTTP 검증 → 생성 DB 정리
TEST_DATABASE_ADMIN_URL=postgres://blariyo_local@127.0.0.1:55439/blariyo_local npm run test:integration

# 최초 1회: 설치된 Playwright 버전에 맞는 Chromium 설치
npx playwright install chromium

# 실제 Chromium UI, 별도 임시 DB·이미지 저장소 사용
TEST_DATABASE_ADMIN_URL=postgres://blariyo_local@127.0.0.1:55439/blariyo_local npm run test:browser

# 일회용 Docker Web/Core/PostgreSQL, 명령 실행, dump/restore/readback
npm run test:docker

git diff --check
```

통합 검증은 `CREATE DATABASE` 가능한 **격리된 로컬 DB 계정**으로만 실행한다. 사용자 DB를 초기화하지
않고 실행기가 생성한 `m0_*_<난수>` DB만 제거한다. BFF 테스트는 로컬 `3041` 포트를 사용하며
`TEST_WEB_PORT`로 변경할 수 있다. 빌드 때 docs OpenAPI 동일성과 타입 생성을 확인한다.

2026-09-08 Node 24.18.0 기준으로 현재 소스의 빌드, 단위·실제 PostgreSQL/HTTP 통합 테스트 42개,
Chromium 브라우저 테스트 8개를 통과했다(실패·건너뜀 0개). 브라우저 테스트는 확장 프로그램 대신
Playwright 전용 Chromium을 사용한다. 테스트용 이미지·정책·게시글과 임시 인증값만 사용하며 테스트
종료 시 생성한 DB·저장소·프로세스를 정리한다. 운영 서비스로 데이터를 보내지 않는다.

| 범위 | 현재 검증 증거 |
| --- | --- |
| API·DB·계약 | `npm run test:integration`: migration up/down, OpenAPI 동일성·생성 타입·응답 검증, 권한, 동시성, 멱등성, 업로드 보상·outbox·예약·정책 시행 |
| 이미지 업로드 UI | `npm run test:browser`: 실제 파일 입력 성공, 전체 실패, 혼합 413의 모든 파일 오류, 형식 415, 개수 제한 413, 저장소 503와 preview 미생성 |
| 관리자 | 입력 필드 오류·초점, 업로드 중 글 전환 차단, 초안·발행·숨김·재공개·최종 삭제, 기본 예약·취소·due worker, 저장 후 재조회 실패의 멱등 재시도 |
| 공개 목록·상세 | 20건 페이지 이동, 상세 본문 유지, 현재 글의 링크·tab stop 제거, 숨김 404, 공개 이미지 실제 로딩 |
| 정책·공유·쿠키 | 현재/이전 정책, 모달 Escape·초점 복귀, 공유 대화상자·Kakao 비활성, GA4 비활성 시 선택 항목·저장·외부 요청 없음 |
| 분석 동의 | 테스트용 태그 응답으로 동의 전 로드 0건, 허용 후 로드 1회, 고정 분석 필드, 철회 후 태그·쿠키 삭제, 저장 실패 시 차단. Google 실제 전송·DebugView 검증은 아님 |
| 반응형 | 360·390·1280px 공개 화면과 360px 관리자 가로 넘침 없음. 캡처는 `test-results/m0-browser/`에 생성 |
| Docker·복구 | `npm run test:docker`: Web/API 이미지 빌드·실행, readiness·인증·발행·숨김, 운영 command 3개, PostgreSQL custom dump를 별도 DB에 복원한 뒤 V004 readiness·게시글·상태 이력 대조 |

이번 보완에서는 수집 기능을 끈 Core가 V003 기준으로 기동할 수 있도록 readiness와 token 파일 읽기,
정리 실패 경계를 분리했다. 수집 기능을 켜면 V004와 `collect` 권한을 계속 요구한다. 예약 게시 시각은
DB 문장 시각으로 기록해 공개 조회의 시계 경계를 맞췄다. 통합 검증기는 실제 생성한 난수 DB만 강제
정리하고 정리 실패를 테스트 실패와 함께 보고하며, Docker 검증기는 실행마다 image·network·port를
분리한다. 수집 RUNNING lease의 재선점 상한과 PENDING 보존, 중복 확인 UI, 동의 후 페이지 이동별
분석 이벤트도 회귀 테스트에 포함한다.

운영 R2·Cloudflare Access·CDN purge, 운영 cron·알림 수신, 암호화 백업의 원격 보관과 전체 서버 복구,
법무 실값·승인 정책 시행, 실제 배포는 미검증이다. Kakao·GA4 운영 활성화는 별도 gate다.
이 로컬 검증 결과를 production 공개 완료로 해석하지 않는다.

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

```sh
npm run posts:publish-due  # 매분, 지난 예약도 재처리
npm run outbox:run         # 매분, lease 회수·backoff·8회 실패 DEAD
npm run cleanup:run        # 매일, staging 24시간·orphan inventory·멱등 기록 만료
npm run policies:publish -- --artifact=/absolute/path/approved-policy.json
```

정책 artifact 필드는 `type`(`terms`/`privacy`), `version`, `title`, `body`(HTML), `effectiveAt`, `checksum`이다.
checksum은 자신을 제외한 객체의 key를 재귀 정렬한 JSON UTF-8 bytes의 SHA-256 hex다.
`apps/api/src/policies.mjs`의 `artifactChecksum`을 승인 artifact 생성 시 사용할 수 있다.
시행 시각은 실행 시점부터 과거 5분 이내이고 미래일 수 없다. production에는 승인된 실값
`LEGAL_CONFIG` JSON(`operatorDisplayName`, `contactEmail`, `rightsEmail`, `privacyEmail`, `privacyOfficer`)과
root 소유 `0600` read-only artifact가 필요하다. 사업자 보류값·법무 출시 차단은 그대로 유지한다.

- `V003` migration은 예약 실패 알림 보존 테이블을 추가한다. 기존 로컬 DB도 `npm run db:migrate` 후 실행한다.
- `SCHEDULE_ALERT_WEBHOOK_URL`: 기존 운영 webhook 수신 주소. 첫 실패부터 전달하며 같은 예약·오류는
  15분 단위로 묶는다. 수신 주소 미설정·전송 실패는 command 비정상 종료이며 DB에 전달 대상을 보존한다.
  production은 HTTPS만 허용한다. 로컬 HTTP 대체 수신기로만 검증했으며 실제 운영 전송은 하지 않았다.
- `MAINTENANCE_READ_ONLY=true`: 조회 유지, API mutation과 운영 쓰기 command 차단.
- migration은 owner 계정으로 실행한다. `DB_APP_ROLE`을 주면 별도 application role에 업무 테이블 권한과
  readiness 함수 실행 권한을 부여한다. migration ledger 직접 조회·변경은 허용하지 않는다.
- 운영 저장소: `STORAGE_MODE=r2`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BUCKET`; private/public bucket은 반드시 다르다.
- 캐시 제거: `CACHE_ZONE_ID`, `CACHE_PURGE_TOKEN`. 실값 없이는 로컬 대체 구현으로만 검증한다.
- BFF 관리자: `NUXT_ACCESS_ISSUER`, `NUXT_ACCESS_AUDIENCE`, `NUXT_ADMIN_OPERATORS_FILE`(subject→내부
  operatorId JSON 파일), `NUXT_SERVICE_TOKEN`, `NUXT_ACTOR_SECRET`. 외부 assertion은 Core에 중계하지 않는다.
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
`ops.is_schema_ready('V003')`와 게시글·상태 이력을 대조했다. 운영 암호화·R2 백업과 전체 서버 복구는
[보안·운영 설계](docs/system-design/05-security-operations.md)에 따른 별도 미검증 항목이다.

## 주요 결정 기록

- [작업 기록 안내](worklog/README.md)
- [세션 기록 규칙](worklog/session-log/README.md)
- [PostgreSQL 전환 결정](worklog/session-log/2026-08-14-postgresql-transition.md)
- [planning·system-design 경계 재검토](worklog/session-log/2026-08-14-planning-system-design-boundary-review.md)
- [게시판·권리 정책 정정](worklog/session-log/2026-08-12-board-policy-correction.md)
