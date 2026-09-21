ALTER TABLE collect.candidate ADD COLUMN content_blocks JSONB;
ALTER TABLE collect.candidate ADD CONSTRAINT candidate_content_blocks_shape CHECK (
  content_blocks IS NULL OR (
    jsonb_typeof(content_blocks) = 'array'
    AND jsonb_array_length(content_blocks) BETWEEN 1 AND 40
  )
);
