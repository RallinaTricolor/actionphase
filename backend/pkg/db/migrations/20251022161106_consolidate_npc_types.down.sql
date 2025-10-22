-- Rollback: Restore NPC Type Distinction (Best Effort)
-- This rollback cannot perfectly restore the original npc_gm vs npc_audience distinction
-- because that information was not semantically meaningful (the npc_assignments table
-- already tracked assignment relationships).
--
-- Strategy:
-- - NPCs with assignment records become npc_audience
-- - NPCs without assignment records become npc_gm
--
-- Note: This is a best-effort rollback. The original type distinction may not be
-- perfectly restored if NPCs were reassigned or had their assignments removed.

-- Step 1: Drop the new check constraint
ALTER TABLE characters DROP CONSTRAINT characters_character_type_check;

-- Step 2: Restore the distinction between npc_gm and npc_audience
UPDATE characters c
SET character_type = CASE
  WHEN EXISTS (
    SELECT 1 FROM npc_assignments na WHERE na.character_id = c.id
  ) THEN 'npc_audience'
  ELSE 'npc_gm'
END
WHERE c.character_type = 'npc';

-- Step 3: Restore the original check constraint with all three types
ALTER TABLE characters ADD CONSTRAINT characters_character_type_check
    CHECK (character_type IN ('player_character', 'npc_gm', 'npc_audience'));
