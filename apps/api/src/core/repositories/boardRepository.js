class BoardRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findActiveBoards() {
    const result = await this.pool.query(`
      SELECT id, slug, display_name, posting_policy
      FROM content.board
      WHERE is_active = TRUE
      ORDER BY display_order, id
    `);
    return result.rows;
  }

  async findActiveBoardBySlug(slug) {
    const result = await this.pool.query(
      `SELECT id, slug, display_name
       FROM content.board
       WHERE slug = $1 AND is_active = TRUE`,
      [slug]
    );
    return result.rows[0] || null;
  }
}

module.exports = BoardRepository;
