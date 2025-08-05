-- Add admin flag to existing users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN high_contrast BOOLEAN DEFAULT FALSE;

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    gm_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL DEFAULT 'setup' CHECK (state IN ('setup', 'recruitment', 'character_creation', 'in_progress', 'paused', 'completed', 'cancelled')),
    genre VARCHAR(100),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    recruitment_deadline TIMESTAMP WITH TIME ZONE,
    max_players INTEGER DEFAULT 6,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game participants (players, co-GMs, audience)
CREATE TABLE game_participants (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('player', 'co_gm', 'audience')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, user_id)
);

-- Characters table (includes Player Characters and NPCs)
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for GM-controlled NPCs
    name VARCHAR(255) NOT NULL,
    character_type VARCHAR(20) NOT NULL CHECK (character_type IN ('player_character', 'npc_gm', 'npc_audience')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'dead')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character data (modular system for character sheets)
CREATE TABLE character_data (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL, -- 'bio', 'notes', 'abilities', 'inventory', etc.
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    field_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'boolean', 'json')),
    is_public BOOLEAN DEFAULT TRUE, -- FALSE for private notes, secrets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, module_type, field_name)
);

-- NPC assignments (audience members assigned to control NPCs)
CREATE TABLE npc_assignments (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    assigned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id) -- Each NPC can only be assigned to one user at a time
);

-- Game phases (common room, action phase, etc.)
CREATE TABLE game_phases (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_type VARCHAR(20) NOT NULL CHECK (phase_type IN ('common_room', 'action', 'results')),
    phase_number INTEGER NOT NULL, -- Sequential numbering within game
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, phase_number)
);

-- Action submissions (private until game completion)
CREATE TABLE action_submissions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL REFERENCES game_phases(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    content TEXT NOT NULL, -- Rich text content stored as JSON or HTML
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, user_id, phase_id) -- One action per user per phase
);

-- Action results (private GM -> player messages)
CREATE TABLE action_results (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL REFERENCES game_phases(id) ON DELETE CASCADE,
    gm_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Rich text results
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threads (for common room discussions)
CREATE TABLE threads (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES game_phases(id) ON DELETE SET NULL,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Opening post content
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thread posts (replies to threads)
CREATE TABLE thread_posts (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    parent_post_id INTEGER REFERENCES thread_posts(id) ON DELETE CASCADE, -- For nested replies
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL, -- Posted as which character
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Private conversations
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    conversation_type VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group')),
    title VARCHAR(255), -- For group chats
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants (users and NPCs in private messages)
CREATE TABLE conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL, -- If participating as specific character
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id, character_id)
);

-- Private messages
CREATE TABLE private_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL, -- Sent as which character
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    related_entity_type VARCHAR(50), -- 'game', 'character', 'message', etc.
    related_entity_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_games_gm_user_id ON games(gm_user_id);
CREATE INDEX idx_games_state ON games(state);
CREATE INDEX idx_games_is_public ON games(is_public);
CREATE INDEX idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX idx_game_participants_user_id ON game_participants(user_id);
CREATE INDEX idx_characters_game_id ON characters(game_id);
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_type ON characters(character_type);
CREATE INDEX idx_character_data_character_id ON character_data(character_id);
CREATE INDEX idx_character_data_module ON character_data(module_type);
CREATE INDEX idx_game_phases_game_id ON game_phases(game_id);
CREATE INDEX idx_game_phases_active ON game_phases(is_active);
CREATE INDEX idx_action_submissions_game_id ON action_submissions(game_id);
CREATE INDEX idx_action_submissions_user_id ON action_submissions(user_id);
CREATE INDEX idx_action_submissions_phase_id ON action_submissions(phase_id);
CREATE INDEX idx_action_results_game_id ON action_results(game_id);
CREATE INDEX idx_action_results_user_id ON action_results(user_id);
CREATE INDEX idx_threads_game_id ON threads(game_id);
CREATE INDEX idx_thread_posts_thread_id ON thread_posts(thread_id);
CREATE INDEX idx_thread_posts_parent ON thread_posts(parent_post_id);
CREATE INDEX idx_conversations_game_id ON conversations(game_id);
CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_private_messages_conversation_id ON private_messages(conversation_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
