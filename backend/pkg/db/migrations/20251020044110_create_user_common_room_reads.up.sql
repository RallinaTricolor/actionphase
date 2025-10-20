-- Create table to track which comments users have read in common room posts
CREATE TABLE IF NOT EXISTS user_common_room_reads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  last_read_comment_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure one read marker per user per post
  UNIQUE(user_id, post_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_common_room_reads_user_game
ON user_common_room_reads(user_id, game_id);

CREATE INDEX idx_user_common_room_reads_post
ON user_common_room_reads(post_id);

CREATE INDEX idx_user_common_room_reads_updated
ON user_common_room_reads(updated_at DESC);

-- Add helpful comments
COMMENT ON TABLE user_common_room_reads IS 'Tracks which comments users have read in common room posts';
COMMENT ON COLUMN user_common_room_reads.last_read_comment_id IS 'The most recent comment this user has read in this post thread';
COMMENT ON COLUMN user_common_room_reads.last_read_at IS 'When the user last viewed this thread';
