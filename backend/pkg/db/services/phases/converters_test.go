package phases

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_ConvertPhaseToResponse(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("converts phase to response correctly", func(t *testing.T) {
		// Create a phase
		req := core.CreatePhaseRequest{
			GameID:      game.ID,
			PhaseType:   "common_room",
			PhaseNumber: 1,
			Title:       "Test Phase",
			Description: "Test description",
			StartTime:   core.TimePtr(time.Now()),
			EndTime:     core.TimePtr(time.Now().Add(24 * time.Hour)),
			Deadline:    core.TimePtr(time.Now().Add(48 * time.Hour)),
		}
		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)

		// Convert to response
		response := phaseService.ConvertPhaseToResponse(phase)

		assert.Equal(t, phase.ID, response.ID)
		assert.Equal(t, phase.GameID, response.GameID)
		assert.Equal(t, phase.PhaseType, response.PhaseType)
		assert.Equal(t, phase.PhaseNumber, response.PhaseNumber)
		assert.NotNil(t, response.Title)
		assert.Equal(t, "Test Phase", *response.Title)
		assert.NotNil(t, response.Description)
		assert.Equal(t, "Test description", *response.Description)
		assert.NotNil(t, response.EndTime)
		assert.NotNil(t, response.Deadline)
	})
}
