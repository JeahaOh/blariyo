\set ON_ERROR_STOP on
-- Add only the batch login. Never alter existing application roles or credentials.
BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
DO $$ BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'blariyo'
    OR (SELECT count(*) FROM pg_roles WHERE rolname IN ('blariyo_app','blariyo_migrator','blariyo_backup')) <> 3
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='blariyo_batch') THEN
    RAISE EXCEPTION 'BATCH_ROLE_SETUP_STATE_INVALID';
  END IF;
END $$;
CREATE ROLE blariyo_batch LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD :'batch_password';
GRANT CONNECT ON DATABASE blariyo TO blariyo_batch;
ALTER ROLE blariyo_batch IN DATABASE blariyo SET timezone = 'UTC';
ALTER ROLE blariyo_batch IN DATABASE blariyo SET statement_timeout = '30s';
ALTER ROLE blariyo_batch IN DATABASE blariyo SET lock_timeout = '5s';
ALTER ROLE blariyo_batch IN DATABASE blariyo SET idle_in_transaction_session_timeout = '30s';
COMMIT;
