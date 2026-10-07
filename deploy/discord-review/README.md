# Discord 검수 실행

- API가 DB의 승인·반려·발행과 작업 상태를 소유한다. 전용 Java worker는 Discord 전송·반응 조회·삭제 복구를 담당하며 DB credential을 받지 않는다.
- 수집04:30/15:30, 검수07:30/17:00(Asia/Seoul). 유지보수는 종료 후60초마다 전송·명령·삭제를 복구하고, 놓친 검수 시간대만 현재 반응으로 이어간다. 완료된 검수 시간대는 반복하지 않는다.
- 기존 수집 lock/컨테이너와 별도 `run.lock`, `blariyo-discord-review-worker`를 사용한다. 검수 worker는15분 상한, export/scan claim은180초, cleanup claim은30초다.

## 준비와 적용 순서

1. 관련 source/계약/DB·worker·화면 검증과 실제 Discord 개발 채널 시험을 통과시킨다. V014 적용 전 지원되는 DB 백업과 archive 검사를 수행한다.
2. API migration과 API 전용 grants를 적용한다. BATCH에는 새5개 표의 쓰기 권한을 부여하지 않는다.
3. `/opt/blariyo/discord-review/`에 검증한 `collector.jar`, `run.py`, jar SHA-256·고정 Java image digest·Git SHA의 `manifest.json`을 설치한다. 파일은0600 또는0644, secrets 폴더0700·파일0600·소유1000:1000으로 둔다.
4. `secrets/`에는 `api.json`, `worker.json`, `discord-token`, `worker-token`, `reviewers.json`, `admin-operators.json`, `actor-secret`을 둔다. 토큰·HMAC·실제 계정값은 저장소나 명령 인자에 쓰지 않는다. API actor secret과 operator 목록은 현재 Web의 실제 값과 일치해야 한다.
5. API release compose에 secrets를 `/run/secrets/discord-review`로 read-only mount하고 `DISCORD_REVIEW_ENABLED=true`, `DISCORD_REVIEW_CONFIG_FILE=/run/secrets/discord-review/api.json`을 설정한다. Web에는 `NUXT_DISCORD_REVIEW_ENABLED=true`를 설정한다. 기본 준비 도구의 flag는false다.
6. `python3 -B /opt/blariyo/discord-review/run.py check`로 runtime 바인딩·봇·채널을 확인한다. 새 두 service/timer를 `/etc/systemd/system`에 설치하고 daemon-reload 후 timer를 enable/start한다.
7. 실제 헤드·스레드·본문·seed의 readback, READY/48시간, 무승인 유지, 관리자 처리 뒤 삭제를 확인한다. 이 확인과 다음04:30 수집 성공은 별도 증거다.

## 비공개 설정 형태

`api.json`은 `environment`, `guildId`, `channelId`, `exportSince`(ISO 시각), `botTokenFile`, `workerTokenFile`, `reviewersFile`, `adminOperatorsFile`, `actorSecretFile`을 갖는다. 운영 environment는production, 로컬은local_test다. 파일 경로는 절대경로다.

`worker.json`은 `environment`, `guildId`, `channelId`, `apiOrigin`, `botTokenFile`, `workerTokenFile`을 갖는다. 운영 apiOrigin은`http://api:4000`, 로컬은`http://127.0.0.1:3100`이다. API/worker의 환경·서버·채널은 정확히 일치해야 한다.

`reviewers.json`은 `{discordUserId,operatorId}` 배열이다. `admin-operators.json`은 Web과 같은 `{identity,operatorId,role,active}` 배열이다. 유효한 활성 OWNER/EDITOR만 인정한다.

로컬 credential 위치는 `~/.config/blariyo/discord/local/`, 실행 데이터는 `.local-data/discord-review/`다. `scripts/local/discord-review.py maintain|scan|check`를 사용한다. Python/JDK/Node/저장소 경로를 확인한 LaunchAgent로 실행하고 API/Web의 지속 실행도 함께 확인한다.

## 중단·복구

- 권한·채널·설정 오류는 차단 상태로 남겨 수정 후 재개한다. 반응 읽기 실패를 무반응으로 판단하지 않는다.
- 부분 전송은 영속 nonce/표식으로 기존 메시지를 찾는다. 불확실한 전송을 무조건 재전송하지 않는다.
- 삭제 실패는 삭제만 재시도하며2회부터 같은 스레드에 실제 승인·발행 상태를 알린다. 안내 실패는 별도 횟수/재시도 시각을 사용한다.
- 긴급 중단은 두 timer/service를 중지하고 API/Web flag를false로 맞춘다. 완료된 발행을 rollback으로 취소하지 않는다. V014에 복구 상태가 있으면 down migration이 거부되므로 데이터를 임의 삭제하지 않는다.
- 야간 main 배포는 현재 release의 compose와 비공개 설정을 복사한다. 새 release에도 mount/flags가 유지되는지 확인한다. 재설치 도구로 기존 private registry를 덮어쓰지 않는다.

정책: [기술 설계](../../docs/system-design/10-discord-review.md), 비공개 파일: [복구 목록](../../docs/operations/private-files-and-recovery.md).
