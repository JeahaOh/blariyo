# BACKLOG 수용 감사 — 2026-09-23

정본: [BACKLOG](BACKLOG.md). 요구 범위는 축소하지 않는다. source/fixture/live/DB/object/browser/운영 증거를 분리한다.
로컬 최종 주소는 http://localhost:3000/meme 이며 운영 환경은 변경하지 않는다.

## 요구조건별 대조

| 요구조건 | 현재 증거 | 판정과 한계 |
| --- | --- | --- |
| 기존 변경 보존, commit/push/배포 금지 | 작업 전후 git status와 diff check, PROGRESS | 준수; 기존 main ahead1을 새 commit으로 집계하지 않음 |
| 기존 500 오류·긴 본문·한글 URL 해결 | API 공개 계약, public service tests, 공개71건 HTTP/본문 대조 및 브라우저71건 | 통과; 57번 긴 본문 및 이토랜드 URL 포함 |
| 목록 누락·중복 없음 | collected-content.json:4페이지/total71/unique71, Chrome 목록4페이지에서71 URL 발견 | 통과 |
| 모든 상세 화면·다중 이미지 | browser-all-posts-20260923.json:71개 상세 article 제목, 이미지266, broken/pending/overflow0 | 통과; 모든 페이지 스크린샷 육안 검사는 아님 |
| 원문 본문·이미지·외부 링크 순서 | 공개71건의 stored blocks와 batch body_blocks 순서 대조, 인벤 첨부 링크2개 브라우저 확인 | 통과; 최초 원문 parser 검증은 아래 별도 fixture/live 증거 |
| 이미지 HTTP/decode/hash/size/MIME/dimensions | verify-collected-content.mjs와 최근 결과:266개 모두 통과 | 통과 |
| private/public 참조·바이트 일치 | 같은 검사에서 DB key와 두 디렉터리 bytes/hash 대조 | 통과; 과거 private 복원은 고정 대상 복구 스크립트 사용 |
| 이미지 host와 path 분리 | public_storage_key, local media route, 환경 예시, 환경 회귀 테스트 | 통과; remote CDN/R2 실제 연결은 미검증 |
| SNS 원문 URL과 공식 임베드 | sns10/missing0, X 공식 iframe 실제 관측, social/x parser exact host/path allowlist | 로컬 통과; 모든 provider의 외부 가용성 보장은 아님 |
| collect/private 익명 노출 금지 | 공개 route prefix 검사, 404 음성 시험, FILE preview404 통합 시험 | 통과 |
| batch가 fetch/queue/collect DB/object 소유 | DirectBatchRunner/DirectUrlRunner/BatchQueueWorker, 전용 repository/object adapter, 실제 원본104건 readback | 통과; 글별 API 결과 제출 경로를 사용하지 않음 |
| API가 조회/검수/content 소유 | batch-review controller/service/repository, Local/S3CollectReader, 3000 BFF 정식 명령 | 통과; 외부 원문을 다시 fetch하지 않고 collect object만 읽음 |
| 수집 상태와 검수 상태·역할 분리 | V003/V004/V005/V006, API V008, DB guard, 제한 role 실접속 검사 | 로컬 통과; 운영 SQL 적용을 뜻하지 않음 |
| unique/optimistic lock/멱등/완료 snapshot 불변 | BatchOwnershipReadbackTests, BatchQueueReadbackTests, batch-review integration | DB 시험으로 확인; metadata 수정은 소유자 전용 V006 감사 경로 |
| 정식 조회→검수→초안→별도 발행 | 인벤 item71e37810… version3, REVIEWING→APPROVED→DRAFT111/private8/public0/공개404→PUBLISHED111 | 실제3000 API·DB/object·공개 브라우저 통과 |
| 중복 승격·동시 요청·실패 복구 | review integration의 same-key concurrent retry, corrupt object 복원, 2번째 image 실패 보상, deadline 보상 | 격리 DB 통과 |
| 서버 재시작 후 재시도 | animation-restart-replay.json:HTTP201/passtrue/동일110, actor secret 보존 회귀 | 통과; 수정 이전109 원래 요청의409는 실패 이력 유지 |
| 숨김·재발행/공개 copy 회수·재생성 | 격리 review integration publish/hide/outbox/republish, private bytes 유지 | 통과; 사용자 게시글 대량 삭제 없음 |
| 로컬 복구의 대상·백업·재실행 안전성 | repair-collected-media/labels/notice/collector-mime scripts, V006 감사 함수·manifest·백업 | 구현·실행 증거 PROGRESS; bulk reset 없음 |
| source별 Hot/일반/상세/차단 구분 | source registry와 source-collection-policy, 실제 fixture17출처, manifest chart 회귀 | 통과; 일반9출처에 가짜hot 없음 |
| 공지·광고·카테고리 제외 | etoland 실제 공지 fixture, SiteAdapter/ObservedSiteFixture tests, 공지80/81 숨김과404 | 해당 관측 구조 통과; 향후 사이트 구조 변화 감시 필요 |
| 최대5개 고유 상세 표본 | 초기 local-21-hot-run 기록과 후속 run/readback | 17출처 실제 저장 증거; 누적104건을 최신5건×21 완료율로 계산하지 않음 |
| 21출처 실제 fixture/live/readback | 후속 보고서21행, raw 해시·정제 manifest, 원본104건 재검사 | 17출처 verified-local, 4출처 외부 차단/본문 renderer 미확인 |
| 본문·이미지·첨부·SNS parser | 출처별21 synthetic pipeline + 실제36 HTML 회귀, 인벤 실제 FILE2 | fixture/실제 표본을 분리; 모든 원문에 없는 첨부/SNS 수집을 주장하지 않음 |
| canonical/source post key 중복 | inventory104건 hash/고유성, DirectBatchRunnerReadback/Queue tests | 로컬 통과 |
| 페이지/수량/기간/간격/재시도/site stop | DirectBatchRunnerTests, SourceRequestsTests, queue DB backoff/3회 상한/stop | 테스트 통과; INCLUDE_UNKNOWN은 엄격한24시간 보장 아님 |
| dry-run 무쓰기 | 실제 인벤 상세 DB12테이블/object527개 전후 hash 불변; 목록 dry-run 별도 증거 | 통과; 네트워크와 로컬 진단 보고서 생성은 발생 |
| 환경별 예시·인증·DB/object 권한 | .env.local/dev/stage/prod.example, 환경 문서/회귀, prepare/start/run wrappers | local 검증; 예시를 원격 배포 통과로 집계하지 않음 |
| 우연한 환경변수·수동 복사 없이 재현 | 고정 local wrapper, private config 생성, 일관된 actor secret, 명시 migration/build/start 문서 | local 반복 실행·재시작 검증; Windows/Docker CLI 예시는 실제 Windows 실행 증거와 구분 |
| 시작만으로 자동 공개 금지 | start-development는 조회/서버 실행, collect-url 이후 UNREVIEWED, 초안404, publish 별도 명령 | 통과 |
| compile/lint/unit/integration/parser/migration | 아래 최종 실행과 이전 직전 API/Web 검사 | 결과별 생략·실패를 별도 기록 |
| 관리자 UI 실제 검수 버튼 | 재확인한 /admin/batch는 관리자 인증 필요 화면 | 미검증: 브라우저 세션 적용 권한 제한, 사용자 로그인 필요 |
| Discord Gateway | queue/service DB 시험과 Gateway를 분리 | 미검증: 실제 연결·slash command 실행 증거 없음 |
| 원격 S3/R2 | 로컬 bytes readback와 S3 fixture adapter 시험만 있음 | 미검증: 허용된 비운영 대상·전용 역할·자격증명·접근 경로 필요 |

## 근거 파일

- [첨부·전체 브라우저·21출처 후속 보고서](../../../apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md)
- [원래3000 재검증 시점 보고서](../../../apps/collector/ops/reports/local-3000-review-2026-09-23.md)
- [실제 HTML 및 외부 차단 증거](../../../apps/collector/ops/reports/observed-fixtures-2026-09-23.md)
- [단계별 실행·수정·실패 이력](PROGRESS.md)
- 비공개 현재 원본: `.local-data/verification/collected-content.json`, `collector-inventory.json`,
  `browser-all-posts-20260923.json`, `dry-run-inven-detail.json`, `animation-restart-replay.json`.

## 외부 차단과 재개 조건

- fmkorea: 실제HTTP430 보안 페이지. 정적 공개 접근이 허용되거나 공식 수집 경로를 확인한 뒤 재개한다.
- ppomppu: 실제302→403. 공개 접근 허용 또는 공식 경로가 필요하다.
- pgr21: Anubis 연결 확인 응답, 상세 SOURCE_ACCESS_BLOCKED. challenge 없는 공개 본문 응답이 필요하다.
- youtube-community: HTTP200이나 `ytInitialData`는 responseContext뿐. 공개 본문 renderer가 있는 URL/허용 경로가 필요하다.
- 관리자UI: `http://localhost:3000/admin/batch`에 사용자 로그인 완료가 필요하다. 쿠키/토큰 값을 대화로 보내지 않는다.
- Discord/S3: 실제 테스트 환경 설정과 범위가 필요하다. 운영 DB/bucket은 이번 작업 권한에 포함하지 않는다.

같은 외부 접근·인증 조건이 최근 연속 작업에서도 해소되지 않았다. 차단을 generic parser나
인증 우회로 성공 처리하지 않는다. 이번 증거로 전체21개 수집 또는 전체외부연동 완료를 선언하지 않는다.

## 최종 실행 확인

2026-09-23 12:36 KST, Node24.18.0/JDK25:

```sh
node scripts/test-collector-readback.mjs
node scripts/test-database-roles.ts
npm run typecheck:scripts
npm run lint:scripts
git diff --check
git status --short --branch
```

- 새 임시 DB에서 Java 전체170/170 통과, 실패0/생략0. 앞선16개 환경skip은 이 실행에서 실제DB로 검증했다.
  migration 멱등/완료상태 불변/죽은소유자 차단/queue 확인 동시성/30초 지수backoff/3회상한/실패복구 포함.
  증거 `.local-data/verification/final-java-readback-suite.json` 및 `apps/collector/build/test-results/test/TEST-*.xml`.
- 별도 임시 PostgreSQL에서 역할4개 실제SCRAM, API V001–V008/Collector V001–V006 적용,
  제한 batch계정 수집·중복skip·본문/image/file/SNS·raw/media/report/checkpoint readback,
  제한 API계정 검수→초안→발행, runtime DDL·역할전환·collect/content 쓰기경계, backup 읽기전용 통과.
- backup계정 dump를 별도DB에 복원해61개 table 전체행/ledger와16개sequence 일치.
  대상은 검증 전용 자원이며 운영 자격증명·DB·bucket을 읽거나 바꾸지 않았다.
- 테스트 전용 `blariyo_collector_test_*` DB 잔존0, `blariyo-roles-*` 컨테이너 잔존0 확인.
- scripts 타입 검사/lint, 새mjs 구문검사, 상대링크 확인 및 diff check 통과.
  마지막 localhost3000 공개 API 응답200. 게시글·미디어를 추가 변경하지 않아 최종 수량71/266 유지.

## 최종 판정

로컬 수집→DB/object→검수→초안→별도발행→공개 화면의 내부 구현·데이터·설정 검증은 통과했다.
21출처 전체 live 성공, 관리자 인증 UI, 실제 Gateway·원격 object 권한까지 완료한 것은 아니므로 **전체 부분 완료**다.
같은 외부 차단이 연속된 최근3개 goal 작업에서도 남았고, 다른 내부 수정·검증을 마친 뒤에도
인증/공개 응답이 없으면 다음 실행을 완료할 수 없다. 목표를 완료로 표시하지 않고 외부 입력 대기 blocked로 종료한다.
새 공개 응답/허용경로 또는 테스트환경·관리자 로그인 준비가 확인되면 해당 미검증 항목부터 재개한다.
