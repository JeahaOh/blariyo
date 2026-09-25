\set ON_ERROR_STOP on
-- Input: policy_seed_hex = UTF-8 JSON encoded as hex, supplied through psql stdin.
-- Apply AFTER application migrations, as blariyo_migrator. Never makes a policy effective.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_user <> 'blariyo_migrator' OR current_database() <> 'blariyo' THEN
    RAISE EXCEPTION 'POLICY_SEED_DATABASE_ROLE_MISMATCH';
  END IF;
END $$;
-- Transaction-local input avoids granting TEMP privilege to the migrator.
SELECT
    set_config(
        'blariyo.policy_seed', convert_from(decode(:'policy_seed_hex', 'hex'), 'UTF8'), true
    ) IS NOT null AS seed_loaded;
DO $$ BEGIN
  IF (SELECT count(*) FROM jsonb_array_elements(current_setting('blariyo.policy_seed')::jsonb) AS s(item)) <> 2 OR
     (SELECT count(DISTINCT item->>'type') FROM jsonb_array_elements(current_setting('blariyo.policy_seed')::jsonb) AS s(item)) <> 2 OR
     EXISTS (SELECT FROM jsonb_array_elements(current_setting('blariyo.policy_seed')::jsonb) AS s(item) WHERE
       jsonb_typeof(item) <> 'object' OR
       COALESCE(item->>'type','') NOT IN ('TERMS','PRIVACY') OR
       COALESCE(item->>'version','') !~ '^v[0-9]+\.[0-9]+-draft\.[0-9]+$' OR
       length(item->>'version') > 20 OR
       COALESCE(length(trim(item->>'title')),0) NOT BETWEEN 1 AND 200 OR
       COALESCE(length(trim(item->>'body')),0) NOT BETWEEN 1 AND 1000000 OR
       item->>'status' IS DISTINCT FROM 'DRAFT' OR
       item->'effectiveAt' IS DISTINCT FROM 'null'::jsonb) THEN
    RAISE EXCEPTION 'POLICY_DRAFT_INPUT_INVALID';
  END IF;
END $$;
-- Also serializes with application publishers; wait rather than overwrite.
LOCK TABLE legal.policy_version IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT FROM legal.policy_version p JOIN jsonb_array_elements(current_setting('blariyo.policy_seed')::jsonb) AS s(item)
      ON p.policy_type=s.item->>'type' AND p.version_label=s.item->>'version'
    WHERE p.status <> 'DRAFT' OR p.effective_at IS NOT NULL OR p.ended_at IS NOT NULL OR
      p.title IS DISTINCT FROM s.item->>'title' OR p.body_html IS DISTINCT FROM s.item->>'body'
  ) THEN RAISE EXCEPTION 'POLICY_DRAFT_VERSION_CONFLICT'; END IF;
END $$;
INSERT INTO legal.policy_version
(policy_type,version_label,title,body_html,status,effective_at,ended_at,created_by,created_at,updated_by,updated_at)
SELECT
    item->>'type' AS policy_type,
    item->>'version' AS version_label,
    item->>'title' AS title,
    item->>'body' AS body_html,
    'DRAFT' AS status,
    null AS effective_at,
    null AS ended_at,
    'system:policy-publisher' AS created_by,
    now() AS created_at,
    'system:policy-publisher' AS updated_by,
    now() AS updated_at
FROM jsonb_array_elements(current_setting('blariyo.policy_seed')::jsonb) AS s(item) WHERE NOT EXISTS (
    SELECT FROM legal.policy_version p WHERE p.policy_type=s.item->>'type' AND p.version_label=s.item->>'version'
);
COMMIT;
