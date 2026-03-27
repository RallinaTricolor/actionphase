-- Manual per-comment read tracking for users in "manual" read mode
CREATE TABLE user_comment_reads (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    post_id    INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

CREATE INDEX idx_user_comment_reads_user_game ON user_comment_reads(user_id, game_id);
CREATE INDEX idx_user_comment_reads_user_post ON user_comment_reads(user_id, post_id);
CREATE INDEX idx_user_comment_reads_comment   ON user_comment_reads(comment_id);
