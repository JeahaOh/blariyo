-- Collector-owned catalogue/control. API writes only through the versioned command below.
CREATE TABLE collect.batch_source_collection_setting (
 source_key VARCHAR(80) PRIMARY KEY CHECK(source_key ~ '^[a-z][a-z0-9-]{0,79}$'),
 source_url TEXT CHECK(source_url IS NULL OR source_url ~ '^https?://[^/@[:space:]]+(/[^[:space:]]*)?$'),
 configured_enabled BOOLEAN NOT NULL,
 collection_available BOOLEAN NOT NULL,
 blocked_reason VARCHAR(100),
 collection_enabled BOOLEAN NOT NULL,
 lock_version INTEGER NOT NULL DEFAULT 0 CHECK(lock_version>=0),
 updated_by VARCHAR(100),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE collect.batch_source_collection_setting_change (
 source_key VARCHAR(80) NOT NULL REFERENCES collect.batch_source_collection_setting(source_key),
 lock_version INTEGER NOT NULL,
 collection_enabled BOOLEAN NOT NULL,
 actor VARCHAR(100) NOT NULL,
 occurred_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(source_key,lock_version)
);
CREATE FUNCTION collect.sync_source_collection_setting(p_source TEXT,p_url TEXT,p_default BOOLEAN,p_available BOOLEAN,p_reason TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
BEGIN
 IF p_reason IS NOT NULL AND p_reason !~ '^[A-Z][A-Z0-9_]{0,99}$' THEN
  RAISE EXCEPTION 'SOURCE_CONFIG_REQUIRED' USING ERRCODE='22023';
 END IF;
 INSERT INTO collect.batch_source_collection_setting(source_key,source_url,configured_enabled,collection_available,blocked_reason,collection_enabled)
 VALUES(p_source,p_url,p_default,p_available,p_reason,p_default)
 ON CONFLICT(source_key) DO UPDATE SET source_url=p_url,configured_enabled=p_default,
 collection_available=p_available,blocked_reason=p_reason,
 collection_enabled=CASE WHEN batch_source_collection_setting.updated_by IS NULL THEN p_default ELSE batch_source_collection_setting.collection_enabled END,
 lock_version=batch_source_collection_setting.lock_version+1,updated_at=clock_timestamp()
 WHERE (batch_source_collection_setting.source_url,batch_source_collection_setting.configured_enabled,
 batch_source_collection_setting.collection_available,batch_source_collection_setting.blocked_reason)
 IS DISTINCT FROM (p_url,p_default,p_available,p_reason);
END $$;
CREATE FUNCTION collect.set_source_collection_setting(p_source TEXT,p_enabled BOOLEAN,p_version INTEGER,p_actor TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE current_setting collect.batch_source_collection_setting%ROWTYPE;
BEGIN
 IF p_enabled IS NULL OR p_version IS NULL OR p_version<0 OR p_actor IS NULL OR p_actor !~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$' THEN
  RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE='22023';
 END IF;
 SELECT * INTO current_setting FROM collect.batch_source_collection_setting WHERE source_key=p_source FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_COLLECTION_SETTING_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 IF current_setting.lock_version<>p_version THEN RAISE EXCEPTION 'SOURCE_COLLECTION_SETTING_VERSION_CONFLICT' USING ERRCODE='P0001'; END IF;
 IF p_enabled AND NOT current_setting.collection_available THEN RAISE EXCEPTION 'SOURCE_COLLECTION_NOT_AVAILABLE' USING ERRCODE='P0001'; END IF;
 IF current_setting.collection_enabled=p_enabled THEN RETURN; END IF;
 UPDATE collect.batch_source_collection_setting SET collection_enabled=p_enabled,lock_version=lock_version+1,
 updated_by=p_actor,updated_at=clock_timestamp() WHERE source_key=p_source;
 INSERT INTO collect.batch_source_collection_setting_change(source_key,lock_version,collection_enabled,actor)
 VALUES(p_source,current_setting.lock_version+1,p_enabled,p_actor);
END $$;
REVOKE ALL ON collect.batch_source_collection_setting,collect.batch_source_collection_setting_change FROM PUBLIC;
REVOKE ALL ON FUNCTION collect.sync_source_collection_setting(TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT),collect.set_source_collection_setting(TEXT,BOOLEAN,INTEGER,TEXT) FROM PUBLIC;
