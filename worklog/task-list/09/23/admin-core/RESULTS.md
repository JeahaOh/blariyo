# M0 Core 관리자 마감 결과 — 2026-09-23

**개발자 로컬 구현·검증 완료. 실제 운영자 Access 인증·수동 사용성 인수와 운영 배포는 미검증이다.**
요청 범위는 [P0-01~04](../../../../../docs/implementation/m0-interim-2026-09-23/next-plan.md)이며
P0-05·신규 수집 기능·자동 승인/발행·commit·push·배포는 수행하지 않았다.
이전 [진행 기록](PROGRESS.md)의 시작 상태를 소급 수정하지 않고 기존 변경을 보존해 이어서 검증했다.

## 항목별 판정

| 항목 | 판정 | 근거·잔여 |
| --- | --- | --- |
| P0-01 | 완료 — 로컬 화면 계약·문서 정렬 | planning·D08·[실제 화면 검토물](../../../../../docs/publishing/admin-core-review.md)·상태 체크리스트. 이미 주입된 법무 실값과 CI 게시 기록을 시점별로 정정. 운영자 사용성 확인은 별도 인수 |
| P0-02 | 완료 — 로컬 | 관리 메뉴, 상태/제목/게시판/수정일 검색, KST·게시판 표시, loading/empty/error/retry, 비활성 수집 메뉴 미노출 |
| P0-03 | 완료 — 로컬 | 편집·다중 이미지·alt/출처/순서, 미저장 이탈·중복 요청 보호·저장 결과 복구·충돌 안내, 상태별 액션/확인창 |
| P0-04 | 개발자 검증 완료 / 운영자 인수 미검증 | 12건 반복 업무·API/DB/object 대조, Core 통합94·브라우저21. 실제 운영자 수동 10~20건 처리 시간·클릭 반복·Access 인증은 수행하지 않음 |

P0-04 전체 운영자 인수까지 완료됐다는 의미는 아니다. 이번 goal의 로컬 마감과 운영 개시 승인은 분리한다.

## 변경 범위

- `apps/web/app/pages/admin.vue`: 시작 시 존재하던 관리자 UI 보강을 보존했다. 현재 검증에서 발견한 추가 결함은 상태 변경 후 검색 결과에서 빠진 글의 모바일 목록 복귀 포커스이며 `새 초안` fallback으로 수정했다.
- `apps/api/src/persistence/entities.ts`: V007/V008 SQL 테이블 3개와 23개 열·외래키 2개의 누락된 TypeORM 매핑을 추가했다. synchronize=false·relation 쓰기 금지를 유지한다. API endpoint·요청 계약·migration 파일은 변경하지 않았다.
- `tests/browser/admin-workflow.test.ts`: 12건 반복 업무, DB/이미지 readback, KST 고정, 검색/권한/충돌·4개 화면 폭·포커스·preview 복구. 단계 실패 시 완료 JSON을 새로 기록하지 않도록 성공 단계 수를 확인한다.
- 기존 render/Core browser 테스트의 한국어 상태·입력 보존·저장 복구 기대를 정렬했다.
- API 회귀 테스트 4개: parser fixture의 빈 첨부 계약, V007 rollback 보호, 경쟁 요청의 필수 본문·패자 데이터 보존, 전체 entity/외래키 대조, dump 주석의 배포판명 차이를 정정했다. 실패 기준을 낮추거나 검사 자체를 생략하지 않았다.
- `scripts/local/open-admin.mjs`: 기존 로컬 세션으로 별도 Chromium 창을 연다. 토큰 출력·URL 노출 없이 loopback만 허용하며 `--verify`는 읽기 전용이다.
- planning·관리자 명세·결정 색인·배포 정책·화면 검토물·실행 계획·오늘 목차를 결과와 연결했다. 과거 중간 점검 보고서와 worklog 결과는 보존한다.

## 실행 결과

Node 24.18.0, JDK25.0.2, 테스트 전용 PostgreSQL `127.0.0.1:55449/postgres`를 사용했다.
DB runner는 무작위 `nest_*`/`m0_browser_*` DB만 생성·삭제했고 미디어는 임시 디렉터리를 사용했다.
기존 개발 DB `5439/blariyo_local`의 게시글은 조회만 했다.

| 검사 | 결과 | 로컬 증거 (`test-results/admin-core/`, Git 제외) |
| --- | --- | --- |
| contracts 생성 + API/Web build | 통과, generated contract diff 없음 | `build.log`, 최종 `api-build-final.log`, `build-web-final.log` |
| API/Web typecheck·lint | 통과 | `api-typecheck-final.log`, `api-lint-final.log`, `typecheck-web-final.log`, `lint-web-final.log` |
| API test compile/typecheck | 통과 | `api-test-build-final.log`, `api-test-typecheck-final.log` |
| scripts/tests typecheck·lint | 통과 | `typecheck-scripts.log`, `lint-scripts.log`, `typecheck-tests-final.log`, `lint-tests-final.log` |
| 공통 unit | 26/26, skip0 | `unit-final.log` |
| API unit | 29/29, skip0 | `api-unit-final.log` |
| Nest integration | 94/94, skip0 — 22파일93개 + 마지막 복원1개 재검증 | `integration-complete.log` 앞93개 및 `schema-restore-final.log` |
| 전체 Chromium | 21/21, skip0 | `browser-final.log` |
| 최종 업무 JSON 증거 보강 후 해당 Chromium 재검사 | 4/4, 12건·3단계·최종 PUBLISHED12 | `admin-workflow-final.log`, `workflow.json` |
| schema/backup restore | 별도 PostgreSQL에 복원 후 31개 테이블·sequence 항목 및 모든 행/ledger/시퀀스·API 동일 | `schema-restore-final.log` (위94개에 포함) |
| 3000 관리자 | 실제 Chromium UI/API 일치·익명401·쓰기0 | `.local-data/verification/admin-core-3000.{json,png}` |
| 화면 | 320/390/768/1280px 가로 넘침0·모바일 목록/편집·키보드 포커스 확인 | `editor-*.png`, `list-*.png`, 검토물 캡처 |

최종 전체 테스트 뒤 API/Web 제품 로직은 변경하지 않았다. 실패 검사는 원인 수정 후 관련 범위를
다시 실행했으며 같은 성공 결과를 여러 번 합산하지 않았다. raw 로그에는 의도한 장애 주입의
도메인 오류 이벤트가 있을 수 있다. 통과 여부는 테스트 결과와 DB readback으로 판단한다.

### 12건 업무와 미디어

- 각 글에서 제목·본문·출처 입력 → 이미지2개 업로드/alt/순서 → 초안 → 수정 → 즉시 발행 → 숨김 → 회수 완료 확인 → 본문 수정 → 재공개를 수행했다. 6건은 KST 예약·확인 취소·예약 등록·예약 취소도 거쳤다.
- 반복 구간 종료에서 게시글12/공개12, 이미지24, 각 글의 공개 전이 이력2회(최초 발행+의도한 재공개)를 확인했다. 의도하지 않은 중복 발행0, 초안/숨김의 공개 API404, 공개 후200이었다.
- private/public 바이트와 SHA-256·80px 이미지 decode 일치, 숨김/outbox 후 public object 부재, 재공개 결과를 확인했다. DB 본문·순서·alt는 기대값과 일치했다.
- 별도 동시 수정 단계에서는 다른 요청으로 한 글의 내용을 의도적으로 교체한 뒤 UI 입력 보존·최신 내용 확인을 검사했다. 이 후속 변경은 내용 유실로 세지 않는다. 전체 종료 시 PUBLISHED12를 다시 확인했다.
- API 통합/기존 Core 브라우저에서 저장 응답 후 상세 재조회 실패의 동일 key 재시도→DB1건, 미저장 이탈 취소, 업로드413/415/503 전체 실패, due worker 반복 호출의 두 번째 발행0, 최종 제거·권한/Origin 검사를 확인했다.
- 최종 반복/오류/화면 3단계 자동화 시간은 **11.383초**, mutation HTTP 요청 **101회**, 브라우저 pageerror **0**이다. 사람의 작업 속도·실제 클릭 수·생산성 기준이 아니다. 실제 운영자의 수동 측정은 아직 없다.

## 직접 확인하는 순서

현재 로컬 Web `http://localhost:3000` / API `127.0.0.1:3100`은 최종 빌드로 실행 중이다.
저장소 루트에서 Node24.18.0으로 `node scripts/local/open-admin.mjs`를 실행하면 로컬 테스트 인증
Chromium 창이 열린다. 일반 Chrome의 `/admin` 비인증 안내는 정상이다.

1. `http://localhost:3000/admin`에서 새 초안 또는 상태/제목 검색으로 시작한다.
2. 제목·본문·출처·이미지/alt·순서를 입력하고 초안 생성/수정 저장한다.
3. 저장 후 즉시 발행 또는 KST 예약을 선택한다. 예약 취소는 초안으로 복귀한다.
4. 공개 글은 숨김 처리 후 수정한다. 이미지 회수가 끝나면 최신 내용 확인→수정 저장→재공개한다.
5. 공개 결과는 편집기의 공개 게시글 보기 또는 `http://localhost:3000/meme`에서 확인한다.

서버를 재시작하면 로컬 세션이 바뀌므로 helper 창을 다시 연다. 실행·인증 경계는
[로컬 실행서](../../../../../scripts/local/README.md#로컬-관리자-화면-열기)를 따른다.

## 실패 이력과 잔여

- Node20/JAVA_HOME 누락과 테스트 Origin·상태 문구·fixture·migration 기대 불일치는 수정 후 통과했다.
- API를 다시 빌드하는 동안 실행하던 일부 통합 검사는 dist 교체로 중단됐다. 해당 결과를 성공으로 쓰지 않았고 빌드 완료 후 전체 23파일을 순차 실행했다.
- 마지막 schema dump 비교는 18.6과 18.6(Debian)의 **주석만** 달랐다. 배포판 suffix만 정규화하고 숫자 버전·모든 DDL/ACL·복원 readback을 유지해 통과했다.
- 실제 Access 허용/거부, 운영 R2/CDN 회수, timer 장기 관찰·알림 실수신·운영자 수동 반복 업무 인수는 미검증이며 P0-05와 운영 인수 범위다. 합성 인증을 운영 인증으로 보고하지 않는다.
- legacy 수집 `CollectionPipeline`이 `SiteAdapters`의 `attachmentCandidates`를 기존 result 계약으로 그대로 보낼 가능성을 코드에서 발견했다. fixture bridge에서 빈 배열만 분리해 검증했으며 실제 legacy pipeline은 실행/수정하지 않았다. 신규 수집 기능의 이번 완료 근거가 아니며 P1 계약 정렬에서 다룬다.
- 현재 로컬 마감에 필요한 추가 사용자 입력은 없다. 운영 인수에는 실제 운영자 세션·허용된 테스트 콘텐츠/비운영 자원과 운영자 수동 확인이 필요하다.

## Git·문서 검증

`git diff --check` 통과. `main...origin/main`에서 변경을 보존했으며 commit·push·배포 없음.
최종 변경 파일 목록은 같은 폴더의 [Git 상태](GIT-STATUS.txt)에 저장한다. tracked 수정15개,
untracked 파일10개이며 기존 사용자 변경/미추적 파일도 포함한 전체 작업 트리 수량이다.
변경 문서의 상대 링크183개·화면 캡처 파일 존재 확인, 깨진 링크0이다.
법무 placeholder·후속 활성화 gate는 제거하지 않았다.
