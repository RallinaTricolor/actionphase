-- Rollback: Set GM NPC user_ids back to NULL
-- Note: This rollback may lose information if user_id was manually set for GM NPCs

UPDATE characters
SET user_id = NULL
WHERE character_type = 'npc_gm';

-- Remove the comment
COMMENT ON COLUMN characters.user_id IS NULL;
