-- Restore the prior transition contract without rewriting review history.
CREATE OR REPLACE FUNCTION collect.guard_batch_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'REVIEWING' OR NEW.lock_version<>1 OR NEW.post_id IS NOT NULL THEN
     RAISE EXCEPTION 'invalid initial review' USING ERRCODE='23514';
   END IF;
 ELSE
   IF OLD.post_id IS NOT NULL OR NEW.item_id<>OLD.item_id OR NEW.source_key<>OLD.source_key
     OR NEW.source_post_key IS DISTINCT FROM OLD.source_post_key OR NEW.canonical_url_hash<>OLD.canonical_url_hash
     OR NEW.lock_version<>OLD.lock_version+1 THEN
     RAISE EXCEPTION 'invalid review update' USING ERRCODE='23514';
   END IF;
   IF NOT ((OLD.status='REVIEWING' AND NEW.status IN ('APPROVED','REJECTED'))
     OR (NEW.status='REVIEWING' AND (OLD.status IN ('APPROVED','REJECTED') OR NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest))
     OR (OLD.status='APPROVED' AND NEW.status='APPROVED' AND NEW.post_id IS NOT NULL AND NEW.item_version=OLD.item_version)) THEN
     RAISE EXCEPTION 'invalid review transition' USING ERRCODE='23514';
   END IF;
   IF (NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest) AND NEW.status<>'REVIEWING' THEN
     RAISE EXCEPTION 'stale reviewed item' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
