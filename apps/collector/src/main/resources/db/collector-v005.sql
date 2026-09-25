LOCK TABLE collect.batch_run IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_MIGRATION_REQUIRES_IDLE' USING ERRCODE='55000';
  END IF;
END $$;
-- Durable Discord requests are distinct from collection attempts.
CREATE TABLE collect.batch_queue (
    id UUID PRIMARY KEY,
    source_key VARCHAR(80) NOT NULL REFERENCES collect.batch_source(source_key),
    source_post_key TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    canonical_url_hash BYTEA NOT NULL CHECK(octet_length(canonical_url_hash)=32),
    state VARCHAR(20) NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','RUNNING','COMPLETED','FAILED','BLOCKED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
    active_run_id UUID UNIQUE REFERENCES collect.batch_run(id),
    owner_backend_pid INTEGER,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error_code VARCHAR(80),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX batch_queue_active_post ON collect.batch_queue(source_key,source_post_key) WHERE state IN (
    'QUEUED','RUNNING'
);
CREATE UNIQUE INDEX batch_queue_active_url ON collect.batch_queue(source_key,canonical_url_hash) WHERE state IN (
    'QUEUED','RUNNING'
);
CREATE UNIQUE INDEX batch_queue_running_source ON collect.batch_queue(source_key) WHERE state='RUNNING';
CREATE INDEX batch_queue_ready ON collect.batch_queue(next_attempt_at,created_at) WHERE state IN ('QUEUED','RUNNING');
CREATE TABLE collect.batch_confirmation (
    id UUID PRIMARY KEY,
    trigger_hmac CHAR(64) NOT NULL UNIQUE CHECK(trigger_hmac ~ '^[a-f0-9]{64}$'),
    actor_hmac CHAR(64) NOT NULL CHECK(actor_hmac ~ '^[a-f0-9]{64}$'),
    channel_hmac CHAR(64) NOT NULL CHECK(channel_hmac ~ '^[a-f0-9]{64}$'),
    source_key VARCHAR(80) NOT NULL,
    source_post_key TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+INTERVAL '10 minutes',
    request_id UUID REFERENCES collect.batch_queue(id),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE FUNCTION collect.guard_batch_confirmation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.request_id IS NOT NULL OR NEW.version<>0 THEN RAISE EXCEPTION 'CONFIRMATION_INITIAL_STATE'; END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF OLD.expires_at<=now() OR OLD.request_id IS NOT NULL OR NEW.request_id IS NULL OR NEW.version<>OLD.version+1
       OR (to_jsonb(NEW)-'version'-'request_id') IS DISTINCT FROM (to_jsonb(OLD)-'version'-'request_id')
       OR NOT EXISTS (SELECT 1 FROM collect.batch_queue q WHERE q.id=NEW.request_id AND q.source_key=NEW.source_key
         AND q.source_post_key=NEW.source_post_key AND q.canonical_url=NEW.canonical_url) THEN
      RAISE EXCEPTION 'CONFIRMATION_TRANSITION' USING ERRCODE='23514';
    END IF;
  ELSE RAISE EXCEPTION 'CONFIRMATION_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_confirmation_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_confirmation
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_confirmation();
CREATE FUNCTION collect.guard_batch_queue() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE r collect.batch_run%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'BATCH_QUEUE_IMMUTABLE'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'QUEUED' OR NEW.attempts<>0 OR NEW.version<>0 OR NEW.active_run_id IS NOT NULL OR NEW.owner_backend_pid IS NOT NULL THEN
      RAISE EXCEPTION 'BATCH_QUEUE_INITIAL_STATE' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM collect.assert_source_owner(NEW.source_key);
  IF OLD.state NOT IN ('QUEUED','RUNNING') OR NEW.version<>OLD.version+1
    OR (NEW.id,NEW.source_key,NEW.source_post_key,NEW.canonical_url,NEW.canonical_url_hash,NEW.created_at)
      IS DISTINCT FROM (OLD.id,OLD.source_key,OLD.source_post_key,OLD.canonical_url,OLD.canonical_url_hash,OLD.created_at) THEN
    RAISE EXCEPTION 'BATCH_QUEUE_TRANSITION' USING ERRCODE='23514';
  END IF;
  IF OLD.state='QUEUED' THEN
    IF NEW.state<>'RUNNING' OR NEW.attempts<>OLD.attempts+1 OR OLD.next_attempt_at>now()
       OR NEW.active_run_id IS NOT NULL OR NEW.error_code IS NOT NULL THEN RAISE EXCEPTION 'BATCH_QUEUE_CLAIM' USING ERRCODE='23514'; END IF;
    NEW.owner_backend_pid:=pg_backend_pid();
  ELSE
    IF NEW.attempts<>OLD.attempts THEN RAISE EXCEPTION 'BATCH_QUEUE_ATTEMPTS'; END IF;
    IF NEW.state='RUNNING' THEN
      IF OLD.owner_backend_pid<>pg_backend_pid() OR NEW.owner_backend_pid IS DISTINCT FROM OLD.owner_backend_pid
        OR OLD.active_run_id IS NOT NULL OR NEW.active_run_id IS NULL THEN RAISE EXCEPTION 'BATCH_QUEUE_OWNER_LOST'; END IF;
      PERFORM collect.assert_run_owner(NEW.active_run_id);
      IF NOT EXISTS (SELECT 1 FROM collect.batch_run WHERE id=NEW.active_run_id AND source_key=NEW.source_key) THEN
        RAISE EXCEPTION 'BATCH_QUEUE_RUN_SOURCE';
      END IF;
    ELSE
      IF NEW.active_run_id IS DISTINCT FROM OLD.active_run_id OR NEW.owner_backend_pid IS NOT NULL THEN RAISE EXCEPTION 'BATCH_QUEUE_RESULT'; END IF;
      SELECT * INTO r FROM collect.batch_run WHERE id=NEW.active_run_id;
      IF NEW.state='COMPLETED' THEN
        IF r.state IS DISTINCT FROM 'COMPLETED' THEN RAISE EXCEPTION 'BATCH_QUEUE_NOT_COMPLETE'; END IF;
      ELSIF NEW.state='BLOCKED' THEN
        IF r.state IS DISTINCT FROM 'BLOCKED' OR NEW.error_code IS NULL THEN RAISE EXCEPTION 'BATCH_QUEUE_NOT_BLOCKED'; END IF;
      ELSIF NEW.state IN ('QUEUED','FAILED') THEN
        IF NEW.error_code IS NULL OR (NEW.active_run_id IS NOT NULL AND r.state<>'FAILED')
          OR (NEW.active_run_id IS NULL AND NEW.error_code<>'BATCH_OWNER_LOST') THEN RAISE EXCEPTION 'BATCH_QUEUE_NOT_FAILED'; END IF;
        IF NEW.state='QUEUED' AND (NEW.attempts>=3 OR NEW.next_attempt_at<now()+interval '30 seconds'
          OR NEW.error_code NOT IN ('BATCH_OWNER_LOST','SOURCE_FETCH_FAILED','SOURCE_DNS_FAILED','SOURCE_HTTP_UNAVAILABLE')) THEN
          RAISE EXCEPTION 'BATCH_QUEUE_RETRY_POLICY';
        END IF;
      ELSE RAISE EXCEPTION 'BATCH_QUEUE_TRANSITION';
      END IF;
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $$;
CREATE TRIGGER batch_queue_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_queue
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_queue();

-- Preserve any legacy direct-queue receipts and move their pending payload to the durable queue.
DO $$ DECLARE entry RECORD; BEGIN
  FOR entry IN SELECT r.id,r.source_key,i.source_post_key,i.canonical_url,i.canonical_url_hash
      FROM collect.batch_run r JOIN collect.batch_item i ON i.run_id=r.id WHERE r.state='QUEUED' LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('collector-source:'||entry.source_key,0));
    INSERT INTO collect.batch_queue(id,source_key,source_post_key,canonical_url,canonical_url_hash)
      VALUES(entry.id,entry.source_key,entry.source_post_key,entry.canonical_url,entry.canonical_url_hash);
    UPDATE collect.batch_run SET state='FAILED',finished_at=now(),checkpoint=checkpoint||'{"reason":"BATCH_QUEUE_MIGRATED"}'::jsonb,version=version+1 WHERE id=entry.id;
  END LOOP;
END $$;

REVOKE ALL ON collect.batch_queue,collect.batch_confirmation FROM public;
