# 더쿠 HOT 25건 — 출처 기반 로컬 검토 초안

2026-09-20 KST에 더쿠 HOT 목록 1~3페이지와 상세 페이지에서 수집했다.
허구 게시글 생성이나 예전 예제 데이터 복사가 아니다. 단일 커뮤니티의 그 시점 HOT 목록이며
전체 커뮤니티 인기 순위나 게시물에 적힌 주장의 진실성을 뜻하지 않는다.

[수집 묶음](community-hot-20260920.json)에 25개 각각의 상세 URL, 원제목, 원문 표시 시각,
관측 시각, HOT 목록 URL, 조회/댓글 수와 응답 SHA-256을 남겼다. 본문은 직접 작성한 검토 요약이다.
이미지·영상만 있는 글은 보지 않은 장면을 창작하지 않고 추가 확인이 필요하다고 표시했다.
원문 이미지·댓글·전체 본문은 복제하지 않았다. 다운로드해 읽은 본문 텍스트도 최종 묶음에 남기지 않았다.
`robots.txt`는 관측 당시 404였으며, 이것을 이용 허가로 해석하지 않았다.
[이용약관](https://theqoo.net/service)을 확인했으나 이미지 재사용 허가는 확보되지 않았다.

## 최초 요약 DB 저장 이력

대상은 이 저장소의 로컬 PostgreSQL `127.0.0.1:55439/blariyo_local`이다.
`content.board_post`에 출처·제목을, `content.board_post_block`에 요약을 저장했다.
운영 DB를 대상으로 하는 옵션은 제공하지 않는다. 실제 앱 PostsService와 migration을 사용한다.
수집은 단발 작업이며 운영 collector나 자동 발행을 켜지 않았다.

```sh
nvm use 24.18.0
docker compose up -d postgresql
npm run build -w @blariyo/api
node scripts/content/import-local-drafts.mjs --apply
```

최초 실행 결과: 신규 25, `DRAFT=25`, `PUBLISHED=0`.
재실행 결과: 신규 0, 기존 25 유지. source URL로 중복을 피하며 기존 편집 내용을 덮어쓰지 않는다.
검사 결과와 실제 ID는 `.local-data/content-review/import-result.json`에 저장한다. 이 파일은 Git 제외다.
최초 실패는 DB의 작성자 식별자 제약 때문이었고 transaction이 취소됐다. 규정된 `system:collector`로
수정한 뒤 25개 모두 성공했다. DB 제약을 완화하지 않았다.

## 발행 전

이 적재는 원문 전체 수집이나 운영 발행이 아니라 출처 기반 요약 초안이다. 원출처·재사용 권리·개인정보·사실관계를 검토하고 필요한 본문과 첨부를 확보한 뒤 앱의 정상 발행 절차를 사용한다.
