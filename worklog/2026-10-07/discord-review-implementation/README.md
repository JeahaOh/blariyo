# Discord 검수 구현·운영 검증

- 담당: Codex / 상태: 진행 / 갱신: 2026-10-07 23:49 KST
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/discord-review` / 시작 HEAD: `d2139f35d004e1d5c8fa4103ba189b4c219167f5`
- 기준 release: 로컬 확인 `origin/release=1c255a9ba261903c6a64804edb29ef0fa0b70da1`, 현재 HEAD의 조상. 운영 수집 예약 변경을 포함한 기존 feature HEAD에서 분기했다. 원격 최신 상태는 배포 준비 때 다시 확인한다.
- 요청: 확정한 계획대로 로컬 구현·시험 후 운영 반영·검증. [상세 설계](../discord-review-plan/DETAILED-DESIGN.md)의 확정 정책을 정본과 구현으로 옮긴다.
- 담당 범위: 관련 planning/system-design/development-specs, API collection/posts/persistence, Collector discordreview, 관리자 batch 화면, 검수 배치 운영 도구, 관련 테스트와 이 기록.
- 기존 변경: `.gitignore`, 운영 비공개 파일 안내, Discord 계획/입력/도구와 비공개 파일 목록은 이 세션의 선행 작업으로 보존한다. 운영·로컬 입력 JSON과 token은 Git 제외를 유지한다. 이전 수집 담당의 종결 기록을 확인했으며 다른 파일을 덮어쓰지 않는다.

## 완료 기준

- [x] 정본·DB·API·권한 계약 동기화
- [x] 문장/이미지 단위 표시·선택, 등록 검수자 반응만 판정
- [x] 07:30/17:00 전체 미승인 재조회·준비 완료 후48시간 정책
- [x] 공통 승인/발행 명령의 영속 상태·중복 방지·관리자 우선권
- [x] 최상위 commit 및 연결/잠금 반환 후 비동기 삭제, 삭제만 재시도
- [x] 삭제2회 실패 안내·부분 전송·ACK 유실·프로세스 재시작 복구
- [x] 관리자 화면의 공통 명령·상태·최종 본문 연결
- [x] 로컬 단위·DB·통합·브라우저·실제 Discord 검증
- [ ] 운영 배포 후보 Git/CI/이미지·migration·백업/복귀 검증
- [ ] 운영 반영·실제 검수/삭제 흐름 검증

## 진행

- 선행 준비: 비공개 token 저장·권한과 Discord 읽기7요청 성공. 메시지/반응/삭제 및 발행 시험은 아직 미실행.
- 현재 구현 착수: 기존 API는 중첩 transaction을 재사용하고 바깥 session lock이 연결을 유지한다. 단순 비동기 호출 대신 최상위 연결 반환 이후 실행 경계를 구현한다.
- 설계·로컬 시험·운영 반영은 별도 증거로 기록한다. 현재 운영 변경 없음.

## 22:39 중간 구현·검증

- 사용자 후속: 취침 중에도 중단하지 않고 로컬·운영에 반영. 다음 날04:30 수집 이후 Discord 검수 메시지,07:30 반응 판정을 목표로 작업을 계속한다. 운영 배포/전송 완료를 아직 주장하지 않는다.
- 정본: 수집 기획§8과 보안의 전용 비공개 채널 예외를 갱신하고 `docs/system-design/10-discord-review.md`를 추가했다. 기존09번 보안/비용 문서와 번호가 겹치지 않게10번을 사용한다.
- 구현: V014 신규5표·ORM 매핑·API 전용 권한·선택 백업 분류, 문장/이미지 manifest와 반응 판정, 최상위 연결 반환 이후 알림, cleanup lease/ACK·REST 삭제·제한 큐, 공통 검수 명령 저장/관리자 선점/단계 진행을 작성했다.
- 실제 발행 경로: 기존 이미지 준비를 `prepareSelectedDraft`로 공유하고 선정된 이미지에만 읽기/업로드를 적용한다. 게시글 발행 commit 전 control epoch·command lease·원문 버전/보존·현재 운영자 권한을 재검증한다. 관리자 반려는 연결된 DRAFT ID를 보존하며 일반 publish 경로도 차단한다.
- V014는 이번 작업에서 새로 작성 중인 migration이며 기존 적용 migration은 수정하지 않았다. V014를 개발/운영 DB에 적용한 것이 아니라 매번 새 임의 이름의 격리 시험 DB에 적용했다.
- 검증(기반 작성 시점): API 서비스42건, 기존 batch 검수 통합21건, DB 매핑/after-commit/cleanup/명령 lease 각1건, migration 계약·백업 도구8건 통과. 이후 공통 실행 경로 변경의 관련 회귀는 별도로 재실행했다. 전체 최종 검증 receipt는 아직 없다.
- 수정 중 발견: 기본 shell Node20으로 처음 build가 실패해 프로젝트 지정 Node24.18.0 PATH로 실행했다. 루트에서 직접 ESLint config를 지정한 첫 실행은 파일 glob/typed context 때문에 실패해 API 작업 디렉터리에서 정상 검사했다. 새 workflow fixture의 UUID/varchar 동일 파라미터 충돌을 명시 cast로 고쳤고, TEXT 저장 기대값은 기존 PostsRepository.addBlock의 trim 계약과 대조해 정렬했다.

## 이어서 완료할 구현

1. 공통 workflow 통합 시험을 마치고 권한 회수·관리자 선점(이미지 준비/발행 직전) 경합을 보강한다. 현재 새 ReviewCommandService·Authority·cleanup은 아직 HTTP/module에 연결하지 않았다.
2. API export/scan/ACK/유실 복구 repository·service·worker guard/controller와 관리자 공통 command 계약/개발 명세/OpenAPI·생성 타입을 연결한다. 원본 없는 최소 manifest만 DB/선택 백업에 남기고 본문은 매번 원문 snapshot에서 읽는다.
3. 반응 관찰을 큰 글에서도256KB 요청 상한 안에 제출하도록 chunk를 영속 저장한다. 모든 페이지/fragment가 확인되어야 판정하며120초 관찰 TTL과 동시 상태 변경을 검증한다. 등록 검수자 외 반응을 봇 seed로 오인하지 않는다.
4. Java 전용 DiscordReviewMain·REST client·export/scan/maintain 구현, 메시지 nonce/표식·ready 이전 반응 제거·늦은 ACK 정리·실패2회 안내·동일 bot rate limit 복구.
5. 관리자 화면에서 새 공통 command/상태/최종 선택을 사용한다. Discord flag ON일 때 옛 review/draft 경로가 우회하지 못하게 계약에 맞춰 제한한다. flag OFF의 기존 흐름은 유지한다.
6. 로컬/운영 설정은 기존 intake JSON을 자동 소비하지 않고 별도 비공개 runtime config와 worker credential을 만든다. 운영 active operator와 Discord 검수자의 실제 매핑, 동일 HMAC actor secret을 확인한다. 토큰을 로그/명령 인자/커밋에 넣지 않는다.
7. 유지보수1분·검수07:30/17:00, 기존 수집04:30/15:30을 독립 lock으로 연결하고 로컬·실제 Discord 검증 후 운영 배포 후보/Git/CI/백업·복귀/실제 전송을 검증한다. 운영은 아직 변경하지 않았다.

### 공통 업무 실행 경로 검증 추가

- `review-workflow.integration.test.ts` 실제 PostgreSQL·Nest·이미지 저장소 시험4건 통과: 문장/이미지 제외와 제외된 missing 이미지 미조회, 게시글/발행 이력1회, 초안 이후 관리자 반려 시 연결 보존·일반 publish 차단, 운영자 권한 회수 후 NEEDS_ADMIN.
- 기존 `batch-review.integration.test.ts`21건은 이미지 준비 공통화·발행 fence 도입 후 다시 통과했다. API source/test build 및 변경 경로 ESLint도 통과했다(현재 새 서비스와 HTTP/BATCH 연결 전 단계).
- HTTP/API 계약·worker·관리자 UI·운영 연결이 다음 단계다. 운영자 매핑 설정의 실제 읽기, 실제 Discord 쓰기와 운영 배포는 아직 수행하지 않았다.
- 구현 보완 체크: 명령의 본문 제외에 참여한 모든 검수자 매핑도 실행 직전에 다시 확인해야 한다(현재 대표 actor 재확인 구현). 최종 publish의 authorize callback은 새 command fence와 함께 실행한다. 작업 실패 NEEDS_ADMIN의 상세 오류 코드 표시, expiry 검증, 부분 export/late ACK·notice는 후속 연결에서 완성한다.

## 23:10 HTTP·BATCH·UI 연결 검증

- API export/lease/ACK·분할 관찰·07:30/17:00 scan·관리자 공통 명령을 module/controller와 strict OpenAPI에 연결했다. Java REST worker와 관리자 공통 command/status/최종 본문 UI를 연결했다.
- 새 API 실제 PostgreSQL/Nest HTTP 시험1건, 공통 workflow5건, DB 매핑1건, cleanup1건 통과. workflow는 관리자가 기존 DRAFT를 현재 postVersion으로 인수해 발행하는 회귀도 포함한다. Java worker5건 통과. API source/test build 통과.
- Web typecheck/변경 경로 ESLint는 UI 연결 시점에 통과했다. 실제 브라우저/Discord 쓰기와 전체 최종 receipt는 아직 미검증이다.
- 관찰 chunk 중복은 JSONB key 순서를 고려한 deep equality로 수정했다. 삭제 실패 안내는 별도 실패 수/재시도 시간을 두고 삭제 횟수와 분리했다.
- 운영 읽기 전용 확인: API/Web healthy, 현재 release b57724d-schema-v013, 활성 OWNER1명. 관리자 registry/HMAC 연동 가능. 실제 설정 변경/배포/DB migration은 아직 수행하지 않았다.
- 추가 복구 보완: 원문 보존 종료 시 Discord 복사본만 정리, 과대 manifest 개별 BLOCKED 처리, 원문 삭제 후에도 동일 관리자 요청의 영속 명령 replay, UI 상태 polling의 늦은 응답 보호. 이 추가분은 후속 검증한다.
- 이어서: 로컬·운영 설정/worker 실행 예약, 실제 메시지·삭제 및 브라우저 수용, 최종 품질 검사와 Git/배포/운영 readback.

## 23:19 로컬 실제 연결·회귀 보완

- 로컬 개발 DB V014 적용 전 dump·archive 목록을 확인했다. 기존 API 역할만 새 검수 표 UPDATE 가능, BATCH 역할 불가를 실제 조회했다. 로컬 API/Web은 전용 LaunchAgent로 재시작했고1분 유지보수/07:30·17:00 검수도 등록했다.
- 실제 Discord 개발 채널에 시험 글1건 전송: 헤드1개, 스레드 내 문장2개·이미지1개, 모두👍/❌ seed, READY 및48시간 DB readback 성공. 브라우저에서 표시를 확인했다.
- 관리자 화면에서 시험 글 반려 성공. 실제 Discord 헤드·스레드 GET 모두404. API3초 전체 deadline에서 응답 유실 가능성이 생겨 최초 ACK는RETRY_WAIT/실패1회였으며, 다음 maintenance의 삭제만 재시도·DONE readback을 추가 확인한다. 승인/발행 명령은 만들지 않았다.
- 기능과 무관한 실제 수집 글은 수정·승인·발행하지 않았다. 첫 시험 fixture 생성은 기존 수집 guard가 초기COMPLETED를 거부해 transaction 전체 rollback됐다. guard를 유지하고 source lock·RUNNING→FETCHING→FETCHED 및 report/checkpoint를 갖춘 정상 흐름으로 재작성했다.
- 전체 검증 중 신규V014가 기존 Spring 수집 schemaReady의V013 상한에 빠진 문제를 발견해V014 지원을 추가했다. DB 역할 시험의 API migration 기대값도14개로 갱신했다. fixture/reference 검사 완화나 skip은 하지 않았다.
- 초기 품질 검사는 잘못된 CLI 인자(task누락), UI poll의itemId 오타, 겹친 build 중lint 컨텍스트 실패를 구분해 기록했다. UI 오타는수정, 개별lint:tests 재실행통과. 전체API 첫 재실행의JAVA_HOME누락도 실제Java25환경으로 재실행한다. 최종 동일입력 receipt는 새로 얻는다.
- Java 전체 JUnit만 실행했을 때304개 중22개 DB 연동 조건부 skip이 있어 최종 통과로 보지 않는다. 실제Collector DB readback을 활성화한 별도 검증을 진행한다.

## 23:23 복구·권한·Collector 검증

- 실제 로컬 삭제는 다음 유지보수에서404를 성공으로 처리해DONE으로 복구됐다. 관리자 화면의 `반려 완료 / Discord 정리 완료 / 실패1회`와 DB 상태를 확인했다. 반려·발행 업무를 다시 실행하지 않았다.
- 운영 비공개 설정7개와 worker jar·service/timer 원본을 `/opt/blariyo/discord-review/`에 준비했다. 현재상태는PREPARED_NOT_ENABLED이며 운영 API flag/compose/DB/실행 예약은 아직 변경하지 않았다. 초기 파일 전송은 jar basename 허용 목록 불일치로 중단돼 이미 준비된 secret은 보존하고 artifact만 이어서 전송했다.
- Collector 실제 DB readback 활성화 검증:83 suites/304 tests, 실패0·오류0·skip0, DB readback20건 통과.
- DB 역할5개·API V001~V014/Collector V001~V015·API/BATCH/retention 경계·dump→별도DB복원84개표/17개sequence 전수 비교 통과.
- 새migration 추가로V014가 첫 down 대상이 됨에 따라 기존V013 롤백 차단 회귀는 먼저 빈V014 down을 수행한 후V013 차단·ledger불변을 그대로검증하도록 갱신했다. common-codes/migrations 관련검사9건 통과. 데이터가 있는V014는 별도cleanup시험에서down거부를 검증한다.
- `.gitignore`에 새worker credential과actor-secret 파일명도 추가했다. 최종 품질/전체API/브라우저는 소스변경을 멈춘 입력에서 순서대로 실행한다.

## 23:32 최종 검증 환경 확인

- 품질 profile14개 검사는 모두 통과했다(`2026-10-07T14-24-00.644Z-quality-5483.json`). 이후 소스 변경 없이 전체 API와 Docker 브라우저를 순서대로 검증한다.
- API 직접 URL mailbox의 Java fixture는 안전 경계상 loopback55449의 임의 `nest_*` DB만 허용한다. 개발DB5439를 사용한 실행은 `ISOLATED_MAILBOX_DATABASE_REQUIRED`로 실패했으며 권한/업무 로직 실패가 아니다. fixture guard를 변경하지 않았다.
- 새 작업 소유 시험 컨테이너 `blariyo-discord-review-test-20261007`(label `blariyo.task=discord-review-20261007`, loopback55449, 기존PG18 image digest)을 만들었다. 기존5439 개발DB와 이전 중지 컨테이너는 보존했다. 전체API는 해당 전용 환경에서 재실행한다.
- 운영 기존 백업 service 실행 성공: 2026-10-07T14:25:51Z 암호화 백업, SHA256 `aefcd65c789457c8582061f9fa836fdd3dc889c9fe93f15a03311841c0f04a48`. 새 선택 백업 runner로 전환하지 않았다. 선택 백업 실암호화 시험은 전용 fixture/age 도구 입력이 없어 미실행이며 기존 DB 역할 시험의 dump·복원 검증과 구분한다.
- 로컬 AC 전원에서 새벽 실행을 위해 기존 렌더링한 `com.blariyo.local-collection.awake.plist`를 등록했다(`/usr/bin/caffeinate -s`). 화면 설정이나 배터리 사용 중 절전 정책은 바꾸지 않았다. 복구 시 해당 LaunchAgent도 경로 확인 후 재등록한다.

## 23:35 API 최종 통과

- 최종 동일 입력 digest `f7adea6464ff3f904e369c56292622f175c29194db09d4fd3af637c1c21a6c78`에서 quality14검사(CI16·common88 포함)와 API149건 모두통과, 실패/skip/todo0. APIreceipt `2026-10-07T14-31-50.636Z-api-25307.json`, problems없음.
- API149에는 새 Discord 검수 HTTP·workflow·cleanup/after-commit 회귀와 기존 직접 URL mailbox, 전체schema dump/복원 검사가 포함된다. 55449 fixture 환경으로 재실행했으며 코드/테스트 기대값을 추가 변경하지 않았다.
- Docker 브라우저 profile은 위API 완료후build부터 순차실행중이다. 최종 source를 변경하지 않고 배포 준비를 계속한다.

## 23:40 브라우저 회귀 원인·보완

- 전체 Docker 브라우저88건 중87통과/1실패, skip0. 기존 관리자 features 응답의 정확 비교가 새 `discordReview:false` 기본값을 기대하지 않아 실패했다. 별도16건 재현에서 같은1건 실패와 실제 응답diff를 확인했다.
- 승인된 기능 flag 계약에 맞게 기대 객체에 `discordReview:false`를 추가했다. 정확 비교와 인증·404·비노출 검증은 유지했다. 나머지15건의 기존 검수/중복/발행복구/화면검사는 재현에서도통과했다.
- 최종 입력이 바뀌었으므로 quality→API→browser-docker를 다시 순차 실행한다. 이전 receipt는 당시 입력의 증거로 보존한다.
- 로컬 개발 LaunchAgent를 검증된 새빌드로 재시작한 뒤 readiness READY, 전용worker check COMPLETED를 확인했다.

## 23:44 최종 재검증 진행

- feature 응답 기대값 보완 후 입력 digest `7eda8fe6d43f1e63c7aa6d3962f39663628bece10321a9490b9fa1a3ffbf28be`에서 quality14검사와 API149건 재통과, 문제/실패/skip/todo없음.
- receipt: `2026-10-07T14-40-06.614Z-quality-28522.json`, `2026-10-07T14-41-05.393Z-api-46226.json`. 브라우저 최종 재실행중.
- 운영 수집 preflight READY, 기존활성source15개·동시source1·최대2시간, 다음실행2026-10-08 04:30KST를실제systemd에서확인했다. 기존예약/수집본체는이번점검에서변경하지않았다.

## 23:49 로컬 최종 검증 완료·Git 전달

- 최종입력 digest `7eda8fe6d43f1e63c7aa6d3962f39663628bece10321a9490b9fa1a3ffbf28be`: 품질14검사, API149건, Docker브라우저88건 통과. 실패/skip/todo0·receipt problems없음. 브라우저receipt `2026-10-07T14-43-53.811Z-browser-docker-47926.json`.
- Collector Java 소스는304건·DBreadback20건 통과 이후 변경하지 않았다. DB역할·dump/복원 경계 및 실제로컬Discord 메시지/관리자반려/삭제복구 증거는 앞선기록과구분해유지한다.
- fresh fetch의 origin/main `b57724dbb6309fc07f76c49e4a9e69d5708215cd`, origin/release `1c255a9ba261903c6a64804edb29ef0fa0b70da1`을확인했다. origin/release는현재HEAD의조상이다.
- 이세션변경만 scoped stage하고 기존 `worklog/2026-10-06/discord-admin-review/README.md`는제외했다. actual환경JSON/token은Gitignore, secret패턴검사0, diff/cached diff check통과. hook상태정상.
- 이제 feature commit→release FF통합·push→GitHub GUI의release→main PR전체검증·merge→mainimage검증을진행한다. 다른세션수정담당없음을기존기록과현재상태에서확인했다.

## 23:51 Git·PR 전달

- 구현 commit `7df63deef5a48b836841dc96d4afb69aadee4a60`에서 staged계약hook통과. release는origin/release→feature순서로FF통합했으며충돌없음. feature/release 원격push완료, main직접push없음.
- GitHub GUI에서 [PR #18](https://github.com/JeahaOh/blariyo/pull/18) 생성: base main@b57724d, head release@7df63de,4 commits/153files. 앞선운영수집예약·운영관찰기록3커밋도포함되며이번검증의기준선이었다.
- PR전체검증대기. 브랜치를 feature/discord-review로되돌려 후속실행기록만작성하며release후보를변경하지않는다.
