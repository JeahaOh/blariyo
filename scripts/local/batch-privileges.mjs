// Keep fixed-local setup aligned with deploy/postgresql/apply-privileges.sql.
export async function grantLocalBatchPrivileges(client, role) {
  if (role !== 'blariyo_batch_local') throw Error('LOCAL_BATCH_ROLE_REQUIRED');
  await client.query(`GRANT USAGE ON SCHEMA collect TO ${role};
    REVOKE ALL ON ALL TABLES IN SCHEMA collect FROM ${role};
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA collect FROM PUBLIC,${role};
    GRANT SELECT,INSERT,UPDATE ON collect.batch_source,collect.batch_run,collect.batch_item,collect.batch_media,collect.batch_failure,collect.batch_report,collect.batch_checkpoint,collect.batch_queue,collect.batch_confirmation,collect.batch_input_receipt,collect.batch_source_runtime TO ${role};
    GRANT SELECT ON collect.batch_confirmation_receipt,collect.batch_runtime_projection TO ${role};
    GRANT DELETE ON collect.batch_media,collect.batch_source_runtime TO ${role};
    GRANT EXECUTE ON FUNCTION collect.assert_source_owner(text),collect.assert_run_owner(uuid),collect.assert_item_live(uuid),collect.lookup_dedup(text,text,text),collect.purge_authorized(text,uuid),collect.retention_backlog(),collect.assert_run_payload_live(uuid),collect.complete_confirmation(uuid,text,text,text,uuid),collect.cancel_confirmation(uuid,text,text,text),collect.lock_collection_writer(),collect.unlock_collection_writer(),collect.claim_web_requests(integer),collect.ack_web_request(uuid,uuid),collect.cleanup_input_receipts(),collect.web_retry_accessible(uuid),collect.reserve_batch_request(text,integer,bigint),collect.defer_batch_request(text,bigint),collect.retry_image(uuid,text),collect.prepare_image_retry(text,text),collect.discard_image_failure(uuid) TO ${role};`);
}
