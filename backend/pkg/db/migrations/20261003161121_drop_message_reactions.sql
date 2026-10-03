-- +goose Up
-- Message reactions were scaffolded with the messages system for a "like"
-- feature that was never built: no handler, route or frontend ever read or
-- wrote this table. Dropping it rather than leaving it for a feature that would
-- need its own design (and per-thread visibility checks) anyway.
DROP TABLE IF EXISTS message_reactions;

-- +goose Down
-- Recreated as it stood before the drop, including the TIMESTAMPTZ conversion
-- from 20260911162433_convert_naive_timestamps_to_timestamptz.sql. Rows are not
-- restored.
CREATE TABLE message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction_type)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
