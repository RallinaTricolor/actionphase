-- name: GetSession :one
SELECT * FROM sessions
WHERE id = $1 LIMIT 1;

-- name: GetSessionByToken :one
SELECT * FROM sessions
WHERE data = $1 LIMIT 1;

-- name: GetSessionsByUser :many
SELECT * FROM sessions
WHERE user_id = $1;

-- name: CreateSession :one
INSERT INTO sessions (
    user_id, data, expires
) VALUES (
             $1, $2, $3
         )
RETURNING *;

-- name: DeleteSession :exec
DELETE FROM sessions
WHERE id = $1;

-- name: DeleteSessionByToken :exec
DELETE FROM sessions
WHERE data = $1;
