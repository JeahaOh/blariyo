# 로컬 수집 배치 정기 실행

- 요청: 중단 지시 전까지 매일 04:30·16:30에 모든 수집처 배치 실행.
- 담당: Codex / 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 시작 HEAD: `d4ab0a1`
- 상태: 종료 — 예약 설치·첫 실행 확인 완료, 첫 전체 배치는 백그라운드 진행 / 갱신: 2026-10-06 22:07 KST
- 변경 범위: `scripts/local/{scheduled-batch.mjs,scheduled-batch.test.mjs,render-batch-schedule.py}`, 수집 planning·architecture, 이 기록, 로컬 LaunchAgent.
- 다른 담당의 `worklog/2026-10-06/discord-admin-review/`는 보존한다. 해당 기록은 종료 상태이며 이번 변경과 겹치지 않는다.

## 실행 계약

- macOS 사용자 LaunchAgent `com.blariyo.local-collection`, 한국 시간 04:30·16:30, 종료일 없음.
- 기존 `run-batches.mjs --write-db --max-pages 2 --max-items 20 --since 24h`를 실행한다. DB는 `127.0.0.1:5439/blariyo_local` 고정이다.
- 등록21곳 중 임시 제외6곳(디시·아카라이브·보배드림·인벤·MLBPARK·PGR21)을 유지하여15곳 시도. 기존 출처별 정책 검사·차단은 유지하므로 시도 수와 성공 수는 다르다.
- 기본 출처 병렬3, 출처별 요청 간격5초. 같은 launchd job은 중복 기동하지 않는다. 2시간 초과 시 해당 배치 프로세스 그룹 종료,30초 유예 후 강제 종료한다.
- 실행별 로그 `.local-data/batch-schedule/logs/run-*.log`는14일 보존하며, 비밀 설정을 plist에 넣지 않는다.
- 로그인 세션·Docker/로컬 DB가 필요하다. 잠자기 중 예정 실행은 깨어난 뒤 한 번으로 합쳐질 수 있으며, 전원 종료·로그아웃 중 정시 실행은 보장하지 않는다. 시스템 잠자기 설정은 변경하지 않는다.

## 등록·조회·중단

```sh
python3 scripts/local/render-batch-schedule.py --node /Users/zeaha/.nvm/versions/node/v24.18.0/bin/node --java-home /opt/homebrew/opt/openjdk@25
install -m 600 .local-data/batch-schedule/com.blariyo.local-collection.plist ~/Library/LaunchAgents/com.blariyo.local-collection.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.blariyo.local-collection.plist
launchctl print gui/$(id -u)/com.blariyo.local-collection
# 즉시 1회 실행: 이미 실행 중이면 중복 실행하지 않는다. -k 사용 금지.
launchctl kickstart gui/$(id -u)/com.blariyo.local-collection
# 중단: 예약과 현재 실행을 종료하고 재로그인 시 재등록을 막는다.
launchctl bootout gui/$(id -u)/com.blariyo.local-collection
rm ~/Library/LaunchAgents/com.blariyo.local-collection.plist
```

## 검증

- Node24 단위 검사9건 통과: 기존 병렬 실행6건과 신규 종료 코드 전달·SIGTERM 무시 프로세스 제한 종료·실행 파일 오류3건. 신규 스크립트 Oxlint, Python 구문, plist 문법, `git diff --check`, hooks 설치 상태 확인 통과.
- 설치된 plist를 생성본과 비교해 일치 확인. `launchctl print gui/503/com.blariyo.local-collection`에서04:30·16:30 두 트리거 등록 확인.
- 22:05:26 KST 첫 실행 시작. 시작 로그의 대상15곳·제외6곳·병렬3 확인. 실행 중 `kickstart` 재호출 전후 PID81347·runs1 유지로 중복 기동 없음 확인.
- 로컬 DB readback: 클리앙 BLOCKED1건, 디미토리 RUNNING2건 중 FETCHED1건, 개드립 RUNNING1건. 이 수치는 첫 실행 중간 관측이며 전체 성공을 뜻하지 않는다. 출처별 결과와 전체 종료 코드는 실행 로그에서 확인한다.
- 로그: `.local-data/batch-schedule/logs/run-2026-10-06T13-05-26.633Z.log`. 다음 예약은2026-10-07 04:30 KST다. 대화를 종료해도 launchd가 유지하며 중단 지시 시 등록 해제한다.
- 정시 트리거 실관측은 다음 예약 시각 이후 확인 가능하다.
- 커밋 범위는 이 작업6개 파일만이며 기존 Discord 검토 기록은 보존한다. push·운영 변경은 수행하지 않는다.
