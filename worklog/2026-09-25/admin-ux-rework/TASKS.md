# 관리자 UX rework 실행 기록

- 요청: [REQUEST.md](REQUEST.md)
- Goal: `01a0d3f9-5a98-7292-aea8-e117a6110174` (완료)
- 범위: ADM-00~07. commit/push/운영 배포 제외.
- 보존: 시작 시 확인한 다른 작업의 modified/untracked 파일은 수정·stage하지 않았다.

| ID | 결과 | 실행 근거 |
| --- | --- | --- |
| ADM-00 | 완료(기준선 기록) | 시작 Git 상태 `main...origin/main [ahead 4]`; 기존 변경 보존. 개발 DB 시작 수량·상태·해시는 이전 실행 메모 기준이며 아래 최종 대조 참고. |
| ADM-01 | 완료 | 화면 계약, 인증 경계, 검수→초안→발행 흐름을 planning·system-design·두 개발 명세에 반영. |
| ADM-02 | 완료 | 공통 작업공간·반응형 레이아웃 구현. 검수·게시글 화면 1440/1280/768/390/320px, 로그인 화면 1280/390/320px 캡처와 넘침 assertion. |
| ADM-03 | 완료 | 로그인·로그아웃·allowlist 복귀 구현. 활성/비활성, Origin/Host/loopback/전달 헤더 거부 검사 통과. |
| ADM-04 | 완료 | 검수 목록·상세·필터·페이지·원문/미디어·모바일 복귀 및 오류 복구 검사 통과. |
| ADM-05 | 완료 | 격리 DB/object에서 승인·반려·초안·편집·발행·공개 readback, 중복 방지, 401/403·충돌 복구와 게시글 회귀 통과. |
| ADM-06 | 완료 | Node 24.18.0 typecheck/build, web lint, 변경 browser/script lint, 두 브라우저 스위트 통과. 시각 캡처 직접 확인. |
| ADM-07 | 완료 | 개발 앱 최신 빌드 기동 및 실제 로그인·게시글 50건·수집 검수 206건·상세 열기 확인. 같은 직렬화 방식으로 6개 테이블의 최종 수량·SHA-256이 기준선과 모두 일치. |

## 구현 내용

- 관리자 공통 작업공간: 브랜드/메뉴/현재 위치, 게시글·수집 검수 전용 메뉴, 넓은 작업 영역과 모바일 메뉴.
- 로컬 전용 로그인: same-origin POST, HttpOnly·SameSite=Strict 세션, 로그아웃, 안전한 복귀 URL. 운영 및 비루프백 접근은 허용하지 않는다.
- 검수: 데스크톱 목록/상세 분할, 모바일 상세 복귀, 출처·수집·검수 필터, 페이지 이동, 원문/첨부 및 처리 단계 표시.
- 초안 복귀: 검수 목록·필터·페이지·선택 항목 보존. 세션 만료 시 새 탭에서 다시 인증하고 미확정 요청 키와 입력을 유지한다.
- 개발 실행기와 안내 문서는 토큰을 브라우저에 직접 주입하지 않고 `/admin/login` 흐름을 사용한다.
- 후속 화면 제보: 인증 완료 화면에서 주 동작과 로그아웃이 붙어 보여 혼동을 줬다. 두 버튼을 별도 `.login-actions` grid로 묶고 12px 간격, 우측 정렬된 보조 버튼으로 구분했다.

## 검증 결과

- `npm run typecheck -w @blariyo/web` — 통과.
- `npm run lint -w @blariyo/web` — 통과.
- 변경 web 파일 ESLint — 통과.
- 변경 browser 테스트 ESLint — 통과.
- `node --check scripts/local/open-admin.mjs` 및 `start-development.mjs` — 통과.
- `npm run build` — 통과(Node 24.18.0).
- 후속 로그인 화면 수정 후 `npm run build`, web typecheck/lint 재검증 — 통과.
- `node --test --test-concurrency=1 tests/browser/batch-review.test.ts` — 12/12 통과.
- `node --test --test-concurrency=1 tests/browser/admin-workflow.test.ts` — 4/4 통과. 12개 게시물 생성·수정·업로드·순서 변경·예약/취소·발행·숨김·재공개 포함.
- `node scripts/local/open-admin.mjs --verify` — 실제 `localhost:3000` 로그인, 게시글 목록 50건, 검수 기능 메뉴와 실제 DB 검수 항목 206건 중 상세 열기, 익명 API 401 확인. 기록상 쓰기 0건, 브라우저 오류 없음.
- 후속 인증 화면 브라우저 확인 — 로그인 후 `/admin/login`에서 관리 이동/로그아웃 버튼 사이 12px 이상 간격 assertion 통과. `.local-data/verification/admin-login-authenticated-3000.png` 캡처를 시각 확인.
- `git diff --check` — 최종 실행 통과.
- 전체 저장소 테스트는 실행하지 않음. 운영 Access와 production은 이 로컬 작업으로 검증하지 않음.

## 개발 DB 최종 readback

- 동일 집계: 수집 206건(`BLOCKED 3`, `FAILED 8`, `FETCHED 193`, `SKIPPED_POLICY 2`), 검수 8건(`APPROVED 8`), 게시글 74건(`DRAFT 1`, `HIDDEN_REVIEW 2`, `PUBLISHED 71`), 게시글 이미지 308건, 상태 이력 83건, 수집 미디어 711건.
- 게시글 최신 `updated_at`: `2026-09-23T03:25:50.698Z`로 이번 UX 작업 시간보다 앞선다.
- 시작·종료 해시 모두 `SELECT to_jsonb(t) ... ORDER BY to_jsonb(t)::text`의 반환 행을 `JSON.stringify(row) + "\n"` 방식으로 SHA-256에 순서대로 반영했다. 여섯 테이블 모두 일치:

| 테이블 | 행 수 | 시작·종료 SHA-256 |
| --- | ---: | --- |
| `collect.batch_item` | 206 | `c18d62e3b38d64ce80cee6fcf77e60d10183fdb8d6e3371cd027c3ef6c07c116` |
| `collect.batch_review` | 8 | `93f693e95aff8cd591d3fbc48558c1b504fa324817cd8814cd7629c3ed24ee19` |
| `collect.batch_media` | 711 | `2439e403328e02ea24170943a9708adb52ac481c17dddc39bb732de74d5e6a06` |
| `content.board_post` | 74 | `d7524ddf28567bc614cd514b326d7fd0a8e1e433eecf45aa5ea6ccd13ef8f2d7` |
| `content.board_post_image` | 308 | `5b4bb90780f8247a6b587f72a886afb32e5605c07f7b7e926cedf73a016bcb6f` |
| `content.board_post_status_history` | 83 | `ac5a97bdc9eeaf20dec30e1696add8be60583c57a08f136897f1336de93abf51` |
- 이 작업의 게시글/검수 변경 테스트는 임의 격리 DB와 임시 object 저장소에서 수행했다. 실제 개발 앱 확인 기록도 `writes: 0`이다.
- 최초 재계산은 행 끝 개행을 누락해 일시적으로 달랐다. 시작 실행 로그에서 정확한 직렬화 규칙을 확인하고 같은 방식으로 다시 계산해 여섯 해시 모두 일치했다.

## 화면 증거

- 격리 브라우저 캡처: `.local-data/admin-ux-rework/screenshots/`의 `admin-login-*`, `admin-posts-*`, `batch-review-*`.
- 실제 개발 앱 read-only 캡처: `.local-data/verification/admin-core-3000.png`, `.local-data/verification/admin-batch-3000.png`.
- 캡처에서 폭 넘침·버튼 겹침은 발견하지 않았다. 320px 검수 상세는 본문이 세로로 길지만 뷰포트 가로 넘침은 없다.

## 실행 기록

| 시각(KST) | Task | 명령·검증 | 결과 |
| --- | --- | --- | --- |
| 2026-09-25 | ADM-00~06 | typecheck, lint, build, 두 브라우저 스위트 | 통과. 게시글 인증 검증을 신규 로그인 페이지 리다이렉트 계약에 맞추어 갱신 후 4/4 통과. |
| 2026-09-25 | ADM-07 | `start-development.mjs`, `open-admin.mjs --verify`, repeatable-read DB checksum | 실제 앱 반영·브라우저 readback 통과. 개발 DB 6개 테이블의 시작·종료 행 수와 SHA-256 일치. |
