package db

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// TestCreateGameStartsWithDefaultSheet pins that a new game gets the default
// layout. Create takes no sheet config (the GM customises it afterwards), so
// the column must fall to its '{}' default rather than NULL.
func TestCreateGameStartsWithDefaultSheet(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	queries := models.New(testDB.Pool)

	game, err := queries.CreateGame(context.Background(), models.CreateGameParams{
		Title:       "Game Without A Sheet Config",
		Description: "Created with the default sheet.",
		GmUserID:    int32(fixtures.TestUser.ID),
	})
	if err != nil {
		t.Fatalf("creating a game must not fail: %v", err)
	}

	if string(game.CharacterSheet) != "{}" {
		t.Errorf("character_sheet = %q, want %q", game.CharacterSheet, "{}")
	}
	if got := core.CharacterSheetConfigForResponse(game.CharacterSheet); got != nil {
		t.Errorf("a new game must render the default layout, got %+v", got)
	}
}

// TestGameService_UpdateGameLeavesCharacterSheetAlone pins that a game
// settings save never touches the sheet layout.
//
// UpdateGame is a full replace of every other setting. The layout used to ride
// along with it, so a settings save that omitted it reset the GM's tab names;
// it is now written only by UpdateGameCharacterSheet. Both stored shapes are
// covered: legacy labels (from before tab composition) and composed tabs.
func TestGameService_UpdateGameLeavesCharacterSheetAlone(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	ctx := context.Background()

	cases := []struct {
		name   string
		config core.CharacterSheetConfig
		stored string
	}{
		{
			name:   "legacy labels",
			config: core.CharacterSheetConfig{Labels: &core.CharacterSheetLabels{Skills: "Approaches", Numbers: "Stress"}},
			stored: `{"labels":{"skills":"Approaches","numbers":"Stress"}}`,
		},
		{
			name: "composed tabs",
			config: core.CharacterSheetConfig{
				Tabs: []core.CharacterSheetTab{{Key: "t_abc123", Label: "Contacts", Fields: []core.CharacterSheetField{}}},
			},
			stored: `{"tabs":[{"key":"t_abc123","label":"Contacts","fields":[]}]}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			game, err := gameService.CreateGame(ctx, core.CreateGameRequest{
				Title:       "Game With A Customised Sheet",
				Description: "The GM customises the sheet after creation.",
				GMUserID:    int32(fixtures.TestUser.ID),
				CommunityID: int32(fixtures.TestCommunity.ID),
			})
			core.AssertNoError(t, err, "Failed to create game")

			_, err = gameService.UpdateGameCharacterSheet(ctx, game.ID, tc.config)
			core.AssertNoError(t, err, "Failed to customise sheet")

			updated, err := gameService.UpdateGame(ctx, core.UpdateGameRequest{
				ID:          game.ID,
				Title:       "Game With A Customised Sheet",
				Description: "Edited through the settings form.",
			})
			core.AssertNoError(t, err, "Failed to update game")

			assertSameJSON(t, updated.CharacterSheet, tc.stored)
		})
	}
}

// TestGameService_UpdateGameCharacterSheet covers the dedicated sheet write the
// Character Sheet editor uses.
func TestGameService_UpdateGameCharacterSheet(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	ctx := context.Background()

	newGame := func(t *testing.T) *models.Game {
		t.Helper()
		game, err := gameService.CreateGame(ctx, core.CreateGameRequest{
			Title:       "Game With A Composed Sheet",
			Description: "The GM customises the sheet after creation.",
			GMUserID:    int32(fixtures.TestUser.ID),
			CommunityID: int32(fixtures.TestCommunity.ID),
		})
		core.AssertNoError(t, err, "Failed to create game")
		// A game from before tab composition, with a legacy label override.
		_, err = gameService.UpdateGameCharacterSheet(ctx, game.ID, core.CharacterSheetConfig{
			Labels: &core.CharacterSheetLabels{Inventory: "Gear"},
		})
		core.AssertNoError(t, err, "Failed to set legacy labels")
		return game
	}

	t.Run("stores the normalized layout and drops legacy labels", func(t *testing.T) {
		game := newGame(t)
		updated, err := gameService.UpdateGameCharacterSheet(ctx, game.ID, core.CharacterSheetConfig{
			Labels: &core.CharacterSheetLabels{Inventory: "Gear"},
			Tabs: []core.CharacterSheetTab{
				{Key: "inventory", Label: " Gear "},
				{Key: "t_abc123", Label: "Contacts", Fields: []core.CharacterSheetField{}},
			},
		})
		core.AssertNoError(t, err, "Failed to update character sheet")

		assertSameJSON(t, updated.CharacterSheet,
			`{"tabs":[{"key":"inventory","label":"Gear"},{"key":"t_abc123","label":"Contacts","fields":[]}]}`)
	})

	t.Run("an empty config resets to the default layout", func(t *testing.T) {
		game := newGame(t)
		updated, err := gameService.UpdateGameCharacterSheet(ctx, game.ID, core.CharacterSheetConfig{})
		core.AssertNoError(t, err, "Failed to reset character sheet")
		if string(updated.CharacterSheet) != "{}" {
			t.Errorf("stored %s, want {}", updated.CharacterSheet)
		}
	})

	t.Run("rejects an invalid layout without writing it", func(t *testing.T) {
		game := newGame(t)
		_, err := gameService.UpdateGameCharacterSheet(ctx, game.ID, core.CharacterSheetConfig{
			Tabs: []core.CharacterSheetTab{{Key: "bio"}},
		})
		if err == nil {
			t.Fatal("expected a validation error")
		}
		stored, err := models.New(testDB.Pool).GetGame(ctx, game.ID)
		core.AssertNoError(t, err, "Failed to reload game")
		assertSameJSON(t, stored.CharacterSheet, `{"labels":{"inventory":"Gear"}}`)
	})

	t.Run("rejects an archived game", func(t *testing.T) {
		game := newGame(t)
		_, err := testDB.Pool.Exec(ctx, `UPDATE games SET state = 'completed' WHERE id = $1`, game.ID)
		core.AssertNoError(t, err, "Failed to complete game")

		_, err = gameService.UpdateGameCharacterSheet(ctx, game.ID, core.CharacterSheetConfig{})
		if !errors.Is(err, core.ErrGameReadOnly) {
			t.Errorf("err = %v, want ErrGameReadOnly", err)
		}
	})
}

// assertSameJSON compares semantically: JSONB re-renders whitespace on the way
// out, so the stored bytes never match what was marshalled.
func assertSameJSON(t *testing.T, got []byte, want string) {
	t.Helper()
	var g, w any
	if err := json.Unmarshal(got, &g); err != nil {
		t.Fatalf("stored value is not JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(want), &w); err != nil {
		t.Fatalf("want is not JSON: %v", err)
	}
	if !reflect.DeepEqual(g, w) {
		t.Errorf("stored %s, want %s", got, want)
	}
}
