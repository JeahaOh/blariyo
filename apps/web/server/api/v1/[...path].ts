import { randomUUID, createHash } from 'node:crypto';
import {
  matchOperation,
  validateRequest,
  validateResponse,
  normalizeInput,
  projectResponse,
} from '@blariyo/contracts';
const viewLimits = new Map<string, { count: number; expires: number }>();
export default defineEventHandler(async (event) => {
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
    const url = getRequestURL(event),
      operation = matchOperation(event.method, url.pathname);
    if (!operation) return error(404, 'POST_NOT_FOUND');
    const headers: Record<string, string> = {};
    if (url.pathname.startsWith('/api/v1/admin/')) {
      try {
        headers['X-Blariyo-Admin-Actor'] = await adminIdentity(event);
      } catch (e: any) {
        return error(
          e.statusCode === 403 ? 403 : 401,
          e.statusCode === 403 ? 'ADMIN_FORBIDDEN' : 'ADMIN_AUTH_REQUIRED'
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
      for await (const chunk of event.node.req) {
        size += chunk.length;
        if (size > maximum) return error(413, multipart ? 'UPLOAD_TOO_LARGE' : 'REQUEST_TOO_LARGE');
        chunks.push(Buffer.from(chunk));
      }
    const raw = size ? Buffer.concat(chunks) : undefined;
    let body;
    if (!multipart) {
      try {
        body = raw ? normalizeInput(JSON.parse(raw.toString())) : undefined;
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
      body: multipart ? raw : body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(multipart ? 60000 : 15000),
    });
    if (operation.operationId === 'previewImage' && response.ok) {
      const type = response.headers.get('content-type') || '';
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return error(503, 'DEPENDENCY_UNAVAILABLE');
      setHeader(event, 'Cache-Control', 'private, no-store');
      setHeader(event, 'Content-Type', type);
      setHeader(event, 'X-Content-Type-Options', 'nosniff');
      return sendStream(event, response.body!);
    }
    const result = response.status === 204 ? undefined : await response.json();
    if (!validateResponse(operation, response.status, result))
      return error(503, 'DEPENDENCY_UNAVAILABLE');
    const output =
      result === undefined ? undefined : projectResponse(operation, response.status, result);
    if (output?.meta) output.meta.requestId = requestId;
    setResponseStatus(event, response.status);
    setHeader(event, 'Cache-Control', response.headers.get('cache-control') || 'no-store');
    if (response.headers.has('retry-after'))
      setHeader(event, 'Retry-After', response.headers.get('retry-after')!);
    if (response.ok && event.method === 'GET') {
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
});
