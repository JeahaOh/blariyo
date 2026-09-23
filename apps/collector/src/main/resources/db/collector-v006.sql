-- Explicit owner-only maintenance; runtime ownership and finished item snapshots stay intact.
LOCK TABLE collect.batch_run IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_MIGRATION_REQUIRES_IDLE' USING ERRCODE='55000';
  END IF;
END $$;
CREATE TABLE collect.batch_media_correction (
  operation_id UUID PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES collect.batch_media(id),
  revision BIGINT NOT NULL CHECK (revision>0),
  item_version BIGINT NOT NULL CHECK (item_version>=0),
  before_row JSONB NOT NULL CHECK (jsonb_typeof(before_row)='object'),
  new_mime VARCHAR(160) NOT NULL CHECK (new_mime IN ('image/jpeg','image/png','image/gif','image/webp','image/avif')),
  reason_code VARCHAR(80) NOT NULL CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  actor NAME NOT NULL DEFAULT current_user,
  transaction_id XID8 NOT NULL DEFAULT pg_current_xact_id(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(media_id,revision),
  CHECK ((before_row->>'mime_type') IS DISTINCT FROM new_mime)
);
REVOKE ALL ON collect.batch_media_correction FROM PUBLIC;

CREATE FUNCTION collect.guard_media_correction() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'BATCH_CORRECTION_IMMUTABLE' USING ERRCODE='55000'; END IF;
  IF current_user IS DISTINCT FROM pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='collect.batch_media'::regclass))
     OR NEW.actor IS DISTINCT FROM current_user OR NEW.transaction_id<>pg_current_xact_id() THEN
    RAISE EXCEPTION 'BATCH_CORRECTION_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_correction_guard BEFORE INSERT OR UPDATE OR DELETE ON collect.batch_media_correction
  FOR EACH ROW EXECUTE FUNCTION collect.guard_media_correction();
CREATE TRIGGER media_correction_no_truncate BEFORE TRUNCATE ON collect.batch_media_correction
  FOR EACH STATEMENT EXECUTE FUNCTION collect.guard_media_correction();

CREATE OR REPLACE FUNCTION collect.guard_batch_media() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE i collect.batch_item%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF current_user IS DISTINCT FROM pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='collect.batch_media'::regclass)) THEN
      RAISE EXCEPTION 'BATCH_MEDIA_IMMUTABLE' USING ERRCODE='55000';
    END IF;
    IF (to_jsonb(NEW)-'mime_type') IS DISTINCT FROM (to_jsonb(OLD)-'mime_type')
       OR NOT EXISTS (SELECT 1 FROM collect.batch_media_correction c JOIN collect.batch_item b ON b.id=OLD.item_id
         WHERE c.media_id=OLD.id AND c.before_row=to_jsonb(OLD) AND c.new_mime=NEW.mime_type
           AND c.transaction_id=pg_current_xact_id() AND b.state='FETCHED' AND b.version=c.item_version AND OLD.kind='IMAGE') THEN
      RAISE EXCEPTION 'BATCH_MEDIA_IMMUTABLE' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
  END IF;
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

CREATE FUNCTION collect.apply_media_correction() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  UPDATE collect.batch_media m SET mime_type=NEW.new_mime
    WHERE m.id=NEW.media_id AND to_jsonb(m)=NEW.before_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_CORRECTION_STALE' USING ERRCODE='40001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_correction_apply AFTER INSERT ON collect.batch_media_correction
  FOR EACH ROW EXECUTE FUNCTION collect.apply_media_correction();

CREATE FUNCTION collect.correct_batch_media_mime(
  operation UUID, media UUID, expected_mime TEXT, corrected_mime TEXT, expected_hash BYTEA,
  expected_size BIGINT, expected_item_version BIGINT, expected_revision BIGINT, reason TEXT
) RETURNS BIGINT LANGUAGE plpgsql SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE m collect.batch_media%ROWTYPE; i collect.batch_item%ROWTYPE;
  receipt collect.batch_media_correction%ROWTYPE; revision_now BIGINT;
BEGIN
  IF current_user IS DISTINCT FROM pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='collect.batch_media'::regclass)) THEN
    RAISE EXCEPTION 'BATCH_CORRECTION_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF operation IS NULL OR media IS NULL OR expected_mime IS NULL OR corrected_mime IS NULL
     OR expected_hash IS NULL OR octet_length(expected_hash)<>32 OR expected_size IS NULL OR expected_size<=0
     OR expected_item_version IS NULL OR expected_item_version<0 OR expected_revision IS NULL OR expected_revision<0
     OR reason IS NULL OR reason !~ '^[A-Z][A-Z0-9_]{1,79}$'
     OR corrected_mime NOT IN ('image/jpeg','image/png','image/gif','image/webp','image/avif')
     OR expected_mime=corrected_mime THEN
    RAISE EXCEPTION 'BATCH_CORRECTION_ARGUMENT' USING ERRCODE='22023';
  END IF;
  SELECT b.* INTO i FROM collect.batch_item b JOIN collect.batch_media a ON a.item_id=b.id WHERE a.id=media;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_CORRECTION_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('collector-source:'||i.source_key,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||i.id,0));
  SELECT * INTO i FROM collect.batch_item WHERE id=i.id FOR UPDATE;
  SELECT * INTO m FROM collect.batch_media WHERE id=media FOR UPDATE;
  SELECT * INTO receipt FROM collect.batch_media_correction WHERE operation_id=operation;
  IF FOUND THEN
    IF receipt.media_id<>media OR receipt.before_row->>'mime_type'<>expected_mime
       OR receipt.new_mime<>corrected_mime OR receipt.before_row->>'sha256'<>('\x'||encode(expected_hash,'hex'))
       OR (receipt.before_row->>'byte_size')::bigint<>expected_size OR receipt.item_version<>expected_item_version
       OR receipt.revision<>expected_revision+1 OR receipt.reason_code<>reason THEN
      RAISE EXCEPTION 'BATCH_CORRECTION_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN receipt.revision;
  END IF;
  SELECT COALESCE(max(revision),0) INTO revision_now FROM collect.batch_media_correction WHERE media_id=media;
  IF i.state<>'FETCHED' OR m.kind<>'IMAGE' OR i.version<>expected_item_version OR revision_now<>expected_revision
     OR m.mime_type IS DISTINCT FROM expected_mime OR m.sha256 IS DISTINCT FROM expected_hash
     OR m.byte_size IS DISTINCT FROM expected_size OR EXISTS (SELECT 1 FROM collect.batch_run WHERE source_key=i.source_key AND state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_CORRECTION_STALE' USING ERRCODE='40001';
  END IF;
  INSERT INTO collect.batch_media_correction(operation_id,media_id,revision,item_version,before_row,new_mime,reason_code)
    VALUES(operation,media,revision_now+1,i.version,to_jsonb(m),corrected_mime,reason);
  RETURN revision_now+1;
END $$;
REVOKE ALL ON FUNCTION collect.correct_batch_media_mime(UUID,UUID,TEXT,TEXT,BYTEA,BIGINT,BIGINT,BIGINT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION collect.guard_media_correction(),collect.apply_media_correction() FROM PUBLIC;
