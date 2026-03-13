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
