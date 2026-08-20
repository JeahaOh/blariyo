async function seedPublicContent(pool) {
  const actor = 'system:migration';
  const memeBoard = await pool.query("SELECT id FROM content.board WHERE slug = 'meme'");
  const memeBoardId = memeBoard.rows[0].id;

  const boards = await pool.query(
    `INSERT INTO content.board (
       slug, display_name, is_active, posting_policy, display_order, created_by, updated_by
     ) VALUES
       ('empty', '빈 게시판', TRUE, 'ADMIN', 20, $1, $1),
       ('other', '다른 게시판', TRUE, 'ADMIN', 30, $1, $1),
       ('inactive', '비활성 게시판', FALSE, 'ADMIN', 40, $1, $1)
     RETURNING id, slug`,
    [actor]
  );
  const otherBoardId = boards.rows.find((board) => board.slug === 'other').id;

  await pool.query(
    `INSERT INTO content.board_post (
       id, board_id, title, source_name, source_url, status, pinned_position,
       published_at, view_count, created_by, updated_by
     ) VALUES
       (12, $1, '공지 글', NULL, NULL, 'PUBLISHED', 1, CURRENT_TIMESTAMP - INTERVAL '4 days', 1842, $3, $3),
       (1047, $1, '공개 일반 글 1047', 'example.com', 'https://example.com/source/1047', 'PUBLISHED', NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', 1248, $3, $3),
       (1046, $1, '공개 일반 글 1046', NULL, NULL, 'PUBLISHED', NULL, CURRENT_TIMESTAMP - INTERVAL '2 days', 967, $3, $3),
       (1045, $1, '숨김 글', NULL, NULL, 'HIDDEN_REVIEW', NULL, CURRENT_TIMESTAMP - INTERVAL '3 days', 10, $3, $3),
       (1044, $1, '초안 글', NULL, NULL, 'DRAFT', NULL, NULL, 0, $3, $3),
       (1043, $1, '제거 글', NULL, NULL, 'REMOVED', NULL, CURRENT_TIMESTAMP - INTERVAL '3 days', 0, $3, $3),
       (2047, $2, '다른 게시판 글', NULL, NULL, 'PUBLISHED', NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', 1, $3, $3)`,
    [memeBoardId, otherBoardId, actor]
  );

  await pool.query(
    `INSERT INTO content.board_post (
       id, board_id, title, status, scheduled_at, view_count, created_by, updated_by
     ) VALUES (
       1042, $1, '예약 글', 'SCHEDULED', CURRENT_TIMESTAMP + INTERVAL '1 day', 0, $2, $2
     )`,
    [memeBoardId, actor]
  );

  await pool.query(
    `INSERT INTO content.board_post_image (
       id, post_id, private_storage_key, public_storage_key, status, content_sha256,
       mime_type, byte_size, width, height, created_by, updated_by
     ) VALUES (
       501, 1047, 'private/posts/1047/hash.webp', 'posts/1047/hash.webp', 'PUBLIC',
       decode(repeat('ab', 32), 'hex'), 'image/webp', 1024, 1200, 900, $1, $1
     )`,
    [actor]
  );

  await pool.query(
    `INSERT INTO content.board_post_block (
       post_id, position, type, text_content, image_id, alt_text, created_by, updated_by
     ) VALUES
       (12, 1, 'TEXT', '공지 본문', NULL, NULL, $1, $1),
       (1047, 1, 'TEXT', '본문 텍스트', NULL, NULL, $1, $1),
       (1047, 2, 'IMAGE', NULL, 501, '테스트 이미지', $1, $1),
       (1046, 1, 'TEXT', '두 번째 본문', NULL, NULL, $1, $1),
       (2047, 1, 'TEXT', '다른 게시판 본문', NULL, NULL, $1, $1)`,
    [actor]
  );

  await pool.query(
    `INSERT INTO legal.policy_version (
       policy_type, version_label, title, body_html, status, effective_at, ended_at,
       created_by, updated_by
     ) VALUES
       ('PRIVACY', 'v0.1', '개인정보처리방침 v0.1', '<h2>이전 개인정보처리방침</h2>',
        'RETIRED', '2026-07-01T00:00:00Z', '2026-07-31T23:59:59.999Z', $1, $1),
       ('PRIVACY', 'v0.2', '개인정보처리방침', '<h2>현재 개인정보처리방침</h2><p>테스트 본문</p>',
        'EFFECTIVE', '2026-08-01T00:00:00Z', NULL, $1, $1),
       ('PRIVACY', 'v0.3', '개인정보처리방침 예약본', '<h2>예약 본문</h2>',
        'SCHEDULED', '2099-01-01T00:00:00Z', NULL, $1, $1),
       ('TERMS', 'v0.1', '이용약관 초안', '<h2>초안 본문</h2>',
        'DRAFT', NULL, NULL, $1, $1)`,
    [actor]
  );
}

module.exports = { seedPublicContent };
