# 지속적인 로컬 개발 서버

프로젝트 루트에서 Node 24.18.0을 사용한다. 운영 설정·운영 DB를 사용하지 않는다.

```sh
# nvm을 쓰는 macOS/Linux: 저장소 .nvmrc의 24.18.0 선택
nvm use
node --version # v24.18.0 확인
docker compose up -d postgresql
npm run build
node scripts/local/seed-policies.mjs --apply
node scripts/local/start-development.mjs
```

- 화면: `http://localhost:3000/meme`, 약관 `/terms`, 개인정보 `/privacy`.
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
- 시작 스크립트는 게시글 상태를 변경하지 않는다. 2026-09-23 11:37 KST 재검증 데이터는 17개 사이트의
  공개 게시글 69개와 이미지 208개다. 이 수치는 고정 초기 seed가 아니며 검증 스크립트로 현재 DB를 다시 확인한다.
- 로컬 관리자 cookie 검수용 토큰은 Git 제외 `.local-data/development/session.json`에 권한 600으로
  저장한다. 매 실행마다 바뀌며 로그에 출력하지 않는다. 운영 Access 인증을 대체하는 도구가 아니다.
- 멱등 요청의 관리자 식별용 비밀값은 Git 제외 `.local-data/development/actor-secret`에 권한 600으로 보존한다. 서버 재시작으로 이 값을 바꾸지 않는다. 파일이 손상되면 자동 재발급하지 않고 시작을 중단한다. 이 파일을 삭제·교체하면 과거 관리자별 멱등 영수증을 같은 사용자로 조회할 수 없다. 이 보존 기능 도입 전의 임시 식별값으로 만든 영수증은 자동 이전하지 않는다.
- 수집 초안은 이미지가 많으면 15초 이상 걸릴 수 있다. Web 대기 시간은 초안 180초·이미지 preview 60초이며 API는 이미지 준비 120초 예산을 검사한다. 응답 유실 시 원래 요청 키·본문 그대로 재시도하고, 새 키로 중복 생성하지 않는다. 처리 시간의 세부 경계는 [수집 시간 계약](../../docs/system-design/07-spring-collector-design.md#2026-09-23-다중-이미지와-수집-용량-계약)을 따른다.
- 종료는 실행 터미널에서 Ctrl+C. Web/Core만 종료하며 개발 DB·정책·초안은 남긴다.

자동 브라우저 검사의 `browserFixture()`는 별도 임시 DB와 가짜 정책을 사용하는 검사 도구다.
지속적인 개발 서버나 실제 정책 확인 용도로 안내하지 않는다.

### 로컬 관리자 화면 열기

서버를 시작한 다음 Node 24.18.0으로 실행한다.

```sh
node scripts/local/open-admin.mjs
# 읽기 전용 UI/API smoke 및 화면 캡처만 수행:
node scripts/local/open-admin.mjs --verify
```

기존 로컬 세션 파일을 메모리에서 읽어 별도 Chromium 창에 인증한다. 토큰을 출력하거나 URL에 넣지
않고 브라우저를 닫으면 종료한다. 일반 Chrome에서 `/admin`을 바로 열면 세션이 없어 인증 안내가
나오는 것이 정상이다. 이 도구는 localhost:3000 전용 테스트 인증이며 실제 운영 Access 인수와 구분한다.
`--verify`는 기존 글을 조회하고 빈 편집기만 열며 저장·발행하지 않는다. 결과는 Git 제외
`.local-data/verification/admin-core-3000.json` 및 같은 이름의 PNG에 남긴다.

## 2026-09-23 수집 게시글 정합성 복구

현재 기본 접속 주소는 `http://localhost:3000/meme`다. 저장소 루트에서 실행한다.
기존 게시글을 삭제하지 않으며, 아래 복구는 고정 로컬 DB `127.0.0.1:5439/blariyo_local`만 사용한다.

```sh
node scripts/local/repair-collected-media.mjs --dry-run
node scripts/local/repair-collected-media.mjs --apply
node scripts/local/verify-collected-content.mjs
# 복구 이전 private key / public key / MIME으로 되돌려야 할 때만:
# node scripts/local/repair-collected-media.mjs --rollback
```

복구 전 `.local-data/repairs/collected-media-v1.json`과 별도 비공개 objects 디렉터리에 이전 DB 값과
공개 파일을 보관한다. 기존 경로를 덮어쓰지 않고 전체 hash/size/실제 format/dimensions/decode 사전 검증,
행 compare-and-set 뒤 새 private 경로를 연결한다. PNG로 잘못 기록된 JPEG의 확장자·MIME도 함께 정정한다.
새 공개 key가 연결된 뒤 이전 공개 key는 회수해 숨김 시 우회 경로가 남지 않게 한다.
반복 적용은 이미 같은 값이면 변경 0건이다. backup/manifest는 Git 제외이며 외부에 공개하지 않는다.
검증 결과는 `.local-data/verification/collected-content.json`에 저장한다.

기존 애니메이션 복구 검사는 원본 프레임을 자르지 않는다. 오프라인에서 프레임당 40M pixel,
최대 1000프레임 및 전체 RGBA 256MiB 안에서 디코딩한다. 신규 이미지 업로드 검증과는 구분한다.
이 복구는 정식 batch 검수·승격·발행 검증을 대신하지 않는다.


2026-09-23 이전 로컬 승격에서 빠진 링크 설명 5건은 별도 고정 대상 복구로 처리한다.
`--apply` 전에 `.local-data/repairs/collected-labels-v1.json`에 원래 블록과 원문 digest를 저장하며,
원래 블록 ID를 유지하고 설명 블록만 추가한다. 대상이 바뀌었으면 중단한다.

```sh
node scripts/local/repair-collected-labels.mjs --dry-run
node scripts/local/repair-collected-labels.mjs --apply
node scripts/local/verify-collected-content.mjs
# 해당 스크립트가 추가한 설명만 되돌릴 때:
# node scripts/local/repair-collected-labels.mjs --rollback
```

검증 스크립트는 수집 DB의 본문·링크 설명·이미지 순서와 공개 게시글을 대조한다.
원문 HTML 전체와 parser 출력의 일치, 21개 사이트 live 성공 여부는 별도 검증이다.

공개 전 수집 원본까지 전수 readback하려면 `node scripts/local/verify-collector-inventory.mjs`를 실행한다.
고정 로컬 DB의 단일 읽기 전용 snapshot에서 모든 FETCHED item의 canonical hash/중복,
본문과 IMAGE/FILE/SNS 대응, raw 존재, media hash/크기/MIME/디코딩을 검사한다.
결과는 `.local-data/verification/collector-inventory.json`에 기록한다. 진행·실패 item은 완료로 세지 않는다.
GIF 디코딩 자원 한도 초과와 파일 부재·손상, MIME 불일치는 서로 다른 실패 코드다.
이 검사는 실행별 report/checkpoint 검사인 `verify-batch-run.mjs RUN_UUID`를 대체하지 않는다.

### 개발 데이터를 건드리지 않는 Collector DB 회귀 테스트

```sh
# JDK25와 Node24.18.0, 로컬 PostgreSQL5439가 준비된 상태에서 실행
node scripts/test-collector-readback.mjs
```

이 명령은 `postgres` 관리 DB에 접속해 무작위 이름의 임시 DB를 만들고 Java 전체 테스트에
`COLLECTOR_READBACK_DATABASE_URL`을 주입한다. migration·source 소유권·queue 확인/재시작·backoff·중복
테스트가 DB 환경 부재로 생략되지 않게 한다. `blariyo_local`은 테스트 대상이 아니며 종료 시 자신이 만든
DB만 제거한다. 프로세스 강제 종료 등으로 정리가 실패하면 출력된 `blariyo_collector_test_*` 이름을 확인한 뒤 정리한다.
외부 사이트 네트워크는 fixture로 대체하므로 이 테스트를 live 수집이나 Discord Gateway 검증으로 집계하지 않는다.

## 정식 batch 검수 실행

저장소 루트에서 실행한다. DB는 동일한 `blariyo_local`을 사용하지만 API와 batch의 로그인 role은
분리한다. 준비 명령은 사전 pg_dump 백업 후 migration/grant를 적용하고 자격 증명을 Git 제외 파일에
권한600으로 저장한다. API는 batch 결과를 SELECT만, batch는 content/검수 테이블에 접근할 수 없다.

```sh
npm run build
./apps/collector/gradlew -p apps/collector bootJar --no-daemon
node scripts/local/prepare-batch-review.mjs --apply
# 과거 임시 collect object를 옮길 때만 추가: --import-root=/absolute/path/to/old-objects
node scripts/local/start-development.mjs
```

다른 터미널에서 실행한다. 로컬 wrapper는 DB5439, 제한 batch role과
`.local-data/collector-objects`를 고정해 사용하며 API를 호출하지 않는다.

```sh
node scripts/local/run-batch.mjs batch --source yuldo --chart latest --max-pages 1 --max-items 1 --since 24h --dry-run
node scripts/local/run-batch.mjs batch --source yuldo --chart latest --max-pages 1 --max-items 1 --since 24h --write-db
node scripts/local/batch-review.mjs list yuldo
node scripts/local/batch-review.mjs detail ITEM_UUID
node scripts/local/batch-review.mjs review ITEM_UUID --item-version=N --lock-version=0 --decision=REVIEWING --key=UNIQUE_REVIEW_KEY
node scripts/local/batch-review.mjs review ITEM_UUID --item-version=N --lock-version=1 --decision=APPROVED --key=UNIQUE_APPROVAL_KEY
node scripts/local/batch-review.mjs draft ITEM_UUID --item-version=N --lock-version=2 --key=UNIQUE_DRAFT_KEY
# 위 응답의 postId와 lockVersion을 사용. reviewLockVersion과 혼동하지 않는다.
node scripts/local/batch-review.mjs publish POST_ID --lock-version=POST_VERSION --key=UNIQUE_PUBLISH_KEY
```

`N`/UUID/버전은 실제 조회 응답으로 대체한다. 동일 요청의 통신 실패 재시도에는 같은 `--key`를 사용한다.
기존 원문에 연결된 게시글이 있으면 중복 승격은409다. 검수/초안 생성과 발행은 별도 명령이며 자동 발행하지 않는다.
관리자 화면은 `/admin/batch`; HTTP 전수 검증과 실제 관리자 브라우저 조작의 증거는 구분한다.
율도는 일반 유머/이슈 목록이므로 `--chart latest`를 사용한다. `hot`을 요청하면 미지원으로 거부한다.
CLI는 로컬3000의 현재 관리자 세션 파일을 읽으며 토큰을 출력하지 않는다.
PowerShell도 위 `node scripts/local/*.mjs` 명령을 사용하고 Gradle 빌드만
`.\apps\collector\gradlew.bat -p apps/collector bootJar --no-daemon`으로 실행한다.

### 실행 중 재빌드와 이미지 검수

`run-batch.mjs`는 실행마다 현재 Collector JAR의 비공개 사본을 만들고 종료 시 해당 사본만 회수한다.
따라서 다른 터미널에서 bootJar를 다시 빌드해도 실행 중인 Spring nested JAR가 교체되지 않는다.
Web도 시작 시 빌드 사본을 사용하므로 새 소스 반영에는 이 저장소의 로컬 서버 재시작이 필요하다.

수집 이미지 preview와 DRAFT 승격은 일반 업로드와 분리된 검증 함수를 공유한다. GIF 최대500프레임,
30MiB 파일/글 전체150MiB/256MiB RGBA 추정량 한도를 적용하며 원본 프레임·재생 간격을 버리지 않는다. 일반 관리자 업로드는 파일당10MiB다.
일반 업로드는200프레임 제한을 유지한다. 검수 화면은 이미지 실패 안내·원문 링크·다시 불러오기를 제공한다.

일반 목록에는 `--chart latest`, Hot/베스트에는 `--chart hot`을 사용한다. 생략하면 source의 defaultChart다.
`--since 24h`와 `datePolicy=INCLUDE_UNKNOWN`의 조합은 시각 미확인 글을 포함하므로 report의
unknownDates/skippedByDate도 확인한다. 엄격한 기간 검증에는 REQUIRE_KNOWN을 사용한다.

로컬 dry-run 무쓰기 검증(다른 collector 실행이 없을 때):

```sh
node scripts/local/verify-dry-run.mjs yuldo
node scripts/local/verify-dry-run.mjs inven https://www.inven.co.kr/board/black/3584/51253
```

collect 수집/검수/queue/confirmation/정정 이력 12테이블의 전체 행 해시와 collect object 전체파일 해시를 전후 대조한다.
실제목록/상세 요청은 발생하며 결과는 `.local-data/verification/dry-run-yuldo.json`이다.
선택적인 두 번째 인자가 있으면 목록 batch 대신 `collect-url --dry-run`을 실행하고
결과를 `dry-run-{source}-detail.json`에 저장한다. URL은 공개 HTTPS 상세 URL이어야 한다.
이 검증은 DB와 object 무쓰기를 확인하며 네트워크 요청이나 진단 보고서 파일 생성까지 금지하는 뜻은 아니다.

### Collector V003/V004 적용과 실행 소유권

`prepare-batch-review --apply`는 백업 후 Collector V006까지와 API V008 migration을 명시적으로 적용한다.
Collector JAR를 먼저 빌드하고 실행 중인 batch가 없는 상태에서 적용한다. 자동 서버 시작은 migration을 실행하지 않는다.
PostgreSQL은 직접 연결하거나 session pooling을 사용한다. transaction pooling은 source session 잠금을 보장하지 못하므로 지원하지 않는다.
잠금을 얻은 연결이 끊기면 해당 실행은 새 연결로 쓰기를 이어가지 않는다. 다음 실행이 이전 RUNNING을
BATCH_OWNER_LOST로 정리하고 미완성 item만 재시도하며 FETCHED snapshot은 보존한다.

신규 media key는 `collect/media/{runId}/{itemId}/{position}`이며 기존 key는 읽기 호환된다.
종료 report의 key/hash/JSONL 행 수는 batch_report에, 진행/최종 상태는 batch_checkpoint에 저장한다.
`node scripts/local/verify-batch-run.mjs RUN_UUID`가 실제 object bytes와 두 테이블 및 run 상태를 대조한다.
V003 이전 실행은 ledgerRequired=false로 명시하며 과거 미작성 report를 소급 생성하지 않는다.

V004부터 상세 요청 전에 item을 등록하므로 삭제·접근 제한·parse 실패를 항목별로 조회할 수 있다.
기간 밖/작성시각 미확인 제외는 SKIPPED_POLICY이며 실패 건수와 구분한다. API 검수 화면은
failureCode 또는 skipReason을 보여 주며 FETCHED 이외의 항목을 승인·승격하지 않는다.

### V005 대기열 실행

API와 Collector를 빌드한 뒤 `node scripts/local/prepare-batch-review.mjs --apply`로 백업·migration·role 검증을 수행한다.
`node scripts/local/run-batch.mjs queue --once --write-db`는 같은 로컬 DB/object 설정으로 한 요청을 처리하거나 복구한다.
상시 worker는 `queue --write-db`, Gateway 포함 실행은 `discord --write-db`이다. 실제 Discord allowlist와 owner-only secret 디렉터리는 별도 설정하며 일반 개발 서버 시작에는 포함하지 않는다.

Gateway 자격 없이 로컬 확인 서비스/worker만 검증할 때:

```sh
./apps/collector/gradlew -p apps/collector fixtureClasspath
node scripts/local/verify-queue-intake.mjs 'https://공개-출처의-실제-상세-URL'
node scripts/local/run-batch.mjs queue --once --write-db
```

이 명령은 확인 receipt와 queue를 실제 로컬 DB에 저장한다. 실제 Discord 사용자 대신 검증용 HMAC을 사용하며 Gateway 연결을 증명하지 않는다. request 결과는 `.local-data/verification/queue-intake.json`에 기록한다. 실제 공개 URL과 승인된 source policy를 사용해야 하며 최종 run은 `verify-batch-run.mjs <runId>`로 DB/object를 readback한다.

Node 20에서는 `node build.ts`를 실행할 수 없다. Node 24.18.0을 설치한 뒤 현재 셸의 `node --version`을 확인한다. Homebrew 디렉터리 이름만으로 버전을 판단하지 않는다. PowerShell에서는 사용 중인 버전 관리자로 24.18.0을 선택한 뒤 같은 npm/node 명령을 실행한다.


### 고정된 공지 2건 숨김과 복구

`repair-notice-posts.mjs`는 이 로컬 DB의 이토랜드 공지 게시글 80·81번만 대상으로 한다.
원문 post key·본문 fingerprint·이미지 없음·lock version을 사전 대조하고 일반 관리자 API로 숨긴다.
다른 DB나 다른 post ID에 재사용하지 않는다.

```sh
node scripts/local/repair-notice-posts.mjs --dry-run
node scripts/local/repair-notice-posts.mjs --apply
# 원래 공개 상태로 되돌려야 할 때만 실행
node scripts/local/repair-notice-posts.mjs --rollback
```

첫 적용 전에 `.local-data/backups/before-notice-posts-v1.dump`와 고정 대상 manifest를 생성한다.
반복 `--apply`는 이미 숨긴 항목을 건너뛰며 DB 상태와 공개 API 404를 다시 확인한다.
`--rollback`은 정식 재발행 API로 공개 상태를 복원한다. 원래 발행 시각·version·감사 이력을
되감는 기능은 아니다. 복구 후 다시 숨기는 것은 이 manifest의 자동 재실행 범위 밖이다.
2026-09-23 실제 적용과 반복 적용(추가 변경 0건)은 확인했으며, 이 두 공지의 rollback은 실행하지 않았다.
백업만 생성되고 manifest 저장 전에 중단됐다면 자동 덮어쓰기하지 않고 멈춘다.
이 경우 기존 백업을 보존하고 DB 상태와 manifest 생성 전 중단 여부를 확인한 뒤 별도로 복구한다.

### 정식 검수·초안·별도 발행 확인

`batch-review.mjs detail ITEM_UUID`의 현재 item version과 review lock version을 확인한다.
아래 ID·version은 자리표시자이며 실제 응답값으로 바꾼다. 각 논리 요청의 KEY는 UUID이며,
응답 유실 재시도에서는 같은 KEY와 본문을 사용한다.

```sh
node scripts/local/batch-review.mjs review ITEM_UUID --item-version=ITEM_VERSION --lock-version=REVIEW_VERSION --decision=REVIEWING --key=KEY_1
node scripts/local/batch-review.mjs review ITEM_UUID --item-version=ITEM_VERSION --lock-version=NEXT_REVIEW_VERSION --decision=APPROVED --key=KEY_2
node scripts/local/batch-review.mjs draft ITEM_UUID --item-version=ITEM_VERSION --lock-version=APPROVED_REVIEW_VERSION --key=KEY_3
# 반환 postId를 관리자에서 확인한 뒤 별도 실행한다.
node scripts/local/batch-review.mjs publish POST_ID --lock-version=POST_VERSION --key=KEY_4
node scripts/local/verify-collected-content.mjs
```

초안은 private 사본만 만들고 공개 API에서 404여야 한다. 별도 발행 뒤 public key는
`content/published/posts/{postId}/...`이며 private/public 사본과 DB hash가 일치해야 한다.
2026-09-23 더쿠 표본 108번은 이 순서 및 같은 KEY의 초안 재전송을 실제 검증했다.
같은 source URL의 게시글은 1개이며 기존 수집 원본은 유지됐다.
이 로컬 표본은 운영 게시 허가나 R2/Gateway 실연동 검증을 대신하지 않는다.


### 과거 수집 이미지 MIME 정정 (V006)

`repair-collector-mime.mjs`는 이번에 확인한 todayhumor 7개 item의 IMAGE 12개만 다룬다.
대상 UUID/position은 스크립트에 고정돼 있고 파일의 실제 JPEG 형식·전체 디코딩·hash·size와
원래 DB snapshot을 확인한다. 새로운 대상이나 다른 환경에 그대로 재사용하지 않는다.

```sh
node scripts/local/repair-collector-mime.mjs --dry-run
# V006이 없으면 먼저 새 Collector JAR를 빌드하고 아래를 명시적으로 실행한다.
node scripts/local/prepare-batch-review.mjs --apply
node scripts/local/repair-collector-mime.mjs --apply
node scripts/local/verify-collector-inventory.mjs
# 잘못된 원래 MIME으로 되돌리는 유지보수 복구가 필요한 경우에만 실행
node scripts/local/repair-collector-mime.mjs --rollback
```

실행기는 고정 로컬 DB 소유자 연결을 사용한다. API/batch runtime role로 실행할 수 없다.
`--apply`는 소유자 전용 함수로 MIME과 append-only 정정 이력만 변경한다. 원본 object,
item 본문/상태/version, 공개 content와 과거 run report는 변경하지 않는다.
최초 쓰기 전에 private pg_dump와 manifest를 보관한다. 반복 apply는 추가 변경 없이 readback한다.
rollback은 새 revision과 감사 행을 남기며 과거 이력을 지우지 않는다. rollback 후 자동 재적용은
거부하고 별도 검토가 필요하다. 백업 파일만 남은 중단은 다음 실행에서 새 백업을 생성하되
기존 백업을 덮어쓰지 않는다. manifest가 있는 경우 원본 백업 hash까지 확인한다.

격리 DB 검증은 `node --test scripts/local/collector-mime-repair.test.mjs`다.
새 임시 DB/role만 생성·삭제하며 기존 개발 DB를 초기화하지 않는다. MIME 오류가 없어져도
애니메이션·첨부·다른 원본 검사가 남으면 inventory 전체를 통과로 표시하지 않는다.
