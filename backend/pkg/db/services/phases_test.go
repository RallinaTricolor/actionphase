package db

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

func TestPhaseService_TransitionToNextPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

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

	phaseService := &PhaseService{DB: testDB.Pool}

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

func TestActionSubmissionService_SubmitAction(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	// Create game participant
	gameService := &GameService{DB: testDB.Pool}
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user.ID), "player")
	require.NoError(t, err)

	// Create and activate an action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
		Deadline:  core.TimePtr(time.Now().Add(72 * time.Hour)),
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
	require.NoError(t, err)

	t.Run("submits action successfully", func(t *testing.T) {
		user1 := testDB.CreateTestUser(t, "testuser1", "test1@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user1.ID), "player")
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user1.ID),
			Content: "I search the room for clues.",
			IsDraft: false,
		}

		action, err := actionService.SubmitAction(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, req.GameID, action.GameID)
		assert.Equal(t, req.PhaseID, action.PhaseID)
		assert.Equal(t, req.UserID, action.UserID)
		assert.Equal(t, "I search the room for clues.", action.Content)
		assert.False(t, action.IsDraft.Bool)
	})

	t.Run("saves draft action", func(t *testing.T) {
		user2 := testDB.CreateTestUser(t, "testuser2", "test2@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user2.ID), "player")
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user2.ID),
			Content: "Draft action content",
			IsDraft: true,
		}

		action, err := actionService.SubmitAction(context.Background(), req)
		require.NoError(t, err)
		assert.True(t, action.IsDraft.Bool)
		assert.False(t, action.SubmittedAt.Valid) // Drafts don't have submission time
	})
}

func TestActionSubmissionService_CreateActionResult(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	gm := testDB.CreateTestUser(t, "gmuser", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Create game participants
	gameService := &GameService{DB: testDB.Pool}
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user.ID), "player")
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
			UserID:      int32(user.ID),
			Content:     "You find a hidden key behind the painting.",
			IsPublished: false,
		}

		result, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, req.GameID, result.GameID)
		assert.Equal(t, req.PhaseID, result.PhaseID)
		assert.Equal(t, req.UserID, result.UserID)
		assert.Contains(t, result.Content, "hidden key")
		assert.False(t, result.IsPublished.Bool)
	})

	t.Run("publishes result immediately when requested", func(t *testing.T) {
		req := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(user.ID),
			Content:     "Published result content",
			IsPublished: true,
		}

		result, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)
		assert.True(t, result.IsPublished.Bool)
		assert.True(t, result.SentAt.Valid) // Published results have sent_at time
	})
}

func TestActionSubmissionService_GetSubmissionStats(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Create game participants
	gameService := &GameService{DB: testDB.Pool}
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	// Player 1 submits action
	_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
		GameID:  game.ID,
		PhaseID: phase.ID,
		UserID:  int32(player1.ID),
		Content: "Action from player 1",
		IsDraft: false,
	})
	require.NoError(t, err)

	// Player 2 saves draft
	_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
		GameID:  game.ID,
		PhaseID: phase.ID,
		UserID:  int32(player2.ID),
		Content: "Draft from player 2",
		IsDraft: true,
	})
	require.NoError(t, err)

	t.Run("calculates submission stats correctly", func(t *testing.T) {
		stats, err := actionService.GetSubmissionStats(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Equal(t, int32(2), stats.TotalPlayers)   // 2 players in game
		assert.Equal(t, int32(1), stats.SubmittedCount) // 1 submitted action
		assert.Equal(t, int32(1), stats.DraftCount)     // 1 draft
		assert.Equal(t, 50.0, stats.SubmissionRate)     // 50% submission rate
		assert.NotNil(t, stats.LatestSubmission)
	})
}

// Helper functions

// Use core.TimePtr instead of local helper

func durationPtr(d time.Duration) *time.Duration {
	return &d
}
