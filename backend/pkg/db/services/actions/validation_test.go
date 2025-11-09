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

func TestActionSubmissionService_CanUserSubmitAction(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("allows submission to active action phase", func(t *testing.T) {
		// Create and activate an action phase
		transitionReq := core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase",
		}
		phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
		require.NoError(t, err)

		canSubmit, err := actionService.CanUserSubmitAction(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.True(t, canSubmit)
	})

	t.Run("disallows submission to inactive phase", func(t *testing.T) {
		// Create an inactive phase
		createReq := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Inactive Action Phase",
		}
		phase, err := phaseService.CreatePhase(context.Background(), createReq)
		require.NoError(t, err)

		canSubmit, err := actionService.CanUserSubmitAction(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.False(t, canSubmit)
	})

	t.Run("disallows submission to common_room phase", func(t *testing.T) {
		// Create and activate a common_room phase
		transitionReq := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Common Room",
		}
		phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
		require.NoError(t, err)

		canSubmit, err := actionService.CanUserSubmitAction(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.False(t, canSubmit)
	})
}
