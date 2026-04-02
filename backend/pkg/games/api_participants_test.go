package games

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGameAPI_PromoteToCoGM tests POST /api/v1/games/{id}/participants/{userId}/promote-to-co-gm
func TestGameAPI_PromoteToCoGM(t *testing.T) {
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

	t.Run("GM promotes audience member to co-GM", func(t *testing.T) {
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/participants/%d/promote-to-co-gm", game.ID, audienceMember.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify the participant's role changed to co_gm
		participants, err := gameService.GetGameParticipants(context.Background(), game.ID)
		require.NoError(t, err)
		var audienceRole string
		for _, p := range participants {
			if p.UserID == int32(audienceMember.ID) {
				audienceRole = p.Role
			}
		}
		assert.Equal(t, "co_gm", audienceRole)
	})

	t.Run("non-GM player cannot promote to co-GM", func(t *testing.T) {
		// Add another audience member so there's someone to promote
		otherAudience := testDB.CreateTestUser(t, "audience2", "audience2@example.com")
		_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(otherAudience.ID), "audience")
		require.NoError(t, err)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/participants/%d/promote-to-co-gm", game.ID, otherAudience.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("cannot promote player (non-audience) to co-GM", func(t *testing.T) {
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/participants/%d/promote-to-co-gm", game.ID, player.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		// Service returns validation error which maps to 400
		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})
}

// TestGameAPI_DemoteFromCoGM tests POST /api/v1/games/{id}/participants/{userId}/demote-from-co-gm
func TestGameAPI_DemoteFromCoGM(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	coGMCandidate := testDB.CreateTestUser(t, "cogm", "cogm@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)
	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	require.NoError(t, err)

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(coGMCandidate.ID), "audience")
	require.NoError(t, err)

	// Promote coGMCandidate to co-GM first
	err = gameService.PromoteToCoGM(context.Background(), game.ID, int32(coGMCandidate.ID), int32(gm.ID))
	require.NoError(t, err)

	t.Run("GM demotes co-GM back to audience", func(t *testing.T) {
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/participants/%d/demote-from-co-gm", game.ID, coGMCandidate.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify the participant's role changed back to audience
		participants, err := gameService.GetGameParticipants(context.Background(), game.ID)
		require.NoError(t, err)
		var coGMRole string
		for _, p := range participants {
			if p.UserID == int32(coGMCandidate.ID) {
				coGMRole = p.Role
			}
		}
		assert.Equal(t, "audience", coGMRole)
	})

	t.Run("non-GM player cannot demote co-GM", func(t *testing.T) {
		// Re-promote so there's a co-GM to demote
		otherAudience := testDB.CreateTestUser(t, "audience3", "audience3@example.com")
		_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(otherAudience.ID), "audience")
		require.NoError(t, err)
		err = gameService.PromoteToCoGM(context.Background(), game.ID, int32(otherAudience.ID), int32(gm.ID))
		require.NoError(t, err)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/participants/%d/demote-from-co-gm", game.ID, otherAudience.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}
