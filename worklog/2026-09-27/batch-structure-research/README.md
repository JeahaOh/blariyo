# batch 구조에 대한 연구 — 별도 2GB 서버와 하루 두 차례 실행 검토

- 담당: Codex / 이 세션의 배치 구성 검토.
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`.
- 브랜치·기준: `feature/m0-design-completion@71ed8ef`.
- 상태: 종료 — 검토 및 기록만 완료. 갱신: 2026-09-27 00:05 KST.
- 요청: 별도 2GB 배치 서버에서 매일 04:00~05:00, 13:00~14:00 KST 실행하는 구성의 적합성.
- 쓰기 범위: 이 기록만. 기존 `worklog/2026-09-27/m0-implementation-plan/README.md`는 다른 담당의 변경으로 보존한다. 해당 기록의 담당 상태는 종료로 확인했다.
- 이전 대화의 기록 경로: `worklog/2026-09-26/batch-structure-research/README.md`. 이번 조회에서 파일이 없으므로 과거 내용을 복원하거나 링크가 존재한다고 보고하지 않는다.
- 제외: 서버 생성·요금제 변경·배포·운영 DB 접근·자동 수집 활성화·Git ref/index 변경.

## 판단

- 운영 서버의 CPU·메모리 부담 분리 목적에는 적합하다. 웹·DB 자체에 메모리가 더 필요한지와 배치 전용 2GB의 처리량은 실측 전이다.
- Linux/public IPv4 일반형 정가는 2GB $12/월, 4GB $24/월이다. 따라서 운영 2GB + 배치 2GB는 $24/월로 4GB 한 대와 같다. 세금·스냅샷·초과 전송·기타 서비스·크레딧은 별도다.
- Lightsail 일반 인스턴스는 정지 상태에도 삭제 전까지 과금한다. 배치를 하루 두 시간만 실행하거나 VM을 나머지 시간 정지해도 위 기본 서버 비용은 줄지 않는다. Lightsail이라면 VM을 유지하고 작업만 예약 실행하는 구성이 단순하다.
- 직전 질문의 정정: 2GB만 무료이고 4GB부터 유료인 구조가 아니다. [운영 기록](../../../docs/operations/current-status.md)의 9월 20일 무료 플랜·잔여 크레딧 $120 관측은 현재 잔액이 아니다. 앞서 +$12는 정가 차액이며 실제 추가 카드 결제액이 아니다. 계정별 사용 가능 상품·크레딧 조건은 미조회다.
- 실행 시간만큼 컴퓨팅 비용을 내는 목적이면 EC2 On-Demand의 예약 시작/정지가 후보다. 중지 중 컴퓨팅 요금은 없지만 EBS 저장장치 등은 별도 과금되며, 현재 Lightsail DB와의 사설 연결 및 시작 스케줄러도 설계해야 한다. 이번에는 EC2 SKU/총비용을 산정하지 않았다.

## 구성 제안과 조건

1. 기존 운영 2GB는 Web/API/PostgreSQL을 유지하고 별도 2GB에 Docker 배치만 둔다. 같은 계정·서울 리전의 사설 IPv4로 DB에 연결하는 안을 우선 검토한다. 이 통신 경로에는 NordVPN/Tailscale이 필요하지 않다.
2. 운영 [PostgreSQL Compose](../../../deploy/postgresql/compose.yaml)는 현재 host port를 공개하지 않는다. 사설 접속 지점, batch 전용 DB role, 해당 배치 IP만 허용하는 DB/호스트 정책과 암호화 연결은 추가 설정이 필요하다. Lightsail 콘솔 방화벽은 사설 IP 트래픽을 통제하지 않으므로 콘솔 설정만으로 접근 제한이 됐다고 판단하지 않는다.
3. systemd timer(리눅스 예약 실행 기능)로 04:00·13:00 KST에 단발 Docker 배치를 실행하는 안이다. Jenkins 도입은 필요하지 않다. 사전 빌드된 이미지를 사용하고 처음에는 HTTP 수집 worker 한 개로 제한해 메모리·처리 시간을 측정한다. 브라우저 병렬 수집과 1시간 내 전체 완료는 보장하지 않는다.
4. 1시간은 처리 예산으로 삼고 종료 직전에는 새 작업을 받지 않으며 진행 상태를 저장한 뒤 정상 종료하도록 설계한다. 중복 실행 차단·재시도 상한·실패 기록·다음 실행에서의 재개가 필요하며 해당 전체 기능의 구현 완료를 뜻하지 않는다.
5. 두 실행 시작 사이 간격은 9시간과 15시간이다. 직전 1시간 게시물만 조회하면 누락된다. 마지막 성공 지점 이후 수집 또는 겹치는 조회 범위와 중복 제거를 사용한다. 인기 목록에서 이미 사라진 글은 나중 조회만으로 회수하지 못할 수 있다.
6. 하루 두 번 처리하면 즉시 수집이 아니며 최장 약 15시간의 시작 간격이 있다. Discord Gateway의 상시 명령 접수는 수집 작업 시간과 별도 검토해야 한다. 운영 DB는 공유하므로 DB 쓰기 부하는 사라지지 않는다.

## 현재 계약과 검증

- [인프라 계획](../../../docs/planning/02-infra-plan.md)은 현재 운영 2GB와 별도 수집 장비 미정을 유지한다. 본문은 후보 검토이며 확정 아키텍처로 정본을 바꾸지 않았다.
- [수집 설계](../../../docs/system-design/07-spring-collector-design.md)의 현행 경로는 Java direct batch다. Spring Batch/Quartz 절은 legacy이며 현재 스케줄러로 단정하지 않는다. robots/일일 총량 통제와 원격 writer·운영 활성화의 미완료 경계도 유지한다.
- `DirectBatchRunner.Options`의 출처·페이지·항목·조회 기간·요청 간격 설정과 유한 반복 경계를 읽었다. 2GB 성능 측정, 클라우드 IP에서의 출처 접근, DB 연결, 실제 스케줄 실행은 미검증이다.
- 공식 요금·정지 과금·사설 IP·EC2 상태별 과금 문서를 2026-09-27 조회했다. 문서 상대 링크와 diff 공백·작업 범위 검사를 수행한다. 애플리케이션 변경이 없어 제품 테스트는 실행하지 않는다.

## 공식 근거

- [Lightsail 요금표](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html)
- [Lightsail 과금 및 무료 체험 FAQ](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html)
- [Lightsail 사설 IP](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-public-ip-and-private-ip-addresses-in-amazon-lightsail.html)
- [Lightsail 방화벽 적용 범위](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)
- [EC2 상태별 과금](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html)

## 후속 검토 — Jenkins 겸용과 무중단 배포 (2026-09-27 00:07 KST)

- 요청: 비용이 같다면 배치 서버에 Jenkins를 함께 두고 배치 실행과 무중단 배포를 관리하는 편이 나은지 검토.
- 담당·폴더·브랜치: 위와 동일, HEAD `71ed8ef`. 상태: 종료 — 검토·기록만 완료.
- 동시 작업: `m0-implementation/README.md`에서 다른 담당의 앱·deploy·docs 구현 진행을 확인했다. 해당 변경을 읽기 전용으로 보존하며 이번 쓰기는 이 파일에만 한정한다. Git ref/index 변경 없음.
- 판단: 작업 실행·이력·수동 재실행 화면이 필요하면 Jenkins 도입에 가치가 있다. 하루 두 번 예약 실행만 필요하면 systemd timer보다 JVM·플러그인·업데이트·백업의 관리 부담이 늘어난다. 별도 서버 정가가 같다는 사실만으로 Jenkins가 더 적합하다고 판단하지 않는다.
- 2GB의 범위: Jenkins가 2GB에서 실행 불가능한 것은 아니다. 다만 공식 Linux 설치 안내는 소규모 팀에 RAM 4GB 이상을 권장한다. Jenkins와 Java 수집, Node/Gradle/Docker 빌드를 같은 2GB에 함께 올리는 안은 권장하지 않는다. 빌드는 기존 GitHub Actions에 유지하고 Jenkins는 예약·수동 실행 및 배포 절차 호출을 맡기는 안이 우선이다. 경량 구성도 동시 작업 1개·배치/배포 상호 배제·실측이 필요하다.
- 실행 권한: Jenkins controller 자체에서 작업을 수행하는 대신 분리된 실행 agent를 사용하고, 배포 자격 증명과 batch DB 역할을 분리하는 것이 공식 권고와 맞는다. 같은 VM의 별도 agent가 메모리 용량을 추가해 주는 것은 아니다. 임의 Docker socket 접근을 안전한 격리로 취급하지 않는다.
- 현재 근거: `.github/workflows/ci.yml`의 `images` job은 main 검사 이후 API/Web 이미지를 GHCR에 게시한다. 현재 checkout의 [인프라 설계](../../../docs/system-design/04-infrastructure-design.md)와 [배포 실행서](../../../docs/operations/deployment-runbook.md)는 API/Web 순차 교체이며 무중단이 아님을 명시한다. 과거 nightly CD 설계의 존재를 현행 checkout 구현·운영 활성화로 간주하지 않는다.
- 무중단 조건: 기존 버전을 유지한 채 새 Web/API를 실행하고 readiness와 공개 흐름을 검증한 다음 gateway 트래픽을 전환한다. 진행 중 요청 종료 대기, 구 버전 정적 자산 유지, 신·구 앱과 DB migration 호환 및 실패 복귀가 필요하다. Jenkins는 이 절차를 자동 실행할 수 있으나 설치 자체가 무중단을 보장하지 않는다. DB/VM 장애까지 이중화하는 구성도 아니다.
- 운영 RAM 검토: 현재 Compose의 상한은 API 256MiB, Web 384MiB, PostgreSQL 768MiB, Nginx 64MiB다. 구·신 앱 전체를 동시에 실행하면 `(256+384)*2+768+64=2112MiB`로 약 2.06GiB이며 OS·Docker·Tunnel을 포함하지 않는다. 이는 실제 사용량이나 예약량이 아닌 설정된 제한값 합계다. 2GB에서 불가능하다는 증명은 아니지만 안정적인 이중 실행 여유도 확인되지 않았다. 무중단이 우선이면 운영 서버 4GB 증설 후보와 부하 검증을 먼저 평가한다.
- 비용 범위: 운영 2GB + 보조 2GB는 기본 월 $24다. 운영을 4GB로 올리고 보조 2GB를 유지하면 월 $36이므로 같은 예산에서 무중단까지 확보됐다고 설명하지 않는다. 크레딧·세금·기타 서비스 비용은 별도다.
- 검증: 관련 CI·Compose·배포 문서와 Jenkins 공식 요구사항을 조회했다. Jenkins 설치·메모리 부하 시험·무중단 전환·운영 상태 조회는 미실행이다. 문서 링크·공백과 이번 세션의 변경 범위를 확인한다.
- 공식 근거: [Jenkins Linux 요구사항](https://www.jenkins.io/doc/book/installing/linux/), [controller 실행 격리](https://www.jenkins.io/doc/book/security/controller-isolation/).

## 후속 검토 — Web/API와 DB/배치 분리 (2026-09-27 00:12 KST)

- 요청: 사용자가 무중단 배포의 필요성을 낮추고, 한 인스턴스의 DB·배치와 다른 인스턴스의 Web·API 구성 적합성을 질문했다.
- 담당·폴더·브랜치: 위와 동일, HEAD `71ed8ef`. 상태: 종료 — 검토·기록만 완료. 다른 담당의 진행 중 구현 파일은 보존하고 이번 쓰기는 이 파일만 사용한다.
- 판단: 가능한 구성이다. 서비스 서버의 RAM 여유와 앱/DB 호스트별 재시작·확장 독립성이 장점이다. 반면 DB와 scraper가 CPU·메모리·디스크를 공유하고 모든 API의 DB 접근이 서버 간 네트워크에 의존하게 된다. DB 호스트의 부하·장애가 공개 서비스에 영향을 주므로 두 인스턴스를 서비스 이중화로 보지 않는다.
- 현재 우선안: 운영 2GB에 Web/API/DB를 유지하고 별도 2GB에 배치를 두는 안. 수집 작업의 변동 부하를 공개 요청 처리와 DB로부터 호스트 단위로 분리하고 기존 DB 이동·API 접속 경로 변경을 줄인다. 배치의 DB 쓰기·잠금·접속 수는 이 안에서도 제한해야 한다. 실제 API/DB 메모리 사용량을 측정하지 않았으므로 영구적인 최선이라고 단정하지 않는다.
- 대안 선택 조건: 앱 서버의 독립적인 증설·재시작이 중요하고 수집이 작은 HTTP 작업으로 제한된다면 DB+배치 서버도 후보가 된다. 배치는 단일 worker, CPU·메모리 한도, 로그·임시 파일 상한, 짧은 DB transaction과 제한된 연결 수로 DB를 우선 보호해야 한다. 브라우저 병렬 수집·이미지 변환·빌드는 같은 2GB DB 호스트에 추가하지 않는 안을 권고한다.
- 배포 경계: `deploy/application/compose.yaml`과 `deploy/postgresql/compose.yaml`은 현재 별도 프로젝트다. 배포 실행서도 `api`와 `web`만 `--no-deps`로 교체하며 일반 코드 배포에서 DB를 재생성하지 않는다. 따라서 앱 배포 시 DB를 유지하는 목적만으로 DB를 별도 VM에 옮길 필요는 없다. DB schema 변경은 어느 구성에서도 호환성과 실행 중 writer 조율이 필요하다.
- 사설 연결: 같은 계정·서울 리전의 사설 IPv4 경로를 사용하면 이 연결에 NordVPN/Tailscale은 필요하지 않다. 같은 리전의 Lightsail 간 사설 IP 전송은 AWS 문서상 무료다. 현재 DB는 host port를 공개하지 않고 Docker 내부 연결을 전제로 `pg_hba.conf`를 구성하므로, API 서버의 사설 주소만 허용하는 연결 지점·DB/호스트 접근 제어·암호화 연결을 준비해야 한다. Lightsail 콘솔 방화벽은 사설 트래픽을 통제하지 않는다.
- 비용·Jenkins: 두 배치안 모두 Linux/public IPv4 일반형 2GB 두 대면 기본 월 $24라는 이전 비교를 유지한다. 크레딧·세금·기타 자원은 별도다. DB+배치+Jenkins를 한 2GB에 모두 올리는 것은 권고하지 않는다. Jenkins 도입 여부는 아직 확정되지 않았으며 빌드는 기존 GitHub Actions 유지안이다.
- 무중단: 사용자 최신 의견에 따라 이번 비교의 필수 목표에서 제외한다. 블루그린·운영 4GB 증설을 선행 조건으로 두지 않는다. 정본·서버·배포 설정은 변경하지 않았다.
- 검증: 현재 planning, Compose, DB 접속 정책, 배포 실행서와 AWS 공식 통신·방화벽 문서를 읽었다. 자원 실측·DB 이동·실연결·부하 검증은 미실행이다. 이 기록의 링크·공백과 쓰기 범위를 확인한다.
- 추가 공식 근거: [Lightsail 사설 통신 비용](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html).
