# 비공개 파일 보관 위치와 포맷 전 복구 준비

**비공개 파일은 Git에 넣지 않는다. 이 문서는 위치와 복구 순서만 관리한다.**
Git clone, iCloud 경로의 존재, 이 목록 작성은 백업·복원 성공의 증거가 아니다.

## 관리 기준

- 새 로컬 credential은 `~/.config/blariyo/<기능>/<환경>/` 아래 보관한다. 폴더는0700, 파일은0600을 기본으로 한다. 기존 SSH 키의0400은 유지한다.
- Discord 로컬 토큰은 `~/.config/blariyo/discord/local/discord-token`을 사용한다. 운영 token은 운영 전용 경로·주입 구성을 확인한 뒤 별도 보관한다. 로컬 파일을 운영 보관 완료로 간주하지 않는다.
- 기존 파일은 참조 경로가 연결돼 있으므로 일괄 이동하지 않는다. 아래 목록이 분산된 기존 위치의 공통 진입점이다. 위치 변경 시 실행 설정·문서·복구 목록을 함께 갱신한다.
- 토큰·비밀번호·개인키·복구 코드 원문은 이 문서, worklog, 입력 JSON, 명령행 인자와 Git에 남기지 않는다.
- 실제 백업은 포맷 대상과 다른 장치 또는 별도 계정의 암호화 보관소에 둔다. 백업 잠금 해제 정보도 이 컴퓨터에만 두지 않는다. 외부 저장 대상은 아직 미정이며 자동 업로드는 설정하지 않았다.

## 현재 위치 목록

2026-10-07 로컬 파일명·존재·권한과 관련 실행 소스를 확인했다. 비밀값 본문은 목록에 복제하지 않았다.
`<repo>`는 현재 `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`다.

| 우선순위 | 위치 | 포함 항목·용도 | 확인 상태·복구 시 주의 |
| --- | --- | --- | --- |
| P0 | `~/.config/blariyo/` 전체 | Cloudflare Access/cache, R2 credential, 내부 인증, 관리자 준비본, DB 암호, 배포 설정 묶음 | 기존 일반 파일26개 확인. 배포 묶음2개는 과거 후보이며 최신 운영 설정이라고 단정하지 않음 |
| P0 | `<repo>/worklog/task-list/.blariyo-recovery/postgres-age-identity.txt` | 암호화 DB 백업을 복호화하는 age 개인키 | 존재·0600·Git 제외 확인. 폴더0700. **새 clone에 포함되지 않으며 분실하면 해당 백업 복호화 불가** |
| P0 | `~/Library/Mobile Documents/com~apple~CloudDocs/blariyo/LightsailDefaultKey-ap-northeast-2.pem` | Lightsail SSH 접속 개인키 | 존재·0400 확인. iCloud 동기화·다른 장치에서 읽기·실제 접속은 별도 확인 |
| P0 | 같은 iCloud `blariyo/` 폴더의 `squarespace_backup_codes_*.txt` | 도메인 관리 계정 복구 코드 후보 | 파일 존재만 확인. 현재 계정과의 대응·사용 가능 여부는 미검증. 파일명에 포함된 계정 정보도 공개하지 않음 |
| P0 | `~/.config/blariyo/discord/local/discord-token` | Discord 검수 봇 token | 파일0600·폴더0700, 2026-10-07 실제 봇 인증·두 채널 조회 확인. 운영 서버 배치·별도 백업은 미확인 |
| P1 | `<repo>/worklog/2026-10-07/discord-review-plan/discord-server.production.json`, `discord-server.local.json` | 실제 서버·채널·봇·검수자 ID 입력 | Git 제외. 현재 같은 봇·다른 채널 구성. template와 안내는 Git 관리 후보로 유지 |
| P1 | `<repo>/.local-data/development/` | 로컬 API/Web/batch 설정·credential·세션 관련 파일 | 폴더 존재·0700 확인. 세션은 복구 후 재발급할 수 있으며 운영 인증에 재사용하지 않음 |
| P1 | `<repo>/.local-data/production-collection-20261004/`, `production-collector-schedule/`, `production-collector-trial-20261007/` | 운영 수집 준비·관찰 산출물, 비공개 설정 포함 가능 | 폴더 존재·0700 확인. 각 파일의 현재 운영 참조 여부는 미검증 |
| P1 | `<repo>/.local-data/backups/`, `.local-data/collector-objects/`, `.local-data/media/` | 로컬 백업·수집 원본 이미지·서비스 미디어 | 폴더 존재 확인. credential 백업과 별도로 데이터 보존 범위·보존기한을 적용 |
| P1 · 별도 확인 | 로컬 PostgreSQL/Docker volume | 로컬 DB·검수 상태 | 이번에는 DB/volume 백업 미실행. 실행 중 데이터 디렉터리 복사만으로 복원 가능하다고 판단하지 않음 |
| P1 · 별도 확인 | macOS Keychain 서비스 `com.blariyo.collector` | 기존 수집기가 지원하는 `discord-token`, `request-key`, `spool-key` 등 | 소스상 지원 위치. 실제 항목 존재·동기화·내보내기는 확인하지 않음. 일반 폴더 백업으로 대체 불가 |
| P1 · 공용 확인 | `~/.ssh/` | Git·서버 SSH 설정, 개인키·공개키·known_hosts | config/id_rsa/id_rsa.pub 존재 확인. 다른 프로젝트와 공유할 수 있어 이동·삭제하지 않음 |
| P2 | `~/Library/LaunchAgents/com.blariyo.local-collection.plist` | 로컬 정기 수집 실행 등록 | 존재·0600 확인. 저장소·Node·JDK의 절대경로가 있어 새 컴퓨터에서 그대로 실행하지 말고 경로 확인 후 재등록 |

`~/.config/blariyo/`에서 확인한 기존 구성:

```text
admin-operators.json
cloudflare-access.env
cloudflare-cache.env
internal-auth.env
public-contact.json
r2-credentials.env
db-secrets/{app-password,backup-password,migrator-password}
application-config-W8Wwp5/{api.env,web.env,bundle.json,compose.yaml,secrets/}
application-config-ZzkcSI/{api.env,web.env,bundle.json,compose.yaml,secrets/}
policy-review-bNeEfD/                 # 정책 화면 산출물, credential 자체는 아님
discord/local/discord-token          # 로컬 저장·읽기 전용 인증 확인, 별도 백업 필요
```

직전에 준비했던 `~/task_list/blariyo-discord-secrets/`는 빈 폴더이며 사용하지 않는다.
비밀값을 옮긴 것은 없고 빈 폴더도 삭제하지 않았다. 토큰 저장 도구와 로컬 입력 양식은 새 경로로 맞췄다.

## 포맷 전 절차

1. **준비물:** 위 P0/P1 항목, 별도 장치·계정의 암호화 보관소, 그 보관소의 독립적인 복구 수단을 준비한다. 실제 백업 목적지는 현재 `(미정)`이다.
2. **실행:** 폴더 백업에는 숨김·Git 제외 파일을 포함한다. iCloud 파일은 로컬 다운로드를 완료한 뒤 백업 사본에서 열리는지 확인한다. SSH·age 개인키는 원문을 로그에 출력하지 않는다. Keychain·계정 MFA/복구 코드는 별도 복구 절차를 따른다.
3. **데이터:** 로컬 DB는 지원되는 dump/복원 절차를 사용한다. 수집 원본·백업을 무기한 복제하지 않도록 기존 보존 정책을 적용한다. 운영 서버 DB/R2 백업은 맥 credential 백업과 별개다.
4. **통과 기준:** 다른 장치 또는 격리된 복원 위치에서 복사본의 파일 수·크기·해시를 확인하고, SSH 접근·비공개 설정 로드·age 암호화 백업의 격리 복원을 확인한다. 단순 파일 존재로 통과시키지 않는다.
5. **기록:** 수행일, 백업 위치의 별칭, 검증한 항목, 실패·미확인 항목을 날짜별 worklog에 남긴다. credential 원문은 기록하지 않는다.
6. **중단 기준:** P0 사본이나 잠금 해제 수단이 없거나 복원 실패 시 포맷을 진행하지 않는다. iCloud·Git·이 컴퓨터의 단일 사본만으로 보존 완료라 하지 않는다.

## 복구 순서

1. 저장소를 복원하고, Git 제외된 실제 입력 파일은 비공개 백업에서 별도로 복구한다.
2. `~/.config/blariyo`와 복구키·SSH 키를 원래 경로에 복구하고 소유자·권한을 재확인한다. 사용자명·repo 경로가 바뀌면 명시적으로 참조를 갱신한다.
3. 현재 운영 설정과 과거 배포 후보를 대조한다. 특히 로컬 `admin-operators.json` 준비본을 운영 계정 정본으로 덮어쓰지 않는다.
4. 토큰과 관리자 매핑을 검증하고 DB/object 사본을 격리 환경에서 복원한다.
5. 마지막으로 수집 스케줄을 재등록한다. 복구 도중 자동 수집·승인·발행을 켜지 않는다.

## Git 제외 확인

- `.env*`, `.local-data/`, `.collector-data/`는 기존 제외 규칙을 유지한다.
- 실제 Discord 운영·로컬 JSON, `discord-token`, `postgres-age-identity.txt`, `.blariyo-recovery/`, Lightsail 개인키는 추가 제외한다.
- 저장소 밖의 `~/.config/blariyo`, iCloud, `~/.ssh`는 이 저장소의 Git 추적 범위가 아니다. 복사본이 실수로 들어오는 경우에 대비해 알려진 이름도 제외한다.
- `.gitignore`는 암호화·백업·접근 통제가 아니며, `git add -f` 또는 이미 추적 중인 파일을 보호하지 못한다.
- 실제 입력 파일은 제외하지만 `discord-server.template.json`, 입력 안내와 이 복구 문서는 제외하지 않는다.

관련 정본: [환경 설정](environment-configuration.md), [기존 DB 백업과 age 복구키](../../deploy/backup/README.md), [Collector 비공개 설정](../../apps/collector/ops/README.md).

## Discord 검수 런타임 추가 — 2026-10-07

- 로컬 통일 위치: `~/.config/blariyo/discord/local/{api.json,worker.json,worker-token,reviewers.json,admin-operators.json,discord-token}`. 기존 Web actor secret은 `<repo>/.local-data/development/actor-secret`을 참조하므로 함께 보존한다.
- 운영 설치 위치: `/opt/blariyo/discord-review/secrets/`의 API/worker 설정, 두 token, 검수자/운영자 registry, actor-secret. 실제 운영 설치·검증 결과는 [구현 기록](../../worklog/2026-10-07/discord-review-implementation/README.md)을 따른다.
- 로컬 예약: `~/Library/LaunchAgents/com.blariyo.discord-review.{development,maintenance,scan}.plist`. 재설치 시 경로를 재생성하고 DB·비공개 설정·봇 권한 확인 후 등록한다.
- 운영 예약: `blariyo-discord-review.timer`, `blariyo-discord-review-scan.timer`. jar/manifest/service는 Git·빌드로 복원할 수 있지만 secrets는 Git에 없다. API release의 flags와 read-only mount도 복원한다.
- 별도 암호화 백업 저장소·포맷 후 복원 시험은 아직 미완료다. 위치 목록과 Git 제외를 백업 완료로 해석하지 않는다.
