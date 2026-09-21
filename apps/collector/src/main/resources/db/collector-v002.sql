-- Batch-owned collection ledger. API has SELECT only; batch owns writes.
CREATE TABLE IF NOT EXISTS collect.batch_source (
  source_key VARCHAR(80) PRIMARY KEY,
  host VARCHAR(255) NOT NULL,
  chart_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_version VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collect.batch_run (
  id UUID PRIMARY KEY,
  source_key VARCHAR(80) NOT NULL REFERENCES collect.batch_source(source_key),
  chart_key VARCHAR(80) NOT NULL,
  mode VARCHAR(12) NOT NULL CHECK (mode IN ('DRY_RUN','WRITE_DB')),
  state VARCHAR(20) NOT NULL CHECK (state IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','BLOCKED')),
  max_pages INTEGER NOT NULL CHECK (max_pages BETWEEN 1 AND 100),
  max_items INTEGER NOT NULL CHECK (max_items BETWEEN 1 AND 10000),
  since_at TIMESTAMPTZ(3), interval_ms BIGINT NOT NULL CHECK (interval_ms >= 10000),
  started_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ(3),
  checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb, report_object_key VARCHAR(512),
  version BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS collect.batch_item (
  id UUID PRIMARY KEY, run_id UUID NOT NULL REFERENCES collect.batch_run(id),
  source_key VARCHAR(80) NOT NULL, source_post_key VARCHAR(200), canonical_url TEXT NOT NULL,
  canonical_url_hash BYTEA NOT NULL CHECK (octet_length(canonical_url_hash)=32),
  state VARCHAR(24) NOT NULL CHECK (state IN ('DISCOVERED','FETCHING','FETCHED','FAILED','BLOCKED','SKIPPED_DUPLICATE')),
  title TEXT, body_blocks JSONB, attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  sns_links JSONB NOT NULL DEFAULT '[]'::jsonb, raw_object_key VARCHAR(512),
  fetched_at TIMESTAMPTZ(3), failure_code VARCHAR(80), version BIGINT NOT NULL DEFAULT 0,
  UNIQUE(source_key, source_post_key), UNIQUE(canonical_url_hash)
);
CREATE TABLE IF NOT EXISTS collect.batch_media (
  id UUID PRIMARY KEY, item_id UUID NOT NULL REFERENCES collect.batch_item(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0), kind VARCHAR(16) NOT NULL CHECK (kind IN ('IMAGE','FILE')),
  remote_url TEXT, sha256 BYTEA CHECK (sha256 IS NULL OR octet_length(sha256)=32),
  mime_type VARCHAR(160), byte_size BIGINT, object_key VARCHAR(512),
  UNIQUE(item_id, position)
);
CREATE TABLE IF NOT EXISTS collect.batch_failure (
  id UUID PRIMARY KEY, run_id UUID NOT NULL REFERENCES collect.batch_run(id) ON DELETE CASCADE,
  item_id UUID REFERENCES collect.batch_item(id) ON DELETE SET NULL, phase VARCHAR(32) NOT NULL,
  code VARCHAR(80) NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collect.batch_report (
  run_id UUID PRIMARY KEY REFERENCES collect.batch_run(id) ON DELETE CASCADE,
  object_key VARCHAR(512), sha256 BYTEA CHECK (sha256 IS NULL OR octet_length(sha256)=32),
  jsonl_count BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collect.batch_checkpoint (
  run_id UUID PRIMARY KEY REFERENCES collect.batch_run(id) ON DELETE CASCADE,
  page_url TEXT, page_number INTEGER NOT NULL DEFAULT 0, item_count INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL DEFAULT '{}'::jsonb, version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batch_item_run_state ON collect.batch_item(run_id,state);
CREATE INDEX IF NOT EXISTS batch_failure_run_time ON collect.batch_failure(run_id,occurred_at);
