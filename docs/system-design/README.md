# 블라리요 M0 시스템 설계

- 문서 상태: M0 기술 계약 정본 · 실행 산출물은 별도 상태 관리
- 기준일: 2026-08-15
- 상위 기획: [서비스 기획서](../planning/01-service-plan.md)
- UI 정본: [반응형 퍼블리싱](../publishing/responsive/README.md)
- 데이터베이스 결정: [2026-08-14 PostgreSQL 전환 결정](../session-log/2026-08-14-postgresql-transition.md)

이 디렉터리는 확정된 기획을 구현 가능한 기술 계약으로 구체화한다. `docs/planning`은 무엇을 만들지 정의하고, 이 디렉터리는 컴포넌트 경계, 데이터 구조, API, 배포와 운영 방식을 정의한다.

## 문서 책임과 우선순위

| 계층 | 답하는 질문 | 포함하는 내용 | 포함하지 않는 내용 |
| --- | --- | --- | --- |
| planning | 무엇을, 어느 단계에, 어떤 제품 규칙으로 만드는가 | 범위·운영 정책·화면·수용 기준 | SQL 자료형·endpoint payload·container 설정 |
| system-design | 확정 요구사항을 어떻게 구현하는가 | 컴포넌트·DB·API·인프라·보안 계약 | 제품 범위의 독자적 변경 |
| executable artifacts | 계약이 실제로 구현됐는가 | migration·OpenAPI·source·test·Compose | 미구현 설계를 구현 완료로 간주하는 설명 |

제품 범위가 충돌하면 planning을 먼저 고치고 system-design을 맞춘다. 구현 세부가 충돌하면 해당 system-design 문서가 우선한다. 실행 산출물이 system-design과 다르면 구현 완료가 아니라 drift로 판정한다.

## 현재 준비 상태

| 영역 | 설계 문서 | 실행 산출물 | 현재 판정 |
| --- | --- | --- | --- |
| 시스템 경계 | 아키텍처 흐름 정의 | M0 route·service 미구현 | 설계 완료, 구현 전 |
| 데이터 | PostgreSQL table·constraint·상태·보존 계약 | `V001`·`V002` migration 미구현 | 설계 검토 완료, 실행 불가 |
| API | 외부 BFF·내부 Core request·response·오류 계약 | M0 OpenAPI·route·contract test 미구현 | 설계 검토 완료, 실행 불가 |
| 인프라 | 공급자·network·resource 기준 | production 계정·domain 미확정 | 설계 완료, 배포 전 |
| 보안·운영 | 접근·backup·restore·runbook | production restore drill 미실시 | 설계 완료, 운영 검증 전 |

따라서 `02-data-model.md`와 `03-api-design.md`는 구현 방향의 정본이지만, migration과 OpenAPI가 만들어지고 빈 환경 검증을 통과하기 전에는 “구현 준비 완료”로 표시하지 않는다.

## 설계 범위

M0 핵심 범위는 다음과 같다.

- 공개 `짤/meme` 목록과 페이지네이션
- 게시글 상세와 같은 게시판의 하단 목록 페이지네이션
- 운영자 전용 게시글 초안·예약·발행·숨김
- 복수 본문 이미지, 출처, 정책 버전
- 최소 내부 조회 이벤트
- 외부 이미지 저장소, 백업과 복구
- 단일 서버·단일 리전 저비용 운영

소셜 회원가입·로그인, 사용자 작성 게시판, 자동 수집, 광고와 GA4는 확장 지점만 정의한다. M0 핵심을 배포하기 전 필수 의존성으로 만들지 않는다.

## 문서 구성

| 문서 | 역할 |
| --- | --- |
| [01-system-architecture.md](./01-system-architecture.md) | 시스템 경계, 컴포넌트, 요청·발행·숨김 흐름 |
| [02-data-model.md](./02-data-model.md) | ERD, 테이블·인덱스·상태 전이·보존 계약 |
| [03-api-design.md](./03-api-design.md) | 공개·관리자 API와 공통 응답·오류 계약 |
| [04-infrastructure-design.md](./04-infrastructure-design.md) | 저비용 사업자 비교, 배포 토폴로지와 비용 상한 |
| [05-security-operations.md](./05-security-operations.md) | 접근통제, secret, 백업·복구·관측·장애 대응 |

## 핵심 결정

| 영역 | M0 결정 |
| --- | --- |
| 런타임 | Node.js `24.18.0` LTS |
| 웹·BFF | Nuxt SSR + same-origin `/api/v1` 외부 계약 |
| Core API | Express, Docker app network에서 Web만 HTTP 접근; cron은 단발성 command |
| 데이터베이스 | PostgreSQL 18 단일 인스턴스 |
| DB schema | `content`, `legal`, `analytics`, `ops`; M1 이후 schema는 단계별 migration에서 추가 |
| 이미지 | Cloudflare R2 Standard, 비공개 원본 bucket과 공개 media bucket 분리 |
| 엣지 | Cloudflare Free DNS·CDN·Universal SSL |
| 원본 연결 | Cloudflare Tunnel로 공개 inbound port 제거 |
| 운영자 접근 | Cloudflare Access Free로 `/admin*`, `/api/v1/admin/*` 보호 |
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
