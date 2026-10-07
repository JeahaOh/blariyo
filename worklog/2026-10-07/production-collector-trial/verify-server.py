"""Read back only this trial and emit non-secret evidence."""
import json,pathlib,subprocess,uuid
p=pathlib.Path('/opt/blariyo/operations/collector-trial-20261007')
result=json.loads((p/'result.json').read_text())
assert result['state']=='FINISHED' and result['report']
run=str(uuid.UUID(result['report']['runId']))
base=['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
def q(sql):
 r=subprocess.run(base,input=sql,text=True,capture_output=True,timeout=30)
 assert r.returncode==0,'READBACK_FAILED'
 return json.loads(r.stdout)
readback=q(f"""SELECT json_build_object(
'run',(SELECT row_to_json(r) FROM (SELECT id,source_key,state,started_at,finished_at,interval_ms,checkpoint FROM collect.batch_run WHERE id='{run}') r),
'items',(SELECT coalesce(json_agg(i),'[]'::json) FROM (SELECT id,state,fetched_at,raw_object_key FROM collect.batch_item WHERE run_id='{run}') i),
'media',(SELECT coalesce(json_agg(m),'[]'::json) FROM (SELECT m.object_key,encode(m.sha256,'hex') sha256,m.byte_size,m.mime_type FROM collect.batch_media m JOIN collect.batch_item i ON i.id=m.item_id WHERE i.run_id='{run}') m),
'failures',(SELECT count(*) FROM collect.batch_failure WHERE run_id='{run}'),
'collectionCounts',(SELECT json_build_object('items',(SELECT count(*) FROM collect.batch_item),'media',(SELECT count(*) FROM collect.batch_media),'runs',(SELECT count(*) FROM collect.batch_run))),
'cleanupPending',(SELECT count(*) FROM collect.batch_image_cleanup WHERE completed_at IS NULL),
'backupNewTablesReadable',has_table_privilege('blariyo_backup','collect.batch_image_retry','SELECT') AND has_table_privilege('blariyo_backup','collect.batch_manual_cleanup','SELECT'),
'schemaVersions',(SELECT json_agg(version ORDER BY version) FROM collector.schema_migration))""")
metrics=[json.loads(s) for s in (p/'metrics.jsonl').read_text().splitlines()]
out={'result':result,'readback':readback,'metrics':metrics,'manifest':json.loads((p/'manifest.json').read_text()),'backup':json.loads((p/'backup.json').read_text()),'beforeCounts':json.loads((p/'before-counts.json').read_text())}
(p/'evidence.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
