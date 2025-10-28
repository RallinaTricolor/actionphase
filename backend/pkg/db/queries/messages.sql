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
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as comment_count
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
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1
  AND m.is_deleted = false;

-- name: GetGamePosts :many
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as comment_count
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
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.id = $1;

-- name: GetPostComments :many
-- Get direct comments for a specific post
-- For threaded display, call this recursively on the frontend
-- Sorted newest first (DESC) for better UX - users see latest comments at top
SELECT m.*,
       u.username as author_username,
       c.name as character_name,
       c.avatar_url as character_avatar_url,
       (SELECT COUNT(*) FROM messages WHERE parent_id = m.id AND is_deleted = false) as reply_count
FROM messages m
JOIN users u ON m.author_id = u.id
LEFT JOIN characters c ON m.character_id = c.id
WHERE m.parent_id = $1
  AND m.message_type = 'comment'
  AND m.is_deleted = false
ORDER BY m.created_at DESC;

-- NOTE: GetCommentThread with recursive CTE is not supported by sqlc
-- Use GetPostComments recursively on the frontend to build the tree
-- This is actually more efficient for large thread trees anyway

-- name: UpdateComment :one
UPDATE messages
SET content = $2,
    mentioned_character_ids = $3,
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
       c.avatar_url as character_avatar_url,
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
-- A comment is new if it was created after the user's last_read_at timestamp
SELECT
    m.id as post_id,
    COALESCE(
        array_agg(c.id ORDER BY c.created_at DESC) FILTER (
            WHERE ucr.last_read_at IS NULL OR c.created_at > ucr.last_read_at
        ),
        '{}'::integer[]
    ) as unread_comment_ids
FROM messages m
LEFT JOIN user_common_room_reads ucr ON ucr.post_id = m.id AND ucr.user_id = $1
LEFT JOIN messages c ON c.parent_id = m.id AND c.is_deleted = false
WHERE m.game_id = $2
  AND m.message_type = 'post'
  AND m.is_deleted = false
GROUP BY m.id, ucr.last_read_at
ORDER BY m.created_at DESC;

-- ============================================================================
-- AUDIENCE PARTICIPATION (Private Message Access)
-- ============================================================================

-- name: ListAllPrivateConversations :many
-- List all private message conversations in a game (for audience/GM)
-- Returns all conversations with metadata and participant information
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
)
SELECT
  cm.conversation_id,
  cm.title as subject,
  cm.conversation_type,
  cm.created_at,
  cm.message_count,
  cm.latest_message_at as last_message_at,
  pa.participant_names,
  pa.participant_usernames
FROM conversation_messages cm
LEFT JOIN participants_agg pa ON cm.conversation_id = pa.conversation_id
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
