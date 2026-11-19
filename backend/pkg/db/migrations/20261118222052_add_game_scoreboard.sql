-- +goose Up
ALTER TABLE games
    ADD COLUMN scoreboard_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN scoreboard JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN games.scoreboard_enabled IS 'Whether the game has a Scoreboard tab. Turning it off keeps the scoreboard config.';
COMMENT ON COLUMN games.scoreboard IS 'Scoreboard setup (core.ScoreboardConfig): visibility, columns and sort. Sparse; validated by the application.';

-- +goose Down
ALTER TABLE games
    DROP COLUMN scoreboard,
    DROP COLUMN scoreboard_enabled;
