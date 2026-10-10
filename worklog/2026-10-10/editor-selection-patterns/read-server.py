"""Read-only publication/explicit review evidence; no actor IDs or raw request bodies."""
import socket, subprocess

assert socket.gethostname() == 'ip-172-26-1-91'
sql = """
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT json_build_object('postSummary',COALESCE(json_agg(x),'[]'::json)) FROM (
 SELECT status,count(*) AS count,min(published_at) AS first_published,max(published_at) AS last_published
 FROM content.board_post GROUP BY status ORDER BY status
) x;
SELECT json_build_object('commandSummary',COALESCE(json_agg(x),'[]'::json)) FROM (
 SELECT origin,action,stage,count(*) AS count,count(DISTINCT operator_id) AS operator_count,
 min(created_at) AS first_decision,max(created_at) AS last_decision
 FROM collect.batch_review_command GROUP BY origin,action,stage ORDER BY origin,action,stage
) x;
SELECT json_build_object('publishedSources',COALESCE(json_agg(x),'[]'::json)) FROM (
 SELECT COALESCE(p.source_name,'(none)') AS source_name,COALESCE(c.origin,'LEGACY_OR_IMPORTED') AS origin,count(*) AS count
 FROM content.board_post p LEFT JOIN LATERAL (
  SELECT origin FROM collect.batch_review_command WHERE post_id=p.id AND action='APPROVE_PUBLISH'
  ORDER BY created_at DESC LIMIT 1
 ) c ON true WHERE p.status='PUBLISHED'
 GROUP BY p.source_name,c.origin ORDER BY count(*) DESC
) x;
SELECT json_build_object('publishedPosts',COALESCE(json_agg(x),'[]'::json)) FROM (
 SELECT p.id,p.title,p.source_name,p.published_at,COALESCE(c.origin,'LEGACY_OR_IMPORTED') AS origin,
 (SELECT count(*) FROM content.board_post_block b WHERE b.post_id=p.id AND b.type='IMAGE') AS images,
 (SELECT count(*) FROM content.board_post_block b WHERE b.post_id=p.id AND b.type='TEXT') AS text_blocks,
 (SELECT left(string_agg(b.text_content,E'\n' ORDER BY b.position),600) FROM content.board_post_block b WHERE b.post_id=p.id AND b.type='TEXT') AS text_excerpt,
 COALESCE(c.excluded_count,0) AS excluded_units
 FROM content.board_post p LEFT JOIN LATERAL (
  SELECT origin,jsonb_array_length(excluded_unit_ids) AS excluded_count
  FROM collect.batch_review_command WHERE post_id=p.id AND action='APPROVE_PUBLISH'
  ORDER BY created_at DESC LIMIT 1
 ) c ON true WHERE p.status='PUBLISHED' AND COALESCE(c.origin,'LEGACY_OR_IMPORTED')<>'AUTO'
 ORDER BY p.published_at DESC,p.id DESC LIMIT 100
) x;
SELECT json_build_object('explicitDecisionsBySource',COALESCE(json_agg(x),'[]'::json)) FROM (
 SELECT r.source_key,c.action,c.stage,count(*) AS count
 FROM collect.batch_review_command c JOIN collect.batch_review r ON r.item_id=c.item_id
 WHERE c.origin IN ('ADMIN','DISCORD') AND c.stage IN ('PUBLISHED','REJECTED')
 GROUP BY r.source_key,c.action,c.stage ORDER BY r.source_key,c.action,c.stage
) x;
SELECT json_build_object('rejectedItems',COALESCE(json_agg(x),'[]'::json)) FROM (
 SELECT i.title,i.source_key,c.origin,c.finished_at,
 jsonb_array_length(COALESCE(i.body_blocks,'[]'::jsonb)) AS blocks,
 (SELECT count(*) FROM jsonb_array_elements(COALESCE(i.body_blocks,'[]'::jsonb)) b WHERE b->>'type'='IMAGE') AS images,
 (SELECT jsonb_agg(DISTINCT b->>'type') FROM jsonb_array_elements(COALESCE(i.body_blocks,'[]'::jsonb)) b) AS block_types,
 (SELECT left(string_agg(b->>'text',E'\n'),400) FROM jsonb_array_elements(COALESCE(i.body_blocks,'[]'::jsonb)) b WHERE b->>'type'='TEXT') AS text_excerpt
 FROM collect.batch_review_command c JOIN collect.batch_item i ON i.id=c.item_id
 WHERE c.origin IN ('ADMIN','DISCORD') AND c.action='REJECT' AND c.stage='REJECTED'
 ORDER BY c.finished_at DESC LIMIT 50
) x;
COMMIT;
"""
result = subprocess.run(['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1',
 'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-d','blariyo'],
 input=sql,capture_output=True,text=True,timeout=35)
if result.returncode:
    raise RuntimeError('READ_ONLY_SELECTION_QUERY_FAILED')
print(result.stdout)
