INSERT INTO content.board(
    slug,display_name,is_active,posting_policy,display_order,created_by,created_at,updated_by,updated_at
)
VALUES('meme','짤',true,'ADMIN',10,'system:migration',now(),'system:migration',now());
