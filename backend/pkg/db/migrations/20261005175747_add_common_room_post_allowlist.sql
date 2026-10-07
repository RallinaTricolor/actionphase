-- +goose Up
-- Restricted Common Room posts: a GM can limit a top-level post (and every
-- comment under it) to an allowlist of players.
--
-- root_post_id records each message's thread root so read paths that reach
-- comments without going through the post (New Comments, profiles, favorites,
-- dashboard, unread tracking) can filter with one join instead of a recursive
-- CTE. Posts point at themselves.
ALTER TABLE messages ADD COLUMN root_post_id INTEGER REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN is_restricted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD CONSTRAINT restricted_only_on_posts
    CHECK (is_restricted = false OR message_type = 'post');

-- Backfill: every parentless row is its own root, then walk down the tree.
-- Anchoring on parent_id rather than message_type also covers any legacy
-- 'private_message' rows, which no current code path writes.
WITH RECURSIVE tree AS (
    SELECT id, id AS root FROM messages WHERE parent_id IS NULL
    UNION ALL
    SELECT m.id, t.root FROM messages m JOIN tree t ON m.parent_id = t.id
)
UPDATE messages m SET root_post_id = t.root FROM tree t
WHERE m.id = t.id;

-- Fails the migration loudly if the backfill missed anything.
ALTER TABLE messages ALTER COLUMN root_post_id SET NOT NULL;
CREATE INDEX idx_messages_root_post_id ON messages(root_post_id);

-- +goose StatementBegin
-- Extends the original thread-depth trigger to also fill root_post_id.
-- parent_id never changes after insert, so an INSERT trigger is enough.
CREATE OR REPLACE FUNCTION update_message_thread_depth()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        SELECT COALESCE(thread_depth, 0) + 1, root_post_id
          INTO NEW.thread_depth, NEW.root_post_id
          FROM messages
         WHERE id = NEW.parent_id;
    ELSE
        NEW.thread_depth := 0;
        -- Column defaults (the id sequence) are applied before BEFORE triggers.
        NEW.root_post_id := NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- The allowlist for a restricted post. Keyed by user, not character: visibility
-- is about who reads the page.
CREATE TABLE common_room_post_viewers (
    post_id    INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_common_room_post_viewers_user ON common_room_post_viewers(user_id);

-- +goose Down
DROP TABLE IF EXISTS common_room_post_viewers;

-- +goose StatementBegin
-- Restored from 20251015165715_add_messages_and_comments_system.sql.
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
-- +goose StatementEnd

DROP INDEX IF EXISTS idx_messages_root_post_id;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS restricted_only_on_posts;
ALTER TABLE messages DROP COLUMN IF EXISTS is_restricted;
ALTER TABLE messages DROP COLUMN IF EXISTS root_post_id;
