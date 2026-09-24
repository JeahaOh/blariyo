#!/bin/sh
set -eu

# Prefer a key beside this script; otherwise use the existing iCloud key.
ssh_script_dir=$(CDPATH= cd -P "$(dirname "$0")" && pwd)
ssh_key_name='LightsailDefaultKey-ap-northeast-2.pem'
ssh_key_file="$ssh_script_dir/$ssh_key_name"

if [ ! -f "$ssh_key_file" ]; then
    ssh_key_file="$HOME/Library/Mobile Documents/com~apple~CloudDocs/blariyo/$ssh_key_name"
fi

if [ ! -f "$ssh_key_file" ] || [ ! -r "$ssh_key_file" ]; then
    printf '%s\n' "SSH 키 파일을 찾거나 읽을 수 없습니다: $ssh_key_file" >&2
    printf '%s\n' "$ssh_key_name 파일을 이 스크립트와 같은 폴더에 놓아주세요." >&2
    exit 1
fi

exec ssh -o IdentitiesOnly=yes -i "$ssh_key_file" ubuntu@13.124.55.99
