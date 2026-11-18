-- =============================================================================
-- ACCESS SCOPE QUERIES
-- =============================================================================
-- The owner of each kind of row, for the access middleware (pkg/access). A
-- route under /games/{gameID} that also names a row by ID is refused unless
-- that row is in {gameID}. A row nested under another ID in the path
-- (/posts/{postId}/comments/{commentId}) answers its PARENT instead, and must
-- match the ID before it; the parent carries the game check.
-- Soft-deleted rows still answer: whether a deleted row may be acted on is the
-- handler's call, not this check's.
-- =============================================================================

-- name: GameIDOfApplication :one
SELECT game_id FROM game_applications WHERE id = $1;

-- name: GameIDOfCharacter :one
SELECT game_id FROM characters WHERE id = $1;

-- name: GameIDOfMessage :one
-- Common Room posts and comments.
SELECT game_id FROM messages WHERE id = $1;

-- name: GameIDOfHandout :one
SELECT game_id FROM handouts WHERE id = $1;

-- name: HandoutOfHandoutComment :one
SELECT handout_id FROM handout_comments WHERE id = $1;

-- name: RootPostOfComment :one
-- The top-level post at the head of a comment's thread. A post is not a
-- comment, so naming one answers no row.
WITH RECURSIVE chain AS (
    SELECT m.id, m.parent_id FROM messages m
    WHERE m.id = $1 AND m.message_type = 'comment'
    UNION ALL
    SELECT m.id, m.parent_id FROM messages m
    JOIN chain c ON m.id = c.parent_id
)
SELECT chain.id FROM chain WHERE chain.parent_id IS NULL;

-- name: GameIDOfConversation :one
SELECT game_id FROM conversations WHERE id = $1;

-- name: ConversationOfPrivateMessage :one
SELECT conversation_id FROM private_messages WHERE id = $1;

-- name: GameIDOfPhase :one
SELECT game_id FROM game_phases WHERE id = $1;

-- name: GameIDOfActionResult :one
SELECT game_id FROM action_results WHERE id = $1;

-- name: ActionResultOfCharacterUpdate :one
SELECT action_result_id FROM action_result_character_updates WHERE id = $1;

-- name: GameIDOfLootTable :one
SELECT game_id FROM game_loot_tables WHERE id = $1;
