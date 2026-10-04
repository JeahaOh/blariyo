# CI 개선 실측·배포 교체 시간 확인과 release 인계

- 담당: Codex 운영 결과·release 통합 세션
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 작업 브랜치: `feature/production-deploy-3e3e1d0`
- 기준: feature `f4af675`, local/remote release 모두 `43d82fe`, 작업 폴더 clean.
- 상태: 종료 — 시간 분석·통합 후보 검증 완료, 아래 후보를 FF-only로 release에 전달
- 갱신: 2026-10-04 KST
- 요청: CI 개선 효과, 배포 유휴시간 확인, 배포 기록 release 반영.
- 변경 경로: 이 기록만. 기존 운영 배포 기록 `f4af675`는 그대로 포함한다.
- 범위: 완료 Actions 근거 대조, 운영 서비스/Docker events 읽기 전용 조회, 문서 commit·로컬 release FF-only 병합. source·운영 변경·재배포·원격 push 제외.

## CI 개선 효과

| 구간 | 직전 | 개선 후 | 절감 | 단축률 |
| --- | --- | --- | --- | --- |
| PR 검증 | 9분29초 | 5분40초 | 3분49초 | 40.2% |
| main 검증·이미지 게시 | 11분12초 | 3분27초 | 7분45초 | 69.2% |
| 두 실행 시간 합계 | 20분41초 | 9분7초 | 11분34초 | 55.9% |

- 직전: [PR #53](https://github.com/JeahaOh/blariyo/actions/runs/37181975219), [main #54](https://github.com/JeahaOh/blariyo/actions/runs/37184260894).
- 개선 후: [PR #55](https://github.com/JeahaOh/blariyo/actions/runs/37185946231), [main #56](https://github.com/JeahaOh/blariyo/actions/runs/37186590723).
- 이 대화의 GitHub 화면 직접 확인과 당시 배포 기록의 완료 실행 시간에 근거한다.
- PR은 quality·integration·browser·collector 병렬화, main은 동일 tree의 성공한 전체 PR 검사 재사용으로 중복 검사를 줄였다. main의 무거운 검사 skipped를 재실행 성공으로 표현하지 않는다.
- 단일 전후 실행 비교다. 캐시·runner·예약 테스트 대기 등 변동 요인이 있어 평균/항상 보장되는 성능 수치가 아니다.
- 합계는 workflow 경과시간의 합이며 사람이 PR을 병합하거나 배포를 시작하기까지 기다린 시간, 서버 배포·검사 시간, runner 사용량/비용을 포함하지 않는다.

## 배포 중 서비스 중단 가능 구간

- 현재 source는 동일 Compose service를 API→Web 순서로 교체한다. 새 image pull·백업 중 기존 앱은 동작하며 DB·Nginx는 교체하지 않는다. 블루그린·무중단 방식이 아니다.
- 이번 systemd 배포 실행: 16:52:50~16:53:09 KST, 초 단위 기록 기준 약 19초. image를 사전에 pull한 이번 실행의 수치이며 일반적인 배포 소요 보장은 아니다.
- Docker `events`의 `kill`(중지 신호)과 `health_status: healthy`를 대조했다.

| 대상 | 중지 신호 KST | 새 컨테이너 healthy KST | 관측 구간 |
| --- | --- | --- | --- |
| API | 16:52:56.753 | 16:53:02.642 | 5.889초 |
| Web | 16:53:03.123 | 16:53:08.850 | 5.726초 |
| 첫 API 중지~마지막 Web healthy | 16:52:56.753 | 16:53:08.850 | 12.097초 |

- 이 값은 중지 신호부터 healthcheck 성공까지의 교체 관측 구간이다. healthcheck 간격·앱 준비·진행 중 요청에 따라 실제 HTTP 실패 구간과 다를 수 있다.
- 연속 외부 HTTP probe를 배포 동안 실행하지 않았으므로 실제 사용자 오류 시간·오류율은 미계측이다. 12.1초 내내 모든 요청이 실패했다고 단정하지 않는다.
- API 교체 중 동적 조회/쓰기, Web 교체 중 페이지·BFF 요청이 영향을 받을 수 있다. 이미 브라우저/CDN에 캐시된 정적 파일은 별도다.
- 이번 변경은 CI 개선이며 기존 배포 교체 방식이나 무중단 보장을 변경하지 않았다.
- 후속 측정 시 배포 전후 0.5~1초 간격의 비변경 공개 요청에서 시각·상태코드·응답시간을 기록하면 실제 오류 구간을 구분할 수 있다. 이번에는 이를 측정하기 위한 재배포를 하지 않았다.

## release 반영 범위·검증

- 포함: 기존 `f4af675` 운영 배포·태그 게시 기록, 이번 시간 분석·인계 기록.
- 원격 release 조회 당시 `43d82fe8614aa07243e69c604aac3806a2242802`로 local과 일치.
- 기존 작업 담당 상태 종료, 범위 밖 변경 없음. release가 feature의 조상인 FF 경로로 통합한다.
- Node 24.18.0의 `hooks:check`와 설치된 `check-contracts.mjs` 검사 통과. 최종 기록 commit 후 clean 후보에서 다시 검사하고 정확한 feature SHA로 `git merge --ff-only` 실행.
- 문서만 변경되어 앱 build·DB·브라우저 테스트는 재실행하지 않는다. `git diff --check`·대상 경로·링크를 확인한다.
- 원격 release push는 요청되지 않아 실행하지 않는다. 앞서 승인된 배포 태그 push와 브랜치 push를 구분한다.
