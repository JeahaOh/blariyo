# 블라리요 인프라 계획

- 문서 상태: 제품 확정안 반영, 인프라 세부안은 제안
- 기준일: 2026-08-12
- 관련 문서: [01-service-plan.md](./01-service-plan.md), [03-screen-design.md](./03-screen-design.md), [04-analytics-ad-plan.md](./04-analytics-ad-plan.md)

## 1. 확정된 기술 계약

- 데스크톱·모바일은 하나의 반응형 웹으로 제공한다.
- `/`는 `/meme`으로 리다이렉트한다.
- 초기 게시판은 표시명 `짤`, 코드 `meme`, URL `/meme`이다.
- 추후 `익게/community`, `뉴스/news`와 다른 게시판을 추가할 수 있다.
- 게시판 코드를 애플리케이션 상수로 고정하지 않는다.
- 외부 이미지는 블라리요 서버 측 저장소에 저장하고 핫링크하지 않는다.
- 이미지 저장 사업자와 물리 경로는 아직 확정하지 않는다.
- 자동 수집 결과는 임시 큐에만 저장하고 즉시 공개하지 않는다.
- 권리자 요청이 접수되면 대상 게시글을 먼저 숨긴다.

## 2. 현재 인프라 제안

```text
Cloudflare
  -> Nginx
      -> Nuxt 반응형 웹
      -> Express API /api/v1
      -> 이미지 저장소
Express
  -> MySQL
  -> 후보 수집 worker
```

초기에는 단일 서버와 Docker Compose 구성을 우선 검토한다. AWS Lightsail, 다른 VPS, 컨테이너 호스팅 중 실제 배포 대상을 정하기 전에는 특정 사업자를 확정안으로 간주하지 않는다.

### 기본 구성 후보

| 구성 | 역할 |
| --- | --- |
| Nginx | TLS 종료, reverse proxy, 정적 파일 전달 |
| Nuxt | 목록·상세 SSR과 OG 생성 |
| Express | 공개·관리자 API |
| MySQL 8 | 게시판, 게시글, 후보 큐, 운영 기록 |
| Docker Compose | 초기 단일 서버 프로세스 관리 |

Redis, MongoDB, 다중 API 서버는 초기 필수 구성에 넣지 않는다.

## 3. 요청 라우팅

| 경로 | 처리 |
| --- | --- |
| `/` | `/meme` 리다이렉트 |
| `/meme` | 짤 게시판 목록 |
| `/community` | 추후 익게 |
| `/news` | 추후 뉴스 |
| `/posts/:postNo` | 게시글 상세 |
| `/terms` | 이용약관 |
| `/privacy` | 개인정보처리방침 |
| `/rights` | 권리자 요청 |
| `/cookie-settings` | 쿠키 설정 |
| `/api/v1/*` | Express API |
| `/_nuxt/*` | Nuxt 정적 자산 |
| `/health/live` | 프로세스 생존 확인 |
| `/health/ready` | DB 등 의존성 준비 확인 |

실제 서비스 도메인은 `__SERVICE_DOMAIN__` placeholder로 두고 확정된 문자열을 입력하기 전에는 배포를 차단한다.

## 4. 게시판 데이터

```text
TB_BOARD
  board_code varchar unique
  display_name varchar
  active_yn char(1)
  write_policy varchar
  sort_order int
  created_at datetime
  updated_at datetime
```

초기 데이터는 다음 한 건이다.

```text
board_code=meme
display_name=짤
active_yn=Y
write_policy=ADMIN
```

`community`, `news`는 해당 게시판을 실제로 열 때 추가한다. API와 화면은 활성 게시판 데이터를 기준으로 경로와 표시명을 해석한다.

## 5. 게시글 데이터와 상태

```text
TB_POST
  post_no bigint primary key
  board_code varchar foreign key
  title varchar
  content text
  image_storage_key varchar
  image_alt varchar
  source_name varchar null
  source_url varchar null
  post_status varchar
  scheduled_at datetime null
  published_at datetime null
  created_at datetime
  updated_at datetime
```

| 상태 | 전이 |
| --- | --- |
| `DRAFT` | `SCHEDULED`, `PUBLISHED` |
| `SCHEDULED` | `DRAFT`, `PUBLISHED` |
| `PUBLISHED` | `HIDDEN_REVIEW` |
| `HIDDEN_REVIEW` | `PUBLISHED`, `REMOVED` |
| `REMOVED` | 최종 상태 |

- 공개 API는 `post_status=PUBLISHED`이고 `published_at <= now()`인 글만 반환한다.
- 권리 확인 완료 상태를 공개 조건으로 사용하지 않는다.
- 권리자 요청을 접수하면 게시글 상태를 같은 트랜잭션에서 `HIDDEN_REVIEW`로 변경한다.
- 관리자가 재공개, 수정 후 재공개, 삭제 중 하나를 결정한다.
- 상태 변경은 운영자, 이전·이후 상태, 시각, 요청 번호를 기록한다.

## 6. 게시와 예약

- 하루 2회 게시한다.
- 한 번에 10~20개를 게시한다.
- 정확한 게시 시각은 운영 설정으로 관리한다.
- 운영자가 준비한 `SCHEDULED` 게시글만 예약 시각에 공개한다.
- 후보 수집 worker는 초안, 예약, 공개 상태를 직접 만들 수 없다.
- 중복 발행을 막기 위해 게시글별 발행 요청에 멱등키를 사용할 수 있다.

## 7. 이미지 저장

### 공통 계약

- 외부 이미지는 블라리요가 관리하는 저장소에 복사해 저장한다.
- 원본 사이트 이미지를 공개 화면에서 직접 호출하지 않는다.
- DB에는 저장소 key 또는 상대 경로를 저장한다.
- 공개 URL은 저장소 adapter가 생성한다.

```text
ImageStorage
  store(file) -> storageKey
  publicUrl(storageKey) -> url
  delete(storageKey)
```

### 저장소 후보

- 단일 서버 영속 볼륨
- Amazon S3
- S3 호환 오브젝트 스토리지
- 기타 외부 파일 저장소

사업자, 버킷, 경로, CDN은 미정이다. 어느 저장소를 선택해도 게시글 API와 DB 필드가 바뀌지 않게 한다.

### 기본 보안

- 파일 확장자만 믿지 않고 MIME과 실제 이미지 decoding을 검사한다.
- UUID 등 추측하기 어려운 저장 key를 사용한다.
- 원본 파일명과 외부 URL을 공개 저장 경로로 사용하지 않는다.
- 운영 중인 게시글의 이미지와 수집 후보 이미지를 분리한다.
- 게시글 삭제 시 이미지와 CDN 캐시 삭제 작업을 함께 실행한다.

## 8. 자동 수집

```text
SourceAdapter
  -> 원문 URL·제목·이미지 후보 수집
  -> 정규화
  -> 중복 경고
  -> TB_SOURCE_CANDIDATE
  -> 운영자 확인
  -> 이미지 저장
  -> 게시글 초안
```

- 이토랜드, 펨코, 개드립넷 등을 adapter 후보로 둔다.
- 고급유머는 화면·기능 벤치마킹 대상으로 둔다.
- 출처별 요청 경로와 주기는 adapter 설정으로 관리한다.
- 403, 429, 로그인 요구, CAPTCHA가 나오면 우회하지 않고 중지한다.
- 수집 응답 원문은 필요한 후보 필드를 추출한 뒤 장기 보관하지 않는다.
- 수집 후보는 공개 게시글 테이블에 직접 쓰지 않는다.

후보 상태는 최소한으로 관리한다.

| 필드 | 값 |
| --- | --- |
| `fetch_status` | `PENDING`, `FETCHING`, `SUCCEEDED`, `FAILED`, `BLOCKED` |
| `review_status` | `PENDING`, `APPROVED`, `REJECTED`, `DUPLICATE` |

운영자가 `APPROVED`한 뒤에도 게시글 초안과 공개 발행은 별도 동작이다.

## 9. 공개 API

- `GET /api/v1/boards`
- `GET /api/v1/posts?board=meme&page=1`
- `GET /api/v1/posts/:postNo`

목록 크기는 게시글 20개로 고정한다. 광고 행은 API 결과에 포함하지 않는다. 상세 응답의 `contextPosts`는 현재 글과 같은 게시판에서 현재 글을 포함해 최대 20개 반환한다.

## 10. 관리자 API

- `POST /api/v1/admin/posts`
- `PATCH /api/v1/admin/posts/:postNo`
- `POST /api/v1/admin/posts/:postNo/publish`
- `POST /api/v1/admin/source-candidates/collect`
- `GET /api/v1/admin/source-candidates`
- `PATCH /api/v1/admin/source-candidates/:candidateNo/review`
- `POST /api/v1/rights-requests`
- `PATCH /api/v1/admin/rights-requests/:requestNo`

관리자 API는 인증과 관리자 권한을 확인한다. 공개 API와 수집 worker에는 게시글 상태를 임의 변경할 권한을 주지 않는다.

## 11. 분석과 광고

- 최소 내부 조회 이벤트는 MySQL에 저장할 수 있다.
- GA4는 분석 동의 후에만 로드한다.
- 광고 script는 광고 기능을 실제로 시작할 때만 로드한다.
- 상세 광고는 `AD-POST-BODY-BOTTOM`, `AD-DETAIL-LIST-INLINE`, `AD-DETAIL-LIST-AFTER`만 사용한다.
- 광고 실패가 목록·상세·공유 API를 중단시키지 않게 격리한다.

세부 내용은 [04-analytics-ad-plan.md](./04-analytics-ad-plan.md)를 따른다.

## 12. 보안과 운영

- 사용자 연결은 HTTPS만 허용한다.
- 관리자 인증 쿠키는 `HttpOnly`, `Secure`, `SameSite`를 사용한다.
- 관리자·수집 API에 요청 제한을 적용한다.
- 비밀값은 저장소에 커밋하지 않고 환경 변수나 secret 저장소로 주입한다.
- DB와 이미지 백업을 자동화한다.
- 백업 복구 절차를 실제로 시험한다.
- 애플리케이션 로그에 토큰, 비밀번호, 권리자 소명 자료를 남기지 않는다.

## 13. 아직 미정인 인프라 항목

- 실제 서비스 도메인 문자열
- 배포 사업자와 서버 사양
- 이미지 저장 사업자와 물리 경로
- 이미지 CDN 사용 여부
- DB·이미지 백업 저장소
- 로그·모니터링 사업자
- 자동 수집 실행 주기와 출처별 제한값

미정 항목은 확정값처럼 Docker, 환경 변수 예제, 배포 체크리스트에 넣지 않는다.
