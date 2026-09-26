# GitHub CI와 배포 정책

2026-09-20 수동 배포 결정, **2026-09-26 매일 03:00 KST 자동 배포+필요 시 수동 배포로 목표 정책 변경**.
목표는 로컬 수정 → PR 검증 → main의 API/Web 이미지·후보 게시 → 운영 서버의 정기/수동 실행이다.
**구현·운영 활성화 전까지 현재 수동 배포 절차를 유지한다. 이번 변경은 설계·계획이며 자동 배포 설치가 아니다.**
마지막 운영 확인은 2026-09-23의 [`5c581c2` API/Web 배포](../../worklog/2026-09-23/release/production-deployment-5c581c2.md)와
[DB V008·Collector V006 반영](../../worklog/2026-09-23/release/production-db-promotion.md) 기록이다.
이 문서 갱신에서 원격 CI·서버를 다시 조회하지 않았다. 실제 명령과 복귀 조건은 [배포 실행서](deployment-runbook.md)에 있다.

## 현재 방식과 선택

| 방식 | 장점 | 부담·한계 | 결정 |
| --- | --- | --- | --- |
| 단일 VM 순차 교체 | 추가 서버 비용 없음, 되돌릴 이미지 명확 | 교체 중 요청 실패 가능, 무중단 아님 | 현재 기본 |
| 같은 VM 블루그린 | 새 Web/Core의 준비 완료 후 Nginx 전환, 이전 버전 빠른 복귀 | 두 앱 동시 메모리, 공유 DB 호환성, 실행 중 요청 종료 처리 필요 | 다음 개선 후보 |
| VM 두 대 + 분산 진입점 | 서버 장애와 배포를 분리, 자원 여유 | 서버·운영 비용과 관리 대상 증가 | 트래픽·가용성 요구가 생기면 검토 |

무중단이 불가능한 것은 아니다. 다만 2GB에서 두 앱을 동시에 돌릴 수 있다고 아직 검증하지 않았다.
현재 설정 상한만 합쳐도 DB 768MiB + 앱 두 벌 1,280MiB + Nginx 64MiB = 2,112MiB이며
OS·Docker·Tunnel은 별도다. 상한의 합이 실제 사용량은 아니므로 **2GB가 현재 서비스에 부족하다는 결론은 아니다**.
현재 서비스는 실제 부하·OOM·swap·응답 시간을 보고 판단한다. 증설을 먼저 전제하지 않는다.

같은 VM 블루그린 전환 조건:

1. 2개 버전 동시 기동과 업로드·발행 부하에서 메모리/응답 시간 측정. OOM·지속 swap 과다 시 중단.
2. 버전별 Web/Core network alias 분리, Nginx upstream만 원자적으로 전환하고 `nginx -t` 후 reload.
3. 새 버전 readiness·로그인·R2·공개 경로 확인 후 기존 요청이 끝날 시간을 두고 구 버전 종료.
4. 이전 앱과 새 앱 모두 처리할 수 있는 DB 변경만 먼저 적용. 열 삭제·의미 변경은 구 버전 제거 이후 별도 배포.
5. 예약 발행·outbox·cleanup은 한 벌만 실행. 전환 중 job 중복과 진행 중 업로드를 시험.
6. 전환·복귀 중 연속 요청의 오류율을 계측해 중단 여부를 판단. 구성 이름만으로 무중단이라 부르지 않는다.

현재 앱은 같은 Compose project와 service 이름을 쓰므로 project 이름만 복제하면 위 조건을 충족하지 못한다.

## CI: 변경마다 자동 검사

[CI workflow](../../.github/workflows/ci.yml)는 PR/main push/수동 실행에서 Node 24.18.0을 사용한다.
Java parser를 호출하는 discovery 통합 검사를 위해 Java 25를 설정하고 `npm run test:fixtures`로
`testClasses`·`fixtureClasspath`를 생성한다. `verify` job은 타입·lint·unit·Nest/PostgreSQL 통합·
실제 Chromium 검증을 수행한다. 별도 `collector` job은 Java 전체·fixture·임시 PostgreSQL readback을
`npm run test:collector`로 검사하고 JAR·SBOM을 빌드한다. 테스트 건너뜀·실패·결과 누락은 실패로 처리한다.
`verify`와 `collector`가 모두 성공해야 image job을 실행한다.
운영 DB·SSH·R2·Access secret을 CI에 넣지 않는다. PostgreSQL trust 인증은 일회성 runner의 검사 DB 전용이다.
Actions는 전체 commit SHA로 고정하며 변경은 버전·테스트를 대조한 PR로 한다.

검사된 main만 GHCR(GitHub 이미지 저장소)에 `linux/amd64` API/Web 이미지를 게시한다.
tag는 전체 Git SHA, 배포 식별자는 `image@sha256:...` digest다. `latest` 배포는 하지 않는다.
현재 image 생성 job만 `packages: write`를 갖고 PR은 읽기 권한만 쓴다. fork PR에 운영 secret을 주지 않는다.
Collector JAR·SBOM과 JUnit 결과는 7일 보관하는 검사 artifact로 남긴다. Collector GHCR 이미지 게시·
설치·운영 배포는 이 job에 포함하지 않는다. 프로세스 복구·실제 외부 연동·Windows 검증은 별도다.

**2026-09-20 후속 기록에는 `f38758a` 기준 `verify`와 API/Web 이미지 게시 job 성공이 남아 있다.**
근거는 [CI/CD 후속 기록의 현재 확인](../../worklog/2026-09-20/local-ui-cicd/TODO-CICD-DEPLOY.md#현재-확인)이다.
초기 작성 시점의 미실행 상태를 현재 상태로 반복하지 않는다. 이 성공은 해당 커밋의 검사·GHCR 게시
증거이며, 이번 로컬 변경의 CI 통과나 운영 배포 증거는 아니다. 2026-09-23 정정에서는 GitHub 실행·
package·운영 서버를 직접 재조회하지 않았다.

2026-09-23 후속 GitHub 조회에서 [CI #9](https://github.com/JeahaOh/blariyo/actions/runs/35852208616)의
통합 검사 실패·images skipped를 확인했다. Java fixture 준비 누락과 migration 테스트 기대 불일치이며,
[원인·현재 로컬 대응·재검증 계획](../../worklog/2026-09-23/admin-core/FOLLOW-UP.md)에 기록했다.
이 실패는 운영 서버 배포 실패를 뜻하지 않는다.

후속 로컬 수정과 깨끗한 checkout의 검사 결과는 [CI·관리자 보완 결과](../../worklog/2026-09-23/admin-core/FIX-RESULTS.md)에
기록했다. **당시에는** 새 commit/push의 원격 성공 run과 API/Web digest가 없었다. 이후 9월 23일
`5c581c2ad82a9f1565ac53349fbaae7afed9c9cd`의
[CI #35866422574](https://github.com/JeahaOh/blariyo/actions/runs/35866422574) `verify`·`collector`·API/Web `images`가
성공했고, GHCR digest를 확인해 실제 서버 API/Web을 교체했다. digest·상세 smoke는 [운영 배포 기록](../../worklog/2026-09-23/release/production-deployment-5c581c2.md)을 따른다.
Collector job 추가와 macOS·Linux Docker의 새 실행 결과는 [Collector CI 결과](../../worklog/2026-09-23/collector-ci/RESULTS.md)에
기록했다. 이 역시 원격 `collector` job 성공이나 실제 운영 환경 검증을 뜻하지 않는다.

현재 workflow source에는 `verify`·`collector` 이후 API/Web 이미지 게시만 있고 서버 pull·Compose 교체·readiness·
rollback job은 없다. schema dump/restore는 일반 CI에서 제외하고
[별도 수동·일일 workflow](../../.github/workflows/backup-restore.yml)로 분리돼 있다.
main 보호 규칙의 `CI / verify`·`CI / collector` 필수 검사 지정 여부, 관리자 우회·요금제의 보호 기능, GHCR package
private 접근과 서버의 최소 package 읽기 권한은 별도 설정 확인 대상이다.

2026-09-23 [Core 로컬 배포 후보](../../worklog/2026-09-23/release/candidate.md)는 amd64 API/Web archive와
설정 사본을 준비하고 **당시 V005**의 Core 호환·이전 앱 복귀를 검사했다. 이후 API V008·Collector V006을
운영에 적용하고 게시글 74건을 공개했다. V008에서 9월 20일 구 API는 readiness 503이므로 복귀 기준이
아니다. 9월 23일 사전·사후 백업의 R2 다운로드·격리 복원은 확인됐으나 실제 rollback·VM 재부팅과
운영자 MFA 인수는 남아 있다. 새 후보의 SHA별 CI·서버 ledger·백업은 다시 확인한다.

## CD: 현행 수동 절차와 03:00 자동 배포 전환

main push는 운영 배포를 실행하지 않는다. 현재는 기존 맥의 archive 전달 방식도 계속 사용할 수 있다.
GHCR 경로를 사용할 때 서버의 읽기 전용 registry 인증과 digest pull을 먼저 검증해야 한다.
두 경로 모두 서버에서 source build·npm install을 하지 않는다. 운영 비밀은 서버 runtime 파일로만 전달한다.

배포 단위: Git SHA 또는 dirty snapshot hash + Web/Core image digest + 설정 묶음 식별자 + migration 목록.
배포 전 DB 백업, timer 중복 방지, 순차 교체, 공개·관리자 smoke, 부팅 복구 대상 갱신을 한 기록에 남긴다.
실패 시 **현재 DB와 호환성이 확인된 앱 이미지·설정**으로 복귀하며 DB는 자동 역마이그레이션하지 않는다.
V008의 마지막 확인 기준은 `5c581c2` 앱 image다. DB 전체 복구는 별도 범위·백업 이후 데이터 처리가 필요하다.
파괴적인 DB 변경은 호환 단계로 나누고, 불가피한 경우 점검 시간을 별도로 잡는다.
구 이미지·사전 dump는 다음 배포의 복귀 가능 여부를 확인하기 전까지 정리하지 않는다.

2026-09-26 결정한 목표는 **서버가 매일 03:00 Asia/Seoul에 main의 최신 성공 후보 manifest를
가져와 API/Web을 함께 배포하는 방식**이다. 운영자가 필요할 때 같은 실행기를 수동 호출한다.
후보 선택·시간·잠금·DB/설정 보류·복귀·복원키 경계의 정본은
[야간 배포 설계](../system-design/10-nightly-deployment.md), 구현 순서는
[DPL-01~09](../implementation-tasks/nightly-deployment.md)다.

- CI의 verify·collector·API/Web 이미지 생성이 모두 성공한 한 SHA를 배포 단위로 삼는다.
  더 최신 main 커밋이 실패/진행 중이어도 이미 게시된 최신 성공 후보는 배포될 수 있다.
- 자동 경로는 DB 변경·신규 필수 설정·민감 기능/정책 변경이 없는 app-only 후보만 허용한다.
  migration/설정 교체와 실제 MFA 등 수동 인수가 필요한 변경은 별도 절차로 보류한다.
- 새 백업의 R2 다운로드·동일 archive 격리 복원을 유지한다. 현재 복호화 키가 서버 밖에 있으므로
  DPL-04의 외부 무인 검증 경로가 준비되지 않으면 자동화를 활성화하지 않는다.
- 자동/수동/rollback은 같은 잠금·기록·검사를 사용한다. 수동 rollback 또는 실패 복귀 뒤에는
  AUTO_HOLD로 문제 버전의 다음날 자동 재배포를 막고 명시적으로 재개한다.
- 놓친 새벽 일정을 낮 재부팅 때 신규 배포로 따라 실행하지 않는다. 미완료 교체 복구는 별개다.
- 자동 배포 검사 통과와 실제 운영자 MFA·업무 인수는 별도 결과다. OPS-01~03을 자동 완료하지 않는다.

고정 IP 미사용 결정을 유지하고 GitHub runner IP 전체에 SSH를 개방하거나 운영 VM에 PR용
self-hosted runner를 두지 않는다. 현행 SSH helper의 고정 대상과 부팅 helper의 고정 release는
DPL-01에서 재조회하고 DPL-05에서 교체한다. 현재 도구가 범용 자동 CD를 지원한다고 보지 않는다.

## 확인한 공식 근거

2026-09-24 아래 공식 안내의 이미지 게시·인증·최소 권한·환경 보호 경계를 재확인했다.
이 자료 확인은 해당 저장소의 보호 규칙·요금제·registry 권한을 조회한 결과가 아니다.

- [GitHub Docker image 게시](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images): GITHUB_TOKEN과 이미지 게시 job.
- [GHCR 인증](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry): 외부 클라이언트 인증·package 접근.
- [Actions 보안](https://docs.github.com/en/actions/reference/security/secure-use): 최소 권한·SHA 고정.
- [배포 환경](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments): 환경 보호 기능과 이용 조건.
