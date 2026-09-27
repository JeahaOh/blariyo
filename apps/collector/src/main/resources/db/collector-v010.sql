-- Direct HTTP budget is independent of the disabled Core/legacy reservation API.
-- One aggregate row per source. No URLs, original content, user IDs or credentials.
CREATE TABLE collect.batch_request_budget (
  source_key VARCHAR(100) PRIMARY KEY,
  budget_date DATE NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count >= 0),
  next_allowed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
REVOKE ALL ON collect.batch_request_budget FROM PUBLIC;
ALTER TABLE collector.restore_gate ADD COLUMN direct_resume_not_before TIMESTAMPTZ;

-- Returns a wait without consuming quota, or a single charged, short-lived permit.
-- Database clock and the row lock cover concurrent JVMs, restart and KST midnight.
CREATE FUNCTION collect.reserve_batch_request(p_source TEXT,p_limit INTEGER,p_interval BIGINT)
RETURNS TABLE(wait_ms BIGINT,valid_ms BIGINT,used INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect AS $$
DECLARE
  observed TIMESTAMPTZ;
  today DATE;
  current_budget collect.batch_request_budget%ROWTYPE;
  deadline TIMESTAMPTZ;
BEGIN
  IF EXISTS(SELECT 1 FROM collector.restore_gate WHERE singleton AND
      (reconcile_required OR direct_resume_not_before>clock_timestamp())) THEN
    RAISE EXCEPTION 'SOURCE_RESTORE_RECONCILE_REQUIRED' USING ERRCODE='P0001';
  END IF;
  IF p_source IS NULL OR p_source !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$'
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000000
     OR p_interval IS NULL OR p_interval NOT BETWEEN 0 AND 3600000 THEN
    RAISE EXCEPTION 'SOURCE_CONFIG_REQUIRED' USING ERRCODE='P0001';
  END IF;
  observed:=clock_timestamp();
  INSERT INTO collect.batch_request_budget(source_key,budget_date,request_count,next_allowed_at,updated_at)
    VALUES(p_source,(observed AT TIME ZONE 'Asia/Seoul')::date,0,observed,observed)
    ON CONFLICT(source_key) DO NOTHING;
  SELECT * INTO current_budget FROM collect.batch_request_budget WHERE source_key=p_source FOR UPDATE;
  observed:=clock_timestamp();
  today:=(observed AT TIME ZONE 'Asia/Seoul')::date;
  -- A clock moving backwards must not reset a previously charged day.
  IF today < current_budget.budget_date THEN
    RAISE EXCEPTION 'SOURCE_CLOCK_UNSAFE' USING ERRCODE='P0001';
  END IF;
  IF today > current_budget.budget_date THEN
    current_budget.budget_date:=today;
    current_budget.request_count:=0;
  END IF;
  IF current_budget.request_count >= p_limit THEN
    RAISE EXCEPTION 'SOURCE_DAILY_LIMIT_EXCEEDED' USING ERRCODE='P0001';
  END IF;
  IF current_budget.next_allowed_at > observed THEN
    RETURN QUERY SELECT ceil(extract(epoch FROM (current_budget.next_allowed_at-observed))*1000)::bigint,0::bigint,current_budget.request_count;
    RETURN;
  END IF;
  deadline:=least(observed+interval '2 seconds',((today+1)::timestamp AT TIME ZONE 'Asia/Seoul'));
  -- The next sender starts after this permit's latest start plus the full interval.
  UPDATE collect.batch_request_budget SET budget_date=today,request_count=current_budget.request_count+1,
    next_allowed_at=deadline+p_interval*interval '1 millisecond',updated_at=observed WHERE source_key=p_source;
  RETURN QUERY SELECT 0::bigint,floor(extract(epoch FROM (deadline-observed))*1000)::bigint,current_budget.request_count+1;
END $$;
REVOKE ALL ON FUNCTION collect.reserve_batch_request(TEXT,INTEGER,BIGINT) FROM PUBLIC;

-- Cancellation applies only before confirmation. Keep a short-lived identity tombstone,
-- immediately remove the URL, and serialize with confirmation on the same advisory key.
ALTER TABLE collect.batch_confirmation ADD COLUMN cancelled_at TIMESTAMPTZ,
  ALTER COLUMN source_key DROP NOT NULL, ALTER COLUMN source_post_key DROP NOT NULL,
  ALTER COLUMN canonical_url DROP NOT NULL;
ALTER TABLE collect.batch_confirmation ADD CONSTRAINT confirmation_cancel_payload CHECK(
  (cancelled_at IS NULL AND source_key IS NOT NULL AND source_post_key IS NOT NULL AND canonical_url IS NOT NULL)
  OR (cancelled_at IS NOT NULL AND request_id IS NULL AND source_key IS NULL AND source_post_key IS NULL AND canonical_url IS NULL));
CREATE FUNCTION collect.cancel_confirmation(confirmation UUID,actor TEXT,channel TEXT,replay_hmac TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE pending collect.batch_confirmation%ROWTYPE; tx XID8:=pg_current_xact_id();
BEGIN
  IF confirmation IS NULL OR actor IS NULL OR channel IS NULL OR replay_hmac IS NULL THEN
    RAISE EXCEPTION 'CONFIRMATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('batch-confirmation:'||confirmation,0));
  SELECT * INTO pending FROM collect.batch_confirmation WHERE id=confirmation FOR UPDATE;
  IF NOT FOUND THEN
    IF EXISTS(SELECT 1 FROM collect.batch_confirmation_receipt WHERE trigger_hmac=replay_hmac AND expires_at>clock_timestamp()) THEN
      RAISE EXCEPTION 'CONFIRMATION_ALREADY_CONFIRMED'; END IF;
    RAISE EXCEPTION 'CONFIRMATION_EXPIRED';
  END IF;
  IF pending.actor_hmac IS DISTINCT FROM actor OR pending.channel_hmac IS DISTINCT FROM channel THEN
    RAISE EXCEPTION 'CONFIRMATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF pending.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CONFIRMATION_EXPIRED'; END IF;
  IF pending.cancelled_at IS NOT NULL THEN RETURN; END IF;
  IF pending.request_id IS NOT NULL THEN RAISE EXCEPTION 'CONFIRMATION_ALREADY_CONFIRMED'; END IF;
  INSERT INTO collect.batch_purge_scope VALUES(tx,'batch_confirmation',confirmation);
  UPDATE collect.batch_confirmation SET cancelled_at=clock_timestamp(),source_key=NULL,source_post_key=NULL,
    canonical_url=NULL,version=version+1 WHERE id=confirmation;
  DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx AND table_name='batch_confirmation' AND row_id=confirmation;
END $$;
REVOKE ALL ON FUNCTION collect.cancel_confirmation(UUID,TEXT,TEXT,TEXT) FROM PUBLIC;
