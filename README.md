# Blariyo

`블라리요`는 운영자가 선별한 유머 콘텐츠를 데스크톱·모바일 웹에서 연속해서 보는 서비스다.

- 내부 코드명: `blariyo`
- 공개 서비스명: `블라리요`
- 현재 단계: M0 Core 신규 구현·로컬 검증
- 현재 상태: Nuxt Web/BFF, Express Core, PostgreSQL migration과 로컬 테스트 구현. 실제 브라우저·운영 외부 서비스·배포 검증은 별도다.

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

현재 구현 목표는 수집·회원·광고를 제외한 M0 Core다. 단계별 제품 범위와 기술 선택은 위 정본 문서에서만 변경한다.

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
Core 포트는 host에 공개하지 않는다. API Docker 이미지 빌드는 이전 세션에서 성공한 것으로
보고됐으며, 아래 2026-09-07 브라우저 검증에서는 재실행하지 않았다.

## 검증

```sh
# 순수 단위 검증. DB 환경변수가 없으면 통합 항목은 SKIP으로 표시된다.
npm test

# 매번 별도 빈 DB 7개 생성 → migration → Core/BFF/SSR HTTP 검증 → 생성 DB 정리
TEST_DATABASE_ADMIN_URL=postgres://blariyo_local@127.0.0.1:55439/blariyo_local npm run test:integration

git diff --check
```

통합 검증은 `CREATE DATABASE` 가능한 **격리된 로컬 DB 계정**으로만 실행한다. 사용자 DB를 초기화하지
않고 실행기가 생성한 `m0_*_<난수>` DB만 제거한다. BFF 테스트는 로컬 `3041` 포트를 사용하며
`TEST_WEB_PORT`로 변경할 수 있다. 빌드 때 docs OpenAPI 동일성과 타입 생성을 확인한다.

2026-09-07 Node 24.18.0에서 빌드와 테스트 29개가 통과했다(실패·건너뜀 0개).
실제 PostgreSQL, 로컬 파일 저장소·캐시 대체 구현, 서명된 identity fixture와 Nuxt SSR HTTP를 사용한다.

Chrome 실제 브라우저 검증 결과는 다음과 같다. 정책 본문은 출시용 정책이 아닌 로컬 검증 fixture다.

| 범위 | 결과 |
| --- | --- |
| 공개 목록·상세 | 20건/나머지 페이지 이동, 상세 하단 목록 이동과 본문 유지 확인 |
| 공유 | 링크 복사 완료 안내, 브라우저 공유 실패 시 대안 안내, X 공유 URL과 비활성 Kakao 항목 숨김 확인. 외부 전송은 실행하지 않음 |
| 관리자 | 텍스트 초안, 기본 슬롯·임의 시각 예약, 예약 취소, 즉시 발행, 숨김 404, 재공개 확인 |
| 예약 자동 발행 | 브라우저에서 저장한 예약이 로컬 worker 처리 뒤 PUBLISHED로 바뀜. 운영 cron 검증은 아님 |
| 이미지 상태 전이 | HTTP로 준비한 이미지 초안의 브라우저 발행·숨김·삭제 대기 잠금·재공개 및 실제 이미지 로딩 확인 |
| 반응형 | 390px 모바일 공개 상세·하단 공유 시트, 관리자 상하 배치와 가로 넘침 수정 확인. 1280px 공개·관리자 배치 확인 |
| 정책·쿠키 | 모달 현재/이전 정책 전환, 닫기·Escape·포커스 복귀, 정책·쿠키 직접 경로, 비활성 동의 항목 숨김 확인 |
| GA4 비활성 | 쿠키·정책·목록·상세 탐색의 브라우저 네트워크 관찰 구간에서 외부 HTTP 요청 0건. 운영 활성 상태 검증은 아님 |
| 이미지 업로드 UI | **차단**: Chrome 확장의 파일 URL 접근 권한 부족으로 파일 선택 주입 실패. 파일별 오류 UI의 실제 브라우저 검증도 남음 |

이미지 혼합 업로드의 `413`과 모든 실패 파일 index/reason은 실제 로컬 BFF HTTP에서 별도로
확인했다. 이 결과와 템플릿 렌더 테스트는 파일 업로드 UI의 브라우저 통과를 대신하지 않는다.
파일 업로드 검증을 이어가려면 Chrome 확장 관리에서 ChatGPT 확장의 `파일 URL에 대한 액세스 허용`을
켜야 한다. R2·Cloudflare Access·CDN purge·Kakao·GA4 운영 연결과 Docker 앱 이미지 실행은 미검증이다.

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
- GA4 기본값은 꺼짐이다. 승인된 운영 gate 이후에만 `NUXT_PUBLIC_ANALYTICS_ENABLED`,
  `NUXT_PUBLIC_ANALYTICS_APPROVED`, `NUXT_PUBLIC_MEASUREMENT_ID`, `NUXT_PUBLIC_ANALYTICS_CONNECT_ORIGINS`를
  설정한다. 향상된 자동 측정 비활성화와 실제 네트워크 검증이 선행되어야 한다.
- Kakao도 기본값은 꺼짐이다. 운영값·등록 domain·SRI 확인 후에만 `NUXT_PUBLIC_KAKAO_ENABLED`,
  `NUXT_PUBLIC_KAKAO_KEY`, `NUXT_PUBLIC_KAKAO_SDK_URL`, `NUXT_PUBLIC_KAKAO_INTEGRITY`,
  `NUXT_PUBLIC_KAKAO_CONNECT_ORIGINS`를 주입한다.
- GIF decode는 최대 200 frame·누적 RGBA 256MiB로 제한하며 공통 40MP·10MiB 제한도 적용한다.

로컬 백업·복구 확인은 `pg_dump -Fc`로 만든 dump를 **새 별도 DB**에 `pg_restore --exit-on-error`한 뒤
`ops.is_schema_ready('V002')`와 게시글·상태 이력을 대조했다. 운영 암호화·R2 백업과 전체 서버 복구는
[보안·운영 설계](docs/system-design/05-security-operations.md)에 따른 별도 미검증 항목이다.

## 주요 결정 기록

- [작업 기록 안내](worklog/README.md)
- [세션 기록 규칙](worklog/session-log/README.md)
- [PostgreSQL 전환 결정](worklog/session-log/2026-08-14-postgresql-transition.md)
- [planning·system-design 경계 재검토](worklog/session-log/2026-08-14-planning-system-design-boundary-review.md)
- [게시판·권리 정책 정정](worklog/session-log/2026-08-12-board-policy-correction.md)
