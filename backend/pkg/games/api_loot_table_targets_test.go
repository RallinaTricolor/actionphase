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

// TestLootTableTargets covers loot tables rolling into a tab of the GM's
// choosing: the target is validated against the game's sheet, the roll writes
// into that tab, a table with contents can't be retargeted, and the sheet
// editor can't remove a tab a table rolls into.
func TestLootTableTargets(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	tables := []string{"game_logs", "character_data", "characters", "game_loot_table_contents", "game_loot_tables", "games", "sessions", "users"}
	testDB.CleanupTables(t, tables...)
	defer testDB.CleanupTables(t, tables...)

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)
	ctx := context.Background()
	gameID := int32(fixtures.TestGame.ID)

	token, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	require.NoError(t, err)

	send := func(t *testing.T, method, path string, body any) *httptest.ResponseRecorder {
		t.Helper()
		var reader *bytes.Buffer
		switch b := body.(type) {
		case nil:
			reader = &bytes.Buffer{}
		case string:
			reader = bytes.NewBufferString(b)
		default:
			encoded, err := json.Marshal(b)
			require.NoError(t, err)
			reader = bytes.NewBuffer(encoded)
		}
		req := httptest.NewRequest(method, fmt.Sprintf("/api/v1/games/%d%s", gameID, path), reader)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	setLayout := func(t *testing.T, sheet string) {
		t.Helper()
		_, err := testDB.Pool.Exec(ctx, `UPDATE games SET character_sheet = $2 WHERE id = $1`, gameID, sheet)
		require.NoError(t, err)
	}
	clearTables := func(t *testing.T) {
		t.Helper()
		_, err := testDB.Pool.Exec(ctx, `DELETE FROM game_loot_tables WHERE game_id = $1`, gameID)
		require.NoError(t, err)
	}
	type tableResponse struct {
		ID        int32  `json:"id"`
		Name      string `json:"name"`
		TargetTab string `json:"target_tab"`
	}
	create := func(t *testing.T, body map[string]any) tableResponse {
		t.Helper()
		rec := send(t, http.MethodPost, "/loot-tables", body)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var created tableResponse
		require.NoError(t, json.NewDecoder(rec.Body).Decode(&created))
		return created
	}
	withContacts := `{"tabs":[{"key":"inventory"},{"key":"t_abc123","label":"Contacts","fields":[]}]}`

	t.Run("a table rolls into Inventory unless told otherwise", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, `{}`)
		created := create(t, map[string]any{"name": "Common Drops"})
		assert.Equal(t, "inventory", created.TargetTab)

		rec := send(t, http.MethodGet, "/loot-tables", nil)
		require.Equal(t, http.StatusOK, rec.Code)
		var listed []tableResponse
		require.NoError(t, json.NewDecoder(rec.Body).Decode(&listed))
		require.Len(t, listed, 1)
		assert.Equal(t, "inventory", listed[0].TargetTab, "The list reports each table's target")
	})

	t.Run("a table can target a custom tab on the sheet", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, withContacts)
		created := create(t, map[string]any{"name": "Townsfolk", "target_tab": "t_abc123"})
		assert.Equal(t, "t_abc123", created.TargetTab)
	})

	t.Run("a target the sheet doesn't have is rejected", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, withContacts)

		rec := send(t, http.MethodPost, "/loot-tables", map[string]any{"name": "Talents", "target_tab": "skills"})
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), `no tab \"skills\"`)

		rec = send(t, http.MethodPost, "/loot-tables", map[string]any{"name": "Bad", "target_tab": "bio"})
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "Public Profile is never a loot target")

		// A layout without Inventory makes the old default invalid too.
		setLayout(t, `{"tabs":[{"key":"skills"}]}`)
		rec = send(t, http.MethodPost, "/loot-tables", map[string]any{"name": "Common Drops"})
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	})

	t.Run("rolling writes into the target tab and names it in the game log", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, withContacts)

		characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
		npc, err := characterService.CreateCharacter(ctx, core.CreateCharacterRequest{
			GameID: gameID, CharacterType: "npc", Name: "Rumour Monger",
		})
		require.NoError(t, err)

		created := create(t, map[string]any{
			"name": "Townsfolk", "target_tab": "t_abc123",
			"items": []map[string]any{{"name": "Old Zadok", "data": `{"name":"Old Zadok"}`}},
		})
		rec := send(t, http.MethodPost, fmt.Sprintf("/loot-tables/%d/random/%d", created.ID, npc.ID), nil)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

		data, err := characterService.GetCharacterData(ctx, npc.ID)
		require.NoError(t, err)
		require.Len(t, data, 1)
		assert.Equal(t, "t_abc123", data[0].ModuleType)
		assert.Equal(t, "t_abc123", data[0].FieldName, "A custom tab stores under its own key")
		assert.Contains(t, data[0].FieldValue.String, "Old Zadok")

		var logType, message string
		require.NoError(t, testDB.Pool.QueryRow(ctx,
			`SELECT type, message FROM game_logs WHERE game_id = $1 ORDER BY id DESC LIMIT 1`, gameID).Scan(&logType, &message))
		assert.Equal(t, "SHEET_ENTRY_ADD", logType)
		assert.Equal(t, "Added Old Zadok to Character Rumour Monger's Contacts (Rolled: 1)", message)
	})

	t.Run("rolling on a table whose tab has left the sheet is refused", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, withContacts)
		characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
		npc, err := characterService.CreateCharacter(ctx, core.CreateCharacterRequest{
			GameID: gameID, CharacterType: "npc", Name: "Orphan Recipient",
		})
		require.NoError(t, err)
		created := create(t, map[string]any{
			"name": "Townsfolk", "target_tab": "t_abc123",
			"items": []map[string]any{{"name": "Old Zadok", "data": `{"name":"Old Zadok"}`}},
		})

		// Only reachable by a layout saved before targets existed: the editor
		// can't remove a targeted tab.
		setLayout(t, `{"tabs":[{"key":"inventory"}]}`)
		rec := send(t, http.MethodPost, fmt.Sprintf("/loot-tables/%d/random/%d", created.ID, npc.ID), nil)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())

		data, err := characterService.GetCharacterData(ctx, npc.ID)
		require.NoError(t, err)
		assert.Empty(t, data, "Nothing is written to a tab the sheet can't show")
	})

	t.Run("an empty table can be retargeted; one with contents can't", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, withContacts)

		empty := create(t, map[string]any{"name": "Empty"})
		rec := send(t, http.MethodPut, fmt.Sprintf("/loot-tables/%d", empty.ID), map[string]any{"name": "Empty", "target_tab": "t_abc123"})
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var updated tableResponse
		require.NoError(t, json.NewDecoder(rec.Body).Decode(&updated))
		assert.Equal(t, "t_abc123", updated.TargetTab)

		full := create(t, map[string]any{
			"name": "Full", "items": []map[string]any{{"name": "Rope", "data": `{"name":"Rope"}`}},
		})
		rec = send(t, http.MethodPut, fmt.Sprintf("/loot-tables/%d", full.ID), map[string]any{"name": "Full", "target_tab": "t_abc123"})
		assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())

		// A rename alone still works on a table with contents.
		rec = send(t, http.MethodPut, fmt.Sprintf("/loot-tables/%d", full.ID), map[string]any{"name": "Full Renamed"})
		assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

		rec = send(t, http.MethodPut, fmt.Sprintf("/loot-tables/%d", empty.ID), map[string]any{"name": "Empty", "target_tab": "numbers"})
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "A retarget is validated against the sheet too")
	})

	t.Run("the sheet can't drop a tab a loot table rolls into", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, withContacts)
		create(t, map[string]any{"name": "Townsfolk", "target_tab": "t_abc123"})
		create(t, map[string]any{"name": "Informants", "target_tab": "t_abc123"})

		rec := send(t, http.MethodPut, "/character-sheet", `{"tabs":[{"key":"inventory"}]}`)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		var problem struct {
			Detail string `json:"detail"`
		}
		require.NoError(t, json.NewDecoder(rec.Body).Decode(&problem))
		assert.Equal(t,
			`Contacts is used by loot tables "Townsfolk", "Informants". Retarget or delete those tables before removing the tab.`,
			problem.Detail)

		var stored string
		require.NoError(t, testDB.Pool.QueryRow(ctx, `SELECT character_sheet::text FROM games WHERE id = $1`, gameID).Scan(&stored))
		assert.Contains(t, stored, "t_abc123", "A rejected save leaves the layout alone")

		// Renaming or reordering the targeted tab is fine.
		rec = send(t, http.MethodPut, "/character-sheet", `{"tabs":[{"key":"t_abc123","label":"People","fields":[]},{"key":"inventory"}]}`)
		assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	})

	t.Run("the default layout's Inventory is guarded too", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, `{}`)
		create(t, map[string]any{"name": "Common Drops"})

		rec := send(t, http.MethodPut, "/character-sheet", `{"tabs":[{"key":"skills"},{"key":"numbers"}]}`)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), `Inventory is used by loot table \"Common Drops\"`)
	})

	t.Run("a table already pointing at a missing tab doesn't block other saves", func(t *testing.T) {
		defer clearTables(t)
		setLayout(t, `{}`)
		create(t, map[string]any{"name": "Common Drops"})
		setLayout(t, `{"tabs":[{"key":"skills"}]}`)

		rec := send(t, http.MethodPut, "/character-sheet", `{"tabs":[{"key":"skills","label":"Talents"}]}`)
		assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	})
}
