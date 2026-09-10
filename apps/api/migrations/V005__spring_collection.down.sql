DROP TRIGGER reset_preview_metadata ON collect.candidate_image;
DROP FUNCTION collect.reset_preview_metadata();
DROP TRIGGER reset_execution_metadata ON collect.candidate;
DROP FUNCTION collect.reset_execution_metadata();
DROP TABLE collect.collector_operational_event, collect.source_request_reservation, collect.source_request_budget, collect.collector_receipt;
ALTER TABLE collect.candidate_image DROP preview_source_sha256, DROP preview_uploaded_at;
ALTER TABLE collect.candidate DROP collector_execution_id, DROP last_heartbeat_at, DROP result_payload_sha256;
ALTER TABLE collect.source DROP next_request_at;
