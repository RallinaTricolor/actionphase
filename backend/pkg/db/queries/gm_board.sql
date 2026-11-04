-- GM results board items (per action phase) and GM settings items (per game).
-- Both tables share gm_board_seq. Every write runs under the board's advisory
-- lock (LockGmBoard / LockGmSettings), so within one board seq order is commit
-- order and a "since" poll never skips a row. See the migration for the model.

-- name: LockGmBoard :exec
-- Serializes writes to one phase's board for the rest of the transaction.
-- Class 1 = board (keyed by phase), class 2 = settings (keyed by game).
SELECT pg_advisory_xact_lock(1, sqlc.arg(phase_id)::int);

-- name: LockGmSettings :exec
SELECT pg_advisory_xact_lock(2, sqlc.arg(game_id)::int);

-- name: ListGmBoardItems :many
-- Live items only: a full load has no use for tombstones.
SELECT * FROM gm_board_items
WHERE phase_id = $1 AND deleted = false
ORDER BY seq;

-- name: ListGmBoardItemsSince :many
-- Tombstones included, so a poller learns about deletions.
SELECT * FROM gm_board_items
WHERE phase_id = $1 AND seq > $2
ORDER BY seq;

-- name: GetGmBoardCursor :one
-- The highest seq on the board, tombstones included: the cursor a client
-- polls from next.
SELECT COALESCE(MAX(seq), 0)::bigint FROM gm_board_items WHERE phase_id = $1;

-- name: GetGmBoardItemsByKeys :many
-- The current rows for a batch's (kind, item_key) pairs, tombstones included.
-- The two arrays are zipped: set-returning functions in one select list run in step.
SELECT i.* FROM gm_board_items i
WHERE i.phase_id = sqlc.arg(phase_id)
  AND (i.kind, i.item_key) IN (
    SELECT UNNEST(sqlc.arg(kinds)::text[]), UNNEST(sqlc.arg(item_keys)::text[]));

-- name: UpsertGmBoardItem :one
-- The version check happens in the service, under LockGmBoard, before this runs.
INSERT INTO gm_board_items (phase_id, kind, item_key, game_id, doc, version, deleted, updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (phase_id, kind, item_key) DO UPDATE
SET doc = EXCLUDED.doc,
    version = EXCLUDED.version,
    deleted = EXCLUDED.deleted,
    seq = nextval('gm_board_seq'),
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by
RETURNING *;

-- name: CountLiveGmBoardItems :one
SELECT COUNT(*)::int FROM gm_board_items WHERE phase_id = $1 AND deleted = false;

-- name: ListGmSettingsItems :many
SELECT * FROM gm_settings_items
WHERE game_id = $1 AND deleted = false
ORDER BY seq;

-- name: ListGmSettingsItemsSince :many
SELECT * FROM gm_settings_items
WHERE game_id = $1 AND seq > $2
ORDER BY seq;

-- name: GetGmSettingsCursor :one
SELECT COALESCE(MAX(seq), 0)::bigint FROM gm_settings_items WHERE game_id = $1;

-- name: GetGmSettingsItemsByKeys :many
-- The two arrays are zipped: set-returning functions in one select list run in step.
SELECT i.* FROM gm_settings_items i
WHERE i.game_id = sqlc.arg(game_id)
  AND (i.kind, i.item_key) IN (
    SELECT UNNEST(sqlc.arg(kinds)::text[]), UNNEST(sqlc.arg(item_keys)::text[]));

-- name: UpsertGmSettingsItem :one
INSERT INTO gm_settings_items (game_id, kind, item_key, doc, version, deleted, updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (game_id, kind, item_key) DO UPDATE
SET doc = EXCLUDED.doc,
    version = EXCLUDED.version,
    deleted = EXCLUDED.deleted,
    seq = nextval('gm_board_seq'),
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by
RETURNING *;

-- name: CountLiveGmSettingsItems :one
SELECT COUNT(*)::int FROM gm_settings_items WHERE game_id = $1 AND deleted = false;

-- name: SetGameShareGmBoard :one
-- soft-delete: scoped to one game its route already resolved through GetGame; the filter is kept anyway.
UPDATE games SET share_gm_board = $2
WHERE id = $1 AND deleted_at IS NULL
RETURNING share_gm_board;

-- name: ListGmBoardPhaseIDs :many
-- The game's action phases whose board has at least one live item, in phase
-- order. Goes through game_phases so the lookup uses gm_board_items' primary
-- key (phase_id first); the table has no game_id index.
SELECT p.id FROM game_phases p
WHERE p.game_id = $1
  AND p.phase_type = 'action'
  AND EXISTS (SELECT 1 FROM gm_board_items i WHERE i.phase_id = p.id AND i.deleted = false)
ORDER BY p.phase_number;
