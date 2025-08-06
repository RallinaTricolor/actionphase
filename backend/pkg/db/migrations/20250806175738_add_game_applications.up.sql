-- Game applications table for managing player applications to join games
-- Players apply to join games, and GMs approve/reject these applications
CREATE TABLE game_applications (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('player', 'audience')),
    message TEXT, -- Optional message from applicant explaining why they want to join
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE, -- When GM reviewed the application
    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- GM who reviewed
    UNIQUE(game_id, user_id) -- One application per user per game
);

-- Indexes for performance
CREATE INDEX idx_game_applications_game_id ON game_applications(game_id);
CREATE INDEX idx_game_applications_user_id ON game_applications(user_id);
CREATE INDEX idx_game_applications_status ON game_applications(status);
CREATE INDEX idx_game_applications_pending ON game_applications(game_id, status) WHERE status = 'pending';
