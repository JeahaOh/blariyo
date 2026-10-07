# MLBPARK·PGR21 임시 수집 제외

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료 / 갱신: 2026-10-06 21:18 KST
- 요청: MLB와 PGR을 임시 수집 제외한다. 등록 출처명에 따라 MLBPARK(`mlbpark`)·PGR21(`pgr21`)에 적용한다.
- 범위: 기본 출처 설정·설정 시험·수집 기획/아키텍처·이 기록. 품질 도입 담당의 source/시험·공유 빌드·Git은 보존한다.
- 기준: approved=false, blockedReason=SOURCE_DISABLED. 기존 수집물·공통코드·parser와 MLBPARK GENERAL_LIST/PGR21 DETAIL_ONLY 분류는 보존한다.
- Git 상태: 기존 작업 단위 커밋 준비를 유지한다. 품질 도입 세션 우선권 때문이 아니라 AGENTS G03의 동시 Git 작업 금지 경계이며, 사용자의 이번 질문을 해당 경계 해제나 타 세션 강제 종료 승인으로 해석하지 않는다.

## 결과

- 두 출처 임시 제외 적용. 디시인사이드·아카라이브·보배드림·인벤·MLBPARK·PGR21 총6곳 제외, 전체 실행기 대상15곳이다. 기존 수집물은 삭제하지 않았다.
- Node24.18.0 설정·스키마·전체 실행기 집중10 tests PASS. 기존 JAR 사본에서 두 출처의 batch/collect-url4회 차단 응답 PASS. DB 자격증명 없이 외부 수집 전 차단했다.
- 제외 시험은 원래 네 출처의 HOT_LIST뿐 아니라 MLBPARK GENERAL_LIST와 PGR21 DETAIL_ONLY·각 목록 설정이 보존되는지 검증하도록 확장했다. 실제 분류를 바꾸거나 정책 검증을 해제하지 않았다.
- `git diff --check` PASS. 기본 source 설정을 사용하는 다음 배치부터 적용하며 별도 설정 사본/운영 장비는 미반영이다. 공유 빌드·Git 변경·커밋·푸시·배포는 하지 않았다.
