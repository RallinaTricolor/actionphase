-- Create conversation_reads table to track which messages users have read
CREATE TABLE IF NOT EXISTS conversation_reads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_read_message_id INTEGER REFERENCES private_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure one read marker per user per conversation
  UNIQUE(user_id, conversation_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_conversation_reads_user_conversation
ON conversation_reads(user_id, conversation_id);

CREATE INDEX idx_conversation_reads_conversation
ON conversation_reads(conversation_id);

COMMENT ON TABLE conversation_reads IS 'Tracks which messages users have read in each conversation';
COMMENT ON COLUMN conversation_reads.last_read_message_id IS 'Last message the user read in this conversation';
COMMENT ON COLUMN conversation_reads.last_read_at IS 'Timestamp when user last read messages in this conversation';
