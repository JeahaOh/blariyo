\set ON_ERROR_STOP on
-- For a new blariyo database only. Password variables are supplied through stdin, never argv.
BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
DO $$
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'blariyo' THEN
    RAISE EXCEPTION 'NEW_BLARIYO_DATABASE_REQUIRED';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('blariyo_app', 'blariyo_migrator', 'blariyo_backup'))
     OR EXISTS (SELECT FROM pg_namespace WHERE nspname IN ('content', 'legal', 'ops', 'collect')) THEN
    RAISE EXCEPTION 'DATABASE_ALREADY_PREPARED';
  END IF;
END $$;
CREATE ROLE blariyo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD :'app_password';
CREATE ROLE blariyo_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD :'migrator_password';
CREATE ROLE blariyo_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD :'backup_password';
REVOKE ALL ON DATABASE blariyo FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE blariyo TO blariyo_app, blariyo_migrator, blariyo_backup;
GRANT CREATE ON DATABASE blariyo TO blariyo_migrator;
ALTER DATABASE blariyo SET timezone = 'UTC';
ALTER ROLE blariyo_app IN DATABASE blariyo SET timezone = 'UTC';
ALTER ROLE blariyo_app IN DATABASE blariyo SET statement_timeout = '30s';
ALTER ROLE blariyo_app IN DATABASE blariyo SET lock_timeout = '5s';
ALTER ROLE blariyo_app IN DATABASE blariyo SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE blariyo_migrator IN DATABASE blariyo SET timezone = 'UTC';
ALTER ROLE blariyo_backup IN DATABASE blariyo SET timezone = 'UTC';
ALTER ROLE blariyo_backup IN DATABASE blariyo SET default_transaction_read_only = on;
-- Functions created by future migrations must opt in to external execution.
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
