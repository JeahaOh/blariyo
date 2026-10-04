# 계약 검사 작업의 로컬 release 통합

- 담당: Codex (현재 세션)
- 작업 폴더: `/Volumes/MicroVault/iCloudDrive/git/private/blariyo`
- 작성 브랜치: `feature/contract-precommit-check`, 통합 대상: 로컬 `release`
- 상태: 종료 (아래 작업 커밋 4개 통합 완료)
- 갱신: 2026-10-04 15:07 KST
- 요청: 지금까지 작업한 내용을 로컬 release에 병합.
- 변경 경로: 이 기록만 추가. 다른 worktree·앱 코드·원격 브랜치는 변경하지 않는다.

## 실제 반영

- 병합 전 로컬 release와 `git ls-remote --heads origin release` 결과는 모두 `c0ffd5565cd384f8dc7ef30b446a24a12148e51d`였다.
- 기존 작업 폴더는 깨끗했고, 이 폴더의 앞선 작업은 같은 담당의 종료 상태였다. 별도 `blariyo-m0-core` worktree는 보존했다.
- `git merge --ff-only 7747a81b42c80053dadc12329c8dbc07846a8cba` 성공 후 release HEAD 일치를 확인했다. 충돌·추가 merge commit 없음.
- 포함한 작업: `0f8a37a` 계약 해시 누락 수정, `3e1a489` commit/merge 계약 검사, `e0f9f00` 브라우저 테스트 보완, `7747a81` FF 기본 규칙.
- release 직접 commit을 피하기 위해 동일 feature로 돌아와 이 결과 기록을 별도 commit한다. 이 기록 commit도 계약 검사 후 FF로 통합하며 최종 SHA는 Git 이력으로 확인한다.

## 검증과 경계

- 검증 후보: `7747a81b42c80053dadc12329c8dbc07846a8cba`의 깨끗한 index/HEAD.
- Node 24.18.0 `npm test`: 51/51 통과, 실패·skip 0. 테스트 중 Vue의 기존 `batchItemId` 미정의 경고가 있었으나 assertion 실패는 없었다.
- `npm run hooks:check` 및 설치된 `check-contracts.mjs` 검사 통과.
- FF 병합은 검증한 커밋 자체를 옮겼으며 충돌 해결이나 앱 변경을 추가하지 않았다. 후속 기록 commit은 문서만 추가한다.
- 앞선 전체 앱·DB·Collector·브라우저 테스트는 [원래 기록](../contract-precommit-check/README.md)을 따른다. 이번 병합에서 해당 전체 검사를 재실행한 것으로 표시하지 않는다.
- push·main 병합·GitHub Actions 재실행·배포는 수행하지 않았다.
