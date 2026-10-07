-- API-owned display codes; never an approval or parser configuration.
CREATE TABLE content.source_code (
 source_key VARCHAR(80) PRIMARY KEY CHECK(source_key ~ '^[a-z][a-z0-9-]{0,79}$'),
 display_name VARCHAR(200) NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 200 AND display_name=btrim(display_name)),
 lock_version INTEGER NOT NULL DEFAULT 1 CHECK(lock_version>=1),
 created_by VARCHAR(100) NOT NULL CHECK(created_by ~ '^(admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}|system:migration)$'),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 updated_by VARCHAR(100) NOT NULL CHECK(updated_by ~ '^(admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}|system:migration)$'),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 CHECK(updated_at>=created_at)
);
CREATE FUNCTION content.guard_source_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.source_key<>OLD.source_key OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at
   OR NEW.lock_version<>OLD.lock_version+1 THEN
   RAISE EXCEPTION 'invalid source code update' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_source_code BEFORE UPDATE ON content.source_code FOR EACH ROW EXECUTE FUNCTION content.guard_source_code();
INSERT INTO content.source_code(source_key,display_name,created_by,updated_by) VALUES
 ('arcalive','아카라이브','system:migration','system:migration'),
 ('bobaedream','보배드림','system:migration','system:migration'),
 ('clien','클리앙','system:migration','system:migration'),
 ('dcinside','디시인사이드','system:migration','system:migration'),
 ('dmitory','디미토리','system:migration','system:migration'),
 ('dogdrip','개드립','system:migration','system:migration'),
 ('etoland','이토랜드','system:migration','system:migration'),
 ('fmkorea','에펨코리아','system:migration','system:migration'),
 ('goodgag','고급유머','system:migration','system:migration'),
 ('humoruniv','웃긴대학','system:migration','system:migration'),
 ('instiz','인스티즈','system:migration','system:migration'),
 ('inven','인벤','system:migration','system:migration'),
 ('mlbpark','MLBPARK','system:migration','system:migration'),
 ('natepann','네이트판','system:migration','system:migration'),
 ('pgr21','PGR21','system:migration','system:migration'),
 ('ppomppu','뽐뿌','system:migration','system:migration'),
 ('ruliweb','루리웹','system:migration','system:migration'),
 ('theqoo','더쿠','system:migration','system:migration'),
 ('todayhumor','오늘의유머','system:migration','system:migration'),
 ('youtube-community','유튜브 커뮤니티','system:migration','system:migration'),
 ('yuldo','율도','system:migration','system:migration');
REVOKE ALL ON content.source_code FROM PUBLIC;
