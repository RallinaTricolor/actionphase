-- Create handouts table for GM informational documents
CREATE TABLE handouts (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_handouts_game
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX idx_handouts_game_id ON handouts(game_id);
CREATE INDEX idx_handouts_status ON handouts(game_id, status);

-- Create handout_comments table for GM-only comments on handouts
CREATE TABLE handout_comments (
    id SERIAL PRIMARY KEY,
    handout_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_comment_id INT DEFAULT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    edited_at TIMESTAMPTZ DEFAULT NULL,
    edit_count INT DEFAULT 0 NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INT DEFAULT NULL,

    CONSTRAINT fk_handout_comments_handout
        FOREIGN KEY (handout_id) REFERENCES handouts(id) ON DELETE CASCADE,
    CONSTRAINT fk_handout_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_handout_comments_parent
        FOREIGN KEY (parent_comment_id) REFERENCES handout_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_handout_comments_deleted_by
        FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_handout_comments_handout ON handout_comments(handout_id);
CREATE INDEX idx_handout_comments_parent ON handout_comments(parent_comment_id);
