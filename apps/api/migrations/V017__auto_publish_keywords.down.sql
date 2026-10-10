DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM collect.auto_publish_keyword_revision WHERE revision>1)
 OR EXISTS(SELECT 1 FROM collect.batch_review_command WHERE origin='AUTO' AND finished_at IS NULL) THEN
  RAISE EXCEPTION 'AUTO_PUBLISH_KEYWORDS_ROLLBACK_REQUIRES_HANDOFF';
 END IF;
END $$;
DROP TABLE collect.auto_publish_keyword_head;
DROP TABLE collect.auto_publish_keyword_revision;
DROP FUNCTION collect.protect_keyword_revision();
