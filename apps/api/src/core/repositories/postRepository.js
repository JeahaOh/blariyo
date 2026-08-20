const PUBLIC_POST_PREDICATE = "status = 'PUBLISHED' AND published_at <= CURRENT_TIMESTAMP";

class PostRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async countPublicRegularPosts(boardId) {
    const result = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM content.board_post
       WHERE board_id = $1
         AND ${PUBLIC_POST_PREDICATE}
         AND pinned_position IS NULL`,
      [boardId]
    );
    return result.rows[0].count;
  }

  async findPublicPinnedPosts(boardId) {
    const result = await this.pool.query(
      `SELECT id, title, view_count, published_at
       FROM content.board_post
       WHERE board_id = $1
         AND ${PUBLIC_POST_PREDICATE}
         AND pinned_position IS NOT NULL
       ORDER BY pinned_position, id DESC`,
      [boardId]
    );
    return result.rows;
  }

  async findPublicRegularPosts(boardId, { limit, offset }) {
    const result = await this.pool.query(
      `SELECT id, title, view_count, published_at
       FROM content.board_post
       WHERE board_id = $1
         AND ${PUBLIC_POST_PREDICATE}
         AND pinned_position IS NULL
       ORDER BY published_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [boardId, limit, offset]
    );
    return result.rows;
  }

  async findPublicPost(boardSlug, postId) {
    const result = await this.pool.query(
      `SELECT
         post.id,
         post.board_id,
         post.title,
         post.source_name,
         post.source_url,
         post.view_count,
         post.published_at,
         post.pinned_position,
         board.slug AS board_slug,
         board.display_name AS board_display_name
       FROM content.board_post AS post
       JOIN content.board AS board ON board.id = post.board_id
       WHERE board.slug = $1
         AND board.is_active = TRUE
         AND post.id = $2
         AND post.status = 'PUBLISHED'
         AND post.published_at <= CURRENT_TIMESTAMP`,
      [boardSlug, postId]
    );
    return result.rows[0] || null;
  }

  async findPostBlocks(postId) {
    const result = await this.pool.query(
      `SELECT
         block.type,
         block.text_content,
         block.alt_text,
         image.status AS image_status,
         image.public_storage_key,
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

  async countNewerPublicRegularPosts(post) {
    const result = await this.pool.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM content.board_post
       WHERE board_id = $1
         AND ${PUBLIC_POST_PREDICATE}
         AND pinned_position IS NULL
         AND (published_at > $2 OR (published_at = $2 AND id > $3))`,
      [post.board_id, post.published_at, post.id]
    );
    return result.rows[0].count;
  }
}

module.exports = PostRepository;
