# 04:30·16:30 예약 수집 신뢰성 보완

- 요청: 정기 배치를 다시 점검하고 저녁 확인 시 실제 실행되도록 보완.
- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004` / 시작 HEAD: `0189763`
- 상태: 인계 — 예약 보완·검증 완료, AC 상시 잠자기 방지 선택 대기 / 갱신: 2026-10-07 06:32 KST
- 다음 담당: 이 세션 Codex. 사용자 선택 후 awake 후보 설치·assertion 확인 또는 실행 중 보호만 유지. 16:30 실제 실행 결과는 해당 시각 이후 별도 관측한다.
- 범위: 로컬 예약 실행기·출처 선택 필터·해당 검사·launchd 설정·개발 DB 재시작 정책(`compose.yaml`)·관련 planning/architecture와 이 기록. 기존 Discord 검토 기록은 보존한다.
- 선행: [오늘 오전 실패 조사](../batch-schedule-morning-check/README.md).

## 확인·보완 계획

- 예약04:30·16:30, OS Asia/Seoul, 설치된 LaunchAgent 활성 상태 확인. 현재06:22 수집은 실행 중이므로 중간에 종료하지 않는다.
- AC 전원·배터리100%, AC 자동 잠자기1분·PowerNap 활성. 새벽12개 출처 DNS 실패는 확인했으나 잠자기가 유일한 원인이었다고 확정하지 않는다.
- 실행 중 잠자기 방지, DNS/로컬 DB 준비 대기, 일시적 네트워크 실패 출처만 제한 재시도, 최종 상태 파일을 추가한다. 정책 차단·영구 실패·성공 출처는 재시도하지 않는다.
- 16:30 미래 실행 결과는 현재 검증 완료라고 주장하지 않는다. 전원 종료·로그아웃·덮개 닫힘·외부 네트워크 장애는 예약만으로 해결되지 않는다.

## 구현·검증 결과

- 네트워크/DB 준비60초 간격 확인, 총2시간 기한, 일시 오류 출처만5분·15분 후 재시도, 상태 JSON 원자적 저장, 실행 중 caffeinate 보호를 구현했다. 기존06:22 실행은 중단하지 않으며 새 로직은 다음 실행부터 적용된다.
- 단위·실프로세스 검사16건 통과: 준비 실패→복구, 재시도 대상 제한, 제외 출처 보호, 최대3회 제한, 시간 만료, 취소, 실제 child 종료/보고서→재실행→성공, 빈 보고서 성공 오판 방지. 초기 선택 필터 fixture 실행 인자는 기존 `--max-items 10` assertion과 일치하도록 보완했다.
- 별도 임시 폴더에서 새 예약 실행기 main을 실제 기동했다. DNS/DB TCP 준비 확인→fixture child→로그·COMPLETED 상태 파일→정상 종료 readback 통과. 사이트 수집·DB 쓰기 없는 실행기 검사이며 실수집 결과로 보고하지 않는다.
- 설치 plist와 생성본 완전 일치,04:30·16:30 트리거, 절대 Node/Java 경로, Asia/Seoul 확인. 따라서 활성 배치를 종료하는 launchd 재등록은 불필요하다. 같은 절대 스크립트 경로의 새 코드가 다음 예약에 적용된다.
- Oxlint, Compose 설정, diff whitespace, hooks 설치 검사 통과. DB `restart=no`를 `unless-stopped`로 바꾸고 compose 정본 동기화. healthy·기존 StartedAt 유지로 DB 재시작 없음 확인.
- 현재 배치 PID20419를 기다리는 caffeinate PID21756으로 실행 중 잠자기 방지를 즉시 적용했다. `pmset -g assertions`에서 해당 PID의 두 assertion을 확인했다. 이 보호는 해당 배치 종료 시 자동 해제된다.
- 진행 중 DB 관측: 클리앙4·디미토리9·개드립8·웃대6·인스티즈3건 FETCHED(합30건). 중간 관측이며 전체 실행 결과는 이전06:22 로그를 따른다.

## AC 전원 자동 잠자기 방지 선택

- 별도 후보 `.local-data/batch-schedule/com.blariyo.local-collection.awake.plist` 생성·문법 검증 완료. `/usr/bin/caffeinate -s`, RunAtLoad/KeepAlive로 AC 전원에서 예약 대기 중 시스템 잠자기를 막으며 화면 잠자기와 배터리 사용을 유지한다.
- 사용자에게 적용 여부를 질문했으며 응답 전에는 이 후보를 설치하지 않는다. 실행 중 잠자기 방지와 별개다. 현재 AC 자동 잠자기1분 설정을 그대로 두면 정시 네트워크 준비를 보장할 수 없다.
- 적용 승인 후 설치: `install -m 600 .local-data/batch-schedule/com.blariyo.local-collection.awake.plist ~/Library/LaunchAgents/com.blariyo.local-collection.awake.plist`, `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.blariyo.local-collection.awake.plist`.
- 전체 예약 중단 시 수집 job 및 awake job을 각각 `launchctl bootout gui/$(id -u)/<label>`로 해제하고 두 설치 plist를 제거한다. awake를 설치하지 않았다면 기존 수집 job만 해제한다.

## 확인 경로

- 예약 등록: `launchctl print gui/$(id -u)/com.blariyo.local-collection`
- 새 실행 결과: `.local-data/batch-schedule/status.json` (새 코드 첫 실행부터 생성)
- 원시 출처 보고서: `.local-data/batch-schedule/logs/run-*.log`
- 다음 예정 실행:2026-10-07 16:30 KST. 그 시각의 실제 실행·신규 수집은 아직 관측하지 않았다.

## 후속 확인 — 2026-10-07 19:38 KST

- 사용자 요청으로 오늘 실제 실행을 로그·status.json·DB와 다시 대조했다. Git 기준 `c2a5e11`, 기존 Discord 검토 기록 보존.
- 04:30:04~04:32:03 예약 실행: DNS 실패12곳·목록 미검증3곳, 정상 수집0건.
- 06:22:33~06:43:12 수동 재실행 종료 확인. 현재 DB 연결 항목 중 FETCHED114건(과거 실행 보고서의 원시 처리 건수와 구분).
- 16:30:09~16:54:47 예약 실행·종료 확인. 15곳 시도, 정상 수집139건을 출처 보고서 합계 및 DB FETCHED 합계로 교차 확인했다. 소요24분38초.
- 정상 종료 출처6곳: 고급유머15·디미토리20·개드립20·네이트판12·웃대19·루리웹20건. 부분 적재 출처: 더쿠7·율도13·인스티즈13건. 클리앙·오늘의유머와 더쿠·인스티즈는 SOURCE_NOT_ALLOWED, 이토랜드 PARSE_FAILED, 율도 LIST_STRUCTURE_CHANGED, 나머지3곳 CHART_UNVERIFIED가 보고됐다.
- 최종 `COMPLETED_WITH_ERRORS`·exit1이며 전체 성공을 뜻하지 않는다. 재시도 대상인 일시 네트워크 오류가 없어1회만 실행했다. launchd runs4·현재 not running·두 예약 트리거 유지 확인.
- AC 상시 잠자기 방지에 대한 사용자 선택은 여전히 미수신이며 설치하지 않았다. 이번16:30 실동작 증거와 향후 전원/네트워크 보장은 구분한다.
