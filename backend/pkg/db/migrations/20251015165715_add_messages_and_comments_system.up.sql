-- Messages table for both Common Room posts and private messages
-- This unified approach allows us to:
-- 1. Support threaded Reddit-style comments
-- 2. Enable private messaging between characters
-- 3. Maintain consistent UI/UX patterns across message types
--
-- Key Design Decisions:
-- - All messages MUST be sent as a character (character_id required)
-- - Visibility: 'game' (Common Room, visible to all) or 'private' (DMs between characters)
-- - All messages are associated with a game (no global messages)

CREATE TYPE message_visibility AS ENUM ('game', 'private');
CREATE TYPE message_type AS ENUM ('post', 'comment', 'private_message');

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES game_phases(id) ON DELETE SET NULL,

    -- Author information (all messages sent as characters)
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE, -- Required: post as character

    -- Message content
    content TEXT NOT NULL,
    message_type message_type NOT NULL DEFAULT 'post',

    -- Threading support (for Reddit-style comments)
    parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    thread_depth INTEGER NOT NULL DEFAULT 0, -- Denormalized for performance

    -- Visibility control
    visibility message_visibility NOT NULL DEFAULT 'game',

    -- Metadata
    is_edited BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false, -- Soft delete for thread integrity

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_thread_depth CHECK (thread_depth >= 0 AND thread_depth <= 10),
    CONSTRAINT parent_required_for_comments CHECK (
        (message_type = 'comment' AND parent_id IS NOT NULL) OR
        (message_type != 'comment')
    ),
    CONSTRAINT no_parent_for_posts CHECK (
        (message_type = 'post' AND parent_id IS NULL) OR
        (message_type != 'post')
    )
    -- Note: character ownership validation must be done at application level
    -- We ensure character belongs to game via business logic
);

-- Indexes for performance
CREATE INDEX idx_messages_game_id ON messages(game_id);
CREATE INDEX idx_messages_phase_id ON messages(phase_id);
CREATE INDEX idx_messages_author_id ON messages(author_id);
CREATE INDEX idx_messages_parent_id ON messages(parent_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_game_phase ON messages(game_id, phase_id);

-- Composite index for efficient thread queries
CREATE INDEX idx_messages_thread ON messages(game_id, parent_id, created_at)
    WHERE is_deleted = false;

-- Recipients table for private messages (future use)
-- This allows 1:1, 1:many, and group messaging
CREATE TABLE message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(message_id, recipient_id)
);

CREATE INDEX idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX idx_message_recipients_recipient_id ON message_recipients(recipient_id);
CREATE INDEX idx_message_recipients_unread ON message_recipients(recipient_id, is_read)
    WHERE is_read = false;

-- Reactions table (optional, for future "like" functionality)
CREATE TABLE message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) NOT NULL, -- 'like', 'love', 'laugh', etc.

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- One reaction per user per message
    UNIQUE(message_id, user_id, reaction_type)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

-- Function to update thread_depth automatically
CREATE OR REPLACE FUNCTION update_message_thread_depth()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a comment (has parent), calculate depth
    IF NEW.parent_id IS NOT NULL THEN
        SELECT COALESCE(thread_depth, 0) + 1 INTO NEW.thread_depth
        FROM messages
        WHERE id = NEW.parent_id;
    ELSE
        -- Top-level post
        NEW.thread_depth := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_message_thread_depth
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_message_thread_depth();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        NEW.deleted_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_timestamp_trigger
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_message_timestamp();
