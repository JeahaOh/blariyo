# 수집 검수: 인코딩·재조회·승인 발행·안내

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료(구현·검증·로컬 화면 반영, 기존 DB 정정 잔여) / 갱신: 2026-10-05 20:28 KST
- 앞선 batch-detail-navigation 종료 확인. 기존 미커밋 변경 보존.
- 요청: 웃대 한글 깨짐 수정, 수동 목록 재조회 시 상세 해제, 승인부터 초안 생성·즉시 발행 연결, 사이트 전용 안내 다이얼로그.
- 변경 범위: 웃대 상세 파서/공통 순서 파서·회귀, batch Web/공통 다이얼로그·브라우저 회귀, 관련 planning/system-design·현재 상태.
- 검증 계획: 실제 로컬 원문 읽기와 파서 재현, Collector 회귀, Web 빌드/타입, 격리 DB 브라우저에서 발행/중간 실패/응답 손실/재조회 검증.
- 제외: 운영 데이터 변경·커밋·push·배포. 기존 로컬 수집물 복구 가능 여부는 별도 확인.

## 확인

- 로컬 웃대 원문은 EUC-KR 선언을 포함한 bytes로 보존되어 있다. DB 제목에 깨진 문자가 실제 저장돼 있어 표시 전용 문제는 아니다.
- 현행 웃대 파서는 최초 파싱 뒤 UTF-8로 직렬화하고 공통 파서에서 charset을 다시 탐지한다. 재파싱 경로를 회귀로 확인한다.
- 승인/승격/발행 API는 각각 요청 키와 버전 검사를 지원한다. UI에서 기존 명령을 순차 연결하고 실패 단계의 요청을 보존한다.

## 반영 결과

- 웃대: EUC-KR http-equiv meta가 있는 원문을 UTF-8로 다시 직렬화·탐지하면서 생긴 깨짐. 최초 디코딩된 DOM을 공통 순서 파서에 직접 전달한다. 기존 byte[] 진입점·다른 사이트의 동작은 유지한다.
- 수동 목록 조회/재조회/페이지 변경: 즉시 상세·제목·연결 글 상태를 비우고 URL itemId를 제거한다. 조회 실패 시 이전 목록만 보존한다. 저장 후 내부 갱신은 상세를 유지한다.
- `승인 및 발행`: 제목 확인 → 기존 review → draft → IMMEDIATE publish. 단계별 요청 키·버전 보존, 각 단계 응답 손실/인증 실패 시 같은 요청으로 재시도한다. 초안 생성 후 발행 실패는 초안을 보존한다. 기존 연결 초안은 발행 재시도로 이어 가고 발행 여부는 게시글 조회 결과로 표시한다.
- 도움말: 화면 상시 설명을 `사용 안내` 버튼 + 공통 AppDialog로 이동. 사이트 색상·배경, Escape/확인 닫기, Tab/Shift+Tab 포커스 유지와 트리거 복귀.
- planning 서비스/수집/화면, system-design API/Collector, 기능 개발 명세 동기화. API wire·OpenAPI·migration 변경 없음.

## 검증

- 원인 재현: 수정 전 새 EUC-KR 회귀 1건 실패, UTF-8 통과. 수정 후 Collector 총291개 중271 통과·20 DB 환경 전제 미충족 skip·실패0. 기존 DB 관련 skip을 성공으로 집계하지 않는다. `test fixtureClasspath`, `bootJar` 성공.
- 로컬 원문 읽기 전용: 웃대7건 모두 재파싱 성공, 전체 제목/본문 replacement 문자0, 제목6건 정정 결과 확인. 실제 외부 fetch 및 DB 쓰기0. 대상 DB 상태는 FETCHED6(제목 깨짐5), FAILED1(제목 깨짐1), 연결 게시글0.
- Web build, Web typecheck, tests tsc, 대상 Vue/브라우저 테스트 ESLint, git diff --check 통과.
- 최종 격리 Chromium26 tests 모두 통과: batch review15·navigation4·expiry1·loading6. 승인/승격 응답 및 상세 응답 손실→401/403→동일 요청 복구, 발행 전 실패/발행 commit 후 응답 손실, 중복 글 차단, 동시 클릭, 실제 공개 API200·공개 이미지 bytes·상태 이력2건 검증. UI 요구 변경에 따라 기존 DRAFT/별도 클릭 기대를 PUBLISHED/연속 처리로 강화했다.
- 도움말 최초 Tab 회귀 실패를 공통 다이얼로그 포커스 순환으로 수정한 뒤 최종 재실행. 320/1280px 도움말 및320/390/768/1280/1440px 상세 스크린샷 생성·도움말320/1280 및 상세390 직접 확인.
- 로그: `/tmp/blariyo-humoruniv-before.log`, `/tmp/blariyo-humoruniv-after.log`, `/tmp/blariyo-batch-publish-*`.
- 로컬 Web/Core 재시작, 새 세션26049, localhost3000·Core3100·workers=false. 새 Collector jar 빌드 완료, 실제 신규 외부 수집은 실행하지 않았다.

## 잔여와 경계

- **기존 저장 수집물은 자동 복구하지 않았다.** `collect.guard_batch_item`은 FETCHED 재수정을 차단한다. 보호 trigger/검사를 끄거나 state를 임의 우회하지 않았다. 정정 ledger·원문 hash·버전·검수 이력 보존을 포함한 공식 재파싱/정정 경로가 필요하다. 따라서 기존 제목 깨짐6건은 로컬 목록에 남아 있다.
- 입력 표본은 `.local-data/repairs/humoruniv-encoding/input.json`(비공개·Git 제외)에만 보존. 원문·개인정보를 작업 기록에 복제하지 않았다.
- 운영 DB/원문 정정, 기존 게시글 발행, commit/push/배포는 실행하지 않았다. 격리 테스트에서만 실제 발행했다.
