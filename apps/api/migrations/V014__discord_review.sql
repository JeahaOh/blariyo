-- API-owned durable review/Discord transport state. No FK to disposable batch_item.
-- Installing this schema does not enable export, scan or publication.
CREATE TABLE collect.batch_review_control (
 item_id UUID PRIMARY KEY,
 authority VARCHAR(16) NOT NULL DEFAULT 'DISCORD' CHECK(authority IN ('DISCORD','ADMIN','SYSTEM')),
 decision_epoch BIGINT NOT NULL DEFAULT 0 CHECK(decision_epoch>=0),
 active_command_id UUID,
 last_observation_reason VARCHAR(80),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE collect.discord_review_delivery (
 id UUID PRIMARY KEY,
 item_id UUID NOT NULL,
 environment VARCHAR(16) NOT NULL CHECK(environment IN ('local_test','production')),
 item_version BIGINT NOT NULL CHECK(item_version>=0),
 content_digest BYTEA NOT NULL CHECK(octet_length(content_digest)=32),
 renderer_version VARCHAR(40) NOT NULL,
 manifest JSONB NOT NULL CHECK(jsonb_typeof(manifest)='object'),
 guild_id VARCHAR(20) NOT NULL CHECK(guild_id ~ '^[0-9]{17,20}$'),
 channel_id VARCHAR(20) NOT NULL CHECK(channel_id ~ '^[0-9]{17,20}$'),
 head_message_id VARCHAR(20) CHECK(head_message_id ~ '^[0-9]{17,20}$'),
 thread_id VARCHAR(20) CHECK(thread_id ~ '^[0-9]{17,20}$'),
 review_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
 state VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','EXPORTING','READY','CANCELLED','BLOCKED','CLOSED')),
 generation BIGINT NOT NULL DEFAULT 1 CHECK(generation>0),
 head_seeded BOOLEAN NOT NULL DEFAULT false,
 head_send_state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(head_send_state IN ('PENDING','SENDING','SENT','UNKNOWN','BLOCKED')),
 head_nonce VARCHAR(25),
 export_token UUID,
 observation_scan_id UUID,
 observation_started_at TIMESTAMPTZ(3),
 observation_chunks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(observation_chunks)='array'),
 ready_at TIMESTAMPTZ(3),
 expires_at TIMESTAMPTZ(3),
 last_scanned_at TIMESTAMPTZ(3),
 last_scan_result VARCHAR(80),
 work_kind VARCHAR(16) CHECK(work_kind IN ('EXPORT','CLEANUP','NOTICE')),
 lease_owner VARCHAR(100),
 lease_token UUID,
 lease_until TIMESTAMPTZ(3),
 attempt_id UUID,
 last_ack_attempt_id UUID,
 next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 cleanup_state VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK(cleanup_state IN ('NONE','PENDING','RUNNING','RETRY_WAIT','BLOCKED','DONE')),
 cleanup_failures INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_failures>=0),
 head_deleted_at TIMESTAMPTZ(3),
 thread_deleted_at TIMESTAMPTZ(3),
 notice_state VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK(notice_state IN ('NONE','PENDING','SENT','BLOCKED','UNAVAILABLE')),
 notice_failures INTEGER NOT NULL DEFAULT 0 CHECK(notice_failures>=0),
 notice_next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 notice_message_id VARCHAR(20) CHECK(notice_message_id ~ '^[0-9]{17,20}$'),
 last_error VARCHAR(80),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 CHECK((ready_at IS NULL AND expires_at IS NULL) OR (ready_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at=ready_at+interval '48 hours')),
 CHECK(state<>'READY' OR (ready_at IS NOT NULL AND head_message_id IS NOT NULL AND thread_id IS NOT NULL AND head_seeded AND head_send_state='SENT')),
 CHECK((lease_token IS NULL AND lease_until IS NULL AND lease_owner IS NULL AND work_kind IS NULL)
   OR (lease_token IS NOT NULL AND lease_until IS NOT NULL AND lease_owner IS NOT NULL AND work_kind IS NOT NULL))
);
CREATE UNIQUE INDEX uq_discord_review_active_item ON collect.discord_review_delivery(item_id)
 WHERE state<>'CLOSED';
CREATE INDEX ix_discord_review_scan ON collect.discord_review_delivery(environment,ready_at,id) WHERE state='READY';
CREATE INDEX ix_discord_review_cleanup ON collect.discord_review_delivery(environment,next_attempt_at,id)
 WHERE cleanup_state IN ('PENDING','RUNNING','RETRY_WAIT');
CREATE TABLE collect.discord_review_part (
 delivery_id UUID NOT NULL REFERENCES collect.discord_review_delivery(id),
 ordinal INTEGER NOT NULL CHECK(ordinal>=0),
 unit_id VARCHAR(64) NOT NULL CHECK(unit_id ~ '^[a-f0-9]{64}$'),
 fragment_index INTEGER NOT NULL CHECK(fragment_index>=0),
 kind VARCHAR(8) NOT NULL CHECK(kind IN ('TEXT','IMAGE','LINK')),
 source_block INTEGER NOT NULL CHECK(source_block>=0),
 source_start INTEGER NOT NULL CHECK(source_start>=0),
 source_end INTEGER NOT NULL CHECK(source_end>=source_start),
 image_position INTEGER,
 message_id VARCHAR(20) CHECK(message_id ~ '^[0-9]{17,20}$'),
 send_state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(send_state IN ('PENDING','SENDING','SENT','UNKNOWN','BLOCKED')),
 seeded BOOLEAN NOT NULL DEFAULT false,
 attempt_nonce VARCHAR(25),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 PRIMARY KEY(delivery_id,ordinal),
 UNIQUE(delivery_id,unit_id,fragment_index),
 UNIQUE(delivery_id,message_id),
 CHECK((kind='IMAGE' AND image_position IS NOT NULL AND image_position>0) OR (kind<>'IMAGE' AND image_position IS NULL)),
 CHECK(NOT seeded OR (send_state='SENT' AND message_id IS NOT NULL))
);
CREATE TABLE collect.batch_review_command (
 id UUID PRIMARY KEY,
 item_id UUID NOT NULL,
 origin VARCHAR(8) NOT NULL CHECK(origin IN ('ADMIN','DISCORD','SYSTEM')),
 action VARCHAR(20) NOT NULL CHECK(action IN ('APPROVE_PUBLISH','REJECT')),
 actor VARCHAR(100) NOT NULL,
 operator_id VARCHAR(100),
 reviewer_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(reviewer_ids)='array'),
 decision_epoch BIGINT NOT NULL CHECK(decision_epoch>=0),
 item_version BIGINT NOT NULL CHECK(item_version>=0),
 review_version INTEGER NOT NULL CHECK(review_version>=0),
 content_digest BYTEA NOT NULL CHECK(octet_length(content_digest)=32),
 selection_digest BYTEA NOT NULL CHECK(octet_length(selection_digest)=32),
 excluded_unit_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(excluded_unit_ids)='array'),
 evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(evidence)='object'),
 request_body JSONB NOT NULL CHECK(jsonb_typeof(request_body)='object'),
 request_key VARCHAR(200) NOT NULL,
 request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32),
 stage VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED' CHECK(stage IN ('ACCEPTED','APPROVED','PREPARING','DRAFTED','PUBLISHED','REJECTED','CANCELLED','NEEDS_ADMIN','FAILED')),
 post_id BIGINT REFERENCES content.board_post(id),
 post_version INTEGER,
 lease_owner VARCHAR(100),
 lease_token UUID,
 lease_until TIMESTAMPTZ(3),
 next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count>=0),
 last_error VARCHAR(80),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ(3),
 UNIQUE(actor,request_key),
 CHECK(origin<>'SYSTEM' OR action='REJECT'),
 CHECK((origin='SYSTEM' AND actor='system:discord-review-expiry' AND operator_id IS NULL)
   OR (origin IN ('ADMIN','DISCORD') AND actor ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$' AND operator_id IS NOT NULL)),
 CHECK(stage NOT IN ('DRAFTED','PUBLISHED') OR post_id IS NOT NULL),
 CHECK((stage IN ('PUBLISHED','REJECTED','CANCELLED','NEEDS_ADMIN','FAILED'))=(finished_at IS NOT NULL)),
 CHECK((lease_token IS NULL AND lease_until IS NULL AND lease_owner IS NULL)
   OR (lease_token IS NOT NULL AND lease_until IS NOT NULL AND lease_owner IS NOT NULL))
);
CREATE UNIQUE INDEX uq_batch_review_active_command ON collect.batch_review_command(item_id) WHERE finished_at IS NULL;
CREATE INDEX ix_batch_review_command_recovery ON collect.batch_review_command(next_attempt_at,id) WHERE finished_at IS NULL;
CREATE INDEX ix_batch_review_command_post ON collect.batch_review_command(post_id) WHERE post_id IS NOT NULL;
CREATE TABLE collect.discord_review_scan_run (
 id UUID PRIMARY KEY,
 environment VARCHAR(16) NOT NULL CHECK(environment IN ('local_test','production')),
 scheduled_slot TIMESTAMPTZ(3) NOT NULL,
 cutoff_at TIMESTAMPTZ(3) NOT NULL,
 cursor_ready_at TIMESTAMPTZ(3),
 cursor_id UUID,
 state VARCHAR(16) NOT NULL DEFAULT 'RUNNING' CHECK(state IN ('RUNNING','COMPLETED','FAILED')),
 lease_owner VARCHAR(100) NOT NULL,
 lease_token UUID NOT NULL,
 lease_until TIMESTAMPTZ(3) NOT NULL,
 summary JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(summary)='object'),
 started_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ(3),
 UNIQUE(environment,scheduled_slot),
 CHECK((cursor_ready_at IS NULL)=(cursor_id IS NULL)),
 CHECK(to_char(scheduled_slot AT TIME ZONE 'Asia/Seoul','HH24:MI:SS.MS') IN ('07:30:00.000','17:00:00.000'))
);
REVOKE ALL ON collect.batch_review_control,collect.discord_review_delivery,collect.discord_review_part,
 collect.batch_review_command,collect.discord_review_scan_run FROM PUBLIC;
REVOKE ALL ON SEQUENCE collect.discord_review_delivery_review_number_seq FROM PUBLIC;

-- Preserve linked drafts when an administrator cancels pending publication.
ALTER TABLE collect.batch_review DROP CONSTRAINT batch_review_check;
ALTER TABLE collect.batch_review ADD CONSTRAINT batch_review_linked_decision_check
 CHECK(post_id IS NULL OR status IN ('APPROVED','REJECTED'));
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
