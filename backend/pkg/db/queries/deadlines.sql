-- name: CreateDeadline :one
INSERT INTO game_deadlines (game_id, title, description, deadline, created_by_user_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetDeadline :one
SELECT * FROM game_deadlines
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetGameDeadlines :many
SELECT * FROM game_deadlines
WHERE game_id = $1
  AND deleted_at IS NULL
  AND (
    -- Include expired deadlines if requested
    $2 = true OR deadline > NOW()
  )
ORDER BY deadline ASC;

-- name: GetUpcomingDeadlinesForUser :many
-- Get upcoming deadlines across all games user participates in
SELECT
    gd.*,
    g.title as game_title,
    g.id as game_id
FROM game_deadlines gd
JOIN games g ON gd.game_id = g.id
LEFT JOIN game_participants gp ON g.id = gp.game_id AND gp.user_id = $1
WHERE gd.deleted_at IS NULL
  AND gd.deadline > NOW()
  AND (
    g.gm_user_id = $1  -- User is GM
    OR (gp.user_id = $1 AND gp.status = 'active')  -- User is participant
  )
ORDER BY gd.deadline ASC
LIMIT $2;

-- name: UpdateDeadline :one
UPDATE game_deadlines
SET title = $2, description = $3, deadline = $4, updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteDeadline :exec
UPDATE game_deadlines
SET deleted_at = NOW()
WHERE id = $1;

-- name: GetExpiredDeadlines :many
-- For cleanup jobs or notifications
SELECT * FROM game_deadlines
WHERE deleted_at IS NULL
  AND deadline <= NOW()
ORDER BY deadline DESC;
