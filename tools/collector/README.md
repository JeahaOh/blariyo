# Legacy Python 로컬 수집기

이 문서는 기존 Python·SQLite 호환 구현의 사용법이다. 현행 신규 수집은
[Java direct batch 운영 안내](../../apps/collector/ops/README.md#직접-저장-batch-실행)를 따른다.
아래 Core 후보·cron·별도 상태 DB 절차를 direct batch/Discord queue에 적용하지 않는다.
운영 활성화·실연동 여부는 [현재 운영 상태](../../docs/operations/current-status.md)와 별도로 확인한다.

관리자 URL 접수 또는 Discord `/collect url` → 작업 선점 → 로컬 HTML·이미지 추출 →
비공개 후보 검수 → 기존 Core 초안 생성 순서다. 발행은 운영자가 별도로 실행한다.
HTTP 서버·cron scheduler·Discord가 하나의 공통 JobRunner를 사용하는 상시 실행 서버다.
Core와 웹은 이 프로세스가 꺼져 있어도 동작한다. 목록 수집·로그인·브라우저 우회는 없다.

## 준비

1. Core에 V004 migration을 적용한다. 공개 운영 DB 적용은 별도 배포 작업이다.
2. 승인한 출처만 `collect.source`에 등록한다. 자동 seed는 없다. 출처 정책·robots·상세 경로·
   title/body selector·이미지 CDN·요청 간격·일일 한도를 확인한다.
3. `config.example.json`을 Git 제외된 `config.local.json`으로 복사하고 값을 채운다.
   `userAgent`는 서비스명과 실제 연락처를 포함한다. 예시 호스트와 빈 값으로는 수집하지 않는다.
   selector는 `tag`, `.class`, `#id`만 지원한다. 추측하는 일반 본문 추출기는 아니다.
4. Core의 `COLLECT_MANUAL_URL_ENABLED=true`와 웹의 `NUXT_COLLECT_MANUAL_URL_ENABLED=true`를
   맞춘다. Discord 사용 시 양쪽 `COLLECT_DISCORD_COMMAND_ENABLED` / `NUXT_COLLECT_DISCORD_COMMAND_ENABLED`도 켠다.
   기본값은 모두 false다.
5. Core의 `COLLECTOR_TOKENS_FILE`에는 다음 구조의 JSON 배열을 둔다. 원본 bearer는 넣지 않는다.
   `[{"collectorId":"운영자가 정한 영문 ID","tokenSha256":"bearer의 SHA-256 hex","scopes":["collect"]}]`
6. `.env.template`의 값을 로컬 비밀 관리 도구로 주입한다. 원본 token은 32자 이상 난수,
   API URL은 HTTPS BFF의 `/api/collector/v1`, 상태 DB는 이 운영자 기기의 지속 경로를 쓴다.
   `COLLECTOR_CONTROL_TOKEN`은 로컬 HTTP 제어용 32자 이상 난수이며 Core bearer와 다른 값을 쓴다.
   같은 출처를 처리하는 모든 로컬 프로세스는 같은 SQLite 상태 DB를 공유해야 한다.
   여러 기기에서 동시에 돌리는 분산 quota는 지원하지 않으므로 단일 운영자 기기만 사용한다.

```sh
python3 -m venv tools/collector/.venv
tools/collector/.venv/bin/python -m pip install -r tools/collector/requirements.txt
# 환경변수를 준비한 터미널에서 상시 서버 실행
# 기본 주소: http://127.0.0.1:8787
tools/collector/.venv/bin/python tools/collector/server.py
# Discord enabled 설정 후, 명령 최초 등록이 필요한 경우에만 사용
# 이후에는 위의 기본 명령으로 실행한다.
tools/collector/.venv/bin/python tools/collector/server.py --register-discord
```

Discord 봇은 Gateway로 연결하고 일반 메시지 본문 intent를 사용하지 않는다. 허용 guild·channel·user
목록을 모두 검증하며, 60초 내 확인 버튼을 누른 요청만 접수한다. 외부 I/O 전에 응답을 defer한다.
`/collect status`는 로컬 작업 상태만 읽는다. 메시지에 원문 URL·제목·이미지·token을 출력하지 않는다.
라이브 Discord 명령 등록과 메시지 전송은 로컬 테스트에서 실행하지 않았다.

## 접근 제한과 복구

- HTTPS만 허용하고 DNS 결과 중 하나라도 사설·루프백·링크 로컬 IP면 거부한다.
  검증한 IP에 직접 연결하고 TLS는 원래 hostname으로 검증한다. 환경 proxy는 사용하지 않는다.
- 리다이렉트는 최대 3회, 매번 URL·host·DNS·robots 허용을 다시 확인한다.
  상세 글은 같은 출처 host와 허용 상세 경로, 이미지는 해당 CDN host 안에서만 이동한다.
- robots.txt 확인 실패는 수집 실패로 처리한다. HTML 2MiB, 이미지당 10MiB, 20장,
  응답 읽기 30초·socket 15초 제한이다. 비압축 UTF-8 HTML과 지정 이미지 형식만 지원한다.
- 각 외부 요청은 SQLite에 먼저 기록한다. 일일 한도는 UTC 날짜 기준이며 robots·리다이렉트·이미지도
  포함한다. 재시작으로 초기화되지 않는다. robots crawl-delay/request-rate가 더 엄격하면 이를 따른다.
- 매 요청 전 heartbeat로 최신 출처 활성 상태와 정책 확인 여부를 확인한다. 후보 lease 충돌은 중단한다.
- 원문 HTML은 메모리에서만 파싱하고 이미지 임시 파일은 로컬 임시 디렉터리 종료 시 제거한다.
  서버는 업로드 파일을 다시 디코딩·재인코딩한 뒤 비공개로 저장한다. 미리보기 수명은 24시간이다.
- 결과 전송은 동일 idempotency key로 한 차례 재시도한다. heartbeat/claim/preview는 자동 재시도하지 않는다.
  결과 제출 뒤 preview가 일부 실패하면 `PARTIAL_PREVIEW`다. 검수 화면에서 직접 이미지를 교체할 수 있다.
- 대기/실행 후보는 24시간 후 실패 처리, 검수 대기/실패 및 반려 후보는 기준 시각에서 30일 후 정리한다.
  정리는 기존 `cleanup:run`과 outbox worker를 운영 스케줄에 등록해야 실제 수행된다.

## 검증

```sh
tools/collector/.venv/bin/python -m unittest discover -s tools/collector -p 'test_*.py' -v
npm run test:integration
npm run test:browser
```

Python 검증은 네트워크를 대체한 fixture다. 실제 출처의 선택자·robots·이미지 CDN 검증,
실제 Discord 계정 연결과 공개 HTTPS 배포는 별도 확인 대상이다.

참조: [Discord Gateway](https://docs.discord.com/developers/events/gateway),
[interaction 응답](https://docs.discord.com/developers/interactions/receiving-and-responding),
[discord.py](https://discordpy.readthedocs.io/en/stable/interactions/api.html).

## 상시 서버의 cron·API·실행 이력

설정 파일의 `server`를 아래처럼 지정한다. 설정 변경 후 서버를 재시작한다.

```json
{
  "server": {
    "port": 8787,
    "batchSize": 5,
    "schedule": { "enabled": true, "cron": "*/5 * * * *", "timezone": "Asia/Seoul" }
  }
}
```

5분마다 접수된 후보를 최대 5건 처리한다. `30 7 * * *`는 매일 오전 7시 30분이다.
cron은 **5필드(분·시·일·월·요일)**이고 s2b_batch/Quartz의 초 포함 표현식과 다르다.
예약을 끄려면 `schedule.enabled=false`로 설정한다. HTTP·Discord 즉시 실행은 계속 가능하다.
cron은 기존 후보 처리만 수행하며 사이트 목록을 돌아 새 URL을 찾는 기능은 아니다.

| Method | 로컬 경로          | 동작                               |
| ------ | ------------------ | ---------------------------------- |
| GET    | `/health`          | 서버·활성 실행·Discord 연결 상태   |
| GET    | `/v1/schedule`     | cron·timezone·다음 실행 시각       |
| POST   | `/v1/runs`         | 즉시 실행 요청, `202`와 runId 반환 |
| GET    | `/v1/runs`         | 최근 실행 이력 최대 50건           |
| GET    | `/v1/runs/{runId}` | 실행별 상태·처리 결과              |

모든 경로는 `Authorization: Bearer <COLLECTOR_CONTROL_TOKEN>`이 필요하다.
쿠키 인증·CORS는 제공하지 않는다. 서버는 `127.0.0.1`에만 열리므로 원격 인터넷에 공개되지 않는다.

```sh
# 상태 조회 — 환경변수의 실제 값을 콘솔에 출력하지 않는다.
curl -s http://127.0.0.1:8787/health \
  -H "Authorization: Bearer $COLLECTOR_CONTROL_TOKEN"

# 대기 작업 즉시 실행. 네트워크 오류 재시도에는 같은 key를 사용한다.
curl -s http://127.0.0.1:8787/v1/runs \
  -H "Authorization: Bearer $COLLECTOR_CONTROL_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: manual-run-001' \
  -d '{}'

# 이미 접수된 후보 한 건만 실행하려면 body를 {"candidateId":123}으로 지정한다.
```

URL 신규 접수는 관리자 화면 또는 Discord `/collect url`에서 한다. Discord는 접수한 candidateId를
동일 runner에 전달하며 자체 polling worker를 추가로 실행하지 않는다. 이전 `discord_bot.py` 실행도
새 상시 서버로 연결된다. `collector.py --once`는 서버를 끈 상태의 진단용으로 남겨 두었다.

실행 요청은 최대 100건까지 SQLite에 대기하며 한 번에 하나만 수행한다. 원문·token은 이력에 넣지 않는다.
동일 요청 key는 같은 runId를 반환하고 body가 다르면 409다. 이력은 30일간 보관하며 다음 접수 시 정리한다.
처리할 후보가 없거나 다른 collector가 이미 선점한 경우 `SUCCEEDED`, `processed=0`으로 끝난다.
일부 preview 실패는 PARTIAL, 수집 실패는 FAILED로 기록한다.

정상 종료는 신규 접수를 막고 진행 중 후보 처리를 기다린다. 강제 종료된 RUNNING은 다음 시작 시
INTERRUPTED로 기록하며 QUEUED는 유지한다. Core의 만료 lease는 다음 cron/API 실행에서 회수한다.
놓친 cron을 한꺼번에 재생하지 않는다. 같은 상태 파일을 쓰는 서버·단독 CLI의 중복 기동은 파일 잠금으로 차단한다.

참고한 구조는 s2b_batch의 QuartzBatchJobLauncher·수동 launch API·동시 실행 방지다.
이 legacy 구현은 Python의 aiohttp HTTP 서버와 croniter를 사용한다. 현재 Java/Spring 구현과 별개다.
운영 기기의 로그인 시 자동 기동(launchd) 등록과 실제 Discord·출처 연결은 별도다.
