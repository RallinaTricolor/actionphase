-- +goose Up
-- Drop games.is_public.
--
-- The column was a half-removed feature. Creation stopped honouring it long ago
-- (the handler hardcoded `IsPublic: true // All games are now public`) and no UI
-- ever exposed it, but PUT /games/{id} still passed the field straight through
-- to the full-replace UPDATE. So a GM could hand-craft a request, flip a game
-- private, and watch it vanish from browse with no way back through the UI.
-- Verified against the running dev stack before this migration was written.
--
-- Nothing in the product wants per-game visibility: access is governed by game
-- state, participation, and community bans. Keeping a lever that only a crafted
-- request can pull is strictly worse than not having one.
--
-- The four indexes below are dropped and three are recreated without the
-- `WHERE is_public = true` predicate, which now matches every row. Note that
-- idx_games_state was declared with that predicate in TWO earlier migrations
-- (20251020005202, 20251020021306) but exists in the live database WITHOUT it:
-- the second CREATE INDEX IF NOT EXISTS found the name taken and silently did
-- nothing. Recreating it unpartial here makes the schema and the migrations
-- agree for the first time.
DROP INDEX IF EXISTS idx_games_is_public;
DROP INDEX IF EXISTS idx_games_genre;
DROP INDEX IF EXISTS idx_games_start_date;
DROP INDEX IF EXISTS idx_games_updated_at;
DROP INDEX IF EXISTS idx_games_state;

ALTER TABLE games DROP COLUMN is_public;

CREATE INDEX idx_games_state      ON games(state);
CREATE INDEX idx_games_genre      ON games(genre)          WHERE genre IS NOT NULL;
CREATE INDEX idx_games_start_date ON games(start_date)     WHERE start_date IS NOT NULL;
CREATE INDEX idx_games_updated_at ON games(updated_at DESC);

-- +goose Down
-- Restores the column with its original default, so every existing row comes
-- back public. The one game that was private before this migration is NOT
-- recovered -- that information is destroyed by the Up, and a down-migration
-- cannot invent it. Recreates the indexes as the earlier migrations DECLARED
-- them (idx_games_state partial), not as the live database happened to hold it.
DROP INDEX IF EXISTS idx_games_updated_at;
DROP INDEX IF EXISTS idx_games_start_date;
DROP INDEX IF EXISTS idx_games_genre;
DROP INDEX IF EXISTS idx_games_state;

ALTER TABLE games ADD COLUMN is_public BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_games_is_public  ON games(is_public);
CREATE INDEX idx_games_state      ON games(state)      WHERE is_public = true;
CREATE INDEX idx_games_genre      ON games(genre)      WHERE is_public = true AND genre IS NOT NULL;
CREATE INDEX idx_games_start_date ON games(start_date) WHERE is_public = true AND start_date IS NOT NULL;
CREATE INDEX idx_games_updated_at ON games(updated_at DESC) WHERE is_public = true;
