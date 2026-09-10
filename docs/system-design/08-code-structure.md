# M0 코드 구조와 의존성 계약

- 기준일: 2026-09-09
- 범위: M0 Core와 Spring 수집 보조의 내부 구조. API·DB·제품 동작과 운영 활성화 조건은 유지한다.
- 상위 계약: [아키텍처](01-system-architecture.md), [수집 서버](07-spring-collector-design.md), [수집 기획](../planning/content-collection/README.md)

## 1. 앱과 공유 계약

`apps/api`는 Nest Core (기본 Express 어댑터), `apps/web`은 Nuxt 화면·BFF, `apps/collector`는 운영자 로컬 Spring 서버다.
`packages/contracts`는 OpenAPI·검증·생성 타입이며 실행 앱이 아니다. `tools/collector`의 Python 구현은
기존 실행의 종료·전환을 위한 legacy이며 신규 기능을 추가하지 않는다.
collector → Web/BFF → Core 경계를 유지한다. Web에는 SQL·게시 상태 전이를, collector에는 서비스 DB·R2 자격을 두지 않는다.

## 2. Core API

2026-09-09 사용자 요청에 따라 NestJS + 엄격한 TypeScript + TypeORM으로 내부 구현을 전환한다.
현재 실행 전환 상태와 검증 결과는 [진행 기록](../migration/PROGRESS.md)을 따른다.

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

| 패키지 | 책임 |
| --- | --- |
| shared | JSON·공통 오류 |
| config | 비밀·운영 설정·DataSource 설정 |
| observability / lifecycle | 실행 계측 / 종료 gate |
| run | 요청 검증·중복 방지·실행 큐·이력 저장 |
| spool / state | 암호화 임시 파일 / 복구 상태 저장 |
| source / core | 외부 출처 transport·정책 / BFF를 통한 Core 연동 |
| execution | Batch 실행·6단계 pipeline·만료 복구 |
| web / discord / scheduling | REST / Discord / Quartz 진입점 |
| notification / maintenance | 알림·운영 이벤트 / 보존·정리 |
| bootstrap | 기동 검사·health·의존 서비스 지표 조립 |
| ops | migration·백업·복원·작업 조정 CLI |

진입점은 `run.CollectorRunService`를 호출한다. 공통 요청 검증은 `run`이 소유하고 `web`에 의존하지 않는다.
`run`은 execution·web·discord·scheduling을 참조하지 않는다. `source`, `core`, `spool`은 run·진입점을 참조하지 않는다.
execution은 run·state·source·core를 조합하며 web·discord·scheduling을 참조하지 않는다.
shared는 다른 내부 패키지를 참조하지 않고 config는 shared만 참조한다. 패키지 간 순환 참조를 허용하지 않는다.
테스트도 대상 패키지로 옮기며 fixture 설정은 테스트 source set에만 둔다. 운영 CLI의 FQCN 변경은
Gradle task·launchd 렌더러·운영 문서·프로세스 테스트와 함께 반영한다.

## 4. Web

Nuxt 경로 규약을 유지한다. `app/pages`는 URL과 페이지 조립, `app/components`는 UI,
`app/composables`는 반응형 상태, `app/utils`는 순수 처리, `server/api`는 BFF,
`server/utils`는 identity adapter를 소유한다. 페이지 파일명과 공개 URL은 내부 패키지 정리로 변경하지 않는다.
다른 앱 source를 직접 import하지 않고 HTTP와 `packages/contracts`를 사용한다.

## 5. 검증과 운영 경계

`npm run test:architecture` 구조 검사는 API import 경계·Collector 패키지 순환과 금지 의존성·Web 앱 경계를 검사한다.
Core/브라우저 회귀, Spring 단위·프로세스·복구 시험, Docker build/운영 명령으로 경로와 실행을 확인한다.
현재 Nest의 종합 실행은 `npm run verify:migration`이며 결과는 [전환 검증 보고](../migration/REPORT.md)에 기록한다.
[이전 구현 검증 기록](../implementation/m0-completion/evidence.md)은 이전 M0/Spring 개별 검증 이력으로 구분한다.
구조 정리가 실제 출처·Discord·Keychain·launchd·7일 관찰의 완료를 의미하지 않는다.
