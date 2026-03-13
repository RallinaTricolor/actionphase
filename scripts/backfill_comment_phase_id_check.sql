-- Check: how many comments are missing phase_id
SELECT
  message_type,
  phase_id IS NULL AS missing_phase_id,
  COUNT(*)
FROM messages
WHERE message_type IN ('post', 'comment')
GROUP BY message_type, missing_phase_id
ORDER BY message_type, missing_phase_id;

-- Preview: which comments will be updated and what phase_id they'll get
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
SELECT
  c.id          AS comment_id,
  c.created_at,
  r.root_id     AS root_post_id,
  p.phase_id    AS will_get_phase_id
FROM roots r
JOIN messages c ON c.id = r.comment_id
JOIN messages p ON p.id = r.root_id
WHERE p.phase_id IS NOT NULL
ORDER BY c.created_at;
