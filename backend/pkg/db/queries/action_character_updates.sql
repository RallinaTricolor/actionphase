-- name: CreateDraftCharacterUpdate :one
-- Create or update a draft character update (upsert behavior on conflict)
INSERT INTO action_result_character_updates (
    action_result_id,
    character_id,
    module_type,
    field_name,
    field_value,
    field_type,
    operation
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (action_result_id, character_id, module_type, field_name)
DO UPDATE SET
    field_value = EXCLUDED.field_value,
    field_type = EXCLUDED.field_type,
    operation = EXCLUDED.operation,
    updated_at = NOW()
RETURNING *;

-- name: GetDraftCharacterUpdates :many
-- Get all draft character updates for an action result
SELECT * FROM action_result_character_updates
WHERE action_result_id = $1
ORDER BY module_type, field_name;

-- name: GetDraftCharacterUpdate :one
-- Get a single draft character update by ID
SELECT * FROM action_result_character_updates
WHERE id = $1;

-- name: UpdateDraftCharacterUpdate :one
-- Update the field value of an existing draft
UPDATE action_result_character_updates
SET
    field_value = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteDraftCharacterUpdate :exec
-- Delete a draft character update by ID
DELETE FROM action_result_character_updates
WHERE id = $1;

-- name: GetDraftUpdateCount :one
-- Count the number of draft updates for an action result
SELECT COUNT(*) FROM action_result_character_updates
WHERE action_result_id = $1;

-- name: PublishDraftCharacterUpdates :exec
-- Copy draft updates to character_data table (only upsert operations)
WITH draft_updates AS (
    SELECT
        character_id,
        module_type,
        field_name,
        field_value,
        field_type
    FROM action_result_character_updates
    WHERE action_result_id = $1 AND operation = 'upsert'
)
INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type)
SELECT character_id, module_type, field_name, field_value, field_type
FROM draft_updates
ON CONFLICT (character_id, module_type, field_name)
DO UPDATE SET
    field_value = EXCLUDED.field_value,
    field_type = EXCLUDED.field_type,
    updated_at = NOW();

-- name: DeletePublishedDrafts :exec
-- Delete all draft updates for an action result (called after publishing)
DELETE FROM action_result_character_updates
WHERE action_result_id = $1;
