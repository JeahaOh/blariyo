# S01-A 복원 명령

원본 worktree·ref·hook을 덮어쓰지 않는 **새 격리 디렉터리**용 명령이다. 아래 명령은 복구 절차이며 원본 저장소에 실행한 원복 기록이 아니다. 실제 수행한 검사는 [검증](verification.json)과 [작업본 복원](restore-readback.json)을 따른다.

## 1. archive 무결성

```sh
S01_ARCHIVE='/Volumes/MicroVault/iCloudDrive/git/private/blariyo/worklog/2026-09-25/git-governance/archive/2026-09-26-s01-a-backup-145815'
(cd "$S01_ARCHIVE" && shasum -a 256 -c SHA256SUMS)
```

다른 위치로 복사했다면 `S01_ARCHIVE`만 실제 경로로 바꾼다. `private/`까지 보존해야 복원할 수 있다.

## 2. 전체 ref·stash·commit/blob 읽기

```sh
S01_OBJECTS="$(mktemp -d /private/tmp/blariyo-s01-objects-XXXXXX)"
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git init --bare "$S01_OBJECTS"
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$S01_OBJECTS" bundle verify "$S01_ARCHIVE/private/git-assets.bundle"
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$S01_OBJECTS" fetch --no-tags "$S01_ARCHIVE/private/git-assets.bundle" '+refs/*:refs/*'
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$S01_OBJECTS" fsck --full --strict --no-reflogs
git -C "$S01_OBJECTS" show -s --format='%H %P' refs/stash
git -C "$S01_OBJECTS" cat-file -t refs/remotes/fixprep/harness
```

- stash: `c373dac4ad6584e663ad958d1c9d64767dc48605`.
- stash 부모: `e51f1b501f7cc327da279102dd69eac2f4c554db`, `3717cc55313ad7d1215691dc1593c6d3fd5889c9`.
- `refs/s01/remote/heads/develop`: `1ad626c92dd418f31827d17ccbb9f3580f58447f`.
- `refs/heads/develop`: 당시 로컬 `8af72449a7d56c9701efd0d73dc7d430a66f9610`.
- HTML 원본/변형본은 [fixtures.json](fixtures.json)의 blob ID로 `git cat-file blob <ID>`하여 읽거나, 대응하는 `private/fixtures/` 파일을 사용한다.

## 3. 미커밋 작업본 복원 예시 — stash-recovery

```sh
S01_WORKTREE='blariyo-stash-recovery'
S01_HEAD='5957492429b668377bede866c90f878b43225785'
S01_RECOVERY="$(mktemp -d /private/tmp/blariyo-s01-working-XXXXXX)"
S01_FILES="$S01_ARCHIVE/private/worktrees/$S01_WORKTREE"
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git init "$S01_RECOVERY"
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$S01_RECOVERY" fetch --no-tags "$S01_ARCHIVE/private/git-assets.bundle" '+refs/heads/*:refs/remotes/s01/*'
env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git -C "$S01_RECOVERY" -c core.hooksPath=/dev/null checkout --detach "$S01_HEAD"
if [ -s "$S01_FILES/staged.patch" ]; then
  git -C "$S01_RECOVERY" apply --index "$S01_FILES/staged.patch"
fi
if [ -s "$S01_FILES/unstaged.patch" ]; then
  git -C "$S01_RECOVERY" apply "$S01_FILES/unstaged.patch"
fi
cp -pR "$S01_FILES/files/." "$S01_RECOVERY/"
git -C "$S01_RECOVERY" status --short --branch
```

기본 작업본은 `S01_WORKTREE=blariyo`, `S01_HEAD=8af72449a7d56c9701efd0d73dc7d430a66f9610`을 사용한다. m0-core는 `S01_WORKTREE=blariyo-m0-core`, `S01_HEAD=a273f3c853fe0cf8260e3c7eb9daa2cfd1b02727`을 사용한다. 세 작업본 모두 위와 같은 독립 복원 방식으로 status·staged/unstaged diff·index 항목 일치를 검증했다.

`private/git-admin/`의 config·index·worktree 포인터·hook은 원본 경로에 연결된 보존 자료다. 새 clone의 `.git`에 일괄 덮어쓰지 않는다. S03은 `harness-hooks.json`의 설치 전 위치와 실제 wrapper·설정 원본을 대조한 뒤 자기 범위에서 복원 여부를 결정한다.
