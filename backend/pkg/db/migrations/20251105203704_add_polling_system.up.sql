-- Common Room Polling System
-- Enables GMs to create polls for player voting and consensus-building

-- Main polls table
CREATE TABLE common_room_polls (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES game_phases(id) ON DELETE CASCADE,

    -- Creator information
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,

    -- Poll content
    question VARCHAR(500) NOT NULL,
    description TEXT,

    -- Configuration
    deadline TIMESTAMPTZ NOT NULL,
    vote_as_type VARCHAR(20) NOT NULL CHECK (vote_as_type IN ('player', 'character')),
    show_individual_votes BOOLEAN DEFAULT FALSE,
    allow_other_option BOOLEAN DEFAULT TRUE,

    -- Metadata
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll options table
CREATE TABLE poll_options (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES common_room_polls(id) ON DELETE CASCADE,
    option_text VARCHAR(200) NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique ordering within a poll
    UNIQUE (poll_id, display_order)
);

-- Poll votes table
CREATE TABLE poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES common_room_polls(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,

    -- Vote data
    selected_option_id INTEGER REFERENCES poll_options(id) ON DELETE CASCADE,
    other_response TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    -- User can only vote once per poll (with or without character)
    UNIQUE (poll_id, user_id, character_id),

    -- Must select an option OR provide "other" response
    CHECK (
        (selected_option_id IS NOT NULL AND other_response IS NULL) OR
        (selected_option_id IS NULL AND other_response IS NOT NULL)
    )
);

-- Indexes for performance

-- Query polls by game and phase
CREATE INDEX idx_polls_game_phase
    ON common_room_polls(game_id, phase_id)
    WHERE is_deleted = FALSE;

-- Query active polls by deadline
CREATE INDEX idx_polls_deadline
    ON common_room_polls(deadline)
    WHERE is_deleted = FALSE;

-- Query votes by poll
CREATE INDEX idx_votes_poll
    ON poll_votes(poll_id);

-- Query user's votes
CREATE INDEX idx_votes_user
    ON poll_votes(user_id);

-- Query poll options by poll
CREATE INDEX idx_options_poll
    ON poll_options(poll_id, display_order);
