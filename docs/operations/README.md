# 운영 안내

현재 운영 상태와 환경·배포·백업·복구 절차를 찾는 진입점이다. 실행 도구는 [deploy](../../deploy/)에 둔다.

- [현재 운영 상태](current-status.md): 실제 서버에서 확인한 결과와 미검증 사항.
- [배포 정책](deployment-policy.md), [배포 실행서](deployment-runbook.md): 현행 수동 배포와 03:00 KST 자동화 전환.
- [야간 배포 설계](../system-design/10-nightly-deployment.md), [DPL-01~09](../implementation-tasks/nightly-deployment.md):
  WEB·API 매일 03:00 자동 배포+수동 실행 계획. 구현·운영 활성화는 별도.
- [환경 설정](environment-configuration.md), [운영자 준비](owner-setup-checklist.md), [인프라 검토](infrastructure-review-brief.md).
- [Docker 실행](docker.md), [운영 명령](../../deploy/operations/README.md), [백업·복원](../../deploy/backup/README.md).
- [법무·정책 확인](../legal/README.md), [Core 정책 자료](../legal/m0-core/).
- [Collector 전환 관찰 양식](collector-transition-observation.md): 기존 legacy 전환 조건 포함. 현행 Core/P1 단계는 [로드맵](../roadmap.md)과 대조.

이곳의 미정·운영 차단 조건은 문서 이동으로 해소되지 않는다. 특정 후보·실행 결과는 날짜별 worklog에 보관한다.
