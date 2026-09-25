-- Append-only migration: retain all existing snapshots and failures.
LOCK TABLE collect.batch_run IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_MIGRATION_REQUIRES_IDLE' USING ERRCODE='55000';
  END IF;
END $$;
ALTER TABLE collect.batch_item ADD COLUMN skip_reason VARCHAR(80);
ALTER TABLE collect.batch_item DROP CONSTRAINT batch_item_state_check;
ALTER TABLE collect.batch_item ADD CONSTRAINT batch_item_state_check
CHECK (state IN ('DISCOVERED','FETCHING','FETCHED','FAILED','BLOCKED','SKIPPED_DUPLICATE','SKIPPED_POLICY'));
ALTER TABLE collect.batch_item ADD CONSTRAINT batch_item_skip_reason_check CHECK (
    (
        state='SKIPPED_POLICY'
        AND skip_reason IN ('SOURCE_DATE_UNKNOWN','SOURCE_OUTSIDE_WINDOW')
        AND failure_code IS NULL
    ) IS TRUE
    OR (state<>'SKIPPED_POLICY' AND skip_reason IS NULL)
);
CREATE OR REPLACE FUNCTION collect.guard_batch_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
    IF OLD.state NOT IN ('DISCOVERED','FETCHING','FAILED','BLOCKED','SKIPPED_POLICY') OR NEW.version<>OLD.version+1
       OR (NEW.id,NEW.source_key,NEW.source_post_key) IS DISTINCT FROM (OLD.id,OLD.source_key,OLD.source_post_key)
       OR NOT (NEW.state='FETCHING' OR (OLD.state='FETCHING' AND NEW.state IN ('FETCHED','FAILED','BLOCKED','SKIPPED_POLICY')))
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
  IF NEW.state='SKIPPED_POLICY' AND (NEW.skip_reason IN ('SOURCE_DATE_UNKNOWN','SOURCE_OUTSIDE_WINDOW')) IS NOT TRUE THEN
    RAISE EXCEPTION 'BATCH_SKIP_REASON_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF NEW.state<>'SKIPPED_POLICY' AND NEW.skip_reason IS NOT NULL THEN
    RAISE EXCEPTION 'BATCH_SKIP_REASON_STATE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
