# 브랜치 전환 사전 inventory

- 확인 시각: 2026-09-25 KST
- 확인 방법: read-only Git refs·worktree·remote 조회
- 실행 결과: branch 생성·전환·삭제·merge·push 없음
- 보호 원칙: owner가 확인되지 않은 branch와 미커밋·untracked 파일은 모두 그대로 둔다.

## 기준선 후보

| 항목 | 확인값 |
| --- | --- |
| 운영 배포 기준 | `origin/main` = `8af72449a7d56c9701efd0d73dc7d430a66f9610` (`git ls-remote` 결과와 기존 운영 배포 기록 일치) |
| 현재 local `main` | `e51f1b501f7cc327da279102dd69eac2f4c554db`, `origin/main`보다 8 commits 앞섬 |
| 원격 `develop` | 없음 |
| 현재 정책이 원하는 `develop` 초기 SHA | 미결정. `origin/main`으로 두면 local-only 8 commits는 develop에서 빠지고, local `main`으로 두면 아직 운영되지 않은 변경을 통합 기준선에 포함함 |
| Branch owner | Git 설정·branch 이름만으로 확인 불가. `office`, `planning-design-only`, `feature/m0-core`의 담당자 미확인 |

## Refs

| Ref | SHA | upstream / 차이 | 비고 |
| --- | --- | --- | --- |
| `main` | `e51f1b501f7cc327da279102dd69eac2f4c554db` | `origin/main`, 8 commits ahead | analytics/admin 및 설계·worklog 변경 포함 |
| `origin/main` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` | 원격 main | 확인된 운영 배포 SHA |
| `feature/m0-core` | `a273f3c853fe0cf8260e3c7eb9daa2cfd1b02727` | `origin/feature/m0-core`, 동일 SHA | 두 번째 worktree에 20 modified·68 untracked |
| `origin/feature/m0-core-web` | `c48f0845133cafea1c046eb26bec7e040d781ca6` | local branch 없음 | checkout/worktree 없음 |
| `office` | `0dde53881c85629f62bbceade5408ec6177a0e8c` | upstream 없음 | owner와 용도 미확인 |
| `planning-design-only` | `3e8935b6541e204a7bf2a1a4b3d68c5c0d5d8854` | `origin/planning-design-only`, 1 commit ahead | owner 확인 필요 |
| `origin/planning-design-only` | `0ade2e4815e74af68d337f73bd10877da28cce2f` | remote-only commit 없음 | remote counterpart |

`main`의 local-only commits는 `4605399`, `f920954`, `945b746`, `21b8828`, `8389eee`, `62f6fe5`, `6e05314`, `e51f1b5`이다. `planning-design-only`의 local-only commit은 `3e8935b`이다. SHA 약식은 해당 시점의 `git log origin/<branch>..<branch>` 결과다.

## Worktree·미커밋 상태

| 경로 | Branch / HEAD | 상태 | 처리 |
| --- | --- | --- | --- |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` | `main` / `e51f1b501f7cc327da279102dd69eac2f4c554db` | 30 modified·44 untracked. governance 구현, 제품·CI·문서 작업이 함께 존재; 개별 소유자 미확인. untracked에는 이 inventory와 이번 lease 구현이 포함됨 | 아무것도 stage·commit·reset하지 않음 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-m0-core` | `feature/m0-core` / `a273f3c853fe0cf8260e3c7eb9daa2cfd1b02727` | 20 modified·68 untracked; Collector·API·DB·문서 작업 | worktree·파일 모두 보존 |

## 결론과 미결정

- 운영 SHA와 remote `main`은 일치하지만, local `main`에는 미배포 8 commits가 있다. 이 8 commits를 `develop`에 포함할지 제외할지 선택해야 한다.
- `office`, `planning-design-only`, `feature/m0-core`, `origin/feature/m0-core-web`의 owner/보존·종료 의도를 확인해야 한다.
- branch 수와 dirty worktree를 고려하면 자동 `develop` 생성, branch 이동·삭제·재작성은 안전한 기본 동작이 아니다. 기준 SHA와 각 ref의 처리 방침이 정해지기 전까지 HARN-02 `start`와 실제 branch 전환은 BLOCKED다.
- 이번 조회는 inventory만 기록한다. 위 미결정 사항을 승인된 결정으로 간주하지 않는다.
