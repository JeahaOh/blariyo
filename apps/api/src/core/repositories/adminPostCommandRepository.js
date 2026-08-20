class AdminPostCommandRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findIdempotency(actor, scope, key) {
    const result = await this.pool.query(
      `SELECT request_hash, response_status, response_body, resource_id
       FROM ops.idempotency_request
       WHERE created_by = $1 AND operation_scope = $2 AND idempotency_key = $3
         AND expires_at > CURRENT_TIMESTAMP`,
      [actor, scope, key]
    );
    return result.rows[0] || null;
  }

  async createDraft(command, { actor, scope, idempotencyKey, requestHash }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM ops.idempotency_request
         WHERE created_by = $1 AND operation_scope = $2 AND idempotency_key = $3
           AND expires_at <= CURRENT_TIMESTAMP`,
        [actor, scope, idempotencyKey]
      );
      const existing = await client.query(
        `SELECT request_hash, response_status, response_body, resource_id
         FROM ops.idempotency_request
         WHERE created_by = $1 AND operation_scope = $2 AND idempotency_key = $3
           AND expires_at > CURRENT_TIMESTAMP
         FOR UPDATE`,
        [actor, scope, idempotencyKey]
      );
      if (existing.rowCount > 0) {
        await client.query('COMMIT');
        return { kind: 'IDEMPOTENT', row: existing.rows[0] };
      }

      const board = await client.query(
        `SELECT id FROM content.board WHERE slug = $1 AND is_active = TRUE`,
        [command.boardSlug]
      );
      if (board.rowCount === 0) {
        await client.query('ROLLBACK');
        return { kind: 'BOARD_NOT_FOUND' };
      }

      const post = await client.query(
        `INSERT INTO content.board_post (
           board_id, title, source_name, source_url, status, pinned_position,
           created_by, updated_by
         ) VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $6)
         RETURNING id, status, lock_version`,
        [
          board.rows[0].id,
          command.title,
          command.source?.name || null,
          command.source?.url || null,
          command.pinnedPosition,
          actor,
        ]
      );
      const postId = post.rows[0].id;
      const imageResult = await this.lockAndClaimImages(client, command.imageIds, postId, actor);
      if (imageResult !== 'CLAIMED') {
        await client.query('ROLLBACK');
        return { kind: imageResult };
      }
      await this.insertBlocks(client, postId, command.blocks, actor);
      await client.query(
        `INSERT INTO content.board_post_status_history (
           post_id, from_status, to_status, reason_code, actor_type, created_by, updated_by
         ) VALUES ($1, NULL, 'DRAFT', 'CREATE', 'ADMIN', $2, $2)`,
        [postId, actor]
      );
      const responseBody = {
        postId: Number(postId),
        status: post.rows[0].status,
        lockVersion: post.rows[0].lock_version,
      };
      await client.query(
        `INSERT INTO ops.idempotency_request (
           operation_scope, idempotency_key, request_hash, response_status, response_body,
           resource_type, resource_id, expires_at, created_by, updated_by
         ) VALUES ($1, $2, $3, 201, $4::JSONB, 'POST', $5,
                   CURRENT_TIMESTAMP + INTERVAL '24 hours', $6, $6)`,
        [scope, idempotencyKey, requestHash, JSON.stringify(responseBody), postId, actor]
      );
      await client.query('COMMIT');
      return { kind: 'CREATED', responseBody };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'uq_idempotency_request__actor_scope_key') {
        const existing = await this.findIdempotency(actor, scope, idempotencyKey);
        if (existing) return { kind: 'IDEMPOTENT', row: existing };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateDraft(postId, command, actor) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT id, status, lock_version, title, source_name, source_url, pinned_position
         FROM content.board_post
         WHERE id = $1
         FOR UPDATE`,
        [postId]
      );
      if (current.rowCount === 0) {
        await client.query('ROLLBACK');
        return { kind: 'POST_NOT_FOUND' };
      }
      const post = current.rows[0];
      if (!['DRAFT', 'SCHEDULED', 'HIDDEN_REVIEW'].includes(post.status)) {
        await client.query('ROLLBACK');
        return { kind: 'POST_STATE_CONFLICT' };
      }
      if (post.lock_version !== command.lockVersion) {
        await client.query('ROLLBACK');
        return { kind: 'POST_VERSION_CONFLICT' };
      }
      if (post.status === 'HIDDEN_REVIEW' && command.pinnedPosition !== undefined && command.pinnedPosition !== null) {
        await client.query('ROLLBACK');
        return { kind: 'POST_STATE_CONFLICT' };
      }

      if (command.blocks) {
        const imageResult = await this.replaceBlocks(client, post, command, actor);
        if (imageResult !== 'REPLACED') {
          await client.query('ROLLBACK');
          return { kind: imageResult };
        }
      }

      const title = command.title === undefined ? post.title : command.title;
      const sourceName = command.source === undefined ? post.source_name : command.source?.name || null;
      const sourceUrl = command.source === undefined ? post.source_url : command.source?.url || null;
      const pinnedPosition = command.pinnedPosition === undefined
        ? post.pinned_position
        : command.pinnedPosition;
      const updated = await client.query(
        `UPDATE content.board_post
         SET title = $2,
             source_name = $3,
             source_url = $4,
             pinned_position = $5,
             lock_version = lock_version + 1,
             updated_by = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, status, lock_version, updated_at`,
        [postId, title, sourceName, sourceUrl, pinnedPosition, actor]
      );
      await client.query(
        `INSERT INTO content.board_post_status_history (
           post_id, from_status, to_status, reason_code, actor_type, created_by, updated_by
         ) VALUES ($1, $2, $2, 'EDIT', 'ADMIN', $3, $3)`,
        [postId, post.status, actor]
      );
      await client.query('COMMIT');
      return { kind: 'UPDATED', row: updated.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'uq_board_post__published_pin') {
        return { kind: 'PINNED_ORDER_CONFLICT' };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async lockAndClaimImages(client, imageIds, postId, actor) {
    if (imageIds.length === 0) return 'CLAIMED';
    const images = await client.query(
      `SELECT id, post_id, status
       FROM content.board_post_image
       WHERE id = ANY($1::BIGINT[])
       FOR UPDATE`,
      [imageIds]
    );
    if (images.rowCount !== imageIds.length) return 'IMAGE_NOT_FOUND';
    if (images.rows.some((image) => image.post_id !== null)) return 'IMAGE_ALREADY_ATTACHED';
    if (images.rows.some((image) => image.status !== 'STAGED')) return 'IMAGE_STATE_CONFLICT';
    await client.query(
      `UPDATE content.board_post_image
       SET post_id = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::BIGINT[])`,
      [imageIds, postId, actor]
    );
    return 'CLAIMED';
  }

  async replaceBlocks(client, post, command, actor) {
    const existing = await client.query(
      `SELECT id, status
       FROM content.board_post_image
       WHERE post_id = $1
       FOR UPDATE`,
      [post.id]
    );
    if (post.status === 'HIDDEN_REVIEW' && existing.rows.some((image) => image.status === 'PUBLIC_DELETE_PENDING')) {
      return 'IMAGE_STATE_CONFLICT';
    }
    const requested = new Set(command.imageIds.map(String));
    const retained = existing.rows.filter((image) => requested.has(String(image.id)));
    const newIds = command.imageIds.filter((id) => !retained.some((image) => String(image.id) === String(id)));
    if (retained.some((image) => !['STAGED', 'PRIVATE_REVIEW'].includes(image.status))) {
      return 'IMAGE_STATE_CONFLICT';
    }

    await client.query('DELETE FROM content.board_post_block WHERE post_id = $1', [post.id]);
    const removed = existing.rows.filter((image) => !requested.has(String(image.id)));
    for (const image of removed) {
      if (post.status === 'HIDDEN_REVIEW') {
        if (image.status !== 'PRIVATE_REVIEW') return 'IMAGE_STATE_CONFLICT';
        await client.query(
          `UPDATE content.board_post_image
           SET post_id = NULL, status = 'PRIVATE_DELETE_PENDING', updated_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [image.id, actor]
        );
        await client.query(
          `INSERT INTO ops.outbox_task (
             type, status, aggregate_type, aggregate_id, payload, attempt_count,
             next_attempt_at, created_by, updated_by
           ) SELECT 'OBJECT_DELETE_PRIVATE', 'PENDING', 'IMAGE', id,
                    jsonb_build_object('privateStorageKey', private_storage_key), 0,
                    CURRENT_TIMESTAMP, $2, $2
             FROM content.board_post_image WHERE id = $1`,
          [image.id, actor]
        );
      } else {
        if (image.status !== 'STAGED') return 'IMAGE_STATE_CONFLICT';
        await client.query(
          `UPDATE content.board_post_image
           SET post_id = NULL, updated_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [image.id, actor]
        );
      }
    }

    const claim = await this.lockAndClaimImages(client, newIds, post.id, actor);
    if (claim !== 'CLAIMED') return claim;
    await this.insertBlocks(client, post.id, command.blocks, actor);
    return 'REPLACED';
  }

  async insertBlocks(client, postId, blocks, actor) {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      await client.query(
        `INSERT INTO content.board_post_block (
           post_id, position, type, text_content, image_id, alt_text, created_by, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [
          postId,
          index + 1,
          block.type,
          block.type === 'TEXT' ? block.text : null,
          block.type === 'IMAGE' ? block.imageId : null,
          block.type === 'IMAGE' ? block.alt : null,
          actor,
        ]
      );
    }
  }
}

module.exports = AdminPostCommandRepository;
