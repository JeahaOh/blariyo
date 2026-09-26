# M0 코드 구조와 의존성 계약

- 기준일: 2026-09-23
- 범위: M0 Core와 Collector의 내부 구조. 사이트별 모듈 분리 목표와 현재 구현 상태를 구분한다.
- 상위 계약: [아키텍처](01-system-architecture.md), [수집 서버](07-spring-collector-design.md), [수집 기획](../planning/content-collection/README.md)

## 1. 앱과 공유 계약

`apps/api`는 Nest Core (기본 Express 어댑터), `apps/web`은 Nuxt 화면·BFF, `apps/collector`는 별도 컴퓨터에서 실행하는 Java batch와 Spring 수집 서버다.
`packages/contracts`는 OpenAPI·검증·생성 타입이며 실행 앱이 아니다. `tools/collector`의 Python 구현은
기존 실행의 종료·전환을 위한 legacy이며 신규 기능을 추가하지 않는다.
현행 direct batch는 외부 사이트 수집과 `collect.*`·`collect/raw/*`·`collect/media/*`·`collect/report/*` 저장을 소유하며 글마다 API를 호출하지 않는다.
API는 수집 결과 조회·검수·content 초안 승격과 공개 상태를 소유한다. DB role과 object prefix 권한을 분리하고,
batch에는 content 쓰기·공개 권한을 주지 않는다. Web에는 SQL·게시 상태 전이를 두지 않는다.
collector → Web/BFF → Core 경로는 legacy 호환 경로이며 신규 사이트 모듈의 전제가 아니다.

## 2. Core API

2026-09-09 사용자 요청에 따라 NestJS + 엄격한 TypeScript + TypeORM으로 내부 구현을 전환한다.
당시 전환 결과는 [진행 기록](../../worklog/2026-09-09/nest-transition/PROGRESS.md), 현행 구현·남은 수용은
[요구사항 대조표](../development-specs/requirements-status.md)를 따른다.

```text
HTTP → 도메인 Controller → Service → Repository 계약 → TypeORM Repository → PostgreSQL
apps/api/src/
  main.ts / app.module.ts  Nest 기동·도메인 Module 조립
  features/               public/posts/images/policies/collection 도메인
  persistence/            TypeORM DataSource·엔티티·Repository 구현·Unit of Work
  http/                   Guard·Pipe·Exception Filter·응답 interceptor
  adapters/               로컬/R2 저장소·CDN 구현
  operations/             outbox·정리·예약 실패 알림 서비스
  commands/               SQL migration 및 운영 CLI
  shared/                 도메인 오류·공통 모델
apps/api/migrations/      기존 SQL 및 checksum 이력 유지
```

- 도메인별 Module은 Controller, Service와 명시적 Repository 토큰 provider를 등록한다.
- Controller는 입력 검증과 응답 매핑, Service는 업무 규칙과 트랜잭션 경계를 소유한다.
- SQL·TypeORM 객체는 persistence의 Repository 구현에만 둔다. 계약은 엔티티를 노출하지 않는다.
- Unit of Work가 트랜잭션과 연결 범위를 관리하며 서비스에는 업무 Repository를 제공한다.
- public snapshot의 REPEATABLE READ, 게시물 session advisory lock, 멱등성·lease·fencing을 유지한다.
- 일반 JSON controller는 Express Request/Response를 받지 않는다. multipart·stream은 HTTP 경계에 격리한다.
- 기능 간 의존성은 collection → posts/images와 posts → images만 허용한다. 인프라는 업무 서비스에 의존하지 않는다.
- 전역 거대 모듈 및 forwardRef는 사용하지 않는다.
- TypeScript strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes를 모두 활성화한다.
- TypeORM synchronize/dropSchema/migrationsRun은 false다. DDL과 migration 이력은 기존 SQL runner가 소유한다.
- 프런트엔드·Spring·OpenAPI·스키마·정책은 기존 계약을 유지한다.

## 3. Spring Collector

기본 패키지는 `com.blariyo.collector`이며 `CollectorApplication`만 루트에 둔다.

아래 표와 `CollectorRunService`·6단계 pipeline 의존 규칙은 기존 Spring 서버 경로의 구조다.
현행 direct batch는 `run.DirectBatchRunner`가 registry에서 선택한 사이트 adapter와 공통 fetch·저장을 조합한다.
신규 사이트 구현과 파일 분리는 아래 [사이트별 모듈 계약](#collector-site-modules)을 따른다.

| 패키지                     | 책임                                            |
| -------------------------- | ----------------------------------------------- |
| shared                     | JSON·공통 오류                                  |
| config                     | 비밀·운영 설정·DataSource 설정                  |
| observability / lifecycle  | 실행 계측 / 종료 gate                           |
| run                        | 요청 검증·중복 방지·실행 큐·이력 저장           |
| spool / state              | 암호화 임시 파일 / 복구 상태 저장               |
| source / core              | 외부 출처 transport·정책 / BFF를 통한 Core 연동 |
| execution                  | Batch 실행·6단계 pipeline·만료 복구             |
| web / discord / scheduling | REST / Discord / Quartz 진입점                  |
| notification / maintenance | 알림·운영 이벤트 / 보존·정리                    |
| bootstrap                  | 기동 검사·health·의존 서비스 지표 조립          |
| ops                        | migration·백업·복원·작업 조정 CLI               |

진입점은 `run.CollectorRunService`를 호출한다. 공통 요청 검증은 `run`이 소유하고 `web`에 의존하지 않는다.
`run`은 execution·web·discord·scheduling을 참조하지 않는다. `source`, `core`, `spool`은 run·진입점을 참조하지 않는다.
execution은 run·state·source·core를 조합하며 web·discord·scheduling을 참조하지 않는다.
shared는 다른 내부 패키지를 참조하지 않고 config는 shared만 참조한다. 위 표의 상위 기능 패키지 간 순환 참조를 허용하지 않는다. `source` 내부의 공통 계약·registry·사이트 모듈은
아래 모듈 의존 규칙으로 별도 검사한다.
테스트도 대상 패키지로 옮기며 fixture 설정은 테스트 source set에만 둔다. 운영 CLI의 FQCN 변경은
Gradle task·launchd 렌더러·운영 문서·프로세스 테스트와 함께 반영한다.

<a id="collector-site-modules"></a>

### 3.1. 사이트별 모듈 계약

**2026-09-23 로컬 구현:** `source/sites/`의 21개 패키지에 adapter 21개·상세 parser 21개·목록 parser
19개를 분리했다. `SiteAdapters.java`는 adapter 선택과 기존 query helper 위임만 담당한다. PGR21과
YouTube Community는 목록 parser를 만들지 않고 `CHART_UNVERIFIED`를 유지한다. 파일 분리와 실제 출처
수집·운영 검증은 별도이며 실행 근거는 [분리 결과](../../worklog/2026-09-23/collector-site-modules/RESULTS.md)를 따른다.
`SourceRegistry`가 adapter를 선택하고 `DirectBatchRunner`가 목록·상세 메서드를 호출하는 구조는 유지한다.

디렉터리별 책임은 다음과 같다. `OrderedContentParser`는 `source/common/`에 두고 사이트별 selector와
예외 처리는 해당 `source/sites/<site>/` 파일에서 관리한다.

```text
apps/collector/src/main/java/com/blariyo/collector/
  source/
    SiteAdapter.java             사이트 공통 진입 계약
    SourceRegistry.java          source key·설정·adapter 연결
    common/                     순서 보존·URL·이미지·첨부·SNS 공통 파싱
    sites/
      dcinside/
        DcinsideAdapter.java    상세 URL 식별·canonical·post key와 parser 조합
        DcinsideListParser.java 목록 항목·게시 시각·다음 페이지 추출
        DcinsideDetailParser.java 제목·본문·미디어·SNS 추출
      todayhumor/                같은 책임 분리
      yuldo/                     같은 책임 분리
      ...                        나머지 source key별 패키지
  run/                           공통 실행·제한·재시도·중복 제거·저장·report 조합
```

- 사이트 adapter는 해당 사이트의 URL 식별 규칙과 목록·상세 parser 조합을 소유한다.
  selector·목록 API 응답 구조·공지 제외·pagination 해석은 각 사이트 모듈에 둔다.
- 목록 parser는 가져온 HTML/API 응답에서 상세 URL·게시 시각·다음 페이지를 반환한다.
  상세 parser는 가져온 응답에서 제목·본문 순서·이미지·첨부·SNS 원문 링크를 반환한다.
  두 parser는 별도 파일과 테스트로 관리하며 직접 HTTP·DB·S3/R2에 접근하지 않는다.
- `HOT_LIST`·`GENERAL_LIST`·`DETAIL_ONLY` 등 출처별 수집 정책은 유지한다.
  목록을 지원하지 않는 사이트에 형식적인 ListParser를 만들지 않는다. 지원 불가 사유를 명시하고
  목록 실행을 거부하며 상세 URL 경로만 허용한다. 목록이 열려도 상세 접근·파싱 성공은 별도 검증한다.
- `OrderedContentParser` 같은 본문 순서 보존 로직은 공통으로 재사용한다. 사이트마다 이를 복제하거나
  불확실한 selector를 generic parser로 대체하지 않는다. 공통 모듈은 개별 사이트 구현에 의존하지 않는다.
- fetch·요청 간격·retry/backoff·site stop·중복 조회·queue·DB·object 저장·report는 공통 실행 계층이 소유한다.
  사이트 모듈끼리 서로 참조하지 않으며 registry가 사이트 구현을 조립한다. 공통·사이트 parser는
  `source`의 `SiteAdapter`·`SourcePolicy` 계약을 사용할 수 있으나 registry·transport·runner·저장 구현을 호출하지 않는다. canonical 생성은 사이트 규칙,
  canonical hash·source post key의 중복 판정과 unique constraint는 공통 저장 계약이다.

분리는 사이트 단위로 진행한다. 먼저 기존 fixture 결과를 고정하고 해당 사이트의 parser를 옮긴 뒤
registry 연결을 교체한다. source key·CLI·설정 형식·canonical/post key·오류 코드·저장 결과를 유지하며,
파일 이동만을 이유로 DB schema를 바꾸지 않는다. `SiteAdapters`에 파싱 분기를 계속 추가하지 않고
전환 완료 후에는 adapter 조립만 남기거나 registry로 통합한다.

분리 완료 기준은 다음과 같다.

1. 사이트별 adapter와 지원하는 목록·상세 parser가 독립 파일에 있고 서로 다른 사이트 구현에 의존하지 않는다.
2. 사이트별 fixture 테스트가 목록·pagination·본문 순서·이미지·첨부·SNS·삭제·빈 본문·중복 URL을 확인한다.
   이미지 없음·외부 링크만 있는 본문도 검사하고, 확인하지 못한 경우는 미검증으로 남긴다.
3. 분리 전후 fixture 결과와 canonical/post key가 같고, 공통 runner·중복 제거·dry-run 무쓰기 테스트가 통과한다.
   사이트만 수정하면 해당 fixture를 우선 실행하고, 공통 parser를 수정하면 영향받는 모든 사이트 fixture를 실행한다.
4. 테스트는 사이트별 패키지에 대응시킨다. 기존 fixture 경로는 먼저 보존하고 경로 이동 시 모든 참조를 함께 수정한다.
5. 파일 분리 완료와 실제 수집 완료는 따로 기록한다. fixture 통과는 live URL·DB/S3 readback·Discord Gateway
   검증을 대체하지 않으며 출처별 상태는 [검증표](../planning/content-collection/reference-site-validation.md)를 따른다.

## 4. Web

Nuxt 경로 규약을 유지한다. `app/pages`는 URL과 페이지 조립, `app/components`는 UI,
`app/composables`는 반응형 상태, `app/utils`는 순수 처리, `server/api`는 BFF,
`server/utils`는 identity adapter를 소유한다. 페이지 파일명과 공개 URL은 내부 패키지 정리로 변경하지 않는다.
다른 앱 source를 직접 import하지 않고 HTTP와 `packages/contracts`를 사용한다.

## 5. 검증과 운영 경계

`npm run test:architecture` 구조 검사는 API import 경계·Collector 패키지 순환과 금지 의존성·Web 앱 경계를 검사한다.
Core/브라우저 회귀, Spring 단위·프로세스·복구 시험, Docker build/운영 명령으로 경로와 실행을 확인한다.
`npm run verify:migration`은 9월 9일 전환용 고정 환경 검사이며 일반적인 새 체크아웃의 검증 명령이 아니다.
고정 container/branch/port 조건과 실행 경계는 [Docker 안내](../operations/docker.md), 현행 검증 명령은
[루트 README](../../README.md#검증)를 따른다. 당시 결과는 [전환 검증 보고](../../worklog/2026-09-09/nest-transition/REPORT.md)에 있다.
[이전 구현 검증 기록](../../worklog/2026-09-09/core-spring-verification/evidence.md)은 이전 M0/Spring 개별 검증 이력으로 구분한다.
구조 정리가 실제 출처·Discord·Keychain·launchd·7일 관찰의 완료를 의미하지 않는다.
