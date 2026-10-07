export interface BatchResultRow {
  id: string; source_key: string; source_post_key: string | null; canonical_url: string;
  state: string; title: string | null; body_blocks: unknown; attachment_metadata: unknown;
  failure_code: string | null; skip_reason: string | null;
  fetched_at: string | null;
  sns_links: unknown; raw_object_key: string | null; version: string;
  collected_at: string; review_finalized_at: string | null; expires_at: string;
  retention_state: 'LIVE' | 'PURGE_PENDING' | 'PURGE_FAILED' | 'PURGED';
  accessDeadline: number;
}
export abstract class BatchResultRepository {
  abstract find(itemId: string): Promise<BatchResultRow | null>;
}
