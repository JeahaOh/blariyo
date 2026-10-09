# 10월9일15:30 운영 수집 부분 실패 사유

- 담당: Codex / 상태: 종료 / 작업일: 2026-10-09 KST.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` / 브랜치: `feature/discord-review`.
- 요청: 직전 보고한 부분 실패의 사유 확인.
- 범위: 운영 status.json/source 설정·batch_failure READ ONLY 조회, 현재 코드 및 배포 source SHA 대조, 이 기록. 재수집·설정/코드 수정·배치 재개 없음.
- 기준 실행: 2026-10-09 15:30:02~16:08:04 KST, source SHA `b57724dbb6309fc07f76c49e4a9e69d5708215cd`.

## 출처별 사유

| 출처 | 결과·코드 | 확인된 단계/영향 |
| --- | --- | --- |
| 에펨코리아·뽐뿌·유튜브 커뮤니티 | BLOCKED / CHART_UNVERIFIED | 운영 설정 chartVerified=false. 목록 검증 선행 조건에서 중단, 각0건. 이번 실행에서 외부 접근 실패를 새로 확인한 것이 아님 |
| 디미토리·개드립 | BLOCKED / SOURCE_ACCESS_BLOCKED | LIST 단계 접근 차단, 각0건. HTTP401/403 또는 접근 확인 페이지를 같은 코드로 표현하므로 정확한 응답 종류는 현재 결과만으로 미확정 |
| 클리앙 | BLOCKED / SOURCE_NOT_ALLOWED | LIST 단계에서 내부 허용 정책 위반,0건. 어느 URL/redirect가 판정을 일으켰는지는 미확정 |
| 더쿠·오늘의유머 | BLOCKED / SOURCE_NOT_ALLOWED | 각각7건 성공 뒤 후속 글 PARSE 단계 내부 허용 정책 위반. 구체적인 본문/이미지 URL과 위반 조건은 미확정. 외부 사이트 접근 차단으로 단정하지 않음 |
| 이토랜드 | FAILED / PARSE_FAILED 3회 | 목록1페이지 발견5건 중 중복2·본문 파싱 실패3·성공0. 코드의 사이트 실패3회 중단 조건에 도달 |
| 루리웹 | FAILED / SOURCE_FETCH_FAILED | LIST 단계 응답 취득 실패,0건. 이 코드는 전송 예외를 묶으므로 timeout/TLS/socket 중 정확한 원인은 미확정 |
| 율도 | FAILED / LIST_STRUCTURE_CHANGED | 첫 목록1페이지에서13건 성공·중복2 후 다음 목록 파싱 실패. 실제 DOM 변경/빈 목록/다른 응답 중 어느 것인지 원문 재대조 미실행 |
| 웃긴대학·인스티즈 | TIME_LIMIT / exit143 / REPORT_MISSING | 각각 약7분 후 스케줄러의 출처별 제한으로 종료. 최종 보고서가 없어 중간 성공 건수는 이 보고서로 판단 불가 |
| 고급유머·네이트판 | COMPLETED | 각각15건·4건 성공, 네이트판 중복16건 |

## 합계와 해석

- 15개 출처 중 COMPLETED2/BLOCKED8/FAILED3/TIME_LIMIT2.
- 최종 보고서 fetched 합계46 = 고급유머15+네이트판4+더쿠7+오늘의유머7+율도13. 시간 초과2개 출처의 중간 수집은 포함 여부를 확정할 수 없다. DB/object readback 전수 검증 수치 아님.
- 출처 한 개라도 비정상 exit/error/stopReason이면 wrapper가 COMPLETED_WITH_ERRORS로 집계한다. 수집된 모든 글이 실패했거나 전체 트랜잭션이 취소됐다는 뜻이 아니다.
- 전체15개 oomKilled=false, 표본 호스트 가용RAM 최소736.3MiB, RESOURCE_OR_HTTP_LIMIT 중단 없음. 이번 결과에는 메모리 부족 강제 종료 증거가 없다. 성능 병목 전체를 배제한 것은 아님.
- SOURCE_NOT_ALLOWED는 내부 URL/설정 보안 규칙, SOURCE_ACCESS_BLOCKED는 접근 응답/페이지 판정이다. 서로 다른 사유다. robots는 현재 자동 차단 조건이 아니다.
- URL 규칙/본문 파싱/후속 목록은 실패 원문으로 재현 후 최소 수정 검토, 시간 초과는 중간 진행·요청 대기를 확인할 필요가 있다. 제한 완화·차단 우회는 실행하지 않았다.

## 근거와 검증

- 운영 `/opt/blariyo/collector/status.json`, `/opt/blariyo/collector/sources.json`, `collect.batch_failure` 조회. 본문·비밀·전체 URL은 기록하지 않음.
- [실행기](../../../deploy/collector/run.py), [수집 처리](../../../apps/collector/src/main/java/com/blariyo/collector/run/DirectBatchRunner.java), [요청 처리](../../../apps/collector/src/main/java/com/blariyo/collector/run/SourceRequests.java), [URL 허용 정책](../../../apps/collector/src/main/java/com/blariyo/collector/source/SourcePolicy.java), [전송 오류](../../../apps/collector/src/main/java/com/blariyo/collector/source/PinnedHttp.java).
- 위 Java 핵심4파일의 배포 source SHA~HEAD diff 없음 확인. 현재 소스의 예외 의미를 런타임 근본 원인 확정으로 확대하지 않음.
- 작업 전후 Git 상태·상대 링크 존재·whitespace 검사. 기존 untracked 보존. 코드 변경이 없어 build/test 미실행.
