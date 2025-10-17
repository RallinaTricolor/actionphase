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

	t.Run("returns error when user is not a participant", func(t *testing.T) {
		outsider := testDB.CreateTestUser(t, "outsider", "outsider@example.com")

		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(outsider.ID),
			Content: "Trying to submit without permission",
			IsDraft: false,
		}

		_, err := actionService.SubmitAction(context.Background(), req)
		require.Error(t, err) // Verify error occurs (permission denied)
	})

	t.Run("submits action with character successfully", func(t *testing.T) {
		// Create a character service and character for testing
		charService := &CharacterService{DB: testDB.Pool}
		user3 := testDB.CreateTestUser(t, "testuser3", "test3@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user3.ID), "player")
		require.NoError(t, err)

		charReq := CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        core.Int32Ptr(int32(user3.ID)),
			Name:          "Test Character",
			CharacterType: "player_character",
		}
		character, err := charService.CreateCharacter(context.Background(), charReq)
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(user3.ID),
			CharacterID: &character.ID,
			Content:     "Action with character",
			IsDraft:     false,
		}

		action, err := actionService.SubmitAction(context.Background(), req)
		require.NoError(t, err)
		assert.NotNil(t, action)
		assert.True(t, action.CharacterID.Valid)
		assert.Equal(t, character.ID, action.CharacterID.Int32)
	})

	t.Run("returns error when character does not exist", func(t *testing.T) {
		user4 := testDB.CreateTestUser(t, "testuser4", "test4@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user4.ID), "player")
		require.NoError(t, err)

		nonExistentCharID := int32(99999)
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(user4.ID),
			CharacterID: &nonExistentCharID,
			Content:     "Action with non-existent character",
			IsDraft:     false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "character not found")
	})

	t.Run("returns error when character does not belong to user", func(t *testing.T) {
		// Create character service and two users
		charService := &CharacterService{DB: testDB.Pool}
		user5 := testDB.CreateTestUser(t, "testuser5", "test5@example.com")
		user6 := testDB.CreateTestUser(t, "testuser6", "test6@example.com")

		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user5.ID), "player")
		require.NoError(t, err)
		_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(user6.ID), "player")
		require.NoError(t, err)

		// Create character for user5
		charReq := CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        core.Int32Ptr(int32(user5.ID)),
			Name:          "User5 Character",
			CharacterType: "player_character",
		}
		character, err := charService.CreateCharacter(context.Background(), charReq)
		require.NoError(t, err)

		// Try to submit action as user6 with user5's character
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(user6.ID),
			CharacterID: &character.ID,
			Content:     "Trying to use someone else's character",
			IsDraft:     false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "you can only submit actions for characters you own")
	})

	t.Run("returns error when character belongs to different game", func(t *testing.T) {
		// Create character service and another game
		charService := &CharacterService{DB: testDB.Pool}
		user7 := testDB.CreateTestUser(t, "testuser7", "test7@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user7.ID), "player")
		require.NoError(t, err)

		// Create a different game
		otherGame := testDB.CreateTestGame(t, int32(user.ID), "Other Game")

		// Create character in the other game
		charReq := CreateCharacterRequest{
			GameID:        otherGame.ID,
			UserID:        core.Int32Ptr(int32(user7.ID)),
			Name:          "Character in Other Game",
			CharacterType: "player_character",
		}
		character, err := charService.CreateCharacter(context.Background(), charReq)
		require.NoError(t, err)

		// Try to submit action in original game with character from other game
		req := core.SubmitActionRequest{
			GameID:      game.ID, // Original game
			PhaseID:     phase.ID,
			UserID:      int32(user7.ID),
			CharacterID: &character.ID, // Character from other game
			Content:     "Cross-game character usage attempt",
			IsDraft:     false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "character does not belong to this game")
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

func TestPhaseService_GetPhaseHistory(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

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

func TestPhaseService_ExtendPhaseDeadline(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	// Create a phase with deadline
	originalDeadline := time.Now().Add(24 * time.Hour)
	req := core.CreatePhaseRequest{
		GameID:    game.ID,
		PhaseType: "action",
		Title:     "Action Phase",
		Deadline:  &originalDeadline,
	}
	phase, err := phaseService.CreatePhase(context.Background(), req)
	require.NoError(t, err)

	t.Run("extends phase deadline successfully", func(t *testing.T) {
		newDeadline := time.Now().Add(72 * time.Hour)
		updatedPhase, err := phaseService.ExtendPhaseDeadline(context.Background(), phase.ID, newDeadline)
		require.NoError(t, err)
		assert.True(t, updatedPhase.Deadline.Valid)
		assert.True(t, updatedPhase.Deadline.Time.After(originalDeadline))
	})
}

func TestPhaseService_PermissionChecks(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	t.Run("CanUserManagePhases - GM can manage phases", func(t *testing.T) {
		canManage, err := phaseService.CanUserManagePhases(context.Background(), game.ID, int32(gm.ID))
		require.NoError(t, err)
		assert.True(t, canManage)
	})

	t.Run("CanUserManagePhases - player cannot manage phases", func(t *testing.T) {
		canManage, err := phaseService.CanUserManagePhases(context.Background(), game.ID, int32(player.ID))
		require.NoError(t, err)
		assert.False(t, canManage)
	})

	t.Run("CanUserSubmitActions - participant can submit", func(t *testing.T) {
		canSubmit, err := phaseService.CanUserSubmitActions(context.Background(), game.ID, int32(player.ID))
		require.NoError(t, err)
		assert.True(t, canSubmit)
	})

	t.Run("CanUserSubmitActions - non-participant cannot submit", func(t *testing.T) {
		nonParticipant := testDB.CreateTestUser(t, "outsider", "outsider@example.com")
		canSubmit, err := phaseService.CanUserSubmitActions(context.Background(), game.ID, int32(nonParticipant.ID))
		require.NoError(t, err)
		assert.False(t, canSubmit)
	})
}

func TestActionSubmissionService_GetActionSubmission(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user.ID), "player")
	require.NoError(t, err)

	// Create and activate action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
	require.NoError(t, err)

	t.Run("returns error when submission does not exist", func(t *testing.T) {
		_, err := actionService.GetActionSubmission(context.Background(), 99999)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("returns action submission by ID", func(t *testing.T) {
		// Submit an action
		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user.ID),
			Content: "Test action content",
			IsDraft: false,
		}
		submitted, err := actionService.SubmitAction(context.Background(), req)
		require.NoError(t, err)

		// Get the submission
		retrieved, err := actionService.GetActionSubmission(context.Background(), submitted.ID)
		require.NoError(t, err)
		assert.Equal(t, submitted.ID, retrieved.ID)
		assert.Equal(t, "Test action content", retrieved.Content)
	})
}

func TestActionSubmissionService_GetUserPhaseSubmission(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user.ID), "player")
	require.NoError(t, err)

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
	require.NoError(t, err)

	t.Run("returns nil when user has no submission", func(t *testing.T) {
		submission, err := actionService.GetUserPhaseSubmission(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.Nil(t, submission)
	})

	t.Run("returns user's submission for phase", func(t *testing.T) {
		// Submit an action
		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user.ID),
			Content: "My action",
			IsDraft: false,
		}
		_, err := actionService.SubmitAction(context.Background(), req)
		require.NoError(t, err)

		// Get the submission
		submission, err := actionService.GetUserPhaseSubmission(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		require.NotNil(t, submission)
		assert.Equal(t, "My action", submission.Content)
	})
}

func TestActionSubmissionService_GetPhaseSubmissions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

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

	t.Run("returns empty list when no submissions", func(t *testing.T) {
		submissions, err := actionService.GetPhaseSubmissions(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Empty(t, submissions)
	})

	t.Run("returns all phase submissions", func(t *testing.T) {
		// Player 1 submits
		req1 := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player1.ID),
			Content: "Player 1 action",
			IsDraft: false,
		}
		_, err := actionService.SubmitAction(context.Background(), req1)
		require.NoError(t, err)

		// Player 2 submits draft
		req2 := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player2.ID),
			Content: "Player 2 draft",
			IsDraft: true,
		}
		_, err = actionService.SubmitAction(context.Background(), req2)
		require.NoError(t, err)

		// Get all submissions
		submissions, err := actionService.GetPhaseSubmissions(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Len(t, submissions, 2)
	})
}

func TestActionSubmissionService_DeleteActionSubmission(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user.ID), "player")
	require.NoError(t, err)

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
	require.NoError(t, err)

	t.Run("deletes action submission successfully", func(t *testing.T) {
		// Submit an action
		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user.ID),
			Content: "Action to delete",
			IsDraft: true,
		}
		submitted, err := actionService.SubmitAction(context.Background(), req)
		require.NoError(t, err)

		// Delete the submission
		err = actionService.DeleteActionSubmission(context.Background(), submitted.ID, int32(user.ID))
		require.NoError(t, err)

		// Verify it's deleted
		_, err = actionService.GetActionSubmission(context.Background(), submitted.ID)
		assert.Error(t, err)
	})
}

func TestActionSubmissionService_ActionResultOperations(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

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

	t.Run("GetActionResult - retrieves result by ID", func(t *testing.T) {
		// Create a result
		req := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "You successfully search the room.",
			IsPublished: false,
		}
		created, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)

		// Get the result
		retrieved, err := actionService.GetActionResult(context.Background(), created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Contains(t, retrieved.Content, "search the room")
	})

	t.Run("GetActionResult - returns error for non-existent result", func(t *testing.T) {
		_, err := actionService.GetActionResult(context.Background(), 99999)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("GetUserPhaseResults - returns user's results for phase", func(t *testing.T) {
		// Create multiple results
		req1 := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Result 1",
			IsPublished: true,
		}
		_, err := actionService.CreateActionResult(context.Background(), req1)
		require.NoError(t, err)

		req2 := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Result 2",
			IsPublished: false,
		}
		_, err = actionService.CreateActionResult(context.Background(), req2)
		require.NoError(t, err)

		// Get user's results
		results, err := actionService.GetUserPhaseResults(context.Background(), phase.ID, int32(player.ID))
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(results), 2)
	})

	t.Run("UpdateActionResult - updates unpublished result", func(t *testing.T) {
		// Create unpublished result
		req := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Original content",
			IsPublished: false,
		}
		created, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)

		// Update the result
		updated, err := actionService.UpdateActionResult(context.Background(), created.ID, "Updated content")
		require.NoError(t, err)
		assert.Equal(t, "Updated content", updated.Content)
	})

	t.Run("PublishActionResult - publishes single result", func(t *testing.T) {
		// Create unpublished result
		req := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Result to publish",
			IsPublished: false,
		}
		created, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)

		// Publish it
		err = actionService.PublishActionResult(context.Background(), created.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify it's published
		published, err := actionService.GetActionResult(context.Background(), created.ID)
		require.NoError(t, err)
		assert.True(t, published.IsPublished.Bool)
	})

	t.Run("GetUnpublishedResultsCount - counts unpublished results", func(t *testing.T) {
		// Create unpublished result
		req := core.CreateActionResultRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			Content:     "Unpublished result",
			IsPublished: false,
		}
		_, err := actionService.CreateActionResult(context.Background(), req)
		require.NoError(t, err)

		// Get count
		count, err := actionService.GetUnpublishedResultsCount(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Greater(t, count, int64(0))
	})

	t.Run("PublishAllPhaseResults - publishes all results for phase", func(t *testing.T) {
		// Publish all results
		err := actionService.PublishAllPhaseResults(context.Background(), phase.ID)
		require.NoError(t, err)

		// Verify count is now zero
		count, err := actionService.GetUnpublishedResultsCount(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})
}

func TestActionSubmissionService_CanUserSubmitAction(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &PhaseService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("returns false for inactive phase", func(t *testing.T) {
		// Create inactive phase
		req := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Inactive Phase",
		}
		phase, err := phaseService.CreatePhase(context.Background(), req)
		require.NoError(t, err)

		canSubmit, err := actionService.CanUserSubmitAction(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.False(t, canSubmit)
	})

	t.Run("returns false for active common_room phase", func(t *testing.T) {
		// Create and activate common_room phase
		req := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Common Room",
		}
		phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req)
		require.NoError(t, err)

		canSubmit, err := actionService.CanUserSubmitAction(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.False(t, canSubmit)
	})

	t.Run("returns true for active action phase", func(t *testing.T) {
		// Create and activate action phase
		req := core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase",
		}
		phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), req)
		require.NoError(t, err)

		canSubmit, err := actionService.CanUserSubmitAction(context.Background(), phase.ID, int32(user.ID))
		require.NoError(t, err)
		assert.True(t, canSubmit)
	})
}

func TestPhaseService_ActivateDeactivatePhaseOld(t *testing.T) {
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

	t.Run("ActivatePhaseOld activates phase", func(t *testing.T) {
		activated, err := phaseService.ActivatePhaseOld(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.NotNil(t, activated)
		assert.True(t, activated.IsActive.Bool)
	})

	t.Run("DeactivatePhaseOld deactivates phase", func(t *testing.T) {
		deactivated, err := phaseService.DeactivatePhaseOld(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.NotNil(t, deactivated)
		assert.False(t, deactivated.IsActive.Bool)
	})
}

func TestPhaseService_ActionQueryFunctions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}
	actionService := &ActionSubmissionService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

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

	// Submit actions
	_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
		GameID:  game.ID,
		PhaseID: phase.ID,
		UserID:  int32(player1.ID),
		Content: "Player 1 action",
		IsDraft: false,
	})
	require.NoError(t, err)

	_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
		GameID:  game.ID,
		PhaseID: phase.ID,
		UserID:  int32(player2.ID),
		Content: "Player 2 action",
		IsDraft: false,
	})
	require.NoError(t, err)

	t.Run("GetUserAction returns user's action for phase", func(t *testing.T) {
		action, err := phaseService.GetUserAction(context.Background(), game.ID, int32(player1.ID), phase.ID)
		require.NoError(t, err)
		require.NotNil(t, action)
		assert.Equal(t, int32(player1.ID), action.UserID)
		assert.Contains(t, action.Content, "Player 1")
	})

	t.Run("GetUserAction returns nil when no action exists", func(t *testing.T) {
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")
		action, err := phaseService.GetUserAction(context.Background(), game.ID, int32(player3.ID), phase.ID)
		require.NoError(t, err)
		assert.Nil(t, action)
	})

	t.Run("GetUserActions returns all actions by user in game", func(t *testing.T) {
		actions, err := phaseService.GetUserActions(context.Background(), game.ID, int32(player1.ID))
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(actions), 1)
	})

	t.Run("GetPhaseActions returns all actions for phase", func(t *testing.T) {
		actions, err := phaseService.GetPhaseActions(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Len(t, actions, 2)
	})

	t.Run("GetGameActions returns all actions for game", func(t *testing.T) {
		actions, err := phaseService.GetGameActions(context.Background(), game.ID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(actions), 2)
	})
}

func TestPhaseService_DeleteAction(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}
	actionService := &ActionSubmissionService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

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

	// Submit action
	_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
		GameID:  game.ID,
		PhaseID: phase.ID,
		UserID:  int32(player.ID),
		Content: "Action to delete",
		IsDraft: true,
	})
	require.NoError(t, err)

	t.Run("deletes user action successfully", func(t *testing.T) {
		// Verify action exists
		action, err := phaseService.GetUserAction(context.Background(), game.ID, int32(player.ID), phase.ID)
		require.NoError(t, err)
		require.NotNil(t, action)

		// Delete the action
		err = phaseService.DeleteAction(context.Background(), game.ID, int32(player.ID), phase.ID)
		require.NoError(t, err)

		// Verify action is deleted
		action, err = phaseService.GetUserAction(context.Background(), game.ID, int32(player.ID), phase.ID)
		require.NoError(t, err)
		assert.Nil(t, action)
	})
}

func TestPhaseService_ResultFunctions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

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

	t.Run("SendActionResult sends and publishes result", func(t *testing.T) {
		result, err := phaseService.SendActionResult(
			context.Background(),
			game.ID,
			int32(player1.ID),
			phase.ID,
			int32(gm.ID),
			"You successfully find the hidden treasure!",
		)
		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, game.ID, result.GameID)
		assert.Equal(t, int32(player1.ID), result.UserID)
		assert.Contains(t, result.Content, "treasure")
		assert.True(t, result.IsPublished.Bool) // SendActionResult publishes immediately
	})

	t.Run("GetUserResults returns results for user in game", func(t *testing.T) {
		// Send result to player1
		_, err := phaseService.SendActionResult(
			context.Background(),
			game.ID,
			int32(player1.ID),
			phase.ID,
			int32(gm.ID),
			"Result 1 for player 1",
		)
		require.NoError(t, err)

		// Get user results
		results, err := phaseService.GetUserResults(context.Background(), game.ID, int32(player1.ID))
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(results), 1)
	})

	t.Run("GetGameResults returns all results for game", func(t *testing.T) {
		// Send results to both players
		_, err := phaseService.SendActionResult(
			context.Background(),
			game.ID,
			int32(player2.ID),
			phase.ID,
			int32(gm.ID),
			"Result for player 2",
		)
		require.NoError(t, err)

		// Get game results
		results, err := phaseService.GetGameResults(context.Background(), game.ID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(results), 2)
	})
}

func TestPhaseService_ConverterFunctions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}
	actionService := &ActionSubmissionService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user.ID), "player")
	require.NoError(t, err)

	t.Run("ConvertPhaseToResponse converts phase correctly", func(t *testing.T) {
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

	t.Run("ConvertActionToResponse converts action correctly", func(t *testing.T) {
		// Create action phase
		transitionReq := core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase",
		}
		phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(user.ID), transitionReq)
		require.NoError(t, err)

		// Submit action
		submitReq := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user.ID),
			Content: "Test action content",
			IsDraft: false,
		}
		action, err := actionService.SubmitAction(context.Background(), submitReq)
		require.NoError(t, err)

		// Convert to response
		response := phaseService.ConvertActionToResponse(action)

		assert.Equal(t, action.ID, response.ID)
		assert.Equal(t, action.GameID, response.GameID)
		assert.Equal(t, action.UserID, response.UserID)
		assert.Equal(t, action.PhaseID, response.PhaseID)
		assert.Equal(t, "Test action content", response.Content)
		assert.NotZero(t, response.SubmittedAt)
		assert.NotZero(t, response.UpdatedAt)
	})
}

// Helper functions

// Use core.TimePtr instead of local helper

func durationPtr(d time.Duration) *time.Duration {
	return &d
}
