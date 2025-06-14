# 블라리요 (Blariyo)

사용해보지 않았거나, 스킬 레벨이 낮은 기술을 사용하여 간단한 커뮤니티 게시판을 만드는 CMS(Content Management System) 개발.

### 🏷️ 소개

쓸데없는 이야기부터 진지한 대화까지,  
글 하나, 댓글 하나가 작은 우주가 됩니다.  
Blariyo — 그냥 말하고 싶은 사람들을 위한 곳.

### 🏷️ 슬로건 및 배너 카피

💬 모든 이야기의 시작, Blariyo.

----

## ✅ 기능 요구사항 (Functional Requirements)

### 📌 1. 사용자 관리

- 회원 가입 / 로그인 / 로그아웃 (JWT) / refresh token
- 회원 정보 수정 / 탈퇴
- 사용자 권한 구분 (관리자 / 일반 사용자)
- OAuth 로그인 (시간이 된다면: Google, Naver, Kakao 등)

### 📌 2. 게시판 기능

- 게시글 목록 조회 (페이징 / 검색 / 정렬 포함)
- 게시글 작성 / 수정 / 삭제
- 게시글 상세 조회
- 이미지 업로드 (S3 또는 로컬 저장소)
- 게시글 카테고리 분류

### 📌 3. 댓글 기능

- 댓글 작성 / 수정 / 삭제
- 대댓글 (Nested Comments)

### 📌 4. 좋아요 / 싫어요 기능

- 게시글 및 댓글에 대한 좋아요 / 싫어요 기능

### 📌 5. 신고 기능

- 게시글 및 댓글 신고
- 관리자 페이지에서 신고 처리 기능

### 📌 6. 관리자 기능

- 유저 관리 (조회 / 정지 / 탈퇴 처리)
- 게시글 및 댓글 모니터링 및 삭제
- 신고 접수 및 조치
- 게시판 생성 삭제 수정 등

### 📌 7. 알림 기능 (선택사항)

- 댓글, 대댓글, 좋아요 등에 대한 실시간 알림
- 알림 목록 페이지

----

## ✅ 비기능 요구사항 (Non-functional Requirements)

### 🔧 기술 스택 관련

-  Docker: 모든 서비스 컨테이너화
-  Nginx: Reverse Proxy + 정적 파일 서빙
-  MySQL: 사용자, 게시판, 댓글 등 관계형 데이터 저장
-  MongoDB: 로그, 통계 데이터 저장 (비정형 데이터)
-  Node.js + Express: API 서버
-  Nuxt.js 또는 Next.js: 프론트엔드 SSR or SSG 처리

### 📈 시스템 아키텍처

- RESTful API 설계 또는 GraphQL (선택 사항)
- JWT 인증 기반 보안 처리
- 로깅 및 모니터링 시스템 (예: Morgan, Winston, Prometheus)
- 배포 자동화 (CI/CD, GitHub Actions or Jenkins)
- 확장성 고려한 마이크로서비스 아키텍처(선택 사항)

### 🛡 보안

-  비밀번호 해싱 (bcrypt 등)
-  CSRF / XSS / SQL Injection 방어
-  HTTPS 적용 (Let’s Encrypt)
-  관리자 페이지 접근 제한

### 📊 성능 / 확장성

-  캐싱 (Redis 등)
-  DB 인덱싱 및 최적화
-  페이지네이션
-  파일 업로드 시 CDN 사용 고려

----

### ✅ 비기능 요구사항 추가 고려사항

-  반응형 디자인 (모바일/태블릿 지원)
-  다국어 지원 (i18n)
-  SEO 최적화 (Next.js/Nuxt.js SSR 기능 활용)
-  테스트 코드 작성 (Jest, Cypress 등)

----

## ✅ 설계

### 1. 📌 인프라 아키텍쳐 (초안)

```txt
  [Client] <--> [Nginx (Reverse Proxy)]
                         |
        ┌────────────────┴──────────────────┐
        |                                   |
  [Frontend (Vue.js)]          [Backend (NestJS)]
                                            |
                                 ┌──────────┬─────────────┐
                                 |                        |
                             [MySQL]               [MongoDB (Optional, for logs)]
```

- Docker Compose로 모든 구성 요소를 컨테이너화
- Nginx는 정적 파일 서빙 + API 요청 리버스 프록시
- FE (미확정) : Vue 3 + Composition API + Vite
- BE : NestJS
- DB : MySQL, MongoDB

### 2. 📌 어플리케이션 아키텍쳐 (BE)

```txt
   [Express Router]
          |
    [Controllers]
          |
     [Services]
          |
  [Repositories (DB Access)]
          |
       [MySQL]
```

- Controller : 요청 처리 및 응답
- Service : 비즈니스 로직 처리
- Repository : DB 쿼리 분리 (Sequeliae 또는 Knex)
- 유효성 검증 : express-validator 또는 joi
- 인증 : JWT (JSON Web Token)

### 3. 📌 ERD 설계 (초안)

```txt
  Users
  - id (PK)
  - email
  - username
  - password
  - role (user/admin)
  - created_at
  - updated_at

  Posts
  - id (PK)
  - user_id (FK → Users)
  - title
  - content
  - created_at
  - updated_at

  Comments
  - id (PK)
  - post_id (FK → Posts)
  - user_id (FK → Users)
  - parent_id (nullable, self FK)
  - content
  - created_at
  - updated_at

  Likes
  - id (PK)
  - user_id (FK → Users)
  - post_id (FK → Posts, nullable)
  - comment_id (FK → Comments, nullable)
  - is_like (boolean)

  Reports
  - id (PK)
  - user_id (FK → Users)
  - post_id / comment_id
  - reason
  - created_at
```

### 4. 📌 API 명세서 (초안)

| Method |  Endpoint |  Description |  Auth |  Body |
| :--- | :--- | :--- | :---: | :--- |
|POST   |  /api/auth/register  |  회원가입         | ❌ |  email, username, password |
|POST   |  /api/auth/login     |  로그인           | ❌ |  email, password |
|GET    |  /api/posts          |  게시글 목록 조회   | ❌ |  ?page=1&search=... |
|GET    |  /api/posts/:id      |  게시글 상세        | ❌ |  - |
|POST   |  /api/posts          |  게시글 작성       | ✅ |  title, content |
|PUT    |  /api/posts/:id      |  게시글 수정        | ✅ |  title, content |
|DELETE |  /api/posts/:id      |  게시글 삭제        | ✅ |  - |
|POST   |  /api/posts/:id/like |  게시글 좋아요     | ✅ |  - |
|POST   |  /api/comments       |  댓글 작성         | ✅ |  post_id, parent_id?, content |
|GET    |  /api/users/me       |  내 정보 조회      | ✅ |  - |

### 5. 📌 프로젝트 파일 구조

단일 레포 기반 구성

```txt
blariyo/
  ├── api.core/ # NestJS core API 서버
  │   ├── src/
  │   │   ├── app.module.ts # 루트 모듈
  │   │   ├── main.ts # 앱 진입점
  │   │   │
  │   │   ├── config/ # 환경 설정 관련
  │   │   │   ├── config.module.ts
  │   │   │   └── config.service.ts
  │   │   │
  │   │   ├── common/ # 공통 모듈
  │   │   │   ├── guards/
  │   │   │   ├── filters/
  │   │   │   ├── interceptors/
  │   │   │   ├── decorators/
  │   │   │   └── utils/
  │   │   │
  │   │   └── modules/ # 도메인 모듈
  │   │       └── domain/ # 각 도메인별 모듈
  │   │           ├── domain.module.ts
  │   │           ├── domain.controller.ts
  │   │           ├── domain.service.ts
  │   │           ├── domain.repository.ts
  │   │           └── dto/
  │   │
  │   ├── .env
  │   └── Dockerfile
  │
  ├── frontend/                # Vue 3
  │   ├── public/
  │   ├── src/
  │   │   ├── components/
  │   │   ├── pages/
  │   │   ├── router/
  │   │   ├── store/
  │   │   └── App.vue
  │   ├── vite.config.js
  │   └── Dockerfile
  │
  ├── nginx/                   # Nginx 설정
  │   └── default.conf
  │
  ├── docker-compose.yml
  └── README.md
```

----

### 🛠 도입 고려 라이브러리 / 툴

-  ORM: Sequelize or Prisma (JS에서 추천)
-  DB 마이그레이션: Sequelize CLI
-  유효성 검증: express-validator or joi
-  인증: jsonwebtoken, bcrypt
-  로깅: winston, morgan
-  테스트: Jest or Vitest
-  API 문서화: Swagger (swagger-jsdoc + swagger-ui-express)

----
