-- Destructive rollback would discard retention evidence. Keep metadata and close writes instead.
DO $$ BEGIN RAISE EXCEPTION 'RETENTION_ROLLBACK_REQUIRES_READ_ONLY_HANDOFF'; END $$;
