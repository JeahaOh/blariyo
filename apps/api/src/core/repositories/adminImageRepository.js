class AdminImageRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createStagedImages(images, actor) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rows = [];
      for (const image of images) {
        const result = await client.query(
          `INSERT INTO content.board_post_image (
             private_storage_key, status, content_sha256, mime_type, byte_size,
             width, height, created_by, updated_by
           ) VALUES ($1, 'STAGED', $2, $3, $4, $5, $6, $7, $7)
           RETURNING id, status, mime_type, byte_size, width, height`,
          [
            image.storageKey,
            image.sha256,
            image.mimeType,
            image.byteSize,
            image.width,
            image.height,
            actor,
          ]
        );
        rows.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findPreviewImage(imageId) {
    const result = await this.pool.query(
      `SELECT id, private_storage_key, mime_type
       FROM content.board_post_image
       WHERE id = $1
         AND status IN ('STAGED', 'PUBLIC', 'PUBLIC_DELETE_PENDING', 'PRIVATE_REVIEW')`,
      [imageId]
    );
    return result.rows[0] || null;
  }

  async markPrivateDeletePending(imageId, actor) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT id, post_id, status, private_storage_key
         FROM content.board_post_image
         WHERE id = $1
         FOR UPDATE`,
        [imageId]
      );
      if (current.rowCount === 0) {
        await client.query('ROLLBACK');
        return { kind: 'NOT_FOUND' };
      }
      const image = current.rows[0];
      if (image.post_id !== null || image.status !== 'STAGED') {
        await client.query('ROLLBACK');
        return { kind: 'CONFLICT' };
      }

      await client.query(
        `UPDATE content.board_post_image
         SET status = 'PRIVATE_DELETE_PENDING', updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [imageId, actor]
      );
      await client.query(
        `INSERT INTO ops.outbox_task (
           type, status, aggregate_type, aggregate_id, payload, attempt_count,
           next_attempt_at, created_by, updated_by
         ) VALUES (
           'OBJECT_DELETE_PRIVATE', 'PENDING', 'IMAGE', $1, $2::JSONB, 0,
           CURRENT_TIMESTAMP, $3, $3
         )`,
        [imageId, JSON.stringify({ privateStorageKey: image.private_storage_key }), actor]
      );
      await client.query('COMMIT');
      return { kind: 'UPDATED' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = AdminImageRepository;
