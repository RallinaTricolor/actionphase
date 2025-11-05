-- Create game_deadlines table
-- Allows GMs to create arbitrary deadlines separate from phase transitions
CREATE TABLE game_deadlines (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ NOT NULL,

    -- Metadata
    created_by_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete for history
    deleted_at TIMESTAMPTZ
);

-- Index for querying active deadlines for a specific game
CREATE INDEX idx_game_deadlines_game_active
    ON game_deadlines(game_id, deadline)
    WHERE deleted_at IS NULL;

-- Index for querying deadlines by timestamp
CREATE INDEX idx_game_deadlines_deadline
    ON game_deadlines(deadline)
    WHERE deleted_at IS NULL;
