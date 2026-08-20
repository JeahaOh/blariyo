const AGGREGATION_LOCK = 'blariyo:event-aggregate';
const ACTOR = 'system:event-aggregate';

async function aggregateEventBatch(pool, { batchSize = 500, clock = () => new Date() } = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error('batchSize must be an integer between 1 and 5000');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)::BIGINT) AS locked',
      [AGGREGATION_LOCK]
    );
    if (!lock.rows[0].locked) {
      await client.query('ROLLBACK');
      return { processed: 0, locked: false };
    }

    const batch = await client.query(
      `SELECT
         id,
         type,
         board_id,
         post_id,
         anonymous_hmac,
         (occurred_at AT TIME ZONE 'UTC')::DATE::TEXT AS event_date
       FROM analytics.raw_event
       WHERE aggregated_at IS NULL
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [batchSize]
    );
    if (batch.rowCount === 0) {
      await client.query('COMMIT');
      return { processed: 0, locked: true };
    }

    const metrics = new Map();
    const postViews = new Map();
    for (const row of batch.rows) {
      const metricKey = `${row.event_date}|${row.type}|${row.board_id}`;
      const metric = metrics.get(metricKey) || {
        eventDate: row.event_date,
        eventType: row.type,
        boardId: row.board_id,
        eventCount: 0,
      };
      metric.eventCount += 1;
      metrics.set(metricKey, metric);
      if (row.type === 'POST_VIEW') {
        postViews.set(String(row.post_id), (postViews.get(String(row.post_id)) || 0) + 1);
      }
    }

    const now = clock();
    for (const metric of metrics.values()) {
      const uniqueResult = await client.query(
        `SELECT COUNT(DISTINCT anonymous_hmac)::BIGINT AS count
         FROM analytics.raw_event
         WHERE type = $1
           AND board_id = $2
           AND (occurred_at AT TIME ZONE 'UTC')::DATE = $3::DATE`,
        [metric.eventType, metric.boardId, metric.eventDate]
      );
      await client.query(
        `INSERT INTO analytics.daily_event_metric (
           event_date, event_type, board_id, event_count, unique_anonymous_count,
           created_by, created_at, updated_by, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7)
         ON CONFLICT (event_date, event_type, board_id) DO UPDATE SET
           event_count = analytics.daily_event_metric.event_count + EXCLUDED.event_count,
           unique_anonymous_count = EXCLUDED.unique_anonymous_count,
           updated_by = EXCLUDED.updated_by,
           updated_at = EXCLUDED.updated_at`,
        [
          metric.eventDate,
          metric.eventType,
          metric.boardId,
          metric.eventCount,
          uniqueResult.rows[0].count,
          ACTOR,
          now,
        ]
      );
    }

    for (const [postId, count] of postViews) {
      await client.query(
        `UPDATE content.board_post
         SET view_count = view_count + $2,
             updated_by = $3,
             updated_at = $4
         WHERE id = $1`,
        [postId, count, ACTOR, now]
      );
    }

    await client.query(
      `UPDATE analytics.raw_event
       SET aggregated_at = $2,
           updated_by = $3,
           updated_at = $2
       WHERE id = ANY($1::BIGINT[])`,
      [batch.rows.map((row) => row.id), now, ACTOR]
    );
    await client.query('COMMIT');
    return { processed: batch.rowCount, locked: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteExpiredRawEvents(pool, { retentionDays = 90, clock = () => new Date() } = {}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error('retentionDays must be a positive integer');
  }
  const cutoff = new Date(clock().getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await pool.query(
    `DELETE FROM analytics.raw_event
     WHERE aggregated_at IS NOT NULL
       AND occurred_at < $1`,
    [cutoff]
  );
  return result.rowCount;
}

module.exports = { aggregateEventBatch, deleteExpiredRawEvents };
