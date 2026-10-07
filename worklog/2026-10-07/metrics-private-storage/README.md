# 운영 측정 로그 비공개 스토리지 저장

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/collection-schedule-0430-1530` / 상태: 종료 / 갱신: 2026-10-07 21:03 KST
- 요청: 기존 비공개 스토리지의 `metrics/yyyy/mm/dd/` 경로로 운영 Web·API·Batch 측정 로그 저장.
- 담당 경로: `deploy/collector/`, `docs/system-design/07-spring-collector-design.md`, 이 기록. 이전 측정 작업을 이어받고 다른 세션 변경 보존.
- 날짜는 측정 시각의 한국 날짜, 파일은 운영 실행ID로 구분. 기존 파일도 업로드한다. 업로드 확인 전 로컬 파일을 만료 삭제하지 않으며 재시도·원격 readback을 검증한다.
- 검증 계획: 날짜 경계·재시도·중복 업로드·실패 보존·로컬 회귀, 운영 설치 해시와 실제 R2 파일 다운로드 해시 일치 확인.
- 선행 기록: [측정 로그 적용](../batch-resource-metrics/README.md).

## 반영 결과

- 기존 비공개 R2 버킷 `blariyo-media-private`를 사용한다. 저장 키는 `metrics/yyyy/mm/dd/production-<executionId>.jsonl`이며 날짜는 각 표본의 Asia/Seoul 날짜다. 자정을 넘는 실행은 날짜별 객체로 나뉜다.
- 배치 중 60초 간격 로컬 기록은 유지하고 배치 종료 후 업로드한다. 기존 설치 API 이미지의 S3 SDK를 별도 CPU0.25·RAM128MiB 제한 컨테이너에서 사용하고 필요한 비공개 버킷 자격증명만 stdin으로 전달한다.
- 객체 생성 후 GET으로 전체 bytes·SHA-256을 검증하고 로컬 `.uploaded.json`에 확인 기록을 저장한다. 같은 키가 이미 존재하면 내용이 일치할 때만 성공 처리하며 덮어쓰지 않는다.
- 업로드 실패는 `status.json.metrics.archive.state=PENDING`으로 남기고 로컬 파일을 유지한다. 다음 배치 종료 시 재시도하며 한 번의 재시도 작업에 시간 상한을 둔다. 검증된 로컬 사본만7일 이후 정리한다.
- 원격 metrics 객체 자동삭제 기능이나 bucket lifecycle 변경은 추가하지 않았다. 기존 일반 진단 로그 정리와 수집 원문 정리 경로는 변경하지 않았다.
- [운영 안내](../../../deploy/collector/README.md)·[설계](../../../docs/system-design/07-spring-collector-design.md)에 동기화했다.

## 운영 검증

| 객체 키 | 크기 | 확인 |
| --- | --- | --- |
| `metrics/2026/10/07/production-20261007T115011Z-33bfb89d.jsonl` | 1012bytes | 기존 로컬2개 표본 업로드·GET 해시 일치 |
| `metrics/2026/10/07/production-20261007T120315Z-c82121ce.jsonl` | 507bytes | 새 배치 종료 자동 업로드·GET 해시 일치 |

- 신규 제한 실행21:03:15–21:03:33 KST: goodgag1건 중복, 신규0·실패0, exit0·OOM없음. 게시글83·수집물118 유지.
- 두 번째 실행의 metrics는 RECORDED, archive는 VERIFIED, 실패·미전송0. 같은 spool 재시도 시 검증 완료 파일을 건너뛰었다.
- Web/API healthy, timer active/enabled, 다음 정기 예약2026-10-08 04:30 KST 유지.
- 설치 전 배치 미실행·실행 잠금·기존 파일 해시 확인. 백업 `/opt/blariyo/collector/backups/20261007T120229Z`. 서버4개 파일 해시가 로컬 최종 소스와 일치한다.
- 증거: [evidence.json](evidence.json). 원본은 `.local-data/metrics-private-storage/{install,smoke}.txt`에 보관한다. 비밀값은 기록하지 않았다.

## 로컬 검증과 경계

- Python15건·Node3건, 총18건 통과: KST 자정 분할, 실패 후 보존·재시도, 잘못된 성공 응답 거부, 부분 파일/잘못된 실행ID/심볼릭 링크 거부, 같은 키의 동일 내용 허용·다른 내용 거부, metrics 외 경로 거부 및 기존 측정·실행 회귀.
- Python 문법·문서 상대 링크·`git diff --check` 통과.
- S3 SDK 사용 방식은 [Cloudflare 공식 문서](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)를 확인하고 기존 저장소의 업로드·GET 해시 검증 방식을 재사용했다.
- 현재 변경은 미커밋이다. 다른 세션 변경·과거 작업 기록은 보존했다. 다음 정기 예약 자체의 자동 실행은 아직 미래 관측 사항이다.
