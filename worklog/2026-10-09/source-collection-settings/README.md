# 수집처 수집 여부·URL 관리와 배치 연동

- 담당: Codex / 상태: 종료 / 갱신: 2026-10-09 22:28 KST.
- 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치 `feature/discord-review` / HEAD `abf21ea`.
- 요청: 수집처 URL 표시, 수집 여부·자동 발행 여부를 select로 함께 저장하고 배치가 DB 설정을 읽어 동작.
- 앞선 [메뉴 분리](../source-management-menu/README.md) 종료 확인. 기존 미커밋 개발분을 보존한다.
- 담당 경로: Collector V016·수집처 설정/실행 경로·로컬/운영 실행기·권한/백업, API 수집처 설정 목록·통합 저장·계약, Web 관리 화면, 관련 테스트·planning/system-design/spec/status·이 기록.
- 결정: Collector 소유 수집 설정과 API 소유 발행 정책은 별도 소유권 유지. API는 제한 함수로 수집 설정을 변경하며 한 transaction에서 두 설정을 저장한다. 두 버전 중 충돌이 있으면 전체 rollback. 자동 발행 값이 같으면 해당 정책 버전을 불필요하게 바꾸지 않는다.
- 초기 수집 여부는 기존 설정을 유지한다. SOURCE_DISABLED 임시 중지는 관리자 ON으로 재개 가능. 파서/URL/미검증·BLOCKED 등 기술 제한은 별도 보존한다. URL은 설정의 수집 주소에서 가져오고 편집하지 않는다.
- 배치는 등록된 source를 평가하며 DB OFF는 외부 HTTP 전에 skip한다. 실행 중에는 매 HTTP 요청 전에 DB 값을 재검사한다. Collector 재시작/설정 재읽기는 관리자가 저장한 값을 덮어쓰지 않는다.
- 검증: 실제 격리 DB 저장/충돌/권한·배치 OFF 무요청/ON/재시작/실행 중 OFF, API·Web·Java·실행기 테스트, 로컬 백업/마이그레이션/화면. 운영 적용·실제 재수집·예약 재개·commit/push는 범위 밖.

- 22:24 KST 후속 요청: 별도 설정 영역을 없애고 각 수집처 행에 두 select와 저장 버튼 배치. 행별 저장/오류/충돌 재조회가 다른 행의 미저장 변경을 건드리지 않도록 변경한다.

## 배치·DB 적용 증거

- Collector 전체 86 suites / 313 tests 통과, 실패·오류·skip 0. 이 중 실제 격리 DB readback 22개. DB OFF 외부 요청 0, ON 저장 및 새 BatchStore/구성 재읽기 유지, 요청 permit 대기 중 OFF 차단을 확인했다.
- 최소 권한 검증: 역할 5개 분리, Collector V016/API V015, 실제 restricted batch 수집·API 접근 경계, 별도 DB 백업 복원 88 tables/17 sequences 일치. 로컬 batch 권한 테스트도 통과했다.
- 실행기/계약 Node 7개, 운영 실행기 Python 4개 통과. 실제 운영 배치 실행은 하지 않았다.
- 로컬 DB 사전 백업 1,852,647 bytes/0600 및 archive 목록 확인. SHA와 보존 테이블 건수/해시는 [local-readback.json](local-readback.json)에 기록했다.
- 로컬 Collector V016 및 API/batch 최소 권한 적용 후 `sources-sync`만 실행: 21개 수집처/21개 URL. 기존 수집 ON 13곳, 임시 중지 6곳, 기술 제한 2곳 유지. 관리자 변경 이력 0행, 자동 발행 정책/이력 0행(전체 기본 OFF).
- 실제 로컬 `batch --source inven --dry-run --max-pages 1 --max-items 1`: exit0 / SKIPPED / SOURCE_DISABLED / pages0·fetched0·failures0. OFF 경로 검증이며 외부 수집은 실행하지 않았다.
- 기존 게시물30·수집항목948·검수47·검수명령17은 전체 행 해시까지 동일. 개발 수집/Discord scan/maintenance/awake 예약 4개 disabled·unloaded 유지.
- 초기 회귀 실패: 새 설정 조회의 기술 차단 사유가 SOURCE_DISABLED로 합쳐지는 문제를 수정했다. HTTP/retention fixture에 새 메타데이터 초기화를 추가했고, mailbox 최소 권한 fixture에 설정 조회·동기화 권한을 추가했다. Java 25 미지정, 빌드와 test artifact 동시 사용, mailbox fixture의 포트55449 제한으로 실패한 실행은 통과 증거에서 제외한다.
- 행별 UI 변경 전 품질 receipt는 이후 입력 변경으로 최종 증거가 아니다. 최종 행별 UI 빌드·브라우저 검증과 API 전체 검사 결과는 아래 후속 결과에 남긴다.

## 행별 UI 후속 결과

- 별도 수집처 선택·설정 form을 제거했다. 목록의 각 행에 URL·수집 여부 select·자동 발행 여부 select·저장 버튼을 배치했다. 변경 없는 행의 저장은 비활성이다.
- 저장 성공/충돌/응답 불명확 메시지는 해당 행에 표시한다. 해당 행의 최신 값만 다시 읽고 다른 행의 미저장 값은 보존한다. EDITOR 조회 전용과 OWNER 저장 권한은 유지한다.
- 행별 UI 최종 품질 검증: [receipt](verification/2026-10-09T13-24-19.361Z-quality-68384.json)의 14개 검사 통과, problems0. 일반 unit 88개 포함. 이 입력 이후 source/contract 변경 없음.
- Docker 브라우저 7개 통과(실패/skip0): 행별 ON/OFF 저장·새로고침·다중 행 미저장 값 보존·충돌·OWNER/EDITOR·초기 조회 실패 복구·기능 OFF·관련 메뉴. 1280/390/320px 화면 넘침 검사 및 [데스크톱](admin-sources.png)/[모바일](admin-sources-mobile.png) 화면 확인. 모바일 표는 내부 가로 스크롤을 사용한다.
- 실제 Chrome `http://localhost:3000/admin/sources`: 21행/42select/21저장 버튼/별도form 없음, 인벤 수집OFF·자동발행OFF·URL 확인. 실제 로컬 설정 저장/활성화는 하지 않았다.
- 로컬 API PID84356/Web PID85126, 포트3100/3000, readiness READY. 기존 LaunchAgent 재시작으로 최신 빌드를 반영했으며 예약 worker는 시작하지 않았다.
- 표시 URL은 기본 목록·다른 등록 목록 순, 목록 없는 단건 전용 출처는 구성의 HTTPS 사이트 루트 주소다. URL 표시가 목록 수집 지원을 의미하지 않는다.
- 변경 문서 상대 링크437개 존재 및 git diff --check 통과. 법무 placeholder/출시 차단 항목 변경 없음. 운영 배포·예약 재개·commit/push 없음.

## 최종 결과

- API 전체 inventory 37개 파일/162개 테스트 통과, 실패/skip0. 처음34파일 통과 후 schema-restore의 postgres 역할 환경 오류를 바로잡고 schema-restore/sitemap/source-auto-publish 3파일을 같은 최종 소스로 재검증했다. API·Collector 권한/원자적 저장·자동 발행 최종 guard·백업 복원 포함. [검증 집계](test-summary.json).
- 행별 UI 최종 receipt 재검사 valid=true/problems0. HEAD abf21ea 및 feature/discord-review 유지, 기존 미커밋 변경 보존.
- 완료: 요청한 행별 수집 여부/자동 발행 여부/URL/저장, DB→배치 연동, 로컬 적용 및 검증. 운영 적용은 수행하지 않았으며 예약 중지는 유지했다.
