# 운영 정기 수집

운영은 systemd, 개발(로컬)은 macOS LaunchAgent로 매일 **04:30·15:30 Asia/Seoul**에 실행한다.
개발과 로컬은 같은 환경이다. 실제 설치 증거는 [작업 기록](../../worklog/2026-10-07/collection-schedule/README.md)을 따른다.

## 실행 범위

- 운영 설치 위치: `/opt/blariyo/collector`, 예약: `blariyo-collection.timer`.
- 임시 제외 6개를 제외한 15개 출처를 순차 실행한다. 출처별 최대 2페이지·20건·최근 24시간, 요청 간격 5초다.
- 컨테이너 CPU 0.5개·RAM 512MiB·추가 swap 없음·JVM heap 256MiB, 출처별 7분·전체 2시간으로 제한한다.
- 실패한 출처를 기록하고 다음 출처를 진행한다. 운영 예약 실행 전체를 즉시 재시도하지 않는다.
- DB 전용 role과 비공개 collect 저장소만 사용한다. 수집 후 자동 발행하지 않는다.
- 실행 잠금으로 중복 실행을 막는다. 운영 `Persistent=false`이므로 서버가 꺼져 놓친 예약은 복구 직후 몰아서 실행하지 않는다.
- 30초마다 호스트 가용 메모리와 공개 health 응답을 확인한다. 가용 메모리 256MiB 미만 또는 HTTP 오류 3회 연속이면 중단한다.
- 결과 JSON은 `logs/run-*.json`에 14일 보관하고 최신 결과는 `status.json`에 남긴다. 정리는 다음 실행 시 수행한다.
- 컨테이너 로그는 최대 5MiB × 2개이며 실행 컨테이너 제거 시 함께 제거된다. systemd journal 보존은 호스트 정책을 따른다.
- 운영 배치의 첫 컨테이너가 시작되면 Web·API·Batch 사용량을 즉시 1회, 이후 60초 간격으로 측정하고 배치 종료 시 중단한다. 출처 전환 시 주기를 초기화하지 않는다.
- 서버 디스크 `/opt/blariyo/collector/metrics/metrics-<executionId>.jsonl`에 CPU 사용률·RAM 사용량/한도(bytes)·UTC 측정 시각·출처를 누적한다. 배치 종료 후 기존 비공개 R2 버킷 `blariyo-media-private`의 `metrics/yyyy/mm/dd/production-<executionId>.jsonl`로 업로드한다. 날짜는 각 표본의 한국 날짜이며 자정을 넘으면 파일을 날짜별로 나눈다.
- PUT 후 GET으로 내려받아 SHA-256과 크기를 대조한 뒤 `.uploaded.json` 확인 기록을 남긴다. 같은 키가 이미 있으면 덮어쓰지 않고 동일 내용인지 검증한다. 실패한 파일은 다음 배치 종료 시 재시도하며 `status.json.metrics.archive`에 대기 상태를 남긴다.
- 로컬 파일은 root 전용0600이며 업로드 확인된 파일만7일 이후 다음 배치 시작 시 정리한다. 미업로드 파일은 만료 삭제하지 않는다. 원격 `metrics/` 객체 삭제 기능은 추가하지 않았다. 배치 중에는 로컬에 누적되고 원격 업로드는 종료 후 수행된다.
- Docker CLI의 RAM 값은 Linux 파일 캐시를 제외한 값이고 표시 정밀도로 환산한 bytes다. CPU 값은 단일 코어100% 기준이며 60초 평균이 아닌 해당 조회 시점의 표본이다. [Docker stats 기준](https://docs.docker.com/reference/cli/docker/container/stats/).
- 컨테이너 부재·측정 실패는 `UNAVAILABLE`로 남긴다. 파일 쓰기 오류는 수집을 중단하지 않고 `status.json`의 `metrics`에 기록한다. 주기는 `resource_metrics.py`의 `SAMPLE_INTERVAL_SECONDS=60`으로 조정한다.
- 전송은 설치된 API 이미지의 S3 SDK를 별도 컨테이너(CPU0.25·RAM128MiB)에서 재사용한다. 비공개 버킷 자격증명4개만 stdin으로 전달하며 DB·공개 버킷·백업 키는 전달하지 않는다. 전송 코드는 `metrics/` 아래의 정해진 파일명만 허용하고 재시도 처리에는 시간 상한을 둔다.

## 상태 확인

운영 서버에서 실행한다. `--check`는 수집 요청이나 DB 저장을 실행하지 않는다.

```sh
sudo systemctl status blariyo-collection.timer --no-pager
sudo systemctl list-timers blariyo-collection.timer --all
sudo python3 /opt/blariyo/collector/run.py --check
sudo cat /opt/blariyo/collector/status.json
sudo ls -lt /opt/blariyo/collector/metrics/
sudo journalctl -u blariyo-collection.service -n 50 --no-pager
```

통과 기준은 timer `active/enabled`, 다음 실행 시각 일치, 실행 결과의 출처별 상태·오류·미실행 목록 확인이다.
timer 활성화는 실제 예약 실행 성공 증거와 구분한다. systemctl이 UTC로 출력하면 한국 시간으로 변환해 확인한다.

## 설치·산출물 갱신

- 최초 설치 스크립트 `install-server.py`는 지정 운영 서버만 대상으로 하며 기존 설치가 있으면 중단한다. 반복 적용용 도구가 아니다.
- 비밀값은 stdin으로 전달하고 서버 `collector.env`는 root 전용으로 저장한다. 전달 본문과 환경변수를 로그에 출력하지 않는다.
- 설치는 timer를 활성화하지 않는다. JAR·source 설정 해시, 권한, unit 검사와 소량 실행 후 별도로 활성화한다.
- 현재 JAR은 main `b57724d`와 동일 소스의 검증된 CI #57 산출물이다. 원본 artifact와 JAR 해시를 `manifest.json`에 고정했다.
- Web/API 야간 배포가 Collector JAR을 자동 교체하지 않는다. 갱신 시 새 CI 산출물·main 소스 대응·DB migration 호환을 검증하고, 실행 중이 아닌 상태에서 manifest와 함께 교체한다.
- 개발(로컬) 예약 원본은 `scripts/local/render-batch-schedule.py`이며, 설치본은 `~/Library/LaunchAgents/com.blariyo.local-collection.plist`다. 컴퓨터 전원·로그인·Docker 상태에 영향을 받는다.

## 중단

사용자가 정기 수집 중단을 요청한 경우 아래 명령으로 다음 예약과 진행 중 실행을 중단한다. DB 수집 결과는 유지한다.

```sh
sudo systemctl disable --now blariyo-collection.timer
sudo systemctl stop blariyo-collection.service
```

개발(로컬)은 해당 사용자 세션에서 LaunchAgent를 해제한다.

```sh
launchctl bootout gui/$(id -u) "$HOME/Library/LaunchAgents/com.blariyo.local-collection.plist"
```
