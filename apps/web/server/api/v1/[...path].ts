import { randomUUID, createHash } from 'node:crypto';
import type { H3Event } from 'h3';
import {
  matchOperation,
  validateRequest,
  validateResponse,
  normalizeInput,
  projectResponse,
} from '@blariyo/contracts';
const viewLimits = new Map<string, { count: number; expires: number }>();
export async function proxyCoreRequest(event: H3Event, directAlias = false) {
  const requestId = randomUUID(),
    config = useRuntimeConfig(event);
  setHeader(event, 'X-Request-Id', requestId);
  setHeader(event, 'Cache-Control', 'no-store');
  const error = (status: number, code: string) => {
    setResponseStatus(event, status);
    return {
      success: false,
      error: { code, message: '요청을 처리하지 못했습니다. 다시 확인해 주세요.' },
      meta: { requestId },
    };
  };
  try {
    const url = getRequestURL(event);
    if (directAlias) url.pathname = url.pathname.replace(/^\/api\/admin\/collect\//, '/api/v1/admin/collect/');
    const operation = matchOperation(event.method, url.pathname);
    if (!operation) return error(404, 'POST_NOT_FOUND');
    const batchReview = /^\/api\/v1\/admin\/collect\/(?:batch-items|source-publish-policies|auto-publish-keywords)(?:\/|$)/.test(url.pathname);
    const directInput = /^\/api\/v1\/admin\/collect\/(requests|runtime-sources)(?:\/|$)/.test(url.pathname);
    if (directInput && !config.collectDirectInputEnabled) return error(404, 'COLLECTION_REQUEST_NOT_FOUND');
    if (directAlias && !directInput) return error(404, 'COLLECTION_REQUEST_NOT_FOUND');
    if (batchReview && !config.collectBatchReviewEnabled) return error(404, 'BATCH_ITEM_NOT_FOUND');
    if (
      !batchReview && !directInput && url.pathname.startsWith('/api/v1/admin/collect/') &&
      !config.collectManualUrlEnabled &&
      !config.collectDiscordCommandEnabled
    )
      return error(404, 'CANDIDATE_NOT_FOUND');
    if (operation.operationId === 'createCollectionCandidate' && !config.collectManualUrlEnabled)
      return error(404, 'CANDIDATE_NOT_FOUND');
    const headers: Record<string, string> = {};
    if (url.pathname.startsWith('/api/v1/admin/')) {
      try {
        const identity = await adminIdentity(event);
        headers['X-Blariyo-Admin-Actor'] = identity.actor;
        // Forward only the verified registry role, never a client supplied role header.
        headers['X-Blariyo-Admin-Role'] = identity.role;
      } catch (e: unknown) {
        return error(
          errorStatus(e) === 403 ? 403 : 401,
          errorStatus(e) === 403 ? 'ADMIN_FORBIDDEN' : 'ADMIN_AUTH_REQUIRED'
        );
      }
      headers['X-Blariyo-Service-Token'] = config.serviceToken;
      if (
        !['GET', 'HEAD'].includes(event.method) &&
        getHeader(event, 'origin') !== config.public.siteOrigin
      )
        return error(403, 'ADMIN_FORBIDDEN');
    }
    const key = getHeader(event, 'idempotency-key');
    if (key) headers['Idempotency-Key'] = key;
    if (operation.operationId === 'incrementPostView') {
      const now = Date.now();
      for (const [key, value] of viewLimits) if (value.expires <= now) viewLimits.delete(key);
      // Arbitrary forwarded IP headers are never trusted in local/direct mode.
      const ip =
        (config.trustedClientIpHeader === 'cf-connecting-ip'
          ? getHeader(event, 'cf-connecting-ip')
          : undefined) ||
        event.node.req.socket.remoteAddress ||
        'unknown';
      const entry = viewLimits.get(ip) || { count: 0, expires: now + 60000 };
      entry.count++;
      viewLimits.set(ip, entry);
      if (entry.count > 60) {
        setHeader(event, 'Retry-After', Math.max(1, Math.ceil((entry.expires - now) / 1000)));
        return error(429, 'RATE_LIMITED');
      }
    }
    const multipart = operation.operationId === 'uploadImages';
    const maximum = multipart ? 101 * 1024 * 1024 : 256 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    if (!['GET', 'HEAD'].includes(event.method))
      for await (const input of event.node.req) {
        const value: unknown = input;
        if (typeof value !== 'string' && !(value instanceof Uint8Array))
          throw new Error('Invalid request chunk');
        const chunk = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
        size += chunk.length;
        if (size > maximum) return error(413, multipart ? 'UPLOAD_TOO_LARGE' : 'REQUEST_TOO_LARGE');
        chunks.push(chunk);
      }
    const raw = size ? Buffer.concat(chunks) : undefined;
    let body: unknown;
    if (!multipart) {
      try {
        const parsed: unknown = raw ? JSON.parse(raw.toString()) : undefined;
        body = operation.operationId === 'createDirectCollectionRequest' ? parsed : normalizeInput(parsed);
      } catch {
        return error(400, 'VALIDATION_FAILED');
      }
    }
    if (!validateRequest(operation, { query: getQuery(event), headers: getHeaders(event), body }))
      return error(400, 'VALIDATION_FAILED');
    headers['Content-Type'] = multipart
      ? getHeader(event, 'content-type') || ''
      : 'application/json';
    const response = await fetch(`${config.coreOrigin}${url.pathname}${url.search}`, {
      method: event.method,
      headers,
      ...(multipart && raw
        ? { body: raw }
        : body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
      // Collected galleries may require sequential validation of up to 200 images.
      // A lost response must be retried with the original idempotency key.
      signal: AbortSignal.timeout(operation.operationId === 'promoteBatchItem' ? 180000
        : operation.operationId === 'previewBatchImage' || multipart ? 60000 : 15000),
    });
    if (['previewImage', 'previewCollectionImage', 'previewBatchImage'].includes(operation.operationId) && response.ok) {
      const type = response.headers.get('content-type') || '';
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return error(503, 'DEPENDENCY_UNAVAILABLE');
      setHeader(event, 'Cache-Control', 'private, no-store');
      setHeader(event, 'Content-Type', type);
      setHeader(event, 'X-Content-Type-Options', 'nosniff');
      if (!response.body) return error(503, 'DEPENDENCY_UNAVAILABLE');
      return sendStream(event, response.body);
    }
    const result: unknown = response.status === 204 ? undefined : await response.json();
    if (!validateResponse(operation, response.status, result))
      return error(503, 'DEPENDENCY_UNAVAILABLE');
    const output =
      result === undefined
        ? undefined
        : responseEnvelope(projectResponse(operation, response.status, result));
    if (output?.meta) output.meta.requestId = requestId;
    setResponseStatus(event, response.status);
    setHeader(event, 'Cache-Control', response.headers.get('cache-control') || 'no-store');
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter !== null) event.node.res.setHeader('Retry-After', retryAfter);
    if (output && response.ok && event.method === 'GET' && !url.pathname.startsWith('/api/v1/admin/')) {
      const etag =
        '"' +
        createHash('sha256')
          .update(
            JSON.stringify({ data: output.data, meta: { ...output.meta, requestId: undefined } })
          )
          .digest('hex') +
        '"';
      setHeader(event, 'ETag', etag);
      if (getHeader(event, 'if-none-match') === etag) {
        setResponseStatus(event, 304);
        return;
      }
    }
    return output;
  } catch {
    return error(503, 'DEPENDENCY_UNAVAILABLE');
  }
}
export default defineEventHandler(event => proxyCoreRequest(event));
