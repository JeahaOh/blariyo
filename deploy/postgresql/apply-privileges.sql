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
-- Reset existing and future privileges, including optional Collector framework schemas.
-- Runtime roles never inherit access to a new collect table merely because it exists.
DO $$
DECLARE s text; r text;
BEGIN
  FOR s IN SELECT nspname FROM pg_namespace WHERE nspname IN ('content','legal','ops','collect','collector','batch','quartz') LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=s AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) THEN
      RAISE EXCEPTION 'MIGRATION_SCHEMA_OWNERSHIP_REQUIRED';
    END IF;
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,blariyo_app,blariyo_backup',s);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO blariyo_backup',s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO blariyo_backup',s);
    EXECUTE format('GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO blariyo_backup',s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I GRANT SELECT ON TABLES TO blariyo_backup',s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I GRANT SELECT ON SEQUENCES TO blariyo_backup',s);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='blariyo_batch') THEN
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM blariyo_batch',s);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM blariyo_batch',s);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM blariyo_batch',s);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM blariyo_batch',s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I REVOKE ALL ON TABLES FROM blariyo_batch',s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM blariyo_batch',s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM blariyo_batch',s);
    END IF;
  END LOOP;
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('blariyo_app','blariyo_batch','blariyo_backup') LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE ALL ON TABLES FROM %I',r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE ALL ON SEQUENCES FROM %I',r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE EXECUTE ON FUNCTIONS FROM %I',r);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE ALL ON TABLES FROM public;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE ALL ON SEQUENCES FROM public;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator REVOKE EXECUTE ON FUNCTIONS FROM public;
GRANT USAGE ON SCHEMA content,legal,ops,collect TO blariyo_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA content,legal TO blariyo_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ops.outbox_task,ops.idempotency_request,ops.schedule_failure_alert TO blariyo_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA content,legal TO blariyo_app;
GRANT EXECUTE ON FUNCTION ops.is_schema_ready(TEXT) TO blariyo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content,
legal GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLES TO blariyo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE blariyo_migrator IN SCHEMA content,
legal GRANT USAGE,
SELECT ON SEQUENCES TO blariyo_app;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['source','candidate','candidate_image','collector_receipt','source_request_budget','source_request_reservation','collector_operational_event','source_discovery_policy','batch_review','batch_review_request'] LOOP
    IF to_regclass('collect.'||t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON collect.%I TO blariyo_app',t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['source_id_seq','candidate_id_seq','candidate_image_id_seq'] LOOP
    IF to_regclass('collect.'||t) IS NOT NULL THEN
      EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE collect.%I TO blariyo_app',t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['batch_source','batch_run','batch_item','batch_media','batch_failure','batch_report','batch_checkpoint'] LOOP
    IF to_regclass('collect.'||t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON collect.%I TO blariyo_app',t);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='blariyo_batch') THEN
    GRANT USAGE ON SCHEMA collect TO blariyo_batch;
    FOREACH t IN ARRAY ARRAY['batch_source','batch_run','batch_item','batch_media','batch_failure','batch_report','batch_checkpoint','batch_queue','batch_confirmation'] LOOP
      IF to_regclass('collect.'||t) IS NOT NULL THEN
        EXECUTE format('GRANT SELECT,INSERT,UPDATE ON collect.%I TO blariyo_batch',t);
      END IF;
    END LOOP;
    -- Only media replacement needs DELETE; lifecycle rows remain immutable.
    IF to_regclass('collect.batch_media') IS NOT NULL THEN
      GRANT DELETE ON collect.batch_media TO blariyo_batch;
    END IF;
    FOREACH t IN ARRAY ARRAY['collect.assert_source_owner(text)','collect.assert_run_owner(uuid)'] LOOP
      IF to_regprocedure(t) IS NOT NULL THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO blariyo_batch',t);
      END IF;
    END LOOP;
  END IF;
END $$;
COMMIT;
