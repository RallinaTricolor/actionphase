-- name: CreateRegistrationAttempt :one
INSERT INTO registration_attempts (
    email, username, ip_address, user_agent, captcha_passed, honeypot_triggered, blocked_reason, successful
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: CountRecentRegistrationAttemptsByIP :one
SELECT COUNT(*) FROM registration_attempts
WHERE ip_address = $1
  AND created_at > $2;

-- name: CountRecentRegistrationAttemptsByEmail :one
SELECT COUNT(*) FROM registration_attempts
WHERE email = $1
  AND created_at > $2;

-- name: GetRecentSuccessfulRegistrationByIP :one
SELECT * FROM registration_attempts
WHERE ip_address = $1
  AND successful = TRUE
  AND created_at > $2
ORDER BY created_at DESC
LIMIT 1;

-- name: DeleteOldRegistrationAttempts :exec
DELETE FROM registration_attempts
WHERE created_at < $1;
