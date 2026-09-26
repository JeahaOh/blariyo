# 첨부 수집과 공개 화면 전수 검증 — 2026-09-23 후속

이 기록은 같은 날짜의 `local-3000-review-2026-09-23.md` 이후 실행이다. 이전 기록의
70글/258이미지, 수집103건/첨부0을 삭제하거나 현재 값으로 소급 변경하지 않는다.
환경은 로컬 PostgreSQL `blariyo_local:5439`, Web3000/Core3100, 로컬 object store다.
원격 S3/R2 또는 Discord Gateway를 검증한 결과가 아니다.

## 실제 인벤 첨부 누락 수정

- 공개 URL: https://www.inven.co.kr/board/black/3584/51253
- 기존 parser는 본문 밖 `#tbArticle > .articleFile a[href]`의 ZIP 2개를 놓쳤다.
  `inven-ordered-v2`는 표시명·URL을 본문 앞에 보존하며 anchor의 다운로드 아이콘을 이미지로 수집하지 않는다.
  한글 charset을 해석하고 UTF-8로 다시 전달한다. 중복 링크는 본문에 유지하되 첨부 다운로드 후보만 중복 제거한다.
- 추가 실제 fixture: 같은 글의 외부 첨부 2개, lostark/4821/104384의 첨부 영역·본문 반복 URL 1개.
  총 observed HTML은 36개다. 정제본은 원문·개인정보·미디어 주소를 재배포하지 않는다.
- run `a4acee83-4f31-499a-a79f-3fb3859b3cb1`, item `71e37810-61ac-481f-a187-bbfd5c5afe76`:
  FETCHED, 본문38블록, 이미지8개, FILE2개, 실패0. raw/report/checkpoint/ledger/media readback 통과.
- ZIP 크기 3,158,739 / 3,049,350 bytes. DB hash·크기 일치, ZIP 서명 및 두 파일 각19 entry CRC 검사 통과.
  압축 파일을 디스크로 풀거나 포함 코드를 실행하지 않았다. 악성코드 검사 완료라는 의미는 아니다.
- 실제 상세 dry-run은 DB12테이블과 당시 collect object527개 해시를 변경하지 않았다.

## 정식 검수와 공개

3000 BFF 경로의 `batch-review.mjs`로 REVIEWING(lock1) → APPROVED(lock2) → DRAFT를 실행했다.
111번 초안은 private8개 해시 일치, public key0개, 공개API404였다. 별도 publish 요청 뒤 PUBLISHED/lock2가 됐다.
원문38블록과 파일 표시명·원문URL을 보존했고, 첨부 bytes는 collect에만 남았다.

Chrome `http://localhost:3000/meme/posts/111`에서 이미지8개 로드, ZIP 원문링크2개,
collect 다운로드 링크0개를 확인했다. 관리자 화면의 버튼 조작을 검증한 것은 아니다.
백업: `.local-data/backups/before-inven-attachment-review-20260923.dump`.
반복 승격은 같은 요청 key로 영수증을 조회한다. 공개 철회가 필요하면 별도 hide 명령을 사용하며 DB를 직접 삭제하지 않는다.

## 현재 수치

| 항목               | 검증 결과                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------- |
| 수집 DB            | 17출처, FETCHED104건, 이미지380, FILE2, SNS21, 불일치0                                    |
| 공개 API/DB/object | 71글, 이미지266, 본문71, SNS10 누락0, 실패0                                               |
| 목록               | 4페이지, 고유71건, 누락·중복0                                                             |
| 실제 Chrome 상세   | 목록에서 찾은71개 URL 전부 방문; article 제목 표시, 이미지266 로드, 깨짐/미완료/가로넘침0 |
| 비공개 경계        | 초안110과 숨김80/81의 공개API404, collect/private 임의경로404                             |

브라우저 전수 검사는 각 페이지의 렌더링된 DOM과 이미지 로드를 검사했다. 모든 페이지를 개별 스크린샷으로
육안 대조했다는 뜻은 아니다. 111번 화면은 별도 스크린샷으로 확인했다. 접속 과정에서 조회수가 증가할 수 있다.

## 재현 설정과 문서 정정

- 운영 readback manifest 2곳에서 일반목록9출처의 `hot`을 `latest`로 정정했다(소형 샘플의 웃긴대학 포함 총10항목).
  잘못된 chart로 실행되던 오류를 회귀 테스트에서 먼저 재현한 뒤 수정했다. 운영 manifest 자체는 실행하지 않았다.
- 기획의 metadata 조건부 상세 fetch를 현행 전체 본문 수집으로 정렬했다. Core 후보 제출·임시 preview·Spring 전환은
  legacy로 명시했고 일반 목록 정책을 빠뜨린 분기에 GENERAL_LIST를 추가했다.
- 초기 임시 DB의 source 승인 플래그·절단 보정·text-only 판정은 과거 증거로 분리했다.

## 실행 검증

- Java 최종 테스트 XML:170개 중154통과/환경skip16/실패0. 이 수치는 첨부 parser 수정 직후 실행 결과다.
- API/Web unit32/32, 격리 PostgreSQL batch review14/14, API/Web lint, API test typecheck 통과.
- source schema/registry/readback-manifest3/3 통과. 신규 manifest 검사는 수정 전 실패를 확인했다.
- `verify-batch-run.mjs a4acee83-4f31-499a-a79f-3fb3859b3cb1` 통과.
- `verify-collector-inventory.mjs`, 발행 후 `verify-collected-content.mjs` 통과.
- 검증 증거는 `.local-data/verification/`의 `collector-inventory.json`, `collected-content.json`,
  `browser-all-posts-20260923.json`, `dry-run-inven-detail.json`, `inven-attachment-detail.json`,
  `inven-attachment-draft.json`, `batch-run-a4acee83-4f31-499a-a79f-3fb3859b3cb1.json`에 있다.

## 남은 경계

관리자 브라우저 인증은 저장된 브라우저 권한의 세션 적용 제한 때문에 사용자 로그인 필요 상태다.
인증 경계를 우회하지 않았다. 정식 API 명령 검증과 관리자 UI 버튼 검증을 구분한다.
fmkorea/ppomppu/pgr21/youtube-community의 기존 접근·renderer 차단은 이번에 재요청하지 않았으며 그대로 미완료다.
Discord Gateway와 운영/공유 개발 S3/R2 실연동 역시 별도 미검증이다. commit/push/배포는 하지 않았다.

## Migration·권한·환경 후속 감사

- 현재 로컬 DB ledger: API V001–V008, Collector V001–V006. batch item/media 및 API review guard trigger 존재 확인.
- 실제 권한 조회: batch content INSERT=false, batch review UPDATE=false, API item UPDATE=false, API item SELECT=true.
  trigger 존재 검사는 동시성 테스트를 대신하지 않는다. 제약·경합·복구 실행 증거는 앞선 격리 통합 테스트와 진행 기록을 함께 따른다.
- `.env.dev/.stage/.prod.example`의 API HOST는 Docker 내부 접속 예시에 맞게 `0.0.0.0`으로 정정했다.
  기존 `127.0.0.1`은 다른 컨테이너의 `api:3100` 연결을 받을 수 없었다. local 직접 실행은 loopback을 유지한다.
  API 포트 공개나 실행 중 서버 변경은 하지 않았다.
- `environment-config.test.mjs`는 Core 포트/주소·서비스 token 일치, 기본 검수 비활성,
  collect/private/public bucket 분리와 API collect reader 별도 자격증명 예시를 검사한다.
  최초 테스트는 env 변수명 정규식이 R2의 숫자를 제외해 실패했고 이를 수정했다. 최종 source/config 테스트4/4 통과.
  이 검사는 원격 dev/stage/prod 실제 연결·권한·배포를 증명하지 않는다.

## 21개 출처별 현재 증거

목록·상세 구현은 각 사이트 adapter를 사용한다. 아래 실제 fixture는 저장된 관측 구조이며 이번 재접속을 뜻하지 않는다.
17출처는 기존 live 저장 원본을 재검사했고 인벤에만 이번 신규 첨부 수집이 추가됐다. 4개 차단 출처의 synthetic 테스트를 실제 HTML 검증으로 집계하지 않는다.

| source            | 정책         | 실제 목록/상세 fixture | FETCHED / 이미지 / FILE / SNS | DB/object           | 상태                                       |
| ----------------- | ------------ | ---------------------- | ----------------------------- | ------------------- | ------------------------------------------ |
| arcalive          | HOT_LIST     | 있음/있음              | 7 / 17 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| bobaedream        | HOT_LIST     | 있음/있음              | 4 / 10 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| clien             | GENERAL_LIST | 있음/있음              | 4 / 0 / 0 / 1                 | 통과                | verified-local 저장 원본                   |
| dcinside          | HOT_LIST     | 있음/있음              | 5 / 175 / 0 / 0               | 통과                | verified-local 저장 원본                   |
| dmitory           | GENERAL_LIST | 있음/있음              | 10 / 14 / 0 / 8               | 통과                | verified-local 저장 원본                   |
| dogdrip           | HOT_LIST     | 있음/있음              | 4 / 14 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| etoland           | GENERAL_LIST | 있음/있음              | 4 / 1 / 0 / 1                 | 통과                | verified-local 저장 원본                   |
| fmkorea           | BLOCKED      | 없음/없음              | 0 / 0 / 0 / 0                 | 본문 성공 증거 없음 | blocked: HTTP430/보안 페이지               |
| goodgag           | GENERAL_LIST | 있음/있음              | 9 / 10 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| humoruniv         | GENERAL_LIST | 있음/있음              | 6 / 18 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| instiz            | GENERAL_LIST | 있음/있음              | 5 / 19 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| inven             | HOT_LIST     | 있음/있음              | 5 / 12 / 2 / 1                | 통과                | verified-local 저장 원본                   |
| mlbpark           | GENERAL_LIST | 있음/있음              | 5 / 2 / 0 / 0                 | 통과                | verified-local 저장 원본                   |
| natepann          | GENERAL_LIST | 있음/있음              | 5 / 10 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| pgr21             | DETAIL_ONLY  | 없음/없음              | 0 / 0 / 0 / 0                 | 본문 성공 증거 없음 | blocked: Anubis 연결 확인                  |
| ppomppu           | BLOCKED      | 없음/없음              | 0 / 0 / 0 / 0                 | 본문 성공 증거 없음 | blocked: 302→403                           |
| ruliweb           | HOT_LIST     | 있음/있음              | 5 / 12 / 0 / 0                | 통과                | verified-local 저장 원본                   |
| theqoo            | HOT_LIST     | 있음/있음              | 5 / 4 / 0 / 0                 | 통과                | verified-local 저장 원본                   |
| todayhumor        | HOT_LIST     | 있음/있음              | 7 / 37 / 0 / 1                | 통과                | verified-local 저장 원본                   |
| yuldo             | GENERAL_LIST | 있음/있음              | 14 / 25 / 0 / 9               | 통과                | verified-local 저장 원본                   |
| youtube-community | DETAIL_ONLY  | 없음/없음              | 0 / 0 / 0 / 0                 | 본문 성공 증거 없음 | unverified: HTTP200이나 본문 renderer 없음 |
