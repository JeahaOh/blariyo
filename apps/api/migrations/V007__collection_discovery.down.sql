-- Refuse rollback while list candidates or reservations exist; never discard collected records.
ALTER TABLE collect.candidate DROP CONSTRAINT candidate_discovery_mode_check;
ALTER TABLE collect.candidate ADD CONSTRAINT candidate_discovery_mode_check CHECK(discovery_mode='MANUAL_URL');
ALTER TABLE collect.source_request_reservation DROP CONSTRAINT source_request_reservation_request_kind_check;
ALTER TABLE collect.source_request_reservation ADD CONSTRAINT source_request_reservation_request_kind_check
CHECK(request_kind IN ('ROBOTS','DETAIL','REDIRECT','IMAGE'));
DROP INDEX collect.uq_collect_candidate_source_post_key;
ALTER TABLE collect.candidate DROP COLUMN source_post_key;
DROP TABLE collect.source_discovery_policy;
