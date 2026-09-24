# GTM 운영 배포 결과

- 교체 완료: **2026-09-25 01:47:24 KST**. API → Web 순차 교체, 기본 검사 후 부팅 helper 갱신·예약 timer 재개.
- 대상: `8af72449a7d56c9701efd0d73dc7d430a66f9610`, [CI #15](https://github.com/JeahaOh/blariyo/actions/runs/36026079723)의 verify·collector·API/Web images 성공 확인.
- 운영 release: `/opt/blariyo/application/release-8af7244-gtm-20260925`.
- 복귀 release: `/opt/blariyo/application/release-5c581c2-db-v008-20260923`. 이전 이미지·설정·부팅 helper 사본 보존.
- 로컬 다른 세션의 미커밋 변경 및 후속 `4605399` 문서 커밋은 이번 운영 이미지에 포함하지 않았다.

## 배포 이미지

| 대상 | GHCR digest |
| --- | --- |
| API | `ghcr.io/jeahaoh/blariyo-api@sha256:ad83b8f08cf57894e08ca4072c7ea1edcb3bf2c5a15f101b12ad45ce1ab13e94` |
| Web | `ghcr.io/jeahaoh/blariyo-web@sha256:480c40ebe204e59292a2e0d85aa7eed4b46dad85b80f78ef5f9249e68c5e066a` |

CI summary의 digest와 서버 pull·실행 image 식별자를 대조했고 linux/amd64를 확인했다. 서버 build는 수행하지 않았다.
기존 runtime env·secret은 서버 안에서 복제하고 내용·소유자·권한을 대조했다. batch 검수 true,
URL·Discord 접수 false, 앱 GA4·카카오 false를 유지했다. Collector 서비스는 배포하지 않았다.

## 백업·DB·운영 작업

- 새 백업 생성: 01:44:49 KST, 암호화 파일 370,825 bytes.
- SHA-256: `94f1535d963a5f36d22cd38d377dc0ef83250410e3a771032c56f254e92cc59b`.
- R2 실제 다운로드·SHA-256·age 복호화·격리 PostgreSQL 18 복원 통과. 복원 DB의 API ledger·정책 본문 해시·게시판/게시글 수를 운영 DB와 대조했다.
- API V001–V008 checksum 전부 및 Collector V002–V006 checksum을 배포 커밋과 대조했다. Collector V001을 포함한 전체 ledger는 배포 전후 동일했다.
- DB migration·정책 발행·콘텐츠 변경은 수행하지 않았다. DB·Nginx 컨테이너 ID를 유지했다.
- publish/outbox/cleanup timer 중지·진행 작업 종료 후 교체했고 3개를 재개했다. backup/log-retention 포함 5개 timer active·작업 결과 success 확인.
- 서버 helper 사본: 새 release의 `previous-start-application.py`. 서버와 저장소의 부팅 경로를 새 release로 맞췄다.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| API readiness / Web liveness | 200 READY / 200 UP |
| API·Web·DB·Nginx | healthy, OOM 없음, host port 없음 |
| `/meme`, `/terms`, `/privacy`, `/cookie-settings`, `/health/live` | 공개 HTTPS 200 |
| GTM HTML | head 맨 앞 script·body 바로 뒤 noscript, ID 2회, CSP nonce 일치 |
| 실제 Chrome GTM 요청 | `gtm.js?id=GTM-5BRTQ5T3` 페이지 새로고침당 1회, HTTP 200 |
| GTM 실행 | `window.google_tag_manager['GTM-5BRTQ5T3']` 초기화, dataLayer `gtm.js` 시작 이벤트 확인, 콘솔 오류 0건 |
| 공개 상세 | `/meme/posts/38` HTTP 200·GTM 삽입 확인 |
| 정책 API | terms/privacy v0.1·시행일·placeholder 검사 통과 |
| 관리자 보호 | 익명·위조 헤더 모두 Access 302, Core 내부 경로 외부 404 |
| redirect | HTTP → HTTPS, www → 대표 도메인 정상 |
| 오류 캐시 | 공개 HTML/JSON 404·Web 직접 JSON 404 모두 no-store |
| 정적 JS/CSS 10개 | 원래 URL·쿼리 변형 200, 바이트 해시 동일, immutable |
| 사이트맵 | index·하위 XML 200, 일반 페이지 3개·공개 게시글 74개, robots의 Sitemap 안내 확인 |
| 격리 Web 캐시 회귀 | 검증된 GTM Docker snapshot에서 4/4 통과 |

중단 후 08:23 KST에 공개 `/meme`, `/health/live`, `/robots.txt`의 200과 GTM 삽입을 재확인했다.
이어 SSH로 서버의 `deployed` 기록과 새 부팅 경로를 재조회했다. 조회 과정의 일시적 SSH 연결 실패는 재시도로 해소했다.

서버 증거는 새 release의 `gtm-deployment.json`, `public-verification-gtm.json`에 root 전용으로 보관했다.
로컬 검증 자료는 `/private/tmp/blariyo-gtm-deploy-20260925/`에 있다. 비밀값·복구키는 기록에 포함하지 않았다.

## 남은 검증

- GTM 설치·실제 로딩 확인이며 Tag Assistant의 태그별 실행, GA4 이벤트 수신, GTM 콘솔의 태그·동의 설정 검증은 아니다.
- 실제 관리자 MFA 후 작성·업로드·발행·숨김 인수, 운영 rollback·VM 재부팅 시험은 수행하지 않았다.
- Cloudflare 기존 9개 정적 자산 규칙에 새 파일명을 추가하지 않았다. 기본 CDN 제공·캐시 응답은 확인했고 새 자산의 쿼리 분산 방지는 별도다.
- 단일 VM 순차 교체이며 무중단 또는 구 탭의 lazy chunk 보존을 보장하지 않는다.
