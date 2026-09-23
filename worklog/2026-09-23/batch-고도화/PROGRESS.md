# Batch 고도화 진행 기록

- 목표 정본: [BACKLOG](BACKLOG.md). 범위를 축소하지 않는다.
- 시작 상태: main ahead 1, 기존 tracked 변경 18개와 untracked 설정/보고서 보존.
- 운영 변경·commit·push·배포 없음. 로컬 DB는 127.0.0.1:5439/blariyo_local.

## 수용 항목과 현재 증거

- [x] P1: 66개 목록/상세, 긴 본문/URL, 134개 private/public 정합성 복구
- [x] P1: 재실행 가능한 복구 스크립트, 사전 manifest/복구 수단, 수집 DB 대비 내용·순서 보존
- [x] P2: batch 목록/상세 조회 계약과 Web 경로, 인증
- [x] P2: API 소유 검수 migration/state/version/unique/idempotency
- [x] P2: collect object 읽기 → private 검증 저장 → DRAFT, 별도 발행
- [x] P2: 실패/재시도/중복/동시성, 격리 게시글 숨김·회수·재발행
- [ ] P3: local/dev/stage/prod DB·role·object 권한·서비스 인증·Core 주소
- [ ] P3: 문서 명령으로 재현, 실행만으로 발행하지 않음
- [ ] P4: 21개 사이트별 목록 정책·공지 제외·최대 5개 고유 상세 검증
- [ ] P4: fixture/live/DB/object 결과 및 blocked 응답·재개 조건 분리 기록
- [ ] 최종: Java/Node build/lint/unit/integration/fixture/batch/migration/dry-run 검증
- [ ] 최종: localhost:3000 브라우저 목록·상세·다중 이미지·긴 본문·SNS·pagination
- [ ] 최종: git diff --check / git status, 문서·코드 상태 대조

## 시작 시 재확인한 문제

2026-09-23 검토: 목록 66/66, 상세 61/66. 57번은 57블록/40블록 계약 충돌,
78~81번은 한글 source URL URI 검사 실패. 공개 이미지 134개 해시/크기/MIME/dimensions/디코딩 정상,
private key 파일 134개 누락. batch read OpenAPI 미등록, 기존 candidate 승격만 존재.
Web lint SiteFooter.vue:35 타입 단언 오류. 환경 예시의 DB 분리·Core 주소·SERVICE_TOKEN 불일치.

## 진행 원칙

P1 복구와 3000번 재검증을 마쳤고 P2~P4는 진행 중이다. 본문을 잘라 오류를 숨기지 않는다. 본문 계약을 1~1000블록으로 정렬하고
한도를 넘으면 원문을 잘라 저장하지 않고 명시적으로 거부한다. 블록당 문자·이미지·요청 크기 검증은 유지한다.
로컬 복구는 manifest를 먼저 저장하고 검증된 공개 이미지에서 private 사본을 복구한다.
정식 승격 구현과 검증은 P2에서 별도로 진행하며 복구 결과를 전체 완료로 취급하지 않는다.

## 3000 재검증과 추가 발견

- 상세 결과: [REVIEW-3000](REVIEW-3000.md).
- 66개 게시글/4페이지 중복·누락 0. 134개 이미지 실제 형식·전체 프레임 디코딩·hash/size/dimensions·private/public 사본 일치.
- 기존 공개 파일 6개는 실제 JPEG인데 PNG로 기록돼 있었다. media 복구에서 MIME과 확장자를 정정했다.
- 본문을 개수뿐 아니라 값과 순서로 대조하면서 링크 설명 누락 5건(42/81/91/94/102)을 추가 발견했다.
  고정 대상 labels 복구 스크립트로 복원, 반복 적용 0건, rollback/reapply 검증. 현재 379블록(245 TEXT/134 IMAGE), 수집 DB 대비 일치 66/66, SNS 9/9.
- 브라우저: 목록 1/4페이지, 긴 본문 57, 이토랜드 78, 율도 40 이미지 15/15 실제 로딩, 복구 문구 42, YouTube 공식 iframe 확인. 마지막 화면 localhost:3000/meme 유지.
- API 새 batch 검수 module/repository/reader/V008/OpenAPI가 작성됐고 격리 PostgreSQL에서 5개 통합 테스트 통과.
  REVIEWING → APPROVED → DRAFT → 별도 발행 → 숨김 → outbox 회수 → 재발행, checksum 오류/동일 요청 재시도/버전/멱등성 검증.
- **현재 지속 개발 DB는 V006**. V008 적용·실제 수집물 정식 승격·3000 운영자 화면/명령 연결은 아직 남았다. isolated 테스트를 dev 적용 완료로 표시하지 않는다.
- API unit 20, 이번 통합 test 12, media repair unit 1 통과. API/Web lint 및 Web typecheck 통과.
- Java 일반 실행 95개 중 93 통과/DB 조건 2 skip. 이어서 별도 임시 DB를 만들어 해당 migration/readback 2개를 실행해 통과(임시 DB 회수). 누적 고유 95개 실행 통과.
- 일부 site adapter의 20개 초과 이미지 조용한 누락 옵션을 제거했고 img/background image 한도 초과 실패 테스트 통과.
- 환경 예시의 API SERVICE_TOKEN 누락, dev/stage Core 자기호출 URL, API/batch 서로 다른 database 표기를 정정했다. 실제 role/remote object 권한 검증은 남았다.

## 재개할 내부 작업 (외부 차단으로 분류하지 않음)

1. P2 상세/목록 DTO에서 손상된 단일 item이 전체 목록을 막는지, batch 재수집과 review snapshot/version 경쟁 검토·테스트.
2. P2 object reader 자체의 S3/경로/크기 테스트, 중간 이미지 실패 시 보상, 동시 승격, source post key 중복 테스트 추가.
3. private 신규 업로드가 아직 staging/*인 부분을 content/private/*로 정렬하고 cleanup/legacy 호환 테스트.
4. 검증된 local DB 백업 후 V007/V008 적용, batch reader root 명시, 정식 관리자 조회·검수·초안/발행을 실제 3000 서비스 경로로 재현. 현재66개와 새 샘플 중복 생성 금지.
5. P3 역할별 실제 grants, 재현 가능한 CLI/관리자 화면, 원격 R2 readback 증거 분리.
6. P4 이토랜드 공지 80/81의 발견 당시 목록 fixture에서 공지 row ancestor를 확인해 제외 규칙 검증. 기존 공개 데이터는 자동 삭제하지 않는다.
7. P4 이미지 truncation 제거 후 21개 사이트 live/fixture/DB/object 재검증. 기존 FETCHED만으로 무손실 보존 판정 금지.
8. 본문 일반 URL은 현재 TEXT로 보존되며 SNS 외에는 클릭 가능한 링크로 렌더링되지 않는 부분 검토.

## 최신 재검증 반영 (2026-09-23)

위 V006/신규 staging 미정렬 설명은 당시 기록이다. 현재는 개발 DB 백업 후 V008 적용,
API/batch 제한 role 및 지속 collect object root 준비, 최신 서버 3000/3100 재시작까지 진행했다.
공개66건/이미지134건 전수 readback 실패0, 인증된 batch 목록·상세66건 정상, 인증 없는 요청401.
관리자 preview는 133/134 성공, GIF257프레임 1건은 기존 신규 업로드200프레임 제한으로413이다.
새 실수집물의 개발 DB 정식 검수·초안 승격은 아직 실행하지 않았고 batch_review는0행이다.
API unit22와 격리 통합14개 재실행 통과. 상세·남은 코드 검토는 [REVIEW-3000 최신 절](REVIEW-3000.md#최신-빌드-재시작-후-추가-검증-2026-09-23)을 따른다.
P2 전체, P3 원격 환경, P4 사이트별 live 수용 조건은 계속 미완료이며 기존 체크박스를 완료로 바꾸지 않는다.

## 정식 흐름 실제 실행 후 상태 (2026-09-23, 위 기록 이후)

- P2 증거: [P2-LIVE](P2-LIVE.md). 새 실수집물2건을 API 검수/승인/DRAFT/별도 발행했다.
  새 공개104는 SNS 링크,105는 이미지3개 원문이다. 기존66건은 보존했다.
- 현재 공개68건/이미지137개/본문68건/SNS10개, 목록4페이지 고유68건, 전수 readback 실패0.
  3000 브라우저에서105 이미지3/3 로딩,104 X 공식 iframe,42 일반 외부 링크 클릭 가능 확인.
- batch 공통 요청 간격·retry/backoff·site stop·source 동시 실행 잠금·미완성 재실행·FETCHED 중복 skip 보강.
  API R2 자격 증명 fallback 제거, source별 limits 적용, 실제 source host 저장.
- Java103개 전체를 고유 임시 PostgreSQL 연결 상태에서 실행: pass103/fail0/skip0, bootJar 성공.
  Web 링크 테스트2/typecheck/lint/build 통과. API P2 테스트 결과는 API source 변경 없는 앞선22 unit/14 integration 증거를 사용한다.
- 율도 신규5건은 FETCHED/DB/raw/report readback 통과(일반 목록; SNS 원문 링크 중심, 이미지0).
  goodgag 신규5건 중4 FETCHED/1 FAILED(SOURCE_TOO_LARGE), collect 이미지5개 bytes/hash/decode readback 통과.
  성공으로 바꾸지 않았으며 해당5건 실행은PARTIAL이다.
- P3 local role/지속 root/CLI 문서 정렬. 실제 remote R2 권한/readback, Windows/Docker 실행은 아직 별도 미검증.
- P4: 전체21사이트 분류와 실제 list/detail fixture 재검증, 공지 제외, 날짜 미확인 처리, batch 상태 DB 제약/소유권 fencing,
  실패 전 item 등록·checkpoint/report 테이블 활용을 계속 점검한다. 이들은 내부 후속 작업이며 외부 차단으로 묶지 않는다.
- 현재 서버는 최신 Web 빌드로3000/3100 실행 중. commit/push/배포 없음.

## GIF 제한·출처 분류·실행 중 재빌드 보강 (2026-09-23)

- 직전3000 검토는 진행 증거다: 공개68/이미지137/본문68/SNS10/4페이지68고유 전수통과.
  외부21개를 새로 성공 수집한 증거로 사용하지 않는다.
- 수집 전용 이미지 검증을 preview와 private 승격에 공통 적용했다. 일반200프레임 제한은 유지,
  수집500프레임/전체64Mi픽셀/RGBA256MiB/파일10MiB로 제한한다. GIF 중복프레임도 보존한다.
  실제43번 GIF preview200, 원본/응답257프레임·delay·loop 일치, 전체디코딩 통과.
- API unit24 통과, 격리 batch-review9 통과(257프레임 preview→승인→DRAFT→private readback 포함),
  runtime operations5 통과. Web typecheck/lint/build, API build/lint 통과.
- Java 전체109개 pass/fail0/skip0: 고유 임시 PostgreSQL 생성·테스트·회수로 실제DB 조건 테스트 포함.
- 일반9개 목록을GENERAL_LIST/latest, 상세전용2개, Hot8개, blocked목록후보2개로 분리한 설정에
  planning source policy·validation·system design·spec을 정렬했다. 시각미확인 INCLUDE_UNKNOWN 의미도 명시했다.
- 더쿠 실제HTML에서 img-cdn.theqoo.net 원문 이미지2개를 확인해 정확한 host만 허용하고 관측 최소fixture/provenance를 추가했다.
- 디시HIT 첫표본 본문49이미지:20개 제한을 넘는다. 일부삭제 없이 SOURCE_IMAGE_LIMIT_EXCEEDED로 구분한다.
  삭제·개별글 크기/본문/이미지 제한은 site 구조오류3건 중단 카운트에서 제외하고 maxItems 내 다음글을 검사한다.
- 중단 report의 fetched/날짜 checkpoint 누락 수정, readback은 failure 행 개수도 report와 대조한다.
- 더쿠 장시간 실행 중 bootJar 재빌드로 nested JAR 클래스 로딩이 실패했다. run-batch 실행파일 사본을 도입했다.
  종료된 실행 c8fd954c-9f0e-4f4c-9daa-e036fbfb0008은 다음 source lock 확보에서 BATCH_OWNER_LOST로 기록됨.
  이미FETCHED 행은 보존하며 미완성행만 재시도한다. 기존 실패이력을 성공으로 수정하지 않았다.
- 아직 남음:21개 실제목록/상세fixture·최대5개 저장전체검증, batch DB fencing/state제약,
  fetch/parse이전item상태등록, checkpoint/report별도테이블 활용, 전체 dry-run 무쓰기 재검증,
  admin 실패안내 실제브라우저, 실제원격S3/Windows/Docker/Discord 증거. 내부작업이 남아 목표완료 아님.

### 이번 Hot 5건 실행의 확정 결과

- 더쿠 최종 run `7f4e880d-b940-46bd-9b19-489ed00f762f`: COMPLETED, discovered5/fetched1/duplicates4/failures0,
  unknownDates5. 날짜 미확인이므로 최근24시간5건 성공이라고 부르지 않는다.
  앞선 실행에서 보존된 항목을 포함해 현재 theqoo5건/이미지4개를 독립 readback했다.
  canonical hash·본문IMAGE 위치·DB media 개수·raw 존재·media hash/size/전체decode 모두5/5 통과.
  `.local-data/verification/theqoo-source-five.json`, 최종run report/readback 파일 참조.
- 디시 run `a6286f76-00ee-414a-9c70-98a7a75c0dfb`: BLOCKED, discovered5/fetched1/failures4.
  17809/17808/17807은IMAGE_LIMIT,17806은14블록/10이미지FETCHED,17805는SOURCE_NOT_ALLOWED.
  raw/media10/report와failure4행 대조 readbackPass=true, collectionComplete=false.
  17805 실제HTTP200 HTML을 `.local-data/site-probes/dcinside/1790123611540-detail.html`에 확보했다.
  body영역의 추가CDN과일반광고host를 구분해정확한origin정책보강이 내부후속이다. 접근차단으로확정하지않는다.
- 17809의 실제write_div49이미지/lazy구조를 축소한 observed fixture와 provenance 추가.
  109개 전체Java테스트 후 이추가회귀테스트를포함한ManualSiteAdapterTests 재실행통과.
- 기존공개68개는그대로이며새수집물을자동승격/공개하지않았다. 수집FETCHED사이트는15→17개다.
- 실패run `eb617188-873e-4319-b4c3-08b9223e8da2`의구버전checkpoint누락과
  `c8fd954c-9f0e-4f4c-9daa-e036fbfb0008`의강제종료report미작성은과거실패증거로보존했다.
  새run 정상report검증으로과거실행을성공으로소급하지않는다.

- 최종 율도 dry-run: COMPLETED/exit0, collect 수집·검수9테이블 전체행 hash 및261개object파일hash
  전후동일. 재실행명령 `node scripts/local/verify-dry-run.mjs yuldo`와JSON증거를저장했다.
- 최신서버3000/3100재시작 후목록68/이미지137/본문68/SNS10 전수readback통과,
  브라우저43번GIF포함4/4이미지표시, 마지막localhost:3000/meme목록20개/콘솔오류0 유지.
- 다음우선순위:dcinside17805 body의미허용CDN검토, 나머지출처5건·fixture검증,
  batchDB상태/fencing와시작전실패item기록. 실제admin오류안내UI와remote환경증거도남아있다.

## Collector V003 실행 소유권·report/checkpoint (2026-09-23)

직전3000 재검토는 새로운 근거를 얻은 진행 턴이었다: 공개68/이미지137 전수 통과와 함께
분리된 잠금/쓰기 연결, item 없는 실패25/26, report/checkpoint0행을 현재 코드·DB에서 확인했다.
이번에는 그중 실행 소유권과 report/checkpoint를 실제 수정·검증했다.

- BatchStore는 source session advisory lock을 잡은 동일 물리 DB 연결만 빌려 쓴다. 연결 상실 시
  다른 pool 연결로 이어 쓰지 않는다. 네트워크 동안 transaction을 열어두지 않는다.
- runner의 예외 처리도 잠금 해제 전 실행한다. 새 media object key에 runId를 포함해 이전 실행의
  늦은 PUT과 새 실행의 파일을 분리한다. 기존 key는 조회 호환을 유지한다.
- 신규 Collector V003: source별 RUNNING unique, owner backend, 상태/version/source/잠금 guard,
  완료 run/FETCHED item/media 불변, run 종료 시 report/checkpoint 요구. V001/V002 checksum은 보존했다.
- report key/hash/JSONL행 수, checkpoint 진행 상태와 run 종료를 동일 transaction에 기록한다.
  verify-batch-run은 V003 run의 실제 report object와 ledger/checkpoint를 필수 대조한다.
- 실제 PostgreSQL에서 연결 강제 종료→이전 소유자 쓰기 거부→새 소유자의 미완성 item 회수,
  무잠금/잘못된version/불법상태/완료snapshot 변경 거부, report transaction rollback을 검증했다.
  재시도 이전 object bytes는 그대로이고 새 media는 새 run prefix에 저장되는 것도 확인했다.
- 고유 임시DB에서 Java 전체112개 pass, fail0/skip0, bootJar 통과. 임시DB는 테스트 후 제거했다.
- local prepare는 이제 Collector V003/API V008을 함께 명시 적용한다. 실행 순서는 API/Collector build→
  prepare→서버/CLI다. 운영 문서의 legacy Core 전송 경로와 direct DB 경로를 구분했다.
- 개발 DB 실행중 batch0 확인 후 백업 `.local-data/backups/before-batch-review-1790124513939.dump`를
  생성하고 V003 적용. 기존 collect media153개 readback 및 API/batch 제한 role 검증 통과.
- 실제 아카라이브 run `cc1aea19-9a4e-4a59-bc9a-9ca6da66d12a`: COMPLETED, 발견1/FETCHED1/중복0/실패0,
  날짜미확인0. 원문·본문·이미지1·report hash/ledger/checkpoint readback 모두 통과.
  `.local-data/verification/batch-run-cc1aea19-9a4e-4a59-bc9a-9ca6da66d12a.json` 참조.
- 공개3000 전수검증은 여전히68글/137이미지/68본문/10SNS/4페이지68고유, 실패0. 자동승격/공개 없음.

남은 내부 작업: 상세 fetch 전 item 등록과 실패·날짜제외 상태, Discord batch queue 소비 경로 검증/연결,
21개 사이트 최신 fixture·최대5건 저장 검증(디시 미허용 본문CDN 포함), 관리자 실패안내 브라우저 검증.
원격S3/Windows/Docker/Discord Gateway는 별도 미검증이다. 목표 전체 완료로 표시하지 않는다.

- V003 이후 율도 dry-run 재실행: COMPLETED/exit0, collect·검수9테이블 및264object파일
  전후hash동일. 새 migration/소유권 제약이 dry-run 무쓰기 계약을 깨뜨리지 않았다.
- Git diff --check 및 수정 Node 스크립트 문법검사 통과. main 기존 ahead1과 기존 변경 보존.
  이번에도 commit/push/배포 없음.

## Collector V004 개별 실패·기간 제외 저장 (2026-09-23)

이전 V003 턴은 코드/migration/실제 아카라이브 저장과 readback을 완료한 진행 턴이었다.
이번에는 fetch/parse 이전 item 등록, 실패 추적과 기간 제외 상태를 구현했다.

- 목록과 수동 URL 모두 먼저 canonical/source post key로 FETCHING claim한다. 완료된 중복은
  상세 요청 전 건너뛰고, fetch 성공 원문은 parse 전에 저장한다. 실패는 item 상태와 phase/code에
  기록하며 raw가 있으면 실패 이력에도 rawObjectKey를 보존한다. 과거 item 없는25건은 소급 수정하지 않았다.
- V004에서 SKIPPED_POLICY/skip_reason을 추가했다. 날짜 미확인 strict 정책은 SOURCE_DATE_UNKNOWN,
  기간 밖은 SOURCE_OUTSIDE_WINDOW다. 실패 건수에는 더하지 않고 정책 변경 시 재검토할 수 있다.
- API 목록/상세에 failureCode/skipReason, Web 검수 화면에 상태/사유 안내를 추가했다.
  진단용 필드는 기존 검수 snapshot digest에 추가하지 않아 무관한 metadata 변경이 승인 내용을 바꾸지 않는다.
- 격리 PostgreSQL에서 네트워크 요청 당시 FETCHING 존재,404실패/빈본문parse실패의 item·phase·raw,
  동일ID 재시도, FETCHED 중복의 무네트워크 처리, 날짜제외/정책변경 재수집을 검증했다.
- Java 전체115 pass/fail0/skip0 및 bootJar 통과. API unit24, batch-review integration10 통과.
  API/Web lint, Web typecheck/build, API build, 계약 생성 통과. API 통합fixture는 손상 주입을 위해
  ownership trigger를 제외하며 실제 V003/V004 trigger는 Collector PostgreSQL 테스트에서 따로 검증한다.
- 개발 DB 백업 `.local-data/backups/before-batch-review-1790125021878.dump` 후 V004 적용.
  checksum 일치, 기존 media154개 readback 및 제한 role 검증 통과.
- 디시 실제URL `https://gall.dcinside.com/board/view/?id=hit&no=17809`: run
  `7ab4d22f-e610-478b-ad49-1ac48c2f9759`, FAILED/SOURCE_IMAGE_LIMIT_EXCEEDED, item1/failure1,
  raw보존/phasePARSE/report/ledger/checkpoint readbackPass=true. 수집 성공으로 처리하지 않았다.
- 더쿠 `https://theqoo.net/hot?page=2` 최대1건과 REQUIRE_KNOWN의 별도 로컬설정으로 run
  `4604b222-a463-4f1a-bff3-107d88923fde` 실행: discovered1/fetched0/unknownDates1/skippedByDate1,
  item SKIPPED_POLICY/SOURCE_DATE_UNKNOWN, 실패0. raw·report·ledger·checkpoint readback 통과.
  executionComplete=true지만 collectionComplete=false다. 전체기간제외를 수집 성공으로 부르지 않는다.
  설정은 Git 제외 `.local-data/verification/theqoo-strict-sources.json`; 공유source설정은 변경하지 않았다.
- 실제3000 관리자 API에서 두 item의 상태·사유와 DB 일치 HTTP200.
  `.local-data/verification/v004-admin-readback.json`에 비밀 없는 수치만 저장했다.
- 최신 Web/Core를3000/3100으로 재시작하고 브라우저 목록을 새로고침했다. 공개 전수검증은
 68글/137이미지/68본문/10SNS/4페이지68고유 실패0. 기존 공개/승인 데이터 자동 변경 없음.
- V004 이후 율도 dry-run:9테이블/268object 전후hash동일, COMPLETED/exit0.

다음 내부 우선순위: Discord confirmation→batch QUEUED의 소비 실행기 연결·재시도/중복 접수,
21개 사이트 최신실수집/fixture·최대5건(디시17805 추가CDN 포함), 관리자 실패안내의 인증된 브라우저 조작.
Gateway 실연결/원격S3/Windows/Docker 증거는 별도다. 전체 목표는 진행 중, commit/push/배포 없음.

## Collector V005 Discord confirmation → durable queue → direct runner (2026-09-23)

직전 3000 재검증 턴은 공개68글/137이미지·관리자85item/154preview의 현재 상태를 확인하고,
Discord가 새 queue에 등록하지만 legacy 실행기가 다른 테이블을 읽는 결함을 확정한 진행 턴이었다.
이번에는 그 단절과 confirmation의 중간 실패 구간을 실제 구현으로 수정했다.

- V005: batch 소유 `batch_confirmation`, `batch_queue` 추가. 공개 canonical URL과 actor/channel/interaction
  HMAC만 저장하며 raw Discord ID/token은 저장하지 않는다. confirmation 유효기간10분, 확인 전 queue/run/item/object 없음.
  확인 transaction이 queue 등록과 receipt 연결을 함께 commit한다. 재전송은 동일 request ID를 반환한다.
- request ID와 실행 run ID 분리. worker는 기존 source session advisory lock을 공유하며 매 attempt 새 run/prefix 사용.
  중단된 RUNNING은 기록을 보존하고 회수한다. run 완료 뒤 queue 확정 직전 중단되면 fetch 없이 완료를 반영한다.
  상태/version/소유권/active 원문 중복/동일 source RUNNING 1개/terminal 불변은 DB trigger·constraint로 보장한다.
- 네트워크/DNS/일시 서버 장애와 owner 상실은 최대3회,30초·60초 backoff. 차단/삭제/parser/크기/rate-limit은
  자동 재시도하지 않는다.403/정책/rate-limit 뒤 동일 source 다른 요청도15분 유예한다.
- DiscordGateway의 CoreClient/legacy confirmation/spool 의존을 접수 경로에서 제거했다. `/collect status`도
  batch queue를 조회한다. `QueueMain`은 Spring context/Core/Quartz 없이 Gateway+worker 또는 worker만 실행한다.
  `queue --once --write-db`, `queue --write-db`, `discord --write-db`가 같은 macOS/PowerShell/Docker 진입점을 사용한다.
- API grant/readiness는 private queue/confirmation을 제외한다. API role의 SELECT도 거부하고 batch role만 접근한다.
  환경예시5개·실행문서·설계/명세·Gateway checklist를 맞췄다. 설계 도입부의 legacy API 중심 설명도 구분했다.
- 새 PostgreSQL 테스트: 확인 전 무수집,12개 동시 confirmation 동일ID,다른 사용자/만료/정책철회 거부,
  receipt 저장 실패의 queue rollback과 동일확인 재시도,본문/image/file/SNS/report readback,
  다른 PC source lock skip,terminal/version/무잠금 mutation 거부,중단복구/완료run 무fetch 복구,
  실제30초·60초 backoff와3회 제한,site stop을 검증했다. trigger를 끄지 않고 실제 대기시간을 검증했다.
- 최초 테스트3실패는 공유 canonical URL 때문에 다른 test가 중복 제외된 fixture2건과 PostgreSQL boolean
  문자열`t`의 기대 표현1건이었다. 각 test URL을 분리하고 의미를 유지해 수정했다.
- Java 전체123개 pass/fail0/skip0 후 receipt rollback 추가1개 pass(현재 총124케이스).
  CLI 옵션 테스트 재실행,compile/bootJar/fixtureClasspath 통과. API build/build:test/lint/unit24,
  migration/권한1,검수·승격 통합10 통과. 테스트DB는 생성한 것만 finally로 제거했다.
- 로컬 수집RUNNING/QUEUED0 확인 후 백업 `.local-data/backups/before-batch-review-1790126247217.dump`.
  V005 적용 및 기존154media readback 통과. API confirmation SELECT=false,queue UPDATE=false,
  batch queue UPDATE=true를 실제 제한 role로 확인했다.
- `verify-queue-intake.mjs https://arca.live/b/live/183808317`로 실제 접수 서비스 실행.
  confirmation `9cbfce05-e080-4d62-94c4-0b04814159d3`,request `eb84bf84-7f7b-400c-beda-52f3b1eb19ba`.
  확인 전 queue 수 불변·동일확인 재전송 동일ID. 검증용 HMAC이며 실제 Gateway interaction이 아님.
- `run-batch.mjs queue --once --write-db` 결과 run `f18a2ef9-ee5d-4c1f-85d0-e4575787f454`:
  request COMPLETED/attempt1,run COMPLETED,item FETCHED,본문2블록/image1,실패0.
  raw/본문/image해시·디코딩/report ledger/checkpoint readbackPass=true,collectionComplete=true.
  `.local-data/verification/queue-intake.json`, `batch-run-f18a2ef9-ee5d-4c1f-85d0-e4575787f454.json` 참조.
- 3000 관리자API에서 새 item `d9e513cf-d543-489c-8630-241fe732a4e5` HTTP200,UNREVIEWED,
  이미지preview HTTP200/image/jpeg/68,585bytes. 자동승격/발행 없음.
  `.local-data/verification/v005-admin-readback.json` 참조.
- 최신API/Web 재시작: 현재실행 session58959,3000/3100. 공개전수68글/137이미지/68본문/10SNS/4페이지68고유 실패0.
  실제 브라우저3000 reload 목록20건 확인. collect현재83FETCHED/2FAILED/1SKIPPED_POLICY,queue완료1,수집RUNNING0.
- queue 두 번째실행 IDLE. 율도dry-run COMPLETED/exit0,queue/confirmation 포함11테이블과271objects 전후hash동일.
- 실제 Gateway·명령등록·Windows/Docker·원격S3 실연동은 미검증이다. 이번 queue 실수집을 Gateway 완료로 세지 않는다.

다음 내부 작업:
1. `deploy/postgresql/apply-privileges.sql`의 collect 전체쓰기/default grant가 현행 batch/API 소유권과 충돌한다.
   로컬 TypeORM grant는 이번에 제한했지만 별도 운영 provisioning SQL도 정렬하고 격리환경에서 검증해야 한다.
2. 21개 사이트 최신 fixture·지원 목록 최대5건 실수집(디시17805 본문CDN,goodgag 크기 제한 등).
3. 인증된 관리자 브라우저의 실패안내/검수 조작,첨부 실제공개사례와 사이트별 증거표 갱신.

전체 BACKLOG 목표는 진행 중이다. 기존 변경 보존,commit/push/배포 없음.


## 2026-09-23 운영 provisioning 권한 정렬 및 제한 역할 통합 검증

직전 턴은 3000 화면/API/DB/object 전수 재검증으로 운영 SQL의 과도한 collect 권한을
확정한 진행 턴이었다. 이번에는 해당 차이를 실제 source/config/test로 수정했다.

- 운영 `apply-privileges.sql`: API collect 쓰기를 10개 API 소유 테이블의 명시 허용 목록으로 전환.
  batch 결과 7개 SELECT만, queue/confirmation 접근 금지. 새 collect table/sequence/function은
  API/batch에 자동 허용하지 않는다. content/legal 기존 기본 권한은 유지한다.
- batch role: batch 결과7 + queue/confirmation에 SELECT/INSERT/UPDATE, media에만 DELETE.
  content/legal/ops/API 검수와 Collector framework schema 접근 금지. trigger의
  `assert_source_owner(text)`, `assert_run_owner(uuid)` helper EXECUTE만 명시 부여.
- backup: content/legal/ops/collect/collector/batch/quartz 7개 schema의 기존·향후 테이블과
  sequence/ledger SELECT. migrator 단독 DDL 소유권을 검증하고 PUBLIC 실행 권한을 회수한다.
- `create-batch-role.sql`, `create-roles.py --batch-only`: 기존3역할/비밀번호를 변경하지 않고
  batch login만 추가. 재실행 거부, 동일 디렉터리의 기존 비밀번호 재사용 거부.
  HBA는 기존 사설/내부 연결 규칙에 batch login만 추가하며 host port를 새로 열지 않는다.
  install payload에 SQL 포함, 초기 설치는 기존3역할만 생성한다.
- API `collect-ownership.ts` 허용 목록을 grant/readiness에서 사용. 미래 collect 테이블은
  권한을 얻지 않으며 관련 없는 테이블 때문에 readiness가 실패하지 않는다.
- `BatchRoleFixtureMain` / `test-database-roles.ts`: 실제 API V001–V008와 Collector V001–V005를
  제한 migrator로 적용. 별도 Java 프로세스가 제한 batch 계정으로 real pipeline을 실행한다.
  외부 HTTP만 합성 transport이고 DB trigger/owner lock/object 저장은 실제 실행이다.
  body/image1/file1/SNS1/raw/report/checkpoint hash readback, 두 번째 실행 중복 skip을 확인했다.
- 같은 isolated DB의 제한 API 계정으로 REVIEWING → APPROVED → DRAFT/private1/public0 →
  별도 발행/private-public bytes 일치를 검증했다. batch 결과는 FETCHED로 보존된다.
- 4역할 SCRAM 접속, 잘못된 비밀번호·관리자TCP·다른DB·역할전환·DDL 차단,
  API batch수정/queue조회/helper실행 거부, batch content/검수조회 거부를 확인했다.
  새 collect table/sequence는 거부되며 운영 ACL+API grant 재적용 후에도 거부된다.
- backup role pg_dump 후 별도 DB restore: 60개 테이블 전체 행/ledger와 16개 sequence 일치.
  `--no-owner --no-acl` 복원이므로 복원한 서버의 운영 소유권 설정 증거로 확대하지 않는다.
- 초기 fixture실패는 userAgent의 필수 contact 표기 누락(SOURCE_CONFIG_REQUIRED)이었다.
  fixture 설정을 수정하고 전체 역할 검사를 재실행해 통과했다. 검증기/정책을 완화하지 않았다.
- 추가 검증: API migration down/up/readiness 통합1, API unit24, Java testClasses/fixtureClasspath,
  API lint, scripts lint/typecheck, Python3파일 compile 모두 통과.
  `deploy/postgresql/test-setup.py`: linux/amd64 Compose 초기설치/재실행/컨테이너 재생성 후
  데이터·기존3역할 보존 통과. batch Windows/원격S3 실연동 증거는 아니다.
- 로컬 준비 스크립트에도 같은 batch DELETE/helper 경계를 적용.
  running0/pending0 확인 → 백업 `.local-data/backups/before-batch-review-1790127165158.dump`
  → API V008/Collector V005 재적용(기존 checksum 유지) → collect media155 hash/size readback 통과.
  실제 로컬 API: item UPDATE=false,queue SELECT=false,content UPDATE=true,helper EXECUTE=false.
  batch: item UPDATE=true,queue SELECT=true,content UPDATE=false,run DELETE=false,media DELETE=true.
- 개발 서버 기존 session58959 정상종료 후 새 session67769 (3000/3100)로 재시작.
  queue --once --write-db IDLE/exit0. 공개전수68글/137이미지/68본문/10SNS/4페이지68고유 실패0.
  실제 브라우저 localhost:3000의 상세67번 본문/이미지9개 AX 확인. 사용자 열람 위치를 유지했다.
- 명령: `npm run test:database-roles`, `python3 deploy/postgresql/test-setup.py`,
  `npm run build:test -w @blariyo/api`, 격리 DB `migrations.integration.test.js`,
  `npm run test:unit -w @blariyo/api`, `npm run lint -w @blariyo/api`, `npm run lint:scripts`,
  `npm run typecheck:scripts`, `node scripts/local/prepare-batch-review.mjs --apply`,
  `node scripts/local/run-batch.mjs queue --once --write-db`,
  `node scripts/local/verify-collected-content.mjs`.

다음 내부 작업은 사이트별 최신 실제 fixture/지원 목록 최대5건/readback 증거표와
인증된 관리자 브라우저 검수/실패안내, 실제 공개 첨부파일 사례 검증이다.
BACKLOG의 사이트 기준은 지원 가능한 목록에서 최대5건이며, 상세전용/외부 차단은 분리한다.
앞선 간단 보고의 '21개 사이트 × 5건' 표현으로 그 범위를 일괄 필수로 바꾸지 않는다.
운영 DB/bucket/server는 변경하지 않았고 commit/push/배포도 하지 않았다. 전체 목표는 진행 중이다.


### 같은 턴 후속: 실제 목록 4개·제한 역할 write-db 재검증

- dcinside/todayhumor/yuldo/dmitory 실제 목록 HTTP200, 상세 URL47/30/15/20개 추출.
  각 raw HTML/hash는 `.local-data/site-probes/20260923-role-followup.json`에 보존.
- 관측 디시17805 본문의 dcimg5.dcinside.com/dccon.php 누락을 확인하고 해당 image path prefix만
  config에 추가. `dcinside.dccon.observed.html` 최소 구조/provenance 및 허용·거부 회귀 추가.
  SiteAdapterTests13개, source config2개 pass, bootJar 통과. 미확인 CDN을 wildcard로 허용하지 않았다.
- 목록1page/최대5items/24h/write-db 실행:
  dmitory run53d83bab-7e61-4ebf-bb38-012bf672b263 COMPLETED 신규5/image5/fail0.
  yuldo runb9c302ac-c4b9-44cb-bab7-4548e431db1a COMPLETED 신규4/duplicate1/image6/fail0.
  todayhumor run1c67d17d-19e9-4748-a501-5ca64633597c PARTIAL 신규1/duplicate3/image4/fail1.
  dcinside runfb597d66-d042-4cf4-a2ba-fcd7930af028 FAILED 신규0/duplicate1/fail4.
- 4run 모두 raw/item/media/report hash/checkpoint/failure readbackPass=true.
  todayhumor1797973 및 dcinside17809/17808/17807/17805는 SOURCE_IMAGE_LIMIT_EXCEEDED.
  내부 이미지20장 한도이며 외부 접근 차단이 아니다. 전체 수집 성공으로 표시하지 않는다.
- 실제 제한 batch role로 저장한 신규10건/image15건 확인. 자동 발행 없음.
  현재 collect FETCHED93/FAILED6/SKIPPED_POLICY1,image170,RUNNING0; 공개68건 유지.
- 상세 보고 `apps/collector/ops/reports/local-role-followup-2026-09-23.{md,json}`.
- 다음 내부 우선 작업: 관측한 이미지 많은 글을 자르지 않고 처리할 수 있도록
  collector detail/media 한도와 API 검수·승격의 이미지 수 한도를 함께 설계/구현/검증한다.
  원문 전체 보존/개별파일·전체용량/요청간격의 자원 한계를 명시하며 조용히 제한을 제거하지 않는다.
  이후 나머지 사이트 실제 fixture/최대5건/readback, 관리자 브라우저와 실제 첨부파일 검증을 계속한다.


### 2026-09-23 다중 이미지 한도 정렬 (진행)

- 이전 goal turn은 3000번 UI/DB/object 전수 검증으로 내부 한도 불일치를 확정한 progress다.
- 정본을 먼저 갱신: direct batch 이미지 200개/파일 30MiB/글 전체 150MiB, 첨부20개,
  원문1000블록. site mediaLimits 설정은 낮추기만 가능. 일반 업로드10MiB/10개/100MiB 유지.
- SourceMediaLimits + ArticleMediaBudget 추가. 목록/manual runner 모두 이미지·첨부 누적량을
  다음 파일 요청 크기에 반영하고 object 쓰기 전에 거부. 글 용량 오류는 site stop에 누적하지 않는다.
- API 수집 입력30MiB/출력30MiB/출력합계150MiB, 전체 원본media합계 사전 검사,
  기존 partial private 보상 경로 유지. direct BatchContentBlock과 legacy CollectionContentBlock 분리.
  Core EditBlocks/editor200장 동기화. 수집 시 조용한20장절단 제거(legacy metadata 계약은 유지).
- SourceMediaLimitsTests는200장 순서/201장 거부/낮은source상한/잘못된설정 거부를 검증.
  MediaBudgetRunnerTests는 첨부 포함 누적량/초과파일 무쓰기/다음 글 fresh budget/manual 실패를 검증.
- Java 전체129개 중113통과/16DB환경skip. 별도 임시DB DirectBatchRunnerReadback+Lifecycle5개 통과.
  새 todayhumor observed fixture 추가 후 해당2개 테스트 별도 통과.
- API 격리통합12개 통과:49장 검수→DRAFT→별도발행,미디어총량 초과 사전무쓰기,
  기존checksum오류복구/멱등동시재시도/숨김재발행/GIF보존 포함. API수집이미지단위3개통과.
- Node24.18.0으로 API/Web build/lint/typecheck,Web/config5개,root26개,tests lint/typecheck 통과.
  root 과거기준선 검사를 현행추가계약과 분리: 원본contract-baseline.json 유지,
  contract-evolution.json에 변경OpenAPI/생성물 원래/현재해시와 추가migration해시 기록.
  테스트는기존SQL불변/신규API·Collector migration전수목록/계약사본일치를 모두 검사한다.
- local 백업 `.local-data/backups/before-media-limits-20260923.dump` 확보.
  서버는Node24.18.0으로 재시작(session33613),3000/3100유지.
- todayhumor1797973 재수집run a3ac4fde-19e8-433f-acd8-d8a7d1841dd6 COMPLETED/image21,
  raw/media/report/DB readbackPass=true. 실제 `.viewContent` img[src]21개를 최소회귀fixture로 저장,
  원본SHA와fixtureSHA는 todayhumor.gallery.observed.provenance.json.
- 정식 API REVIEWING→APPROVED→DRAFT(private21/hash일치,public없음)→별도발행 post106.
  localhost:3000/meme/posts/106 브라우저21이미지모두로드/가로넘침없음.
  공개전수69글/158이미지/69본문/SNS10/목록4페이지 오류0.
- DCInside17809 재수집run a0500dfe-5e97-4621-8442-3c1a5b780cac 진행중(session39290).
  본문143블록 파싱,마지막조회IMAGE38. 실제완료/readback/승격/브라우저는 아직완료로표시하지않는다.
- 다음: 이DCrun 확인→readback→정식초안·발행→3000브라우저→dry-run snapshot무쓰기.
  잔여DC17808/17807/17805,goodgag큰파일,나머지사이트전수/실제첨부/관리자UI 등 BACKLOG목표는계속활성이다.

#### 같은 작업의 후속 완료 증거

- DCInside run a0500dfe-5e97-4621-8442-3c1a5b780cac COMPLETED/1글/49이미지/실패0.
  readbackPass·executionComplete·collectionComplete 모두true.
- DCInside dry-run: collect11테이블/object379개 hash무변경,exit0/COMPLETED.
- 정식 REVIEWING→APPROVED→DRAFT(private49/hash일치/public없음)→별도발행 post107.
  3000브라우저49/49이미지로드,원문143블록의텍스트·링크순서보존,390px가로넘침없음/console오류없음.
- 최종공개전수70글/207이미지/70본문/SNS10/4페이지 오류0. 공개출처16개.
  collect FETCHED95/FAILED4/SKIPPED_POLICY1,image240(다음재수집시작직전).
- 상세보고: apps/collector/ops/reports/local-gallery-limits-2026-09-23.{md,json}.
- 다음 실제실행을 시작했다. DCInside hot/max-pages1/max-items5/since24h/write-db session53743,
  Goodgag371439 collect-url/write-db session10065. 완료 여부는각handle/DB를재확인한다.
  지금까지새커밋/push/배포없음. 서버session33613은3000/3100으로계속실행중.

- 후속Goodgag session10065 종료(exit1). run dc4be5cd-3010-4b5b-a309-c726179f9771 FAILED/SOURCE_TOO_LARGE/media0. readbackPass=true,collectionComplete=false. 해당PNG HEAD200/Content-Length45,590,774bytes:30MiB자원한도초과이며외부차단아님.
- DCInside session53743은현재살아있고run5bef4c3f-d638-41ac-bb4e-310dfac23307 RUNNING. 다음turn에서같은handle을poll하고진행중이면재시작하지않는다. 현재서버33613실행중.
- git diff --check 통과,main ahead1. 이번작업commit/push/배포없음.

### 2026-09-23 실제 fixture 34개·웃긴대학 순서 보존·수집 원본 전수 점검

이전 goal turn은 localhost:3000 공개70글/207이미지/본문70/SNS10/4페이지 재검증으로
현재 정식 검수 이력4건, 기존 공지80/81, 공개 전 수집 데이터의 검증 범위를 확정한 progress다.
이번 작업도 구현·테스트·실제 DB 저장과 새로운 불일치 발견으로 progress이며 전체 목표는 활성이다.

- 실제 저장 원본에서 17개 사이트 목록/상세 fixture34개와 URL/raw hash/fixture hash/기대 구조를 생성.
  `ObservedFixtureMain`은 정제 전후 identity/순서/시각/pagination 및 body/media구조가 같아야 저장한다.
  NBSP와 로딩 표시가 새 본문/이미지가 되지 않도록 보존, 스크립트/HTML주석/입력값/본문·닉네임 정제.
  `ObservedSiteFixtureTests` 실제34개 회귀+웃긴대학 혼합본문1개 통과. fmkorea/ppomppu/pgr21/YT 성공fixture 없음.
- 웃긴대학 모바일 `p.content_body_padding` 밖 `.body_editor`가 누락될 수 있던 경로를
  `.daum-wm-content` 전체 ordered 처리로 수정. 관측된 확대버튼/로딩UI만 제거한다.
  본문→이미지→본문→SNS/첨부 순서, 링크전용/텍스트전용/빈본문 테스트 통과.
- 실제 웃긴대학 latest/max-pages1/max-items5/since24h/write-db run
  df20e175-e1fe-4cb1-85cf-79fcd6b3612f COMPLETED/신규5/이미지16/실패0.
  DB/raw/media/report/ledger/checkpoint readbackPass=true,collectionComplete=true.
  unknownDates5이므로 최근24시간 게시글이라고 단정하지 않는다. 자동공개 없음.
- DCInside session53743 정상 종료(exit0). run5bef4c3f-d638-41ac-bb4e-310dfac23307
  COMPLETED/발견5/신규3/중복2/실패0/신규IMAGE116. 아래 디코딩 정책5개 때문에 전체readbackPass=false.
  보고서의 collectionComplete도 readbackPass를 필수조건으로 수정했다. 실행완료와 검증완료를 구분.
- `SiteProbeMain`이 거부 HTTP 응답의 status/bytes/hash도 기록하도록 보강. 헤더/token/cookie는 기록하지 않음.
  fmkorea실제HTTP430(6169bytes),ppomppu302→403 재확인. dogdrip200/후보20으로fixture추가.
  pgr21 run429a48ae-5926-4031-92d1-bcda418adb7a BLOCKED/SOURCE_ACCESS_BLOCKED 실패readback 통과.
  YT run84c83f1d-8a28-4c70-ba4f-8e9d9ab04357 FAILED/PARSE_FAILED 실패readback 통과.
  YT 실제raw의 ytInitialData root는 responseContext뿐이며 게시글renderer0;삭제/비공개라고 단정하지 않음.
- 새 `verify-collector-inventory.mjs`로 읽기전용snapshot의 모든FETCHED를 검사.
  최종 FETCHED103/17출처/IMAGE372/SNS21/FILE0. canonical/본문-이미지-첨부-SNS대응과raw/media검사.
  오늘의유머12개는 실제JPEG인데 DB image/png. 기존 runner가원문HTTP헤더를 우선한것이원인.
  공통 `SourceImageType`에바이트서명우선방식으로신규수집수정,기존DB는불변snapshot이므로무단수정안함.
  DCInside hit17807 GIF4개(800x450,187/194/251/266frames),hit17805 position39 WebP511x639/235frames는
  전체디코딩64Mpixel/API256MiB예산초과.파일부재/손상과구분하며검사완화/첫프레임절단안함.
- Java전체165개:149통과/DB환경16skip. 이후MIME수정 관련46개모두통과,bootJar성공.
  Java전체실행은MIME수정직전이며그뒤전체통과로승계하지않음. 신규MIME테스트2개포함관련46개실행.
  node --check 신규inventory스크립트통과. 기존DB migration/권한/숨김재발행 통합검증은 앞선증거와구분.
- 새MIMEJAR의 humoruniv dry-run:collect11테이블/object527hash불변,exit0/COMPLETED.
  `.local-data/verification/dry-run-humoruniv.json`.
- 문서:system-design07에실제fixture/모바일본문/MIME계약,정책표dogdrip/etoland현재관측,
  reference-site-validation의초기조사와현행증거분리,localREADME수집이미지10MiB잔존문구30MiB로정정.
  보고서 observed-fixtures-2026-09-23.md,blocked-http-observations-2026-09-23.json,
  collector-inventory-2026-09-23.json. 원본raw/private자격증명은Git제외경로만사용.

다음 내부 작업 (완료 전 필요):
1. 과거 FETCHED12개 MIME 메타데이터 정정: backup/고정대상/불변snapshot 및 권한/감사 원칙을
   보존하는 복구 설계와 구현. trigger를 임의로끄거나검사를완화하지않는다.
2. 애니메이션5개:전체프레임보존/정해진메모리안의검증·승격 또는명시적자원제한판정을정렬.
   원본수집성공과검수·공개가능판정은별도다. 원본유실이나외부차단으로분류하지않는다.
3. 기존공지80/81의고정대상백업·재실행안전·복구가있는정식API숨김처리. 더쿠정식검수→초안→발행표본.
4. 관리자실제브라우저 검수/실패안내,21사이트최신증거표,실제FILE첨부검증. 기존공개66건의검수이력을소급위조하지않는다.
5. 최종3000브라우저/전수readback/gitdiffcheck로BACKLOG전체기준감사.

프로세스: DC53743·Humor42827·probe20200·dryrun21043 모두종료.
현재서버session33613(3000/3100)은유지. 마지막DC검증session13836은다음조회필요시같은handle사용.
운영DB/bucket변경,commit/push/배포없음. 이번부분증거로목표완료/blocked를선언하지않는다.

- 최종 후속 확인: DC 검증 session13836 종료(exit1), readbackPass=false / executionComplete=true /
  collectionComplete=false. 진행 중인 수집·검증 process는 없다. 개발 서버는 유지한다.
  변경 문서의 추가 링크 누락0, 신규/수정 Node 검증 스크립트 syntax 통과, git diff --check 통과.
  Git main ahead1, tracked 변경86/untracked 표기93(디렉터리 축약 포함), 기존 변경 보존.


### 2026-09-23 11:37 KST 공지 숨김 재실행·더쿠 정식 발행

직전 turn은 실제 3000 브라우저 및 공개/수집 원본 전수 검사를 완료한 progress다.
공개 68건/207이미지 통과와 원본 103건 중 MIME12·애니메이션5 문제를 재확인했으며,
전체 Java167개 중151통과/DB조건16skip, API25통과, Web/복구4통과, API/Web typecheck/lint 통과.
이번 turn은 아래 정식 API 상태 변경과 readback으로 progress다. 목표는 계속 활성이다.

- `repair-notice-posts --apply` 재실행: changed0, 80/81 HIDDEN_REVIEW, lock2/5,
  backup hash/본문 fingerprint/공개404 재검증 통과. 기존 백업과 manifest 보존.
- 더쿠 item8f1778df-1309-454c-8b04-ae7ad6ef6618, source key4353612190,
  원문 https://theqoo.net/hot/4353612190, itemversion2, 본문4블록/이미지1을 확인.
- 실제3000 BFF로 REVIEWING(lock1) → APPROVED(lock2) → DRAFT(post108,reviewlock3,postlock1).
  초안 private파일 hash/size 일치, public파일0, 공개API404를 발행 전에 확인.
  같은 idempotency key로 초안 재전송: 같은108 반환, 중복 게시글1개 유지.
- 별도 publish 요청:108 PUBLISHED/postlock2. DB/private/public hash/bytes 일치,
  public key content/published/posts/108/*, reviewAPPROVED/itemversion2 유지.
- 3000 실제 브라우저에서108번 이미지와 본문4블록/원문링크 표시 확인.
- `verify-collected-content`: 공개69건/17출처/이미지208/본문69/SNS10/4페이지,
  post/image/body failures0, 중복·누락0. 로컬검증 파일
  `.local-data/verification/theqoo-draft.json`, `theqoo-published.json`, `collected-content.json`.
- localREADME: 현행69/208관측값, dryrun11테이블, migrationV005, 공지 적용/복구 제약,
  정식검수→초안→별도발행 재현명령 정리.

남은 내부 작업: 기존 MIME12개 정정(불변snapshot/감사/권한보존), 애니메이션5개 전체프레임
자원제한 처리, 관리자 브라우저 인증 후 검수/실패화면, 실제FILE표본, 21사이트최신증거표.
더쿠 공개0·공지80/81 공개는 해소됐으며 이전 관측 수치를 현재값으로 사용하지 않는다.
운영DB/object변경,commit/push/배포없음. 서버3000/3100유지.


### 2026-09-23 11:46 KST 완료 미디어 MIME 감사 정정

직전 turn은 더쿠108 정식검수/초안/발행과69글208이미지readback을 완료한 progress다.
이번 turn도 V006 구현·격리검증·실제12개정정으로 progress다. 전체 목표는 활성이다.

- task-start스킬로 기술계약 먼저 정리. 새CollectorV006:소유자전용 correct_batch_media_mime,
  append-only batch_media_correction,기대mime/hash/size/itemversion/revision조건부대조,
  source/APIreview잠금, runtime직접수정금지. 기존V001–V005 SQL은불변.
- migration함수MigrationMain에V006추가, migrationtest 및 contract-evolution hash등록.
- `collector-mime-repair.test.mjs`:격리DB/role만생성삭제. 최종관련Node검사12개통과(skip0).
  오류/stale/ABA/동시멱등/역정정/transactionrollback/active-run/reviewlock/runtime권한/감사불변 포함.
- Java전체167중151통과16환경skip 후 search_path방어보강. 최종SQL로 격리DB
  MigrationMainTests+BatchOwnershipReadbackTests3개통과(skip0),bootJar성공.
  첫 targetedGradle명령은 --tests위치가bootJar뒤여서실패; 옵션위치를test뒤로고쳐재실행통과.
- `prepare-batch-review --apply`:백업before-batch-review-1790131428857.dump,
  실제API V008/CollectorV006적용,media372파일검사,새ledger/함수runtime권한차단확인.
- `repair-collector-mime.mjs`:todayhumor고정7item12IMAGE,전체JPEGdecode/hash/size사전대조.
  privatebackup before-collector-mime-cf09338a-fe83-472d-86e2-89cf58907248.dump와manifest확보.
  apply changed12/readbacktrue, 반복apply changed0/readbacktrue. 파일bytes/본문/itemversion/content변경0.
  감사행12/item7/revision1/PNG→JPEG DBreadback. 실제rollback은미실행,격리DB에서만검증.
- 원본inventory:103FETCHED/17출처/372IMAGE/SNS21/FILE0. MIME실패12→0.
  현재101item통과,DC2item애니메이션5개만미통과(exit1);전체완료아님.
- 공개69글208이미지본문69/SNS10/4페이지전수실패0.
- V006후 humorunivdryrun:DB12테이블+collect파일527개hash불변,COMPLETED/exit0.
- 문서/보고:systemdesign07·02,개발명세,환경설정,localREADME,deployREADME,
  ops/reports/collector-mime-correction-2026-09-23.md. 과거보고서소급변경없음.

다음 내부 작업: DC애니메이션5개 전체프레임·메모리제한 처리를 정렬(검사한도무조건상향/첫프레임절단금지),
관리자실제브라우저검수,실제FILE표본,21사이트최신증거표. MIME12개정정은해소됐다.
Collector/검사sessions30669·86999·16410·80528·36769·40739 모두종료.
서버3000/3100유지. 신규commit/push/배포없음. 소스·문서 변경만으로 전체완료를선언하지않는다.

### 2026-09-23 12:10 KST 3000 종합 재검증과 시간 초과·재시작 수정

사용자의 3000 재검증 요청을 반영했다. 전체 목표는 부분 완료/활성으로 유지한다.
보고서: apps/collector/ops/reports/local-3000-review-2026-09-23.md.

- 기존 공개69/208, 원본103/372 전수검사 통과 후, 승인된109번(DRAFT/private50/public0/공개404)의 별도 발행을 수행했다.
  최종 공개70/17출처/258이미지/본문70/SNS10/4페이지, 누락·중복·해시·MIME·치수·전체프레임·본문 대조 실패0.
  현재 공개70 중 정식 batch 검수 연결6, 기존 적재64. 과거 검수 이력을 소급 생성하지 않았다.
- 원본103FETCHED/17출처/372IMAGE/21SNS/FILE0 전수readback 통과. 애니메이션5개 한도 문제는 분할 검사 구현으로 해소됐으나 운영R2검증은 아니다.
- f28a41b9-1244-4615-b497-56daa7f4a093의 source key는 hit:17808이다. 이전 hit17807 기록을 현재값으로 사용하지 않는다.
- 직전 진행에서 작성된 collected-animation.ts/회귀시험은 이번 API 빌드와unit32중 관련4개 테스트로 재검증했다.
  실제원본5개1133프레임 대조는 이전 실행 collected-animations.json 근거로 보존하며 이번 실행횟수로 중복 계산하지 않는다.
- Web batch 초안180초/preview60초, API 이미지 준비120초 예산(협력적 검사)/디코딩30초로 정렬.
  deadline 초과 회수·원본 불변·같은 key 재시도 격리DB통과. 파일I/O의 절대중단deadline은 아니다.
- 서버 재시작 시 actorSecret이 교체되어 과거 영수증 조회가409인 문제 발견. 로컬 actor-secret(600/Git제외)을 보존하도록 수정.
  도입 이전109 원래 key 재생 실패는 미해소 이력이며 성공으로 집계하지 않는다. 기존 draft는DB/file대조 후별도발행했다.
- 110번(hit17805)은 정식 REVIEWING→APPROVED→DRAFT, private42/public0/공개404, WebP95/140/235프레임 검증.
  실제 서버 재시작 후 원래 key/body가HTTP201/동일110 반환, 이미지42유지.110은비공개로남겼다.
- Chrome3000: 목록,108본문이미지,107의49이미지,57긴본문/390px모바일,87X공식embed본문·이미지,109의50이미지,
  1→4페이지마지막10건/다음비활성 확인. 표본이미지깨짐0/가로넘침0/error·warn0. 전70개는API/object전수이며개별전체화면검사는아니다.
- API/Web build/lint,Webtypecheck통과. APIunit+Web32/32,reviewintegration13/13,identity2/2,source/migration3/3.
  Java전체167/151통과16환경skip/실패0(재실행). skip16은DB실연동통과로표시하지않는다.
- 실제권한 batch contentINSERT/reviewUPDATE=false,API itemUPDATE=false/itemSELECT=true.
- planning§3.2에legacy경계직접표시,system-design/devspec/localREADME처리시간·재시작설정정렬.
- 변경전backup before-browser-review-20260923-1215.dump. 상세증거는보고서의.local-data경로.

남은 내부작업: 관리자인증브라우저검수/실패안내,실제FILE첨부표본,21사이트검증조건최종정렬.
외부검증:4사이트접근/renderer,DiscordGateway,운영R2/S3. 이번로컬readback을새live수집성공으로보고하지않는다.
현재서버session13595(3000/3100)유지,브라우저/meme탭유지. 감사/테스트실행은모두종료.
commit/push/배포없음,기존tracked/untracked보존. gitdiffcheck통과.

### 2026-09-23 12:30 KST 첨부 실수집·정식 발행과 브라우저 전수 검증

직전 turn은 실제 원본104건과 공개70건 재검사를 완료한 progress다. 이번 turn은 잘못된 재현
manifest 수정, 첨부 표본의 정식 발행, 공개71건 브라우저 검사와 문서 정렬을 수행한 progress다.
전체 목표는 활성/부분 완료이며 외부 접근·인증이 없는 검증을 성공으로 바꾸지 않았다.

- 실제 인벤 `black/3584/51253`의 본문 밖 첨부2개 누락을 수정한 `inven-ordered-v2`와
  고유 첨부 URL 중복 제거가 최종 Java170개 중154통과/16환경skip/실패0으로 검증됐다.
  `.articleFile`의 다운로드 아이콘을 제거하지 않은 최초 수정은 테스트2개 실패였고, 수정 후 통과했다.
- 실제 추가 fixture2개와 synthetic 파일 링크/한도 회귀를 추가했다. observed HTML 총36개.
  ZIP 실수집 run `a4acee83-4f31-499a-a79f-3fb3859b3cb1`:38블록/8IMAGE/2FILE, raw/media/report/ledger readback통과.
  ZIP2개 크기·hash 일치, 각19entry CRC통과. 압축 해제/코드 실행하지 않음.
- 상세 dry-run:DB12테이블/object527개 전체해시 불변. `verify-dry-run.mjs SOURCE [DETAIL_URL]` 사용법 문서화.
- item `71e37810-61ac-481f-a187-bbfd5c5afe76` version3을3000 BFF로 REVIEWING→APPROVED→DRAFT111.
  private8/hash일치/public0/공개404 확인 후 별도publish:PUBLISHED lock2. 실제화면 image8/file원문link2/collect링크0.
  backup `.local-data/backups/before-inven-attachment-review-20260923.dump`.
- 공개 전수:71글/266이미지/본문71/SNS10누락0/4페이지고유71, HTTP·DB·private/public hash/크기/MIME/치수/프레임·본문대조실패0.
  수집 원본104건/17출처/380IMAGE/2FILE/21SNS readback실패0. 기존70/258 기록은 이전시점이다.
- Chrome실제목록4페이지에서71개URL수집→모두상세방문. article제목71/이미지266, broken0/pending0/overflow0.
  대표화면111 스크린샷 확인. 전71개 스크린샷 육안대조는아님. browser-all-posts-20260923.json에 개별수치보존.
- API/Web unit32/32, reviewintegration14/14(FILE링크와비공개경계포함), API/Weblint, APItesttypecheck통과.
- 재현manifest오류:GENERAL_LIST9출처가hot으로등록. sample웃긴대학포함총10항목latest정정.
  source-configtest에서수정전실패재현후3/3통과. 운영manifest는실행하지않음.
- planning의조건부metadata수집흐름을본문파이프라인으로정렬. API결과제출/preview/Spring은legacy표시.
  reference검증표는현재지속DB와초기임시DB를분리하고과거승인플래그/절단보정/실패이력을보존했다.
  relativefilelink32개누락0,gitdiffcheck통과. 법무placeholder·출시gate변경없음.

종합근거: `apps/collector/ops/reports/local-attachment-and-browser-2026-09-23.md`.
남은 수용감사: BACKLOG의 migration/권한/환경별재현/실패복구 증거를 마지막으로 항목별 대조한다.
관리자UI는저장된브라우저권한이세션적용CDP작업을막아사용자로그인대기이며우회하지않는다.
외부미검증:4사이트접근/renderer,실제DiscordGateway,원격S3/R2. 관리자API명령통과를UI버튼완료로집계하지않는다.
Web3000/Core3100유지. 검증session20156완료. commit/push/배포없음. 기존tracked/untracked보존.

#### 같은 실행의 환경·권한 추가 감사

- 로컬 migrationledger API V001–V008/Collector V001–V006, item/media/review guardtrigger존재 확인.
  batchcontent쓰기/APIbatchitem쓰기금지와API조회허용을실제권한쿼리로재확인했다.
- dev/stage/prod 예시HOST127.0.0.1과Docker api:3100 불일치수정:컨테이너HOST0.0.0.0,
  local직접실행loopback유지. 서버재시작/포트공개/운영변경없음.
- environment-config.test.mjs추가:Core주소·포트/token/기본비활성/bucket분리/reader별도자격예시.
  첫시험의R2변수미인식정규식오류를수정하고source/config4개최종통과. 실제원격연결시험아님.
- 남은 수용감사는 기존 제약/재시작/복구 증거를 요구조건별 최종표로 연결하고, 아직 없는 외부·관리자UI 증거를 분리하는 일이다.

### 2026-09-23 12:36 KST 최종 수용 감사와 외부 대기

직전 turn은 실제첨부·발행/설정수정/브라우저71건 검증으로 progress였다.
이번 turn은 임시DB Java170개 생략없는 실행, 제한role·backup/restore 재검증, 수용표 작성으로 progress다.

- `scripts/test-collector-readback.mjs`추가. 고정5439 관리접속으로무작위전용DB생성,
  Gradle전체시험에DB URL주입,종료시생성DB만정리. 실제개발DB는시험대상으로쓰지않는다.
  최종170/170통과/skip0/failure0. queue30초backoff·3회재시도상한을실제대기했고검사기를완화하지않았다.
- `test-database-roles.ts`의CollectorV006 ledger명시검사와PASS문구정정.
  실역할SCRAM/권한/Java batch수집/본문imagefileSNS·reportcheckpoint/검수초안발행/DDL차단통과.
  backup계정dump→별도DB복원61table행·ledger/16sequence일치. 임시container정리확인.
- scripts typecheck/lint,mjs syntax통과. `.local-data/verification/final-java-readback-suite.json`생성.
  `blariyo_collector_test_*` DB잔존0,`blariyo-roles-*` container잔존0.
- localREADME시험명령추가,opsREADME현재migration V006으로정렬.
- `ACCEPTANCE-AUDIT.md`에BACKLOG의소유권/이미지/원문/사이트/환경/시험/재현/실패복구를항목별대조.
  현재공개71글266이미지,수집104건380이미지2FILE21SNS. 실제3000 API200확인.
- 관리자UI 재확인:관리자인증필요. 저장된브라우저권한의CDP세션적용거부를우회하지않음.
  4사이트외부응답차단/renderer부재,DiscordGateway/원격S3실연동증거부재는최근연속3goal작업동안동일조건이다.
  수정가능한내부작업을마친현재는해당외부상태/사용자입력없이다음수용검증을완료할수없다.
- 전체판정부분완료,목표상태blocked로전환. 완료로표시하지않는다.
  재개입력:관리자로그인완료,접근가능한공개URL/공식경로,허용된Discord·비운영S3테스트환경.
  비밀값을대화/로그/문서로받지않고비공개설정으로주입한다. 운영DB/bucket변경권한없음.

Web3000/Core3100유지. 테스트sessions45449·94906·96550·66643종료. 기존변경보존.
gitdiffcheck통과,main...origin/main ahead1은기존상태. 새commit/push/배포없음.
