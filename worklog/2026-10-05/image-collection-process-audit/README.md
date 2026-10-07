# 이미지 수집 실패 프로세스 검토

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / HEAD: `12df6ae`
- 상태: 종료 / 갱신: 2026-10-05 22:07 KST
- 요청: 이미지 실패 원인이 수집 프로세스의 잘못인지 검토.
- 범위: 기존6건 증거, direct robots/HTTP/이미지 처리·재시도·삭제 판단, 테스트의 검증 한계. `audit` 스킬 사용.
- 검토 전용: 작업 기록과 격리 임시 재현 외 파일·DB·배치 실행·배포 변경 없음. 기존 dirty 변경 보존. 직전 image-failure-retry-cleanup 종료 확인.

## 결론

이미지 파일 불량으로 확인된6건이 아니다. 기존6건은 모두 MEDIA/IMAGE 경로에서 `ROBOTS_UNVERIFIED`로 종료됐다. 요청 코드상 해당 이미지의 HTTP 송신 전에 robots 확인이 실패한다. robots 확인 오류까지 이미지 재시도·삭제 대상에 넣은 직전 구현의 분류가 너무 넓다.

### 실시간 robots 확인

기존 백업의 batch_failure COPY를 `pg_restore --data-only --table=batch_failure --file=-`로 메모리에서 읽어6건의 실패 host를 확인했다. DB 복원/쓰기 없이 수행했다. 같은 `PinnedHttp`와 현재 출처별 User-Agent로 각 이미지 host의 `/robots.txt`만1회 GET, 요청 사이10초, 응답512KiB·프로세스35초 제한. 이미지·본문 GET 및 배치/DB quota 변경 없음. 이 결과는 이번 검토 시점이며 원래 실패 시점의 HTTP status까지 소급 확정하지 않는다.

| 출처 | 이미지 host | robots 응답 |
| --- | --- | --- |
| 아카라이브 | ac.arca.live |403 text/plain,13 bytes |
| 보배드림 | file1.bobaedream.co.kr |404 text/html,208 bytes |
| 웃대 | down-webp.humoruniv.com |404 text/html,13 bytes |
| 고급유머 | cdn.goodgag.net |404 text/html,27511 bytes |
| 인스티즈 | cdn.instiz.net |404 text/html,27150 bytes |
| 율도 | img.yul-do.com |404 text/html,146 bytes |

증거: [robots-results.json](robots-results.json). 이미지 파일 자체가200/404/손상인지 확인한 결과가 아니다. robots 실패를 우회한 이미지 요청은 하지 않았다.

## 발견 사항

### D01 / 높음 / 오류 분류·삭제 설계 / 신뢰도 높음

- `SourceRequests.java:53,66,79-83`은 이미지 GET 전에 별도 CDN robots를 확인하고 robots404·403·DNS·5xx·redirect 오류를 모두 ROBOTS_UNVERIFIED로 바꾼다.
- `collector-v012.sql:4-8`은 ROBOTS_UNVERIFIED/DISALLOWED, DNS 장애,429까지 IMAGE 실패와 같은 자동 재시도·삭제 코드로 등록했다. 실제 로컬 DB READ ONLY 조회로 네 코드 모두true, BATCH_DB_WRITE_FAILED는false 확인.
- `collector-v011.sql:68-89`은 두 번째 실패 후 payload·failure를 삭제하고 dedup을 등록한다. `BatchStore.java:128-139`는 해당 dedup이 있으면 다음 수집을 skip한다. 일시적 CDN/네트워크 문제라도 게시물이 삭제되고, 조건이 회복돼도 정상 재수집되지 않는다.
- 본문/원문·게시글 사본 보호와 정확한 삭제 자체는 별도 검증됐지만, 삭제 대상을 정하는 분류의 적합성을 그 검증으로 증명할 수 없다. 직전 테스트는 이 판단 결함을 놓쳤다.
- 권장: 접근 정책/robots 미확인·일시 장애·요청 제한은 출처/host 보류로 분리. 실제 이미지 GET 결과의 영구 오류만 글당 추가 재시도 후 삭제 후보로 삼고, 일시 오류를 영구 dedup 처리하지 않는다. 사용자 삭제 정책의 적용 범위를 이 구분으로 구체화할 필요가 있다.

### E02 / 높음 / Retry-After 경계 위반 / 신뢰도 높음·직접 재현

- `SourceRequests.java:111-117`은 Retry-After가60초를 넘으면 즉시 예외로 빠져 해당 출처의 중단을 의도한다. 예외에 다음 허용 시각이 전달되지 않는다.
- `DirectUrlRunner.java:124-130`, `DirectBatchRunner.java:151-157`의 새 바깥 재시도는 SOURCE_RATE_LIMITED를 잡고 다시 fetch한다. 새 request의 delay는 기본10초로 초기화된다.
- 합성429 + Retry-After3600 응답, 실제 runner/SourceRequests, mock DB/object로 재현: 이미지 요청2회, 둘 사이 요청된 대기10000ms, 서버 요구3600000ms. 외부 네트워크·DB 쓰기 없음.
- 권장: 재시도 계층을 하나의 정책으로 조정하고 nextAllowedAt/Retry-After를 상위로 전달·보존. 긴 대기는 다음 실행으로 이월하고 그 사이 요청·삭제를 금지한다. 중첩된 HTTP3회×이미지2회도 명시적으로 정의한다.

### E03 / 중간 / 실패 원인 증거 손실 / 신뢰도 높음

- `SourceRequests.java:79-83`에서 원래 HTTP status·하위 오류가 단일403 ROBOTS_UNVERIFIED로 사라진다. CollectorFailure에도 원인 context가 남지 않는다.
- `collector-v011.sql:86-89`은 failure detail을 삭제하고 first_code/last_code만 남긴다. 정상 report에도 IMAGE_RETRY_EXHAUSTED만 기록된다. 원문을 보존할 필요 없이 host·요청 종류·원래 status·하위 오류·Retry-After 정도의 비민감 진단값은 남길 수 있다.
- 따라서 당시6건의 HTTP status는 기존 기록만으로 복원할 수 없다. 위4045건/4031건은 이번 직접 GET 결과다.
- 권장: ROBOTS/FETCH/VALIDATE/STORE 단계를 구분하고 구조화된 최소 진단값을 보존한다. URL query·원문·이미지 binary는 기록하지 않는다.

### R04 / 중간 / robots 호환성·정책 대조 / 신뢰도 높음

- RFC9309 §2.3.1.3은 robots4xx unavailable에서 접근을 허용할 수 있다고 정의한다(MAY). 현재 일괄 차단은 RFC의 강제 요구가 아니라 프로젝트의 더 보수적인 정책이다. 무조건 표준 위반으로 판정하지 않는다.
- RFC9309 §2.2.1의 group이 없는 문서는 적용 규칙이 없는데, `RobotsRules.java:17-28`은 유효한 User-agent 줄이 있어야 valid가true다. `200 text/plain`의 빈 문서·주석만 문서가 ROBOTS_UNVERIFIED로 차단되는 반례 재현.
- 같은 host의 `/robots.txt -> /rules.txt`301도 `/robots.txt` prefix allowlist 때문에 실패하는 반례 재현. robots용 redirect 정책은 콘텐츠용 allowlist/3회와 분리해서 검토하되, 모든 hop의 DNS/HTTPS 검증은 유지해야 한다.
- 권장: 이미 등록·승인된 CDN의 robots404/410은 별도 명시 정책으로 처리.403·실제Disallow·429·5xx는 섞지 않는다. 본문 사이트의 robots를 다른 CDN에 대신 적용하거나 무조건 robots 검사를 건너뛰지 않는다.
- 표준 근거: https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.3, §2.2.1, §2.3.1.2, §2.3.1.4.

## 재현·범위

- [process-results.jsonl](process-results.jsonl): robots404/200빈문서/주석/정상Allow/동일host리다이렉트,429 Retry-After 반례. 실제 compiled SourceRequests/DirectUrlRunner/RobotsRules, mock DB/object 및 합성 transport 사용.
- `/tmp/blariyo-image-process-audit/`는 컴파일·백업 읽기·robots 진단용 임시 경로. raw 실패 URL·robots 응답 본문을 worklog에 복제하지 않았다.
- source·migration·정본 정책·로컬/운영 DB·기존6건 삭제 상태 변경 없음. 추가 재수집·삭제·복구·commit/push/배포 미실행.
- 수정 권장 순서: robots/네트워크/이미지 오류 분리 → Retry-After 이월 보장 → 승인 CDN404·빈robots 정책 명확화 → 출처별 실제 정상수집 확인 → 삭제6건의 재처리 가능 여부를 백업/중복키 기준으로 검토.
