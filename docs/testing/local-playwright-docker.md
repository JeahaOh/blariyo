# 로컬 Playwright 브라우저 테스트 (Docker)

macOS에서 로컬 Chromium 실행이 차단될 때 Playwright 브라우저 서버만 Docker로 실행해
브라우저 테스트를 반복할 수 있다. 테스트 서버·애플리케이션은 호스트에서 실행되며,
PostgreSQL 격리 테스트 DB는 로컬 Compose 컨테이너의 `postgres` 데이터베이스 안에 무작위로 만든다.
테스트 종료 시 임시 DB와 이번 명령이 만든 브라우저 컨테이너를 회수한다.

저장소 루트에서 실행한다.

```sh
nvm use # Node 24.18.0
npm run test:browser:docker -- tests/browser/consent.test.ts
# 브라우저 테스트 전체 실행
npm run test:browser:docker
```

- `tests/` 아래 `*.test.ts` 파일을 인자로 전달할 수 있다. 여러 파일도 지정 가능하다.
- 테스트는 `node --test --test-concurrency=1`로 실행한다. 프로덕션 빌드는 자동으로 하지 않는다.
- Docker 이미지 태그는 설치된 `@playwright/test` 버전과 일치한다. 이미지가 없으면 실행기가
  이미지 pull 명령을 알려주고 중단한다. 안내된 명령을 실행한 뒤 테스트를 다시 시작한다.
- 브라우저 서버 포트 `55450`은 `127.0.0.1`에만 공개한다. 해당 포트가 점유 중이거나 고정
  컨테이너 이름이 이미 있으면 기존 프로세스·컨테이너에 손대지 않고 중단한다.
- 테스트 DB 접속 URL은 실행 중인 `blariyo-m0-core-local-postgresql-1` 컨테이너의
  PostgreSQL 사용자와 비밀번호 환경 변수 또는 비밀번호 파일에서 구성해 테스트 프로세스에만
  전달한다. URL·비밀번호는 출력하지 않는다. 사용자 정의 compose port를 쓰는 경우 실행기 설정도
  함께 조정해야 한다.
- `Ctrl+C`는 현재 테스트를 중지하고, 실행기가 만든 브라우저 컨테이너를 정리한다.
- 테스트 프로세스가 강제 종료되면 브라우저 컨테이너가 남을 수 있다. 이 경우 이름
  `blariyo-local-playwright-server`의 컨테이너가 이번 테스트 실행에서 만든 것인지 확인한 후
  직접 정리한다. 실행기는 이름이 이미 존재하면 자동 삭제하지 않는다.

이 명령은 로컬 격리 테스트 편의 기능이다. Google Analytics 실제 수신이나 운영 배포를 증명하지 않는다.
