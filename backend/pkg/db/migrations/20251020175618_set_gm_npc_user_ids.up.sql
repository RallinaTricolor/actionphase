-- Set user_id for all GM NPCs to the game's GM user
-- This simplifies queries and permissions checks by ensuring all characters have an owner

UPDATE characters
SET user_id = (SELECT gm_user_id FROM games WHERE games.id = characters.game_id)
WHERE character_type = 'npc_gm'
  AND user_id IS NULL;

-- Add comment explaining the relationship
COMMENT ON COLUMN characters.user_id IS 'User who controls this character. For player_character: the player. For npc_gm: the GM. For npc_audience: the audience member who created it.';
