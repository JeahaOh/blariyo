# 블라리요 인프라 계획

- 문서 상태: M0 인프라 의사결정 정본
- 기준일: 2026-08-15
- 역할: 배포 방향·비용 경계·공급자 선택을 정의한다. 스키마, API payload, container 자원값과 운영 명령은 정의하지 않는다.
- 관련 문서: [서비스 기획서](./01-service-plan.md), [시스템 설계](../system-design/README.md), [상세 인프라 설계](../system-design/04-infrastructure-design.md), [보안·운영 설계](../system-design/05-security-operations.md)

## 1. 문서 경계

이 문서는 “어떤 운영 형태와 공급자를 선택하는가”만 결정한다.

| 내용 | 정본 |
| --- | --- |
| 제품 범위·게시 규칙·사용자 화면 | `docs/planning/01-service-plan.md`, `03-screen-design.md` |
| DB 테이블·자료형·제약·migration | `docs/system-design/02-data-model.md` |
| endpoint·request·response·오류 | `docs/system-design/03-api-design.md` |
| network·container·자원·배포 절차 | `docs/system-design/04-infrastructure-design.md` |
| 인증·secret·백업·복구·관측 | `docs/system-design/05-security-operations.md` |

하위 시스템 설계가 제품 범위를 바꾸면 이 문서를 포함한 planning 정본을 먼저 수정한다. 반대로 planning 문서에는 기술 계약의 사본을 만들지 않고 해당 system-design 문서를 연결한다.

## 2. M0 운영 목표

- 데스크톱·모바일을 하나의 반응형 웹으로 제공한다.
- 운영자가 올린 `짤/meme`을 비로그인 사용자에게 안정적으로 제공한다.
- 초기 트래픽에서는 단일 서버·단일 리전으로 비용을 제한한다.
- 서버가 사라져도 PostgreSQL backup과 공개 이미지 원본으로 복구할 수 있게 한다.
- 고가용성보다 검증 가능한 백업·복원과 공급자 이전 경로를 우선한다.
- 소셜 로그인, 사용자 작성 게시판, 자동 수집, 광고와 GA4는 M0 runtime·schema·API에 포함하지 않는다.

## 3. 확정 기술 선택

| 영역 | M0 선택 | 선택 경계 |
| --- | --- | --- |
| 웹·BFF | Nuxt SSR + same-origin `/api/v1` | HTML·OG 생성과 외부 API 계약 |
| Core API | Express | Docker 내부 조회와 운영자 transaction |
| 런타임 | Node.js `24.18.0` LTS | Nuxt·Express 통일 |
| 데이터베이스 | PostgreSQL 18 | 단일 영구 관계형 DB, MySQL·MariaDB 병행 없음 |
| 이미지 | Cloudflare R2 Standard | private 원본, public media 분리 |
| 엣지 | Cloudflare Free | DNS·CDN·TLS·Tunnel·Access |
| 배포 단위 | Docker Compose | 단일 VM |
| 원격 백업 | private R2 bucket | media와 credential·bucket 분리 |

Redis, MongoDB, 별도 managed DB, Kubernetes, 다중 API instance와 다중 region은 M0에 포함하지 않는다.

## 4. 배포 사업자 결정

1. OCI 서울 리전 Always Free A1을 먼저 시도한다.
2. 가입·배포 시점에 A1 용량을 확보하지 못하면 AWS Lightsail 서울 2GB로 전환한다.
3. 2GB 환경에서 실제 메모리 임계치를 반복 초과할 때만 4GB로 올린다.

무료 자원은 비용 절감 수단이며 영속성 보장이 아니다. OCI 사용 여부와 관계없이 이미지와 DB backup은 VM 외부 R2에 둔다. 월별 비용 상한, 자원 배분과 전환 측정값은 [상세 인프라 설계](../system-design/04-infrastructure-design.md)를 따른다.

## 5. 공개 경로와 구성 경계

| 공개 경로 | 제품 역할 |
| --- | --- |
| `/` | `/meme`으로 이동 |
| `/meme` | 짤 게시판 목록 |
| `/:boardSlug/posts/:postId` | 해당 게시판의 게시글 상세 |
| `/terms`, `/privacy`, `/cookie-settings` | 정책 화면 직접 진입 |
| `/api/v1/boards/:boardSlug/posts*` | Nuxt BFF의 게시판 하위 공개 목록·상세 API |
| `/api/v1/*` | Nuxt BFF의 나머지 공개·관리자 API |

- PostgreSQL과 application container port는 인터넷에 직접 공개하지 않는다. Express Core API는 Nginx route·public DNS·host port 없이 Nuxt BFF만 HTTP로 호출한다. cron은 API image의 단발성 command로 실행한다.
- 관리자 화면과 관리자 API는 Cloudflare Access를 통과해야 한다.
- 실제 service domain은 `__SERVICE_DOMAIN__` placeholder가 남아 있으면 배포하지 않는다.
- `/community`, `/news`, `/login`, `/signup/consent`, `/account`는 해당 후속 단계가 시작될 때 활성화한다.

endpoint별 계약은 [API 설계](../system-design/03-api-design.md), network와 health check는 [상세 인프라 설계](../system-design/04-infrastructure-design.md)를 따른다.

## 6. 데이터와 저장소 원칙

- PostgreSQL 18을 M0의 단일 영구 관계형 데이터베이스로 사용한다.
- 운영 스키마는 순번 migration으로만 적용한다. 개발 연결 확인용 `init.sql`은 운영 스키마가 아니다.
- 외부 이미지는 hotlink하지 않고 R2에 저장하며 DB에는 공개 URL 대신 storage key를 저장한다.
- private 원본은 upload 후 유지하고 발행된 이미지는 public media에 별도 copy한다.
- DB backup은 media와 분리된 private bucket에 암호화해 저장한다.
- 게시글을 숨겨도 즉시 물리 삭제하지 않고 운영 복구 유예를 둔다.

테이블·상태·보존기간의 단일 정본은 [데이터 모델](../system-design/02-data-model.md)이다.

## 7. 기능 단계와 인프라 영향

| 단계 | 기능 | 인프라 영향 |
| --- | --- | --- |
| M0 | 공개 짤 목록·상세, 운영자 발행·숨김, 정책, 최소 내부 조회 | 현재 단일 VM·PostgreSQL·R2 구성 |
| M1 | 소셜 가입·로그인·탈퇴 | provider secret, callback, session store 계약 추가 |
| M1.5 | 익게 작성·댓글·신고·moderation | 사용자 쓰기 부하와 abuse 방어 재산정 |
| 후속 | 자동 수집·광고·GA4 | worker 제한, consent, 외부 script와 CSP 검토 |

후속 기능의 테이블과 endpoint를 M0 schema·API에 미리 넣지 않는다. 단계 착수 전에 planning을 확정하고 system-design을 별도로 확장한다.

## 8. 운영·보안 의사결정

- 공개 읽기 장애와 운영자 쓰기 장애를 분리한다. Access나 R2 private media 장애가 기존 공개 읽기를 중단시키지 않게 한다.
- 관리자 identity, DB role, R2 bucket, backup credential을 최소 권한으로 분리한다.
- DB logical backup과 실제 restore test를 운영 필수 작업으로 둔다.
- token·비밀번호·개인정보·권리자 소명 자료를 application log에 남기지 않는다.
- 광고·GA4·소셜 provider를 활성화할 때마다 consent, CSP, callback allowlist를 다시 검토한다.

구체적인 제한값과 runbook은 [보안·운영 설계](../system-design/05-security-operations.md)를 따른다.

## 9. 배포 전에 확정할 운영값

- 실제 service domain
- OCI A1 확보 여부와 OCI/Lightsail 최종 선택
- R2 production account, bucket 이름과 public media custom domain
- Cloudflare Access team·audience와 운영자 allowlist
- monitoring provider와 알림 수신 경로
- PostgreSQL·R2 production credential 주입 경로

이 값들은 계정과 도메인을 실제로 확보한 뒤 배포 secret·설정에 주입한다. placeholder나 예시 credential을 production 값처럼 사용하지 않는다.

## 10. 완료 기준

- 빈 PostgreSQL 18에서 migration과 seed가 성공한다.
- 목록·상세·운영자 발행·숨김 smoke test가 통과한다.
- 외부 공개 port가 의도한 HTTP endpoint로만 제한된다.
- 암호화 DB backup을 새 PostgreSQL 18에 실제 복원한다.
- VM 전체를 잃어도 문서화된 절차로 DB와 media를 재연결할 수 있다.
- 월 비용과 자원 사용량이 정한 전환 기준 안에 있다.
