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

// TestPhaseService_TransitionErrors tests error conditions during phase transitions
func TestPhaseService_TransitionErrors(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	t.Run("fails with invalid phase type", func(t *testing.T) {
		req := core.TransitionPhaseRequest{
			PhaseType: "invalid_phase_type",
			Title:     "Invalid Phase",
			Duration:  durationPtr(24 * time.Hour),
		}

		_, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), req)
		require.Error(t, err)
		// Database constraint error contains "check constraint"
		assert.Contains(t, err.Error(), "check constraint")
	})

	t.Run("documents no permission check at service layer", func(t *testing.T) {
		// Note: Permission checking happens at HTTP handler layer
		// Service layer accepts any user ID - documents current behavior
		req := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Service Layer Transition",
			Duration:  durationPtr(24 * time.Hour),
		}

		// This succeeds because service layer doesn't validate permissions
		phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(player.ID), req)
		require.NoError(t, err)
		assert.NotNil(t, phase)
	})

	t.Run("fails with non-existent game", func(t *testing.T) {
		req := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Test Phase",
			Duration:  durationPtr(24 * time.Hour),
		}

		_, err := phaseService.TransitionToNextPhase(context.Background(), 99999, int32(gm.ID), req)
		require.Error(t, err)
		// Foreign key constraint violation
		assert.Contains(t, err.Error(), "foreign key constraint")
	})
}

// TestPhaseService_DeadlineBoundaryConditions tests deadline validation edge cases
func TestPhaseService_DeadlineBoundaryConditions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("accepts deadline in near future", func(t *testing.T) {
		nearFuture := time.Now().Add(1 * time.Hour)
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Near Future Deadline",
			Deadline:  &nearFuture,
		}
		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)
		assert.True(t, phase.Deadline.Valid)
	})

	t.Run("accepts deadline far in future", func(t *testing.T) {
		farFuture := time.Now().Add(365 * 24 * time.Hour) // 1 year
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Far Future Deadline",
			Deadline:  &farFuture,
		}
		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)
		assert.True(t, phase.Deadline.Valid)
	})

	t.Run("accepts phase without deadline for common_room", func(t *testing.T) {
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "common_room",
			Title:     "No Deadline Phase",
			Deadline:  nil,
		}
		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)
		assert.False(t, phase.Deadline.Valid)
	})

	t.Run("extension to past deadline is allowed by system", func(t *testing.T) {
		// Note: This documents current behavior - system allows past deadlines
		// Future enhancement could add validation
		originalDeadline := time.Now().Add(24 * time.Hour)
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Test Deadline Extension",
			Deadline:  &originalDeadline,
		}
		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)

		pastDeadline := time.Now().Add(-24 * time.Hour)
		updatedPhase, err := phaseService.ExtendPhaseDeadline(context.Background(), phase.ID, pastDeadline)
		// Current implementation allows this - documents behavior
		require.NoError(t, err)
		assert.True(t, updatedPhase.Deadline.Valid)
	})
}

// TestPhaseService_ActivationErrors tests activation error conditions
func TestPhaseService_ActivationErrors(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("fails to activate non-existent phase", func(t *testing.T) {
		err := phaseService.ActivatePhase(context.Background(), 99999, int32(user.ID))
		require.Error(t, err)
	})

	t.Run("deactivate with no active phase returns error", func(t *testing.T) {
		// Documents actual behavior - returns error when no phase is active
		err := phaseService.DeactivatePhase(context.Background(), game.ID, int32(user.ID))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no active phase")
	})

	t.Run("multiple activations replace previous active phase", func(t *testing.T) {
		// Create two phases
		phase1, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "common_room",
			Title:     "Phase 1",
		})
		require.NoError(t, err)

		phase2, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Phase 2",
		})
		require.NoError(t, err)

		// Activate phase 1
		err = phaseService.ActivatePhase(context.Background(), phase1.ID, int32(user.ID))
		require.NoError(t, err)

		// Activate phase 2 - should deactivate phase 1
		err = phaseService.ActivatePhase(context.Background(), phase2.ID, int32(user.ID))
		require.NoError(t, err)

		// Verify only phase 2 is active
		activePhase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Equal(t, phase2.ID, activePhase.ID)
	})
}

// Helper functions

func durationPtr(d time.Duration) *time.Duration {
	return &d
}
