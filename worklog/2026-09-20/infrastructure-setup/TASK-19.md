# TASK-19 — 정책 정식 발행과 Lightsail 운영 배포

- 수행일: 2026-09-20 KST
- 요청: 단계별 작업을 이어서 운영 서버 배포까지 수행. 시행일은 오늘, 보관은 문제 없는 최소 범위.
- 결과: **공개 사이트 운영 배포 완료. 관리자 실제 로그인은 사용자의 TOTP 입력 대기.**
- 이전 TASK-01~18의 당시 미완료 기록은 소급 수정하지 않았다.

## 1. 정책 발행

- 공개 연락처 기존 파일 재사용, 실값을 Git·작업 기록에 복사하지 않음.
- AWS 청구 화면의 Amazon Web Services Korea LLC·서울과 Cloudflare Email Routing → 일반 Gmail 확인.
- Cloudflare/Google의 글로벌 처리와 사업자 보존을 현재 M0 본문에 반영. 자체 7일 진단 로그와 제공자 보안/감사 로그를 구분.
- 확정 TERMS·PRIVACY v0.1을 실제 앱 `policies:publish`로 등록. 당일 effectiveAt·체크섬 guard 유지.
- 사전 DB dump 보관, 정제된 본문 SHA-256 독립 SQL readback 일치. 기존 draft.1·draft.2 보존.
- 초기 seed draft.2 본문을 별도 고정했고 신규 initialize의 선택 `--publish-policies` 단계로 확정 발행 연결.
- 공개 API·화면에서 v0.1·2026-09-20·미입력 표식 없음 확인. 약관 팝업·개인정보 화면 시각 확인.
- 후속 회원·GA4·광고 조건은 유지. 법률상 모든 개별 쟁점의 외부 전문가 확인이나 일괄 면책을 의미하지 않음.

## 2. 컨테이너와 공개 연결

- release: `/opt/blariyo/application/release-56351a45eea650c0f02e5043`
- Core·Web·PostgreSQL·Nginx 모두 healthy, OOM 없음. 기존 cloudflared 정상 유지.
- 모든 위 컨테이너에 host port 없음. cloudflared만 기존 network에 더해 edge 연결.
- Tunnel 공개 경로 `blariyo.com → http://nginx:8080` 추가.
- apex 기존 Squarespace A를 proxied Tunnel CNAME으로 변경. www도 같은 터널에 연결하되 Nginx에서 apex로 308 이동.
- 메일 MX/TXT·R2 media 도메인 유지. Always Use HTTPS 활성, 최소 TLS 1.2·TLS 1.3 활성.
- 단일 VM Compose 배포. blue/green·무중단 전환 구현 아님.

## 3. 자동 작업과 로그

- 부팅 복구 systemd service, 매분 예약 발행/outbox, 일일 cleanup 설치·수동 1회 실행 PASS.
- 전용 rsyslog receiver·AppArmor 최소 경로 허용·Docker dual logging cache 비활성.
- API/Web/Nginx 진단 로그 일별 root 600, 부모 700. UTC 당일+이전 5일 유지·일일 TTL timer.
- 실제 Docker log 수신·10일 전 합성 로그 삭제 PASS. 소유자·symlink·무관 파일 보호 검사 PASS.
- DB 운영 이력·Cloudflare 감사 기록·호스트 로그를 이 TTL로 삭제하지 않음.

## 4. 백업과 복구

- official Ubuntu age 설치. 복구 secret key는 맥 private 폴더에만 지속 보관, 서버에는 public recipient.
- 전용 backup DB 역할·backup R2 S3 key만 사용.
- 매일 03:30/15:30 KST 암호화 dump·R2 업로드·실제 다운로드 SHA-256 검증. 최근 7일 보관.
- R2 실파일 다운로드 → age 복호화 → network none/tmpfs PostgreSQL 18 실제 복원 PASS.
- migration ledger checksum·정책 본문 해시·게시판/게시글 수 운영 DB 대조 PASS.
- 첫 검사 도구의 ledger 열 이름 오기와 초기화 임시 소켓 readiness 판정을 수정하고 재실행 PASS.
- 테스트 컨테이너·readback 파일 정리, 복구 identity 서버 파일 저장 없음.
- 원격 보관 경계·현재 백업·다른 prefix 보호 단위 검사 PASS. 최종 코드로 systemd backup 실행 PASS.
- 복구키: `/Users/zeaha/task_list/.blariyo-recovery/postgres-age-identity.txt`, 부모 700·파일 600·Git 제외. 비밀값 비출력.

## 5. 최종 검증

- 실제 일반 DNS·HTTPS `/meme`, `/terms`, `/privacy`, `/cookie-settings`, `/health/live` 200.
- 공개 정책 API 2종 v0.1·시행일·본문 표식 검사 PASS.
- 익명 및 위조 JWT header의 `/admin`, `/api/v1/admin/posts` 요청은 Access 로그인으로 302.
- `/internal/health/ready` 외부 404. HTTP→HTTPS, www 관리자 URL→apex 관리자 URL→Access 경계 PASS.
- Access 정책은 이메일 2개 포함 규칙 1개, Allow. Everyone/Bypass 아님. 앱 별도 운영자 매핑 활성 1명.
- Access MFA는 인증 앱·6시간, 앱/정책 세션 6시간. 실제 관리자 연결은 TOTP 입력 화면까지 확인.
- 마지막 서버 점검: 메모리 1906MiB 중 723MiB 사용·1182MiB available, swap 0/2047MiB. 디스크 6.5/58GB, 51GB 여유. 부하 용량 보장 아님.
- 부팅 service·로그 service·관련 timer enabled/active 확인. 실제 VM 재부팅 시험은 하지 않음.
- 정책 생성/파서 검사, 로그 TTL 검사, backup 보관 검사, Python 구문, 공개 smoke, `git diff --check` PASS.

## 6. 남은 운영 확인

- 사용자가 MFA를 직접 완료한 뒤 관리자 권한 매핑·게시물 생성/발행·이미지 업로드 전체 흐름 확인.
- 최초 공개 게시글은 아직 없어 공개 목록이 빈 상태다. 테스트용 공개 게시글을 임의로 발행하지 않음.
- 복구키 별도 안전한 사본은 사용자 보관 필요. R2 media 전체 별도 복제 백업은 미구성.
- timer 장기 관찰·7일 지난 실제 R2 object 삭제 관찰·월간 복원 시험·외부 가용성/실패 알림 자동화는 후속 운영 작업.
- AWS 화면은 Free plan으로 표시됨. 크레딧/무료 플랜 만료에 대한 계정 운영은 별도 확인 필요. 요금제·결제 변경 없음.
- Git commit·push 수행하지 않음. 기존 미커밋 변경 보존.

## 관련 구현

- [공개 smoke](../../../deploy/application/check-public.py)
- [정식 정책 발행](../../../deploy/application/publish-policies-from-mac.py)
- [운영 실행 안내](../../../deploy/operations/README.md)
- [백업·복구 안내](../../../deploy/backup/README.md)
- [현재 정책 정본](../../../docs/legal/m0-core/README.md)
