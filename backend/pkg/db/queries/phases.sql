-- name: CreateGamePhase :one
INSERT INTO game_phases (game_id, phase_type, phase_number, title, description, start_time, end_time, deadline)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
INSERT INTO action_submissions (game_id, user_id, phase_id, character_id, content, is_draft, submitted_at)
VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN NULL ELSE NOW() END)
ON CONFLICT (game_id, user_id, phase_id)
DO UPDATE SET content = $5, character_id = $4, is_draft = $6,
              submitted_at = CASE WHEN $6 THEN action_submissions.submitted_at ELSE COALESCE(action_submissions.submitted_at, NOW()) END,
              updated_at = NOW()
RETURNING *;

-- name: GetUserAction :one
SELECT acts.*, c.name as character_name
FROM action_submissions acts
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.game_id = $1 AND acts.user_id = $2 AND acts.phase_id = $3;

-- name: GetUserActions :many
SELECT acts.*, gp.phase_type, gp.phase_number, c.name as character_name
FROM action_submissions acts
JOIN game_phases gp ON acts.phase_id = gp.id
LEFT JOIN characters c ON acts.character_id = c.id
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

-- name: CreateActionResult :one
INSERT INTO action_results (game_id, user_id, phase_id, gm_user_id, content, is_published, sent_at)
VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN NOW() ELSE NULL END)
RETURNING *;

-- name: GetUserResults :many
SELECT results.*, gp.phase_type, gp.phase_number, u.username as gm_username
FROM action_results results
JOIN game_phases gp ON results.phase_id = gp.id
JOIN users u ON results.gm_user_id = u.id
WHERE results.game_id = $1 AND results.user_id = $2 AND results.is_published = true
ORDER BY gp.phase_number DESC;

-- name: GetPhaseResults :many
SELECT results.*, u.username, gm.username as gm_username
FROM action_results results
JOIN users u ON results.user_id = u.id
JOIN users gm ON results.gm_user_id = gm.id
WHERE results.phase_id = $1
ORDER BY results.sent_at;

-- name: GetGameResults :many
SELECT results.*, u.username, gp.phase_type, gp.phase_number
FROM action_results results
JOIN users u ON results.user_id = u.id
JOIN game_phases gp ON results.phase_id = gp.id
WHERE results.game_id = $1
ORDER BY gp.phase_number, results.sent_at;

-- Additional queries for comprehensive phase management

-- name: UpdatePhase :one
UPDATE game_phases
SET title = $2, description = $3, start_time = $4, end_time = $5, deadline = $6
WHERE id = $1
RETURNING *;

-- name: DeletePhase :exec
DELETE FROM game_phases WHERE id = $1;

-- name: GetActionSubmission :one
SELECT * FROM action_submissions WHERE id = $1;

-- name: GetUserPhaseSubmission :one
SELECT * FROM action_submissions
WHERE phase_id = $1 AND user_id = $2;

-- name: GetPhaseSubmissions :many
SELECT acts.*, u.username, c.name as character_name
FROM action_submissions acts
JOIN users u ON acts.user_id = u.id
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.phase_id = $1
ORDER BY acts.submitted_at;

-- name: DeleteActionSubmission :exec
DELETE FROM action_submissions
WHERE id = $1 AND user_id = $2;

-- name: GetActionResult :one
SELECT * FROM action_results WHERE id = $1;

-- name: GetUserPhaseResults :many
SELECT * FROM action_results
WHERE phase_id = $1 AND user_id = $2
ORDER BY sent_at;

-- name: PublishActionResult :one
UPDATE action_results
SET is_published = true, sent_at = NOW()
WHERE id = $1
RETURNING *;

-- name: PublishAllPhaseResults :exec
UPDATE action_results
SET is_published = true, sent_at = COALESCE(sent_at, NOW())
WHERE phase_id = $1 AND is_published = false;

-- name: GetUnpublishedResultsCount :one
SELECT COUNT(*) as count
FROM action_results
WHERE phase_id = $1 AND is_published = false;

-- name: GetUnpublishedResultIDs :many
SELECT id
FROM action_results
WHERE phase_id = $1 AND is_published = false;

-- name: UpdateActionResult :one
UPDATE action_results
SET content = $2
WHERE id = $1 AND is_published = false
RETURNING *;

-- name: GetSubmissionStatsForPhase :one
SELECT
    $1::int as phase_id,
    COUNT(DISTINCT gp.user_id) as total_players,
    COUNT(DISTINCT CASE WHEN acts.id IS NOT NULL AND NOT acts.is_draft THEN acts.user_id END) as submitted_count,
    COUNT(DISTINCT CASE WHEN acts.is_draft THEN acts.user_id END) as draft_count,
    COALESCE(
        ROUND(
            (COUNT(DISTINCT CASE WHEN acts.id IS NOT NULL AND NOT acts.is_draft THEN acts.user_id END) * 100.0) /
            NULLIF(COUNT(DISTINCT gp.user_id), 0),
            2
        ),
        0
    ) as submission_rate,
    MAX(acts.submitted_at) as latest_submission
FROM game_participants gp
JOIN game_phases ph ON gp.game_id = ph.game_id
LEFT JOIN action_submissions acts ON gp.user_id = acts.user_id AND acts.phase_id = ph.id
WHERE ph.id = $1 AND gp.role = 'player';

-- name: CanUserSubmitToPhase :one
SELECT
    CASE
        WHEN ph.phase_type != 'action' THEN false
        WHEN ph.deadline IS NOT NULL AND ph.deadline < NOW() THEN false
        WHEN NOT ph.is_active THEN false
        WHEN gp.role != 'player' THEN false
        ELSE true
    END as can_submit
FROM game_phases ph
JOIN games g ON ph.game_id = g.id
JOIN game_participants gp ON g.id = gp.game_id
WHERE ph.id = $1 AND gp.user_id = $2;

-- Phase transition queries

-- name: CreatePhaseTransition :one
INSERT INTO phase_transitions (game_id, from_phase_id, to_phase_id, initiated_by, reason)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetPhaseTransitions :many
SELECT pt.*,
       from_phase.phase_type as from_phase_type, from_phase.phase_number as from_phase_number,
       to_phase.phase_type as to_phase_type, to_phase.phase_number as to_phase_number,
       u.username as initiated_by_username
FROM phase_transitions pt
LEFT JOIN game_phases from_phase ON pt.from_phase_id = from_phase.id
JOIN game_phases to_phase ON pt.to_phase_id = to_phase.id
JOIN users u ON pt.initiated_by = u.id
WHERE pt.game_id = $1
ORDER BY pt.created_at;

-- Audience Participation Queries (Action Viewing)

-- name: ListAllActionSubmissions :many
-- List all action submissions for a game (for audience/GM)
-- Includes character name and submission status
SELECT acts.*, u.username, c.name as character_name, gp.phase_type, gp.phase_number, gp.title as phase_title
FROM action_submissions acts
JOIN users u ON acts.user_id = u.id
JOIN game_phases gp ON acts.phase_id = gp.id
LEFT JOIN characters c ON acts.character_id = c.id
WHERE acts.game_id = sqlc.arg(game_id)
  AND (CASE WHEN sqlc.arg(phase_id) = 0 THEN TRUE ELSE acts.phase_id = sqlc.arg(phase_id) END)
ORDER BY gp.phase_number DESC, acts.submitted_at DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountAllActionSubmissions :one
-- Count total action submissions for a game/phase (for pagination)
SELECT COUNT(*)
FROM action_submissions acts
WHERE acts.game_id = sqlc.arg(game_id)
  AND (CASE WHEN sqlc.arg(phase_id) = 0 THEN TRUE ELSE acts.phase_id = sqlc.arg(phase_id) END);

-- name: CountActionSubmissionsByCharacter :one
-- Count action submissions for a specific character
-- Used to check if character can be deleted
SELECT COUNT(*)
FROM action_submissions
WHERE character_id = $1;
