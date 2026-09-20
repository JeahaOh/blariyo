# TASK-08 — Docker inspect 버전 차이로 인한 image 검증 오탐 수정

- 기록일: 2026-09-20, KST
- 이전 기록: [초기 앱 migration 준비](TASK-07.md)
- 상태: image 비교 호환성 수정·서버 읽기 전용 대조 완료. 실제 서버 migration은 재실행 대기.

## 실패와 원인

사용자의 `migrate-blariyo-db.py --host 13.124.55.99 --apply` 실행은 image 전송에 성공했지만
`IMAGE_FINGERPRINT_MISMATCH`에서 중단됐다. 이 검사는 DB migration·사본·초기 marker 생성보다
앞에 있다. 도구가 만든 lock 파일은 남을 수 있으나 DB schema 변경을 실행하지 않은 분기다.

기존 strict SSH 인증으로 대상 image metadata만 읽어 로컬과 대조했다. 기존 Tunnel inspect,
secret 파일 읽기·출력, DB 변경 명령은 수행하지 않았다.

- 서버 Docker 29.8.1 / API 1.56.
- OS linux, architecture amd64, RootFS 전체 layer와 순서가 로컬과 일치했다.
- Config 차이는 Hostname·Domainname·AttachStdin/Stdout/Stderr·Tty·OpenStdin·StdinOnce·Image의
  빈 문자열/false와 Labels·OnBuild·Volumes의 null 항목이 서버에서 생략되는 것이었다.
- 서버 `/opt/blariyo/postgresql/.initial-migration.json`이 존재하지 않음을 확인했다.
- [공식 Docker 변경 문서](https://docs.docker.com/engine/deprecated/)의 non-standard Config 항목
  제거와 Docker 29의 empty/nil 항목 생략에 해당한다. 동일 Docker Desktop 안에서만 load를
  검사했던 TASK-07의 검증으로는 이 버전 간 차이를 발견하지 못했다.

## 수정

[migrate-server.py](../../../../../deploy/postgresql/migrate-server.py)의 fingerprint 계산에서
공식 문서에 나온 필드의 빈 값·기본값만 정규화했다. 실제 runtime 설정, 알 수 없는 신규 필드,
architecture·OS와 파일 layer 내용·순서는 그대로 비교한다. 검증 우회나 서버 Docker 설정 변경은 없다.

기존 image archive를 유지하고 원래 fingerprint 일치를 먼저 확인한 뒤 로컬 manifest의 새
fingerprint·helper SHA-256을 갱신했다. 이전 manifest는 같은 디렉터리의
`manifest.before-fingerprint-fix.json`에 보관했다. 운영 비밀번호는 포함하지 않는다.

## 검증과 다음 실행

- [회귀 검사](../../../../../deploy/postgresql/test-image-fingerprint.py): 구 API 기본값/신 API 생략값
  일치, 빈 runtime 필드 일치, 실제 설정 변경 거부, platform/layer 내용·순서 변경 거부 통과.
- 수정한 fingerprint 함수를 서버 image에 읽기 전용으로 적용해 로컬 예상값과 일치 확인.
- 서버 초기 migration marker는 여전히 없음. 수정 도구로 실제 서버 migration은 실행하지 않음.

수정 후 동일 image archive로 격리 DB V001–V005 migration·역할별 권한·동일 묶음 재실행·
ledger 변조 거부 검사가 종료 코드 0으로 통과했다. fixture DB 정리도 성공했다.
맥 진입점 기본 검사, Python 구문·상대 링크 확인 및 `git diff --check`가 통과했다.
서버 적용은 맥에서 기존 명령을 다시 실행한다.

```sh
python3 /Users/zeaha/task_list/migrate-blariyo-db.py --host 13.124.55.99 --apply
```

기존 서버 image가 있어도 같은 archive를 다시 load하며 DB 삭제·초기화는 하지 않는다.
TASK-07은 당시의 시험 결과로 보존했다. commit·push는 하지 않았다.
