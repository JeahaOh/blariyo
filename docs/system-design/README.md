# 블라리요 시스템 설계

- 문서 상태: M0 공통 기술 계약과 M1·M1.5 확장 계약 · 신규 개발 기준
- 기준일: 2026-09-02
- 정합성 검토일: 2026-09-02
- 상위 기획: [서비스 기획서](../planning/01-service-plan.md)
- 수집 상위 기획: [콘텐츠 수집 기획](../planning/content-collection/README.md)
- 화면 상위 정본: [화면 설계](../planning/03-screen-design.md)
- 정적 검토물: [반응형 퍼블리싱](../publishing/responsive/README.md)
- 데이터베이스 결정: [2026-08-14 PostgreSQL 전환 결정](../../worklog/session-log/2026-08-14-postgresql-transition.md)

이 디렉터리는 확정된 기획을 구현 가능한 기술 계약으로 구체화한다. `docs/planning`은 무엇을 만들지 정의하고, 이 디렉터리는 컴포넌트 경계, 데이터 구조, API, 배포와 운영 방식을 정의한다.

## 문서 책임과 우선순위

| 계층 | 답하는 질문 | 포함하는 내용 | 포함하지 않는 내용 |
| --- | --- | --- | --- |
| planning | 무엇을, 어느 단계에, 어떤 제품 규칙으로 만드는가 | 범위·운영 정책·화면·수용 기준 | SQL 자료형·endpoint payload·container 설정 |
| system-design | 확정 요구사항을 어떻게 구현하는가 | 컴포넌트·DB·API·인프라·보안 계약 | 제품 범위의 독자적 변경 |
| executable artifacts | 계약이 실제로 구현됐는가 | migration·OpenAPI·source·test·Compose | 미구현 설계를 구현 완료로 간주하는 설명 |

제품 범위가 충돌하면 planning을 먼저 고치고 system-design을 맞춘다. 구현 세부가 충돌하면 해당 system-design 문서가 우선한다. 실행 산출물이 system-design과 다르면 구현 완료가 아니라 drift로 판정한다.

## 현재 준비 상태

2026-09-07 사용자 결정에 따라 기존 애플리케이션 프로토타입을 이어 개발하지 않고 새로 구현한다.
기존 source·migration·생성 타입·테스트 결과는 새 구현의 완료 근거로 승계하지 않는다.
이 전제 이후 현재 브랜치에 신규 Core 구현이 추가됐다. 2026-09-08 로컬 검증 범위와 실행 명령은
[루트 README 검증](../../README.md#검증)을 따른다. 이 문서의 설계 계약과 실제 실행 증거는 구분한다.

- 개발 입력: planning → system-design → 기능 명세와 docs OpenAPI.
- 첫 구현 범위: M0 Core. 수집 보조·자동 수집·M1 기능은 각 단계로 분리한다.
- 구현 시작 순서와 완료 조건: [구현 Backlog](../development-specs/m0-core/implementation-backlog.md).
- 현행 판정: [설계 준비 상태](design-readiness.md)에서 설계 기준선·구현 수용·production 공개 승인을
  각각 관리한다. 과거 검증 보고서의 미실행 상태를 현행 설계 기준선으로 사용하지 않는다.
- 법무 실값·production 계정·복구 훈련은 공개 전 조건이다. 로컬 개발과 가짜 외부 adapter를 이용한 테스트는 시작할 수 있다.
- 문서 검증과 새 구현의 test·build·runtime·브라우저·배포 검증은 별도다.

## 설계 범위

M0 전체 기술 범위는 다음과 같다.

- 공개 `짤/meme` 목록과 페이지네이션
- 게시글 상세와 같은 게시판의 하단 목록 페이지네이션
- 운영자 전용 게시글 초안·예약·발행·숨김
- 복수 본문 이미지, 출처, 정책 버전
- 게시글 참고용 조회 수와 기본 비활성 GA4 연동
- `M0 수집 보조`의 운영자 URL 지정·후보 큐·검수·초안 승격
- `M0 자동 수집`의 사용 결정된 출처 목록 수집과 실패 시 출처 비활성
- 외부 이미지 저장소, 백업과 복구
- 단일 서버·단일 리전 저비용 운영

`M0 Core`는 수집 없이 먼저 구현·공개할 수 있다. 수집 보조와 자동 수집은 각 단계 gate 뒤에
feature flag로 활성화하고 공개 읽기 경로와 분리해, 수집이 멈춰도 공개 목록·상세와 운영자
발행이 계속 동작하게 한다. GA4는 M0 Web에 기본 비활성 연동으로 포함하고 운영 gate를 통과한
환경에서도 분석 동의 후에만 로드하며 자체 분석 DB·API를 만들지 않는다. GA4 활성화는 M0 Core
공개 완료 조건이 아니다. M1 회원과 M1.5 익게는 [별도 확장 계약](06-member-community-design.md)으로 설계한다. 광고는 기존 후속 활성화 경계를 유지한다.

내부 패키지와 import 경계는 [M0 코드 구조](08-code-structure.md)를 따른다.

## 문서 구성

| 문서 | 역할 |
| --- | --- |
| [01-system-architecture.md](./01-system-architecture.md) | 시스템 경계, 컴포넌트, 요청·발행·숨김·수집 흐름 |
| [02-data-model.md](./02-data-model.md) | ERD, 테이블·인덱스·상태 전이·보존 계약 |
| [03-api-design.md](./03-api-design.md) | 공개·관리자 API와 공통 응답·오류 계약 |
| [04-infrastructure-design.md](./04-infrastructure-design.md) | 저비용 사업자 비교, 배포 토폴로지와 비용 상한 |
| [05-security-operations.md](./05-security-operations.md) | 접근통제, secret, 백업·복구·관측·장애 대응 |
| [06-member-community-design.md](./06-member-community-design.md) | M1·M1.5 아키텍처·데이터·API·보안·운영 확장; 문서 작성과 공개 gate 별도 |
| [07-spring-collector-design.md](./07-spring-collector-design.md) | M0 수집 보조 Spring 실행·복구·quota·보안·전환 상세 계약; 구현·활성화 별도 |
| [09-security-cost-protection-plan.md](./09-security-cost-protection-plan.md) | Cloudflare·AWS 보안/비용 보강 적용 계획; 정적 JS 캐시·알림 1차 적용, 요청 제한·전체 정상 이용 검증은 별도 |
| [design-readiness.md](./design-readiness.md) | 단계별 설계 기준선·구현 수용·production 공개 승인 현행 판정 |

## 핵심 결정

| 영역 | M0 결정 |
| --- | --- |
| 공개 BE·FE 런타임 | Node.js `24.18.0` LTS |
| 웹·BFF | Nuxt SSR + same-origin `/api/v1` 외부 계약 |
| Core API | NestJS + TypeORM + TypeScript strict, Docker app network에서 Web만 HTTP 접근; cron은 단발성 command |
| 서비스 데이터베이스 | PostgreSQL 18 단일 인스턴스. Spring collector는 운영자 PC의 별도 PostgreSQL 18에서 `batch`·`quartz`·`collector` schema 사용 |
| DB schema | `M0 Core`: `content`, `legal`, `ops`; `M0 수집 보조`: `collect`; 이후 schema는 단계별 migration에서 추가 |
| 이미지 | Cloudflare R2 Standard, 비공개 원본 bucket과 공개 media bucket 분리 |
| 수집 | M0 수집 보조는 운영자 로컬 컴퓨터의 `collector`가 Discord `/collect url` 또는 관리자 URL 입력의 단일 상세 페이지 1건만 처리. BE는 후보 접수·저장·검수 API를 제공하고 출처 등록/활성·robots·요청 상한 결과를 검증. 목록 수집은 후속 자동 수집 단계 |
| 엣지 | Cloudflare Free DNS·CDN·Universal SSL |
| 원본 연결 | Cloudflare Tunnel로 공개 inbound port 제거 |
| 운영자 접근 | BFF의 교체 가능한 외부 인증 adapter, Core의 provider-neutral 서비스 토큰 검증 |
| 배포 단위 | 단일 ARM64 또는 x86_64 VM의 Docker Compose |
| 기본 비용안 | OCI 서울 Always Free를 우선 시험하고 실패 시 Lightsail 서울 2GB로 전환 |
| 고가용성 | M0에서는 구성하지 않고 백업 복구로 대응 |

## 설계 원칙

1. 비용을 줄이기 위해 컴퓨트·DB를 한 VM에 두되 DB 포트는 외부에 공개하지 않는다.
2. 이미지와 DB 백업은 VM 밖에 저장해 서버 삭제가 곧 데이터 소실이 되지 않게 한다.
3. 무료 서비스는 비용 절감 수단이지 영속성 보장이 아니다. 무료 자원 확보 실패와 정책 변경에 대비한 유료 전환 경로를 유지한다.
4. ARM64와 x86_64에서 같은 컨테이너 이미지를 빌드해 OCI와 Lightsail 사이의 이동을 단순화한다.
5. 관리자 인증, 이미지 저장과 분석은 adapter 경계로 분리해 공급자 변경이 공개 API와 DB 핵심 모델을 바꾸지 않게 한다.
6. 구현 코드는 이 문서보다 임의로 범위를 넓히지 않는다. 계약 변경은 기획과 시스템 설계를 먼저 수정한다.

## Spring 수집 서버 준비 상태 (2026-09-08)

- 설계 기준선: **조건부 확정 가능(개발 입력), 주 검수 완료.** [Spring 상세 계약](07-spring-collector-design.md)에
  운영자 로컬 Boot 서버, Batch/Quartz/REST·Discord 공통 실행, 전용 PostgreSQL, 응답 유실·quota·lease,
  spool·알림·cutover/rollback을 반영했다.
- 구현 수용: Spring source·Core/local migration·OpenAPI·test·build·runtime은 미구현·미검증이다. 기존
  Python source와 테스트를 Spring 완료 증거로 승계하지 않는다.
- 공개 승인: 실제 출처·robots·이용 조건, Discord Application·운영 계정, User-Agent 연락처, 법무·운영
  수용 전에는 collector를 활성화하지 않는다. M0 Core 공개와 collector 활성화는 분리한다.
- 범위: 수집 보조 전환이며 목록 자동 발견·자동 발행·M1·M1.5 변경·전체 BE 스택 전환은 포함하지 않는다.
