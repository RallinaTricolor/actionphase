package games

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGameAPI_UpdateCharacterSheet tests PUT /api/v1/games/{id}/character-sheet,
// the Character Sheet editor's save.
func TestGameAPI_UpdateCharacterSheet(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	ctx := context.Background()

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	coGM := testDB.CreateTestUser(t, "cogm", "cogm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	token := func(u *core.User) string {
		tok, err := core.CreateTestJWTTokenForUser(app, u)
		require.NoError(t, err)
		return tok
	}
	gmToken, coGMToken, playerToken := token(gm), token(coGM), token(player)

	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Sheet Game", core.GameStateInProgress)
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	for _, u := range []*core.User{coGM, player} {
		_, err := gameService.AddGameParticipant(ctx, game.ID, int32(u.ID), "player")
		require.NoError(t, err)
	}
	_, err := testDB.Pool.Exec(ctx,
		`UPDATE game_participants SET role = 'co_gm' WHERE game_id = $1 AND user_id = $2`, game.ID, coGM.ID)
	require.NoError(t, err)

	put := func(t *testing.T, gameID int32, tok, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/v1/games/%d/character-sheet", gameID), bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+tok)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	stored := func(t *testing.T, gameID int32) string {
		t.Helper()
		var sheet string
		require.NoError(t, testDB.Pool.QueryRow(ctx, `SELECT character_sheet::text FROM games WHERE id = $1`, gameID).Scan(&sheet))
		return sheet
	}
	reset := func(t *testing.T) {
		t.Helper()
		_, err := testDB.Pool.Exec(ctx, `UPDATE games SET character_sheet = '{}' WHERE id = $1`, game.ID)
		require.NoError(t, err)
	}

	layout := `{"tabs":[{"key":"inventory","label":" Gear "},{"key":"t_abc123","label":"Contacts","fields":[
		{"key":"f_a81x0p","label":"Relationship","type":"select","options":["Ally","Rival"]}]}]}`

	t.Run("GM saves a layout; it is normalized, stored and echoed", func(t *testing.T) {
		defer reset(t)
		rec := put(t, game.ID, gmToken, layout)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

		var resp struct {
			ID             int32                      `json:"id"`
			CharacterSheet *core.CharacterSheetConfig `json:"character_sheet"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.Equal(t, game.ID, resp.ID)
		require.NotNil(t, resp.CharacterSheet)
		require.Len(t, resp.CharacterSheet.Tabs, 2)
		assert.Equal(t, "Gear", resp.CharacterSheet.Tabs[0].Label, "label trimmed")
		assert.Equal(t, "select", resp.CharacterSheet.Tabs[1].Fields[0].Type)

		assert.JSONEq(t,
			`{"tabs":[{"key":"inventory","label":"Gear"},{"key":"t_abc123","label":"Contacts","fields":[{"key":"f_a81x0p","label":"Relationship","type":"select","options":["Ally","Rival"]}]}]}`,
			stored(t, game.ID))
	})

	t.Run("co-GM can save", func(t *testing.T) {
		defer reset(t)
		rec := put(t, game.ID, coGMToken, `{"tabs":[{"key":"skills"}]}`)
		assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assert.JSONEq(t, `{"tabs":[{"key":"skills"}]}`, stored(t, game.ID))
	})

	t.Run("player cannot save", func(t *testing.T) {
		rec := put(t, game.ID, playerToken, layout)
		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.JSONEq(t, `{}`, stored(t, game.ID))
	})

	t.Run("an invalid layout is a 422 naming the problem, and nothing is stored", func(t *testing.T) {
		rec := put(t, game.ID, gmToken, `{"tabs":[{"key":"bio"}]}`)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
		assert.Contains(t, rec.Body.String(), "bio")
		assert.JSONEq(t, `{}`, stored(t, game.ID))
	})

	t.Run("an unknown key is a 422", func(t *testing.T) {
		rec := put(t, game.ID, gmToken, `{"tabs":[{"key":"skills","public":true}]}`)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	})

	t.Run("an empty body resets to the default layout", func(t *testing.T) {
		_, err := testDB.Pool.Exec(ctx, `UPDATE games SET character_sheet = '{"tabs":[]}' WHERE id = $1`, game.ID)
		require.NoError(t, err)

		rec := put(t, game.ID, gmToken, `{}`)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assert.JSONEq(t, `{}`, stored(t, game.ID))

		// And the response omits the key, the one wire shape for "defaults".
		var resp map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.NotContains(t, resp, "character_sheet")
	})

	t.Run("an archived game is a 409", func(t *testing.T) {
		completed := testDB.CreateTestGameWithState(t, int32(gm.ID), "Finished Game", core.GameStateCompleted)
		rec := put(t, completed.ID, gmToken, `{"tabs":[{"key":"skills"}]}`)
		assert.Equal(t, http.StatusConflict, rec.Code)
		assert.JSONEq(t, `{}`, stored(t, completed.ID))
	})
}
