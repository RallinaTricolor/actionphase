ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_status_check;
ALTER TABLE characters ADD CONSTRAINT characters_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'dead'));
