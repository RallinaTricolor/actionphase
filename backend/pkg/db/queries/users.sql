-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByUsername :one
SELECT * FROM users
WHERE username = $1 LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users
ORDER BY username;

-- name: CreateUser :one
INSERT INTO users (
    username, password, email
) VALUES (
             $1, $2, $3
         )
RETURNING *;

-- name: UpdateUser :exec
UPDATE users
set username = $2,
    password = $3,
    email = $4
WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;

-- Admin management queries

-- name: UpdateUserAdminStatus :exec
UPDATE users
SET is_admin = $2
WHERE id = $1;

-- name: ListAdmins :many
SELECT id, username, email, created_at
FROM users
WHERE is_admin = TRUE
ORDER BY created_at ASC;

-- User banning queries

-- name: BanUser :exec
UPDATE users
SET is_banned = TRUE,
    banned_at = NOW(),
    banned_by_user_id = $2
WHERE id = $1;

-- name: UnbanUser :exec
UPDATE users
SET is_banned = FALSE,
    banned_at = NULL,
    banned_by_user_id = NULL
WHERE id = $1;

-- name: ListBannedUsers :many
SELECT u.id, u.username, u.email, u.banned_at, u.banned_by_user_id, u.created_at,
       admin.username as banned_by_username
FROM users u
LEFT JOIN users admin ON u.banned_by_user_id = admin.id
WHERE u.is_banned = TRUE
ORDER BY u.banned_at DESC;

-- User search queries

-- name: SearchUsers :many
SELECT id, username, email, created_at
FROM users
WHERE username ILIKE '%' || $1 || '%'
  AND is_banned = FALSE
ORDER BY username
LIMIT 20;
