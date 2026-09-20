# 첫 GitHub Actions 실행 실패와 로컬 수정

- 확인일: 2026-09-20
- 사용자 push: `fe739a83a6351d098c3492826a4019725d6c6417` (`main`)
- 원격 `refs/heads/main`과 로컬 HEAD 일치 확인.
- 실행: https://github.com/JeahaOh/blariyo/actions/runs/35510996309
- 원격 결과: verify 실패, images 건너뜀. 이미지 게시 및 운영 배포 성공을 의미하지 않는다.

## 원인과 변경

스크립트 타입 검사가 `apps/api/dist`의 생성 모듈을 import하지만, 기존 workflow는 빌드보다 타입 검사를 먼저 실행했다. 깨끗한 checkout에서는 생성물이 없으므로 모듈을 찾지 못한다.

`.github/workflows/ci.yml`에서 앱 빌드와 API 테스트 빌드를 scripts/tests 타입 검사보다 먼저 실행하도록 순서를 변경했다.

## 검증

다른 세션의 미커밋 변경을 제외하려고 `git archive HEAD`로 push된 소스만 `/tmp/blariyo-ci-order-hvp0j5lc`에 추출하고 수정한 workflow만 복사했다. Node 24.18.0에서 의존성을 새로 설치했다.

- 빌드 전 `npm run typecheck:scripts`: 종료 코드 2로 실패 재현.
- 수정 순서: `npm run build`, `npm run build:test -w @blariyo/api`, scripts/tests 타입 검사와 lint, Web 타입 검사 모두 통과.
- `npm test`: 15개 통과, 실패 0개.
- 로컬 재현 기록: `/tmp/blariyo-ci-before.log`, 설치 기록: `/tmp/blariyo-ci-install.log` (임시 파일).

## 남은 범위

- 수정은 로컬 작업 트리에만 있으며 이 수정의 commit/push는 수행하지 않았다.
- 수정된 SHA의 GitHub Actions 재실행, CI DB 통합/브라우저 검사, GHCR 이미지 게시, 운영 배포는 미검증이다.
- 이전 SHA의 실패 작업만 재실행하면 수정된 순서가 적용되지 않는다. 수정 커밋을 push한 새 실행을 확인해야 한다.
- 다른 세션의 변경과 기존 로컬 preview는 보존했다.
