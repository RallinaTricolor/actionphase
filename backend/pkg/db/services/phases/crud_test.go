package phases

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_CreatePhase(t *testing.T) {
	suite := db.NewTestSuite(t).
		WithCleanup("phases").
		Setup()
	defer suite.Cleanup()

	phaseService := &PhaseService{DB: suite.Pool()}
	factory := suite.Factory()

	// Create test user once for all subtests
	user := factory.NewUser().Create()

	t.Run("creates phase successfully", func(t *testing.T) {
		game := factory.NewGame().WithGM(user.ID).Create()

		// Using PhaseBuilder instead of CreatePhaseRequest
		phase := factory.NewPhase().
			InGame(game).
			CommonRoom().
			WithTitle("Opening Scene").
			WithDescription("The adventure begins...").
			WithTimeRange(48 * time.Hour).
			Create()

		assert.Equal(t, game.ID, phase.GameID)
		assert.Equal(t, "common_room", phase.PhaseType)
		assert.Equal(t, "Opening Scene", phase.Title)
		assert.True(t, phase.Description.Valid)
		assert.Equal(t, "The adventure begins...", phase.Description.String)
	})

	t.Run("assigns sequential phase numbers", func(t *testing.T) {
		game := factory.NewGame().WithGM(user.ID).Create()

		// Using fluent builders with auto-increment
		phase1 := factory.NewPhase().
			InGame(game).
			CommonRoom().
			WithTitle("Phase 1").
			Create()

		phase2 := factory.NewPhase().
			InGame(game).
			ActionPhase().
			WithTitle("Phase 2").
			Create()

		assert.Equal(t, phase1.PhaseNumber+1, phase2.PhaseNumber)
	})

	t.Run("validates phase type", func(t *testing.T) {
		game := factory.NewGame().WithGM(user.ID).Create()

		// Still need to use service for validation tests
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "invalid_type",
			Title:     "Invalid Phase",
		}

		_, err := phaseService.CreatePhase(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid phase type")
	})

	t.Run("blocks phase creation in completed game", func(t *testing.T) {
		game := factory.NewGame().WithGM(user.ID).WithState(core.GameStateCompleted).Create()

		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Should Fail",
		}

		_, err := phaseService.CreatePhase(context.Background(), req)
		require.Error(t, err, "Expected error when creating phase in completed game")
		assert.Contains(t, err.Error(), "archived", "Error should mention game is archived")
	})

	t.Run("blocks phase creation in cancelled game", func(t *testing.T) {
		game := factory.NewGame().WithGM(user.ID).WithState(core.GameStateCancelled).Create()

		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Should Fail",
		}

		_, err := phaseService.CreatePhase(context.Background(), req)
		require.Error(t, err, "Expected error when creating phase in cancelled game")
		assert.Contains(t, err.Error(), "archived", "Error should mention game is archived")
	})
}

func TestPhaseService_GetActivePhase(t *testing.T) {
	suite := db.NewTestSuite(t).
		WithCleanup("phases").
		Setup()
	defer suite.Cleanup()

	phaseService := &PhaseService{DB: suite.Pool()}
	factory := suite.Factory()

	// Create test data once
	user := factory.NewUser().Create()
	game := factory.NewGame().WithGM(user.ID).Create()

	t.Run("returns nil when no active phase", func(t *testing.T) {
		phase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Nil(t, phase)
	})

	t.Run("returns active phase", func(t *testing.T) {
		// Using builder with .Active() instead of manual activation
		createdPhase := factory.NewPhase().
			InGame(game).
			CommonRoom().
			WithTitle("Active Phase").
			Active().
			Create()

		// Get active phase
		activePhase, err := phaseService.GetActivePhase(context.Background(), game.ID)
		require.NoError(t, err)
		require.NotNil(t, activePhase)
		assert.Equal(t, createdPhase.ID, activePhase.ID)
		assert.True(t, activePhase.IsActive.Bool)
	})
}

func TestPhaseService_GetGamePhases(t *testing.T) {
	suite := db.NewTestSuite(t).
		WithCleanup("phases").
		Setup()
	defer suite.Cleanup()

	phaseService := &PhaseService{DB: suite.Pool()}
	factory := suite.Factory()

	// Create test data
	user := factory.NewUser().Create()
	game := factory.NewGame().WithGM(user.ID).Create()

	t.Run("returns empty list when no phases exist", func(t *testing.T) {
		phases, err := phaseService.GetGamePhases(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Empty(t, phases)
	})

	t.Run("returns all phases for a game", func(t *testing.T) {
		// Using concise builders instead of verbose CreatePhaseRequest
		phase1 := factory.NewPhase().
			InGame(game).
			CommonRoom().
			WithTitle("Phase 1").
			Create()

		phase2 := factory.NewPhase().
			InGame(game).
			ActionPhase().
			WithTitle("Phase 2").
			Create()

		// Get all phases
		phases, err := phaseService.GetGamePhases(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Len(t, phases, 2)
		assert.Equal(t, phase1.ID, phases[0].ID)
		assert.Equal(t, phase2.ID, phases[1].ID)
	})
}

func TestPhaseService_UpdatePhase(t *testing.T) {
	suite := db.NewTestSuite(t).
		WithCleanup("phases").
		Setup()
	defer suite.Cleanup()

	phaseService := &PhaseService{DB: suite.Pool()}
	factory := suite.Factory()

	// Create test data
	user := factory.NewUser().Create()
	game := factory.NewGame().WithGM(user.ID).Create()

	// Create a phase using builder
	phase := factory.NewPhase().
		InGame(game).
		CommonRoom().
		WithTitle("Original Title").
		Create()

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

	t.Run("sets start_time when provided", func(t *testing.T) {
		future := time.Now().Add(2 * time.Hour)
		updateReq := core.UpdatePhaseRequest{
			ID:        phase.ID,
			StartTime: core.TimePtr(future),
		}

		updatedPhase, err := phaseService.UpdatePhase(context.Background(), updateReq)
		require.NoError(t, err)
		assert.True(t, updatedPhase.StartTime.Valid, "start_time should be set")
		assert.WithinDuration(t, future, updatedPhase.StartTime.Time, time.Second)
	})

	t.Run("clears start_time when set to nil", func(t *testing.T) {
		// First set a start_time
		future := time.Now().Add(2 * time.Hour)
		_, err := phaseService.UpdatePhase(context.Background(), core.UpdatePhaseRequest{
			ID:        phase.ID,
			StartTime: core.TimePtr(future),
		})
		require.NoError(t, err)

		// Now clear it by passing nil
		updatedPhase, err := phaseService.UpdatePhase(context.Background(), core.UpdatePhaseRequest{
			ID:        phase.ID,
			StartTime: nil,
		})
		require.NoError(t, err)
		assert.False(t, updatedPhase.StartTime.Valid, "start_time should be cleared when nil is passed")
	})
}

func TestPhaseService_DeletePhase(t *testing.T) {
	suite := db.NewTestSuite(t).
		WithCleanup("phases").
		Setup()
	defer suite.Cleanup()

	phaseService := &PhaseService{DB: suite.Pool()}
	factory := suite.Factory()

	user := factory.NewUser().Create()
	game := factory.NewGame().WithGM(user.ID).Create()

	t.Run("deletes phase successfully when no content exists", func(t *testing.T) {
		phase := factory.NewPhase().InGame(game).CommonRoom().Create()

		err := phaseService.DeletePhase(context.Background(), phase.ID)
		require.NoError(t, err)

		// Verify phase was deleted
		_, err = phaseService.GetPhase(context.Background(), phase.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "phase not found")
	})

	t.Run("fails when validation fails due to associated content", func(t *testing.T) {
		phase := factory.NewPhase().InGame(game).ActionPhase().Create()
		player := factory.NewUser().Create()

		// Create action submission to block deletion
		factory.NewActionSubmission().
			InGame(game).
			InPhase(phase).
			ByUser(player).
			Create()

		err := phaseService.DeletePhase(context.Background(), phase.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "action submission(s) exist")

		// Verify phase was NOT deleted
		existingPhase, err := phaseService.GetPhase(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Equal(t, phase.ID, existingPhase.ID)
	})

	t.Run("cascades deletion correctly", func(t *testing.T) {
		// Create multiple phases and ensure only the target is deleted
		phase1 := factory.NewPhase().InGame(game).CommonRoom().WithTitle("Phase 1").Create()
		phase2 := factory.NewPhase().InGame(game).CommonRoom().WithTitle("Phase 2").Create()
		phase3 := factory.NewPhase().InGame(game).CommonRoom().WithTitle("Phase 3").Create()

		// Delete middle phase
		err := phaseService.DeletePhase(context.Background(), phase2.ID)
		require.NoError(t, err)

		// Verify phase1 and phase3 still exist
		_, err = phaseService.GetPhase(context.Background(), phase1.ID)
		require.NoError(t, err)

		_, err = phaseService.GetPhase(context.Background(), phase3.ID)
		require.NoError(t, err)

		// Verify phase2 is deleted
		_, err = phaseService.GetPhase(context.Background(), phase2.ID)
		require.Error(t, err)
	})
}
