# 운영 배포 기록 — 5c581c2

- 요청: 별도 대화에서 사용자가 운영 배포를 명시적으로 요청.
- 결과: 2026-09-23 22:36:28 KST, API·Web 운영 컨테이너 교체 완료.
- Git SHA: `5c581c2ad82a9f1565ac53349fbaae7afed9c9cd`.
- [CI 실행 35866422574](https://github.com/JeahaOh/blariyo/actions/runs/35866422574): verify, collector, images(api), images(web) 모두 success.
- 배포 원본: 해당 SHA 태그의 GHCR 이미지. 로컬 미커밋 문서 정리 작업은 이미지에 포함하지 않음.
- 신규 release: `/opt/blariyo/application/release-5c581c2ad82a9f1565ac5334`.
- 이전 release: `/opt/blariyo/application/release-56351a45eea650c0f02e5043`.

## 이미지와 설정

| 대상 | GHCR OCI index digest |
| --- | --- |
| API | `sha256:946d68ba8914bba28b28f9eff3f7334a0580f463bd3468a0c998862833cf3d6d` |
| Web | `sha256:e0b635cddc5f73826882676a37347941e8470586b3fa367f8866a37d7ede7659` |

- 저장소: `ghcr.io/jeahaoh/blariyo-api`, `ghcr.io/jeahaoh/blariyo-web`; linux/amd64 manifest를 확인하고 digest로 pull.
- 실행 컨테이너의 image 참조와 실제 image ID가 위 digest와 일치.
- 기존 운영 환경·비밀 파일을 서버 안에서 복제하고 소유권·권한을 보존.
- API `COLLECT_MANUAL_URL_ENABLED`, `COLLECT_DISCORD_COMMAND_ENABLED`, `COLLECT_BATCH_REVIEW_ENABLED` 및 Web의 대응 `NUXT_` 설정은 모두 false.
- Web Access 인증 설정과 빈 `NUXT_TRUSTED_CLIENT_IP_HEADER`를 기존 값대로 유지.
- DB V001–V005 ledger/checksum을 배포 커밋의 migration 원문과 대조. 배포 전후 동일. 신규 migration 미실행.
- Collector 서비스 배포·수집 활성화는 이번 배포에 포함하지 않음.

## 백업과 교체

- 22:35:26 KST 새 DB 백업 생성, R2 업로드·실제 다운로드 SHA-256 대조 통과.
- 암호화 파일 90,332 bytes, SHA-256 `6ccdb857d6cac0573c27f4f51da27c63f81978ec65a961571362693bd19ef98d`.
- R2 실파일 다운로드 → age 복호화 → 격리 PostgreSQL 18 복원 → 운영 ledger·정책 본문 해시·게시판/게시글 수 대조 통과. 임시 복원 컨테이너 정리 완료.
- publish/outbox/cleanup timer를 중지하고 실행 중 작업 종료 확인 후 API → Web 순서로 Compose 교체.
- 프로젝트 `blariyo-app` 유지. DB·Nginx·Tunnel 컨테이너와 볼륨 재생성 없음.
- timer 3개 재개. backup/log-retention timer도 active. 작업 상태 success.
- 서버 부팅 helper 및 저장소의 `deploy/operations/start-application.py`를 신규 release로 갱신.

## 운영 검증

| 확인 | 결과 |
| --- | --- |
| API `/internal/health/ready` | 200, READY |
| Web `/health/live` | 200, UP |
| API·Web·DB·Nginx | healthy, OOM 없음, host port 없음 |
| API·Web·Nginx 로그 | syslog 유지 |
| `/meme`, `/terms`, `/privacy`, `/health/live` | 공개 HTTPS 200 |
| `/api/v1/boards/meme/posts` | 200, success=true, totalItems=0 |
| 익명 `/admin` | 302, Cloudflare Access 로그인으로 이동 |
| 익명 `/health/ready` | 503, no-store. 운영자 인증 실패를 NOT_READY로 응답하는 현재 코드의 동작. 인증된 readiness는 미검증 |
| HTTP / www | 각각 HTTPS 301 / 대표 도메인 308 |
| 공개 HTML·JSON 404 | no-store |
| Web 직접 JSON 404 | no-store |
| 홈에서 참조한 JS/CSS 10개 | 원본·쿼리 변형 모두 200, 바이트 SHA-256 동일, immutable 캐시 정책 |
| 컨테이너 메모리 표본 | API 약 63 MiB/256 MiB, Web 약 48 MiB/384 MiB |

서버 증거: 신규 release의 `deployment.json`, `public-verification.json` (root 전용).

## 복귀와 남은 검증

- 이전 release와 API/Web image를 보존. 부팅 helper 이전 사본은 `/opt/blariyo/operations/start-application.py.before-5c581c2`.
- DB V005를 유지하므로 기존 이미지와의 호환 경계를 유지. 장애 시 이전 release의 Compose로 API → Web 교체 후 부팅 helper를 이전 사본으로 복구하고 timer 상태를 확인.
- 이번 운영에서 고의 rollback·VM 재부팅 시험은 실행하지 않음. 복귀 준비와 실제 복귀 시험은 구분.
- 실제 운영자 Access MFA 후 작성·이미지 업로드·발행·숨김 인수 검증은 남아 있음. 공개 글이 없어 상세 페이지 데이터 검증도 미실행.
- 새 자산명은 기존 Cloudflare 9개 경로의 쿼리 무시 규칙에 추가하지 않음. 신규 자산 기본 제공·해시·immutable 응답은 통과했으나 쿼리 분산 방지는 미적용 상태로 기록.
- 기존 탭의 구 lazy chunk 보존 및 무중단 교체는 보장하지 않음.
- 이번 요청에서 commit/push 또는 자동 CD workflow 변경은 수행하지 않음.
