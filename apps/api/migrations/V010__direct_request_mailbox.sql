-- API-owned Web input mailbox. Batch may call fixed lease/ack functions, never general DML.
CREATE TABLE collect.web_collection_request (
 id UUID PRIMARY KEY,
 actor VARCHAR(100) NOT NULL CHECK(actor ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$'),
 idempotency_key VARCHAR(200) NOT NULL,
 request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32),
 source_key VARCHAR(80) NOT NULL,
 canonical_url TEXT CHECK(canonical_url IS NULL OR length(canonical_url)<=2048),
 canonical_hash BYTEA NOT NULL CHECK(octet_length(canonical_hash)=32),
 post_key_hash BYTEA NOT NULL CHECK(octet_length(post_key_hash)=32),
 normalization_version SMALLINT NOT NULL CHECK(normalization_version>0),
 requested_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 accept_before TIMESTAMPTZ(3) NOT NULL,
 lease_token UUID,
 lease_until TIMESTAMPTZ(3),
 previous_request_id UUID,
 closed_at TIMESTAMPTZ(3),
 state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','DUPLICATE','EXPIRED')),
 UNIQUE(actor,idempotency_key),
 CHECK(accept_before=requested_at+interval '24 hours'),
 CHECK((lease_token IS NULL)=(lease_until IS NULL)),
 CHECK(state='PENDING' OR (canonical_url IS NULL AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX web_request_active_canonical ON collect.web_collection_request(normalization_version,canonical_hash) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX web_request_active_post ON collect.web_collection_request(source_key,normalization_version,post_key_hash) WHERE closed_at IS NULL;
CREATE INDEX web_request_pending ON collect.web_collection_request(accept_before,source_key,id) WHERE canonical_url IS NOT NULL AND closed_at IS NULL;
CREATE TABLE collect.web_collection_request_key (
 actor VARCHAR(100) NOT NULL CHECK(actor ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$'),
 idempotency_key VARCHAR(200) NOT NULL,
 request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32),
 request_id UUID NOT NULL REFERENCES collect.web_collection_request(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 PRIMARY KEY(actor,idempotency_key)
);
REVOKE ALL ON collect.web_collection_request,collect.web_collection_request_key FROM PUBLIC;

CREATE FUNCTION collect.guard_web_request() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE owner_name TEXT;
BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='collect.web_collection_request'::regclass;
 IF TG_OP='INSERT' THEN
  IF NEW.lease_token IS NOT NULL OR NEW.lease_until IS NOT NULL OR NEW.state='EXPIRED'
     OR (NEW.state='PENDING' AND (NEW.closed_at IS NOT NULL OR NEW.canonical_url IS NULL))
     OR abs(extract(epoch FROM clock_timestamp()-NEW.requested_at))>5 THEN
   RAISE EXCEPTION 'WEB_REQUEST_INITIAL_INVALID' USING ERRCODE='23514';
  END IF;
 ELSE
  IF current_user<>owner_name THEN RAISE EXCEPTION 'WEB_REQUEST_FIXED_FUNCTION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF (NEW.id,NEW.actor,NEW.idempotency_key,NEW.request_hash,NEW.source_key,NEW.canonical_hash,NEW.post_key_hash,
      NEW.normalization_version,NEW.requested_at,NEW.accept_before,NEW.previous_request_id)
      IS DISTINCT FROM (OLD.id,OLD.actor,OLD.idempotency_key,OLD.request_hash,OLD.source_key,OLD.canonical_hash,OLD.post_key_hash,
      OLD.normalization_version,OLD.requested_at,OLD.accept_before,OLD.previous_request_id)
     OR (OLD.canonical_url IS NULL AND NEW.canonical_url IS NOT NULL)
     OR (OLD.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at) THEN
   RAISE EXCEPTION 'WEB_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_web_request BEFORE INSERT OR UPDATE OR DELETE ON collect.web_collection_request
 FOR EACH ROW EXECUTE FUNCTION collect.guard_web_request();

CREATE FUNCTION collect.fence_web_retry_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF NEW.previous_request_id IS NOT NULL AND (NOT collect.web_retry_accessible(NEW.id) OR NOT EXISTS(
  SELECT 1 FROM collect.web_collection_request prior WHERE prior.id=NEW.previous_request_id
   AND (prior.source_key,prior.normalization_version,prior.canonical_hash,prior.post_key_hash)
     =(NEW.source_key,NEW.normalization_version,NEW.canonical_hash,NEW.post_key_hash))) THEN
  RAISE EXCEPTION 'REQUEST_RETRY_NOT_ALLOWED' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER fence_web_retry_commit AFTER INSERT ON collect.web_collection_request
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_web_retry_commit();

CREATE FUNCTION collect.claim_web_requests(batch_limit INTEGER DEFAULT 20)
RETURNS TABLE(request_id UUID,source_key TEXT,canonical_url TEXT,canonical_hash BYTEA,post_key_hash BYTEA,
 normalization_version SMALLINT,lease_token UUID,accept_before TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF batch_limit<1 OR batch_limit>20 THEN RAISE EXCEPTION 'WEB_CLAIM_LIMIT_INVALID' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 WITH selected AS (
   SELECT w.id FROM collect.web_collection_request w
   WHERE w.state='PENDING' AND w.closed_at IS NULL AND w.canonical_url IS NOT NULL
     AND w.accept_before>clock_timestamp() AND (w.lease_until IS NULL OR w.lease_until<=clock_timestamp())
   ORDER BY w.source_key,w.requested_at,w.id LIMIT batch_limit FOR UPDATE SKIP LOCKED
 ), claimed AS (
   UPDATE collect.web_collection_request w SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds'
   FROM selected s WHERE w.id=s.id RETURNING w.*
 ) SELECT c.id,c.source_key::text,c.canonical_url,c.canonical_hash,c.post_key_hash,c.normalization_version,c.lease_token,c.accept_before::timestamptz FROM claimed c;
END $$;

CREATE FUNCTION collect.ack_web_request(request_id UUID,token UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE requested collect.web_collection_request%ROWTYPE; accepted RECORD;
BEGIN
 SELECT * INTO requested FROM collect.web_collection_request WHERE id=request_id FOR UPDATE;
 IF NOT FOUND OR requested.lease_token IS DISTINCT FROM token OR requested.lease_until<=clock_timestamp()
   OR requested.accept_before<=clock_timestamp() OR requested.canonical_url IS NULL OR requested.closed_at IS NOT NULL THEN
  RAISE EXCEPTION 'WEB_REQUEST_LEASE_CONFLICT' USING ERRCODE='40001';
 END IF;
 -- The receipt is batch-owned and must be written in this transaction, before clearing the URL.
 SELECT state,version INTO accepted FROM collect.batch_input_receipt WHERE batch_input_receipt.request_id=ack_web_request.request_id
   AND xmin::text=(pg_current_xact_id()::text::numeric % 4294967296)::text;
 IF NOT FOUND OR accepted.version<>1 OR accepted.state NOT IN ('ACCEPTED','DUPLICATE','BLOCKED','FAILED') THEN
  RAISE EXCEPTION 'WEB_REQUEST_RECEIPT_REQUIRED' USING ERRCODE='23514';
 END IF;
 UPDATE collect.web_collection_request SET canonical_url=NULL,lease_token=NULL,lease_until=NULL,
   closed_at=CASE WHEN accepted.state='ACCEPTED' THEN NULL ELSE clock_timestamp() END WHERE id=request_id;
END $$;

CREATE FUNCTION collect.close_web_request(request_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE terminal RECORD;
BEGIN
 SELECT state,terminal_at INTO terminal FROM collect.batch_input_receipt WHERE batch_input_receipt.request_id=close_web_request.request_id;
 IF NOT FOUND OR terminal.state NOT IN ('SUCCEEDED','FAILED','BLOCKED','DUPLICATE','EXPIRED') OR terminal.terminal_at IS NULL THEN
  RAISE EXCEPTION 'WEB_REQUEST_TERMINAL_REQUIRED' USING ERRCODE='23514';
 END IF;
 UPDATE collect.web_collection_request SET closed_at=terminal.terminal_at,canonical_url=NULL,lease_token=NULL,lease_until=NULL
   WHERE id=request_id AND closed_at IS NULL;
END $$;

CREATE FUNCTION collect.cleanup_web_requests() RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE removed BIGINT;
BEGIN
 -- Only unacknowledged mailbox requests expire here; accepted execution remains batch-owned.
 UPDATE collect.web_collection_request SET state='EXPIRED',closed_at=accept_before,canonical_url=NULL,lease_token=NULL,lease_until=NULL
   WHERE closed_at IS NULL AND canonical_url IS NOT NULL AND accept_before<=clock_timestamp();
 DELETE FROM collect.web_collection_request_key WHERE expires_at<=clock_timestamp();
 IF to_regclass('collect.batch_input_receipt') IS NOT NULL THEN
  DELETE FROM collect.web_collection_request w WHERE w.closed_at IS NOT NULL AND (
   w.closed_at+interval '7 days'<=clock_timestamp() OR EXISTS(
    SELECT 1 FROM collect.batch_input_receipt b JOIN collect.batch_retention r ON r.item_id=b.item_id
    WHERE b.request_id=w.id AND r.expires_at<=clock_timestamp()));
 ELSE
  DELETE FROM collect.web_collection_request WHERE closed_at+interval '7 days'<=clock_timestamp();
 END IF;
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END $$;
REVOKE EXECUTE ON FUNCTION collect.guard_web_request(),collect.fence_web_retry_commit(),collect.claim_web_requests(integer),
 collect.ack_web_request(uuid,uuid),collect.close_web_request(uuid),collect.cleanup_web_requests() FROM PUBLIC;
