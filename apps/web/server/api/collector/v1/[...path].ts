import { randomUUID, createHash } from 'node:crypto';
import {
  matchOperation,
  validateRequest,
  validateResponse,
  projectResponse,
  normalizeInput,
} from '@blariyo/contracts';
const limits = new Map<string, { count: number; expires: number }>();
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event),
    requestId = randomUUID();
  setHeader(event, 'X-Request-Id', requestId);
  setHeader(event, 'Cache-Control', 'private, no-store');
  const error = (status: number, code: string) => {
    setResponseStatus(event, status);
    return {
      success: false,
      error: { code, message: '수집 작업을 처리하지 못했습니다.' },
      meta: { requestId },
    };
  };
  if (!config.collectManualUrlEnabled && !config.collectDiscordCommandEnabled)
    return error(404, 'CANDIDATE_NOT_FOUND');
  const url = getRequestURL(event),
    operation = matchOperation(event.method, url.pathname);
  if (!operation || !url.pathname.startsWith('/api/collector/v1/'))
    return error(404, 'CANDIDATE_NOT_FOUND');
  if (getHeader(event, 'origin')) return error(403, 'COLLECTOR_FORBIDDEN');
  if (operation.operationId === 'collectorCreateCandidate' && !config.collectDiscordCommandEnabled)
    return error(404, 'CANDIDATE_NOT_FOUND');
  const authorization = getHeader(event, 'authorization') || '';
  if (!/^Bearer [^\s]{32,512}$/.test(authorization)) return error(401, 'COLLECTOR_AUTH_REQUIRED');
  const now = Date.now(),
    key = createHash('sha256').update(authorization).digest('hex');
  for (const [id, entry] of limits) if (entry.expires <= now) limits.delete(id);
  if (!limits.has(key) && limits.size >= 1000) return error(429, 'RATE_LIMITED');
  const limit = limits.get(key) || { count: 0, expires: now + 60000 };
  limit.count++;
  limits.set(key, limit);
  if (limit.count > 120) {
    setHeader(event, 'Retry-After', '60');
    return error(429, 'RATE_LIMITED');
  }
  try {
    const multipart = operation.operationId === 'collectorUploadPreview';
    const maximum = multipart ? 11 * 1024 * 1024 : 256 * 1024;
    if (Number(getHeader(event, 'content-length') || 0) > maximum)
      return error(413, 'UPLOAD_TOO_LARGE');
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of event.node.req) {
      length += chunk.length;
      if (length > maximum) return error(413, 'UPLOAD_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks);
    let body;
    if (!multipart) {
      try {
        body = raw.length ? normalizeInput(JSON.parse(raw.toString())) : undefined;
      } catch {
        return error(400, 'VALIDATION_FAILED');
      }
    }
    if (!validateRequest(operation, { query: getQuery(event), headers: getHeaders(event), body }))
      return error(400, 'VALIDATION_FAILED');
    const headers: Record<string, string> = {
      Authorization: authorization,
      'Content-Type': multipart ? getHeader(event, 'content-type') || '' : 'application/json',
    };
    const idempotency = getHeader(event, 'idempotency-key');
    if (idempotency) headers['Idempotency-Key'] = idempotency;
    // Caller-supplied admin actors, service tokens, cookies and forwarding headers are never relayed.
    const response = await fetch(
      config.coreOrigin +
        url.pathname.replace('/api/collector/v1', '/internal/collect') +
        url.search,
      {
        method: event.method,
        headers,
        body: multipart ? raw : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      }
    );
    const value = await response.json();
    if (!validateResponse(operation, response.status, value))
      return error(503, 'DEPENDENCY_UNAVAILABLE');
    const result = projectResponse(operation, response.status, value);
    result.meta.requestId = requestId;
    setResponseStatus(event, response.status);
    if (response.headers.has('retry-after'))
      setHeader(event, 'Retry-After', response.headers.get('retry-after')!);
    return result;
  } catch {
    return error(503, 'DEPENDENCY_UNAVAILABLE');
  }
});
