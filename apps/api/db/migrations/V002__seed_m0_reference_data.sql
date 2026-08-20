INSERT INTO content.board (
  slug,
  display_name,
  is_active,
  posting_policy,
  display_order,
  created_by,
  updated_by
)
VALUES (
  'meme',
  '짤',
  TRUE,
  'ADMIN',
  10,
  'system:migration',
  'system:migration'
);
