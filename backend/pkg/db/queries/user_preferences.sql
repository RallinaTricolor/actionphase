-- name: GetUserPreferences :one
-- Get user preferences by user ID
SELECT *
FROM user_preferences
WHERE user_id = $1;

-- name: UpsertUserPreferences :one
-- Create or update user preferences
INSERT INTO user_preferences (user_id, preferences)
VALUES ($1, $2)
ON CONFLICT (user_id)
DO UPDATE SET
  preferences = EXCLUDED.preferences,
  updated_at = NOW()
RETURNING *;

-- name: UpdateUserPreferenceField :one
-- Update a single preference field without replacing entire JSON
-- $2 is the JSON path as text array, e.g. '{theme}' for top-level or '{notification_settings,email_enabled}' for nested
UPDATE user_preferences
SET
  preferences = jsonb_set(preferences, $2::text[], $3::jsonb, true),
  updated_at = NOW()
WHERE user_id = $1
RETURNING *;

-- name: DeleteUserPreferences :exec
-- Delete all preferences for a user (cascade handles this on user deletion, but keeping for completeness)
DELETE FROM user_preferences
WHERE user_id = $1;
