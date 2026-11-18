package db

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

func TestScoreboardService_ReadsStoredSheets(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "characters", "games", "sessions", "users")

	ctx := context.Background()
	queries := models.New(testDB.Pool)
	service := &ScoreboardService{DB: testDB.Pool, Logger: core.NewTestApp(testDB.Pool).ObsLogger}

	gm := testDB.CreateTestUser(t, "sb_service_gm", "sb_service_gm@example.com")
	player := testDB.CreateTestUser(t, "sb_service_player", "sb_service_player@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Scoreboard Service", core.GameStateInProgress)

	sheet, err := core.MarshalCharacterSheetConfig(core.CharacterSheetConfig{Tabs: []core.CharacterSheetTab{
		{Key: "numbers"},
		{Key: "t_abc123", Label: "Resources", Fields: []core.CharacterSheetField{{Key: "gold", Label: "Gold", Type: core.SheetFieldNumber}}},
	}})
	require.NoError(t, err)
	updated, err := queries.UpdateGameCharacterSheet(ctx, models.UpdateGameCharacterSheetParams{ID: game.ID, CharacterSheet: sheet})
	require.NoError(t, err)
	game = &updated

	character, err := queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID:        game.ID,
		UserID:        pgtype.Int4{Int32: int32(player.ID), Valid: true},
		Name:          "Ash",
		CharacterType: "player_character",
		Status:        "approved",
	})
	require.NoError(t, err)
	for _, row := range []struct{ module, field, value string }{
		{"t_abc123", "t_abc123", `[{"id":"e1","name":"Purse","gold":40}]`},
		{"numbers", "numbers", `[{"id":"e2","name":"Score","amount":7,"max":12}]`},
		// A row that isn't the tab's entry list must not be read as one.
		{"numbers", "other", `[{"id":"e3","name":"Score","amount":99}]`},
	} {
		_, err := queries.CreateCharacterData(ctx, models.CreateCharacterDataParams{
			CharacterID: character.ID,
			ModuleType:  row.module,
			FieldName:   row.field,
			FieldValue:  pgtype.Text{String: row.value, Valid: true},
			FieldType:   "json",
			IsPublic:    pgtype.Bool{Bool: false, Valid: true},
		})
		require.NoError(t, err)
	}

	config := core.ScoreboardConfig{Columns: []core.ScoreboardColumn{
		{ID: "c_gold01", Label: "Gold", TabKey: "t_abc123", Entry: "Purse", FieldKey: "gold"},
		{ID: "c_score1", Label: "Score", TabKey: "numbers", Entry: "score", FieldKey: "amount", Display: core.ScoreboardDisplayValueMax},
	}}
	stored, err := service.UpdateScoreboardConfig(ctx, game, config)
	require.NoError(t, err)
	assert.Equal(t, config.Columns, stored.Columns)

	reload := func() *models.Game {
		current, err := queries.GetGame(ctx, game.ID)
		require.NoError(t, err)
		return &current
	}

	board, err := service.GetScoreboard(ctx, reload(), core.ScoreboardFull)
	require.NoError(t, err)
	require.Len(t, board.Rows, 1)
	assert.Equal(t, 40.0, *board.Rows[0].Values["c_gold01"].Value, "a custom tab's number field")
	score := board.Rows[0].Values["c_score1"]
	assert.Equal(t, 7.0, *score.Value, "a legacy Numbers row")
	assert.Equal(t, 12.0, *score.Max)
	assert.Empty(t, board.BrokenColumnIDs)

	names, err := service.GetScoreboardEntryNames(ctx, reload())
	require.NoError(t, err)
	assert.Equal(t, []core.ScoreboardTabEntryNames{
		{TabKey: "numbers", EntryNames: []string{"Score"}},
		{TabKey: "t_abc123", EntryNames: []string{"Purse"}},
	}, names)

	// Removing the tab afterwards is allowed, and only flags the column.
	sheet, err = core.MarshalCharacterSheetConfig(core.CharacterSheetConfig{Tabs: []core.CharacterSheetTab{{Key: "numbers"}}})
	require.NoError(t, err)
	_, err = queries.UpdateGameCharacterSheet(ctx, models.UpdateGameCharacterSheetParams{ID: game.ID, CharacterSheet: sheet})
	require.NoError(t, err)

	board, err = service.GetScoreboard(ctx, reload(), core.ScoreboardFull)
	require.NoError(t, err)
	assert.Equal(t, []string{"c_gold01"}, board.BrokenColumnIDs)
	assert.NotContains(t, board.Rows[0].Values, "c_gold01")
	assert.Contains(t, board.Rows[0].Values, "c_score1")

	_, err = service.UpdateScoreboardConfig(ctx, reload(), config)
	assert.ErrorIs(t, err, core.ErrInvalidScoreboardConfig, "saving a column on a removed tab is refused")
}
