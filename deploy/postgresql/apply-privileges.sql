\set ON_ERROR_STOP on
-- Run as blariyo_migrator after SQL migrations. Safe to repeat after each release.
BEGIN;
DO $$
BEGIN
  IF current_user <> 'blariyo_migrator' OR current_database() <> 'blariyo' THEN
    RAISE EXCEPTION 'BLARIYO_MIGRATOR_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_namespace
      WHERE nspname IN ('content','legal','ops','collect')
        AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)) <> 4 THEN
    RAISE EXCEPTION 'MIGRATION_SCHEMA_OWNERSHIP_REQUIRED';
  END IF;
END $$;
REVOKE ALL ON SCHEMA content, legal, ops, collect FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA content, legal, ops, collect FROM PUBLIC, blariyo_app, blariyo_backup;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA content, legal, ops, collect FROM PUBLIC, blariyo_app, blariyo_backup;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA content, legal, ops, collect FROM PUBLIC, blariyo_app, blariyo_backup;
GRANT USAGE ON SCHEMA content, legal, ops, collect TO blariyo_app, blariyo_backup;
REVOKE CREATE ON SCHEMA content, legal, ops, collect FROM blariyo_app, blariyo_backup;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA content, legal, collect TO blariyo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.outbox_task, ops.idempotency_request, ops.schedule_failure_alert TO blariyo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA content, legal, ops, collect TO blariyo_app;
REVOKE ALL ON ops.schema_migration FROM blariyo_app;
GRANT EXECUTE ON FUNCTION ops.is_schema_ready(TEXT) TO blariyo_app;
GRANT SELECT ON ALL TABLES IN SCHEMA content, legal, ops, collect TO blariyo_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA content, legal, ops, collect TO blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator
  REVOKE ALL ON TABLES FROM PUBLIC, blariyo_app, blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator
  REVOKE ALL ON SEQUENCES FROM PUBLIC, blariyo_app, blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content, legal, ops, collect
  REVOKE ALL ON TABLES FROM PUBLIC, blariyo_app, blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content, legal, ops, collect
  REVOKE ALL ON SEQUENCES FROM PUBLIC, blariyo_app, blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content, legal, collect
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO blariyo_app;
-- ops tables are explicitly reviewed above; never default-grant access to the migration ledger.
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA ops
  REVOKE ALL ON TABLES FROM blariyo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content, legal, ops, collect
  GRANT USAGE, SELECT ON SEQUENCES TO blariyo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content, legal, ops, collect
  GRANT SELECT ON TABLES TO blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content, legal, ops, collect
  GRANT SELECT ON SEQUENCES TO blariyo_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
