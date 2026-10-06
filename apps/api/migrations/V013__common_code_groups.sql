-- Migrate display metadata only. Collector identities and existing post snapshots stay unchanged.
LOCK TABLE content.source_code IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(WITH source_code_mapping(source_key,code) AS (VALUES
 ('theqoo','thqo'),('ppomppu','pmpu'),('yuldo','yldo'),('inven','invn'),('dogdrip','dgdp'),('ruliweb','rlwb'),
 ('arcalive','arca'),('bobaedream','bbae'),('clien','clin'),('dcinside','dcid'),('dmitory','dmtr'),('etoland','etld'),
 ('fmkorea','fmkr'),('goodgag','ggag'),('humoruniv','hmun'),('instiz','inst'),('mlbpark','mlbp'),('natepann','ntpn'),
 ('pgr21','pgr2'),('todayhumor','tdhm'),('youtube-community','ytcm')
 ) SELECT 1 FROM content.source_code s LEFT JOIN source_code_mapping m USING(source_key) WHERE m.code IS NULL) THEN
   RAISE EXCEPTION 'COMMON_CODES_UNMAPPED_SOURCE_KEY';
 END IF;
END $$;
CREATE TABLE content.common_code_group (
 group_key VARCHAR(40) PRIMARY KEY CHECK(group_key ~ '^[a-z][a-z0-9_-]{0,39}$'),
 display_name VARCHAR(200) NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 200 AND display_name=btrim(display_name)),
 lock_version INTEGER NOT NULL DEFAULT 1 CHECK(lock_version>=1),
 created_by VARCHAR(100) NOT NULL CHECK(created_by ~ '^(admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}|system:migration)$'),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 updated_by VARCHAR(100) NOT NULL CHECK(updated_by ~ '^(admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}|system:migration)$'),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 CHECK(updated_at>=created_at)
);
CREATE TABLE content.common_code (
 group_key VARCHAR(40) NOT NULL REFERENCES content.common_code_group(group_key),
 code VARCHAR(40) NOT NULL CHECK(code ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
 display_name VARCHAR(200) NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 200 AND display_name=btrim(display_name)),
 reference_key VARCHAR(80),
 lock_version INTEGER NOT NULL DEFAULT 1 CHECK(lock_version>=1),
 created_by VARCHAR(100) NOT NULL CHECK(created_by ~ '^(admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}|system:migration)$'),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 updated_by VARCHAR(100) NOT NULL CHECK(updated_by ~ '^(admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}|system:migration)$'),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 PRIMARY KEY(group_key,code), UNIQUE(group_key,reference_key),
 CHECK(updated_at>=created_at),
 CHECK((group_key='source' AND code ~ '^[a-z][a-z0-9]{3}$' AND reference_key IS NOT NULL AND reference_key ~ '^[a-z][a-z0-9-]{0,79}$')
   OR (group_key<>'source' AND reference_key IS NULL))
);
CREATE FUNCTION content.guard_common_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.group_key<>OLD.group_key OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at
   OR NEW.lock_version<>OLD.lock_version+1 THEN
   RAISE EXCEPTION 'invalid common code update' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='common_code' THEN
   IF NEW.code<>OLD.code OR NEW.reference_key IS DISTINCT FROM OLD.reference_key THEN
     RAISE EXCEPTION 'immutable common code identity' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_common_code_group BEFORE UPDATE ON content.common_code_group FOR EACH ROW EXECUTE FUNCTION content.guard_common_code();
CREATE TRIGGER guard_common_code BEFORE UPDATE ON content.common_code FOR EACH ROW EXECUTE FUNCTION content.guard_common_code();
INSERT INTO content.common_code_group(group_key,display_name,created_by,updated_by) VALUES('source','출처','system:migration','system:migration');
WITH source_code_mapping(source_key,code) AS (VALUES
 ('theqoo','thqo'),('ppomppu','pmpu'),('yuldo','yldo'),('inven','invn'),('dogdrip','dgdp'),('ruliweb','rlwb'),
 ('arcalive','arca'),('bobaedream','bbae'),('clien','clin'),('dcinside','dcid'),('dmitory','dmtr'),('etoland','etld'),
 ('fmkorea','fmkr'),('goodgag','ggag'),('humoruniv','hmun'),('instiz','inst'),('mlbpark','mlbp'),('natepann','ntpn'),
 ('pgr21','pgr2'),('todayhumor','tdhm'),('youtube-community','ytcm')
)
INSERT INTO content.common_code(group_key,code,display_name,reference_key,lock_version,created_by,created_at,updated_by,updated_at)
 SELECT 'source',m.code,s.display_name,s.source_key,s.lock_version,s.created_by,s.created_at,s.updated_by,s.updated_at
 FROM content.source_code s JOIN source_code_mapping m USING(source_key);
DROP TABLE content.source_code;
DROP FUNCTION content.guard_source_code();
REVOKE ALL ON content.common_code_group,content.common_code FROM PUBLIC;
