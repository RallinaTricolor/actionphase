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

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

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

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

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
}
