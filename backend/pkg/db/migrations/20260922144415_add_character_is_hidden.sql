-- +goose Up
-- Hidden NPCs: concealed from regular players, visible to GMs and the audience.
--
-- Hiding conceals a character's PRESENCE IN THE CAST, never content it has
-- authored -- a hidden NPC's common room posts and conversation messages render
-- normally for everyone. See .claude/planning/hidden-npcs.md.
--
-- The column is on every character but is only meaningful for NPCs. Setting it
-- on a player_character is rejected by the handler rather than a partial CHECK,
-- so extending this to player characters later stays a handler change rather
-- than a migration.
ALTER TABLE characters ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN characters.is_hidden IS 'NPC concealed from regular players in the roster, profile, mentions and conversation creation. Content the character authored stays visible.';

-- Partial index: the roster filter is always `is_hidden = false`, and hidden
-- NPCs are a small minority of any game's cast.
CREATE INDEX idx_characters_hidden ON characters (game_id) WHERE is_hidden = TRUE;

-- +goose Down
DROP INDEX IF EXISTS idx_characters_hidden;

ALTER TABLE characters DROP COLUMN IF EXISTS is_hidden;
