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
    -- A hand edit of a draft the board generated makes it hand-made.
    from_rewards = false,
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
    from_rewards = false,
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

-- name: ListPhaseDraftCharacterUpdates :many
-- Every draft sheet update on a result in this phase, for the results board.
SELECT u.*
FROM action_result_character_updates u
JOIN action_results r ON r.id = u.action_result_id
WHERE r.phase_id = $1
ORDER BY u.character_id, u.action_result_id, u.module_type, u.field_name;

-- name: ListCharacterDraftsOnUnpublishedResults :many
-- A character's draft sheet updates on this phase's unpublished results:
-- the ones a reward sync replaces.
SELECT u.*
FROM action_result_character_updates u
JOIN action_results r ON r.id = u.action_result_id
WHERE r.phase_id = $1
  AND u.character_id = $2
  AND r.is_published = false;

-- name: DeleteCharacterDraftsOnUnpublishedResults :exec
-- Clears a character's draft sheet updates on this phase's unpublished
-- results, before a reward sync writes the new set. Hand-made ones go only
-- when include_hand_made is true.
DELETE FROM action_result_character_updates u
USING action_results r
WHERE r.id = u.action_result_id
  AND r.phase_id = sqlc.arg('phase_id')
  AND u.character_id = sqlc.arg('character_id')
  AND r.is_published = false
  AND (u.from_rewards OR sqlc.arg('include_hand_made')::boolean);

-- name: CreateRewardCharacterUpdate :one
-- A draft sheet update generated from reward lines.
INSERT INTO action_result_character_updates (
    action_result_id, character_id, module_type, field_name,
    field_value, field_type, operation, from_rewards
)
VALUES ($1, $2, $3, $4, $5, 'json', 'upsert', true)
RETURNING *;

-- name: MoveDraftCharacterUpdates :exec
-- Moves a result's draft sheet updates to another result: a chain's drafts
-- follow its last part when a part is added.
UPDATE action_result_character_updates
SET action_result_id = sqlc.arg('to_result_id'), updated_at = NOW()
WHERE action_result_id = sqlc.arg('from_result_id');

-- name: IsChainTail :one
-- Whether no later part follows this result in its chain.
SELECT NOT EXISTS (
    SELECT 1 FROM action_results WHERE parent_result_id = $1
)::boolean AS is_tail;
