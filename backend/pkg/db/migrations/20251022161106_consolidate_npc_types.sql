-- +goose Up
-- Consolidate NPC Character Types
-- This migration simplifies the character type system by converting the two
-- separate NPC types (npc_gm and npc_audience) into a single 'npc' type.
-- The npc_assignments table already handles the distinction between
-- GM-controlled and audience-controlled NPCs, making the type distinction redundant.
--
-- Rationale:
-- - Reduces complexity in validation logic
-- - More flexible: any NPC can be assigned to audience at any time
-- - Clearer semantics: "NPC" vs "Player Character" is the real distinction
-- - No data loss: all assignment relationships preserved in npc_assignments table

-- Step 1: Drop the existing check constraint
ALTER TABLE characters DROP CONSTRAINT characters_character_type_check;

-- Step 2: Convert all npc_gm and npc_audience character types to just 'npc'
UPDATE characters
SET character_type = 'npc'
WHERE character_type IN ('npc_gm', 'npc_audience');

-- Step 3: Re-add the check constraint with the new allowed values
ALTER TABLE characters ADD CONSTRAINT characters_character_type_check
    CHECK (character_type IN ('player_character', 'npc'));

-- Note: The npc_assignments table already tracks which NPCs are assigned to audience members
-- No changes needed to npc_assignments data - all assignments are preserved

-- +goose Down
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
