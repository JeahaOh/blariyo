# develop 초기 기준 결정 — 2026-09-25

## 결정

- 사용자는 `origin/main`의 운영 production SHA를 초기 `develop` 기준으로 선택했다.
- 선택 당시 SHA: `8af72449a7d56c9701efd0d73dc7d430a66f9610`.
- local `develop` ref를 해당 commit에 생성했다. 현재 local `main`의 8개 추가 commit은 포함하지 않는다.
- `.harness/policy.json`의 `developBootstrapSha`가 선택한 SHA를 고정한다. `start`는 local `develop`이 그 commit의 후손인지 검사하고, local `develop`과 `origin/develop`이 존재하며 같은 SHA인지 확인한다.

## 남은 원격 단계

- `origin/develop`은 아직 없고 push하지 않았다. 따라서 task worktree 생성은 원격 ref가 준비될 때까지 차단된다.
- GitHub ruleset 목록은 이전 공개 API 조회에서 비어 있었고 classic branch protection은 인증이 없어 확인하지 못했다. 원격 branch 및 보호 규칙 설정은 미적용이다.
- 당시 lint baseline candidate 1,651건은 사용자 지시에 따라 검토 전 gate 차단을 유지했다. 이후 전체 SQL lint 정리 작업에서 migration 434건과 deploy SQL 28건을 포함한 SQL finding을 0건으로 수정했다. 현재 candidate는 0건이며 local `lint:all` 통과를 재검증했다. 초기 수치는 당시 기록으로 보존한다.

## 보존 경계

- `feature/m0-core` 별도 worktree의 변경은 손대지 않았다.
- 이 결정 기록은 당시 inventory를 소급 수정하지 않고 선택 이후의 결과를 별도로 남긴다.
