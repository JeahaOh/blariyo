import express from 'express';
import { registerCollection } from './collection-routes.mjs';
import {
  matchOperation,
  validateRequest,
  validateResponse,
  normalizeInput,
} from '@blariyo/contracts';
import { requestContext, success, errorHandler, fail } from './http.mjs';
import { authenticateCore } from './auth.mjs';
import { postService } from './posts.mjs';
import { imageService } from './images.mjs';
import { publicService } from './public.mjs';
export async function coreSchemaReady(pool, collectionEnabled) {
  const version = await pool.query(
    "SELECT ops.is_schema_ready('V004') OR (NOT $1::boolean AND ops.is_schema_ready('V003')) AS ready",
    [collectionEnabled]
  );
  if (!version.rows[0]?.ready) return false;
  if (!collectionEnabled) return true;
  const access = await pool.query(`SELECT
    has_schema_privilege(current_user,'collect','USAGE')
    AND has_table_privilege(current_user,'collect.source','SELECT')
    AND has_table_privilege(current_user,'collect.source','INSERT')
    AND has_table_privilege(current_user,'collect.source','UPDATE')
    AND has_table_privilege(current_user,'collect.source','DELETE')
    AND has_table_privilege(current_user,'collect.candidate','SELECT')
    AND has_table_privilege(current_user,'collect.candidate','INSERT')
    AND has_table_privilege(current_user,'collect.candidate','UPDATE')
    AND has_table_privilege(current_user,'collect.candidate','DELETE')
    AND has_table_privilege(current_user,'collect.candidate_image','SELECT')
    AND has_table_privilege(current_user,'collect.candidate_image','INSERT')
    AND has_table_privilege(current_user,'collect.candidate_image','UPDATE')
    AND has_table_privilege(current_user,'collect.candidate_image','DELETE')
    AND has_sequence_privilege(current_user,'collect.source_id_seq','USAGE')
    AND has_sequence_privilege(current_user,'collect.source_id_seq','SELECT')
    AND has_sequence_privilege(current_user,'collect.candidate_id_seq','USAGE')
    AND has_sequence_privilege(current_user,'collect.candidate_id_seq','SELECT')
    AND has_sequence_privilege(current_user,'collect.candidate_image_id_seq','USAGE')
    AND has_sequence_privilege(current_user,'collect.candidate_image_id_seq','SELECT') AS accessible`);
  return Boolean(access.rows[0]?.accessible);
}
export function createApp(pool, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.use(requestContext);
  app.use(
    '/api/v1/boards/:boardSlug/posts/:postId/views',
    express.raw({
      type: '*/*',
      limit: '256kb',
      verify: (req, _res, bytes) => {
        req.hasBody = bytes.length > 0;
      },
    })
  );
  app.use(
    express.json({
      limit: '256kb',
      verify: (req, _res, bytes) => {
        req.hasBody = bytes.length > 0;
      },
    })
  );
  app.get('/internal/health/live', (_req, res) => res.json({ status: 'UP' }));
  app.get('/internal/health/ready', async (_req, res) => {
    try {
      const collectionEnabled =
          options.collectManualUrlEnabled || options.collectDiscordCommandEnabled,
        ready = await coreSchemaReady(pool, Boolean(collectionEnabled));
      res
        .status(ready ? 200 : 503)
        .json({ status: ready ? 'READY' : 'NOT_READY' });
    } catch {
      res.status(503).json({ status: 'NOT_READY' });
    }
  });
  if (options.localMedia && process.env.NODE_ENV !== 'production')
    app.get('/internal/local-media/{*key}', async (req, res) => {
      const key = req.params.key.join('/');
      if (!/^posts\/[1-9][0-9]*\/[1-9][0-9]*-[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(key))
        fail(404, 'IMAGE_NOT_FOUND');
      const bytes = await options.storage.get('public', key);
      res
        .set(
          'Content-Type',
          { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[
            key.split('.').at(-1)
          ]
        )
        .send(bytes);
    });
  registerCollection(app, pool, options);
  const service = publicService(pool, options);
  app.use('/api/v1', async (req, res, next) => {
    try {
      const operation = matchOperation(req.method, req.originalUrl.split('?')[0]);
      if (!operation) return fail(404, 'POST_NOT_FOUND');
      req.operation = operation;
      if (req.originalUrl.startsWith('/api/v1/admin/'))
        req.actor = authenticateCore(req, options.serviceToken);
      req.body = normalizeInput(req.body);
      if (
        !validateRequest(operation, {
          query: req.query,
          headers: req.headers,
          body: req.hasBody ? req.body : undefined,
        })
      )
        fail(400, 'VALIDATION_FAILED');
      if (options.maintenance && req.method !== 'GET') {
        res.set('Retry-After', '60');
        fail(503, 'MAINTENANCE_READ_ONLY');
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  const send = (req, res, data, meta = {}, status = 200, cache = 'no-store') => {
    const envelope = { success: true, data, meta: { requestId: req.requestId, ...meta } };
    if (!validateResponse(req.operation, status, envelope)) fail(500, 'INTERNAL_ERROR');
    success(req, res, data, meta, status, cache);
  };
  app.get('/api/v1/boards', async (req, res) =>
    send(req, res, await service.boards(), {}, 200, 'public, max-age=60, s-maxage=300')
  );
  app.get('/api/v1/boards/:boardSlug/posts', async (req, res) => {
    const result = await service.list(req.params.boardSlug, Number(req.query.page || 1));
    send(req, res, result.data, result.meta);
  });
  app.get('/api/v1/boards/:boardSlug/posts/:postId', async (req, res) =>
    send(req, res, await service.detail(req.params.boardSlug, req.params.postId))
  );
  app.post('/api/v1/boards/:boardSlug/posts/:postId/views', async (req, res) => {
    await service.view(req.params.boardSlug, req.params.postId);
    res.status(204).end();
  });
  app.get('/api/v1/policies/:type', async (req, res) =>
    send(
      req,
      res,
      await service.policy(req.params.type, req.query.version),
      {},
      200,
      'public, max-age=60, s-maxage=300'
    )
  );

  const posts = postService(pool, options.storage, options),
    images = imageService(pool, options.storage);
  app.get('/api/v1/admin/posts', async (req, res) => {
    const result = await posts.search(req.query);
    send(req, res, result.data, result.meta, 200, 'private, no-store');
  });
  app.get('/api/v1/admin/posts/:postId', async (req, res) =>
    send(req, res, await posts.detail(req.params.postId), {}, 200, 'private, no-store')
  );
  for (const [method, path, action] of [
    ['post', '/posts', 'create'],
    ['patch', '/posts/:postId', 'update'],
    ['delete', '/posts/:postId', 'remove'],
    ...['publish', 'unschedule', 'hide', 'republish'].map((a) => [
      'post',
      `/posts/:postId/${a}`,
      a,
    ]),
  ]) {
    app[method]('/api/v1/admin' + path, async (req, res) => {
      const result = await posts.command(
        action,
        req.params,
        req.body,
        req.actor,
        req.get('idempotency-key'),
        req.method + ' ' + req.operation.pattern
      );
      send(req, res, result.data, {}, result.status, 'private, no-store');
    });
  }
  app.post('/api/v1/admin/images', async (req, res) => {
    const length = Number(req.get('content-length') || 0);
    if (length > 101 * 1024 * 1024) fail(413, 'UPLOAD_TOO_LARGE');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 101 * 1024 * 1024) fail(413, 'UPLOAD_TOO_LARGE');
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
    if (entries.some(([name, file]) => name !== 'files' || !(file instanceof File)))
      fail(400, 'VALIDATION_FAILED');
    const files = await Promise.all(
      entries.map(async ([_, file]) => ({
        bytes: Buffer.from(await file.arrayBuffer()),
        mime: file.type,
      }))
    );
    send(req, res, await images.upload(files, req.actor), {}, 200, 'private, no-store');
  });
  app.get('/api/v1/admin/images/:imageId/preview', async (req, res) => {
    const result = await images.preview(req.params.imageId);
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': result.mime,
        'X-Content-Type-Options': 'nosniff',
      })
      .send(result.bytes);
  });
  app.delete('/api/v1/admin/images/:imageId', async (req, res) =>
    send(
      req,
      res,
      await images.discard(req.params.imageId, req.actor),
      {},
      202,
      'private, no-store'
    )
  );

  app.use((_req, _res) => fail(404, 'POST_NOT_FOUND'));
  app.use(errorHandler);
  return app;
}
