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
