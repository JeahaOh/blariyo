"""Read structured logs and selected non-secret configuration/DB evidence only."""
import json, socket, subprocess
from pathlib import Path

assert socket.gethostname() == 'ip-172-26-1-91'
root = Path('/opt/blariyo/collector')
records = []
for path in sorted((root / 'logs').glob('run-*.json')):
    record = json.loads(path.read_text())
    if '2026-10-09T19:30:' in record.get('startedAt', ''):
        records.append({'file': path.name, **{k: record.get(k) for k in ['startedAt', 'finishedAt', 'state', 'sources']}})
print(json.dumps({'execution': records}, ensure_ascii=False))
config = json.loads((root / 'sources.json').read_text())
safe = {}
for source in ['clien', 'dmitory', 'dogdrip', 'fmkorea', 'ppomppu', 'youtube-community']:
    safe[source] = {key: config[source].get(key) for key in ['host', 'hostAliases', 'pathPrefixes', 'charts', 'approved', 'blockedReason', 'collectionPolicy', 'enabled', 'chartVerified']}
print(json.dumps({'config': safe}, ensure_ascii=False))
sql = """
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT json_build_object('runs', COALESCE(json_agg(x), '[]'::json)) FROM (
 SELECT r.source_key,r.id,r.state,r.started_at,r.finished_at,r.checkpoint,
  (SELECT json_agg(json_build_object('phase',f.phase,'code',f.code,'detailKeys',
    ARRAY(SELECT jsonb_object_keys(f.detail)))) FROM collect.batch_failure f WHERE f.run_id=r.id) AS failures
 FROM collect.batch_run r
 WHERE r.started_at >= '2026-10-09T19:30:00Z' AND r.started_at < '2026-10-09T20:13:00Z'
 ORDER BY r.started_at
) x;
SELECT json_build_object('settings', json_agg(x)) FROM (
 SELECT source_key,source_url,collection_enabled,collection_available,blocked_reason
 FROM collect.batch_source_collection_setting ORDER BY source_key
) x;
COMMIT;
"""
result = subprocess.run(['docker', 'exec', '-i', '--user', 'postgres', 'blariyo-db-postgresql-1',
                         'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', 'blariyo'],
                        input=sql, capture_output=True, text=True, timeout=25)
if result.returncode:
    raise RuntimeError('READ_ONLY_DB_QUERY_FAILED')
print(result.stdout)
