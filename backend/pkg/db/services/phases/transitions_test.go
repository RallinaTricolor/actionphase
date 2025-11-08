package phases

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_TransitionToNextPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	t.Run("transitions from no active phase", func(t *testing.T) {
		game := testDB.CreateTestGame(t, int32(user.ID), "Test Game 1")

		req := core.TransitionPhaseRequest{
			PhaseType:   "common_room",
			Title:       "First Phase",
			Description: "Starting the game",
			Duration:    durationPtr(48 * time.Hour),
		}

		newPhase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req)
		require.NoError(t, err)
		assert.Equal(t, req.PhaseType, newPhase.PhaseType)
		assert.Equal(t, req.Title, newPhase.Title)
		assert.True(t, newPhase.IsActive.Bool)
	})

	t.Run("transitions from active phase", func(t *testing.T) {
		game := testDB.CreateTestGame(t, int32(user.ID), "Test Game 2")

		// Create first phase
		req1 := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Common Room Phase",
			Duration:  durationPtr(24 * time.Hour),
		}
		phase1, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req1)
		require.NoError(t, err)

		// Transition to action phase
		req2 := core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase",
			Duration:  durationPtr(72 * time.Hour),
			Reason:    "Moving to action submissions",
		}
		phase2, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req2)
		require.NoError(t, err)

		// Verify phase1 is deactivated
		updatedPhase1, err := phaseService.GetPhase(context.Background(), phase1.ID)
		require.NoError(t, err)
		assert.False(t, updatedPhase1.IsActive.Bool)

		// Verify phase2 is active
		assert.True(t, phase2.IsActive.Bool)
		assert.Equal(t, phase1.PhaseNumber+1, phase2.PhaseNumber)
	})
}

func TestPhaseService_ActivateDeactivatePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	// Create a phase
	req := core.CreatePhaseRequest{
		GameID:    game.ID,
		PhaseType: "common_room",
		Title:     "Test Phase",
	}
	phase, err := phaseService.CreatePhase(context.Background(), req)
	require.NoError(t, err)

	t.Run("activate phase", func(t *testing.T) {
		err := phaseService.ActivatePhase(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)

		// Verify phase is active
		activePhase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Equal(t, phase.ID, activePhase.ID)
	})

	t.Run("deactivate phase", func(t *testing.T) {
		err := phaseService.DeactivatePhase(context.Background(), game.ID, int32(user.ID))
		require.NoError(t, err)

		// Verify no active phase
		activePhase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Nil(t, activePhase)
	})
}

// Helper functions

func durationPtr(d time.Duration) *time.Duration {
	return &d
}
