package phases

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_CreatePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test user
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	t.Run("creates phase successfully", func(t *testing.T) {
		game := testDB.CreateTestGame(t, int32(user.ID), "Test Game 1")

		req := core.CreatePhaseRequest{
			GameID:      game.ID,
			PhaseType:   "common_room",
			PhaseNumber: 1,
			Title:       "Opening Scene",
			Description: "The adventure begins...",
			StartTime:   core.TimePtr(time.Now()),
			EndTime:     core.TimePtr(time.Now().Add(48 * time.Hour)),
		}

		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, req.GameID, phase.GameID)
		assert.Equal(t, req.PhaseType, phase.PhaseType)
		assert.Equal(t, req.Title, phase.Title)
		assert.True(t, phase.Description.Valid)
		assert.Equal(t, req.Description, phase.Description.String)
	})

	t.Run("assigns sequential phase numbers", func(t *testing.T) {
		game := testDB.CreateTestGame(t, int32(user.ID), "Test Game 2")

		// Create first phase
		req1 := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "common_room",
			Title:     "Phase 1",
		}
		phase1, err := phaseService.CreatePhase(context.Background(), req1)
		require.NoError(t, err)

		// Create second phase
		req2 := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Phase 2",
		}
		phase2, err := phaseService.CreatePhase(context.Background(), req2)
		require.NoError(t, err)

		assert.Equal(t, phase1.PhaseNumber+1, phase2.PhaseNumber)
	})

	t.Run("validates phase type", func(t *testing.T) {
		game := testDB.CreateTestGame(t, int32(user.ID), "Test Game 3")

		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "invalid_type",
			Title:     "Invalid Phase",
		}

		_, err := phaseService.CreatePhase(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid phase type")
	})
}

func TestPhaseService_GetActivePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("returns nil when no active phase", func(t *testing.T) {
		phase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Nil(t, phase)
	})

	t.Run("returns active phase", func(t *testing.T) {
		// Create and activate a phase
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "common_room",
			Title:     "Active Phase",
		}
		createdPhase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)

		_, err = phaseService.activatePhaseInternal(context.Background(), createdPhase.ID)
		require.NoError(t, err)

		// Get active phase
		activePhase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		require.NotNil(t, activePhase)
		assert.Equal(t, createdPhase.ID, activePhase.ID)
		assert.True(t, activePhase.IsActive.Bool)
	})
}

func TestPhaseService_GetGamePhases(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("returns empty list when no phases exist", func(t *testing.T) {
		phases, err := phaseService.GetGamePhases(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Empty(t, phases)
	})

	t.Run("returns all phases for a game", func(t *testing.T) {
		// Create multiple phases
		req1 := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "common_room",
			Title:     "Phase 1",
		}
		phase1, err := phaseService.CreatePhase(context.Background(), req1)
		require.NoError(t, err)

		req2 := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Phase 2",
		}
		phase2, err := phaseService.CreatePhase(context.Background(), req2)
		require.NoError(t, err)

		// Get all phases
		phases, err := phaseService.GetGamePhases(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Len(t, phases, 2)
		assert.Equal(t, phase1.ID, phases[0].ID)
		assert.Equal(t, phase2.ID, phases[1].ID)
	})
}

func TestPhaseService_UpdatePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	// Create a phase
	createReq := core.CreatePhaseRequest{
		GameID:    game.ID,
		PhaseType: "common_room",
		Title:     "Original Title",
	}
	phase, err := phaseService.CreatePhase(context.Background(), createReq)
	require.NoError(t, err)

	t.Run("updates phase successfully", func(t *testing.T) {
		updateReq := core.UpdatePhaseRequest{
			ID:          phase.ID,
			Title:       "Updated Title",
			Description: "Updated description",
			EndTime:     core.TimePtr(time.Now().Add(24 * time.Hour)),
		}

		updatedPhase, err := phaseService.UpdatePhase(context.Background(), updateReq)
		require.NoError(t, err)
		assert.Equal(t, updateReq.Title, updatedPhase.Title)
		assert.Equal(t, updateReq.Description, updatedPhase.Description.String)
		assert.True(t, updatedPhase.EndTime.Valid)
	})
}
