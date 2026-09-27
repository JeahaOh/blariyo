-- D01 restricted purge path. This migration installs capability; activation is separately gated.
LOCK TABLE collect.batch_run IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_MIGRATION_REQUIRES_IDLE';
  END IF;
END $$;
CREATE TABLE collect.batch_retention_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton),
  selective_backup_verified BOOLEAN NOT NULL DEFAULT false,
  backup_receipt_hash BYTEA CHECK(backup_receipt_hash IS NULL OR octet_length(backup_receipt_hash)=32),
  CHECK(NOT selective_backup_verified OR backup_receipt_hash IS NOT NULL)
);
INSERT INTO collect.batch_retention_control(singleton) VALUES(true);
-- Only a SECURITY DEFINER purge transaction can create these private row capabilities.
CREATE TABLE collect.batch_purge_scope (
  transaction_id XID8 NOT NULL,
  table_name NAME NOT NULL,
  row_id UUID NOT NULL,
  PRIMARY KEY(transaction_id,table_name,row_id)
);
REVOKE ALL ON collect.batch_retention_control,collect.batch_purge_scope FROM PUBLIC;
CREATE FUNCTION collect.purge_authorized(table_name TEXT,row_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM collect.batch_purge_scope s WHERE s.transaction_id=pg_current_xact_id_if_assigned()
    AND s.table_name=$1 AND s.row_id=$2)
$$;
REVOKE ALL ON FUNCTION collect.purge_authorized(TEXT,UUID) FROM PUBLIC;

-- Preserve each prior trigger body. Add a private transaction/row capability, never a session flag.
DO $$ DECLARE function_name TEXT; definition TEXT; prefix TEXT; BEGIN
  prefix:=$guard$BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND collect.purge_authorized(TG_TABLE_NAME,
    CASE WHEN TG_TABLE_NAME IN ('batch_report','batch_checkpoint') THEN
      (CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END->>'run_id')::uuid
    WHEN TG_TABLE_NAME='batch_media_correction' THEN
      (CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END->>'operation_id')::uuid
    ELSE (CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END->>'id')::uuid END) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
$guard$;
  FOREACH function_name IN ARRAY ARRAY['guard_batch_item','guard_batch_media','guard_batch_run',
    'guard_batch_failure','guard_batch_report','guard_batch_checkpoint','guard_media_correction',
    'guard_batch_queue','guard_batch_confirmation'] LOOP
    SELECT pg_get_functiondef(to_regprocedure('collect.'||function_name||'()')) INTO definition;
    IF definition IS NULL OR position('BEGIN' in definition)=0 THEN RAISE EXCEPTION 'RETENTION_GUARD_MISSING'; END IF;
    EXECUTE regexp_replace(definition,'\mBEGIN\M',prefix);
  END LOOP;
END $$;

CREATE FUNCTION collect.assert_purge_lease(item UUID,owner_token UUID,fence BIGINT)
RETURNS collect.batch_retention LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle collect.batch_retention%ROWTYPE;
BEGIN
  IF item IS NULL OR owner_token IS NULL OR fence IS NULL THEN RAISE EXCEPTION 'PURGE_LEASE_ARGUMENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||item,0));
  SELECT * INTO lifecycle FROM collect.batch_retention WHERE item_id=item FOR UPDATE;
  IF NOT FOUND OR lifecycle.purge_owner IS DISTINCT FROM owner_token OR lifecycle.version<>fence
     OR lifecycle.retention_state<>'PURGE_PENDING' OR lifecycle.purge_lease_until<=clock_timestamp()
     OR lifecycle.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'PURGE_LEASE_LOST' USING ERRCODE='55000'; END IF;
  RETURN lifecycle;
END $$;
CREATE FUNCTION collect.claim_retention(owner_token UUID,maximum INTEGER DEFAULT 20)
RETURNS SETOF collect.batch_retention LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE candidate RECORD; lifecycle collect.batch_retention%ROWTYPE;
BEGIN
  IF owner_token IS NULL OR maximum IS NULL OR maximum NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'PURGE_CLAIM_ARGUMENT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM collect.batch_retention_control WHERE selective_backup_verified) THEN
    RAISE EXCEPTION 'RETENTION_BACKUP_GATE_CLOSED' USING ERRCODE='55000';
  END IF;
  FOR candidate IN SELECT item_id FROM collect.batch_retention
      WHERE retention_state<>'PURGED' AND expires_at<=clock_timestamp()
        AND (purge_lease_until IS NULL OR purge_lease_until<=clock_timestamp())
        AND (next_attempt_at IS NULL OR next_attempt_at<=clock_timestamp()) ORDER BY expires_at,item_id LIMIT maximum LOOP
    IF NOT pg_try_advisory_xact_lock(hashtextextended('batch-review:'||candidate.item_id,0)) THEN CONTINUE; END IF;
    SELECT * INTO lifecycle FROM collect.batch_retention WHERE item_id=candidate.item_id FOR UPDATE SKIP LOCKED;
    IF NOT FOUND OR lifecycle.retention_state='PURGED' OR lifecycle.expires_at>clock_timestamp()
       OR lifecycle.purge_lease_until>clock_timestamp() THEN CONTINUE; END IF;
    UPDATE collect.batch_retention SET retention_state='PURGE_PENDING',purge_owner=owner_token,
      purge_lease_until=clock_timestamp()+interval '120 seconds',version=version+1,
      purge_attempts=purge_attempts+1 WHERE item_id=lifecycle.item_id RETURNING * INTO lifecycle;
    INSERT INTO collect.batch_purge_object(item_id,object_key,kind)
      SELECT lifecycle.item_id,raw_object_key,'RAW' FROM collect.batch_item
      WHERE id=lifecycle.item_id AND raw_object_key IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO collect.batch_purge_object(item_id,object_key,kind,expected_hash)
      SELECT lifecycle.item_id,object_key,'MEDIA',sha256 FROM collect.batch_media
      WHERE item_id=lifecycle.item_id AND object_key IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO collect.batch_purge_object(item_id,object_key,kind,expected_hash)
      SELECT lifecycle.item_id,object_key,'REPORT',sha256 FROM collect.batch_report
      WHERE run_id=lifecycle.run_id AND object_key IS NOT NULL ON CONFLICT DO NOTHING;
    RETURN NEXT lifecycle;
  END LOOP;
END $$;
CREATE FUNCTION collect.heartbeat_retention(item UUID,owner_token UUID,fence BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  PERFORM collect.assert_purge_lease(item,owner_token,fence);
  UPDATE collect.batch_retention SET purge_lease_until=clock_timestamp()+interval '120 seconds' WHERE item_id=item;
END $$;
CREATE FUNCTION collect.retention_objects(item UUID,owner_token UUID,fence BIGINT)
RETURNS SETOF collect.batch_purge_object LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  PERFORM collect.assert_purge_lease(item,owner_token,fence);
  RETURN QUERY SELECT * FROM collect.batch_purge_object WHERE item_id=item ORDER BY object_key;
END $$;
CREATE FUNCTION collect.record_purge_inventory(item UUID,owner_token UUID,fence BIGINT,key TEXT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle collect.batch_retention%ROWTYPE;
BEGIN
  lifecycle:=collect.assert_purge_lease(item,owner_token,fence);
  IF key IS NULL OR NOT (key LIKE 'collect/raw/'||lifecycle.run_id||'/'||item||'.%'
    OR key LIKE 'collect/media/'||lifecycle.run_id||'/'||item||'/%'
    OR key='collect/report/'||lifecycle.run_id||'.jsonl') THEN
    RAISE EXCEPTION 'PURGE_OBJECT_SCOPE' USING ERRCODE='42501';
  END IF;
  INSERT INTO collect.batch_purge_object(item_id,object_key,kind) VALUES(item,key,'ORPHAN')
    ON CONFLICT(item_id,object_key) DO UPDATE SET deletion_state='PENDING';
END $$;
CREATE FUNCTION collect.record_purge_result(item UUID,owner_token UUID,fence BIGINT,key TEXT,deleted BOOLEAN,error_code TEXT DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  PERFORM collect.assert_purge_lease(item,owner_token,fence);
  IF deleted IS NULL OR (NOT deleted AND (error_code IS NULL OR error_code !~ '^[A-Z][A-Z0-9_]{1,79}$')) THEN
    RAISE EXCEPTION 'PURGE_RESULT_ARGUMENT';
  END IF;
  UPDATE collect.batch_purge_object SET deletion_state=CASE WHEN deleted THEN 'DELETED' ELSE 'FAILED' END,
    attempts=attempts+1,last_error_code=CASE WHEN deleted THEN NULL ELSE error_code END WHERE item_id=item AND object_key=key;
  IF NOT FOUND THEN RAISE EXCEPTION 'PURGE_OBJECT_UNKNOWN'; END IF;
END $$;
CREATE FUNCTION collect.fail_retention(item UUID,owner_token UUID,fence BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle collect.batch_retention%ROWTYPE;
BEGIN
  lifecycle:=collect.assert_purge_lease(item,owner_token,fence);
  UPDATE collect.batch_retention SET retention_state='PURGE_FAILED',purge_owner=NULL,purge_lease_until=NULL,
    next_attempt_at=clock_timestamp()+CASE lifecycle.purge_attempts WHEN 1 THEN interval '1 minute'
      WHEN 2 THEN interval '5 minutes' WHEN 3 THEN interval '30 minutes' ELSE interval '1 hour' END,
    version=version+1 WHERE item_id=item;
END $$;

CREATE FUNCTION collect.finish_retention(item UUID,owner_token UUID,fence BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle collect.batch_retention%ROWTYPE; tx XID8:=pg_current_xact_id();
BEGIN
  lifecycle:=collect.assert_purge_lease(item,owner_token,fence);
  IF EXISTS(SELECT 1 FROM collect.batch_purge_object WHERE item_id=item AND deletion_state<>'DELETED') THEN
    RAISE EXCEPTION 'PURGE_OBJECTS_REMAIN' USING ERRCODE='55000';
  END IF;
  -- API's own function checks post origin and removes only its expired review/receipt rows.
  PERFORM collect.cleanup_expired_batch_review(item);
  INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_item',item) ON CONFLICT DO NOTHING;
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media',id FROM collect.batch_media WHERE item_id=item ON CONFLICT DO NOTHING;
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media_correction',c.operation_id FROM collect.batch_media_correction c
    JOIN collect.batch_media m ON m.id=c.media_id JOIN collect.batch_item i ON i.id=m.item_id
    WHERE i.run_id=lifecycle.run_id ON CONFLICT DO NOTHING;
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_failure',id FROM collect.batch_failure WHERE run_id=lifecycle.run_id ON CONFLICT DO NOTHING;
  IF lifecycle.run_id IS NOT NULL THEN
    INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_report',lifecycle.run_id),(tx,'batch_checkpoint',lifecycle.run_id),(tx,'batch_run',lifecycle.run_id) ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM collect.batch_media_correction WHERE media_id IN (SELECT m.id FROM collect.batch_media m JOIN collect.batch_item i ON i.id=m.item_id WHERE i.run_id=lifecycle.run_id);
  DELETE FROM collect.batch_failure WHERE run_id=lifecycle.run_id;
  DELETE FROM collect.batch_report WHERE run_id=lifecycle.run_id;
  DELETE FROM collect.batch_checkpoint WHERE run_id=lifecycle.run_id;
  UPDATE collect.batch_run SET checkpoint='{}'::jsonb,report_object_key=NULL,
    payload_purged_at=COALESCE(payload_purged_at,clock_timestamp()),
    state=CASE WHEN state='RUNNING' THEN 'FAILED' ELSE state END,
    finished_at=COALESCE(finished_at,clock_timestamp()) WHERE id=lifecycle.run_id;
  DELETE FROM collect.batch_media WHERE item_id=item;
  DELETE FROM collect.batch_item WHERE id=item;
  DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx;
  UPDATE collect.batch_retention SET retention_state='PURGED',purged_at=clock_timestamp(),purge_owner=NULL,
    purge_lease_until=NULL,next_attempt_at=NULL,version=version+1 WHERE item_id=item;
END $$;
REVOKE ALL ON FUNCTION collect.assert_purge_lease(UUID,UUID,BIGINT),collect.claim_retention(UUID,INTEGER),
  collect.heartbeat_retention(UUID,UUID,BIGINT),collect.retention_objects(UUID,UUID,BIGINT),
  collect.record_purge_inventory(UUID,UUID,BIGINT,TEXT),collect.record_purge_result(UUID,UUID,BIGINT,TEXT,BOOLEAN,TEXT),
  collect.fail_retention(UUID,UUID,BIGINT),collect.finish_retention(UUID,UUID,BIGINT) FROM PUBLIC;

-- A complete inventory detects a late PUT even after a previous purge succeeded.
-- Unknown objects are eligible only during the explicit, quiesced restore workflow.
CREATE FUNCTION collect.observe_retention_object(key TEXT,restore_inventory BOOLEAN DEFAULT false) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE candidate UUID; lifecycle collect.batch_retention%ROWTYPE; now_at TIMESTAMPTZ(3):=clock_timestamp();
BEGIN
  IF key IS NULL OR key !~ '^collect/(raw|media|report)/[A-Za-z0-9._/-]+$'
    OR key ~ '(^|/)\.\.?(/|$)' OR key LIKE '%//%' THEN RAISE EXCEPTION 'PURGE_OBJECT_SCOPE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM collect.batch_retention_control WHERE selective_backup_verified) THEN
    RAISE EXCEPTION 'RETENTION_BACKUP_GATE_CLOSED';
  END IF;
  SELECT r.item_id INTO candidate FROM collect.batch_retention r
    LEFT JOIN collect.batch_item i ON i.id=r.item_id
    WHERE i.raw_object_key=key
      OR EXISTS(SELECT 1 FROM collect.batch_media m WHERE m.item_id=r.item_id AND m.object_key=key)
      OR EXISTS(SELECT 1 FROM collect.batch_purge_object o WHERE o.item_id=r.item_id AND o.object_key=key)
      OR key LIKE 'collect/raw/'||r.run_id||'/'||r.item_id||'.%'
      OR key LIKE 'collect/media/'||r.run_id||'/'||r.item_id||'/%'
      OR key='collect/report/'||r.run_id||'.jsonl'
    ORDER BY r.expires_at,r.item_id LIMIT 1;
  IF candidate IS NULL THEN
    IF NOT restore_inventory THEN
      -- No-item runs retain their report for 28 days; restored payload-less runs are orphans.
      IF EXISTS(SELECT 1 FROM collect.batch_run r WHERE key='collect/report/'||r.id||'.jsonl'
        AND r.started_at+interval '28 days'>now_at) THEN RETURN NULL; END IF;
      RAISE EXCEPTION 'RETENTION_ORPHAN_REQUIRES_QUIESCED_INVENTORY';
    END IF;
    IF EXISTS(SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
      RAISE EXCEPTION 'RESTORE_REQUIRES_COLLECTION_IDLE';
    END IF;
    candidate:=gen_random_uuid();
    PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||candidate,0));
    INSERT INTO collect.batch_retention(item_id,collected_at,expires_at) VALUES(candidate,now_at,now_at);
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||candidate,0));
    SELECT * INTO lifecycle FROM collect.batch_retention WHERE item_id=candidate FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RETENTION_INVENTORY_RACE'; END IF;
    -- A restore omits direct payload, so its objects expire immediately, even if the old ledger was live.
    IF restore_inventory AND NOT EXISTS(SELECT 1 FROM collect.batch_item WHERE id=candidate) THEN
      IF EXISTS(SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN RAISE EXCEPTION 'RESTORE_REQUIRES_COLLECTION_IDLE'; END IF;
      UPDATE collect.batch_retention SET expires_at=GREATEST(collected_at,now_at) WHERE item_id=candidate;
    ELSIF lifecycle.expires_at>now_at THEN RETURN NULL;
    END IF;
    IF lifecycle.retention_state='PURGED' THEN
      UPDATE collect.batch_retention SET retention_state='PURGE_FAILED',purged_at=NULL,
        next_attempt_at=now_at,version=version+1 WHERE item_id=candidate;
    END IF;
  END IF;
  INSERT INTO collect.batch_purge_object(item_id,object_key,kind) VALUES(candidate,key,'ORPHAN')
    ON CONFLICT(item_id,object_key) DO UPDATE SET deletion_state='PENDING';
  RETURN candidate;
END $$;

CREATE FUNCTION collect.retention_backlog() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM collect.batch_retention WHERE expires_at<=clock_timestamp() AND retention_state<>'PURGED')
$$;
CREATE FUNCTION collect.cleanup_retention_ledger() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry RECORD; removed INTEGER:=0;
BEGIN
  FOR entry IN SELECT item_id FROM collect.batch_retention WHERE retention_state='PURGED'
    AND purged_at<=clock_timestamp()-interval '7 days' ORDER BY purged_at LIMIT 100 LOOP
    IF NOT pg_try_advisory_xact_lock(hashtextextended('batch-review:'||entry.item_id,0)) THEN CONTINUE; END IF;
    PERFORM 1 FROM collect.batch_retention WHERE item_id=entry.item_id AND retention_state='PURGED'
      AND purged_at<=clock_timestamp()-interval '7 days' FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    DELETE FROM collect.batch_purge_object WHERE item_id=entry.item_id;
    DELETE FROM collect.batch_retention WHERE item_id=entry.item_id;
    removed:=removed+1;
  END LOOP;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION collect.observe_retention_object(TEXT,BOOLEAN),collect.retention_backlog(),
  collect.cleanup_retention_ledger() FROM PUBLIC;

-- Auxiliary payloads have independent TTLs; a terminal receipt never needs its URL.
ALTER TABLE collect.batch_queue ALTER COLUMN source_post_key DROP NOT NULL,
  ALTER COLUMN canonical_url DROP NOT NULL, ALTER COLUMN canonical_url_hash DROP NOT NULL,
  ADD COLUMN terminal_at TIMESTAMPTZ(3);
ALTER TABLE collect.batch_queue DROP CONSTRAINT batch_queue_state_check;
ALTER TABLE collect.batch_queue ADD CONSTRAINT batch_queue_state_check
  CHECK(state IN ('QUEUED','RUNNING','COMPLETED','FAILED','BLOCKED','EXPIRED'));
CREATE TABLE collect.batch_confirmation_receipt (
  trigger_hmac CHAR(64) PRIMARY KEY CHECK(trigger_hmac ~ '^[a-f0-9]{64}$'),
  request_id UUID NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp()+interval '24 hours'
);
REVOKE ALL ON collect.batch_confirmation_receipt FROM PUBLIC;
CREATE FUNCTION collect.scrub_queue_terminal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  IF NEW.state NOT IN ('QUEUED','RUNNING') THEN
    NEW.canonical_url:=NULL;NEW.source_post_key:=NULL;NEW.canonical_url_hash:=NULL;
    NEW.terminal_at:=COALESCE(OLD.terminal_at,CASE WHEN OLD.state NOT IN ('QUEUED','RUNNING') THEN OLD.updated_at ELSE clock_timestamp() END);
  ELSE
    IF NEW.canonical_url IS NULL OR NEW.source_post_key IS NULL OR NEW.canonical_url_hash IS NULL
      OR clock_timestamp()>=NEW.created_at+interval '24 hours' THEN RAISE EXCEPTION 'BATCH_QUEUE_EXPIRED'; END IF;
    NEW.terminal_at:=NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_queue_retention BEFORE INSERT OR UPDATE ON collect.batch_queue
  FOR EACH ROW EXECUTE FUNCTION collect.scrub_queue_terminal();
CREATE FUNCTION collect.scrub_confirmation_payload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  IF NEW.request_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO collect.batch_confirmation_receipt(trigger_hmac,request_id) VALUES(NEW.trigger_hmac,NEW.request_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO collect.batch_purge_scope VALUES(pg_current_xact_id(),'batch_confirmation',NEW.id) ON CONFLICT DO NOTHING;
  DELETE FROM collect.batch_confirmation WHERE id=NEW.id;
  DELETE FROM collect.batch_purge_scope WHERE transaction_id=pg_current_xact_id() AND table_name='batch_confirmation' AND row_id=NEW.id;
  RETURN NULL;
END $$;
CREATE TRIGGER confirmation_payload_closed AFTER UPDATE ON collect.batch_confirmation
  FOR EACH ROW EXECUTE FUNCTION collect.scrub_confirmation_payload();
CREATE FUNCTION collect.complete_confirmation(confirmation UUID,actor TEXT,channel TEXT,replay_hmac TEXT,request UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE pending collect.batch_confirmation%ROWTYPE;
BEGIN
  IF replay_hmac IS NULL OR replay_hmac !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'CONFIRMATION_RECEIPT_INVALID'; END IF;
  SELECT * INTO pending FROM collect.batch_confirmation WHERE id=confirmation FOR UPDATE;
  IF NOT FOUND OR pending.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CONFIRMATION_EXPIRED'; END IF;
  IF pending.actor_hmac IS DISTINCT FROM actor OR pending.channel_hmac IS DISTINCT FROM channel THEN
    RAISE EXCEPTION 'CONFIRMATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
  -- Existing ownership trigger validates the request source/post/URL and transition.
  UPDATE collect.batch_confirmation SET request_id=request,version=version+1 WHERE id=confirmation;
  INSERT INTO collect.batch_confirmation_receipt(trigger_hmac,request_id) VALUES(replay_hmac,request);
  RETURN request;
END $$;

CREATE FUNCTION collect.cleanup_retention_metadata() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry RECORD; tx XID8:=pg_current_xact_id();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM collect.batch_retention_control WHERE selective_backup_verified) THEN
    RAISE EXCEPTION 'RETENTION_BACKUP_GATE_CLOSED'; END IF;
  FOR entry IN SELECT id FROM collect.batch_confirmation WHERE expires_at<=clock_timestamp()
    OR request_id IS NOT NULL FOR UPDATE SKIP LOCKED LOOP
    INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_confirmation',entry.id) ON CONFLICT DO NOTHING;
    DELETE FROM collect.batch_confirmation WHERE id=entry.id;
  END LOOP;
  DELETE FROM collect.batch_confirmation_receipt WHERE expires_at<=clock_timestamp();
  FOR entry IN SELECT q.id FROM collect.batch_queue q WHERE
      (q.state IN ('QUEUED','RUNNING') AND (q.created_at+interval '24 hours'<=clock_timestamp()
        OR EXISTS(SELECT 1 FROM collect.batch_retention r WHERE r.run_id=q.active_run_id AND r.expires_at<=clock_timestamp())))
      OR (q.state NOT IN ('QUEUED','RUNNING') AND q.canonical_url IS NOT NULL)
      OR q.terminal_at+interval '7 days'<=clock_timestamp()
      FOR UPDATE SKIP LOCKED LOOP
    INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_queue',entry.id) ON CONFLICT DO NOTHING;
    UPDATE collect.batch_queue SET state=CASE WHEN state IN ('QUEUED','RUNNING') THEN 'EXPIRED' ELSE state END,
      canonical_url=NULL,source_post_key=NULL,canonical_url_hash=NULL,owner_backend_pid=NULL,
      error_code=CASE WHEN state IN ('QUEUED','RUNNING') THEN 'BATCH_QUEUE_EXPIRED' ELSE error_code END,
      terminal_at=COALESCE(terminal_at,updated_at),version=version+1 WHERE id=entry.id;
    -- Pending confirmations refer to this queue only until their immediate scrub transaction.
    DELETE FROM collect.batch_queue WHERE id=entry.id AND terminal_at+interval '7 days'<=clock_timestamp();
  END LOOP;
  IF to_regprocedure('collect.cleanup_input_receipts()') IS NOT NULL THEN PERFORM collect.cleanup_input_receipts(); END IF;
  DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx;
END $$;

CREATE FUNCTION collect.assert_run_payload_live(run UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry RECORD; started TIMESTAMPTZ;
BEGIN
  SELECT started_at INTO started FROM collect.batch_run WHERE id=run;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_RUN_NOT_FOUND'; END IF;
  IF to_regprocedure('collect.assert_web_run_live(uuid)') IS NOT NULL THEN
    PERFORM collect.assert_web_run_live(run);
  END IF;
  IF (started+interval '28 days'<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM collect.batch_retention WHERE run_id=run))
     OR EXISTS(SELECT 1 FROM collect.batch_queue WHERE active_run_id=run AND state='EXPIRED') THEN
    RAISE EXCEPTION 'BATCH_ITEM_EXPIRED'; END IF;
  FOR entry IN SELECT item_id FROM collect.batch_retention WHERE run_id=run ORDER BY item_id LOOP
    PERFORM collect.assert_item_live(entry.item_id);
  END LOOP;
END $$;
CREATE FUNCTION collect.fence_auxiliary_payload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE row_data JSONB:=to_jsonb(NEW); identifier UUID; run UUID;
BEGIN
  identifier:=CASE WHEN TG_TABLE_NAME IN ('batch_report','batch_checkpoint') THEN (row_data->>'run_id')::uuid
    WHEN TG_TABLE_NAME='batch_media_correction' THEN (row_data->>'operation_id')::uuid ELSE (row_data->>'id')::uuid END;
  IF collect.purge_authorized(TG_TABLE_NAME,identifier) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='batch_media' THEN
    PERFORM collect.assert_item_live(NEW.item_id);
  ELSIF TG_TABLE_NAME='batch_media_correction' THEN
    PERFORM collect.assert_item_live((SELECT item_id FROM collect.batch_media WHERE id=NEW.media_id));
  ELSE
    run:=(row_data->>'run_id')::uuid;
    PERFORM collect.assert_run_payload_live(run);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_media_retention BEFORE INSERT OR UPDATE ON collect.batch_media
  FOR EACH ROW EXECUTE FUNCTION collect.fence_auxiliary_payload();
CREATE TRIGGER a_failure_retention BEFORE INSERT OR UPDATE ON collect.batch_failure
  FOR EACH ROW EXECUTE FUNCTION collect.fence_auxiliary_payload();
CREATE TRIGGER a_report_retention BEFORE INSERT OR UPDATE ON collect.batch_report
  FOR EACH ROW EXECUTE FUNCTION collect.fence_auxiliary_payload();
CREATE TRIGGER a_checkpoint_retention BEFORE INSERT OR UPDATE ON collect.batch_checkpoint
  FOR EACH ROW EXECUTE FUNCTION collect.fence_auxiliary_payload();
CREATE TRIGGER a_correction_retention BEFORE INSERT OR UPDATE ON collect.batch_media_correction
  FOR EACH ROW EXECUTE FUNCTION collect.fence_auxiliary_payload();
CREATE FUNCTION collect.fence_item_payload_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  PERFORM collect.assert_item_live((to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='batch_item' THEN 'id' ELSE 'item_id' END)::uuid);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER item_payload_commit AFTER INSERT OR UPDATE ON collect.batch_item
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_item_payload_commit();
CREATE CONSTRAINT TRIGGER media_payload_commit AFTER INSERT OR UPDATE ON collect.batch_media
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_item_payload_commit();
REVOKE ALL ON FUNCTION collect.scrub_queue_terminal(),collect.scrub_confirmation_payload(),
  collect.complete_confirmation(UUID,TEXT,TEXT,TEXT,UUID),collect.cleanup_retention_metadata(),
  collect.assert_run_payload_live(UUID),collect.fence_auxiliary_payload(),collect.fence_item_payload_commit() FROM PUBLIC;

-- No payload may be committed after expiry, including a shared run report.
CREATE FUNCTION collect.fence_run_payload_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME='batch_run' AND to_jsonb(NEW)->'checkpoint'='{}'::jsonb AND to_jsonb(NEW)->>'report_object_key' IS NULL THEN RETURN NULL; END IF;
  PERFORM collect.assert_run_payload_live((to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='batch_run' THEN 'id' ELSE 'run_id' END)::uuid);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER run_payload_commit AFTER UPDATE ON collect.batch_run
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_run_payload_commit();
CREATE CONSTRAINT TRIGGER report_payload_commit AFTER INSERT OR UPDATE ON collect.batch_report
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_run_payload_commit();
CREATE CONSTRAINT TRIGGER checkpoint_payload_commit AFTER INSERT OR UPDATE ON collect.batch_checkpoint
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_run_payload_commit();
REVOKE ALL ON FUNCTION collect.fence_run_payload_commit() FROM PUBLIC;

ALTER TABLE collect.batch_run ADD COLUMN payload_purged_at TIMESTAMPTZ(3);
CREATE FUNCTION collect.prepare_expired_run_retention() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE entry RECORD; tx XID8:=pg_current_xact_id();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM collect.batch_retention_control WHERE selective_backup_verified) THEN
    RAISE EXCEPTION 'RETENTION_BACKUP_GATE_CLOSED'; END IF;
  -- Empty/failed runs can have reports and checkpoints without an item.
  FOR entry IN SELECT r.id,r.started_at FROM collect.batch_run r
      WHERE r.started_at+interval '28 days'<=clock_timestamp() AND r.payload_purged_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM collect.batch_retention l WHERE l.run_id=r.id)
        AND NOT EXISTS(SELECT 1 FROM collect.batch_item i WHERE i.run_id=r.id)
      ORDER BY r.started_at,r.id LIMIT 100 FOR UPDATE OF r SKIP LOCKED LOOP
    IF EXISTS(SELECT 1 FROM collect.batch_retention WHERE run_id=entry.id) THEN CONTINUE; END IF;
    INSERT INTO collect.batch_retention(item_id,run_id,collected_at,expires_at)
      VALUES(gen_random_uuid(),entry.id,entry.started_at,entry.started_at+interval '28 days');
  END LOOP;
  -- Minimal FK shells are removed only after the final child and all object readbacks.
  FOR entry IN SELECT r.id FROM collect.batch_run r
    WHERE NOT EXISTS(SELECT 1 FROM collect.batch_item i WHERE i.run_id=r.id)
      AND NOT EXISTS(SELECT 1 FROM collect.batch_queue q WHERE q.active_run_id=r.id)
      AND NOT EXISTS(SELECT 1 FROM collect.batch_retention l WHERE l.run_id=r.id AND l.retention_state<>'PURGED')
      AND COALESCE((SELECT max(l.purged_at) FROM collect.batch_retention l WHERE l.run_id=r.id),r.payload_purged_at)+interval '7 days'<=clock_timestamp()
    ORDER BY r.id LIMIT 100 FOR UPDATE OF r SKIP LOCKED LOOP
    INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_run',entry.id) ON CONFLICT DO NOTHING;
    DELETE FROM collect.batch_run WHERE id=entry.id;
  END LOOP;
  DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx;
END $$;
REVOKE ALL ON FUNCTION collect.prepare_expired_run_retention() FROM PUBLIC;
CREATE FUNCTION collect.retention_preview() RETURNS TABLE(due BIGINT,failed BIGINT,backup_gate BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
  SELECT count(*) FILTER(WHERE expires_at<=statement_timestamp() AND retention_state<>'PURGED'),
    count(*) FILTER(WHERE retention_state='PURGE_FAILED'),
    COALESCE((SELECT selective_backup_verified FROM collect.batch_retention_control),false)
    FROM collect.batch_retention
$$;
REVOKE ALL ON FUNCTION collect.retention_preview() FROM PUBLIC;

-- A restore inventory holds an exclusive session fence. Ordinary writers hold a shared fence.
CREATE FUNCTION collect.lock_collection_writer() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 SELECT pg_try_advisory_lock_shared(hashtextextended('collect-retention-restore',0))
$$;
CREATE FUNCTION collect.unlock_collection_writer() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 SELECT pg_advisory_unlock_shared(hashtextextended('collect-retention-restore',0))
$$;
CREATE FUNCTION collect.lock_retention_restore() RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF NOT pg_try_advisory_lock(hashtextextended('collect-retention-restore',0)) THEN
   RAISE EXCEPTION 'RETENTION_RESTORE_BUSY'; END IF;
 IF EXISTS(SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
   PERFORM pg_advisory_unlock(hashtextextended('collect-retention-restore',0));
   RAISE EXCEPTION 'RESTORE_REQUIRES_COLLECTION_IDLE'; END IF;
 RETURN true;
END $$;
CREATE FUNCTION collect.unlock_retention_restore() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
 SELECT pg_advisory_unlock(hashtextextended('collect-retention-restore',0))
$$;
CREATE FUNCTION collect.fence_collection_restore() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('collect-retention-restore',0)) THEN
   RAISE EXCEPTION 'RETENTION_RESTORE_BUSY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_collection_restore BEFORE INSERT ON collect.batch_run
 FOR EACH ROW EXECUTE FUNCTION collect.fence_collection_restore();
CREATE TRIGGER a_queue_restore BEFORE INSERT ON collect.batch_queue
 FOR EACH ROW EXECUTE FUNCTION collect.fence_collection_restore();
REVOKE ALL ON FUNCTION collect.lock_collection_writer(),collect.unlock_collection_writer(),
 collect.lock_retention_restore(),collect.unlock_retention_restore(),collect.fence_collection_restore() FROM PUBLIC;
