-- Create user_preferences table for storing user-specific UI/UX settings
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure one preferences row per user
  UNIQUE(user_id)
);

-- Index for fast user lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- GIN index for JSONB queries (if we need to query specific preference values)
CREATE INDEX idx_user_preferences_jsonb ON user_preferences USING GIN (preferences);

COMMENT ON TABLE user_preferences IS 'Stores user-specific UI/UX preferences as JSONB for flexibility';
COMMENT ON COLUMN user_preferences.preferences IS 'JSONB object containing preference key-value pairs (theme, timezone, notifications, etc.)';

-- Example preferences structure:
-- {
--   "theme": "dark",           // "light" | "dark" | "auto"
--   "timezone": "America/New_York",
--   "notification_settings": {
--     "email_enabled": true,
--     "push_enabled": false
--   }
-- }
