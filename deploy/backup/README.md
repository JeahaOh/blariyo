# 암호화 PostgreSQL 원격 백업

- DB: `blariyo_backup` 읽기 전용 역할. 앱·migrator 비밀번호를 사용하지 않는다.
- R2: `blariyo-backup` 버킷 전용 S3 키만 주입. media 키·관리 API token 제외.
- 암호화: `pg_dump -Fc --no-owner --no-acl` → age. 평문 dump는 pipe 안에서만 처리.
- 서버에는 암호화 수신용 public key만 지속 보관. 복구용 secret identity는 맥에 별도 보관.
- 주기: 03:30·15:30 KST. 정상 주기의 목표 데이터 손실 범위는 최대 약 12시간이다.
- 보관: `db/daily/` 최근 7일. 새 업로드·실제 다운로드 SHA-256 확인 후에만 정확한 파일명 규칙에 맞는 오래된 archive/manifest를 정리한다. 자동 작업 실패가 계속되면 보관 상한을 넘길 수 있다.
- 로컬: 최근 검증된 암호화 사본 1개. 실패 암호화 사본은 다음 성공까지 보존.
- 범위: PostgreSQL 논리 백업. R2 media 전체의 별도 복제 백업은 포함하지 않는다.

## 파일

맥 복구키(내용을 출력하지 않는다):
`/Users/zeaha/task_list/.blariyo-recovery/postgres-age-identity.txt`

부모 폴더 700·파일 600, Git 제외 파일을 함께 둔다. **이 키를 잃으면 R2 암호화 백업을 복호화할 수 없다.**
사용자가 별도 암호 관리자나 안전한 오프라인 저장소에도 보관해야 한다. 채팅·Git에 붙여 넣지 않는다.

서버는 `/opt/blariyo/backup`(700)에 설정·스크립트·암호화 spool을 보관한다.
`r2.json`과 `recipient.txt` 등은 root 600이며 앱 컨테이너에 mount하지 않는다.

## 설치·수동 실행·복원 시험

현재 검증된 서버에 이미 설치했다. 설치 도구는 기존 키를 유지하고 다른 기존 설정은 거부한다.

```sh
python3 deploy/backup/install-from-mac.py
```

서버에서 한 번 더 백업하려면:

```sh
sudo systemctl start blariyo-backup.service
sudo journalctl -u blariyo-backup.service -n 10 --no-pager
```

`verify-restore-server.py`는 SSH 표준입력으로 받은 복구키를 **프로세스 메모리에서만** 사용한다.
age identity를 stdin으로 공급하고 평문은 `pg_restore` stdin으로 전달한다.
R2 실제 파일을 내려받아 해시를 비교한 뒤, network none·host port 없음·tmpfs인 일회성 PostgreSQL 18에
single-transaction으로 복원한다. migration checksum·정책 본문 해시·게시판/글 수를 운영 DB와
비교하고 테스트 컨테이너와 암호화 readback 사본을 정리한다. 게시글이 동시에 바뀌면 수량 대조는
불일치할 수 있으므로 운영 쓰기가 없는 시점이나 사전에 저장한 snapshot 기준으로 시험한다.
현재 도구는 소규모 초기 DB 시험용이며 대형 dump는 메모리 스트리밍 복원으로 보완해야 한다.

2026-09-20 실제 복원 시험 통과. 향후 매월 또는 schema 변경 뒤 복원 시험을 반복한다.
매월 자동 복원은 private identity를 서버에 상시 두지 않으므로 운영자가 실행한다.
복구키 분실·복원 오류를 발견했을 때 원본 운영 DB를 지우거나 자동으로 덮어쓰지 않는다.

## 검증

```sh
node deploy/backup/test-retention.cjs
```

이 검사는 기간 경계·현재 사본 보호·다른 prefix와 알 수 없는 파일 보존을 확인한다.
초기 운영 버킷에는 만료된 실제 백업이 없어 7일 뒤 원격 삭제 자체의 운영 관찰은 남아 있다.
