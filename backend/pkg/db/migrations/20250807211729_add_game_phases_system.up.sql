-- Game phases table to track different phases within games
CREATE TABLE game_phases (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_type VARCHAR(50) NOT NULL, -- 'common_room', 'action', 'results'
    phase_number INTEGER NOT NULL, -- Sequential phase number within the game
    title VARCHAR(255) NOT NULL, -- GM-customizable phase title
    description TEXT, -- Optional phase description
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE, -- For action phases (when submissions are due)
    is_active BOOLEAN DEFAULT FALSE, -- Only one phase per game can be active
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient game phase queries
CREATE INDEX idx_game_phases_game_id ON game_phases(game_id);
CREATE INDEX idx_game_phases_active ON game_phases(game_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_game_phases_phase_number ON game_phases(game_id, phase_number);

-- Ensure only one active phase per game
CREATE UNIQUE INDEX idx_game_phases_one_active_per_game ON game_phases(game_id) WHERE is_active = TRUE;

-- Action submissions table for action phases
CREATE TABLE action_submissions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL REFERENCES game_phases(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER, -- Optional reference to specific character (for later implementation)
    content JSONB NOT NULL, -- Rich text content
    is_draft BOOLEAN DEFAULT TRUE, -- Allow players to save drafts
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient action submission queries
CREATE INDEX idx_action_submissions_phase_id ON action_submissions(phase_id);
CREATE INDEX idx_action_submissions_user_id ON action_submissions(user_id);
CREATE INDEX idx_action_submissions_game_phase ON action_submissions(game_id, phase_id);

-- Ensure one submission per user per phase
CREATE UNIQUE INDEX idx_action_submissions_unique_user_phase ON action_submissions(phase_id, user_id);

-- Action results table for GM responses to action submissions
CREATE TABLE action_results (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL REFERENCES game_phases(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_submission_id INTEGER REFERENCES action_submissions(id) ON DELETE CASCADE,
    content JSONB NOT NULL, -- Rich text content from GM
    is_published BOOLEAN DEFAULT FALSE, -- GM can prepare results before publishing
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient action result queries
CREATE INDEX idx_action_results_phase_id ON action_results(phase_id);
CREATE INDEX idx_action_results_user_id ON action_results(user_id);
CREATE INDEX idx_action_results_submission_id ON action_results(action_submission_id);

-- Phase transitions log for audit trail
CREATE TABLE phase_transitions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    from_phase_id INTEGER REFERENCES game_phases(id) ON DELETE SET NULL,
    to_phase_id INTEGER NOT NULL REFERENCES game_phases(id) ON DELETE CASCADE,
    initiated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT, -- Optional reason for transition
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for phase transition history
CREATE INDEX idx_phase_transitions_game_id ON phase_transitions(game_id);
CREATE INDEX idx_phase_transitions_created_at ON phase_transitions(created_at);

-- Add phase management triggers to maintain data integrity

-- Function to automatically set updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_game_phases_updated_at
    BEFORE UPDATE ON game_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_submissions_updated_at
    BEFORE UPDATE ON action_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_results_updated_at
    BEFORE UPDATE ON action_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
