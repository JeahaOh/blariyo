# 운영 배치 실행 중 Web·API·Batch 사용량 기록

- 담당: Codex / 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/collection-schedule-0430-1530` / 상태: 종료 / 갱신: 2026-10-07 20:52 KST
- 요청: 운영 Web·API·Batch CPU·RAM을 배치 실행 중 1분 간격으로 스토리지에 저장.
- 변경 경로: `deploy/collector/`, `docs/system-design/07-spring-collector-design.md`, 이 작업 기록. 앞선 예약 작업의 담당을 이어받고 다른 세션 변경은 보존한다.
- 구현 기준: 배치 실행 잠금 내부에서 시작하고 종료 시 중단하는 경량 측정기, 실행별 JSONL, 조회·저장 실패와 미측정은 실제 0 사용량과 구분. 저장 위치 질문에 답변이 없어 사전 안내한 운영 서버 디스크를 기준으로 적용했다.
- 보존: 기존 일반 진단 로그의 최소 보관 정책에 맞춰 7일. 수집 결과 JSON의 14일 보존과 별도다.
- 검증 범위: 주기·종료·누락·장애·보존 회귀, 기존 실행기 회귀, 운영 설치 파일 해시·실제 측정 파일 readback. 예약 시간·수집 출처 설정은 유지하고 실측을 위한 제한 수집의 DB 반영은 아래에 구분했다.
- 이전 기록: [정기 예약 설치](../collection-schedule/README.md).

## 적용

- `resource_metrics.py`의 `SAMPLE_INTERVAL_SECONDS=60`. 첫 컨테이너 시작 직후1회·이후60초 간격이며 출처가 바뀌어도 주기를 초기화하지 않는다. 수집 종료 시 측정 thread를 종료한다.
- 운영 경로: `/opt/blariyo/collector/metrics/metrics-<executionId>.jsonl`, root 전용 디렉터리0700·파일0600. Web/API/Batch CPU%·RAM사용량/한도bytes·UTC시각·출처·실행ID만 기록한다.
- 종료 결과 `status.json.metrics`에 파일·주기·기록 수·측정/쓰기 오류 수를 남긴다. 실패와 없는 컨테이너를0으로 만들지 않는다. 측정 오류는 배치 수집 실패와 분리한다.
- 보존 목표7일이며 다음 배치 시작에 만료된 소유 파일만 정리한다. 배치가 중단된 동안에는 정리되지 않는다. 기존 수집 결과 로그14일은 변경하지 않았다.
- 운영 잠금 확보·기존 runner 해시 확인·컨테이너 미실행 확인 후 파일을 교체하고 `--check`를 실행했다. JAR·DB schema·Web/API 이미지 변경 없음. 이전 runner는 `/opt/blariyo/collector/backups/20261007T114946Z`에 보존했다.

## 검증 결과

- Python 회귀11건 통과: 기존 실행4건과 측정7건. 분 간격 유지, 출처 전환, 즉시 종료, 실패/누락, 수치 변환, 비밀 필드 미저장, 만료 파일 범위·권한, 저장 실패를 확인했다.
- 20:50:11–20:51:23 KST 운영 goodgag1페이지·10건 제한 실행 정상 종료. 신규5·중복5·실패0, OOM없음. 게시글83→83, 수집물113→118, batch_run46→47. 공개 발행은 하지 않았다.
- 실행ID `20261007T115011Z-33bfb89d`, DB runId `d432bd4a-84eb-42c6-8384-e3ac6c9e56e8`.
- 실제 파일에서3개 컨테이너 모두 측정 성공:2줄·1012bytes, 두 시각 차이60.000초, sampleErrors0·writeErrors0·state RECORDED. 수집 종료 후 컨테이너 제거와 기록2건 유지 확인.
- Web/API healthy, timer active/enabled, 다음 예약2026-10-08 04:30 KST 유지.
- 설치 파일 해시가 로컬과 일치: runner `7102d0defb4063df91b4daa3e105700481405b78916b86a7ca2229d6e713d6dc`, metrics `530871170f0b474271ea9de17d99a15563258e07c75ad659f09fe9fa290366d9`.
- Python 문법·문서 상대 링크·`git diff --check` 통과. 설치/실행 원본은 `.local-data/batch-resource-metrics/`에, 공유 가능한 실측은 [evidence.json](evidence.json)에 보관했다.
- 이번 작업은 미커밋이며 다른 세션의 변경은 보존했다. 운영 실측은 수동 제한 실행이고 다음 정기 예약 자동 실행은 미래 관측 사항이다.

## 값 해석

- CPU는 단일 코어100% 기준 조회 표본이다. 60초 전체 평균·최대값을 뜻하지 않는다.
- RAM은 Linux Docker CLI의 파일 캐시 차감 값이며 CLI 표시 정밀도에서bytes로 환산한다. [Docker 공식 문서](https://docs.docker.com/reference/cli/docker/container/stats/)를 기준으로 구현했다.
