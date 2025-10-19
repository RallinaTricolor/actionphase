package actions

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phases "actionphase/pkg/db/services/phases"

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
