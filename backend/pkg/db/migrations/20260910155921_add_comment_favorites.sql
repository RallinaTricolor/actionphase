-- +goose Up
-- Private, per-user favorited comments. Cross-game: the listing spans every
-- game the user participates in, so there is no game scoping in the read path.
-- game_id is denormalized (as user_comment_reads does) so the per-game
-- star-state fetch avoids a join through messages.
CREATE TABLE user_comment_favorites (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

-- created_at DESC: the list is ordered by when favorited, not when written.
CREATE INDEX idx_user_comment_favorites_user      ON user_comment_favorites(user_id, created_at DESC);
CREATE INDEX idx_user_comment_favorites_user_game ON user_comment_favorites(user_id, game_id);
CREATE INDEX idx_user_comment_favorites_comment   ON user_comment_favorites(comment_id);

-- +goose Down
DROP TABLE IF EXISTS user_comment_favorites;
