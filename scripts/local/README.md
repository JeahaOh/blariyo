# 지속적인 로컬 개발 서버

프로젝트 루트에서 Node 24.18.0을 사용한다. 운영 설정·운영 DB를 사용하지 않는다.

```sh
docker compose up -d postgresql
npm run build
node scripts/local/seed-policies.mjs --apply
node scripts/local/start-development.mjs
```

- 화면: `http://127.0.0.1:3000/meme`, 약관 `/terms`, 개인정보 `/privacy`.
  페이지와 이미지 주소를 같은 origin으로 맞춰 브라우저의 `img-src 'self'` 정책을 유지한다.
- Web/Core는 빌드한 현재 소스를 실행한다. 소스 변경 후 `npm run build`와 서버 재시작이 필요하다.
  이 macOS 환경의 파일 감시 한도 오류(EMFILE)를 피하기 위해 자동 감시 모드는 사용하지 않는다.
  시작할 때 Web 빌드를 Git 제외 `.local-data/development/web-output-*`에 복사해 실행하므로,
  다른 세션이 다시 빌드해도 실행 중인 서버의 JavaScript·CSS 파일이 사라지지 않는다.
- API: `http://127.0.0.1:3100`, DB: `127.0.0.1:5439/blariyo_local`, 이미지: Git 제외 `.local-data/media`.
- 이 로컬 실행기는 `NUXT_PUBLIC_X_EMBEDS_ENABLED=true`, `NUXT_PUBLIC_SOCIAL_EMBEDS_ENABLED=true`로
  X·YouTube·TikTok·Instagram 공식 게시물 표시를 활성화한다. 기본 배포 설정은 false다.
  임베드 비활성·실패 시 원문 링크와 안내를 표시하며 저장된 SNS 사본으로 자동 대체하지 않는다.
  원문 삭제·비공개 확정, 외부 재생 금지, 통신 실패를 가능한 범위에서 구분하고 미확인 상태를 삭제로 단정하지 않는다.
- 2026-09-20 사용자 지정으로 DB의 host 포트를 `55439`에서 `5439`로 변경했다.
  기존 `blariyo-m0-core-local_pgdata` volume과 데이터를 그대로 사용한다.
- 정책은 `docs/legal/m0-core/terms.html`, `privacy.html`과 기존 비공개 연락처 설정으로 만든다.
  실제 PoliciesService로 로컬 `v0.1`을 EFFECTIVE 등록한다. 시행 시각은 로컬 등록 시각이다.
  같은 본문은 재실행 시 유지하며, 같은 버전의 다른 본문·상태는 덮어쓰지 않고 중단한다.
- 문의 설정은 `~/.config/blariyo/public-contact.json`에서 읽는다. 실값을 source나 로그에 복사하지 않는다.
- 게시글 상태는 변경하지 않는다. 수집 25건이 DRAFT면 공개 목록은 비어 있는 것이 정상이다.
  2026-09-20 사용자의 개발 게시판 표시 요청으로 해당 25건을 별도 PostsService 발행 절차로
  PUBLISHED 처리했다. 현재 `/meme`에서 25건과 이미지 105개를 확인할 수 있다.
- 로컬 관리자 cookie 검수용 토큰은 Git 제외 `.local-data/development/session.json`에 권한 600으로
  저장한다. 매 실행마다 바뀌며 로그에 출력하지 않는다. 운영 Access 인증을 대체하는 도구가 아니다.
- 종료는 실행 터미널에서 Ctrl+C. Web/Core만 종료하며 개발 DB·정책·초안은 남긴다.

자동 브라우저 검사의 `browserFixture()`는 별도 임시 DB와 가짜 정책을 사용하는 검사 도구다.
지속적인 개발 서버나 실제 정책 확인 용도로 안내하지 않는다.
