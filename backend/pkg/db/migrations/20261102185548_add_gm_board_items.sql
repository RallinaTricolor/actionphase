-- +goose Up
-- The GM results board: a GM workspace for resolving one action phase, plus
-- per-game setup (codex, names, reward template). Both are stored one row per
-- item (a card, a scene, a stance...), not one document, so two GMs or two
-- tabs only collide when they edit the same item. Each row carries:
--   version: bumped on every write; a write names the version it was based
--            on and is refused (409) when that is stale.
--   seq:     drawn from one shared sequence on every write, so a client polls
--            "what changed since seq N". Writers take a per-phase (or per-game)
--            advisory lock before drawing it, so within one board seq order is
--            commit order and a poller never skips a row.
--   deleted: deletes are tombstones, so pollers learn about them.
-- The doc shapes are the client's (frontend/src/lib/gmBoard) and will keep
-- changing, which is why they are JSONB. A tombstone keeps no doc.
CREATE SEQUENCE gm_board_seq;

-- Lets gm_board_items name (phase, game) as a pair, so a row can never claim a
-- game its phase isn't in.
ALTER TABLE game_phases ADD CONSTRAINT game_phases_id_game_id_key UNIQUE (id, game_id);

CREATE TABLE gm_board_items (
    phase_id   INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    item_key   TEXT NOT NULL,
    game_id    INTEGER NOT NULL,
    doc        JSONB,
    version    INTEGER NOT NULL CHECK (version > 0),
    seq        BIGINT NOT NULL DEFAULT nextval('gm_board_seq'),
    deleted    BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (phase_id, kind, item_key),
    FOREIGN KEY (phase_id, game_id) REFERENCES game_phases(id, game_id) ON DELETE CASCADE,
    CHECK (deleted OR doc IS NOT NULL)
);
CREATE INDEX idx_gm_board_items_phase_seq ON gm_board_items (phase_id, seq);

CREATE TABLE gm_settings_items (
    game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    item_key   TEXT NOT NULL,
    doc        JSONB,
    version    INTEGER NOT NULL CHECK (version > 0),
    seq        BIGINT NOT NULL DEFAULT nextval('gm_board_seq'),
    deleted    BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (game_id, kind, item_key),
    CHECK (deleted OR doc IS NOT NULL)
);
CREATE INDEX idx_gm_settings_items_game_seq ON gm_settings_items (game_id, seq);

-- Off by default. When on, the audience may view the boards while the game
-- runs, and anyone who can see the game once it is a public archive. A plain
-- column because the board's read check reads it on every request.
ALTER TABLE games ADD COLUMN share_gm_board BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE games DROP COLUMN share_gm_board;
DROP TABLE gm_settings_items;
DROP TABLE gm_board_items;
ALTER TABLE game_phases DROP CONSTRAINT game_phases_id_game_id_key;
DROP SEQUENCE gm_board_seq;
