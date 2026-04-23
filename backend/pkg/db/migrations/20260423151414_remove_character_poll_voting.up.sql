ALTER TABLE poll_votes DROP CONSTRAINT poll_votes_poll_id_user_id_character_id_key;
ALTER TABLE poll_votes DROP COLUMN character_id;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_user_id_key UNIQUE (poll_id, user_id);
ALTER TABLE common_room_polls DROP COLUMN vote_as_type;
