-- robots.txt is reference-only. Network throttling is durable across runs and restarts.
CREATE FUNCTION collect.defer_batch_request(p_source text,p_delay_ms bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect AS $$
DECLARE observed timestamptz; deadline timestamptz;
BEGIN
  IF p_source IS NULL OR p_source !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$'
     OR p_delay_ms IS NULL OR p_delay_ms<0 THEN
    RAISE EXCEPTION 'SOURCE_CONFIG_REQUIRED';
  END IF;
  observed:=clock_timestamp();
  -- Huge/unparseable Retry-After must never overflow or become an earlier retry.
  deadline:=CASE WHEN p_delay_ms>31536000000 THEN 'infinity'::timestamptz
    ELSE observed+p_delay_ms*interval '1 millisecond' END;
  INSERT INTO collect.batch_request_budget(source_key,budget_date,request_count,next_allowed_at,updated_at)
    VALUES(p_source,(observed AT TIME ZONE 'Asia/Seoul')::date,0,deadline,observed)
    ON CONFLICT(source_key) DO UPDATE SET
      next_allowed_at=greatest(collect.batch_request_budget.next_allowed_at,EXCLUDED.next_allowed_at),
      updated_at=greatest(collect.batch_request_budget.updated_at,EXCLUDED.updated_at);
END $$;
REVOKE ALL ON FUNCTION collect.defer_batch_request(text,bigint) FROM PUBLIC;

-- Only image-specific failures consume the one extra attempt and permit deletion.
-- Access policy, throttling and transient network failures preserve the collected item.
CREATE OR REPLACE FUNCTION collect.image_failure_code(code text) RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog AS $$ SELECT code=ANY(ARRAY[
 'SOURCE_GONE','SOURCE_HTTP_REJECTED','SOURCE_TOO_LARGE','SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED',
 'SOURCE_NOT_IMAGE','SOURCE_ENCODING_UNSUPPORTED']) $$;

-- 2026-10-06: configurable 1s..1h intervals; Java default is 5s.
-- V002/V009 remain immutable. Their named interval checks are replaced here.
ALTER TABLE collect.batch_run DROP CONSTRAINT batch_run_interval_ms_check;
ALTER TABLE collect.batch_run ADD CONSTRAINT batch_run_interval_ms_check CHECK(interval_ms>=1000);
ALTER TABLE collect.batch_source_runtime DROP CONSTRAINT batch_source_runtime_effective_policy_check7;
ALTER TABLE collect.batch_source_runtime ADD CONSTRAINT batch_source_runtime_interval_check
 CHECK((effective_policy->>'requestIntervalMs')::bigint BETWEEN 1000 AND 3600000);
