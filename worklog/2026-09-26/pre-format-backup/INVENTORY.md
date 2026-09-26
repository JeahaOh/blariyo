# 노트북 포맷 전 Blariyo 백업 목록과 누락 확인

## 1. 결론과 기록 범위

- 조사일: **2026-09-26**. Git 수치는 **12:19~12:20 KST** 확인 기준이다.
- 목적: 포맷 뒤 Blariyo 운영 접속과 개발 환경을 복구할 수 있도록 실제 보존 대상과 공백을 식별한다.
- 범위: Blariyo 운영·개발 자료, 관련 SSH 키, 주요 개발 도구 설정. 다른 프로젝트와 개인 자료의 전체 백업 목록은 아니다.
- **완료:** 파일 존재·권한·위치, 로컬 DB 목록, Docker 저장 위치, Git 작업·실시간 원격 참조, 오래된 파일 참조 조사.
- **미실행:** 암호화 백업 생성, 외부 사본 보관, 최신 DB 덤프 생성, 복호화·격리 복원 시험, 운영서버 접속.
- 사용자 확인: 별도 Time Machine 백업이나 암호화 백업 파일은 아직 없다. 암호화 금고·비밀번호 관리자는 사용하지 않으며, 암호화 백업 파일 방식으로 준비한다.
- **판정: 목록 작성과 누락 확인은 완료했으나, 포맷 준비는 미완료다.**

이 문서는 당시 읽기 전용 조사 결과를 보존한다. 문서 작성 시 전체 조사를 다시 실행한 것은 아니다.
다른 세션에서 작업이 진행 중이므로 실제 백업 직전에 Git·파일·DB의 기준 시점을 다시 확정한다.
파일 이동·삭제·키 교체·commit·push·운영 배포는 수행하지 않았다.

### 위치 표기

| 표기 | 조사 당시 실제 경로 |
| --- | --- |
| 홈 `~` | `/Users/zeaha` |
| 프로젝트 | `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` |
| Discord 워크트리 | `/Users/zeaha/workspace/.worktrees/blariyo-discord-setup` |

경로·파일명·권한·개수·시각만 기록한다. 비밀번호, 개인키 내용, 토큰, Discord ID 실값,
서버 접속 실값과 개인정보 원문은 기록하지 않는다. 원본 비밀 파일은 이 문서에 첨부하지 않는다.

## 2. 필수 설정·키 백업 목록

`존재 확인`은 외부 백업 또는 복구 성공을 의미하지 않는다. P0는 포맷 전에 보존·검증할 대상이다.

| 우선순위 | 실제 위치 | 확인 결과와 보존 범위 |
| --- | --- | --- |
| P0 | `~/.config/blariyo/` | 파일 26개. 당시 모든 일반 파일 권한 600. 설정과 배포 입력을 함께 보존 |
| P0 | `프로젝트/worklog/task-list/.blariyo-recovery/postgres-age-identity.txt` | 운영 DB 백업 복호화 키. 파일 600·부모 700, Git 제외·미추적. 실제 복호화는 미검증 |
| P0 | `~/Library/Mobile Documents/com~apple~CloudDocs/blariyo/LightsailDefaultKey-ap-northeast-2.pem` | 운영 SSH 개인키. 파일 400. 배포 도구의 대체 탐색 경로에 존재하며, 별도 백업이 필요 |
| P0 | `~/.ssh/` | `config`, `id_rsa`, `id_rsa.pub`, `known_hosts`, `known_hosts.old` 보존. agent 소켓과 `.DS_Store`는 재생성·제외 대상 |
| P0 | `~/workspace/_reference/.ssh/` | `id_rsa` 600·`id_rsa.pub` 644. 현재 `~/.ssh/config`가 이 개인키를 참조 |
| P0 | `Discord 워크트리/.env.discord.local` | 입력된 로컬 설정. 파일 600, Git 제외·미추적 |
| P0 | `Discord 워크트리/.env.discord.prod` | 입력된 운영 설정. 파일 600, Git 제외·미추적 |
| P0 | `프로젝트/.local-data/development/actor-secret` | 파일 600. 이전 관리자별 처리 이력과의 연결을 위해 기존 값을 유지 |
| P0 | `프로젝트/.local-data/development/batch-config.json` | 파일 600. 로컬 수집기 연결 설정 |

### `~/.config/blariyo/`의 26개 파일

| 위치 | 파일 | 개수 |
| --- | --- | ---: |
| 최상위 | `admin-operators.json`, `cloudflare-access.env`, `cloudflare-cache.env`, `internal-auth.env`, `public-contact.json`, `r2-credentials.env` | 6 |
| `db-secrets/` | `app-password`, `backup-password`, `migrator-password` | 3 |
| `application-config-W8Wwp5/` | `api.env`, `web.env`, `bundle.json`, `compose.yaml`, `secrets/admin-operators.json`, `secrets/app-password` | 6 |
| `application-config-ZzkcSI/` | 위와 같은 파일 구성 | 6 |
| `policy-review-bNeEfD/` | `cookies.html`, `index.html`, `privacy.html`, `rights.html`, `terms.html` | 5 |
| **합계** | 운영 설정·배포 입력 21개와 정책 검토 HTML 5개 | **26** |

두 배포 입력 묶음 중 현재 운영서버와 일치하는 묶음은 이번에 서버에 접속해 대조하지 않았다.
포맷 전에는 둘 다 보존한다. 이름이나 수정 시각만으로 하나를 현행 정본으로 선택하거나 삭제하지 않는다.
`policy-review-*`는 과거 검토 자료이며, 현재 공개 법무 정책을 대신하는 정본이 아니다.

### Discord 준비 상태

- `~/.config/blariyo/collector/secrets/local/`, `prod/`는 존재하고 각각 권한 700이다.
- 양쪽 디렉터리의 `discord-token`, `request-key`는 모두 없다.
- 기본 Keychain 검색 범위에서 `com.blariyo.collector`의 기존 운영 문서상 계정 10개도 발견되지 않았다.
  비밀번호 조회 옵션 없이 항목 존재 여부만 확인했다. 다른 키체인·다른 계정에 저장된 값까지 부재로 단정하지 않는다.
- 따라서 현재 판정은 **비밀 파일 준비 미완료**다. 발급되지 않았는지 다른 곳에 보관됐는지는 추가 확인 대상이며,
  기존 토큰·키를 분실한 것으로 판정하지 않는다.
- 값 없는 `.env.discord.example`도 존재하지만 아직 미추적 파일이므로 코드 백업에 포함한다.

## 3. DB·원문·미디어 백업 목록

| 대상 | 실제 확인 결과 | 포맷 전 조치 |
| --- | --- | --- |
| 로컬 PostgreSQL | 컨테이너 `blariyo-m0-core-local-postgresql-1` 실행 중. 볼륨 `blariyo-m0-core-local_pgdata` 사용 | 최신 논리 백업 생성·격리 복원 시험 |
| 개발 DB | `blariyo_local`, 조사 시 저장 크기 약 13.9MB | 역할·권한 재구성 자료와 함께 보존. 저장 크기는 덤프 파일 크기가 아님 |
| 추가 DB | 시험·미리보기 DB 9개와 관리용 `postgres` DB 존재 | 보존 필요 여부를 구분하며 임의 삭제하지 않음 |
| 수집 원문·첨부 | `프로젝트/.local-data/collector-objects/`, 972개 파일·360,596,118바이트 | DB와 같은 기준 시점으로 보존 |
| 서비스 미디어 | `프로젝트/.local-data/media/`, 946개 파일·554,716,990바이트 | DB 참조와 함께 보존 |
| **원문·미디어 합계** | **1,918개 파일·915,313,108바이트, 약 915MB** | 복사 후 파일 목록·크기·무결성 확인 |
| 정정·복구 자료 | `.local-data/repairs/`, `release-preparation/`, `hot-collection-20260925/` 등 존재 | 복구 근거와 원본을 확인해 함께 보존 |
| 기존 DB 덤프 | 프로젝트 안에서 `.dump`·`.age` 파일명으로 검색해 덤프 15개 확인 | 과거 사본으로 보존. 최신 백업으로 자동 승계하지 않음 |

### 기존 덤프와 최신성 공백

- `.local-data/backups/`의 14개 덤프는 모두 2026-09-23 자료다.
- 추가로 발견한 최신 후보는 `.local-data/hot-collection-20260925/before.dump`다.
  파일 크기 392,227바이트, 수정 시각은 **2026-09-25 00:13:45 KST**다.
- 수집 파일은 같은 날 00:38까지, 서비스 미디어는 10:14까지 수정된 파일이 있다.
  파일 수정 시각만으로 DB 내용의 일치를 증명할 수 없으므로, 기존 덤프를 현재 상태의 복구 사본으로 확정하지 않는다.
- 위 덤프의 내용 검사·복호화·실제 복원 시험은 이번 조사에서 수행하지 않았다.
- 운영 백업은 PostgreSQL 논리 백업 범위다. **R2 미디어 전체의 별도 복제 백업은 포함하지 않는다.**
  실제 운영 R2 사본과 최신 운영 DB 백업은 별도 확인 대상이다.

Docker의 실행 중인 DB 파일이나 `Docker.raw`를 그대로 복사한 것만으로 일관된 DB 백업을 보장하지 않는다.
포맷 전에는 보존 대상 DB의 논리 백업과 대응하는 원문·미디어 사본을 준비한다.
중지된 시험 컨테이너와 추가 Docker 볼륨도 존재하므로, 현재 개발 DB를 보존했다는 이유로 일괄 삭제하지 않는다.

## 4. 코드·Git 작업 보존 목록

### 원격과 로컬 이력

- 2026-09-26 12:19 KST에 실제 `origin` 참조를 조회했다. 원격 브랜치 15개, 태그 0개였다.
- 해당 원격 참조에서 도달할 수 없는 로컬 브랜치·태그의 **고유 커밋 17개**를 확인했다.
  브랜치별 개수는 이력이 겹치므로 합산하지 않는다.
- **stash 1개**를 확인했다.
- 이 숫자는 당시 원격 조회 결과다. 이후 다른 세션의 commit·push에 따라 달라질 수 있다.

### 작업 디렉터리 상태

2026-09-26 **12:20:38 KST** 확인 기준으로 워크트리 8개 중 6개에 미커밋 작업이 있었다.

| 워크트리 | 추적 파일 변경 | 미추적 파일 |
| --- | ---: | ---: |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` | 0 | 57 |
| `/private/tmp/blariyo-nightly-deploy-20260926` | 0 | 22 |
| `/Users/zeaha/workspace/.worktrees/blariyo-discord-setup` | 1 | 1 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery` | 3 | 0 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-m0-core` | 20 | 68 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-stash-recovery` | 8 | 2 |
| **합계** | **32** | **150** |

- Git 제외 설정·비밀 파일·DB/object는 위 수에 포함되지 않는다.
- 공통 Git 저장소의 로컬 이력·브랜치·stash와 각 워크트리의 미커밋·미추적 파일을 함께 보존한다.
- 연결된 워크트리의 `.git` 파일만 복사하면 실제 Git 이력을 보존할 수 없다.
- `/private/tmp`의 작업과 홈 디렉터리의 Discord 설정을 빠뜨리지 않는다.
- `/Volumes/MicroVault`에 원본이 있다는 사실만으로 별도 백업이 있다고 판단하지 않는다.
  외장 원본과 독립 백업 사본을 구분한다.

## 5. 발견된 누락·복구 방해 요소

| 우선순위·상태 | 발견 사항 | 영향과 조치 |
| --- | --- | --- |
| P0·미준비 | 별도 암호화 백업이 없음 | 사용자 확인. 노트북 외부 사본을 생성하고 실제로 열어 복원해야 함 |
| P0·미검증 | 최신 로컬 DB·미디어의 일관된 사본 미확인 | 과거 덤프를 현재 상태로 간주하지 않고 새 기준 시점으로 백업 |
| P0·미검증 | 운영 DB 복구키로 실제 복원하지 않음 | 파일 존재와 복구 성공을 구분. 암호화 백업 복호화·격리 복원 필요 |
| P0·미검증 | 주요 계정의 포맷 후 로그인·다중 인증 | AWS·Cloudflare·GitHub 등에서 다른 기기를 통한 인증·계정 복구 가능 여부 확인 |
| P1·경로 불일치 | 백업 설치 코드가 `~/task_list/.blariyo-recovery/`를 사용 | 기존 키는 `프로젝트/worklog/task-list/.blariyo-recovery/`에 있음. 재설치 전 기존 키의 경로를 맞춰야 함 |
| P1·경로 불일치 | 백업 설치 코드가 `~/task_list/check-blariyo-r2.cjs`를 참조 | 실제 파일은 `프로젝트/worklog/task-list/check-blariyo-r2.cjs`. 참조 경로 보완 필요 |
| P1·경로 불일치 | 배포 기본 이미지 디렉터리가 옛 `~/task_list/` 경로 | 실제 자료는 `프로젝트/worklog/task-list/` 아래에 존재. 새 배포 후보를 명시하고 기본 경로를 정비해야 함 |
| 준비 미완료 | Discord token·request-key 파일 없음 | 발급·저장 여부 확인 후 준비. 기존 자료 분실로 단정하지 않음 |
| 미검증 | 두 배포 설정 묶음과 운영서버의 일치 여부 | 서버 설정 식별자를 읽기 전용으로 대조하기 전까지 두 묶음 모두 보존 |

### 경로 불일치의 근거

- [백업 설치 코드](../../../deploy/backup/install-from-mac.py) 7행은 옛 복구키 디렉터리를 사용한다.
  11~15행은 해당 위치에 키가 없으면 새 키를 만드는 흐름이므로, 기존 키를 찾아 연결하기 전에 재실행하지 않는다.
- 같은 파일 18행은 옛 R2 도우미 경로를 참조한다. 옛 위치는 없고 이동된 실제 파일은 존재한다.
- [배포 stage 코드](../../../deploy/application/stage-from-mac.py) 20행의 기본 이미지 경로는 없다.
  `worklog/task-list/blariyo-app-images-20260920T005324Z-rhn14v8g/`에는 당시 자료 232개가 존재한다.
  이 자료를 현재 배포 후보로 승인한 것은 아니다.
- [백업 문서](../../../deploy/backup/README.md)의 복구키 경로도 당시 실제 위치와 다르다.

자료가 발견됐으므로 **파일 분실과 오래된 경로 참조를 구분**한다. 이번 문서화에서는 실행 코드와 과거 문서를 수정하지 않았다.

### 백업 존재 여부 확인의 한계

- Time Machine 대상 설정은 있었지만 `latestbackup` 조회에서 최신 백업 경로를 확인하지 못했다.
  사용자도 별도 백업이 없다고 확인했다. 대상 설정만으로 백업 완료를 주장하지 않는다.
- `.aws`, `.cloudflared`, GitHub CLI 인증 설정 파일이 로컬에 없다는 사실만으로 계정 접근 수단 분실을 단정하지 않는다.
  브라우저·운영서버·다른 인증 저장소 사용 여부는 별도 확인 대상이다.
- 운영서버의 현재 DB·R2·토큰과 계정 복구 수단은 이번 파일 조사에서 직접 검증하지 않았다.

## 6. 개발 환경 복구용 추가 목록

| 분류 | 존재를 확인한 경로 | 처리 |
| --- | --- | --- |
| 셸·Git | `~/.zshrc`, `~/.zprofile`, `~/.gitconfig` | 설정 보존. 내부에 비밀값이 있는지 확인하기 전까지 암호화 대상에 포함 |
| Codex | `~/.codex/config.toml`, `~/.codex/AGENTS.md`, `~/.codex/skills/`, `~/.codex/rules/`, `~/.agents/skills/` | 사용자 설정·사용자 정의 스킬·규칙 보존 |
| Claude | `~/.claude/settings.json`, `~/.claude/skills/` | 설정·스킬 보존 |
| Gemini | `~/.gemini/settings.json` | 설정 보존 |
| VS Code | `~/Library/Application Support/Code/User/settings.json`, `keybindings.json` | 편집기 설정 보존. snippets 디렉터리는 당시 비어 있었음 |
| Docker | `~/.docker/config.json` | 설정 보존. 인증 저장소와 DB 볼륨을 이 파일로 복구할 수 있다고 간주하지 않음 |
| 인증 상태 | `~/.codex/auth.json`, `~/Library/Keychains/login.keychain-db` | 존재 확인. 파일 복사만으로 인증이 복구된다고 보장하지 않고 재로그인·복구 수단을 별도 확보 |

`session.json` 같은 단기 인증 상태, agent 소켓, 의존성·빌드 캐시는 재생성 대상으로 구분한다.
단, 장기 보존용 `actor-secret`과 실제 사용 중인 암호화·서명 키는 임의로 재생성하지 않는다.

## 7. 포맷 전 실행 순서와 완료 조건

다음은 **후속 계획**이며, 이번 조사에서 수행한 작업이 아니다.

1. 진행 중인 세션과 백업 기준 시점을 맞추고 Git·파일 목록을 다시 확인한다.
2. 설정·키·SSH 자료·로컬 Git 이력·stash·미커밋·미추적 작업을 먼저 보존한다.
3. 필요한 쓰기 작업을 조율한 뒤 최신 로컬 DB와 대응하는 원문·미디어를 백업한다.
4. 설정·키 복구 파일과 데이터 백업을 암호화하고, 노트북 밖의 독립된 두 위치에 보관한다.
5. 백업 암호는 노트북이나 암호화 파일 안에만 두지 않고 별도 오프라인 복구 수단을 확보한다.
6. 다른 기기 또는 별도 테스트 계정에서 기존 Keychain에 의존하지 않고 암호화 파일을 연다.
7. 복원한 키로 서버 신원을 확인하며 읽기 전용 SSH 접속을 확인한다.
8. DB 백업을 격리 환경에 복원하고 원문·미디어 참조와 파일 무결성을 대조한다.
9. 주요 계정의 로그인·다중 인증과 코드·설정 복구를 확인한 뒤 포맷 여부를 결정한다.

완료 조건은 백업 파일 생성이 아니라 **외부 사본에서의 실제 복원 확인**이다.
정리·이동·중복 삭제는 검증된 사본을 확보한 후 별도 범위로 진행한다.
복원 후 예약 작업·수집 자동 실행은 연결 대상을 확인한 뒤 재개한다.

## 8. 조사 방법과 검증 범위

- 로컬 파일: 이름·존재·크기·권한·수정 시각 조사. 실제 비밀값은 출력하지 않음.
- Git: worktree·status·브랜치·stash 조회와 실시간 원격 참조 비교. fetch·commit·push는 하지 않음.
- Docker: 로컬 Unix 소켓 대상 확인 후 컨테이너·mount·볼륨 메타데이터만 조회.
  전체 환경변수나 전체 container inspect를 출력하지 않음.
- DB: 로컬 컨테이너 안에서 DB명·크기를 읽기 전용 SELECT로 확인. 사용자 데이터 본문은 조회하지 않음.
- Keychain: 지정 서비스·계정의 존재 여부만 확인. 비밀번호 출력 옵션을 사용하지 않음.
- 복원: 이번에는 실행하지 않음. 기존 성공 기록을 현재 백업의 검증으로 승계하지 않음.

관련 정본·실행 안내:

- [환경 설정 계약](../../../docs/operations/environment-configuration.md)
- [보안·운영의 secret 관리](../../../docs/system-design/05-security-operations.md#5-secret-관리)
- [운영 백업·복원](../../../deploy/backup/README.md)
- [로컬 실행·장기 보존 키](../../../scripts/local/README.md)
- [Collector 비밀 파일·Discord 준비](../../../apps/collector/ops/README.md)

[2026-09-26 색인](../README.md) · [전체 작업 기록](../../README.md)
