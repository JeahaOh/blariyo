#!/usr/bin/env bash
set -u

usage() {
  cat <<'USAGE'
Usage:
  scripts/local/vpn-latency-test.sh [--label vpn-on|vpn-off|name] [--runs N] [--out-dir DIR] [--no-codex]

Examples:
  scripts/local/vpn-latency-test.sh --label vpn-off --runs 3
  scripts/local/vpn-latency-test.sh --label vpn-on --runs 3
  scripts/local/vpn-latency-test.sh --label fixed-ip-vpn --runs 5 --out-dir .tmp/vpn-tests

What it records:
  - One directory per test run.
  - summary.tsv with elapsed time and HTTP timings.
  - command/*.log files with raw command output.
  - env.txt with local network context, without secrets.
  - codex exec "1+1" latency when the codex CLI is available.

Notes:
  - This script does not change the repository, server, or Git remote.
  - It uses read-only network checks where possible.
  - The codex check measures local Codex CLI round-trip time, not this chat UI rendering time.
USAGE
}

LABEL="manual"
RUNS=3
OUT_DIR=".tmp/vpn-tests"
MEASURE_CODEX=1
CODEX_PROMPT='Answer with only the number: 1+1'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)
      [[ $# -ge 2 ]] || { echo "missing value for --label" >&2; exit 2; }
      LABEL="$2"
      shift 2
      ;;
    --runs)
      [[ $# -ge 2 ]] || { echo "missing value for --runs" >&2; exit 2; }
      RUNS="$2"
      shift 2
      ;;
    --out-dir)
      [[ $# -ge 2 ]] || { echo "missing value for --out-dir" >&2; exit 2; }
      OUT_DIR="$2"
      shift 2
      ;;
    --no-codex)
      MEASURE_CODEX=0
      shift
      ;;
    --codex-prompt)
      [[ $# -ge 2 ]] || { echo "missing value for --codex-prompt" >&2; exit 2; }
      CODEX_PROMPT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$RUNS" in
  ''|*[!0-9]*)
    echo "--runs must be a positive integer" >&2
    exit 2
    ;;
esac

if [[ "$RUNS" -lt 1 ]]; then
  echo "--runs must be a positive integer" >&2
  exit 2
fi

safe_label="$(printf '%s' "$LABEL" | tr -cs '[:alnum:]_.-' '-')"
started_at="$(date '+%Y%m%d-%H%M%S')"
run_dir="${OUT_DIR}/run-${started_at}-${safe_label}"
command_dir="${run_dir}/command"
mkdir -p "$command_dir"

summary_file="${run_dir}/summary.tsv"
env_file="${run_dir}/env.txt"

write_env() {
  {
    echo "label=${LABEL}"
    echo "started_at=$(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "hostname=$(hostname 2>/dev/null || true)"
    echo "system=$(uname -a 2>/dev/null || true)"
    echo "cwd=$(pwd)"
    echo
    echo "[interfaces]"
    if command -v scutil >/dev/null 2>&1; then
      scutil --nwi 2>/dev/null || true
    elif command -v ip >/dev/null 2>&1; then
      ip route 2>/dev/null || true
    elif command -v route >/dev/null 2>&1; then
      route -n get default 2>/dev/null || true
    fi
    echo
    echo "[public-ip]"
    curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true
    echo
  } > "$env_file"
}

now_ns() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import time
print(time.monotonic_ns())
PY
  else
    date '+%s000000000'
  fi
}

elapsed_ms() {
  local start_ns="$1"
  local end_ns="$2"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$start_ns" "$end_ns" <<'PY'
import sys
start = int(sys.argv[1])
end = int(sys.argv[2])
print(int((end - start) / 1_000_000))
PY
  else
    echo 0
  fi
}

record_cmd() {
  local seq="$1"
  local name="$2"
  shift 2

  local log_file="${command_dir}/${seq}-${name}.log"
  local start_ns end_ns ms status
  start_ns="$(now_ns)"
  "$@" > "$log_file" 2>&1
  status=$?
  end_ns="$(now_ns)"
  ms="$(elapsed_ms "$start_ns" "$end_ns")"
  printf 'cmd\t%s\t%s\t%s\t%s\t\t\t\t\t\t\t%s\n' "$seq" "$name" "$status" "$ms" "$log_file" >> "$summary_file"
}

record_curl() {
  local seq="$1"
  local name="$2"
  local url="$3"
  local log_file="${command_dir}/${seq}-${name}.log"
  local metrics status total connect tls starttransfer remote_ip http_code

  metrics="$(
    curl -L -o /dev/null -sS \
      --max-time 20 \
      -w 'http_code=%{http_code}\nremote_ip=%{remote_ip}\ntime_namelookup=%{time_namelookup}\ntime_connect=%{time_connect}\ntime_appconnect=%{time_appconnect}\ntime_starttransfer=%{time_starttransfer}\ntime_total=%{time_total}\n' \
      "$url" 2>"$log_file"
  )"
  status=$?
  {
    echo "url=${url}"
    echo "curl_status=${status}"
    printf '%s\n' "$metrics"
  } >> "$log_file"

  http_code="$(printf '%s\n' "$metrics" | awk -F= '$1=="http_code"{print $2}')"
  remote_ip="$(printf '%s\n' "$metrics" | awk -F= '$1=="remote_ip"{print $2}')"
  connect="$(printf '%s\n' "$metrics" | awk -F= '$1=="time_connect"{print $2}')"
  tls="$(printf '%s\n' "$metrics" | awk -F= '$1=="time_appconnect"{print $2}')"
  starttransfer="$(printf '%s\n' "$metrics" | awk -F= '$1=="time_starttransfer"{print $2}')"
  total="$(printf '%s\n' "$metrics" | awk -F= '$1=="time_total"{print $2}')"

  printf 'curl\t%s\t%s\t%s\t\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$seq" "$name" "$status" "$http_code" "$remote_ip" "$connect" "$tls" "$starttransfer" "$total" "$log_file" >> "$summary_file"
}

record_codex() {
  local seq="$1"
  local log_file="${command_dir}/${seq}-codex-1plus1.log"
  local answer_file="${command_dir}/${seq}-codex-1plus1.answer.txt"
  local start_ns end_ns ms status answer

  if ! command -v codex >/dev/null 2>&1; then
    echo "codex command not found" > "$log_file"
    printf 'codex\t%s\tcodex-1plus1\t127\t0\t\t\t\t\t\t\t%s\n' "$seq" "$log_file" >> "$summary_file"
    return
  fi

  start_ns="$(now_ns)"
  codex --no-daemon exec \
    --ephemeral \
    --ignore-rules \
    --skip-git-repo-check \
    --output-last-message "$answer_file" \
    "$CODEX_PROMPT" > "$log_file" 2>&1
  status=$?
  end_ns="$(now_ns)"
  ms="$(elapsed_ms "$start_ns" "$end_ns")"

  answer=""
  if [[ -f "$answer_file" ]]; then
    answer="$(tr '\n\t' '  ' < "$answer_file" | sed 's/[[:space:]][[:space:]]*/ /g' | cut -c 1-80)"
  fi

  {
    echo
    echo "[codex-test]"
    echo "prompt=${CODEX_PROMPT}"
    echo "status=${status}"
    echo "elapsed_ms=${ms}"
    echo "answer=${answer}"
  } >> "$log_file"

  printf 'codex\t%s\tcodex-1plus1\t%s\t%s\t\t\t\t\t\t\t%s\n' "$seq" "$status" "$ms" "$log_file" >> "$summary_file"
}

write_env

{
  printf 'type\tseq\tname\tstatus\telapsed_ms\thttp_code\tremote_ip\tconnect_s\ttls_s\tstarttransfer_s\ttotal_s\tlog_file\n'
} > "$summary_file"

echo "VPN latency test started"
echo "label: ${LABEL}"
echo "runs: ${RUNS}"
echo "output: ${run_dir}"

for ((i = 1; i <= RUNS; i += 1)); do
  printf 'run %d/%d\n' "$i" "$RUNS"

  record_cmd "$i" "local-git-status" git status --short --branch

  if command -v ping >/dev/null 2>&1; then
    record_cmd "$i" "ping-cloudflare-dns" ping -c 5 1.1.1.1
    record_cmd "$i" "ping-google-dns" ping -c 5 8.8.8.8
  fi

  record_curl "$i" "github" "https://github.com/"
  record_curl "$i" "github-api" "https://api.github.com/rate_limit"
  record_curl "$i" "openai" "https://openai.com/"

  record_cmd "$i" "git-ls-remote-main" git ls-remote --heads origin main

  if [[ "$MEASURE_CODEX" -eq 1 ]]; then
    record_codex "$i"
  fi
done

echo
echo "summary: ${summary_file}"
echo "environment: ${env_file}"
echo "raw logs: ${command_dir}"
