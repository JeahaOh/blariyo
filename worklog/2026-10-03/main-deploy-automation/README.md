# main 배포 자동화 작업

## 요청

- `release` 브랜치를 `main`에 반영하고 운영에 배포한다.
- 운영 서버에 매일 새벽 3시(KST) `main` 브랜치 변경이 있으면 배포하는 스크립트를 만든다.

## 경계

- 저장소 지침상 `release -> main` 최종 병합은 GitHub 웹 GUI PR에서만 수행한다.
- CLI/API로 main 직접 merge, main 직접 push, 자동 merge는 수행하지 않는다.
- 운영 배포는 main SHA, CI image digest, 최신 백업/복원, 서버 상태 확인이 별도 증거다.
- 현재 작업은 자동 배포 스크립트와 timer 파일을 source에 추가하는 범위다. 운영 서버 설치·활성화는 별도 실행 증거가 필요하다.

## 구현

- `deploy/application/nightly-main-deploy-server.py`
  - 서버에서 `origin/main` SHA를 조회한다.
  - 현재 부팅 helper가 가리키는 release SHA와 같으면 종료한다.
  - 새 main SHA의 GHCR API/Web image를 tag로 pull한 뒤 digest 참조로 고정한다.
  - 배포 직전 `blariyo-backup.service`를 실행하고 성공하지 않으면 중단한다.
  - 현재 release 폴더를 새 release 폴더로 복제하고 `images.env`만 새 digest로 작성한다.
  - API, Web을 순차 교체하고 health smoke 뒤 부팅 helper를 새 release로 갱신한다.
- `deploy/application/blariyo-nightly-main-deploy.service`
- `deploy/application/blariyo-nightly-main-deploy.timer`
  - `OnCalendar=*-*-* 18:00:00 UTC`, 즉 KST 03:00.
- `deploy/application/test-nightly-main-deploy.py`
  - 설정 파싱, release 복제, image 참조 갱신의 파일 단위 회귀 검사.

## 검증

- 아직 운영 서버에 설치하거나 timer를 활성화하지 않았다.
- 후속으로 로컬 테스트, lint/문서 검사, release 통합, PR 준비, 실제 배포 절차가 필요하다.

## 잔여

- `release -> main` PR 생성 및 GitHub 웹 GUI 병합.
- main push 후 CI `verify`, `collector`, `images` 성공과 image digest 확인.
- 운영 서버의 현재 release/digest/DB ledger/timer/백업 상태 읽기 전용 재조회.
- 최신 18시간 이내 백업과 격리 복원 확인.
- 배포 후 관리자 이미지 업로드 실패 문구, 발행/숨김, 공개 smoke 확인.
