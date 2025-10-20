-- name: GetUserConversationRead :one
-- Get the read tracking information for a specific user and conversation
SELECT *
FROM conversation_reads
WHERE user_id = $1 AND conversation_id = $2;

-- name: UpsertConversationRead :one
-- Update or insert read tracking for a conversation
-- Uses the message's created_at timestamp to accurately track read position
INSERT INTO conversation_reads (user_id, conversation_id, last_read_message_id, last_read_at)
VALUES (
  $1,
  $2,
  $3,
  COALESCE(
    (SELECT created_at FROM private_messages WHERE id = $3),
    NOW()
  )
)
ON CONFLICT (user_id, conversation_id)
DO UPDATE SET
  last_read_message_id = EXCLUDED.last_read_message_id,
  last_read_at = COALESCE(
    (SELECT created_at FROM private_messages WHERE id = EXCLUDED.last_read_message_id),
    NOW()
  ),
  updated_at = NOW()
RETURNING *;

-- name: GetConversationUnreadCount :one
-- Count unread messages in a conversation for a user
SELECT COUNT(*) as unread_count
FROM private_messages pm
WHERE
  pm.conversation_id = $1
  AND pm.created_at > COALESCE(
    (SELECT last_read_at FROM conversation_reads WHERE user_id = $2 AND conversation_id = $1),
    '1970-01-01'::timestamptz
  );

-- name: GetFirstUnreadMessageID :one
-- Get the ID of the first unread message in a conversation for a user
SELECT pm.id
FROM private_messages pm
WHERE
  pm.conversation_id = $1
  AND pm.created_at > COALESCE(
    (SELECT last_read_at FROM conversation_reads WHERE user_id = $2 AND conversation_id = $1),
    '1970-01-01'::timestamptz
  )
ORDER BY pm.created_at ASC, pm.id ASC
LIMIT 1;
