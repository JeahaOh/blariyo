const WORKER_ACTOR = 'system:outbox-worker';

function backoffMs(attemptCount) {
  return Math.min(2 ** Math.max(0, attemptCount - 1) * 1000, 15 * 60 * 1000);
}

class OutboxRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async recoverStale(now, staleAfterMs = 5 * 60 * 1000) {
    const client = await this.pool.connect();
    let recovered = 0;
    try {
      await client.query('BEGIN');
      const stale = await client.query(
        `SELECT id, attempt_count
         FROM ops.outbox_task
         WHERE status = 'RUNNING' AND updated_at < $1
         ORDER BY updated_at, id
         FOR UPDATE SKIP LOCKED`,
        [new Date(now.getTime() - staleAfterMs)]
      );
      for (const task of stale.rows) {
        const attemptCount = task.attempt_count + 1;
        const dead = attemptCount >= 8;
        await client.query(
          `UPDATE ops.outbox_task
           SET status = $2, attempt_count = $3, next_attempt_at = $4,
               last_error_code = 'WORKER_STALE', updated_by = $5, updated_at = $6
           WHERE id = $1`,
          [
            task.id,
            dead ? 'DEAD' : 'FAILED',
            attemptCount,
            new Date(now.getTime() + backoffMs(attemptCount)),
            WORKER_ACTOR,
            now,
          ]
        );
        recovered += 1;
      }
      await client.query('COMMIT');
      return recovered;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimNext(now) {
    const result = await this.pool.query(
      `WITH candidate AS (
         SELECT id
         FROM ops.outbox_task
         WHERE status IN ('PENDING', 'FAILED') AND next_attempt_at <= $1
         ORDER BY next_attempt_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE ops.outbox_task task
       SET status = 'RUNNING', updated_by = $2, updated_at = $1
       FROM candidate
       WHERE task.id = candidate.id
       RETURNING task.*`,
      [now, WORKER_ACTOR]
    );
    return result.rows[0] || null;
  }

  async complete(task, now) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT id, status FROM ops.outbox_task WHERE id = $1 FOR UPDATE`,
        [task.id]
      );
      if (current.rowCount === 0 || current.rows[0].status !== 'RUNNING') {
        await client.query('ROLLBACK');
        return false;
      }
      if (task.type === 'OBJECT_DELETE_PUBLIC') {
        const transitioned = await client.query(
          `UPDATE content.board_post_image
           SET status = 'PRIVATE_REVIEW', public_storage_key = NULL,
               updated_by = $2, updated_at = $3
           WHERE id = $1 AND status = 'PUBLIC_DELETE_PENDING'`,
          [task.aggregate_id, WORKER_ACTOR, now]
        );
        if (transitioned.rowCount === 0) {
          const existing = await client.query(
            `SELECT status, public_storage_key FROM content.board_post_image WHERE id = $1`,
            [task.aggregate_id]
          );
          if (existing.rowCount === 0
            || existing.rows[0].status !== 'PRIVATE_REVIEW'
            || existing.rows[0].public_storage_key !== null) {
            throw new Error('OUTBOX_IMAGE_STATE_CONFLICT');
          }
        }
      }
      if (task.type === 'OBJECT_DELETE_PRIVATE') {
        const transitioned = await client.query(
          `UPDATE content.board_post_image
           SET status = 'DELETED', updated_by = $2, updated_at = $3
           WHERE id = $1 AND status = 'PRIVATE_DELETE_PENDING'`,
          [task.aggregate_id, WORKER_ACTOR, now]
        );
        if (transitioned.rowCount === 0) {
          const existing = await client.query(
            `SELECT status FROM content.board_post_image WHERE id = $1`,
            [task.aggregate_id]
          );
          if (existing.rowCount === 0 || existing.rows[0].status !== 'DELETED') {
            throw new Error('OUTBOX_IMAGE_STATE_CONFLICT');
          }
        }
      }
      await client.query(
        `UPDATE ops.outbox_task
         SET status = 'SUCCEEDED', last_error_code = NULL,
             updated_by = $2, updated_at = $3
         WHERE id = $1`,
        [task.id, WORKER_ACTOR, now]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async fail(taskId, errorCode, now) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT attempt_count, status FROM ops.outbox_task WHERE id = $1 FOR UPDATE`,
        [taskId]
      );
      if (current.rowCount === 0 || current.rows[0].status !== 'RUNNING') {
        await client.query('ROLLBACK');
        return false;
      }
      const attemptCount = current.rows[0].attempt_count + 1;
      const dead = attemptCount >= 8;
      await client.query(
        `UPDATE ops.outbox_task
         SET status = $2, attempt_count = $3, next_attempt_at = $4,
             last_error_code = $5, updated_by = $6, updated_at = $7
         WHERE id = $1`,
        [
          taskId,
          dead ? 'DEAD' : 'FAILED',
          attemptCount,
          new Date(now.getTime() + backoffMs(attemptCount)),
          errorCode.slice(0, 50),
          WORKER_ACTOR,
          now,
        ]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = OutboxRepository;
module.exports.backoffMs = backoffMs;
