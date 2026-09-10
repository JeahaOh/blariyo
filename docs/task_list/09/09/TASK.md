# Blariyo Express Core API → NestJS + TypeORM 전환 재개 지시

이 문서는 중단된 Blariyo Core API 재개발의 최종 작업 명세다.
계획·검토만 제출하지 말고 기존 산출물을 이어받아 구현, 전환, 검증,
정리와 문서 동기화까지 실제로 수행하라.

[0. 명시적인 재개 지시와 이전 중단 사유 해소]

- 이 지시를 전달하는 사용자는 이전의 작업 중단 요청을 철회하고,
  이 문서의 조건에 따라 개발을 재개하도록 명시적으로 승인한다.
- 이전 메시지의 “다음 조건을 변경한다:” 뒤에 조건 본문이 없어서
  대기하던 상황은 이 문서로 해소한다. 변경·확정 조건은 아래에 모두 있다.
  해당 과거 메시지의 나머지를 다시 요구하거나 재개 승인을 반복해서 묻지 않는다.
- 이전의 “파일 수정·테스트·프로세스 재시작을 하지 않고 중단 상태 유지”는
  당시 중단 기간에 적용된 지시다. 이번 재개 지시 이후에는 아래 범위의
  코드 수정, 테스트, 빌드 및 작업 전용 환경 기동을 수행한다.
- 다만 이 지시는 이후 사용자가 새로 내리는 중단·수정 요청까지 무시하라는
  의미가 아니다. 새로운 중단 요청과 실제 실행 권한·예산 제한은 존중한다.
- docs/migration/PROGRESS.md와 기존 설계·검증 기록부터 읽고 이어서 진행한다.
  처음부터 새로운 마이그레이션을 시작하거나 기존 산출물을 일괄 폐기하지 않는다.
- 이전 보고에는 공개 조회·이미지·게시물·정책·outbox·migration의
  Nest/TypeORM 코드 작성, health·예약 실패 알림 코드 보존,
  수집 legacy/V2·나머지 운영 경로·전체 연동 검증·주 실행 경로 교체의
  미완료와 기본 Express 실행 경로 유지가 기록되어 있다.
  이는 확인할 인계 정보이지 현재 구현·검증 완료의 확정 증거가 아니다.
- 실제 파일, 실행 연결과 테스트로 각 항목을 다시 확인하여
  “작성됨”, “실행 경로에 연결됨”, “검증됨”을 구분한다.
  적절한 기존 Nest/TypeORM 구현은 재사용·보완하고 미완료 부분을 이어서 구현한다.
- 이전 보고의 356개 파일·5개 변경 파일 등의 수치는 당시 기준선 정보다.
  현재 작업 범위를 그 파일 수로 제한하거나 모든 파일의 해시를
  끝까지 같게 유지해야 한다는 뜻으로 해석하지 않는다.
- 이전 작업 전용 PostgreSQL 컨테이너와 데이터는 보존된 것으로 보고되었다.
  실제 컨테이너·volume·DB 식별자와 소유 범위를 확인한 후 필요하면 재기동한다.
  보존된 데이터를 삭제·초기화하지 않는다. 초기화가 필요한 반복 테스트에는
  별도 작업 전용 DB 또는 컨테이너를 사용한다.

[1. 고정 목표와 변경 금지 조건]

1. 현재 main 작업 트리의 apps/api Express Core API를
   NestJS + TypeORM + TypeScript strict + 기능별 Repository 구조로 전환한다.
2. ORM은 TypeORM으로 확정한다. Prisma 등 다른 ORM으로 재선정하지 않는다.
3. 기존 PostgreSQL schema와 외부 API 계약을 유지하고 내부 구현을 전환한다.
   Nest·TypeORM에 맞추기 위해 DB 구조, API 또는 제품 정책을 바꾸지 않는다.
4. 기존 M0 기능이 범위다. M1·M1.5, 새로운 제품 기능, 무관한 프런트엔드 개편,
   마이크로서비스화, 불필요한 CQRS·이벤트 소싱 도입은 하지 않는다.
5. 현재 main에서 직접 작업한다. 새 브랜치·Git worktree를 만들지 않는다.
6. commit, amend, push, 태그·PR 생성, 배포를 하지 않는다.
   직접 실행뿐 아니라 다른 도구나 스크립트를 통한 자동 수행도 금지한다.
7. 기존 사용자 변경과 이전 세션 산출물을 보존한다.
   보존은 수정 금지가 아니라 기능·의도를 누락하거나 되돌리지 않는다는 뜻이다.
   필요한 소스 수정·이동·분리·교체와 검증 후 기존 코드 제거는 허용한다.
8. 아직 출시 전이므로 폐기할 Express 구조를 위한 영구적인 이중 실행,
   요청별 우회·fallback, 불필요한 호환 계층이나 무중단 전환 인프라는 만들지 않는다.
   구현 도중 미전환 코드가 잠시 남아 있는 것은 허용하지만 완료 상태가 아니다.
9. 실제 운영·공유 DB와 사용자 보유 데이터를 삭제·초기화하지 않는다.
   실제 출처 수집, Discord 실발송, 운영 계정 사용, 외부 서비스 활성화는 금지한다.
10. 이 문서와 충돌하는 이전의 사용자 작업 조건은 이 문서로 대체한다.
    적용되는 상위 안전·권한 지침은 준수한다. 완료를 위해 이 문서의
    제약·완료 조건을 스스로 완화하거나 검증 대상을 축소하지 않는다.

[2. 재개 기준선, Git 보호와 계약 정본 확인]

- 적용되는 AGENTS.md, docs/ai/README.md와 관련 프로젝트 스킬을 읽는다.
  express-to-nest 등 관련 스킬이 실제로 존재하면 사용하되,
  ORM 재선정·새 브랜치·커밋 등 이번 고정 조건과 충돌하는 관행은 적용하지 않는다.
  없는 스킬을 있다고 가정하거나 불필요한 외부 스킬 설치로 착수를 지연하지 않는다.
- 현재 브랜치, HEAD, index, unstaged·untracked 변경과 실제 저장소 구조를 확인한다.
  main이 아니면 임의로 checkout하지 말고 해당 쓰기 작업의 차단 사유를 알린다.
  이전 기록과 HEAD가 달라도 과거 HEAD로 되돌리지 말고 차이를 확인한다.
- 코드 작업의 기준은 재개 시점 파일시스템 작업 트리다.
  미추적 소스·문서와 이전 세션에서 작성한 코드도 포함한다.
  HEAD, origin/main, 깨끗한 clone만을 기준으로 삼지 않는다.
- index에 저장된 내용은 사용자 staging 기록으로 보존한다.
  git add, rm --cached, reset 등으로 index를 임의 변경하지 않는다.
  작업 트리 수정에 따라 git status 표시가 바뀌는 것까지 금지하는 것은 아니다.
- stash, reset, clean, restore/checkout에 의한 변경 폐기,
  pull, merge, rebase 및 강제 Git 작업은 하지 않는다.
- 기존 기준선·해시·백업 기록을 재사용하고 재개 시점의 변경 목록을 추가한다.
  필요한 변경 대상은 허용된 로컬 위치에 비파괴적으로 보존하되,
  비밀정보를 패치·문서·로그에 복사하지 않는다.
- 수정 직전에 파일을 읽고, 재개 이후 다른 주체가 변경한 부분도 다시 대조한다.
  광범위한 포맷팅이나 무관한 파일 수정으로 사용자 변경을 섞지 않는다.
- 코드 작업 기준과 계약 보존 기준을 구분한다.
  계약 기준은 기존 마이그레이션 착수 당시의 정본 OpenAPI·공유 생성 타입,
  관련 명세와 기존 migration으로 재현되는 M0 schema다.
  현재 미완성 Nest 코드의 동작을 새 계약 기준선으로 삼지 않는다.
- planning, system-design, development-specs, OpenAPI, 공유 타입,
  기존 Express 구현과 테스트를 대조하고 저장소의 정본 우선순위를 확인한다.
- “API 계약 보존”은 명확한 정본에 부합하는 동작의 보존을 의미한다.
  기존 구현이 명확한 정본을 위반하면 근거·영향·회귀 테스트를 남겨
  구현을 정본에 맞추되 계약 문서를 새 구현에 맞춰 변경하지 않는다.
  정본에 없는 동작은 기존 Express 동작과 테스트를 기준으로 보존한다.
- 정본끼리 충돌하거나 외부 계약 변경 없이는 해결할 수 없는 사항은
  해당 항목만 판단 보류로 기록하고 독립적으로 가능한 작업을 계속한다.
- 기존 계약 기준선을 확보할 수 없다면 그 한계를 기록한다.
  근거가 없는데도 schema·API 무변경을 검증했다고 보고하지 않는다.

[3. 기존 설계·기능 목록 갱신과 재개 순서]

- 기존 PLAN.md, DECISIONS.md, PROGRESS.md, REPORT.md를 읽고 갱신한다.
  이미 타당한 설계를 이유 없이 전면 재작성하지 않는다.
  추가 구현 전에 달라지는 설계와 완료 체크리스트를 기록한다.
- Node.js, TypeScript, 모듈 시스템, 패키지 매니저, lockfile,
  앱·운영 진입점, Docker, 기존 CI와 실행·테스트 명령을 조사한다.
- NestJS, @nestjs/typeorm, typeorm, PostgreSQL driver와 Node.js의
  호환 근거를 공식 문서·공식 패키지 메타데이터로 확인한다.
  기존에 선정한 호환 버전은 존중하고 필요한 변경만 lockfile에 반영한다.
- 기존 M0 기능·엔드포인트·운영 명령·테스트 대응표를 보완한다.
  각 항목에 정본, 기존 구현, 새 Module·Controller·Service·Repository/Adapter,
  DB·동시성 요구, 검증 테스트·실행 명령과 결과를 연결한다.
  모든 기존 항목을 추적하되 파일·클래스 수의 기계적인 1:1 대응은 강제하지 않는다.
- 이미 확보한 Express 기준선은 재사용하되 현재 코드와 관계를 확인한다.
  필요한 누락 검증만 보완하고, 기존 실패와 전환으로 발생한 실패를 구분한다.
  과거 Express 통과 기록은 최종 Nest 검증의 대체 증거가 아니다.
- 기본 재개 순서는 다음과 같다. 실제 의존관계에 따라 조정하고 이유를 기록한다.
  A. 기존 Nest/TypeORM 코드와 기록을 대조하고 실행 연결·결함을 확인한다.
  B. 수집 legacy/V2 및 미완료 운영·백그라운드 경로를 완성한다.
  C. 미완료 DB·Adapter·트랜잭션 경계를 전환한다.
  D. 모든 M0 기능의 연결을 확인한 뒤 주 실행 경로를 Nest로 교체한다.
  E. 전체 검증, 실패 수정, 기존 구현 정리와 문서 동기화를 수행한다.
- 실제 구현 진행 없이 조사·계획·현황 보고만 반복하지 않는다.

[4. Nest 구조와 의존성 경계]

기본 구조:
Controller → Service/Use Case → Repository·Adapter·트랜잭션 계약
→ TypeORM Repository·외부 Adapter·트랜잭션 구현

- 업무 도메인별 Nest Module을 구성하고 Provider와 명시적 DI로 연결한다.
- Controller는 HTTP 입력·응답, 검증된 입력 전달과 유스케이스 호출에 집중한다.
- Service/Use Case는 업무 규칙, 상태 전이, 처리 순서,
  트랜잭션 범위와 필요한 보상 처리를 담당한다.
- Repository는 DB 조회·저장·원자적 연산과 쿼리 구성을 캡슐화한다.
- 저장소·CDN·인증·알림 등 외부 연동은 주입 가능한 Adapter 계약과 구현으로 분리한다.
- 설정 검증, 인증·인가, 요청 검증, 오류 응답, 로그,
  readiness/liveness, 유지보수 모드와 정상 종료를 Nest 구조에 통합한다.
  Guard, Pipe, Filter, Interceptor와 lifecycle hook을 책임에 맞게 사용한다.
- 기존 Express router 전체를 단일 Controller로 감싸거나
  모든 요청을 기존 분기 코드로 위임하는 방식은 전환으로 인정하지 않는다.
- 기존 Service의 이름만 바꾸거나 거대한 단일 Module로 옮기지 않는다.
  불필요한 단순 위임 계층·만능 공통화·범용 BaseRepository를 만들지 않는다.
- 특별한 이유가 없으면 Nest의 Express HTTP adapter를 유지한다.
  제거 대상은 기존 직접 작성한 Express 실행 구조이지 adapter 의존성 자체가 아니다.
- 일반 JSON API에 Express Request/Response를 전파하지 않는다.
  raw body·multipart·파일·스트림 등 필요한 예외만 HTTP 경계에 격리한다.
- 기능 간 허용·금지 의존성을 문서화하고 자동 검사한다.
  순환 참조, 전역 서비스 로케이터, 거대한 전역 모듈화와
  forwardRef로 구조 문제를 덮는 방식을 사용하지 않는다.
- 운영 명령·worker도 동일한 DI·설정·유스케이스를 재사용한다.
  HTTP가 필요 없는 명령은 적절한 application context를 사용하고,
  명령 실행 때 불필요한 listener·scheduler·worker가 시작되지 않게 한다.

[5. 엄격한 TypeScript와 런타임 입력 검증]

- Core API 실제 실행 코드와 관련 운영 진입점을 TypeScript로 전환한다.
  strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes를 적용한다.
- 직접 작성한 앱·테스트·TypeScript 운영 코드가 적절한 설정으로 검사되게 한다.
  생성 코드·외부 라이브러리·기존 SQL migration을 억지로 재작성하지 않는다.
- DTO, 업무 입력·출력, Repository 반환값, 환경 설정,
  인증 사용자와 Adapter 계약을 명시한다.
  HTTP DTO·업무 모델·TypeORM Entity의 책임을 구분한다.
- 기존 OpenAPI와 공유 생성 타입을 기준으로 런타임 DTO의 일치를 검증한다.
  별도의 Swagger/OpenAPI 정본이나 충돌하는 API 타입을 새로 만들지 않는다.
- 외부 입력·외부 응답·raw SQL 결과를 근거 없이 신뢰하지 않는다.
  unknown과 실제 검증·narrowing을 사용하고, DTO의 런타임 검증 경로를 확인한다.
- 타입 정리를 이유로 입력 허용 범위, 알 수 없는 필드 처리,
  자동 변환, 기본값, null/undefined 의미와 오류 응답을 바꾸지 않는다.
  ValidationPipe의 whitelist·forbidNonWhitelisted·transform 등을
  일괄 강화하지 말고 기존 계약에 맞게 명시적으로 구성한다.
- any, @ts-ignore, @ts-nocheck, 이중 타입 단언으로 오류를 숨기지 않는다.
  직접 작성한 코드를 검사에서 제외하거나 설정을 완화해 통과시키지 않는다.
- 필드 선언의 definite assignment assertion(!)은 DI·ORM 로딩·DTO 변환과
  필수값 검증 등 실제 초기화·검증 경로를 확인한 경우에만 제한적으로 사용한다.
  decorator가 있다는 이유만으로 필드의 존재·초기화를 보장한다고 가정하지 않는다.
- 외부 라이브러리 제약의 불가피한 예외는 최소 경계에 격리하고
  이유·범위·대체 검증을 기록한다. 일반적인 타입 회피 수단으로 확장하지 않는다.

[6. Repository와 TypeORM 전면 적용]

- HTTP, 수집, batch, queue, scheduler, outbox, 정리 작업과 운영 명령 등
  모든 DB 접근을 기능별 Repository 또는 명시된 DB 인프라 경계로 옮긴다.
  객체 저장소 등 DB 밖의 영속성 접근은 별도 Adapter 경계로 분리한다.
- Repository 계약과 TypeORM 구현을 분리하고 Symbol 또는 추상 클래스 등
  런타임 토큰과 Nest Provider를 구성한다.
- Controller·Service에는 SQL이나 TypeORM/pg 직접 의존성을 남기지 않는다.
  DataSource, EntityManager, QueryRunner, QueryBuilder, ORM Repository,
  pg Pool/Client를 직접 사용하거나 SQL을 만들어 하위 계층에 전달하지 않는다.
- TypeORM 사용은 Repository 구현, Entity 매핑, 연결·종료 관리,
  Unit of Work와 migration 등 명시된 DB 인프라 계층에 한정한다.
  DB 연결·transaction 인프라까지 Repository 클래스 안에 억지로 넣지 않는다.
- Repository 계약에 ORM Entity·전용 쿼리 옵션·transaction 객체를 노출하지 않는다.
  업무 의미를 드러내는 입력·출력과 원자적 메서드를 설계한다.
- 일반 조회·저장은 실제 TypeORM Entity·Repository·QueryBuilder로 전환한다.
  TypeORM 패키지만 설치하거나 기존 SQL 전체를 범용 query 래퍼로 옮긴 상태는
  ORM 전환 완료로 인정하지 않는다.
- PostgreSQL 고유 기능·복잡한 SQL은 필요한 범위에 한해
  Repository 또는 전용 DB 인프라 안의 매개변수화 SQL로 유지할 수 있다.
  반드시 TypeORM이 관리하는 연결·transaction을 사용하고 예외별 근거를 기록한다.
- pg가 TypeORM의 PostgreSQL driver 의존성으로 남는 것은 허용한다.
  제거 대상은 애플리케이션의 독립적인 직접 pg 연결·쿼리 경로다.
- Entity/DB 행과 업무 모델을 명시적으로 매핑한다.
  numeric/Decimal·BigInt·Date·timezone·JSON·null 변환과 API 직렬화를 확인한다.
- N+1, 무제한 조회, 정렬·페이지네이션·필터 누락과 인덱스 사용을 점검한다.
  인덱스 문제를 발견해도 schema 불변 조건을 깨고 임의로 인덱스를 추가하지 않는다.
  쿼리·매핑을 먼저 수정하고 schema 변경이 필요한 문제는 별도로 보고한다.
- 금지 의존성을 lint/import 규칙 또는 아키텍처 테스트로 검사한다.
  DB 인프라 예외 목록은 좁게 유지한다.

[7. 트랜잭션·잠금·동시성 계약]

- Service가 업무 단위의 transaction 범위를 결정하되,
  ORM에 독립적인 Unit of Work 또는 동등한 계약으로 실행한다.
- 하나의 transaction에 참여하는 모든 Repository와 raw SQL은
  동일한 transactional EntityManager/QueryRunner와 연결을 사용한다.
  전역 Repository, 별도 Pool 또는 다른 연결로 transaction을 이탈하지 않는다.
- 요청별 transaction 상태를 가변 singleton 필드에 저장하지 않는다.
  선택한 전달 방식의 동시 요청 격리와 종료 후 정리를 검증한다.
- 기존 isolation, row/advisory lock의 범위·수명·획득 순서,
  timeout·재시도·rollback 계약을 확인하고 보존한다.
  session lock과 transaction lock을 임의로 치환하지 않는다.
- idempotency, quota, lease, execution/version fencing, 조회 수와 상태 전이의
  조건부 원자적 갱신 및 영향받은 행 수 검사를 보존한다.
  조회 후 save하는 방식으로 경쟁 조건을 새로 만들지 않는다.
- version decorator 도입만으로 기존 fencing이 보장된다고 가정하지 않는다.
  stale execution·stale version·lease 재획득과 경쟁 요청 결과를 테스트한다.
- outbox 기록과 업무 상태 변경의 원자성, 중복 처리와 재시도 계약을 보존한다.
- 외부 업로드·삭제의 부수효과는 기존 보상·재처리 정책에 맞춰 처리한다.
  DB rollback이 외부 부수효과까지 취소한다고 가정하지 않는다.
- 실제 PostgreSQL의 독립된 여러 연결로 잠금·경쟁·중복·rollback을 검증한다.
  단일 연결의 순차 테스트만으로 동시성 검증을 완료 처리하지 않는다.

[8. Schema 무변경과 migration 단일 경로]

- 테이블·컬럼·타입·nullability·default·PK/FK·unique·check·인덱스와,
  존재하는 sequence·enum·view·trigger·권한·RLS 등 기존 DB 계약을 유지한다.
- Entity 테이블·컬럼·관계 매핑을 실제 schema에 맞춘다.
  naming strategy, cascade, eager/lazy loading, soft delete,
  자동 timestamp/version 처리로 구조나 업무 동작을 바꾸지 않는다.
- 애플리케이션 기동에서는 synchronize: false,
  dropSchema: false, migrationsRun: false를 명시한다.
  migration은 명시적인 운영 명령으로만 실행한다.
- TypeORM 도입이 내장 migration 러너 교체를 뜻하지 않는다.
  기존 migration 파일·식별자·순서·이력 테이블·checksum·잠금과
  transaction 실행 정책을 보존하는 단일 경로를 기본으로 유지한다.
- 필요한 연결·실행부는 TypeORM DB 인프라로 통합하되
  기존 migration 내용·적용 이력·checksum을 재작성하거나 초기화하지 않는다.
  TypeORM용 이력·metadata 테이블을 임의 추가하거나 이중 관리하지 않는다.
- 신규 DDL이나 형식적인 no-op migration을 이번 전환을 위해 만들지 않는다.
  자동 생성 schema diff를 자동 적용하지 말고 예상 밖 차이는 매핑부터 수정한다.
- “schema 무변경”은 이번 전환이 기존 M0 schema에 새 구조 변경을
  도입하지 않는다는 뜻이다. 빈 격리 DB에 기존 migration을 적용하거나
  격리 복원으로 동일한 schema를 재현하는 작업은 허용한다.
- 신규 설치·전환·복원 검증에 필요한 합성 fixture/seed와 준비 명령을
  재현 가능하게 구성한다. 실제 사용자 데이터를 fixture로 복사하지 않는다.
- 서로 다른 작업 전용 PostgreSQL에서 다음을 실제 검증한다.
  A. 빈 DB에 보존된 migration으로 M0 신규 설치 후 Nest와 운영 명령 실행.
  B. 기존 M0 schema·migration 이력·합성 데이터가 있는 상태에서
     새 기동·migration 경로 실행 후 이력·checksum·데이터 보존 확인.
- 전환 전후 PostgreSQL catalog 또는 정규화한 schema dump를 비교한다.
  ORM이 표현하지 못하는 DB 객체도 포함하여 구조·제약·인덱스 보존을 확인한다.
- schema 변경 없이는 해결할 수 없는 사항은 임의 DDL로 해결하지 않는다.
  근거와 필요한 결정을 기록하고 독립적인 작업을 계속한다.

[9. 누락 없이 보존할 M0 기능과 외부 계약]

아래 목록과 실제 저장소 조사 결과를 기능 대응표에 모두 반영한다.

- 공개 게시판 목록·상세·조회 수·정책 조회.
- 관리자 초안 작성·수정·수동 발행·예약 발행·숨김·삭제.
- 이미지 검증·재인코딩·업로드·보상 처리.
- 정책 artifact 검증·발행과 공개 조건.
- 수집 출처·후보·검수·반려·초안 승격.
- Collector legacy/V2 계약과 명시된 전환 절차.
- 인증·권한·입력 검증·오류 응답·헤더·쿠키.
- idempotency·quota·lease·execution/version fencing.
- outbox·정리·예약 실패 알림.
- migration·예약 발행·정책 발행·수집 전환 등 운영 명령.
- readiness/liveness·유지보수 모드·정상 종료.
- Nuxt BFF와 Spring Collector 연동.

추가 보존 조건:

- 유효한 Collector legacy 계약과 폐기할 Express 구현을 혼동하지 않는다.
  프레임워크 전환 때문에 Collector 계약·전환 절차를 삭제하지 않는다.
- URL, HTTP method, 상태 코드, Content-Type, JSON 필드·직렬화,
  오류 코드·응답 형태, 캐시·인증·보안 헤더와 쿠키를 보존한다.
- 빈 본문·204·redirect·HEAD/OPTIONS, query 변환,
  multipart 크기·개수 제한, 파일·스트림과 raw body 등 해당 항목을 검증한다.
- Nest의 기본 POST 상태 코드, 예외 응답, body parser,
  DTO 변환·직렬화가 기존 계약을 바꾸지 않도록 명시적으로 설정한다.
- 존재하는 webhook 서명, CORS, proxy, 공개 조건,
  정렬·페이지네이션·삭제 데이터 처리와 보존 정책을 유지한다.
- 동적으로 생성되는 값은 계약상의 의미·형식·제약을 검증한다.
  timestamp·request ID 등 매 실행마다 다른 값의 단순 문자열 동일성을 요구하지 않는다.
- 운영 명령의 인자·환경변수·종료 코드·부수효과를 보존한다.
  내부 파일·빌드 경로 변경은 실행 스크립트와 문서에 연결한다.
- Nuxt BFF나 Spring Collector를 변경해 Core API 계약 위반을 숨기지 않는다.
  필요한 내부 연결·설정·테스트 변경만 최소 범위로 수행한다.

[10. 테스트·빌드·연동·복구 필수 검증]

- 도메인별로 HTTP/운영 진입점부터 DB·테스트까지 연결되는 묶음으로 구현한다.
  각 묶음마다 타입 검사·관련 테스트를 실행하고 실패를 수정한다.
- Service 단위 테스트에는 Repository 계약의 대역을 사용할 수 있다.
  Repository·migration·transaction·동시성 검증은 실제 격리 PostgreSQL로 수행한다.
  다른 DB 엔진이나 mock으로 필수 DB 검증을 대체하지 않는다.
- 기존 테스트를 새 Nest 코드와 실제 진입점에 연결한다.
  assertion 약화, 무분별한 skip/삭제, 자동 snapshot 승인,
  no-tests 성공 옵션, 하드코딩 성공 응답으로 통과를 위장하지 않는다.
- Express 내부에만 결합된 테스트는 동일한 외부 행동을 검증하도록 바꾸고
  변경 이유와 보존한 검증 내용을 기록한다.
  명확한 정본 위반 기대값의 수정에는 정본 근거와 회귀 테스트를 남긴다.
- 각 기능에 적용되는 정상 동작뿐 아니라 입력 오류, 인증 실패, 권한 부족,
  리소스 없음, 중복·상태 충돌, 업로드 실패·보상과 rollback을 검증한다.
- 기존 Nest 부분 구현의 과거 통과 기록도 최종 코드의 전체 통과 증거가 아니다.
  작성된 테스트가 아직 Express를 호출하지 않는지 확인한다.
- 기존 패키지 매니저에 맞춰 verify:migration 또는 동등한
  단일 종합 검증 진입점을 구성·정비하고 다음을 실제 실행한다.
  실행 순서는 자원 준비와 의존관계에 맞춰 조정한다.

  1. 앱·테스트·운영 코드의 strict 타입 검사.
  2. lint와 모듈·Repository·ORM 의존성 구조 검사.
  3. 단위 테스트.
  4. 실제 PostgreSQL Repository·transaction·잠금·동시성 통합 테스트.
  5. 빈 DB 설치, 기존 M0 전환, migration 이력·checksum·데이터 보존 검증.
  6. schema 무변경과 OpenAPI·공유 API 계약 보존 검증.
  7. 모든 M0 API·운영 기능 대응표에 연결된 계약·E2E 테스트.
  8. production build와 빌드 산출물로 기동한 서버의 주요 API smoke test.
  9. 실제 Nuxt BFF와 실제 브라우저의 M0 사용자·관리자 흐름 회귀 테스트.
  10. 실제 Spring Collector 프로세스와 Core API 연동,
      중단·재시작·중복 요청·lease/fencing·복구 시나리오.
  11. 최종 작업 트리의 Docker image build·기동·readiness/liveness,
      유지보수·정상 종료와 운영 명령 실행 검증.
  12. 작업 전용 합성 DB 백업, 별도 격리 DB 복원과
      복원 schema·데이터·migration 이력·주요 API 동작 검증.
  13. 기존 Express 직접 구현·중복 실행 경로·임시 전환 코드 잔존 검사.

- 브라우저 검증은 실제 브라우저로 수행하며 headless 실행도 허용한다.
  API 요청이나 HTML 문자열 조회만으로 브라우저 검증을 대체하지 않는다.
- Spring Collector는 실제 애플리케이션 프로세스로 실행한다.
  외부 출처·저장소·CDN·알림 등은 합성 데이터와 로컬 대역을 사용할 수 있지만,
  BFF·브라우저·Collector·PostgreSQL 자체의 필수 실프로세스 검증은 대체하지 않는다.
- Docker는 미커밋 변경을 포함한 최종 작업 트리로 빌드한다.
  과거 image·HEAD 기반 산출물·개발 서버 실행을 최종 production 검증으로 재사용하지 않는다.
- 필수 도구·권한이 없으면 설치·실행이 허용된 범위에서 해결하고,
  해결 불가능한 검증은 BLOCKED로 기록한다. 다른 실행 가능한 작업은 계속한다.
- 필수 검증이 실패·미실행·차단이면 종합 결과를 성공으로 처리하지 않는다.
  실패 종료 코드를 숨기지 말고 명령·환경·결과·로그 위치를 기록한다.
- 실패 원인을 수정한 뒤 영향받는 검증을 재실행한다.
  원인·접근 변경 없이 같은 실패를 반복하거나 우연한 통과만 고르지 않는다.
- 완료 직전 최종 기능 대응표를 다시 감사하고 종합 검증을 재실행한다.
  이후 코드·설정·의존성·검증 스크립트가 바뀌면 필요한 최종 검증을 갱신한다.
  결과 문서·로그만 갱신한 것을 이유로 무한 재검증하지 않는다.

[11. 실행 자원과 데이터 안전]

- 스크립트 이름이 test라는 이유만으로 안전하다고 판단하지 않는다.
  실행 전 연결 대상·부수효과·migration/reset 동작과 외부 호출을 확인한다.
- NODE_ENV=test만으로 격리 DB를 판정하지 않는다.
  호스트·포트·DB 이름·소유 자원과 안전 설정을 확인한다.
- 이전에 보존한 PostgreSQL 컨테이너·volume은 무작정 삭제하지 않는다.
  작업 전용임을 확인할 수 없으면 읽기 전용으로 조사하고 별도 격리 자원을 만든다.
- 새 테스트 자원은 작업 전용 이름·포트·데이터 위치로 생성하고 기록한다.
  파괴적 초기화는 새로 만든 폐기 가능한 자원에만 한정한다.
- 운영·공유 DB에 migration/reset/drop/truncate를 실행하거나,
  사용자 데이터로 임의 백업·복원 테스트를 하지 않는다.
- 실제 비밀키·개인정보·운영 토큰을 fixture·로그·문서에 남기지 않는다.
  로컬 대역 설정으로 실제 수집·저장소 삭제·Discord 발송을 방지한다.
- 다른 개발 서버·컨테이너·volume을 종료하거나 Docker 전역 prune을 하지 않는다.
- 종료 시 이번 작업이 시작한 프로세스는 정상 정리하고,
  새 폐기 자원은 해당 자원만 제거한다.
  이전에 보존한 컨테이너·volume은 원칙적으로 다시 정상 종료하여 보존한다.
- 새 사용자 중단 요청이 들어오면 안전한 지점에서 멈추고
  코드·재개 기록·필요한 테스트 데이터와 자원 상태를 보존한다.
- 필요한 권한이 없으면 우회·권한 확대를 하지 않는다.
  실제로 필요한 대상과 행위를 구체적으로 알리고 독립적인 작업을 계속한다.

[12. 기존 코드 정리와 문서 동기화]

- 기능 이전·실행 연결·검증이 확인된 뒤 기존 Express 진입점,
  router·middleware·중복 Service·직접 DB 접근·임시 bridge를 정리한다.
- 이전 코드라는 이유만으로 미전환 기능, 사용자 변경 또는
  Collector legacy 계약·운영 절차를 삭제하지 않는다.
- 개발·production·테스트·Docker·운영 명령의 최종 실행 경로를 Nest로 통일한다.
  숨겨진 Express fallback이나 환경에 따른 이중 업무 실행을 남기지 않는다.
- src와 dist의 Entity·Module·migration 탐색 및 build 정리를 확인하여
  중복 로딩과 이전 산출물 실행을 방지한다.
- scripts, 환경변수 예시, 설정, Dockerfile/Compose, 기존 CI,
  lockfile과 운영 실행 문서를 새 구조에 맞춘다.
  로컬 Docker 검증은 수행하되 배포는 하지 않는다.
- planning, system-design, development-specs, README, docs/ai의
  내부 구조·실행 정보와 실제 코드의 불일치를 해소한다.
- OpenAPI·공유 타입은 계약 보존을 검증하고 불필요하게 변경하지 않는다.
  생성 산출물을 갱신했다면 의미상 API 차이가 없는지 확인한다.
- docs/migration의 기존 기록을 유지하면서 다음을 갱신한다.
  TASK.md: 이번 사용자 지시와 고정 완료 조건. 임의 완화 금지.
  PLAN.md: 단계, 기능·API·운영 명령 대응표와 검증 매핑.
  DECISIONS.md: 모듈 경계, TypeORM 버전·매핑, transaction·migration 설계 근거.
  PROGRESS.md: 완료·미완료·차단, 변경 파일, 최근 결과, 자원 상태와 다음 명령.
  REPORT.md: 최종 구조, 실행·운영·검증 방법, 계약 보존 근거와 미검증 항목.
- 과거 중단·실패·Express 검증 기록을 삭제하거나 현재 통과 기록으로 바꾸지 않는다.
  재개 사실과 현재 결과를 구분하여 남긴다.
- 최종 감사에서 불필요한 추상화·임시 코드·중복 타입·죽은 코드를 제거한다.
  필수 기능을 TODO·빈 메서드·고정 성공 응답으로 남기지 않는다.

[13. 최종 완료 조건]

다음 조건을 모두 충족한 경우에만 [DONE_LOCAL]로 판정한다.

- [ ] main의 실제 작업 트리를 기준으로 작업했으며 사용자 변경과 기존 산출물이 보존됐다.
- [ ] 기본 개발·production·Docker·운영 진입점과 업무 처리가 Nest로 전환됐다.
- [ ] 도메인별 Module·Controller·Service·Repository·Adapter와 DI가 실제로 동작한다.
- [ ] Controller·Service에 SQL·ORM·DB driver 직접 의존성이 없고,
      TypeORM 사용은 Repository와 명시된 DB 인프라 경계에 제한됐다.
- [ ] strict 및 강화 옵션의 타입 검사와 구조 검사가 통과했고 타입 회피가 없다.
- [ ] 일반 DB 처리가 실제 TypeORM으로 전환됐고 raw SQL 예외는 제한·문서화됐다.
- [ ] transaction 공유·잠금·원자적 갱신·idempotency·quota·lease·fencing·outbox를
      실제 PostgreSQL에서 검증했다.
- [ ] 기존 M0 schema·API 계약·migration 이력·checksum과 데이터 보존을 검증했다.
- [ ] 수집 legacy/V2를 포함한 모든 M0 기능·API·운영 명령에 누락이 없다.
- [ ] [10]의 모든 필수 검증이 최종 Nest 코드에서 실제 실행되어 통과했다.
      브라우저·실제 Collector·Docker·백업·격리 복원을 생략하지 않았다.
- [ ] 기존 Express 직접 구현, 중복 실행 경로, 임시 전환 코드와 placeholder가 정리됐다.
      Nest Express adapter 및 TypeORM의 pg driver 의존성은 미전환으로 보지 않는다.
- [ ] 설정·scripts·Docker·lockfile·기존 CI·설계·개발 명세·README·검증 기록이 일치한다.
- [ ] 테스트 자원이 안전하게 정리되었고 보존 대상 컨테이너·데이터가 유지됐다.
- [ ] 작업 중 commit·push·배포·임의 staging·브랜치 전환을 수행하지 않았다.
- [ ] 실제 출처·Discord·운영 계정·실제 배포·7일 관찰 등의 외부 운영 검증은
      로컬 완료 조건과 구분하여 미수행 항목으로 표시했다.

필수 로컬 검증이 실패·미실행·차단인 상태에서는 DONE_LOCAL로 보고하지 않는다.
외부 운영 실값이 없다는 이유로 로컬 구현을 멈추지 않으며,
필수 로컬 검증을 외부 운영 항목으로 바꿔 완료 조건에서 빼지도 않는다.

[14. 자율 진행·목표 상태·인계와 최종 보고]

- 계획 제출, 일부 모듈 작성, 타입 검사 또는 빌드 성공만으로 종료하지 않는다.
  조사 → 구현 → 검증 → 실패 수정 → 재검증 → 정리·문서 동기화를 이어간다.
- 범위 안의 파일명·패키지 배치·모듈 경계·구현 선택은 근거를 기록하고 진행한다.
  각 단계마다 “계속할까요?”를 묻지 않는다.
- 목표 기능이 제공되면 이 명세를 참조하는 작업 목표를 지원되는 수단으로
  설정·갱신한다. 이전 “조건 본문과 재개 지시 대기” 사유는 해소되었다고 기록한다.
  실제 목표 상태 전환은 런타임 권한 안에서 수행하고 성공 여부를 확인한다.
- 목표 상태 전환에 별도 사용자 조작이 필요한 경우 정확히 알린다.
  지원되지 않는 도구를 사용했다고 주장하거나 임의 우회하지 않는다.
  현재 요청으로 허용된 구현 작업이 가능하다면 그 작업은 계속한다.
- 새 권한·정보·계약 결정이 실제로 필요할 때만 구체적으로 요청한다.
  차단되지 않은 필수 작업은 먼저 수행하고 같은 대기 알림을 반복하지 않는다.
- 실행 예산·사용량 제한을 무시하거나 변경하지 않는다.
  토큰 소모 자체를 목표로 삼지 말고 완료되면 종료한다.
- 작업 묶음마다 PROGRESS.md를 갱신한다. 컨텍스트 압축·재개 시 기록과
  실제 파일을 읽고 이어서 진행하며 이미 완료한 작업을 이유 없이 다시 작성하지 않는다.
- 핵심 진행 상황은 현재 단계·직전 검증·다음 작업 중심으로 한국어로 짧게 보고한다.
- 실행 한도나 안전상 이유로 중단이 불가피하면 다음을 저장소에 남긴다.
  완료·미완료 항목, 사용자 변경과 이번 변경의 구분, 변경 파일,
  핵심 결정, 실패·차단 원인, 마지막 명령·결과·코드 상태,
  생성·보존한 자원과 종료 여부, 다음 실행 명령과 재개 지점.
- 아래 표기는 사용자 보고 상태이며 런타임 내부 상태 이름을 가정하지 않는다.
  [DONE_LOCAL]: 모든 필수 로컬 완료 조건 충족.
  [BLOCKED]: 필요한 권한·정보·환경·계약 결정 때문에 필수 조건 미충족.
  [IN_PROGRESS]: 실행 한도로 중단했으며 필수 작업과 재개 기록이 남음.
  [PAUSED]: 사용자의 새로운 명시적 중단 요청에 따라 안전하게 멈춤.
- 최종 보고에는 다음을 한국어로 명시한다.
  1. 실제 변경 구조와 주요 Module·Repository·Adapter.
  2. TypeORM 버전·적용 방식과 transaction·migration 설계 근거.
  3. schema·API 계약 및 사용자 변경 보존 결과.
  4. 실제 검증 명령과 PASS/FAIL/BLOCKED 결과, 해당 코드 상태와 기록 위치.
  5. 실행·운영 방법과 주요 문서 위치.
  6. 남은 필수 작업과 별도의 외부 운영 미검증 항목.
  7. 테스트 자원 종료·정리·보존 상태.
  8. 현재 브랜치·HEAD와 commit·push·배포·staging 미수행 확인.

지금 적용 지침과 docs/migration/PROGRESS.md, 현재 main 작업 트리,
기존 Nest/TypeORM 산출물 및 보존된 테스트 자원부터 확인하라.
이전 중단 상태를 확인하는 보고만 반복하지 말고,
이번 명시적 재개 지시에 따라 남은 구현과 최종 검증까지 이어서 수행하라.