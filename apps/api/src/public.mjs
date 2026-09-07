import { fail, id, slug, pagination } from './http.mjs';
const visible = "p.status='PUBLISHED' AND p.published_at<=now()";
const boardData = (b) => ({ slug: b.slug, displayName: b.display_name });
const listItem = (p, b) => ({
  postId: Number(p.id),
  title: p.title,
  viewCount: Number(p.view_count),
  authorLabel: '운영자',
  publishedAt: p.published_at.toISOString(),
  path: `/${b.slug}/posts/${p.id}`,
});
export function publicService(
  pool,
  { siteOrigin = 'http://localhost:3000', imageOrigin = 'http://localhost:3000/media' } = {}
) {
  async function board(db, name, code = 'BOARD_NOT_FOUND') {
    if (!slug(name)) fail(404, code);
    const b = (await db.query('SELECT * FROM content.board WHERE slug=$1 AND is_active', [name]))
      .rows[0];
    if (!b) fail(404, code);
    return b;
  }
  async function page(db, b, pageNumber) {
    const total = Number(
      (
        await db.query(
          `SELECT count(*) FROM content.board_post p WHERE board_id=$1 AND ${visible} AND pinned_position IS NULL`,
          [b.id]
        )
      ).rows[0].count
    );
    if (pageNumber > Math.max(1, Math.ceil(total / 20))) fail(404, 'PAGE_NOT_FOUND');
    const pinned = (
      await db.query(
        `SELECT * FROM content.board_post p WHERE board_id=$1 AND ${visible} AND pinned_position IS NOT NULL ORDER BY pinned_position`,
        [b.id]
      )
    ).rows;
    const rows = (
      await db.query(
        `SELECT * FROM content.board_post p WHERE board_id=$1 AND ${visible} AND pinned_position IS NULL ORDER BY published_at DESC,id DESC LIMIT 20 OFFSET $2`,
        [b.id, (pageNumber - 1) * 20]
      )
    ).rows;
    return {
      data: {
        board: boardData(b),
        pinnedItems: pinned.map((p) => listItem(p, b)),
        items: rows.map((p) => listItem(p, b)),
      },
      meta: pagination(pageNumber, total),
    };
  }
  async function snapshot(fn) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await fn(db);
      await db.query('COMMIT');
      return result;
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
  return {
    boards: async () => ({
      items: (
        await pool.query('SELECT * FROM content.board WHERE is_active ORDER BY display_order')
      ).rows.map((b) => ({ ...boardData(b), postingPolicy: b.posting_policy, path: `/${b.slug}` })),
    }),
    list: (name, p = 1) => snapshot(async (db) => page(db, await board(db, name), p)),
    detail: (name, postId) =>
      snapshot(async (db) => {
        if (!id(postId)) fail(404, 'POST_NOT_FOUND');
        const b = await board(db, name, 'POST_NOT_FOUND');
        const p = (
          await db.query(
            `SELECT * FROM content.board_post p WHERE p.id=$1 AND board_id=$2 AND ${visible}`,
            [postId, b.id]
          )
        ).rows[0];
        if (!p) fail(404, 'POST_NOT_FOUND');
        const rank = p.pinned_position
          ? 0
          : Number(
              (
                await db.query(
                  `SELECT count(*) FROM content.board_post p WHERE board_id=$1 AND ${visible} AND pinned_position IS NULL AND (published_at,id)>($2,$3)`,
                  [b.id, p.published_at, p.id]
                )
              ).rows[0].count
            );
        const list = await page(db, b, Math.floor(rank / 20) + 1);
        const blocks = (
          await db.query(
            'SELECT b.*,i.public_storage_key,i.width,i.height FROM content.board_post_block b LEFT JOIN content.board_post_image i ON i.id=b.image_id WHERE b.post_id=$1 ORDER BY position',
            [p.id]
          )
        ).rows.map((block) =>
          block.type === 'TEXT'
            ? { type: 'TEXT', text: block.text_content }
            : {
                type: 'IMAGE',
                image: {
                  url: `${imageOrigin}/${block.public_storage_key}`,
                  alt: block.alt_text,
                  width: block.width,
                  height: block.height,
                },
              }
        );
        return {
          post: {
            ...Object.fromEntries(Object.entries(listItem(p, b)).filter(([k]) => k !== 'path')),
            board: boardData(b),
            blocks,
            source: p.source_url ? { name: p.source_name, url: p.source_url } : null,
            shareUrl: `${siteOrigin}/${b.slug}/posts/${p.id}`,
          },
          context: {
            pinnedItems: list.data.pinnedItems.map((i) => ({
              ...i,
              ...(i.postId === Number(p.id) ? { current: true } : {}),
            })),
            items: list.data.items.map((i) => ({
              ...i,
              ...(i.postId === Number(p.id) ? { current: true } : {}),
            })),
            listPage: list.meta.page,
            pageSize: 20,
            totalItems: list.meta.totalItems,
            totalPages: list.meta.totalPages,
          },
        };
      }),
    view: async (name, postId) => {
      if (!slug(name) || !id(postId)) fail(404, 'POST_NOT_FOUND');
      const result = await pool.query(
        `UPDATE content.board_post p SET view_count=view_count+1 FROM content.board b WHERE p.board_id=b.id AND b.slug=$1 AND b.is_active AND p.id=$2 AND ${visible}`,
        [name, postId]
      );
      if (!result.rowCount) fail(404, 'POST_NOT_FOUND');
    },
    policy: async (type, version) => {
      if (!['terms', 'privacy'].includes(type)) fail(404, 'POLICY_NOT_FOUND');
      const rows = (
        await pool.query(
          "SELECT * FROM legal.policy_version WHERE policy_type=$1 AND status IN ('EFFECTIVE','RETIRED') AND effective_at<=now() ORDER BY effective_at DESC",
          [type.toUpperCase()]
        )
      ).rows;
      const p = version
        ? rows.find((r) => r.version_label === version)
        : rows.find((r) => r.status === 'EFFECTIVE');
      if (!p) fail(404, 'POLICY_NOT_FOUND');
      const history = (r) => ({
        version: r.version_label,
        effectiveAt: r.effective_at.toISOString(),
        endedAt: r.ended_at?.toISOString() || null,
      });
      return {
        policy: { ...history(p), type, title: p.title, bodyHtml: p.body_html },
        history: rows.map(history),
      };
    },
  };
}
