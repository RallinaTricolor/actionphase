-- Rollback player management tracking changes

-- Remove character original_owner tracking
ALTER TABLE characters DROP CONSTRAINT IF EXISTS fk_characters_original_owner;
ALTER TABLE characters DROP COLUMN IF EXISTS original_owner_user_id;

-- Remove character active status
DROP INDEX IF EXISTS idx_characters_active;
ALTER TABLE characters DROP COLUMN IF EXISTS is_active;

-- Remove game_participants removal tracking
DROP INDEX IF EXISTS idx_game_participants_removed_at;
ALTER TABLE game_participants DROP CONSTRAINT IF EXISTS fk_game_participants_removed_by;
ALTER TABLE game_participants DROP COLUMN IF EXISTS removed_by_user_id;
ALTER TABLE game_participants DROP COLUMN IF EXISTS removed_at;
