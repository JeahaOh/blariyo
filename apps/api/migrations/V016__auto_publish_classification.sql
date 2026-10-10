-- API-owned metadata only. No source title/body/media copies and no Collector grants.
CREATE FUNCTION collect.auto_publish_title_key(value TEXT) RETURNS BYTEA
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT sha256(convert_to(regexp_replace(lower(normalize(value,NFKC)),'[^[:alnum:]]','','g'),'UTF8'))
$$;
REVOKE ALL ON FUNCTION collect.auto_publish_title_key(TEXT) FROM PUBLIC;
CREATE INDEX ix_board_post_auto_title ON content.board_post(collect.auto_publish_title_key(title)) WHERE status<>'REMOVED';
CREATE TABLE collect.batch_auto_publish_classification (
 item_id UUID PRIMARY KEY,
 item_version BIGINT NOT NULL CHECK(item_version>=0),
 policy_version INTEGER NOT NULL CHECK(policy_version>0),
 content_digest BYTEA NOT NULL CHECK(octet_length(content_digest)=32),
 title_key BYTEA NOT NULL CHECK(octet_length(title_key)=32),
 rule_version VARCHAR(40) NOT NULL CHECK(rule_version ~ '^[a-z][a-z0-9-]{0,39}$'),
 decision VARCHAR(10) NOT NULL CHECK(decision IN ('ELIGIBLE','REVIEW')),
 category VARCHAR(10) CHECK(category IN ('LIFE','HUMOR')),
 reason VARCHAR(80) NOT NULL CHECK(reason ~ '^[A-Z][A-Z0-9_]{0,79}$'),
 classified_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 CHECK((decision='ELIGIBLE')=(category IS NOT NULL))
);
-- Original batch rows are excluded from selective backups. These minimal decisions remain restorable.
REVOKE ALL ON collect.batch_auto_publish_classification FROM PUBLIC;
