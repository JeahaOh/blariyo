# 개발 배치 일시 중지·운영 상태 확인

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 16:50 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: 운영 배치 상태 확인, 개발 배치 일시 중지.
- 변경 범위: 개발 수집·Discord scan/maintenance·수집용 awake LaunchAgent 비활성/해제 및 이 기록. 운영은 읽기 전용. 개발 Web/API·DB 유지.
- 기존 untracked 기록 보존. 앱 코드·DB 데이터·운영 설정 변경, commit/push 없음.

## 개발 중지 결과

아래 네 label에 `launchctl disable gui/503/<label>`과 `launchctl bootout gui/503/<label>`을 실행해 모두 exit 0을 확인했다.

- `com.blariyo.local-collection`: 04:30/15:30 수집.
- `com.blariyo.discord-review.scan`: 07:30/17:00 검수.
- `com.blariyo.discord-review.maintenance`: 60초 간격 전송·검수 복구·삭제 유지보수.
- `com.blariyo.local-collection.awake`: 배치용 AC 잠자기 방지.

재조회: 네 서비스 모두 미등록, 네 label 모두 disabled. 관련 Python/Java/Node 배치 프로세스 잔존 없음. plist와 DB 데이터는 삭제하지 않았다. 재로그인 후에도 자동 재개되지 않는다. 재개는 사용자 요청 후 해당 label enable 및 보존한 plist bootstrap으로 수행한다.

개발 앱 `com.blariyo.discord-review.development`는 running 유지. Web `/meme` HTTP 200, API `/internal/health/ready` HTTP 200. 로컬 PostgreSQL 컨테이너 healthy. 첫 탐색의 `/health` HTTP 404는 경로 오류이며 정식 readiness 경로로 재확인했다.

## 운영 읽기 전용 확인

조회 시각: 2026-10-09 16:47 KST. 운영 서비스·예약·DB 설정은 변경하지 않았다.

- 수집 timer enabled/active. 오늘15:30 시작,16:08:04 `COMPLETED_WITH_ERRORS` 종료. 조회 시점 수집 컨테이너 없음. 다음 수집10/10 04:30 KST.
- 출처15개 모두 시도: COMPLETED2/BLOCKED8/FAILED3/TIME_LIMIT2. 보고서 fetched 합계46이며 DB/객체 신규 저장46건을 독립 검증한 수치는 아니다. 서비스 exit1을 정상 완료로 표시하지 않는다.
- Discord scan timer enabled/active, 다음10/9 17:00 KST. 유지보수 worker 컨테이너 실행 중.
- 오전 scan service는 exit1 기록이 있으나 read-only DB의07:30회차는07:36:24 COMPLETED. summary 승인15/반려6/무승인188. 실제 게시글 발행 상태 전수 대조는 이번 범위에서 미실행. 서비스 종료 결과와 업무 회차 완료를 구분한다.
- 운영 Web/API 컨테이너 healthy. 출처 차단·파싱/접근 실패·시간 초과 원인 수정은 이번 중지 요청 범위 밖이며 미수행.

## 검증과 잔여

- 실행: launchctl disable/bootout 및 readback, 프로세스 잔존 확인, 개발 HTTP readiness, 운영 systemd/status.json/journal/container 조회, 운영 scan 요약 READ ONLY SQL.
- sandbox에서 ps 조회가 제한돼 승인된 비상자화 읽기 전용 조회로 잔존 여부를 확인했다. LaunchAgent 변경은 사용자의 개발 배치 중지 요청 범위로 승인받아 실행했다.
- Git 작업 전후 상태·diff whitespace 확인. 변경은 이 기록만이며 기존 기록 보존. 앱 코드 변경이 없어 build/test 미실행.
- 운영 수집은 부분 실패 상태를 유지한다. 다음 예약의 성공은 보증하지 않는다. 개발 배치는 재개 요청 전 비활성 유지.
