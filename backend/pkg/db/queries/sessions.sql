-- name: GetSession :one
SELECT * FROM sessions
WHERE id = $1 LIMIT 1;

-- name: GetSessionsByUser :many
SELECT * FROM sessions
WHERE user_id = $1;


-- name: CreateSession :one
INSERT INTO sessions (
    user_id, data
) VALUES (
             $1, $2
         )
RETURNING *;

-- name: DeleteSession :exec
DELETE FROM sessions
WHERE id = $1;
