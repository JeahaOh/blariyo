import { createHash, randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { fail, id, pagination } from './http.mjs';
import { canonical, postService } from './posts.mjs';
import { validateImages, imageService } from './images.mjs';
import { enqueue } from './outbox.mjs';
const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(canonical(value)))
    .digest();
const stamp = (value) => value?.toISOString() || null;
export function normalizeCollectionUrl(value) {
  try {
    if (typeof value !== 'string' || value.length > 2048) throw new Error();
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes('.')
    )
      throw new Error();
    url.hash = '';
    for (const key of [...url.searchParams.keys()])
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    fail(400, 'VALIDATION_FAILED');
  }
}
export async function collectionLock(pool, key, fn, immediate = false) {
  const client = await pool.connect();
  let locked = false;
  try {
    const result = await client.query(
      `SELECT pg_${immediate ? 'try_' : ''}advisory_lock(hashtextextended($1,0)) AS locked`,
      ['collect:' + key]
    );
    locked = immediate ? result.rows[0].locked : true;
    if (!locked) fail(409, 'IDEMPOTENCY_IN_PROGRESS');
    return await fn({
      query: client.query.bind(client),
      connect: async () => ({ query: client.query.bind(client), release() {} }),
    });
  } finally {
    if (locked)
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', ['collect:' + key]);
    client.release();
  }
}
const sourceData = (s) => ({
  sourceId: Number(s.id),
  name: s.name,
  baseUrl: s.base_url,
  host: s.host,
  fetchMode: s.fetch_mode,
  parserType: s.parser_type,
  listUrl: s.list_url,
  isActive: s.is_active,
  isListCrawlEnabled: s.is_list_crawl_enabled,
  robotsAllowed: s.robots_allowed,
  robotsCheckedAt: stamp(s.robots_checked_at),
  requestIntervalMs: s.request_interval_ms,
  dailyFetchLimit: s.daily_fetch_limit,
  lastFetchedAt: stamp(s.last_fetched_at),
  lastErrorCode: s.last_error_code,
  disabledReasonCode: s.disabled_reason_code,
  lockVersion: s.lock_version,
  updatedAt: stamp(s.updated_at),
});
const candidateData = (c) => ({
  candidateId: Number(c.id),
  sourceId: Number(c.source_id),
  sourceName: c.source_name,
  originUrl: c.origin_url,
  title: c.title,
  status: c.status,
  discoveryMode: c.discovery_mode,
  imageCandidateCount: Number(c.image_count || 0),
  duplicatePostId: c.duplicate_post_id ? Number(c.duplicate_post_id) : null,
  postId: c.post_id ? Number(c.post_id) : null,
  rejectReasonCode: c.reject_reason_code,
  fetchErrorCode: c.fetch_error_code,
  requestedAt: stamp(c.requested_at),
  claimedAt: stamp(c.claimed_at),
  fetchedAt: stamp(c.fetched_at),
  lockVersion: c.lock_version,
});
const previewPath = (c, image) => `/api/v1/admin/collect/candidates/${c}/images/${image}/preview`;
export function collectionService(pool, storage, options = {}) {
  const posts = postService(pool, storage, options);
  async function find(db, candidateId, lock = false) {
    if (!id(String(candidateId))) fail(404, 'CANDIDATE_NOT_FOUND');
    const row = (
      await db.query(
        `SELECT c.*,s.name AS source_name,(SELECT count(*) FROM collect.candidate_image i WHERE i.candidate_id=c.id) AS image_count FROM collect.candidate c JOIN collect.source s ON s.id=c.source_id WHERE c.id=$1 ${lock ? 'FOR UPDATE OF c' : ''}`,
        [candidateId]
      )
    ).rows[0];
    if (!row) fail(404, 'CANDIDATE_NOT_FOUND');
    return row;
  }
  async function source(db, sourceId) {
    const s = (await db.query('SELECT * FROM collect.source WHERE id=$1', [sourceId])).rows[0];
    if (!s) fail(404, 'SOURCE_NOT_FOUND');
    return s;
  }
  function version(c, body, states, collectorId) {
    if (collectorId) {
      if (
        c.status !== 'RUNNING' ||
        c.collector_id !== collectorId ||
        c.lock_version !== body.lockVersion ||
        c.lease_until <= new Date()
      )
        fail(409, 'CANDIDATE_LEASE_CONFLICT');
    } else {
      if (c.lock_version !== body.lockVersion) fail(409, 'CANDIDATE_VERSION_CONFLICT');
      if (!states.includes(c.status)) fail(409, 'CANDIDATE_STATE_CONFLICT');
    }
  }
  async function replay(db, actor, scope, key, hash) {
    const row = (
      await db.query(
        'SELECT * FROM ops.idempotency_request WHERE created_by=$1 AND operation_scope=$2 AND idempotency_key=$3 AND expires_at>now()',
        [actor, scope, key]
      )
    ).rows[0];
    if (!row) return null;
    if (!row.request_hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
    return { status: row.response_status, data: row.response_body };
  }
  async function discardPreviews(db, candidateId, actor) {
    const images = (
      await db.query(
        'SELECT preview_storage_key FROM collect.candidate_image WHERE candidate_id=$1 AND preview_storage_key IS NOT NULL',
        [candidateId]
      )
    ).rows;
    for (const image of images)
      await enqueue(
        db,
        'OBJECT_DELETE_PRIVATE',
        'STORAGE_OBJECT',
        null,
        { privateStorageKey: image.preview_storage_key },
        actor
      );
    await db.query(
      'UPDATE collect.candidate_image SET preview_storage_key=NULL,preview_expires_at=NULL,updated_by=$2,updated_at=now() WHERE candidate_id=$1',
      [candidateId, actor]
    );
  }
  async function mutate(operation, params, body, actor, key, scope) {
    const hash = digest({ params, body });
    return collectionLock(
      pool,
      `key:${actor}:${scope}:${key}`,
      async (db) => {
        const saved = await replay(db, actor, scope, key, hash);
        if (saved) return saved;
        const run = async (db) => {
          let prepared;
          if (operation === 'draft') {
            const c = await find(db, params.candidateId);
            version(c, body, ['NEW']);
            const ids = body.candidateImageIds,
              opts = body.imageOptions;
            if (
              opts.length !== ids.length ||
              new Set(opts.map((i) => i.candidateImageId)).size !== ids.length ||
              opts.some((i) => !ids.includes(i.candidateImageId))
            )
              fail(400, 'VALIDATION_FAILED');
            const uploaded = opts.filter((i) => i.uploadedImageId).map((i) => i.uploadedImageId);
            if (new Set(uploaded).size !== uploaded.length) fail(400, 'VALIDATION_FAILED');
            const images = (
              await db.query('SELECT * FROM collect.candidate_image WHERE candidate_id=$1', [c.id])
            ).rows;
            const files = [],
              selected = [];
            for (const selectedId of ids) {
              const img = images.find((i) => Number(i.id) === selectedId),
                opt = opts.find((i) => i.candidateImageId === selectedId);
              if (!img) fail(400, 'VALIDATION_FAILED');
              selected.push({ image: img, option: opt });
              if (!opt.uploadedImageId) {
                if (!img.preview_storage_key || img.preview_expires_at <= new Date())
                  fail(409, 'IMAGE_STATE_CONFLICT');
                try {
                  files.push({
                    bytes: await storage.get('private', img.preview_storage_key),
                    mime: {
                      jpg: 'image/jpeg',
                      png: 'image/png',
                      webp: 'image/webp',
                      gif: 'image/gif',
                    }[img.preview_storage_key.split('.').at(-1)],
                  });
                } catch {
                  fail(503, 'DEPENDENCY_UNAVAILABLE');
                }
              }
            }
            const title = (body.title ?? c.title ?? '').trim();
            if (!title || [...title].length > 200) fail(400, 'VALIDATION_FAILED');
            const validated = [];
            for (let start = 0; start < files.length; start += 10)
              validated.push(...(await validateImages(files.slice(start, start + 10))));
            const duplicate = await duplicatePost(db, c.origin_url, validated, uploaded);
            if (duplicate && !body.acknowledgeDuplicate) fail(409, 'CANDIDATE_DUPLICATE');
            const stored = [];
            // The Core upload contract permits ten files per request; promotion may select twenty.
            for (let start = 0; start < files.length; start += 10)
              stored.push(
                ...(await imageService(db, storage).upload(files.slice(start, start + 10), actor))
                  .items
              );
            let index = 0;
            prepared = {
              c,
              title,
              selected: selected.map((item) => ({
                ...item,
                imageId: item.option.uploadedImageId || stored[index++].imageId,
              })),
            };
          }
          return transaction(db, async (tx) => {
            let data,
              status = 200,
              resourceType = 'CANDIDATE',
              resourceId;
            if (operation === 'create') {
              const url = normalizeCollectionUrl(body.originUrl),
                host = new URL(url).hostname;
              const s = (
                await tx.query('SELECT * FROM collect.source WHERE host=$1 AND is_active', [host])
              ).rows[0];
              if (!s) fail(403, 'SOURCE_NOT_ALLOWED');
              if (
                (
                  await tx.query('SELECT 1 FROM collect.candidate WHERE origin_url_sha256=$1', [
                    digest(url),
                  ])
                ).rowCount
              )
                fail(409, 'CANDIDATE_DUPLICATE');
              const duplicate = await duplicatePost(tx, url);
              const c = (
                await tx.query(
                  "INSERT INTO collect.candidate(source_id,origin_url,origin_url_sha256,status,duplicate_post_id,created_by,updated_by) VALUES($1,$2,$3,'PENDING',$4,$5,$5) RETURNING *",
                  [s.id, url, digest(url), duplicate, actor]
                )
              ).rows[0];
              data = {
                candidateId: Number(c.id),
                status: c.status,
                lockVersion: 1,
                duplicatePostId: duplicate,
              };
              status = 202;
              resourceId = c.id;
            } else {
              const c = await find(tx, params.candidateId, true);
              resourceId = c.id;
              if (operation === 'result') {
                version(c, body, [], body.collectorId);
                const s = await source(tx, c.source_id);
                if (body.status === 'NEW') {
                  if (!s.is_active) fail(403, 'SOURCE_NOT_ALLOWED');
                  if (s.robots_allowed !== true || !s.robots_checked_at)
                    fail(403, 'SOURCE_NOT_ALLOWED');
                  const url = normalizeCollectionUrl(body.canonicalUrl);
                  if (new URL(url).hostname !== s.host) fail(403, 'SOURCE_NOT_ALLOWED');
                  if (body.imageCandidates.some((i, n) => i.position !== n + 1))
                    fail(400, 'VALIDATION_FAILED');
                  if (
                    (
                      await tx.query(
                        'SELECT 1 FROM collect.candidate WHERE origin_url_sha256=$1 AND id<>$2',
                        [digest(url), c.id]
                      )
                    ).rowCount
                  )
                    fail(409, 'CANDIDATE_DUPLICATE');
                  await discardPreviews(tx, c.id, actor);
                  await tx.query('DELETE FROM collect.candidate_image WHERE candidate_id=$1', [
                    c.id,
                  ]);
                  for (const image of body.imageCandidates)
                    await tx.query(
                      'INSERT INTO collect.candidate_image(candidate_id,position,remote_url,created_by,updated_by) VALUES($1,$2,$3,$4,$4)',
                      [c.id, image.position, normalizeCollectionUrl(image.remoteUrl), actor]
                    );
                  await tx.query(
                    'UPDATE collect.candidate SET title=$2,origin_url=$3,origin_url_sha256=$4,parser_version=$5,source_published_at=$6,duplicate_post_id=$7 WHERE id=$1',
                    [
                      c.id,
                      body.title.trim(),
                      url,
                      digest(url),
                      body.parserVersion.trim(),
                      body.sourcePublishedAt,
                      await duplicatePost(tx, url),
                    ]
                  );
                }
                await tx.query(
                  'UPDATE collect.candidate SET status=$2,fetch_error_code=$3,warnings=$4,lease_until=NULL,fetched_at=now(),lock_version=lock_version+1,updated_by=$5,updated_at=now() WHERE id=$1',
                  [
                    c.id,
                    body.status,
                    body.fetchErrorCode || null,
                    JSON.stringify(body.warnings),
                    actor,
                  ]
                );
                await tx.query(
                  'UPDATE collect.source SET last_fetched_at=now(),last_error_code=$2::varchar,consecutive_error_count=CASE WHEN $2::varchar IS NULL THEN 0 ELSE consecutive_error_count+1 END,updated_by=$3,updated_at=now() WHERE id=$1',
                  [c.source_id, body.fetchErrorCode || null, actor]
                );
                data = {
                  candidateId: Number(c.id),
                  status: body.status,
                  lockVersion: c.lock_version + 1,
                  imageCandidates:
                    body.status === 'NEW'
                      ? (
                          await tx.query(
                            'SELECT id,position FROM collect.candidate_image WHERE candidate_id=$1 ORDER BY position',
                            [c.id]
                          )
                        ).rows.map((i) => ({
                          candidateImageId: Number(i.id),
                          position: i.position,
                        }))
                      : [],
                };
              } else if (operation === 'draft') {
                version(c, body, ['NEW']);
                for (const item of prepared.selected) {
                  const row = (
                    await tx.query(
                      'SELECT * FROM content.board_post_image WHERE id=$1 FOR UPDATE',
                      [item.imageId]
                    )
                  ).rows[0];
                  if (!row || row.status !== 'STAGED' || row.post_id)
                    fail(409, 'IMAGE_STATE_CONFLICT');
                }
                const duplicate = await duplicatePost(
                  tx,
                  c.origin_url,
                  [],
                  prepared.selected.map((i) => i.imageId)
                );
                if (duplicate && !body.acknowledgeDuplicate) fail(409, 'CANDIDATE_DUPLICATE');
                const s = await source(tx, c.source_id);
                const post = await posts.createDraftInTransaction(
                  tx,
                  {
                    boardSlug: body.boardSlug,
                    title: prepared.title,
                    source: body.source || { name: s.name, url: c.origin_url },
                    pinnedPosition: null,
                    blocks: [
                      ...(body.leadText ? [{ type: 'TEXT', text: body.leadText }] : []),
                      ...prepared.selected.map((i) => ({
                        type: 'IMAGE',
                        imageId: i.imageId,
                        alt: i.option.alt,
                      })),
                    ],
                  },
                  actor
                );
                await discardPreviews(tx, c.id, actor);
                await tx.query(
                  "UPDATE collect.candidate_image SET status='SKIPPED',updated_by=$2,updated_at=now() WHERE candidate_id=$1",
                  [c.id, actor]
                );
                for (const item of prepared.selected)
                  await tx.query(
                    "UPDATE collect.candidate_image SET status='STORED',image_id=$2 WHERE id=$1",
                    [item.image.id, item.imageId]
                  );
                await tx.query(
                  "UPDATE collect.candidate SET status='APPROVED',post_id=$2,reviewed_at=now(),lock_version=lock_version+1,updated_by=$3,updated_at=now() WHERE id=$1",
                  [c.id, post.postId, actor]
                );
                data = {
                  ...post,
                  candidateId: Number(c.id),
                  storedImageIds: prepared.selected.map((i) => i.imageId),
                };
                status = 201;
                resourceType = 'POST';
                resourceId = post.postId;
              } else {
                version(
                  c,
                  body,
                  operation === 'retry' ? ['FETCH_FAILED'] : ['NEW', 'FETCH_FAILED']
                );
                await discardPreviews(tx, c.id, actor);
                if (operation === 'retry') {
                  await tx.query('DELETE FROM collect.candidate_image WHERE candidate_id=$1', [
                    c.id,
                  ]);
                  await tx.query(
                    "UPDATE collect.candidate SET status='PENDING',requested_at=now(),fetched_at=NULL,fetch_error_code=NULL,lease_until=NULL,collector_id=NULL,claimed_at=NULL,attempt_count=0,title=NULL,parser_version=NULL,warnings='[]',lock_version=lock_version+1,updated_by=$2,updated_at=now() WHERE id=$1",
                    [c.id, actor]
                  );
                } else
                  await tx.query(
                    "UPDATE collect.candidate SET status='REJECTED',reject_reason_code=$2,reviewed_at=now(),lock_version=lock_version+1,updated_by=$3,updated_at=now() WHERE id=$1",
                    [c.id, body.reasonCode, actor]
                  );
                const updated = await find(tx, c.id);
                data = {
                  candidateId: Number(c.id),
                  status: updated.status,
                  lockVersion: updated.lock_version,
                  reviewedAt: stamp(updated.reviewed_at),
                };
              }
            }
            await tx.query(
              'DELETE FROM ops.idempotency_request WHERE created_by=$1 AND operation_scope=$2 AND idempotency_key=$3 AND expires_at<=now()',
              [actor, scope, key]
            );
            await tx.query(
              "INSERT INTO ops.idempotency_request(operation_scope,idempotency_key,request_hash,response_status,response_body,resource_type,resource_id,expires_at,created_by,created_at,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '24 hours',$8,now(),$8,now())",
              [scope, key, hash, status, data, resourceType, resourceId, actor]
            );
            return { status, data };
          });
        };
        try {
          return params.candidateId
            ? await collectionLock(db, `candidate:${params.candidateId}`, run)
            : await run(db);
        } catch (e) {
          if (e.code === '23505' && e.constraint?.includes('origin'))
            fail(409, 'CANDIDATE_DUPLICATE');
          throw e;
        }
      },
      true
    );
  }
  async function duplicatePost(db, url, validated = [], uploaded = []) {
    const hashes = validated.map((i) => i.hash);
    if (uploaded.length)
      hashes.push(
        ...(
          await db.query(
            'SELECT content_sha256 FROM content.board_post_image WHERE id=ANY($1::bigint[])',
            [uploaded]
          )
        ).rows.map((i) => i.content_sha256)
      );
    const post = (
      await db.query(
        'SELECT p.id FROM content.board_post p WHERE p.source_url=$1 OR EXISTS(SELECT 1 FROM content.board_post_image i WHERE i.post_id=p.id AND i.content_sha256=ANY($2::bytea[])) ORDER BY p.id LIMIT 1',
        [url, hashes]
      )
    ).rows[0];
    return post ? Number(post.id) : null;
  }
  async function expireUnclaimableRuns(db, candidateId = null) {
    const rows = (
      await db.query(
        "WITH expired AS (SELECT id FROM collect.candidate WHERE status='RUNNING' AND lease_until<now() AND (attempt_count>=3 OR requested_at<=now()-interval '24 hours') AND ($1::bigint IS NULL OR id=$1) ORDER BY requested_at,id FOR UPDATE SKIP LOCKED) UPDATE collect.candidate c SET status='FETCH_FAILED',fetch_error_code='LEASE_EXPIRED',fetched_at=now(),lease_until=NULL,lock_version=lock_version+1,updated_by='system:collector',updated_at=now() FROM expired WHERE c.id=expired.id RETURNING c.id",
        [candidateId]
      )
    ).rows;
    for (const row of rows)
      console.error(JSON.stringify({ event: 'LEASE_EXPIRED', candidateId: Number(row.id) }));
    return rows.length;
  }
  return {
    mutate,
    async sources() {
      return {
        items: (await pool.query('SELECT * FROM collect.source ORDER BY id')).rows.map(sourceData),
      };
    },
    async updateSource(sourceId, body, actor) {
      if (!id(String(sourceId))) fail(404, 'SOURCE_NOT_FOUND');
      return transaction(pool, async (db) => {
        const s = (
          await db.query('SELECT * FROM collect.source WHERE id=$1 FOR UPDATE', [sourceId])
        ).rows[0];
        if (!s) fail(404, 'SOURCE_NOT_FOUND');
        if (s.lock_version !== body.lockVersion) fail(409, 'SOURCE_VERSION_CONFLICT');
        if (
          (body.fetchMode && body.fetchMode !== 'URL_ONLY') ||
          (body.parserType && body.parserType !== 'MANUAL') ||
          body.listUrl ||
          body.isListCrawlEnabled
        )
          fail(409, 'SOURCE_STATE_CONFLICT');
        const has = (name) => Object.hasOwn(body, name);
        const result = await db.query(
          'UPDATE collect.source SET is_active=$2,robots_allowed=$3,robots_checked_at=$4,request_interval_ms=$5,daily_fetch_limit=$6,disabled_reason_code=$7,lock_version=lock_version+1,updated_by=$8,updated_at=now() WHERE id=$1 RETURNING *',
          [
            sourceId,
            body.isActive ?? s.is_active,
            has('robotsAllowed') ? body.robotsAllowed : s.robots_allowed,
            has('robotsAllowed')
              ? body.robotsAllowed === null
                ? null
                : new Date()
              : s.robots_checked_at,
            body.requestIntervalMs ?? s.request_interval_ms,
            body.dailyFetchLimit ?? s.daily_fetch_limit,
            has('isActive') ? (body.isActive ? null : 'OPERATOR') : s.disabled_reason_code,
            actor,
          ]
        );
        return sourceData(result.rows[0]);
      });
    },
    async search(query) {
      const args = [],
        where = [];
      const add = (sql, value) => {
        args.push(value);
        where.push(sql.replace('?', `$${args.length}`));
      };
      if (query.status) add('c.status=?', query.status);
      if (query.sourceId) add('c.source_id=?', query.sourceId);
      if (query.discoveryMode) add('c.discovery_mode=?', query.discoveryMode);
      if (query.duplicateOnly === 'true') where.push('c.duplicate_post_id IS NOT NULL');
      const filter = where.length ? ' WHERE ' + where.join(' AND ') : '';
      const total = Number(
          (await pool.query('SELECT count(*) FROM collect.candidate c' + filter, args)).rows[0]
            .count
        ),
        page = Number(query.page || 1);
      const rows = (
        await pool.query(
          'SELECT c.*,s.name AS source_name,(SELECT count(*) FROM collect.candidate_image i WHERE i.candidate_id=c.id) AS image_count FROM collect.candidate c JOIN collect.source s ON s.id=c.source_id' +
            filter +
            ` ORDER BY COALESCE(c.fetched_at,c.requested_at) DESC,c.id DESC LIMIT 50 OFFSET $${args.length + 1}`,
          [...args, (page - 1) * 50]
        )
      ).rows;
      return { data: { items: rows.map(candidateData) }, meta: pagination(page, total, 50) };
    },
    async detail(candidateId) {
      const c = await find(pool, candidateId);
      const images = (
        await pool.query(
          'SELECT * FROM collect.candidate_image WHERE candidate_id=$1 ORDER BY position',
          [c.id]
        )
      ).rows;
      return {
        ...candidateData(c),
        warnings: c.warnings,
        imageCandidates: images.map((i) => ({
          candidateImageId: Number(i.id),
          position: i.position,
          remoteUrl: i.remote_url,
          status: i.status,
          imageId: i.image_id ? Number(i.image_id) : null,
          previewPath:
            i.preview_storage_key && i.preview_expires_at > new Date()
              ? previewPath(c.id, i.id)
              : null,
          previewExpiresAt: stamp(i.preview_expires_at),
          fetchErrorCode: i.fetch_error_code,
        })),
      };
    },
    async claim(body) {
      if (body.candidateId && body.maxItems !== 1) fail(400, 'VALIDATION_FAILED');
      return transaction(pool, async (db) => {
        await expireUnclaimableRuns(db, body.candidateId || null);
        const candidates = (
          await db.query(
            "SELECT * FROM collect.candidate WHERE (status='PENDING' OR (status='RUNNING' AND lease_until<now() AND attempt_count<3 AND requested_at>now()-interval '24 hours')) AND ($1::bigint IS NULL OR id=$1) ORDER BY requested_at,id FOR UPDATE SKIP LOCKED LIMIT $2",
            [body.candidateId || null, body.maxItems]
          )
        ).rows;
        const items = [];
        for (const c of candidates) {
          const s = await source(db, c.source_id);
          const row = (
            await db.query(
              "UPDATE collect.candidate SET status='RUNNING',collector_id=$2,claimed_at=now(),lease_until=now()+$3*interval '1 second',attempt_count=attempt_count+1,lock_version=lock_version+1,updated_by='system:collector',updated_at=now() WHERE id=$1 RETURNING *",
              [c.id, body.collectorId, body.leaseSeconds]
            )
          ).rows[0];
          items.push({
            candidateId: Number(c.id),
            sourceId: Number(s.id),
            sourceHost: s.host,
            originUrl: c.origin_url,
            discoveryMode: c.discovery_mode,
            attemptCount: row.attempt_count,
            lockVersion: row.lock_version,
            leaseUntil: stamp(row.lease_until),
            requestIntervalMs: s.request_interval_ms,
            dailyFetchLimit: s.daily_fetch_limit,
            robotsAllowed: s.robots_allowed,
            robotsCheckedAt: stamp(s.robots_checked_at),
            isActive: s.is_active,
          });
        }
        return { items };
      });
    },
    async heartbeat(candidateId, body) {
      return transaction(pool, async (db) => {
        const c = await find(db, candidateId, true);
        version(c, body, [], body.collectorId);
        const row = (
          await db.query(
            "UPDATE collect.candidate SET lease_until=now()+$2*interval '1 second',lock_version=lock_version+1,updated_by='system:collector',updated_at=now() WHERE id=$1 RETURNING *",
            [c.id, body.leaseSeconds]
          )
        ).rows[0];
        return {
          candidateId: Number(c.id),
          status: 'RUNNING',
          lockVersion: row.lock_version,
          leaseUntil: stamp(row.lease_until),
          source: sourceData(await source(db, c.source_id)),
        };
      });
    },
    async uploadPreview(candidateId, imageId, body, file) {
      if (!id(String(imageId))) fail(404, 'IMAGE_NOT_FOUND');
      return collectionLock(pool, `candidate:${candidateId}`, async (db) => {
        const c = await find(db, candidateId);
        version(c, body, ['NEW']);
        if (c.collector_id !== body.collectorId) fail(403, 'COLLECTOR_FORBIDDEN');
        const image = (
          await db.query('SELECT * FROM collect.candidate_image WHERE id=$1 AND candidate_id=$2', [
            imageId,
            c.id,
          ])
        ).rows[0];
        if (!image) fail(404, 'IMAGE_NOT_FOUND');
        const [validated] = await validateImages([file]);
        const key = `collect-preview/${c.id}/${randomUUID()}.${validated.ext}`;
        try {
          await storage.put('private', key, validated.bytes);
          return await transaction(db, async (tx) => {
            const current = await find(tx, c.id, true);
            version(current, body, ['NEW']);
            if (image.preview_storage_key)
              await enqueue(
                tx,
                'OBJECT_DELETE_PRIVATE',
                'STORAGE_OBJECT',
                null,
                { privateStorageKey: image.preview_storage_key },
                'system:collector'
              );
            const updated = (
              await tx.query(
                "UPDATE collect.candidate_image SET preview_storage_key=$2,preview_expires_at=now()+interval '24 hours',updated_by='system:collector',updated_at=now() WHERE id=$1 RETURNING *",
                [image.id, key]
              )
            ).rows[0];
            const duplicate = await duplicatePost(tx, c.origin_url, [validated]);
            await tx.query(
              "UPDATE collect.candidate SET duplicate_post_id=COALESCE($2,duplicate_post_id),lock_version=lock_version+1,updated_by='system:collector',updated_at=now() WHERE id=$1",
              [c.id, duplicate]
            );
            return {
              candidateImageId: Number(image.id),
              previewPath: previewPath(c.id, image.id),
              previewExpiresAt: stamp(updated.preview_expires_at),
              lockVersion: c.lock_version + 1,
            };
          });
        } catch (e) {
          // Do not delete an object when commit succeeded but its acknowledgement was lost.
          const committed = await db
            .query('SELECT 1 FROM collect.candidate_image WHERE preview_storage_key=$1', [key])
            .catch(() => null);
          if (committed && !committed.rowCount) {
            try {
              await storage.delete('private', key);
            } catch {
              await enqueue(
                db,
                'OBJECT_DELETE_PRIVATE',
                'STORAGE_OBJECT',
                null,
                { privateStorageKey: key },
                'system:collector'
              ).catch(() => {});
            }
          }
          if (e.status) throw e;
          fail(503, 'DEPENDENCY_UNAVAILABLE');
        }
      });
    },
    async preview(candidateId, imageId) {
      if (!id(String(candidateId)) || !id(String(imageId))) fail(404, 'IMAGE_NOT_FOUND');
      const row = (
        await pool.query(
          "SELECT i.* FROM collect.candidate_image i JOIN collect.candidate c ON c.id=i.candidate_id WHERE c.id=$1 AND i.id=$2 AND c.status='NEW' AND i.preview_expires_at>now()",
          [candidateId, imageId]
        )
      ).rows[0];
      if (!row?.preview_storage_key) fail(404, 'IMAGE_NOT_FOUND');
      try {
        return {
          bytes: await storage.get('private', row.preview_storage_key),
          mime: { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[
            row.preview_storage_key.split('.').at(-1)
          ],
        };
      } catch {
        fail(503, 'DEPENDENCY_UNAVAILABLE');
      }
    },
    async cleanup() {
      const rows = (
        await pool.query(
          "SELECT id FROM collect.candidate WHERE status='PENDING' AND requested_at<=now()-interval '24 hours' OR status='RUNNING' AND lease_until<now() AND (attempt_count>=3 OR requested_at<=now()-interval '24 hours') OR status IN ('NEW','FETCH_FAILED') AND fetched_at<now()-interval '30 days' OR status='REJECTED' AND reviewed_at<now()-interval '30 days' OR EXISTS(SELECT 1 FROM collect.candidate_image i WHERE i.candidate_id=collect.candidate.id AND preview_expires_at<now())"
        )
      ).rows;
      for (const row of rows)
        await collectionLock(pool, `candidate:${row.id}`, (db) =>
          transaction(db, async (tx) => {
            const c = await find(tx, row.id, true);
            if (c.status === 'PENDING' && Date.now() - c.requested_at > 86400000) {
              console.error(
                JSON.stringify({ event: 'COLLECTOR_PENDING_STALE', candidateId: Number(c.id) })
              );
              return;
            }
            if (c.status === 'RUNNING' && (await expireUnclaimableRuns(tx, c.id))) return;
            const expired = ['NEW', 'FETCH_FAILED'].includes(c.status)
              ? Date.now() - c.fetched_at > 30 * 86400000
              : c.status === 'REJECTED' && Date.now() - c.reviewed_at > 30 * 86400000;
            if (expired) {
              await discardPreviews(tx, c.id, 'system:collector');
              await tx.query('DELETE FROM collect.candidate_image WHERE candidate_id=$1', [c.id]);
              await tx.query('DELETE FROM collect.candidate WHERE id=$1', [c.id]);
            } else {
              const images = (
                await tx.query(
                  'SELECT * FROM collect.candidate_image WHERE candidate_id=$1 AND preview_expires_at<now()',
                  [c.id]
                )
              ).rows;
              for (const i of images) {
                await enqueue(
                  tx,
                  'OBJECT_DELETE_PRIVATE',
                  'STORAGE_OBJECT',
                  null,
                  { privateStorageKey: i.preview_storage_key },
                  'system:collector'
                );
                await tx.query(
                  "UPDATE collect.candidate_image SET preview_storage_key=NULL,preview_expires_at=NULL,updated_by='system:collector',updated_at=now() WHERE id=$1",
                  [i.id]
                );
              }
            }
          })
        );
    },
  };
}
