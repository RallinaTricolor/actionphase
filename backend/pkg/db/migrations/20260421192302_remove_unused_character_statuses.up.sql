-- Migrate existing rows with removed statuses before tightening the constraint
UPDATE characters SET status = 'approved' WHERE status IN ('dead', 'active');
UPDATE characters SET status = 'pending' WHERE status = 'rejected';

ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_status_check;
ALTER TABLE characters ADD CONSTRAINT characters_status_check
    CHECK (status IN ('pending', 'approved'));
