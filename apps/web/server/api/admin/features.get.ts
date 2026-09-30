export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  await adminIdentity(event);
  const config = useRuntimeConfig(event);
  return { batchReview: Boolean(config.collectBatchReviewEnabled), directInput: Boolean(config.collectDirectInputEnabled) };
});
