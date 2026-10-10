DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM collect.batch_auto_publish_classification)
 OR EXISTS(SELECT 1 FROM collect.batch_source_publish_policy)
 OR EXISTS(SELECT 1 FROM collect.batch_review_command WHERE origin='AUTO') THEN
  RAISE EXCEPTION 'AUTO_PUBLISH_CLASSIFICATION_ROLLBACK_REQUIRES_HANDOFF';
 END IF;
END $$;
DROP TABLE collect.batch_auto_publish_classification;
DROP INDEX content.ix_board_post_auto_title;
DROP FUNCTION collect.auto_publish_title_key(TEXT);
