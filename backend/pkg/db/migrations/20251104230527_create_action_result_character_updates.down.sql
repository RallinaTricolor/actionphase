-- Drop unique constraint
DROP INDEX IF EXISTS idx_action_result_character_updates_unique_field;

-- Drop regular indexes
DROP INDEX IF EXISTS idx_action_result_character_updates_character_id;
DROP INDEX IF EXISTS idx_action_result_character_updates_result_id;

-- Drop table (CASCADE deletes all draft data)
DROP TABLE IF EXISTS action_result_character_updates;
