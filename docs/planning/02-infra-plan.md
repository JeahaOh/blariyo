# Blariyo 인프라 설계서

- 문서 상태: 기획 재정의에 따른 참고안
- 기준일: 2026-08-11
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [04-analytics-ad-plan.md](./04-analytics-ad-plan.md)
- 대상: 운영자 큐레이션형 유머 피드 웹 서비스

## 1. 결론

기획 재정의가 끝난 뒤에도 M0부터 M1.5까지는 확장 조건을 넘지 않는 한 AWS Lightsail 서울 리전의 단일 인스턴스에서 Docker Compose로 운영하는 안을 기본 후보로 둔다. 단, 이 문서는 현재 구현 지시가 아니라 기획 확정 후 재검토할 인프라 참고안이다.

```text
사용자
  |
Cloudflare
  - DNS
  - TLS
  - 정적 파일 CDN
  - 기본 DDoS 방어
  |
AWS Lightsail 1대
  - Region: ap-northeast-2 (Seoul)
  - Linux/Unix, Public IPv4
  - 2 vCPU, RAM 4GB, SSD 80GB
  |
Nginx :80/:443
  |-- /             -> Nuxt 3 SSR
  |-- /api/*        -> Express API
  |-- /uploads/*    -> 정적 이미지
  `-- /health/*     -> 상태 확인
          |
        MySQL 8

Lightsail
  |-- 자동 스냅샷
  `-- DB 덤프와 이미지 -> Amazon S3
```

초기에는 서버 이중화보다 배포 단순성, 복구 가능성, 낮은 운영비를 우선한다.

## 2. 설계 목표

- 1인이 배포와 장애 대응을 할 수 있어야 한다.
- M0 활성 사용자 100명, M1과 M1.5 활성 사용자 500명을 수용한다.
- 공개 포트와 운영 서비스를 최소화한다.
- 서버 한 대가 손실되어도 원격 백업으로 복원할 수 있어야 한다.
- 영구 데이터를 애플리케이션 프로세스 메모리에 저장하지 않는다.
- 실제 병목이 확인되기 전까지 Redis와 다중 서버를 도입하지 않는다.
- 개발 환경과 운영 환경의 Compose 구성을 분리한다.

## 3. 이번 단계에서 제외할 것

- Kubernetes
- ECS 또는 컨테이너 오케스트레이션
- 다중 리전
- 다중 가용 영역 DB
- Redis
- MongoDB
- RabbitMQ 또는 별도 메시지 브로커
- Elasticsearch 또는 OpenSearch
- 별도 로그 수집 클러스터
- API 서버 다중 인스턴스
- 무중단 Blue/Green 배포

## 4. 운영 플랫폼 확정

### 선정안

| 항목 | 결정 |
| --- | --- |
| Cloud provider | AWS |
| Service | Amazon Lightsail |
| Region | Asia Pacific (Seoul) `ap-northeast-2` |
| Availability Zone | 생성 시 서울 리전 내 가용 영역 선택 |
| Instance bundle | Linux/Unix, Public IPv4 |
| Instance size | 2 vCPU, RAM 4GB, SSD 80GB, 월 4TB 전송량 |
| Operating system | 최신 Ubuntu LTS |
| Static IP | Lightsail 고정 IP 1개 연결 |
| DNS/CDN | Cloudflare Free |
| Server snapshot | Lightsail 자동 스냅샷 |
| Data backup | 비공개 Amazon S3 버킷 |

일반 AWS의 EC2, RDS, ALB 조합은 M0~M1.5에서 확장 조건을 넘기 전까지 사용하지 않는다. Lightsail은 컴퓨팅, SSD, 전송량, 고정 IP와 모니터링을 예측 가능한 번들 요금으로 제공하므로 1인 운영에 적합하다. AWS 계정과 향후 S3, Managed DB, Load Balancer 연계도 한 공급자 안에서 유지할 수 있다.

### 예상 월 비용

2026-08-06 공개 요금을 기준으로 계획한다.

| 항목 | 예상 비용 | 비고 |
| --- | ---: | --- |
| Lightsail 4GB 인스턴스 | `$24` | 2 vCPU, RAM 4GB, SSD 80GB, 전송량 4TB |
| 자동 스냅샷 | `$1~5` | 실제 사용량과 변경량에 따라 증분 과금 |
| S3 백업 | `$1~3` | DB 덤프와 이미지 용량에 따라 변동 |
| Cloudflare Free | `$0` | DNS proxy와 기본 CDN 사용 |
| 합계 | **`$26~32/월`** | 도메인, 세금, 초과 사용량 제외 |

- 운영 예산은 월 `$35`를 기본 상한으로 잡는다.
- AWS Budgets에서 실제 비용 `$25`, `$35` 알림과 예측 비용 알림을 설정한다.
- 사용하지 않는 스냅샷, 분리된 고정 IP, 테스트 인스턴스를 월 1회 확인한다.
- AWS 요금이 변경되면 운영 시작 시 공식 가격표를 다시 확인한다.

### 플랫폼 운영 원칙

- AWS 루트 계정에는 MFA를 적용하고 평상시 작업에 사용하지 않는다.
- 루트 액세스 키를 생성하지 않는다.
- 운영용 IAM 관리자와 읽기 전용 계정을 분리한다.
- Lightsail 방화벽과 Ubuntu 방화벽에서 동일한 공개 포트 정책을 적용한다.
- 서울 리전 장애나 계정 잠금에 대비해 S3 백업의 복원 절차와 관리자 복구 수단을 문서화한다.
- Lightsail 장애 시 새 인스턴스를 만든 뒤 Compose, S3 백업, DNS 순서로 복구한다.

## 5. 서버 기준

### M0~M1.5 기본 사양

| 항목 | 기준 |
| --- | --- |
| Provider | AWS Lightsail |
| Region | Asia Pacific (Seoul) `ap-northeast-2` |
| OS | Ubuntu LTS |
| CPU | 2 vCPU |
| RAM | 4GB |
| Disk | SSD 80GB 이상 |
| Swap | 2GB |
| Public IP | 고정 IP 1개 |
| Timezone | `Asia/Seoul` |
| Container runtime | Docker Engine + Docker Compose |

Nuxt SSR, Express, MySQL을 한 서버에서 실행하므로 RAM 2GB 구성은 사용하지 않는다.

### 서버 디렉터리

```text
/srv/blariyo/
  |-- compose.yml
  |-- compose.production.yml
  |-- config/
  |   `-- .env.production
  |-- data/
  |   |-- mysql/
  |   |-- uploads/
  |   `-- submissions/
  |-- backups/
  `-- scripts/
```

- 환경 파일 권한은 `600`으로 제한한다.
- MySQL과 업로드 파일은 컨테이너 외부 영속 경로에 저장한다.
- M1.5 검수 전 이미지는 `submissions`에 저장하고 Nginx 정적 경로로 공개하지 않는다.
- 애플리케이션 소스 전부를 운영 서버에 마운트하지 않는다.

## 6. 운영 컨테이너

| 서비스 | 역할 | 외부 공개 |
| --- | --- | --- |
| `blariyo-nginx` | TLS 종료, reverse proxy, 정적 파일 제공 | 80, 443 |
| `blariyo-web` | Nuxt 3 SSR | 공개하지 않음 |
| `blariyo-api` | Express API | 공개하지 않음 |
| `blariyo-mysql` | 영구 데이터 저장 | 공개하지 않음 |

운영 환경에서는 다음 컨테이너를 실행하지 않는다.

- `mongodb`
- `mongo-express`
- `phpmyadmin`
- 개발용 `nodemon`

DB 점검이 필요하면 SSH 터널을 통해 MySQL 클라이언트로 접근한다.

## 7. 네트워크와 포트

### 외부 공개

| Port | 용도 | 제한 |
| ---: | --- | --- |
| 80 | HTTPS 리다이렉트 | 공개 |
| 443 | 웹 서비스 | 공개 |
| 22 | 운영자 SSH | 키 인증, 가능하면 접속 IP 제한 |

### Docker 내부

| Port | 서비스 |
| ---: | --- |
| 3000 | Nuxt |
| 4000 | Express |
| 3306 | MySQL |

- MySQL의 현재 외부 포트 `43306` 매핑은 운영 Compose에서 제거한다.
- Nuxt와 Express도 호스트 포트를 공개하지 않는다.
- 모든 사용자 요청은 Nginx를 통해서만 들어온다.

## 8. 요청 라우팅

| 경로 | 대상 | 캐시 정책 |
| --- | --- | --- |
| `/` 및 페이지 경로 | Nuxt | 기본적으로 캐시하지 않음 |
| `/api/v1/*` | Express | 캐시하지 않음 |
| `/_nuxt/*` | Nuxt 정적 자산 | 장기 캐시, 파일명 해시 사용 |
| `/uploads/*` | Nginx 정적 파일 | 공개 캐시, 짧은 초기 TTL |
| `/ads.txt` | Nuxt 또는 Nginx 정적 파일 | 1시간 캐시, 한 곳만 정본으로 관리 |
| `/health/live` | Express | 캐시하지 않음 |
| `/health/ready` | Express | 캐시하지 않음 |

Cloudflare는 DNS proxy를 활성화하고 정적 자산만 캐시한다. 관리자, 인증, API 응답은 캐시 대상에서 제외한다.

## 9. TLS와 도메인

- 사용자 연결은 HTTPS만 허용한다.
- Cloudflare SSL 모드는 `Full (Strict)`을 사용한다.
- 원본 서버에도 유효한 인증서를 설치한다.
- HTTP 요청은 HTTPS로 영구 리다이렉트한다.
- HSTS는 HTTPS 동작을 확인한 뒤 적용한다.
- 서비스 도메인 확정 전에는 임시 서브도메인을 사용한다.

권장 도메인 구조는 다음과 같다.

```text
service.example.com       사용자 웹과 API
```

M0에서는 API 서브도메인을 분리하지 않는다. 동일 출처를 사용해 CORS와 쿠키 구성을 단순하게 유지한다.

### 분석·광고 외부 태그

- M0 제한 공개 전 GA4와 basic consent mode를 적용한다.
- 분석 동의 전에는 Google tag를 로드하지 않는다.
- 광고 script는 광고 게이트 통과 전 production bundle에 포함하지 않는다.
- GA4 measurement ID, AdSense publisher ID와 slot ID는 Nuxt public runtime config로 분리한다.
- `ANALYTICS_ENABLED`, `ADS_ENABLED`, `ADS_POST_BANNERS_ENABLED`, `ADS_INTERSTITIAL_ENABLED` feature flag를 둔다.
- 대형 광고는 사용자 현지 날짜 기준 일 3회, 상세 3개, 20분 간격을 클라이언트에서 확인한다.
- Google script는 비동기로 한 번만 로드하고 실패가 Nuxt 화면과 API 호출을 중단시키지 않게 격리한다.
- AdSense publisher ID가 확정된 뒤에만 root의 `/ads.txt`를 배포한다.
- 상세한 이벤트·동의·광고 노출 규칙은 [04-analytics-ad-plan.md](./04-analytics-ad-plan.md)를 따른다.

## 10. 데이터 저장

### MySQL

- MySQL 8.0을 사용한다.
- 애플리케이션 영구 데이터는 모두 MySQL에 저장한다.
- 초기 connection pool은 10개로 시작한다.
- Binary log와 slow query log를 활성화한다.
- DB 계정은 애플리케이션 DB에 필요한 권한만 가진다.
- root 계정은 애플리케이션에서 사용하지 않는다.
- 초기화 SQL과 운영 마이그레이션을 분리한다.

운영 마이그레이션 파일은 다음 규칙으로 관리한다.

```text
apps/init/mysql/migrations/
  0001_create_post.sql
  0002_create_visit_event.sql
```

적용된 버전은 `SCHEMA_MIGRATION` 테이블에 기록한다. 기존 데이터를 삭제하는 초기화 스크립트를 운영 배포에서 실행하지 않는다.

### 이미지

M0에서는 서버의 `/srv/blariyo/data/uploads`에 저장하고 Nginx가 직접 제공한다.

- 허용 형식: `jpg`, `png`, `webp`
- 파일당 최대 크기: 5MB
- 게시글당 대표 이미지 1개
- 파일명: UUID
- DB 저장값: 상대 경로
- 외부 이미지 핫링크 금지
- 영상과 GIF 업로드 제외

다중 API 서버로 확장하기 전에 S3 호환 오브젝트 스토리지로 이전한다.

### M1.5 검수 이미지

- 검수 전 이미지는 `/srv/blariyo/data/submissions`에 저장한다.
- Nginx의 `/uploads/*` 경로로 노출하지 않는다.
- 관리자는 인증된 API를 통해서만 이미지를 조회한다.
- 승인 시 검증된 이미지만 공개 `uploads` 경로로 이동하고 게시글 경로를 생성한다.
- 반려·철회 이미지는 운영 저장소에서 7일 후 삭제한다.
- 백업 버킷의 검수 이미지는 별도 prefix와 28일 만료 lifecycle을 사용한다.

## 11. 인증과 세션

M0~M1.5는 JWT 기반으로 운영한다.

### M0 관리자

- Access Token 수명: 15~30분
- `HttpOnly`, `Secure`, `SameSite` 쿠키 사용
- 서버 프로세스 메모리에 로그인 상태를 저장하지 않음
- 로그아웃 시 쿠키 삭제
- 로그인 실패 횟수와 잠금 상태는 MySQL에 저장

### M1 이후 사용자

- Access Token은 짧게 유지한다.
- Refresh Token은 해시로 MySQL에 저장한다.
- 토큰 만료, 회전, 폐기 상태를 관리한다.
- 로그아웃 시 Refresh Token을 폐기한다.

서버 세션을 프로세스 메모리에 저장하지 않으므로 단일 서버에서 Redis가 필요하지 않다.

## 12. 캐시

M0~M1.5에는 아래 확장 조건이 생기기 전까지 Redis를 사용하지 않는다.

적용할 캐시는 다음 두 가지뿐이다.

1. Cloudflare와 Nginx의 정적 파일 캐시
2. 브라우저의 해시 기반 Nuxt 자산 캐시

게시글 목록과 상세 API는 MySQL 인덱스로 처리한다. 애플리케이션 메모리 캐시는 인스턴스 간 불일치와 삭제 콘텐츠 재노출을 만들 수 있으므로 사용하지 않는다.

## 13. 배포 구조

### 출처 후보 수집 작업

출처 후보 수집은 공개 사용자 요청과 분리한다. 초기에는 관리자 명령으로 실행하고, 자동 주기는 운영 안정화 이후 feature flag로 연다.

```text
관리자 실행
  -> SourceCollector job
  -> SourceAdapter별 목록 요청
  -> 상세 후보 요청
  -> 정규화와 중복 검사
  -> TB_SOURCE_CANDIDATE 저장
  -> 운영자 검수
```

- 수집 job은 API 컨테이너 내부 worker 또는 별도 one-shot container로 실행한다.
- 같은 출처에 동시에 여러 worker가 접근하지 않도록 source별 lock을 둔다.
- 실패한 출처는 backoff를 적용하고 반복 실패 시 자동 중지한다.
- 수집 결과는 공개 게시글 테이블에 직접 쓰지 않는다.
- `SOURCE_CANDIDATE_AUTO_PUBLISH=false`를 운영 기본값으로 둔다.

### 이미지 관리

- 운영 이미지는 CI에서 빌드한다.
- GHCR 등 컨테이너 레지스트리에 저장한다.
- `latest`만 사용하지 않고 Git commit SHA 태그를 함께 사용한다.
- 운영 서버는 빌드하지 않고 이미지를 pull한다.

### 배포 흐름

```text
main 반영
  -> API 테스트
  -> Web 빌드
  -> Docker 이미지 빌드
  -> 이미지 레지스트리 push
  -> 배포 승인
  -> 배포 전 DB 백업
  -> 운영 서버 image pull
  -> DB migration
  -> docker compose up -d
  -> readiness 확인
  -> 핵심 URL smoke test
```

### 실패 시 롤백

1. 새 컨테이너를 중지한다.
2. 이전 Git SHA 이미지로 되돌린다.
3. 하위 호환되지 않는 DB 변경이면 배포 전 백업을 복원한다.
4. `/health/ready`, 홈, 게시글 상세를 확인한다.

M0에서는 1분 이내의 배포 중단을 허용한다.

## 14. 백업과 복구

서버 스냅샷과 데이터 백업을 별도로 운영한다.

### 백업 정책

| 대상 | 주기 | 보관 |
| --- | --- | --- |
| MySQL 논리 백업 | 매일 | 일간 7개, 주간 4개 |
| 업로드 이미지 | 매일 증분 | 일간 7개, 주간 4개 |
| M1.5 검수 이미지 | 매일 증분 | 별도 prefix, 최대 28일 |
| Lightsail 자동 스냅샷 | 매일 | 최근 7개 자동 스냅샷 |
| 배포 전 DB 백업 | 매 배포 | 최근 정상 배포 3개 |

MySQL은 `mysqldump --single-transaction`으로 백업한다. 백업 파일은 압축하고 비공개 S3 버킷에 전송한다. S3 버킷은 퍼블릭 액세스를 차단하고 서버의 IAM 자격 증명에는 지정 prefix의 읽기와 쓰기 권한만 부여한다.

스냅샷만 믿지 않는다. 서버와 동일한 장애 영역에 있는 로컬 백업도 복구본으로 인정하지 않는다.

### 목표

| 지표 | M0~M1.5 목표 |
| --- | --- |
| RPO | 최대 24시간 데이터 손실 |
| RTO | 4시간 이내 서비스 복구 |

### 복구 점검

- 월 1회 새 MySQL 컨테이너에 최신 덤프를 복원한다.
- 임의 게시글, 사용자, 이벤트 레코드를 조회한다.
- 이미지 파일과 DB 경로가 일치하는지 확인한다.
- 복구 시간과 실패 원인을 기록한다.

## 15. 상태 확인과 모니터링

### Health endpoint

- `/health/live`: Express 프로세스가 응답하는지 확인
- `/health/ready`: MySQL 연결과 필수 설정이 정상인지 확인

`ready` 검사에서 외부 서비스 전부를 호출하지 않는다. MySQL에 짧은 제한 시간으로 연결 가능한지만 확인한다.

### 수집 항목

- HTTP 요청 수
- 상태 코드별 응답 수
- p50, p95 응답 시간
- 5xx 오류율
- CPU와 메모리
- 디스크 사용량
- MySQL connection pool 대기
- MySQL slow query
- 컨테이너 재시작 횟수
- 백업 성공 여부

### 알림 기준

| 상황 | 기준 |
| --- | --- |
| 서비스 장애 | 외부 검사 3회 연속 실패 |
| 오류 증가 | 5분간 5xx 1% 초과 |
| 응답 지연 | 5분간 p95 1초 초과 |
| 디스크 주의 | 70% 초과 |
| 디스크 긴급 | 85% 초과 |
| 백업 실패 | 1회 실패 즉시 |

초기 로그는 JSON 형식으로 표준 출력에 기록한다. Docker 로그는 파일당 10MB, 최대 5개로 회전한다.

## 16. 보안 기준

- SSH 비밀번호 로그인을 비활성화한다.
- root 직접 로그인을 비활성화한다.
- AWS 루트 계정 MFA를 적용하고 루트 액세스 키를 만들지 않는다.
- 배포와 운영은 별도 IAM 계정으로 수행한다.
- 운영자별 SSH key를 사용한다.
- 방화벽은 22, 80, 443만 허용한다.
- MySQL과 내부 서비스 포트를 공개하지 않는다.
- 운영 비밀값을 Git에 저장하지 않는다.
- 관리자 API와 로그인 API에 속도 제한을 적용한다.
- 관리자 계정은 일반 사용자 계정과 분리한다.
- 컨테이너는 가능한 경우 non-root 사용자로 실행한다.
- CSP는 `Report-Only`로 먼저 관찰한 뒤 적용하고 분석·광고에 필요한 domain만 `script-src`, `connect-src`, `frame-src`, `img-src`에 허용한다.
- 외부 광고 iframe에 인증 token, 사용자 식별값, 게시글·댓글·제보 원문을 전달하지 않는다.
- 출처 후보 수집 도구는 관리자 전용으로만 열고, 내부 IP, metadata endpoint, localhost, private network 대역으로 요청하지 않는다.
- 출처 후보 수집은 HTML 메타 정보와 대표 이미지 후보 URL까지만 저장하고 원문 이미지 파일은 검수 전 공개 저장소에 저장하지 않는다.
- 외부 URL 요청은 timeout, redirect 제한, 응답 크기 제한을 둔다.
- OS와 컨테이너 이미지를 정기적으로 업데이트한다.
- 업로드 파일은 확장자뿐 아니라 MIME type도 검사한다.
- 요청 본문과 업로드 크기에 상한을 둔다.
- 권리자 삭제 요청 시 게시글과 캐시, 이미지 파일을 함께 제거한다.

## 17. 용량 목표

| 단계 | 활성 사용자 목표 | API 목표 |
| --- | ---: | ---: |
| M0 | 100명 | 50 RPS 이하 |
| M1 | 500명 | 200 RPS 이하 |
| M1.5 | 500명 | 200 RPS 이하 |

출시 전 부하 테스트의 통과 기준은 다음과 같다.

- p95 응답 시간 300ms 이하
- 오류율 1% 미만
- CPU 지속 사용률 70% 이하
- MySQL connection pool 대기 급증 없음
- 메모리 누수 없음

부하 테스트는 `100 -> 300 -> 500 -> 1,000` 가상 사용자 순서로 올린다. 최대 연결 수보다 서비스 품질 기준이 무너지는 지점을 용량 한계로 본다.

## 18. 확장 조건과 순서

### 1단계: 이미지 분리

다음 조건 중 하나가 발생하면 이미지를 S3 호환 오브젝트 스토리지로 옮긴다.

- 업로드 저장량 5GB 초과
- 이미지 백업 시간이 운영에 영향을 줌
- API 서버를 2개 이상 실행해야 함

### 2단계: MySQL 분리

다음 조건 중 하나가 발생하면 MySQL을 별도 서버 또는 Managed MySQL로 옮긴다.

- DB I/O가 API 응답의 주요 병목
- Lightsail 인스턴스 장애 시 DB 복구 시간이 허용 범위를 초과
- DB 백업이 서비스 성능에 영향을 줌
- API와 DB의 자원 경쟁이 반복됨

### 3단계: API 다중화

다음 조건 중 하나가 지속되면 Express를 2개 이상 실행하고 로드밸런서를 둔다.

- API CPU 70% 초과
- p95 응답 시간 300ms 초과
- 배포 중단을 허용할 수 없음
- 단일 프로세스 장애가 서비스 목표를 위반함

### 4단계: Redis

다음 요구가 실제로 생기면 Redis를 추가한다.

- 여러 API 인스턴스의 공용 속도 제한
- 서버 세션 또는 토큰 상태 공유
- 인기 피드 조회가 MySQL 부하의 주요 원인
- 실시간 알림 또는 짧은 작업 큐

Redis는 원본 데이터 저장소로 사용하지 않는다.

## 19. 장애 대응

| 장애 | 우선 조치 | 복구 |
| --- | --- | --- |
| API 컨테이너 종료 | 자동 재시작 확인 | 이전 이미지로 재기동 |
| MySQL 컨테이너 종료 | 디스크와 로그 확인 | 동일 볼륨으로 재기동 |
| DB 데이터 손상 | 서비스 쓰기 중단 | 최신 검증 백업 복원 |
| Lightsail 전면 장애 | 새 Lightsail 인스턴스 생성 | Compose, S3의 DB와 이미지 복원 |
| 디스크 부족 | 업로드 중단 | 로그 정리 후 디스크 확장 |
| 인증서 문제 | Cloudflare와 원본 인증서 확인 | 유효 인증서 재배포 |
| 잘못된 배포 | 배포 중단 | 이전 Git SHA 이미지로 롤백 |

장애 중 데이터 정합성이 불분명하면 쓰기 요청을 먼저 차단하고 읽기 복구 여부를 판단한다.

## 20. 현재 저장소 변경 방향

현재 `apps/docker-compose.yml`은 개발 도구 중심이다. 운영 적용 시 다음 파일을 별도로 만든다.

```text
apps/
  |-- docker-compose.yml
  `-- compose.production.yml

infra/
  |-- nginx/
  |   `-- default.conf
  |-- scripts/
  |   |-- deploy.sh
  |   |-- backup.sh
  |   `-- restore.sh
  `-- monitoring/
```

운영 Compose에는 다음을 반영한다.

- `web`, `api`, `mysql`, `nginx`만 실행
- 서비스별 health check
- `restart: unless-stopped`
- CPU와 메모리 상한
- 로그 회전
- 내부 네트워크
- 영속 볼륨
- 외부 DB 포트 제거
- 운영 환경 변수 분리

## 21. 구현 순서

1. MongoDB 의존 여부를 확인하고 운영 대상에서 제외한다.
2. API 포트를 `4000`으로 통일한다.
3. Express health endpoint를 구현한다.
4. Nuxt 프로젝트와 운영 Dockerfile을 만든다.
5. Express 운영 Dockerfile을 만든다.
6. Nginx reverse proxy 설정을 만든다.
7. `compose.production.yml`을 만든다.
8. MySQL migration 실행 방식을 만든다.
9. 백업과 복원 스크립트를 만든다.
10. CI 이미지 빌드와 배포 절차를 연결한다.
11. AWS 계정 MFA, IAM, Budget 알림을 설정한다.
12. Lightsail 서울 리전 인스턴스와 고정 IP를 생성한다.
13. Lightsail 자동 스냅샷과 S3 백업 버킷을 설정한다.
14. Cloudflare DNS와 TLS를 설정한다.
15. GA4, 분석 동의 bar, 쿠키 설정과 CSP Report-Only를 적용한다.
16. 제한 공개 전 부하 테스트와 복구 테스트를 수행한다.

광고 게이트 통과 후에는 `/ads.txt`, 상세 상·하단 배너, 대형 광고 순서로 별도 배포한다. 대형 광고는 일 1회부터 시작해 최대 일 3회까지 단계적으로 올리며 M0 운영 시작의 선행 조건으로 만들지 않는다.

## 22. 운영 시작 체크리스트

- [ ] AWS Lightsail 서울 리전 4GB 인스턴스 생성
- [ ] Lightsail 고정 IP 연결
- [ ] AWS 루트 MFA와 운영용 IAM 계정 설정
- [ ] AWS Budget `$25`, `$35` 비용 알림 설정
- [ ] 운영 도메인 확정
- [ ] SSH key 인증과 방화벽 적용
- [ ] MySQL 외부 포트 미노출 확인
- [ ] 운영 환경 변수 권한 확인
- [ ] Nginx HTTPS와 redirect 확인
- [ ] `/health/live`, `/health/ready` 확인
- [ ] 홈, 상세, 관리자 로그인 smoke test
- [ ] 분석 거부 상태에서 Google tag 요청이 발생하지 않음
- [ ] GA4 DebugView에서 route당 `page_view` 1회 확인
- [ ] CSP Report-Only report에 서비스 기능 차단이 없음
- [ ] DB 마이그레이션 이력 확인
- [ ] DB 백업 원격 전송 확인
- [ ] Lightsail 자동 스냅샷 활성화 확인
- [ ] S3 퍼블릭 액세스 차단과 최소 권한 확인
- [ ] 빈 서버에서 복원 테스트 완료
- [ ] 로그 회전 확인
- [ ] 디스크와 장애 알림 확인
- [ ] 500 가상 사용자 부하 테스트 통과
- [ ] 이전 이미지 롤백 확인

광고 실험 시 추가 확인한다.

- [ ] `/ads.txt` publisher ID와 AdSense 계정 일치
- [ ] 상세 상·하단 배너만 활성화되고 금지 화면에는 광고가 없음
- [ ] 대형 광고 일 3회·상세 3개·20분 제한 확인
- [ ] 광고 script 차단·실패 시 상세 이동 smoke test 통과
- [ ] `ADS_ENABLED=false`로 광고 기능 즉시 비활성화 확인

## 23. 최종 판정

M0부터 M1.5까지 적당한 인프라는 다음과 같다.

> AWS Lightsail 서울 리전 `ap-northeast-2`의 2 vCPU, RAM 4GB, SSD 80GB 인스턴스 한 대에서 Nginx, Nuxt, Express, MySQL을 Docker Compose로 운영한다. 정적 파일은 Cloudflare와 Nginx가 처리하고, Lightsail 자동 스냅샷과 S3 데이터 백업을 함께 사용한다. Redis와 다중 서버는 측정된 병목이 생긴 뒤 추가한다.

이 구성은 단일 서버 장애를 허용하는 대신 복구 절차를 명확히 하며, 초기 서비스에 불필요한 운영 복잡도를 만들지 않는다.

## 참고 자료

- [Docker Compose 운영 가이드](https://docs.docker.com/compose/how-tos/production/)
- [Cloudflare Cache 시작하기](https://developers.cloudflare.com/cache/get-started/)
- [MySQL InnoDB 백업](https://dev.mysql.com/doc/refman/8.0/en/innodb-backup.html)
- [Amazon Lightsail 요금](https://aws.amazon.com/lightsail/pricing/)
- [Amazon Lightsail 리전과 가용 영역](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html)
- [Amazon Lightsail 자동 스냅샷](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-snapshots.html)
- [AWS 루트 사용자 보안 권장 사항](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)
- [AWS Budgets 관리](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
