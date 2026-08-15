# 2026-08-08 서비스 기획 세션

> [!WARNING]
> **대체됨 · 과거 비교용 기록**
> 아래 내용은 2026-08-08 당시 결정이며 현행 요구사항이 아니다. MySQL 결정은 [2026-08-14 PostgreSQL 전환 결정](./2026-08-14-postgresql-transition.md)으로 대체됐다. 현재 정본은 [서비스 기획서](../planning/01-service-plan.md), [인프라 설계서](../planning/02-infra-plan.md), [화면 설계서](../planning/03-screen-design.md), [분석·광고 계획](../planning/04-analytics-ad-plan.md)과 [2026-08-12 정정 Tasklist](./2026-08-12-docs-correction-tasklist.md)를 따른다.

## 1. 목적

`blariyo`를 범용 커뮤니티에서 운영자 큐레이션형 유머 피드로 전환하기 위한 서비스 범위, 인프라, 화면, 분석·광고 운영 기준을 확정한다.

## 2. 확정한 결정

### 서비스 범위

- 내부 코드명은 `blariyo`, 서비스 가칭은 `피식톡`이다.
- M0는 로그인 없는 최신 피드, 게시글 상세, 조회 기록, 관리자 게시글 API만 구현한다.
- M1에서 회원, 좋아요, 댓글, 신고, 최소 관리자 화면을 추가한다.
- M1.5에서 관리자 승인형 사용자 제보를 추가한다.
- 사용자가 작성한 제보는 즉시 공개하지 않는다.
- 자동 크롤링, 영상 호스팅, 네이티브 앱, 추천 알고리즘은 초기 범위에서 제외한다.

### 데이터와 서버

- 영구 저장소는 MySQL 8 하나만 사용한다.
- MongoDB, Redis, 세션 클러스터링은 초기에는 사용하지 않는다.
- 인증은 stateless access token과 회전형 refresh token을 기준으로 한다.
- 운영은 AWS Lightsail 서울 리전의 2 vCPU, RAM 4GB 인스턴스 한 대에서 시작한다.
- Nginx, Nuxt, Express, MySQL을 Docker Compose로 운영한다.
- Cloudflare Free를 DNS, TLS 보조, 정적 파일 CDN에 사용한다.
- Lightsail snapshot과 S3 원격 백업을 함께 사용한다.
- 다중 서버와 Redis는 측정된 병목이나 무중단 요구가 생겼을 때만 추가한다.

### 화면과 앱

- M0 웹 화면은 홈 피드와 게시글 상세 두 개로 제한한다.
- 로딩, 빈 목록, 오류, 숨김 게시글은 별도 페이지가 아니라 화면 상태로 처리한다.
- 데스크톱과 모바일은 동일한 Nuxt/Vue 컴포넌트를 반응형 CSS로 제공한다.
- 향후 앱은 조건을 충족할 때 `Capacitor + Nuxt/Vue client build`로 검토한다.
- 앱 와이어프레임은 정보 구조 검토용이며 현재 구현 범위가 아니다.

### 분석과 광고

- M0부터 MySQL 내부 방문 이벤트와 GA4를 함께 사용한다.
- 핵심 제품 지표의 정본은 MySQL이고, GA4는 유입 채널·기기·화면 흐름 분석에 사용한다.
- 분석 동의 전에는 Google tag를 로드하지 않는다.
- M0~M1.5 기본 화면에는 광고를 넣지 않는다.
- 광고는 MAU 1만, 최근 30일 5만 PV, 직접 광고 제안 중 하나를 충족한 뒤 실험한다.
- 광고 구조는 게시글 상세 상단·하단 배너와 대형 광고로 구성한다.
- 대형 광고는 첫 게시글에 노출하지 않고 하루 최대 3회로 제한한다.
- 대형 광고 사이에는 상세 3개와 20분 간격을 모두 적용한다.
- 대형 광고는 일 1회부터 시작해 지표를 확인하며 최대 일 3회까지 올린다.
- 일반 배너를 자체 modal로 확대하지 않고 광고 사업자가 허용한 전면형 상품만 사용한다.
- 전체 광고는 feature flag로 즉시 비활성화할 수 있어야 한다.
- 안정적인 운영비 회수 목표는 월 10만 PV로 잡는다.

## 3. 작성·변경 파일

- `README.md`: 프로젝트 방향, 단계별 범위, 기술 기준, 문서 링크 정리
- `docs/planning/01-service-plan.md`: 서비스 범위, 운영 정책, 데이터·API, 확장 게이트
- `docs/planning/02-infra-plan.md`: Lightsail 서울 리전, 배포·백업·복구·확장 기준
- `docs/planning/03-screen-design.md`: 데스크톱·모바일·앱 화면과 광고 확장 화면 기준
- `docs/planning/04-analytics-ad-plan.md`: GA4, 동의, 광고 손익과 노출 정책
- `docs/wireframes/desktop/index.html`: 데스크톱 웹 참고 화면
- `docs/wireframes/mobile/index.html`: 모바일 웹 참고 화면
- `docs/wireframes/app/index.html`: 향후 앱 참고 화면
- `docs/wireframes/community/index.html`: M1 댓글과 M1.5 제보 참고 화면
- `docs/wireframes/ads/index.html`: 분석 동의, 상세 배너, 대형 광고 참고 화면

## 4. 검증 결과

- 기획 문서의 로컬 Markdown 링크를 검사했다.
- 광고 와이어프레임 JavaScript 문법을 검사했다.
- 광고 와이어프레임을 데스크톱과 모바일 크기로 렌더링했다.
- 모바일에서 긴 제목과 화면 탭이 잘리지 않도록 폭과 줄바꿈을 보정했다.
- `git diff --check`에서 공백 오류가 없음을 확인했다.
- 프로젝트의 기존 API 변경 파일은 이번 문서 작업에서 수정하지 않았다.

## 5. 남은 작업

1. M0 구현 작업을 이슈 단위로 분리한다.
2. 기존 Express 인증, 권한 코드, 오류 middleware를 정상화한다.
3. MongoDB 의존성을 운영 구성에서 제거한다.
4. `TB_POST`, `TB_VISIT_EVENT`, migration 체계를 구현한다.
5. 게시글 공개·관리 API와 통합 테스트를 작성한다.
6. Nuxt 홈·상세·상태 화면을 구현한다.
7. GA4와 분석 동의 기능을 연결한다.
8. production Compose, Nginx, 백업·복원 절차를 구현한다.
9. 초기 콘텐츠 30개를 준비하고 사용자 100명 내외로 4주 검증한다.

광고 구현은 M0 작업 목록에 넣지 않는다. 분석 기준값을 먼저 확보한 뒤 광고 게이트를 통과했을 때 별도 작업으로 연다.

## 6. 다음 세션 시작점

`docs/planning/01-service-plan.md`의 M0 개발 계획을 기준으로 구현 이슈를 작성한다. 첫 작업은 기존 API 인증과 권한 체계를 실제 코드·테스트 기준으로 점검하는 것이다.
