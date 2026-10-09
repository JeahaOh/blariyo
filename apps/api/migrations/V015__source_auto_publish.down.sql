-- Downgrade only before policies/automatic commands have been used.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM collect.batch_source_publish_policy) OR EXISTS(SELECT 1 FROM collect.batch_review_command WHERE origin='AUTO')
 OR EXISTS(SELECT 1 FROM collect.batch_review_control WHERE authority='AUTO') THEN
   RAISE EXCEPTION 'SOURCE_PUBLISH_POLICY_ROLLBACK_REQUIRES_HANDOFF';
 END IF;
END $$;
DROP TABLE collect.batch_source_publish_policy_change;
DROP TABLE collect.batch_source_publish_policy;
DROP FUNCTION collect.audit_source_publish_policy();
ALTER TABLE collect.batch_review_control DROP CONSTRAINT batch_review_control_authority_check;
ALTER TABLE collect.batch_review_control ADD CONSTRAINT batch_review_control_authority_check CHECK(authority IN ('DISCORD','ADMIN','SYSTEM'));
ALTER TABLE collect.batch_review_command DROP CONSTRAINT batch_review_command_origin_check;
ALTER TABLE collect.batch_review_command ADD CONSTRAINT batch_review_command_origin_check CHECK(origin IN ('ADMIN','DISCORD','SYSTEM'));
ALTER TABLE collect.batch_review_command DROP CONSTRAINT batch_review_command_actor_check;
ALTER TABLE collect.batch_review_command ADD CONSTRAINT batch_review_command_actor_check CHECK(
 (origin='SYSTEM' AND actor='system:discord-review-expiry' AND operator_id IS NULL)
 OR (origin IN ('ADMIN','DISCORD') AND actor ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$' AND operator_id IS NOT NULL));
ALTER TABLE collect.batch_review DROP CONSTRAINT batch_review_updated_by_check;
ALTER TABLE collect.batch_review ADD CONSTRAINT batch_review_updated_by_check
 CHECK(updated_by ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$' OR updated_by='system:discord-review-expiry');
CREATE OR REPLACE FUNCTION collect.guard_batch_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permitted boolean;
BEGIN
 IF NEW.status NOT IN ('APPROVED','REJECTED') THEN
   RAISE EXCEPTION 'invalid review decision' USING ERRCODE='23514';
 END IF;
 IF NEW.updated_by='system:discord-review-expiry' THEN
   SELECT EXISTS(SELECT 1 FROM collect.batch_review_control r JOIN collect.batch_review_command c ON c.id=r.active_command_id
     WHERE r.item_id=NEW.item_id AND r.authority='SYSTEM' AND r.decision_epoch=c.decision_epoch
       AND c.origin='SYSTEM' AND c.action='REJECT' AND c.stage='ACCEPTED'
       AND c.item_version=NEW.item_version AND c.content_digest=NEW.content_digest) INTO permitted;
   IF NEW.status<>'REJECTED' OR NOT permitted THEN
     RAISE EXCEPTION 'invalid automatic rejection' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.lock_version<>1 OR NEW.post_id IS NOT NULL THEN
     RAISE EXCEPTION 'invalid initial review' USING ERRCODE='23514';
   END IF;
 ELSE
   IF NEW.item_id<>OLD.item_id OR NEW.source_key<>OLD.source_key
     OR NEW.source_post_key IS DISTINCT FROM OLD.source_post_key OR NEW.canonical_url_hash<>OLD.canonical_url_hash
     OR NEW.lock_version<>OLD.lock_version+1 THEN
     RAISE EXCEPTION 'invalid review update' USING ERRCODE='23514';
   END IF;
   IF OLD.post_id IS NOT NULL THEN
     SELECT EXISTS(SELECT 1 FROM collect.batch_review_control r JOIN collect.batch_review_command c ON c.id=r.active_command_id
       JOIN content.board_post p ON p.id=OLD.post_id
       WHERE r.item_id=NEW.item_id AND r.authority='ADMIN' AND r.decision_epoch=c.decision_epoch
         AND c.origin='ADMIN' AND ((c.action='REJECT' AND NEW.status='REJECTED') OR (c.action='APPROVE_PUBLISH' AND NEW.status='APPROVED'))
         AND c.actor=NEW.updated_by AND c.stage='ACCEPTED'
         AND p.status='DRAFT') INTO permitted;
     IF NOT permitted OR NEW.post_id IS DISTINCT FROM OLD.post_id
       OR NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest THEN
       RAISE EXCEPTION 'invalid linked draft rejection' USING ERRCODE='23514';
     END IF;
   ELSIF NEW.post_id IS NOT NULL AND (OLD.status<>'APPROVED' OR NEW.status<>'APPROVED'
     OR NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest) THEN
     RAISE EXCEPTION 'stale reviewed item' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
