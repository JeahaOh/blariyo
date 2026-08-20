class EventRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async insertRawEvent(event) {
    const result = await this.pool.query(
      `INSERT INTO analytics.raw_event (
         type, anonymous_hmac, session_hmac, board_id, post_id, list_page, item_count,
         dedupe_hmac, occurred_at, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'system:event-ingest', 'system:event-ingest')
       ON CONFLICT (dedupe_hmac) DO NOTHING
       RETURNING id`,
      [
        event.type,
        event.anonymousHmac,
        event.sessionHmac,
        event.boardId,
        event.postId,
        event.listPage,
        event.itemCount,
        event.dedupeHmac,
        event.occurredAt,
      ]
    );
    return result.rowCount === 1;
  }
}

module.exports = EventRepository;
