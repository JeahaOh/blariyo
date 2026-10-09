-- API-owned opt-in publication policy. Installing it enables no sources.
CREATE TABLE collect.batch_source_publish_policy (
 source_key VARCHAR(80) PRIMARY KEY CHECK(source_key ~ '^[a-z][a-z0-9-]{0,79}$'),
 auto_publish_enabled BOOLEAN NOT NULL DEFAULT false,
 enabled_since TIMESTAMPTZ(3),
 lock_version INTEGER NOT NULL DEFAULT 1 CHECK(lock_version>0),
 updated_by VARCHAR(100) NOT NULL CHECK(updated_by ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$'),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 CHECK(NOT auto_publish_enabled OR enabled_since IS NOT NULL)
);
CREATE TABLE collect.batch_source_publish_policy_change (
 source_key VARCHAR(80) NOT NULL REFERENCES collect.batch_source_publish_policy(source_key),
 lock_version INTEGER NOT NULL CHECK(lock_version>0),
 auto_publish_enabled BOOLEAN NOT NULL,
 enabled_since TIMESTAMPTZ(3),
 actor VARCHAR(100) NOT NULL,
 occurred_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(source_key,lock_version)
);
CREATE FUNCTION collect.audit_source_publish_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.source_key<>OLD.source_key OR NEW.lock_version<>OLD.lock_version+1) THEN
   RAISE EXCEPTION 'invalid policy version' USING ERRCODE='23514';
 END IF;
 INSERT INTO collect.batch_source_publish_policy_change(source_key,lock_version,auto_publish_enabled,enabled_since,actor)
 VALUES(NEW.source_key,NEW.lock_version,NEW.auto_publish_enabled,NEW.enabled_since,NEW.updated_by);
 RETURN NEW;
END $$;
CREATE TRIGGER audit_source_publish_policy AFTER INSERT OR UPDATE ON collect.batch_source_publish_policy
 FOR EACH ROW EXECUTE FUNCTION collect.audit_source_publish_policy();
REVOKE ALL ON collect.batch_source_publish_policy,collect.batch_source_publish_policy_change FROM PUBLIC;
ALTER TABLE collect.batch_review_control DROP CONSTRAINT batch_review_control_authority_check;
ALTER TABLE collect.batch_review_control ADD CONSTRAINT batch_review_control_authority_check CHECK(authority IN ('DISCORD','ADMIN','SYSTEM','AUTO'));
ALTER TABLE collect.batch_review_command DROP CONSTRAINT batch_review_command_origin_check;
ALTER TABLE collect.batch_review_command ADD CONSTRAINT batch_review_command_origin_check CHECK(origin IN ('ADMIN','DISCORD','SYSTEM','AUTO'));
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='collect.batch_review_command'::regclass
   AND contype='c' AND pg_get_constraintdef(oid) LIKE '%operator_id%' LOOP
   EXECUTE format('ALTER TABLE collect.batch_review_command DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE collect.batch_review_command ADD CONSTRAINT batch_review_command_actor_check CHECK(
 (origin='SYSTEM' AND actor='system:discord-review-expiry' AND operator_id IS NULL)
 OR (origin IN ('ADMIN','DISCORD') AND actor ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$' AND operator_id IS NOT NULL)
 OR (origin='AUTO' AND actor='system:collector' AND operator_id IS NULL AND action='APPROVE_PUBLISH' AND reviewer_ids='[]'::jsonb));
ALTER TABLE collect.batch_review DROP CONSTRAINT batch_review_updated_by_check;
ALTER TABLE collect.batch_review ADD CONSTRAINT batch_review_updated_by_check
 CHECK(updated_by ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$' OR updated_by IN ('system:discord-review-expiry','system:collector'));
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
 IF NEW.updated_by='system:collector' THEN
   SELECT EXISTS(SELECT 1 FROM collect.batch_review_control r JOIN collect.batch_review_command c ON c.id=r.active_command_id
     WHERE r.item_id=NEW.item_id AND r.authority='AUTO' AND r.decision_epoch=c.decision_epoch
       AND c.origin='AUTO' AND c.actor=NEW.updated_by AND c.action='APPROVE_PUBLISH'
       AND c.stage IN ('ACCEPTED','APPROVED','PREPARING')
       AND c.item_version=NEW.item_version AND c.content_digest=NEW.content_digest) INTO permitted;
   IF NEW.status<>'APPROVED' OR NOT permitted THEN
     RAISE EXCEPTION 'invalid automatic approval' USING ERRCODE='23514';
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
