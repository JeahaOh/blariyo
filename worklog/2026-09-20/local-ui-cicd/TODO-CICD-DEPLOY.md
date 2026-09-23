# GitHub Actions 경고 정리와 운영 자동 배포 TODO

- 기록일: 2026-09-20 KST
- 상태: **TODO — 다음 CI/CD 작업에서 진행**
- 현재 기준 커밋: `f38758a`

## 현재 확인

- `verify`와 API/Web 이미지 게시 job은 성공했다.
- API/Web 이미지는 GHCR에 commit SHA와 immutable digest로 게시된다.
- 현재 workflow에는 Lightsail SSH 접속, 운영 서버 image pull, Compose 교체, readiness 확인,
  rollback 단계가 없다.
- 따라서 CI 성공은 이미지 게시 성공을 뜻하며, 운영 서버 자동 배포 성공을 뜻하지 않는다.

## 다음 작업

1. Node 20 경고가 발생한 action을 Node 24 지원 릴리스로 갱신한다.
   - `actions/upload-artifact`
   - `docker/setup-buildx-action`
   - `docker/login-action`
   - `docker/build-push-action`
2. 갱신한 action은 가변 tag가 아니라 immutable commit SHA로 고정한다.
3. 새 CI에서 경고가 사라지고 `verify`·`images(api/web)`가 모두 통과하는지 확인한다.
4. `deploy.yml`을 별도로 추가한다.
   - `main`의 CI 성공 결과에만 연결
   - GitHub `production` environment 승인 사용
   - 전용 SSH deploy key와 GHCR read 권한 사용
   - commit SHA 또는 digest 기준 image pull
   - Compose 교체 후 Web/Core readiness 확인
   - 실패 시 직전 release/digest rollback
5. 운영 배포 후 HTTPS 공개 경로, health, Tunnel/Nginx, 기존 DB/R2 연결을 독립 확인한다.

## 배포 방식 결정

- 현재 단일 Lightsail VM의 순차 Compose 교체를 우선 구현한다.
- 이 방식은 짧은 연결 끊김이 있을 수 있으며 blue-green 무중단 배포가 아니다.
- blue-green 전환은 동시 메모리, Nginx 전환, 진행 중 요청, 구 이미지 보관과 rollback을
  별도로 검증한 뒤 후속 작업으로 결정한다.

## 대기 입력과 검증 경계

- GitHub Environment `production` 승인 정책
- SSH deploy key·known_hosts·GHCR read token 등록
- 운영 Compose 경로와 health URL 재확인
- action 버전 갱신 및 실제 서버 배포는 아직 수행하지 않았다.
