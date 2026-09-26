# S03 검증 자료

- [실행 결과](../S03-RESULT.md)
- [설정·작업본 입력](before.json): 변경 전 6개 작업본 SHA·diff·기존 파일 hash와 설정 백업 44개 목록.
- [복원 readback](restoration.json): 실제 설정 변경 4개, 유효 경로 확인 6개, 보존 metadata 40개.
- [검사 결과](checks.json): 기존 hook 15개, 수동 검사 13개, 형식 검사.
- [수동 검사 patch](manual-checks.patch) · [소스 hash](source-manifest.json).
- [S02 커밋 확인](s02-commit.json): 독립 후보의 검증된 선택자 patch와 commit 내용 대조.
- [최종 보존 확인](final-verification.json): 기존 파일·Git 상태·archive hash 대조. 커밋 전 snapshot.
- [SHA256SUMS](SHA256SUMS): 이 폴더의 공개 자료 checksum. 자기 자신과 `private/`, `logs/` 제외.

`private/`는 복원 전 Git 설정과 wrapper 원문 백업이며 로컬에서만 보관한다.
`logs/`는 테스트 원문이다. 두 디렉터리는 `.gitignore`로 제외한다.
S01·S02의 checksum과 과거 결과를 수정하지 않고 S03 및 후속 커밋 사실을 별도로 기록한다.

복원은 각 대상 작업본에서 `git config --worktree --unset core.hooksPath`만 실행했다.
현재 네 작업본의 설치 전 경로는 모두 공통 `.git/hooks`이며 활성 원래 hook은 없었다.
공유 `extensions.worktreeConfig=true`, 나머지 설정, 기존 wrapper와 post-commit 기록은 보존했다.
기존 installer의 `removeHooks()`는 wrapper도 삭제하므로 실행하지 않았다.

기존 wrapper를 다시 연결하는 것은 task·branch 강제를 다시 활성화한다.
보존된 `harness-hooks.json`은 과거 설치 증거이며 현재 활성 상태를 뜻하지 않는다.
