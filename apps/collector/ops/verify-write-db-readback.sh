#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage:
  apps/collector/ops/verify-write-db-readback.sh [source ...]
  apps/collector/ops/verify-write-db-readback.sh --manifest apps/collector/ops/production-readback-sample.json

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
  COLLECTOR_VERIFY_MANIFEST        manifest path when --manifest is omitted
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
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
report="$report_dir/readback-$stamp.md"
jsonl="$report_dir/runs-$stamp.jsonl"
max_pages="${COLLECTOR_VERIFY_MAX_PAGES:-1}"
max_items="${COLLECTOR_VERIFY_MAX_ITEMS:-1}"
since="${COLLECTOR_VERIFY_SINCE:-24h}"
interval="${COLLECTOR_VERIFY_INTERVAL_MS:-10000}"
manifest="${COLLECTOR_VERIFY_MANIFEST:-}"

if [[ "${1:-}" == "--manifest" ]]; then
  if [[ -z "${2:-}" || "$#" -ne 2 ]]; then
    echo "usage: $0 --manifest /path/to/manifest.json" >&2
    exit 2
  fi
  manifest="$2"
elif [[ -z "$manifest" ]]; then
  if [[ "$#" -gt 0 ]]; then sources=("$@"); else sources=(theqoo humoruniv todayhumor); fi
fi

if [[ -n "$manifest" ]]; then
  if [[ ! -f "$manifest" ]]; then
    echo "manifest not found: $manifest" >&2
    exit 2
  fi
  mapfile -t operations < <(python3 - "$manifest" <<'PY'
import json, sys
from pathlib import Path
rows = json.loads(Path(sys.argv[1]).read_text())
if not isinstance(rows, list):
    raise SystemExit('manifest must be a JSON array')
for row in rows:
    kind = row.get('kind')
    source = row.get('source')
    if kind not in {'batch', 'collect-url'} or not source:
        raise SystemExit('manifest row requires kind=batch|collect-url and source')
    if kind == 'batch':
        print('\t'.join([
            'batch', source, row.get('chart', 'hot'), str(row.get('maxPages', '')), str(row.get('maxItems', '')),
            row.get('since', ''), str(row.get('intervalMs', '')), ''
        ]))
    else:
        url = row.get('url')
        if not url:
            raise SystemExit('collect-url row requires url')
        print('\t'.join(['collect-url', source, '', '', '', '', str(row.get('intervalMs', '')), url]))
PY
  )
else
  operations=()
  for source in "${sources[@]}"; do
    operations+=("batch	${source}	hot	${max_pages}	${max_items}	${since}	${interval}	")
  done
fi

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
  echo "| source/command | command state | run id | DB state | fetched | failures | report object |"
  echo "|---|---|---|---|---:|---:|---|"
} > "$report"

for operation in "${operations[@]}"; do
  IFS=$'\t' read -r kind source row_chart row_max_pages row_max_items row_since row_interval row_url <<< "$operation"
  if [[ "$kind" == "batch" ]]; then
    command_label="batch:${row_chart:-hot}"
    output="$($repo_root/bin/blariyo-collector batch --source "$source" --chart "${row_chart:-hot}" --max-pages "${row_max_pages:-$max_pages}" --max-items "${row_max_items:-$max_items}" --since "${row_since:-$since}" --interval-ms "${row_interval:-$interval}" --write-db || true)"
  else
    command_label="collect-url"
    output="$($repo_root/bin/blariyo-collector collect-url --source "$source" --url "$row_url" --interval-ms "${row_interval:-$interval}" --write-db || true)"
  fi
  printf '%s\n' "$output" >> "$jsonl"
  run_id="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("runId", ""))' <<< "$output")"
  state="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("report", {}).get("state", ""))' <<< "$output")"
  if [[ -z "$run_id" ]]; then
    echo "| ${source} ${command_label} | ${state:-NO_RUN_ID} |  |  | 0 | 1 |  |" >> "$report"
    continue
  fi
  row="$(PGPASSWORD="$COLLECTOR_DB_PASSWORD" psql "$jdbc" -U "$COLLECTOR_DB_USER" -v ON_ERROR_STOP=1 -A -F $'\t' -P pager=off -c "select state, checkpoint->>'fetched', coalesce((checkpoint->>'failures'),'0'), coalesce(report_object_key,'') from collect.batch_run where id='${run_id}'" | tail -n +2 | head -n 1)"
  db_state="$(cut -f1 <<< "$row")"
  fetched="$(cut -f2 <<< "$row")"
  failures="$(cut -f3 <<< "$row")"
  report_key="$(cut -f4 <<< "$row")"
  echo "| ${source} ${command_label} | ${state} | \`${run_id}\` | ${db_state} | ${fetched:-0} | ${failures:-0} | \`${report_key}\` |" >> "$report"
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
