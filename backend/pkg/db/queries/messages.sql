-- Messages Queries (Common Room posts and future private messages)

-- ============================================================================
-- POST MANAGEMENT (Top-level messages)
-- ============================================================================

-- name: CreatePost :one
INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    content,
    message_type,
    visibility
) VALUES (
    $1, $2, $3, $4, $5, 'post', $6
)
RETURNING *;

-- name: GetPost :one
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1 AND m.is_deleted = false;

-- name: GetGamePosts :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.game_id = $1
  AND m.message_type = 'post'
  AND m.is_deleted = false
  AND ($2::integer IS NULL OR m.phase_id = $2)
ORDER BY m.created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetPhasePosts :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.phase_id = $1
  AND m.message_type = 'post'
  AND m.is_deleted = false
ORDER BY m.created_at DESC;

-- name: UpdatePost :one
UPDATE messages
SET content = $2,
    is_edited = true
WHERE id = $1
  AND is_deleted = false
  AND message_type = 'post'
RETURNING *;

-- name: DeletePost :one
UPDATE messages
SET is_deleted = true
WHERE id = $1
  AND message_type = 'post'
RETURNING *;

-- ============================================================================
-- COMMENT MANAGEMENT (Threaded replies)
-- ============================================================================

-- name: CreateComment :one
INSERT INTO messages (
    game_id,
    phase_id,
    author_id,
    character_id,
    content,
    message_type,
    parent_id,
    visibility
) VALUES (
    $1, $2, $3, $4, $5, 'comment', $6, $7
)
RETURNING *;

-- name: GetComment :one
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1 AND m.is_deleted = false;

-- name: GetPostComments :many
-- Get direct comments for a specific post
-- For threaded display, call this recursively on the frontend
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.parent_id = $1
  AND m.message_type = 'comment'
  AND m.is_deleted = false
ORDER BY m.created_at ASC;

-- NOTE: GetCommentThread with recursive CTE is not supported by sqlc
-- Use GetPostComments recursively on the frontend to build the tree
-- This is actually more efficient for large thread trees anyway

-- name: UpdateComment :one
UPDATE messages
SET content = $2,
    is_edited = true
WHERE id = $1
  AND is_deleted = false
  AND message_type = 'comment'
RETURNING *;

-- name: DeleteComment :one
UPDATE messages
SET is_deleted = true
WHERE id = $1
  AND message_type = 'comment'
RETURNING *;

-- ============================================================================
-- STATISTICS & COUNTS
-- ============================================================================

-- name: GetGamePostCount :one
SELECT COUNT(*)
FROM messages
WHERE game_id = $1
  AND message_type = 'post'
  AND is_deleted = false
  AND ($2::integer IS NULL OR phase_id = $2);

-- name: GetPostCommentCount :one
SELECT COUNT(*)
FROM messages
WHERE parent_id = $1
  AND is_deleted = false;

-- name: GetAllDescendantComments :many
-- Get all descendant comments recursively for counting
WITH RECURSIVE comment_tree AS (
  SELECT messages.id as comment_id
  FROM messages
  WHERE messages.parent_id = $1 AND messages.is_deleted = false

  UNION ALL

  SELECT m.id as comment_id
  FROM messages m
  INNER JOIN comment_tree ct ON m.parent_id = ct.comment_id
  WHERE m.is_deleted = false
)
SELECT comment_id as id FROM comment_tree;

-- name: GetUserPostsInGame :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.game_id = $1
  AND m.author_id = $2
  AND m.message_type = 'post'
  AND m.is_deleted = false
ORDER BY m.created_at DESC;

-- ============================================================================
-- REACTIONS (Optional - for future use)
-- ============================================================================

-- name: AddReaction :one
INSERT INTO message_reactions (message_id, user_id, reaction_type)
VALUES ($1, $2, $3)
ON CONFLICT (message_id, user_id, reaction_type) DO NOTHING
RETURNING *;

-- name: RemoveReaction :exec
DELETE FROM message_reactions
WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3;

-- name: GetMessageReactions :many
SELECT mr.*, u.username
FROM message_reactions mr
JOIN users u ON mr.user_id = u.id
WHERE mr.message_id = $1
ORDER BY mr.created_at;

-- name: GetReactionCounts :many
SELECT reaction_type, COUNT(*) as count
FROM message_reactions
WHERE message_id = $1
GROUP BY reaction_type;
