# Branch guards require POSIX sh and Git; contract checks also require Node.js.
guard_contracts() {
    # No npm dependencies or TS loader: this works with the Node on Git's PATH.
    if ! command -v node >/dev/null 2>&1; then
        guard_deny '계약 검사에 Node.js가 필요합니다. Git 실행 환경의 PATH를 확인하세요.'
    fi
    node "$(dirname "$0")/check-contracts.mjs"
}

guard_deny() {
    printf '%s\n' "[git-guard] $*" >&2
    exit 1
}

guard_commit() {
    guard_branch=$(git symbolic-ref --quiet --short HEAD || :)
    case "$guard_branch" in
        main)
            guard_deny 'main 직접 commit은 금지합니다. release/hotfix PR을 GitHub 웹에서 병합하세요.'
            ;;
        release)
            if ! test -f "$(git rev-parse --git-path MERGE_HEAD)"; then
                guard_deny 'release 일반 commit은 금지합니다. feature에서 작성한 뒤 merge --no-ff로 통합하세요.'
            fi
            ;;
    esac
}

guard_merge() {
    guard_branch=$(git symbolic-ref --quiet --short HEAD || :)
    if test "$guard_branch" = main; then
        guard_deny 'main 로컬 merge commit은 금지합니다. GitHub 웹 PR로 병합하세요.'
    fi
}

guard_zero_oid() {
    case "$1" in
        ''|*[!0]*) return 1 ;;
        *) return 0 ;;
    esac
}

guard_push() {
    # Inspect the destination refs supplied by Git, including HEAD:main,
    # alternate remotes, deletions, and multi-ref pushes.
    while read -r guard_local_ref guard_local_oid guard_remote_ref guard_remote_oid guard_extra; do
        if test -z "$guard_local_ref" || test -z "$guard_local_oid" ||
           test -z "$guard_remote_ref" || test -z "$guard_remote_oid" || test -n "$guard_extra"; then
            guard_deny 'push 대상 정보를 해석할 수 없습니다. Git 상태를 확인하세요.'
        fi
        case "$guard_remote_ref" in
            refs/heads/main)
                guard_deny '원격 main으로의 모든 git push(생성·수정·삭제)는 금지합니다. GitHub 웹 PR로 병합하세요.'
                ;;
            refs/heads/release)
                if guard_zero_oid "$guard_local_oid"; then
                    guard_deny '원격 release 삭제는 금지합니다.'
                fi
                # A new release has no old history to preserve.
                if guard_zero_oid "$guard_remote_oid"; then
                    continue
                fi
                if ! git cat-file -e "$guard_remote_oid^{commit}" 2>/dev/null; then
                    guard_deny '원격 release 기준 커밋이 로컬에 없습니다. 해당 원격을 fetch하고 통합 상태를 확인하세요.'
                fi
                if ! git merge-base --is-ancestor "$guard_remote_oid" "$guard_local_oid"; then
                    guard_deny 'release 이력을 덮어쓰는 push는 금지합니다. 원격 변경을 fetch·병합한 뒤 다시 확인하세요.'
                fi
                ;;
        esac
    done
}
