package actions

import (
	"context"
	"fmt"
	"testing"
	"time"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	phases "actionphase/pkg/db/services/phases"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestActionSubmissionService_SubmitAction(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Create test data
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	// Create game participant
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

	t.Run("blocks action submission in completed game", func(t *testing.T) {
		// Create a completed game with a phase
		completedGame := testDB.CreateTestGameWithState(t, int32(user.ID), "Completed Game", core.GameStateCompleted)

		// Create participant (using test helper to bypass validation)
		testDB.AddTestGameParticipant(t, completedGame.ID, int32(user.ID), "player")

		// Create a phase (this would have been created before completion)
		// Need to manually create phase bypassing validation for test setup
		testPhase := testDB.CreateTestPhase(t, completedGame.ID, "action", "Old Phase")

		req := core.SubmitActionRequest{
			GameID:  completedGame.ID,
			PhaseID: testPhase.ID,
			UserID:  int32(user.ID),
			Content: "Should fail",
			IsDraft: false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		require.Error(t, err, "Expected error when submitting action to completed game")
		assert.Contains(t, err.Error(), "archived", "Error should mention game is archived")
	})

	t.Run("blocks action submission in cancelled game", func(t *testing.T) {
		// Create a cancelled game with a phase
		cancelledGame := testDB.CreateTestGameWithState(t, int32(user.ID), "Cancelled Game", core.GameStateCancelled)

		// Create participant (using test helper to bypass validation)
		testDB.AddTestGameParticipant(t, cancelledGame.ID, int32(user.ID), "player")

		// Create a phase
		testPhase := testDB.CreateTestPhase(t, cancelledGame.ID, "action", "Old Phase")

		req := core.SubmitActionRequest{
			GameID:  cancelledGame.ID,
			PhaseID: testPhase.ID,
			UserID:  int32(user.ID),
			Content: "Should fail",
			IsDraft: false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		require.Error(t, err, "Expected error when submitting action to cancelled game")
		assert.Contains(t, err.Error(), "archived", "Error should mention game is archived")
	})

	t.Run("validates character ownership", func(t *testing.T) {
		// Create character service to create test characters
		queries := models.New(testDB.Pool)

		// Create two players
		player1 := testDB.CreateTestUser(t, "char_player1", "char_player1@example.com")
		player2 := testDB.CreateTestUser(t, "char_player2", "char_player2@example.com")

		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
		require.NoError(t, err)
		_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
		require.NoError(t, err)

		// Create character owned by player1
		char1, err := queries.CreateCharacter(context.Background(), models.CreateCharacterParams{
			GameID:        game.ID,
			UserID:        pgtype.Int4{Int32: int32(player1.ID), Valid: true},
			Name:          "Player 1's Character",
			CharacterType: "player_character",
			Status:        pgtype.Text{String: "active", Valid: true},
		})
		require.NoError(t, err)

		// Try to submit action with player2 using player1's character
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player2.ID),
			CharacterID: &char1.ID,
			Content:     "Action with wrong character",
			IsDraft:     false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		require.Error(t, err, "Should error when using another user's character")
		assert.Contains(t, err.Error(), "you can only submit actions for characters you own")
	})

	t.Run("validates character belongs to game", func(t *testing.T) {
		queries := models.New(testDB.Pool)

		// Create another game
		game2 := testDB.CreateTestGame(t, int32(user.ID), "Another Game")
		player := testDB.CreateTestUser(t, "cross_game_player", "cross_game_player@example.com")

		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
		require.NoError(t, err)

		// Create character in game2
		charInGame2, err := queries.CreateCharacter(context.Background(), models.CreateCharacterParams{
			GameID:        game2.ID,
			UserID:        pgtype.Int4{Int32: int32(player.ID), Valid: true},
			Name:          "Character in Game 2",
			CharacterType: "player_character",
			Status:        pgtype.Text{String: "active", Valid: true},
		})
		require.NoError(t, err)

		// Try to submit action in game1 with character from game2
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			CharacterID: &charInGame2.ID,
			Content:     "Cross-game action",
			IsDraft:     false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		require.Error(t, err, "Should error when using character from different game")
		assert.Contains(t, err.Error(), "character does not belong to this game")
	})

	t.Run("returns error for non-existent character", func(t *testing.T) {
		player := testDB.CreateTestUser(t, "nonexist_char_player", "nonexist_char_player@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
		require.NoError(t, err)

		nonExistentCharID := int32(999999)
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			CharacterID: &nonExistentCharID,
			Content:     "Action with non-existent character",
			IsDraft:     false,
		}

		_, err = actionService.SubmitAction(context.Background(), req)
		require.Error(t, err, "Should error when character doesn't exist")
		assert.Contains(t, err.Error(), "character not found")
	})
}

func TestActionSubmissionService_GetActionSubmission(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

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

	// Submit an action
	submitReq := core.SubmitActionRequest{
		GameID:  game.ID,
		PhaseID: phase.ID,
		UserID:  int32(user.ID),
		Content: "Test action",
		IsDraft: false,
	}
	submission, err := actionService.SubmitAction(context.Background(), submitReq)
	require.NoError(t, err)

	t.Run("retrieves submission by ID", func(t *testing.T) {
		retrieved, err := actionService.GetActionSubmission(context.Background(), submission.ID)
		require.NoError(t, err)
		assert.Equal(t, submission.ID, retrieved.ID)
		assert.Equal(t, submission.Content, retrieved.Content)
	})

	t.Run("returns error for non-existent submission", func(t *testing.T) {
		_, err := actionService.GetActionSubmission(context.Background(), 99999)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})
}

func TestActionSubmissionService_DeleteActionSubmission(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

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

	t.Run("deletes submission successfully", func(t *testing.T) {
		// Submit an action
		submitReq := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(user.ID),
			Content: "Action to delete",
			IsDraft: true,
		}
		submission, err := actionService.SubmitAction(context.Background(), submitReq)
		require.NoError(t, err)

		// Delete it
		err = actionService.DeleteActionSubmission(context.Background(), submission.ID, int32(user.ID))
		require.NoError(t, err)

		// Verify it's gone
		_, err = actionService.GetActionSubmission(context.Background(), submission.ID)
		require.Error(t, err)
	})
}

func TestActionSubmissionService_GetSubmissionStats(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	t.Run("calculates submission stats correctly", func(t *testing.T) {
		// Add players and submissions
		player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
		player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
		require.NoError(t, err)
		_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
		require.NoError(t, err)

		// Submit one final, one draft
		_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player1.ID),
			Content: "Final action",
			IsDraft: false,
		})
		require.NoError(t, err)

		_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player2.ID),
			Content: "Draft action",
			IsDraft: true,
		})
		require.NoError(t, err)

		// Get stats
		stats, err := actionService.GetSubmissionStats(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Equal(t, int32(1), stats.SubmittedCount)
		assert.Equal(t, int32(1), stats.DraftCount)
		assert.Equal(t, int32(2), stats.TotalPlayers)
	})
}

func TestActionSubmissionService_GetUserPhaseSubmission(t *testing.T) {
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
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	})
	require.NoError(t, err)

	t.Run("returns submission when user has submitted", func(t *testing.T) {
		// Submit action
		submitted, err := actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player.ID),
			Content: "My action for this phase",
			IsDraft: false,
		})
		require.NoError(t, err)

		// Get user's phase submission
		result, err := actionService.GetUserPhaseSubmission(context.Background(), phase.ID, int32(player.ID))
		require.NoError(t, err)
		require.NotNil(t, result, "Should return submission")
		assert.Equal(t, submitted.ID, result.ID)
		assert.Equal(t, "My action for this phase", result.Content)
		assert.False(t, result.IsDraft.Bool)
	})

	t.Run("returns nil when user has not submitted", func(t *testing.T) {
		newPlayer := testDB.CreateTestUser(t, "newplayer", "newplayer@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(newPlayer.ID), "player")
		require.NoError(t, err)

		// Get submission for user who hasn't submitted
		result, err := actionService.GetUserPhaseSubmission(context.Background(), phase.ID, int32(newPlayer.ID))
		require.NoError(t, err)
		assert.Nil(t, result, "Should return nil when no submission exists")
	})

	t.Run("returns draft submission", func(t *testing.T) {
		draftPlayer := testDB.CreateTestUser(t, "draftplayer", "draftplayer@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(draftPlayer.ID), "player")
		require.NoError(t, err)

		// Submit draft
		_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(draftPlayer.ID),
			Content: "Draft action",
			IsDraft: true,
		})
		require.NoError(t, err)

		// Get user's draft submission
		result, err := actionService.GetUserPhaseSubmission(context.Background(), phase.ID, int32(draftPlayer.ID))
		require.NoError(t, err)
		require.NotNil(t, result, "Should return draft submission")
		assert.True(t, result.IsDraft.Bool)
		assert.False(t, result.SubmittedAt.Valid, "Draft should not have submission time")
	})
}

func TestActionSubmissionService_GetPhaseSubmissions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	actionService := &ActionSubmissionService{DB: testDB.Pool}
	phaseService := &phases.PhaseService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Create action phase
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	})
	require.NoError(t, err)

	t.Run("returns all submissions for a phase", func(t *testing.T) {
		// Create 3 players and have them submit
		for i := 1; i <= 3; i++ {
			player := testDB.CreateTestUser(t, fmt.Sprintf("player%d", i), fmt.Sprintf("player%d@example.com", i))
			_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
			require.NoError(t, err)

			_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
				GameID:  game.ID,
				PhaseID: phase.ID,
				UserID:  int32(player.ID),
				Content: fmt.Sprintf("Action from player %d", i),
				IsDraft: false,
			})
			require.NoError(t, err)
		}

		// Get all phase submissions
		submissions, err := actionService.GetPhaseSubmissions(context.Background(), phase.ID)
		require.NoError(t, err)
		assert.Len(t, submissions, 3, "Should return all 3 submissions")
	})

	t.Run("includes both draft and final submissions", func(t *testing.T) {
		game2 := testDB.CreateTestGame(t, int32(gm.ID), "Draft Test Game")
		phase2, err := phaseService.TransitionToNextPhase(context.Background(), game2.ID, int32(gm.ID), core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Draft Phase",
		})
		require.NoError(t, err)

		// Create 2 players: one draft, one final
		player1 := testDB.CreateTestUser(t, "draftsubmitter", "draftsubmitter@example.com")
		player2 := testDB.CreateTestUser(t, "finalsubmitter", "finalsubmitter@example.com")

		_, err = gameService.AddGameParticipant(context.Background(), game2.ID, int32(player1.ID), "player")
		require.NoError(t, err)
		_, err = gameService.AddGameParticipant(context.Background(), game2.ID, int32(player2.ID), "player")
		require.NoError(t, err)

		// Submit draft
		_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
			GameID:  game2.ID,
			PhaseID: phase2.ID,
			UserID:  int32(player1.ID),
			Content: "Draft action",
			IsDraft: true,
		})
		require.NoError(t, err)

		// Submit final
		_, err = actionService.SubmitAction(context.Background(), core.SubmitActionRequest{
			GameID:  game2.ID,
			PhaseID: phase2.ID,
			UserID:  int32(player2.ID),
			Content: "Final action",
			IsDraft: false,
		})
		require.NoError(t, err)

		// Get all submissions
		submissions, err := actionService.GetPhaseSubmissions(context.Background(), phase2.ID)
		require.NoError(t, err)
		assert.Len(t, submissions, 2, "Should return both draft and final submissions")

		// Verify one is draft, one is final
		drafts := 0
		finals := 0
		for _, s := range submissions {
			if s.IsDraft.Bool {
				drafts++
			} else {
				finals++
			}
		}
		assert.Equal(t, 1, drafts, "Should have 1 draft")
		assert.Equal(t, 1, finals, "Should have 1 final submission")
	})

	t.Run("returns empty list when no submissions exist", func(t *testing.T) {
		emptyGame := testDB.CreateTestGame(t, int32(gm.ID), "Empty Game")
		emptyPhase, err := phaseService.TransitionToNextPhase(context.Background(), emptyGame.ID, int32(gm.ID), core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Empty Phase",
		})
		require.NoError(t, err)

		// Get submissions for phase with no submissions
		submissions, err := actionService.GetPhaseSubmissions(context.Background(), emptyPhase.ID)
		require.NoError(t, err)
		assert.Empty(t, submissions, "Should return empty list when no submissions exist")
	})
}
