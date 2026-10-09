# 로컬 이미지 정책 실제 배치 테스트

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST / 실행: 20:59~21:02 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review` / HEAD: `0bf9533`.
- 요청: 로컬 배치 일회 테스트. 범위: 오늘의유머·더쿠, 출처당1페이지·최대5후보·최근24시간·요청간격5초, 로컬 DB/파일 저장.
- 담당 경로: 이 기록과 해당 실행의 `.local-data` 결과/백업. 기존 소스 변경과 다른 작업 기록은 보존한다.
- 준비: 개발 DB `127.0.0.1:5439/blariyo_local`, batch role/object root 고정 wrapper 확인. 기존 RUNNING 실행0. 자동 예약4개 disabled/미로드 확인.
- 실행 JAR과 변경 Java 파일은 직전312테스트 통과 시점 SHA-256과 일치한다. 운영 접근·배포·발행·Discord 전송·자동 예약 재개는 하지 않는다.
- 검증 계획: 실행 전 DB 백업 목록 검사 → 두 출처 순차 수집 → DB/report/raw/media 해시 및 이미지 decode 확인 → HTTP/CDN 주소 집계와 실패 연속 처리 확인.

## 실제 결과

| 출처 | 상태 | 후보 | 중복 제외 | 신규 저장 | 이미지 | 오류 | 소요 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 오늘의유머 | COMPLETED | 5 | 4 | 1 | 2 | 0 | 27.7초 |
| 더쿠 | COMPLETED | 5 | 0 | 5 | 13 | 0 | 167.8초 |

- 합계 신규6글·이미지15개·오류0. 정상 종료 후 RUNNING 실행0 확인.
- [실행 결과](runs.json), [저장 검증](verification.json), [백업 확인](backup.json).
- 실행 전 개발DB custom dump 1,840,933bytes, pg_restore 목록714항목 확인. 백업은 `.local-data/backups/`에0600으로 보관했다.
- 두 실행 모두 `scripts/local/verify-batch-run.mjs`로 report/checkpoint 원장·실패 수·원문/본문·이미지 크기/SHA-256/전체 프레임 decode를 검사해 readbackPass=true. 미디어 총2,296,440bytes.
- 오늘의유머 이미지는 `https://thimg.todayhumor.co.kr`2개, 더쿠는 `https://img-cdn.theqoo.net`13개다. 이번 실사이트 표본에는 HTTP 이미지·새 외부CDN·이미지 오류가 없어 해당 경계는 실사이트 검증으로 판정하지 않는다. 해당 경계의 이전 합성 회귀312개 증거와 구분한다.
- 신규6글의 게시시각은 parser에서 확인되지 않아 unknownDates로 집계됐다. `--since 24h` 옵션은 유지했지만6글의 실제 게시시각이24시간 이내라고 확정하지 않는다.
- 시작/종료 시 자동 작업4개 모두 disabled/미로드. Java/JAR SHA-256은 직전 검증 상태와 일치한다. 소스·정책·설정 변경 없음. commit/push/운영 배포 없음.

## Discord 문의

- 사용자가 실행 중 개발 Discord에 메시지가 오지 않는 이유를 문의했다.
- 이번에는 `run-batch.mjs batch --write-db`로 수집기만 실행했다. 별도 Discord 검수 maintain/scan은 이전 중지 지시 상태를 유지해 실행하지 않았다. 수집기는 DB·파일에만 저장하며 직접 Discord로 전송하지 않는다.
- 수집 테스트 범위에 Discord 전송이 포함되지 않았음을 설명했다. Discord 전송·검수·발행 또는 예약 재개를 실행한 결과로 보고하지 않는다.
- 후속 검증이 필요하면 HTTP/외부CDN 실제 대상 및 개발 Discord 전송 범위를 정해 별도로 실행한다.
