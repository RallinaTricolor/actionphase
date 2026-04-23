ALTER TABLE poll_votes DROP CONSTRAINT poll_votes_poll_id_user_id_key;
ALTER TABLE poll_votes ADD COLUMN character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_user_id_character_id_key UNIQUE (poll_id, user_id, character_id);
ALTER TABLE common_room_polls ADD COLUMN vote_as_type VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (vote_as_type IN ('player', 'character'));
