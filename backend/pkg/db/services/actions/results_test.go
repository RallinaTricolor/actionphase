package actions

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phases "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestActionSubmissionService_CreateActionResult(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	t.Run("creates action result successfully", func(t *testing.T) {
		req := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "You find a mysterious key.",
			IsPublished: false,
		}

		result, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, req.GameID, result.GameID)
		assert.Equal(t, req.PhaseID, result.PhaseID)
		assert.Equal(t, req.UserID, result.UserID)
		assert.Equal(t, "You find a mysterious key.", result.Content)
		assert.False(t, result.IsPublished.Bool)
	})

	t.Run("publishes action result", func(t *testing.T) {
		// Create unpublished result
		createReq := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Result to publish",
			IsPublished: false,
		}
		result, err := actionService.CreateActionResult(context.Background(), createReq)
		require.NoError(t, err)

		// Publish it
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify published
		published, err := actionService.GetActionResult(context.Background(), result.ID)
		require.NoError(t, err)
		assert.True(t, published.IsPublished.Bool)
	})
}

func TestActionSubmissionService_ActionResultOperations(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	t.Run("updates unpublished result", func(t *testing.T) {
		// Create result
		createReq := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Original content",
			IsPublished: false,
		}
		result, err := actionService.CreateActionResult(context.Background(), createReq)
		require.NoError(t, err)

		// Update it
		updated, err := actionService.UpdateActionResult(context.Background(), result.ID, "Updated content")
		require.NoError(t, err)
		assert.Equal(t, "Updated content", updated.Content)
	})

	t.Run("gets unpublished results count", func(t *testing.T) {
		// Create some unpublished results
		for i := 0; i < 3; i++ {
			createReq := core.CreateActionResultRequest{
				GameID:      game.ID,
				PhaseID:     phase.ID,
				UserID:      int32(player.ID),
				Content:     "Unpublished result",
				IsPublished: false,
			}
			_, err := actionService.CreateActionResult(context.Background(), createReq)
			require.NoError(t, err)
		}

		count, err := actionService.GetUnpublishedResultsCount(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, count, int64(3))
	})

	t.Run("returns error when updating published result", func(t *testing.T) {
		// Create and publish a result
		createReq := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Published result",
			IsPublished: false,
		}
		result, err := actionService.CreateActionResult(context.Background(), createReq)
		require.NoError(t, err)

		// Publish it
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Try to update published result
		_, err = actionService.UpdateActionResult(context.Background(), result.ID, "Trying to update published result")
		require.Error(t, err, "Should not be able to update published result")
		assert.Contains(t, err.Error(), "result not found or already published")
	})

	t.Run("returns error when updating non-existent result", func(t *testing.T) {
		nonExistentID := int32(999999)
		_, err := actionService.UpdateActionResult(context.Background(), nonExistentID, "Update non-existent")
		require.Error(t, err, "Should error when result doesn't exist")
		assert.Contains(t, err.Error(), "result not found or already published")
	})

	t.Run("returns error when getting non-existent result", func(t *testing.T) {
		nonExistentID := int32(999999)
		_, err := actionService.GetActionResult(context.Background(), nonExistentID)
		require.Error(t, err, "Should error when result doesn't exist")
		assert.Contains(t, err.Error(), "action result not found")
	})
}

func TestActionSubmissionService_GetUserPhaseResults(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create action phase
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	})
	require.NoError(t, err)

	t.Run("returns all results for user (both published and unpublished)", func(t *testing.T) {
		// Create 1 published and 1 unpublished result for this user
		_, err := actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Published result",
			IsPublished: true,
		})
		require.NoError(t, err)

		_, err = actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Unpublished result",
			IsPublished: false,
		})
		require.NoError(t, err)

		// Get user's results - should return both published and unpublished
		results, err := actionService.GetUserPhaseResults(context.Background(), phase.ID, int32(player.ID))
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(results), 2, "Should return at least 2 results")

		// Verify we have both published and unpublished
		hasPublished := false
		hasUnpublished := false
		for _, r := range results {
			if r.IsPublished.Bool {
				hasPublished = true
			} else {
				hasUnpublished = true
			}
		}
		assert.True(t, hasPublished, "Should have at least one published result")
		assert.True(t, hasUnpublished, "Should have at least one unpublished result")
	})

	t.Run("filters by user and phase correctly", func(t *testing.T) {
		game2 := testDB.CreateTestGame(t, int32(gm.ID), "Test Game 2")
		player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game2.ID, int32(player2.ID), "player")
		require.NoError(t, err)
		_, err = gameService.AddGameParticipant(context.Background(), game2.ID, int32(player3.ID), "player")
		require.NoError(t, err)

		phase2, err := phaseService.TransitionToNextPhase(context.Background(), game2.ID, int32(gm.ID), core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase 2",
		})
		require.NoError(t, err)

		// Create result for player2
		_, err = actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID:      game2.ID,
			PhaseID:     phase2.ID,
			UserID:      int32(player2.ID),
			Content:     "Result for player 2",
			IsPublished: false,
		})
		require.NoError(t, err)

		// Create result for player3
		_, err = actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID:      game2.ID,
			PhaseID:     phase2.ID,
			UserID:      int32(player3.ID),
			Content:     "Result for player 3",
			IsPublished: false,
		})
		require.NoError(t, err)

		// Get player2's results - should only return player2's result
		results, err := actionService.GetUserPhaseResults(context.Background(), phase2.ID, int32(player2.ID))
		require.NoError(t, err)
		assert.Len(t, results, 1, "Should return exactly 1 result for player2")
		assert.Equal(t, int32(player2.ID), results[0].UserID, "Result should belong to player2")
	})

	t.Run("returns empty list when no results exist", func(t *testing.T) {
		newPlayer := testDB.CreateTestUser(t, "newplayer", "newplayer@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(newPlayer.ID), "player")
		require.NoError(t, err)

		// Get results for player with no results
		results, err := actionService.GetUserPhaseResults(context.Background(), phase.ID, int32(newPlayer.ID))
		require.NoError(t, err)
		assert.Empty(t, results, "Should return empty list when no results exist")
	})
}

func TestActionSubmissionService_PublishAllPhaseResults(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Create action phase
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	})
	require.NoError(t, err)

	t.Run("publishes all unpublished results for a phase", func(t *testing.T) {
		// Create 3 players with unpublished results
		for i := 1; i <= 3; i++ {
			player := testDB.CreateTestUser(t, "publish_player_"+string(rune(i+'0')), "publish_player_"+string(rune(i+'0'))+"@example.com")
			_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
			require.NoError(t, err)

			_, err = actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
				GameID:      game.ID,
				PhaseID:     phase.ID,
				UserID:      int32(player.ID),
				Content:     "Unpublished result",
				IsPublished: false,
			})
			require.NoError(t, err)
		}

		// Verify we have unpublished results
		countBefore, err := actionService.GetUnpublishedResultsCount(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, countBefore, int64(3), "Should have at least 3 unpublished results")

		// Publish all
		err = actionService.PublishAllPhaseResults(context.Background(), phase.ID)
		require.NoError(t, err)

		// Verify all are published
		countAfter, err := actionService.GetUnpublishedResultsCount(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), countAfter, "Should have 0 unpublished results after publishing all")
	})

	t.Run("does not affect other phases", func(t *testing.T) {
		game2 := testDB.CreateTestGame(t, int32(gm.ID), "Test Game 2")
		player := testDB.CreateTestUser(t, "isolate_player", "isolate_player@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game2.ID, int32(player.ID), "player")
		require.NoError(t, err)

		// Create phase 1 and phase 2
		phase1, err := phaseService.TransitionToNextPhase(context.Background(), game2.ID, int32(gm.ID), core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Phase 1",
		})
		require.NoError(t, err)

		// Create unpublished result in phase 1
		_, err = actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID:      game2.ID,
			PhaseID:     phase1.ID,
			UserID:      int32(player.ID),
			Content:     "Result in phase 1",
			IsPublished: false,
		})
		require.NoError(t, err)

		// Transition to phase 2
		phase2, err := phaseService.TransitionToNextPhase(context.Background(), game2.ID, int32(gm.ID), core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Phase 2",
		})
		require.NoError(t, err)

		// Create unpublished result in phase 2
		_, err = actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID:      game2.ID,
			PhaseID:     phase2.ID,
			UserID:      int32(player.ID),
			Content:     "Result in phase 2",
			IsPublished: false,
		})
		require.NoError(t, err)

		// Publish all in phase 1
		err = actionService.PublishAllPhaseResults(context.Background(), phase1.ID)
		require.NoError(t, err)

		// Verify phase 1 has 0 unpublished
		count1, err := actionService.GetUnpublishedResultsCount(context.Background(), phase1.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count1, "Phase 1 should have 0 unpublished results")

		// Verify phase 2 still has 1 unpublished
		count2, err := actionService.GetUnpublishedResultsCount(context.Background(), phase2.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count2, "Phase 2 should still have 1 unpublished result")
	})

	t.Run("handles empty phase gracefully", func(t *testing.T) {
		emptyGame := testDB.CreateTestGame(t, int32(gm.ID), "Empty Game")
		emptyPhase, err := phaseService.TransitionToNextPhase(context.Background(), emptyGame.ID, int32(gm.ID), core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Empty Phase",
		})
		require.NoError(t, err)

		// Try to publish all in empty phase (should not error)
		err = actionService.PublishAllPhaseResults(context.Background(), emptyPhase.ID)
		require.NoError(t, err)

		// Verify still 0 unpublished
		count, err := actionService.GetUnpublishedResultsCount(context.Background(), emptyPhase.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count, "Empty phase should have 0 unpublished results")
	})
}
