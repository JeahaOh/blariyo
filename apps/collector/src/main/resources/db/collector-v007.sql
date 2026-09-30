-- D01 metadata and deadline fences. Existing V001--V006 checksums remain unchanged.
LOCK TABLE collect.batch_run,collect.batch_item IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM collect.batch_run WHERE state='RUNNING') THEN
    RAISE EXCEPTION 'BATCH_MIGRATION_REQUIRES_IDLE' USING ERRCODE='55000';
  END IF;
END $$;

CREATE TABLE collect.batch_dedup_key (
  id UUID PRIMARY KEY,
  source_key VARCHAR(80) NOT NULL,
  normalization_version SMALLINT NOT NULL CHECK(normalization_version=1),
  post_key_hash BYTEA NOT NULL CHECK(octet_length(post_key_hash)=32),
  canonical_hash BYTEA NOT NULL CHECK(octet_length(canonical_hash)=32),
  UNIQUE(source_key,normalization_version,post_key_hash),
  UNIQUE(normalization_version,canonical_hash)
);
CREATE TABLE collect.batch_retention (
  item_id UUID PRIMARY KEY,
  run_id UUID,
  dedup_id UUID REFERENCES collect.batch_dedup_key(id),
  collected_at TIMESTAMPTZ(3) NOT NULL,
  review_finalized_at TIMESTAMPTZ(3),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  retention_state VARCHAR(20) NOT NULL DEFAULT 'LIVE'
    CHECK(retention_state IN ('LIVE','PURGE_PENDING','PURGE_FAILED','PURGED')),
  version BIGINT NOT NULL DEFAULT 0 CHECK(version>=0),
  purged_at TIMESTAMPTZ(3),
  purge_owner UUID,
  purge_lease_until TIMESTAMPTZ(3),
  next_attempt_at TIMESTAMPTZ(3),
  purge_attempts INTEGER NOT NULL DEFAULT 0 CHECK(purge_attempts>=0),
  -- Legacy review updated_at does not prove its first decision time.
  legacy_review_finalized BOOLEAN NOT NULL DEFAULT false,
  CHECK((purge_owner IS NULL)=(purge_lease_until IS NULL)),
  CHECK((retention_state='PURGED')=(purged_at IS NOT NULL)),
  CHECK(expires_at>=collected_at)
);
CREATE INDEX batch_retention_due ON collect.batch_retention(expires_at)
  WHERE retention_state<>'PURGED';
CREATE TABLE collect.batch_purge_object (
  item_id UUID NOT NULL REFERENCES collect.batch_retention(item_id),
  object_key VARCHAR(512) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK(kind IN ('RAW','MEDIA','REPORT','ORPHAN')),
  expected_hash BYTEA CHECK(expected_hash IS NULL OR octet_length(expected_hash)=32),
  deletion_state VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK(deletion_state IN ('PENDING','FAILED','DELETED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  last_error_code VARCHAR(80),
  PRIMARY KEY(item_id,object_key),
  CHECK(object_key ~ '^collect/(raw|media|report)/[A-Za-z0-9._/-]+$'),
  CHECK(object_key !~ '(^|/)\.\.?(/|$)')
);
REVOKE ALL ON collect.batch_dedup_key,collect.batch_retention,collect.batch_purge_object FROM PUBLIC;

CREATE FUNCTION collect.identity_hash(VARIADIC parts TEXT[]) RETURNS BYTEA
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE value TEXT; bytes BYTEA; result BYTEA:=''::bytea;
BEGIN
  FOREACH value IN ARRAY parts LOOP
    IF value IS NULL THEN RAISE EXCEPTION 'DEDUP_NULL_IDENTITY' USING ERRCODE='22023'; END IF;
    bytes:=convert_to(value,'UTF8');
    result:=result||int4send(octet_length(bytes))||bytes;
  END LOOP;
  RETURN sha256(result);
END $$;

CREATE FUNCTION collect.lookup_dedup(source TEXT,post_key TEXT,canonical TEXT) RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE post_id UUID; url_id UUID; url_source TEXT;
BEGIN
  IF source IS NULL OR source='' OR canonical IS NULL OR canonical='' THEN
    RAISE EXCEPTION 'DEDUP_INVALID_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT id INTO post_id FROM collect.batch_dedup_key
    WHERE source_key=source AND normalization_version=1
      AND post_key_hash=collect.identity_hash('v1',source,COALESCE(post_key,canonical));
  SELECT id,source_key INTO url_id,url_source FROM collect.batch_dedup_key
    WHERE normalization_version=1 AND canonical_hash=collect.identity_hash('v1',canonical);
  IF (post_id IS NOT NULL AND url_id IS NOT NULL AND post_id<>url_id)
     OR (url_id IS NOT NULL AND url_source<>source) THEN
    RAISE EXCEPTION 'DEDUP_IDENTITY_CONFLICT' USING ERRCODE='23505';
  END IF;
  RETURN COALESCE(post_id,url_id);
END $$;

CREATE FUNCTION collect.register_dedup(source TEXT,post_key TEXT,canonical TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE found_id UUID;
BEGIN
  -- A global short transaction lock also serializes cross-source canonical conflicts.
  PERFORM pg_advisory_xact_lock(hashtextextended('batch-dedup-v1',0));
  found_id:=collect.lookup_dedup(source,post_key,canonical);
  IF found_id IS NOT NULL THEN RETURN found_id; END IF;
  found_id:=gen_random_uuid();
  INSERT INTO collect.batch_dedup_key VALUES(found_id,source,1,
    collect.identity_hash('v1',source,COALESCE(post_key,canonical)),collect.identity_hash('v1',canonical));
  RETURN found_id;
END $$;

CREATE FUNCTION collect.retention_accessible(deadline TIMESTAMPTZ,state TEXT,at_time TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,collect,pg_temp
AS $$ SELECT state='LIVE' AND at_time<deadline $$;

CREATE FUNCTION collect.assert_item_live(item UUID) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle collect.batch_retention%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||item,0));
  SELECT * INTO lifecycle FROM collect.batch_retention WHERE item_id=item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_ITEM_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF NOT collect.retention_accessible(lifecycle.expires_at,lifecycle.retention_state,clock_timestamp()) THEN
    RAISE EXCEPTION 'BATCH_ITEM_EXPIRED' USING ERRCODE='P0001';
  END IF;
  IF to_regprocedure('collect.assert_web_run_live(uuid)') IS NOT NULL THEN
    PERFORM collect.assert_web_run_live(lifecycle.run_id);
  END IF;
  RETURN lifecycle.expires_at;
END $$;

-- Backfill uses the earliest proven DB event and never turns updated_at into a first decision.
INSERT INTO collect.batch_retention(item_id,run_id,collected_at,expires_at)
SELECT i.id,i.run_id,LEAST(r.started_at,i.fetched_at),LEAST(r.started_at,i.fetched_at)+interval '28 days'
  FROM collect.batch_item i JOIN collect.batch_run r ON r.id=i.run_id;
DO $$ DECLARE item RECORD; BEGIN
  FOR item IN SELECT * FROM collect.batch_item WHERE state='FETCHED' ORDER BY id LOOP
    UPDATE collect.batch_retention SET dedup_id=collect.register_dedup(item.source_key,item.source_post_key,item.canonical_url)
      WHERE item_id=item.id;
  END LOOP;
  IF to_regclass('collect.batch_review') IS NOT NULL THEN
    EXECUTE 'UPDATE collect.batch_retention r SET legacy_review_finalized=true,
      expires_at=GREATEST(r.collected_at,LEAST(r.expires_at,v.updated_at+interval ''7 days''))
      FROM collect.batch_review v WHERE v.item_id=r.item_id AND (v.status IN (''APPROVED'',''REJECTED'') OR v.post_id IS NOT NULL)';
  END IF;
  IF to_regclass('content.post_collection_origin') IS NOT NULL THEN
    EXECUTE 'INSERT INTO content.post_collection_origin(post_id,dedup_id)
      SELECT v.post_id,r.dedup_id FROM collect.batch_review v JOIN collect.batch_retention r ON r.item_id=v.item_id
      WHERE v.post_id IS NOT NULL AND r.dedup_id IS NOT NULL ON CONFLICT DO NOTHING';
    IF EXISTS(SELECT 1 FROM collect.batch_review v JOIN collect.batch_retention r ON r.item_id=v.item_id
       LEFT JOIN content.post_collection_origin o ON o.post_id=v.post_id AND o.dedup_id=r.dedup_id
       WHERE v.post_id IS NOT NULL AND o.post_id IS NULL) THEN
      RAISE EXCEPTION 'RETENTION_ORIGIN_BACKFILL_CONFLICT';
    END IF;
  END IF;
END $$;

CREATE FUNCTION collect.guard_item_retention() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE timestamp_now TIMESTAMPTZ(3):=clock_timestamp(); identity_id UUID;
BEGIN
  IF TG_OP='INSERT' AND TG_WHEN='BEFORE' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('batch-review:'||NEW.id,0));
    IF collect.lookup_dedup(NEW.source_key,NEW.source_post_key,NEW.canonical_url) IS NOT NULL THEN
      RAISE EXCEPTION 'BATCH_DUPLICATE_ITEM' USING ERRCODE='23505';
    END IF;
    RETURN NEW;
  ELSIF TG_OP='INSERT' THEN
    INSERT INTO collect.batch_retention(item_id,run_id,collected_at,expires_at)
      VALUES(NEW.id,NEW.run_id,timestamp_now,timestamp_now+interval '28 days');
  ELSE
    PERFORM collect.assert_item_live(NEW.id);
  END IF;
  IF NEW.state='FETCHED' THEN
    identity_id:=collect.register_dedup(NEW.source_key,NEW.source_post_key,NEW.canonical_url);
    IF EXISTS(SELECT 1 FROM collect.batch_retention WHERE dedup_id=identity_id AND item_id<>NEW.id) THEN
      RAISE EXCEPTION 'BATCH_DUPLICATE_ITEM' USING ERRCODE='23505';
    END IF;
    UPDATE collect.batch_retention SET dedup_id=identity_id,version=version+1 WHERE item_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_item_retention BEFORE INSERT OR UPDATE ON collect.batch_item
  FOR EACH ROW EXECUTE FUNCTION collect.guard_item_retention();
CREATE TRIGGER item_retention_created AFTER INSERT ON collect.batch_item
  FOR EACH ROW EXECUTE FUNCTION collect.guard_item_retention();

CREATE FUNCTION collect.finalize_retention(item UUID,expected_version BIGINT,decision TEXT) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE lifecycle collect.batch_retention%ROWTYPE; review RECORD; timestamp_now TIMESTAMPTZ(3);
BEGIN
  IF item IS NULL OR expected_version IS NULL OR expected_version<1 OR decision IS NULL OR decision NOT IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'RETENTION_INVALID_DECISION' USING ERRCODE='22023';
  END IF;
  PERFORM collect.assert_item_live(item);
  SELECT * INTO lifecycle FROM collect.batch_retention WHERE item_id=item FOR UPDATE;
  SELECT * INTO review FROM collect.batch_review WHERE item_id=item FOR UPDATE;
  IF NOT FOUND OR review.lock_version<>expected_version OR review.status<>decision THEN
    RAISE EXCEPTION 'RETENTION_REVIEW_VERSION_CONFLICT' USING ERRCODE='40001';
  END IF;
  timestamp_now:=clock_timestamp();
  IF timestamp_now>=lifecycle.expires_at THEN RAISE EXCEPTION 'BATCH_ITEM_EXPIRED'; END IF;
  IF lifecycle.review_finalized_at IS NULL AND NOT lifecycle.legacy_review_finalized THEN
    UPDATE collect.batch_retention SET review_finalized_at=timestamp_now,
      expires_at=timestamp_now+interval '7 days',version=version+1 WHERE item_id=item;
    RETURN timestamp_now+interval '7 days';
  END IF;
  RETURN lifecycle.expires_at;
END $$;

CREATE FUNCTION collect.fence_retention_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
  -- Extending a first decision must also commit before the original deadline.
  IF OLD.review_finalized_at IS NULL AND NEW.review_finalized_at IS NOT NULL
     AND clock_timestamp()>=OLD.expires_at THEN
    RAISE EXCEPTION 'BATCH_ITEM_EXPIRED';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER retention_commit AFTER UPDATE ON collect.batch_retention
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collect.fence_retention_commit();

REVOKE ALL ON FUNCTION collect.identity_hash(TEXT[]),collect.lookup_dedup(TEXT,TEXT,TEXT),
  collect.register_dedup(TEXT,TEXT,TEXT),collect.retention_accessible(TIMESTAMPTZ,TEXT,TIMESTAMPTZ),
  collect.assert_item_live(UUID),collect.guard_item_retention(),collect.finalize_retention(UUID,BIGINT,TEXT),
  collect.fence_retention_commit() FROM PUBLIC;
