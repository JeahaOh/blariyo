-- Approve/reject the snapshot read by the operator without a REVIEWING transition.
-- Existing REVIEWING rows are read as UNREVIEWED; do not rewrite expired originals.
CREATE OR REPLACE FUNCTION collect.guard_batch_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status NOT IN ('APPROVED','REJECTED') THEN
   RAISE EXCEPTION 'invalid review decision' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.lock_version<>1 OR NEW.post_id IS NOT NULL THEN
     RAISE EXCEPTION 'invalid initial review' USING ERRCODE='23514';
   END IF;
 ELSE
   IF OLD.post_id IS NOT NULL OR NEW.item_id<>OLD.item_id OR NEW.source_key<>OLD.source_key
     OR NEW.source_post_key IS DISTINCT FROM OLD.source_post_key OR NEW.canonical_url_hash<>OLD.canonical_url_hash
     OR NEW.lock_version<>OLD.lock_version+1 THEN
     RAISE EXCEPTION 'invalid review update' USING ERRCODE='23514';
   END IF;
   IF NEW.post_id IS NOT NULL AND (OLD.status<>'APPROVED' OR NEW.status<>'APPROVED'
     OR NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest) THEN
     RAISE EXCEPTION 'stale reviewed item' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
