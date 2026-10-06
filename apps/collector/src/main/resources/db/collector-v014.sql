-- Explicit operator deletion, separate from image retries and expiry.
CREATE TABLE collect.batch_manual_deletion (
 item_id uuid PRIMARY KEY, item_version bigint NOT NULL, deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 deleted_by text NOT NULL CHECK(length(deleted_by) BETWEEN 1 AND 200)
);
CREATE TABLE collect.batch_manual_cleanup (
 item_id uuid NOT NULL REFERENCES collect.batch_manual_deletion(item_id), run_id uuid NOT NULL,
 completed_at timestamptz, PRIMARY KEY(item_id,run_id)
);
REVOKE ALL ON collect.batch_manual_deletion,collect.batch_manual_cleanup FROM PUBLIC;
CREATE FUNCTION collect.delete_failed_item(item uuid,expected_version bigint,review_version bigint,actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry collect.batch_item%ROWTYPE; prior record; reviewed record; tx xid8:=pg_current_xact_id(); identity uuid; protected boolean;
BEGIN
 IF item IS NULL OR expected_version IS NULL OR expected_version<0 OR review_version IS NULL OR review_version<0
    OR actor IS NULL OR length(actor) NOT BETWEEN 1 AND 200 THEN RETURN 'VALIDATION_FAILED'; END IF;
 IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('collect-retention-restore',0)) THEN RETURN 'BATCH_ITEM_BUSY'; END IF;
 SELECT * INTO entry FROM collect.batch_item WHERE id=item;
 IF FOUND AND NOT pg_try_advisory_xact_lock(hashtextextended('collector-source:'||entry.source_key,0)) THEN RETURN 'BATCH_ITEM_BUSY'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||item,0));
 SELECT * INTO prior FROM collect.batch_manual_deletion WHERE item_id=item;
 IF FOUND THEN
   IF prior.item_version<>expected_version THEN RETURN 'BATCH_ITEM_VERSION_CONFLICT'; END IF;
   RETURN 'DELETED';
 END IF;
 SELECT * INTO entry FROM collect.batch_item WHERE id=item FOR UPDATE;
 IF NOT FOUND THEN RETURN 'BATCH_ITEM_NOT_FOUND'; END IF;
 IF entry.version<>expected_version THEN RETURN 'BATCH_ITEM_VERSION_CONFLICT'; END IF;
 IF entry.state NOT IN ('FAILED','BLOCKED') THEN RETURN 'BATCH_ITEM_STATE_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM collect.batch_run WHERE id=entry.run_id AND state='RUNNING') THEN RETURN 'BATCH_ITEM_BUSY'; END IF;
 IF NOT EXISTS(SELECT 1 FROM collect.batch_retention WHERE item_id=item AND retention_state='LIVE' AND expires_at>clock_timestamp()) THEN RETURN 'BATCH_ITEM_EXPIRED'; END IF;
 SELECT * INTO reviewed FROM collect.batch_review WHERE item_id=item FOR UPDATE;
 IF FOUND THEN
   IF reviewed.lock_version<>review_version THEN RETURN 'BATCH_REVIEW_VERSION_CONFLICT'; END IF;
   IF reviewed.status NOT IN ('REVIEWING','UNREVIEWED') OR reviewed.post_id IS NOT NULL THEN RETURN 'BATCH_REVIEW_STATE_CONFLICT'; END IF;
 ELSIF review_version<>0 THEN RETURN 'BATCH_REVIEW_VERSION_CONFLICT';
 END IF;
 IF to_regclass('content.board_post') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM content.board_post WHERE source_url=$1)' INTO protected USING entry.canonical_url;
   IF protected THEN RETURN 'BATCH_ALREADY_PROMOTED'; END IF;
 END IF;
 -- Only collector-owned item paths can enter the exact-prefix cleanup worker.
 IF entry.raw_object_key IS NOT NULL AND entry.raw_object_key !~ ('^collect/raw/[0-9a-f-]{36}/'||item||'\.html$') THEN RETURN 'BATCH_CONTENT_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM collect.batch_media WHERE item_id=item AND object_key IS NOT NULL
   AND object_key !~ ('^collect/media/[0-9a-f-]{36}/'||item||'/[0-9]+$')) THEN RETURN 'BATCH_CONTENT_INVALID'; END IF;
 identity:=collect.register_dedup(entry.source_key,entry.source_post_key,entry.canonical_url);
 UPDATE collect.batch_retention SET dedup_id=identity WHERE item_id=item;
 INSERT INTO collect.batch_manual_deletion(item_id,item_version,deleted_by) VALUES(item,entry.version,actor);
 INSERT INTO collect.batch_manual_cleanup(item_id,run_id)
   SELECT item,entry.run_id UNION SELECT item,run_id FROM collect.batch_failure WHERE item_id=item
   UNION SELECT item,run_id FROM collect.batch_image_cleanup WHERE item_id=item
   UNION SELECT item,split_part(entry.raw_object_key,'/',3)::uuid WHERE entry.raw_object_key IS NOT NULL
   UNION SELECT item,split_part(object_key,'/',3)::uuid FROM collect.batch_media WHERE item_id=item AND object_key IS NOT NULL;
 INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_item',item) ON CONFLICT DO NOTHING;
 INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media',id FROM collect.batch_media WHERE item_id=item ON CONFLICT DO NOTHING;
 INSERT INTO collect.batch_purge_scope SELECT tx,'batch_failure',id FROM collect.batch_failure WHERE item_id=item ON CONFLICT DO NOTHING;
 INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media_correction',operation_id FROM collect.batch_media_correction
   WHERE media_id IN (SELECT id FROM collect.batch_media WHERE item_id=item) ON CONFLICT DO NOTHING;
 DELETE FROM collect.batch_review_request WHERE scope IN ('batch:review:'||item,'batch:draft:'||item);
 DELETE FROM collect.batch_review WHERE item_id=item AND post_id IS NULL;
 DELETE FROM collect.batch_media_correction WHERE media_id IN (SELECT id FROM collect.batch_media WHERE item_id=item);
 DELETE FROM collect.batch_failure WHERE item_id=item;
 DELETE FROM collect.batch_media WHERE item_id=item;
 DELETE FROM collect.batch_item WHERE id=item;
 DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx;
 RETURN 'DELETED';
END $$;
REVOKE ALL ON FUNCTION collect.delete_failed_item(uuid,bigint,bigint,text) FROM PUBLIC;

-- Existing exact item/run worker also drains explicit operator deletions.
CREATE OR REPLACE FUNCTION collect.image_cleanup_pending() RETURNS TABLE(item_id uuid,run_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 SELECT p.item_id,p.run_id FROM (
   SELECT c.item_id,c.run_id,r.discarded_at AS queued_at FROM collect.batch_image_cleanup c JOIN collect.batch_image_retry r USING(item_id)
     WHERE r.discarded_at IS NOT NULL AND c.completed_at IS NULL
   UNION ALL SELECT c.item_id,c.run_id,d.deleted_at FROM collect.batch_manual_cleanup c JOIN collect.batch_manual_deletion d USING(item_id)
     WHERE c.completed_at IS NULL
 ) p ORDER BY queued_at,run_id LIMIT 100
$$;
ALTER FUNCTION collect.image_cleanup_allowed(uuid,uuid,text) RENAME TO image_cleanup_allowed_before_manual_delete;
CREATE FUNCTION collect.image_cleanup_allowed(item uuid,run uuid,key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE referenced boolean;
BEGIN
 IF collect.image_cleanup_allowed_before_manual_delete(item,run,key) THEN RETURN true; END IF;
 IF key IS NULL OR key ~ '(^|/)\.\.?(/|$)' OR key LIKE '%//%' OR NOT
   (key='collect/raw/'||run||'/'||item||'.html' OR key ~ ('^collect/media/'||run||'/'||item||'/[0-9]+$')) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM collect.batch_manual_cleanup WHERE item_id=item AND run_id=run) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM collect.batch_item WHERE id=item OR raw_object_key=key) OR EXISTS(SELECT 1 FROM collect.batch_media WHERE object_key=key) THEN RETURN false; END IF;
 IF to_regclass('content.board_post_image') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM content.board_post_image WHERE private_storage_key=$1 OR public_storage_key=$1)' INTO referenced USING key;
   IF referenced THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION collect.finish_image_cleanup(item uuid,run uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 UPDATE collect.batch_image_cleanup c SET completed_at=clock_timestamp() WHERE c.item_id=item AND c.run_id=run
   AND EXISTS(SELECT 1 FROM collect.batch_image_retry r WHERE r.item_id=item AND r.discarded_at IS NOT NULL);
 UPDATE collect.batch_manual_cleanup SET completed_at=clock_timestamp() WHERE item_id=item AND run_id=run;
$$;
ALTER FUNCTION collect.observe_retention_object(text,boolean) RENAME TO observe_retention_object_before_manual_delete;
CREATE FUNCTION collect.observe_retention_object(key text,restore_inventory boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE candidate record;
BEGIN
 FOR candidate IN SELECT item_id,run_id FROM collect.batch_manual_cleanup c
   WHERE key='collect/raw/'||c.run_id||'/'||c.item_id||'.html' OR key LIKE 'collect/media/'||c.run_id||'/'||c.item_id||'/%' LOOP
   UPDATE collect.batch_manual_cleanup SET completed_at=NULL WHERE item_id=candidate.item_id AND run_id=candidate.run_id;
   RETURN candidate.item_id;
 END LOOP;
 RETURN collect.observe_retention_object_before_manual_delete(key,restore_inventory);
END $$;
REVOKE ALL ON FUNCTION collect.image_cleanup_pending(),collect.image_cleanup_allowed(uuid,uuid,text),
 collect.finish_image_cleanup(uuid,uuid),collect.observe_retention_object(text,boolean) FROM PUBLIC;
