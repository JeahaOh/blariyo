# Git 자산·설치 hook 세부 목록

[issue 상세](README.md) · [원본 목록](inventory.json)

## 작업본

| 작업본 | branch | HEAD | 추적 수정 | 미추적 파일 | hook metadata |
| --- | --- | --- | ---: | ---: | --- |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo` | `develop` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` | 0 | 70 | 있음 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-ci-browser-review` | `feature/HARN-09-browser-retry` | `2b61c4ca038adea80069f0d020019199b4c1e53c` | 0 | 0 | 없음 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-git-governance` | `feature/HARN-06-git-governance-bootstrap` | `f376e3dd7a2a41d489d5e0e67b591d62fe151753` | 0 | 0 | 있음 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-governance-delivery` | `feature/HARN-07-release-fixture-clock` | `6a431358db73b9c59be4125fa0749beb014e7acd` | 0 | 0 | 있음 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-m0-core` | `feature/m0-core` | `a273f3c853fe0cf8260e3c7eb9daa2cfd1b02727` | 20 | 68 | 없음 |
| `/Volumes/MicroVault/iCloudDrive/git/private/blariyo-stash-recovery` | `feature/HARN-08-stash-recovery` | `5957492429b668377bede866c90f878b43225785` | 8 | 2 | 있음 |

미추적 수는 Git ignore 규칙을 적용한 파일 수다. 생성 디렉터리·ignored 경로는 JSON의 각 worktree `ignored` 필드에 별도로 기록했다. m0-core 작업본은 보존 대상이다.

## 설치 hook 16개 정적 확인

메타데이터 hash·실행 권한·활성 dispatcher 행·CLI/policy 파일 존재만 확인했다. hook을 실제 실행한 결과가 아니다.

| 작업본 | hook | hash 일치 | 실행 권한 | 활성 dispatcher | CLI/policy |
| --- | --- | --- | --- | --- | --- |
| `blariyo` | `pre-commit` | True | True | True | True/True |
| `blariyo` | `commit-msg` | True | True | True | True/True |
| `blariyo` | `post-commit` | True | True | True | True/True |
| `blariyo` | `pre-push` | True | True | True | True/True |
| `blariyo-git-governance` | `pre-commit` | True | True | True | True/True |
| `blariyo-git-governance` | `commit-msg` | True | True | True | True/True |
| `blariyo-git-governance` | `post-commit` | True | True | True | True/True |
| `blariyo-git-governance` | `pre-push` | True | True | True | True/True |
| `blariyo-governance-delivery` | `pre-commit` | True | True | True | True/True |
| `blariyo-governance-delivery` | `commit-msg` | True | True | True | True/True |
| `blariyo-governance-delivery` | `post-commit` | True | True | True | True/True |
| `blariyo-governance-delivery` | `pre-push` | True | True | True | True/True |
| `blariyo-stash-recovery` | `pre-commit` | True | True | True | True/True |
| `blariyo-stash-recovery` | `commit-msg` | True | True | True | True/True |
| `blariyo-stash-recovery` | `post-commit` | True | True | True | True/True |
| `blariyo-stash-recovery` | `pre-push` | True | True | True | True/True |

## 관련 ref

| ref | SHA |
| --- | --- |
| `refs/heads/develop` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` |
| `refs/heads/feature/HARN-06-git-governance-bootstrap` | `f376e3dd7a2a41d489d5e0e67b591d62fe151753` |
| `refs/heads/feature/HARN-06-governance-registration` | `ada24744af144b7a3d72df3e029e1845594dc33c` |
| `refs/heads/feature/HARN-07-release-fixture-clock` | `6a431358db73b9c59be4125fa0749beb014e7acd` |
| `refs/heads/feature/HARN-08-cleanup-review` | `a1a4802c75c0048345778ad11ae2af39b9315fd7` |
| `refs/heads/feature/HARN-08-harness-review` | `f782c0be80763f279cd11fb261bfc825cadf9b6d` |
| `refs/heads/feature/HARN-08-legacy-main-review` | `df7482704c7867712c12028d1a69e59bfd662acc` |
| `refs/heads/feature/HARN-08-policy-review` | `8a72c9ae3e09460718de61065810a95594cd891c` |
| `refs/heads/feature/HARN-08-stash-recovery` | `5957492429b668377bede866c90f878b43225785` |
| `refs/heads/feature/HARN-09-browser-retry` | `2b61c4ca038adea80069f0d020019199b4c1e53c` |
| `refs/heads/feature/HARN-09-ci-diagnostics` | `299ea62ab8eb3e00d4471fc82930137fc5026dc0` |
| `refs/heads/main` | `e51f1b501f7cc327da279102dd69eac2f4c554db` |
| `refs/heads/release` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` |
| `refs/remotes/fixprep/harness` | `85796f2667a7a9e0f220e7cefd1c025c33f86e2c` |
| `refs/remotes/origin/develop` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` |
| `refs/remotes/origin/feature/HARN-06-git-governance-bootstrap` | `f376e3dd7a2a41d489d5e0e67b591d62fe151753` |
| `refs/remotes/origin/feature/HARN-06-governance-registration` | `ada24744af144b7a3d72df3e029e1845594dc33c` |
| `refs/remotes/origin/feature/HARN-07-release-fixture-clock` | `6a431358db73b9c59be4125fa0749beb014e7acd` |
| `refs/remotes/origin/feature/HARN-08-cleanup-review` | `a1a4802c75c0048345778ad11ae2af39b9315fd7` |
| `refs/remotes/origin/feature/HARN-08-harness-review` | `f782c0be80763f279cd11fb261bfc825cadf9b6d` |
| `refs/remotes/origin/feature/HARN-08-legacy-main-review` | `df7482704c7867712c12028d1a69e59bfd662acc` |
| `refs/remotes/origin/feature/HARN-08-policy-review` | `8a72c9ae3e09460718de61065810a95594cd891c` |
| `refs/remotes/origin/feature/HARN-09-browser-retry` | `2b61c4ca038adea80069f0d020019199b4c1e53c` |
| `refs/remotes/origin/feature/HARN-09-ci-diagnostics` | `299ea62ab8eb3e00d4471fc82930137fc5026dc0` |
| `refs/remotes/origin/main` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` |
| `refs/remotes/origin/release` | `8af72449a7d56c9701efd0d73dc7d430a66f9610` |
| `refs/stash` | `c373dac4ad6584e663ad958d1c9d64767dc48605` |

remote-tracking ref는 로컬 캐시이며 실제 GitHub branch SHA는 JSON `remote.branches`를 우선한다. 현재 local origin/develop 캐시는 원격보다 오래됐다.

## stash-recovery 미커밋 파일

| 경로 | 종류 | SHA-256 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | dirtyTracked | `42c30c533706d93b0a81819918c03472bf26bb99e9e02555d94a9a96e459566c` |
| `docs/ai/git-workflow.md` | dirtyTracked | `1ecdafe2563b3f470a47b21a2f781921a1ab6edcb6e855adf715a516b6db3c20` |
| `docs/ai/harness-implementation-plan.md` | dirtyTracked | `1e0a8731dc77fd139ad4e3eddf2f252e158ad80e240e14a41cb596ac9dc64d66` |
| `docs/roadmap.md` | dirtyTracked | `6db241c54247dc65252dd4e038b90169254df170af38e5bbfc9ad74635ab17e3` |
| `docs/status.md` | dirtyTracked | `87e97b1c57e64ca54db5738552568211c0b42cd028639f0d9c98c36ba5db15b4` |
| `tests/browser/admin-workflow.test.ts` | dirtyTracked | `54f25844d1cfece69a92e0758ca10501736f554d05c30ea58652b475f9584d8b` |
| `tests/harness/ci-workflow.test.mjs` | dirtyTracked | `cb7717a38763c225cba3db4e082965f6c5f757a53573984b51cfe02eda0a7d98` |
| `worklog/2026-09-25/git-governance/STASH-RECOVERY.md` | dirtyTracked | `a0275d5aeb802d0ce00dfcc69efc19fc1e40fdd29d6e075f2a89ce272244348b` |
| `.harness/tasks/HARN-09.json` | untracked | `cc94d0114f1644210f05242b7e399d55abfac54caecbc43626ac89932924c9cc` |
| `worklog/2026-09-25/git-governance/CI-RECOVERY.md` | untracked | `b233f9a2c04b897a42aac71a54c95aef3b5b40aa9c9addad229163e07e93e790` |

## Git 내부 설치·생성 자료

각 경로의 hash·wrapper 목록·하위 항목은 JSON에 있다. quality 도구 캐시는 lint를 남길 경우 함께 남길 수 있다.

- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/config.worktree` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/harness-hooks` (directory)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/harness-hooks.json` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/harness-post-commit.jsonl` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/quality-tools` (directory)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/quality-venv` (directory)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-ci-browser-review/config.worktree` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-git-governance/config.worktree` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-git-governance/harness-hooks` (directory)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-git-governance/harness-hooks.json` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-git-governance/harness-post-commit.jsonl` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-governance-delivery/config.worktree` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-governance-delivery/harness-hooks` (directory)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-governance-delivery/harness-hooks.json` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-governance-delivery/harness-post-commit.jsonl` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-stash-recovery/config.worktree` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-stash-recovery/harness-hooks` (directory)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-stash-recovery/harness-hooks.json` (file)
- `/Volumes/MicroVault/iCloudDrive/git/private/blariyo/.git/worktrees/blariyo-stash-recovery/harness-post-commit.jsonl` (file)
