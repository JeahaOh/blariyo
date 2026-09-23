export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  await adminIdentity(event);
  return { batchReview: Boolean(useRuntimeConfig(event).collectBatchReviewEnabled) };
});
