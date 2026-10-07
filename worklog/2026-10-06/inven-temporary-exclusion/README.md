# 인벤 임시 수집 제외

- 담당: Codex / 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/production-collection-20261004`
- 상태: 종료 / 갱신: 2026-10-06 21:10 KST
- 요청: 인벤도 수집 대상에서 일시 제외한다.
- 범위: 기본 출처 설정의 inven, 제외 목록 시험, 수집 기획·기술 문서, 이 기록. 다른 담당의 품질 파일·공유 빌드·Git과 기존 변경은 보존한다.
- 기준: [이전 세 출처 제외](../temporary-source-exclusion/README.md)와 같은 approved/blockedReason 설정으로 다음 전체 배치에서 제외하고 직접 수집도 차단한다. 기존 수집물·공통코드는 보존한다.

## 결과

- 인벤에 `approved: false`, `blockedReason: SOURCE_DISABLED` 적용. 임시 제외4개, 등록21개 중 전체 배치 후보17개다. 기존 제외3개와 다른 출처 설정은 유지했다.
- Node24.18.0 설정/스키마/배치 pool 집중10 tests PASS. 기존 JAR 임시 사본에서 인벤 batch는 SOURCE_DISABLED/종료2, collect-url은 SOURCE_NOT_ALLOWED/종료1 확인. DB 자격증명 없이 수집 전 차단했다.
- `git diff --check` PASS. 기본 설정을 쓰는 다음 배치부터 적용하며 운영 장비나 별도 설정 사본은 변경하지 않았다. 재수집·DB 삭제·서버 재시작·공유 빌드·커밋/푸시 없음.
