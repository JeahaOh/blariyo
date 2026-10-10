# 새벽 운영 수집 차단 사유 확인

- 요청: 오늘 새벽 수집 차단 사유 확인. 운영 읽기 전용 조사.
- 담당: Codex / 상태: 종료 / 갱신: 2026-10-10 08:39 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 브랜치: `feature/discord-review`, 기준 HEAD `6990dea`.
- 담당 경로: 이 기록 폴더만. 기존 관리자 UI3파일과 다른 세션/과거 기록은 보존한다. 이전 담당은 종료 확인.
- 대상:10/10 04:30 KST 운영 예약 배치. SSH host key·hostname 확인을 유지하고 구조화 로그·DB SELECT만 조회. 앱·운영 설정·DB 쓰기·재수집·메시지 발송 없음.
- 기준: `docs/ai/README.md`, `docs/operations/deployment-runbook.md`, `deploy/collector/run.py`와 Collector 실제 코드의 실패 코드 계약.
- 검증 계획: 운영 실행 JSON·DB 실패 phase/checkpoint·안전한 설정 필드 대조. HTTP 상태/응답 원문을 기록하지 않은 실패는 근본 원인을 추측하지 않는다.

## 운영 읽기 결과

- 실행:10/10 04:30:02~05:12:20 KST, `COMPLETED_WITH_ERRORS`.21곳 중 정상3·BLOCKED6·FAILED3·TIME_LIMIT3·설정OFF 건너뜀6. systemd 서비스는 종료 코드1/failed이며 실제 수집이 계속 실행 중인 상태가 아니다.
- BLOCKED: 클리앙 `SOURCE_NOT_ALLOWED`; 디미토리·개드립 `SOURCE_ACCESS_BLOCKED`; 에펨코리아·뽐뿌 `SOURCE_NOT_ALLOWED`; 유튜브 커뮤니티 `CHART_UNVERIFIED`.
- 클리앙·디미토리·개드립은 DB 수집 ON/available이며 최초 목록 LIST 단계에서0페이지·0건으로 종료. 이미지 단계의 HTTP/CDN 허용 변경과 별개다. 클리앙 설정의 승인/호스트/목록 URL은 유효한 형태이며, 실패 detail은 비어 있어 주소 검사·DNS/IP 검사·리다이렉트 어느 지점인지 기록만으로 확정할 수 없다. 디미토리·개드립은 코드상 HTTP401/403 또는 본문의 접근 확인/차단 페이지 판별에 해당하며 실제 상태 코드·본문은 기록되지 않았다.
- 에펨코리아·뽐뿌는 파일의 collectionPolicy=BLOCKED, DB collection_available=false·collection_enabled=false. 기존 수집 불가 제한이며 네트워크 실행 전 종료라 이번 run DB행은 생성되지 않았다. 관리 화면의 기존 제한과 일치한다.
- 유튜브는 collectionPolicy=DETAIL_ONLY·charts={}·chartVerified=false. 상세 링크 수집 대상이지만 이번 자동 목록 배치에는 유효한 목록이 없어서 run 생성 전 CHART_UNVERIFIED. 수집 ON만으로 자동 목록 수집을 지원하는 것은 아니다.
- 일반 FAILED: 이토랜드는 목록1페이지·발견5·중복2 뒤 상세 PARSE_FAILED3건·성공0. 루리웹은 LIST/SOURCE_FETCH_FAILED·0페이지. 율도는1페이지·15건 수집 완료 후 LIST_STRUCTURE_CHANGED로 다음 목록 단계 실패.
- 시간 제한: 웃긴대학04:35:45~04:42:47, 인스티즈04:42:47~04:49:50, 더쿠04:52:56~04:59:58 각각7분 제한·exit143·REPORT_MISSING. 모두 OOM=false이며 로그상 메모리/HTTP 보호 중단은 없음. DB run은3개 모두 RUNNING/finished_at=null로 남아 있어 화면의 수집 중 표시가 실제 프로세스 상태와 다르다. 7분 안에 끝나지 않은 세부 지연 원인은 이번 구조화 기록으로 확정하지 못했다.
- 정상: 고급유머15건·네이트판2건·오늘의유머12건 신규 수집. 위 정상3곳의29건과 율도15건 외 시간 제한 실행의 저장 건수는 이번 조회에서 합산하지 않았다.
- 근거: [운영 읽기 결과](production-readback.jsonl), [읽기 전용 조사 코드](read-server.py). 코드 해석 대상 Collector/runner는 운영 main77a425d와 현재 HEAD 사이에 변경 없음 확인.
- 후속 권고: LIST 실패의 안전한 세부 원인(검사 종류·HTTP 상태) 기록, 종료 제한의 DB 상태 정리, 유튜브 DETAIL_ONLY의 자동 목록 배치 대상 구분. 구현·재수집은 실행하지 않았다.
- 앱·정책·DB 쓰기·운영 재시작·외부 메시지 없음. 조회를 위해 원문 사이트를 새로 스크랩하지 않았다. 기존 UI 변경과 다른 기록 보존.
