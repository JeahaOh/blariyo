# M0 운영 상태와 남은 작업

- 기준일: 2026-09-20 KST
- 판정: **공개 서버 배포 완료. 관리자 실제 쓰기 흐름과 장기 운영 검증은 남아 있다.**
- 근거: [TASK-01~20 목록](../../worklog/2026-09-23/directory-reorganization/previous-task-list-index.md), [TASK-19 배포 증거](../../worklog/2026-09-20/infrastructure-setup/TASK-19.md)
- 역할: 현재 실행 결과를 찾아가는 안내. 제품·법무·인프라 정본을 대신하지 않는다.

## 현재 구성

| 항목 | 배포 결과 |
| --- | --- |
| 공개 웹 | `https://blariyo.com/` → `/meme`, `www` → 대표 도메인 308 |
| 공개 이미지 | `https://media.blariyo.com/`, public R2 버킷만 연결 |
| 서버 | AWS Lightsail 서울 x86_64·2GB, swap 2GB, 고정 IP 미사용 |
| 연결 | Cloudflare → Tunnel → Nginx → Nuxt Web/BFF → Nest Core → PostgreSQL 18 |
| 포트 | DB·Core·Web·Nginx host port 미공개. SSH 관리 경계와 별도 |
| 방식 | 단일 VM Docker Compose 교체. 블루그린·무중단 배포 아님 |
| 운영 이미지 | 맥에서 검증한 amd64 archive를 전송. 서버 build 없음 |
| 현재 release | `/opt/blariyo/application/release-56351a45eea650c0f02e5043` |
| 기능 | M0 Core. 회원·광고·GA4·카카오·수집 기능 비활성 |
| 연락처 | 기존 비공개 입력 재사용. Cloudflare Email Routing → 일반 Gmail |

## 확인된 결과와 한계

| 범위 | 확인한 증거 | 완료로 확대하지 않는 범위 |
| --- | --- | --- |
| DB | V001–V005·ledger, app/migrator/backup 역할별 접속·허용/거부 | 향후 migration·부하 성능 |
| 앱 | DB·Core·Web·Nginx healthy, 기존 cloudflared 유지 | 2GB 최대 수용량·무중단 보장 |
| 정책 | TERMS/PRIVACY v0.1, 2026-09-20 시행, SQL 본문 해시·공개 API·화면 확인 | 후속 기능 법무 gate·개별 사건 면책 |
| 공개 경로 | 목록·정책·health HTTPS 200, HTTP→HTTPS, www→대표 도메인 | 실제 게시글 전체 흐름. 현재 공개 글 없음 |
| 관리자 | 이메일 Allow, MFA 6시간, 익명·위조 JWT의 관리자 경로 Access 302, 내부 경로 외부 404 | 실제 TOTP 완료 후 앱 운영자 매핑·작성·업로드·발행·숨김 |
| R2/CDN | 세 버킷별 키 검사, 앱 어댑터 private→public 복사, 이미지 HTTPS, 단일 URL purge 수락 | CDN HIT·전체 전파·브라우저 CORS·교차 객체 읽기/쓰기 차단 전체 검사 |
| 작업 | 예약 발행·outbox·cleanup timer 설치, 수동 단발 실행 | 실제 예약 게시글 장기 처리·외부 실패 알림 |
| 로그 | 전용 rsyslog, root 접근 제한, 최대 7일 보관 timer, 실제 수신·합성 만료 파일 삭제 | 제공자 감사 기록·호스트 로그·DB 운영 이력은 같은 TTL 대상 아님 |
| DB 백업 | 하루 두 번 age 암호화→R2→실제 다운로드 SHA-256, 격리 PostgreSQL 18 복원·정책/ledger/수량 대조 | 새 VM 전체 복구·RTO, media 전체 복제, 7일 지난 실제 object 삭제 관찰 |
| 부팅 | 서비스·timer enabled/active | 실제 VM 재부팅 시험 |
| 보안 보강 | JS 9개 쿼리 무관 캐시·Cloudflare $1 비용/DDoS 알림. 후속 게이트웨이 오류 `no-store` 적용, 정상 JS/CSS 24개·HTML/JSON 오류 검사 | 경로 캐시 확대·AWS 예산/MFA는 콘솔 연결 차단. 이미지·이메일 수신·공유 IP·관리자 전체 흐름·장기 관찰 미검증. [실행 기록](security-protection-status.md) |

과거 TASK의 “배포 대기”는 당시 단계의 결과다. 현재 상태를 이유로 과거 기록을 소급 변경하지 않는다.
정책 v0.1 본문을 덮어쓰지 않으며 변경이 필요하면 새 버전으로 검토·발행한다.

## 다음 작업

1. 운영자가 Access MFA를 직접 완료한 뒤 관리자 권한과 업로드·발행·숨김 흐름을 검증한다. 인증 코드·쿠키를 채팅에 보내지 않는다.
2. 맥에 보관된 DB 복구키를 별도 안전한 장소에도 보관한다. 서버에는 암호화 public recipient만 지속 보관한다.
3. 최신 백업 시각·timer 실패·자원을 관찰하고 외부 가용성/실패 알림을 구성한다.
4. 7일 보관 관찰, 월간 DB 복원, 별도 일정의 VM 재부팅·새 VM 복구를 수행한다.
5. AWS 비용 알림을 확인한다. 1차 보강 조회에서는 무료 플랜·잔여 크레딧 $120·2027-03-15 종료 표시를 확인했다. 결제/요금제는 변경하지 않았다.
6. [보안·비용 보호 적용 계획](../system-design/09-security-cost-protection-plan.md)의 정적 JS 9개 캐시·Cloudflare 비용/DDoS 알림과 후속 게이트웨이 오류 `no-store`를 적용했다. JS/CSS 경로 규칙으로의 확대는 콘솔 연결 후 검증·저장해야 하므로, 그 전에는 새 배포 자산이 기존 9개 규칙에 자동 포함되지 않는다. 정상 이용·공유 IP·관리자 흐름 검증 후 요청 제한을 진행한다. 전체 보강 완료는 아니다.
7. GitHub Actions의 Node 20 런타임 경고를 Node 24 지원 action으로 갱신하고, GHCR 이미지 게시 후 Lightsail에 자동 배포하는 SSH workflow를 추가한다. 현재 CI는 이미지 게시까지만 수행하며 운영 서버 자동 배포는 하지 않는다. 상세 TODO는 [CI/CD 후속 기록](../../worklog/2026-09-20/local-ui-cicd/TODO-CICD-DEPLOY.md)이다.

보안 작업은 사용자 요청에 따라 코드·설정·문서, SSH 서버 점검, 공개 HTTP 검증 범위에서 마감했다.
관리 콘솔/API 설정은 이번 범위 밖으로 두고, [수행한 일·남은 일과 재개 조건](security-protection-status.md#7-이번-작업-마감과-남은-일)에 기록했다.

## 로컬 후속 작업 — 운영 반영 전

앱 JSON 오류의 `no-store` 보완을 구현하고 production build·로컬 HTTP 회귀 검사·타입/정적 검사를
통과했다. 운영 앱 배포는 하지 않았으며 기존 게이트웨이 보호를 유지한다.
[검증 범위와 배포 대기 항목](security-protection-status.md#9-앱-원본-json-오류-보완--로컬-완료-운영-배포-대기)을 따른다.

2026-09-20 로컬에서 M0 공개 화면을 시각 기준에 맞춰 수정하고 GitHub CI workflow를 작성했다.
실제 HOT 25건은 로컬 DB의 DRAFT로 저장했다. 운영 앱 배포·운영 콘텐츠 발행은 하지 않았다.
[화면 검증](../testing/ui-wireframe-review-20260920.md), [콘텐츠 저장](../../scripts/content/README.md),
[배포 실행서](deployment-runbook.md), [배포 정책](deployment-policy.md)을 따른다.

## 환경 설정 기준

local/dev/stage/prod `.env` 예시와 이미지 URL 조립 규칙은 [환경별 설정과 이미지 URL 계약](environment-configuration.md)을 따른다.
공개 이미지는 `IMAGE_ORIGIN + '/' + publicStorageKey`로 계산한다. 공개 게시글 이미지는 `content/published/posts/{postId}/{imageId}-{sha256}.{ext}` key를 사용하고, 수집용 `collect/media/*`는 public origin에 직접 노출하지 않는다.

## 운영 진입점

- [서비스·정기 작업 확인과 되돌리기](../../deploy/operations/README.md)
- [백업 실행·복원 시험·복구키 보관](../../deploy/backup/README.md)
- [앱 설정·image·서버 보관 도구](../../deploy/application/README.md)
- [PostgreSQL 설치·migration·정책 seed](../../deploy/postgresql/README.md)
- [현재 공개 정책](../legal/m0-core/README.md)
- 공개 읽기 점검: `python3 deploy/application/check-public.py`

설치·발행 명령은 조회 명령이 아니다. 공개 점검을 위해 설치·정책 발행을 반복 실행하지 않는다.
