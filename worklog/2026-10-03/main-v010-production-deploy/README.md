# main V010 운영 배포와 03시 자동배포 설치

## 요청

- `release`를 `main`에 반영한 뒤 운영 배포.
- 매일 03:00 KST에 `main` 변경이 있으면 운영에 배포하는 자동화 설치.
- 가오픈 상태이므로 DB/Collector migration 포함 경로로 진행 승인.

## 결과

- 운영 배포 완료.
  - main SHA: `31be83ba83bd0f6b251772400e743c2bd31fb378`
  - release: `/opt/blariyo/application/release-31be83b-main-nightly-20261003T034353Z`
  - API image: `ghcr.io/jeahaoh/blariyo-api@sha256:a21714bd7a6e06562f529d691059cd18b625938d6e353d849086d5db4ccf5c66`
  - Web image: `ghcr.io/jeahaoh/blariyo-web@sha256:b9c1c6f398a5e2e14648ffb7dbc03a8047c3b838c63301ac186113a93766530c`
- 운영 DB migration 완료.
  - API ledger: `V001`부터 `V010`
  - Collector ledger: `V001`부터 `V010`
  - `ops.is_schema_ready('V010') = true`
  - `collect.batch_retention`, `collect.assert_item_live(uuid)`, `collect.batch_input_receipt` 생성 확인
- 공개 smoke 확인.
  - `https://blariyo.com/health/live` -> 200
  - `https://blariyo.com/meme` -> 200
- systemd 자동배포 설치 완료.
  - service: `/etc/systemd/system/blariyo-nightly-main-deploy.service`
  - timer: `/etc/systemd/system/blariyo-nightly-main-deploy.timer`
  - schedule: `18:00 UTC` = `03:00 KST`, `RandomizedDelaySec=120`
  - 설치 후 1회 실행 결과: 현재 release가 main과 같아 `NOOP current release already matches main`
- 후속 보정: main 변경이 없으면 현재 release의 API/Web을 재시작하고 공개 smoke를 확인하도록 변경했다.
  - 서버 설치본 갱신 후 1회 실행 결과: `RESTARTED current release for unchanged main 31be83ba83bd0f6b251772400e743c2bd31fb378`
- 후속 운영 규칙: 운영 배포 성공 커밋에는 annotated tag를 남긴다.
  - 형식: `prod/YYYY-MM-DD-HHMM-KST-<shortsha>`
  - main 변경 없이 같은 release만 재시작한 경우에는 새 tag를 만들지 않는다.

## 운영 중 발견·조치

- 새 API image가 `ANALYTICS_CONTENT_KEY_SECRET`과 V010 DB 상태를 요구했다.
- 복사된 release secret이 root 소유면 uid 1000 컨테이너가 읽지 못해 `DB_PASSWORD_FILE_INVALID`가 발생했다.
- 자동배포 script의 기존 smoke는 host `127.0.0.1:3000`을 사용했지만 운영 compose는 host port를 열지 않는다.
- `/admin` 접근 시 운영자 권한 없음이 표시됐다. 원인은 운영 `admin-operators.json`에 최신 Web이 요구하는
  `role` 필드가 빠져 있어 운영자 registry 검증이 fail-closed로 403을 반환한 것이다.
- `role` 보정 뒤에도 403이 유지됐다. 추가 원인은 운영자 파일의 `identity`가 앱이 검증하는
  Cloudflare Access JWT `sub`와 달랐기 때문이었다. 현재 구성에서 `sub`는
  `/cdn-cgi/access/get-identity` 응답의 `user_uuid`와 일치했다.
- 조치:
  - Collector V007~V010을 `collector.schema_migration` checksum과 함께 한 트랜잭션으로 적용.
  - API V009~V010을 새 API image migration command로 적용.
  - `deploy/postgresql/apply-privileges.sql` 재적용.
  - `deploy/application/nightly-main-deploy-server.py`에서 copied secret 권한을 고정하고 공개 HTTPS smoke로 변경.
  - main 변경 없음 분기에서 API/Web restart, health wait, 공개 smoke, state 기록을 수행하도록 변경.
  - 운영 `admin-operators.json`을 백업한 뒤 활성 운영자에 `role: OWNER`를 추가했다.
  - 운영 `admin-operators.json`을 다시 백업한 뒤 활성 운영자의 `identity`를 현재 Cloudflare Access `user_uuid`로 교체했다.
  - `prepare-runtime-config.cjs`와 stage 검증에서 `role`을 보존·검사하도록 보정했다.
  - 설정 준비 도구가 Cloudflare Access `user_uuid` 형식인 UUID와 Access `id` 형식인 32자 hex를 모두 허용하도록 보정했다.

## 검증

- 서버:
  - API/Web 컨테이너 `healthy`
  - `docker inspect` 기준 API/Web image digest 일치
  - 공개 `/health/live`, `/meme` 200
  - `blariyo-publish.timer`, `blariyo-outbox.timer`, `blariyo-cleanup.timer` active
  - `blariyo-nightly-main-deploy.timer` enable/active
  - `blariyo-nightly-main-deploy.service` 후속 실행 성공, API/Web 재시작 후 `healthy`
  - 운영자 파일 보정 후 활성 운영자 1명, `role=OWNER`, `active=true` 확인
  - 운영자 identity 교체 후 hash 대조 기록. 원문 identity는 worklog에 남기지 않음
- 로컬:
  - `python3 deploy/application/test-nightly-main-deploy.py` 통과
  - `git diff --check` 통과
  - 배포 tag 규칙 문서화 후 `git diff --check` 통과
  - `node` 스키마 보존 검사에서 `admin-operators.json`의 `role` 출력 확인
  - `python3 deploy/application/test-stage.py` 통과

## 미검증·잔여

- 관리자 MFA 로그인, 글 작성, 이미지 업로드 재검증은 이번 자동 smoke 범위에 포함하지 않았다.
- 향후 Collector schema 변경을 자동배포가 직접 적용하는 범위는 별도 설계가 필요하다. 이번 자동배포 보정은 release 복사 권한과 공개 smoke 오류 수정까지다.
