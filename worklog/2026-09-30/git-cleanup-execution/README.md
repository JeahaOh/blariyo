# Git 통합·원격 동기화·종료 브랜치 정리 실행

- 요청: [확정 계획](../git-cleanup-plan/README.md)을 진행. 사용자의 실행 지시는 계획의 commit·merge·일반 release push·확인된 종료 브랜치 삭제 범위를 포함한다.
- 담당: Codex / 상태: 진행 / 작업일: 2026-09-30 KST.
- 기본 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`, 시작 feature/m0-design-completion@578c058.
- 변경 범위: 승인된 계획의 GIT-01~06, docs/status.md·docs/roadmap.md의 Git 현황, 격리 release 병합/검증/기록. main·별도 m0-core worktree·고유 원격14개·열린 governance PR은 보존한다.
- 별도 m0-core 미커밋88개는 SHA-256 기준선으로 보호한다. 원격PR8개를 GitHub 로그인 화면에서 읽기 전용 확인했으며 삭제 후보의 연결 여부를 별도로 검사한다.
- 초기 단계: 기록·현행 Git 상태 문서를 마감한 뒤 bundle 복구 검증, release에 최신 feature 병합, 실제 통합 검증, 일반 push/readback, 확인된 종료 브랜치 정리 순서로 진행한다.
- API/웹·DB·브라우저 검증은 격리 비운영 환경만 사용한다. main 승격·운영 배포·실제 외부 수집은 실행하지 않는다.
