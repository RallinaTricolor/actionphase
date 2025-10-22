-- Add player removal tracking to game_participants
ALTER TABLE game_participants ADD COLUMN removed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE game_participants ADD COLUMN removed_by_user_id INT DEFAULT NULL;

-- Add foreign key for removed_by
ALTER TABLE game_participants
ADD CONSTRAINT fk_game_participants_removed_by
FOREIGN KEY (removed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying active participants (not removed)
CREATE INDEX idx_game_participants_removed_at
ON game_participants(game_id, removed_at)
WHERE removed_at IS NULL;

-- Add inactive status to characters
ALTER TABLE characters ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Add index for active characters
CREATE INDEX idx_characters_active ON characters(game_id, is_active);

-- Add column to track character reassignments (original owner)
ALTER TABLE characters ADD COLUMN original_owner_user_id INT DEFAULT NULL;

-- Add foreign key for original_owner
ALTER TABLE characters
ADD CONSTRAINT fk_characters_original_owner
FOREIGN KEY (original_owner_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Update existing characters to set original_owner_user_id
UPDATE characters
SET original_owner_user_id = user_id
WHERE original_owner_user_id IS NULL;
