# 03:00 KST WEB·API 배포 설계·계획 작업

## 요청과 범위

- 사용자 요청: 한국 시간 매일 새벽 3시 WEB·API 자동 배포 설계·계획·문서 갱신·task 목록.
  필요 시 수동 배포를 유지하고 다른 에이전트와 분리된 worktree에서 작업.
- 원본 저장소: /Volumes/MicroVault/iCloudDrive/git/private/blariyo, develop.
- 문서 worktree: /private/tmp/blariyo-nightly-deploy-20260926.
- 작업 branch: docs/nightly-deploy-0300-kst.
- 기준 HEAD: 8af72449a7d56c9701efd0d73dc7d430a66f9610.
- 착수 당시 HEAD·origin/main·origin/develop의 로컬 참조가 같았다. 이 작업에서 원격 fetch·CI·운영 서버를
  다시 조회하지 않았다. 다른 worktree의 미커밋·미병합 변경을 이번 기준선에 포함하지 않았다.
- 실행 source·workflow·unit·token·서버 설정은 변경하지 않는다. commit·push·merge·배포는 요청 범위가 아니다.

## 반영한 결정

- [인프라 계획](../../../docs/planning/02-infra-plan.md)의 목표를 매일 03:00 Asia/Seoul 자동 배포와
  공통 수동 실행으로 갱신하고 [기술 설계](../../../docs/system-design/10-nightly-deployment.md)를 추가했다.
- CI 성공 API/Web 한 쌍의 불변 manifest, 서버 pull·명시적 digest, app-only 자동 허용,
  migration/설정/민감 기능 변경 보류, 전역 잠금·journal·부팅 참조·실패 복귀를 정의했다.
- Persistent=false와 시간/일자 gate로 낮 재부팅의 신규 자동 배포를 막고 수동 rollback 뒤 AUTO_HOLD를 유지한다.
- 현재 복호화 키가 서버 밖에 있는 점과 배포 전 새 백업의 실제 복원 조건을 직접 확인했다.
  외부 검증 장비·서명 receipt를 선행 task로 두고 기존 복원 조건을 해시 검사로 축소하지 않았다.
- [DPL-01~09](../../../docs/implementation-tasks/nightly-deployment.md)를 추가했다.
  담당·선행·범위·완료 시점·산출물·검증을 포함하며 기존 17개와 합쳐 26개다.
- 시간/후보/권한/백업/복귀/수동/실패/재부팅을 다루는 후속 구현 검증 시나리오 V01~V21을 작성했다.
  이 21개는 앞으로 실행할 검증 목록이며 이번에 통과한 테스트 수가 아니다.
- 정책·실행서·인프라/보안 설계·색인·status·roadmap을 동기화했다.

## 검증 기록

- 변경 범위: Markdown 15개 = 기존 문서 12개 수정 + 설계/task/본 기록 3개 추가.
- git diff --check 통과. 새 파일을 포함한 trailing whitespace·Markdown fence 검사 통과.
- 변경 15개 문서의 상대 링크/앵커 273개 검사: 끊긴 경로·앵커 0개.
- 기존 [입력 필요]·[출시 차단: ...]·(미정) placeholder 삭제 0개. 법무 문서는 변경하지 않았다.
- DPL-01~09 중복/누락 없음, V01~V21 후속 검증 목록 중복/누락 없음. 기존 17+신규 9=26개.
- Python zoneinfo 시각 대조: 2026-09-27 03:00 Asia/Seoul = 2026-09-26 18:00 UTC.
  Linux/systemd 시간식 실행이나 실제 예약 기동을 검증한 것은 아니다.
- 정합성 직접 검토: planning→system-design→policy/runbook→roadmap/status→task의 03:00·대상·수동/
  자동·DB 변경 보류·복원키·복귀 계약을 대조했다. 수동 필요 후보의 사전 인수 조건, 즉시 실패 복귀의
  사전 백업 재사용, 현재 API 장애와 백업 도구 의존 분리를 보완했다.
- .github/workflows·apps·deploy 실행 파일 변경 0개. build·애플리케이션 테스트·서버 API 호출·
  Linux timer 설치·실제 배포·운영 rollback/재부팅은 실행하지 않았다.
- 원본 develop의 종료 git status는 착수 때의 미추적 경로 목록과 동일했다.
  다른 worktree가 병행 진행 중임을 확인했으며 해당 branch/파일을 변경하지 않았다.
- 별도 worktree에 미커밋 문서로 남겼다. commit·push·merge는 수행하지 않았다.

검사 도구는 임시 Python 상대 링크/앵커·placeholder·목록/시간 검사와 Git diff/status다.
문서 검사 통과는 배포 실행기·권한·실연동·운영 활성화의 성공을 뜻하지 않는다.

## 다음 시작점

DPL-01의 읽기 전용 운영 조사와 선행 입력 확정 후 DPL-02~04 계약을 먼저 구현한다.
실제 GHCR 권한, 무인 복원 검증 장비/키 보관, private 검증 제어 bucket, 알림 수신 경로,
자원 기준·최초 활성화 날짜는 (미정)이다. 비밀값을 문서에 추가하지 않는다.
기존 OPS-01~03·법무/수집 gate는 이 설계로 완료 처리하지 않는다.
