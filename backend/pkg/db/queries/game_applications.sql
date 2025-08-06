-- name: CreateGameApplication :one
INSERT INTO game_applications (
    game_id, user_id, role, message
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetGameApplication :one
SELECT * FROM game_applications WHERE id = $1;

-- name: GetGameApplicationByUserAndGame :one
SELECT * FROM game_applications
WHERE game_id = $1 AND user_id = $2;

-- name: GetGameApplications :many
SELECT
    ga.*,
    u.username,
    u.email
FROM game_applications ga
JOIN users u ON ga.user_id = u.id
WHERE ga.game_id = $1
ORDER BY ga.applied_at ASC;

-- name: GetGameApplicationsByStatus :many
SELECT
    ga.*,
    u.username,
    u.email
FROM game_applications ga
JOIN users u ON ga.user_id = u.id
WHERE ga.game_id = $1 AND ga.status = $2
ORDER BY ga.applied_at ASC;

-- name: GetUserGameApplications :many
SELECT
    ga.*,
    g.title AS game_title,
    g.state AS game_state
FROM game_applications ga
JOIN games g ON ga.game_id = g.id
WHERE ga.user_id = $1
ORDER BY ga.applied_at DESC;

-- name: UpdateGameApplicationStatus :one
UPDATE game_applications
SET
    status = $2,
    reviewed_at = NOW(),
    reviewed_by_user_id = $3
WHERE id = $1
RETURNING *;

-- name: WithdrawGameApplication :exec
UPDATE game_applications
SET
    status = 'withdrawn',
    reviewed_at = NOW()
WHERE id = $1 AND user_id = $2;

-- name: DeleteGameApplication :exec
DELETE FROM game_applications WHERE id = $1 AND user_id = $2;

-- name: CountPendingApplicationsForGame :one
SELECT COUNT(*) FROM game_applications
WHERE game_id = $1 AND status = 'pending';

-- name: GetApprovedApplicationsForGame :many
SELECT
    ga.*,
    u.username,
    u.email
FROM game_applications ga
JOIN users u ON ga.user_id = u.id
WHERE ga.game_id = $1 AND ga.status = 'approved'
ORDER BY ga.reviewed_at ASC;

-- name: BulkApproveApplications :exec
UPDATE game_applications
SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by_user_id = $2
WHERE game_id = $1 AND status = 'pending';

-- name: HasUserAppliedToGame :one
SELECT EXISTS(
    SELECT 1 FROM game_applications
    WHERE game_id = $1 AND user_id = $2
);

-- name: CanUserApplyToGame :one
SELECT CASE
    WHEN EXISTS(SELECT 1 FROM game_participants gp WHERE gp.game_id = $1 AND gp.user_id = $2) THEN 'already_participant'
    WHEN EXISTS(SELECT 1 FROM game_applications ga WHERE ga.game_id = $1 AND ga.user_id = $2 AND ga.status = 'pending') THEN 'application_pending'
    WHEN EXISTS(SELECT 1 FROM game_applications ga2 WHERE ga2.game_id = $1 AND ga2.user_id = $2 AND ga2.status = 'rejected') THEN 'application_rejected'
    WHEN EXISTS(SELECT 1 FROM games g WHERE g.id = $1 AND g.state != 'recruitment') THEN 'not_recruiting'
    ELSE 'can_apply'
END AS status;
