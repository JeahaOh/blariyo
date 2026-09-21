-- Local, one-off importer archive; independent of the application migration ledger.
-- Apply only to the fixed loopback blariyo_local database.
CREATE SCHEMA IF NOT EXISTS scrape_archive;
CREATE TABLE IF NOT EXISTS scrape_archive.schema_migration (
 version INTEGER PRIMARY KEY,
 checksum_sha256 VARCHAR(64) NOT NULL CHECK(checksum_sha256 ~ '^[a-f0-9]{64}$'),
 applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scrape_archive.source_capture (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 post_id BIGINT NOT NULL REFERENCES content.board_post(id),
 source_url TEXT NOT NULL CHECK(source_url ~ '^https://theqoo.net/hot/[0-9]+$'),
 capture_sha256 VARCHAR(64) NOT NULL CHECK(capture_sha256 ~ '^[a-f0-9]{64}$'),
 parser_version TEXT NOT NULL,
 captured_at TIMESTAMPTZ NOT NULL,
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 capture JSONB NOT NULL CHECK(jsonb_typeof(capture)='object'),
 created_by TEXT NOT NULL CHECK(created_by='system:collector'),
 UNIQUE(post_id, capture_sha256)
);
COMMENT ON TABLE scrape_archive.source_capture IS
 'Private local source snapshots: article body, ordered blocks, SNS responses and media provenance. Not a public API.';
REVOKE ALL ON SCHEMA scrape_archive FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA scrape_archive FROM PUBLIC;
