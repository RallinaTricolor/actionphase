-- Backfill phase_id on comments by walking up the parent chain to the root post.
-- Run backfill_comment_phase_id_check.sql first to preview what will change.

BEGIN;

WITH RECURSIVE comment_roots AS (
  -- Start with comments missing phase_id, track their parent chain
  SELECT
    c.id       AS comment_id,
    c.parent_id,
    0          AS depth
  FROM messages c
  WHERE c.message_type = 'comment'
    AND c.phase_id IS NULL

  UNION ALL

  -- Walk up toward the root post
  SELECT
    cr.comment_id,
    m.parent_id,
    cr.depth + 1
  FROM comment_roots cr
  JOIN messages m ON m.id = cr.parent_id
  WHERE cr.parent_id IS NOT NULL
),
-- Keep only the row where we reached the root (parent_id IS NULL = root post)
roots AS (
  SELECT DISTINCT ON (comment_id)
    comment_id,
    parent_id AS root_id
  FROM comment_roots
  ORDER BY comment_id, depth DESC
)
UPDATE messages c
SET phase_id = p.phase_id
FROM roots r
JOIN messages p ON p.id = r.root_id
WHERE c.id = r.comment_id
  AND p.phase_id IS NOT NULL;

-- Show how many rows were updated
GET DIAGNOSTICS -- not valid outside plpgsql, so use rowcount trick:
SELECT 'Rows updated: ' || COUNT(*) AS result
FROM messages
WHERE message_type = 'comment'
  AND phase_id IS NOT NULL;

COMMIT;
