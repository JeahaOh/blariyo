-- A crashed retry may still be FETCHING and have no batch_failure row. Capture its
-- old prefix before claim replaces run_id/raw/media, without granting another retry.
CREATE OR REPLACE FUNCTION collect.prepare_image_retry(source text,post_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry collect.batch_item%ROWTYPE; failure collect.batch_failure%ROWTYPE;
BEGIN
 PERFORM collect.assert_source_owner(source);
 SELECT * INTO entry FROM collect.batch_item WHERE source_key=source AND source_post_key=post_key;
 IF NOT FOUND OR entry.state NOT IN ('FETCHING','FAILED','BLOCKED') THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM collect.batch_image_retry WHERE item_id=entry.id AND discarded_at IS NULL) THEN
  PERFORM collect.assert_image_unreviewed(entry.id);
  INSERT INTO collect.batch_image_cleanup(item_id,run_id) VALUES(entry.id,entry.run_id) ON CONFLICT DO NOTHING;
  RETURN;
 END IF;
 IF entry.state='FETCHING' THEN RETURN; END IF;
 SELECT * INTO failure FROM collect.batch_failure WHERE item_id=entry.id AND run_id=entry.run_id ORDER BY occurred_at DESC,id DESC LIMIT 1;
 IF failure.phase IS DISTINCT FROM 'MEDIA' OR failure.detail->>'assetKind' IS DISTINCT FROM 'IMAGE'
   OR NOT collect.image_failure_code(failure.code) THEN RETURN; END IF;
 PERFORM collect.assert_image_unreviewed(entry.id);
 INSERT INTO collect.batch_image_retry(item_id,first_code) VALUES(entry.id,failure.code) ON CONFLICT DO NOTHING;
 INSERT INTO collect.batch_image_cleanup(item_id,run_id) VALUES(entry.id,entry.run_id) ON CONFLICT DO NOTHING;
END $$;
