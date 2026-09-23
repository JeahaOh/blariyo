# GitHub CI와 배포 정책

2026-09-20 결정. 2026-09-23 기록·workflow source 정합성 검토. **로컬에서 수정 → PR 검증 → main의 검증된 이미지 → 운영자가 배포 실행**을 기본으로 한다.
운영 서버는 이미 가동 중이며 이번 UI·수집 작업은 운영에 적용하지 않는다.
실제 명령과 최초 배포 증거는 [배포 실행서](deployment-runbook.md)에 있다.

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
image 생성 job만 `packages: write`를 갖고 PR은 읽기 권한만 쓴다. fork PR에 운영 secret을 주지 않는다.
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
기록했다. 새 commit/push의 원격 성공 run과 API/Web digest는 아직 없으며 로컬 통과로 대체하지 않는다.
Collector job 추가와 macOS·Linux Docker의 새 실행 결과는 [Collector CI 결과](../../worklog/2026-09-23/collector-ci/RESULTS.md)에
기록했다. 이 역시 원격 `collector` job 성공이나 실제 운영 환경 검증을 뜻하지 않는다.

현재 workflow source에는 `verify`·`collector` 이후 API/Web 이미지 게시만 있고 서버 pull·Compose 교체·readiness·
rollback job은 없다. schema dump/restore는 일반 CI에서 제외하고
[별도 수동·일일 workflow](../../.github/workflows/backup-restore.yml)로 분리돼 있다.
main 보호 규칙의 `CI / verify`·`CI / collector` 필수 검사 지정 여부, 관리자 우회·요금제의 보호 기능, GHCR package
private 접근과 서버의 최소 package 읽기 권한은 별도 설정 확인 대상이다.

2026-09-23 [Core 로컬 배포 후보](../../worklog/2026-09-23/release/candidate.md)는 amd64 API/Web archive와
설정 사본을 준비하고 V005 Core 호환·이전 앱 복귀를 검사했다. V008에서 이전 앱 readiness 503을 확인해
Core 배포와 수집 migration을 분리한다. 최종 SHA 원격 CI·운영 인수·실제 서버/백업 검증은 여전히 필요하다.

## CD: 검증된 산출물의 수동 운영 배포

main push는 운영 배포를 실행하지 않는다. 현재는 기존 맥의 archive 전달 방식도 계속 사용할 수 있다.
GHCR 경로를 사용할 때 서버의 읽기 전용 registry 인증과 digest pull을 먼저 검증해야 한다.
두 경로 모두 서버에서 source build·npm install을 하지 않는다. 운영 비밀은 서버 runtime 파일로만 전달한다.

배포 단위: Git SHA 또는 dirty snapshot hash + Web/Core image digest + 설정 묶음 식별자 + migration 목록.
배포 전 DB 백업, timer 중복 방지, 순차 교체, 공개·관리자 smoke, 부팅 복구 대상 갱신을 한 기록에 남긴다.
실패 시 이전 **앱 이미지와 호환 설정**으로 복귀하며 DB는 자동 역마이그레이션하지 않는다.
파괴적인 DB 변경은 호환 단계로 나누고, 불가피한 경우 점검 시간을 별도로 잡는다.
구 이미지·사전 dump는 다음 배포의 복귀 가능 여부를 확인하기 전까지 정리하지 않는다.

자동 CD는 서버가 승인된 manifest를 가져오는 방식이 다음 후보다. 고정 IP 미사용 결정을 유지하고,
GitHub runner IP 전체에 SSH를 개방하거나 운영 VM에 PR용 self-hosted runner를 두지 않는다.
현재 SSH helper와 부팅 helper에는 최초 IP/release가 고정돼 있어 범용 자동 CD로 볼 수 없다.

## 확인한 공식 근거

- [GitHub Docker image 게시](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images): GITHUB_TOKEN과 이미지 게시 job.
- [GHCR 인증](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry): 외부 클라이언트 인증·package 접근.
- [Actions 보안](https://docs.github.com/en/actions/reference/security/secure-use): 최소 권한·SHA 고정.
- [배포 환경](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments): 환경 보호 기능과 이용 조건.
