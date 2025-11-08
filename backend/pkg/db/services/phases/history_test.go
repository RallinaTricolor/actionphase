package phases

import (
	"context"
	"testing"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_GetPhaseHistory(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("returns empty list when no transitions exist", func(t *testing.T) {
		history, err := phaseService.GetPhaseHistory(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Empty(t, history)
	})

	t.Run("returns phase transition history", func(t *testing.T) {
		// Transition to first phase
		req1 := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Common Room Phase",
			Reason:    "Starting the game",
		}
		_, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req1)
		require.NoError(t, err)

		// Transition to action phase
		req2 := core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase",
			Reason:    "Moving to actions",
		}
		_, err = phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req2)
		require.NoError(t, err)

		// Get history
		history, err := phaseService.GetPhaseHistory(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Len(t, history, 2)
		assert.Equal(t, "Starting the game", history[0].Reason)
		assert.Equal(t, "Moving to actions", history[1].Reason)
		assert.Equal(t, int32(user.ID), history[0].InitiatedBy)
	})
}
