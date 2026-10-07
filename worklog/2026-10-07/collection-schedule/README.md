# 운영·개발(로컬) 정기 수집 시간 통일

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/collection-schedule-0430-1530`, 기준 release `1c255a9`의 후속 `9012d0c`에서 분기.
- 상태: 종료 / 갱신: 2026-10-07 20:31 KST. 설정·설치·활성화·소량 실행 검증 완료, 다음 예약의 자동 실행은 미래 관측 사항.
- 요청: 운영·개발·로컬 정기 수집을04:30/15:30 KST로 통일. 개발과 로컬은 같은 환경이라고 사용자 확인.
- 범위: 로컬 LaunchAgent 시간 변경·재등록, 운영 정기 direct collector 설치·timer 활성화, 정책·실행 계약·검증 기록. 기존 제외6개 출처·5초 간격·출처별 일일5000요청·자동 발행 금지 유지.
- CPU/RAM 로그 질문: 기록 방식의 부하를 검토하고 수치와 조건을 구분해 보고. 별도 모니터링 스택 도입 없음.
- 기존 변경 보존: 앞선 운영 시험의 기획/설계 변경을 이어 반영하고, 다른 세션 discord 기록은 변경하지 않는다. 공유 폴더 기록상 다른 수정 담당은 종료, 로컬 배치 신뢰성 인계는 이 세션 담당이다.
- 검증: schedule 렌더링·launchd readback, 운영 unit 검증·다음 실행 시간, main과 동일 source의 Collector 산출물·권한·제한 확인, 제한된 운영 실행·중복 실행 방지·서비스 영향 관측.

## 반영 결과

| 환경 | 설치 상태 | 예약 시각 |
| --- | --- | --- |
| 운영 | `blariyo-collection.timer` active/enabled | 04:30·15:30 Asia/Seoul |
| 개발=로컬 | `gui/503/com.blariyo.local-collection` 재등록·live readback | 04:30·15:30, 기존16:30 제거 |

- 다음 운영 예약은2026-10-08 04:30·15:30이다. 10월7일 변경 시각에 이미 지난 예약을 소급 실행하지 않았다.
- 운영15개 활성 출처, 동시1개·CPU0.5·RAM512MiB·heap256MiB, 출처별7분·전체2시간. 로컬 기존 동시3개·일시 실패 재시도는 유지했다.
- 운영 전용 `blariyo_batch` role·단일IP HBA·비공개 collect 저장소 writer를 설치했다. content/legal 접근 불가를 확인했고 API/Web/DB schema는 이번 예약 작업에서 변경하지 않았다.
- 로컬 설치 전 plist 백업: `.local-data/batch-schedule/before-0430-1530.plist`. 대기 중 AC 잠자기 방지 설정은 추가하지 않았다.
- 운영 결과 JSON14일 보관, 최소 호스트 가용 RAM과 오류를 기록한다. 주기적인 CPU/RAM 사용량 로거는 추가하지 않았다.
- [실행·확인·중단 안내](../../../deploy/collector/README.md), [수집 기획](../../../docs/planning/content-collection/README.md), [설계](../../../docs/system-design/07-spring-collector-design.md)에 반영했다.

## 산출물과 실제 실행 증거

- main: `b57724dbb6309fc07f76c49e4a9e69d5708215cd`. 동일 소스의 [CI #57 산출물](https://github.com/JeahaOh/blariyo/actions/runs/37610919403/artifacts/11477238476)을 사용했다. 서버 빌드와 이전 feature 시험 JAR 재사용은 하지 않았다.
- artifact ZIP SHA256: `58f967e3117abda513893cc0f8e9d271789757365a98b896db86ddb947c4aff6`.
- Collector JAR SHA256: `5a7f34c330859e4a1530dfd7fc35a1c43ce1dd08655b5b61e5afb6cde8c3ce55`.
- runtime: `eclipse-temurin@sha256:78498f30dd330b06755c1b134039dcbf8324bedb385136819dd519b842a3816a`.
- 20:25:36–20:25:56 KST goodgag1페이지·1건 제한 실행: `COMPLETED`, exit0, OOM없음, 중복1·새 수집0·실패0. runId `3f3b0227-6e99-4a19-9f08-bee857992c76`.
- DB readback: 게시글83→83, 수집물113→113, batch_run45→46. 이 검증은 새로운 본문·이미지 저장 성공을 의미하지 않는다.
- 실행 중 최소 호스트 가용 RAM1137.5MiB, 종료 후 API/Web healthy. 잠금 보유 상태의 중복 호출은 `COLLECTION_ALREADY_RUNNING`으로 외부 수집 없이 종료했다.
- 설치·활성화·소량 실행·최종 readback 원본은 `.local-data/production-collector-schedule/{install-result,activation,smoke-result,final-check}.txt`에 보관한다. 비밀값은 기록하지 않았다.
- 서버 설치 runner/timer/service SHA256이 저장소 파일과 각각 일치함을 확인했다.

## 검증 및 한계

- Python 운영 runner 회귀4건: 제외·자원 제한·예약 시간, 첫 출처 시작 실패 후 다음 출처 진행/기존 컨테이너 보존, 보고서 없는 exit0 실패 처리 통과.
- 기존 로컬 예약·재시도 Node 테스트10건 통과. systemd unit 검증, 다음 시각 계산과 live launchd 시각 확인 통과.
- 문서 상대 링크·Python 문법·`git diff --check` 확인. 테스트용 새 수집 전체 실행, 다음 예약 자동 실행, 재부팅 복구는 이번 검증에 포함하지 않았다.
- 서버 예약 활성화와 향후 모든 출처 수집 성공은 별도다. 로컬은 컴퓨터·로그인·Docker 상태에 영향을 받는다.
- 이번 예약 변경은 미커밋 상태다. 기존 다른 세션의 작업 파일은 보존했다.

## CPU/RAM 로그 부하 검토

- 운영의3개 컨테이너에 `docker stats --no-stream`1회 조회: 출력637bytes, CLI CPU32ms, 임시 최고RSS31540KiB(약31MiB), 경과2040ms. 경과 시간에는 샘플 대기가 포함되며 CPU 사용 시간과 다르다. Docker 데몬 추가 비용은 측정에 포함하지 않았다.
- 권장안은 배치 실행 중30초마다 한 줄 기록·14일 보관이다. 1회1KiB·하루2회 각2시간이라는 가정이면480KiB/일 수준이다. 실제 출력량과 부하는 구현 후 별도 측정한다.
- [Docker 공식 stats 문서](https://docs.docker.com/reference/cli/docker/container/stats/)의 단발 조회 기능을 기준으로 검토했다. 별도 모니터링 서버·실시간 대시보드는 도입하지 않았다.
