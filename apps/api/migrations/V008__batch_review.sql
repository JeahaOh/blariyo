-- API-owned review ledger. Batch-owned result tables remain read-only to the API.
-- No FK to batch_item: the independently installed batch ledger can be absent.
-- The service validates the item/version and stores an immutable reviewed identity.
CREATE TABLE collect.batch_review (
    item_id UUID PRIMARY KEY,
    item_version BIGINT NOT NULL CHECK(item_version >= 0),
    content_digest BYTEA NOT NULL CHECK(octet_length(content_digest)=32),
    source_key VARCHAR(80) NOT NULL,
    source_post_key VARCHAR(200),
    canonical_url_hash BYTEA NOT NULL CHECK(octet_length(canonical_url_hash)=32),
    status VARCHAR(16) NOT NULL CHECK(status IN ('REVIEWING','REJECTED','APPROVED')),
    lock_version INTEGER NOT NULL DEFAULT 1 CHECK(lock_version >= 1),
    post_id BIGINT UNIQUE REFERENCES content.board_post(id),
    updated_by VARCHAR(100) NOT NULL CHECK(updated_by ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$'),
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CHECK(post_id IS NULL OR status='APPROVED')
);
CREATE UNIQUE INDEX uq_batch_review_promoted_url ON collect.batch_review(canonical_url_hash) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX uq_batch_review_promoted_source ON collect.batch_review(
    source_key,source_post_key
) WHERE post_id IS NOT NULL;
CREATE FUNCTION collect.guard_batch_review() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'REVIEWING' OR NEW.lock_version<>1 OR NEW.post_id IS NOT NULL THEN
     RAISE EXCEPTION 'invalid initial review' USING ERRCODE='23514';
   END IF;
 ELSE
   IF OLD.post_id IS NOT NULL OR NEW.item_id<>OLD.item_id OR NEW.source_key<>OLD.source_key
     OR NEW.source_post_key IS DISTINCT FROM OLD.source_post_key OR NEW.canonical_url_hash<>OLD.canonical_url_hash
     OR NEW.lock_version<>OLD.lock_version+1 THEN
     RAISE EXCEPTION 'invalid review update' USING ERRCODE='23514';
   END IF;
   IF NOT ((OLD.status='REVIEWING' AND NEW.status IN ('APPROVED','REJECTED'))
     OR (NEW.status='REVIEWING' AND (OLD.status IN ('APPROVED','REJECTED') OR NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest))
     OR (OLD.status='APPROVED' AND NEW.status='APPROVED' AND NEW.post_id IS NOT NULL AND NEW.item_version=OLD.item_version)) THEN
     RAISE EXCEPTION 'invalid review transition' USING ERRCODE='23514';
   END IF;
   IF (NEW.item_version<>OLD.item_version OR NEW.content_digest<>OLD.content_digest) AND NEW.status<>'REVIEWING' THEN
     RAISE EXCEPTION 'stale reviewed item' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_batch_review
BEFORE INSERT OR UPDATE ON collect.batch_review
FOR EACH ROW
EXECUTE FUNCTION collect.guard_batch_review();
CREATE TABLE collect.batch_review_request (
    actor VARCHAR(100) NOT NULL CHECK(actor ~ '^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$'),
    scope VARCHAR(200) NOT NULL,
    request_key VARCHAR(200) NOT NULL,
    digest BYTEA NOT NULL CHECK(octet_length(digest)=32),
    response_status INTEGER NOT NULL CHECK(response_status IN (200,201)),
    response_data JSONB NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    PRIMARY KEY(actor,scope,request_key)
);
REVOKE ALL ON collect.batch_review,collect.batch_review_request FROM public;
