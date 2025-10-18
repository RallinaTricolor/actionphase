-- name: CreateCharacter :one
INSERT INTO characters (game_id, user_id, name, character_type, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetCharacter :one
SELECT * FROM characters WHERE id = $1;

-- name: GetCharactersByGame :many
SELECT c.*, u.username as owner_username
FROM characters c
LEFT JOIN users u ON c.user_id = u.id
WHERE c.game_id = $1
ORDER BY c.character_type, c.name;

-- name: GetCharactersByUser :many
SELECT c.*, g.title as game_title
FROM characters c
JOIN games g ON c.game_id = g.id
WHERE c.user_id = $1
ORDER BY c.created_at DESC;

-- name: GetPlayerCharactersByGame :many
SELECT c.*, u.username as owner_username
FROM characters c
JOIN users u ON c.user_id = u.id
WHERE c.game_id = $1 AND c.character_type = 'player_character'
ORDER BY c.name;

-- name: GetNPCsByGame :many
SELECT c.*, u.username as owner_username, na.assigned_user_id, au.username as assigned_username
FROM characters c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN npc_assignments na ON c.id = na.character_id
LEFT JOIN users au ON na.assigned_user_id = au.id
WHERE c.game_id = $1 AND c.character_type IN ('npc_gm', 'npc_audience')
ORDER BY c.character_type, c.name;

-- name: UpdateCharacter :one
UPDATE characters
SET name = $2, status = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateCharacterStatus :one
UPDATE characters
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteCharacter :exec
DELETE FROM characters WHERE id = $1;

-- name: AssignNPCToUser :one
INSERT INTO npc_assignments (character_id, assigned_user_id, assigned_by_user_id)
VALUES ($1, $2, $3)
ON CONFLICT (character_id)
DO UPDATE SET assigned_user_id = $2, assigned_by_user_id = $3, assigned_at = NOW()
RETURNING *;

-- name: UnassignNPC :exec
DELETE FROM npc_assignments WHERE character_id = $1;

-- name: GetNPCAssignment :one
SELECT * FROM npc_assignments WHERE character_id = $1;

-- name: GetUserNPCs :many
SELECT c.*, g.title as game_title
FROM characters c
JOIN games g ON c.game_id = g.id
JOIN npc_assignments na ON c.id = na.character_id
WHERE na.assigned_user_id = $1
ORDER BY g.title, c.name;

-- name: CreateCharacterData :one
INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, is_public)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (character_id, module_type, field_name)
DO UPDATE SET field_value = $4, field_type = $5, is_public = $6, updated_at = NOW()
RETURNING *;

-- name: GetCharacterData :many
SELECT * FROM character_data
WHERE character_id = $1
ORDER BY module_type, field_name;

-- name: GetCharacterDataByModule :many
SELECT * FROM character_data
WHERE character_id = $1 AND module_type = $2
ORDER BY field_name;

-- name: GetPublicCharacterData :many
SELECT * FROM character_data
WHERE character_id = $1 AND is_public = true
ORDER BY module_type, field_name;

-- name: DeleteCharacterData :exec
DELETE FROM character_data
WHERE character_id = $1 AND module_type = $2 AND field_name = $3;

-- name: DeleteCharacterModule :exec
DELETE FROM character_data
WHERE character_id = $1 AND module_type = $2;

-- name: GetUserControllableCharacters :many
-- Get all characters a user can control in a game:
-- 1. Their own player characters (where user_id matches)
-- 2. NPCs assigned to them via npc_assignments
-- 3. If they're the GM, all NPCs (for emergency situations, GMs can control any NPC)
SELECT DISTINCT c.id, c.game_id, c.user_id, c.name, c.character_type, c.status, c.created_at, c.updated_at
FROM characters c
LEFT JOIN npc_assignments na ON c.id = na.character_id
LEFT JOIN games g ON c.game_id = g.id
WHERE c.game_id = $1
  AND (
    -- User's own player characters
    (c.user_id = $2 AND c.character_type = 'player_character')
    OR
    -- NPCs assigned to user
    (na.assigned_user_id = $2)
    OR
    -- If user is GM, all NPCs (GMs can control any NPC in their game)
    (g.gm_user_id = $2 AND c.character_type IN ('npc_gm', 'npc_audience'))
  )
ORDER BY c.character_type, c.name;

-- name: GetCharacterByNameAndGame :one
-- Look up a character by name within a specific game (for mention parsing)
SELECT * FROM characters
WHERE name = $1 AND game_id = $2
LIMIT 1;
