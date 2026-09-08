import { createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { withPostLock } from './post-lock.mjs';
import { recordScheduleFailure } from './schedule-alerts.mjs';
import { fail, id, slug, pagination } from './http.mjs';
import { enqueue } from './outbox.mjs';
export const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])])
        )
      : value;
const hash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest();
const summary = (p) => ({
  postId: Number(p.id),
  boardSlug: p.slug,
  title: p.title,
  status: p.status,
  lockVersion: p.lock_version,
  scheduledAt: p.scheduled_at?.toISOString() || null,
  publishedAt: p.published_at?.toISOString() || null,
  updatedAt: p.updated_at.toISOString(),
});
export function postService(
  pool,
  storage,
  { siteOrigin = 'http://localhost:3000', imageOrigin = 'http://localhost:3000/media' } = {}
) {
  async function find(db, postId, lock = false) {
    if (!id(String(postId))) fail(404, 'POST_NOT_FOUND');
    const p = (
      await db.query(
        `SELECT p.*,b.slug FROM content.board_post p JOIN content.board b ON b.id=p.board_id WHERE p.id=$1 ${lock ? 'FOR UPDATE OF p' : ''}`,
        [postId]
      )
    ).rows[0];
    if (!p) fail(404, 'POST_NOT_FOUND');
    return p;
  }
  const images = (db, postId) =>
    db
      .query('SELECT * FROM content.board_post_image WHERE post_id=$1 ORDER BY id', [postId])
      .then((r) => r.rows);
  async function history(db, p, previous, reason, actor) {
    await db.query(
      `INSERT INTO content.board_post_status_history(post_id,from_status,to_status,reason_code,actor_type,created_by,created_at,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,now(),$6,now())`,
      [p.id, previous, p.status, reason, actor.startsWith('admin:') ? 'ADMIN' : 'SYSTEM', actor]
    );
  }
  async function purge(db, p, actor) {
    await enqueue(
      db,
      'CACHE_PURGE',
      'POST',
      p.id,
      { urls: [`${siteOrigin}/${p.slug}`, `${siteOrigin}/${p.slug}/posts/${p.id}`] },
      actor
    );
  }
  async function blocks(db, p, values, actor) {
    const previous = await images(db, p.id);
    if (p.status === 'HIDDEN_REVIEW' && previous.some((i) => i.status === 'PUBLIC_DELETE_PENDING'))
      fail(409, 'IMAGE_STATE_CONFLICT');
    const ids = values.filter((b) => b.type === 'IMAGE').map((b) => b.imageId);
    if (new Set(ids).size !== ids.length) fail(400, 'VALIDATION_FAILED');
    await db.query('DELETE FROM content.board_post_block WHERE post_id=$1', [p.id]);
    for (const image of previous.filter((i) => !ids.includes(Number(i.id)))) {
      const discarded = image.status === 'PRIVATE_REVIEW';
      await db.query(
        'UPDATE content.board_post_image SET post_id=NULL,status=$2,updated_by=$3,updated_at=now() WHERE id=$1',
        [image.id, discarded ? 'PRIVATE_DELETE_PENDING' : 'STAGED', actor]
      );
      if (discarded)
        await enqueue(
          db,
          'OBJECT_DELETE_PRIVATE',
          'IMAGE',
          image.id,
          { privateStorageKey: image.private_storage_key },
          actor
        );
    }
    for (const [index, block] of values.entries()) {
      if (block.type === 'IMAGE') {
        const image = (
          await db.query('SELECT * FROM content.board_post_image WHERE id=$1 FOR UPDATE', [
            block.imageId,
          ])
        ).rows[0];
        if (!image) fail(409, 'IMAGE_STATE_CONFLICT');
        if (image.post_id && String(image.post_id) !== String(p.id))
          fail(409, 'IMAGE_ALREADY_ATTACHED');
        if (!['STAGED', 'PRIVATE_REVIEW'].includes(image.status)) fail(409, 'IMAGE_STATE_CONFLICT');
        await db.query(
          'UPDATE content.board_post_image SET post_id=$2,updated_by=$3,updated_at=now() WHERE id=$1',
          [image.id, p.id, actor]
        );
      }
      await db.query(
        `INSERT INTO content.board_post_block(post_id,position,type,text_content,image_id,alt_text,created_by,created_at,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,now(),$7,now())`,
        [
          p.id,
          index + 1,
          block.type,
          block.type === 'TEXT' ? block.text.trim() : null,
          block.type === 'IMAGE' ? block.imageId : null,
          block.type === 'IMAGE' ? block.alt.trim() : null,
          actor,
        ]
      );
    }
  }
  async function createDraft(db, body, actor) {
    if (!slug(body.boardSlug)) fail(404, 'BOARD_NOT_FOUND');
    const b = (
      await db.query(
        "SELECT * FROM content.board WHERE slug=$1 AND is_active AND posting_policy='ADMIN'",
        [body.boardSlug]
      )
    ).rows[0];
    if (!b) fail(404, 'BOARD_NOT_FOUND');
    const p = (
      await db.query(
        `INSERT INTO content.board_post(board_id,title,source_name,source_url,status,pinned_position,created_by,created_at,updated_by,updated_at) VALUES($1,$2,$3,$4,'DRAFT',$5,$6,now(),$6,now()) RETURNING *`,
        [
          b.id,
          body.title.trim(),
          body.source?.name.trim() || null,
          body.source?.url || null,
          body.pinnedPosition,
          actor,
        ]
      )
    ).rows[0];
    p.slug = b.slug;
    await blocks(db, p, body.blocks, actor);
    return p;
  }
  async function replay(db, actor, scope, key, digest) {
    const row = (
      await db.query(
        'SELECT * FROM ops.idempotency_request WHERE created_by=$1 AND operation_scope=$2 AND idempotency_key=$3',
        [actor, scope, key]
      )
    ).rows[0];
    if (row) {
      if (!row.request_hash.equals(digest)) fail(409, 'IDEMPOTENCY_CONFLICT');
      return { status: row.response_status, data: row.response_body };
    }
  }
  async function runCommand(operation, params, body, actor, key, scope, transactionPool = pool) {
    const digest = hash({ params, body });
    if (key) {
      const saved = await replay(transactionPool, actor, scope, key, digest);
      if (saved) return saved;
    }
    const promoted = [];
    // The caller holds the post lock through copy, commit and compensation.
    // Record attempted keys before I/O: a failed copy may still have reached storage.
    try {
      if (
        (operation === 'publish' && body.mode === 'IMMEDIATE') ||
        operation === 'republish' ||
        operation === 'due'
      ) {
        const p = await find(transactionPool, params.postId);
        if (p.lock_version !== body.lockVersion) fail(409, 'POST_VERSION_CONFLICT');
        const allowed =
          operation === 'republish'
            ? ['HIDDEN_REVIEW']
            : operation === 'due'
              ? ['SCHEDULED']
              : ['DRAFT', 'SCHEDULED'];
        if (!allowed.includes(p.status)) fail(409, 'POST_STATE_CONFLICT');
        const attached = await images(transactionPool, p.id);
        if (attached.some((i) => !['STAGED', 'PRIVATE_REVIEW'].includes(i.status)))
          fail(409, 'IMAGE_STATE_CONFLICT');
        for (const image of attached) {
          const ext = image.mime_type.split('/')[1].replace('jpeg', 'jpg');
          const publicKey = `posts/${p.id}/${image.id}-${image.content_sha256.toString('hex')}.${ext}`;
          promoted.push({ id: image.id, key: publicKey });
          try {
            await storage.promote(image.private_storage_key, publicKey);
          } catch {
            fail(503, 'DEPENDENCY_UNAVAILABLE');
          }
        }
      }
      return await transaction(transactionPool, async (db) => {
        if (key) {
          const acquired = (
            await db.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired', [
              `${actor}:${scope}:${key}`,
            ])
          ).rows[0].acquired;
          if (!acquired) fail(409, 'IDEMPOTENCY_IN_PROGRESS');
          const saved = await replay(db, actor, scope, key, digest);
          if (saved) return saved;
        }
        let p,
          previous = null,
          reason = operation.toUpperCase(),
          setPublishedAtNow = false;
        if (operation === 'create') {
          p = await createDraft(db, body, actor);
        } else {
          p = await find(db, params.postId, true);
          previous = p.status;
          if (p.lock_version !== body.lockVersion) fail(409, 'POST_VERSION_CONFLICT');
          const allowed = {
            update: ['DRAFT', 'SCHEDULED', 'HIDDEN_REVIEW'],
            publish: body.mode === 'IMMEDIATE' ? ['DRAFT', 'SCHEDULED'] : ['DRAFT'],
            unschedule: ['SCHEDULED'],
            hide: ['PUBLISHED'],
            republish: ['HIDDEN_REVIEW'],
            remove: ['HIDDEN_REVIEW'],
            due: ['SCHEDULED'],
          }[operation];
          if (!allowed?.includes(p.status)) fail(409, 'POST_STATE_CONFLICT');
          if (operation === 'update') {
            if (p.status === 'HIDDEN_REVIEW' && Object.hasOwn(body, 'pinnedPosition'))
              fail(400, 'VALIDATION_FAILED');
            if (body.blocks) await blocks(db, p, body.blocks, actor);
            if (body.title !== undefined) p.title = body.title.trim();
            if (Object.hasOwn(body, 'source')) {
              p.source_name = body.source?.name.trim() || null;
              p.source_url = body.source?.url || null;
            }
            if (Object.hasOwn(body, 'pinnedPosition')) p.pinned_position = body.pinnedPosition;
            reason = 'EDIT';
          }
          if (operation === 'publish' || operation === 'due') {
            if (operation === 'publish' && body.mode === 'SCHEDULED') {
              if (new Date(body.scheduledAt).getTime() < Date.now() + 60000)
                fail(400, 'VALIDATION_FAILED');
              p.status = 'SCHEDULED';
              p.scheduled_at = new Date(body.scheduledAt);
              reason = 'SCHEDULE';
            } else {
              p.status = 'PUBLISHED';
              setPublishedAtNow = true;
              p.scheduled_at = null;
              reason = operation === 'due' ? 'SYSTEM_DUE' : 'PUBLISH';
            }
          }
          if (operation === 'unschedule') {
            p.status = 'DRAFT';
            p.scheduled_at = null;
          }
          if (operation === 'hide') {
            p.status = 'HIDDEN_REVIEW';
            p.pinned_position = null;
            reason = body.reasonCode;
            for (const image of await images(db, p.id)) {
              if (image.status !== 'PUBLIC') fail(409, 'IMAGE_STATE_CONFLICT');
              await db.query(
                "UPDATE content.board_post_image SET status='PUBLIC_DELETE_PENDING',updated_by=$2,updated_at=now() WHERE id=$1",
                [image.id, actor]
              );
              await enqueue(
                db,
                'OBJECT_DELETE_PUBLIC',
                'IMAGE',
                image.id,
                {
                  publicStorageKey: image.public_storage_key,
                  publicUrl: `${imageOrigin}/${image.public_storage_key}`,
                },
                actor
              );
            }
          }
          if (operation === 'republish') {
            p.status = 'PUBLISHED';
            p.pinned_position = body.pinnedPosition;
          }
          if (operation === 'remove') {
            const attached = await images(db, p.id);
            if (attached.some((i) => i.status === 'PUBLIC_DELETE_PENDING'))
              fail(409, 'IMAGE_STATE_CONFLICT');
            p.status = 'REMOVED';
            for (const image of attached) {
              await db.query(
                "UPDATE content.board_post_image SET status='PRIVATE_DELETE_PENDING',updated_by=$2,updated_at=now() WHERE id=$1",
                [image.id, actor]
              );
              await enqueue(
                db,
                'OBJECT_DELETE_PRIVATE',
                'IMAGE',
                image.id,
                { privateStorageKey: image.private_storage_key },
                actor,
                30 * 86400
              );
            }
          }
          const updated = (
            await db.query(
              `UPDATE content.board_post SET title=$2,source_name=$3,source_url=$4,status=$5,pinned_position=$6,scheduled_at=$7,published_at=CASE WHEN $10 THEN statement_timestamp() ELSE $8 END,lock_version=lock_version+1,updated_by=$9,updated_at=now() WHERE id=$1 RETURNING *`,
              [
                p.id,
                p.title,
                p.source_name,
                p.source_url,
                p.status,
                p.pinned_position,
                p.scheduled_at,
                p.published_at,
                actor,
                setPublishedAtNow,
              ]
            )
          ).rows[0];
          p = { ...updated, slug: p.slug };
        }
        for (const image of promoted)
          await db.query(
            "UPDATE content.board_post_image SET status='PUBLIC',public_storage_key=$2,updated_by=$3,updated_at=now() WHERE id=$1 AND post_id=$4",
            [image.id, image.key, actor, p.id]
          );
        await history(db, p, previous, reason, actor);
        if (['PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED'].includes(p.status) && operation !== 'update')
          await purge(db, p, actor);
        const data = {
          postId: Number(p.id),
          status: p.status,
          lockVersion: p.lock_version,
          ...(operation === 'create' ? {} : { updatedAt: p.updated_at.toISOString() }),
        };
        if (['publish', 'unschedule'].includes(operation)) {
          data.scheduledAt = p.scheduled_at?.toISOString() || null;
          if (operation === 'publish') data.publishedAt = p.published_at?.toISOString() || null;
        }
        const status = operation === 'create' ? 201 : 200;
        if (key)
          await db.query(
            `INSERT INTO ops.idempotency_request(operation_scope,idempotency_key,request_hash,response_status,response_body,resource_type,resource_id,expires_at,created_by,created_at,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,'POST',$6,now()+interval '24 hours',$7,now(),$7,now())`,
            [scope, key, digest, status, data, p.id, actor]
          );
        return { status, data };
      });
    } catch (e) {
      // Commit acknowledgement can fail after a successful commit. Never delete
      // a currently PUBLIC asset. Recheck under the same post lock in the worker.
      for (const image of promoted) {
        await enqueue(
          transactionPool,
          'OBJECT_DELETE_PUBLIC',
          'IMAGE',
          image.id,
          {
            compensation: true,
            publicStorageKey: image.key,
            publicUrl: `${imageOrigin}/${image.key}`,
          },
          actor
        );
      }
      if (e.constraint === 'uq_board_post__active_pin') fail(409, 'PINNED_ORDER_CONFLICT');
      throw e;
    }
  }
  async function command(operation, params, body, actor, key, scope) {
    const run = (db) =>
      params.postId
        ? withPostLock(db, params.postId, (locked) =>
            runCommand(operation, params, body, actor, key, scope, locked)
          )
        : runCommand(operation, params, body, actor, key, scope, db);
    if (!key) return run(pool);
    const client = await pool.connect(),
      lockKey = `${actor}:${scope}:${key}`;
    let locked = false;
    try {
      locked = (
        await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [
          lockKey,
        ])
      ).rows[0].locked;
      if (!locked) fail(409, 'IDEMPOTENCY_IN_PROGRESS');
      const sameConnection = {
        query: client.query.bind(client),
        connect: async () => ({ query: client.query.bind(client), release() {} }),
      };
      return await run(sameConnection);
    } finally {
      if (locked)
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockKey]);
      client.release();
    }
  }
  return {
    async createDraftInTransaction(db, body, actor) {
      const p = await createDraft(db, body, actor);
      await history(db, p, null, 'CREATE', actor);
      return { postId: Number(p.id), status: 'DRAFT', lockVersion: 1 };
    },
    command,
    async search(query) {
      const values = [],
        conditions = [];
      const add = (sql, value) => {
        values.push(value);
        conditions.push(sql.replace('?', `$${values.length}`));
      };
      if (query.status) add('p.status=?', query.status);
      if (query.board) add('b.slug=?', query.board);
      if (query.titlePrefix)
        add(
          "p.title LIKE ? ESCAPE '\\'",
          query.titlePrefix.trim().replace(/[\\%_]/g, '\\$&') + '%'
        );
      if (query.from) add('p.updated_at>=?', query.from);
      if (query.to) add('p.updated_at<=?', query.to);
      if (query.from && query.to && new Date(query.from) > new Date(query.to))
        fail(400, 'VALIDATION_FAILED');
      const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '',
        base = ' FROM content.board_post p JOIN content.board b ON b.id=p.board_id';
      const total = Number(
          (await pool.query('SELECT count(*)' + base + where, values)).rows[0].count
        ),
        page = Number(query.page || 1);
      const rows = (
        await pool.query(
          'SELECT p.*,b.slug' +
            base +
            where +
            ` ORDER BY p.updated_at DESC,p.id DESC LIMIT 50 OFFSET $${values.length + 1}`,
          [...values, (page - 1) * 50]
        )
      ).rows;
      return { data: { items: rows.map(summary) }, meta: pagination(page, total, 50) };
    },
    async detail(postId) {
      const p = await find(pool, postId);
      const blockRows = (
        await pool.query(
          'SELECT b.*,i.status,i.width,i.height FROM content.board_post_block b LEFT JOIN content.board_post_image i ON i.id=b.image_id WHERE b.post_id=$1 ORDER BY position',
          [p.id]
        )
      ).rows;
      return {
        ...summary(p),
        source: p.source_url ? { name: p.source_name, url: p.source_url } : null,
        pinnedPosition: p.pinned_position,
        createdAt: p.created_at.toISOString(),
        blocks: blockRows.map((b) =>
          b.type === 'TEXT'
            ? { type: 'TEXT', text: b.text_content }
            : {
                type: 'IMAGE',
                imageId: Number(b.image_id),
                alt: b.alt_text,
                status: b.status,
                width: b.width,
                height: b.height,
                previewPath: ['PRIVATE_DELETE_PENDING', 'DELETED'].includes(b.status)
                  ? null
                  : `/api/v1/admin/images/${b.image_id}/preview`,
              }
        ),
      };
    },
    async publishDue() {
      const due = (
        await pool.query(
          "SELECT id,lock_version,scheduled_at FROM content.board_post WHERE status='SCHEDULED' AND scheduled_at<=now() ORDER BY scheduled_at,id"
        )
      ).rows;
      let done = 0;
      for (const p of due) {
        try {
          await command(
            'due',
            { postId: String(p.id) },
            { lockVersion: p.lock_version },
            'system:scheduler'
          );
          done++;
        } catch (e) {
          if (e.code === 'PINNED_ORDER_CONFLICT')
            await transaction(pool, async (db) => {
              const result = await db.query(
                "UPDATE content.board_post SET status='DRAFT',scheduled_at=NULL,lock_version=lock_version+1,updated_by='system:scheduler',updated_at=now() WHERE id=$1 AND status='SCHEDULED' AND lock_version=$2 RETURNING *",
                [p.id, p.lock_version]
              );
              if (result.rowCount)
                await history(
                  db,
                  result.rows[0],
                  'SCHEDULED',
                  'PINNED_ORDER_CONFLICT',
                  'system:scheduler'
                );
            });
          if (!['POST_STATE_CONFLICT', 'POST_VERSION_CONFLICT'].includes(e.code))
            await recordScheduleFailure(pool, p, e.code);
        }
      }
      return done;
    },
  };
}
