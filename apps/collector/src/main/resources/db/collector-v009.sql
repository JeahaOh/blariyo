-- Batch owns receipt/runtime writes. API reads explicit projections without queue internals.
ALTER TABLE collect.batch_source ADD COLUMN identity_parser VARCHAR(40),
 ADD COLUMN normalization_version SMALLINT NOT NULL DEFAULT 1 CHECK(normalization_version>0),
 ADD COLUMN identity_hosts TEXT[];

CREATE TABLE collect.batch_source_runtime (
 instance_id UUID NOT NULL,
 source_key VARCHAR(80) NOT NULL REFERENCES collect.batch_source(source_key),
 config_version CHAR(64) NOT NULL CHECK(config_version ~ '^[a-f0-9]{64}$'),
 normalization_version SMALLINT NOT NULL CHECK(normalization_version>0),
 loaded_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 heartbeat_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 effective_policy JSONB NOT NULL,
 PRIMARY KEY(instance_id,source_key),
 CHECK(jsonb_typeof(effective_policy)='object'),
 CHECK(effective_policy-ARRAY['enabled','blockedReason','collectionPolicy','allowedHosts','requestIntervalMs','dailyRequestLimit','maxPages','maxItems','mediaLimits']='{}'::jsonb),
 CHECK(effective_policy ?& ARRAY['enabled','blockedReason','collectionPolicy','allowedHosts','requestIntervalMs','dailyRequestLimit','maxPages','maxItems','mediaLimits']),
 CHECK(jsonb_typeof(effective_policy->'enabled')='boolean'),
 CHECK(effective_policy->>'collectionPolicy' IN ('HOT_LIST','GENERAL_LIST','DETAIL_ONLY','BLOCKED','UNVERIFIED')),
 CHECK(effective_policy->'blockedReason'='null'::jsonb OR effective_policy->>'blockedReason' ~ '^[A-Z][A-Z0-9_]{0,99}$'),
 CHECK(jsonb_typeof(effective_policy->'allowedHosts')='array' AND jsonb_array_length(effective_policy->'allowedHosts') BETWEEN 1 AND 100),
 CHECK((effective_policy->>'requestIntervalMs')::bigint BETWEEN 10000 AND 3600000),
 CHECK((effective_policy->>'dailyRequestLimit')::integer BETWEEN 1 AND 1000000),
 CHECK(effective_policy->>'enabled'='false' OR effective_policy->'dailyRequestLimit'<>'null'::jsonb),
 CHECK((effective_policy->>'maxPages')::integer BETWEEN 1 AND 10),
 CHECK((effective_policy->>'maxItems')::integer BETWEEN 1 AND 100),
 CHECK(jsonb_typeof(effective_policy->'mediaLimits')='object' AND (effective_policy->'mediaLimits')-ARRAY['maxImages','maxFileBytes','maxTotalBytes']='{}'::jsonb),
 CHECK((effective_policy->'mediaLimits') ?& ARRAY['maxImages','maxFileBytes','maxTotalBytes']),
 CHECK((effective_policy#>>'{mediaLimits,maxImages}')::integer BETWEEN 1 AND 200),
 CHECK((effective_policy#>>'{mediaLimits,maxFileBytes}')::integer BETWEEN 1 AND 31457280),
 CHECK((effective_policy#>>'{mediaLimits,maxTotalBytes}')::integer BETWEEN 1 AND 157286400)
);

CREATE FUNCTION collect.guard_source_runtime() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE value JSONB;
BEGIN
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 FOR value IN SELECT * FROM jsonb_array_elements(NEW.effective_policy->'allowedHosts') LOOP
  IF jsonb_typeof(value)<>'string' OR value#>>'{}' !~ '^[A-Za-z0-9]([A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$'
     OR value#>>'{}' ~ '(^|\.)(localhost|local|internal)$' OR value#>>'{}' ~ '^[0-9.]+$' THEN
   RAISE EXCEPTION 'RUNTIME_HOST_INVALID' USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF TG_OP='UPDATE' THEN
  IF (NEW.instance_id,NEW.source_key) IS DISTINCT FROM (OLD.instance_id,OLD.source_key) THEN
   RAISE EXCEPTION 'RUNTIME_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  NEW.loaded_at:=CASE WHEN (NEW.config_version,NEW.normalization_version,NEW.effective_policy)
    IS DISTINCT FROM (OLD.config_version,OLD.normalization_version,OLD.effective_policy) THEN clock_timestamp() ELSE OLD.loaded_at END;
 ELSE NEW.loaded_at:=clock_timestamp(); END IF;
 NEW.heartbeat_at:=clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER guard_source_runtime BEFORE INSERT OR UPDATE ON collect.batch_source_runtime
 FOR EACH ROW EXECUTE FUNCTION collect.guard_source_runtime();

CREATE VIEW collect.batch_runtime_projection AS
SELECT s.source_key,s.host,s.enabled AS registered_enabled,s.identity_parser,s.normalization_version AS registered_normalization_version,
 COALESCE(s.identity_hosts,ARRAY[s.host::text]) AS identity_hosts,
 CASE WHEN COALESCE(a.versions,0)>1 THEN 'CONFLICT' WHEN COALESCE(a.instances,0)>0 THEN 'CURRENT'
      WHEN r.instance_id IS NOT NULL THEN 'STALE' ELSE 'ABSENT' END AS freshness,
 r.config_version,r.normalization_version,r.loaded_at,r.heartbeat_at,r.effective_policy
FROM collect.batch_source s
LEFT JOIN LATERAL (SELECT count(*) AS instances,count(DISTINCT (config_version,normalization_version)) AS versions
 FROM collect.batch_source_runtime WHERE source_key=s.source_key AND heartbeat_at>clock_timestamp()-interval '5 minutes') a ON true
LEFT JOIN LATERAL (SELECT * FROM collect.batch_source_runtime WHERE source_key=s.source_key ORDER BY heartbeat_at DESC,instance_id LIMIT 1) r ON true;

CREATE TABLE collect.batch_input_receipt (
 request_id UUID PRIMARY KEY,
 queue_id UUID,
 item_id UUID,
 state VARCHAR(16) NOT NULL CHECK(state IN ('ACCEPTED','RUNNING','SUCCEEDED','FAILED','BLOCKED','DUPLICATE','EXPIRED')),
 error_code VARCHAR(100) CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]*$'),
 retryable BOOLEAN NOT NULL DEFAULT false,
 version BIGINT NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9007199254740991),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 terminal_at TIMESTAMPTZ(3),
 CHECK((state IN ('ACCEPTED','RUNNING'))=(terminal_at IS NULL)),
 CHECK(NOT retryable OR state='FAILED')
);
CREATE INDEX batch_input_queue ON collect.batch_input_receipt(queue_id);
CREATE INDEX batch_input_item ON collect.batch_input_receipt(item_id);
CREATE VIEW collect.batch_input_projection AS
SELECT request_id,state,item_id,error_code,retryable,version,updated_at,terminal_at FROM collect.batch_input_receipt;

-- A retry keeps the original payload's deadline; a new mailbox does not restart its lifetime.
CREATE FUNCTION collect.web_retry_accessible(request UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF to_regclass('collect.web_collection_request') IS NULL THEN RETURN false; END IF;
 RETURN COALESCE((SELECT w.previous_request_id IS NULL OR EXISTS(
   SELECT 1 FROM collect.batch_input_receipt old JOIN collect.batch_retention r ON r.item_id=old.item_id
   WHERE old.request_id=w.previous_request_id AND old.state='FAILED' AND old.retryable
     AND r.retention_state='LIVE' AND r.expires_at>clock_timestamp())
   FROM collect.web_collection_request w WHERE w.id=request),false);
END
$$;

CREATE FUNCTION collect.assert_web_run_live(run UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM collect.batch_queue q JOIN collect.batch_input_receipt b ON b.queue_id=q.id
    WHERE q.active_run_id=run AND (q.created_at+interval '24 hours'<=clock_timestamp()
      OR NOT collect.web_retry_accessible(b.request_id))) THEN
  RAISE EXCEPTION 'BATCH_ITEM_EXPIRED'; END IF;
END $$;

CREATE FUNCTION collect.fence_web_queue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF NEW.state IN ('QUEUED','RUNNING') AND EXISTS(SELECT 1 FROM collect.batch_input_receipt b
   WHERE b.queue_id=NEW.id AND NOT collect.web_retry_accessible(b.request_id)) THEN
  RAISE EXCEPTION 'REQUEST_RETRY_NOT_ALLOWED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER z_web_queue BEFORE UPDATE ON collect.batch_queue
 FOR EACH ROW EXECUTE FUNCTION collect.fence_web_queue();

CREATE FUNCTION collect.guard_input_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE requested RECORD; queued RECORD;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.terminal_at IS NULL OR (OLD.terminal_at+interval '7 days'>clock_timestamp() AND NOT EXISTS(
   SELECT 1 FROM collect.batch_retention r WHERE r.item_id=OLD.item_id AND r.expires_at<=clock_timestamp())) THEN
   RAISE EXCEPTION 'INPUT_RECEIPT_NOT_EXPIRED' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO requested FROM collect.web_collection_request WHERE id=NEW.request_id;
  IF NOT FOUND OR requested.canonical_url IS NULL OR requested.closed_at IS NOT NULL OR requested.lease_token IS NULL
     OR requested.lease_until<=clock_timestamp() OR requested.accept_before<=clock_timestamp()
     OR NEW.version<>1 OR NEW.state NOT IN ('ACCEPTED','BLOCKED','DUPLICATE','FAILED') THEN
   RAISE EXCEPTION 'INPUT_RECEIPT_LEASE_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NEW.state='ACCEPTED' THEN
   SELECT * INTO queued FROM collect.batch_queue WHERE id=NEW.queue_id;
   IF NOT FOUND OR queued.source_key<>requested.source_key OR queued.state NOT IN ('QUEUED','RUNNING')
      OR collect.identity_hash('v'||requested.normalization_version,queued.canonical_url)<>requested.canonical_hash
      OR collect.identity_hash('v'||requested.normalization_version,queued.source_key,queued.source_post_key)<>requested.post_key_hash
      OR queued.created_at+interval '24 hours'>requested.accept_before THEN
    RAISE EXCEPTION 'INPUT_QUEUE_IDENTITY_CONFLICT' USING ERRCODE='23514'; END IF;
  ELSIF NEW.queue_id IS NOT NULL THEN RAISE EXCEPTION 'INPUT_TERMINAL_QUEUE_FORBIDDEN' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.request_id<>OLD.request_id OR NEW.queue_id IS DISTINCT FROM OLD.queue_id OR NEW.version<>OLD.version+1
     OR OLD.terminal_at IS NOT NULL THEN RAISE EXCEPTION 'INPUT_RECEIPT_IMMUTABLE' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.updated_at:=clock_timestamp();
 NEW.terminal_at:=CASE WHEN NEW.state IN ('ACCEPTED','RUNNING') THEN NULL ELSE clock_timestamp() END;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_input_receipt BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_input_receipt
 FOR EACH ROW EXECUTE FUNCTION collect.guard_input_receipt();

CREATE FUNCTION collect.sync_queue_input_receipts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE value RECORD; item UUID; outcome TEXT; transient BOOLEAN; error TEXT;
BEGIN
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NOT EXISTS(SELECT 1 FROM collect.batch_input_receipt WHERE queue_id=NEW.id AND terminal_at IS NULL) THEN RETURN NEW; END IF;
 SELECT id INTO item FROM collect.batch_item WHERE run_id=NEW.active_run_id ORDER BY id LIMIT 1;
 outcome:=CASE NEW.state WHEN 'QUEUED' THEN 'ACCEPTED' WHEN 'RUNNING' THEN 'RUNNING' WHEN 'COMPLETED' THEN
   CASE WHEN item IS NULL THEN 'DUPLICATE' ELSE 'SUCCEEDED' END WHEN 'BLOCKED' THEN 'BLOCKED' WHEN 'EXPIRED' THEN 'EXPIRED' ELSE 'FAILED' END;
 error:=CASE WHEN outcome IN ('SUCCEEDED','DUPLICATE') THEN NULL ELSE NEW.error_code END;
 transient:=outcome='FAILED' AND error IN ('BATCH_OWNER_LOST','SOURCE_FETCH_FAILED','SOURCE_DNS_FAILED','SOURCE_HTTP_UNAVAILABLE');
 FOR value IN SELECT * FROM collect.batch_input_receipt WHERE queue_id=NEW.id AND terminal_at IS NULL ORDER BY request_id FOR UPDATE LOOP
  UPDATE collect.batch_input_receipt SET state=outcome,item_id=COALESCE(item,item_id),error_code=error,
    retryable=COALESCE(transient,false),version=version+1 WHERE request_id=value.request_id;
  IF outcome NOT IN ('ACCEPTED','RUNNING') THEN PERFORM collect.close_web_request(value.request_id); END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_queue_input_receipts AFTER UPDATE ON collect.batch_queue
 FOR EACH ROW EXECUTE FUNCTION collect.sync_queue_input_receipts();

CREATE FUNCTION collect.cleanup_input_receipts() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry RECORD; tx XID8:=pg_current_xact_id();
BEGIN
 IF to_regclass('collect.web_collection_request') IS NOT NULL THEN
  FOR entry IN SELECT q.id FROM collect.batch_queue q WHERE q.state IN ('QUEUED','RUNNING') AND EXISTS(
    SELECT 1 FROM collect.batch_input_receipt b WHERE b.queue_id=q.id
     AND (q.created_at+interval '24 hours'<=clock_timestamp() OR NOT collect.web_retry_accessible(b.request_id)))
    FOR UPDATE SKIP LOCKED LOOP
   INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_queue',entry.id) ON CONFLICT DO NOTHING;
   UPDATE collect.batch_queue SET state='EXPIRED',error_code='BATCH_QUEUE_EXPIRED',owner_backend_pid=NULL,version=version+1 WHERE id=entry.id;
   DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx AND table_name='batch_queue' AND row_id=entry.id;
  END LOOP;
 END IF;
 IF to_regprocedure('collect.cleanup_web_requests()') IS NOT NULL THEN PERFORM collect.cleanup_web_requests(); END IF;
 DELETE FROM collect.batch_input_receipt b WHERE b.terminal_at IS NOT NULL AND (b.terminal_at+interval '7 days'<=clock_timestamp()
   OR EXISTS(SELECT 1 FROM collect.batch_retention r WHERE r.item_id=b.item_id AND r.expires_at<=clock_timestamp()));
 DELETE FROM collect.batch_source_runtime WHERE heartbeat_at+interval '28 days'<=clock_timestamp();
END $$;
REVOKE ALL ON collect.batch_input_receipt,collect.batch_source_runtime,collect.batch_input_projection,collect.batch_runtime_projection FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION collect.guard_source_runtime(),collect.guard_input_receipt(),collect.sync_queue_input_receipts(),collect.cleanup_input_receipts(),collect.web_retry_accessible(uuid),collect.assert_web_run_live(uuid),collect.fence_web_queue() FROM PUBLIC;
