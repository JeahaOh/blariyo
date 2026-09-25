CREATE TABLE collector.identity (
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton), collector_id VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE collector.run (
    id UUID PRIMARY KEY, trigger VARCHAR(10) NOT NULL CHECK(trigger IN ('REST','DISCORD','QUARTZ')),
    trigger_key_hash CHAR(64) NOT NULL UNIQUE, request_hash CHAR(64) NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK(mode IN ('COLLECT','PREVIEW_REFRESH')),
    candidate_id BIGINT, initial_version INTEGER, next_pending BOOLEAN NOT NULL DEFAULT false,
    state VARCHAR(30) NOT NULL CHECK(
        state IN (
            'QUEUED',
            'RUNNING',
            'STOP_REQUESTED',
            'STOPPED',
            'COMPLETED',
            'COMPLETED_WITH_WARNINGS',
            'FAILED',
            'RECONCILE_REQUIRED'
        )
    ),
    collector_execution_id UUID NOT NULL, spool_ref UUID, spool_sha256 CHAR(64), batch_execution_id BIGINT,
    result_payload_sha256 CHAR(64),
    outcome VARCHAR(80),
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ(3),
    finished_at TIMESTAMPTZ(3),
    queued_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    restartable BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()+INTERVAL '7 days',
    CHECK((candidate_id IS null AND next_pending) OR (candidate_id>0 AND NOT next_pending))
);
CREATE UNIQUE INDEX one_active_run ON collector.run((true)) WHERE state IN ('RUNNING','STOP_REQUESTED');
CREATE INDEX queued_runs ON collector.run(queued_at,id) WHERE state='QUEUED';
CREATE TABLE collector.network_attempt (
    id UUID PRIMARY KEY,
    job_request_id UUID NOT NULL REFERENCES collector.run(id),
    request_key_hash CHAR(64) NOT NULL UNIQUE,
    reservation_id UUID,
    kind VARCHAR(10) NOT NULL,
    state VARCHAR(24) NOT NULL CHECK(state IN ('RESERVING','RESERVED','NETWORK_STARTED','COMPLETED','FAILED')),
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),valid_until TIMESTAMPTZ(3)
);
CREATE TABLE collector.notification (
    id UUID PRIMARY KEY,job_request_id UUID NOT NULL,target_ref UUID,candidate_id BIGINT,outcome VARCHAR(80),
    event_code VARCHAR(40) NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(
        status IN ('PENDING','DELIVERED','FINAL_FAILED','CORE_RECORDED')
    ),
    next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    UNIQUE(job_request_id,event_code)
);
CREATE TABLE collector.spool_reference (
    ref UUID PRIMARY KEY,
    job_request_id UUID NOT NULL REFERENCES collector.run(id),
    kind VARCHAR(10) NOT NULL CHECK(kind IN ('STATE','IMAGE','RESULT','DISCORD')),
    sha256 CHAR(64) NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE collector.token_audit (
    scope VARCHAR(50) PRIMARY KEY, token_hmac CHAR(64) NOT NULL, rotated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE collector.restore_gate(
    singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton), reconcile_required BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO collector.restore_gate(singleton) VALUES(true);

CREATE TABLE collector.confirmation (
    id UUID PRIMARY KEY, actor_hmac CHAR(64) NOT NULL, channel_hmac CHAR(64) NOT NULL,
    spool_ref UUID NOT NULL, trigger_key_hash CHAR(64) NOT NULL UNIQUE,
    job_request_id UUID REFERENCES collector.run(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()+INTERVAL '10 minutes'
);

CREATE TABLE collector.daily_summary (
    summary_date DATE NOT NULL, trigger VARCHAR(10) NOT NULL,state VARCHAR(30) NOT NULL,
    job_count BIGINT NOT NULL CHECK(job_count>=0),PRIMARY KEY(summary_date,trigger,state)
);
CREATE TABLE collector.operational_event (
    id UUID PRIMARY KEY,event_key VARCHAR(100) NOT NULL UNIQUE,event_code VARCHAR(40) NOT NULL,
    job_request_id UUID,candidate_id BIGINT,severity VARCHAR(5) NOT NULL DEFAULT 'WARN',
    occurred_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),delivered_at TIMESTAMPTZ(3)
);
