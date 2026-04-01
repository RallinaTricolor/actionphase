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

-- name: GetAllGameDeadlines :many
-- Aggregate ALL deadlines for a game: arbitrary, phase, and poll deadlines
SELECT
    'deadline' as deadline_type,
    gd.id as source_id,
    gd.title as title,
    gd.description as description,
    gd.deadline as deadline,
    gd.game_id,
    NULL::INTEGER as phase_id,
    NULL::INTEGER as poll_id,
    false as is_system_deadline
FROM game_deadlines gd
WHERE gd.game_id = $1
  AND gd.deleted_at IS NULL
  AND ($2 = true OR gd.deadline > NOW())

UNION ALL

SELECT
    'phase' as deadline_type,
    gp.id as source_id,
    gp.title as title,
    CONCAT(gp.phase_type, ' Phase ', gp.phase_number) as description,
    gp.deadline as deadline,
    gp.game_id,
    gp.id as phase_id,
    NULL::INTEGER as poll_id,
    true as is_system_deadline
FROM game_phases gp
WHERE gp.game_id = $1
  AND gp.is_active = true
  AND gp.deadline IS NOT NULL
  AND ($2 = true OR gp.deadline > NOW())

UNION ALL

SELECT
    'poll' as deadline_type,
    crp.id as source_id,
    crp.question as title,
    COALESCE(crp.description, 'Poll voting deadline') as description,
    crp.deadline as deadline,
    crp.game_id,
    crp.phase_id,
    crp.id as poll_id,
    false as is_system_deadline
FROM common_room_polls crp
WHERE crp.game_id = $1
  AND crp.is_deleted = false
  AND crp.deadline IS NOT NULL
  AND ($2 = true OR crp.deadline > NOW())

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
