-- Stop all collectors before applying. Existing finished snapshots remain unchanged.
LOCK TABLE collect.batch_run IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_MIGRATION_REQUIRES_IDLE' USING ERRCODE='55000';
  END IF;
END $$;
ALTER TABLE collect.batch_run ADD COLUMN owner_backend_pid INTEGER;
CREATE UNIQUE INDEX batch_one_running_source ON collect.batch_run(source_key) WHERE state='RUNNING';

CREATE FUNCTION collect.assert_source_owner(source TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE lock_key BIGINT := hashtextextended('collector-source:' || source,0);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_locks
    WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND mode='ExclusiveLock'
      AND database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())
      AND objsubid=1 AND ((classid::bigint << 32) | objid::bigint)=lock_key
  ) THEN RAISE EXCEPTION 'BATCH_SOURCE_LOCK_REQUIRED' USING ERRCODE='55000'; END IF;
END $$;

CREATE FUNCTION collect.assert_run_owner(run UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r collect.batch_run%ROWTYPE;
BEGIN
  SELECT * INTO r FROM collect.batch_run WHERE id=run;
  IF NOT FOUND OR r.state<>'RUNNING' OR r.owner_backend_pid IS DISTINCT FROM pg_backend_pid() THEN
    RAISE EXCEPTION 'BATCH_RUN_OWNER_LOST' USING ERRCODE='55000';
  END IF;
  PERFORM collect.assert_source_owner(r.source_key);
END $$;

CREATE FUNCTION collect.guard_batch_run() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'BATCH_RUN_IMMUTABLE' USING ERRCODE='55000'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.version<>0 OR NEW.state NOT IN ('QUEUED','RUNNING') THEN
      RAISE EXCEPTION 'BATCH_RUN_INITIAL_STATE' USING ERRCODE='23514';
    END IF;
    IF NEW.state='QUEUED' THEN NEW.owner_backend_pid:=NULL; RETURN NEW; END IF;
    PERFORM collect.assert_source_owner(NEW.source_key);
    NEW.owner_backend_pid:=pg_backend_pid(); RETURN NEW;
  END IF;
  IF OLD.state NOT IN ('QUEUED','RUNNING') OR NEW.version<>OLD.version+1
    OR (NEW.id,NEW.source_key,NEW.chart_key,NEW.mode,NEW.max_pages,NEW.max_items,NEW.interval_ms,NEW.since_at,NEW.started_at)
       IS DISTINCT FROM (OLD.id,OLD.source_key,OLD.chart_key,OLD.mode,OLD.max_pages,OLD.max_items,OLD.interval_ms,OLD.since_at,OLD.started_at)
    OR NEW.state NOT IN ('RUNNING','COMPLETED','PARTIAL','FAILED','BLOCKED')
    OR (OLD.state='QUEUED' AND NEW.state NOT IN ('RUNNING','FAILED','BLOCKED')) THEN
    RAISE EXCEPTION 'BATCH_RUN_TRANSITION' USING ERRCODE='23514';
  END IF;
  PERFORM collect.assert_source_owner(NEW.source_key);
  IF OLD.state='RUNNING' THEN
    IF NEW.owner_backend_pid IS DISTINCT FROM OLD.owner_backend_pid THEN
      RAISE EXCEPTION 'BATCH_RUN_OWNER_IMMUTABLE' USING ERRCODE='23514';
    END IF;
    IF OLD.owner_backend_pid IS DISTINCT FROM pg_backend_pid()
       AND (NEW.state='FAILED' AND NEW.checkpoint->>'reason'='BATCH_OWNER_LOST') IS NOT TRUE THEN
      RAISE EXCEPTION 'BATCH_RUN_OWNER_LOST' USING ERRCODE='55000';
    END IF;
  ELSE
    NEW.owner_backend_pid:=pg_backend_pid();
  END IF;
  IF NEW.state<>'RUNNING' AND NEW.finished_at IS NULL THEN
    RAISE EXCEPTION 'BATCH_RUN_FINISH_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF OLD.state='RUNNING' AND NEW.state<>'RUNNING'
     AND (NEW.state='FAILED' AND NEW.checkpoint->>'reason'='BATCH_OWNER_LOST') IS NOT TRUE
     AND (NOT EXISTS (SELECT 1 FROM collect.batch_report WHERE run_id=NEW.id AND object_key=NEW.report_object_key)
       OR NOT EXISTS (SELECT 1 FROM collect.batch_checkpoint WHERE run_id=NEW.id AND state=NEW.checkpoint)) THEN
    RAISE EXCEPTION 'BATCH_RUN_REPORT_REQUIRED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_run_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_run
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_run();

CREATE FUNCTION collect.guard_batch_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE r collect.batch_run%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'BATCH_ITEM_IMMUTABLE' USING ERRCODE='55000'; END IF;
  SELECT * INTO r FROM collect.batch_run WHERE id=NEW.run_id;
  IF NOT FOUND OR NEW.source_key<>r.source_key THEN
    RAISE EXCEPTION 'BATCH_ITEM_SOURCE_CONFLICT' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.version<>0 OR NEW.state NOT IN ('DISCOVERED','FETCHING') THEN
      RAISE EXCEPTION 'BATCH_ITEM_INITIAL_STATE' USING ERRCODE='23514';
    END IF;
    IF NEW.state='DISCOVERED' AND r.state='QUEUED' THEN RETURN NEW; END IF;
  ELSE
    IF OLD.state NOT IN ('DISCOVERED','FETCHING','FAILED','BLOCKED') OR NEW.version<>OLD.version+1
       OR (NEW.id,NEW.source_key,NEW.source_post_key) IS DISTINCT FROM (OLD.id,OLD.source_key,OLD.source_post_key)
       OR NOT (NEW.state='FETCHING' OR (OLD.state='FETCHING' AND NEW.state IN ('FETCHED','FAILED','BLOCKED')))
       OR (NEW.run_id<>OLD.run_id AND NEW.state<>'FETCHING') THEN
      RAISE EXCEPTION 'BATCH_ITEM_TRANSITION' USING ERRCODE='23514';
    END IF;
  END IF;
  PERFORM collect.assert_run_owner(NEW.run_id);
  IF NEW.state='FETCHED' THEN
    IF NEW.raw_object_key IS NULL OR NEW.fetched_at IS NULL OR NEW.title IS NULL OR length(trim(NEW.title))=0
      OR NEW.body_blocks IS NULL OR jsonb_typeof(NEW.body_blocks)<>'array' OR jsonb_array_length(NEW.body_blocks)=0 THEN
      RAISE EXCEPTION 'BATCH_ITEM_INCOMPLETE' USING ERRCODE='23514';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(NEW.body_blocks) b WHERE b->>'type'='IMAGE')
       <> (SELECT count(*) FROM collect.batch_media WHERE item_id=NEW.id AND kind='IMAGE')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.body_blocks) b WHERE b->>'type'='IMAGE'
         AND NOT EXISTS (SELECT 1 FROM collect.batch_media m WHERE m.item_id=NEW.id AND m.kind='IMAGE' AND m.position::text=b->>'imagePosition')) THEN
      RAISE EXCEPTION 'BATCH_MEDIA_INCOMPLETE' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.state IN ('FAILED','BLOCKED') AND NEW.failure_code IS NULL THEN
    RAISE EXCEPTION 'BATCH_FAILURE_CODE_REQUIRED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_item_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_item
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_item();

CREATE FUNCTION collect.guard_batch_media() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE i collect.batch_item%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'BATCH_MEDIA_IMMUTABLE' USING ERRCODE='55000'; END IF;
  SELECT * INTO i FROM collect.batch_item WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.item_id ELSE NEW.item_id END;
  IF NOT FOUND OR i.state<>'FETCHING' THEN RAISE EXCEPTION 'BATCH_MEDIA_ITEM_STATE' USING ERRCODE='55000'; END IF;
  PERFORM collect.assert_run_owner(i.run_id);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.object_key IS NULL OR NEW.object_key<>'collect/media/' || i.run_id || '/' || i.id || '/' || NEW.position
     OR NEW.sha256 IS NULL OR NEW.byte_size IS NULL OR NEW.byte_size<=0 OR NEW.mime_type IS NULL THEN
    RAISE EXCEPTION 'BATCH_MEDIA_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_media_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_media
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_media();

CREATE FUNCTION collect.guard_batch_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'BATCH_FAILURE_IMMUTABLE' USING ERRCODE='55000'; END IF;
  PERFORM collect.assert_run_owner(NEW.run_id);
  IF NEW.item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM collect.batch_item WHERE id=NEW.item_id AND run_id=NEW.run_id) THEN
    RAISE EXCEPTION 'BATCH_FAILURE_ITEM_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_failure_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_failure
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_failure();

CREATE FUNCTION collect.guard_batch_report() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'BATCH_REPORT_IMMUTABLE' USING ERRCODE='55000'; END IF;
  PERFORM collect.assert_run_owner(NEW.run_id);
  IF NEW.object_key IS DISTINCT FROM 'collect/report/' || NEW.run_id || '.jsonl' OR NEW.sha256 IS NULL OR NEW.jsonl_count<=0 THEN
    RAISE EXCEPTION 'BATCH_REPORT_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_report_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_report
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_report();

CREATE FUNCTION collect.guard_batch_checkpoint() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'BATCH_CHECKPOINT_IMMUTABLE' USING ERRCODE='55000'; END IF;
  PERFORM collect.assert_run_owner(NEW.run_id);
  IF (TG_OP='INSERT' AND NEW.version<>0) OR (TG_OP='UPDATE' AND (NEW.run_id<>OLD.run_id OR NEW.version<>OLD.version+1)) THEN
    RAISE EXCEPTION 'BATCH_CHECKPOINT_VERSION_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_checkpoint_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_checkpoint
FOR EACH ROW EXECUTE FUNCTION collect.guard_batch_checkpoint();
