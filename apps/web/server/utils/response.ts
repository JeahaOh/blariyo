export function responseEnvelope(value: unknown) {
  if (typeof value !== 'object' || value === null || !('meta' in value))
    throw new Error('Invalid API response');
  const meta = value.meta;
  if (
    typeof meta !== 'object' ||
    meta === null ||
    !('requestId' in meta) ||
    typeof meta.requestId !== 'string'
  )
    throw new Error('Invalid API response metadata');
  return { ...value, meta: { ...meta }, ...('data' in value ? { data: value.data } : {}) };
}
export function errorStatus(error: unknown): number | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
    ? error.statusCode
    : undefined;
}
