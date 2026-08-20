class AdminPostRepository {
  constructor(pool) {
    this.pool = pool;
  }

  buildSearch(filters) {
    const conditions = [];
    const values = [];
    const add = (condition, value) => {
      values.push(value);
      conditions.push(condition.replace('?', `$${values.length}`));
    };

    if (filters.status) add('post.status = ?', filters.status);
    if (filters.board) add('board.slug = ?', filters.board);
    if (filters.titlePrefix) add("post.title LIKE ? || '%' ESCAPE '\\'", filters.titlePrefix);
    if (filters.from) add('post.updated_at >= ?', filters.from);
    if (filters.to) add('post.updated_at <= ?', filters.to);

    return {
      where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
  }

  async countPosts(filters) {
    const search = this.buildSearch(filters);
    const result = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM content.board_post AS post
       JOIN content.board AS board ON board.id = post.board_id
       ${search.where}`,
      search.values
    );
    return result.rows[0].count;
  }

  async findPosts(filters, { limit, offset }) {
    const search = this.buildSearch(filters);
    const limitParameter = search.values.length + 1;
    const offsetParameter = search.values.length + 2;
    const result = await this.pool.query(
      `SELECT
         post.id,
         board.slug AS board_slug,
         post.title,
         post.status,
         post.lock_version,
         post.scheduled_at,
         post.published_at,
         post.updated_at
       FROM content.board_post AS post
       JOIN content.board AS board ON board.id = post.board_id
       ${search.where}
       ORDER BY post.updated_at DESC, post.id DESC
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      [...search.values, limit, offset]
    );
    return result.rows;
  }

  async findPost(postId) {
    const result = await this.pool.query(
      `SELECT
         post.id,
         board.slug AS board_slug,
         post.title,
         post.source_name,
         post.source_url,
         post.status,
         post.pinned_position,
         post.scheduled_at,
         post.published_at,
         post.lock_version,
         post.created_at,
         post.updated_at
       FROM content.board_post AS post
       JOIN content.board AS board ON board.id = post.board_id
       WHERE post.id = $1`,
      [postId]
    );
    return result.rows[0] || null;
  }

  async findPostBlocks(postId) {
    const result = await this.pool.query(
      `SELECT
         block.position,
         block.type,
         block.text_content,
         block.alt_text,
         image.id AS image_id,
         image.status AS image_status,
         image.width,
         image.height
       FROM content.board_post_block AS block
       LEFT JOIN content.board_post_image AS image ON image.id = block.image_id
       WHERE block.post_id = $1
       ORDER BY block.position`,
      [postId]
    );
    return result.rows;
  }
}

module.exports = AdminPostRepository;
