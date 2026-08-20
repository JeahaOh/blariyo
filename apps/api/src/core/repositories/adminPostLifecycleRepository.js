class AdminPostLifecycleRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async runIdempotent(meta, operation) {
    const client = await this.pool.connect();
    const lockName = `${meta.actor}|${meta.scope}|${meta.idempotencyKey}`;
    let locked = false;
    try {
      const lock = await client.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked',
        [lockName]
      );
      locked = lock.rows[0].locked;
      if (!locked) return { kind: 'IDEMPOTENCY_IN_PROGRESS' };
      await client.query(
        `DELETE FROM ops.idempotency_request
         WHERE created_by = $1 AND operation_scope = $2 AND idempotency_key = $3
           AND expires_at <= CURRENT_TIMESTAMP`,
        [meta.actor, meta.scope, meta.idempotencyKey]
      );
      const existing = await client.query(
        `SELECT request_hash, response_status, response_body, resource_id
         FROM ops.idempotency_request
         WHERE created_by = $1 AND operation_scope = $2 AND idempotency_key = $3
           AND expires_at > CURRENT_TIMESTAMP`,
        [meta.actor, meta.scope, meta.idempotencyKey]
      );
      if (existing.rowCount > 0) return { kind: 'IDEMPOTENT', row: existing.rows[0] };
      return await operation(client);
    } finally {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [lockName])
          .catch(() => undefined);
      }
      client.release();
    }
  }

  async preparePublish(client, postId, lockVersion, { dueAt = null } = {}) {
    const postResult = await client.query(
      `SELECT post.id, post.status, post.lock_version, post.scheduled_at,
              post.published_at, post.pinned_position, board.slug AS board_slug,
              EXISTS (
                SELECT 1 FROM content.board_post_block block WHERE block.post_id = post.id
              ) AS has_blocks
       FROM content.board_post post
       JOIN content.board ON board.id = post.board_id
       WHERE post.id = $1`,
      [postId]
    );
    if (postResult.rowCount === 0) return { kind: 'POST_NOT_FOUND' };
    const post = postResult.rows[0];
    if (post.lock_version !== lockVersion) return { kind: 'POST_VERSION_CONFLICT' };
    if (dueAt) {
      if (post.status !== 'SCHEDULED' || !post.scheduled_at || post.scheduled_at > dueAt) {
        return { kind: 'POST_STATE_CONFLICT' };
      }
    } else if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
      return { kind: 'POST_STATE_CONFLICT' };
    }
    if (!post.has_blocks) return { kind: 'POST_STATE_CONFLICT' };

    const images = await client.query(
      `SELECT id, status, private_storage_key, public_storage_key,
              content_sha256, mime_type
       FROM content.board_post_image
       WHERE post_id = $1
       ORDER BY id`,
      [postId]
    );
    if (images.rows.some((image) => image.status !== 'STAGED')) {
      return { kind: 'IMAGE_STATE_CONFLICT' };
    }
    return { kind: 'READY', post, images: images.rows };
  }

  async prepareRepublish(client, postId, lockVersion) {
    const postResult = await client.query(
      `SELECT post.id, post.status, post.lock_version, post.scheduled_at,
              post.published_at, post.pinned_position, board.slug AS board_slug,
              EXISTS (
                SELECT 1 FROM content.board_post_block block WHERE block.post_id = post.id
              ) AS has_blocks
       FROM content.board_post post
       JOIN content.board ON board.id = post.board_id
       WHERE post.id = $1`,
      [postId]
    );
    if (postResult.rowCount === 0) return { kind: 'POST_NOT_FOUND' };
    const post = postResult.rows[0];
    if (post.lock_version !== lockVersion) return { kind: 'POST_VERSION_CONFLICT' };
    if (post.status !== 'HIDDEN_REVIEW' || !post.has_blocks) {
      return { kind: 'POST_STATE_CONFLICT' };
    }

    const images = await client.query(
      `SELECT id, status, private_storage_key, public_storage_key,
              content_sha256, mime_type
       FROM content.board_post_image
       WHERE post_id = $1
       ORDER BY id`,
      [postId]
    );
    if (images.rows.some((image) => !['PRIVATE_REVIEW', 'STAGED'].includes(image.status))) {
      return { kind: 'IMAGE_STATE_CONFLICT' };
    }
    return { kind: 'READY', post, images: images.rows };
  }

  async schedule(client, prepared, command, meta, now) {
    return this.inTransaction(client, async () => {
      const current = await this.lockPost(client, prepared.post.id);
      const conflict = this.validateCurrent(current, prepared.post, ['DRAFT']);
      if (conflict) return conflict;
      const updated = await client.query(
        `UPDATE content.board_post
         SET status = 'SCHEDULED', scheduled_at = $2, published_at = NULL,
             lock_version = lock_version + 1, updated_by = $3, updated_at = $4
         WHERE id = $1
         RETURNING id, status, lock_version, published_at, scheduled_at, updated_at`,
        [prepared.post.id, command.scheduledAt, meta.actor, now]
      );
      await this.insertHistory(client, prepared.post.id, 'DRAFT', 'SCHEDULED', 'SCHEDULE', 'ADMIN', meta.actor, now);
      const responseBody = this.publishResponse(updated.rows[0]);
      await this.storeIdempotency(client, meta, prepared.post.id, 200, responseBody, now);
      return { kind: 'COMPLETED', responseBody };
    });
  }

  async publish(client, prepared, promoted, meta, now, { system = false } = {}) {
    return this.inTransaction(client, async () => {
      const current = await this.lockPost(client, prepared.post.id);
      const allowed = system ? ['SCHEDULED'] : ['DRAFT', 'SCHEDULED'];
      const conflict = this.validateCurrent(current, prepared.post, allowed);
      if (conflict) return conflict;
      if (system && (!current.scheduled_at || current.scheduled_at > now)) {
        return { kind: 'POST_STATE_CONFLICT' };
      }
      const imageResult = await this.lockPublishImages(client, prepared, promoted);
      if (imageResult.kind !== 'READY') return imageResult;
      for (const image of promoted) {
        await client.query(
          `UPDATE content.board_post_image
           SET status = 'PUBLIC', public_storage_key = $2,
               updated_by = $3, updated_at = $4
           WHERE id = $1`,
          [image.imageId, image.publicStorageKey, system ? 'system:scheduler' : meta.actor, now]
        );
      }
      const actor = system ? 'system:scheduler' : meta.actor;
      const updated = await client.query(
        `UPDATE content.board_post
         SET status = 'PUBLISHED', scheduled_at = NULL, published_at = $2,
             lock_version = lock_version + 1, updated_by = $3, updated_at = $2
         WHERE id = $1
         RETURNING id, status, lock_version, published_at, scheduled_at, updated_at`,
        [prepared.post.id, now, actor]
      );
      await this.insertHistory(
        client,
        prepared.post.id,
        current.status,
        'PUBLISHED',
        system ? 'SYSTEM_DUE' : 'PUBLISH',
        system ? 'SYSTEM' : 'ADMIN',
        actor,
        now
      );
      await this.insertCachePurge(client, prepared.post, actor, now);
      const responseBody = this.publishResponse(updated.rows[0]);
      if (!system) await this.storeIdempotency(client, meta, prepared.post.id, 200, responseBody, now);
      return { kind: 'COMPLETED', responseBody };
    });
  }

  async unschedule(client, postId, command, meta, now) {
    return this.inTransaction(client, async () => {
      const current = await this.lockPost(client, postId);
      if (!current) return { kind: 'POST_NOT_FOUND' };
      if (current.lock_version !== command.lockVersion) return { kind: 'POST_VERSION_CONFLICT' };
      if (current.status !== 'SCHEDULED') return { kind: 'POST_STATE_CONFLICT' };
      const updated = await client.query(
        `UPDATE content.board_post
         SET status = 'DRAFT', scheduled_at = NULL,
             lock_version = lock_version + 1, updated_by = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, status, lock_version, scheduled_at, updated_at`,
        [postId, meta.actor, now]
      );
      await this.insertHistory(client, postId, 'SCHEDULED', 'DRAFT', 'UNSCHEDULE', 'ADMIN', meta.actor, now);
      const row = updated.rows[0];
      const responseBody = {
        postId: Number(row.id),
        status: row.status,
        lockVersion: row.lock_version,
        scheduledAt: null,
        updatedAt: row.updated_at.toISOString(),
      };
      await this.storeIdempotency(client, meta, postId, 200, responseBody, now);
      return { kind: 'COMPLETED', responseBody };
    });
  }

  async hide(client, postId, command, meta, now) {
    return this.inTransaction(client, async () => {
      const current = await client.query(
        `SELECT post.*, board.slug AS board_slug
         FROM content.board_post post
         JOIN content.board ON board.id = post.board_id
         WHERE post.id = $1 FOR UPDATE OF post`,
        [postId]
      );
      if (current.rowCount === 0) return { kind: 'POST_NOT_FOUND' };
      const post = current.rows[0];
      if (post.lock_version !== command.lockVersion) return { kind: 'POST_VERSION_CONFLICT' };
      if (post.status !== 'PUBLISHED') return { kind: 'POST_STATE_CONFLICT' };
      const images = await client.query(
        `SELECT id, status, public_storage_key
         FROM content.board_post_image WHERE post_id = $1 FOR UPDATE`,
        [postId]
      );
      if (images.rows.some((image) => image.status !== 'PUBLIC' || !image.public_storage_key)) {
        return { kind: 'IMAGE_STATE_CONFLICT' };
      }
      const updated = await client.query(
        `UPDATE content.board_post
         SET status = 'HIDDEN_REVIEW', pinned_position = NULL,
             lock_version = lock_version + 1, updated_by = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, status, lock_version, updated_at`,
        [postId, meta.actor, now]
      );
      for (const image of images.rows) {
        await client.query(
          `UPDATE content.board_post_image
           SET status = 'PUBLIC_DELETE_PENDING', updated_by = $2, updated_at = $3
           WHERE id = $1`,
          [image.id, meta.actor, now]
        );
        await this.insertOutbox(
          client,
          'OBJECT_DELETE_PUBLIC',
          'IMAGE',
          image.id,
          { publicStorageKey: image.public_storage_key },
          meta.actor,
          now
        );
      }
      await this.insertHistory(client, postId, 'PUBLISHED', 'HIDDEN_REVIEW', command.reasonCode, 'ADMIN', meta.actor, now);
      await this.insertCachePurge(client, post, meta.actor, now);
      const row = updated.rows[0];
      const responseBody = {
        postId: Number(row.id),
        status: row.status,
        lockVersion: row.lock_version,
        updatedAt: row.updated_at.toISOString(),
      };
      await this.storeIdempotency(client, meta, postId, 200, responseBody, now);
      return { kind: 'COMPLETED', responseBody };
    });
  }

  async republish(client, prepared, promoted, command, meta, now) {
    return this.inTransaction(client, async () => {
      const current = await this.lockPost(client, prepared.post.id);
      const conflict = this.validateCurrent(current, prepared.post, ['HIDDEN_REVIEW']);
      if (conflict) return conflict;
      const imageResult = await this.lockPublishImages(
        client,
        prepared,
        promoted,
        ['PRIVATE_REVIEW', 'STAGED']
      );
      if (imageResult.kind !== 'READY') return imageResult;
      for (const image of promoted) {
        await client.query(
          `UPDATE content.board_post_image
           SET status = 'PUBLIC', public_storage_key = $2,
               updated_by = $3, updated_at = $4
           WHERE id = $1`,
          [image.imageId, image.publicStorageKey, meta.actor, now]
        );
      }
      const updated = await client.query(
        `UPDATE content.board_post
         SET status = 'PUBLISHED', pinned_position = $2,
             lock_version = lock_version + 1, updated_by = $3, updated_at = $4
         WHERE id = $1
         RETURNING id, status, lock_version, updated_at`,
        [prepared.post.id, command.pinnedPosition, meta.actor, now]
      );
      await this.insertHistory(
        client,
        prepared.post.id,
        'HIDDEN_REVIEW',
        'PUBLISHED',
        'REPUBLISH',
        'ADMIN',
        meta.actor,
        now
      );
      await this.insertCachePurge(client, prepared.post, meta.actor, now);
      const responseBody = this.transitionResponse(updated.rows[0]);
      await this.storeIdempotency(client, meta, prepared.post.id, 200, responseBody, now);
      return { kind: 'COMPLETED', responseBody };
    });
  }

  async remove(client, postId, command, meta, now) {
    return this.inTransaction(client, async () => {
      const current = await client.query(
        `SELECT post.*, board.slug AS board_slug
         FROM content.board_post post
         JOIN content.board ON board.id = post.board_id
         WHERE post.id = $1 FOR UPDATE OF post`,
        [postId]
      );
      if (current.rowCount === 0) return { kind: 'POST_NOT_FOUND' };
      const post = current.rows[0];
      if (post.lock_version !== command.lockVersion) return { kind: 'POST_VERSION_CONFLICT' };
      if (post.status !== 'HIDDEN_REVIEW') return { kind: 'POST_STATE_CONFLICT' };
      const images = await client.query(
        `SELECT id, status, private_storage_key
         FROM content.board_post_image WHERE post_id = $1 FOR UPDATE`,
        [postId]
      );
      if (images.rows.some((image) => !['PRIVATE_REVIEW', 'STAGED'].includes(image.status))) {
        return { kind: 'IMAGE_STATE_CONFLICT' };
      }
      const updated = await client.query(
        `UPDATE content.board_post
         SET status = 'REMOVED', pinned_position = NULL,
             lock_version = lock_version + 1, updated_by = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, status, lock_version, updated_at`,
        [postId, meta.actor, now]
      );
      const deleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      for (const image of images.rows) {
        await client.query(
          `UPDATE content.board_post_image
           SET status = 'PRIVATE_DELETE_PENDING', updated_by = $2, updated_at = $3
           WHERE id = $1`,
          [image.id, meta.actor, now]
        );
        await this.insertOutbox(
          client,
          'OBJECT_DELETE_PRIVATE',
          'IMAGE',
          image.id,
          { privateStorageKey: image.private_storage_key },
          meta.actor,
          deleteAt
        );
      }
      await this.insertHistory(
        client,
        postId,
        'HIDDEN_REVIEW',
        'REMOVED',
        command.reasonCode,
        'ADMIN',
        meta.actor,
        now
      );
      await this.insertCachePurge(client, post, meta.actor, now);
      const responseBody = this.transitionResponse(updated.rows[0]);
      await this.storeIdempotency(client, meta, postId, 200, responseBody, now);
      return { kind: 'COMPLETED', responseBody };
    });
  }

  async findDuePosts(limit, now) {
    const result = await this.pool.query(
      `SELECT id, lock_version
       FROM content.board_post
       WHERE status = 'SCHEDULED' AND scheduled_at <= $1
       ORDER BY scheduled_at, id
       LIMIT $2`,
      [now, limit]
    );
    return result.rows;
  }

  async prepareDue(postId, lockVersion, now) {
    const client = await this.pool.connect();
    try {
      return await this.preparePublish(client, postId, lockVersion, { dueAt: now });
    } finally {
      client.release();
    }
  }

  async completeDue(prepared, promoted, now) {
    const client = await this.pool.connect();
    try {
      return await this.publish(client, prepared, promoted, null, now, { system: true });
    } finally {
      client.release();
    }
  }

  async inTransaction(client, operation) {
    try {
      await client.query('BEGIN');
      const result = await operation();
      if (result.kind === 'COMPLETED') await client.query('COMMIT');
      else await client.query('ROLLBACK');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'uq_board_post__published_pin') {
        return { kind: 'PINNED_ORDER_CONFLICT' };
      }
      throw error;
    }
  }

  async lockPost(client, postId) {
    const result = await client.query(
      `SELECT id, status, lock_version, scheduled_at, published_at
       FROM content.board_post WHERE id = $1 FOR UPDATE`,
      [postId]
    );
    return result.rows[0] || null;
  }

  validateCurrent(current, prepared, allowedStatuses) {
    if (!current) return { kind: 'POST_NOT_FOUND' };
    if (current.lock_version !== prepared.lock_version) return { kind: 'POST_VERSION_CONFLICT' };
    if (!allowedStatuses.includes(current.status)) return { kind: 'POST_STATE_CONFLICT' };
    return null;
  }

  async lockPublishImages(client, prepared, promoted, allowedStatuses = ['STAGED']) {
    const current = await client.query(
      `SELECT id, status FROM content.board_post_image
       WHERE post_id = $1 ORDER BY id FOR UPDATE`,
      [prepared.post.id]
    );
    const preparedIds = prepared.images.map((image) => String(image.id));
    const currentIds = current.rows.map((image) => String(image.id));
    const promotedIds = promoted.map((image) => String(image.imageId)).sort();
    if (JSON.stringify(preparedIds) !== JSON.stringify(currentIds)
      || JSON.stringify([...preparedIds].sort()) !== JSON.stringify(promotedIds)) {
      return { kind: 'POST_VERSION_CONFLICT' };
    }
    if (current.rows.some((image) => !allowedStatuses.includes(image.status))) {
      return { kind: 'IMAGE_STATE_CONFLICT' };
    }
    return { kind: 'READY' };
  }

  async insertHistory(client, postId, fromStatus, toStatus, reasonCode, actorType, actor, now) {
    await client.query(
      `INSERT INTO content.board_post_status_history (
         post_id, from_status, to_status, reason_code, actor_type,
         created_by, created_at, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7)`,
      [postId, fromStatus, toStatus, reasonCode, actorType, actor, now]
    );
  }

  async insertCachePurge(client, post, actor, now) {
    await this.insertOutbox(
      client,
      'CACHE_PURGE',
      'POST',
      post.id,
      { paths: [`/${post.board_slug}`, `/${post.board_slug}/posts/${post.id}`] },
      actor,
      now
    );
  }

  async insertOutbox(client, type, aggregateType, aggregateId, payload, actor, nextAttemptAt) {
    await client.query(
      `INSERT INTO ops.outbox_task (
         type, status, aggregate_type, aggregate_id, payload, attempt_count,
         next_attempt_at, created_by, updated_by
       ) VALUES ($1, 'PENDING', $2, $3, $4::JSONB, 0, $5, $6, $6)`,
      [type, aggregateType, aggregateId, JSON.stringify(payload), nextAttemptAt, actor]
    );
  }

  async storeIdempotency(client, meta, postId, responseStatus, responseBody, now) {
    await client.query(
      `INSERT INTO ops.idempotency_request (
         operation_scope, idempotency_key, request_hash, response_status, response_body,
         resource_type, resource_id, expires_at, created_by, created_at, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5::JSONB, 'POST', $6, $7, $8, $9, $8, $9)`,
      [
        meta.scope,
        meta.idempotencyKey,
        meta.requestHash,
        responseStatus,
        JSON.stringify(responseBody),
        postId,
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
        meta.actor,
        now,
      ]
    );
  }

  publishResponse(row) {
    return {
      postId: Number(row.id),
      status: row.status,
      lockVersion: row.lock_version,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      scheduledAt: row.scheduled_at ? row.scheduled_at.toISOString() : null,
    };
  }

  transitionResponse(row) {
    return {
      postId: Number(row.id),
      status: row.status,
      lockVersion: row.lock_version,
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

module.exports = AdminPostLifecycleRepository;
