import { createHash, timingSafeEqual } from 'node:crypto';
import {
  matchOperation,
  validateRequest,
  validateResponse,
  normalizeInput,
} from '@blariyo/contracts';
import { authenticateCore } from './auth.mjs';
import { fail, success } from './http.mjs';
import { collectionService } from './collection.mjs';
export function collectionSettings(env = process.env) {
  return {
    collectManualUrlEnabled: env.COLLECT_MANUAL_URL_ENABLED === 'true',
    collectDiscordCommandEnabled: env.COLLECT_DISCORD_COMMAND_ENABLED === 'true',
  };
}
export function registerCollection(app, pool, options) {
  const enabled = options.collectManualUrlEnabled || options.collectDiscordCommandEnabled;
  const service = collectionService(pool, options.storage, options);
  const limits = new Map();
  for (const [prefix, machine] of [
    ['/api/v1/admin/collect', false],
    ['/internal/collect', true],
  ])
    app.use(prefix, async (req, res, next) => {
      try {
        if (!enabled) fail(404, 'CANDIDATE_NOT_FOUND');
        const path = req.originalUrl.split('?')[0],
          publicPath = machine ? path.replace('/internal/collect', '/api/collector/v1') : path;
        const operation = matchOperation(req.method, publicPath);
        if (!operation) fail(404, 'CANDIDATE_NOT_FOUND');
        let collector, actor;
        if (machine) {
          const token = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '')?.[1];
          if (!token || token.length < 32) fail(401, 'COLLECTOR_AUTH_REQUIRED');
          const hash = createHash('sha256').update(token).digest();
          collector = (options.collectorTokens || []).find(
            (item) =>
              /^[a-f0-9]{64}$/.test(item.tokenSha256) &&
              timingSafeEqual(hash, Buffer.from(item.tokenSha256, 'hex'))
          );
          if (!collector) fail(401, 'COLLECTOR_AUTH_REQUIRED');
          if (
            !collector.scopes?.includes('collect') ||
            !/^[A-Za-z0-9_-]{1,100}$/.test(collector.collectorId)
          )
            fail(403, 'COLLECTOR_FORBIDDEN');
          actor = 'system:collector';
          const now = Date.now();
          for (const [key, value] of limits) if (value.expires <= now) limits.delete(key);
          const rate = limits.get(collector.collectorId) || { count: 0, expires: now + 60000 };
          rate.count++;
          limits.set(collector.collectorId, rate);
          if (rate.count > 120) {
            res.set('Retry-After', '60');
            fail(429, 'RATE_LIMITED');
          }
        } else actor = authenticateCore(req, options.serviceToken);
        if (
          operation.operationId === 'createCollectionCandidate' &&
          !options.collectManualUrlEnabled
        )
          fail(404, 'CANDIDATE_NOT_FOUND');
        if (
          operation.operationId === 'collectorCreateCandidate' &&
          !options.collectDiscordCommandEnabled
        )
          fail(404, 'CANDIDATE_NOT_FOUND');
        if (options.maintenance && req.method !== 'GET') {
          res.set('Retry-After', '60');
          fail(503, 'MAINTENANCE_READ_ONLY');
        }
        let body = normalizeInput(req.body),
          file;
        const multipart = operation.operationId === 'collectorUploadPreview';
        if (multipart) {
          let length = 0;
          const chunks = [];
          if (Number(req.get('content-length') || 0) > 11 * 1024 * 1024)
            fail(413, 'UPLOAD_TOO_LARGE');
          for await (const chunk of req) {
            length += chunk.length;
            if (length > 11 * 1024 * 1024) fail(413, 'UPLOAD_TOO_LARGE');
            chunks.push(chunk);
          }
          let form;
          try {
            form = await new Response(Buffer.concat(chunks), {
              headers: { 'content-type': req.get('content-type') },
            }).formData();
          } catch {
            fail(400, 'VALIDATION_FAILED');
          }
          const entries = [...form.entries()];
          if (
            entries.length !== 3 ||
            !['collectorId', 'lockVersion', 'file'].every((key) => form.getAll(key).length === 1) ||
            !(form.get('file') instanceof File)
          )
            fail(400, 'VALIDATION_FAILED');
          const version = form.get('lockVersion');
          if (
            typeof version !== 'string' ||
            !/^\d+$/.test(version) ||
            !Number.isSafeInteger(Number(version)) ||
            Number(version) < 1
          )
            fail(400, 'VALIDATION_FAILED');
          body = { collectorId: form.get('collectorId'), lockVersion: Number(version) };
          const value = form.get('file');
          file = { bytes: Buffer.from(await value.arrayBuffer()), mime: value.type };
        }
        if (
          !validateRequest(operation, {
            query: req.query,
            headers: req.headers,
            body: req.hasBody || multipart ? body : undefined,
          })
        )
          fail(400, 'VALIDATION_FAILED');
        if (machine && body.collectorId !== collector.collectorId) fail(403, 'COLLECTOR_FORBIDDEN');
        const params = operation.params;
        let result,
          status = 200,
          meta = {};
        const op = operation.operationId;
        if (op === 'previewCollectionImage') {
          result = await service.preview(params.candidateId, params.candidateImageId);
          return res
            .set({
              'Cache-Control': 'private, no-store',
              'Content-Type': result.mime,
              'X-Content-Type-Options': 'nosniff',
            })
            .send(result.bytes);
        }
        if (op === 'listCollectionSources') result = await service.sources();
        else if (op === 'updateCollectionSource')
          result = await service.updateSource(params.sourceId, body, actor);
        else if (op === 'listCollectionCandidates') {
          const found = await service.search(req.query);
          result = found.data;
          meta = found.meta;
        } else if (op === 'getCollectionCandidate')
          result = await service.detail(params.candidateId);
        else if (op === 'collectorClaim') result = await service.claim(body);
        else if (op === 'collectorHeartbeat')
          result = await service.heartbeat(params.candidateId, body);
        else if (op === 'collectorUploadPreview')
          result = await service.uploadPreview(
            params.candidateId,
            params.candidateImageId,
            body,
            file
          );
        else {
          const action = {
            createCollectionCandidate: 'create',
            collectorCreateCandidate: 'create',
            retryCollectionCandidate: 'retry',
            rejectCollectionCandidate: 'reject',
            promoteCollectionCandidate: 'draft',
            collectorResult: 'result',
          }[op];
          if (!action) fail(404, 'CANDIDATE_NOT_FOUND');
          const scope = machine
            ? 'collector:' +
              createHash('sha256')
                .update(collector.collectorId + ':' + op)
                .digest('hex')
            : req.method + ' ' + operation.pattern;
          const changed = await service.mutate(
            action,
            params,
            body,
            actor,
            req.get('idempotency-key'),
            scope
          );
          result = changed.data;
          status = changed.status;
        }
        if (
          !validateResponse(operation, status, {
            success: true,
            data: result,
            meta: { requestId: req.requestId, ...meta },
          })
        )
          fail(500, 'INTERNAL_ERROR');
        success(req, res, result, meta, status, 'private, no-store');
      } catch (e) {
        next(e);
      }
    });
}
