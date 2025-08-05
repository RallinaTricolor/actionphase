-- name: CreateGame :one
INSERT INTO games (
    title, description, gm_user_id, genre, start_date, end_date,
    recruitment_deadline, max_players, is_public
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetGame :one
SELECT * FROM games WHERE id = $1;

-- name: GetGamesByGM :many
SELECT * FROM games WHERE gm_user_id = $1 ORDER BY created_at DESC;

-- name: GetPublicGames :many
SELECT g.*, u.username as gm_username
FROM games g
JOIN users u ON g.gm_user_id = u.id
WHERE g.is_public = true
  AND g.state = 'recruitment'
ORDER BY g.created_at DESC;

-- name: GetGamesByUser :many
SELECT g.*, gp.role as user_role, u.username as gm_username
FROM games g
JOIN game_participants gp ON g.id = gp.game_id
JOIN users u ON g.gm_user_id = u.id
WHERE gp.user_id = $1 AND gp.status = 'active'
ORDER BY g.updated_at DESC;

-- name: UpdateGameState :one
UPDATE games
SET state = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateGame :one
UPDATE games
SET title = $2, description = $3, genre = $4, start_date = $5,
    end_date = $6, recruitment_deadline = $7, max_players = $8,
    is_public = $9, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteGame :exec
DELETE FROM games WHERE id = $1;

-- name: GetGameParticipants :many
SELECT gp.*, u.username, u.email
FROM game_participants gp
JOIN users u ON gp.user_id = u.id
WHERE gp.game_id = $1 AND gp.status = 'active'
ORDER BY gp.joined_at;

-- name: AddGameParticipant :one
INSERT INTO game_participants (game_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateParticipantStatus :one
UPDATE game_participants
SET status = $3
WHERE game_id = $1 AND user_id = $2
RETURNING *;

-- name: RemoveGameParticipant :exec
DELETE FROM game_participants
WHERE game_id = $1 AND user_id = $2;

-- name: GetParticipantRole :one
SELECT role FROM game_participants
WHERE game_id = $1 AND user_id = $2 AND status = 'active';

-- name: IsUserInGame :one
SELECT EXISTS(
    SELECT 1 FROM game_participants
    WHERE game_id = $1 AND user_id = $2 AND status = 'active'
);

-- name: GetGameParticipantCount :one
SELECT COUNT(*) FROM game_participants
WHERE game_id = $1 AND role = 'player' AND status = 'active';
