-- +goose Up
-- message_recipients was scaffolded alongside messages for a plan to carry
-- private messages in the messages table (visibility = 'private'), with this
-- table holding each message's recipients and per-recipient read state. That
-- plan was never built: DMs live in conversations / private_messages /
-- conversation_reads, and no query or code ever read or wrote this table.
DROP TABLE IF EXISTS message_recipients;

-- +goose Down
-- Recreated as it stood before the drop, including the TIMESTAMPTZ conversion
-- from 20260911162433_convert_naive_timestamps_to_timestamptz.sql. Rows are not
-- restored.
CREATE TABLE message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, recipient_id)
);

CREATE INDEX idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX idx_message_recipients_recipient_id ON message_recipients(recipient_id);
CREATE INDEX idx_message_recipients_unread ON message_recipients(recipient_id, is_read)
    WHERE is_read = false;
