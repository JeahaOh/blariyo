# Body HTML Roadmap

## 요청

- 운영 게시글 저장 구조를 DB까지 `body_html` 단일 본문으로 바꾸고 싶다는 사용자 결정 기록.
- 단, 수집 원문과 사용자가 검토하는 수집 결과는 기존처럼 block 단위로 보관·표시한다.
- 수집 결과를 실제 게시글에 반영하는 시점에만 block을 HTML 본문으로 변환한다.

## 반영

- `docs/roadmap.md`
  - `BODY-HTML-01`을 별도 `M0.5` 후속 마일스톤으로 추가.
  - 수집 block 유지, 게시글 `body_html` 전환, migration/API/UI/rollback 완료 조건을 분리.
- `docs/system-design/02-data-model.md`
  - 현행 M0는 `content.board_post_block` 기반임을 유지.
  - 후속 M0.5 목표 계약으로 `body_html` 단일 본문, image reference 검증, sanitize, migration/rollback 경계를 추가.
- `docs/development-specs/m0-core/admin-post-management/admin-post-management.dev.md`
  - 현행 관리자 명세의 범위 밖에 M0.5 전환을 추가.
  - M0.5 목표 계약 링크를 결정·가정 절에 추가.
- `docs/development-specs/m0-core/public-post-browsing/public-post-browsing.dev.md`
  - 현행 공개 상세는 block 표시 계층이고, M0.5에서 `body_html` 렌더링으로 전환한다는 후속 경계를 추가.
- `docs/status.md`
  - 구현 완료가 아니라 후속 결정 등록임을 명시.

## 미구현

- DB migration 없음.
- OpenAPI·생성 타입 변경 없음.
- API/Web source 변경 없음.
- 기존 게시글 변환·rollback rehearsal 없음.
- 브라우저/DB/runtime 검증 없음.

## 검증

- `git diff --check` 통과.
- `rg -n "M0\\.5|body-html|BODY-HTML|본문 HTML 저장 구조" docs worklog/2026-10-04/body-html-roadmap/README.md`로 변경 위치와 문서 간 참조를 확인했다.
