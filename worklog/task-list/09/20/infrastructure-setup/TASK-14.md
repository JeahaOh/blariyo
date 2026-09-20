# TASK-14 — Web·Core 서버 보관 도구 준비

- 기록일: 2026-09-20, KST
- 이전 기록: [amd64 앱 image 준비](TASK-13.md)
- 상태: **로컬 입력·image 대조, 설치 실패/재실행 검사, Linux secret 읽기 PASS. 실제 서버 설치 대기**

## 현재 서버를 읽기 전용으로 확인

기존 신뢰된 SSH로 다음 항목만 조회했다. cloudflared의 command·환경 변수·토큰은 출력하지 않았다.

- hostname `ip-172-26-1-91`, x86_64, 루트 디스크 여유 54,627,962,880 bytes.
- `blariyo-db-postgresql-1`: 실행 중, healthy, `blariyo-db_data` network, host port 없음.
- `quirky_hertz`: cloudflared 실행 중, 기본 `bridge` network, host port 없음.
- `/opt/blariyo/application` 없음. 앱 설치 완료로 판단하지 않는다.

이 조회는 과거 사용자 결과와 별도로 수행한 현재 관측이다. DB 내용·정책 상태나 Tunnel의
대시보드 route 설정까지 확인한 결과는 아니다. 서버 쓰기·container 재시작은 수행하지 않았다.

## 준비한 설치 단계

- [맥 설치 도구](../../../../../deploy/application/stage-from-mac.py),
  [서버 코드](../../../../../deploy/application/stage-server.py),
  [회귀 검사](../../../../../deploy/application/test-stage.py)를 추가했다.
- 사용자 진입점: `/Users/zeaha/task_list/stage-blariyo-application.py`.
- 기본 입력은 사용자 생성 `application-config-W8Wwp5`와 TASK-13의 최종 image 폴더다.
  실제 비밀값·연락처는 코드/기록에 넣지 않았다.
- 기본 명령은 로컬 검사만 한다. `--stage`가 있어야 SSH stdin으로 설정·image를 전달한다.
- 서버 app 비밀번호와 기존 DB 비밀번호 일치, archive 전체 hash, image 실행 설정·layer,
  Compose 구문과 UID/GID 1000 secret 읽기를 검사한다. 설정은 root 600, secret은 1000:1000·600.
- 완료된 새 release에만 `STAGED_NO_SERVICES`를 기록한다. 기존 release를 덮어쓰지 않고,
  동일 입력은 재검증·재사용한다. 실패한 private 폴더는 완료 상태로 승격하지 않는다.
- Nginx·Tunnel 연결은 후속이다. 기존 Tunnel이 기본 bridge에 있다는 사실을 확인했으므로,
  설계의 edge network 연결을 아직 완료했다고 표시하지 않는다.

## 검증 증거

1. 설치 부정 입력·재실행 검사 8개 PASS. Docker 호출은 대역으로 검사했다.
2. 실제 amd64 Web·Core image에서 network none·read-only root·128MiB 한도로 합성 secret을
   UID 1000이 읽는 검사 PASS. 임시 volume 정리 완료.
3. 실제 image 묶음 archive config로 계산한 fingerprint와 로컬 Docker inspect 결과가 두 image 모두 일치.
4. 기존 image archive 회귀 8개 PASS. 실제 운영 입력 묶음 로컬 검사 PASS. 원문 비출력.
5. 조합된 원격 Python 코드 구문 검사, 문서 링크·공백과 `git diff --check` 확인.

검증용 Node container는 파일만 읽었다. production Compose 전체 기동·메모리 적정성,
서버 설치·앱 서비스·실제 Access 로그인·Nginx·Tunnel·R2 원격 백업은 미검증이다.

## 다음 실행

```sh
python3 /Users/zeaha/task_list/stage-blariyo-application.py --host 13.124.55.99 --stage
```

이는 image와 설정 설치 명령이다. DB 변경·정책 발행·앱 서버 기동·공개 경로 변경을 포함하지 않는다.
정책 본문·시행일 등의 미확정 사항을 정리하고 발행한 뒤 Nginx/Tunnel 연결과 서비스 기동을 진행한다.
기존 정책 필수 검사를 우회하지 않는다. Git commit/push는 수행하지 않았다.
