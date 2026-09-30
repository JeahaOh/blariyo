# 선택 백업·독립 복원·전환 인계

- 담당: 사용자 OWNER. 구현·합성 검증 담당: Codex, 2026-09-27.
- 현재: 로컬 코드와 합성 시험. 서버 설치·실제 R2/Drive/Discord·운영 전환은 미실행이다.
- 정본: [D03](../../docs/system-design/05-security-operations.md#m0-d03-drive), [D01 회수 인계](../operations/collect-retention.md).
- 기존 정상 R2 경로는 이 저장소의 파일 변경만으로 바뀌지 않는다. 아래 수용 절차 후 새 runner를 설치한다.

## 코드와 검사

| 코드 | 역할·증거 |
| --- | --- |
| `selective-profile.mjs`, `backup-dump.mjs` | collect table 분류를 모르면 dump 전 실패. 같은 PG snapshot에서 schema ledger·보존 table count/hash를 얻고 pg_dump→age를 스트리밍한다. 평문 dump 파일 없음 |
| `drive-auth.mjs`, `drive-store.mjs` | OAuth offline 또는 전용 Shared Drive 서비스 계정. 고정 folder/drive/identity·예약 file ID·8MiB chunk·0600 journal·offset 재조회·실다운로드 hash·manifest 마지막 업로드 |
| `r2-store.mjs`, `backup-jobs.mjs` | 선택 backup의 R2 우선/병행/Drive 주 경로와 같은 암호문으로 R2 복귀. 독립 만료·catalog·24시간 업로드 재시도·18시간 RPO 경보 |
| `incidents.mjs` | 최초/6시간 지속/회복 알림과1/5/30분 재시도. backup receipt와 알림 실패 분리. webhook/token/session/본문/계정/파일 링크 비출력 |
| `restore-snapshot.mjs`, `offline-recovery.mjs` | 별도 다운로드·hash·빈 격리PG18 복원·snapshot fingerprint 대조·원문0 확인. 복원 후 retention gate 닫힘·자동 수집 재개 없음 |
| `legacy-replacement.mjs`, `replace-full.mjs` | 기존 full snapshot 독립 복원→격리 DB migration→선택 재dump/age→R2 실다운로드→두 번째 격리 복원. 원래 snapshot/expiry 유지 후 원본 제거 |
| `run-backup.py`, `Dockerfile`, service/timer | 수동·예약·만료·알림 공통 OS lock. 전용 비root container, Node24.18.0/PG18/age1.3.2, secret 개별 mount, 임시 container만 정리 |

```sh
npm run test:backup
# 실제 age/PG 검사는 작업 소유 컨테이너·loopback55449·Java25·age 경로를 명시해야 한다.
node deploy/backup/test-selective-backup.mjs
docker build -f deploy/backup/Dockerfile -t blariyo-backup-review .
docker run --rm --network none --read-only --cap-drop ALL blariyo-backup-review check
```

실제 DB 시험의 환경 변수는 `TEST_DATABASE_ADMIN_URL`, `TEST_BACKUP_POSTGRES_CONTAINER`, `JAVA_HOME`,
`TEST_AGE_BIN`, `TEST_AGE_KEYGEN_BIN`이다. 시험 스크립트는 작업 컨테이너 이름·소유 label·포트를
검사한다. 이 값들을 운영 DB로 바꿔 실행하지 않는다. 테스트 성공을 외부 서비스 인수로 계산하지 않는다.

## 설치 전 입력과 순서

1. 전용 backup OS 계정(uid/gid≥1000, shell nologin)과 DB `blariyo_backup`, backup 전용 R2 credential을 준비한다.
   API/batch/retention 자격증명을 재사용하지 않는다. Docker socket을 container에 mount하지 않는다.
2. 현재 선택 dump를 비운영 R2에 올리고 별도 사용자 환경에서 `offline-recovery.mjs`로 복원한다.
   `OPS03_SELECTIVE_RESTORE`, provider=r2, 원문0·fingerprint 일치, 최근18시간 receipt를 확보한다.
3. 서버 `/opt/blariyo/backup`에 아래 입력을 준비한다. 각 secret 파일은0600·backup uid 소유, state는0700·같은 uid 소유다.
   root runner와 runtime.json은 root 전용으로 관리한다. 기존 파일을 자동 덮어쓰지 않는다.
4. `runtime.json.image`에는 검증한 **로컬 image config SHA-256**을 고정한다. 해당 이미지를 서버에 준비하는 행위는 별도 배포 권한이 필요하다.
   `networks`는 기존 DB 사설망과 외부 전송망이다. 기존 이름을 직접 확인한다. host network·특권 모드는 사용하지 않는다.
5. 설치 대상7개 파일의 현행 SHA-256(새 파일은 null) 목록과 R2 복원 receipt로 bundle을 만든다.
   검토 후 서버에서 installer를 `--activate`로 실행한다. installer는 원래 hash·입력 권한·image runtime을 확인하고 공통 lock 안에서만 교체한다.
6. 예약03:30/15:30 KST, 매시간 만료, 매분 알림 timer를 확인한다. 원격 실행·재부팅 결과를 별도 기록한다.
   설치 실패를 full-dump 자동 복귀로 해결하지 않는다. 기존 운영 경로는 교체 전 사전 검증으로 보호한다.

| 파일 | 필수 키·용도 |
| --- | --- |
| `runtime.json` | `image`=`sha256:…`, `uid`, `gid`, `networks` 배열. 경로/계정은 실제 입력 |
| `config.json` | `mode`=`r2`/`dual`/`drive`, `database`={host,port,database,user:`blariyo_backup`} |
| `db-password` | 기존 backup DB password의 전용 copy. 다른 역할 비밀번호 금지 |
| `recipient.txt` | age 공개 recipient만. private identity는 서버에 두지 않음 |
| `r2.json` | `endpoint`,`bucket`=`blariyo-backup`,`accessKeyId`,`secretAccessKey` |
| `drive.json` | 기본 `mode`=`oauth`,`clientId`,`clientSecret`,`refreshToken`,`folderId`. Shared Drive는 `mode`=`shared-service-account`,`clientEmail`,`privateKey`,`driveId`,`folderId`; subject 위임 금지 |
| `discord-webhook` | 사용자 전용 webhook. 실제 수신 시험 필요 |
| `transition.json` | Drive 주 경로 전환 인수 receipt. 아래 전환 조건 필요 |

```sh
python3 deploy/backup/install-from-mac.py \
  --restore-receipt /사용자전용/restore-receipt.json \
  --expected-hashes /사용자전용/installed-file-hashes.json \
  --output /사용자전용/reviewed-backup-bundle.json
# 다음 명령은 사용자 승인 후 대상 서버에서 실행한다. 위 bundle 생성은 전송하지 않는다.
sudo python3 /검토된경로/install-server.py --activate < /검토된경로/reviewed-backup-bundle.json
sudo python3 /opt/blariyo/backup/run-backup.py backup
sudo python3 /opt/blariyo/backup/run-backup.py maintain
```

기존 `r2-transfer.cjs`와 `verify-restore-server.py`는 과거 format1/R2 경로의 참고 도구다.
새 runner는 호출하지 않는다. 새 backup 복원은 아래 도구를 사용하며 현재 DB와 수량을 비교하지 않고
**backup snapshot의 count/hash**와 비교한다.

## 독립 복구 입력

`node deploy/backup/offline-recovery.mjs /사용자전용/recovery.json`

- config0600: `isolated:true`, `provider`=`r2` 또는 `drive`, `providerConfigPath`, `isolatedDatabaseUrl`,
  `identityPath`, `receiptPath`, 선택 `ageExecutable`/`pgRestoreExecutable`.
- R2 선택: `backupId`. Drive 선택: `manifestFileId`. 파일명 검색으로 대체하지 않는다.
- 대상은 loopback의 `restore_*` 이름을 가진 **빈 PostgreSQL18 DB**다. 격리 container/DB 소유권과 외부 수집·cron 비활성을 사용자가 먼저 확인한다.
- 복원은 single transaction이다. 비어 있지 않은 DB·7일 만료 backup·변조 hash·ledger/fingerprint 불일치를 거부한다.
- 시험 뒤 복구 DB/volume은 원문 잔존 inventory에 포함한다. 임의 기존 DB를 삭제하지 않으며 소유권을 확인한 시험 DB만 정리한다.
- 복원 성공 직후 retention gate와 collector restore gate는 닫힌다. Collector V010의 direct permit은 복원 다음 KST 날짜 시작 전까지 추가 차단된다. snapshot 이후 당일 요청 수가 유실될 수 있으므로 이를 앞당기거나 counter를0으로 바꾸지 않는다. D01 quiesced object inventory·늦은 객체 회수·dedup/게시글 사본 확인 후 운영자가 gate를 재개하며, 다음 날이 되었다는 이유로 자동 해제하지 않는다.

## 기존 full 사본 교체와 Drive 전환

`node deploy/backup/replace-full.mjs /사용자전용/replacement.json`

- config0600: `isolated:true`, `authorizeOriginalRemoval:true`, `sourceDatabaseUrl`, `verificationDatabaseUrl`,
  `r2ConfigPath`, `originalKey`, `identityPath`, `recipient`, `receiptPath`, `collectorClasspathFile`, `javaExecutable`.
  선택 `pgDumpExecutable`/`pgRestoreExecutable`/`ageExecutable`, 로컬 원본이 같은 장비에 있을 때 `originalLocalSpool`.
- 서로 다른 빈 loopback `restore_*` DB 두 개를 준비한다. 현재 API build와 Collector fixtureClasspath를 준비한다.
  migration은 복원한 첫 격리 DB에만 적용하며 원본 운영 DB에 접속하지 않는다.
- 보유 중인 snapshot마다 실행한다. 대체본 실다운로드·두 번째 복원이 실패하면 원본 제거 단계로 가지 않는다.
  원래 snapshotAt+7일을 유지하며 만료 시각이 업로드 시각으로 늘어나지 않는다.
- 이미 만료된 format1 원격 사본은 매시간 만료 경로에서 회수한다. 서버 기존 `spool/`, 수동 dump,
  분리 volume·외부 복구 장비의 로컬 사본은 별도 목록으로 정확한 위치·hash·기한·제거 readback을 인수한다.
  `removeLegacySpool`은 일치하는 local manifest/hash와 교체 receipt 또는 기한 도달이 있을 때만 제거한다.
- 기존 full 사본의 원격/로컬 inventory가 남아 있으면 D01 운영 삭제 gate를 열지 않는다.
- Drive는 `dual`로 병행 검증한다. `drive`로 바꾸기 전 `OPS03_DRIVE_ACCEPTANCE` receipt에
  `environment:production`, `ownerAccepted:true`, `acceptedAt`, `fullSnapshotsReplaced:true`,
  `fullReplacementReceiptSha256`, `restoreReceiptSha256`, `restoredAt`과 서로 다른2회
  `scheduledDriveSuccesses`를 기록한다. 각 성공은 provider/scheduled/backupId/snapshotAt/expiresAt/receiptSha256을 가진다.
  인수 시 최근18시간 복원과 연속 정기2회 성공, 실제 token 회수·용량·Discord 수신·7일 만료를 확인한다.
- Drive 장애 시 동일한 선택 암호문으로 R2에 전송한다. Drive→R2 전환 후에도 Drive credential을 보존해
  기존 Drive 파일을 원래 기한에 회수한다. credential 회수로 삭제가 막히면 지연 장애를 기록하고 사용자 재인증을 요청한다.

실값·private key·token·session URI·원문은 Git/일반 로그/알림에 넣지 않는다. 외부 서비스의 HTTP receipt는
실제 사용자 수신·운영 인수·7일 관찰 완료를 대신하지 않는다.
