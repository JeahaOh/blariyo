# M0 운영 상태와 남은 작업

- 기준일: 2026-09-20 KST
- 판정: **공개 서버 배포 완료. 관리자 실제 쓰기 흐름과 장기 운영 검증은 남아 있다.**
- 근거: [TASK-01~20 목록](../../../worklog/task-list/README.md), [TASK-19 배포 증거](../../../worklog/task-list/09/20/infrastructure-setup/TASK-19.md)
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

과거 TASK의 “배포 대기”는 당시 단계의 결과다. 현재 상태를 이유로 과거 기록을 소급 변경하지 않는다.
정책 v0.1 본문을 덮어쓰지 않으며 변경이 필요하면 새 버전으로 검토·발행한다.

## 다음 작업

1. 운영자가 Access MFA를 직접 완료한 뒤 관리자 권한과 업로드·발행·숨김 흐름을 검증한다. 인증 코드·쿠키를 채팅에 보내지 않는다.
2. 맥에 보관된 DB 복구키를 별도 안전한 장소에도 보관한다. 서버에는 암호화 public recipient만 지속 보관한다.
3. 최신 백업 시각·timer 실패·자원을 관찰하고 외부 가용성/실패 알림을 구성한다.
4. 7일 보관 관찰, 월간 DB 복원, 별도 일정의 VM 재부팅·새 VM 복구를 수행한다.
5. AWS 무료 플랜·크레딧 만료와 비용 알림을 확인한다. 이번 배포로 결제/요금제를 변경하지 않았다.

## 운영 진입점

- [서비스·정기 작업 확인과 되돌리기](../../../deploy/operations/README.md)
- [백업 실행·복원 시험·복구키 보관](../../../deploy/backup/README.md)
- [앱 설정·image·서버 보관 도구](../../../deploy/application/README.md)
- [PostgreSQL 설치·migration·정책 seed](../../../deploy/postgresql/README.md)
- [현재 공개 정책](../../legal/m0-core/README.md)
- 공개 읽기 점검: `python3 deploy/application/check-public.py`

설치·발행 명령은 조회 명령이 아니다. 공개 점검을 위해 설치·정책 발행을 반복 실행하지 않는다.
