# 로컬 FF 병합 기본값

- 담당: Codex (현재 세션)
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 브랜치: `feature/contract-precommit-check`
- 기준: `e0f9f00`, 작업 시작 시 변경 없음. 이전 계약 검사 작업 담당은 종료 상태.
- 상태: 종료
- 갱신: 2026-10-04 15:05 KST
- 요청: 작은 변경마다 추가되는 병합 커밋을 줄이도록 Git 규칙에 FF 병합 적용. 앞선 단위별 commit 요청에 따라 이번 규칙 변경도 별도 commit으로 분리한다.
- 변경 경로: `docs/ai/git-workflow.md`, `.githooks/guard.sh`, 이 기록. 제품·앱·기존 이력은 변경하지 않는다.

## 근거와 변경

- 기존 규칙의 로컬 `--no-ff`가 단일 변경에도 병합 커밋을 만들었다. 시작 시 release `c0ffd55`는 HEAD의 조상이며 현재 3개 commit은 FF 통합 가능한 관계다.
- 로컬 feature→release는 `--ff-only`를 기본으로 한다. 이력이 갈라지면 중단하고 원인·담당·변경을 확인한다. 필요한 실제 병합은 권한 범위에서 명시적으로 수행하고 검증한다.
- FF는 commit을 만들지 않아 pre-merge-commit 계약 검사가 실행되지 않는다. 깨끗한 후보 브랜치에서 설치된 계약 검사와 필요한 검증을 수행하고 SHA를 고정한 뒤 병합하는 절차를 문서화한다.
- main은 기존 GitHub 웹 PR의 Create a merge commit을 유지한다. 원본 SHA를 보존하는 순수 FF와 GitHub의 squash/rebase 병합은 같지 않다.
- 기존 공유 이력 재작성·실제 release 병합·push·원격 설정 변경은 범위 밖이다. Git 설정을 통한 강제 적용으로 보고하지 않는다.

## 검증

- Node 24.18.0에서 `npm run hooks:install`, `npm run hooks:check` 통과. 현재 clone 설치본의 안내도 갱신했다.
- `npm run test:git-hooks`: 16/16 통과, 실패·skip 0. 기존 commit·push 차단과 계약 검사 동작을 유지한다.
- `sh -n .githooks/guard.sh`, 문서 상대 링크 존재, `git diff --check` 통과. 변경은 위 3개 파일뿐이다.
- 이번 변경은 병합 규칙과 오류 안내이며 앱 코드는 그대로다. 앞선 전체 앱 테스트 결과를 새 SHA의 재실행 결과로 보고하지 않는다.
- 실제 병합·push는 수행하지 않는다. 이 변경은 별도 로컬 commit으로 기록하며 SHA는 Git 이력에서 확인한다.
