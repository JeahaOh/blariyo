-- API-owned content linkage and review fences; Collector V007 owns lifecycle/dedup.
CREATE TABLE content.post_collection_origin (
  post_id BIGINT PRIMARY KEY REFERENCES content.board_post(id),
  dedup_id UUID NOT NULL UNIQUE
);
REVOKE ALL ON content.post_collection_origin FROM PUBLIC;
ALTER TABLE content.board_post_image ADD COLUMN source_expires_at TIMESTAMPTZ(3);
CREATE FUNCTION content.fence_collected_staging() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,content,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.source_expires_at IS NOT NULL AND clock_timestamp()>=NEW.source_expires_at THEN
      RAISE EXCEPTION 'BATCH_ITEM_EXPIRED';
    END IF;
  ELSIF OLD.post_id IS NULL AND NEW.post_id IS NOT NULL AND OLD.source_expires_at IS NOT NULL THEN
    IF clock_timestamp()>=OLD.source_expires_at THEN RAISE EXCEPTION 'BATCH_ITEM_EXPIRED'; END IF;
    NEW.source_expires_at:=NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collected_staging_fence BEFORE INSERT OR UPDATE ON content.board_post_image
  FOR EACH ROW EXECUTE FUNCTION content.fence_collected_staging();
CREATE FUNCTION content.fence_collected_staging_commit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,content,pg_temp AS $$
DECLARE deadline TIMESTAMPTZ;
BEGIN
  IF TG_OP='INSERT' THEN deadline:=NEW.source_expires_at;
  ELSIF OLD.post_id IS NULL AND NEW.post_id IS NOT NULL THEN deadline:=OLD.source_expires_at;
  END IF;
  IF deadline IS NOT NULL AND clock_timestamp()>=deadline THEN RAISE EXCEPTION 'BATCH_ITEM_EXPIRED'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER collected_staging_commit AFTER INSERT OR UPDATE ON content.board_post_image
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION content.fence_collected_staging_commit();
REVOKE ALL ON FUNCTION content.fence_collected_staging(),content.fence_collected_staging_commit() FROM PUBLIC;

CREATE FUNCTION collect.fence_batch_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  IF to_regclass('collect.batch_retention') IS NULL THEN
    RAISE EXCEPTION 'BATCH_RETENTION_NOT_READY' USING ERRCODE='55000';
  END IF;
  PERFORM collect.assert_item_live(NEW.item_id);
  RETURN NEW;
END $$;
CREATE TRIGGER a_review_retention BEFORE INSERT OR UPDATE ON collect.batch_review
  FOR EACH ROW EXECUTE FUNCTION collect.fence_batch_review();

CREATE FUNCTION collect.finalize_batch_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  IF NEW.status IN ('APPROVED','REJECTED') THEN
    PERFORM collect.finalize_retention(NEW.item_id,NEW.lock_version,NEW.status);
  END IF;
  IF NEW.post_id IS NOT NULL THEN
    INSERT INTO content.post_collection_origin(post_id,dedup_id)
      SELECT NEW.post_id,dedup_id FROM collect.batch_retention WHERE item_id=NEW.item_id AND dedup_id IS NOT NULL
      ON CONFLICT(post_id) DO NOTHING;
    IF NOT EXISTS(SELECT 1 FROM content.post_collection_origin o JOIN collect.batch_retention r ON r.dedup_id=o.dedup_id
      WHERE o.post_id=NEW.post_id AND r.item_id=NEW.item_id) THEN
      RAISE EXCEPTION 'BATCH_ORIGIN_REQUIRED' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER review_retention_finalized AFTER INSERT OR UPDATE ON collect.batch_review
  FOR EACH ROW EXECUTE FUNCTION collect.finalize_batch_review();

CREATE FUNCTION collect.fence_review_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  PERFORM collect.assert_item_live(NEW.item_id);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER review_retention_commit AFTER INSERT OR UPDATE ON collect.batch_review
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_review_commit();

-- Safe in either API/Collector installation order; no runtime cross-owner DML grant.
DO $$ BEGIN
  IF to_regclass('collect.batch_retention') IS NOT NULL THEN
    EXECUTE 'INSERT INTO content.post_collection_origin(post_id,dedup_id)
      SELECT v.post_id,r.dedup_id FROM collect.batch_review v JOIN collect.batch_retention r ON r.item_id=v.item_id
      WHERE v.post_id IS NOT NULL AND r.dedup_id IS NOT NULL';
  END IF;
END $$;
REVOKE ALL ON FUNCTION collect.fence_batch_review(),collect.finalize_batch_review(),collect.fence_review_commit() FROM PUBLIC;

CREATE FUNCTION collect.cleanup_expired_batch_review(item UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle RECORD; review RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||item,0));
  SELECT * INTO lifecycle FROM collect.batch_retention WHERE item_id=item FOR UPDATE;
  IF NOT FOUND OR clock_timestamp()<lifecycle.expires_at OR lifecycle.retention_state NOT IN ('PURGE_PENDING','PURGE_FAILED') THEN
    RAISE EXCEPTION 'RETENTION_PURGE_NOT_DUE' USING ERRCODE='55000';
  END IF;
  SELECT * INTO review FROM collect.batch_review WHERE item_id=item FOR UPDATE;
  IF FOUND AND review.post_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM content.post_collection_origin WHERE post_id=review.post_id AND dedup_id=lifecycle.dedup_id
  ) THEN RAISE EXCEPTION 'RETENTION_CONTENT_ORIGIN_CONFLICT' USING ERRCODE='23514'; END IF;
  DELETE FROM collect.batch_review_request WHERE scope IN ('batch:review:'||item,'batch:draft:'||item);
  DELETE FROM collect.batch_review WHERE item_id=item;
END $$;
REVOKE ALL ON FUNCTION collect.cleanup_expired_batch_review(UUID) FROM PUBLIC;
