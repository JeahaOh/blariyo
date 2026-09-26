# Discord `/collect url` End-to-End 검증 체크리스트

이 문서는 실제 Discord Gateway 연결 검증을 위한 운영 체크리스트다. fixture test나 코드 존재는 Discord 완료 증거가 아니다. 이 파일에는 token, guild id, channel id, user id, role id 같은 실제 식별자와 secret 값을 적지 않는다. 실행 결과는 일반화된 run id, source key, 상태, DB readback 여부만 남긴다.

## 사전 조건

- API와 같은 PostgreSQL database의 `collect.*` schema에 Collector migration 적용 완료. batch 제한 role을 사용하며 API 검수/content 쓰기 권한은 주지 않음
- `COLLECTOR_SOURCE_CONFIG` 또는 `COLLECTOR_SOURCES_FILE`에 검증 source가 있고 `approved=true`
- object store backend 준비: `COLLECTOR_OBJECT_STORE_DIRECTORY` 또는 `COLLECTOR_OBJECT_STORE_S3_*`
- Discord bot token은 secret store에만 있고 shell history, 문서, 로그에 남기지 않음
- queue 계약은 Collector V005, 현재 schema 기준은 V006이다. API/batch role 분리 후 `./bin/blariyo-collector discord --write-db` 사용 (Core API·Spring 서버 불필요)
- `COLLECTOR_DISCORD_REGISTER_COMMANDS=true`는 최초 등록 검증 때만 사용하고, 등록 후에는 false로 되돌림. 비공개 properties를 쓰면 `COLLECTOR_CONFIG_FILE`로 읽고 같은 의미의 `collector.discord-register-commands`를 사용
- 허용 guild/channel/user 또는 role allowlist 설정 완료
- 테스트 명령은 운영자 개인 테스트 guild/channel에서만 실행

## 권장 검증 URL

아래 URL과 성공/차단 기대는 기존 표본이다. 실행 전에 공개 여부·승인 범위를 다시 확인하며,
출처 응답이 바뀌면 실제 결과를 기록한다. 과거 차단 상태를 재현하려고 접근 제한을 우회하지 않는다.

| source     | URL                                                                                                   | 기대 결과                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| theqoo     | `https://theqoo.net/hot/4353370346` 또는 당일 공개 hot URL                                            | 확인 메시지 후 batch queue 등록, 상세 fetch/parser/DB/object readback       |
| todayhumor | `https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970` 또는 당일 공개 humorbest URL | 확인 메시지 후 batch queue 등록, 상세 fetch/parser/DB/object readback       |
| pgr21      | `https://pgr21.com/humor/507793`                                                                      | 확인 메시지 후 batch queue 등록, `SOURCE_ACCESS_BLOCKED` 실패 저장/readback |

## 실행 순서

1. `./bin/blariyo-collector discord --write-db`를 배치 PC에서 시작한다.
2. Gateway ready 이벤트의 일반화된 `DISCORD_GATEWAY_CONNECTED` 로그를 확인한다.
3. Discord 테스트 채널에서 `/collect status`를 실행한다.
4. 허용되지 않은 channel 또는 user에서 `/collect status` 또는 `/collect url`을 시도해 거부 응답을 확인한다.
5. 허용된 user로 `/collect url <검증 URL>`을 실행한다.
6. Discord가 source key, host, canonical URL, 확인 버튼을 표시하는지 확인한다.
7. 확인 버튼을 누르기 전에는 `collect.batch_run`과 `collect.batch_item`이 생성되지 않는지 확인한다.
8. 확인 버튼을 누른 뒤 `collect.batch_queue`의 request UUID가 응답과 일치하는지 확인한다. 같은 버튼을 동시에 재전송해도 request 한 건이어야 한다.
9. 동일 프로세스의 worker가 queue를 claim하고 새 `batch_run`을 연결하여 fetch/parse/write를 수행한다. 별도 worker PC는 `queue --write-db`를 사용한다. 별도 collect-url 실행으로 대체하지 않는다.
10. DB readback을 확인한다.
11. object store의 `collect/raw/*`, `collect/media/*`, `collect/report/*` readback을 확인한다.
12. Discord notification이 구성되어 있으면 일반화된 결과 메시지만 표시되는지 확인한다. 원문 본문, token, raw Discord id가 메시지에 나오면 실패다.

## DB readback SQL 예시

```sql
select id, source_key, chart_key, mode, state, report_object_key, started_at, finished_at
from collect.batch_run
order by started_at desc
limit 10;

select i.source_key, i.source_post_key, i.state, left(coalesce(i.title,''),80) title,
       jsonb_array_length(coalesce(i.body_blocks,'[]'::jsonb)) blocks,
       i.raw_object_key
from collect.batch_item i
join collect.batch_run r on r.id = i.run_id
order by r.started_at desc, i.id
limit 10;

select r.source_key, f.phase, f.code, f.detail->>'detailUrl' detail_url
from collect.batch_failure f
join collect.batch_run r on r.id = f.run_id
order by f.occurred_at desc
limit 10;
```

## 결과 기록 템플릿

| 항목                                                     | 결과   |
| -------------------------------------------------------- | ------ |
| 검증 일시                                                |        |
| collector build/commit                                   |        |
| Discord Gateway connected                                | 미검증 |
| command registration                                     | 미검증 |
| allowlist 거부 테스트                                    | 미검증 |
| `/collect status`                                        | 미검증 |
| `/collect url` 확인 전 수집 queue/run/item/object 무쓰기 | 미검증 |
| 확인 후 batch queue 등록                                 | 미검증 |
| batch fetch/parser/write-db                              | 미검증 |
| object store readback                                    | 미검증 |
| Discord 결과 알림                                        | 미검증 |
| 운영자 검토 URL 또는 run id                              |        |
| 판정                                                     | 미검증 |

## 완료 판정

- 실제 Discord Gateway가 `CONNECTED` 상태여야 한다.
- Discord 테스트 채널에서 slash command가 실행되어야 한다.
- 허용되지 않은 guild/channel/user/role은 거부되어야 한다.
- `/collect url` 확인 전에는 queue/run/item/object write가 없어야 한다. confirmation receipt만 HMAC과 공개 canonical URL로 저장한다.
- 확인 후에는 source 식별, canonical URL, source post key, queue row가 DB에서 readback되어야 한다.
- 상세 parser/write path는 같은 URL에 대해 DB/object readback까지 확인되어야 한다.
- 이 중 하나라도 빠지면 Discord 기능은 `부분 검증` 또는 `미검증`이다.
