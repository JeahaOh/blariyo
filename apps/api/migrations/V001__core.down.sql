DROP SCHEMA content CASCADE;
DROP SCHEMA legal CASCADE;
DROP FUNCTION ops.is_schema_ready(TEXT);
DROP TABLE ops.idempotency_request, ops.outbox_task;
