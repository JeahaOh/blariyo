// Explicit API ownership. New collect tables require an ownership review before grants.
export const apiCollectTables = ['source', 'candidate', 'candidate_image', 'collector_receipt', 'source_request_budget', 'source_request_reservation', 'collector_operational_event', 'source_discovery_policy', 'batch_review', 'batch_review_request', 'web_collection_request', 'web_collection_request_key'] as const;
export const batchResultTables = ['batch_source', 'batch_run', 'batch_item', 'batch_media', 'batch_failure', 'batch_report', 'batch_checkpoint', 'batch_retention', 'batch_dedup_key', 'batch_input_projection', 'batch_runtime_projection'] as const;
export const apiCollectSequences = ['source_id_seq','candidate_id_seq','candidate_image_id_seq'] as const;
