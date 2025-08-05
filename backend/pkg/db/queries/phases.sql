-- name: CreateGamePhase :one
INSERT INTO game_phases (game_id, phase_type, phase_number, start_time, end_time, deadline)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetActivePhase :one
SELECT * FROM game_phases
WHERE game_id = $1 AND is_active = true;

-- name: GetGamePhases :many
SELECT * FROM game_phases
WHERE game_id = $1
ORDER BY phase_number;

-- name: GetPhase :one
SELECT * FROM game_phases WHERE id = $1;

-- name: ActivatePhase :one
UPDATE game_phases
SET is_active = true
WHERE id = $1
RETURNING *;

-- name: DeactivatePhase :one
UPDATE game_phases
SET is_active = false, end_time = NOW()
WHERE id = $1
RETURNING *;

-- name: DeactivateAllGamePhases :exec
UPDATE game_phases
SET is_active = false
WHERE game_id = $1;

-- name: UpdatePhaseDeadline :one
UPDATE game_phases
SET deadline = $2
WHERE id = $1
RETURNING *;

-- name: GetLatestPhaseNumber :one
SELECT COALESCE(MAX(phase_number), 0)
FROM game_phases
WHERE game_id = $1;

-- name: SubmitAction :one
INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (game_id, user_id, phase_id)
DO UPDATE SET content = $5, character_id = $4, updated_at = NOW()
RETURNING *;

-- name: GetUserAction :one
SELECT * FROM action_submissions
WHERE game_id = $1 AND user_id = $2 AND phase_id = $3;

-- name: GetUserActions :many
SELECT acts.*, gp.phase_type, gp.phase_number
FROM action_submissions acts
JOIN game_phases gp ON acts.phase_id = gp.id
WHERE acts.game_id = $1 AND acts.user_id = $2
ORDER BY gp.phase_number DESC;

-- name: GetPhaseActions :many
SELECT acts.*, u.username, c.name as character_name
FROM action_submissions acts
JOIN users u ON acts.user_id = u.id
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.phase_id = $1
ORDER BY acts.submitted_at;

-- name: GetGameActions :many
SELECT acts.*, u.username, c.name as character_name, gp.phase_type, gp.phase_number
FROM action_submissions acts
JOIN users u ON acts.user_id = u.id
JOIN game_phases gp ON acts.phase_id = gp.id
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.game_id = $1
ORDER BY gp.phase_number, acts.submitted_at;

-- name: DeleteAction :exec
DELETE FROM action_submissions
WHERE game_id = $1 AND user_id = $2 AND phase_id = $3;

-- name: SendActionResult :one
INSERT INTO action_results (game_id, user_id, phase_id, gm_user_id, content)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetUserResults :many
SELECT results.*, gp.phase_type, gp.phase_number, u.username as gm_username
FROM action_results results
JOIN game_phases gp ON results.phase_id = gp.id
JOIN users u ON results.gm_user_id = u.id
WHERE results.game_id = $1 AND results.user_id = $2
ORDER BY gp.phase_number DESC;

-- name: GetPhaseResults :many
SELECT results.*, u.username, gm.username as gm_username
FROM action_results results
JOIN users u ON results.user_id = u.id
JOIN users gm ON results.gm_user_id = gm.id
WHERE results.phase_id = $1
ORDER BY results.sent_at;

-- name: GetGameResults :many
SELECT results.*, u.username, gm.username as gm_username, gp.phase_type, gp.phase_number
FROM action_results results
JOIN users u ON results.user_id = u.id
JOIN users gm ON results.gm_user_id = gm.id
JOIN game_phases gp ON results.phase_id = gp.id
WHERE results.game_id = $1
ORDER BY gp.phase_number, results.sent_at;
