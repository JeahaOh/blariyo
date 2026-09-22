#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage:
  apps/collector/ops/verify-write-db-readback.sh [source ...]

Required environment:
  COLLECTOR_DB_URL                 jdbc:postgresql://host:port/database
  COLLECTOR_DB_USER                collect DB user
  COLLECTOR_DB_PASSWORD            collect DB password
  COLLECTOR_SOURCE_CONFIG or COLLECTOR_SOURCES_FILE
  One object store backend:
    COLLECTOR_OBJECT_STORE_DIRECTORY
    or COLLECTOR_OBJECT_STORE_S3_ENDPOINT, COLLECTOR_OBJECT_STORE_S3_BUCKET,
       COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID, COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY

Optional:
  COLLECTOR_VERIFY_REPORT_DIR      default: /tmp/blariyo-collector-production-readback
  COLLECTOR_VERIFY_MAX_PAGES       default: 1
  COLLECTOR_VERIFY_MAX_ITEMS       default: 1
  COLLECTOR_VERIFY_SINCE           default: 24h
  COLLECTOR_VERIFY_INTERVAL_MS     default: 10000
USAGE
  exit 0
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "missing required env: ${name}" >&2
    exit 2
  fi
}

require_env COLLECTOR_DB_URL
require_env COLLECTOR_DB_USER
require_env COLLECTOR_DB_PASSWORD
if [[ -z "${COLLECTOR_SOURCE_CONFIG:-}" && -z "${COLLECTOR_SOURCES_FILE:-}" ]]; then
  echo "missing required env: COLLECTOR_SOURCE_CONFIG or COLLECTOR_SOURCES_FILE" >&2
  exit 2
fi
if [[ -z "${COLLECTOR_OBJECT_STORE_DIRECTORY:-}" ]]; then
  require_env COLLECTOR_OBJECT_STORE_S3_ENDPOINT
  require_env COLLECTOR_OBJECT_STORE_S3_BUCKET
  require_env COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID
  require_env COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY
fi

repo_root="$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)"
report_dir="${COLLECTOR_VERIFY_REPORT_DIR:-/tmp/blariyo-collector-production-readback}"
mkdir -p "$report_dir"
report="$report_dir/readback-$(date -u +%Y%m%dT%H%M%SZ).md"
jsonl="$report_dir/runs-$(date -u +%Y%m%dT%H%M%SZ).jsonl"
max_pages="${COLLECTOR_VERIFY_MAX_PAGES:-1}"
max_items="${COLLECTOR_VERIFY_MAX_ITEMS:-1}"
since="${COLLECTOR_VERIFY_SINCE:-24h}"
interval="${COLLECTOR_VERIFY_INTERVAL_MS:-10000}"
if [[ "$#" -gt 0 ]]; then sources=("$@"); else sources=(theqoo humoruniv todayhumor); fi

jdbc="${COLLECTOR_DB_URL#jdbc:}"
if [[ "$jdbc" != postgresql://* ]]; then
  echo "COLLECTOR_DB_URL must be jdbc:postgresql://..." >&2
  exit 2
fi

{
  echo "# Collector 운영 write-db readback"
  echo
  echo "생성일: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "비밀값은 이 파일에 기록하지 않는다."
  echo
  echo "| source | command state | run id | DB state | fetched | failures | report object |"
  echo "|---|---|---|---|---:|---:|---|"
} > "$report"

for source in "${sources[@]}"; do
  output="$($repo_root/bin/blariyo-collector batch --source "$source" --chart hot --max-pages "$max_pages" --max-items "$max_items" --since "$since" --interval-ms "$interval" --write-db || true)"
  printf '%s\n' "$output" >> "$jsonl"
  run_id="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("runId", ""))' <<< "$output")"
  state="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("report", {}).get("state", ""))' <<< "$output")"
  if [[ -z "$run_id" ]]; then
    echo "| ${source} | ${state:-NO_RUN_ID} |  |  | 0 | 1 |  |" >> "$report"
    continue
  fi
  row="$(PGPASSWORD="$COLLECTOR_DB_PASSWORD" psql "$jdbc" -U "$COLLECTOR_DB_USER" -v ON_ERROR_STOP=1 -A -F $'\t' -P pager=off -c "select state, checkpoint->>'fetched', coalesce((checkpoint->>'failures'),'0'), coalesce(report_object_key,'') from collect.batch_run where id='${run_id}'" | tail -n +2 | head -n 1)"
  db_state="$(cut -f1 <<< "$row")"
  fetched="$(cut -f2 <<< "$row")"
  failures="$(cut -f3 <<< "$row")"
  report_key="$(cut -f4 <<< "$row")"
  echo "| ${source} | ${state} | \`${run_id}\` | ${db_state} | ${fetched:-0} | ${failures:-0} | \`${report_key}\` |" >> "$report"
done

{
  echo
  echo "## DB item readback"
  echo
  echo '```text'
  PGPASSWORD="$COLLECTOR_DB_PASSWORD" psql "$jdbc" -U "$COLLECTOR_DB_USER" -v ON_ERROR_STOP=1 -P pager=off -c "select i.source_key, i.source_post_key, i.state, left(coalesce(i.title,''),80) title, jsonb_array_length(coalesce(i.body_blocks,'[]'::jsonb)) blocks, (select count(*) from collect.batch_media m where m.item_id=i.id) media_count, i.raw_object_key from collect.batch_item i where i.run_id in (select id from collect.batch_run order by started_at desc limit 20) order by i.fetched_at desc nulls last limit 20;"
  echo '```'
} >> "$report"

echo "$report"
echo "$jsonl"
