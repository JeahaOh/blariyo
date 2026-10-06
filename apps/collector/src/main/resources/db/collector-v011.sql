-- Image failure policy: one durable article retry; explicit discard is not expiry.
CREATE TABLE collect.batch_image_retry (
 item_id uuid PRIMARY KEY, first_code text NOT NULL, retried_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 discarded_at timestamptz, last_code text
);
CREATE TABLE collect.batch_image_cleanup (
 item_id uuid NOT NULL REFERENCES collect.batch_image_retry(item_id), run_id uuid NOT NULL,
 completed_at timestamptz, PRIMARY KEY(item_id,run_id)
);
REVOKE ALL ON collect.batch_image_retry,collect.batch_image_cleanup FROM PUBLIC;
CREATE FUNCTION collect.image_failure_code(code text) RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog AS $$ SELECT code=ANY(ARRAY[
 'ROBOTS_UNVERIFIED','ROBOTS_DISALLOWED','ROBOTS_DELAY_UNSUPPORTED','SOURCE_ACCESS_BLOCKED',
 'SOURCE_DNS_FAILED','SOURCE_FETCH_FAILED','SOURCE_GONE','SOURCE_HTTP_REJECTED','SOURCE_HTTP_UNAVAILABLE',
 'SOURCE_NOT_ALLOWED','SOURCE_RATE_LIMITED','SOURCE_REDIRECT_BLOCKED','SOURCE_REDIRECT_LOOP',
 'SOURCE_TOO_LARGE','SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED','SOURCE_NOT_IMAGE','SOURCE_URL_INVALID',
 'SOURCE_DNS_BLOCKED','SOURCE_ADDRESS_BLOCKED']) $$;
CREATE FUNCTION collect.assert_image_unreviewed(item uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE protected boolean;
BEGIN
 PERFORM collect.assert_item_live(item);
 IF to_regclass('collect.batch_review') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM collect.batch_review WHERE item_id=$1 AND (status<>''REVIEWING'' OR post_id IS NOT NULL))' INTO protected USING item;
  IF protected THEN RAISE EXCEPTION 'IMAGE_RETRY_REVIEW_PROTECTED'; END IF;
 END IF;
 IF to_regclass('content.board_post') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM content.board_post p JOIN collect.batch_item i ON p.source_url=i.canonical_url WHERE i.id=$1)' INTO protected USING item;
  IF protected THEN RAISE EXCEPTION 'IMAGE_RETRY_POST_PROTECTED'; END IF;
 END IF;
END $$;
CREATE FUNCTION collect.retry_image(item uuid,code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry collect.batch_item%ROWTYPE; inserted integer;
BEGIN
 PERFORM collect.assert_image_unreviewed(item);
 SELECT * INTO STRICT entry FROM collect.batch_item WHERE id=item FOR UPDATE;
 PERFORM collect.assert_run_owner(entry.run_id);
 IF entry.state<>'FETCHING' OR NOT collect.image_failure_code(code) THEN RETURN false; END IF;
 INSERT INTO collect.batch_image_retry(item_id,first_code) VALUES(item,code) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 RETURN inserted=1;
END $$;
-- A legacy failed item's next claim is already its additional attempt.
CREATE FUNCTION collect.prepare_image_retry(source text,post_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry collect.batch_item%ROWTYPE; failure collect.batch_failure%ROWTYPE;
BEGIN
 PERFORM collect.assert_source_owner(source);
 SELECT * INTO entry FROM collect.batch_item WHERE source_key=source AND source_post_key=post_key;
 IF NOT FOUND OR entry.state NOT IN ('FAILED','BLOCKED') THEN RETURN; END IF;
 SELECT * INTO failure FROM collect.batch_failure WHERE item_id=entry.id AND run_id=entry.run_id ORDER BY occurred_at DESC,id DESC LIMIT 1;
 IF failure.phase IS DISTINCT FROM 'MEDIA' OR failure.detail->>'assetKind' IS DISTINCT FROM 'IMAGE'
   OR NOT collect.image_failure_code(failure.code) THEN RETURN; END IF;
 PERFORM collect.assert_image_unreviewed(entry.id);
 INSERT INTO collect.batch_image_retry(item_id,first_code) VALUES(entry.id,failure.code) ON CONFLICT DO NOTHING;
 INSERT INTO collect.batch_image_cleanup(item_id,run_id) VALUES(entry.id,entry.run_id) ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION collect.discard_image_failure(item uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry collect.batch_item%ROWTYPE; failure collect.batch_failure%ROWTYPE; tx xid8:=pg_current_xact_id(); identity uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM collect.batch_image_retry WHERE item_id=item AND discarded_at IS NULL) THEN RETURN false; END IF;
 PERFORM collect.assert_image_unreviewed(item);
 SELECT * INTO STRICT entry FROM collect.batch_item WHERE id=item FOR UPDATE;
 PERFORM collect.assert_run_owner(entry.run_id);
 SELECT * INTO failure FROM collect.batch_failure WHERE item_id=item AND run_id=entry.run_id ORDER BY occurred_at DESC,id DESC LIMIT 1;
 IF entry.state NOT IN ('FAILED','BLOCKED') OR failure.phase IS DISTINCT FROM 'MEDIA'
   OR failure.detail->>'assetKind' IS DISTINCT FROM 'IMAGE' OR NOT collect.image_failure_code(failure.code) THEN RETURN false; END IF;
 identity:=collect.register_dedup(entry.source_key,entry.source_post_key,entry.canonical_url);
 UPDATE collect.batch_retention SET dedup_id=identity WHERE item_id=item;
 INSERT INTO collect.batch_image_cleanup(item_id,run_id)
  SELECT item,entry.run_id UNION SELECT item,run_id FROM collect.batch_failure WHERE item_id=item ON CONFLICT DO NOTHING;
 INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_item',item);
 INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media',id FROM collect.batch_media WHERE item_id=item;
 INSERT INTO collect.batch_purge_scope SELECT tx,'batch_failure',id FROM collect.batch_failure WHERE item_id=item;
 INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media_correction',operation_id FROM collect.batch_media_correction
  WHERE media_id IN (SELECT id FROM collect.batch_media WHERE item_id=item);
 IF to_regclass('collect.batch_review_request') IS NOT NULL THEN
  EXECUTE 'DELETE FROM collect.batch_review_request WHERE scope IN ($1,$2)' USING 'batch:review:'||item,'batch:draft:'||item;
 END IF;
 IF to_regclass('collect.batch_review') IS NOT NULL THEN
  EXECUTE 'DELETE FROM collect.batch_review WHERE item_id=$1 AND status=''REVIEWING'' AND post_id IS NULL' USING item;
 END IF;
 DELETE FROM collect.batch_media_correction WHERE media_id IN (SELECT id FROM collect.batch_media WHERE item_id=item);
 DELETE FROM collect.batch_failure WHERE item_id=item;
 DELETE FROM collect.batch_media WHERE item_id=item;
 DELETE FROM collect.batch_item WHERE id=item;
 UPDATE collect.batch_image_retry SET discarded_at=clock_timestamp(),last_code=failure.code WHERE item_id=item;
 DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx;
 RETURN true;
END $$;
CREATE FUNCTION collect.image_cleanup_pending() RETURNS TABLE(item_id uuid,run_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 SELECT c.item_id,c.run_id FROM collect.batch_image_cleanup c JOIN collect.batch_image_retry r USING(item_id)
 WHERE r.discarded_at IS NOT NULL AND c.completed_at IS NULL ORDER BY r.discarded_at,c.run_id LIMIT 100
$$;
CREATE FUNCTION collect.image_cleanup_allowed(item uuid,run uuid,key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE referenced boolean;
BEGIN
 IF key IS NULL OR key ~ '(^|/)\.\.?(/|$)' OR key LIKE '%//%' OR NOT
  (key='collect/raw/'||run||'/'||item||'.html' OR key ~ ('^collect/media/'||run||'/'||item||'/[0-9]+$')) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM collect.batch_image_cleanup c JOIN collect.batch_image_retry r USING(item_id)
   WHERE c.item_id=item AND c.run_id=run AND r.discarded_at IS NOT NULL) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM collect.batch_item WHERE id=item OR raw_object_key=key) OR EXISTS(SELECT 1 FROM collect.batch_media WHERE object_key=key) THEN RETURN false; END IF;
 IF to_regclass('content.board_post_image') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM content.board_post_image WHERE private_storage_key=$1 OR public_storage_key=$1)' INTO referenced USING key;
  IF referenced THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $$;
CREATE FUNCTION collect.finish_image_cleanup(item uuid,run uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 UPDATE collect.batch_image_cleanup c SET completed_at=clock_timestamp() WHERE c.item_id=item AND c.run_id=run
 AND EXISTS(SELECT 1 FROM collect.batch_image_retry r WHERE r.item_id=item AND r.discarded_at IS NOT NULL)
$$;
-- Reappearing objects (e.g. interrupted upload/restore) reopen the durable deletion job.
ALTER FUNCTION collect.observe_retention_object(text,boolean) RENAME TO observe_retention_object_before_image_retry;
CREATE FUNCTION collect.observe_retention_object(key text,restore_inventory boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE candidate record;
BEGIN
 FOR candidate IN SELECT c.item_id,c.run_id FROM collect.batch_image_cleanup c JOIN collect.batch_image_retry r USING(item_id)
  WHERE r.discarded_at IS NOT NULL AND (key='collect/raw/'||c.run_id||'/'||c.item_id||'.html'
   OR key LIKE 'collect/media/'||c.run_id||'/'||c.item_id||'/%') LOOP
  UPDATE collect.batch_image_cleanup SET completed_at=NULL WHERE item_id=candidate.item_id AND run_id=candidate.run_id;
  RETURN candidate.item_id;
 END LOOP;
 RETURN collect.observe_retention_object_before_image_retry(key,restore_inventory);
END $$;
REVOKE ALL ON FUNCTION collect.image_failure_code(text),collect.assert_image_unreviewed(uuid),collect.retry_image(uuid,text),
 collect.prepare_image_retry(text,text),collect.discard_image_failure(uuid),collect.image_cleanup_pending(),
 collect.image_cleanup_allowed(uuid,uuid,text),collect.finish_image_cleanup(uuid,uuid),collect.observe_retention_object(text,boolean) FROM PUBLIC;
