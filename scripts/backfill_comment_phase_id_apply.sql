-- Backfill phase_id on comments by walking up the parent chain to the root post.
-- Run backfill_comment_phase_id_check.sql first to preview what will change.

BEGIN;

WITH RECURSIVE comment_roots AS (
  -- Start with comments missing phase_id
  SELECT
    c.id        AS comment_id,
    c.id        AS current_id,
    c.parent_id AS current_parent_id
  FROM messages c
  WHERE c.message_type = 'comment'
    AND c.phase_id IS NULL

  UNION ALL

  -- Walk up one level toward the root
  SELECT
    cr.comment_id,
    m.id,
    m.parent_id
  FROM comment_roots cr
  JOIN messages m ON m.id = cr.current_parent_id
  WHERE cr.current_parent_id IS NOT NULL
),
-- The root is the node with no parent
roots AS (
  SELECT DISTINCT ON (comment_id)
    comment_id,
    current_id AS root_id
  FROM comment_roots
  WHERE current_parent_id IS NULL
)
UPDATE messages c
SET phase_id = p.phase_id
FROM roots r
JOIN messages p ON p.id = r.root_id
WHERE c.id = r.comment_id
  AND p.phase_id IS NOT NULL;

-- Show how many comments still have no phase_id (should be 0 if backfill worked)
SELECT COUNT(*) AS comments_still_missing_phase_id
FROM messages
WHERE message_type = 'comment'
  AND phase_id IS NULL;

COMMIT;
