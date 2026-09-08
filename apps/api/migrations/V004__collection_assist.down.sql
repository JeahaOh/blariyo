-- Prevent rollback from silently discarding collected work or idempotency evidence.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM collect.source) OR EXISTS(SELECT 1 FROM ops.idempotency_request WHERE resource_type='CANDIDATE') THEN
 RAISE EXCEPTION 'COLLECTION_DATA_REQUIRES_REVIEW'; END IF;
END $$;
DROP TABLE collect.candidate_image,collect.candidate,collect.source;
DROP SCHEMA collect;
ALTER TABLE ops.idempotency_request DROP CONSTRAINT idempotency_request_resource_type_check;
ALTER TABLE ops.idempotency_request ADD CONSTRAINT idempotency_request_resource_type_check CHECK(resource_type='POST');
