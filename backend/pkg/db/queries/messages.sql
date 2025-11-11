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
    visibility,
    mentioned_character_ids
) VALUES (
    $1, $2, $3, $4, $5, 'post', $6, $7
)
RETURNING *;

-- name: GetPost :one
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1;

-- name: GetMessage :one
-- Get any message by ID (post or comment) - used for deep linking
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1
  AND m.is_deleted = false;

-- name: GetMessageWithParentContext :many
-- Get a message with its full parent chain for deep linking with context
-- Returns messages in parent-to-child order (root → target)
-- Note: Returns ALL parents up to root. Backend can limit depth if needed.
-- $1 = message_id (target comment)
WITH RECURSIVE parent_chain AS (
    -- Base case: Start with the target message
    SELECT
        m.id,
        m.game_id,
        m.phase_id,
        m.author_id,
        m.character_id,
        m.content,
        m.message_type,
        m.parent_id,
        m.thread_depth,
        m.visibility,
        m.mentioned_character_ids,
        m.is_edited,
        m.is_deleted,
        m.deleted_at,
        m.deleted_by_user_id,
        m.edited_at,
        m.edit_count,
        m.created_at,
        m.thread_depth as original_depth
    FROM messages m
    WHERE m.id = $1

    UNION ALL

    -- Recursive case: Walk up the parent chain to root
    SELECT
        m.id,
        m.game_id,
        m.phase_id,
        m.author_id,
        m.character_id,
        m.content,
        m.message_type,
        m.parent_id,
        m.thread_depth,
        m.visibility,
        m.mentioned_character_ids,
        m.is_edited,
        m.is_deleted,
        m.deleted_at,
        m.deleted_by_user_id,
        m.edited_at,
        m.edit_count,
        m.created_at,
        m.thread_depth as original_depth
    FROM messages m
    INNER JOIN parent_chain pch ON m.id = pch.parent_id
)
SELECT
    parent_chain.id,
    parent_chain.game_id,
    parent_chain.phase_id,
    parent_chain.author_id,
    parent_chain.character_id,
    parent_chain.content,
    parent_chain.message_type,
    parent_chain.parent_id,
    parent_chain.thread_depth,
    parent_chain.visibility,
    parent_chain.mentioned_character_ids,
    parent_chain.is_edited,
    parent_chain.is_deleted,
    parent_chain.deleted_at,
    parent_chain.deleted_by_user_id,
    parent_chain.edited_at,
    parent_chain.edit_count,
    parent_chain.created_at,
    u.username as author_username,
    c.name as character_name,
    c.avatar_url as character_avatar_url,
    (SELECT COUNT(*) FROM messages WHERE parent_id = parent_chain.id) as reply_count
FROM parent_chain
JOIN users u ON parent_chain.author_id = u.id
LEFT JOIN characters c ON parent_chain.character_id = c.id
ORDER BY parent_chain.original_depth ASC;  -- Return in parent-to-child order

-- name: GetGamePosts :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.game_id = $1
  AND m.message_type = 'post'
  AND m.is_deleted = false
  AND (CASE WHEN $2 = 0 THEN TRUE ELSE m.phase_id = $2 END)
ORDER BY m.created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetPhasePosts :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as comment_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.phase_id = $1
  AND m.message_type = 'post'
  AND m.is_deleted = false
ORDER BY m.created_at DESC;

-- name: UpdatePost :one
WITH updated AS (
  UPDATE messages
  SET content = $2,
      is_edited = true,
      edited_at = NOW(),
      edit_count = edit_count + 1
  WHERE messages.id = $1
    AND messages.is_deleted = false
    AND messages.message_type = 'post'
  RETURNING *
)
SELECT
  m.*,
  u.username as author_username,
  c.name as character_name,
  c.avatar_url as character_avatar_url,
  (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as comment_count
FROM updated m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id;

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
    visibility,
    mentioned_character_ids
) VALUES (
    $1, $2, $3, $4, $5, 'comment', $6, $7, $8
)
RETURNING *;

-- name: GetComment :one
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1;

-- name: GetPostComments :many
-- Get direct comments for a specific post
-- For threaded display, call this recursively on the frontend
-- Sorted newest first (DESC) for better UX - users see latest comments at top
-- INCLUDES deleted comments to preserve thread structure - UI will show "[Comment deleted]" placeholder
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.parent_id = $1
  AND m.message_type = 'comment'
ORDER BY m.created_at DESC;

-- NOTE: GetCommentThread with recursive CTE is not supported by sqlc
-- Use GetPostComments recursively on the frontend to build the tree
-- This is actually more efficient for large thread trees anyway
--
-- UPDATE: GetPostCommentsWithThreads uses raw SQL in service layer
-- sqlc does not support recursive CTEs, so we implement this query directly in Go
-- See: backend/pkg/db/services/messages/comments.go

-- name: CountTopLevelComments :one
-- Count total top-level comments for a post (for pagination)
-- INCLUDES deleted comments to preserve thread structure
SELECT COUNT(*) as total
FROM messages
WHERE parent_id = $1
  AND message_type = 'comment';

-- name: UpdateComment :one
UPDATE messages
SET content = $2,
    character_id = COALESCE($3, character_id),
    mentioned_character_ids = $4,
    is_edited = true,
    edited_at = NOW(),
    edit_count = edit_count + 1
WHERE id = $1
  AND deleted_at IS NULL
  AND message_type = 'comment'
RETURNING *;

-- name: DeleteComment :exec
UPDATE messages
SET deleted_at = NOW(),
    deleted_by_user_id = $2,
    is_deleted = true
WHERE id = $1
  AND deleted_at IS NULL
  AND message_type = 'comment';

-- name: CheckCommentOwnership :one
SELECT author_id, deleted_at
FROM messages
WHERE id = $1 AND message_type = 'comment';

-- name: CheckPostOwnership :one
SELECT author_id, deleted_at
FROM messages
WHERE id = $1 AND message_type = 'post';

-- ============================================================================
-- STATISTICS & COUNTS
-- ============================================================================

-- name: GetGamePostCount :one
SELECT COUNT(*)
FROM messages
WHERE game_id = $1
  AND message_type = 'post'
  AND is_deleted = false
  AND (CASE WHEN $2 = 0 THEN TRUE ELSE phase_id = $2 END);

-- name: GetPostCommentCount :one
SELECT COUNT(*)
FROM messages
WHERE parent_id = $1
  AND is_deleted = false;

-- name: GetAllDescendantComments :many
-- Get all descendant comments recursively for counting
-- Includes deleted comments to preserve thread structure counts
WITH RECURSIVE comment_tree AS (
  SELECT messages.id as comment_id
  FROM messages
  WHERE messages.parent_id = $1

  UNION ALL

  SELECT m.id as comment_id
  FROM messages m
  INNER JOIN comment_tree ct ON m.parent_id = ct.comment_id
)
SELECT comment_id as id FROM comment_tree;

-- name: GetUserPostsInGame :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id) as comment_count
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

-- ============================================================================
-- READ TRACKING (Common Room)
-- ============================================================================

-- name: MarkPostRead :one
-- Mark a post (and optionally a specific comment) as read by a user
-- This is an upsert - creates new record or updates existing one
INSERT INTO user_common_room_reads (
    user_id,
    game_id,
    post_id,
    last_read_comment_id,
    last_read_at,
    updated_at
) VALUES (
    $1, $2, $3, $4, NOW(), NOW()
)
ON CONFLICT (user_id, post_id)
DO UPDATE SET
    last_read_comment_id = EXCLUDED.last_read_comment_id,
    last_read_at = NOW(),
    updated_at = NOW()
RETURNING *;

-- name: GetUserReadMarker :one
-- Get the read tracking info for a specific user and post
SELECT * FROM user_common_room_reads
WHERE user_id = $1 AND post_id = $2;

-- name: GetUserReadMarkersForGame :many
-- Get all read markers for a user in a specific game
-- Used to batch-check which posts have unread content
SELECT * FROM user_common_room_reads
WHERE user_id = $1 AND game_id = $2
ORDER BY last_read_at DESC;

-- name: GetPostsWithUnreadCount :many
-- Get posts with their total comment count and last comment timestamp
-- Frontend will compare these with read markers to determine unread status
SELECT
    m.id as post_id,
    m.created_at as post_created_at,
    COUNT(c.id) as total_comments,
    MAX(c.created_at) as latest_comment_at
FROM messages m
LEFT JOIN messages c ON c.parent_id = m.id AND c.is_deleted = false
WHERE m.game_id = $1
  AND m.message_type = 'post'
  AND m.is_deleted = false
GROUP BY m.id, m.created_at
ORDER BY m.created_at DESC;

-- name: DeleteReadMarkersForPost :exec
-- Delete all read markers for a post (e.g., when post is deleted)
DELETE FROM user_common_room_reads
WHERE post_id = $1;

-- name: DeleteReadMarkersForGame :exec
-- Delete all read markers for a game (e.g., when game is deleted or completed)
DELETE FROM user_common_room_reads
WHERE game_id = $1;

-- name: DeleteReadMarkersForUser :exec
-- Delete all read markers for a user (e.g., when user account is deleted)
DELETE FROM user_common_room_reads
WHERE user_id = $1;

-- name: GetUnreadCommentIDsForPosts :many
-- Get unread comment IDs for each post in a game for a specific user
-- Returns post_id and array of comment IDs that are "new since last visit"
-- A comment is new if:
--   1. It was created AFTER the user's last_read_at timestamp
--   2. It was NOT authored by the current user (users don't see their own comments as NEW)
-- NOTE: If user has never visited (ucr.last_read_at IS NULL), returns empty array
-- This prevents overwhelming users with "NEW" badges on their first visit
WITH RECURSIVE comment_threads AS (
    -- Base case: all top-level comments (direct children of posts)
    SELECT
        c.id as comment_id,
        c.parent_id as post_id,
        c.created_at,
        c.author_id
    FROM messages c
    WHERE c.parent_id IN (
        SELECT id FROM messages
        WHERE game_id = $2 AND message_type = 'post' AND is_deleted = false
    )
    AND c.is_deleted = false

    UNION ALL

    -- Recursive case: all nested replies
    SELECT
        m.id as comment_id,
        ct.post_id,
        m.created_at,
        m.author_id
    FROM messages m
    INNER JOIN comment_threads ct ON m.parent_id = ct.comment_id
    WHERE m.is_deleted = false
)
SELECT
    posts.id as post_id,
    COALESCE(
        array_agg(ct.comment_id ORDER BY ct.created_at DESC) FILTER (
            WHERE ucr.last_read_at IS NOT NULL
            AND ct.created_at > ucr.last_read_at
        ),
        '{}'::integer[]
    ) as unread_comment_ids
FROM messages posts
LEFT JOIN user_common_room_reads ucr ON ucr.post_id = posts.id AND ucr.user_id = $1
LEFT JOIN comment_threads ct ON ct.post_id = posts.id AND ct.author_id != $1
WHERE posts.game_id = $2
  AND posts.message_type = 'post'
  AND posts.is_deleted = false
GROUP BY posts.id
ORDER BY posts.created_at DESC;

-- ============================================================================
-- AUDIENCE PARTICIPATION (Private Message Access)
-- ============================================================================

-- name: ListAllPrivateConversations :many
-- List all private message conversations in a game (for audience/GM)
-- Returns all conversations with metadata, participant information, and last message preview
WITH conversation_messages AS (
  SELECT
    c.id as conversation_id,
    c.title,
    c.conversation_type,
    c.created_at,
    COUNT(pm.id) as message_count,
    MAX(pm.created_at) as latest_message_at
  FROM conversations c
  LEFT JOIN private_messages pm ON c.id = pm.conversation_id
  WHERE c.game_id = $1
  GROUP BY c.id, c.title, c.conversation_type, c.created_at
),
participants_agg AS (
  SELECT
    cp.conversation_id,
    array_agg(COALESCE(ch.name, u.username) ORDER BY cp.id) as participant_names,
    array_agg(u.username ORDER BY cp.id) as participant_usernames
  FROM conversation_participants cp
  JOIN users u ON cp.user_id = u.id
  LEFT JOIN characters ch ON cp.character_id = ch.id
  GROUP BY cp.conversation_id
),
last_messages AS (
  -- Get the most recent message for each conversation with sender info
  SELECT DISTINCT ON (pm.conversation_id)
    pm.conversation_id,
    LEFT(pm.content, 150) as last_message_content,
    COALESCE(c.name, u.username) as last_sender_name,
    u.username as last_sender_username,
    c.avatar_url as last_sender_avatar_url
  FROM private_messages pm
  JOIN users u ON pm.sender_user_id = u.id
  LEFT JOIN characters c ON pm.sender_character_id = c.id
  WHERE pm.conversation_id IN (
    SELECT id FROM conversations WHERE game_id = $1
  )
  ORDER BY pm.conversation_id, pm.created_at DESC
)
SELECT
  cm.conversation_id,
  cm.title as subject,
  cm.conversation_type,
  cm.created_at,
  cm.message_count,
  cm.latest_message_at as last_message_at,
  pa.participant_names,
  pa.participant_usernames,
  lm.last_message_content,
  lm.last_sender_name,
  lm.last_sender_username,
  lm.last_sender_avatar_url
FROM conversation_messages cm
LEFT JOIN participants_agg pa ON cm.conversation_id = pa.conversation_id
LEFT JOIN last_messages lm ON cm.conversation_id = lm.conversation_id
ORDER BY cm.latest_message_at DESC NULLS LAST;

-- name: GetAudienceConversationMessages :many
-- Get all messages in a specific conversation (for audience/GM)
SELECT pm.*,
       u.username as sender_username,
       c.name as sender_character_name,
       c.avatar_url as sender_avatar_url
FROM private_messages pm
JOIN users u ON pm.sender_user_id = u.id
LEFT JOIN characters c ON pm.sender_character_id = c.id
WHERE pm.conversation_id = $1
ORDER BY pm.created_at ASC;

-- name: CountMessagesByCharacter :one
-- Count messages (posts and comments) by a specific character
-- Used to check if character can be deleted
SELECT COUNT(*)
FROM messages
WHERE character_id = $1
  AND is_deleted = false;
