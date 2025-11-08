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

func TestPhaseService_ExtendPhaseDeadline(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

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

	app := core.NewTestApp(testDB.Pool)

	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

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

func TestPhaseService_CanDeletePhase(t *testing.T) {
	suite := db.NewTestSuite(t).
		WithCleanup("phases").
		Setup()
	defer suite.Cleanup()

	phaseService := &PhaseService{DB: suite.Pool()}
	factory := suite.Factory()

	user := factory.NewUser().Create()
	game := factory.NewGame().WithGM(user.ID).Create()

	t.Run("allows deletion when phase has no content", func(t *testing.T) {
		phase := factory.NewPhase().InGame(game).CommonRoom().Create()

		err := phaseService.CanDeletePhase(context.Background(), phase.ID)
		assert.NoError(t, err, "should allow deletion of empty phase")
	})

	t.Run("blocks deletion when phase has action submissions", func(t *testing.T) {
		phase := factory.NewPhase().InGame(game).ActionPhase().Create()
		player := factory.NewUser().Create()

		// Create action submission
		factory.NewActionSubmission().
			InGame(game).
			ByUser(player).
			InPhase(phase).
			Create()

		err := phaseService.CanDeletePhase(context.Background(), phase.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "action submission(s) exist")
	})

	t.Run("returns descriptive error with count", func(t *testing.T) {
		phase := factory.NewPhase().InGame(game).ActionPhase().Create()
		player1 := factory.NewUser().Create()
		player2 := factory.NewUser().Create()

		// Create multiple action submissions
		factory.NewActionSubmission().InGame(game).InPhase(phase).ByUser(player1).Create()
		factory.NewActionSubmission().InGame(game).InPhase(phase).ByUser(player2).Create()

		err := phaseService.CanDeletePhase(context.Background(), phase.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "2 action submission(s)")
	})
}
