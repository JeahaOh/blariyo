-- Independent opt-in: existing manual sources stay unchanged and no live source is enabled here.
CREATE TABLE collect.source_discovery_policy (
    source_id BIGINT PRIMARY KEY REFERENCES collect.source(id),
    enabled BOOLEAN NOT NULL DEFAULT false,
    list_url VARCHAR(2048) NOT NULL CHECK(list_url ~ '^https://'),
    reviewed_at TIMESTAMPTZ(3) NOT NULL,
    policy_version VARCHAR(100) NOT NULL CHECK(length(trim(policy_version)) > 0)
);
ALTER TABLE collect.candidate DROP CONSTRAINT candidate_discovery_mode_check;
ALTER TABLE collect.candidate ADD CONSTRAINT candidate_discovery_mode_check
CHECK(discovery_mode IN ('MANUAL_URL','LIST_CRAWL'));
ALTER TABLE collect.candidate ADD COLUMN source_post_key VARCHAR(200);
CREATE UNIQUE INDEX uq_collect_candidate_source_post_key ON collect.candidate(source_id,source_post_key)
WHERE source_post_key IS NOT null;
ALTER TABLE collect.source_request_reservation DROP CONSTRAINT source_request_reservation_request_kind_check;
ALTER TABLE collect.source_request_reservation ADD CONSTRAINT source_request_reservation_request_kind_check
CHECK(request_kind IN ('ROBOTS','DETAIL','REDIRECT','IMAGE','LIST'));
