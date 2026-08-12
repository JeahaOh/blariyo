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
- 네이버, 카카오, Google, Apple OAuth/OIDC 회원가입·로그인을 제공한다.
- GA4는 분석 동의 후에만 로드하고 회원·소셜 계정 식별자를 전송하지 않는다.

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
| `/login` | 소셜 로그인 선택 |
| `/signup/consent` | 최초 로그인 후 Blariyo 약관·개인정보 동의와 가입 완료 |
| `/account` | 연동 제공자 확인, 로그아웃, 탈퇴 |
| `/terms` | 이용약관 modal 직접 진입 |
| `/privacy` | 개인정보처리방침 modal 직접 진입 |
| `/rights` | 권리자 요청 modal 직접 진입 |
| `/cookie-settings` | 쿠키 설정 modal 직접 진입 |
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
  pinned_order tinyint null
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

### 정책 버전 데이터

```text
TB_POLICY_VERSION
  policy_type varchar
  version varchar
  title varchar
  body_markdown longtext
  policy_status varchar
  effective_at datetime null
  created_at datetime
  updated_at datetime
  primary key (policy_type, version)
```

- `policy_type`은 `TERMS`, `PRIVACY`를 사용한다.
- `policy_status`는 `DRAFT`, `SCHEDULED`, `EFFECTIVE`, `RETIRED`를 사용한다.
- 공개 시점에는 유형별 `EFFECTIVE` 버전을 하나만 유지한다.
- 시행된 본문은 덮어쓰지 않고 새 버전을 추가한다.
- 기본 요청은 현재 적용 본문과 하단 이력 metadata를 함께 반환하고, 버전 지정 요청은 해당 버전의 전체 본문을 반환한다.

### 회원·소셜 연동 데이터

```text
TB_USER
  user_no bigint primary key
  user_status varchar
  display_name varchar null
  profile_image_url varchar null
  joined_at datetime
  last_login_at datetime
  withdrawn_at datetime null

TB_SOCIAL_ACCOUNT
  user_no bigint foreign key
  provider varchar
  provider_subject varchar
  email varchar null
  email_verified char(1) null
  linked_at datetime
  last_authenticated_at datetime
  unique(provider, provider_subject)

TB_POLICY_CONSENT
  user_no bigint foreign key
  policy_type varchar
  policy_version varchar
  consented_at datetime
```

- provider는 `NAVER`, `KAKAO`, `GOOGLE`, `APPLE`을 사용하되 adapter registry로 관리한다.
- 이메일은 unique constraint와 자동 계정 병합 기준으로 사용하지 않는다.
- OAuth access·refresh token은 로그인 완료 후 폐기하며 기본 회원 테이블에 저장하지 않는다.
- 탈퇴는 회원 상태 변경, 활성 세션 폐기, 소셜 연동 삭제, 제공자별 unlink/revoke를 하나의 작업으로 처리한다. 외부 API 실패는 재시도 queue와 운영 경보에 남기되 token·개인정보 원문은 로그에 남기지 않는다.

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
- `GET /api/v1/policies/:type`
- `GET /api/v1/policies/:type?version=v0.1`
- `GET /api/v1/auth/:provider/start`
- `GET /api/v1/auth/:provider/callback`
- `POST /api/v1/auth/signup/complete`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `DELETE /api/v1/me`

목록 크기는 일반 게시글 20개로 고정한다. `pinned_order`가 `1~3`인 공지는 별도 배열로 최대 3개를 먼저 반환하며 일반 게시글 수와 광고 위치 계산에서 제외한다. 광고 행은 API 결과에 포함하지 않는다. 상세 응답의 `contextPosts`는 공지 없이 현재 글과 같은 게시판에서 현재 글을 포함해 최대 20개 반환한다.

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
- 회원·관리자 인증 쿠키는 `HttpOnly`, `Secure`, 적절한 `SameSite`와 짧은 세션 만료를 사용한다.
- OAuth authorization code flow를 사용하고 provider가 지원하면 PKCE를 적용한다. 요청별 `state`, OIDC `nonce`, callback URL allowlist를 검증한다.
- 가입 완료 전 임시 인증 정보는 10분 이내 만료하며 약관 동의가 끝나기 전 정식 회원 세션을 발급하지 않는다.
- provider client secret과 Apple private key는 secret 저장소에 보관하고 브라우저·저장소·로그에 노출하지 않는다.
- 계정 연결·해제는 현재 로그인 세션만 믿지 않고 해당 provider 재인증을 요구한다.
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
- provider별 production client ID, callback URL, 검수·심사 결과
- OAuth 세션 만료, 계정 복구·연결 정책과 14세 미만 가입 처리
- GA4 측정 ID, 속성 보관 기간, 실제 계약 법인과 국외이전 항목

미정 항목은 확정값처럼 Docker, 환경 변수 예제, 배포 체크리스트에 넣지 않는다.
