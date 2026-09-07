# 블라리요 콘텐츠 수집 기획

- 문서 상태: 수집 방법 제품 정본 · 출처별 검증 전
- 기준일: 2026-09-04
- 상위 정본: [서비스 기획서 §8](../01-service-plan.md#8-콘텐츠-수집)
- 화면 계약: [화면 설계](../03-screen-design.md)
- 기술 계약: [시스템 설계](../../system-design/README.md)
- 법무·출시 차단: [법무 문서](../../legal/README.md)

이 문서는 콘텐츠를 어디서 어떻게 후보로 가져오고, 어떤 순서와 조건으로 수집 기능을
활성화할지 결정한다. DB 자료형, endpoint payload, container와 cron 명령은 시스템 설계의
책임이다. 실제 출처별 URL·파싱·허용 범위는 이 디렉터리의
[출처 명세 템플릿](source-spec-template.md)으로 검증한 뒤 확정한다.

- `scraper`: 외부 공개 페이지를 요청해 수집 후보를 만드는 프로그램
- `collector`: 운영자 로컬 컴퓨터에서 실행하는 Discord 연결 scraper 프로세스. Discord 명령 수신,
  외부 페이지 fetch, parser 실행과 후보 결과 제출을 담당한다.
- `parser`: HTML·feed에서 URL·제목·이미지 후보를 추출하는 출처별 규칙
- `fixture`: parser가 같은 결과를 내는지 반복 확인하는 최소 테스트 샘플
- `feature flag`: 배포와 기능 활성화를 분리하는 전체 on·off 설정
- `metadata`: 원문·이미지 자체가 아니라 URL·제목·크기처럼 대상을 설명하는 정보
- `temporary image`: 운영자 검수 미리보기를 위해 Python extractor 작업 경로에만 두는 임시 이미지 파일
- `gate`: 다음 단계로 넘어가기 전에 반드시 통과해야 하는 확인 조건

## 1. 핵심 결정

1. 첫 공개는 수집 기능 없이도 운영 가능한 `M0 Core` 플랫폼을 먼저 완성한다.
2. 수집 기능의 첫 단계는 운영자 로컬 컴퓨터의 `collector`가 Discord `/collect url` 또는 관리자 화면
   URL 입력 작업을 받아 단일 상세 페이지 1건만 추출하는 방식이다.
3. 자동 수집기 전체를 먼저 만들지 않는다. 목록·feed·pagination·scheduler는 후속 `M0 자동 수집`
   단계로 분리한다.
4. 운영자의 수동 게시글 작성 경로는 항상 유지한다. 수집 장애가 공개 목록·상세와 수동 발행을
   중단시키면 안 된다.
5. 수집 결과는 후보일 뿐이다. 운영자 검수와 초안 승격 없이 게시글을 자동 발행하지 않는다.
6. M0 수집 보조는 페이지 단위 추출만 수행한다. 자동 목록 수집은 전역과 출처별로 기본 비활성이다.
7. 로그인, CAPTCHA, 유료 장벽, 접근 차단과 수집 거부를 우회하지 않는다.
8. 출처 이용약관은 자동 사용 결정 조건이 아니라 운영 위험 참고값으로 기록한다. 단, 확인하지 못한 출처 URL,
   `robots.txt`, 요청 간격과 연락 수단은 `(미정)`으로 두고 기능을 활성화하지 않는다.

## 2. 개발·활성화 단계

`M0`는 아래 세 단계를 묶는 상위 단계다. 첫 production 공개의 차단 범위는 `M0 Core`이고,
수집 보조와 자동 수집은 각각의 gate를 통과한 뒤 독립적으로 활성화한다.

| 순서 | 단계 | 포함 범위 | production 공개 차단 여부 |
| --- | --- | --- | --- |
| 0 | 수집 가능성 검증 | 출처 한 곳의 공개 목록·상세 구조, 허용 범위와 metadata 추출 가능성 확인 | 플랫폼 공개를 차단하지 않음 |
| 1 | M0 Core | 수동 초안·이미지·발행·숨김, 공개 목록·상세, 출처·정책·권리 대응 | 첫 공개 필수 |
| 2 | M0 수집 보조 | Discord `/collect url` 또는 관리자 URL 입력, 단일 상세 페이지 metadata 후보 생성, 검수·반려·초안 승격 | 별도 기능 활성화만 차단 |
| 3 | M0 자동 수집 | 후속 단계. 사용 결정된 출처 목록·피드 주기 확인, 후보 적재, 실패 시 자동 비활성 | 출처별 기능 활성화만 차단 |

수집 가능성 검증은 production scraper가 아니다. 실제 DB·후보 큐·scheduler에 연결하지 않고,
사용 결정된 공개 샘플에서 아래 공통 결과를 만들 수 있는지만 확인한다.

```json
{
  "originUrl": "https://example.com/posts/123",
  "title": "후보 제목",
  "imageCandidates": [
    { "remoteUrl": "https://example.com/images/123.jpg", "position": 1 }
  ],
  "sourcePublishedAt": null,
  "warnings": []
}
```

예시의 host와 값은 계약 설명용이며 실제 수집 출처로 사용 결정된 값이 아니다.

## 3. 수집 방법 선택

### 3.1 운영자 수동 작성

운영자가 제목, 본문 이미지와 출처 URL을 직접 입력한다. 외부 페이지를 서버가 자동으로 읽지
않으며 `M0 Core`의 기본 운영 경로다. 모든 수집 기능이 꺼지거나 실패해도 이 경로로 게시할 수
있어야 한다.

### 3.2 Discord·운영자 URL 단일 페이지 수집 보조

운영자가 관리자 화면에 공개 원문 URL을 입력하면 BE는 후보 작업을 `PENDING`으로 접수하고 외부
사이트를 직접 fetch하지 않는다. 운영자 로컬 컴퓨터에서 실행 중인 `collector`가 BE에서 대기 작업을
가져와 등록·활성 출처, robots, 요청 상한, SSRF 방어 gate를 확인한 뒤 해당 상세 페이지를 한 번
가져온다. Discord `/collect url:<원문URL>` 명령은 같은 로컬 `collector`가 Discord App으로 받아
BE에 URL 작업을 먼저 접수하고 해당 후보를 선점한 뒤 동일한 검증·추출 흐름을 실행한다. 제목과 이미지 후보 URL을 추출해 BE에 결과를 제출하면 관리자
검수 화면에 표시된다. Python extractor는 로컬 작업 경로에만 임시 파일을 만들 수 있고, BE·FE에는
내부 경로나 원본 binary를 결과 metadata에 넣지 않는다. 관리자 preview가 필요하면 별도 인증 업로드로 검증·재인코딩한 파일만 전달한다. 운영자는 값을 수정하고 사용할 이미지를 선택하거나 후보를
반려한다.

다음 조건에서는 자동 보정을 추측하지 않고 실패 사유를 보여준다.

- 등록·활성화되지 않은 host
- 금지되거나 확인하지 못한 경로
- 로그인·CAPTCHA·접근 제한이 필요한 페이지
- HTML이 아니거나 허용한 응답 크기·시간을 초과한 페이지
- 제목 또는 사용할 이미지 후보를 얻지 못한 페이지
- 허용하지 않은 host로 redirect되는 페이지

### 3.3 후속 자동 수집

자동 수집은 M0 수집 보조 범위가 아니다. 후속 단계에서 다음 우선순위로 출처별 방법을 선택한다.

| 우선순위 | 방법 | 선택 조건 | 초기 판단 |
| --- | --- | --- | --- |
| 1 | 공식 공개 API·feed | 운영 주체가 공개하고 수집 목적과 운영 위험을 확인함 | 가장 우선 |
| 2 | RSS·Atom | 원문 URL과 제목을 안정적으로 제공하고 운영 위험을 확인함 | 우선 사용 |
| 3 | server-rendered HTML 목록 | 인증 없이 HTML에 원문 링크가 있고 구조를 안정적으로 식별 가능 | 출처별 parser 필요 |
| 제외 | headless browser·로그인 자동화·차단 우회 | JavaScript 실행, 계정, CAPTCHA 우회가 필요함 | 초기 범위에서 사용하지 않음 |

후속 자동 수집 한 주기의 기본 흐름은 다음과 같다.

```text
전역·출처별 활성 여부 확인
  -> 사용 결정된 목록·feed 한 번 조회
  -> 원문 URL 정규화와 기존 후보·게시글 중복 제거
  -> 새 URL의 제목·이미지 후보 metadata 확인
  -> 목록·feed 정보가 부족한 새 URL만 허용 범위 안에서 상세 조회
  -> 후보 큐 저장
  -> 운영자 검수(승격 또는 반려)
```

목록 페이지의 과거 페이지를 무제한 순회하지 않는다. 초기 자동 수집은 출처 명세에서 사용 결정한
최신 범위만 확인하고, 이전 실행 이후 새 항목만 후보로 만든다. pagination, 최대 탐색 범위와
실행 간격은 출처 명세에서 따로 확정한다.

## 4. 후보 생성 규칙

### 4.1 공통 후보 정보

후보는 최소한 다음 정보를 가진다.

| 항목 | 규칙 |
| --- | --- |
| 출처 | 사용 결정된 출처 식별자와 표시명 |
| 원문 URL | 정규화한 `https` URL |
| 발견 방식 | M0 수집 보조는 `MANUAL_URL`. 후속 자동 수집은 `LIST_CRAWL` |
| 제목 | 원문에서 추출한 후보값, 운영자 수정 가능 |
| 이미지 후보 | 원격 URL·순서·추출 경고와 인증 preview 경로. DB에는 image binary를 저장하지 않음 |
| 원문 게시 시각 | 신뢰할 수 있을 때만 저장, 없으면 `null` |
| 요청·수집 시각 | BE 접수 시각과 collector 결과 제출 시각을 분리 |
| parser 버전 | 어떤 출처 규칙으로 추출했는지 추적 가능한 값 |
| 경고·실패 사유 | 누락, 차단, 구조 변경과 중복 판단 근거 |

후보 단계에서는 원문 HTML 전체, 댓글, 작성자 프로필과 불필요한 개인정보를 저장하지 않는다.
이미지는 Python extractor가 실행되는 로컬 작업 경로에 임시 파일로 둘 수 있고, 관리자 미리보기가
필요하면 collector가 BE private staging object로 24시간 preview를 업로드한다. DB에는 image binary를
저장하지 않는다. 임시 파일과 preview object는 후보 반려·만료·재시도 교체 시 삭제 대상이며,
운영자가 초안으로 승격하기로 결정한 이미지에 한해 관리자 업로드와 같은 검증·재인코딩 후 블라리요
저장소에 저장한다.

### 4.2 추출 우선순위

출처별 명세가 공통 규칙보다 우선한다. 출처별 규칙이 없을 때 임의의 selector를 production에
추가하지 않는다.

| 대상 | 공통 후보 순서 |
| --- | --- |
| 원문 URL | 사용 결정된 canonical URL, 없으면 정규화한 요청 URL |
| 제목 | 구조화된 feed 값, 사용 결정된 Open Graph 값, 출처별 제목 selector |
| 이미지 | 구조화된 feed enclosure, 사용 결정된 Open Graph 이미지, 출처별 본문 이미지 selector |
| 게시 시각 | 구조화된 feed 값 또는 출처별 명시 시각, 추정값 사용 금지 |

광고, 로고, 프로필, 이모티콘, 추천 콘텐츠, 공지와 추적 pixel은 이미지 후보에서 제외한다.
구체적인 제외 selector와 URL pattern은 출처 명세에서 관리한다.

### 4.3 중복 판정

- 정규화한 원문 URL이 같으면 같은 후보로 본다.
- tracking query, fragment와 불필요한 trailing slash 제거 범위는 출처별로 확정한다.
- redirect 뒤 canonical URL이 기존 후보와 같으면 새 후보를 만들지 않는다.
- 이미지 hash는 Python 임시 파일 또는 승격 시 다시 가져온 image binary를 검증·재인코딩하는 단계에서
  계산한다. 게시 확정 전 hash는 중복 경고용이며 영구 저장 증거가 아니다.
- 제목 유사도는 운영자에게 주는 경고일 뿐 자동 반려·승격 기준으로 사용하지 않는다.

## 5. 출처 등록과 운영 위험 판정 절차

출처 이름만 DB에 넣었다고 사용할 수 있는 것이 아니다. 출처마다
[출처 명세](source-spec-template.md)를 작성하고 다음 gate를 순서대로 통과한다. 이용약관은 자동
차단 조건이 아니라 운영 위험 판단 자료로 기록한다. `robots.txt` 금지, 차단 응답, 로그인·CAPTCHA·
유료 장벽 우회 필요, 요청 상한 초과와 SSRF 위험은 기술 gate로 유지한다.

1. **운영 후보 등록**: 출처명, 운영 주체, 기준 URL과 목적을 기록한다.
2. **정책·위험 확인**: 이용약관, `robots.txt`, 공개 API·RSS 제공 여부와 확인일, 운영 위험도를 기록한다.
3. **기술 검증**: 정상·빈 결과·삭제·차단·구조 변경 샘플에서 추출 결과를 확인한다.
4. **수집 보조 사용 결정**: Discord 또는 관리자 화면에서 입력한 상세 URL 한 건 조회의 사용 범위와 parser가 검증돼야 한다.
5. **후속 자동 수집 사용 결정**: 목록·feed 범위, pagination, 간격·일일 상한과 실패 중단 조건까지
   확정해야 한다.
6. **기본 비활성 배포**: parser와 설정을 배포해도 feature flag와 출처 활성값은 끈 상태로 둔다.
7. **제한 활성화**: 운영자가 소량 결과와 요청 로그를 확인한 뒤 해당 출처만 켠다.
8. **정기 재검토**: 구조, `robots.txt`, 이용약관 또는 응답 정책이 바뀌면 다시 판정한다.

수집 보조 사용 결정과 자동 수집 사용 결정은 별개다. URL 한 건을 보조할 수 있어도 목록 수집을 허용한
것으로 보지 않는다.

## 6. 운영자 검수

후보 화면은 다음 판단을 지원한다.

- 출처와 원문을 새 창에서 확인
- 후보 제목 수정
- collector preview 또는 원격 URL metadata를 통한 이미지 후보 확인과 사용할 이미지 선택
- 원문 URL·이미지·기존 게시글 중복 확인
- `중복`, `품질 부족`, `권리 위험`, `재미 없음`, `원문 삭제`, `기타` 사유로 반려
- parser 실패·차단 사유 확인과 재시도
- 선택한 후보를 게시글 초안으로 승격

parser가 가져온 제목·이미지는 신뢰된 게시물 값이 아니라 검수 후보값으로 표시한다. 내부 오류,
원문 HTML 전체, storage key와 보안 제한 상세는 화면에 노출하지 않는다.

## 7. 실패와 중단 원칙

- `403`, `429`, `robots.txt` 금지, timeout과 구조 파싱 실패를 출처별로 기록한다.
- 연속 실패 기준을 넘으면 자동 수집만 끄고 수동 작성 경로는 유지한다.
- 재활성화는 운영자가 원인을 확인하고 출처 명세의 확인일·parser version을 갱신한 뒤 수행한다.
- 목록 수집 실패를 무한 재시도하지 않는다.
- 외부 응답 HTML과 이미지 binary, Python 임시 파일 경로의 내부 절대 경로를 application log에 기록하지 않는다.
- 출처가 삭제·차단·이용 조건 변경을 요청하면 자동 수집을 먼저 끄고 기존 게시글은 권리 처리
  절차에 따라 판단한다.

## 8. Discord 보고·실행 연동

Discord는 수집 시스템의 정본이나 실행 엔진이 아니라 운영 알림·명령 진입점으로 사용한다.
Discord가 중단돼도 scheduler, 관리자 화면, 수동 게시와 공개 서비스는 계속 동작해야 한다.

### 8.1 연동 방식

| 목적 | 방식 | 이유 |
| --- | --- | --- |
| 정기·실행 결과 보고 | Discord incoming webhook | 수집 시스템이 지정 채널로 단방향 메시지를 보내는 가장 단순한 경로 |
| 운영 명령 | Discord App slash command와 로컬 collector의 Gateway 연결 | 호출자·서버·채널과 URL option을 검증하고 응답할 수 있음 |

일반 webhook URL만으로 slash command를 받을 수 없다. M0에서는 Discord Application을 등록하고
운영자 로컬 collector가 Gateway `INTERACTION_CREATE` event를 받아 처리한다. Discord의 공식
[Interactions 문서](https://docs.discord.com/developers/interactions/receiving-and-responding)와
[Application Commands 문서](https://docs.discord.com/developers/interactions/application-commands)를
구현 시점에 다시 확인한다. Incoming webhook은 블라리요가 Discord로 결과를 보내는 발신 용도로만
사용하고, Discord에서 URL을 받는 수신 용도로 사용하지 않는다.

```text
정기 보고
로컬 collector
  -> 실행 결과 저장
  -> 보고서 생성
  -> Discord webhook

URL 후보 생성 명령
Discord /collect url:<원문URL>
  -> 운영자 로컬 collector의 Discord App 연결
  -> guild·channel·사용자 권한 검증
  -> 3초 안에 deferred response
  -> BE에 URL 작업 접수(PENDING)·후보 id 수신·작업 선점
  -> URL 정규화·출처 등록/활성·robots·요청 상한·SSRF gate 확인
  -> 단일 상세 페이지 fetch·parser 실행
  -> BE collector 제출 API로 후보 결과 전송
  -> 후보 id 또는 실패 사유 후속 응답
  -> 완료 결과는 보고 webhook으로 원래 운영 채널·thread에 전송
```

M0 수집 보조에서는 BE에 공개 Discord Interactions endpoint를 두지 않는다. Discord 연결, 명령 수신과
외부 fetch/parser는 운영자 로컬 `collector`가 담당하고, BE는 관리자 화면·후보 저장·검수·초안 승격
API만 제공한다. 긴 수집 작업은 Discord 응답 시간 안에서 오래 실행하지 않고 3초 안에 deferred
response를 보낸 뒤 로컬 collector job으로 처리한다.
job id는 15분 안에 interaction 후속 응답으로 알리되, 완료 보고에는 유효 시간이 15분인 interaction
token을 사용하지 않는다. 초기에는 명령 허용 channel과 결과 보고 webhook channel을 같은 운영 channel
한 곳으로 고정하고, thread에서 실행한 명령은 검증한 thread id를 job 실행 정보에 저장해 완료 보고
webhook의 대상으로 사용한다. Discord의 interaction id는 멱등 key로 사용해 같은 명령의 중복 실행을
막는다.

### 8.2 초기 명령 범위

| 명령 | 역할 | 상태 변경 |
| --- | --- | --- |
| `/collect url:<원문URL>` | 운영자가 지정한 URL 한 건으로 수집 후보 생성 | 있음 |
| `/collect status` | 최근 생성 job, 대기 후보, 실패·비활성 출처 요약 | 없음 |

초기에는 다음 명령을 제공하지 않는다.

- 일반 Discord 채널 메시지를 감시해 임의 URL을 받아 fetch
- 모든 출처를 한 번에 강제 실행
- 출처 신규 등록·삭제
- `robots.txt` 확인값, 요청 상한과 parser 설정 변경
- 비활성 출처 활성화 또는 운영 위험·기술 gate 우회
- 후보 검수·게시글 발행·숨김·삭제
- 목록 수집 강제 실행, 보고서 생성, 재시도, 반려

출처 활성화와 설정 변경, 후보 검수·발행은 관리자 화면에서만 처리한다. `/collect url`은 로컬
collector가 처리해 BE의 후보 결과 제출 API를 호출하며, 일반 메시지 감시나 BE 내부 scraper 경로를
만들지 않는다.

### 8.3 권한과 실행 통제

- 허용 Discord guild와 channel을 고정하고 DM·다른 서버 명령을 거부한다.
- Discord command permission은 노출 범위를 줄이는 1차 통제로 사용한다.
- 실제 실행 권한은 로컬 collector가 interaction의 guild, channel, user와 role을 내부 allowlist에
  대조해 다시 판단한다.
- 상태 변경 명령은 실행 대상·예상 요청 범위·현재 출처 상태를 보여준 뒤 확인 interaction을
  거친다.
- 확인 뒤에도 전역 feature flag, 출처 활성·운영 위험 판정 상태, robots, 요청 간격과 일일 상한을 다시 검사한다.
- Discord 호출자는 내부 `system:collector` 권한을 직접 받지 않는다. 로컬 collector가 collector
  service token으로 수집 command를 실행하고 Discord user id는 감사 actor로만 연결한다.
- interaction id, Discord user id, guild·channel id, source key, 요청·확인·시작·종료 시각,
  결과와 job id를 감사 기록으로 남긴다. 일반 메시지 content는 저장하지 않는다.

Discord webhook URL, bot token과 collector service token은 서로 분리한 secret으로 관리한다.
application·guild·channel id는 비밀값은 아니지만 확정된 설정으로 변경 이력을 관리한다. secret은
문서, Discord 메시지, application log와 Git에 값을 남기지 않는다.

### 8.4 정기 보고 내용

정기 보고 주기와 발송 시각은 `(미정)`이다. 기본 보고서는 다음 집계만 포함한다.

- 보고 기간과 생성 시각
- 출처별 실행·성공·실패 횟수
- 신규 후보, 중복, 반려, 초안 승격 수
- `403`, `429`, robots 금지, timeout, parser 실패 분류
- 자동 비활성 출처와 운영자 확인 필요 항목
- 다음 예정 실행 또는 scheduler 지연 여부
- Discord 명령으로 시작한 경우 내부 운영자 alias, source key, URL hash와 job id

후보 제목·본문·이미지, 원문 URL 전체, 원문 HTML, 내부 예외 stack, secret과 개인정보는 보고서에
넣지 않는다. 상세 조사가 필요하면 job id로 관리자 화면과 내부 로그를 확인한다.

감사 기록의 Discord user id는 권한 확인과 사후 추적에 필요한 운영자 정보로 제한 접근한다.
Discord 보고서에는 raw user id를 표시하지 않으며 감사 기록의 보존 기간과 삭제 절차를 활성화
전에 확정한다.

Discord 발송 실패는 수집 실패로 바꾸지 않는다. 보고서를 내부에 저장하고 제한된 횟수로
재전송하며, 재전송이 끝까지 실패하면 관리자 화면에 `보고 실패`로 표시한다.

### 8.5 Discord 연동 완료 조건

- [ ] Discord Application, 허용 guild·channel과 운영 역할이 확정됨
- [ ] 보고 webhook URL, Discord application id와 bot token, collector service token이 분리 관리됨
- [ ] 로컬 collector의 Discord 연결, guild·channel·user 권한 검증과 명령 응답이 통과함
- [ ] 모든 명령이 3초 안에 deferred response를 받고 job id가 15분 안에 후속 응답됨
- [ ] 권한 없는 guild·channel·user·role 명령이 거부됨
- [ ] 중복 interaction이 같은 수집 job을 두 번 만들지 않음
- [ ] `/collect url`이 등록·활성 출처의 URL 한 건만 후보 생성함
- [ ] 15분 넘게 실행된 job도 interaction token 없이 보고 webhook으로 원래 운영 channel·thread에
  결과를 남김
- [ ] Discord 장애가 수집 job과 공개 서비스 상태를 바꾸지 않음
- [ ] 보고서와 감사 기록에 금지 정보가 남지 않음

## 9. 단계별 완료 조건

### 수집 가능성 검증

- [ ] 첫 검증 출처 한 곳이 선정됨
- [ ] 실제 목록·상세 URL과 확인일이 기록됨
- [ ] 이용약관·`robots.txt` 확인 결과가 기록됨
- [ ] 최소 공통 후보 결과를 만들거나 불가능 사유가 기록됨
- [ ] 원본 콘텐츠를 복제하지 않은 최소 synthetic fixture로 parser 규칙을 재현함

### M0 수집 보조

- [ ] `M0 Core`의 수동 초안·이미지·발행·숨김 흐름이 먼저 검증됨
- [ ] 로컬 collector가 Discord `/collect url` 또는 관리자 화면 URL 입력 한 건만 처리함
- [ ] 등록·활성 host와 차단 경로를 구분함
- [ ] 단일 상세 페이지 1건이 후보 또는 명시적 실패 상태로 끝남
- [ ] 후보 수정·반려·재시도·초안 승격을 검증함
- [ ] 목록·feed·pagination·scheduler를 호출하지 않음
- [ ] 수집 기능을 꺼도 수동 게시와 공개 읽기가 정상 동작함

### M0 자동 수집

- [ ] 출처별 자동 수집 사용 결정과 운영 위험·기술 gate가 완료됨
- [ ] 전역·출처별 기본값이 비활성임
- [ ] 반복 실행이 같은 URL의 후보를 중복 생성하지 않음
- [ ] 요청 간격·일일 상한·pagination 한계를 지킴
- [ ] 차단·연속 실패 시 해당 출처가 자동 비활성됨
- [ ] 후보가 운영자 검수 없이 게시글로 공개되지 않음

## 10. 현재 미정·차단 항목

- 첫 가능성 검증 대상 출처
- 출처별 실제 기준 URL, 상세 URL pattern과 허용 path
- 출처별 이용약관 위험 판단, `robots.txt` 확인 결과와 확인일
- 출처별 parser 방식과 selector
- 수집 User-Agent 문자열과 연락 수단
- 출처별 요청 간격, 일일 상한과 단건 상세 페이지 timeout·응답 크기 상한
- 구조 변경을 담당하고 출처를 재활성화할 운영자
- 수집 보조와 자동 수집의 production 활성화 일자
- Discord Application, guild·channel·운영 역할과 명령 권한
- Discord 보고 webhook, `/collect url` 명령, 감사 기록 보존 기간
- 로컬 collector 실행 PC, 실행 계정, service token 발급·회전·분실 대응 절차

위 항목이 미정이어도 `M0 Core` 플랫폼 개발과 공개는 진행할 수 있다. 다만 수집 보조 또는 자동
수집 기능은 관련 항목과 해당 단계의 gate가 끝나기 전에는 활성화할 수 없다.

## 11. 후속 시스템 설계 동기화

이 기획을 구현하기 전에 다음 기술 계약을 다시 대조한다.

- 로컬 collector와 BE 후보 저장 service의 책임 분리
- Discord·관리자 화면 URL 입력이 같은 로컬 collector 추출 흐름을 사용하는 조건
- parser version과 경고·실패 사유 저장 위치
- feature flag와 출처별 활성값의 우선순위
- 출처별 request budget 계산과 Discord interaction 멱등성의 관계
- source fixture, contract test와 구조 변경 감지 방식
- 로컬 collector의 Discord Gateway 연결 방식·권한 검증·BE 제출 API 호출
- Discord 명령 job·멱등성·확인·감사 actor, 3초 초기 응답·15분 token 한계와 보고 webhook 전환
- Discord 보고 webhook 재시도·보존·secret 분리

수집 단계의 새 source·migration·OpenAPI·실행 테스트는 별도로 작성해야 하므로 이 문서 작성은 구현 완료나
수집 가능성 검증을 뜻하지 않는다.

<a id="source-common-rules"></a>

### 출처별 공통 추출·임시 파일 규칙

다음은 20개 출처 명세에서 공통으로 참조하는 기존 규칙이다. 출처별 URL·정책 판단·fixture·제한값과 활성화 상태는 각 명세를 따른다.

M0 수집 보조에서는 목록·feed·pagination을 사용하지 않는다. Discord `/collect url` 또는 관리자 화면에서
입력된 단일 상세 페이지 1건만 추출한다. 목록 수집을 도입하려면 별도 `M0 자동 수집` 단계에서 이 절을
다시 작성하고 fixture를 검증한다.

| 대상 | 추출 규칙 | 필수 여부 | 실패 처리 |
| --- | --- | --- | --- |
| 원문 URL | 사용하지 않음 | 해당 없음 | 후보 생성 안 함 |
| 제목 | 사용하지 않음 | 해당 없음 | 상세 페이지 추출 규칙 사용 |
| thumbnail URL | 사용하지 않음 | 해당 없음 | 상세 페이지 추출 규칙 사용 |
| 게시 시각 | 사용하지 않음 | 해당 없음 | `null` |
| 다음 페이지 | 사용하지 않음 | 해당 없음 | 종료 |

- 목록·feed·pagination: M0 수집 보조 범위 밖
- 공지·광고·추천 콘텐츠: 목록에서 추출하지 않음
- 같은 목록의 중복 링크: 목록에서 추출하지 않음

- 후보 생성 시 Python extractor는 미리보기에 필요한 이미지 후보만 작업 경로에 임시 저장할 수 있다.
- 임시 파일 경로는 내부 구현값이며 공개 화면, 로그, Discord 보고와 Git에 남기지 않는다.
- DB에는 원격 URL, 순서, 추출·검증 상태와 preview 식별자만 저장하고 image binary는 저장하지 않는다.
- 후보 반려, 보존 기간 만료, 재시도 교체, parser 실패 전환 시 임시 파일은 삭제 대상이다.
- 게시글 초안 승격이 결정되면 선택 이미지에 한해 관리자 업로드와 같은 MIME·magic byte·decode·pixel·metadata 제거·재인코딩 검증을 거쳐 블라리요 저장소에 저장한다.
- 승격 transaction 실패 시 저장된 이미지는 staging orphan 정리 대상으로 분류한다.
