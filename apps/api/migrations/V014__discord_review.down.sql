-- Only before activation. Losing unresolved jobs/messages is not an app rollback.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM collect.discord_review_delivery) OR EXISTS(SELECT 1 FROM collect.batch_review_command)
   OR EXISTS(SELECT 1 FROM collect.discord_review_scan_run) OR EXISTS(SELECT 1 FROM collect.batch_review_control) THEN
   RAISE EXCEPTION 'discord review data requires an explicit recovery/export plan';
 END IF;
END $$;
ALTER TABLE collect.batch_review DROP CONSTRAINT batch_review_linked_decision_check;
ALTER TABLE collect.batch_review ADD CONSTRAINT batch_review_check CHECK(post_id IS NULL OR status='APPROVED');
ALTER TABLE collect.batch_review DROP CONSTRAINT batch_review_updated_by_check;
ALTER TABLE collect.batch_review ADD CONSTRAINT batch_review_updated_by_check CHECK(updated_by ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$');
DROP TABLE collect.discord_review_scan_run;
DROP TABLE collect.batch_review_command;
DROP TABLE collect.discord_review_part;
DROP TABLE collect.discord_review_delivery;
DROP TABLE collect.batch_review_control;

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
