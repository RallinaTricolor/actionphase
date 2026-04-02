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

// TestGameAPI_ListAudienceMembers tests GET /api/v1/games/{id}/audience
func TestGameAPI_ListAudienceMembers(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	audienceMember := testDB.CreateTestUser(t, "audience", "audience@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)
	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	require.NoError(t, err)

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(audienceMember.ID), "audience")
	require.NoError(t, err)

	t.Run("GM lists audience members", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/audience", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response ListAudienceMembersResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Len(t, response.AudienceMembers, 1)
		assert.Equal(t, "audience", response.AudienceMembers[0].Role)
	})

	t.Run("player can list audience members", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/audience", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response ListAudienceMembersResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Len(t, response.AudienceMembers, 1)
	})

	t.Run("empty audience when no audience members", func(t *testing.T) {
		otherGM := testDB.CreateTestUser(t, "othergm", "othergm@example.com")
		otherGMToken, err := core.CreateTestJWTTokenForUser(app, otherGM)
		require.NoError(t, err)
		emptyGame := testDB.CreateTestGame(t, int32(otherGM.ID), "Empty Audience Game")

		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/audience", emptyGame.ID), nil)
		req.Header.Set("Authorization", "Bearer "+otherGMToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response ListAudienceMembersResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Len(t, response.AudienceMembers, 0)
	})
}

// TestGameAPI_UpdateAutoAcceptAudience tests PUT /api/v1/games/{id}/settings/auto-accept-audience
func TestGameAPI_UpdateAutoAcceptAudience(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

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

	t.Run("GM enables auto-accept audience", func(t *testing.T) {
		body := UpdateAutoAcceptAudienceRequest{AutoAcceptAudience: true}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/settings/auto-accept-audience", game.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Contains(t, response["message"], "updated")

		// Verify the setting was actually changed in DB
		updatedGame, err := gameService.GetGame(context.Background(), game.ID)
		require.NoError(t, err)
		assert.True(t, updatedGame.AutoAcceptAudience)
	})

	t.Run("GM disables auto-accept audience", func(t *testing.T) {
		body := UpdateAutoAcceptAudienceRequest{AutoAcceptAudience: false}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/settings/auto-accept-audience", game.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		updatedGame, err := gameService.GetGame(context.Background(), game.ID)
		require.NoError(t, err)
		assert.False(t, updatedGame.AutoAcceptAudience)
	})

	t.Run("non-GM player cannot update auto-accept audience", func(t *testing.T) {
		body := UpdateAutoAcceptAudienceRequest{AutoAcceptAudience: true}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/settings/auto-accept-audience", game.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}
