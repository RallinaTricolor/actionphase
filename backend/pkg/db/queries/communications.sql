-- name: CreateThread :one
INSERT INTO threads (game_id, phase_id, created_by_user_id, title, content)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetThread :one
SELECT t.*, u.username as creator_username
FROM threads t
JOIN users u ON t.created_by_user_id = u.id
WHERE t.id = $1;

-- name: GetGameThreads :many
SELECT t.*, u.username as creator_username,
       (SELECT COUNT(*) FROM thread_posts WHERE thread_id = t.id) as post_count
FROM threads t
JOIN users u ON t.created_by_user_id = u.id
WHERE t.game_id = $1
ORDER BY t.is_pinned DESC, t.updated_at DESC;

-- name: GetPhaseThreads :many
SELECT t.*, u.username as creator_username,
       (SELECT COUNT(*) FROM thread_posts WHERE thread_id = t.id) as post_count
FROM threads t
JOIN users u ON t.created_by_user_id = u.id
WHERE t.phase_id = $1
ORDER BY t.is_pinned DESC, t.updated_at DESC;

-- name: UpdateThread :one
UPDATE threads
SET title = $2, content = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ToggleThreadPin :one
UPDATE threads
SET is_pinned = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteThread :exec
DELETE FROM threads WHERE id = $1;

-- name: CreateThreadPost :one
INSERT INTO thread_posts (thread_id, parent_post_id, user_id, character_id, content)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetThreadPosts :many
SELECT tp.*, u.username, c.name as character_name
FROM thread_posts tp
JOIN users u ON tp.user_id = u.id
LEFT JOIN characters c ON tp.character_id = c.id
WHERE tp.thread_id = $1
ORDER BY tp.created_at;

-- name: GetThreadPost :one
SELECT tp.*, u.username, c.name as character_name
FROM thread_posts tp
JOIN users u ON tp.user_id = u.id
LEFT JOIN characters c ON tp.character_id = c.id
WHERE tp.id = $1;

-- name: UpdateThreadPost :one
UPDATE thread_posts
SET content = $2, is_edited = true, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteThreadPost :exec
DELETE FROM thread_posts WHERE id = $1;

-- name: UpdateThreadActivity :exec
UPDATE threads
SET updated_at = NOW()
WHERE id = $1;

-- name: CreateConversation :one
INSERT INTO conversations (game_id, conversation_type, title, created_by_user_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetConversation :one
SELECT * FROM conversations WHERE id = $1;

-- name: GetUserConversations :many
SELECT c.*,
       (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) as participant_count,
       COALESCE(lm.last_message, '') as last_message,
       lm.last_message_at,
       (SELECT STRING_AGG(COALESCE(chars.name, users.username), ', ' ORDER BY COALESCE(chars.name, users.username))
        FROM conversation_participants cps
        JOIN users ON cps.user_id = users.id
        LEFT JOIN characters chars ON cps.character_id = chars.id
        WHERE cps.conversation_id = c.id) as participant_names
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversation_id
LEFT JOIN LATERAL (
    SELECT content as last_message, created_at as last_message_at
    FROM private_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
) lm ON true
WHERE cp.user_id = $1 AND c.game_id = $2
ORDER BY c.updated_at DESC;

-- name: AddConversationParticipant :one
INSERT INTO conversation_participants (conversation_id, user_id, character_id)
VALUES ($1, $2, $3)
ON CONFLICT (conversation_id, user_id, character_id) DO NOTHING
RETURNING *;

-- name: GetConversationParticipants :many
SELECT cp.*, u.username, c.name as character_name
FROM conversation_participants cp
JOIN users u ON cp.user_id = u.id
LEFT JOIN characters c ON cp.character_id = c.id
WHERE cp.conversation_id = $1
ORDER BY cp.joined_at;

-- name: RemoveConversationParticipant :exec
DELETE FROM conversation_participants
WHERE conversation_id = $1 AND user_id = $2 AND
      (character_id = $3 OR ($3 IS NULL AND character_id IS NULL));

-- name: IsUserInConversation :one
SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = $1 AND user_id = $2
);

-- name: SendPrivateMessage :one
INSERT INTO private_messages (conversation_id, sender_user_id, sender_character_id, content)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetConversationMessages :many
SELECT pm.*, u.username as sender_username, c.name as sender_character_name
FROM private_messages pm
JOIN users u ON pm.sender_user_id = u.id
LEFT JOIN characters c ON pm.sender_character_id = c.id
WHERE pm.conversation_id = $1
ORDER BY pm.created_at;

-- name: UpdateLastReadTime :exec
UPDATE conversation_participants
SET last_read_at = NOW()
WHERE conversation_id = $1 AND user_id = $2;

-- name: GetUnreadMessageCount :one
SELECT COUNT(*)
FROM private_messages pm
JOIN conversation_participants cp ON pm.conversation_id = cp.conversation_id
WHERE cp.user_id = $1 AND cp.conversation_id = $2
  AND pm.created_at > cp.last_read_at
  AND pm.sender_user_id != $1;

-- name: UpdateConversationActivity :exec
UPDATE conversations
SET updated_at = NOW()
WHERE id = $1;
