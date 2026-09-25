-- Additive transition only. Strict execution/preview constraints are a separate drain operation.
ALTER TABLE collect.source ADD next_request_at TIMESTAMPTZ(3);
ALTER TABLE collect.candidate ADD collector_execution_id UUID, ADD last_heartbeat_at TIMESTAMPTZ(3),
ADD result_payload_sha256 BYTEA CHECK(result_payload_sha256 IS NULL OR octet_length(result_payload_sha256)=32);
ALTER TABLE collect.candidate_image ADD preview_source_sha256 BYTEA CHECK(
    preview_source_sha256 IS NULL OR octet_length(preview_source_sha256)=32
),
ADD preview_uploaded_at TIMESTAMPTZ(3);
CREATE TABLE collect.collector_receipt (
    collector_id VARCHAR(100) NOT NULL,
    operation VARCHAR(200) NOT NULL,
    key_hash BYTEA NOT NULL CHECK(octet_length(key_hash)=32),
    request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32),
    response_status INTEGER NOT NULL CHECK(response_status BETWEEN 200 AND 299),
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()+INTERVAL '7 days',
    PRIMARY KEY(collector_id,operation,key_hash)
);
CREATE INDEX ix_collector_receipt_expiry ON collect.collector_receipt(expires_at);
CREATE TABLE collect.source_request_budget (
    source_id BIGINT NOT NULL REFERENCES collect.source(id), budget_date DATE NOT NULL,
    reserved_count INTEGER NOT NULL DEFAULT 0 CHECK(reserved_count>=0),
    lock_version INTEGER NOT NULL DEFAULT 1 CHECK(lock_version>=1),
    PRIMARY KEY(source_id,budget_date)
);
CREATE TABLE collect.source_request_reservation (
    id UUID PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES collect.source(id),
    candidate_id BIGINT REFERENCES collect.candidate(id) ON DELETE SET NULL,
    collector_id VARCHAR(100) NOT NULL, collector_execution_id UUID NOT NULL, job_request_id UUID NOT NULL,
    request_key_hash BYTEA NOT NULL CHECK(octet_length(request_key_hash)=32),
    request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32),
    request_kind VARCHAR(10) NOT NULL CHECK(request_kind IN ('ROBOTS','DETAIL','REDIRECT','IMAGE')),
    budget_date DATE NOT NULL, reserved_at TIMESTAMPTZ(3) NOT NULL, valid_until TIMESTAMPTZ(3) NOT NULL,
    next_allowed_at TIMESTAMPTZ(3) NOT NULL, reserved_count INTEGER NOT NULL, remaining_count INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','EXPIRED')),
    UNIQUE(source_id,request_key_hash)
);
CREATE TABLE collect.collector_operational_event (
    id UUID PRIMARY KEY, collector_id VARCHAR(100) NOT NULL, delivery_id UUID NOT NULL,
    candidate_id BIGINT REFERENCES collect.candidate(id) ON DELETE SET NULL, job_request_id UUID,
    event_code VARCHAR(40) NOT NULL CHECK(
        event_code IN (
            'NOTIFICATION_FINAL_FAILED',
            'RECONCILE_REQUIRED',
            'SPOOL_CLEANUP_FAILED',
            'LEASE_EXPIRED',
            'QUOTA_INTERVAL_VIOLATION',
            'COLLECTOR_CLOCK_UNSAFE'
        )
    ),
    severity VARCHAR(5) NOT NULL CHECK(severity IN ('INFO','WARN','ERROR')),
    delivery_status VARCHAR(16) NOT NULL DEFAULT 'UNACKNOWLEDGED' CHECK(
        delivery_status IN ('UNACKNOWLEDGED','ACKNOWLEDGED')
    ),
    attempt_count INTEGER NOT NULL CHECK(attempt_count BETWEEN 0 AND 100), occurred_at TIMESTAMPTZ(3) NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), last_attempted_at TIMESTAMPTZ(3), acknowledged_at TIMESTAMPTZ(3),
    request_hash BYTEA NOT NULL CHECK(octet_length(request_hash)=32), UNIQUE(collector_id,delivery_id)
);
-- Cleanup/invalidation is enforced for both legacy and V2 paths, including administrator retry.
CREATE FUNCTION collect.reset_execution_metadata() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status='PENDING' AND OLD.status<>'PENDING' THEN
  NEW.collector_execution_id=NULL; NEW.last_heartbeat_at=NULL; NEW.result_payload_sha256=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reset_execution_metadata
BEFORE UPDATE ON collect.candidate
FOR EACH ROW
EXECUTE FUNCTION collect.reset_execution_metadata();
CREATE FUNCTION collect.reset_preview_metadata() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.preview_storage_key IS NULL THEN NEW.preview_source_sha256=NULL; NEW.preview_uploaded_at=NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reset_preview_metadata
BEFORE UPDATE ON collect.candidate_image
FOR EACH ROW
EXECUTE FUNCTION collect.reset_preview_metadata();
