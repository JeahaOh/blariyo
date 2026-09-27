// Classification is closed: adding a collect table requires an explicit data-retention decision.
export const profileVersion = 'm0-direct-excluded-v1';
const preserved = new Set([
  'source', 'candidate', 'candidate_image', 'collector_receipt', 'source_request_budget',
  'source_request_reservation', 'collector_operational_event', 'source_discovery_policy',
  'batch_source', 'batch_dedup_key', 'batch_retention', 'batch_purge_object', 'batch_retention_control',
  'batch_request_budget',
]);
const excluded = new Set([
  'batch_item', 'batch_media', 'batch_run', 'batch_report', 'batch_checkpoint', 'batch_failure',
  'batch_confirmation', 'batch_confirmation_receipt', 'batch_queue', 'batch_media_correction',
  'batch_review', 'batch_review_request', 'batch_purge_scope',
  'web_collection_request', 'web_collection_request_key', 'batch_input_receipt', 'batch_source_runtime',
]);
export const requiredExclusions = [...excluded].slice(0, 13).map(name => 'collect.' + name).sort();
export function classifyCollect(tables) {
  const result = [];
  for (const table of tables) {
    if (typeof table !== 'string' || !/^collect\.[a-z][a-z0-9_]*$/.test(table)) throw Error('BACKUP_TABLE_ID_INVALID');
    const name = table.substring(8);
    if (!preserved.has(name) && !excluded.has(name)) throw Error('BACKUP_UNCLASSIFIED_COLLECT_TABLE');
    if (excluded.has(name)) result.push(table);
  }
  if (new Set(tables).size !== tables.length) throw Error('BACKUP_TABLE_ID_DUPLICATE');
  return result.sort();
}
export function validateExcludedTables(tables) {
  if (!Array.isArray(tables) || requiredExclusions.some(table => !tables.includes(table)) ||
      JSON.stringify(classifyCollect(tables)) !== JSON.stringify([...tables].sort()))
    throw Error('BACKUP_EXCLUSION_PROFILE_INVALID');
}
