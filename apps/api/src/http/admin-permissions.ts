/** Explicit permissions: adding an OpenAPI operation does not silently grant access. */
const editorialOperations = new Set([
  'listAutoPublishKeywords', 'listSourcePublishPolicies', 'listCommonCodeGroups', 'listCommonCodes', 'searchAdminPosts', 'createPost', 'getPostEditor', 'updatePost', 'removePost',
  'uploadImages', 'previewImage', 'discardImage', 'publishPost', 'unschedulePost',
  'hidePost', 'republishPost', 'listCollectionSources', 'listCollectionCandidates',
  'createCollectionCandidate', 'getCollectionCandidate', 'previewCollectionImage',
  'retryCollectionCandidate', 'rejectCollectionCandidate', 'promoteCollectionCandidate',
  'createBatchReviewCommand', 'getBatchReviewCommandStatus',
  'listBatchItems', 'getBatchItem', 'reviewBatchItem', 'promoteBatchItem', 'previewBatchImage', 'deleteBatchItem',
  'createDirectCollectionRequest', 'getDirectCollectionRequest',
  'retryDirectCollectionRequest', 'listRuntimeCollectionSources',
]);
const ownerOperations = new Set([
  ...editorialOperations, 'createAutoPublishKeyword', 'updateAutoPublishKeyword', 'bulkAutoPublishKeywords', 'updateSourcePublishPolicy', 'createCommonCodeGroup', 'updateCommonCodeGroup', 'createCommonCode', 'updateCommonCode', 'updateCollectionSource',
  'listCollectorOperationalEvents', 'acknowledgeCollectorOperationalEvent',
]);
export type AdminRole = 'OWNER' | 'EDITOR';
export function permitsAdminOperation(role: string, operation: string): boolean {
  if (role === 'OWNER') return ownerOperations.has(operation);
  if (role === 'EDITOR') return editorialOperations.has(operation);
  return false;
}
