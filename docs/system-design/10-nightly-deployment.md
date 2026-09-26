# WEB·API 매일 03:00 KST 자동 배포 설계

- 결정일: 2026-09-26. 사용자 요청: 한국 시간 매일 새벽 3시 WEB·API 자동 배포, 필요 시 수동 배포.
- 상태: **설계·계획 작성. 실행기·timer·후보 게시·운영 인증은 미구현·미검증이며 자동 배포는 비활성이다.**
- 상위 결정: [인프라 계획](../planning/02-infra-plan.md#8-운영보안-의사결정).
- 적용 정책·수동 실행: [배포 정책](../operations/deployment-policy.md), [배포 실행서](../operations/deployment-runbook.md).
- 구현 순서·완료 증거: [DPL-01~09 task](../implementation-tasks/nightly-deployment.md).

## 1. 범위와 선택

| 항목 | 결정 |
| --- | --- |
| 주기 | 운영 VM의 systemd timer가 매일 03:00 Asia/Seoul에 배포 검사를 시작 |
| 대상 | main에서 검증된 linux/amd64 API·Web 이미지 한 쌍 |
| 수동 실행 | 같은 서버 실행기에 검증된 release 식별자를 지정해 즉시 실행 |
| 빌드 | GitHub Actions에서만 수행. 운영 서버의 git pull·npm install·source build 없음 |
| 교체 | 기존 단일 VM·Compose project blariyo-app에서 API → Web 순차 교체 |
| 자동화 제외 | DB migration·데이터 이전·정책 발행·Collector 설치·기능 flag 변경·Gateway/Tunnel/DNS 변경 |
| 가용성 | 짧은 요청 실패 가능. 무중단·블루그린·서버 증설을 전제하지 않음 |
| 배포 권한 | main 반영은 정기 배포 후보 등록 의사. 최초 자동화 활성화는 DPL-09 운영 인수 뒤 별도 수행 |

03:00은 검사 시작 시각이며 교체 완료 시각이 아니다. 이미지 다운로드·백업·복원 검증 시간이 추가된다.
운영 서버는 Git 저장소를 직접 조회하지 않고, CI가 게시한 **main의 최신 성공 후보**를 읽는다.
더 최신 main 커밋의 CI가 실패·진행 중이면 그 커밋은 후보가 아니며, 이미 게시된 최신 성공 후보는
배포될 수 있다. 모든 main 커밋을 차례로 배포하지 않는다.

| 대안 | 장점 | 부담 | 선택 |
| --- | --- | --- | --- |
| 서버 git pull 후 build | 초기 명령이 짧음 | 운영 2GB에서 빌드 부하·의존성 설치·CI 산출물 불일치 | 제외 |
| Actions에서 SSH 배포 | GitHub 화면에서 직접 실행 | 운영 접속 키·네트워크 접근 관리 | 기본 경로에서 제외 |
| 운영 VM에 범용 Actions runner | 서버 내부 실행 | PR/워크플로 코드와 운영 권한 분리 부담 | 제외 |
| 서버가 CI 후보를 가져와 교체 | 외부 SSH 개방 없이 운영 비밀을 서버에 유지 | 후보 게시·배포 상태·복구 실행기 필요 | 채택 |

## 2. 현재 코드와 차이

- [ci.yml](../../.github/workflows/ci.yml)은 verify·collector 성공 후 API/Web 이미지를 게시하고 digest를
  job summary에 남긴다. 두 이미지를 묶은 release manifest나 운영 교체 job은 없다.
- [운영 Compose](../../deploy/application/compose.yaml)는 pull_policy: never다. 실행기가 먼저 digest로
  pull하고 검증한 뒤 up을 실행해야 한다. Compose up만으로 새 이미지를 받는다고 가정하지 않는다.
- [부팅 helper](../../deploy/operations/start-application.py)는 release 경로가 고정돼 있다.
  새 release로 부팅 대상을 안전하게 전환하는 기능이 필요하다.
- [백업 실행서](../../deploy/backup/README.md)의 정기 백업은 03:30·15:30 KST다.
  복호화 키는 운영 서버에 상시 보관하지 않으며, 현재 복원 도구는 Mac에서 키를 전달받는 일회성 도구다.
- 운영 release·DB·token·systemd 버전·알림 수신 상태는 이번에 재조회하지 않았다.
  9월 23일의 API V008·Collector V006·앱 SHA를 앞으로의 배포 기준값으로 고정하지 않는다.

## 3. 후보 생성과 게시

### 후보 게시 순서

1. 기존 verify·collector·API/Web images를 모두 성공시킨다.
2. 각 image job의 전체 Git SHA·run ID·run attempt·registry digest를 별도 artifact로 전달한다.
   matrix job의 마지막 output 하나로 두 digest를 대체하지 않는다.
3. 후속 release-candidate job이 같은 SHA·run attempt의 API/Web 결과와 변경 계약을 검증한다.
   PR·fork·main 이외 ref는 후보 게시를 금지한다.
4. manifest를 GHCR의 별도 비공개 OCI artifact package에 게시하고 내용 digest로 고정한다.
   두 image를 registry에서 다시 읽을 수 있는지 확인한 뒤에만 후보 포인터를 갱신한다.
5. 이동 가능한 포인터 main-candidate는 완성된 manifest 하나만 가리킨다. 서버는 최초 조회 때
   포인터를 digest로 해석하고 이후 실행·복귀까지 그 digest를 사용한다.

대상 package의 실제 이름은 DPL-01에서 기존 namespace·접근 권한과 대조해 확정한다.
main-candidate는 실행할 image의 latest tag가 아니다. 실행 image는 항상 image@sha256 참조다.
OCI 게시 도구와 액션은 구현 때 공식 릴리스·checksum 또는 전체 commit SHA로 고정한다.
선택한 media type의 실제 GHCR push/pull·digest·권한은 DPL-02/03에서 실검증한다.

### 최소 manifest 계약

| 필드 | 검증 |
| --- | --- |
| schemaVersion | 실행기가 지원하는 버전만 허용. 알 수 없는 형식은 보류 |
| releaseId, gitSha, sourceRef | 전체 SHA와 refs/heads/main. releaseId는 SHA·run attempt를 구분 |
| repository, workflow, runId, runAttempt | 허용 저장소·후보 게시 workflow와 성공한 CI 실행 식별자 |
| publishedAt, sourceOrder | 생성 시각과 순서. 시각만으로 신규/구버전을 판단하지 않음 |
| images.api, images.web | 고정 GHCR namespace의 linux/amd64 digest 참조, 같은 SHA·run의 결과 |
| migrationInventory | API와 영향받는 Collector migration의 버전·checksum 목록과 목록 digest |
| runtimeContractVersion, deploymentTemplateDigest | 비밀 없는 설정 계약과 서버에 설치된 Compose/실행기 계약의 식별자 |
| compatibleFrom | 검증한 이전 API/Web digest 쌍과 혼합 버전·복귀 검사 근거. 실제 현재 쌍이 없으면 자동 보류 |
| changeClass, reviewEvidence | app_only 또는 manual_required, 변경 분류·호환성·민감 기능 검토 근거 |

manifest에 shell 명령·임의 URL·secret·env 원문·복호화 키·개인정보를 넣지 않는다.
서버 실행기는 명령을 내려받아 실행하지 않고 미리 설치된 고정 절차만 수행한다.
package 쓰기 권한과 main/workflow 변경 권한은 배포 신뢰 경계다. digest만으로 게시자 신뢰가
증명되는 것은 아니다. 허용 저장소·workflow·package ACL과 변경 검토를 DPL-01/02에서 확인한다.

### 순서와 경합

- 후보 포인터 갱신 job은 전용 concurrency group으로 직렬화하고 cancel-in-progress: false를 사용한다.
  기존 CI의 취소 설정이 이미 진행 중인 운영 교체를 취소해서는 안 된다.
- concurrency의 실행 순서를 최신성 증거로 사용하지 않는다. 게시 직전 현재 main HEAD와 후보 SHA를
  다시 대조하고, 이미 게시된 후보보다 과거 커밋·과거 run attempt면 포인터를 갱신하지 않는다.
  같은 SHA 재실행은 더 높은 attempt의 완성본만 허용한다.
- 서버는 마지막 정상 release·지금 실행 중 release·최대 수용 순서를 영속 보관한다.
  후보가 역행하거나 force-push로 계보 확인이 안 되면 AUTO_HOLD다. 명시적 rollback만 구버전을 허용한다.
- 후보가 검사 중 바뀌어도 이번 실행은 처음 고정한 한 후보로 끝난다. 다음 날 또는 수동 실행에서
  다음 후보를 읽는다. 포인터가 가리키는 최신 후보가 manual_required면 더 오래된 후보를 찾아 대신 배포하지 않는다.

## 4. 자동 배포 허용 조건

자동 경로는 다음 조건을 모두 만족할 때만 앱을 바꾼다. CI의 자기신고 필드 하나만으로 통과시키지 않는다.

| 검사 | 허용 기준·실패 처리 |
| --- | --- |
| 후보 완전성 | 같은 SHA의 두 image와 manifest·필수 검사 결과 존재. 누락/인증/해시 오류는 기존 앱 유지 |
| 변경 분류 | app_only. DB·설정 계약·Compose·권한·정책·분석/광고·인증 경계 변경 또는 불명확한 변경은 manual_required |
| DB 호환성 | 현재 서버 ledger/checksum과 후보 migrationInventory 일치. additive migration도 자동 적용하지 않음 |
| runtime | 현재 secret·feature flag를 보존하고 계약 버전 일치. 신규 필수값·설정 교체는 수동 준비 |
| 혼합 버전 | 교체 중 기존 Web→신규 API와 복귀 조합의 호환 근거가 현재/후보 digest에 연결됨 |
| 자원 | 새 이미지·이전 이미지·백업을 보존할 디스크, 정상 서비스와 백업에 필요한 메모리 확인. 기준은 DPL-01에서 계측 후 설정 |
| 사전 백업 | 이번 시도의 새 암호화 백업·R2 실다운로드 해시·동일 archive의 격리 복원 성공. 18시간 이내 기준도 충족 |
| 운영 gate | 수신 확인된 알림 경로, 정상 부팅 대상, 자동 보류 없음, 실패 후보 차단 목록에 없음 |

변경 분류는 검토된 release 의도와 경로·계약 diff를 결합한다. 코드 의미·개인정보 영향 전체를
파일명 검사로 판정할 수 있다고 주장하지 않는다. 분류 규칙의 기본값은 manual_required이며,
인증·관리자 쓰기·GTM/GA4·법무 조건을 바꾸는 버전은 별도 인수 뒤에만 배포한다.
최초 활성화 때 현재 main 전체를 자동 적격으로 간주하지 않고 운영 버전과의 누적 차이를 검토한다.

## 5. 03:00 스케줄과 수동 실행 계약

아래는 **구현할 timer의 설계값**이다. unit 파일은 이번 문서 작업에서 생성·설치하지 않는다.

```ini
[Timer]
OnCalendar=*-*-* 03:00:00 Asia/Seoul
Persistent=false
AccuracySec=1s
RandomizedDelaySec=0
Unit=blariyo-deploy.service
```

- UTC로는 전날 18:00이며 서버 기본 timezone에 의존하지 않는다.
- Persistent=false로 서버가 꺼져 놓친 실행을 낮 재부팅 직후 따라 실행하지 않는다.
- 자동 실행기는 KST 03:00~03:05 진입 구간과 날짜별 시도 기록을 함께 검사한다.
  clock 변경·지연·동일 날짜 재시작으로 자동 시도를 두 번 시작하지 않는다. 시간 동기화 실패는 보류한다.
- 실행을 시작한 후 새 후보 준비를 기다리며 하루 종일 재시도하지 않는다. 원격 읽기는 요청당 30초,
  최대 2회 재시도로 제한하고, 변경 전 준비는 20분 이내에 끝내지 못하면 다음 날로 보류한다.
  이 값은 초기 설계값이며 DPL-08 계측 후 변경 근거를 남긴다.
- API/Web 각 기동 대기는 기존 180초를 기준으로 한다. 교체가 시작된 뒤 시간 초과·취소가 오면
  정상 종료로 위장하지 않고 복귀 경로로 들어간다. systemd 강제 종료로 복귀까지 끊는 설정을 금지한다.
- timer만 끄면 현재 실행은 멈추지 않는다. hold/cancel은 다음 후보 차단과 현재 작업의 안전한
  경계에서 중단하는 기능을 구분한다. 부팅 시 미완료 journal이 있으면 새 배포보다 복구를 우선한다.

수동 인터페이스의 설계 계약은 다음과 같다. 실제 명령 이름·옵션 구현은 DPL-05/06의 산출물이다.

| 동작 | 의미 |
| --- | --- |
| status / plan | 현재·후보·보류 사유 조회. plan은 pull·백업·서비스 변경 없이 판단 결과만 출력 |
| deploy(releaseId) | 지정된 검증 후보를 즉시 배포. 시간 gate 제외; manual_required는 해당 사유의 사전 인수·준비 근거를 확인해야 허용 |
| hold(reason) / resume | 자동 배포를 지속 보류 / 상태·차단 후보 확인 뒤 명시적으로 재개 |
| rollback(releaseId) | 현재 DB와 호환성이 검증된 release로 공통 실행. 완료 후 자동 보류 유지 |

수동 실행도 임의 SHA·이미지 URL·명령을 받지 않는다. DB 변경이 필요한 버전은 별도 migration
실행서·승인 범위에서 처리한 다음 현재 ledger·설정에 맞는 release로 이 실행기에 다시 진입한다.
manual_required를 단순 실행 버튼으로 우회하지 않는다. 후보 digest에 연결된 정책/기능 인수와
서버의 현재 ledger·설정·템플릿 준비 근거를 확인한 뒤 공통 교체 단계에 들어간다.
보안·백업 검사를 생략하는 force 옵션은 만들지 않는다. hold 상태에서도 명시적 수동 복구는 가능하다.

## 6. 공통 실행기와 실패 복구

1. 서버 전역 배포 잠금을 획득하고 실행 ID·trigger·후보·이전 정상 상태를 journal에 먼저 기록한다.
   자동·수동·rollback·부팅 복구가 같은 잠금을 사용한다. 잠금 사용 중 자동 시도는 SKIPPED_BUSY,
   수동은 BUSY로 종료하며 다른 작업을 강제 종료하지 않는다.
2. 후보·현재 DB/설정·hold·차단 목록을 검증한다. 같은 정상 release이면 NO_CHANGE로 끝낸다.
3. API/Web을 정확한 digest로 pull하고 새 release 디렉터리에 stage한다. root 소유의 검토된 템플릿과
   기존 runtime 설정을 사용한다. Compose config는 비밀을 출력하지 않는 검사만 실행한다.
4. 새 백업과 §7의 복원 확인을 완료한다. 이 단계까지 실패하면 실행 중 앱과 업무 timer를 유지한다.
5. publish/outbox/cleanup의 기존 활성 상태를 기록한 뒤 일시 정지하고 진행 중 작업 종료를 확인한다.
   backup/log는 유지한다. 백업·수동 migration과 공유하는 유지보수 잠금을 획득한 뒤 ledger·설정을
   다시 검사해 준비 중 다른 변경이 없었는지 확인한다.
6. API → readiness 확인 → Web → liveness 확인 순으로 --no-deps 교체한다.
   DB·Gateway·Tunnel을 recreate하지 않고 down -v·image prune·DB 역 migration을 실행하지 않는다.
7. §8의 기본 동작 검사 후 마지막 정상 release와 부팅 참조를 임시 파일+원자적 교체로 갱신한다.
   부팅 helper의 하드코딩을 제거하고 허용 release 경로의 정상 포인터만 사용하도록 변경한다.
8. 원래 활성 상태였던 업무 timer만 재개하고 서비스·실행 digest·부팅 대상·timer를 다시 읽는다.
   진입 때 이미 꺼져 있던 작업을 자동으로 켜지 않는다.
9. 최종 기록을 확정하고 결과 알림을 전송한다. 알림 실패는 별도 상태로 남겨 다음 자동 배포를 보류한다.
   건강한 앱을 알림 전송 실패만으로 되돌리지 않는다.

5단계 이후 실패하면 이전 digest 두 개·설정·부팅 참조·업무 timer 상태를 한 release 단위로 복구한다.
같은 실패 시도 안의 즉시 복귀는 이미 검증한 사전 백업 증거를 사용하며 새 백업을 기다리지 않는다.
별도로 시작하는 수동 rollback은 현재 상태·새 백업/복원 검사를 다시 거친다.
Web 실패 후 신규 API만 남아 있는 혼합 상태를 성공으로 표시하지 않는다. 복귀 뒤 동일 smoke를 검사한다.
rollback도 실패하면 FAILED_RECOVERY_REQUIRED·AUTO_HOLD와 긴급 알림을 남기고 반복 재설치하지 않는다.
기동 중 전원 손실은 journal과 마지막 정상 포인터로 복구하며, 이 경로는 VM 재부팅 시험으로 확인한다.

단계별 상태·예산 초과·잠금 해제는 finally 처리만으로 보장되지 않는다. 프로세스 강제 종료와
재부팅 뒤에도 실패 후보 차단·업무 timer 원상 복구·포인터 일치를 재조정하는 절차가 필요하다.
앱이 비정상이라 작업 재개가 위험하면 timer 중지 상태·사유·담당자를 기록하고 즉시 알린다.

## 7. 백업·복원과 03:30 백업 경합

현재 새 백업의 실제 복원 조건을 자동화 편의를 위해 해시 검사로 축소하지 않는다.
정기 03:30 백업을 기다리지 않고 배포 후보가 있을 때만 별도의 사전 백업을 생성한다.
정기 백업과 사전 백업은 공통 backup 잠금으로 직렬화하고 정확한 backup ID를 사용한다.
latest.json이 다른 백업을 가리키도록 바뀌어도 검증 대상이 바뀌지 않아야 한다.
정기 백업이 먼저 진행 중이면 앱 교체를 보류하고, 앱 교체 중 도래한 백업은 유지보수 잠금 해제 후
실행한다. 잠금 순서는 배포 잠금 → 유지보수 잠금 → backup 잠금으로 통일해 교착을 막는다.
복원 확인을 기다리는 동안 유지보수/backup 잠금은 해제하고 앱 교체 직전에 재검사한다.
정기 백업·수동 migration은 배포 잠금을 요구하지 않되 유지보수 → backup 순서를 지킨다.
백업 전송 도구는 현재 가동 API 컨테이너에 의존하지 않도록 검증된 고정 image를 사용한다.
실패한 앱 때문에 R2 전송·복구 도구까지 기동하지 못하는 구조는 DPL-04에서 제거한다.

**현재 무인 복원 경로는 없다.** [기존 복원 도구](../../deploy/backup/verify-restore-server.py)는 키를
표준입력으로 받아 메모리에서 사용하고 현재 운영 DB와 수량을 비교한다. 이를 그대로 timer로 실행할 수 없다.

DPL-04는 운영 서버와 분리된 신뢰 검증 장비가 다음 절차를 수행하도록 한다.

1. 백업 요청의 backup ID·암호화 SHA-256·배포 실행 ID·snapshot 메타데이터를 읽는다.
2. 백업 읽기 전용 자격증명으로 R2의 해당 archive를 내려받고, 장비 내부의 age identity로 복호화한다.
   운영 서버·GitHub CI·문서에 복호화 키를 상시 배치하지 않는다.
3. 격리 PostgreSQL 18에 복원하고 migration ledger·정책 해시·수량을 **동일 dump snapshot**의
   기준값과 비교한다. 백업 이후 계속 변경되는 운영 DB 수량과 직접 비교하지 않는다.
4. 검증 장비가 backup ID·해시·run ID·검증 결과·시각·만료를 담은 서명된 receipt를 게시한다.
   서버는 설치된 검증 공개키로 확인하고 이번 백업과 연결된 성공 receipt만 수용한다.
5. 평문·임시 DB는 검증 장비에서 정리하며 결과에는 개인정보/본문/키를 넣지 않는다.

제안 전송 경로는 기존 private R2 backup 읽기와 **별도 private 검증 제어 bucket**의 요청/receipt다.
운영 서버와 검증 장비의 credential을 분리하고 bucket 권한 한계를 DPL-01에서 확인한다.
prefix 이름만으로 접근 격리가 된다고 가정하지 않는다. receipt 쓰기 권한이 있어도 검증 서명키 없이
성공 증거를 위조할 수 없어야 한다. 실제 bucket 이름·검증 장비·서명키 보관 위치는 (미정)이다.

기존 Mac을 최초 검증 장비로 시험할 수 있지만 새벽 가동·절전·키 잠금 해제를 확인해야 한다.
검증 장비 부재/오프라인·receipt 만료/변조·20분 준비 한도 초과는 BACKUP_RESTORE_PENDING으로
기존 앱을 유지한다. 이 의존성이 해소되기 전에는 매일 무인 배포 활성화를 완료했다고 하지 않는다.
새 상시 장비·서비스의 비용과 키 보관 방식은 구현 전에 확정하고 별도 클라우드를 임의 도입하지 않는다.

## 8. 기본 동작 검사와 관찰

- 정확한 API/Web digest, 내부 API readiness·Web liveness, DB/Core/Web/Nginx 상태, OOM·host port 없음.
- HTTPS /meme·정책·공개 상세·health, HTTP/www redirect, 공개 API와 실제 정적 JS/CSS 표본.
- 익명 관리자 경로의 Access 이동, 내부 경로 차단, HTML/JSON 오류 no-store.
- robots의 Cloudflare/앱 최종 응답, sitemap XML과 공개/비공개 경계는 첫 적용 및 관련 변경 때 검사.
- 기존 정적 자산별 Cloudflare 규칙과 신규 빌드 파일의 차이를 검사한다. 규칙 업데이트가 필요한
  후보는 manual_required로 보류하거나 먼저 검증된 경로 규칙으로 전환한다. 전체 purge는 하지 않는다.
- 실제 MFA 관리자 쓰기·외부 Google/Discord 수신은 자동 smoke로 대체하지 않는다.
  해당 동작 변경은 별도 수동 인수가 필요한 후보로 분류하며 OPS-01~03의 미완료 상태를 유지한다.

기록: run ID, trigger(auto/manual/rollback), KST 예정일·UTC 시각, 이전/후보 SHA·두 digest,
manifest digest, 비밀 없는 설정 식별자, DB ledger digest, backup ID·receipt ID, 단계별 결과,
timer/부팅 readback, 실패 코드, 복귀 결과, 알림 수신 결과.

| 결과 | 뜻 |
| --- | --- |
| NO_CHANGE / SKIPPED_BUSY / SKIPPED_WINDOW / HELD | 변경 없음 / 다른 작업 중 / 시간 밖 / 운영자 보류 |
| MANUAL_REQUIRED / BACKUP_RESTORE_PENDING | 자동 허용 조건 불충족 / 실제 복원 증거 대기 |
| FAILED_PRECHECK | 후보·권한·자원 등 검사 실패. 앱 변경 없음 |
| DEPLOYED_AUTO_CHECKS_PASSED | 앱 교체·자동 검사·부팅/timer readback 완료. 실제 운영자 인수와 구분 |
| ROLLED_BACK | 배포 실패 후 이전 정상 상태 복구·재검사 완료. 배포 성공이 아님 |
| FAILED_RECOVERY_REQUIRED | 복귀 실패/상태 불명확. 자동 보류·즉시 대응 필요 |

실패·복귀·수동 필요·복원 대기는 운영 담당에게 즉시 알리고, 무변경은 일일 상태 기록으로 남긴다.
성공도 SHA·digest·결과 링크를 알린다. 수신 채널·담당자는 (미정)이며 로그 생성만으로 수신 성공이라 하지 않는다.
일반 진단 로그 7일, 복원 시험 결과 1년 등 기존 보존 규칙을 유지한다. release 상태에는 비밀·개인정보를
넣지 않고 현재/직전 정상/복구 중 참조는 보호한다. 세부 배포 이력·이미지 보관 한도는 DPL-01에서
디스크 예산과 함께 확정하며 최초 버전에서 자동 삭제하지 않는다.

## 9. 인증·권한과 최초 활성화

| 위치 | 최소 권한·경계 |
| --- | --- |
| CI verify/collector | contents: read, 운영 비밀 없음 |
| CI images/release-candidate | 필요한 job만 packages: write, main/ref·변경 검토 검사 |
| 서버 GHCR | 대상 image/manifest package 읽기 + PAT classic read:packages. 만료·교체·회수 절차 필요 |
| 서버 배포 명령 | root 소유의 고정 wrapper와 허용 인자만. 일반 계정에 임의 Docker socket/명령 권한 부여 금지 |
| runtime | 기존 서버의 DB·R2·Access secret 재사용. manifest/CI로 복사하지 않음 |
| 외부 복원 검증 장비 | backup 읽기, 별도 검증 제어 저장소 접근, age 복호화·receipt 서명키 보관 |

서버 GHCR 토큰은 Git 저장소 전체 읽기/쓰기나 AWS·Cloudflare 관리 권한을 갖지 않는다.
백업 검증 통신·알림 credential은 GHCR 읽기 토큰과 별개다. 초기 설치에는 기존 신뢰 관리 경로로
서버에 접근해야 하지만 이후 자동 배포를 위해 SSH inbound를 넓히거나 GitHub IP 전체를 허용하지 않는다.

활성화 순서는 DPL-01~08 증거 → 자동 OFF 상태의 서버 plan → 승인된 수동 후보 배포·복귀·재부팅
인수 → 매일 03:00 timer 활성화 → 실제 새벽 실행 및 7일 관찰이다. 구현 요청이나 이 문서 작성은
운영 설치·활성화·커밋·push 승인을 대신하지 않는다. 자동화를 끌 때는 hold를 먼저 설정하고 timer를
중지하며, 가동 중 앱과 기존 업무/백업 timer는 보존한다.

## 10. 공식 근거와 검증 범위

2026-09-26 공식 자료 확인. 아래는 기능·설정 의미의 근거이며 이 저장소나 서버의 실제 설정 증거가 아니다.

- [systemd timer 원문](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.timer.xml):
  OnCalendar·Persistent·AccuracySec·중복 활성화 동작. 운영 버전의 지원 여부와 시간 계산은 DPL-06에서 검증.
- [systemd 시간식 원문](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.time.xml):
  calendar 시간식과 timezone. KST/UTC·재부팅·시계 변경 시험은 별도.
- [GHCR 인증·digest](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry):
  Actions의 GITHUB_TOKEN, 외부 PAT classic read:packages, package 접근 및 digest 지정.
- [Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency):
  동시 실행 제한·취소 동작. 후보 최신성 판정과 서버 배포 잠금을 대신하지 않음.

- [ORAS 원격 저장소 모델](https://github.com/oras-project/oras-go/blob/main/docs/Targets.md):
  GHCR 등 OCI registry의 manifest/blob 저장 모델. 실제 후보 artifact 게시 성공을 뜻하지 않음.
