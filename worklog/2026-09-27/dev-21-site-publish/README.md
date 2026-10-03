# 개발용 21개 사이트 수집·공개

- 요청: 21개 사이트를 수집해 개발 서버에 공개 상태로 저장. 사용자 지정 상한은 사이트당 10건, 총 210건이다.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/m0-design-completion` / 시작 HEAD: `f1fc07dfcace23dde6230a22016e0eb4abe0d321`
- 상태: 종료 — 부분 적재, 미수집 출처는 차단/실패로 인계 / 갱신: 2026-09-27 18:28 KST
- 변경 범위: 로컬 수집 준비 도구의 필요한 권한 보완, 개발 DB migration·수집·공개, 실행 증거와 관련 현행 안내.
- 제외: 운영 DB·배포·push·commit·batch 구조안·기존 글의 일괄 공개·접근 차단 우회.

## 시작 상태

- 개발 DB: `127.0.0.1:5439/blariyo_local`. API migration V001–V008, Collector V001–V006.
- 기존 게시글: PUBLISHED 72 / HIDDEN_REVIEW 2 / DRAFT 1. 웹 3000·API 3100은 실행되지 않았다.
- 기존 untracked 경로 4개는 보존: 9/26·9/27 batch-structure-research, 9/27 m0-implementation-plan·m0-next-step.
- 기존 준비 도구는 신규 mailbox·quota 함수 권한을 제거하는 문제가 있어 최신 계약으로 정렬한다.

## 완료 기준과 제한

- 21개 소스 각각에 현재 수집 결과 또는 실제 제한 사유를 남긴다. 사이트당 10건을 초과하지 않는다.
- 저장 성공은 원문 본문·블록 순서·미디어 객체 hash/크기 readback으로 확인한다.
- 검증된 신규 항목만 API의 검토·초안·공개 절차로 공개하고 공개 API·이미지·화면을 확인한다.
- 기술적 차단·실패·중복·날짜 제외는 성공과 구분한다. robots·요청 간격·일일 제한은 우회하지 않는다.
- 서로 다른 문제의 retry는 별도 계산하며 같은 문제는 최대 2회 수정, 3회 검증 cycle로 제한한다.
- 백업과 원문·비밀 설정은 Git 제외 `.local-data/`에 보관하며 작업 기록에 비밀 값을 넣지 않는다.

## 결과

- **신규 공개 31건 / 공개 이미지 70개 / 수집 성공 출처 5개.** 21개 출처 모두에서 데이터를 확보하지는 못했다.
- 접속: <http://localhost:3000/meme>. 개발 서버를 계속 실행해 두었다. 신규 글 ID 113–143.
- 기존 글 75건의 상태·버전·갱신 시각 보존. 최종 PUBLISHED 103 / HIDDEN_REVIEW 2 / DRAFT 1.
- 21개 소스 판정: COMPLETED 1 / PARTIAL 2 / BLOCKED 17 / FAILED 1. BLOCKED run에도 중단 전 성공한 항목은 개별 검증 후 공개했다.
- 실제 HTTP 예약 153회, 중복 제외 5건, 기간 제외 1건. 실패 사건 20개는 목록 단계 오류를 포함하므로 실패 게시글 20건이라는 뜻이 아니다.
- 수집 실행: 10:54:34–11:04:50 KST. 최종 공개/브라우저 검증: 18:26 KST. 이미지 포함 18건의 공개는 첫 브라우저 실행 승인 이후 17:43 KST에 완료했다.
- 사이트별 정량·run ID·공개 ID·검증은 [RESULTS.json](RESULTS.json)에 기록했다.

| 출처 | 신규 공개 | 공개 이미지 | 중단·제외 사유 |
| --- | ---: | ---: | --- |
| 디미토리 | 10 | 14 | 지정 상한 도달 |
| 인벤 | 9 | 28 | 상세 1건 PARSE_FAILED |
| 루리웹 | 9 | 28 | 상세 1건 SOURCE_GONE |
| 율도 | 2 | 0 | 기간 제외 1건, 이후 ROBOTS_UNVERIFIED |
| 클리앙 | 1 | 0 | 이후 SOURCE_NOT_ALLOWED |
| 아카라이브·보배드림·디시인사이드·goodgag·웃긴대학·인스티즈·PGR21·더쿠·오늘의유머 | 0 | 0 | ROBOTS_UNVERIFIED |
| 이토랜드·엠팍·네이트판 | 0 | 0 | ROBOTS_DISALLOWED |
| 개드립(dogdrip) | 0 | 0 | SOURCE_ACCESS_BLOCKED |
| 에펨코리아·뽐뿌 | 0 | 0 | CHART_UNVERIFIED, 외부 요청·DB run 생성 없음 |
| 유튜브 커뮤니티 | 0 | 0 | PARSE_FAILED |

## 변경·검증 증거

- 개발 준비 도구: 현행 batch 권한 정렬, 실제 migration ledger 출력, 백업 `pg_restore --list` 검증, 새 DB에서 API→Collector 적용 순서 보완.
- Java25 `bootJar` 성공. 시작 시 기존 JAR는 9/25 빌드여서 첫 준비 실행은 Collector V006 상태에서 42P01로 종료했다. API는 V010까지 적용된 상태를 확인하고 현재 JAR를 빌드한 뒤 재실행했다.
- 최초 전체 백업: Git 제외 `.local-data/backups/before-batch-review-1790473981259.dump` (API008/Collector006). 후속 준비 백업 `1790474026162`, 공개 후 준비 재검증 백업 `1790498582103`도 archive 검사 통과. 백업 복원 자체는 이번 실행에서 하지 않았다.
- 실제 개발 DB: API V001–V010 / Collector V001–V010. 최종 준비 도구 재실행 성공, collect media 772개 hash/크기 검증.
- 별도 임시 DB 시험 `scripts/local/batch-privileges.test.mjs`: 1 test PASS. 현행 migration, 권한 반복 적용, 실제 quota 차감/대기·빈 mailbox claim·runtime 조회, content/검수/정정/항목 삭제 거부. 시험 DB 회수 확인. 첫 시험의 fresh DB schema 충돌은 migration 순서 수정 후 재검증했다.
- 실제 수집은 `blariyo_batch_local`, 검토·초안·공개는 개발 BFF/API 역할로 실행했다. 소유자 계정 수집·직접 게시 상태 SQL 갱신은 하지 않았다.
- DB run이 생성된 19개는 `verify-batch-run.mjs`의 report/checkpoint/hash·raw/body·media readback 통과. 사전 거부 2개는 DB run이 없음을 구분했다.
- 신규 공개 31건: API GET 200, 전체 본문 TEXT/LINK 전개·블록 순서 대조. 이미지 70개는 수집 객체→게시용 정규화 hash→공개 이미지 URL 순서·hash·크기 대조 통과.
- Chromium: 목록과 5개 출처 대표 상세의 제목 표시, 대표 이미지 29개 로딩, pageerror 0. macOS sandbox의 Mach port 거부로 첫 실행이 실패했으며 승인된 sandbox 외부 실행에서 통과했다.
- 화면 캡처와 비공개 상세 검증: Git 제외 `.local-data/development/dev-21-site-publish/`의 `browser-list.png`, `browser-*-*.png`, `public-readback.json`. 원문·제목·UA 연락처·비밀 값은 Git 추적 결과 파일에 복사하지 않았다.
- Node 구문 검사·`git diff --check`·변경 문서 상대 경로 검사 통과. 이번 변경은 미커밋, push/배포 없음. 기존 untracked 4개 보존.

## 제한과 인계

- 16개 미수집 출처는 위 코드로 남았다. robots 확인 불가는 명시적 금지와 구별되지만 현행 구현은 확인되지 않은 상태에서 수집하지 않는다. 차단 우회·임의 parser 수정·대체 콘텐츠 삽입은 하지 않았다.
- max10은 발견 상한이다. 기존 중복·날짜 제외·차단 때문에 사이트마다 실제 공개 수가 적을 수 있다. DETAIL_ONLY인 PGR21·유튜브는 기존 실제 URL 1개씩만 확인했다.
- `--since 24h` + INCLUDE_UNKNOWN이므로 전체가 최근 24시간 글이라는 의미가 아니다. 원문의 게시 시각을 확인할 수 없는 글이 포함됐다.
- SNS/외부 링크는 본문에 보존했지만 외부 embed 공급자의 실제 재생은 브라우저 검증 대상에서 제외했다.
- 다음 담당: 사용자 개발 테스트. 미수집 사이트의 정책·허용 경로·parser 재검토는 별도 작업이며 기존 batch 구조안은 변경하지 않았다.
