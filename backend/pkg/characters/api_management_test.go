package characters

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

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func int32Ptr(i int32) *int32 { return &i }

// setupCharacterManagementTestRouter creates a router with character management routes
func setupCharacterManagementTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()
	router.Route("/api/v1/characters", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(core.RequireAuthenticationMiddleware(userService))

		handler := &Handler{App: app}
		r.Put("/{id}/rename", handler.RenameCharacter)
		r.Delete("/{id}", handler.DeleteCharacter)
	})
	return router
}

// TestCharacterAPI_RenameCharacter tests PUT /api/v1/characters/{id}/rename
func TestCharacterAPI_RenameCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "characters", "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterManagementTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	otherPlayer := testDB.CreateTestUser(t, "other", "other@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)
	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	require.NoError(t, err)
	otherToken, err := core.CreateTestJWTTokenForUser(app, otherPlayer)
	require.NoError(t, err)

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(otherPlayer.ID), "player")
	require.NoError(t, err)

	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	playerChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Original Name",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("owner renames their own character", func(t *testing.T) {
		body := RenameCharacterRequest{Name: "New Name"}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/characters/%d/rename", playerChar.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, "New Name", response["name"])
	})

	t.Run("GM renames a player character", func(t *testing.T) {
		body := RenameCharacterRequest{Name: "GM Renamed"}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/characters/%d/rename", playerChar.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, "GM Renamed", response["name"])
	})

	t.Run("other player cannot rename someone else's character", func(t *testing.T) {
		body := RenameCharacterRequest{Name: "Stolen Name"}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/characters/%d/rename", playerChar.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+otherToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("duplicate name returns conflict", func(t *testing.T) {
		// Create a second character with a name we'll try to duplicate
		otherChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(otherPlayer.ID)),
			Name:          "Existing Name",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		// Try to rename playerChar to the same name as otherChar
		body := RenameCharacterRequest{Name: otherChar.Name}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/characters/%d/rename", playerChar.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusConflict, rec.Code)
	})
}

// TestCharacterAPI_DeleteCharacter tests DELETE /api/v1/characters/{id}
func TestCharacterAPI_DeleteCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "characters", "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterManagementTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)
	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	require.NoError(t, err)

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("non-GM player cannot delete a character", func(t *testing.T) {
		char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player.ID)),
			Name:          "Character To Keep",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/characters/%d", char.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("GM deletes a character with no activity", func(t *testing.T) {
		char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player.ID)),
			Name:          "Character To Delete",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/characters/%d", char.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify it's gone
		_, err = characterService.GetCharacter(context.Background(), char.ID)
		assert.Error(t, err, "character should no longer exist")
	})

	t.Run("returns 404 for non-existent character", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/characters/99999", nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}
