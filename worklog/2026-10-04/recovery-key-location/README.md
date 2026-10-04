# 복구키 보관 경로 문서 갱신

- 담당: Codex 복구키 경로 문서 갱신 세션
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/ci-fast-validation` (기존 변경 보존, 브랜치 전환 없음)
- 상태: 종료
- 갱신: 2026-10-04 KST
- 요청: 복구키 위치 문서 갱신.
- 변경 경로: `deploy/backup/README.md`, 이 기록.
- 담당 경계: 기존 CI 개선 기록은 종료 상태이며 변경 경로가 겹치지 않는다. 기존 미커밋 파일·과거 작업 기록은 보존한다.

## 변경

- 백업 안내의 복구키 경로를 현재 프로젝트의 `worklog/task-list/.blariyo-recovery/postgres-age-identity.txt`로 수정.
- 프로젝트 기준 상대경로와 현재 절대경로를 함께 표기하고, Git 제외 파일이라 새 clone에 포함되지 않음을 명시.
- 현행 문서 검색에서 직접적인 옛 경로 안내는 위 백업 문서 1곳 확인. 다른 운영 문서의 백업 문서 링크는 그대로 유효.
- 복구키 파일 자체·권한·보관 위치·서버 설정은 변경하지 않는다.

## 검증

- 실제 파일 존재, 파일 600·부모 디렉터리 700 확인.
- `git check-ignore` 제외와 `git ls-files` 미추적 확인. 키 내용은 읽거나 출력하지 않음.
- `git diff --check` 통과. 문서 diff에서 경로 안내만 변경되고 기존 비밀 보관 규칙·링크·미확정 항목이 유지됨을 확인. 시작·종료 Git 상태에서 기존 CI 개선 변경과 다른 작업 기록 보존 확인.
- commit·push 미실행.
