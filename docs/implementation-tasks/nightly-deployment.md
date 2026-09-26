# WEB·API 03:00 KST 자동 배포 task

- 작성: 2026-09-26. **9개 task 모두 대기. 설계 작성과 구현·운영 활성화는 별개다.**
- 목표: 매일 03:00 Asia/Seoul에 검증된 main API/Web 후보를 서버가 배포하고, 같은 실행기로 필요 시 수동 배포한다.
- 정본: [야간 배포 설계](../system-design/10-nightly-deployment.md), [배포 정책](../operations/deployment-policy.md).
- 기존 인수: [OPS-01~05](operations-acceptance.md). 관련 증거는 재사용할 수 있으나 새 SHA·서버 상태를 재대조한다.
- 작업 방식: 구현자는 별도 worktree에서 담당 범위만 변경하고 기존 동시 작업을 덮어쓰지 않는다.

## 순서·우선순위·기한

| ID | 작업 | 우선순위 | 선행 | 완료해야 하는 시점 | 상태 |
| --- | --- | --- | --- | --- | --- |
| DPL-01 | 현재 운영 조사·입력과 자원 기준 확정 | P1 | 설계 정본 | 구현 계약 고정 전 | 대기 |
| DPL-02 | release manifest·CI 후보 게시 | P1 | DPL-01 | 서버 후보 조회 구현 전 | 대기 |
| DPL-03 | 서버 인증·배포 디렉터리·명령 권한 | P1 | DPL-01, DPL-02 형식 | 서버 실연결 전 | 대기 |
| DPL-04 | 새 백업·외부 격리 복원·검증 receipt | P1 | DPL-01 | 무인 배포 인수 전 필수 | 대기 |
| DPL-05 | 공통 실행기·journal·복귀·부팅 복구 | P1 | DPL-02~04 계약 | 통합 인수 전 | 대기 |
| DPL-06 | 03:00 timer·수동 실행·hold | P1 | DPL-05 | 예약 실행 인수 전 | 대기 |
| DPL-07 | 기본 동작 검사·기록·알림·캐시 대조 | P1 | DPL-01, DPL-05 상태 계약 | 운영 활성화 전 | 대기 |
| DPL-08 | 격리 통합·실패·재부팅 검증 | P1 | DPL-02~07 | 운영 설치·활성화 판단 전 | 대기 |
| DPL-09 | 운영 설치·수동 인수·03:00 활성화·7일 관찰 | P1/P2 | DPL-08, OPS-02/03 관련 증거 | 최초 정기 배포 및 실제 7일 뒤 종료 | 대기 |

정기 실행 시각은 **03:00 KST로 확정**했다. 착수일·최초 활성화 날짜·공수는 (미정)이다.
실제 token 권한, 외부 복원 검증 장비와 알림 수신 경로가 확인되기 전 달력 납기를 임의 확정하지 않는다.
DPL-02~04는 입력 계약 확정 뒤 병행 가능하다. DPL-05~07은 공통 인터페이스를 먼저 맞추고,
DPL-08·09는 선행 결과를 건너뛰지 않는다. 문서 작성만으로 task를 완료 처리하지 않는다.

## DPL-01 현재 운영 조사와 입력 확정

- **담당:** 운영 담당 + 개발자.
- **시작 입력:** 읽기 전용 서버 접근, 현행 운영 문서, 현재 main·CI 설정.
- **작업:** 현재 release·두 digest·ledger/checksum·flag·Compose·부팅 helper·업무/백업 timer·디스크/메모리·systemd 버전 확인.
- **결정:** GHCR manifest package 이름·소유자/ACL, main·workflow 변경 보호, PAT 발급 주체/만료/교체,
  복원 검증 장비의 새벽 가동·키 보관, private 검증 제어 bucket과 권한, 알림 담당/수신 경로,
  자원 임계치·배포 이력/이미지 보관 한도.
- **경계:** 상태 조회로 설치·재기동·백업 생성·DB 쓰기를 하지 않는다. private identity/token 값은 기록하지 않는다.
- **완료 증거:** 시각·현재값·정본 차이·위 결정 목록의 값 또는 명시적 미정/차단 사유.
  현재/후보의 누적 기능 변경과 법무·MFA·GTM 등 수동 인수 필요 항목을 구분한다.

## DPL-02 후보 계약과 CI 게시

- **담당:** CI 개발자.
- **변경 예정:** .github/workflows/ci.yml, 새 후보 schema·검증/게시 도구와 테스트.
- **작업:** verify·collector·API/Web images 뒤 release-candidate job 추가, 같은 SHA/run의 두 digest 수집,
  변경 분류·migration inventory·설정 계약·compatibleFrom의 이전 digest 쌍과 검증 근거 포함,
  불변 manifest 게시 후 main-candidate 포인터 갱신. 현재 운영 쌍과 근거가 다르면 서버에서 보류한다.
- **검증:** PR·fork·다른 ref 거부, 한쪽 이미지 실패/누락·SHA 불일치·이미지 미조회 거부,
  구 run 재실행·완료 순서 역전·취소 시 포인터 역행 방지, manifest checksum/형식 음성 시험.
- **완료 증거:** fixture 검사 + 실제 해당 SHA CI 성공·두 image와 manifest GHCR readback.
  CI 게시 성공을 운영 배포로 표시하지 않는다. CI는 운영 비밀을 받지 않는다.

## DPL-03 서버 인증과 배포 실행 경계

- **담당:** 운영 담당 + 배포 개발자.
- **변경 예정:** deploy/application 아래 초기 설치/plan 도구와 인접 README. 실제 파일명은 구현 때 확정.
- **작업:** GHCR 읽기 전용 token·package ACL, root 소유 release/state 디렉터리, 고정 wrapper·허용 인자,
  manifest namespace/workflow/schema 검증, secret 없는 상태 출력, 토큰 교체·회수 절차.
- **검증:** 운영 권한과 분리된 계정으로 package pull 성공·push/delete 거부, 만료·회수·잘못된 package 거부,
  임의 경로·shell 삽입·외부 image URL 거부, source build 없이 stage 가능.
- **완료 증거:** 비밀을 제외한 권한·소유권·인증 결과와 원상복구 절차. 서버 설치는 별도 승인된 범위에서 수행.

## DPL-04 새 백업과 외부 복원 검증

- **담당:** 백업 개발자 + 운영 담당.
- **변경 예정:** deploy/backup의 backup ID 지정·잠금·snapshot 기준값, 별도 검증 장비용 실행기·receipt 검사.
- **작업:** 이번 배포의 새 dump·R2 실다운로드 해시·동일 snapshot 기준 메타데이터를 연결한다.
  운영 서버 밖에서 age 복호화·PostgreSQL 18 격리 복원을 수행하고 서명된 결과를 전달한다.
  백업/R2 전송의 현재 API 컨테이너 의존을 검증된 고정 image로 제거한다.
- **보안:** backup 읽기와 검증 결과 저장 권한 분리, 별도 private 제어 bucket 검증.
  운영 서버/CI에 복호화 키 상시 저장 금지, receipt 서명 검증·run/backup/hash/만료 결합.
- **검증:** 03:30 백업과 경합, latest 포인터 변경, 운영 데이터 동시 쓰기, 검증 장비 절전/오프라인,
  손상 archive·실패 복원·위조/재사용/만료 receipt·자원 한도·평문 정리.
- **완료 증거:** 실제 R2→격리 복원→서버 receipt 검증까지의 기록과 새벽 무인 실행 증거.
  기존 CI의 schema-restore 성공 또는 파일 해시만으로 완료하지 않는다.
- **미정 입력:** 검증 장비·bucket 실제 이름·키 저장/잠금 해제 방식. 미확보 시 DPL-09 활성화 보류.

## DPL-05 공통 배포·복귀 실행기

- **담당:** 배포 개발자.
- **변경 예정:** deploy/application의 고정 실행기·상태/journal, deploy/operations/start-application.py의 정상 release 참조.
- **작업:** 후보 digest 고정, 서버 전역 잠금, 자동 적격/DB/설정/자원 검사, 명시적 pull·stage,
  새 백업·복원 gate, 업무 timer 정지/drain, API→Web 교체, 정상 포인터 원자적 갱신, timer 원상 복구.
- **복귀:** API/Web·설정·부팅 참조를 release 단위로 복구. 실패 후보 차단·AUTO_HOLD.
  journal로 프로세스 종료·전원 손실 뒤 복구하고 DB 역 migration/volume 삭제는 금지.
- **검증:** 같은 후보 반복 NO_CHANGE, 혼합 버전 호환, API 성공/Web 실패, 포인터 기록 실패,
  timer 재개 실패, 복귀 실패, SIGTERM/강제 종료·재부팅, 경로/인자 음성 시험.
- **완료 증거:** 격리 Compose의 이전/신규/복귀 digest·readiness·업무 timer·부팅 포인터 readback.

## DPL-06 예약·수동·보류 제어

- **담당:** 배포 개발자 + 운영 담당.
- **변경 예정:** deploy/operations의 blariyo-deploy.service·timer 및 설치/수동 제어 도구.
- **작업:** 매일 03:00 Asia/Seoul, Persistent=false, 03:00~03:05 진입·날짜별 1회 gate,
  공통 deploy/status/plan/hold/resume/rollback, timeout 뒤 안전한 종료·복구.
- **검증:** 실제 운영과 같은 Linux/systemd에서 시간식 계산, UTC 18:00 변환, 서버 timezone 변경,
  놓친 일정·낮 재부팅·시계 역행·당일 재시작, 자동/수동 동시 실행, rollback 후 다음 새벽 재배포 차단.
- **완료 증거:** systemd-analyze calendar와 unit 검사, 실제 다음 실행 시각·trigger·상태 기록.
  macOS의 문자열/문서 검사만으로 Linux timer 통과라 하지 않는다.

## DPL-07 배포 검사·기록·알림

- **담당:** 운영 담당 + API/Web 개발자.
- **변경 예정:** deploy/application/check-public.py 보완 또는 공통 smoke 모듈, 배포 결과/알림 adapter.
- **작업:** [설계 §8](../system-design/10-nightly-deployment.md#8-기본-동작-검사와-관찰)의 자동 검사,
  새 정적 자산/Cloudflare 규칙 차이 보류, 비밀 없는 journal·결과 요약, 실패·복귀·보류·성공 알림.
- **검증:** HTTP 200만 반환하는 잘못된 본문, DB readiness 실패, Access 경계·오류 no-store,
  asset 누락·캐시 불일치, 알림 실패 뒤 앱 유지/AUTO_HOLD, token·cookie·본문 비노출.
- **완료 증거:** 자동 검사 결과와 실제 지정 수신자에게 도착한 알림.
  실제 MFA·작성/업로드·Google/Discord 인수는 자동 성공에 합산하지 않고 OPS-02/03 등에 연결.

## DPL-08 격리 종합 검증

- **담당:** 개발자 검증 + 운영 담당 결과 검수.
- **환경:** disposable PostgreSQL/Compose, mock registry·알림 음성 시험, 비운영 GHCR/R2 실연결,
  운영과 같은 Linux/systemd 시험 환경. 운영 DB·객체를 파괴 시험에 사용하지 않는다.
- **완료 증거:** 아래 시나리오의 실행 시각·환경·SHA·기대/실제·명령 결과·state readback.
  미실행/실패/차단은 별도 표시하고 전부 통과 전 DPL-09로 넘어가지 않는다.

| ID | 시나리오 | 반드시 확인할 결과 |
| --- | --- | --- |
| V01 | 새 후보 없음·같은 후보 반복 | 앱 재시작·새 백업 없음 |
| V02 | main 성공 후보와 더 최신 실패/진행 중 커밋 | 완성된 성공 후보만 선택, 두 image 같은 SHA |
| V03 | 한쪽 image 실패·digest/manifest 변조 | 포인터 게시/배포 차단 |
| V04 | 구 CI 재실행·완료 순서 역전·force-push | 포인터/서버 상태 역행 거부 또는 AUTO_HOLD |
| V05 | token 만료·네트워크 단절·불허 namespace | 재시도 한도 뒤 앱 유지·실패 기록 |
| V06 | migration/checksum·설정 계약·민감 기능 변경 | 자동 MANUAL_REQUIRED·DB/flag 무변경; 수동도 해당 사유 해소 근거 없으면 거부 |
| V07 | 디스크·메모리 부족 | 이미지/백업 보호, 앱 교체 전 종료 |
| V08 | 03:00 KST·timezone 변경·03:05 이후 지연 | 정해진 시간대 1회, 시간 밖 자동 실행 생략 |
| V09 | 일정 누락·낮 재부팅·시계 역행 | 낮의 신규 자동 배포 없음, 미완료 복구는 수행 |
| V10 | 자동/수동/rollback/부팅 동시 실행 | 전역 잠금으로 중복 교체 없음 |
| V11 | 03:30 백업·수동 migration과 경합 | 교착·backup ID 혼선·교체 중 DB 변경 없음 |
| V12 | archive 손상·복원 실패·검증 장비 오프라인 | 앱 유지, 복원 대기/실패 알림 |
| V13 | 위조/만료/다른 backup receipt | 성공 증거 재사용 거부 |
| V14 | dump 후 운영 데이터 변경 | 동일 snapshot 기준 복원 비교, 오판 없음 |
| V15 | API 성공 뒤 Web 실패·공개 smoke 실패 | 두 image·설정·부팅 대상·timer 전체 복귀 |
| V16 | 포인터 쓰기 실패·timer 재개 실패 | 성공으로 기록하지 않음, 복구 상태 명시 |
| V17 | 교체 중 SIGTERM/강제 종료/VM 재부팅 | journal 복구·마지막 정상 release 일치 |
| V18 | rollback 실패·상태 불명확 | FAILED_RECOVERY_REQUIRED·AUTO_HOLD·알림 |
| V19 | 수동 rollback 뒤 다음날 timer | 문제 후보 재배포 없음, 명시적 resume 필요 |
| V20 | 알림 실패·새 asset cache 불일치 | 상태별 앱 유지/보류, 자동 인수 과장 없음 |
| V21 | 정상 자동·수동 배포 | 두 digest·readiness·공개 경로·부팅/timer·알림 readback |

## DPL-09 운영 활성화와 실제 관찰

- **담당:** 운영 담당 승인/인수 + 개발자 실행.
- **선행:** DPL-01~08 완료, OPS-02/03의 현재 서버·Access·백업·알림·복귀 관련 증거 연결.
- **순서:** 자동 OFF 설치 → plan 확인 → 승인된 수동 후보 배포/복귀·재부팅 → 정상 후보 확정 →
  명시적 timer 활성화 → 실제 03:00 실행 → 7일 관찰. 설치일과 최초 배포일은 구분한다.
- **체크리스트:**
  - [ ] 현재 release·서버 권한·새 백업/복원·이전 정상 release와 알림 수신 확인.
  - [ ] 설치/활성화 승인 범위와 작업자·시각 기록.
  - [ ] 수동 배포·복귀·재부팅 후 digest/부팅 경로/timer 일치.
  - [ ] 실제 03:00에 새 후보 배포 1회, 새 후보 없는 날 NO_CHANGE 확인.
  - [ ] 수동 실행·hold/resume·실패 후보 차단과 자동/수동 중복 방지 인수.
  - [ ] 실제 7일 성공/무변경/보류/실패·소요·디스크·메모리·알림·누락 일정 기록.
  - [ ] 운영 실행서·현재 상태·task에 증거 링크 반영, 미해결 항목의 담당·다음 조치 확정.
- **종료 기준:** 실행기 설치, 첫 배포, 7일 관찰을 각각 보고한다. 이미지 게시·문서 검사·가상 시간
  시험으로 실제 새벽 실행이나 관찰 기간을 대체하지 않는다. 해제는 hold+timer 중지이며 서비스 삭제가 아니다.

## 변경·인계 규칙

구현 전 정본과 현재 worktree를 재확인한다. 이번 문서 worktree의 기준 SHA는 8af7244이며,
다른 에이전트의 이후 CI·migration·부팅 helper 변경을 자동으로 승계하지 않는다.
구현/설치/활성화/commit/push는 각 요청 범위에서 수행한다. 완료 결과는 task별 증거와
[현재 상태](../status.md)·[로드맵](../roadmap.md)에 반영하고 과거 worklog는 덮어쓰지 않는다.
