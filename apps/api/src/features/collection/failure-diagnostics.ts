export const diagnosticReasons = [
  'UNAPPROVED_SOURCE', 'CONFIG_BLOCKED', 'INVALID_URL', 'SCHEME_NOT_ALLOWED', 'HOST_NOT_ALLOWED',
  'PATH_NOT_ALLOWED', 'PORT_NOT_ALLOWED', 'URL_CREDENTIALS_NOT_ALLOWED', 'URL_FRAGMENT_NOT_ALLOWED',
  'NON_PUBLIC_IP', 'DNS_EMPTY', 'DNS_LOOKUP_FAILED', 'TLS_ERROR', 'TIMEOUT', 'CONNECTION_ERROR',
  'NETWORK_INTERRUPTED', 'HTTP_ACCESS_DENIED', 'HTTP_REJECTED', 'HTTP_RETRY_EXHAUSTED', 'HTTP_RATE_LIMITED',
  'ACCESS_CHALLENGE', 'PARSER_REJECTED', 'CHART_UNVERIFIED', 'REDIRECT_LIMIT', 'REDIRECT_HOST_NOT_ALLOWED',
  'REDIRECT_MISSING_LOCATION', 'REDIRECT_LOOP', 'BODY_TOO_LARGE', 'ENCODING_UNSUPPORTED',
] as const;
export interface SourceFailureLog {
  occurredAt: string;
  phase: 'CONFIG' | 'LIST' | 'CLAIM' | 'FETCH' | 'RAW' | 'PARSE' | 'PERSIST' | 'MEDIA' | 'REPORT';
  code: string;
  diagnosticReason: (typeof diagnosticReasons)[number] | null;
  requestHost: string | null;
  httpStatus: number | null;
}
const phases = new Set(['CONFIG', 'LIST', 'CLAIM', 'FETCH', 'RAW', 'PARSE', 'PERSIST', 'MEDIA', 'REPORT']);
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** Project trusted fields only: old/malformed rows cannot expose arbitrary failure detail. */
export function failureLogs(value: unknown): SourceFailureLog[] {
  if (!Array.isArray(value)) return [];
  const result: SourceFailureLog[] = [];
  for (const input of value.slice(0, 10)) {
    const item = record(input), detail = record(item.detail);
    const time = typeof item.occurredAt === 'string' ? new Date(item.occurredAt) : null;
    if (!time || Number.isNaN(time.getTime()) || typeof item.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(item.code)
      || typeof item.phase !== 'string' || !phases.has(item.phase)) continue;
    result.push({ occurredAt: time.toISOString(), phase: item.phase as SourceFailureLog['phase'], code: item.code,
      diagnosticReason: diagnosticReasons.find(reason => reason === detail.diagnosticReason) ?? null,
      requestHost: typeof detail.requestHost === 'string' && /^[a-z0-9.-]{1,253}$/.test(detail.requestHost) ? detail.requestHost : null,
      httpStatus: typeof detail.httpStatus === 'number' && Number.isInteger(detail.httpStatus) && detail.httpStatus >= 100 && detail.httpStatus <= 599 ? detail.httpStatus : null });
  }
  return result;
}
